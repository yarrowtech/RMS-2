
"""
vendor_routes.py
==================
⚠️ SCHEMA CHANGE — vendor identity is now separate from tenant membership.

Previously: vendors_collection had ONE document per vendor, with a single
tenant_id + status + vendor_code baked directly onto it. A vendor could
only ever belong to one retailer.

Now: vendors_collection holds only IDENTITY — name, contact info, PAN/GST,
email + password for login. A NEW collection, vendor_tenant_links_collection,
holds one document per (vendor_id, tenant_id) pair — that's where status
(Pending/Approved/Rejected), source (invite_link/self_registration/
walkin_po_self_register), vendor_code, division/section/department, and
approval timestamps now live. A vendor with relationships to both Citimart
and Zudio has ONE identity document and TWO link documents — one login,
multiple retailers, each with its own independent approval status.

REQUIRED — add to db.py:
    vendor_tenant_links_collection = db["vendor_tenant_links"]

Recommended index (uniqueness + fast lookups):
    await vendor_tenant_links_collection.create_index(
        [("vendor_id", 1), ("tenant_id", 1)], unique=True
    )

MIGRATION: existing vendor documents (from before this change) still carry
tenant_id/status/vendor_code directly on the vendors_collection doc. See
migrate_vendor_tenant_links.py — it must run once, before deploying this
file, to split every existing vendor document into an identity doc + a
link doc. Until that migration runs, existing vendors will have no link
document and will not appear in any tenant's pending/approved lists.

FRONTEND IMPACT: none required. The `id` field returned by /pending and
/approved is now the LINK's _id (not the vendor identity's _id) — this is
deliberate, so that Vendors.jsx's existing approve/reject/delete/deactivate
calls (which just pass back whatever `_id` they were given) transparently
operate on the correct per-tenant relationship without any frontend change.
RegisterVendor.jsx also needs no change — "vendor already registered" logic
now means "already has a link with THIS tenant", not "email exists anywhere".
"""
'''
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from bson import ObjectId
from jose import jwt
from datetime import datetime, timedelta
from ..db import (
    vendors_collection,
    vendor_tenant_links_collection,
    product_mapping_collection,
    vendor_invites_collection,
    questionnaire_collection,
    tenants_collection,
)
from ..config import settings, frontend_url
from ..utils import hash_password, verify_password
from ..email_utils import (
    send_vendor_confirmation_email,
    send_vendor_invite_email,
    send_questionnaire_received_email,
)
from fastapi import Form, File, UploadFile, Depends, Header
from typing import List, Optional
import cloudinary
import cloudinary.uploader
import re
from .deps import get_hq_tenant
from ..db import admins_collection

vendor_bp = APIRouter(prefix="/api/vendors", tags=["Vendors"])

SECRET_KEY = settings.secret_key
ALGORITHM = "HS256"


def serialize_doc(doc):
    doc = dict(doc)
    doc["_id"] = str(doc["_id"])
    return doc


def create_token(data: dict, expires_in: int = 3600):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(seconds=expires_in)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.JWTError:
        return None


async def find_best_mapping(product_type: str, tenant_id: str):
    mapping = await product_mapping_collection.find_one({
        "tenant_id": tenant_id,
        "$expr": {"$eq": [{"$toLower": "$product_type"}, product_type.lower()]}
    })
    if mapping:
        return mapping
    mapping = await product_mapping_collection.find_one({
        "tenant_id": tenant_id,
        "product_type": {"$regex": product_type, "$options": "i"}
    })
    if mapping:
        return mapping
    words = product_type.lower().split()
    for w in words:
        mapping = await product_mapping_collection.find_one({
            "tenant_id": tenant_id,
            "product_type": {"$regex": w, "$options": "i"}
        })
        if mapping:
            return mapping
    return None


# ── Link/identity join helper ──────────────────────────────────────────────
# Every route that lists vendors for an HQ admin needs to show the SAME
# response shape the frontend already expects (name, brandName, email,
# status, source, vendor_code, etc.) — but that data now spans two
# documents. This merges a link doc with its identity doc into one flat
# dict, with "_id" set to the LINK's id (see FRONTEND IMPACT note above).

async def _merge_link_with_identity(link: dict, vendor: dict) -> dict:
    merged = {
        **{k: v for k, v in vendor.items() if k not in ("_id", "password")},
        **{k: v for k, v in link.items() if k != "_id"},
        "_id":        link["_id"],          # LINK id — what the frontend acts on
        "vendor_id":  str(vendor["_id"]),   # identity id, exposed for reference
    }
    return serialize_doc(merged)


# ---------------- Vendor APIs ----------------

@vendor_bp.post("/register")
async def register_vendor(request: Request):
    """
    Register a new vendor — creates or reuses a vendor IDENTITY, and always
    creates a new PENDING relationship LINK for the resolved tenant.

    Public route — no HQ auth, since the vendor doesn't have an account yet.
    tenant_id CANNOT come from a JWT here. Two ways it can be resolved:

      1. INVITE-LINK path: token in the body → tenant_id comes from
         vendor_invites_collection.
      2. SELF-REGISTRATION path: no token → the frontend sends an explicit
         `tenant_id`, chosen by the vendor from the public retailer list
         (GET /api/tenants/public), validated against tenants_collection.

    MULTI-TENANT BEHAVIOR (new): if a vendor identity with this email
    already exists (e.g. they're already approved with Citimart and are
    now registering with Zudio), we do NOT reject with "already
    registered" — we reuse the existing identity and create a new link for
    the new tenant. Registration is only rejected if a link for THIS
    SPECIFIC (vendor, tenant) pair already exists.
    """
    body  = await request.json()
    email = (body.get("email") or "").strip().lower()
    token = (body.get("token") or "").strip()
    selected_tenant_id = (body.get("tenant_id") or "").strip()

    if not email:
        raise HTTPException(status_code=400, detail="Email is required.")

    # ── Resolve tenant_id — invite first, then explicit self-registration pick ──
    tenant_id = None
    source    = "self_registration"

    if token:
        invite = await vendor_invites_collection.find_one({"token": token})
        if invite:
            tenant_id = invite.get("tenant_id")
            source    = "invite_link"

    if not tenant_id and selected_tenant_id:
        tenant = await tenants_collection.find_one({"tenant_id": selected_tenant_id})
        if not tenant:
            raise HTTPException(status_code=400, detail="Selected retailer was not found.")
        tenant_id = selected_tenant_id
        source    = "self_registration"

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Please select a retailer to register with, or use a valid invite link. "
                   "Cannot determine which retailer this vendor is registering for."
        )

    # ── Resolve identity: reuse if this email already has one, else create ──
    identity = await vendors_collection.find_one({"email": email})

    if identity:
        existing_link = await vendor_tenant_links_collection.find_one({
            "vendor_id": identity["_id"],
            "tenant_id": tenant_id,
        })
        if existing_link:
            raise HTTPException(
                status_code=400,
                detail="This vendor is already registered with this retailer."
            )
        vendor_id = identity["_id"]
    else:
        identity_fields = [
            "name", "brandName", "companyType", "industryType",
            "ownerName", "contactName", "contactMobile", "email", "website",
            "address", "cityName", "state", "pincode", "pan",
            "gstCategory", "gstin", "gstState",
        ]
        identity_doc = {k: body.get(k) for k in identity_fields}
        identity_doc["email"]      = email
        identity_doc["password"]   = None
        identity_doc["password_set"] = False
        identity_doc["created_at"] = datetime.utcnow()
        result = await vendors_collection.insert_one(identity_doc)
        vendor_id = result.inserted_id

    # ── Create the per-tenant relationship link ───────────────────────────
    link_doc = {
        "vendor_id":   vendor_id,
        "tenant_id":   tenant_id,
        "product_type": body.get("product_type", ""),
        "division":    None,
        "section":     None,
        "department":  None,
        "status":      "Pending",
        "source":      source,   # decided server-side above, never trusted from client
        "created_at":  datetime.utcnow(),
    }
    link_result = await vendor_tenant_links_collection.insert_one(link_doc)

    return {
        "message":    "Vendor registered successfully",
        "status":     "Pending",
        "vendor_id":  str(vendor_id),
        "link_id":    str(link_result.inserted_id),
    }


@vendor_bp.get("/pending")
async def get_pending_vendors(ctx: dict = Depends(get_hq_tenant)):
    """List all vendor relationships Pending for this tenant."""
    rows = []
    async for link in vendor_tenant_links_collection.find({"status": "Pending", "tenant_id": ctx["tenant_id"]}):
        vendor = await vendors_collection.find_one({"_id": link["vendor_id"]})
        if vendor:
            rows.append(await _merge_link_with_identity(link, vendor))
    return rows


@vendor_bp.get("/approved")
async def get_approved_vendors(ctx: dict = Depends(get_hq_tenant)):
    """List all vendor relationships Approved for this tenant."""
    rows = []
    async for link in vendor_tenant_links_collection.find({"status": "Approved", "tenant_id": ctx["tenant_id"]}):
        vendor = await vendors_collection.find_one({"_id": link["vendor_id"]})
        if vendor:
            rows.append(await _merge_link_with_identity(link, vendor))
    return rows


@vendor_bp.post("/approve/{link_id}")
async def approve_vendor(
    link_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    ctx: dict = Depends(get_hq_tenant),
):
    """
    Approve a vendor-tenant relationship. `link_id` is the LINK's _id (see
    module docstring — /pending and /approved return link ids as "_id" so
    the existing frontend needs no change).

    Vendor code, division/section/department mapping, and the confirmation
    email are all scoped to THIS relationship — approving a vendor at
    Citimart has no effect on their (possibly still-Pending, or
    nonexistent) relationship with any other retailer.
    """
    body = await request.json()
    product_type = body.get("product_type")

    try:
        link = await vendor_tenant_links_collection.find_one({
            "_id": ObjectId(link_id),
            "tenant_id": ctx["tenant_id"],
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid vendor ID")

    if not link:
        raise HTTPException(status_code=404, detail="Vendor not found")

    if link.get("status") == "Approved":
        raise HTTPException(status_code=400, detail="Vendor is already approved.")

    vendor = await vendors_collection.find_one({"_id": link["vendor_id"]})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor identity not found")

    approver_name = "Unknown User"
    approver_role = "Unknown Role"
    approver_department = ctx.get("department", "Unknown Department")
    if ctx.get("admin_id"):
        approver = await admins_collection.find_one({"_id": ObjectId(ctx["admin_id"])})
        if approver:
            approver_name = approver.get("name", approver_name)
            approver_department = approver.get("department", approver_department)
            approver_role = approver.get("department", approver_role)

    mapping = await product_mapping_collection.find_one(
        {"tenant_id": ctx["tenant_id"], "product_type": {"$regex": product_type or link.get("product_type", ""), "$options": "i"}}
    )
    if mapping:
        division, section, department = mapping.get("division"), mapping.get("section"), mapping.get("department")
    else:
        division, section, department = "Uncategorized", "-", "-"

    # Vendor code — scoped per tenant, so numbering is independent per retailer
    last_link = await vendor_tenant_links_collection.find_one(
        {"vendor_code": {"$exists": True}, "tenant_id": ctx["tenant_id"]},
        sort=[("vendor_code", -1)]
    )
    if last_link and "vendor_code" in last_link:
        try:
            new_num = int(last_link["vendor_code"].split("-")[1]) + 1
        except Exception:
            new_num = 1
    else:
        new_num = 1
    vendor_code = f"VEN-{new_num:05d}"

    await vendor_tenant_links_collection.update_one(
        {"_id": link["_id"]},
        {
            "$set": {
                "status":      "Approved",
                "division":    division,
                "section":     section,
                "department":  department,
                "vendor_code": vendor_code,
                "approved_at": datetime.utcnow(),
            },
            "$push": {
                "approvals": {
                    "role": approver_role, "approved_by": approver_name,
                    "department": approver_department, "time": datetime.utcnow(),
                }
            },
        }
    )

    # Password-setup email only needed the FIRST time this identity is
    # approved anywhere — if they already set a password (approved
    # previously at another tenant), they already have login access and
    # just gained a second retailer relationship; no new setup link needed.
    if not vendor.get("password_set"):
        setup_token = create_token(
            {"vendor_id": str(vendor["_id"]), "email": vendor["email"]},
            expires_in=604800,
        )
        setup_link = frontend_url(f'merchandiser-seller/setup-password?token={setup_token}')
        background_tasks.add_task(
            send_vendor_confirmation_email,
            vendor["email"], vendor.get("name", ""), vendor.get("brandName", "Your Brand"), setup_link,
        )
        email_note = "Confirmation email sent (valid 7 days) — please set your password to log in."
    else:
        email_note = f"{vendor.get('name','This vendor')} already has login access; this retailer relationship is now live on their next login."

    return {
        "message": f"✅ Vendor {vendor_code} approved by {approver_name} ({approver_role}, {approver_department}). {email_note}",
        "vendor_code": vendor_code,
        "division": division, "section": section, "department": department,
        "approved_by": approver_name, "approved_role": approver_role, "approved_department": approver_department,
    }


@vendor_bp.post("/reject/{link_id}")
async def reject_vendor(link_id: str, ctx: dict = Depends(get_hq_tenant)):
    """Reject a pending vendor-tenant relationship (link-scoped, not identity-wide)."""
    if not ObjectId.is_valid(link_id):
        raise HTTPException(status_code=400, detail="Invalid vendor ID")

    link = await vendor_tenant_links_collection.find_one({"_id": ObjectId(link_id), "tenant_id": ctx["tenant_id"]})
    if not link:
        raise HTTPException(status_code=404, detail="Vendor not found")
    if link.get("status") == "Approved":
        raise HTTPException(status_code=400, detail="Cannot reject an already-approved vendor.")

    await vendor_tenant_links_collection.update_one(
        {"_id": ObjectId(link_id), "tenant_id": ctx["tenant_id"]},
        {"$set": {"status": "Rejected", "rejected_at": datetime.utcnow(), "rejected_by": ctx.get("admin_id")}}
    )
    return {"message": "Vendor rejected successfully."}


@vendor_bp.delete("/delete/{link_id}")
async def delete_vendor(link_id: str, ctx: dict = Depends(get_hq_tenant)):
    """
    Delete a vendor-tenant relationship. Only removes THIS tenant's
    relationship — the vendor's identity (and any other retailer's
    relationship with them) is untouched. If this was their only
    relationship anywhere, the identity document is left in place
    (harmless orphan; they simply won't appear in any tenant's list) —
    deliberately not cascading a delete into vendor identity, since that
    would risk deleting a login another tenant still depends on if this
    check raced with a concurrent registration. Safe default: leave it.
    """
    if not ObjectId.is_valid(link_id):
        raise HTTPException(status_code=400, detail="Invalid vendor ID")

    result = await vendor_tenant_links_collection.delete_one({"_id": ObjectId(link_id), "tenant_id": ctx["tenant_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return {"message": "Vendor deleted successfully."}


@vendor_bp.post("/deactivate/{link_id}")
async def deactivate_vendor(link_id: str, ctx: dict = Depends(get_hq_tenant)):
    """Deactivate an approved vendor-tenant relationship (link-scoped)."""
    if not ObjectId.is_valid(link_id):
        raise HTTPException(status_code=400, detail="Invalid vendor ID")

    link = await vendor_tenant_links_collection.find_one({"_id": ObjectId(link_id), "tenant_id": ctx["tenant_id"]})
    if not link:
        raise HTTPException(status_code=404, detail="Vendor not found")

    await vendor_tenant_links_collection.update_one(
        {"_id": ObjectId(link_id), "tenant_id": ctx["tenant_id"]},
        {"$set": {"status": "Deactivated", "deactivated_at": datetime.utcnow(), "deactivated_by": ctx.get("admin_id")}}
    )
    return {"message": "Vendor deactivated successfully."}


@vendor_bp.post("/setup-password")
async def setup_vendor_password(request: Request):
    """Set vendor password via confirmation link. Public — sets password on the IDENTITY, not any one link."""
    body = await request.json()
    token = body.get("token")
    password = body.get("password")

    decoded = decode_token(token)
    if not decoded:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    vendor_id = decoded.get("vendor_id")
    hashed = hash_password(password)

    await vendors_collection.update_one(
        {"_id": ObjectId(vendor_id)},
        {"$set": {"password": hashed, "password_set": True}},
    )
    return {"message": "Password setup successful, please login now."}


@vendor_bp.post("/login")
async def vendor_login(request: Request):
    """
    Vendor login — identity-level, not tenant-scoped. A vendor with
    relationships to multiple retailers logs in ONCE; which retailers they
    can act on is discovered via GET /api/vendors/my-tenant after login,
    not baked into the JWT. The JWT therefore carries vendor_id + email
    only — same shape as before this change, so /me, /my-purchaseorders
    etc. that decode vendor_id from the token are unaffected.

    Login succeeds if the identity has a password set AND at least one
    Approved relationship exists anywhere (being Pending/Rejected
    everywhere means there's nothing to log in and do yet).
    """
    body = await request.json()
    email = (body.get("email") or "").strip().lower()
    password = body.get("password")

    vendor = await vendors_collection.find_one({"email": email})
    if not vendor:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    has_approved = await vendor_tenant_links_collection.find_one({
        "vendor_id": vendor["_id"], "status": "Approved",
    })
    if not has_approved:
        raise HTTPException(status_code=403, detail="Vendor not approved yet by any retailer.")

    if not verify_password(password, vendor.get("password", "")):
        raise HTTPException(status_code=401, detail="Incorrect password")

    token = create_token({"vendor_id": str(vendor["_id"]), "email": vendor["email"]})
    return {
        "access_token": token,
        "vendor_id":    str(vendor["_id"]),
        "vendor_name":  vendor.get("name") or vendor.get("vendor_name") or "",
        "email":        vendor.get("email", ""),
        "redirect":     "/merchandiser-seller",
    }


@vendor_bp.get("/me")
async def get_vendor_profile(authorization: str = Header(None)):
    """Fetch logged-in vendor's IDENTITY profile. Unchanged in shape — no tenant/status fields here anymore (see /my-tenant for those, per relationship)."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization token missing")

    token = authorization.split(" ")[1]
    decoded = decode_token(token)
    if not decoded:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    vendor_id = decoded.get("vendor_id")
    if not vendor_id:
        raise HTTPException(status_code=400, detail="Invalid token payload")

    vendor = await vendors_collection.find_one({"_id": ObjectId(vendor_id)})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    vendor["_id"] = str(vendor["_id"])
    vendor.pop("password", None)
    return vendor


@vendor_bp.get("/my-tenant")
async def get_my_tenant(authorization: str = Header(None)):
    """
    Vendor-facing: returns EVERY retailer this vendor has a relationship
    with — genuinely plural now. Powers the "Retailers" tab in the vendor
    dashboard: one row per (vendor, tenant) link, each with its own status,
    vendor_code, source, and approval date, independent of the others.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization token missing")

    token = authorization.split(" ")[1]
    decoded = decode_token(token)
    if not decoded:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    vendor_id = decoded.get("vendor_id")
    if not vendor_id:
        raise HTTPException(status_code=400, detail="Invalid token payload")

    try:
        vendor_oid = ObjectId(vendor_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid token payload")

    vendor = await vendors_collection.find_one({"_id": vendor_oid})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    retailers = []
    async for link in vendor_tenant_links_collection.find({"vendor_id": vendor_oid}).sort("created_at", -1):
        tenant = await tenants_collection.find_one({"tenant_id": link.get("tenant_id")})
        retailers.append({
            "tenant_id":    link.get("tenant_id"),
            "company_name": (tenant or {}).get("company_name") or link.get("tenant_id"),
            "source":       link.get("source", ""),
            "vendor_code":  link.get("vendor_code", ""),
            "status":       link.get("status", ""),
            "division":     link.get("division"),
            "section":      link.get("section"),
            "department":   link.get("department"),
            "approved_at":  str(link.get("approved_at")) if link.get("approved_at") else None,
            "created_at":   str(link.get("created_at")) if link.get("created_at") else None,
        })

    return {"status": "success", "data": retailers}


# ------------------- VENDOR PURCHASE ORDER ROUTES -------------------
from app.db import purchaseorders_collection


@vendor_bp.get("/my-purchaseorders")
async def get_my_purchase_orders(authorization: str = Header(None)):
    """
    Vendor fetches their own POs across ALL retailer relationships. Each PO
    already carries its own tenant_id from purchaseorder_routes.py's
    tenant-scoping — this route doesn't need to filter by relationship
    status itself, since a PO could only ever have been created against a
    vendor_id in the first place by an HQ admin at that specific tenant.
    A vendor now correctly sees POs from every retailer they work with in
    one unified list, which is a natural benefit of the identity/link
    split rather than something that needed extra code here.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization token missing")

    token = authorization.split(" ")[1]
    decoded = decode_token(token)
    if not decoded:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    vendor_id = decoded.get("vendor_id")
    if not vendor_id:
        raise HTTPException(status_code=400, detail="Invalid token payload")

    vendor = await vendors_collection.find_one({"_id": ObjectId(vendor_id)})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    vendor_name = vendor.get("name") or vendor.get("vendor_name") or ""
    vendor_oid  = vendor["_id"]

    cursor = purchaseorders_collection.find({
        "$or": [
            {"vendor_id": vendor_oid},
            {"vendor_id": str(vendor_oid)},
            {"vendorName": {"$regex": f"^{vendor_name.strip()}$", "$options": "i"}},
        ]
    })

    orders = []
    async for po in cursor:
        po["id"]        = str(po["_id"])
        del po["_id"]
        po["vendor_id"] = str(po.get("vendor_id", ""))

        status = po.get("status", "")
        if status in ("SentToVendor", "WalkinAccepted"):
            vendor_items = po.get("vendor_response", {}).get("items")
            if vendor_items:
                po["items"] = vendor_items

        orders.append(po)

    # A vendor can work with more than one retailer. Resolve only the tenants
    # represented by this vendor's own POs so the portal can clearly identify
    # who raised each order without exposing any unrelated tenant information.
    tenant_ids = list({
        str(po.get("tenant_id")).strip()
        for po in orders
        if po.get("tenant_id")
    })
    retailer_names = {}
    if tenant_ids:
        tenant_cursor = tenants_collection.find(
            {"tenant_id": {"$in": tenant_ids}},
            {"tenant_id": 1, "company_name": 1},
        )
        async for tenant in tenant_cursor:
            retailer_names[str(tenant.get("tenant_id"))] = (
                tenant.get("company_name") or str(tenant.get("tenant_id"))
            )

    for po in orders:
        tenant_id = str(po.get("tenant_id") or "").strip()
        retailer_name = retailer_names.get(tenant_id)
        po["retailer_name"] = retailer_name or po.get("ownerSite") or "Retailer"
        po["buyer_name"] = (
            po.get("merchandiserName")
            or po.get("buyerName")
            or po.get("createdByName")
            or ""
        )
        po["buyer_team"] = po.get("teamName") or ""
        po["buyer_site"] = po.get("ownerSite") or po["retailer_name"]

    return orders

@vendor_bp.get("/purchaseorders/{vendor_name}")
async def get_vendor_purchase_orders(vendor_name: str):
    """Vendor: Get all assigned purchase orders — includes walkin POs. Unchanged."""
    name_pattern = re.escape(vendor_name.strip())
    vendor = await vendors_collection.find_one({
        "$or": [
            {"vendor_name": {"$regex": f"^{name_pattern}$", "$options": "i"}},
            {"name":        {"$regex": f"^{name_pattern}$", "$options": "i"}},
        ]
    })
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    vendor_oid = vendor["_id"]

    cursor = purchaseorders_collection.find({
        "$or": [
            {"vendor_id": vendor_oid},
            {"vendor_id": str(vendor_oid)},
            {"vendorName": {"$regex": f"^{vendor_name.strip()}$", "$options": "i"}},
        ]
    })

    orders = []
    async for po in cursor:
        po["id"]        = str(po["_id"])
        del po["_id"]
        po["vendor_id"] = str(po.get("vendor_id", ""))

        status = po.get("status", "")
        if status in ("SentToVendor", "WalkinAccepted"):
            vendor_items = po.get("vendor_response", {}).get("items")
            if vendor_items:
                po["items"] = vendor_items

        orders.append(po)

    # A vendor can work with more than one retailer. Resolve only the tenants
    # represented by this vendor's own POs so the portal can clearly identify
    # who raised each order without exposing any unrelated tenant information.
    tenant_ids = list({
        str(po.get("tenant_id")).strip()
        for po in orders
        if po.get("tenant_id")
    })
    retailer_names = {}
    if tenant_ids:
        tenant_cursor = tenants_collection.find(
            {"tenant_id": {"$in": tenant_ids}},
            {"tenant_id": 1, "company_name": 1},
        )
        async for tenant in tenant_cursor:
            retailer_names[str(tenant.get("tenant_id"))] = (
                tenant.get("company_name") or str(tenant.get("tenant_id"))
            )

    for po in orders:
        tenant_id = str(po.get("tenant_id") or "").strip()
        retailer_name = retailer_names.get(tenant_id)
        po["retailer_name"] = retailer_name or po.get("ownerSite") or "Retailer"
        po["buyer_name"] = (
            po.get("merchandiserName")
            or po.get("buyerName")
            or po.get("createdByName")
            or ""
        )
        po["buyer_team"] = po.get("teamName") or ""
        po["buyer_site"] = po.get("ownerSite") or po["retailer_name"]

    return orders



@vendor_bp.post("/purchaseorders/{po_id}/items")
async def vendor_add_items(po_id: str, payload: dict):
    """Vendor: Add or update items in assigned PO — includes WalkinAccepted. Unchanged."""
    query_id = ObjectId(po_id) if ObjectId.is_valid(po_id) else po_id

    po = await purchaseorders_collection.find_one({"_id": query_id})
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")

    if po.get("status") not in ["SentToVendor", "VendorSubmitted", "WalkinAccepted"]:
        raise HTTPException(
            status_code=400,
            detail=f"PO not open for vendor edits. Current status: '{po.get('status')}'"
        )

    vendor_items = payload.get("items", [])
    if not isinstance(vendor_items, list) or not vendor_items:
        raise HTTPException(status_code=400, detail="No items provided")

    vendor_section = {
        "submittedAt": datetime.utcnow(),
        "items":       vendor_items,
        "status":      "Draft",
    }

    await purchaseorders_collection.update_one(
        {"_id": query_id},
        {"$set": {"vendor_response": vendor_section, "updatedAt": datetime.utcnow()}}
    )

    return {"message": "Vendor items saved as draft"}


@vendor_bp.post("/purchaseorders/{po_id}/submit")
async def vendor_submit_po(po_id: str):
    from .purchaseorder_routes import (
        resolve_real_barcode,
        calculate_po_totals,
    )

    query_id = ObjectId(po_id) if ObjectId.is_valid(po_id) else po_id

    po = await purchaseorders_collection.find_one({"_id": query_id})
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")

    if po.get("status") not in ["SentToVendor", "VendorSubmitted", "WalkinAccepted"]:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Cannot submit: PO status is '{po.get('status')}'. "
                f"Expected SentToVendor, VendorSubmitted or WalkinAccepted."
            )
        )

    vendor_items = po.get("vendor_response", {}).get("items", [])
    if not vendor_items:
        raise HTTPException(status_code=400, detail="Vendor has not added any items yet")

    for item in vendor_items:
        item["barcode"] = await resolve_real_barcode(item)

    merged_items = list(po.get("items", []))

    bc_index: dict = {}
    for i, it in enumerate(merged_items):
        bc = (it.get("barcode") or "").strip()
        if bc:
            bc_index[bc] = i

    desc_index: dict = {}
    for i, it in enumerate(merged_items):
        desc = (it.get("description") or "").strip().lower()
        bc   = (it.get("barcode") or "").strip()
        if desc and bc.startswith("ITEM/"):
            desc_index[desc] = i

    for item in vendor_items:
        bc   = (item.get("barcode") or "").strip()
        desc = (item.get("description") or "").strip().lower()

        if bc and bc in bc_index:
            idx = bc_index[bc]
            merged_items[idx] = {
                **merged_items[idx],
                "amendedQty": item.get("quantity", merged_items[idx].get("amendedQty")),
                "rate":       item.get("rate",     merged_items[idx].get("rate")),
                "remarks":    item.get("remarks",  merged_items[idx].get("remarks", "")),
            }

        elif desc and desc in desc_index:
            idx    = desc_index[desc]
            old_bc = (merged_items[idx].get("barcode") or "").strip()
            merged_items[idx] = {
                **merged_items[idx],
                "barcode":    bc,
                "amendedQty": item.get("quantity", merged_items[idx].get("amendedQty")),
                "rate":       item.get("rate",     merged_items[idx].get("rate")),
                "remarks":    item.get("remarks",  merged_items[idx].get("remarks", "")),
                "removed":    False,
            }
            if old_bc in bc_index:
                del bc_index[old_bc]
            bc_index[bc] = idx
            del desc_index[desc]

        elif bc:
            merged_items.append(item)
            bc_index[bc] = len(merged_items) - 1

        else:
            merged_items.append(item)

    real_barcodes_desc = {
        (it.get("description") or "").strip().lower()
        for it in merged_items
        if not (it.get("barcode") or "").startswith("ITEM/")
    }
    merged_items = [
        it for it in merged_items
        if not (
            (it.get("barcode") or "").startswith("ITEM/") and
            (it.get("description") or "").strip().lower() in real_barcodes_desc
        )
    ]

    po_dict = dict(po)
    po_dict["items"] = merged_items
    calculate_po_totals(po_dict)

    await purchaseorders_collection.update_one(
        {"_id": query_id},
        {"$set": {
            "status":                      "VendorSubmitted",
            "items":                       merged_items,
            "netAmount":                   po_dict["netAmount"],
            "basicValue":                  po_dict["basicValue"],
            "taxAmount":                   po_dict["taxAmount"],
            "grossAmount":                 po_dict["grossAmount"],
            "vendor_response.status":      "Submitted",
            "vendor_response.submittedAt": datetime.utcnow().isoformat(),
            "updatedAt":                   datetime.utcnow(),
        }}
    )

    return {"message": "PO submitted successfully. M-Buyer will review your submission."}


@vendor_bp.post("/invite")
async def create_vendor_invite(request: Request, ctx: dict = Depends(get_hq_tenant)):
    """HQ creates an invite link for a new vendor. Unaffected by the identity/link split — an invite has no vendor identity yet; tenant_id lives on the invite itself, exactly as before."""
    import secrets as _secrets
    body = await request.json()

    company_name     = (body.get("company_name") or body.get("companyName", "")).strip()
    contact_name     = (body.get("contact_person") or body.get("contactName", "")).strip()
    mobile           = body.get("mobile", "").strip()
    email            = (body.get("email") or "").strip()
    product_category = (body.get("product_type") or body.get("productCategory", "")).strip()
    expires_in_days  = int(body.get("expiresInDays", 7))

    if not company_name or not mobile:
        raise HTTPException(status_code=400, detail="company_name and mobile are required.")

    raw_token = _secrets.token_urlsafe(24)

    invite_doc = {
        "token":           raw_token,
        "companyName":     company_name,
        "contactName":     contact_name,
        "mobile":          mobile,
        "email":           email,
        "productCategory": product_category,
        "status":          "Pending",
        "created_by":      ctx.get("admin_id", "M-Buyer"),
        "tenant_id":       ctx["tenant_id"],
        "created_at":      datetime.utcnow(),
        "expires_at":      datetime.utcnow() + timedelta(days=expires_in_days),
        "vendor_id":       None,
    }

    await vendor_invites_collection.insert_one(invite_doc)
    return {
        "message":    "Invite created successfully",
        "token":      raw_token,
        "expires_at": invite_doc["expires_at"].isoformat(),
    }


@vendor_bp.get("/register-by-token")
async def get_invite_by_token(token: str):
    """Called by the vendor registration page on load. Public, unaffected by the identity/link split."""
    invite = await vendor_invites_collection.find_one({"token": token})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite link is invalid or has expired.")

    if invite.get("status") == "Registered":
        raise HTTPException(status_code=400, detail="This invite link has already been used.")

    if invite.get("status") == "Expired" or datetime.utcnow() > invite["expires_at"]:
        await vendor_invites_collection.update_one(
            {"token": token}, {"$set": {"status": "Expired"}}
        )
        raise HTTPException(status_code=400, detail="This invite link has expired.")

    return {
        "companyName":     invite["companyName"],
        "contactName":     invite["contactName"],
        "mobile":          invite["mobile"],
        "email":           invite.get("email", ""),
        "productCategory": invite.get("productCategory", ""),
        "expiresAt":       invite["expires_at"].isoformat(),
    }


@vendor_bp.post("/register-by-token")
async def complete_invite_registration(request: Request):
    """
    Mark an invite token as Registered and link it to the new vendor_id.
    Public — unaffected structurally; still marks the invite used and tags
    the resulting vendor. "source": "invite_link" already lives on the
    LINK document (set during /register), not here.
    """
    body      = await request.json()
    token     = body.get("token", "").strip()
    vendor_id = body.get("vendor_id", "").strip()

    if not token or not vendor_id:
        raise HTTPException(status_code=400, detail="token and vendor_id are required.")

    invite = await vendor_invites_collection.find_one({"token": token})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found.")

    await vendor_invites_collection.update_one(
        {"token": token},
        {"$set": {
            "status":      "Registered",
            "vendor_id":   vendor_id,
            "registered_at": datetime.utcnow(),
        }}
    )

    return {"message": "Invite marked as registered."}


# ── Questionnaire (public lead capture, pre-vendor) — unaffected structurally ─

@vendor_bp.post("/questionnaire")
async def submit_questionnaire(
    vendorName:          str              = Form(...),
    contactPerson:       str              = Form(""),
    phoneNumber:         str              = Form(""),
    cityLocation:        str              = Form(""),
    businessType:        str              = Form(""),
    productCategory:     str              = Form(""),
    vendorQuality:       int              = Form(0),
    moq:                 str              = Form(""),
    priceRange:          str              = Form(""),
    leadTime:            str              = Form(""),
    paymentTerms:        str              = Form(""),
    brandSection:        str              = Form(""),
    onlineCollaboration: str              = Form(""),
    email:               str              = Form(""),
    images:              List[UploadFile] = File([]),
):
    """No auth required — public-facing lead capture form, no vendor identity created here."""
    vendorName = vendorName.strip()
    if not vendorName:
        raise HTTPException(status_code=400, detail="vendorName is required.")

    image_urls: List[str] = []
    for img in images:
        if not img or not img.filename:
            continue
        try:
            raw    = await img.read()
            result = cloudinary.uploader.upload(
                raw,
                folder="vendor_questionnaire",
                resource_type="auto",
                public_id=f"{phoneNumber}_{img.filename}".replace(" ", "_"),
                overwrite=True,
            )
            image_urls.append(result["secure_url"])
        except Exception as e:
            print(f"⚠️ Cloudinary upload failed for {img.filename}: {e}")

    submission = {
        "vendorName":          vendorName,
        "contactPerson":       contactPerson.strip(),
        "phoneNumber":         phoneNumber.strip(),
        "email":               email.strip().lower(),
        "cityLocation":        cityLocation.strip(),
        "businessType":        businessType.strip(),
        "productCategory":     productCategory.strip(),
        "vendorQuality":       vendorQuality,
        "moq":                 moq.strip(),
        "priceRange":          priceRange.strip(),
        "leadTime":            leadTime.strip(),
        "paymentTerms":        paymentTerms.strip(),
        "brandSection":        brandSection.strip(),
        "onlineCollaboration": onlineCollaboration.strip(),
        "images":              image_urls,
        "images_count":        len(image_urls),
        "read":                False,
        "status":              "Pending",
        "submittedAt":         datetime.utcnow(),
        "invite_token":        None,
        # ⚠️ Same known gap as before this change — this public form still
        # has no tenant identifier. Not something the identity/link split
        # fixes on its own; it needs the tenant-scoped-link design flagged
        # earlier in this conversation.
    }

    result = await questionnaire_collection.insert_one(submission)

    vendor_email = email.strip().lower()
    if vendor_email:
        try:
            await send_questionnaire_received_email(
                vendor_email, vendorName, contactPerson.strip() or vendorName,
            )
        except Exception as e:
            print(f"⚠️ Questionnaire ack email failed for {vendor_email}: {e}")

    return {
        "message":       "Questionnaire submitted successfully. We will be in touch soon.",
        "submission_id": str(result.inserted_id),
        "images_saved":  len(image_urls),
    }


@vendor_bp.get("/questionnaire-submissions")
async def get_questionnaire_submissions(ctx: dict = Depends(get_hq_tenant)):
    """Unaffected by this change — see known gap noted in submit_questionnaire above."""
    submissions = await questionnaire_collection.find(
        {}, sort=[("submittedAt", -1)]
    ).to_list(100)
    return [serialize_doc(s) for s in submissions]


@vendor_bp.patch("/questionnaire-submissions/{submission_id}/read")
async def mark_submission_read(submission_id: str, ctx: dict = Depends(get_hq_tenant)):
    if not ObjectId.is_valid(submission_id):
        raise HTTPException(status_code=400, detail="Invalid submission ID.")
    result = await questionnaire_collection.update_one(
        {"_id": ObjectId(submission_id)}, {"$set": {"read": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Submission not found.")
    return {"message": "Marked as read."}


@vendor_bp.post("/questionnaire-submissions/{submission_id}/accept")
async def accept_questionnaire_submission(
    submission_id: str,
    request: Request,
    ctx: dict = Depends(get_hq_tenant),
):
    """Generates an invite (tenant-scoped) from an accepted questionnaire. Unaffected structurally — still produces an invite, not a vendor identity directly."""
    if not ObjectId.is_valid(submission_id):
        raise HTTPException(status_code=400, detail="Invalid submission ID.")

    submission = await questionnaire_collection.find_one({"_id": ObjectId(submission_id)})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found.")

    if submission.get("status") == "Accepted":
        existing_invite = await vendor_invites_collection.find_one({"submission_id": submission_id})
        if existing_invite:
            return {
                "message":   "Already accepted. Returning existing invite token.",
                "token":     existing_invite["token"],
                "expiresAt": existing_invite["expires_at"].isoformat(),
            }

    accepted_by = ctx.get("admin_id", "M-Buyer")

    import secrets
    raw_token = secrets.token_urlsafe(16)

    invite_doc = {
        "token":           raw_token,
        "companyName":     submission.get("vendorName", ""),
        "contactName":     submission.get("contactPerson", ""),
        "mobile":          submission.get("phoneNumber", ""),
        "email":           "",
        "productCategory": submission.get("productCategory", ""),
        "status":          "Pending",
        "source":          "questionnaire",
        "submission_id":   submission_id,
        "created_by":      accepted_by,
        "tenant_id":       ctx["tenant_id"],
        "created_at":      datetime.utcnow(),
        "expires_at":      datetime.utcnow() + timedelta(days=7),
        "vendor_id":       None,
    }

    await vendor_invites_collection.insert_one(invite_doc)

    await questionnaire_collection.update_one(
        {"_id": ObjectId(submission_id)},
        {"$set": {
            "status": "Accepted", "read": True, "accepted_by": accepted_by,
            "accepted_at": datetime.utcnow(), "invite_token": raw_token,
        }}
    )

    return {
        "message":   "Questionnaire accepted. Invite link generated.",
        "token":     raw_token,
        "expiresAt": invite_doc["expires_at"].isoformat(),
    }


@vendor_bp.patch("/questionnaire-submissions/{submission_id}/dismiss")
async def dismiss_questionnaire_submission(submission_id: str, ctx: dict = Depends(get_hq_tenant)):
    if not ObjectId.is_valid(submission_id):
        raise HTTPException(status_code=400, detail="Invalid submission ID.")
    result = await questionnaire_collection.update_one(
        {"_id": ObjectId(submission_id)}, {"$set": {"status": "Dismissed", "read": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Submission not found.")
    return {"message": "Submission dismissed."}


@vendor_bp.get("/invites")
async def list_invites(ctx: dict = Depends(get_hq_tenant)):
    """Returns invite links for the caller's own tenant only."""
    invites = await vendor_invites_collection.find(
        {"tenant_id": ctx["tenant_id"]}, sort=[("created_at", -1)]
    ).to_list(200)
    return [serialize_doc(i) for i in invites]


@vendor_bp.post("/send-invite-email")
async def send_invite_email(
    request: Request,
    background_tasks: BackgroundTasks,
    ctx: dict = Depends(get_hq_tenant),
):
    body         = await request.json()
    email        = body.get("email", "").strip()
    contact_name = body.get("contact_name", "Vendor").strip()
    company_name = body.get("company_name", "").strip()
    invite_link  = body.get("invite_link", "").strip()

    if not email:
        raise HTTPException(status_code=400, detail="Email is required.")
    if not invite_link:
        raise HTTPException(status_code=400, detail="Invite link is required.")

    background_tasks.add_task(
        send_vendor_invite_email, email, contact_name, company_name, invite_link,
    )
    return {"message": f"Invite email sent to {email}"}
'''



