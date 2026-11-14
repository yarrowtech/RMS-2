"""Tenant-level department curation + paid-department upgrades.

Separate from Admin Management's per-admin managedDepartments: that
controls which of a TENANT's already-enabled departments a given staff
member can touch. This controls which departments are enabled for the
TENANT at all — a business-type curation step ("we don't do Production &
Job Work, hide it") plus a request-and-approve path for the departments
that are paid add-ons rather than free/base, reusing the exact same free/
paid split and pending-approval shape the single-store-owner upgrade flow
(store_upgrade_routes.py) already uses, instead of inventing a second one.

Enforcement note: this gates what the UI *offers* (Add Admin's checklist,
Department Reports' tabs, the Department Selector) — it is not yet wired
into every individual department route as a hard backend block. A staff
member who already has, say, "Design & Pattern" in their own
managedDepartments could still hit that department's API routes directly
even if the tenant later disabled it here. Worth tightening later if this
needs to be a hard security boundary rather than a self-service curation
tool for what the business actually uses.
"""
from datetime import datetime, timezone
from typing import Any, Dict, List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..db import tenants_collection, department_upgrade_requests_collection
from .deps import require_department
from .auth_routes import get_current_superadmin
from .hq_store_routes import HQ_DEPARTMENTS
from .store_upgrade_routes import ENTERPRISE_ONLY_DEPARTMENTS

router = APIRouter(prefix="/hq/tenant-departments", tags=["Tenant Departments"])
superadmin_router = APIRouter(prefix="/superadmin/department-upgrade-requests", tags=["Tenant Departments (Super Admin)"])

FREE_DEPARTMENTS: List[str] = [d for d in HQ_DEPARTMENTS if d not in ENTERPRISE_ONLY_DEPARTMENTS]
PAID_DEPARTMENTS: List[str] = [d for d in HQ_DEPARTMENTS if d in ENTERPRISE_ONLY_DEPARTMENTS]


async def _get_or_init_enabled(tenant_id: str) -> List[str]:
    """A tenant's enabled_departments starts out unset — defaults to every
    free department on first read, never silently defaults to paid ones."""
    tenant = await tenants_collection.find_one({"tenant_id": tenant_id}, {"enabled_departments": 1})
    if tenant and tenant.get("enabled_departments") is not None:
        return tenant["enabled_departments"]
    await tenants_collection.update_one(
        {"tenant_id": tenant_id},
        {"$set": {"enabled_departments": list(FREE_DEPARTMENTS)}},
    )
    return list(FREE_DEPARTMENTS)


@router.get("")
async def get_tenant_departments(ctx: Dict[str, Any] = Depends(require_department("HQ"))):
    tenant_id = ctx["tenant_id"]
    enabled = await _get_or_init_enabled(tenant_id)
    requests_cursor = department_upgrade_requests_collection.find(
        {"tenant_id": tenant_id, "status": "PENDING"}
    )
    pending = [r["department"] async for r in requests_cursor]
    return {
        "enabled_departments": enabled,
        "free_departments": FREE_DEPARTMENTS,
        "paid_departments": PAID_DEPARTMENTS,
        "pending_requests": pending,
    }


class TogglePayload(BaseModel):
    department: str
    enabled: bool


@router.patch("")
async def toggle_tenant_department(payload: TogglePayload, ctx: Dict[str, Any] = Depends(require_department("HQ"))):
    if payload.department not in FREE_DEPARTMENTS:
        raise HTTPException(
            status_code=400,
            detail="This department isn't a free/base department — it needs an upgrade request, not a direct toggle." if payload.department in PAID_DEPARTMENTS
            else "Unknown department.",
        )
    tenant_id = ctx["tenant_id"]
    enabled = await _get_or_init_enabled(tenant_id)
    enabled_set = set(enabled)
    if payload.enabled:
        enabled_set.add(payload.department)
    else:
        enabled_set.discard(payload.department)
    await tenants_collection.update_one(
        {"tenant_id": tenant_id},
        {"$set": {"enabled_departments": sorted(enabled_set)}},
    )
    return {"enabled_departments": sorted(enabled_set)}


