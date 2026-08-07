"""
Retailer extra store/branch add-ons.

Retailer plans (retailer_plans.py) bundle a flat store count per tier
(Basic: 1, Professional: 5, Enterprise: unlimited). Previously the only way
past that limit was a full plan upgrade (store_upgrade_routes.py, which also
changes departments/permissions — a bigger step than "I just need one more
branch"). This lets a retailer rent extra store slots on a RECURRING monthly
basis instead, billed via the same in-app Razorpay Orders-API +
verify-payment pattern already used for the admin-seat add-on
(retailer_seat_addon_routes.py).

Unlike admin seats, this capacity is NOT a permanent unlock: it lapses if
not renewed within STORE_ADDON_PERIOD_DAYS, at which point sweep_lapsed()
below auto-deactivates the newest stores over the base plan limit. Meant to
be called daily by the same external scheduler that already hits
/api/subscriptions/send-expiry-reminders (this process has no in-process
cron of its own).
"""
import asyncio
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field

from .auth_routes import get_current_superadmin
from .deps import get_hq_tenant
from .store_upgrade_routes import (
    _checkout_signature_is_valid, _razorpay_capture_payment_sync, _razorpay_create_order_sync,
    _razorpay_credentials, _razorpay_fetch_payment_sync,
)
from ..activity_log import log_activity
from ..config import settings
from ..db import (
    retailer_store_addon_payments_collection, retailer_store_addons_collection, stores_collection,
    tenants_collection,
)
from ..email_utils import send_store_addon_lapsed_email, send_store_addon_receipt_email
from ..retailer_plans import retailer_plan_config

router = APIRouter(prefix="/api/retailer-store-addons", tags=["Retailer Store Add-ons"])
TenantCtx = Dict[str, Any]

PRICE_PER_STORE_INR_PER_MONTH = 15000  # recurring — unlike the admin-seat add-on, this lapses if not renewed
STORE_ADDON_PERIOD_DAYS = 30
MAX_STORES_PER_PURCHASE = 10


class StoreAddonCheckoutRequest(BaseModel):
    quantity: int = Field(..., ge=1, le=MAX_STORES_PER_PURCHASE)


def _active_addon_quantity(addon: Optional[dict], now: Optional[datetime] = None) -> int:
    """0 once the add-on's paid period has lapsed, even if the document
    itself hasn't been swept yet — /me must never show stale capacity."""
    if not addon:
        return 0
    now = now or datetime.utcnow()
    expires_at = addon.get("expires_at")
    if addon.get("status") != "active" or not expires_at or expires_at <= now:
        return 0
    return int(addon.get("quantity") or 0)


def _effective_store_limit(plan_cfg: dict, addon_quantity: int) -> Optional[int]:
    base = plan_cfg.get("stores")
    if base is None:
        return None  # Enterprise is already unlimited — an add-on is moot
    return base + addon_quantity


@router.get("/me")
async def get_store_addon_status(ctx: TenantCtx = Depends(get_hq_tenant)):
    tenant = await tenants_collection.find_one({"tenant_id": ctx["tenant_id"]}, {"plan": 1})
    plan_cfg = retailer_plan_config((tenant or {}).get("plan", "basic"))
    addon = await retailer_store_addons_collection.find_one({"tenant_id": ctx["tenant_id"]})
    now = datetime.utcnow()
    active_quantity = _active_addon_quantity(addon, now)
    used = await stores_collection.count_documents({"tenant_id": ctx["tenant_id"], "active": True})
    limit = _effective_store_limit(plan_cfg, active_quantity)
    expires_at = (addon or {}).get("expires_at")
    lapsed = bool(addon) and addon.get("status") == "lapsed"
    return {
        "plan_label": plan_cfg.get("label"),
        "base_limit": plan_cfg.get("stores"),
        "addon_stores": active_quantity,
        "effective_limit": limit,
        "used": used,
        "unlimited": limit is None,
        "expires_at": expires_at.isoformat() if isinstance(expires_at, datetime) else None,
        "lapsed": lapsed,
        "price_per_store_inr_per_month": PRICE_PER_STORE_INR_PER_MONTH,
        "max_stores_per_purchase": MAX_STORES_PER_PURCHASE,
        "period_days": STORE_ADDON_PERIOD_DAYS,
    }


