"""
superadmin_vendor_routes.py
============================
Updated for the vendor identity/tenant-link split (see vendor_routes.py's
module docstring for the full schema explanation).

GET /superadmin/vendors now returns one row PER RELATIONSHIP (link), not
per vendor identity — a vendor working with both Citimart and Zudio shows
up as two rows here, each independently approvable/rejectable, which is
exactly the visibility Super Admin needs ("which retailer added which
vendor"). The response SHAPE is unchanged from before this migration, so
SuperAdmin.jsx's Vendors tab requires no frontend changes.

Still additive — does not modify or replace your existing
superadmin_routes.py. Wire this in alongside it:

    from .routes.superadmin_vendor_routes import router as superadmin_vendor_router
    app.include_router(superadmin_vendor_router)
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.responses import JSONResponse
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from bson import ObjectId
from pydantic import BaseModel, EmailStr

from ..db import (
    vendors_collection, vendor_tenant_links_collection, tenants_collection,
    product_mapping_collection, vendor_subscriptions_collection,
)
from ..config import frontend_url
from ..email_utils import send_vendor_confirmation_email

from .vendor_routes import create_token
from .auth_routes import get_current_superadmin
from .subscription_routes import TIER_CONFIG, DEFAULT_TIER, _extend_existing_catalogue_items

router = APIRouter(prefix="/superadmin", tags=["SuperAdmin — Vendors"])

CurrentAdmin = Dict[str, Any]

VALID_BUSINESS_TYPES = {
    "general_vendor", "wholesaler", "manufacturer", "distributor",
    "exporter", "fabric_supplier", "retailer",
}
VALID_RELATIONSHIP_STATUSES = {"Pending", "Approved", "Rejected", "Deactivated", "Suspended"}
VALID_SUBSCRIPTION_STATUSES = {"active", "pending_payment", "suspended", "cancelled", "expired"}
VALID_PAYMENT_STATUSES = {"not_required", "pending", "paid", "waived", "refunded"}


class VendorIdentityUpdate(BaseModel):
    name: Optional[str] = None
    brandName: Optional[str] = None
    email: Optional[EmailStr] = None
    contactMobile: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    cityName: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    gstin: Optional[str] = None
    business_type: Optional[List[str]] = None
    product_categories: Optional[List[str]] = None
    platform_status: Optional[str] = None


class VendorRelationshipUpdate(BaseModel):
    status: str
    reason: str = ""


class VendorSubscriptionUpdate(BaseModel):
    tier: str
    status: str = "active"
    payment_status: str = "paid"
    expires_at: Optional[str] = None
    reason: str


def _str(v) -> str:
    return str(v) if v else ""


async def _tenant_name_map() -> dict:
    m: dict = {}
    async for t in tenants_collection.find({}, {"_id": 0, "tenant_id": 1, "company_name": 1}):
        if t.get("tenant_id"):
            m[t["tenant_id"]] = t.get("company_name") or t["tenant_id"]
    return m


def _as_iso(value: Any) -> Optional[str]:
    """Keep management responses JSON-safe without leaking raw Mongo values."""
    if not value:
        return None
    return value.isoformat() if isinstance(value, datetime) else str(value)


def _subscription_view(subscription: Optional[dict]) -> dict:
    subscription = subscription or {}
    return {
        "tier": subscription.get("tier", DEFAULT_TIER),
        "status": subscription.get("status", "active"),
        "payment_status": subscription.get(
            "payment_status", "not_required" if subscription.get("tier", DEFAULT_TIER) == "free" else "pending"
        ),
        "price_inr": subscription.get("price_inr", TIER_CONFIG.get(subscription.get("tier", DEFAULT_TIER), TIER_CONFIG[DEFAULT_TIER])["price_inr"]),
        "started_at": _as_iso(subscription.get("started_at")),
        "expires_at": _as_iso(subscription.get("expires_at")),
        "updated_at": _as_iso(subscription.get("updated_at")),
        "history": subscription.get("admin_history", [])[-15:],
    }


@router.get("/platform-finance")
async def get_platform_finance(
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    """Platform billing overview for Super Admin.

    This deliberately reports RMS subscription revenue only. It never exposes
    retailer/vendor purchase invoices, receivables, or payment negotiations.
    """
    subscriptions = {}
    async for sub in vendor_subscriptions_collection.find({}):
        vendor_id = _str(sub.get("vendor_id"))
        if vendor_id:
            subscriptions[vendor_id] = sub

    plan_counts = {tier: 0 for tier in TIER_CONFIG}
    payment_counts: Dict[str, int] = {}
    rows = []
    expected_mrr = 0.0
    pending_value = 0.0
    renewals_due = 0
    now = datetime.utcnow()
    renewal_cutoff = now + timedelta(days=30)

    async for vendor in vendors_collection.find({}, {"name": 1, "vendor_name": 1, "email": 1}):
        vendor_id = _str(vendor.get("_id"))
        sub = subscriptions.get(vendor_id) or {}
        tier = sub.get("tier", DEFAULT_TIER)
        if tier not in TIER_CONFIG:
            tier = DEFAULT_TIER
        status = sub.get("status", "active")
        payment_status = sub.get("payment_status", "not_required" if tier == DEFAULT_TIER else "pending")
        price = float(sub.get("price_inr", TIER_CONFIG[tier]["price_inr"]) or 0)
        expires_at = sub.get("expires_at")

        plan_counts[tier] += 1
        payment_counts[payment_status] = payment_counts.get(payment_status, 0) + 1
        if tier != DEFAULT_TIER and status == "active" and payment_status in {"paid", "waived"}:
            expected_mrr += price
        if tier != DEFAULT_TIER and payment_status == "pending":
            pending_value += price
        if isinstance(expires_at, datetime) and now <= expires_at <= renewal_cutoff and status == "active":
            renewals_due += 1

        rows.append({
            "vendor_id": vendor_id,
            "vendor_name": vendor.get("name") or vendor.get("vendor_name") or "Vendor",
            "email": vendor.get("email", ""),
            "tier": tier,
            "plan_label": TIER_CONFIG[tier]["label"],
            "price_inr": round(price, 2),
            "status": status,
            "payment_status": payment_status,
            "started_at": _as_iso(sub.get("started_at")),
            "expires_at": _as_iso(expires_at),
            "updated_at": _as_iso(sub.get("updated_at")),
        })

    rows.sort(key=lambda row: (row["payment_status"] == "pending", row["expires_at"] or "9999"), reverse=True)
    return {
        "summary": {
            "vendor_count": len(rows),
            "expected_mrr": round(expected_mrr, 2),
            "pending_subscription_value": round(pending_value, 2),
            "renewals_due_30_days": renewals_due,
        },
        "plan_breakdown": [
            {"tier": tier, "label": config["label"], "count": plan_counts[tier], "price_inr": config["price_inr"]}
            for tier, config in TIER_CONFIG.items()
        ],
        "payment_breakdown": [
            {"status": status, "count": count} for status, count in sorted(payment_counts.items())
        ],
        "subscriptions": rows,
        "rules": {"scope": "RMS subscription billing only", "retailer_vendor_finance_visible": False},
    }


@router.get("/vendors/{vendor_id}/management")
async def get_vendor_management(
    vendor_id: str,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    """Super Admin's safe, three-layer vendor management view.

    Identity and subscription are global to the vendor. Relationships are
    tenant-specific. This endpoint intentionally does not return any tenant
    private procurement, invoice, stock, or negotiation data.
    """
    if not ObjectId.is_valid(vendor_id):
        raise HTTPException(status_code=400, detail="Invalid vendor ID.")
    identity = await vendors_collection.find_one({"_id": ObjectId(vendor_id)})
    if not identity:
        raise HTTPException(status_code=404, detail="Vendor not found.")

    tenant_names = await _tenant_name_map()
    relationships = []
    async for link in vendor_tenant_links_collection.find({"vendor_id": identity["_id"]}).sort("created_at", -1):
        relationships.append({
            "id": _str(link["_id"]),
            "tenant_id": link.get("tenant_id", ""),
            "tenant_name": tenant_names.get(link.get("tenant_id", ""), link.get("tenant_id", "Unknown retailer")),
            "status": link.get("status", "Pending"),
            "vendor_code": link.get("vendor_code", ""),
            "source": link.get("source", ""),
            "approved_at": _as_iso(link.get("approved_at")),
            "updated_at": _as_iso(link.get("updated_at")),
            "history": link.get("superadmin_history", [])[-10:],
        })

    subscription = await vendor_subscriptions_collection.find_one({"vendor_id": identity["_id"]})
    public_identity = {
        "id": _str(identity["_id"]),
        "name": identity.get("name") or identity.get("vendor_name") or "",
        "brandName": identity.get("brandName", ""),
        "email": identity.get("email", ""),
        "contactMobile": identity.get("contactMobile") or identity.get("mobile", ""),
        "website": identity.get("website", ""),
        "address": identity.get("address", ""),
        "cityName": identity.get("cityName", ""),
        "state": identity.get("state", ""),
        "pincode": identity.get("pincode", ""),
        "gstin": identity.get("gstin", ""),
        "business_type": identity.get("business_type", []),
        "product_categories": identity.get("product_categories", []),
        "platform_status": identity.get("platform_status", "active"),
        "marketplace_visible": bool(identity.get("marketplace_visible", False)),
        "password_set": bool(identity.get("password_set", False)),
    }
    return {
        "identity": public_identity,
        "subscription": _subscription_view(subscription),
        "relationships": relationships,
        "rules": {
            "subscription_scope": "vendor_global",
            "relationship_scope": "retailer_specific",
            "private_tenant_data_visible": False,
        },
    }


@router.patch("/vendors/{vendor_id}/identity")
async def update_vendor_identity(
    vendor_id: str,
    payload: VendorIdentityUpdate,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    """Edit global vendor profile fields only; no retailer relationship data."""
    if not ObjectId.is_valid(vendor_id):
        raise HTTPException(status_code=400, detail="Invalid vendor ID.")
    vendor_oid = ObjectId(vendor_id)
    existing = await vendors_collection.find_one({"_id": vendor_oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Vendor not found.")

    raw = payload.model_dump(exclude_unset=True)
    patch: dict = {}
    for field in ("brandName", "contactMobile", "website", "address", "cityName", "state", "pincode", "gstin"):
        if field in raw:
            patch[field] = str(raw[field] or "").strip()
    if "name" in raw:
        name = str(raw["name"] or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="Vendor name cannot be empty.")
        patch["name"] = name
        patch["vendor_name"] = name  # compatibility with legacy documents
    if "email" in raw:
        email = str(raw["email"] or "").strip().lower()
        if not email:
            raise HTTPException(status_code=400, detail="Email cannot be empty.")
        duplicate = await vendors_collection.find_one({"email": email, "_id": {"$ne": vendor_oid}})
        if duplicate:
            raise HTTPException(status_code=409, detail="Another vendor already uses this email.")
        patch["email"] = email
    if "business_type" in raw:
        types = list(dict.fromkeys(str(item).strip().lower() for item in (raw["business_type"] or []) if str(item).strip()))
        invalid = set(types) - VALID_BUSINESS_TYPES
        if invalid:
            raise HTTPException(status_code=400, detail=f"Invalid business type(s): {sorted(invalid)}")
        patch["business_type"] = types
    if "product_categories" in raw:
        patch["product_categories"] = list(dict.fromkeys(str(item).strip()[:100] for item in (raw["product_categories"] or []) if str(item).strip()))[:30]
    if "platform_status" in raw:
        platform_status = str(raw["platform_status"] or "").lower()
        if platform_status not in {"active", "suspended"}:
            raise HTTPException(status_code=400, detail="platform_status must be active or suspended.")
        patch["platform_status"] = platform_status

    if not patch:
        raise HTTPException(status_code=400, detail="No editable fields were supplied.")
    now = datetime.utcnow()
    patch["updated_at"] = now
    history = {"action": "identity_updated", "by": current_admin.get("email", "superadmin"), "at": now, "fields": sorted(key for key in patch if key != "updated_at")}
    await vendors_collection.update_one({"_id": vendor_oid}, {"$set": patch, "$push": {"superadmin_history": history}})
    return {"message": "Vendor identity updated.", "updated_fields": history["fields"]}


@router.patch("/vendor-relationships/{link_id}")
async def update_vendor_relationship(
    link_id: str,
    payload: VendorRelationshipUpdate,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    """Suspend/deactivate or reactivate one retailer relationship only."""
    if not ObjectId.is_valid(link_id):
        raise HTTPException(status_code=400, detail="Invalid relationship ID.")
    link = await vendor_tenant_links_collection.find_one({"_id": ObjectId(link_id)})
    if not link:
        raise HTTPException(status_code=404, detail="Vendor relationship not found.")
    target = payload.status.strip().title()
    current = link.get("status", "Pending")
    allowed = (
        (current == "Approved" and target in {"Deactivated", "Suspended"}) or
        (current in {"Deactivated", "Suspended"} and target == "Approved" and bool(link.get("vendor_code")))
    )
    if not allowed:
        raise HTTPException(
            status_code=400,
            detail="Use approve/reject for pending relationships. Only approved relationships can be suspended/deactivated or reactivated.",
        )
    now = datetime.utcnow()
    reason = payload.reason.strip()[:500]
    history = {"from": current, "to": target, "reason": reason, "by": current_admin.get("email", "superadmin"), "at": now}
    await vendor_tenant_links_collection.update_one(
        {"_id": link["_id"]},
        {"$set": {"status": target, "updated_at": now, "updated_by": "SuperAdmin"}, "$push": {"superadmin_history": history}},
    )
    return {"message": f"Retailer relationship {target.lower()}.", "status": target}


@router.put("/vendors/{vendor_id}/subscription")
async def override_vendor_subscription(
    vendor_id: str,
    payload: VendorSubscriptionUpdate,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    """Set a platform-wide vendor plan with an auditable Super Admin reason."""
    if not ObjectId.is_valid(vendor_id):
        raise HTTPException(status_code=400, detail="Invalid vendor ID.")
    vendor_oid = ObjectId(vendor_id)
    if not await vendors_collection.find_one({"_id": vendor_oid}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Vendor not found.")
    tier = payload.tier.strip().lower()
    status = payload.status.strip().lower()
    payment_status = payload.payment_status.strip().lower()
    reason = payload.reason.strip()
    if tier not in TIER_CONFIG:
        raise HTTPException(status_code=400, detail=f"Unknown plan. Valid plans: {list(TIER_CONFIG)}")
    if status not in VALID_SUBSCRIPTION_STATUSES or payment_status not in VALID_PAYMENT_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid subscription or payment status.")
    if len(reason) < 3:
        raise HTTPException(status_code=400, detail="Provide a short reason for this administrative plan change.")

    now = datetime.utcnow()
    expires_at = None
    if tier != DEFAULT_TIER and status == "active":
        if payload.expires_at:
            try:
                expires_at = datetime.fromisoformat(payload.expires_at.replace("Z", "+00:00")).replace(tzinfo=None)
            except ValueError:
                raise HTTPException(status_code=400, detail="expires_at must be an ISO date/time.")
            if expires_at <= now:
                raise HTTPException(status_code=400, detail="Plan expiry must be in the future.")
        else:
            expires_at = now + timedelta(days=30)

    existing = await vendor_subscriptions_collection.find_one({"vendor_id": vendor_oid})
    event = {
        "tier": tier, "status": status, "payment_status": payment_status,
        "reason": reason[:500], "by": current_admin.get("email", "superadmin"), "at": now,
    }
    update = {
        "vendor_id": vendor_oid, "tier": tier, "status": status,
        "payment_status": payment_status, "price_inr": TIER_CONFIG[tier]["price_inr"],
        "started_at": (existing or {}).get("started_at") or now,
        "expires_at": expires_at, "updated_at": now,
        "source": "superadmin_override", "managed_by": "SuperAdmin",
    }
    await vendor_subscriptions_collection.update_one(
        {"vendor_id": vendor_oid}, {"$set": update, "$push": {"admin_history": event}}, upsert=True,
    )
    extended_count = 0
    if status == "active":
        extended_count = await _extend_existing_catalogue_items(vendor_id, TIER_CONFIG[tier]["visibility_days"])
    return {
        "message": "Vendor subscription updated.", "tier": tier, "status": status,
        "expires_at": _as_iso(expires_at), "catalogue_items_extended": extended_count,
    }


@router.get("/vendors")
async def list_all_vendors(current_admin: CurrentAdmin = Depends(get_current_superadmin)):
    """
    Every vendor-tenant RELATIONSHIP across every retailer. A vendor with
    two retailer relationships appears as two rows — this is intentional:
    each relationship has its own independent status and needs its own
    approve/reject action.
    """
    name_map = await _tenant_name_map()

    vendors = []
    async for link in vendor_tenant_links_collection.find({}).sort("created_at", -1):
        identity = await vendors_collection.find_one({"_id": link.get("vendor_id")})
        if not identity:
            continue  # orphaned link (identity deleted) — skip rather than error
        tenant_id = link.get("tenant_id", "")
        vendors.append({
            "id":              _str(link["_id"]),          # LINK id — approve/reject act on this
            "vendor_id":       _str(identity["_id"]),        # identity id, for reference/grouping
            "name":            identity.get("name") or identity.get("vendor_name") or "",
            "brandName":       identity.get("brandName", ""),
            "email":           identity.get("email", ""),
            "contactMobile":   identity.get("contactMobile") or identity.get("mobile", ""),
            "product_type":    link.get("product_type") or identity.get("product_type", ""),
            "status":          link.get("status", ""),
            "source":          link.get("source", ""),
            "source_po":       link.get("source_po", ""),
            "vendor_code":     link.get("vendor_code", ""),
            "tenant_id":       tenant_id,
            "tenant_name":     name_map.get(tenant_id, tenant_id or "— none —"),
            "password_set":    identity.get("password_set", False),
            "created_at":      link["created_at"].isoformat() if isinstance(link.get("created_at"), datetime) else str(link.get("created_at", "")),
            "approved_at":     link["approved_at"].isoformat() if isinstance(link.get("approved_at"), datetime) else (str(link.get("approved_at")) if link.get("approved_at") else None),
        })

    summary = {
        "total":            len(vendors),
        "pending":          sum(1 for v in vendors if v["status"] == "Pending"),
        "approved":         sum(1 for v in vendors if v["status"] == "Approved"),
        "self_registered":  sum(1 for v in vendors if v["source"] == "self_registration"),
        "invited":          sum(1 for v in vendors if v["source"] == "invite_link"),
        "walkin":           sum(1 for v in vendors if v["source"] == "walkin_po_self_register"),
        "no_tenant":        sum(1 for v in vendors if not v["tenant_id"]),
        # NEW — visible only via this split model: how many distinct
        # vendor identities have MORE than one retailer relationship.
        "multi_retailer_vendors": len({
            v["vendor_id"] for v in vendors
            if sum(1 for x in vendors if x["vendor_id"] == v["vendor_id"]) > 1
        }),
    }

    return JSONResponse({"status": "success", "summary": summary, "data": vendors})


@router.post("/vendors/{link_id}/approve")
async def approve_vendor_as_superadmin(
    link_id: str,
    background_tasks: BackgroundTasks,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    """
    Super Admin approves a vendor-tenant relationship (mainly for
    self-registered vendors, which have no HQ admin who "owns" an invite
    for them). `link_id` is the LINK's _id, matching the shape GET
    /superadmin/vendors returns.
    """
    if not ObjectId.is_valid(link_id):
        raise HTTPException(status_code=400, detail="Invalid vendor ID.")

    link = await vendor_tenant_links_collection.find_one({"_id": ObjectId(link_id)})
    if not link:
        raise HTTPException(status_code=404, detail="Vendor not found.")

    if link.get("status") == "Approved":
        raise HTTPException(status_code=400, detail="Vendor is already approved.")

    tenant_id = link.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="This relationship has no tenant assigned and cannot be approved.")

    identity = await vendors_collection.find_one({"_id": link.get("vendor_id")})
    if not identity:
        raise HTTPException(status_code=404, detail="Vendor identity not found.")

    product_type = link.get("product_type") or identity.get("product_type") or ""
    mapping = await product_mapping_collection.find_one(
        {"tenant_id": tenant_id, "product_type": {"$regex": product_type, "$options": "i"}}
    ) if product_type else None

    if mapping:
        division, section, department = mapping.get("division"), mapping.get("section"), mapping.get("department")
    else:
        division, section, department = "Uncategorized", "-", "-"

    last_link = await vendor_tenant_links_collection.find_one(
        {"vendor_code": {"$exists": True}, "tenant_id": tenant_id},
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
        {"_id": ObjectId(link_id)},
        {
            "$set": {
                "status":      "Approved",
                "division":    division,
                "section":     section,
                "department":  department,
                "vendor_code": vendor_code,
                "approved_at": datetime.utcnow(),
                "approved_by": "SuperAdmin",
            },
            "$push": {
                "approvals": {
                    "role": "SUPERADMIN", "approved_by": current_admin.get("name", "Super Admin"),
                    "department": "—", "time": datetime.utcnow(),
                }
            },
        }
    )

    # Only send the setup email if this identity doesn't already have
    # login access (i.e. this isn't a second/third retailer relationship
    # for someone who already set a password previously).
    if not identity.get("password_set"):
        setup_token = create_token(
            {"vendor_id": str(identity["_id"]), "email": identity.get("email", "")},
            expires_in=604800,
        )
        setup_link = frontend_url(f'merchandiser-seller/setup-password?token={setup_token}')
        background_tasks.add_task(
            send_vendor_confirmation_email,
            identity.get("email", ""), identity.get("name", ""), identity.get("brandName", "Your Brand"), setup_link,
        )
        note = "Confirmation email sent (valid 7 days)."
    else:
        note = "This vendor already has login access — new retailer relationship is live immediately."

    return {
        "message":     f"✅ Vendor {vendor_code} approved by Super Admin. {note}",
        "vendor_code": vendor_code,
        "tenant_id":   tenant_id,
    }


@router.post("/vendors/{link_id}/reject")
async def reject_vendor_as_superadmin(
    link_id: str,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    """Super Admin rejects a vendor-tenant relationship."""
    if not ObjectId.is_valid(link_id):
        raise HTTPException(status_code=400, detail="Invalid vendor ID.")

    link = await vendor_tenant_links_collection.find_one({"_id": ObjectId(link_id)})
    if not link:
        raise HTTPException(status_code=404, detail="Vendor not found.")

    if link.get("status") == "Approved":
        raise HTTPException(status_code=400, detail="Cannot reject an already-approved vendor.")

    await vendor_tenant_links_collection.update_one(
        {"_id": ObjectId(link_id)},
        {"$set": {"status": "Rejected", "rejected_at": datetime.utcnow(), "rejected_by": "SuperAdmin"}}
    )
    return {"message": "Vendor rejected."}
