'''

from fastapi import APIRouter, HTTPException, Form, UploadFile, File, Header, Depends, Query
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from typing import List, Optional
from datetime import datetime
from ..db import product_collection, vendors_collection, inventory_collection, vendor_tenant_links_collection
import json
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv
import os
import re
import random
from bson import ObjectId
from pydantic import BaseModel

from ..auth import decode_token
from .deps import get_hq_tenant

router = APIRouter(prefix="/api/products", tags=["Products"])

load_dotenv()

# ─── Cloudinary Config ───
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True,
)


# ─────────────────────────────────────────────────────────────────────────────
# AUTH HELPERS
#
# get_current_user is unchanged in shape — it still resolves VENDOR vs ADMIN
# from the JWT. What's new: every ADMIN-facing route below now ALSO calls
# get_hq_tenant (a second, independent dependency) to get tenant_id. Two
# checks stay separate on purpose:
#   - get_current_user: "is this a vendor token or an admin token, and if
#     vendor, which vendor" — decides which query shape to use (vendor_id
#     filter vs tenant_id filter)
#   - get_hq_tenant: "which tenant does this admin belong to" — the actual
#     isolation boundary for admin-facing queries
#
# Vendor-facing branches don't need get_hq_tenant separately: a vendor's
# JWT already resolves to exactly one vendor_id, and vendor documents now
# carry tenant_id (from the earlier vendor_routes.py fix), so vendor_id
# scoping is already implicitly tenant-safe.
# ─────────────────────────────────────────────────────────────────────────────

def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")

    token = authorization.split(" ")[1]

    try:
        decoded = decode_token(token)

        if not decoded:
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired token"
            )

    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )

    if decoded.get("vendor_id"):
        return {
            "role": "VENDOR",
            "vendor_id": decoded.get("vendor_id"),
            "vendor_name": decoded.get("vendor_name")
                or decoded.get("name")
                or "",
        }

    return {
        "role": decoded.get("role", "ADMIN"),
        "vendor_id": None,
        "vendor_name": "",
    }

def vendor_id_query(vendor_id: str) -> dict:
    values = [vendor_id]
    try:
        values.append(ObjectId(vendor_id))
    except Exception:
        pass
    return {"$in": values}


async def resolve_vendor_name(vendor_id: str, token_name: str = "") -> str:
    if token_name:
        return token_name
    if not vendor_id:
        return ""
    query = {"$or": [{"_id": vendor_id}, {"vendor_id": vendor_id}]}
    try:
        query["$or"].append({"_id": ObjectId(vendor_id)})
    except Exception:
        pass
    vendor = await vendors_collection.find_one(query, {"_id": 0, "name": 1, "business_name": 1, "contact_name": 1})
    if vendor:
        return vendor.get("business_name") or vendor.get("name") or vendor.get("contact_name") or vendor_id
    return vendor_id


def generate_product_code(name: str) -> str:
    words = re.findall(r"[A-Za-z0-9]+", name.upper())
    return "".join(w[:3] for w in words)[:6]


async def generate_base_sku(division: str, product_name: str, tenant_id: str) -> str:
    """SKU sequence is scoped per tenant so two retailers' SKU counters don't collide."""
    prefix = division[:3].upper() if division else "GEN"
    product_code = generate_product_code(product_name)
    last = await product_collection.find_one(
        {"base_sku": {"$regex": f"^{prefix}-{product_code}"}, "tenant_id": tenant_id},
        sort=[("base_sku", -1)],
    )
    if last:
        try:
            last_no = int(last["base_sku"].split("-")[-1])
        except (ValueError, IndexError):
            last_no = 0
        next_no = last_no + 1
    else:
        next_no = 1
    return f"{prefix}-{product_code}-{str(next_no).zfill(4)}"


def generate_variant_sku(base_sku: str, size: str = None, color: str = None) -> str:
    sku = base_sku
    if size:  sku += f"-{size.upper()}"
    if color: sku += f"-{color.replace('#', '').upper()}"
    return sku


def generate_barcode() -> str:
    return "890" + str(random.randint(100000000, 999999999))


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC ENDPOINTS
#
# These are unauthenticated — no JWT, so no tenant_id to read. Per your
# instruction (Citimart/Zudio/BigBasket must never see each other's data,
# including public-facing pages), tenant now MUST be identified explicitly
# via a `tenant` query param. Swap this for a path segment or subdomain
# resolver later if that's how your frontend routes these pages — the
# underlying query logic stays the same either way.
#
# A request with no `tenant` param is rejected rather than silently
# returning a global/empty catalog, since silently returning "everyone's
# products" or "no products" are both wrong in different ways here.
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/public")
async def get_products_public(tenant: str = Query(..., description="Tenant/retailer identifier, e.g. 'citimart'")):
    products = await product_collection.find({"tenant_id": tenant}, {"_id": 0}).to_list(None)
    vendor_ids = {str(p["vendor_id"]) for p in products if p.get("vendor_id")}
    vendor_name_map: dict[str, str] = {}
    for vid in vendor_ids:
        vendor_name_map[vid] = await resolve_vendor_name(vid)
    for p in products:
        vid = str(p.get("vendor_id") or "")
        p["vendor_name"] = vendor_name_map.get(vid, "") if vid else ""
    return JSONResponse(content=jsonable_encoder({"status": "success", "count": len(products), "data": products}))


@router.get("/public/barcodes")
async def get_all_barcodes_public(tenant: str = Query(..., description="Tenant/retailer identifier, e.g. 'citimart'")):
    vendor_name_map: dict[str, str] = {}
    async for v in vendors_collection.find(
        {"tenant_id": tenant},
        {"_id": 1, "vendor_id": 1, "name": 1, "business_name": 1, "contact_name": 1},
    ):
        vid  = str(v.get("vendor_id") or v["_id"])
        name = v.get("business_name") or v.get("name") or v.get("contact_name") or vid
        vendor_name_map[vid] = name

    def _vname(p: dict) -> str:
        vid = str(p.get("vendor_id") or "")
        return vendor_name_map.get(vid, "") if vid else ""

    lookup = {}
    async for p in product_collection.find({"tenant_id": tenant}):
        vname = _vname(p)
        if not p.get("has_variants"):
            bc = p.get("barcode", "")
            if bc:
                lookup[bc] = {"product_name": p.get("product_name", ""), "sku": p.get("sku", ""), "division": p.get("division", ""), "section": p.get("section", ""), "department": p.get("department", ""), "mrp": p.get("mrp", 0), "selling_price": p.get("selling_price", 0), "vendor_id": str(p.get("vendor_id") or ""), "vendor_name": vname}
        else:
            base_name = p.get("product_name", "")
            for v in p.get("variants", []):
                bc = v.get("barcode", "")
                if not bc:
                    continue
                parts = [base_name]
                if v.get("size_label"): parts.append(v["size_label"])
                if v.get("color"):      parts.append(v["color"])
                lookup[bc] = {"product_name": " | ".join(parts), "sku": v.get("sku", ""), "division": p.get("division", ""), "section": p.get("section", ""), "department": p.get("department", ""), "mrp": v.get("mrp", 0), "selling_price": v.get("selling_price", 0), "vendor_id": str(p.get("vendor_id") or ""), "vendor_name": vname}

    return JSONResponse(content=jsonable_encoder({"status": "success", "count": len(lookup), "data": lookup}))


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN / VENDOR — authenticated routes
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/add")
async def add_product(
    product_name:    str             = Form(...),
    division:        str             = Form(""),
    section:         str             = Form(""),
    department:      str             = Form(""),
    hsn_code:        str             = Form(""),
    gst_rate:        float           = Form(0.0),
    requires_expiry: bool            = Form(False),
    expiry_date:     str             = Form(""),
    shelf_life_days: int             = Form(0),
    cost_price:      float           = Form(0.0),
    mrp:             float           = Form(0.0),
    selling_price:   float           = Form(0.0),
    quantity:        int             = Form(0),
    unit:            str             = Form("pcs"),
    description:     str             = Form(""),
    specification:   str             = Form(""),
    has_variants:    bool            = Form(False),
    variant_type:    str             = Form("none"),
    variants:        Optional[str]   = Form("[]"),
    # NEW: only meaningful for vendor callers with MORE than one Approved
    # retailer relationship (see resolution logic below) — which retailer's
    # catalog this product belongs to. Ignored for admin callers.
    vendor_tenant_id: Optional[str]  = Form(None),
    images:          List[UploadFile]= File(None),
    authorization:   str             = Header(None),
):
    user = get_current_user(authorization)

    # Resolve tenant_id: admins get it from get_hq_tenant's underlying JWT
    # decode (done manually here since this route mixes vendor/admin auth
    # in one function). Vendors no longer carry a single tenant_id on
    # their identity record — see vendor_routes.py's module docstring for
    # the identity/tenant-link split. A vendor may have Approved
    # relationships with multiple retailers, so "which tenant's catalog is
    # this product for" has to be resolved per-request:
    #   - Exactly one Approved relationship → use it automatically, no
    #     frontend change needed for the common (single-retailer) case.
    #   - More than one → the frontend MUST send vendor_tenant_id
    #     explicitly (new optional form field above). This is a stopgap,
    #     not a full "active retailer" selector UI — that's a real UX
    #     decision (mirroring how HQ/store admins pick an active
    #     department) that shouldn't be guessed into existence here.
    if user["role"] == "VENDOR":
        approved_links = await vendor_tenant_links_collection.find({
            "vendor_id": ObjectId(str(user["vendor_id"])) if ObjectId.is_valid(str(user["vendor_id"])) else user["vendor_id"],
            "status": "Approved",
        }).to_list(None)

        if not approved_links:
            raise HTTPException(status_code=403, detail="No approved retailer relationship found for this vendor.")
        elif len(approved_links) == 1:
            tenant_id = approved_links[0]["tenant_id"]
        else:
            if not vendor_tenant_id:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "You supply to multiple retailers. Please specify which retailer "
                        "(vendor_tenant_id) this product is for."
                    )
                )
            match = next((l for l in approved_links if l["tenant_id"] == vendor_tenant_id), None)
            if not match:
                raise HTTPException(status_code=403, detail="You don't have an approved relationship with that retailer.")
            tenant_id = vendor_tenant_id
    else:
        # Re-decode to get tenant context the same way get_hq_tenant does,
        # since this route can't cleanly use Depends(get_hq_tenant) while
        # also supporting vendor tokens through get_current_user.
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Unauthorized")
        decoded = decode_token(authorization.split(" ")[1])
        tenant_id = decoded.get("tenant_id") if decoded else None
        if not tenant_id:
            raise HTTPException(status_code=403, detail="No tenant assigned to this admin.")

    sku     = await generate_base_sku(division, product_name, tenant_id)
    barcode = generate_barcode()

    vendor_name = ""
    if user["role"] == "VENDOR" and user.get("vendor_id"):
        vendor_name = await resolve_vendor_name(str(user["vendor_id"]), user.get("vendor_name", ""))

    try:
        variant_list = json.loads(variants) if variants else []
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid variants JSON")

    uploaded_images = []
    if images:
        for img in images:
            if img and img.filename:
                result = cloudinary.uploader.upload(img.file, folder="products")
                uploaded_images.append(result["secure_url"])

    audit = {
        "created_at": datetime.utcnow(),
        "created_by": user["role"],
        "vendor_id": user.get("vendor_id"),
        "vendor_name": vendor_name,
        "tenant_id": tenant_id,
    }

    if not has_variants:
        doc = {
            "product_name": product_name, "division": division, "section": section, "department": department,
            "hsn_code": hsn_code, "gst_rate": gst_rate, "cgst_rate": round(gst_rate/2,2), "sgst_rate": round(gst_rate/2,2), "igst_rate": gst_rate,
            "requires_expiry": requires_expiry, "expiry_date": expiry_date if requires_expiry else "", "shelf_life_days": shelf_life_days if requires_expiry else 0,
            "sku": sku, "barcode": barcode, "cost_price": cost_price, "mrp": mrp, "selling_price": selling_price if selling_price > 0 else mrp,
            "quantity": quantity, "unit": unit, "description": description, "specification": specification,
            "has_variants": False, "variant_type": "none", "variants": [], "images": uploaded_images, **audit,
        }
        await product_collection.insert_one(doc)
        return {"message": "Product added successfully", "sku": sku}

    variant_docs = []
    if variant_type == "color":
        for v in variant_list:
            color = v.get("color", "")
            if not color: continue
            cp = float(v.get("cost_price", 0) or 0); mrp_v = float(v.get("mrp", 0) or 0); sp = float(v.get("selling_price", 0) or 0)
            if sp <= 0: sp = mrp_v
            variant_docs.append({"sku": generate_variant_sku(sku, color=color), "barcode": generate_barcode(), "color": color, "cost_price": cp, "mrp": mrp_v, "selling_price": sp, "stock": int(v.get("stock", 0) or 0), "unit": v.get("unit", "pcs") or "pcs"})
    elif variant_type == "size_color":
        for sv in variant_list:
            size_label = sv.get("size_label", ""); size_value = sv.get("size_value", ""); colors = sv.get("colors", [])
            for c in colors:
                color = c.get("color", "")
                if not color: continue
                cp = float(c.get("cost_price", 0) or 0); mrp_v = float(c.get("mrp", 0) or 0); sp = float(c.get("selling_price", 0) or 0)
                if sp <= 0: sp = mrp_v
                variant_docs.append({"sku": generate_variant_sku(sku, size=size_label, color=color), "barcode": generate_barcode(), "size_label": size_label, "size_value": size_value, "color": color, "cost_price": cp, "mrp": mrp_v, "selling_price": sp, "stock": int(c.get("stock", 0) or 0), "unit": c.get("unit", "pcs") or "pcs"})

    doc = {
        "product_name": product_name, "division": division, "section": section, "department": department,
        "hsn_code": hsn_code, "base_sku": sku, "base_barcode": barcode, "description": description, "specification": specification,
        "has_variants": True, "variant_type": variant_type, "variants": variant_docs, "images": uploaded_images, **audit,
    }
    await product_collection.insert_one(doc)
    return {"message": "Product added successfully", "base_sku": sku, "total_variants": len(variant_docs)}


@router.get("/")
async def get_products(authorization: str = Header(None)):
    user = get_current_user(authorization)

    # Vendors see only their own products — unchanged in shape, still
    # implicitly tenant-safe since vendor_id already pins them to one tenant.
    if user["role"] == "VENDOR":
        query = {"vendor_id": vendor_id_query(str(user["vendor_id"]))}
        products = await product_collection.find(query).to_list(None)
        for p in products:
            p["_id"] = str(p["_id"])
            if p.get("vendor_id"): p["vendor_id"] = str(p["vendor_id"])
            if not p.get("vendor_name") and p.get("vendor_id"):
                p["vendor_name"] = await resolve_vendor_name(str(p["vendor_id"]))
        return JSONResponse(content=jsonable_encoder({"status": "success", "count": len(products), "data": products}))

    # ── Admin: resolve tenant_id from the token directly ──────────────────
    # (Not using Depends(get_hq_tenant) here because this single route
    # branches on vendor-vs-admin auth via get_current_user above; adding a
    # second FastAPI dependency that also requires a valid Bearer token
    # would just re-parse the same header. Decoding it once, manually, in
    # the admin branch keeps this consistent with add_product() above.)
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    decoded = decode_token(authorization.split(" ")[1])
    tenant_id = decoded.get("tenant_id") if decoded else None
    if not tenant_id:
        raise HTTPException(status_code=403, detail="No tenant assigned to this admin.")

    # ── Build set of inducted barcodes (GRN posted = in inventory_collection) ──
    # Scoped to tenant — see module note in grn_routes.py: inventory_collection
    # doesn't carry tenant_id yet in the schema, so this filter is a no-op
    # until that backfill lands. Included now so the query is already correct
    # once the field exists, rather than needing a second pass later.
    inducted_barcodes: set = set()
    async for inv in inventory_collection.find({"tenant_id": tenant_id}, {"barcode": 1, "_id": 0}):
        bc = (inv.get("barcode") or "").strip()
        if bc:
            inducted_barcodes.add(bc)

    all_products = await product_collection.find({"tenant_id": tenant_id}).to_list(None)
    result = []

    for p in all_products:
        p["_id"] = str(p["_id"])
        if p.get("vendor_id"): p["vendor_id"] = str(p["vendor_id"])
        if not p.get("vendor_name") and p.get("vendor_id"):
            p["vendor_name"] = await resolve_vendor_name(str(p["vendor_id"]))

        source     = (p.get("source") or "").lower()
        created_by = (p.get("created_by") or "").upper()

        # A vendor product is one added by a vendor before any GRN
        is_vendor_product = (
            source == "vendor" or
            created_by == "VENDOR" or
            (p.get("vendor_id") and source not in ("grn", "admin"))
        )

        if is_vendor_product:
            # Only show to admin if it has been inducted via GRN
            barcode = (p.get("barcode") or p.get("base_barcode") or "").strip()
            variant_barcodes = [
                (v.get("barcode") or "").strip()
                for v in p.get("variants", [])
                if v.get("barcode")
            ]
            all_barcodes = [b for b in [barcode] + variant_barcodes if b]
            inducted = any(b in inducted_barcodes for b in all_barcodes)
            if not inducted:
                continue  # hide — pure vendor catalog, no GRN yet

        result.append(p)

    return JSONResponse(content=jsonable_encoder({"status": "success", "count": len(result), "data": result}))


@router.get("/vendor/{vendor_id}")
async def get_products_by_vendor(vendor_id: str, ctx: dict = Depends(get_hq_tenant)):
    """
    HQ-only route (an admin looking up one vendor's products).

    ⚠️ FIXED: previously checked `vendors_collection.find_one({..., "tenant_id":
    ctx["tenant_id"]})` — but vendor identities no longer carry tenant_id at
    all (moved to vendor_tenant_links_collection under the identity/tenant-
    link split, see vendor_routes.py's module docstring). That query could
    never match anything, so this route 404'd for every vendor, every time,
    the moment that split shipped. Fixed to look up the vendor identity by
    _id, then separately verify an Approved link exists for this tenant —
    same security property (an admin can't fish for another tenant's
    vendor's products), correct query for the new schema.

    `vendor_id` here is the vendor's IDENTITY _id (not a link id) — matches
    what product_collection.vendor_id is actually stamped with at creation
    time, and what vendor_routes.py's merged /pending, /approved responses
    expose as "vendor_id" (distinct from their "_id", which is the link id).
    """
    try:
        vendor_oid = ObjectId(vendor_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid vendor ID.")

    vendor_check = await vendors_collection.find_one({"_id": vendor_oid})
    if not vendor_check:
        raise HTTPException(status_code=404, detail="Vendor not found.")

    approved_link = await vendor_tenant_links_collection.find_one({
        "vendor_id": vendor_oid,
        "tenant_id": ctx["tenant_id"],
        "status":    "Approved",
    })
    if not approved_link:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found or does not have an approved relationship with your retailer."
        )

    query: dict = {"vendor_id": vendor_id_query(vendor_id), "tenant_id": ctx["tenant_id"]}
    products = await product_collection.find(query).to_list(None)
    resolved_vname = await resolve_vendor_name(vendor_id)
    for p in products:
        p["_id"] = str(p["_id"])
        if p.get("vendor_id"): p["vendor_id"] = str(p["vendor_id"])
        p["vendor_name"] = p.get("vendor_name") or resolved_vname
    return {"status": "success", "count": len(products), "data": products}


class ProductEnrichPayload(BaseModel):
    sku:           Optional[str]   = None
    hsn_code:      Optional[str]   = None
    gst_rate:      Optional[float] = None
    cgst_rate:     Optional[float] = None
    sgst_rate:     Optional[float] = None
    igst_rate:     Optional[float] = None
    division:      Optional[str]   = None
    section:       Optional[str]   = None
    department:    Optional[str]   = None
    mrp:           Optional[float] = None
    selling_price: Optional[float] = None
    unit:          Optional[str]   = None
    description:   Optional[str]   = None
    specification: Optional[str]   = None

@router.patch("/enrich/{barcode:path}")
async def enrich_product_by_barcode(barcode: str, payload: ProductEnrichPayload, ctx: dict = Depends(get_hq_tenant)):
    """
    Enrich a product (typically auto-created by GRN) with missing metadata.
    Looks up by barcode — works even when the product has no SKU yet.
    Only patches fields that are explicitly provided (non-None).

    Called by QuickFillPanel.jsx from ProductModal and ProductDetailModal.

    Now requires get_hq_tenant and scopes the lookup, so an admin can only
    enrich products belonging to their own tenant.
    """
    barcode = barcode.strip()

    prod = await product_collection.find_one({"barcode": barcode, "tenant_id": ctx["tenant_id"]})
    is_variant = False
    variant_idx = None

    if not prod:
        prod = await product_collection.find_one({"variants.barcode": barcode, "tenant_id": ctx["tenant_id"]})
        if prod:
            is_variant = True
            for i, v in enumerate(prod.get("variants", [])):
                if (v.get("barcode") or "").strip() == barcode:
                    variant_idx = i
                    break

    if not prod:
        raise HTTPException(
            status_code=404,
            detail=f"No product found with barcode '{barcode}'."
        )

    patch: dict = {"updatedAt": datetime.utcnow()}
    data = payload.dict(exclude_none=True)

    parent_fields = {
        "sku", "hsn_code", "gst_rate", "cgst_rate", "sgst_rate", "igst_rate",
        "division", "section", "department", "description", "specification", "unit",
    }
    variant_fields = {"mrp", "selling_price"}

    for field, value in data.items():
        if isinstance(value, str) and not value.strip():
            continue
        if field in parent_fields:
            patch[field] = value
        if is_variant and field in variant_fields and variant_idx is not None:
            patch[f"variants.{variant_idx}.{field}"] = value
        elif not is_variant and field in variant_fields:
            patch[field] = value

    if "gst_rate" in patch and "cgst_rate" not in patch:
        half = round(patch["gst_rate"] / 2, 2)
        patch["cgst_rate"] = half
        patch["sgst_rate"] = half
        patch["igst_rate"] = patch["gst_rate"]

    if not patch or list(patch.keys()) == ["updatedAt"]:
        return {"message": "Nothing to update — all provided fields were empty."}

    await product_collection.update_one(
        {"_id": prod["_id"], "tenant_id": ctx["tenant_id"]},
        {"$set": patch}
    )

    # ── Sync inventory_collection so division/section/dept filters work ──
    # inventory records written at GRN-post time had empty classification
    # fields because the product wasn't enriched yet. Fix them now.
    # NOTE: filtered by barcode only, not tenant_id, since inventory_collection
    # doesn't carry tenant_id yet (same gap noted in grn_routes.py). Once it
    # does, add "tenant_id": ctx["tenant_id"] to this filter too.
    inv_sync: dict = {"updatedAt": datetime.utcnow()}
    for field in ("division", "section", "department", "sku"):
        if field in patch:
            inv_sync[field] = patch[field]
    if len(inv_sync) > 1:
        await inventory_collection.update_one(
            {"barcode": barcode},
            {"$set": inv_sync}
        )

    return {
        "message": f"Product '{prod.get('product_name')}' enriched successfully.",
        "barcode": barcode,
        "updated_fields": [k for k in patch if k != "updatedAt"],
    }


@router.get("/{sku}")
async def get_product(sku: str, authorization: str = Header(None)):
    user  = get_current_user(authorization)
    query = {"$or": [{"sku": sku}, {"base_sku": sku}, {"variants.sku": sku}]}

    if user["role"] == "VENDOR":
        query["vendor_id"] = vendor_id_query(str(user["vendor_id"]))
    else:
        decoded = decode_token(authorization.split(" ")[1]) if authorization else None
        tenant_id = decoded.get("tenant_id") if decoded else None
        if not tenant_id:
            raise HTTPException(status_code=403, detail="No tenant assigned to this admin.")
        query["tenant_id"] = tenant_id

    product = await product_collection.find_one(query, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if not product.get("vendor_name") and product.get("vendor_id"):
        product["vendor_name"] = await resolve_vendor_name(str(product["vendor_id"]))
    return {"status": "success", "data": product}


# ─────────────────────────────
# UPDATE PRODUCT
# ─────────────────────────────

@router.put("/{sku}")
async def update_product(
    sku: str,
    product_name:    Optional[str]   = Form(None),
    division:        Optional[str]   = Form(None),
    section:         Optional[str]   = Form(None),
    department:      Optional[str]   = Form(None),
    hsn_code:        Optional[str]   = Form(None),
    gst_rate:        Optional[float] = Form(None),
    requires_expiry: Optional[bool]  = Form(None),
    expiry_date:     Optional[str]   = Form(None),
    shelf_life_days: Optional[int]   = Form(None),
    description:     Optional[str]   = Form(None),
    specification:   Optional[str]   = Form(None),
    cost_price:      Optional[float] = Form(None),
    mrp:             Optional[float] = Form(None),
    selling_price:   Optional[float] = Form(None),
    quantity:        Optional[int]   = Form(None),
    unit:            Optional[str]   = Form(None),
    variants_update: Optional[str]   = Form("[]"),
    existing_images: str             = Form("[]"),
    images:          List[UploadFile]= File(None),
    authorization:   str             = Header(None),
):
    user = get_current_user(authorization)

    sku_clause = {"$or": [{"sku": sku}, {"base_sku": sku}]}
    if user["role"] == "VENDOR":
        sku_clause["vendor_id"] = vendor_id_query(str(user["vendor_id"]))
    else:
        decoded = decode_token(authorization.split(" ")[1]) if authorization else None
        tenant_id = decoded.get("tenant_id") if decoded else None
        if not tenant_id:
            raise HTTPException(status_code=403, detail="No tenant assigned to this admin.")
        sku_clause["tenant_id"] = tenant_id

    product = await product_collection.find_one(sku_clause)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found or unauthorized")

    try:
        keep_images: list = json.loads(existing_images)
    except Exception:
        keep_images = []

    try:
        variant_updates: list = json.loads(variants_update) if variants_update else []
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid variants_update JSON")

    image_list = list(keep_images)
    if images:
        for img in images:
            if img and img.filename:
                result = cloudinary.uploader.upload(img.file, folder="products")
                image_list.append(result["secure_url"])

    update_data: dict = {"updated_at": datetime.utcnow(), "images": image_list}

    if product_name    is not None: update_data["product_name"]    = product_name
    if hsn_code        is not None: update_data["hsn_code"]        = hsn_code
    if gst_rate        is not None:
        update_data["gst_rate"]  = gst_rate
        update_data["cgst_rate"] = round(gst_rate / 2, 2)
        update_data["sgst_rate"] = round(gst_rate / 2, 2)
        update_data["igst_rate"] = gst_rate
    if requires_expiry is not None: update_data["requires_expiry"] = requires_expiry
    if expiry_date     is not None: update_data["expiry_date"]     = expiry_date
    if shelf_life_days is not None: update_data["shelf_life_days"] = shelf_life_days
    if description     is not None: update_data["description"]     = description
    if specification   is not None: update_data["specification"]   = specification

    if division   is not None: update_data["division"]   = division
    if section    is not None: update_data["section"]    = section
    if department is not None: update_data["department"] = department

    if not product.get("has_variants"):
        if cost_price    is not None: update_data["cost_price"]    = cost_price
        if mrp           is not None: update_data["mrp"]           = mrp
        if selling_price is not None: update_data["selling_price"] = selling_price
        if quantity      is not None: update_data["quantity"]      = quantity
        if unit          is not None: update_data["unit"]          = unit
        await product_collection.update_one({"_id": product["_id"]}, {"$set": update_data})
        return {"message": "Product updated successfully"}

    await product_collection.update_one({"_id": product["_id"]}, {"$set": update_data})

    if variant_updates:
        existing_variants: list = product.get("variants", [])
        sku_to_index = {v["sku"]: i for i, v in enumerate(existing_variants)}
        for row in variant_updates:
            variant_sku = row.get("sku")
            if not variant_sku or variant_sku not in sku_to_index:
                continue
            idx = sku_to_index[variant_sku]
            patch: dict = {}
            if "cost_price"    in row and row["cost_price"]    is not None: patch[f"variants.{idx}.cost_price"]    = float(row["cost_price"])
            if "mrp"           in row and row["mrp"]           is not None: patch[f"variants.{idx}.mrp"]           = float(row["mrp"])
            if "selling_price" in row and row["selling_price"] is not None: patch[f"variants.{idx}.selling_price"] = float(row["selling_price"])
            if "stock"         in row and row["stock"]         is not None: patch[f"variants.{idx}.stock"]         = int(row["stock"])
            if "unit"          in row and row["unit"]          is not None: patch[f"variants.{idx}.unit"]          = row["unit"]
            if patch:
                await product_collection.update_one({"_id": product["_id"]}, {"$set": patch})

    return {"message": "Product updated successfully"}


@router.delete("/{sku}")
async def delete_product(sku: str, authorization: str = Header(None)):
    user  = get_current_user(authorization)
    query = {"$or": [{"sku": sku}, {"base_sku": sku}, {"variants.sku": sku}]}

    if user["role"] == "VENDOR":
        query["vendor_id"] = vendor_id_query(str(user["vendor_id"]))
    else:
        decoded = decode_token(authorization.split(" ")[1]) if authorization else None
        tenant_id = decoded.get("tenant_id") if decoded else None
        if not tenant_id:
            raise HTTPException(status_code=403, detail="No tenant assigned to this admin.")
        query["tenant_id"] = tenant_id

    result = await product_collection.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found or unauthorized")
    return {"message": "Product deleted successfully"}
'''


