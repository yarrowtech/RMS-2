"""
Retailer extra POS-terminal add-ons.

Retailer plans (retailer_plans.py) bundle a flat POS-terminal count per tier
(Basic: 3, Professional: 8, Enterprise: 15). Unlike stores/admins, Enterprise's
POS count is a REAL number, not unlimited — so even an Enterprise retailer can
buy past it. This mirrors retailer_seat_addon_routes.py exactly: a one-time,
permanent unlock (not a recurring charge like the store add-on), billed via
the same in-app Razorpay Orders-API + verify-payment pattern.

"Used" is counted from pos_terminals_collection (cashier_routes.py) — every
physical device that has ever opened the Cashier POS app and registered
itself, across every store belonging to this tenant.
"""
import asyncio
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

from .deps import get_hq_tenant
from .store_upgrade_routes import (
    _checkout_signature_is_valid, _razorpay_capture_payment_sync, _razorpay_create_order_sync,
    _razorpay_credentials, _razorpay_fetch_payment_sync,
)
from ..activity_log import log_activity
from ..db import pos_terminals_collection, retailer_pos_addon_payments_collection, tenants_collection
from ..email_utils import send_pos_addon_receipt_email
from ..retailer_plans import retailer_plan_config

router = APIRouter(prefix="/api/retailer-pos-addons", tags=["Retailer POS Add-ons"])
TenantCtx = Dict[str, Any]

PRICE_PER_POS_INR = 15000  # flat, per additional POS terminal (one-time; never expires/renews)
MAX_POS_PER_PURCHASE = 20


class PosCheckoutRequest(BaseModel):
    quantity: int = Field(..., ge=1, le=MAX_POS_PER_PURCHASE)


def _effective_pos_limit(plan_cfg: dict, bonus_pos: int) -> Optional[int]:
    base = plan_cfg.get("pos")
    if base is None:
        return None  # only true if a future plan ever sets pos=None (unlimited)
    return base + bonus_pos


@router.get("/me")
async def get_pos_addon_status(ctx: TenantCtx = Depends(get_hq_tenant)):
    tenant = await tenants_collection.find_one({"tenant_id": ctx["tenant_id"]}, {"plan": 1, "bonus_pos_seats": 1})
    plan_cfg = retailer_plan_config((tenant or {}).get("plan", "basic"))
    bonus_pos = int((tenant or {}).get("bonus_pos_seats") or 0)
    used = await pos_terminals_collection.count_documents({"tenant_id": ctx["tenant_id"]})
    limit = _effective_pos_limit(plan_cfg, bonus_pos)
    return {
        "plan_label": plan_cfg.get("label"),
        "base_limit": plan_cfg.get("pos"),
        "bonus_pos": bonus_pos,
        "effective_limit": limit,
        "used": used,
        "unlimited": limit is None,
        "price_per_pos_inr": PRICE_PER_POS_INR,
        "max_pos_per_purchase": MAX_POS_PER_PURCHASE,
    }


@router.post("/checkout")
async def checkout_pos_addon(payload: PosCheckoutRequest, ctx: TenantCtx = Depends(get_hq_tenant)):
    tenant = await tenants_collection.find_one({"tenant_id": ctx["tenant_id"]}, {"plan": 1})
    plan_cfg = retailer_plan_config((tenant or {}).get("plan", "basic"))
    if plan_cfg.get("pos") is None:
        raise HTTPException(status_code=400, detail="Your plan already has unlimited POS terminals — no add-on needed.")

    key_id, key_secret = _razorpay_credentials()
    amount_inr = PRICE_PER_POS_INR * payload.quantity
    now = datetime.utcnow()
    receipt = f"rms-pos-{ctx['tenant_id'][:14]}-{int(now.timestamp())}"[:40]
    order_payload = {
        "amount": int(amount_inr * 100),
        "currency": "INR",
        "receipt": receipt,
        "notes": {"purpose": "retailer_pos_addon", "tenant_id": ctx["tenant_id"], "quantity": str(payload.quantity)},
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
    await retailer_pos_addon_payments_collection.insert_one(payment)
    return {
        "key_id": key_id,
        "order_id": order_id,
        "amount": payment["amount_paise"],
        "currency": "INR",
        "quantity": payload.quantity,
        "price_per_pos_inr": PRICE_PER_POS_INR,
    }


@router.post("/verify-payment")
async def verify_pos_addon_payment(payload: dict, ctx: TenantCtx = Depends(get_hq_tenant)):
    order_id = str(payload.get("razorpay_order_id") or "")
    payment_id = str(payload.get("razorpay_payment_id") or "")
    signature = str(payload.get("razorpay_signature") or "")
    if not order_id or not payment_id or not signature:
        raise HTTPException(status_code=400, detail="Razorpay payment verification details are incomplete.")

    key_id, key_secret = _razorpay_credentials()
    payment = await retailer_pos_addon_payments_collection.find_one({"razorpay_order_id": order_id, "tenant_id": ctx["tenant_id"]})
    if not payment:
        raise HTTPException(status_code=404, detail="POS add-on payment order was not found.")
    if payment.get("status") == "captured":
        return {"message": "This payment was already confirmed.", "payment_status": "captured", "bonus_pos_added": 0}
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
        await retailer_pos_addon_payments_collection.update_one(
            {"_id": payment["_id"]},
            {"$set": {"status": gateway_status or "checkout_verified", "razorpay_payment_id": payment_id, "updated_at": now}},
        )
        return {
            "message": "Payment verified. It will be confirmed shortly — refresh in a moment.",
            "payment_status": gateway_status or "checkout_verified",
            "bonus_pos_added": 0,
        }

    # Atomic claim — a $inc side effect below must never fire twice for the
    # same payment, even if verify-payment is retried/double-submitted.
    claimed = await retailer_pos_addon_payments_collection.find_one_and_update(
        {"_id": payment["_id"], "status": {"$ne": "captured"}},
        {"$set": {"status": "captured", "razorpay_payment_id": payment_id, "captured_at": now, "updated_at": now}},
    )
    if not claimed:
        return {"message": "This payment was already confirmed.", "payment_status": "captured", "bonus_pos_added": 0}

    updated_tenant = await tenants_collection.find_one_and_update(
        {"tenant_id": ctx["tenant_id"]},
        {"$inc": {"bonus_pos_seats": payment["quantity"]}, "$set": {"updated_at": now}},
        return_document=ReturnDocument.AFTER,
    )
    await log_activity(
        ctx.get("admin_name", ""), f"Purchased {payment['quantity']} extra POS terminal(s)", type="create",
    )

    admin_email = ctx.get("admin_email")
    if admin_email:
        plan_cfg = retailer_plan_config((updated_tenant or {}).get("plan", "basic"))
        new_total_pos = _effective_pos_limit(plan_cfg, int((updated_tenant or {}).get("bonus_pos_seats") or 0))
        try:
            await send_pos_addon_receipt_email(
                admin_email, ctx.get("admin_name") or "there", payment["quantity"], payment["amount_inr"], new_total_pos,
            )
        except Exception:
            pass

    return {
        "message": f"Payment captured — {payment['quantity']} POS terminal(s) added.",
        "payment_status": "captured",
        "bonus_pos_added": payment["quantity"],
    }
