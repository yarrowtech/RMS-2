"""
subscription_routes.py
=========================
Vendor tier subscription system.

REQUIRED — add to db.py:
    vendor_subscriptions_collection = db["vendor_subscriptions"]

Wire in main.py:
    from .routes.subscription_routes import router as subscription_router
    app.include_router(subscription_router)

─────────────────────────────────────────────────────────────────────────────
THE MODEL
─────────────────────────────────────────────────────────────────────────────
One vendor_subscriptions_collection document per vendor identity (keyed by
vendor_id, NOT per tenant-link — a subscription is the vendor's own plan,
shared across every retailer relationship they have, matching how
vendor_catalogue_collection already works).

TIER_CONFIG below is the single source of truth for what each tier allows.
Both catalogue_routes.py (image count limit, expiry days) and vendor_routes.py
(business_type count limit) import get_vendor_tier() from this file rather
than hardcoding numbers, so the three enforcement points can never drift out
of sync with each other.

⚠️ PAYMENT IS A STUB. There is no real payment gateway wired in yet — see
the big warning on upgrade_subscription() below. Do not deploy the
`simulate_payment` flag to production; it exists purely so tier upgrades
are testable before a real gateway (Razorpay/Stripe/etc.) is connected.
"""

from fastapi import APIRouter, HTTPException, Header, Depends, Request, status
from datetime import datetime, timedelta
from typing import Optional, Any
from bson import ObjectId
import asyncio
import base64
import hashlib
import hmac
import json
import os
from urllib import error as urlerror
from urllib import request as urlrequest

from ..db import vendor_subscriptions_collection, vendor_subscription_payments_collection, vendor_catalogue_collection, vendors_collection
from ..config import settings
from .vendor_routes import decode_token

router = APIRouter(prefix="/api/subscriptions", tags=["Vendor Subscriptions"])
razorpay_webhook_router = APIRouter(prefix="/api/payments/razorpay", tags=["Razorpay Payments"])

RAZORPAY_ORDER_URL = "https://api.razorpay.com/v1/orders"


def _razorpay_credentials() -> tuple[str, str]:
    key_id = (settings.razorpay_key_id or os.environ.get("RAZORPAY_KEY_ID") or "").strip()
    key_secret = (settings.razorpay_key_secret or os.environ.get("RAZORPAY_KEY_SECRET") or "").strip()
    if not key_id or not key_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on the backend.",
        )
    return key_id, key_secret


def _webhook_secret() -> str:
    secret = (settings.razorpay_webhook_secret or os.environ.get("RAZORPAY_WEBHOOK_SECRET") or "").strip()
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Razorpay webhook verification is not configured.",
        )
    return secret