from fastapi import APIRouter, HTTPException, Form, UploadFile, File, Header, Depends, Query
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from typing import List, Optional
from datetime import datetime
from ..db import product_collection, vendors_collection, inventory_collection, vendor_tenant_links_collection, tenants_collection
import json
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv
import os
import re
import random
from bson import ObjectId
from pydantic import BaseModel

from ..auth import decode_token
from .deps import get_hq_tenant

router = APIRouter(prefix="/api/products", tags=["Products"])

load_dotenv()

# ─── Cloudinary Config ───
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True,
)


# ─────────────────────────────────────────────────────────────────────────────
# AUTH HELPERS
#
# get_current_user is unchanged in shape — it still resolves VENDOR vs ADMIN
# from the JWT. What's new: every ADMIN-facing route below now ALSO calls
# get_hq_tenant (a second, independent dependency) to get tenant_id. Two
# checks stay separate on purpose:
#   - get_current_user: "is this a vendor token or an admin token, and if
#     vendor, which vendor" — decides which query shape to use (vendor_id
#     filter vs tenant_id filter)
#   - get_hq_tenant: "which tenant does this admin belong to" — the actual
#     isolation boundary for admin-facing queries
#
# Vendor-facing branches don't need get_hq_tenant separately: a vendor's
# JWT already resolves to exactly one vendor_id, and vendor documents now
# carry tenant_id (from the earlier vendor_routes.py fix), so vendor_id
# scoping is already implicitly tenant-safe.
# ─────────────────────────────────────────────────────────────────────────────

