from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr

from ..db import (
    customer_crm_feedback_collection,
    customer_crm_followups_collection,
    customer_crm_profiles_collection,
    sales_collection,
)
from .deps import get_tenant

router = APIRouter(prefix="/api/customer-crm", tags=["Customer CRM"])

CRM_DEPARTMENTS = {"HQ", "Marketing", "Cashier", "Store Owner", "Customer CRM"}
CRM_PERMISSIONS = {"crm", "customer_crm", "marketing", "cashier", "sales"}


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def serialize_doc(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not doc:
        return None
    out: Dict[str, Any] = {}
    for key, value in doc.items():
        if key == "_id":
            out["id"] = str(value)
        elif isinstance(value, ObjectId):
            out[key] = str(value)
        elif isinstance(value, datetime):
            out[key] = value.isoformat()
        else:
            out[key] = value
    return out


def clean(value: Any, default: str = "") -> str:
    return str(value or default).strip()


def money(value: Any) -> float:
    try:
        return round(float(value or 0), 2)
    except Exception:
        return 0.0


def require_crm_access(ctx: Dict[str, Any]) -> Dict[str, Any]:
    departments = set(ctx.get("_managed_departments") or [])
    permissions = set(ctx.get("_permissions") or [])
    department = ctx.get("department") or ""
    if department in CRM_DEPARTMENTS or departments.intersection(CRM_DEPARTMENTS) or permissions.intersection(CRM_PERMISSIONS):
        return ctx
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Customer CRM access is required.")


def scoped_query(ctx: Dict[str, Any]) -> Dict[str, Any]:
    query = {"tenant_id": ctx["tenant_id"]}
    if ctx.get("scope") in ("store", "branch") and ctx.get("store_id"):
        query["store_id"] = ctx["store_id"]
    return query


def sale_total(doc: Dict[str, Any]) -> float:
    summary = doc.get("summary") or {}
    return money(summary.get("net_payable") or summary.get("total_sale") or doc.get("net_payable") or doc.get("total") or 0)


class CustomerProfilePayload(BaseModel):
    name: str = ""
    mobile: str = ""
    email: Optional[EmailStr] = None
    city: str = ""
    birthday: str = ""
    anniversary: str = ""
    segment: str = "Regular"
    tags: List[str] = []
    preferred_channel: str = "WhatsApp"
    consent_whatsapp: bool = False
    consent_sms: bool = False
    consent_email: bool = False
    notes: str = ""


class FollowupPayload(BaseModel):
    customer_id: str = ""
    customer_name: str = ""
    mobile: str = ""
    title: str
    due_date: str = ""
    channel: str = "WhatsApp"
    purpose: str = "Follow-up"
    note: str = ""


class FollowupStatusPayload(BaseModel):
    status: str


class FeedbackPayload(BaseModel):
    customer_id: str = ""
    customer_name: str = ""
    mobile: str = ""
    source: str = "In-store"
    sentiment: str = "Neutral"
    note: str = ""


def profile_doc(payload: CustomerProfilePayload) -> Dict[str, Any]:
    return {
        "name": clean(payload.name),
        "mobile": clean(payload.mobile),
        "email": clean(payload.email),
        "city": clean(payload.city),
        "birthday": clean(payload.birthday),
        "anniversary": clean(payload.anniversary),
        "segment": clean(payload.segment, "Regular"),
        "tags": [clean(x) for x in payload.tags if clean(x)],
        "preferred_channel": clean(payload.preferred_channel, "WhatsApp"),
        "consent_whatsapp": bool(payload.consent_whatsapp),
        "consent_sms": bool(payload.consent_sms),
        "consent_email": bool(payload.consent_email),
        "notes": clean(payload.notes),
    }


def customer_key(name: str, mobile: str) -> str:
    mobile = clean(mobile)
    if mobile:
        return f"mobile:{mobile}"
    name = clean(name).lower()
    return f"name:{name}" if name else f"walkin:{uuid4().hex[:8]}"


async def build_customer_rows(ctx: Dict[str, Any]) -> List[Dict[str, Any]]:
    sales_query = scoped_query(ctx)
    sales_rows = await sales_collection.find(sales_query).sort("created_at", -1).to_list(2500)
    profile_query = scoped_query(ctx)
    profiles = await customer_crm_profiles_collection.find(profile_query).sort("updated_at", -1).to_list(1000)

    merged: Dict[str, Dict[str, Any]] = {}
    for sale in sales_rows:
        name = clean(sale.get("customer_name"), "Walk-in customer")
        mobile = clean(sale.get("mobile"))
        key = customer_key(name, mobile)
        row = merged.setdefault(key, {
            "id": key,
            "name": name,
            "mobile": mobile,
            "email": "",
            "segment": "Walk-in" if not mobile else "Regular",
            "tags": [],
            "preferred_channel": "WhatsApp",
            "consent_whatsapp": False,
            "consent_sms": False,
            "consent_email": False,
            "total_spend": 0.0,
            "bill_count": 0,
            "last_purchase": "",
            "source": "POS",
        })
        row["total_spend"] = round(row["total_spend"] + sale_total(sale), 2)
        row["bill_count"] += 1
        row["last_purchase"] = row["last_purchase"] or clean(sale.get("date"))

    for profile in profiles:
        key = customer_key(profile.get("name"), profile.get("mobile"))
        existing = merged.get(key, {})
        serialized = serialize_doc(profile) or {}
        merged[key] = {
            **existing,
            **serialized,
            "id": serialized.get("id") or existing.get("id") or key,
            "name": serialized.get("name") or existing.get("name") or "Customer",
            "mobile": serialized.get("mobile") or existing.get("mobile") or "",
            "email": serialized.get("email") or existing.get("email") or "",
            "segment": serialized.get("segment") or existing.get("segment") or "Regular",
            "tags": serialized.get("tags") or existing.get("tags") or [],
            "total_spend": money(existing.get("total_spend")),
            "bill_count": int(existing.get("bill_count") or 0),
            "last_purchase": existing.get("last_purchase", ""),
            "source": "CRM + POS" if existing else "CRM",
        }

    return sorted(merged.values(), key=lambda r: (money(r.get("total_spend")), int(r.get("bill_count") or 0)), reverse=True)


@router.get("/overview")
async def overview(ctx: Dict[str, Any] = Depends(get_tenant)):
    ctx = require_crm_access(ctx)
    customers = await build_customer_rows(ctx)
    followups = await customer_crm_followups_collection.find(scoped_query(ctx)).sort("due_date", 1).to_list(500)
    feedback = await customer_crm_feedback_collection.find(scoped_query(ctx)).sort("created_at", -1).to_list(300)
    total_customers = len([c for c in customers if c.get("mobile") or c.get("name") != "Walk-in customer"])
    repeat_customers = len([c for c in customers if int(c.get("bill_count") or 0) > 1])
    total_spend = round(sum(money(c.get("total_spend")) for c in customers), 2)
    pending_followups = len([f for f in followups if f.get("status", "Pending") == "Pending"])
    return {
        "stats": {
            "customers": total_customers,
            "repeat_customers": repeat_customers,
            "total_spend": total_spend,
            "pending_followups": pending_followups,
        },
        "customers": customers[:500],
        "followups": [serialize_doc(x) for x in followups],
        "feedback": [serialize_doc(x) for x in feedback],
        "scope": {"tenant_id": ctx["tenant_id"], "scope": ctx.get("scope"), "store_id": ctx.get("store_id"), "store_name": ctx.get("store_name")},
    }


@router.post("/customers")
async def create_customer(payload: CustomerProfilePayload, ctx: Dict[str, Any] = Depends(get_tenant)):
    ctx = require_crm_access(ctx)
    doc = profile_doc(payload)
    if not doc["name"] and not doc["mobile"]:
        raise HTTPException(status_code=400, detail="Customer name or mobile is required.")
    doc.update(scoped_query(ctx))
    doc["created_by"] = ctx.get("admin_id")
    doc["created_by_name"] = ctx.get("admin_name")
    doc["created_at"] = now_utc()
    doc["updated_at"] = now_utc()
    result = await customer_crm_profiles_collection.insert_one(doc)
    saved = await customer_crm_profiles_collection.find_one({"_id": result.inserted_id})
    return serialize_doc(saved)


@router.patch("/customers/{customer_id}")
async def update_customer(customer_id: str, payload: CustomerProfilePayload, ctx: Dict[str, Any] = Depends(get_tenant)):
    ctx = require_crm_access(ctx)
    try:
        oid = ObjectId(customer_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid customer id.")
    patch = profile_doc(payload)
    patch["updated_at"] = now_utc()
    result = await customer_crm_profiles_collection.update_one({"_id": oid, **scoped_query(ctx)}, {"$set": patch})
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Customer profile not found.")
    return serialize_doc(await customer_crm_profiles_collection.find_one({"_id": oid}))


@router.post("/followups")
async def create_followup(payload: FollowupPayload, ctx: Dict[str, Any] = Depends(get_tenant)):
    ctx = require_crm_access(ctx)
    if not clean(payload.title):
        raise HTTPException(status_code=400, detail="Follow-up title is required.")
    doc = {
        **scoped_query(ctx),
        "customer_id": clean(payload.customer_id),
        "customer_name": clean(payload.customer_name),
        "mobile": clean(payload.mobile),
        "title": clean(payload.title),
        "due_date": clean(payload.due_date),
        "channel": clean(payload.channel, "WhatsApp"),
        "purpose": clean(payload.purpose, "Follow-up"),
        "note": clean(payload.note),
        "status": "Pending",
        "created_by": ctx.get("admin_id"),
        "created_by_name": ctx.get("admin_name"),
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    result = await customer_crm_followups_collection.insert_one(doc)
    return serialize_doc(await customer_crm_followups_collection.find_one({"_id": result.inserted_id}))


@router.patch("/followups/{followup_id}/status")
async def update_followup_status(followup_id: str, payload: FollowupStatusPayload, ctx: Dict[str, Any] = Depends(get_tenant)):
    ctx = require_crm_access(ctx)
    status_value = clean(payload.status, "Pending")
    if status_value not in {"Pending", "Done", "Cancelled"}:
        raise HTTPException(status_code=400, detail="Invalid follow-up status.")
    try:
        oid = ObjectId(followup_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid follow-up id.")
    result = await customer_crm_followups_collection.update_one({"_id": oid, **scoped_query(ctx)}, {"$set": {"status": status_value, "updated_at": now_utc()}})
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Follow-up not found.")
    return serialize_doc(await customer_crm_followups_collection.find_one({"_id": oid}))


@router.post("/feedback")
async def create_feedback(payload: FeedbackPayload, ctx: Dict[str, Any] = Depends(get_tenant)):
    ctx = require_crm_access(ctx)
    if not clean(payload.note):
        raise HTTPException(status_code=400, detail="Feedback note is required.")
    doc = {
        **scoped_query(ctx),
        "customer_id": clean(payload.customer_id),
        "customer_name": clean(payload.customer_name),
        "mobile": clean(payload.mobile),
        "source": clean(payload.source, "In-store"),
        "sentiment": clean(payload.sentiment, "Neutral"),
        "note": clean(payload.note),
        "created_by": ctx.get("admin_id"),
        "created_by_name": ctx.get("admin_name"),
        "created_at": now_utc(),
    }
    result = await customer_crm_feedback_collection.insert_one(doc)
    return serialize_doc(await customer_crm_feedback_collection.find_one({"_id": result.inserted_id}))
