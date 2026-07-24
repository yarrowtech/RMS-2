"""Controlled Single Store -> multi-store retailer upgrade workflow.

The upgrade changes tenant access only. It intentionally does not move or
duplicate stock: the existing single-store location stays as the retailer's
first store and its stock remains at that location.
"""

import asyncio
import base64
import hashlib
import hmac
import json
from datetime import datetime
from typing import Any, Dict, Literal, Optional
from urllib import error as urlerror
from urllib import request as urlrequest

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from .deps import get_any_tenant
from .auth_routes import get_current_superadmin
from .hq_store_routes import HQ_DEPARTMENTS as HQ_ADMIN_DEPARTMENTS
from ..config import settings
from ..db import admins_collection, store_upgrade_payments_collection, store_upgrade_requests_collection, tenants_collection


router = APIRouter(prefix="/api/store-upgrades", tags=["Store Upgrade"])
TenantCtx = Dict[str, Any]

MULTI_STORE_PLANS = {"professional", "enterprise"}

# Deliberately a different, higher price band than vendor catalogue tiers
# (subscription_routes.py: Free/Standard/Premium top out at price_inr=1499).
# This upgrade restructures a tenant's whole account (HQ + multi-store), not
# a catalogue visibility tier, so it is priced and sold separately.
STORE_PLAN_CONFIG = {
    "professional": {"label": "Professional", "price_inr": 30000,  "max_stores": 5},
    "enterprise":   {"label": "Enterprise",   "price_inr": 125000, "max_stores": None},
}

RAZORPAY_ORDER_URL = "https://api.razorpay.com/v1/orders"


def _razorpay_credentials() -> tuple[str, str]:
    key_id = (settings.razorpay_key_id or "").strip()
    key_secret = (settings.razorpay_key_secret or "").strip()
    if not key_id or not key_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on the backend.",
        )
    return key_id, key_secret