def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")

    token = authorization.split(" ")[1]

    try:
        decoded = decode_token(token)

        if not decoded:
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired token"
            )

    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )

    if decoded.get("vendor_id"):
        return {
            "role": "VENDOR",
            "vendor_id": decoded.get("vendor_id"),
            "vendor_name": decoded.get("vendor_name")
                or decoded.get("name")
                or "",
        }

    return {
        "role": decoded.get("role", "ADMIN"),
        "vendor_id": None,
        "vendor_name": "",
    }

def vendor_id_query(vendor_id: str) -> dict:
    values = [vendor_id]
    try:
        values.append(ObjectId(vendor_id))
    except Exception:
        pass
    return {"$in": values}


async def resolve_vendor_name(vendor_id: str, token_name: str = "") -> str:
    if token_name:
        return token_name
    if not vendor_id:
        return ""
    query = {"$or": [{"_id": vendor_id}, {"vendor_id": vendor_id}]}
    try:
        query["$or"].append({"_id": ObjectId(vendor_id)})
    except Exception:
        pass
    vendor = await vendors_collection.find_one(query, {"_id": 0, "name": 1, "business_name": 1, "contact_name": 1})
    if vendor:
        return vendor.get("business_name") or vendor.get("name") or vendor.get("contact_name") or vendor_id
    return vendor_id


