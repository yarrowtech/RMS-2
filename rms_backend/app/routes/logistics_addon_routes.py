"""Logistics add-on activation requests.

The add-on itself (`logistics_enabled` on the tenant document — see
logistics_routes.py's _ensure_logistics_addon_enabled) is Super-Admin
toggled only today; there is no self-serve checkout yet. Unlike
Production & Job Work, Logistics has no plan-tier grandfather clause —
it's a pure opt-in, since whether a retailer needs shipment/transfer
tracking depends on how they operate, not their plan. This module gives
an existing HQ retailer an in-app way to ask for it, and gives Super
Admin a review queue instead of a purely manual process.
"""
from datetime import datetime
from typing import Any, Dict, Literal

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .deps import get_hq_tenant
from .auth_routes import get_current_superadmin
from ..db import logistics_addon_requests_collection, tenants_collection

router = APIRouter(prefix="/api/logistics-addon", tags=["Logistics Add-on Requests"])
TenantCtx = Dict[str, Any]


class LogisticsAddonRequestCreate(BaseModel):
    note: str = Field(default="", max_length=1000)


class LogisticsAddonReview(BaseModel):
    action: Literal["approve", "decline"]
    internal_note: str = Field(default="", max_length=1000)


def _serialize(document: dict) -> dict:
    return {
        "id": str(document["_id"]),
        "tenant_id": document.get("tenant_id", ""),
        "company_name": document.get("company_name", ""),
        "requested_by_name": document.get("requested_by_name", ""),
        "requested_by_email": document.get("requested_by_email", ""),
        "note": document.get("note", ""),
        "status": document.get("status", "PENDING"),
        "internal_note": document.get("internal_note", ""),
        "created_at": document.get("created_at").isoformat() if isinstance(document.get("created_at"), datetime) else None,
        "reviewed_at": document.get("reviewed_at").isoformat() if isinstance(document.get("reviewed_at"), datetime) else None,
    }


def _is_addon_enabled(tenant: dict) -> bool:
    return bool((tenant or {}).get("logistics_enabled"))


@router.get("/me")
async def get_my_addon_status(ctx: TenantCtx = Depends(get_hq_tenant)):
    tenant = await tenants_collection.find_one(
        {"tenant_id": ctx["tenant_id"]}, {"logistics_enabled": 1}
    )
    latest = await logistics_addon_requests_collection.find_one(
        {"tenant_id": ctx["tenant_id"]}, sort=[("created_at", -1)]
    )
    return {
        "enabled": _is_addon_enabled(tenant or {}),
        "request": _serialize(latest) if latest else None,
    }


@router.post("/requests", status_code=201)
async def request_logistics_addon(payload: LogisticsAddonRequestCreate, ctx: TenantCtx = Depends(get_hq_tenant)):
    tenant = await tenants_collection.find_one({"tenant_id": ctx["tenant_id"]})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found.")
    if _is_addon_enabled(tenant):
        raise HTTPException(status_code=409, detail="Logistics is already enabled for your account.")
    existing = await logistics_addon_requests_collection.find_one(
        {"tenant_id": ctx["tenant_id"], "status": "PENDING"}
    )
    if existing:
        raise HTTPException(status_code=409, detail="A Logistics activation request is already awaiting review.")

    now = datetime.utcnow()
    document = {
        "tenant_id": ctx["tenant_id"],
        "company_name": tenant.get("company_name", ""),
        "requested_by_admin_id": ctx.get("admin_id", ""),
        "requested_by_name": ctx.get("admin_name", ""),
        "requested_by_email": ctx.get("admin_email", ""),
        "note": payload.note.strip(),
        "status": "PENDING",
        "created_at": now,
        "updated_at": now,
    }
    result = await logistics_addon_requests_collection.insert_one(document)
    document["_id"] = result.inserted_id
    return {
        "message": "Your Logistics activation request was sent to RMS for review.",
        "request": _serialize(document),
    }


@router.get("/requests")
async def list_addon_requests(current_admin: Dict[str, Any] = Depends(get_current_superadmin)):
    del current_admin
    requests = []
    async for document in logistics_addon_requests_collection.find({}).sort("created_at", -1):
        requests.append(_serialize(document))
    return {"requests": requests}


@router.patch("/requests/{request_id}")
async def review_addon_request(
    request_id: str,
    payload: LogisticsAddonReview,
    current_admin: Dict[str, Any] = Depends(get_current_superadmin),
):
    try:
        request = await logistics_addon_requests_collection.find_one({"_id": ObjectId(request_id)})
    except Exception:
        request = None
    if not request:
        raise HTTPException(status_code=404, detail="Activation request not found.")
    if request.get("status") != "PENDING":
        raise HTTPException(status_code=409, detail="This request has already been reviewed.")

    now = datetime.utcnow()
    review_patch = {
        "status": "APPROVED" if payload.action == "approve" else "DECLINED",
        "internal_note": payload.internal_note.strip(),
        "reviewed_at": now,
        "reviewed_by": str(current_admin["_id"]),
        "updated_at": now,
    }
    await logistics_addon_requests_collection.update_one({"_id": request["_id"]}, {"$set": review_patch})

    if payload.action == "decline":
        return {"message": "Activation request declined."}

    await tenants_collection.update_one(
        {"tenant_id": request["tenant_id"]},
        {"$set": {"logistics_enabled": True, "updated_at": now}},
    )
    return {"message": f"Logistics activated for {request.get('company_name') or request['tenant_id']}."}