def _razorpay_create_order_sync(key_id: str, key_secret: str, payload: dict) -> dict:
    credentials = base64.b64encode(f"{key_id}:{key_secret}".encode("utf-8")).decode("ascii")
    req = urlrequest.Request(
        RAZORPAY_ORDER_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Basic {credentials}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlrequest.urlopen(req, timeout=20) as response:
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


def _razorpay_fetch_payment_sync(key_id: str, key_secret: str, payment_id: str) -> dict:
    credentials = base64.b64encode(f"{key_id}:{key_secret}".encode("utf-8")).decode("ascii")
    req = urlrequest.Request(
        f"https://api.razorpay.com/v1/payments/{payment_id}",
        headers={"Authorization": f"Basic {credentials}"},
        method="GET",
    )
    try:
        with urlrequest.urlopen(req, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except (urlerror.HTTPError, OSError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not confirm the payment with Razorpay. Please wait a moment and refresh.",
        ) from exc


def _razorpay_capture_payment_sync(key_id: str, key_secret: str, payment_id: str, amount_paise: int) -> dict:
    credentials = base64.b64encode(f"{key_id}:{key_secret}".encode("utf-8")).decode("ascii")
    req = urlrequest.Request(
        f"https://api.razorpay.com/v1/payments/{payment_id}/capture",
        data=json.dumps({"amount": int(amount_paise), "currency": "INR"}).encode("utf-8"),
        headers={"Authorization": f"Basic {credentials}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlrequest.urlopen(req, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except (urlerror.HTTPError, OSError) as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Razorpay payment capture failed.") from exc


def _checkout_signature_is_valid(order_id: str, payment_id: str, signature: str, key_secret: str) -> bool:
    expected = hmac.new(key_secret.encode("utf-8"), f"{order_id}|{payment_id}".encode("utf-8"), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature or "")

# Selectable departments come from hq_store_routes.py's HQ_DEPARTMENTS —
# the same list the (post-upgrade) HQ Admin Management screen uses to add
# more admins later. Importing it instead of keeping a second copy here
# means the two pickers can never quietly drift apart. "HQ" itself is never
# in that list (it's the base scope, not a department) — it's always
# granted to the upgraded owner separately, never selectable.
SELECTABLE_DEPARTMENTS = list(HQ_ADMIN_DEPARTMENTS)

# Manufacturing/specialist departments are Enterprise-only; the rest are
# available on Professional. Keeps plan price tied to capability, not just
# store count. "IT" joins this group as a specialist/support function, same
# reasoning as HR/Job Work — not needed to run day-to-day retail ops.
ENTERPRISE_ONLY_DEPARTMENTS = {"Design & Pattern", "Third Party", "Production & Job Work", "HR", "IT"}

# Every HQ Admin gets these regardless of chosen departments.
BASE_HQ_PERMISSIONS = ["reports", "user_management"]

DEPARTMENT_PERMISSIONS = {
    "Inventory":                     ["inventory", "stock_allocation", "stock_transfer"],
    "Merchandiser Buyer":            ["mbuyer", "purchase_orders", "vendors", "grn", "grc"],
    "Finance":                       ["finance"],
    "Logistics":                     ["logistics"],
    "Design & Pattern":              [],
    "Stock Planning & Forecasting":  ["stock_allocation"],
    "Third Party":                   ["vendors"],
    "Production & Job Work":         ["job_work"],
    "HR":                            ["hr"],
    "IT":                            [],
}

# What a Single Store Owner already has (superadmin_tenant_routes.py:176-188)
# — used only to compute "what's NEW" messaging on the upgrade UI, not for
# access control. Store staff keep running the original store day-to-day
# regardless of what the upgraded HQ Admin's permissions end up being.
SINGLE_STORE_OWNER_PERMISSIONS = {
    "inventory", "vendors", "purchase_orders", "grn", "grc", "reports",
    "mbuyer", "stock_allocation", "cashier", "sales", "store_stock",
    "stock_ledger", "stock_adjustment",
}


def _department_plan_requirement(department: str) -> str:
    return "enterprise" if department in ENTERPRISE_ONLY_DEPARTMENTS else "professional"


def _departments_allowed_for_plan(plan: str) -> list[str]:
    if plan == "enterprise":
        return list(SELECTABLE_DEPARTMENTS)
    return [d for d in SELECTABLE_DEPARTMENTS if d not in ENTERPRISE_ONLY_DEPARTMENTS]


def _new_permissions_for(department: str) -> list[str]:
    return sorted(set(DEPARTMENT_PERMISSIONS.get(department, [])) - SINGLE_STORE_OWNER_PERMISSIONS)


class StoreUpgradeCreate(BaseModel):
    requested_plan: Literal["professional", "enterprise"] = "professional"
    requested_departments: list[str] = Field(default_factory=list)
    note: str = Field(default="", max_length=1000)


class StoreUpgradeReview(BaseModel):
    action: Literal["approve", "decline"]
    approved_plan: Optional[Literal["professional", "enterprise"]] = None
    approved_departments: Optional[list[str]] = None
    internal_note: str = Field(default="", max_length=1000)


def _serialize(document: dict) -> dict:
    return {
        "id": str(document["_id"]),
        "tenant_id": document.get("tenant_id", ""),
        "company_name": document.get("company_name", ""),
        "owner_name": document.get("owner_name", ""),
        "owner_email": document.get("owner_email", ""),
        "primary_store_id": document.get("primary_store_id", ""),
        "primary_store_name": document.get("primary_store_name", ""),
        "requested_plan": document.get("requested_plan", "professional"),
        "requested_departments": document.get("requested_departments", []),
        "note": document.get("note", ""),
        "status": document.get("status", "PENDING"),
        "approved_plan": document.get("approved_plan"),
        "approved_departments": document.get("approved_departments"),
        "payment_status": document.get("payment_status", "unpaid"),
        "internal_note": document.get("internal_note", ""),
        "created_at": document.get("created_at").isoformat() if isinstance(document.get("created_at"), datetime) else None,
        "reviewed_at": document.get("reviewed_at").isoformat() if isinstance(document.get("reviewed_at"), datetime) else None,
    }


async def _owner_and_single_store_tenant(ctx: TenantCtx) -> tuple[dict, dict]:
    tenant = await tenants_collection.find_one({"tenant_id": ctx["tenant_id"]})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found.")
    if tenant.get("account_type") != "single_store":
        raise HTTPException(status_code=409, detail="This business is already a retailer account.")
    try:
        owner = await admins_collection.find_one({"_id": ObjectId(ctx["admin_id"]), "tenant_id": ctx["tenant_id"]})
    except Exception:
        owner = None
    if not owner or owner.get("department") != "Store Owner":
        raise HTTPException(status_code=403, detail="Only the Single Store Owner can request a multi-store upgrade.")
    return tenant, owner


@router.get("/plans")
async def list_store_upgrade_plans():
    always_new = sorted(set(BASE_HQ_PERMISSIONS) - SINGLE_STORE_OWNER_PERMISSIONS)
    plans = {}
    for key, cfg in STORE_PLAN_CONFIG.items():
        depts = _departments_allowed_for_plan(key)
        new_permissions = sorted(set(always_new) | {p for d in depts for p in _new_permissions_for(d)})
        plans[key] = {**cfg, "always_included": always_new, "new_permissions": new_permissions}
    return {"plans": plans}


@router.get("/departments")
async def list_selectable_departments():
    return {
        "departments": [
            {
                "key": d,
                "requires_plan": _department_plan_requirement(d),
                "new_permissions": _new_permissions_for(d),
            }
            for d in SELECTABLE_DEPARTMENTS
        ]
    }


@router.get("/me")
async def get_my_upgrade_status(ctx: TenantCtx = Depends(get_any_tenant)):
    tenant = await tenants_collection.find_one({"tenant_id": ctx["tenant_id"]}, {"account_type": 1, "plan": 1})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found.")
    latest = await store_upgrade_requests_collection.find_one(
        {"tenant_id": ctx["tenant_id"]}, sort=[("created_at", -1)]
    )
    return {
        "eligible": tenant.get("account_type") == "single_store",
        "account_type": tenant.get("account_type", "department_retailer"),
        "current_plan": tenant.get("plan", "starter"),
        "request": _serialize(latest) if latest else None,
    }


@router.post("/requests", status_code=201)
async def request_store_upgrade(payload: StoreUpgradeCreate, ctx: TenantCtx = Depends(get_any_tenant)):
    tenant, owner = await _owner_and_single_store_tenant(ctx)
    existing = await store_upgrade_requests_collection.find_one({
        "tenant_id": ctx["tenant_id"], "status": "PENDING",
    })
    if existing:
        raise HTTPException(status_code=409, detail="A multi-store upgrade request is already awaiting review.")

    requested_departments = [d for d in payload.requested_departments if d in SELECTABLE_DEPARTMENTS]
    allowed = set(_departments_allowed_for_plan(payload.requested_plan))
    unsupported = [d for d in requested_departments if d not in allowed]
    if unsupported:
        raise HTTPException(
            status_code=400,
            detail=f"{', '.join(unsupported)} require{'s' if len(unsupported) == 1 else ''} the Enterprise plan.",
        )

    now = datetime.utcnow()
    document = {
        "tenant_id": ctx["tenant_id"],
        "company_name": tenant.get("company_name", ""),
        "owner_admin_id": str(owner["_id"]),
        "owner_name": owner.get("name", ""),
        "owner_email": owner.get("email", ""),
        "primary_store_id": owner.get("store_id", ""),
        "primary_store_name": owner.get("store_name", ""),
        "requested_plan": payload.requested_plan,
        "requested_departments": requested_departments,
        "note": payload.note.strip(),
        "status": "PENDING",
        "created_at": now,
        "updated_at": now,
    }
    result = await store_upgrade_requests_collection.insert_one(document)
    document["_id"] = result.inserted_id
    return {"message": "Your multi-store upgrade request was sent to RMS for review.", "request": _serialize(document)}


async def _owned_pending_request(request_id: str, ctx: TenantCtx) -> dict:
    try:
        request = await store_upgrade_requests_collection.find_one({"_id": ObjectId(request_id)})
    except Exception:
        request = None
    if not request or request.get("tenant_id") != ctx["tenant_id"]:
        raise HTTPException(status_code=404, detail="Upgrade request not found.")
    if request.get("status") not in ("PENDING", "PAID_PENDING_REVIEW"):
        raise HTTPException(status_code=409, detail="This upgrade request is no longer awaiting payment.")
    return request


@router.post("/{request_id}/checkout")
async def checkout_store_upgrade(request_id: str, ctx: TenantCtx = Depends(get_any_tenant)):
    """Create a Razorpay order for the requested plan. Never approves the upgrade by itself."""
    request = await _owned_pending_request(request_id, ctx)
    plan_key = request.get("requested_plan", "professional")
    plan_cfg = STORE_PLAN_CONFIG.get(plan_key)
    if not plan_cfg:
        raise HTTPException(status_code=400, detail="This request does not have a valid plan to pay for.")

    key_id, key_secret = _razorpay_credentials()
    now = datetime.utcnow()
    receipt = f"rms-supg-{request_id[-8:]}-{int(now.timestamp())}"
    order_payload = {
        "amount": int(plan_cfg["price_inr"] * 100),
        "currency": "INR",
        "receipt": receipt[:40],
        "notes": {"purpose": "store_upgrade", "request_id": request_id, "plan": plan_key},
    }
    razorpay_order = await asyncio.to_thread(_razorpay_create_order_sync, key_id, key_secret, order_payload)
    order_id = str(razorpay_order.get("id") or "")
    if not order_id:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Razorpay did not return an order ID.")

    payment = {
        "request_id": request_id,
        "tenant_id": ctx["tenant_id"],
        "plan": plan_key,
        "razorpay_order_id": order_id,
        "receipt": receipt[:40],
        "amount_paise": int(razorpay_order.get("amount") or order_payload["amount"]),
        "amount_inr": plan_cfg["price_inr"],
        "status": "created",
        "created_at": now,
        "updated_at": now,
    }
    await store_upgrade_payments_collection.insert_one(payment)
    await store_upgrade_requests_collection.update_one(
        {"_id": request["_id"]},
        {"$set": {"payment_status": "checkout_created", "razorpay_order_id": order_id, "updated_at": now}},
    )
    return {
        "key_id": key_id,
        "order_id": order_id,
        "amount": payment["amount_paise"],
        "currency": "INR",
        "plan": {"key": plan_key, "label": plan_cfg["label"], "price_inr": plan_cfg["price_inr"]},
    }


@router.post("/{request_id}/verify-payment")
async def verify_store_upgrade_payment(request_id: str, payload: dict, ctx: TenantCtx = Depends(get_any_tenant)):
    request = await _owned_pending_request(request_id, ctx)
    order_id = str(payload.get("razorpay_order_id") or "")
    payment_id = str(payload.get("razorpay_payment_id") or "")
    signature = str(payload.get("razorpay_signature") or "")
    if not order_id or not payment_id or not signature:
        raise HTTPException(status_code=400, detail="Razorpay payment verification details are incomplete.")

    key_id, key_secret = _razorpay_credentials()
    payment = await store_upgrade_payments_collection.find_one({"razorpay_order_id": order_id, "request_id": request_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Store upgrade payment order was not found.")
    if not _checkout_signature_is_valid(order_id, payment_id, signature, key_secret):
        raise HTTPException(status_code=400, detail="Razorpay payment signature could not be verified.")

    gateway_payment = await asyncio.to_thread(_razorpay_fetch_payment_sync, key_id, key_secret, payment_id)
    if str(gateway_payment.get("order_id") or "") != order_id:
        raise HTTPException(status_code=400, detail="Razorpay payment does not belong to this upgrade order.")
    if int(gateway_payment.get("amount") or 0) != int(payment.get("amount_paise") or 0):
        raise HTTPException(status_code=400, detail="Razorpay payment amount does not match this upgrade order.")

    gateway_status = str(gateway_payment.get("status") or "")
    if gateway_status == "authorized":
        gateway_payment = await asyncio.to_thread(
            _razorpay_capture_payment_sync, key_id, key_secret, payment_id, int(payment.get("amount_paise") or 0)
        )
        gateway_status = str(gateway_payment.get("status") or "")

    now = datetime.utcnow()
    if gateway_status == "captured":
        await store_upgrade_payments_collection.update_one(
            {"_id": payment["_id"]},
            {"$set": {"status": "captured", "razorpay_payment_id": payment_id, "captured_at": now, "updated_at": now}},
        )
        await store_upgrade_requests_collection.update_one(
            {"_id": request["_id"]},
            {"$set": {"status": "PAID_PENDING_REVIEW", "payment_status": "captured", "updated_at": now}},
        )
        return {"message": "Payment captured. RMS will now review your upgrade request.", "payment_status": "captured"}

    await store_upgrade_payments_collection.update_one(
        {"_id": payment["_id"]},
        {"$set": {"status": "checkout_verified", "razorpay_payment_id": payment_id, "updated_at": now}},
    )
    await store_upgrade_requests_collection.update_one(
        {"_id": request["_id"]},
        {"$set": {"payment_status": gateway_status or "checkout_verified", "updated_at": now}},
    )
    return {
        "message": "Payment verified. Your request moves to review once Razorpay captures the payment.",
        "payment_status": gateway_status or "checkout_verified",
    }


@router.get("/")
async def list_store_upgrade_requests(current_admin: Dict[str, Any] = Depends(get_current_superadmin)):
    requests = []
    async for document in store_upgrade_requests_collection.find({}).sort("created_at", -1):
        requests.append(_serialize(document))
    return {"requests": requests}


@router.patch("/{request_id}")
async def review_store_upgrade(
    request_id: str,
    payload: StoreUpgradeReview,
    current_admin: Dict[str, Any] = Depends(get_current_superadmin),
):
    try:
        request = await store_upgrade_requests_collection.find_one({"_id": ObjectId(request_id)})
    except Exception:
        request = None
    if not request:
        raise HTTPException(status_code=404, detail="Upgrade request not found.")
    if request.get("status") not in ("PENDING", "PAID_PENDING_REVIEW"):
        raise HTTPException(status_code=409, detail="This upgrade request has already been reviewed.")
    if payload.action == "approve" and request.get("status") != "PAID_PENDING_REVIEW":
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="This request cannot be approved until the retailer completes payment for the plan.",
        )

    now = datetime.utcnow()
    review_patch = {
        "status": "APPROVED" if payload.action == "approve" else "DECLINED",
        "internal_note": payload.internal_note.strip(),
        "reviewed_at": now,
        "reviewed_by": str(current_admin["_id"]),
        "updated_at": now,
    }

    if payload.action == "decline":
        await store_upgrade_requests_collection.update_one({"_id": request["_id"]}, {"$set": review_patch})
        return {"message": "Multi-store upgrade request declined."}

    tenant = await tenants_collection.find_one({"tenant_id": request["tenant_id"]})
    if not tenant:
        raise HTTPException(status_code=404, detail="Retailer tenant no longer exists.")
    if tenant.get("account_type") != "single_store":
        raise HTTPException(status_code=409, detail="This tenant has already been upgraded.")

    try:
        owner_id = ObjectId(request["owner_admin_id"])
    except Exception:
        raise HTTPException(status_code=409, detail="The requesting Store Owner record is invalid.")
    owner = await admins_collection.find_one({"_id": owner_id, "tenant_id": request["tenant_id"]})
    if not owner:
        raise HTTPException(status_code=409, detail="The requesting Store Owner no longer exists. No upgrade was completed.")

    plan = payload.approved_plan or request.get("requested_plan", "professional")
    if plan not in MULTI_STORE_PLANS:
        raise HTTPException(status_code=400, detail="A Professional or Enterprise plan is required for a multi-store upgrade.")
    if plan != request.get("requested_plan"):
        raise HTTPException(
            status_code=409,
            detail="The approved plan must match the plan the retailer paid for. Decline and ask them to check out again for a different plan.",
        )

    chosen_departments = (
        payload.approved_departments
        if payload.approved_departments is not None
        else request.get("requested_departments", [])
    )
    allowed = set(_departments_allowed_for_plan(plan))
    approved_departments = [d for d in chosen_departments if d in allowed]
    final_departments = ["HQ"] + approved_departments
    final_permissions = sorted(set(BASE_HQ_PERMISSIONS) | {
        p for d in approved_departments for p in DEPARTMENT_PERMISSIONS.get(d, [])
    })

    # Preserve the existing store and its store_stock as the first retailer
    # location. We do not create central quantity from it: doing so would
    # duplicate physical stock. Future HQ receiving goes to central stock.
    await tenants_collection.update_one(
        {"_id": tenant["_id"]},
        {"$set": {
            "account_type": "department_retailer",
            "plan": plan,
            "upgraded_from": "single_store",
            "upgraded_at": now,
            "upgraded_by": str(current_admin["_id"]),
            "updated_at": now,
        }},
    )

    # All existing tenant users must receive the new account type on their
    # next login. The owner becomes the initial HQ administrator; their
    # old store context is removed so HQ screens are not rendered as a store.
    await admins_collection.update_many(
        {"tenant_id": request["tenant_id"]},
        {"$set": {"account_type": "department_retailer", "updated_at": now}},
    )
    owner_result = await admins_collection.update_one(
        {"_id": owner_id, "tenant_id": request["tenant_id"]},
        {"$set": {
            "department": "HQ",
            "managedDepartments": final_departments,
            "permissions": final_permissions,
            "scope": "hq",
            "store_id": None,
            "store_name": None,
            "store_type": None,
            "account_type": "department_retailer",
            "upgraded_from_store_owner": True,
            "updated_at": now,
        }},
    )
    if not owner_result.matched_count:
        raise HTTPException(status_code=409, detail="The requesting Store Owner no longer exists. No upgrade was completed.")

    review_patch.update({
        "approved_plan": plan,
        "approved_departments": approved_departments,
        "migration": "store_preserved_no_stock_duplication",
    })
    await store_upgrade_requests_collection.update_one({"_id": request["_id"]}, {"$set": review_patch})
    return {
        "message": "Tenant upgraded to a multi-store retailer. The original store and its stock were preserved. The owner must sign in again as HQ Admin.",
        "plan": plan,
    }
