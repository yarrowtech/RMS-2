"""Controlled Single Store -> multi-store retailer upgrade workflow.

The upgrade changes tenant access only. It intentionally does not move or
duplicate stock: the existing single-store location stays as the retailer's
first store and its stock remains at that location.
"""

from datetime import datetime
from typing import Any, Dict, Literal, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .deps import get_any_tenant
from .auth_routes import get_current_superadmin
from ..db import admins_collection, store_upgrade_requests_collection, tenants_collection


router = APIRouter(prefix="/api/store-upgrades", tags=["Store Upgrade"])
TenantCtx = Dict[str, Any]

MULTI_STORE_PLANS = {"professional", "enterprise"}
HQ_DEPARTMENTS = [
    "HQ", "Inventory", "Merchandiser Buyer", "Finance", "Logistics",
    "Design & Pattern", "Stock Planning & Forecasting", "Third Party",
    "Production & Job Work", "HR",
]
HQ_PERMISSIONS = [
    "inventory", "purchase_orders", "grn", "grc", "vendors",
    "stock_allocation", "stock_transfer", "job_work", "mbuyer", "hr",
    "finance", "logistics", "reports", "user_management",
]


class StoreUpgradeCreate(BaseModel):
    requested_plan: Literal["professional", "enterprise"] = "professional"
    note: str = Field(default="", max_length=1000)


class StoreUpgradeReview(BaseModel):
    action: Literal["approve", "decline"]
    approved_plan: Optional[Literal["professional", "enterprise"]] = None
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
        "note": document.get("note", ""),
        "status": document.get("status", "PENDING"),
        "approved_plan": document.get("approved_plan"),
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
        "note": payload.note.strip(),
        "status": "PENDING",
        "created_at": now,
        "updated_at": now,
    }
    result = await store_upgrade_requests_collection.insert_one(document)
    document["_id"] = result.inserted_id
    return {"message": "Your multi-store upgrade request was sent to RMS for review.", "request": _serialize(document)}


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
    if request.get("status") != "PENDING":
        raise HTTPException(status_code=409, detail="This upgrade request has already been reviewed.")

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
            "managedDepartments": HQ_DEPARTMENTS,
            "permissions": HQ_PERMISSIONS,
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

    review_patch.update({"approved_plan": plan, "migration": "store_preserved_no_stock_duplication"})
    await store_upgrade_requests_collection.update_one({"_id": request["_id"]}, {"$set": review_patch})
    return {
        "message": "Tenant upgraded to a multi-store retailer. The original store and its stock were preserved. The owner must sign in again as HQ Admin.",
        "plan": plan,
    }
