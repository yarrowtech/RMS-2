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

from fastapi import APIRouter, HTTPException, Header, Depends
from datetime import datetime, timedelta
from typing import Optional
from bson import ObjectId
import os

from ..db import vendor_subscriptions_collection, vendor_catalogue_collection, vendors_collection
from .vendor_routes import decode_token

router = APIRouter(prefix="/api/subscriptions", tags=["Vendor Subscriptions"])


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


@router.post("/upgrade")
async def upgrade_subscription(payload: dict, authorization: str = Header(None)):
    """
    ⚠️⚠️⚠️ PAYMENT STUB — NOT PRODUCTION SAFE ⚠️⚠️⚠️

    No real payment gateway is connected. This route exists so tier limits
    and upgrade flows are testable before Razorpay/Stripe/whatever is wired
    in. Real integration replaces the `simulate_payment` branch below with:
      1. Create an order/payment-intent with the gateway for the tier's
         price_inr, return the client-side payment token/URL to the
         frontend instead of activating anything here.
      2. The gateway calls YOUR webhook on successful payment — THAT
         webhook handler (not this route) is what should set
         status="active" and stamp started_at/expires_at.
      3. This route should then only ever create a status="pending_payment"
         record and hand back whatever the gateway needs to collect money.

    Until that's built, DO NOT expose `simulate_payment` on any
    internet-facing deployment — anyone could upgrade to Premium for free.
    Gate it behind an environment flag at minimum.
    """
    vendor_id = _decode_vendor(authorization)
    tier_key  = (payload.get("tier") or "").lower()
    if tier_key not in TIER_CONFIG:
        raise HTTPException(status_code=400, detail=f"Unknown tier '{tier_key}'. Valid: {list(TIER_CONFIG.keys())}")

    simulate_payment = bool(payload.get("simulate_payment", False))
    dev_mode_allowed = os.environ.get("ALLOW_SIMULATED_PAYMENTS", "false").lower() == "true"

    if tier_key != "free" and simulate_payment and not dev_mode_allowed:
        raise HTTPException(
            status_code=403,
            detail="Simulated payments are disabled. Set ALLOW_SIMULATED_PAYMENTS=true in your dev environment, "
                   "or wire up a real payment gateway before calling this in production."
        )

    now = datetime.utcnow()
    tier_cfg = TIER_CONFIG[tier_key]

    if tier_key == "free":
        # Downgrading to Free is always free — no payment involved.
        status = "active"
    elif simulate_payment:
        status = "active"  # ⚠️ stub-only path, see warning above
    else:
        status = "pending_payment"  # real gateway integration would land here

    update = {
        "vendor_id":   ObjectId(vendor_id),
        "tier":        tier_key,
        "status":      status,
        "price_inr":   tier_cfg["price_inr"],
        "started_at":  now if status == "active" else None,
        "expires_at":  (now + timedelta(days=30)) if status == "active" and tier_key != "free" else None,
        "updated_at":  now,
    }

    await vendor_subscriptions_collection.update_one(
        {"vendor_id": ObjectId(vendor_id)},
        {"$set": update, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )

    extended_count = 0
    if status == "active":
        # Whether newly upgrading or switching tiers, an active paid
        # subscription should keep existing catalogue items visible under
        # the new tier's window — see _extend_existing_catalogue_items.
        extended_count = await _extend_existing_catalogue_items(vendor_id, tier_cfg["visibility_days"])

    return {
        "status":  "success",
        "message": (
            f"Subscribed to {tier_cfg['label']}." if status == "active"
            else f"Upgrade to {tier_cfg['label']} created — awaiting payment confirmation."
        ),
        "tier":    tier_key,
        "sub_status": status,
        "catalogue_items_extended": extended_count,
    }


@router.post("/renew")
async def renew_subscription(authorization: str = Header(None)):
    """
    Extends the current paid subscription by 30 days from today. Same stub
    caveat as /upgrade — in a real system this is triggered by the payment
    gateway's recurring-billing webhook, not called directly by the client.
    """
    vendor_id = _decode_vendor(authorization)
    sub = await vendor_subscriptions_collection.find_one({"vendor_id": ObjectId(vendor_id)})
    if not sub or sub.get("tier") == "free":
        raise HTTPException(status_code=400, detail="No paid subscription to renew.")

    new_expiry = datetime.utcnow() + timedelta(days=30)
    await vendor_subscriptions_collection.update_one(
        {"vendor_id": ObjectId(vendor_id)},
        {"$set": {"expires_at": new_expiry, "status": "active", "updated_at": datetime.utcnow()}}
    )
    tier_cfg = TIER_CONFIG.get(sub.get("tier"), TIER_CONFIG[DEFAULT_TIER])
    extended_count = await _extend_existing_catalogue_items(vendor_id, tier_cfg["visibility_days"])
    return {
        "status": "success", "message": "Subscription renewed.",
        "expires_at": str(new_expiry), "catalogue_items_extended": extended_count,
    }