def generate_product_code(name: str) -> str:
    words = re.findall(r"[A-Za-z0-9]+", name.upper())
    return "".join(w[:3] for w in words)[:6]


async def generate_base_sku(division: str, product_name: str, tenant_id: str) -> str:
    """SKU sequence is scoped per tenant so two retailers' SKU counters don't collide."""
    prefix = division[:3].upper() if division else "GEN"
    product_code = generate_product_code(product_name)
    last = await product_collection.find_one(
        {"base_sku": {"$regex": f"^{prefix}-{product_code}"}, "tenant_id": tenant_id},
        sort=[("base_sku", -1)],
    )
    if last:
        try:
            last_no = int(last["base_sku"].split("-")[-1])
        except (ValueError, IndexError):
            last_no = 0
        next_no = last_no + 1
    else:
        next_no = 1
    return f"{prefix}-{product_code}-{str(next_no).zfill(4)}"


def generate_variant_sku(base_sku: str, size: str = None, color: str = None) -> str:
    sku = base_sku
    if size:  sku += f"-{size.upper()}"
    if color: sku += f"-{color.replace('#', '').upper()}"
    return sku


def generate_barcode() -> str:
    return "890" + str(random.randint(100000000, 999999999))


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC ENDPOINTS
#
# These are unauthenticated — no JWT, so no tenant_id to read. Per your
# instruction (Citimart/Zudio/BigBasket must never see each other's data,
# including public-facing pages), tenant now MUST be identified explicitly
# via a `tenant` query param. Swap this for a path segment or subdomain
# resolver later if that's how your frontend routes these pages — the
# underlying query logic stays the same either way.
#
# A request with no `tenant` param is rejected rather than silently
# returning a global/empty catalog, since silently returning "everyone's
# products" or "no products" are both wrong in different ways here.
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/public")
async def get_products_public(tenant: str = Query(..., description="Tenant/retailer identifier, e.g. 'citimart'")):
    products = await product_collection.find({"tenant_id": tenant}, {"_id": 0}).to_list(None)
    vendor_ids = {str(p["vendor_id"]) for p in products if p.get("vendor_id")}
    vendor_name_map: dict[str, str] = {}
    for vid in vendor_ids:
        vendor_name_map[vid] = await resolve_vendor_name(vid)
    for p in products:
        vid = str(p.get("vendor_id") or "")
        p["vendor_name"] = vendor_name_map.get(vid, "") if vid else ""
    return JSONResponse(content=jsonable_encoder({"status": "success", "count": len(products), "data": products}))


