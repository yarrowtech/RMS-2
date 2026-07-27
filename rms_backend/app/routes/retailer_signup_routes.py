"""Payment-gated retailer signup.

Separate from superadmin_tenant_routes.py's Department Retailer creation
flow (which stays exactly as it was — untouched, no payment gate). This
router is only for the Basic/Professional/Enterprise Single Store plan
ladder: superadmin stages the signup, Razorpay payment is captured, and
only then are the tenant + its first admin actually created. No tenant
exists until payment clears.
"""
import asyncio
import secrets
from datetime import datetime, timedelta
from typing import Any, Dict, Literal, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError
from pydantic import BaseModel, EmailStr

from .auth_routes import get_current_superadmin
from .store_upgrade_routes import (
    _checkout_signature_is_valid,
    _razorpay_capture_payment_sync,
    _razorpay_create_order_sync,
    _razorpay_create_payment_link_sync,
    _razorpay_credentials,
    _razorpay_fetch_payment_sync,
)
from ..auth import create_password_setup_token, create_token, decode_token
from ..config import settings
from ..db import (
    admins_collection, onboarding_requests_collection, retailer_signups_collection,
    retailer_subscription_payments_collection, stores_collection, tenants_collection,
)
from ..retailer_plans import PAID_RETAILER_PLANS
from ..email_utils import send_password_setup_email, send_retailer_payment_email

router = APIRouter(prefix="/api/retailer-signups", tags=["Retailer Signups"])
CurrentAdmin = Dict[str, Any]


class RetailerSignupCreate(BaseModel):
    company_name:   str
    tenant_id:      str
    gstin:          Optional[str] = ""
    plan:           Literal["basic", "professional", "enterprise"] = "basic"
    phone:          Optional[str] = ""
    address:        Optional[str] = ""
    city:           Optional[str] = ""
    state:          Optional[str] = ""
    hq_admin_name:  str
    hq_admin_email: EmailStr
    hq_admin_phone: Optional[str] = ""
    onboarding_request_id: Optional[str] = None


def _str(v): return str(v) if v else ""


def _serialize(doc: dict) -> dict:
    return {
        "id":           str(doc["_id"]),
        "company_name": doc.get("company_name", ""),
        "tenant_id":    doc.get("tenant_id", ""),
        "plan":         doc.get("plan", "basic"),
        "status":       doc.get("status", "PENDING_PAYMENT"),
        "amount_inr":   doc.get("amount_inr", 0),
        "created_at":   doc.get("created_at").isoformat() if isinstance(doc.get("created_at"), datetime) else None,
    }