def _razorpay_create_order_sync(key_id: str, key_secret: str, payload: dict) -> dict:
    credentials = base64.b64encode(f"{key_id}:{key_secret}".encode("utf-8")).decode("ascii")
    request = urlrequest.Request(
        RAZORPAY_ORDER_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlrequest.urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except urlerror.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            detail = json.loads(raw).get("error", {}).get("description") or raw
        except json.JSONDecodeError:
            detail = raw
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Razorpay order creation failed: {detail}") from exc
    except OSError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not reach Razorpay. Please try again.") from exc


def _razorpay_capture_payment_sync(key_id: str, key_secret: str, payment_id: str, amount_paise: int) -> dict:
    credentials = base64.b64encode(f"{key_id}:{key_secret}".encode("utf-8")).decode("ascii")
    request = urlrequest.Request(
        f"https://api.razorpay.com/v1/payments/{payment_id}/capture",
        data=json.dumps({"amount": int(amount_paise), "currency": "INR"}).encode("utf-8"),
        headers={
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlrequest.urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except urlerror.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            detail = json.loads(raw).get("error", {}).get("description") or raw
        except json.JSONDecodeError:
            detail = raw
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Razorpay payment capture failed: {detail}") from exc
    except OSError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not reach Razorpay to capture the payment.") from exc

def _razorpay_fetch_payment_sync(key_id: str, key_secret: str, payment_id: str) -> dict:
    credentials = base64.b64encode(f"{key_id}:{key_secret}".encode("utf-8")).decode("ascii")
    request = urlrequest.Request(
        f"https://api.razorpay.com/v1/payments/{payment_id}",
        headers={"Authorization": f"Basic {credentials}"},
        method="GET",
    )
    try:
        with urlrequest.urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except urlerror.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not confirm the payment with Razorpay. Please wait a moment and refresh.",
        ) from exc
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not reach Razorpay to confirm the payment. Please wait a moment and refresh.",
        ) from exc


async def _mark_payment_captured_and_activate(payment: dict, payment_id: str, event_id: str = "") -> tuple[bool, int]:
    """Idempotently activate after a confirmed Razorpay capture."""
    now = datetime.utcnow()
    result = await vendor_subscription_payments_collection.update_one(
        {"_id": payment["_id"], "status": {"$ne": "captured"}},
        {
            "$set": {
                "status": "captured",
                "razorpay_payment_id": payment_id or payment.get("razorpay_payment_id", ""),
                "captured_at": now,
                "updated_at": now,
            },
            "$addToSet": {"webhook_event_ids": event_id or f"confirmed:{payment_id}"},
        },
    )
    if not result.modified_count:
        return False, 0
    extended_count = await _activate_paid_vendor_subscription(
        payment,
        payment_id or str(payment.get("razorpay_payment_id") or ""),
    )
    return True, extended_count

def _checkout_signature_is_valid(order_id: str, payment_id: str, signature: str, key_secret: str) -> bool:
    expected = hmac.new(
        key_secret.encode("utf-8"),
        f"{order_id}|{payment_id}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature or "")


def _webhook_signature_is_valid(raw_body: bytes, signature: str, webhook_secret: str) -> bool:
    expected = hmac.new(webhook_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature or "")


# ═══════════════════════════════════════════════════════════════════════════
# TIER CONFIG — single source of truth
# ═══════════════════════════════════════════════════════════════════════════

TIER_CONFIG = {
    "free": {
        "label":                "Free",
        "image_limit":          5,
        "photos_per_item":      1,      # NEW — was unlimited for every tier before this pass
        "visibility_days":      45,
        "business_type_limit":  1,
        "inquiry_limit_per_month": 20,
        "price_inr":            0,
        "priority_rank":        0,      # NEW — used to sort search results; higher shows first
        "featured_badge":       False,  # NEW
        "network_page_size":     8,
        "network_requests_per_month": 3,
        "finance_history_months": 3,
        "finance_transaction_limit": 10,
        "finance_export": False,
        "finance_retailer_breakdown": False,
        "finance_forecasting": False,
    },
    "standard": {
        "label":                "Standard",
        "image_limit":          10,
        "photos_per_item":      3,
        "visibility_days":      45,
        "business_type_limit":  3,
        "inquiry_limit_per_month": None,   # None = unlimited
        "price_inr":            499,
        "priority_rank":        1,
        "featured_badge":       False,
        "network_page_size":     20,
        "network_requests_per_month": 25,
        "finance_history_months": 12,
        "finance_transaction_limit": 100,
        "finance_export": True,
        "finance_retailer_breakdown": True,
        "finance_forecasting": False,
    },
    "premium": {
        "label":                "Premium",
        "image_limit":          25,
        "photos_per_item":      None,   # None = unlimited
        "visibility_days":      90,
        "business_type_limit":  None,
        "inquiry_limit_per_month": None,
        "price_inr":            1499,
        "priority_rank":        2,
        "featured_badge":       True,   # NEW — shown as a "Verified" badge in search/browse
        "network_page_size":     40,
        "network_requests_per_month": None,
        "finance_history_months": 36,
        "finance_transaction_limit": 500,
        "finance_export": True,
        "finance_retailer_breakdown": True,
        "finance_forecasting": True,
    },
}

DEFAULT_TIER = "free"


def _decode_vendor(authorization: Optional[str]) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization token missing")
    decoded = decode_token(authorization.split(" ")[1])
    if not decoded:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    vendor_id = decoded.get("vendor_id")
    if not vendor_id:
        raise HTTPException(status_code=403, detail="This endpoint requires a vendor account.")
    return vendor_id


async def get_vendor_tier(vendor_id: str) -> dict:
    """
    Returns the vendor's active tier config dict (from TIER_CONFIG), plus
    the raw subscription document. Falls back to "free" if no subscription
    record exists yet, or if a paid subscription has lapsed (expires_at in
    the past and not renewed) — a lapsed Standard/Premium vendor drops back
    to Free's limits, not to zero access.

    This is the function catalogue_routes.py and vendor_routes.py both call
    — the ONE place tier logic lives, so enforcement can't drift between
    "how many images can I upload" and "how many business types can I tag".
    """
    sub = await vendor_subscriptions_collection.find_one({"vendor_id": ObjectId(vendor_id)})
    tier_key = DEFAULT_TIER

    if sub:
        expires_at = sub.get("expires_at")
        is_active  = sub.get("status") == "active"
        not_lapsed = not expires_at or expires_at > datetime.utcnow()
        if is_active and not_lapsed:
            tier_key = sub.get("tier", DEFAULT_TIER)

    return {**TIER_CONFIG[tier_key], "tier": tier_key, "subscription": sub}


# ═══════════════════════════════════════════════════════════════════════════
# ROUTES
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/tiers")
async def list_tiers():
    """Public — tier comparison table for the upgrade screen. No auth needed."""
    return {"status": "success", "data": TIER_CONFIG}


@router.get("/me")
async def get_my_subscription(authorization: str = Header(None)):
    """
    Vendor's current tier + live usage against that tier's limits — powers
    the "3 of 5 images used" style display in VendorCatalogueTab.jsx.
    """
    vendor_id = _decode_vendor(authorization)
    tier = await get_vendor_tier(vendor_id)

    image_count = await vendor_catalogue_collection.count_documents({
        "vendor_id": ObjectId(vendor_id),
        "active": True,
    })

    vendor = await vendors_collection.find_one({"_id": ObjectId(vendor_id)})
    business_type_count = len((vendor or {}).get("business_type") or [])

    sub = tier.get("subscription")
    return {
        "status": "success",
        "data": {
            "tier":                  tier["tier"],
            "label":                 tier["label"],
            "image_limit":           tier["image_limit"],
            "images_used":           image_count,
            "visibility_days":       tier["visibility_days"],
            "business_type_limit":   tier["business_type_limit"],
            "business_types_used":   business_type_count,
            "inquiry_limit_per_month": tier["inquiry_limit_per_month"],
            "network_page_size":       tier["network_page_size"],
            "network_requests_per_month": tier["network_requests_per_month"],
            "finance_history_months": tier["finance_history_months"],
            "finance_transaction_limit": tier["finance_transaction_limit"],
            "finance_export": tier["finance_export"],
            "finance_retailer_breakdown": tier["finance_retailer_breakdown"],
            "finance_forecasting": tier["finance_forecasting"],
            "status":                (sub or {}).get("status", "active"),
            "pending_tier":          (sub or {}).get("pending_tier", ""),
            "pending_payment_status": (sub or {}).get("pending_payment_status", ""),
            "expires_at":            str((sub or {}).get("expires_at", "")) or None,
            "started_at":            str((sub or {}).get("started_at", "")) or None,
        },
    }


async def _extend_existing_catalogue_items(vendor_id: str, visibility_days: int) -> int:
    """
    ⚠️ FIX: previously, upgrading or renewing only touched the
    vendor_subscriptions_collection record — every catalogue item already
    uploaded kept whatever expires_at it was stamped with at upload time,
    under whatever tier was active THEN. A vendor who paid to renew got
    nothing for their existing photos; only new uploads got the longer
    window. That defeats the entire point of paying to "keep my catalogue
    visible longer."

    Called from both /upgrade (on activation) and /renew — pushes every
    currently-active item's expires_at out to (now + visibility_days),
    same as if freshly uploaded under the new tier.
    """
    new_expiry = datetime.utcnow() + timedelta(days=visibility_days)
    result = await vendor_catalogue_collection.update_many(
        {"vendor_id": ObjectId(vendor_id), "active": True},
        {"$set": {"expires_at": new_expiry}}
    )
    return result.modified_count



async def _activate_paid_vendor_subscription(payment: dict, payment_id: str) -> int:
    """Activate exactly one verified/captured Razorpay vendor plan payment."""
    vendor_id = str(payment["vendor_id"])
    tier_key = payment["tier"]
    tier_cfg = TIER_CONFIG[tier_key]
    now = datetime.utcnow()
    expires_at = now + timedelta(days=30)

    await vendor_subscriptions_collection.update_one(
        {"vendor_id": payment["vendor_id"]},
        {
            "$set": {
                "vendor_id": payment["vendor_id"],
                "tier": tier_key,
                "status": "active",
                "price_inr": tier_cfg["price_inr"],
                "started_at": now,
                "expires_at": expires_at,
                "updated_at": now,
                "payment_provider": "razorpay",
                "payment_status": "paid",
                "last_payment_id": payment_id,
                "last_razorpay_order_id": payment["razorpay_order_id"],
            },
            "$unset": {
                "pending_tier": "",
                "pending_razorpay_order_id": "",
                "pending_payment_status": "",
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    return await _extend_existing_catalogue_items(vendor_id, tier_cfg["visibility_days"])


@router.post("/checkout")
async def create_subscription_checkout(payload: dict, authorization: str = Header(None)):
    """Create a Razorpay order for a paid vendor plan. Never activates access."""
    vendor_id = _decode_vendor(authorization)
    tier_key = str(payload.get("tier") or "").lower().strip()
    if tier_key not in TIER_CONFIG or tier_key == "free":
        raise HTTPException(status_code=400, detail="Choose a paid Standard or Premium plan for checkout.")

    key_id, key_secret = _razorpay_credentials()
    tier_cfg = TIER_CONFIG[tier_key]
    vendor_object_id = ObjectId(vendor_id)
    vendor = await vendors_collection.find_one({"_id": vendor_object_id}) or {}
    now = datetime.utcnow()
    receipt = f"rms-vsub-{vendor_id[-8:]}-{int(now.timestamp())}"
    order_payload = {
        "amount": int(tier_cfg["price_inr"] * 100),
        "currency": "INR",
        "receipt": receipt[:40],
        "notes": {
            "purpose": "vendor_subscription",
            "vendor_id": vendor_id,
            "tier": tier_key,
        },
    }
    razorpay_order = await asyncio.to_thread(_razorpay_create_order_sync, key_id, key_secret, order_payload)
    order_id = str(razorpay_order.get("id") or "")
    if not order_id:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Razorpay did not return an order ID.")

    payment = {
        "vendor_id": vendor_object_id,
        "tier": tier_key,
        "provider": "razorpay",
        "razorpay_order_id": order_id,
        "receipt": receipt[:40],
        "amount_paise": int(razorpay_order.get("amount") or order_payload["amount"]),
        "amount_inr": tier_cfg["price_inr"],
        "currency": "INR",
        "status": "created",
        "created_at": now,
        "updated_at": now,
    }
    try:
        await vendor_subscription_payments_collection.insert_one(payment)
    except Exception as exc:
        # The order ID is unique. Do not create a second local payment row on a retry.
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not record the Razorpay subscription order. Please try again.",
        ) from exc
    current_tier = await get_vendor_tier(vendor_id)
    existing_subscription = current_tier.get("subscription") or {}
    keep_current_access = current_tier["tier"] != "free" and existing_subscription.get("status") == "active"
    await vendor_subscriptions_collection.update_one(
        {"vendor_id": vendor_object_id},
        {
            "$set": {
                "vendor_id": vendor_object_id,
                "tier": current_tier["tier"],
                "status": "active" if keep_current_access else "pending_payment",
                "payment_status": existing_subscription.get("payment_status", "pending") if keep_current_access else "pending",
                "pending_tier": tier_key,
                "pending_razorpay_order_id": order_id,
                "pending_payment_status": "created",
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    return {
        "key_id": key_id,
        "order_id": order_id,
        "amount": payment["amount_paise"],
        "currency": "INR",
        "plan": {"tier": tier_key, "label": tier_cfg["label"], "price_inr": tier_cfg["price_inr"]},
        "prefill": {
            "name": vendor.get("name") or vendor.get("vendor_name") or "",
            "email": vendor.get("email") or "",
            "contact": vendor.get("phone") or vendor.get("phone_number") or "",
        },
    }


@router.post("/verify-payment")
async def verify_subscription_checkout(payload: dict, authorization: str = Header(None)):
    """Verify the Checkout signature; activation still waits for a signed webhook."""
    vendor_id = _decode_vendor(authorization)
    order_id = str(payload.get("razorpay_order_id") or "")
    payment_id = str(payload.get("razorpay_payment_id") or "")
    signature = str(payload.get("razorpay_signature") or "")
    if not order_id or not payment_id or not signature:
        raise HTTPException(status_code=400, detail="Razorpay payment verification details are incomplete.")

    key_id, key_secret = _razorpay_credentials()
    payment = await vendor_subscription_payments_collection.find_one({
        "razorpay_order_id": order_id,
        "vendor_id": ObjectId(vendor_id),
    })
    if not payment:
        raise HTTPException(status_code=404, detail="Subscription payment order was not found.")
    if not _checkout_signature_is_valid(order_id, payment_id, signature, key_secret):
        raise HTTPException(status_code=400, detail="Razorpay payment signature could not be verified.")

    gateway_payment = await asyncio.to_thread(_razorpay_fetch_payment_sync, key_id, key_secret, payment_id)
    if str(gateway_payment.get("order_id") or "") != order_id:
        raise HTTPException(status_code=400, detail="Razorpay payment does not belong to this subscription order.")
    if int(gateway_payment.get("amount") or 0) != int(payment.get("amount_paise") or 0):
        raise HTTPException(status_code=400, detail="Razorpay payment amount does not match this subscription order.")

    gateway_status = str(gateway_payment.get("status") or "")
    if gateway_status == "authorized":
        gateway_payment = await asyncio.to_thread(
            _razorpay_capture_payment_sync, key_id, key_secret, payment_id, int(payment.get("amount_paise") or 0)
        )
        gateway_status = str(gateway_payment.get("status") or "")
    if gateway_status == "captured":
        activated, extended_count = await _mark_payment_captured_and_activate(payment, payment_id)
        return {
            "message": "Payment captured and subscription activated.",
            "payment_status": "captured",
            "subscription_active": True,
            "catalogue_items_extended": extended_count,
            "already_processed": not activated,
        }

    await vendor_subscription_payments_collection.update_one(
        {"_id": payment["_id"]},
        {"$set": {
            "status": "checkout_verified",
            "razorpay_payment_id": payment_id,
            "checkout_verified_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }},
    )
    await vendor_subscriptions_collection.update_one(
        {"vendor_id": ObjectId(vendor_id), "pending_razorpay_order_id": order_id},
        {"$set": {"pending_payment_status": gateway_status or "checkout_verified", "updated_at": datetime.utcnow()}},
    )
    return {
        "message": "Payment verified. Your plan activates after Razorpay captures the payment.",
        "payment_status": gateway_status or "checkout_verified",
        "subscription_active": False,
    }

@razorpay_webhook_router.post("/webhook")
async def razorpay_webhook(request: Request):
    """Razorpay's server-to-server confirmation. This is the only activation path."""
    raw_body = await request.body()
    signature = request.headers.get("x-razorpay-signature", "")
    if not _webhook_signature_is_valid(raw_body, signature, _webhook_secret()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Razorpay webhook signature.")
    try:
        event = json.loads(raw_body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid Razorpay webhook payload.") from exc

    event_name = str(event.get("event") or "")
    event_id = request.headers.get("x-razorpay-event-id", "")
    payment_entity = ((event.get("payload") or {}).get("payment") or {}).get("entity") or {}
    order_id = str(payment_entity.get("order_id") or "")
    payment_id = str(payment_entity.get("id") or "")
    if not order_id:
        return {"status": "ignored"}

    payment = await vendor_subscription_payments_collection.find_one({"razorpay_order_id": order_id})
    if not payment:
        return {"status": "ignored"}

    if event_name == "payment.captured":
        activated, extended_count = await _mark_payment_captured_and_activate(payment, payment_id, event_id)
        if activated:
            return {"status": "activated", "catalogue_items_extended": extended_count}
        return {"status": "already_processed"}
    if event_name == "payment.failed":
        await vendor_subscription_payments_collection.update_one(
            {"_id": payment["_id"]},
            {"$set": {
                "status": "failed",
                "failure_reason": str(payment_entity.get("error_description") or "Payment failed"),
                "updated_at": datetime.utcnow(),
            }, "$addToSet": {"webhook_event_ids": event_id or f"{event_name}:{payment_id}"}},
        )
        await vendor_subscriptions_collection.update_one(
            {"vendor_id": payment["vendor_id"], "pending_razorpay_order_id": order_id},
            {"$set": {"pending_payment_status": "failed", "updated_at": datetime.utcnow()}},
        )
        return {"status": "payment_failed"}

    return {"status": "received", "event": event_name}

@router.post("/upgrade")
async def upgrade_subscription(payload: dict, authorization: str = Header(None)):
    """Switch to Free. Paid plan changes must use the Razorpay checkout route."""
    vendor_id = _decode_vendor(authorization)
    tier_key = (payload.get("tier") or "").lower().strip()
    if tier_key not in TIER_CONFIG:
        raise HTTPException(status_code=400, detail=f"Unknown tier '{tier_key}'. Valid: {list(TIER_CONFIG.keys())}")
    if tier_key != "free":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Paid subscriptions must be purchased through Razorpay checkout.",
        )

    now = datetime.utcnow()
    tier_cfg = TIER_CONFIG[tier_key]
    await vendor_subscriptions_collection.update_one(
        {"vendor_id": ObjectId(vendor_id)},
        {
            "$set": {
                "vendor_id": ObjectId(vendor_id),
                "tier": "free",
                "status": "active",
                "price_inr": tier_cfg["price_inr"],
                "started_at": now,
                "expires_at": None,
                "updated_at": now,
            },
            "$unset": {
                "pending_tier": "",
                "pending_razorpay_order_id": "",
                "pending_payment_status": "",
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    extended_count = await _extend_existing_catalogue_items(vendor_id, tier_cfg["visibility_days"])
    return {
        "status": "success",
        "message": "Switched to Free.",
        "tier": tier_key,
        "sub_status": "active",
        "catalogue_items_extended": extended_count,
    }


@router.post("/renew")
async def renew_subscription(authorization: str = Header(None)):
    """Renewal is a fresh Razorpay checkout, never a client-side activation."""
    vendor_id = _decode_vendor(authorization)
    sub = await vendor_subscriptions_collection.find_one({"vendor_id": ObjectId(vendor_id)})
    if not sub or sub.get("tier") == "free":
        raise HTTPException(status_code=400, detail="No paid subscription to renew.")
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Start a new Razorpay checkout for your current plan to renew it.",
    )