@router.get("/public/barcodes")
async def get_all_barcodes_public(tenant: str = Query(..., description="Tenant/retailer identifier, e.g. 'citimart'")):
    vendor_name_map: dict[str, str] = {}
    async for v in vendors_collection.find(
        {"tenant_id": tenant},
        {"_id": 1, "vendor_id": 1, "name": 1, "business_name": 1, "contact_name": 1},
    ):
        vid  = str(v.get("vendor_id") or v["_id"])
        name = v.get("business_name") or v.get("name") or v.get("contact_name") or vid
        vendor_name_map[vid] = name

    def _vname(p: dict) -> str:
        vid = str(p.get("vendor_id") or "")
        return vendor_name_map.get(vid, "") if vid else ""

    lookup = {}
    async for p in product_collection.find({"tenant_id": tenant}):
        vname = _vname(p)
        if not p.get("has_variants"):
            bc = p.get("barcode", "")
            if bc:
                lookup[bc] = {"product_name": p.get("product_name", ""), "sku": p.get("sku", ""), "division": p.get("division", ""), "section": p.get("section", ""), "department": p.get("department", ""), "mrp": p.get("mrp", 0), "selling_price": p.get("selling_price", 0), "vendor_id": str(p.get("vendor_id") or ""), "vendor_name": vname}
        else:
            base_name = p.get("product_name", "")
            for v in p.get("variants", []):
                bc = v.get("barcode", "")
                if not bc:
                    continue
                parts = [base_name]
                if v.get("size_label"): parts.append(v["size_label"])
                if v.get("color"):      parts.append(v["color"])
                lookup[bc] = {"product_name": " | ".join(parts), "sku": v.get("sku", ""), "division": p.get("division", ""), "section": p.get("section", ""), "department": p.get("department", ""), "mrp": v.get("mrp", 0), "selling_price": v.get("selling_price", 0), "vendor_id": str(p.get("vendor_id") or ""), "vendor_name": vname}

    return JSONResponse(content=jsonable_encoder({"status": "success", "count": len(lookup), "data": lookup}))


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN / VENDOR — authenticated routes
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/add")
async def add_product(
    product_name:    str             = Form(...),
    division:        str             = Form(""),
    section:         str             = Form(""),
    department:      str             = Form(""),
    hsn_code:        str             = Form(""),
    gst_rate:        float           = Form(0.0),
    requires_expiry: bool            = Form(False),
    expiry_date:     str             = Form(""),
    shelf_life_days: int             = Form(0),
    cost_price:      float           = Form(0.0),
    mrp:             float           = Form(0.0),
    selling_price:   float           = Form(0.0),
    quantity:        int             = Form(0),
    unit:            str             = Form("pcs"),
    description:     str             = Form(""),
    specification:   str             = Form(""),
    has_variants:    bool            = Form(False),
    variant_type:    str             = Form("none"),
    variants:        Optional[str]   = Form("[]"),
    # NEW: only meaningful for vendor callers with MORE than one Approved
    # retailer relationship (see resolution logic below) — which retailer's
    # catalog this product belongs to. Ignored for admin callers.
    vendor_tenant_id: Optional[str]  = Form(None),
    # NEW: lets a vendor supply their own real barcode instead of always
    # getting a random generated one. Optional — if omitted, behavior is
    # unchanged (generate_barcode() as before). Validated for per-tenant
    # uniqueness the same way create_product does in
    # inventory_products_routes.py, so two products can't collide within
    # one retailer's catalog.
    barcode_override: Optional[str]  = Form(None),
    images:          List[UploadFile]= File(None),
    authorization:   str             = Header(None),
):
    user = get_current_user(authorization)

    # Resolve tenant_id: admins get it from get_hq_tenant's underlying JWT
    # decode (done manually here since this route mixes vendor/admin auth
    # in one function). Vendors no longer carry a single tenant_id on
    # their identity record — see vendor_routes.py's module docstring for
    # the identity/tenant-link split. A vendor may have Approved
    # relationships with multiple retailers, so "which tenant's catalog is
    # this product for" has to be resolved per-request:
    #   - Exactly one Approved relationship → use it automatically, no
    #     frontend change needed for the common (single-retailer) case.
    #   - More than one → the frontend MUST send vendor_tenant_id
    #     explicitly (new optional form field above). This is a stopgap,
    #     not a full "active retailer" selector UI — that's a real UX
    #     decision (mirroring how HQ/store admins pick an active
    #     department) that shouldn't be guessed into existence here.
    if user["role"] == "VENDOR":
        approved_links = await vendor_tenant_links_collection.find({
            "vendor_id": ObjectId(str(user["vendor_id"])) if ObjectId.is_valid(str(user["vendor_id"])) else user["vendor_id"],
            "status": "Approved",
        }).to_list(None)

        if not approved_links:
            raise HTTPException(status_code=403, detail="No approved retailer relationship found for this vendor.")
        elif len(approved_links) == 1:
            tenant_id = approved_links[0]["tenant_id"]
        else:
            if not vendor_tenant_id:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "You supply to multiple retailers. Please specify which retailer "
                        "(vendor_tenant_id) this product is for."
                    )
                )
            match = next((l for l in approved_links if l["tenant_id"] == vendor_tenant_id), None)
            if not match:
                raise HTTPException(status_code=403, detail="You don't have an approved relationship with that retailer.")
            tenant_id = vendor_tenant_id
    else:
        # Re-decode to get tenant context the same way get_hq_tenant does,
        # since this route can't cleanly use Depends(get_hq_tenant) while
        # also supporting vendor tokens through get_current_user.
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Unauthorized")
        decoded = decode_token(authorization.split(" ")[1])
        tenant_id = decoded.get("tenant_id") if decoded else None
        if not tenant_id:
            raise HTTPException(status_code=403, detail="No tenant assigned to this admin.")

    sku = await generate_base_sku(division, product_name, tenant_id)

    if barcode_override and barcode_override.strip():
        barcode = barcode_override.strip()
        conflict = await product_collection.find_one({"barcode": barcode, "tenant_id": tenant_id})
        if conflict:
            raise HTTPException(
                status_code=400,
                detail=f"Barcode '{barcode}' is already used by another product in this catalogue."
            )
    else:
        barcode = generate_barcode()

    vendor_name = ""
    if user["role"] == "VENDOR" and user.get("vendor_id"):
        vendor_name = await resolve_vendor_name(str(user["vendor_id"]), user.get("vendor_name", ""))

    try:
        variant_list = json.loads(variants) if variants else []
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid variants JSON")

    uploaded_images = []
    if images:
        for img in images:
            if img and img.filename:
                result = cloudinary.uploader.upload(img.file, folder="products")
                uploaded_images.append(result["secure_url"])

    audit = {
        "created_at": datetime.utcnow(),
        "created_by": user["role"],
        "vendor_id": user.get("vendor_id"),
        "vendor_name": vendor_name,
        "tenant_id": tenant_id,
    }

    if not has_variants:
        doc = {
            "product_name": product_name, "division": division, "section": section, "department": department,
            "hsn_code": hsn_code, "gst_rate": gst_rate, "cgst_rate": round(gst_rate/2,2), "sgst_rate": round(gst_rate/2,2), "igst_rate": gst_rate,
            "requires_expiry": requires_expiry, "expiry_date": expiry_date if requires_expiry else "", "shelf_life_days": shelf_life_days if requires_expiry else 0,
            "sku": sku, "barcode": barcode, "cost_price": cost_price, "mrp": mrp, "selling_price": selling_price if selling_price > 0 else mrp,
            "quantity": quantity, "unit": unit, "description": description, "specification": specification,
            "has_variants": False, "variant_type": "none", "variants": [], "images": uploaded_images, **audit,
        }
        await product_collection.insert_one(doc)
        return {"message": "Product added successfully", "sku": sku, "barcode": barcode}

    variant_docs = []
    if variant_type == "color":
        for v in variant_list:
            color = v.get("color", "")
            if not color: continue
            cp = float(v.get("cost_price", 0) or 0); mrp_v = float(v.get("mrp", 0) or 0); sp = float(v.get("selling_price", 0) or 0)
            if sp <= 0: sp = mrp_v
            variant_docs.append({"sku": generate_variant_sku(sku, color=color), "barcode": generate_barcode(), "color": color, "cost_price": cp, "mrp": mrp_v, "selling_price": sp, "stock": int(v.get("stock", 0) or 0), "unit": v.get("unit", "pcs") or "pcs"})
    elif variant_type == "size_color":
        for sv in variant_list:
            size_label = sv.get("size_label", ""); size_value = sv.get("size_value", ""); colors = sv.get("colors", [])
            for c in colors:
                color = c.get("color", "")
                if not color: continue
                cp = float(c.get("cost_price", 0) or 0); mrp_v = float(c.get("mrp", 0) or 0); sp = float(c.get("selling_price", 0) or 0)
                if sp <= 0: sp = mrp_v
                variant_docs.append({"sku": generate_variant_sku(sku, size=size_label, color=color), "barcode": generate_barcode(), "size_label": size_label, "size_value": size_value, "color": color, "cost_price": cp, "mrp": mrp_v, "selling_price": sp, "stock": int(c.get("stock", 0) or 0), "unit": c.get("unit", "pcs") or "pcs"})

    doc = {
        "product_name": product_name, "division": division, "section": section, "department": department,
        "hsn_code": hsn_code, "base_sku": sku, "base_barcode": barcode, "description": description, "specification": specification,
        "has_variants": True, "variant_type": variant_type, "variants": variant_docs, "images": uploaded_images, **audit,
    }
    await product_collection.insert_one(doc)
    return {"message": "Product added successfully", "base_sku": sku, "total_variants": len(variant_docs)}


