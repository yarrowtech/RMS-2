"""Retailer subscription status and monthly renewal — single-store and
multi-store tenants alike, whenever their plan is on the self-serve paid
billing path (has a real subscription_expires_at set)."""
import asyncio
import math
from datetime import datetime, timedelta
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException, status

from ..config import settings
from ..db import retailer_subscription_payments_collection, tenants_collection
from ..email_utils import send_retailer_subscription_expiring_email
from ..retailer_plans import is_paid_retailer_plan, normalize_retailer_plan, retailer_plan_config
from .auth_routes import get_current_superadmin
from .deps import get_tenant
from .store_upgrade_routes import _razorpay_create_payment_link_sync, _razorpay_credentials

router = APIRouter(prefix="/api/retailer-subscriptions", tags=["Retailer Subscriptions"])
RENEWAL_LINK_VALIDITY_DAYS = 7
GRACE_PERIOD_DAYS = 7
EXPIRY_REMINDER_WINDOW_DAYS = 14  # retailers get more runway than the 7-day vendor tier reminder


def _serialize_date(value):
    return value.isoformat() if isinstance(value, datetime) else None


async def _billed_tenant(ctx: dict) -> dict:
    """Was single_store-only. Self-serve signup (retailer_signup_routes.py)
    also creates department_retailer tenants on Professional/Enterprise with
    a real subscription_expires_at ticking — they had no way to see or renew
    it. Superadmin-created tenants (billing_mode="manual", either account
    type) never get subscription_expires_at set at all, so they naturally
    fall through to access_state="internal" / "renewal_required" in
    _subscription_view() exactly as single_store ones already did — this
    open-up changes nothing about that existing behavior, just who can see it."""
    tenant = await tenants_collection.find_one({"tenant_id": ctx["tenant_id"]})
    if not tenant:
        raise HTTPException(status_code=404, detail="Retailer account was not found.")
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
    """Billing countdown for the logged-in tenant — single-store or
    multi-store, whichever account type they are."""
    tenant = await _billed_tenant(ctx)
    return _subscription_view(tenant)


@router.get("/payment-return-status")
async def get_payment_return_status(
    payment_link_id: str,
    ctx: dict = Depends(get_tenant),
):
    """Return the webhook-verified status of this tenant's own payment link."""
    payment_link_id = str(payment_link_id or "").strip()
    if not payment_link_id:
        raise HTTPException(status_code=400, detail="payment_link_id is required.")

    payment = await retailer_subscription_payments_collection.find_one(
        {
            "tenant_id": ctx["tenant_id"],
            "razorpay_payment_link_id": payment_link_id,
        },
        {"status": 1, "payment_kind": 1, "plan": 1, "captured_at": 1},
    )
    if not payment:
        # Never reveal whether a link belongs to another tenant.
        raise HTTPException(status_code=404, detail="Payment link was not found for this retailer.")

    verified = payment.get("status") == "captured"
    return {
        "verified": verified,
        "payment_kind": payment.get("payment_kind", ""),
        "plan": payment.get("plan", ""),
        "captured_at": _serialize_date(payment.get("captured_at")),
        "redirect_path": "/admin" if verified and ctx.get("scope") == "hq" else None,
    }

@router.post("/renew")
async def create_retailer_renewal_link(ctx: dict = Depends(get_tenant)):
    """Create a short-lived Razorpay-hosted renewal link for the current plan."""
    tenant = await _billed_tenant(ctx)
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


@router.post("/upgrade")
async def create_retailer_upgrade_link(payload: dict, ctx: dict = Depends(get_tenant)):
    """
    Create a Razorpay-hosted payment link to move this tenant to a higher
    paid plan (Professional or Enterprise). Only a genuine upgrade is
    allowed — same logic tenants use for a normal renewal, just billed at
    the new plan's price and flipping `plan` on successful payment instead
    of only extending the expiry date.
    """
    requested_plan = normalize_retailer_plan(payload.get("requested_plan"))
    if requested_plan not in ("professional", "enterprise"):
        raise HTTPException(status_code=400, detail="requested_plan must be 'professional' or 'enterprise'.")

    tenant = await _billed_tenant(ctx)
    current_plan = normalize_retailer_plan(tenant.get("plan"))
    if not is_paid_retailer_plan(current_plan):
        raise HTTPException(status_code=409, detail="This internal plan cannot be upgraded here.")

    plan_order = {"basic": 0, "professional": 1, "enterprise": 2}
    if plan_order.get(requested_plan, -1) <= plan_order.get(current_plan, 0):
        raise HTTPException(status_code=400, detail=f"'{requested_plan}' is not an upgrade from your current '{current_plan}' plan.")

    config = retailer_plan_config(requested_plan)
    now = datetime.utcnow()
    expires_at = now + timedelta(days=RENEWAL_LINK_VALIDITY_DAYS)
    key_id, key_secret = _razorpay_credentials()
    amount_paise = int(config["price_inr"] * 100)
    reference_id = f"RMS-UPGRADE-{tenant['tenant_id']}-{int(now.timestamp())}"[:40]
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
            "description": f"RMS upgrade to {config['label']} - {tenant.get('company_name') or tenant['tenant_id']}",
            "customer": customer,
            "notify": {"email": bool(customer.get("email")), "sms": bool(customer.get("contact"))},
            "reminder_enable": True,
            "callback_url": f"{settings.frontend_base_url.rstrip('/')}/retailer/complete-payment?status=processing",
            "callback_method": "get",
            "notes": {
                "purpose": "retailer_upgrade",
                "tenant_id": tenant["tenant_id"],
                "plan": requested_plan,
                "previous_plan": current_plan,
            },
        },
    )
    payment_link_id = str(razorpay_link.get("id") or "")
    payment_link_url = str(razorpay_link.get("short_url") or "")
    if not payment_link_id or not payment_link_url:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Razorpay did not return a hosted upgrade link.")

    await retailer_subscription_payments_collection.insert_one({
        "tenant_id": tenant["tenant_id"],
        "company_name": tenant.get("company_name", ""),
        "plan": requested_plan,
        "previous_plan": current_plan,
        "amount_paise": amount_paise,
        "amount_inr": config["price_inr"],
        "currency": "INR",
        "status": "upgrade_link_created",
        "payment_kind": "upgrade",
        "razorpay_order_id": f"payment_link:{payment_link_id}",
        "razorpay_payment_link_id": payment_link_id,
        "razorpay_payment_link_url": payment_link_url,
        "razorpay_payment_link_reference": reference_id,
        "payment_link_expires_at": expires_at,
        "created_at": now,
        "updated_at": now,
    })
    return {
        "message": f"Secure Razorpay upgrade link created for the {config['label']} plan.",
        "payment_link": payment_link_url,
        "expires_at": expires_at.isoformat(),
        "amount_inr": config["price_inr"],
        "requested_plan": requested_plan,
    }