"""
vendor_routes.py
==================
⚠️ SCHEMA CHANGE — vendor identity is now separate from tenant membership.

Previously: vendors_collection had ONE document per vendor, with a single
tenant_id + status + vendor_code baked directly onto it. A vendor could
only ever belong to one retailer.

Now: vendors_collection holds only IDENTITY — name, contact info, PAN/GST,
email + password for login. A NEW collection, vendor_tenant_links_collection,
holds one document per (vendor_id, tenant_id) pair — that's where status
(Pending/Approved/Rejected), source (invite_link/self_registration/
walkin_po_self_register), vendor_code, division/section/department, and
approval timestamps now live. A vendor with relationships to both Citimart
and Zudio has ONE identity document and TWO link documents — one login,
multiple retailers, each with its own independent approval status.

REQUIRED — add to db.py:
    vendor_tenant_links_collection = db["vendor_tenant_links"]

Recommended index (uniqueness + fast lookups):
    await vendor_tenant_links_collection.create_index(
        [("vendor_id", 1), ("tenant_id", 1)], unique=True
    )

MIGRATION: existing vendor documents (from before this change) still carry
tenant_id/status/vendor_code directly on the vendors_collection doc. See
migrate_vendor_tenant_links.py — it must run once, before deploying this
file, to split every existing vendor document into an identity doc + a
link doc. Until that migration runs, existing vendors will have no link
document and will not appear in any tenant's pending/approved lists.

FRONTEND IMPACT: none required. The `id` field returned by /pending and
/approved is now the LINK's _id (not the vendor identity's _id) — this is
deliberate, so that Vendors.jsx's existing approve/reject/delete/deactivate
calls (which just pass back whatever `_id` they were given) transparently
operate on the correct per-tenant relationship without any frontend change.
RegisterVendor.jsx also needs no change — "vendor already registered" logic
now means "already has a link with THIS tenant", not "email exists anywhere".
"""