@router.get("/")
async def get_products(authorization: str = Header(None)):
    user = get_current_user(authorization)

    # Vendors see only their own products — unchanged in shape, still
    # implicitly tenant-safe since vendor_id already pins them to one tenant.
    if user["role"] == "VENDOR":
        query = {"vendor_id": vendor_id_query(str(user["vendor_id"]))}
        products = await product_collection.find(query).to_list(None)
        for p in products:
            p["_id"] = str(p["_id"])
            if p.get("vendor_id"): p["vendor_id"] = str(p["vendor_id"])
            if not p.get("vendor_name") and p.get("vendor_id"):
                p["vendor_name"] = await resolve_vendor_name(str(p["vendor_id"]))
        return JSONResponse(content=jsonable_encoder({"status": "success", "count": len(products), "data": products}))

    # ── Admin: resolve tenant_id from the token directly ──────────────────
    # (Not using Depends(get_hq_tenant) here because this single route
    # branches on vendor-vs-admin auth via get_current_user above; adding a
    # second FastAPI dependency that also requires a valid Bearer token
    # would just re-parse the same header. Decoding it once, manually, in
    # the admin branch keeps this consistent with add_product() above.)
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    decoded = decode_token(authorization.split(" ")[1])
    tenant_id = decoded.get("tenant_id") if decoded else None
    if not tenant_id:
        raise HTTPException(status_code=403, detail="No tenant assigned to this admin.")

    # ── Build set of inducted barcodes (GRN posted = in inventory_collection) ──
    # Scoped to tenant — see module note in grn_routes.py: inventory_collection
    # doesn't carry tenant_id yet in the schema, so this filter is a no-op
    # until that backfill lands. Included now so the query is already correct
    # once the field exists, rather than needing a second pass later.
    inducted_barcodes: set = set()
    async for inv in inventory_collection.find({"tenant_id": tenant_id}, {"barcode": 1, "_id": 0}):
        bc = (inv.get("barcode") or "").strip()
        if bc:
            inducted_barcodes.add(bc)

    all_products = await product_collection.find({"tenant_id": tenant_id}).to_list(None)
    result = []

    for p in all_products:
        p["_id"] = str(p["_id"])
        if p.get("vendor_id"): p["vendor_id"] = str(p["vendor_id"])
        if not p.get("vendor_name") and p.get("vendor_id"):
            p["vendor_name"] = await resolve_vendor_name(str(p["vendor_id"]))

        source     = (p.get("source") or "").lower()
        created_by = (p.get("created_by") or "").upper()

        # A vendor product is one added by a vendor before any GRN
        is_vendor_product = (
            source == "vendor" or
            created_by == "VENDOR" or
            (p.get("vendor_id") and source not in ("grn", "admin"))
        )

        if is_vendor_product:
            # Only show to admin if it has been inducted via GRN
            barcode = (p.get("barcode") or p.get("base_barcode") or "").strip()
            variant_barcodes = [
                (v.get("barcode") or "").strip()
                for v in p.get("variants", [])
                if v.get("barcode")
            ]
            all_barcodes = [b for b in [barcode] + variant_barcodes if b]
            inducted = any(b in inducted_barcodes for b in all_barcodes)
            if not inducted:
                continue  # hide — pure vendor catalog, no GRN yet

        result.append(p)

    return JSONResponse(content=jsonable_encoder({"status": "success", "count": len(result), "data": result}))


