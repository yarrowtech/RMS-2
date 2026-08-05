"""Shared commercial-plan definitions for retailer tenants.

Department access remains controlled by each tenant's administrators and
permissions.  These limits are only for commercial capacity (stores and
administrator seats) and platform billing.
"""
from typing import Final

PLAN_ALIASES: Final[dict[str, str]] = {
    "starter": "basic",  # existing tenants created before the rename
    "free": "internal_free_enterprise",  # legacy internal/free tenants
}

PAID_RETAILER_PLANS: Final[dict[str, dict]] = {
    "basic": {
        "labetl": "Basic",
        "stores": 1,
        "admins": 3,
        "price_inr": 50000,
        "billing_period_days": 30,
    },
    "professional": {
        "label": "Professional",
        "stores": 5,
        "admins": 15,
        "price_inr": 90000,
        "billing_period_days": 30,
    },
    "enterprise": {
        "label": "Enterprise",
        "stores": None,
        "admins": None,
        "price_inr": 125000,
        "billing_period_days": 30,
    },
}

INTERNAL_FREE_PLAN: Final[str] = "internal_free_enterprise"

RETAILER_PLAN_LIMITS: Final[dict[str, dict]] = {
    **PAID_RETAILER_PLANS,
    INTERNAL_FREE_PLAN: {
        "label": "Internal Free Enterprise",
        "stores": None,
        "admins": None,
        "price_inr": 0,
        "billing_period_days": None,
    },
}


def normalize_retailer_plan(value: str | None) -> str:
    """Return the canonical plan key, retaining compatibility with old data."""
    key = str(value or "basic").strip().lower()
    return PLAN_ALIASES.get(key, key)


def retailer_plan_config(value: str | None) -> dict:
    key = normalize_retailer_plan(value)
    return RETAILER_PLAN_LIMITS.get(key, RETAILER_PLAN_LIMITS["basic"])


def is_paid_retailer_plan(value: str | None) -> bool:
    return normalize_retailer_plan(value) in PAID_RETAILER_PLANS