from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from bson import ObjectId
from jose import jwt
from datetime import datetime, timedelta
from ..db import (
    vendors_collection,
    vendor_tenant_links_collection,
    product_mapping_collection,
    vendor_invites_collection,
    questionnaire_collection,
    tenants_collection,
)
from ..config import settings, frontend_url
from ..utils import hash_password, verify_password
from ..email_utils import (
    send_vendor_confirmation_email,
    send_vendor_invite_email,
    send_questionnaire_received_email,
)
from fastapi import Form, File, UploadFile, Depends, Header
from typing import List, Optional
import cloudinary
import cloudinary.uploader

from .deps import get_hq_tenant
from ..db import admins_collection

vendor_bp = APIRouter(prefix="/api/vendors", tags=["Vendors"])

SECRET_KEY = settings.secret_key
ALGORITHM = "HS256"


def serialize_doc(doc):
    doc = dict(doc)
    doc["_id"] = str(doc["_id"])
    return doc


def create_token(data: dict, expires_in: int = 3600):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(seconds=expires_in)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.JWTError:
        return None


async def find_best_mapping(product_type: str, tenant_id: str):
    mapping = await product_mapping_collection.find_one({
        "tenant_id": tenant_id,
        "$expr": {"$eq": [{"$toLower": "$product_type"}, product_type.lower()]}
    })
    if mapping:
        return mapping
    mapping = await product_mapping_collection.find_one({
        "tenant_id": tenant_id,
        "product_type": {"$regex": product_type, "$options": "i"}
    })
    if mapping:
        return mapping
    words = product_type.lower().split()
    for w in words:
        mapping = await product_mapping_collection.find_one({
            "tenant_id": tenant_id,
            "product_type": {"$regex": w, "$options": "i"}
        })
        if mapping:
            return mapping
    return None


