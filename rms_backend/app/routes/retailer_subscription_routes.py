"""Single-store retailer subscription status and monthly renewal."""
import asyncio
import math
from datetime import datetime, timedelta

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from ..config import settings
from ..db import retailer_subscription_payments_collection, tenants_collection
from ..retailer_plans import is_paid_retailer_plan, normalize_retailer_plan, retailer_plan_config
from .deps import get_tenant
from .store_upgrade_routes import _razorpay_create_payment_link_sync, _razorpay_credentials

router = APIRouter(prefix="/api/retailer-subscriptions", tags=["Retailer Subscriptions"])
RENEWAL_LINK_VALIDITY_DAYS = 7
GRACE_PERIOD_DAYS = 7


def _serialize_date(value):
    return value.isoformat() if isinstance(value, datetime) else None


async def _single_store_tenant(ctx: dict) -> dict:
    tenant = await tenants_collection.find_one({"tenant_id": ctx["tenant_id"]})
    if not tenant:
        raise HTTPException(status_code=404, detail="Retailer account was not found.")
    if tenant.get("account_type") != "single_store":
        raise HTTPException(status_code=403, detail="This subscription view is for single-store accounts only.")
    return tenant


def _subscription_view(tenant: dict) -> dict:
    plan = normalize_retailer_plan(tenant.get("plan"))
    config = retailer_plan_config(plan)
    is_paid = is_paid_retailer_plan(plan)
    expires_at = tenant.get("subscription_expires_at")
    now = datetime.utcnow()
    days_remaining = None
    access_state = "internal"

    if is_paid:
        if isinstance(expires_at, datetime):
            seconds = (expires_at - now).total_seconds()
            days_remaining = max(0, math.ceil(seconds / 86400))
            if seconds >= 0:
                access_state = "active"
            elif seconds >= -(GRACE_PERIOD_DAYS * 86400):
                access_state = "grace"
            else:
                access_state = "expired"
        else:
            access_state = "renewal_required"

    return {
        "plan": plan,
        "plan_label": config.get("label", "Basic"),
        "amount_inr": config.get("price_inr", 0),
        "billing_period_days": config.get("billing_period_days"),
        "is_paid_plan": is_paid,
        "subscription_status": tenant.get("subscription_status", "active"),
        "access_state": access_state,
        "days_remaining": days_remaining,
        "next_payment_due": _serialize_date(expires_at),
        "grace_period_days": GRACE_PERIOD_DAYS if is_paid else 0,
        "renewal_available": is_paid,
    }


@router.get("/me")
async def get_my_retailer_subscription(ctx: dict = Depends(get_tenant)):
    """Show only the logged-in single-store tenant's billing countdown."""
    tenant = await _single_store_tenant(ctx)
    return _subscription_view(tenant)


@router.post("/renew")
async def create_retailer_renewal_link(ctx: dict = Depends(get_tenant)):
    """Create a short-lived Razorpay-hosted renewal link for the current plan."""
    tenant = await _single_store_tenant(ctx)
    plan = normalize_retailer_plan(tenant.get("plan"))
    if not is_paid_retailer_plan(plan):
        raise HTTPException(status_code=409, detail="This internal plan does not need a subscription payment.")

    config = retailer_plan_config(plan)
    now = datetime.utcnow()
    expires_at = now + timedelta(days=RENEWAL_LINK_VALIDITY_DAYS)
    key_id, key_secret = _razorpay_credentials()
    amount_paise = int(config["price_inr"] * 100)
    reference_id = f"RMS-RENEW-{tenant['tenant_id']}-{int(now.timestamp())}"[:40]
    customer = {
        "name": tenant.get("hq_admin_name") or tenant.get("company_name") or "RMS retailer",
        "email": tenant.get("hq_admin_email") or "",
    }
    contact = "".join(char for char in str(tenant.get("phone") or "") if char.isdigit())
    if len(contact) >= 10:
        customer["contact"] = contact[-10:]
    if not customer["email"]:
        customer.pop("email")

    razorpay_link = await asyncio.to_thread(
        _razorpay_create_payment_link_sync,
        key_id,
        key_secret,
        {
            "amount": amount_paise,
            "currency": "INR",
            "accept_partial": False,
            "expire_by": int(expires_at.timestamp()),
            "reference_id": reference_id,
            "description": f"RMS {config['label']} renewal - {tenant.get('company_name') or tenant['tenant_id']}",
            "customer": customer,
            "notify": {"email": bool(customer.get("email")), "sms": bool(customer.get("contact"))},
            "reminder_enable": True,
            "callback_url": f"{settings.frontend_base_url.rstrip('/')}/retailer/complete-payment?status=processing",
            "callback_method": "get",
            "notes": {
                "purpose": "retailer_renewal",
                "tenant_id": tenant["tenant_id"],
                "plan": plan,
            },
        },
    )
    payment_link_id = str(razorpay_link.get("id") or "")
    payment_link_url = str(razorpay_link.get("short_url") or "")
    if not payment_link_id or not payment_link_url:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Razorpay did not return a hosted renewal link.")

    await retailer_subscription_payments_collection.insert_one({
        "tenant_id": tenant["tenant_id"],
        "company_name": tenant.get("company_name", ""),
        "plan": plan,
        "amount_paise": amount_paise,
        "amount_inr": config["price_inr"],
        "currency": "INR",
        "status": "renewal_link_created",
        "payment_kind": "renewal",
        "razorpay_order_id": f"payment_link:{payment_link_id}",
        "razorpay_payment_link_id": payment_link_id,
        "razorpay_payment_link_url": payment_link_url,
        "razorpay_payment_link_reference": reference_id,
        "payment_link_expires_at": expires_at,
        "created_at": now,
        "updated_at": now,
    })
    return {
        "message": "Secure Razorpay renewal link created.",
        "payment_link": payment_link_url,
        "expires_at": expires_at.isoformat(),
        "amount_inr": config["price_inr"],
    }


