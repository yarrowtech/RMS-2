"""Customer CRM coupons — its own tab, gated the same way Lucky Draw's tab
is (see customer_crm_routes.CRM_TAB_PERMISSIONS / admin_crm_tabs).

Scope decided with the user up front, so this stays intentionally small:
  - Percentage-off only (no flat-amount coupons yet).
  - Redemption is manual — there is no real "apply a coupon" step in
    Cashier/POS today, so staff look a code up here (same phone-lookup
    pattern already built for Lucky Draw), see it's valid, type the
    discount into the bill by hand, then mark it redeemed here. No POS
    integration is attempted; that would be a separate, bigger project.
  - HQ Admin only creates/disables coupons. Any CRM-permitted staff (store
    or HQ) can look one up and mark it redeemed, tenant-wide — a coupon
    isn't locked to the store that issued it, since the customer may well
    redeem it at a different branch.
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from ..db import coupons_collection
from .customer_crm_routes import clean, require_crm_tab
from .deps import get_tenant

router = APIRouter(prefix="/api/customer-crm/coupons", tags=["Customer CRM Coupons"])


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def serialize(doc: Optional[dict]) -> Optional[dict]:
    if not doc:
        return None
    out = {}
    for key, value in doc.items():
        if key == "_id":
            out["id"] = str(value)
        elif isinstance(value, datetime):
            out[key] = value.isoformat()
        else:
            out[key] = value
    return out


class CouponPayload(BaseModel):
    discount_pct: float
    min_bill_amount: float = 0
    expiry_date: str = ""
    customer_name: str = ""
    contact_no: str = ""
    notes: str = ""


def require_hq(ctx: Dict[str, Any]) -> Dict[str, Any]:
    if ctx.get("scope") != "hq":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only HQ Admin can manage coupons.")
    return ctx


def _generate_code() -> str:
    return "SAVE-" + uuid.uuid4().hex[:6].upper()


@router.get("")
async def list_coupons(ctx: Dict[str, Any] = Depends(get_tenant)):
    ctx = require_crm_tab(ctx, "coupons")
    rows = await coupons_collection.find({"tenant_id": ctx["tenant_id"]}).sort("created_at", -1).to_list(500)
    return [serialize(r) for r in rows]


async def issue_coupon(
    tenant_id: str, discount_pct: float, min_bill_amount: float = 0, expiry_date: str = "",
    customer_name: str = "", contact_no: str = "", notes: str = "",
    created_by: Optional[str] = None, created_by_name: str = "",
) -> dict:
    """Shared by HQ's manual "New coupon" and the Lucky Draw auto-issued
    thank-you coupon — one place that actually writes a coupon document."""
    now = now_utc()
    for _ in range(5):
        code = _generate_code()
        if not await coupons_collection.find_one({"tenant_id": tenant_id, "code": code}, {"_id": 1}):
            break
    else:
        raise HTTPException(status_code=500, detail="Could not generate a unique coupon code, try again.")
    doc = {
        "tenant_id": tenant_id,
        "code": code,
        "discount_pct": round(float(discount_pct), 2),
        "min_bill_amount": max(0.0, float(min_bill_amount or 0)),
        "expiry_date": clean(expiry_date),
        "customer_name": clean(customer_name),
        "contact_no": clean(contact_no),
        "notes": clean(notes),
        "status": "ACTIVE",
        "redeemed_at": None,
        "redeemed_by": None,
        "redeemed_by_name": None,
        "redeemed_store_id": None,
        "redeemed_store_name": None,
        "created_by": created_by,
        "created_by_name": created_by_name,
        "created_at": now,
        "updated_at": now,
    }
    result = await coupons_collection.insert_one(doc)
    return serialize(await coupons_collection.find_one({"_id": result.inserted_id}))


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_coupon(payload: CouponPayload, ctx: Dict[str, Any] = Depends(get_tenant)):
    ctx = require_hq(require_crm_tab(ctx, "coupons"))
    pct = float(payload.discount_pct or 0)
    if pct <= 0 or pct > 100:
        raise HTTPException(status_code=400, detail="Discount must be a percentage between 1 and 100.")
    return await issue_coupon(
        ctx["tenant_id"], pct, payload.min_bill_amount, payload.expiry_date,
        payload.customer_name, payload.contact_no, payload.notes,
        ctx.get("admin_id"), ctx.get("admin_name"),
    )


@router.patch("/{coupon_id}/status")
async def set_coupon_status(coupon_id: str, payload: dict, ctx: Dict[str, Any] = Depends(get_tenant)):
    ctx = require_hq(require_crm_tab(ctx, "coupons"))
    if not ObjectId.is_valid(coupon_id):
        raise HTTPException(status_code=400, detail="Invalid coupon ID.")
    new_status = clean(payload.get("status")).upper()
    if new_status not in {"ACTIVE", "DISABLED"}:
        raise HTTPException(status_code=400, detail="Status must be ACTIVE or DISABLED.")
    coupon = await coupons_collection.find_one({"_id": ObjectId(coupon_id), "tenant_id": ctx["tenant_id"]})
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found.")
    if coupon.get("status") == "REDEEMED":
        raise HTTPException(status_code=409, detail="This coupon has already been redeemed.")
    await coupons_collection.update_one({"_id": coupon["_id"]}, {"$set": {"status": new_status, "updated_at": now_utc()}})
    return {"message": f"Coupon marked {new_status.title()}."}


@router.get("/lookup")
async def lookup_coupon(code: str = Query(...), ctx: Dict[str, Any] = Depends(get_tenant)):
    """Staff-facing check before manually applying a discount at billing —
    tells them whether a code is real, active, and what it's worth."""
    ctx = require_crm_tab(ctx, "coupons")
    cleaned = clean(code).upper()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Enter a coupon code to search.")
    coupon = await coupons_collection.find_one({"tenant_id": ctx["tenant_id"], "code": cleaned})
    if not coupon:
        return {"found": False}
    return {"found": True, "coupon": serialize(coupon)}


@router.post("/{coupon_id}/redeem")
async def redeem_coupon(coupon_id: str, ctx: Dict[str, Any] = Depends(get_tenant)):
    """Staff clicks this after they've already applied the discount on the
    bill by hand — this just records that it happened, once, so the same
    code can't be reused."""
    ctx = require_crm_tab(ctx, "coupons")
    if not ObjectId.is_valid(coupon_id):
        raise HTTPException(status_code=400, detail="Invalid coupon ID.")
    coupon = await coupons_collection.find_one({"_id": ObjectId(coupon_id), "tenant_id": ctx["tenant_id"]})
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found.")
    if coupon.get("status") == "REDEEMED":
        raise HTTPException(status_code=409, detail="This coupon has already been redeemed.")
    if coupon.get("status") == "DISABLED":
        raise HTTPException(status_code=409, detail="This coupon has been disabled.")
    now = now_utc()
    await coupons_collection.update_one({"_id": coupon["_id"]}, {"$set": {
        "status": "REDEEMED", "redeemed_at": now,
        "redeemed_by": ctx.get("admin_id"), "redeemed_by_name": ctx.get("admin_name"),
        "redeemed_store_id": ctx.get("store_id"), "redeemed_store_name": ctx.get("store_name"),
        "updated_at": now,
    }})
    return {"message": "Coupon marked redeemed."}