# ── Link/identity join helper ──────────────────────────────────────────────
# Every route that lists vendors for an HQ admin needs to show the SAME
# response shape the frontend already expects (name, brandName, email,
# status, source, vendor_code, etc.) — but that data now spans two
# documents. This merges a link doc with its identity doc into one flat
# dict, with "_id" set to the LINK's id (see FRONTEND IMPACT note above).

async def _merge_link_with_identity(link: dict, vendor: dict) -> dict:
    merged = {
        **{k: v for k, v in vendor.items() if k not in ("_id", "password")},
        **{k: v for k, v in link.items() if k != "_id"},
        "_id":        link["_id"],          # LINK id — what the frontend acts on
        "vendor_id":  str(vendor["_id"]),   # identity id, exposed for reference
    }
    return serialize_doc(merged)


# ---------------- Vendor APIs ----------------

@vendor_bp.post("/register")
async def register_vendor(request: Request):
    """
    Register a new vendor — creates or reuses a vendor IDENTITY, and always
    creates a new PENDING relationship LINK for the resolved tenant.

    Public route — no HQ auth, since the vendor doesn't have an account yet.
    tenant_id CANNOT come from a JWT here. Two ways it can be resolved:

      1. INVITE-LINK path: token in the body → tenant_id comes from
         vendor_invites_collection.
      2. SELF-REGISTRATION path: no token → the frontend sends an explicit
         `tenant_id`, chosen by the vendor from the public retailer list
         (GET /api/tenants/public), validated against tenants_collection.

    MULTI-TENANT BEHAVIOR (new): if a vendor identity with this email
    already exists (e.g. they're already approved with Citimart and are
    now registering with Zudio), we do NOT reject with "already
    registered" — we reuse the existing identity and create a new link for
    the new tenant. Registration is only rejected if a link for THIS
    SPECIFIC (vendor, tenant) pair already exists.
    """
    body  = await request.json()
    email = (body.get("email") or "").strip().lower()
    token = (body.get("token") or "").strip()
    selected_tenant_id = (body.get("tenant_id") or "").strip()

    if not email:
        raise HTTPException(status_code=400, detail="Email is required.")

    # ── Resolve tenant_id — invite first, then explicit self-registration pick ──
    tenant_id = None
    source    = "self_registration"

    if token:
        invite = await vendor_invites_collection.find_one({"token": token})
        if invite:
            tenant_id = invite.get("tenant_id")
            source    = "invite_link"

    if not tenant_id and selected_tenant_id:
        tenant = await tenants_collection.find_one({"tenant_id": selected_tenant_id})
        if not tenant:
            raise HTTPException(status_code=400, detail="Selected retailer was not found.")
        tenant_id = selected_tenant_id
        source    = "self_registration"

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Please select a retailer to register with, or use a valid invite link. "
                   "Cannot determine which retailer this vendor is registering for."
        )

    # ── Resolve identity: reuse if this email already has one, else create ──
    identity = await vendors_collection.find_one({"email": email})

    # ⚠️ FIXED BUG: RegisterVendor.jsx's invite-link path collects a
    # password at registration time (its "Set Your Password" section only
    # renders when a token is present). This route previously discarded it
    # entirely — new identities always got password=None, password_set=
    # False, no matter what was submitted. That meant approve_vendor's
    # check ("does this identity already have a password?") always came
    # back False for invite-registered vendors too, so approval kept
    # sending a redundant "please set your password" email/prompt even
    # though the vendor had already set one. Now: if a password was
    # submitted, hash and store it immediately, and mark password_set=True
    # so approval correctly skips the redundant step.
    submitted_password = body.get("password")

    # Capture one primary classification at onboarding. Additional tags are
    # managed later from My Categories according to the subscription plan.
    raw_business_type = body.get("business_type") or []
    if isinstance(raw_business_type, str):
        raw_business_type = [raw_business_type]
    if not isinstance(raw_business_type, list):
        raise HTTPException(status_code=400, detail="business_type must be an array.")
    registration_business_types = list(dict.fromkeys(
        value.strip().lower() for value in raw_business_type
        if isinstance(value, str) and value.strip()
    ))
    invalid_business_types = set(registration_business_types) - VALID_BUSINESS_TYPES
    if invalid_business_types:
        raise HTTPException(status_code=400, detail=f"Invalid business type: {sorted(invalid_business_types)}")
    if len(registration_business_types) > 1:
        raise HTTPException(status_code=400, detail="Choose one primary business type during registration.")

    # Invite registration remains locked to its invitation tenant. Public
    # self-registration may request several retailer relationships at once.
    if token:
        tenant_ids = [tenant_id]
    else:
        raw_tenant_ids = body.get("tenant_ids") or [tenant_id]
        if not isinstance(raw_tenant_ids, list):
            raise HTTPException(status_code=400, detail="tenant_ids must be an array.")
        tenant_ids = list(dict.fromkeys(
            value.strip() for value in raw_tenant_ids
            if isinstance(value, str) and value.strip()
        ))
        if not tenant_ids:
            raise HTTPException(status_code=400, detail="Select at least one retailer.")
        valid_tenant_count = await tenants_collection.count_documents({
            "tenant_id": {"$in": tenant_ids},
            "status": {"$ne": "suspended"},
        })
        if valid_tenant_count != len(tenant_ids):
            raise HTTPException(status_code=400, detail="One or more selected retailers are unavailable.")

    if identity:
        existing_link = await vendor_tenant_links_collection.find_one({
            "vendor_id": identity["_id"],
            "tenant_id": {"$in": tenant_ids},
        })
        if existing_link:
            raise HTTPException(
                status_code=400,
                detail="This vendor is already registered with one of the selected retailers."
            )
        vendor_id = identity["_id"]

        # Only fill in a password if this identity doesn't already have one.
        # Never overwrite an existing password from this unauthenticated
        # endpoint — that would let anyone re-register the same email under
        # a new invite/tenant and silently take over an existing login.
        if submitted_password and not identity.get("password_set"):
            await vendors_collection.update_one(
                {"_id": identity["_id"]},
                {"$set": {
                    "password":     hash_password(submitted_password),
                    "password_set": True,
                }}
            )
        if registration_business_types and not identity.get("business_type"):
            await vendors_collection.update_one(
                {"_id": identity["_id"]},
                {"$set": {"business_type": registration_business_types}},
            )
    else:
        identity_fields = [
            "name", "brandName", "companyType", "industryType",
            "ownerName", "contactName", "contactMobile", "email", "website",
            "address", "cityName", "state", "pincode", "pan",
            "gstCategory", "gstin", "gstState",
        ]
        identity_doc = {k: body.get(k) for k in identity_fields}
        identity_doc["email"] = email
        identity_doc["business_type"] = registration_business_types

        if submitted_password:
            identity_doc["password"]     = hash_password(submitted_password)
            identity_doc["password_set"] = True
        else:
            identity_doc["password"]     = None
            identity_doc["password_set"] = False

        identity_doc["created_at"] = datetime.utcnow()
        result = await vendors_collection.insert_one(identity_doc)
        vendor_id = result.inserted_id

    # ── Create the per-tenant relationship link ───────────────────────────
    link_docs = [{
        "vendor_id": vendor_id,
        "tenant_id": selected_id,
        "product_type": body.get("product_type", ""),
        "division": None, "section": None, "department": None,
        "status": "Pending", "source": source,
        "created_at": datetime.utcnow(),
    } for selected_id in tenant_ids]
    link_result = await vendor_tenant_links_collection.insert_many(link_docs)
    link_ids = [str(link_id) for link_id in link_result.inserted_ids]

    return {
        "message":    "Vendor registered successfully",
        "status":     "Pending",
        "vendor_id":  str(vendor_id),
        "link_id":    link_ids[0],
        "link_ids":   link_ids,
        "tenant_ids": tenant_ids,
        "business_type": registration_business_types,
    }