async def process_retailer_upgrade_payment_link_webhook(event: dict, event_id: str = "") -> dict | None:
    """Flip the tenant onto its new (higher) plan after Razorpay confirms the upgrade payment."""
    if str(event.get("event") or "") != "payment_link.paid":
        return None
    payload = event.get("payload") or {}
    link = (payload.get("payment_link") or {}).get("entity") or {}
    notes = link.get("notes") or {}
    if str(notes.get("purpose") or "") != "retailer_upgrade":
        return None

    payment_link_id = str(link.get("id") or "")
    tenant_id = str(notes.get("tenant_id") or "")
    requested_plan = normalize_retailer_plan(notes.get("plan"))
    payment_entity = (payload.get("payment") or {}).get("entity") or {}
    payment_id = str(payment_entity.get("id") or "")
    if not payment_link_id or not tenant_id or not payment_id:
        return {"status": "ignored", "reason": "invalid_retailer_upgrade_link"}

    payment = await retailer_subscription_payments_collection.find_one({
        "tenant_id": tenant_id,
        "payment_kind": "upgrade",
        "razorpay_order_id": f"payment_link:{payment_link_id}",
        "razorpay_payment_link_id": payment_link_id,
    })
    if not payment:
        return {"status": "ignored", "reason": "unknown_retailer_upgrade_link"}
    if payment.get("status") == "captured":
        return {"status": "already_processed"}
    if int(link.get("amount_paid") or 0) != int(payment.get("amount_paise") or 0):
        return {"status": "ignored", "reason": "amount_mismatch"}

    tenant = await tenants_collection.find_one({"tenant_id": tenant_id})
    if not tenant:
        return {"status": "ignored", "reason": "unknown_tenant"}

    now = datetime.utcnow()
    period_days = int(retailer_plan_config(requested_plan)["billing_period_days"])
    next_due = now + timedelta(days=period_days)
    claim = await retailer_subscription_payments_collection.update_one(
        {"_id": payment["_id"], "status": {"$ne": "captured"}},
        {"$set": {"status": "captured", "razorpay_payment_id": payment_id, "captured_at": now, "updated_at": now}, "$addToSet": {"webhook_event_ids": event_id or f"payment_link.paid:{payment_id}"}},
    )
    if not claim.modified_count:
        return {"status": "already_processed"}
    await tenants_collection.update_one(
        {"_id": tenant["_id"]},
        {"$set": {
            "plan": requested_plan,
            "subscription_status": "active",
            "subscription_renewed_at": now,
            "subscription_expires_at": next_due,
            "subscription_payment_id": payment_id,
            "updated_at": now,
        }},
    )
    return {"status": "upgraded", "tenant_id": tenant_id, "plan": requested_plan, "next_payment_due": next_due.isoformat()}


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


@router.post("/send-expiry-reminders")
async def send_retailer_expiry_reminders(
    authorization: Optional[str] = Header(None),
    x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret"),
):
    """Email every retailer (single- or multi-store) whose paid plan is
    lapsed or renews within 14 days — the in-app banner only reaches an
    HQ/Store Owner actively logged in, so this reaches everyone else. Meant
    to run once a day from the same external scheduler as
    /api/subscriptions/send-expiry-reminders (this process has no
    in-process cron of its own); auth via either a Super Admin JWT or
    CRON_SECRET so a scheduler with no user login can call it."""
    await _authorize_cron_or_superadmin(authorization, x_cron_secret)

    now = datetime.utcnow()
    reminder_window = now + timedelta(days=EXPIRY_REMINDER_WINDOW_DAYS)
    sent, lapsed_sent = 0, 0
    async for tenant in tenants_collection.find({
        "subscription_status": {"$in": ["active", None]},
        "subscription_expires_at": {"$lte": reminder_window, "$ne": None},
    }):
        plan = normalize_retailer_plan(tenant.get("plan"))
        if not is_paid_retailer_plan(plan):
            continue
        email = tenant.get("hq_admin_email")
        if not email:
            continue
        expires_at = tenant.get("subscription_expires_at")
        lapsed = bool(expires_at and expires_at <= now)
        days_left = max((expires_at - now).days, 0) if expires_at and not lapsed else 0
        plan_label = retailer_plan_config(plan).get("label", plan.title())
        try:
            delivered = await send_retailer_subscription_expiring_email(
                email, tenant.get("hq_admin_name") or "there", plan_label, days_left, lapsed,
            )
        except Exception:
            delivered = False
        if delivered:
            sent += 1
            if lapsed:
                lapsed_sent += 1
    return {"status": "success", "reminders_sent": sent, "lapsed_reminders_sent": lapsed_sent}