@router.post("/", status_code=201)
async def create_retailer_signup(
    payload: RetailerSignupCreate,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    """Stage a new Basic/Professional/Enterprise retailer. No tenant is created
    yet — call /checkout then /verify-payment to actually provision it."""
    tenant_id = payload.tenant_id.strip().lower().replace(" ", "_")
    if await tenants_collection.find_one({"tenant_id": tenant_id}):
        raise HTTPException(status_code=400, detail=f"Tenant ID '{tenant_id}' already exists. Choose a different one.")
    existing_signup = await retailer_signups_collection.find_one({"tenant_id": tenant_id, "status": "PENDING_PAYMENT"})
    if existing_signup:
        # A Super Admin can safely resend the link from the same staged signup
        # instead of creating a second order or duplicate tenant request.
        return {"message": "A payment link can be resent for this staged retailer.", "signup": _serialize(existing_signup)}
    if await admins_collection.find_one({"email": payload.hq_admin_email}):
        raise HTTPException(status_code=400, detail=f"An admin with email '{payload.hq_admin_email}' already exists.")

    onboarding_request = None
    if payload.onboarding_request_id:
        if not ObjectId.is_valid(payload.onboarding_request_id):
            raise HTTPException(status_code=400, detail="Invalid onboarding request ID.")
        onboarding_request = await onboarding_requests_collection.find_one({"_id": ObjectId(payload.onboarding_request_id)})
        if not onboarding_request:
            raise HTTPException(status_code=404, detail="Onboarding request not found.")
        if onboarding_request.get("status") != "APPROVED":
            raise HTTPException(status_code=409, detail="Only approved onboarding requests can start payment.")
        if str(onboarding_request.get("email") or "").lower() != str(payload.hq_admin_email).lower():
            raise HTTPException(status_code=400, detail="The retailer administrator email must match the approved onboarding request.")

    now = datetime.utcnow()
    document = {
        "company_name":   payload.company_name.strip(),
        "tenant_id":      tenant_id,
        "gstin":          (payload.gstin or "").strip().upper(),
        "plan":           payload.plan,
        "phone":          (payload.phone or "").strip(),
        "address":        (payload.address or "").strip(),
        "city":           (payload.city or "").strip(),
        "state":          (payload.state or "").strip(),
        "hq_admin_name":  payload.hq_admin_name.strip(),
        "hq_admin_email": payload.hq_admin_email,
        "hq_admin_phone": (payload.hq_admin_phone or "").strip(),
        "status":         "PENDING_PAYMENT",
        "onboarding_request_id": str(onboarding_request["_id"]) if onboarding_request else None,
        "created_at":     now,
        "created_by":     _str(current_admin["_id"]),
    }
    result = await retailer_signups_collection.insert_one(document)
    document["_id"] = result.inserted_id
    if onboarding_request:
        await onboarding_requests_collection.update_one(
            {"_id": onboarding_request["_id"]},
            {"$set": {"status": "APPROVED_PAYMENT_PENDING", "signup_id": str(result.inserted_id), "updated_at": now}},
        )
    return {"message": "Signup staged. Complete payment to activate the tenant.", "signup": _serialize(document)}


PAYMENT_LINK_VALIDITY_DAYS = 7


def _create_retailer_payment_token(signup: dict, nonce: str) -> str:
    return create_token(
        {
            "type": "retailer_payment",
            "signup_id": str(signup["_id"]),
            "email": str(signup.get("hq_admin_email") or "").lower(),
            "nonce": nonce,
        },
        expires_delta=timedelta(days=PAYMENT_LINK_VALIDITY_DAYS),
    )


async def _payment_link_signup(token: str) -> dict:
    """Resolve a short-lived retailer payment token without exposing signup data."""
    try:
        claims = decode_token(token)
    except JWTError:
        raise HTTPException(status_code=401, detail="This payment link is invalid or has expired.")
    if claims.get("type") != "retailer_payment" or not ObjectId.is_valid(str(claims.get("signup_id") or "")):
        raise HTTPException(status_code=401, detail="This payment link is invalid or has expired.")

    signup = await retailer_signups_collection.find_one({"_id": ObjectId(claims["signup_id"])})
    if not signup:
        raise HTTPException(status_code=404, detail="Retailer signup not found.")
    if signup.get("status") != "PENDING_PAYMENT":
        raise HTTPException(status_code=409, detail="This retailer activation is no longer awaiting payment.")
    if not secrets.compare_digest(str(signup.get("payment_link_nonce") or ""), str(claims.get("nonce") or "")):
        raise HTTPException(status_code=401, detail="This payment link has been replaced. Please use the newest email.")
    if str(signup.get("hq_admin_email") or "").lower() != str(claims.get("email") or "").lower():
        raise HTTPException(status_code=401, detail="This payment link is invalid.")
    return signup

async def _pending_signup(signup_id: str) -> dict:
    try:
        signup = await retailer_signups_collection.find_one({"_id": ObjectId(signup_id)})
    except Exception:
        signup = None
    if not signup:
        raise HTTPException(status_code=404, detail="Retailer signup not found.")
    if signup.get("status") != "PENDING_PAYMENT":
        raise HTTPException(status_code=409, detail="This signup is no longer awaiting payment.")
    return signup


@router.post("/{signup_id}/send-payment-link")
async def send_retailer_payment_link(signup_id: str, current_admin: CurrentAdmin = Depends(get_current_superadmin)):
    """Create a Razorpay-hosted Payment Link and send it to the approved retailer."""
    signup = await _pending_signup(signup_id)
    plan_cfg = PAID_RETAILER_PLANS[signup["plan"]]
    key_id, key_secret = _razorpay_credentials()
    now = datetime.utcnow()
    expires_at = now + timedelta(days=PAYMENT_LINK_VALIDITY_DAYS)
    amount_paise = int(plan_cfg["price_inr"] * 100)
    reference_id = f"RMS-{str(signup['_id'])[-10:]}-{int(now.timestamp())}"[:40]
    callback_url = f"{settings.frontend_base_url.rstrip('/')}/retailer/complete-payment?status=processing"
    customer = {"name": signup["hq_admin_name"], "email": str(signup["hq_admin_email"])}
    contact = "".join(char for char in str(signup.get("hq_admin_phone") or signup.get("phone") or "") if char.isdigit())
    if len(contact) >= 10:
        customer["contact"] = contact[-10:]

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
            "description": f"RMS {plan_cfg['label']} plan - {signup['company_name']}",
            "customer": customer,
            "notify": {"email": True, "sms": bool(customer.get("contact"))},
            "reminder_enable": True,
            "callback_url": callback_url,
            "callback_method": "get",
            "notes": {
                "purpose": "retailer_signup",
                "signup_id": str(signup["_id"]),
                "tenant_id": signup["tenant_id"],
                "plan": signup["plan"],
            },
        },
    )
    payment_link_id = str(razorpay_link.get("id") or "")
    payment_link_url = str(razorpay_link.get("short_url") or "")
    if not payment_link_id or not payment_link_url:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Razorpay did not return a hosted payment link.")

    await retailer_signups_collection.update_one(
        {"_id": signup["_id"]},
        {"$set": {
            "razorpay_payment_link_id": payment_link_id,
            "razorpay_payment_link_url": payment_link_url,
            "razorpay_payment_link_reference": reference_id,
            "payment_link_sent_at": now,
            "payment_link_expires_at": expires_at,
            "payment_link_sent_by": _str(current_admin.get("_id")),
            "amount_paise": amount_paise,
            "amount_inr": plan_cfg["price_inr"],
            "payment_status": "payment_link_created",
            "updated_at": now,
        }},
    )
    await retailer_subscription_payments_collection.insert_one({
        "signup_id": str(signup["_id"]), "tenant_id": signup["tenant_id"],
        "company_name": signup["company_name"], "plan": signup["plan"],
        "amount_paise": amount_paise, "amount_inr": plan_cfg["price_inr"],
        "currency": "INR", "status": "payment_link_created",
        "razorpay_payment_link_id": payment_link_id,
        "razorpay_payment_link_url": payment_link_url,
        "razorpay_payment_link_reference": reference_id,
        "created_at": now, "updated_at": now,
    })
    try:
        delivered = await send_retailer_payment_email(
            signup["hq_admin_email"], signup["hq_admin_name"], signup["company_name"],
            plan_cfg["label"], plan_cfg["price_inr"], payment_link_url, PAYMENT_LINK_VALIDITY_DAYS,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Razorpay link was created but RMS email delivery failed: {exc}")

    return {
        "message": "Razorpay-hosted payment link created and sent to the retailer.",
        "email": signup["hq_admin_email"],
        "expires_at": expires_at.isoformat(),
        "email_sent": bool(delivered),
        "payment_link": payment_link_url,
    }
async def _activate_captured_retailer(signup: dict, payment_id: str, created_by: str = "razorpay_webhook") -> dict:
    """Create the RMS tenant only after a confirmed Razorpay payment.

    Razorpay can retry webhooks. Once completed, the existing tenant is returned
    instead of creating a duplicate tenant or administrator.
    """
    now = datetime.utcnow()
    current = await retailer_signups_collection.find_one({"_id": signup["_id"]})
    if current and current.get("status") == "COMPLETED":
        return {
            "message": f"'{current['company_name']}' is already active on RMS.",
            "already_processed": True,
            "tenant_id": current.get("tenant_id"),
            "tenant_doc_id": current.get("tenant_doc_id", ""),
            "hq_admin_id": current.get("hq_admin_id", ""),
        }

    claim = await retailer_signups_collection.update_one(
        {"_id": signup["_id"], "status": {"$in": ["PAID", "PENDING_PAYMENT"]}},
        {"$set": {"status": "PROVISIONING", "updated_at": now}},
    )
    if not claim.modified_count:
        # Another verified webhook is provisioning this retailer. Do not create
        # a second tenant while Razorpay retries the same event.
        return {"message": "Retailer activation is already being processed.", "already_processed": True, "tenant_id": signup["tenant_id"]}
    existing_tenant = await tenants_collection.find_one({"tenant_id": signup["tenant_id"]})
    if existing_tenant:
        await retailer_signups_collection.update_one(
            {"_id": signup["_id"]},
            {"$set": {"status": "COMPLETED", "tenant_doc_id": _str(existing_tenant["_id"]), "updated_at": now}},
        )
        return {"message": f"'{signup['company_name']}' is already active on RMS.", "already_processed": True, "tenant_id": signup["tenant_id"]}

    account_type = "single_store" if signup["plan"] == "basic" else "department_retailer"
    tenant_doc = {
        "tenant_id": signup["tenant_id"], "company_name": signup["company_name"],
        "gstin": signup.get("gstin", ""), "plan": signup["plan"],
        "price_inr": signup.get("amount_inr", 0), "billing_mode": "paid",
        "subscription_status": "active", "subscription_started_at": now,
        "subscription_expires_at": now + timedelta(days=int(PAID_RETAILER_PLANS[signup["plan"]]["billing_period_days"])),
        "subscription_payment_id": payment_id, "account_type": account_type,
        "status": "active", "phone": signup.get("phone", ""),
        "address": signup.get("address", ""), "city": signup.get("city", ""), "state": signup.get("state", ""),
        "hq_admin_name": signup["hq_admin_name"], "hq_admin_email": signup["hq_admin_email"],
        "created_at": now, "created_by": created_by, "signup_id": str(signup["_id"]),
    }
    tenant_res = await tenants_collection.insert_one(tenant_doc)

    is_single_store = account_type == "single_store"
    primary_store = None
    if is_single_store:
        store_doc = {
            "name": signup["company_name"], "code": "MAIN", "type": "store", "tenant_id": signup["tenant_id"],
            "parent_id": None, "city": signup.get("city", ""), "address": signup.get("address", ""),
            "phone": signup.get("phone", ""), "active": True, "created_at": now, "created_by": created_by,
        }
        store_res = await stores_collection.insert_one(store_doc)
        primary_store = {"id": str(store_res.inserted_id), "name": store_doc["name"], "type": store_doc["type"]}

    owner_permissions = ["cashier", "sales", "store_stock", "stock_ledger", "stock_adjustment"] if is_single_store else []
    admin_doc = {
        "name": signup["hq_admin_name"], "email": signup["hq_admin_email"], "phone": signup.get("hq_admin_phone", ""),
        "department": "Store Owner" if is_single_store else "HQ",
        "managedDepartments": ["Store Owner"] if is_single_store else ["HQ"],
        "permissions": ["inventory", "vendors", "purchase_orders", "grn", "grc", "reports", "mbuyer", "stock_allocation"] + owner_permissions,
        "account_type": account_type, "tenant_id": signup["tenant_id"], "scope": "hq",
        "store_id": primary_store["id"] if primary_store else None,
        "store_name": primary_store["name"] if primary_store else None,
        "store_type": primary_store["type"] if primary_store else None,
        "hashed_password": None, "status": "PENDING", "password_set": False,
        "created_at": now, "created_by": created_by,
    }
    admin_res = await admins_collection.insert_one(admin_doc)
    admin_department = "Store Owner" if is_single_store else "HQ"
    setup_token = create_password_setup_token(signup["hq_admin_email"], admin_department)
    setup_link = f"{settings.frontend_base_url}/admin/setup-password?token={setup_token}"
    try:
        await send_password_setup_email(signup["hq_admin_email"], signup["hq_admin_name"], admin_department, setup_link)
    except Exception:
        pass

    await retailer_signups_collection.update_one(
        {"_id": signup["_id"]},
        {"$set": {"status": "COMPLETED", "tenant_doc_id": _str(tenant_res.inserted_id), "hq_admin_id": _str(admin_res.inserted_id), "updated_at": now}},
    )
    if signup.get("onboarding_request_id") and ObjectId.is_valid(signup["onboarding_request_id"]):
        await onboarding_requests_collection.update_one(
            {"_id": ObjectId(signup["onboarding_request_id"])},
            {"$set": {"status": "ACTIVE", "tenant_id": signup["tenant_id"], "updated_at": now}},
        )
    return {
        "message": f"Payment captured. '{signup['company_name']}' is now live on RMS.",
        "account_type": account_type, "tenant_id": signup["tenant_id"],
        "tenant_doc_id": _str(tenant_res.inserted_id), "hq_admin_id": _str(admin_res.inserted_id), "setup_link": setup_link,
    }


async def process_retailer_payment_link_webhook(event: dict, event_id: str = "") -> dict | None:
    """Process signed Razorpay Payment Link callbacks for retailer onboarding."""
    if str(event.get("event") or "") != "payment_link.paid":
        return None
    payload = event.get("payload") or {}
    link = (payload.get("payment_link") or {}).get("entity") or {}
    notes = link.get("notes") or {}
    if str(notes.get("purpose") or "") != "retailer_signup":
        return None

    payment_link_id = str(link.get("id") or "")
    signup_id = str(notes.get("signup_id") or "")
    if not payment_link_id or not ObjectId.is_valid(signup_id):
        return {"status": "ignored", "reason": "invalid_retailer_link"}
    signup = await retailer_signups_collection.find_one({"_id": ObjectId(signup_id), "razorpay_payment_link_id": payment_link_id})
    if not signup:
        return {"status": "ignored", "reason": "unknown_retailer_link"}
    if signup.get("status") == "COMPLETED":
        return {"status": "already_processed"}

    expected_amount = int(signup.get("amount_paise") or 0)
    if not expected_amount or int(link.get("amount_paid") or 0) != expected_amount:
        return {"status": "ignored", "reason": "amount_mismatch"}

    payment_entity = (payload.get("payment") or {}).get("entity") or {}
    payment_id = str(payment_entity.get("id") or "")
    now = datetime.utcnow()
    await retailer_signups_collection.update_one(
        {"_id": signup["_id"]},
        {"$set": {"status": "PAID", "payment_status": "captured", "razorpay_payment_id": payment_id, "captured_at": now, "webhook_event_id": event_id, "updated_at": now}},
    )
    await retailer_subscription_payments_collection.update_one(
        {"razorpay_payment_link_id": payment_link_id},
        {"$set": {"status": "captured", "razorpay_payment_id": payment_id, "captured_at": now, "updated_at": now}, "$addToSet": {"webhook_event_ids": event_id or f"payment_link.paid:{payment_id}"}},
    )
    result = await _activate_captured_retailer(signup, payment_id, "razorpay_webhook")
    return {"status": "activated", "tenant_id": result.get("tenant_id"), "already_processed": result.get("already_processed", False)}