async def process_retailer_renewal_payment_link_webhook(event: dict, event_id: str = "") -> dict | None:
    """Extend a single-store subscription only after Razorpay's signed payment_link.paid event."""
    if str(event.get("event") or "") != "payment_link.paid":
        return None
    payload = event.get("payload") or {}
    link = (payload.get("payment_link") or {}).get("entity") or {}
    notes = link.get("notes") or {}
    if str(notes.get("purpose") or "") != "retailer_renewal":
        return None

    payment_link_id = str(link.get("id") or "")
    tenant_id = str(notes.get("tenant_id") or "")
    payment_entity = (payload.get("payment") or {}).get("entity") or {}
    payment_id = str(payment_entity.get("id") or "")
    if not payment_link_id or not tenant_id or not payment_id:
        return {"status": "ignored", "reason": "invalid_retailer_renewal_link"}

    payment = await retailer_subscription_payments_collection.find_one({
        "tenant_id": tenant_id,
        "payment_kind": "renewal",
        "razorpay_order_id": f"payment_link:{payment_link_id}",
        "razorpay_payment_link_id": payment_link_id,
    })
    if not payment:
        return {"status": "ignored", "reason": "unknown_retailer_renewal_link"}
    if payment.get("status") == "captured":
        return {"status": "already_processed"}
    if int(link.get("amount_paid") or 0) != int(payment.get("amount_paise") or 0):
        return {"status": "ignored", "reason": "amount_mismatch"}

    tenant = await tenants_collection.find_one({"tenant_id": tenant_id})
    if not tenant:
        return {"status": "ignored", "reason": "unknown_tenant"}
    plan = normalize_retailer_plan(tenant.get("plan"))
    if not is_paid_retailer_plan(plan):
        return {"status": "ignored", "reason": "non_paid_plan"}

    now = datetime.utcnow()
    current_due = tenant.get("subscription_expires_at")
    period_days = int(retailer_plan_config(plan)["billing_period_days"])
    next_due = (current_due if isinstance(current_due, datetime) and current_due > now else now) + timedelta(days=period_days)
    claim = await retailer_subscription_payments_collection.update_one(
        {"_id": payment["_id"], "status": {"$ne": "captured"}},
        {"$set": {"status": "captured", "razorpay_payment_id": payment_id, "captured_at": now, "updated_at": now}, "$addToSet": {"webhook_event_ids": event_id or f"payment_link.paid:{payment_id}"}},
    )
    if not claim.modified_count:
        return {"status": "already_processed"}
    await tenants_collection.update_one(
        {"_id": tenant["_id"]},
        {"$set": {"subscription_status": "active", "subscription_renewed_at": now, "subscription_expires_at": next_due, "subscription_payment_id": payment_id, "updated_at": now}},
    )
    return {"status": "renewed", "tenant_id": tenant_id, "next_payment_due": next_due.isoformat()}