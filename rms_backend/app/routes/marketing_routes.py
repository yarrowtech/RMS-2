from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from ..db import (
    marketing_campaigns_collection,
    marketing_offer_redemptions_collection,
    tenants_collection,
)
from .deps import get_tenant
from .auth_routes import get_current_superadmin

router = APIRouter(prefix="/api/marketing", tags=["Marketing"])
superadmin_router = APIRouter(prefix="/superadmin/marketing", tags=["Super Admin Marketing"])

CAMPAIGN_STATUSES = {"Draft", "Scheduled", "Active", "Paused", "Completed"}
CHANNELS = {"WhatsApp", "Email", "SMS", "In-store", "Social", "Marketplace"}


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


def clean_text(value: Any, default: str = "") -> str:
    return str(value or default).strip()


def money(value: Any) -> float:
    try:
        return max(0.0, float(value or 0))
    except Exception:
        return 0.0


def require_marketing_access(ctx: Dict[str, Any]) -> Dict[str, Any]:
    departments = set(ctx.get("_managed_departments") or [])
    permissions = set(ctx.get("_permissions") or [])
    department = ctx.get("department") or ""
    if "Marketing" in departments or department == "Marketing" or "marketing" in permissions:
        return ctx
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Marketing department access is required.",
    )


class CampaignPayload(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    channel: str = "WhatsApp"
    objective: str = ""
    status: str = "Draft"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    budget: float = 0
    target_audience: str = ""
    target_stores: List[str] = []
    offer_type: str = ""
    offer_value: float = 0
    notes: str = ""


class StatusPayload(BaseModel):
    status: str


class RedemptionPayload(BaseModel):
    campaign_id: Optional[str] = None
    store_name: str = ""
    bill_no: str = ""
    customer_ref: str = ""
    amount: float = 0
    note: str = ""


def campaign_payload_doc(payload: CampaignPayload) -> Dict[str, Any]:
    channel = payload.channel if payload.channel in CHANNELS else "WhatsApp"
    status_value = payload.status if payload.status in CAMPAIGN_STATUSES else "Draft"
    return {
        "name": clean_text(payload.name),
        "channel": channel,
        "objective": clean_text(payload.objective),
        "status": status_value,
        "start_date": clean_text(payload.start_date) or None,
        "end_date": clean_text(payload.end_date) or None,
        "budget": money(payload.budget),
        "target_audience": clean_text(payload.target_audience),
        "target_stores": [clean_text(x) for x in (payload.target_stores or []) if clean_text(x)],
        "offer_type": clean_text(payload.offer_type),
        "offer_value": money(payload.offer_value),
        "notes": clean_text(payload.notes),
    }


async def campaign_summary(tenant_id: str) -> Dict[str, Any]:
    campaigns = await marketing_campaigns_collection.find({"tenant_id": tenant_id}).to_list(500)
    redemptions = await marketing_offer_redemptions_collection.find({"tenant_id": tenant_id}).to_list(1000)
    active = [c for c in campaigns if c.get("status") == "Active"]
    scheduled = [c for c in campaigns if c.get("status") == "Scheduled"]
    draft = [c for c in campaigns if c.get("status") == "Draft"]
    total_budget = sum(money(c.get("budget")) for c in campaigns)
    redeemed_value = sum(money(r.get("amount")) for r in redemptions)
    upcoming = sorted(
        [serialize_doc(c) for c in campaigns if c.get("status") in {"Scheduled", "Active", "Draft"}],
        key=lambda c: c.get("start_date") or "9999-99-99",
    )[:6]
    return {
        "total_campaigns": len(campaigns),
        "active_campaigns": len(active),
        "scheduled_campaigns": len(scheduled),
        "draft_campaigns": len(draft),
        "total_budget": total_budget,
        "redeemed_value": redeemed_value,
        "roi_hint": round((redeemed_value / total_budget) * 100, 2) if total_budget else 0,
        "upcoming": upcoming,
    }


@router.get("/overview")
async def overview(ctx: Dict[str, Any] = Depends(get_tenant)):
    ctx = require_marketing_access(ctx)
    return {"data": await campaign_summary(ctx["tenant_id"])}


@router.get("/campaigns")
async def list_campaigns(
    status_filter: Optional[str] = Query(None, alias="status"),
    ctx: Dict[str, Any] = Depends(get_tenant),
):
    ctx = require_marketing_access(ctx)
    query: Dict[str, Any] = {"tenant_id": ctx["tenant_id"]}
    if status_filter and status_filter != "All":
        query["status"] = status_filter
    rows = await marketing_campaigns_collection.find(query).sort("created_at", -1).to_list(300)
    return {"data": [serialize_doc(row) for row in rows]}


@router.post("/campaigns", status_code=201)
async def create_campaign(payload: CampaignPayload, ctx: Dict[str, Any] = Depends(get_tenant)):
    ctx = require_marketing_access(ctx)
    doc = campaign_payload_doc(payload)
    if not doc["name"]:
        raise HTTPException(status_code=400, detail="Campaign name is required.")
    created = now_utc()
    doc.update({
        "tenant_id": ctx["tenant_id"],
        "campaign_code": f"MKT-{created.strftime('%Y%m%d')}-{uuid4().hex[:5].upper()}",
        "created_by": ctx.get("admin_id"),
        "created_by_name": ctx.get("admin_name") or ctx.get("admin_email") or "Marketing user",
        "created_at": created,
        "updated_at": created,
    })
    result = await marketing_campaigns_collection.insert_one(doc)
    saved = await marketing_campaigns_collection.find_one({"_id": result.inserted_id})
    return {"message": "Campaign saved.", "data": serialize_doc(saved)}


@router.patch("/campaigns/{campaign_id}")
async def update_campaign(campaign_id: str, payload: CampaignPayload, ctx: Dict[str, Any] = Depends(get_tenant)):
    ctx = require_marketing_access(ctx)
    try:
        oid = ObjectId(campaign_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid campaign id.")
    update = campaign_payload_doc(payload)
    update["updated_at"] = now_utc()
    result = await marketing_campaigns_collection.update_one({"_id": oid, "tenant_id": ctx["tenant_id"]}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    saved = await marketing_campaigns_collection.find_one({"_id": oid})
    return {"message": "Campaign updated.", "data": serialize_doc(saved)}


@router.post("/campaigns/{campaign_id}/status")
async def update_status(campaign_id: str, payload: StatusPayload, ctx: Dict[str, Any] = Depends(get_tenant)):
    ctx = require_marketing_access(ctx)
    if payload.status not in CAMPAIGN_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid campaign status.")
    try:
        oid = ObjectId(campaign_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid campaign id.")
    result = await marketing_campaigns_collection.update_one(
        {"_id": oid, "tenant_id": ctx["tenant_id"]},
        {"$set": {"status": payload.status, "updated_at": now_utc()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    saved = await marketing_campaigns_collection.find_one({"_id": oid})
    return {"message": "Status updated.", "data": serialize_doc(saved)}


@router.get("/calendar")
async def calendar(ctx: Dict[str, Any] = Depends(get_tenant)):
    ctx = require_marketing_access(ctx)
    rows = await marketing_campaigns_collection.find({"tenant_id": ctx["tenant_id"]}).sort("start_date", 1).to_list(300)
    return {"data": [serialize_doc(row) for row in rows]}


@router.post("/campaigns/{campaign_id}/redemptions", status_code=201)
async def record_redemption(campaign_id: str, payload: RedemptionPayload, ctx: Dict[str, Any] = Depends(get_tenant)):
    ctx = require_marketing_access(ctx)
    try:
        oid = ObjectId(campaign_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid campaign id.")
    campaign = await marketing_campaigns_collection.find_one({"_id": oid, "tenant_id": ctx["tenant_id"]})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    doc = {
        "tenant_id": ctx["tenant_id"],
        "campaign_id": campaign_id,
        "campaign_name": campaign.get("name"),
        "store_name": clean_text(payload.store_name),
        "bill_no": clean_text(payload.bill_no),
        "customer_ref": clean_text(payload.customer_ref),
        "amount": money(payload.amount),
        "note": clean_text(payload.note),
        "created_by": ctx.get("admin_id"),
        "created_at": now_utc(),
    }
    result = await marketing_offer_redemptions_collection.insert_one(doc)
    saved = await marketing_offer_redemptions_collection.find_one({"_id": result.inserted_id})
    return {"message": "Redemption recorded.", "data": serialize_doc(saved)}


@superadmin_router.get("/overview")
async def superadmin_marketing_overview(_admin: Dict[str, Any] = Depends(get_current_superadmin)):
    tenants = await tenants_collection.find({}, {"tenant_id": 1, "business_name": 1, "name": 1}).to_list(200)
    rows: List[Dict[str, Any]] = []
    for tenant in tenants:
        tenant_id = tenant.get("tenant_id")
        if not tenant_id:
            continue
        summary = await campaign_summary(tenant_id)
        rows.append({
            "tenant_id": tenant_id,
            "tenant_name": tenant.get("business_name") or tenant.get("name") or tenant_id,
            **summary,
        })
    totals = {
        "tenants": len(rows),
        "campaigns": sum(row["total_campaigns"] for row in rows),
        "active_campaigns": sum(row["active_campaigns"] for row in rows),
        "total_budget": sum(row["total_budget"] for row in rows),
        "redeemed_value": sum(row["redeemed_value"] for row in rows),
    }
    return {"summary": totals, "data": rows}