@router.get("/vendor/{vendor_id}")
async def get_products_by_vendor(vendor_id: str, ctx: dict = Depends(get_hq_tenant)):
    """
    HQ-only route (an admin looking up one vendor's products).

    ⚠️ FIXED: previously checked `vendors_collection.find_one({..., "tenant_id":
    ctx["tenant_id"]})` — but vendor identities no longer carry tenant_id at
    all (moved to vendor_tenant_links_collection under the identity/tenant-
    link split, see vendor_routes.py's module docstring). That query could
    never match anything, so this route 404'd for every vendor, every time,
    the moment that split shipped. Fixed to look up the vendor identity by
    _id, then separately verify an Approved link exists for this tenant —
    same security property (an admin can't fish for another tenant's
    vendor's products), correct query for the new schema.

    `vendor_id` here is the vendor's IDENTITY _id (not a link id) — matches
    what product_collection.vendor_id is actually stamped with at creation
    time, and what vendor_routes.py's merged /pending, /approved responses
    expose as "vendor_id" (distinct from their "_id", which is the link id).
    """
    try:
        vendor_oid = ObjectId(vendor_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid vendor ID.")

    vendor_check = await vendors_collection.find_one({"_id": vendor_oid})
    if not vendor_check:
        raise HTTPException(status_code=404, detail="Vendor not found.")

    approved_link = await vendor_tenant_links_collection.find_one({
        "vendor_id": vendor_oid,
        "tenant_id": ctx["tenant_id"],
        "status":    "Approved",
    })
    if not approved_link:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found or does not have an approved relationship with your retailer."
        )

    query: dict = {"vendor_id": vendor_id_query(vendor_id), "tenant_id": ctx["tenant_id"]}
    products = await product_collection.find(query).to_list(None)
    resolved_vname = await resolve_vendor_name(vendor_id)
    for p in products:
        p["_id"] = str(p["_id"])
        if p.get("vendor_id"): p["vendor_id"] = str(p["vendor_id"])
        p["vendor_name"] = p.get("vendor_name") or resolved_vname
    return {"status": "success", "count": len(products), "data": products}