@vendor_bp.get("/pending")
async def get_pending_vendors(ctx: dict = Depends(get_hq_tenant)):
    """List all vendor relationships Pending for this tenant."""
    rows = []
    async for link in vendor_tenant_links_collection.find({"status": "Pending", "tenant_id": ctx["tenant_id"]}):
        vendor = await vendors_collection.find_one({"_id": link["vendor_id"]})
        if vendor:
            rows.append(await _merge_link_with_identity(link, vendor))
    return rows


@vendor_bp.get("/approved")
async def get_approved_vendors(ctx: dict = Depends(get_hq_tenant)):
    """List all vendor relationships Approved for this tenant."""
    rows = []
    async for link in vendor_tenant_links_collection.find({"status": "Approved", "tenant_id": ctx["tenant_id"]}):
        vendor = await vendors_collection.find_one({"_id": link["vendor_id"]})
        if vendor:
            rows.append(await _merge_link_with_identity(link, vendor))
    return rows


@vendor_bp.post("/approve/{link_id}")
async def approve_vendor(
    link_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    ctx: dict = Depends(get_hq_tenant),
):
    """
    Approve a vendor-tenant relationship. `link_id` is the LINK's _id (see
    module docstring — /pending and /approved return link ids as "_id" so
    the existing frontend needs no change).

    Vendor code, division/section/department mapping, and the confirmation
    email are all scoped to THIS relationship — approving a vendor at
    Citimart has no effect on their (possibly still-Pending, or
    nonexistent) relationship with any other retailer.
    """
    body = await request.json()
    product_type = body.get("product_type")

    try:
        link = await vendor_tenant_links_collection.find_one({
            "_id": ObjectId(link_id),
            "tenant_id": ctx["tenant_id"],
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid vendor ID")

    if not link:
        raise HTTPException(status_code=404, detail="Vendor not found")

    if link.get("status") == "Approved":
        raise HTTPException(status_code=400, detail="Vendor is already approved.")

    vendor = await vendors_collection.find_one({"_id": link["vendor_id"]})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor identity not found")

    approver_name = "Unknown User"
    approver_role = "Unknown Role"
    approver_department = ctx.get("department", "Unknown Department")
    if ctx.get("admin_id"):
        approver = await admins_collection.find_one({"_id": ObjectId(ctx["admin_id"])})
        if approver:
            approver_name = approver.get("name", approver_name)
            approver_department = approver.get("department", approver_department)
            approver_role = approver.get("department", approver_role)

    mapping = await product_mapping_collection.find_one(
        {"tenant_id": ctx["tenant_id"], "product_type": {"$regex": product_type or link.get("product_type", ""), "$options": "i"}}
    )
    if mapping:
        division, section, department = mapping.get("division"), mapping.get("section"), mapping.get("department")
    else:
        division, section, department = "Uncategorized", "-", "-"

    # Vendor code — scoped per tenant, so numbering is independent per retailer
    last_link = await vendor_tenant_links_collection.find_one(
        {"vendor_code": {"$exists": True}, "tenant_id": ctx["tenant_id"]},
        sort=[("vendor_code", -1)]
    )
    if last_link and "vendor_code" in last_link:
        try:
            new_num = int(last_link["vendor_code"].split("-")[1]) + 1
        except Exception:
            new_num = 1
    else:
        new_num = 1
    vendor_code = f"VEN-{new_num:05d}"

    await vendor_tenant_links_collection.update_one(
        {"_id": link["_id"]},
        {
            "$set": {
                "status":      "Approved",
                "division":    division,
                "section":     section,
                "department":  department,
                "vendor_code": vendor_code,
                "approved_at": datetime.utcnow(),
            },
            "$push": {
                "approvals": {
                    "role": approver_role, "approved_by": approver_name,
                    "department": approver_department, "time": datetime.utcnow(),
                }
            },
        }
    )

    # Password-setup email only needed the FIRST time this identity is
    # approved anywhere — if they already set a password (approved
    # previously at another tenant), they already have login access and
    # just gained a second retailer relationship; no new setup link needed.
    if not vendor.get("password_set"):
        setup_token = create_token(
            {"vendor_id": str(vendor["_id"]), "email": vendor["email"]},
            expires_in=604800,
        )
        setup_link = frontend_url(f'merchandiser-seller/setup-password?token={setup_token}')
        background_tasks.add_task(
            send_vendor_confirmation_email,
            vendor["email"], vendor.get("name", ""), vendor.get("brandName", "Your Brand"), setup_link,
        )
        email_note = "Confirmation email sent (valid 7 days) — please set your password to log in."
    else:
        email_note = f"{vendor.get('name','This vendor')} already has login access; this retailer relationship is now live on their next login."

    return {
        "message": f"✅ Vendor {vendor_code} approved by {approver_name} ({approver_role}, {approver_department}). {email_note}",
        "vendor_code": vendor_code,
        "division": division, "section": section, "department": department,
        "approved_by": approver_name, "approved_role": approver_role, "approved_department": approver_department,
    }


@vendor_bp.post("/reject/{link_id}")
async def reject_vendor(link_id: str, ctx: dict = Depends(get_hq_tenant)):
    """Reject a pending vendor-tenant relationship (link-scoped, not identity-wide)."""
    if not ObjectId.is_valid(link_id):
        raise HTTPException(status_code=400, detail="Invalid vendor ID")

    link = await vendor_tenant_links_collection.find_one({"_id": ObjectId(link_id), "tenant_id": ctx["tenant_id"]})
    if not link:
        raise HTTPException(status_code=404, detail="Vendor not found")
    if link.get("status") == "Approved":
        raise HTTPException(status_code=400, detail="Cannot reject an already-approved vendor.")

    await vendor_tenant_links_collection.update_one(
        {"_id": ObjectId(link_id), "tenant_id": ctx["tenant_id"]},
        {"$set": {"status": "Rejected", "rejected_at": datetime.utcnow(), "rejected_by": ctx.get("admin_id")}}
    )
    return {"message": "Vendor rejected successfully."}


@vendor_bp.delete("/delete/{link_id}")
async def delete_vendor(link_id: str, ctx: dict = Depends(get_hq_tenant)):
    """
    Delete a vendor-tenant relationship. Only removes THIS tenant's
    relationship — the vendor's identity (and any other retailer's
    relationship with them) is untouched. If this was their only
    relationship anywhere, the identity document is left in place
    (harmless orphan; they simply won't appear in any tenant's list) —
    deliberately not cascading a delete into vendor identity, since that
    would risk deleting a login another tenant still depends on if this
    check raced with a concurrent registration. Safe default: leave it.
    """
    if not ObjectId.is_valid(link_id):
        raise HTTPException(status_code=400, detail="Invalid vendor ID")

    result = await vendor_tenant_links_collection.delete_one({"_id": ObjectId(link_id), "tenant_id": ctx["tenant_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return {"message": "Vendor deleted successfully."}


@vendor_bp.post("/deactivate/{link_id}")
async def deactivate_vendor(link_id: str, ctx: dict = Depends(get_hq_tenant)):
    """Deactivate an approved vendor-tenant relationship (link-scoped)."""
    if not ObjectId.is_valid(link_id):
        raise HTTPException(status_code=400, detail="Invalid vendor ID")

    link = await vendor_tenant_links_collection.find_one({"_id": ObjectId(link_id), "tenant_id": ctx["tenant_id"]})
    if not link:
        raise HTTPException(status_code=404, detail="Vendor not found")

    await vendor_tenant_links_collection.update_one(
        {"_id": ObjectId(link_id), "tenant_id": ctx["tenant_id"]},
        {"$set": {"status": "Deactivated", "deactivated_at": datetime.utcnow(), "deactivated_by": ctx.get("admin_id")}}
    )
    return {"message": "Vendor deactivated successfully."}


@vendor_bp.post("/setup-password")
async def setup_vendor_password(request: Request):
    """Set vendor password via confirmation link. Public — sets password on the IDENTITY, not any one link."""
    body = await request.json()
    token = body.get("token")
    password = body.get("password")

    decoded = decode_token(token)
    if not decoded:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    vendor_id = decoded.get("vendor_id")
    hashed = hash_password(password)

    await vendors_collection.update_one(
        {"_id": ObjectId(vendor_id)},
        {"$set": {"password": hashed, "password_set": True}},
    )
    return {"message": "Password setup successful, please login now."}


@vendor_bp.post("/login")
async def vendor_login(request: Request):
    """
    Vendor login — identity-level, not tenant-scoped. A vendor with
    relationships to multiple retailers logs in ONCE; which retailers they
    can act on is discovered via GET /api/vendors/my-tenant after login,
    not baked into the JWT. The JWT therefore carries vendor_id + email
    only — same shape as before this change, so /me, /my-purchaseorders
    etc. that decode vendor_id from the token are unaffected.

    Login succeeds if the identity has a password set AND at least one
    Approved relationship exists anywhere (being Pending/Rejected
    everywhere means there's nothing to log in and do yet).
    """
    body = await request.json()
    email = (body.get("email") or "").strip().lower()
    password = body.get("password")

    vendor = await vendors_collection.find_one({"email": email})
    if not vendor:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    has_approved = await vendor_tenant_links_collection.find_one({
        "vendor_id": vendor["_id"], "status": "Approved",
    })
    if not has_approved:
        raise HTTPException(status_code=403, detail="Vendor not approved yet by any retailer.")

    if not verify_password(password, vendor.get("password", "")):
        raise HTTPException(status_code=401, detail="Incorrect password")

    token = create_token({"vendor_id": str(vendor["_id"]), "email": vendor["email"]})
    return {
        "access_token": token,
        "vendor_id":    str(vendor["_id"]),
        "vendor_name":  vendor.get("name") or vendor.get("vendor_name") or "",
        "email":        vendor.get("email", ""),
        "redirect":     "/merchandiser-seller",
    }


@vendor_bp.get("/me")
async def get_vendor_profile(authorization: str = Header(None)):
    """Fetch logged-in vendor's IDENTITY profile. Unchanged in shape — no tenant/status fields here anymore (see /my-tenant for those, per relationship)."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization token missing")

    token = authorization.split(" ")[1]
    decoded = decode_token(token)
    if not decoded:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    vendor_id = decoded.get("vendor_id")
    if not vendor_id:
        raise HTTPException(status_code=400, detail="Invalid token payload")

    vendor = await vendors_collection.find_one({"_id": ObjectId(vendor_id)})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    vendor["_id"] = str(vendor["_id"])
    vendor.pop("password", None)
    return vendor


VALID_BUSINESS_TYPES = {
    "general_vendor", "wholesaler", "manufacturer", "retailer",
    "fabric_supplier", "exporter", "distributor", "job_worker",
}


@vendor_bp.patch("/me/classification")
async def update_vendor_classification(request: Request, authorization: str = Header(None)):
    """
    Vendor self-service: sets which business_type(s) they are (general vendor /
    wholesaler / manufacturer / retailer / fabric supplier / exporter /
    distributor — multi-select)
    and free-text product_categories (e.g. "casual t-shirts", "formal
    shirts"). This is what lets a buyer SEARCH vendors by category instead
    of only browsing ones they already have a relationship with — see
    catalogue_routes.py's vendor/{vendor_id} route, which is the
    per-vendor catalogue view this classification feeds into for discovery.

    Tier-limited: the number of business_type tags a vendor can hold is
    capped by their subscription (Free=1, Standard=3, Premium=unlimited —
    see subscription_routes.TIER_CONFIG). Imported lazily inside the
    function body rather than at module load time, to avoid a circular
    import — subscription_routes.py itself imports decode_token from this
    file.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization token missing")
    decoded = decode_token(authorization.split(" ")[1])
    if not decoded:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    vendor_id = decoded.get("vendor_id")
    if not vendor_id:
        raise HTTPException(status_code=400, detail="Invalid token payload")

    body = await request.json()
    business_type = body.get("business_type", [])
    product_categories = body.get("product_categories", [])

    if not isinstance(business_type, list) or not isinstance(product_categories, list):
        raise HTTPException(status_code=400, detail="business_type and product_categories must both be arrays.")

    invalid = set(business_type) - VALID_BUSINESS_TYPES
    if invalid:
        raise HTTPException(status_code=400, detail=f"Invalid business_type value(s): {sorted(invalid)}. Valid: {sorted(VALID_BUSINESS_TYPES)}")

    from .subscription_routes import get_vendor_tier  # lazy import — see docstring
    tier = await get_vendor_tier(vendor_id)
    limit = tier["business_type_limit"]
    if limit is not None and len(business_type) > limit:
        raise HTTPException(
            status_code=403,
            detail=f"Your {tier['label']} plan allows up to {limit} business type tag(s). "
                   f"You selected {len(business_type)}. Upgrade to tag more."
        )

    clean_categories = [c.strip() for c in product_categories if isinstance(c, str) and c.strip()][:50]

    await vendors_collection.update_one(
        {"_id": ObjectId(vendor_id)},
        {"$set": {
            "business_type":      business_type,
            "product_categories": clean_categories,
            "classification_updated_at": datetime.utcnow(),
        }}
    )
    return {"status": "success", "message": "Classification updated.", "business_type": business_type, "product_categories": clean_categories}


@vendor_bp.get("/my-tenant")
async def get_my_tenant(authorization: str = Header(None)):
    """
    Vendor-facing: returns EVERY retailer this vendor has a relationship
    with — genuinely plural now. Powers the "Retailers" tab in the vendor
    dashboard: one row per (vendor, tenant) link, each with its own status,
    vendor_code, source, and approval date, independent of the others.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization token missing")

    token = authorization.split(" ")[1]
    decoded = decode_token(token)
    if not decoded:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    vendor_id = decoded.get("vendor_id")
    if not vendor_id:
        raise HTTPException(status_code=400, detail="Invalid token payload")

    try:
        vendor_oid = ObjectId(vendor_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid token payload")

    vendor = await vendors_collection.find_one({"_id": vendor_oid})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    retailers = []
    async for link in vendor_tenant_links_collection.find({"vendor_id": vendor_oid}).sort("created_at", -1):
        tenant = await tenants_collection.find_one({"tenant_id": link.get("tenant_id")})
        retailers.append({
            "tenant_id":    link.get("tenant_id"),
            "company_name": (tenant or {}).get("company_name") or link.get("tenant_id"),
            "source":       link.get("source", ""),
            "vendor_code":  link.get("vendor_code", ""),
            "status":       link.get("status", ""),
            "division":     link.get("division"),
            "section":      link.get("section"),
            "department":   link.get("department"),
            "approved_at":  str(link.get("approved_at")) if link.get("approved_at") else None,
            "created_at":   str(link.get("created_at")) if link.get("created_at") else None,
        })

    return {"status": "success", "data": retailers}


# ------------------- VENDOR PURCHASE ORDER ROUTES -------------------
from app.db import purchaseorders_collection


@vendor_bp.get("/my-purchaseorders")
async def get_my_purchase_orders(authorization: str = Header(None)):
    """
    Vendor fetches their own POs across ALL retailer relationships. Each PO
    already carries its own tenant_id from purchaseorder_routes.py's
    tenant-scoping — this route doesn't need to filter by relationship
    status itself, since a PO could only ever have been created against a
    vendor_id in the first place by an HQ admin at that specific tenant.
    A vendor now correctly sees POs from every retailer they work with in
    one unified list, which is a natural benefit of the identity/link
    split rather than something that needed extra code here.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization token missing")

    token = authorization.split(" ")[1]
    decoded = decode_token(token)
    if not decoded:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    vendor_id = decoded.get("vendor_id")
    if not vendor_id:
        raise HTTPException(status_code=400, detail="Invalid token payload")

    vendor = await vendors_collection.find_one({"_id": ObjectId(vendor_id)})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    vendor_name = vendor.get("name") or vendor.get("vendor_name") or ""
    vendor_oid  = vendor["_id"]

    cursor = purchaseorders_collection.find({
        "$or": [
            {"vendor_id": vendor_oid},
            {"vendor_id": str(vendor_oid)},
            {"vendorName": {"$regex": f"^{vendor_name.strip()}$", "$options": "i"}},
        ]
    })

    orders = []
    async for po in cursor:
        po["id"]        = str(po["_id"])
        del po["_id"]
        po["vendor_id"] = str(po.get("vendor_id", ""))

        status = po.get("status", "")
        if status in ("SentToVendor", "WalkinAccepted"):
            vendor_items = po.get("vendor_response", {}).get("items")
            if vendor_items:
                po["items"] = vendor_items

        orders.append(po)

    return orders


@vendor_bp.get("/purchaseorders/{vendor_name}")
async def get_vendor_purchase_orders(vendor_name: str):
    """Vendor: Get all assigned purchase orders — includes walkin POs. Unchanged."""
    vendor = await vendors_collection.find_one({
        "$or": [{"vendor_name": vendor_name}, {"name": vendor_name}]
    })
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    vendor_oid = vendor["_id"]

    cursor = purchaseorders_collection.find({
        "$or": [
            {"vendor_id": vendor_oid},
            {"vendor_id": str(vendor_oid)},
            {"vendorName": {"$regex": f"^{vendor_name.strip()}$", "$options": "i"}},
        ]
    })

    orders = []
    async for po in cursor:
        po["id"]        = str(po["_id"])
        del po["_id"]
        po["vendor_id"] = str(po.get("vendor_id", ""))

        status = po.get("status", "")
        if status in ("SentToVendor", "WalkinAccepted"):
            vendor_items = po.get("vendor_response", {}).get("items")
            if vendor_items:
                po["items"] = vendor_items

        orders.append(po)

    return orders


@vendor_bp.post("/purchaseorders/{po_id}/items")
async def vendor_add_items(po_id: str, payload: dict):
    """Vendor: Add or update items in assigned PO — includes WalkinAccepted. Unchanged."""
    query_id = ObjectId(po_id) if ObjectId.is_valid(po_id) else po_id

    po = await purchaseorders_collection.find_one({"_id": query_id})
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")

    if po.get("status") not in ["SentToVendor", "VendorSubmitted", "WalkinAccepted"]:
        raise HTTPException(
            status_code=400,
            detail=f"PO not open for vendor edits. Current status: '{po.get('status')}'"
        )

    vendor_items = payload.get("items", [])
    if not isinstance(vendor_items, list) or not vendor_items:
        raise HTTPException(status_code=400, detail="No items provided")

    vendor_section = {
        "submittedAt": datetime.utcnow(),
        "items":       vendor_items,
        "status":      "Draft",
    }

    await purchaseorders_collection.update_one(
        {"_id": query_id},
        {"$set": {"vendor_response": vendor_section, "updatedAt": datetime.utcnow()}}
    )

    return {"message": "Vendor items saved as draft"}


@vendor_bp.post("/purchaseorders/{po_id}/submit")
async def vendor_submit_po(po_id: str):
    from .purchaseorder_routes import (
        resolve_real_barcode,
        calculate_po_totals,
    )

    query_id = ObjectId(po_id) if ObjectId.is_valid(po_id) else po_id

    po = await purchaseorders_collection.find_one({"_id": query_id})
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")

    if po.get("status") not in ["SentToVendor", "VendorSubmitted", "WalkinAccepted"]:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Cannot submit: PO status is '{po.get('status')}'. "
                f"Expected SentToVendor, VendorSubmitted or WalkinAccepted."
            )
        )

    vendor_items = po.get("vendor_response", {}).get("items", [])
    if not vendor_items:
        raise HTTPException(status_code=400, detail="Vendor has not added any items yet")

    for item in vendor_items:
        item["barcode"] = await resolve_real_barcode(item)

    merged_items = list(po.get("items", []))

    bc_index: dict = {}
    for i, it in enumerate(merged_items):
        bc = (it.get("barcode") or "").strip()
        if bc:
            bc_index[bc] = i

    desc_index: dict = {}
    for i, it in enumerate(merged_items):
        desc = (it.get("description") or "").strip().lower()
        bc   = (it.get("barcode") or "").strip()
        if desc and bc.startswith("ITEM/"):
            desc_index[desc] = i

    for item in vendor_items:
        bc   = (item.get("barcode") or "").strip()
        desc = (item.get("description") or "").strip().lower()

        if bc and bc in bc_index:
            idx = bc_index[bc]
            merged_items[idx] = {
                **merged_items[idx],
                "amendedQty": item.get("quantity", merged_items[idx].get("amendedQty")),
                "rate":       item.get("rate",     merged_items[idx].get("rate")),
                "remarks":    item.get("remarks",  merged_items[idx].get("remarks", "")),
            }

        elif desc and desc in desc_index:
            idx    = desc_index[desc]
            old_bc = (merged_items[idx].get("barcode") or "").strip()
            merged_items[idx] = {
                **merged_items[idx],
                "barcode":    bc,
                "amendedQty": item.get("quantity", merged_items[idx].get("amendedQty")),
                "rate":       item.get("rate",     merged_items[idx].get("rate")),
                "remarks":    item.get("remarks",  merged_items[idx].get("remarks", "")),
                "removed":    False,
            }
            if old_bc in bc_index:
                del bc_index[old_bc]
            bc_index[bc] = idx
            del desc_index[desc]

        elif bc:
            merged_items.append(item)
            bc_index[bc] = len(merged_items) - 1

        else:
            merged_items.append(item)

    real_barcodes_desc = {
        (it.get("description") or "").strip().lower()
        for it in merged_items
        if not (it.get("barcode") or "").startswith("ITEM/")
    }
    merged_items = [
        it for it in merged_items
        if not (
            (it.get("barcode") or "").startswith("ITEM/") and
            (it.get("description") or "").strip().lower() in real_barcodes_desc
        )
    ]

    po_dict = dict(po)
    po_dict["items"] = merged_items
    calculate_po_totals(po_dict)

    await purchaseorders_collection.update_one(
        {"_id": query_id},
        {"$set": {
            "status":                      "VendorSubmitted",
            "items":                       merged_items,
            "netAmount":                   po_dict["netAmount"],
            "basicValue":                  po_dict["basicValue"],
            "taxAmount":                   po_dict["taxAmount"],
            "grossAmount":                 po_dict["grossAmount"],
            "vendor_response.status":      "Submitted",
            "vendor_response.submittedAt": datetime.utcnow().isoformat(),
            "updatedAt":                   datetime.utcnow(),
        }}
    )

    return {"message": "PO submitted successfully. M-Buyer will review your submission."}


@vendor_bp.post("/invite")
async def create_vendor_invite(request: Request, ctx: dict = Depends(get_hq_tenant)):
    """HQ creates an invite link for a new vendor. Unaffected by the identity/link split — an invite has no vendor identity yet; tenant_id lives on the invite itself, exactly as before."""
    import secrets as _secrets
    body = await request.json()

    company_name     = (body.get("company_name") or body.get("companyName", "")).strip()
    contact_name     = (body.get("contact_person") or body.get("contactName", "")).strip()
    mobile           = body.get("mobile", "").strip()
    email            = (body.get("email") or "").strip()
    product_category = (body.get("product_type") or body.get("productCategory", "")).strip()
    expires_in_days  = int(body.get("expiresInDays", 7))

    if not company_name or not mobile:
        raise HTTPException(status_code=400, detail="company_name and mobile are required.")

    raw_token = _secrets.token_urlsafe(24)

    invite_doc = {
        "token":           raw_token,
        "companyName":     company_name,
        "contactName":     contact_name,
        "mobile":          mobile,
        "email":           email,
        "productCategory": product_category,
        "status":          "Pending",
        "created_by":      ctx.get("admin_id", "M-Buyer"),
        "tenant_id":       ctx["tenant_id"],
        "created_at":      datetime.utcnow(),
        "expires_at":      datetime.utcnow() + timedelta(days=expires_in_days),
        "vendor_id":       None,
    }

    await vendor_invites_collection.insert_one(invite_doc)
    return {
        "message":    "Invite created successfully",
        "token":      raw_token,
        "expires_at": invite_doc["expires_at"].isoformat(),
    }


@vendor_bp.get("/register-by-token")
async def get_invite_by_token(token: str):
    """Called by the vendor registration page on load. Public, unaffected by the identity/link split."""
    invite = await vendor_invites_collection.find_one({"token": token})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite link is invalid or has expired.")

    if invite.get("status") == "Registered":
        raise HTTPException(status_code=400, detail="This invite link has already been used.")

    if invite.get("status") == "Expired" or datetime.utcnow() > invite["expires_at"]:
        await vendor_invites_collection.update_one(
            {"token": token}, {"$set": {"status": "Expired"}}
        )
        raise HTTPException(status_code=400, detail="This invite link has expired.")

    return {
        "companyName":     invite["companyName"],
        "contactName":     invite["contactName"],
        "mobile":          invite["mobile"],
        "email":           invite.get("email", ""),
        "productCategory": invite.get("productCategory", ""),
        "expiresAt":       invite["expires_at"].isoformat(),
    }


@vendor_bp.post("/register-by-token")
async def complete_invite_registration(request: Request):
    """
    Mark an invite token as Registered and link it to the new vendor_id.
    Public — unaffected structurally; still marks the invite used and tags
    the resulting vendor. "source": "invite_link" already lives on the
    LINK document (set during /register), not here.
    """
    body      = await request.json()
    token     = body.get("token", "").strip()
    vendor_id = body.get("vendor_id", "").strip()

    if not token or not vendor_id:
        raise HTTPException(status_code=400, detail="token and vendor_id are required.")

    invite = await vendor_invites_collection.find_one({"token": token})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found.")

    await vendor_invites_collection.update_one(
        {"token": token},
        {"$set": {
            "status":      "Registered",
            "vendor_id":   vendor_id,
            "registered_at": datetime.utcnow(),
        }}
    )

    return {"message": "Invite marked as registered."}


# ── Questionnaire (public lead capture, pre-vendor) — unaffected structurally ─

@vendor_bp.post("/questionnaire")
async def submit_questionnaire(
    vendorName:          str              = Form(...),
    contactPerson:       str              = Form(""),
    phoneNumber:         str              = Form(""),
    cityLocation:        str              = Form(""),
    businessType:        str              = Form(""),
    productCategory:     str              = Form(""),
    vendorQuality:       int              = Form(0),
    moq:                 str              = Form(""),
    priceRange:          str              = Form(""),
    leadTime:            str              = Form(""),
    paymentTerms:        str              = Form(""),
    brandSection:        str              = Form(""),
    onlineCollaboration: str              = Form(""),
    email:               str              = Form(""),
    images:              List[UploadFile] = File([]),
):
    """No auth required — public-facing lead capture form, no vendor identity created here."""
    vendorName = vendorName.strip()
    if not vendorName:
        raise HTTPException(status_code=400, detail="vendorName is required.")

    image_urls: List[str] = []
    for img in images:
        if not img or not img.filename:
            continue
        try:
            raw    = await img.read()
            result = cloudinary.uploader.upload(
                raw,
                folder="vendor_questionnaire",
                resource_type="auto",
                public_id=f"{phoneNumber}_{img.filename}".replace(" ", "_"),
                overwrite=True,
            )
            image_urls.append(result["secure_url"])
        except Exception as e:
            print(f"⚠️ Cloudinary upload failed for {img.filename}: {e}")

    submission = {
        "vendorName":          vendorName,
        "contactPerson":       contactPerson.strip(),
        "phoneNumber":         phoneNumber.strip(),
        "email":               email.strip().lower(),
        "cityLocation":        cityLocation.strip(),
        "businessType":        businessType.strip(),
        "productCategory":     productCategory.strip(),
        "vendorQuality":       vendorQuality,
        "moq":                 moq.strip(),
        "priceRange":          priceRange.strip(),
        "leadTime":            leadTime.strip(),
        "paymentTerms":        paymentTerms.strip(),
        "brandSection":        brandSection.strip(),
        "onlineCollaboration": onlineCollaboration.strip(),
        "images":              image_urls,
        "images_count":        len(image_urls),
        "read":                False,
        "status":              "Pending",
        "submittedAt":         datetime.utcnow(),
        "invite_token":        None,
        # ⚠️ Same known gap as before this change — this public form still
        # has no tenant identifier. Not something the identity/link split
        # fixes on its own; it needs the tenant-scoped-link design flagged
        # earlier in this conversation.
    }

    result = await questionnaire_collection.insert_one(submission)

    vendor_email = email.strip().lower()
    if vendor_email:
        try:
            await send_questionnaire_received_email(
                vendor_email, vendorName, contactPerson.strip() or vendorName,
            )
        except Exception as e:
            print(f"⚠️ Questionnaire ack email failed for {vendor_email}: {e}")

    return {
        "message":       "Questionnaire submitted successfully. We will be in touch soon.",
        "submission_id": str(result.inserted_id),
        "images_saved":  len(image_urls),
    }


@vendor_bp.get("/questionnaire-submissions")
async def get_questionnaire_submissions(ctx: dict = Depends(get_hq_tenant)):
    """Unaffected by this change — see known gap noted in submit_questionnaire above."""
    submissions = await questionnaire_collection.find(
        {}, sort=[("submittedAt", -1)]
    ).to_list(100)
    return [serialize_doc(s) for s in submissions]


@vendor_bp.patch("/questionnaire-submissions/{submission_id}/read")
async def mark_submission_read(submission_id: str, ctx: dict = Depends(get_hq_tenant)):
    if not ObjectId.is_valid(submission_id):
        raise HTTPException(status_code=400, detail="Invalid submission ID.")
    result = await questionnaire_collection.update_one(
        {"_id": ObjectId(submission_id)}, {"$set": {"read": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Submission not found.")
    return {"message": "Marked as read."}


@vendor_bp.post("/questionnaire-submissions/{submission_id}/accept")
async def accept_questionnaire_submission(
    submission_id: str,
    request: Request,
    ctx: dict = Depends(get_hq_tenant),
):
    """Generates an invite (tenant-scoped) from an accepted questionnaire. Unaffected structurally — still produces an invite, not a vendor identity directly."""
    if not ObjectId.is_valid(submission_id):
        raise HTTPException(status_code=400, detail="Invalid submission ID.")

    submission = await questionnaire_collection.find_one({"_id": ObjectId(submission_id)})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found.")

    if submission.get("status") == "Accepted":
        existing_invite = await vendor_invites_collection.find_one({"submission_id": submission_id})
        if existing_invite:
            return {
                "message":   "Already accepted. Returning existing invite token.",
                "token":     existing_invite["token"],
                "expiresAt": existing_invite["expires_at"].isoformat(),
            }

    accepted_by = ctx.get("admin_id", "M-Buyer")

    import secrets
    raw_token = secrets.token_urlsafe(16)

    invite_doc = {
        "token":           raw_token,
        "companyName":     submission.get("vendorName", ""),
        "contactName":     submission.get("contactPerson", ""),
        "mobile":          submission.get("phoneNumber", ""),
        "email":           "",
        "productCategory": submission.get("productCategory", ""),
        "status":          "Pending",
        "source":          "questionnaire",
        "submission_id":   submission_id,
        "created_by":      accepted_by,
        "tenant_id":       ctx["tenant_id"],
        "created_at":      datetime.utcnow(),
        "expires_at":      datetime.utcnow() + timedelta(days=7),
        "vendor_id":       None,
    }

    await vendor_invites_collection.insert_one(invite_doc)

    await questionnaire_collection.update_one(
        {"_id": ObjectId(submission_id)},
        {"$set": {
            "status": "Accepted", "read": True, "accepted_by": accepted_by,
            "accepted_at": datetime.utcnow(), "invite_token": raw_token,
        }}
    )

    return {
        "message":   "Questionnaire accepted. Invite link generated.",
        "token":     raw_token,
        "expiresAt": invite_doc["expires_at"].isoformat(),
    }


@vendor_bp.patch("/questionnaire-submissions/{submission_id}/dismiss")
async def dismiss_questionnaire_submission(submission_id: str, ctx: dict = Depends(get_hq_tenant)):
    if not ObjectId.is_valid(submission_id):
        raise HTTPException(status_code=400, detail="Invalid submission ID.")
    result = await questionnaire_collection.update_one(
        {"_id": ObjectId(submission_id)}, {"$set": {"status": "Dismissed", "read": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Submission not found.")
    return {"message": "Submission dismissed."}


@vendor_bp.get("/invites")
async def list_invites(ctx: dict = Depends(get_hq_tenant)):
    """Returns invite links for the caller's own tenant only."""
    invites = await vendor_invites_collection.find(
        {"tenant_id": ctx["tenant_id"]}, sort=[("created_at", -1)]
    ).to_list(200)
    return [serialize_doc(i) for i in invites]


@vendor_bp.post("/send-invite-email")
async def send_invite_email(
    request: Request,
    background_tasks: BackgroundTasks,
    ctx: dict = Depends(get_hq_tenant),
):
    body         = await request.json()
    email        = body.get("email", "").strip()
    contact_name = body.get("contact_name", "Vendor").strip()
    company_name = body.get("company_name", "").strip()
    invite_link  = body.get("invite_link", "").strip()

    if not email:
        raise HTTPException(status_code=400, detail="Email is required.")
    if not invite_link:
        raise HTTPException(status_code=400, detail="Invite link is required.")

    background_tasks.add_task(
        send_vendor_invite_email, email, contact_name, company_name, invite_link,
    )
    return {"message": f"Invite email sent to {email}"}
