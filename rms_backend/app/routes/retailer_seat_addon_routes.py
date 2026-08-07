"""
Retailer HQ admin seat add-ons.

Retailer plans (retailer_plans.py) bundle a flat admin-seat count per tier
(Basic: 3, Professional: 15, Enterprise: unlimited). A retailer at their
limit previously had no option except upgrading the entire plan tier — a
large price jump just to add one more admin. This lets them buy extra
seats individually instead, billed via the same in-app Razorpay Orders-API
+ verify-payment pattern already used for store-upgrade checkout
(store_upgrade_routes.py) — synchronous confirmation, no webhook needed,
since this is a logged-in, in-dashboard purchase, not an emailed link.
"""
import asyncio
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from .deps import get_hq_tenant
from .store_upgrade_routes import (
    _checkout_signature_is_valid, _razorpay_capture_payment_sync, _razorpay_create_order_sync,
    _razorpay_credentials, _razorpay_fetch_payment_sync,
)
from ..activity_log import log_activity
from ..db import admins_collection, retailer_seat_addon_payments_collection, tenants_collection
from ..retailer_plans import retailer_plan_config

router = APIRouter(prefix="/api/retailer-seats", tags=["Retailer Seat Add-ons"])
TenantCtx = Dict[str, Any]

PRICE_PER_SEAT_INR = 5000  # flat, per additional admin seat (one-time; seats never expire/renew)
MAX_SEATS_PER_PURCHASE = 20


class SeatCheckoutRequest(BaseModel):
    quantity: int = Field(..., ge=1, le=MAX_SEATS_PER_PURCHASE)


def _effective_admin_limit(plan_cfg: dict, bonus_seats: int) -> Optional[int]:
    base = plan_cfg.get("admins")
    if base is None:
        return None  # Enterprise is already unlimited — bonus seats are moot
    return base + bonus_seats


@router.get("/me")
async def get_seat_status(ctx: TenantCtx = Depends(get_hq_tenant)):
    tenant = await tenants_collection.find_one({"tenant_id": ctx["tenant_id"]}, {"plan": 1, "bonus_admin_seats": 1})
    plan_cfg = retailer_plan_config((tenant or {}).get("plan", "basic"))
    bonus_seats = int((tenant or {}).get("bonus_admin_seats") or 0)
    used = await admins_collection.count_documents({"tenant_id": ctx["tenant_id"], "department": {"$ne": "SUPERADMIN"}})
    limit = _effective_admin_limit(plan_cfg, bonus_seats)
    return {
        "plan_label": plan_cfg.get("label"),
        "base_limit": plan_cfg.get("admins"),
        "bonus_seats": bonus_seats,
        "effective_limit": limit,
        "used": used,
        "unlimited": limit is None,
        "price_per_seat_inr": PRICE_PER_SEAT_INR,
        "max_seats_per_purchase": MAX_SEATS_PER_PURCHASE,
    }


@router.post("/checkout")
async def checkout_seat_addon(payload: SeatCheckoutRequest, ctx: TenantCtx = Depends(get_hq_tenant)):
    tenant = await tenants_collection.find_one({"tenant_id": ctx["tenant_id"]}, {"plan": 1})
    plan_cfg = retailer_plan_config((tenant or {}).get("plan", "basic"))
    if plan_cfg.get("admins") is None:
        raise HTTPException(status_code=400, detail="Your plan already has unlimited admin seats — no add-on needed.")

    key_id, key_secret = _razorpay_credentials()
    amount_inr = PRICE_PER_SEAT_INR * payload.quantity
    now = datetime.utcnow()
    receipt = f"rms-seat-{ctx['tenant_id'][:14]}-{int(now.timestamp())}"[:40]
    order_payload = {
        "amount": int(amount_inr * 100),
        "currency": "INR",
        "receipt": receipt,
        "notes": {"purpose": "retailer_seat_addon", "tenant_id": ctx["tenant_id"], "quantity": str(payload.quantity)},
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
    await retailer_seat_addon_payments_collection.insert_one(payment)
    return {
        "key_id": key_id,
        "order_id": order_id,
        "amount": payment["amount_paise"],
        "currency": "INR",
        "quantity": payload.quantity,
        "price_per_seat_inr": PRICE_PER_SEAT_INR,
    }


@router.post("/verify-payment")
async def verify_seat_addon_payment(payload: dict, ctx: TenantCtx = Depends(get_hq_tenant)):
    order_id = str(payload.get("razorpay_order_id") or "")
    payment_id = str(payload.get("razorpay_payment_id") or "")
    signature = str(payload.get("razorpay_signature") or "")
    if not order_id or not payment_id or not signature:
        raise HTTPException(status_code=400, detail="Razorpay payment verification details are incomplete.")

    key_id, key_secret = _razorpay_credentials()
    payment = await retailer_seat_addon_payments_collection.find_one({"razorpay_order_id": order_id, "tenant_id": ctx["tenant_id"]})
    if not payment:
        raise HTTPException(status_code=404, detail="Seat add-on payment order was not found.")
    if payment.get("status") == "captured":
        return {"message": "This payment was already confirmed.", "payment_status": "captured", "bonus_seats_added": 0}
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
        await retailer_seat_addon_payments_collection.update_one(
            {"_id": payment["_id"]},
            {"$set": {"status": gateway_status or "checkout_verified", "razorpay_payment_id": payment_id, "updated_at": now}},
        )
        return {
            "message": "Payment verified. It will be confirmed shortly — refresh in a moment.",
            "payment_status": gateway_status or "checkout_verified",
            "bonus_seats_added": 0,
        }

    # Atomic claim — a $inc side effect below must never fire twice for the
    # same payment, even if verify-payment is retried/double-submitted.
    claimed = await retailer_seat_addon_payments_collection.find_one_and_update(
        {"_id": payment["_id"], "status": {"$ne": "captured"}},
        {"$set": {"status": "captured", "razorpay_payment_id": payment_id, "captured_at": now, "updated_at": now}},
    )
    if not claimed:
        return {"message": "This payment was already confirmed.", "payment_status": "captured", "bonus_seats_added": 0}

    await tenants_collection.update_one(
        {"tenant_id": ctx["tenant_id"]},
        {"$inc": {"bonus_admin_seats": payment["quantity"]}, "$set": {"updated_at": now}},
    )
    await log_activity(
        ctx.get("admin_name", ""), f"Purchased {payment['quantity']} extra admin seat(s)", type="create",
    )
    return {
        "message": f"Payment captured — {payment['quantity']} admin seat(s) added.",
        "payment_status": "captured",
        "bonus_seats_added": payment["quantity"],
    }