@router.get("/my-catalogue")
async def get_my_catalogue(authorization: str = Header(None)):
    """
    Vendor-facing: returns the calling vendor's own product catalogue,
    grouped by retailer. Powers a "Catalogue" tab on the vendor dashboard.

    Unlike GET /api/products/ (the admin-oriented list, which a vendor can
    also call but gets back a flat list mixing every retailer relationship
    together), this groups products under each retailer they supply,
    since under the vendor identity/tenant-link split a vendor can have
    products for Citimart AND Zudio simultaneously — a flat list would
    make it unclear which catalogue entry belongs to which relationship.

    HQ side already has visibility into this same data via the existing
    GET /api/products/vendor/{vendor_id} (tenant-scoped — an HQ admin only
    ever sees their own retailer's slice of a vendor's catalogue, never a
    vendor's other retailers' products). No new HQ-side route was needed.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization token missing")

    decoded = decode_token(authorization.split(" ")[1])
    if not decoded or not decoded.get("vendor_id"):
        raise HTTPException(status_code=403, detail="This endpoint requires a vendor account.")

    vendor_id = decoded["vendor_id"]
    try:
        vendor_oid = ObjectId(vendor_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid token payload")

    # Every retailer this vendor has ANY relationship with, not just
    # Approved — Pending relationships still let them stage a catalogue
    # ahead of approval, but the retailer name is shown either way so
    # they know which relationship each group belongs to.
    tenant_name_map: dict = {}
    async for link in vendor_tenant_links_collection.find({"vendor_id": vendor_oid}):
        tenant_id = link.get("tenant_id")
        if tenant_id and tenant_id not in tenant_name_map:
            tenant = await tenants_collection.find_one({"tenant_id": tenant_id})
            tenant_name_map[tenant_id] = (tenant or {}).get("company_name") or tenant_id

    products = await product_collection.find({
        "vendor_id": vendor_id_query(vendor_id)
    }).to_list(None)

    grouped: dict = {}
    for p in products:
        tenant_id = p.get("tenant_id", "")
        if tenant_id not in grouped:
            grouped[tenant_id] = {
                "tenant_id":    tenant_id,
                "company_name": tenant_name_map.get(tenant_id, tenant_id or "— unassigned —"),
                "products":     [],
            }
        p["_id"] = str(p["_id"])
        if p.get("vendor_id"):
            p["vendor_id"] = str(p["vendor_id"])
        grouped[tenant_id]["products"].append(p)

    catalogue = list(grouped.values())
    catalogue.sort(key=lambda g: g["company_name"].lower())

    return {
        "status": "success",
        "total_products": len(products),
        "data": catalogue,
    }


class ProductEnrichPayload(BaseModel):
    sku:           Optional[str]   = None
    hsn_code:      Optional[str]   = None
    gst_rate:      Optional[float] = None
    cgst_rate:     Optional[float] = None
    sgst_rate:     Optional[float] = None
    igst_rate:     Optional[float] = None
    division:      Optional[str]   = None
    section:       Optional[str]   = None
    department:    Optional[str]   = None
    mrp:           Optional[float] = None
    selling_price: Optional[float] = None
    unit:          Optional[str]   = None
    description:   Optional[str]   = None
    specification: Optional[str]   = None

@router.patch("/enrich/{barcode:path}")
async def enrich_product_by_barcode(barcode: str, payload: ProductEnrichPayload, ctx: dict = Depends(get_hq_tenant)):
    """
    Enrich a product (typically auto-created by GRN) with missing metadata.
    Looks up by barcode — works even when the product has no SKU yet.
    Only patches fields that are explicitly provided (non-None).

    Called by QuickFillPanel.jsx from ProductModal and ProductDetailModal.

    Now requires get_hq_tenant and scopes the lookup, so an admin can only
    enrich products belonging to their own tenant.
    """
    barcode = barcode.strip()

    prod = await product_collection.find_one({"barcode": barcode, "tenant_id": ctx["tenant_id"]})
    is_variant = False
    variant_idx = None

    if not prod:
        prod = await product_collection.find_one({"variants.barcode": barcode, "tenant_id": ctx["tenant_id"]})
        if prod:
            is_variant = True
            for i, v in enumerate(prod.get("variants", [])):
                if (v.get("barcode") or "").strip() == barcode:
                    variant_idx = i
                    break

    if not prod:
        raise HTTPException(
            status_code=404,
            detail=f"No product found with barcode '{barcode}'."
        )

    patch: dict = {"updatedAt": datetime.utcnow()}
    data = payload.dict(exclude_none=True)

    parent_fields = {
        "sku", "hsn_code", "gst_rate", "cgst_rate", "sgst_rate", "igst_rate",
        "division", "section", "department", "description", "specification", "unit",
    }
    variant_fields = {"mrp", "selling_price"}

    for field, value in data.items():
        if isinstance(value, str) and not value.strip():
            continue
        if field in parent_fields:
            patch[field] = value
        if is_variant and field in variant_fields and variant_idx is not None:
            patch[f"variants.{variant_idx}.{field}"] = value
        elif not is_variant and field in variant_fields:
            patch[field] = value

    if "gst_rate" in patch and "cgst_rate" not in patch:
        half = round(patch["gst_rate"] / 2, 2)
        patch["cgst_rate"] = half
        patch["sgst_rate"] = half
        patch["igst_rate"] = patch["gst_rate"]

    if not patch or list(patch.keys()) == ["updatedAt"]:
        return {"message": "Nothing to update — all provided fields were empty."}

    await product_collection.update_one(
        {"_id": prod["_id"], "tenant_id": ctx["tenant_id"]},
        {"$set": patch}
    )

    # ── Sync inventory_collection so division/section/dept filters work ──
    # inventory records written at GRN-post time had empty classification
    # fields because the product wasn't enriched yet. Fix them now.
    # NOTE: filtered by barcode only, not tenant_id, since inventory_collection
    # doesn't carry tenant_id yet (same gap noted in grn_routes.py). Once it
    # does, add "tenant_id": ctx["tenant_id"] to this filter too.
    inv_sync: dict = {"updatedAt": datetime.utcnow()}
    for field in ("division", "section", "department", "sku"):
        if field in patch:
            inv_sync[field] = patch[field]
    if len(inv_sync) > 1:
        await inventory_collection.update_one(
            {"barcode": barcode},
            {"$set": inv_sync}
        )

    return {
        "message": f"Product '{prod.get('product_name')}' enriched successfully.",
        "barcode": barcode,
        "updated_fields": [k for k in patch if k != "updatedAt"],
    }


@router.get("/{sku}")
async def get_product(sku: str, authorization: str = Header(None)):
    user  = get_current_user(authorization)
    query = {"$or": [{"sku": sku}, {"base_sku": sku}, {"variants.sku": sku}]}

    if user["role"] == "VENDOR":
        query["vendor_id"] = vendor_id_query(str(user["vendor_id"]))
    else:
        decoded = decode_token(authorization.split(" ")[1]) if authorization else None
        tenant_id = decoded.get("tenant_id") if decoded else None
        if not tenant_id:
            raise HTTPException(status_code=403, detail="No tenant assigned to this admin.")
        query["tenant_id"] = tenant_id

    product = await product_collection.find_one(query, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if not product.get("vendor_name") and product.get("vendor_id"):
        product["vendor_name"] = await resolve_vendor_name(str(product["vendor_id"]))
    return {"status": "success", "data": product}


# ─────────────────────────────
# UPDATE PRODUCT
# ─────────────────────────────

@router.put("/{sku}")
async def update_product(
    sku: str,
    product_name:    Optional[str]   = Form(None),
    division:        Optional[str]   = Form(None),
    section:         Optional[str]   = Form(None),
    department:      Optional[str]   = Form(None),
    hsn_code:        Optional[str]   = Form(None),
    gst_rate:        Optional[float] = Form(None),
    requires_expiry: Optional[bool]  = Form(None),
    expiry_date:     Optional[str]   = Form(None),
    shelf_life_days: Optional[int]   = Form(None),
    description:     Optional[str]   = Form(None),
    specification:   Optional[str]   = Form(None),
    cost_price:      Optional[float] = Form(None),
    mrp:             Optional[float] = Form(None),
    selling_price:   Optional[float] = Form(None),
    quantity:        Optional[int]   = Form(None),
    unit:            Optional[str]   = Form(None),
    variants_update: Optional[str]   = Form("[]"),
    existing_images: str             = Form("[]"),
    images:          List[UploadFile]= File(None),
    authorization:   str             = Header(None),
):
    user = get_current_user(authorization)

    sku_clause = {"$or": [{"sku": sku}, {"base_sku": sku}]}
    if user["role"] == "VENDOR":
        sku_clause["vendor_id"] = vendor_id_query(str(user["vendor_id"]))
    else:
        decoded = decode_token(authorization.split(" ")[1]) if authorization else None
        tenant_id = decoded.get("tenant_id") if decoded else None
        if not tenant_id:
            raise HTTPException(status_code=403, detail="No tenant assigned to this admin.")
        sku_clause["tenant_id"] = tenant_id

    product = await product_collection.find_one(sku_clause)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found or unauthorized")

    try:
        keep_images: list = json.loads(existing_images)
    except Exception:
        keep_images = []

    try:
        variant_updates: list = json.loads(variants_update) if variants_update else []
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid variants_update JSON")

    image_list = list(keep_images)
    if images:
        for img in images:
            if img and img.filename:
                result = cloudinary.uploader.upload(img.file, folder="products")
                image_list.append(result["secure_url"])

    update_data: dict = {"updated_at": datetime.utcnow(), "images": image_list}

    if product_name    is not None: update_data["product_name"]    = product_name
    if hsn_code        is not None: update_data["hsn_code"]        = hsn_code
    if gst_rate        is not None:
        update_data["gst_rate"]  = gst_rate
        update_data["cgst_rate"] = round(gst_rate / 2, 2)
        update_data["sgst_rate"] = round(gst_rate / 2, 2)
        update_data["igst_rate"] = gst_rate
    if requires_expiry is not None: update_data["requires_expiry"] = requires_expiry
    if expiry_date     is not None: update_data["expiry_date"]     = expiry_date
    if shelf_life_days is not None: update_data["shelf_life_days"] = shelf_life_days
    if description     is not None: update_data["description"]     = description
    if specification   is not None: update_data["specification"]   = specification

    if division   is not None: update_data["division"]   = division
    if section    is not None: update_data["section"]    = section
    if department is not None: update_data["department"] = department

    if not product.get("has_variants"):
        if cost_price    is not None: update_data["cost_price"]    = cost_price
        if mrp           is not None: update_data["mrp"]           = mrp
        if selling_price is not None: update_data["selling_price"] = selling_price
        if quantity      is not None: update_data["quantity"]      = quantity
        if unit          is not None: update_data["unit"]          = unit
        await product_collection.update_one({"_id": product["_id"]}, {"$set": update_data})
        return {"message": "Product updated successfully"}

    await product_collection.update_one({"_id": product["_id"]}, {"$set": update_data})

    if variant_updates:
        existing_variants: list = product.get("variants", [])
        sku_to_index = {v["sku"]: i for i, v in enumerate(existing_variants)}
        for row in variant_updates:
            variant_sku = row.get("sku")
            if not variant_sku or variant_sku not in sku_to_index:
                continue
            idx = sku_to_index[variant_sku]
            patch: dict = {}
            if "cost_price"    in row and row["cost_price"]    is not None: patch[f"variants.{idx}.cost_price"]    = float(row["cost_price"])
            if "mrp"           in row and row["mrp"]           is not None: patch[f"variants.{idx}.mrp"]           = float(row["mrp"])
            if "selling_price" in row and row["selling_price"] is not None: patch[f"variants.{idx}.selling_price"] = float(row["selling_price"])
            if "stock"         in row and row["stock"]         is not None: patch[f"variants.{idx}.stock"]         = int(row["stock"])
            if "unit"          in row and row["unit"]          is not None: patch[f"variants.{idx}.unit"]          = row["unit"]
            if patch:
                await product_collection.update_one({"_id": product["_id"]}, {"$set": patch})

    return {"message": "Product updated successfully"}


@router.delete("/{sku}")
async def delete_product(sku: str, authorization: str = Header(None)):
    user  = get_current_user(authorization)
    query = {"$or": [{"sku": sku}, {"base_sku": sku}, {"variants.sku": sku}]}

    if user["role"] == "VENDOR":
        query["vendor_id"] = vendor_id_query(str(user["vendor_id"]))
    else:
        decoded = decode_token(authorization.split(" ")[1]) if authorization else None
        tenant_id = decoded.get("tenant_id") if decoded else None
        if not tenant_id:
            raise HTTPException(status_code=403, detail="No tenant assigned to this admin.")
        query["tenant_id"] = tenant_id

    result = await product_collection.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found or unauthorized")
    return {"message": "Product deleted successfully"}