class UpgradeRequestPayload(BaseModel):
    department: str
    note: str = ""


@router.post("/upgrade-request", status_code=201)
async def request_department_upgrade(payload: UpgradeRequestPayload, ctx: Dict[str, Any] = Depends(require_department("HQ"))):
    if payload.department not in PAID_DEPARTMENTS:
        raise HTTPException(status_code=400, detail="This department is free — no upgrade request needed, just toggle it on.")
    tenant_id = ctx["tenant_id"]
    enabled = await _get_or_init_enabled(tenant_id)
    if payload.department in enabled:
        raise HTTPException(status_code=400, detail="This department is already unlocked for your business.")
    existing = await department_upgrade_requests_collection.find_one({
        "tenant_id": tenant_id, "department": payload.department, "status": "PENDING",
    })
    if existing:
        raise HTTPException(status_code=400, detail="An upgrade request for this department is already pending.")
    doc = {
        "tenant_id": tenant_id,
        "department": payload.department,
        "note": payload.note.strip()[:500],
        "status": "PENDING",
        "payment_status": "unpaid",
        "requested_by": ctx.get("admin_id"),
        "requested_by_name": ctx.get("admin_name"),
        "created_at": datetime.utcnow(),
    }
    result = await department_upgrade_requests_collection.insert_one(doc)
    return {"id": str(result.inserted_id), "message": f"Upgrade request for {payload.department} submitted."}


# ─── Super Admin review ──────────────────────────────────────────────────

@superadmin_router.get("")
async def list_department_upgrade_requests(current_admin: Dict[str, Any] = Depends(get_current_superadmin)):
    rows = await department_upgrade_requests_collection.find({"status": "PENDING"}).sort("created_at", -1).to_list(200)
    return [{
        "id": str(r["_id"]),
        "tenant_id": r.get("tenant_id", ""),
        "department": r.get("department", ""),
        "note": r.get("note", ""),
        "requested_by_name": r.get("requested_by_name", ""),
        "created_at": (r.get("created_at") if r.get("created_at").tzinfo else r.get("created_at").replace(tzinfo=timezone.utc)).isoformat() if isinstance(r.get("created_at"), datetime) else None,
    } for r in rows]


class UpgradeReviewPayload(BaseModel):
    action: str  # "approve" | "decline"
    payment_status: str = "paid"  # only meaningful on approve


@superadmin_router.post("/{request_id}/review")
async def review_department_upgrade_request(
    request_id: str,
    payload: UpgradeReviewPayload,
    current_admin: Dict[str, Any] = Depends(get_current_superadmin),
):
    try:
        oid = ObjectId(request_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request ID.")
    req = await department_upgrade_requests_collection.find_one({"_id": oid})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found.")
    if req.get("status") != "PENDING":
        raise HTTPException(status_code=400, detail=f"This request is already {req.get('status')}.")
    if payload.action not in ("approve", "decline"):
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'decline'.")

    now = datetime.utcnow()
    new_status = "APPROVED" if payload.action == "approve" else "DECLINED"
    await department_upgrade_requests_collection.update_one(
        {"_id": oid},
        {"$set": {
            "status": new_status,
            "payment_status": payload.payment_status if payload.action == "approve" else req.get("payment_status", "unpaid"),
            "reviewed_by": str(current_admin.get("_id") or ""),
            "reviewed_at": now,
        }},
    )
    if payload.action == "approve":
        enabled = await _get_or_init_enabled(req["tenant_id"])
        if req["department"] not in enabled:
            enabled = sorted(set(enabled) | {req["department"]})
            await tenants_collection.update_one(
                {"tenant_id": req["tenant_id"]},
                {"$set": {"enabled_departments": enabled}},
            )
    return {"message": f"Request {new_status.lower()}."}