@router.post("/checkout")
async def checkout_store_addon(payload: StoreAddonCheckoutRequest, ctx: TenantCtx = Depends(get_hq_tenant)):
    tenant = await tenants_collection.find_one({"tenant_id": ctx["tenant_id"]}, {"plan": 1})
    plan_cfg = retailer_plan_config((tenant or {}).get("plan", "basic"))
    if plan_cfg.get("stores") is None:
        raise HTTPException(status_code=400, detail="Your plan already has unlimited stores — no add-on needed.")

    key_id, key_secret = _razorpay_credentials()
    amount_inr = PRICE_PER_STORE_INR_PER_MONTH * payload.quantity
    now = datetime.utcnow()
    receipt = f"rms-stad-{ctx['tenant_id'][:14]}-{int(now.timestamp())}"[:40]
    order_payload = {
        "amount": int(amount_inr * 100),
        "currency": "INR",
        "receipt": receipt,
        "notes": {"purpose": "retailer_store_addon", "tenant_id": ctx["tenant_id"], "quantity": str(payload.quantity)},
    }
    razorpay_order = await asyncio.to_thread(_razorpay_create_order_sync, key_id, key_secret, order_payload)
    order_id = str(razorpay_order.get("id") or "")
    if not order_id:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Razorpay did not return an order ID.")

    payment = {
        "tenant_id": ctx["tenant_id"],
        "quantity": payload.quantity,
        "razorpay_order_id": order_id,
        "receipt": receipt,
        "amount_paise": int(razorpay_order.get("amount") or order_payload["amount"]),
        "amount_inr": amount_inr,
        "status": "created",
        "created_by": ctx.get("admin_id"),
        "created_at": now,
        "updated_at": now,
    }
    await retailer_store_addon_payments_collection.insert_one(payment)
    return {
        "key_id": key_id,
        "order_id": order_id,
        "amount": payment["amount_paise"],
        "currency": "INR",
        "quantity": payload.quantity,
        "price_per_store_inr_per_month": PRICE_PER_STORE_INR_PER_MONTH,
    }


@router.post("/verify-payment")
async def verify_store_addon_payment(payload: dict, ctx: TenantCtx = Depends(get_hq_tenant)):
    order_id = str(payload.get("razorpay_order_id") or "")
    payment_id = str(payload.get("razorpay_payment_id") or "")
    signature = str(payload.get("razorpay_signature") or "")
    if not order_id or not payment_id or not signature:
        raise HTTPException(status_code=400, detail="Razorpay payment verification details are incomplete.")

    key_id, key_secret = _razorpay_credentials()
    payment = await retailer_store_addon_payments_collection.find_one({"razorpay_order_id": order_id, "tenant_id": ctx["tenant_id"]})
    if not payment:
        raise HTTPException(status_code=404, detail="Store add-on payment order was not found.")
    if payment.get("status") == "captured":
        return {"message": "This payment was already confirmed.", "payment_status": "captured", "stores_added": 0}
    if not _checkout_signature_is_valid(order_id, payment_id, signature, key_secret):
        raise HTTPException(status_code=400, detail="Razorpay payment signature could not be verified.")

    gateway_payment = await asyncio.to_thread(_razorpay_fetch_payment_sync, key_id, key_secret, payment_id)
    if str(gateway_payment.get("order_id") or "") != order_id:
        raise HTTPException(status_code=400, detail="Razorpay payment does not belong to this order.")
    if int(gateway_payment.get("amount") or 0) != int(payment.get("amount_paise") or 0):
        raise HTTPException(status_code=400, detail="Razorpay payment amount does not match this order.")

    gateway_status = str(gateway_payment.get("status") or "")
    if gateway_status == "authorized":
        gateway_payment = await asyncio.to_thread(
            _razorpay_capture_payment_sync, key_id, key_secret, payment_id, int(payment.get("amount_paise") or 0)
        )
        gateway_status = str(gateway_payment.get("status") or "")

    now = datetime.utcnow()
    if gateway_status != "captured":
        await retailer_store_addon_payments_collection.update_one(
            {"_id": payment["_id"]},
            {"$set": {"status": gateway_status or "checkout_verified", "razorpay_payment_id": payment_id, "updated_at": now}},
        )
        return {
            "message": "Payment verified. It will be confirmed shortly — refresh in a moment.",
            "payment_status": gateway_status or "checkout_verified",
            "stores_added": 0,
        }

    # Atomic claim — a $set/reactivation side effect below must never fire
    # twice for the same payment, even if verify-payment is retried.
    claimed = await retailer_store_addon_payments_collection.find_one_and_update(
        {"_id": payment["_id"], "status": {"$ne": "captured"}},
        {"$set": {"status": "captured", "razorpay_payment_id": payment_id, "captured_at": now, "updated_at": now}},
    )
    if not claimed:
        return {"message": "This payment was already confirmed.", "payment_status": "captured", "stores_added": 0}

    # A fresh purchase resets the full 30-day window and adds this quantity
    # on top of whatever was still active — it does not stack separate
    # expiry dates per purchase, same simplification vendor_subscriptions
    # makes for tier renewals.
    existing_addon = await retailer_store_addons_collection.find_one({"tenant_id": ctx["tenant_id"]})
    carried_over = _active_addon_quantity(existing_addon, now)
    new_quantity = carried_over + payment["quantity"]
    new_expires_at = now + timedelta(days=STORE_ADDON_PERIOD_DAYS)
    await retailer_store_addons_collection.update_one(
        {"tenant_id": ctx["tenant_id"]},
        {
            "$set": {
                "tenant_id": ctx["tenant_id"],
                "quantity": new_quantity,
                "status": "active",
                "expires_at": new_expires_at,
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )

    # A purchase can also bring back stores a previous lapse auto-deactivated
    # (see sweep_lapsed_store_addons) — reactivate the most-recently-lapsed
    # ones first, up to what the new quantity now covers.
    reactivated = 0
    tenant = await tenants_collection.find_one({"tenant_id": ctx["tenant_id"]}, {"plan": 1})
    plan_cfg = retailer_plan_config((tenant or {}).get("plan", "basic"))
    effective_limit = _effective_store_limit(plan_cfg, new_quantity)
    if effective_limit is not None:
        active_count = await stores_collection.count_documents({"tenant_id": ctx["tenant_id"], "active": True})
        reactivatable_slots = effective_limit - active_count
        if reactivatable_slots > 0:
            lapsed_stores = await stores_collection.find(
                {"tenant_id": ctx["tenant_id"], "active": False, "deactivation_reason": "store_addon_lapsed"},
            ).sort("deactivated_at", -1).to_list(reactivatable_slots)
            if lapsed_stores:
                await stores_collection.update_many(
                    {"_id": {"$in": [s["_id"] for s in lapsed_stores]}},
                    {"$set": {"active": True, "updated_at": now}, "$unset": {"deactivation_reason": "", "deactivated_at": ""}},
                )
                reactivated = len(lapsed_stores)

    await log_activity(
        ctx.get("admin_name", ""), f"Purchased {payment['quantity']} extra store/branch slot(s)", type="create",
    )

    admin_email = ctx.get("admin_email")
    if admin_email:
        try:
            await send_store_addon_receipt_email(
                admin_email, ctx.get("admin_name") or "there", payment["quantity"], payment["amount_inr"],
                new_quantity, new_expires_at,
            )
        except Exception:
            pass

    return {
        "message": f"Payment captured — {payment['quantity']} store slot(s) added.",
        "payment_status": "captured",
        "stores_added": payment["quantity"],
        "reactivated_stores": reactivated,
        "total_addon_stores": new_quantity,
        "expires_at": new_expires_at.isoformat(),
    }


async def _authorize_cron_or_superadmin(authorization: Optional[str], x_cron_secret: Optional[str]) -> None:
    if settings.cron_secret and x_cron_secret == settings.cron_secret:
        return
    if authorization and authorization.startswith("Bearer "):
        try:
            await get_current_superadmin(token=authorization.split(" ", 1)[1])
            return
        except HTTPException:
            pass
    raise HTTPException(status_code=401, detail="Provide a valid X-Cron-Secret header, or a Super Admin bearer token.")


@router.post("/sweep-lapsed")
async def sweep_lapsed_store_addons(
    authorization: Optional[str] = Header(None),
    x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret"),
):
    """Deactivate stores over the base plan limit for any tenant whose store
    add-on expired without renewal, then email the HQ Admin what happened.
    Meant to run daily from the same external scheduler as
    /api/subscriptions/send-expiry-reminders — this process has no
    in-process cron of its own."""
    await _authorize_cron_or_superadmin(authorization, x_cron_secret)

    now = datetime.utcnow()
    tenants_affected = 0
    stores_deactivated = 0
    async for addon in retailer_store_addons_collection.find({"status": "active", "expires_at": {"$lte": now}}):
        tenant_id = addon["tenant_id"]
        tenant = await tenants_collection.find_one({"tenant_id": tenant_id})
        await retailer_store_addons_collection.update_one(
            {"_id": addon["_id"]}, {"$set": {"status": "lapsed", "updated_at": now}},
        )
        if not tenant:
            continue
        plan_cfg = retailer_plan_config(tenant.get("plan", "basic"))
        base_limit = plan_cfg.get("stores")
        if base_limit is None:
            continue

        active_stores = await stores_collection.find(
            {"tenant_id": tenant_id, "active": True},
        ).sort("created_at", -1).to_list(None)
        over_limit = len(active_stores) - base_limit
        if over_limit <= 0:
            continue

        to_deactivate = active_stores[:over_limit]
        await stores_collection.update_many(
            {"_id": {"$in": [s["_id"] for s in to_deactivate]}},
            {"$set": {"active": False, "deactivation_reason": "store_addon_lapsed", "deactivated_at": now}},
        )
        stores_deactivated += len(to_deactivate)
        tenants_affected += 1

        hq_email = tenant.get("hq_admin_email")
        if hq_email:
            try:
                await send_store_addon_lapsed_email(
                    hq_email, tenant.get("hq_admin_name") or "there", [s.get("name", "") for s in to_deactivate],
                )
            except Exception:
                pass

    return {"status": "success", "tenants_affected": tenants_affected, "stores_deactivated": stores_deactivated}
