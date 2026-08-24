"""
staff_task_routes.py
=====================
General staff task assignment — a department head or HQ admin hands a task
to a specific admin in their own team/store, tracks its status, and reviews
what's outstanding. Separate from tasklist_routes.py, which is the
Merchandiser Buyer module's own purchasing-workflow to-do list.

Assignment can only target admins_collection members (i.e. staff who have a
login) — floor staff (hr_floor_staff_collection) have no login and can never
see or be assigned a task here.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
from datetime import datetime
from bson import ObjectId

from .deps import get_any_tenant
from ..db import staff_tasks_collection, admins_collection

router = APIRouter(prefix="/staff-tasks", tags=["Staff Tasks"])

TenantCtx = Dict[str, Any]

STATUSES = {"open", "in_progress", "done"}
PRIORITIES = {"low", "medium", "high", "urgent"}

# Departments/roles broad enough to assign tasks to anyone in the tenant,
# not just their own team — mirrors the exact department set the "/admin"
# route itself allows through (App.jsx's DepartmentRouteGuard for
# Hqadminmanagement.jsx: HQ, IT, Administrator, SUPERADMIN), plus Store
# Owner for the single-store equivalent.
FULL_ACCESS_DEPARTMENTS = {"HQ", "Administrator", "IT", "SUPERADMIN", "Store Owner"}


def _is_full_access(ctx: TenantCtx) -> bool:
    """Full-access callers may assign to any staff tenant-wide (subject only
    to the store-lock below). Everyone else who can assign at all (a plain
    department head) is scoped to their OWN department's staff only —
    a Merchandiser Buyer head has no business assigning tasks to Finance."""
    if ctx.get("department") in FULL_ACCESS_DEPARTMENTS:
        return True
    departments = set(ctx.get("_managed_departments") or [])
    permissions = set(ctx.get("_permissions") or [])
    return ctx.get("department") == "HR" or "HR" in departments or "hr" in permissions


async def _can_assign(ctx: TenantCtx) -> bool:
    """A department head, a full-access HQ/Store-Owner admin, an HR admin,
    or anyone explicitly granted the "assign_tasks" permission may assign
    tasks. That last one exists so a department isn't bottlenecked on its
    single formal head — HQ can grant a few trusted senior staff (e.g. team
    leads in a large Merchandiser Buyer team) the ability to distribute
    work too, without making them THE department head."""
    if _is_full_access(ctx):
        return True
    if "assign_tasks" in set(ctx.get("_permissions") or []):
        return True
    admin = await admins_collection.find_one({"_id": ObjectId(ctx["admin_id"])}, {"is_department_head": 1})
    return bool(admin and admin.get("is_department_head"))


def _own_departments(ctx: TenantCtx) -> set:
    departments = set(ctx.get("_managed_departments") or [])
    if ctx.get("department"):
        departments.add(ctx["department"])
    return departments


def _admin_departments(admin: dict) -> set:
    departments = set(admin.get("managedDepartments") or [])
    if admin.get("department"):
        departments.add(admin["department"])
    return departments


async def _assert_can_assign_to(ctx: TenantCtx, assignee: dict) -> None:
    if assignee.get("tenant_id") != ctx["tenant_id"]:
        raise HTTPException(status_code=404, detail="Staff member not found.")
    if not await _can_assign(ctx):
        raise HTTPException(status_code=403, detail="Only a department head or HQ/Store admin can assign tasks.")
    if ctx["scope"] in ("store", "branch"):
        if assignee.get("store_id") != ctx.get("store_id"):
            raise HTTPException(status_code=403, detail="You can only assign tasks to staff at your own store.")
    if not _is_full_access(ctx) and not (_own_departments(ctx) & _admin_departments(assignee)):
        raise HTTPException(status_code=403, detail="You can only assign tasks to staff in your own department.")


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]), "title": doc.get("title", ""), "details": doc.get("details", ""),
        "assigned_to": doc.get("assigned_to", ""), "assigned_to_name": doc.get("assigned_to_name", ""),
        "assigned_by": doc.get("assigned_by", ""), "assigned_by_name": doc.get("assigned_by_name", ""),
        "department": doc.get("department", ""), "store_id": doc.get("store_id"), "store_name": doc.get("store_name", ""),
        "priority": doc.get("priority", "medium"), "status": doc.get("status", "open"),
        "due_date": doc.get("due_date", ""),
        "created_at": doc.get("created_at").isoformat() if isinstance(doc.get("created_at"), datetime) else None,
        "updated_at": doc.get("updated_at").isoformat() if isinstance(doc.get("updated_at"), datetime) else None,
    }


class TaskCreate(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    details: str = Field(default="", max_length=2000)
    assigned_to: str
    priority: str = "medium"
    due_date: Optional[str] = ""


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    details: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[str] = None


@router.get("/assignable-staff")
async def list_assignable_staff(ctx: TenantCtx = Depends(get_any_tenant)):
    """Staff the caller is allowed to hand a task to — feeds the assignee dropdown."""
    if not await _can_assign(ctx):
        return {"data": []}
    query: dict = {"tenant_id": ctx["tenant_id"], "department": {"$ne": "SUPERADMIN"}}
    if ctx["scope"] in ("store", "branch"):
        query["store_id"] = ctx.get("store_id")
    if not _is_full_access(ctx):
        own = list(_own_departments(ctx))
        query["$or"] = [{"department": {"$in": own}}, {"managedDepartments": {"$in": own}}]
    rows = []
    async for a in admins_collection.find(query, {"name": 1, "email": 1, "department": 1, "store_name": 1}):
        rows.append({"id": str(a["_id"]), "name": a.get("name") or a.get("email", ""), "department": a.get("department", ""), "store_name": a.get("store_name", "")})
    return {"data": rows}


@router.get("/mine")
async def list_my_tasks(ctx: TenantCtx = Depends(get_any_tenant)):
    """Tasks assigned to the logged-in admin — every staff member can see their own."""
    rows = []
    async for doc in staff_tasks_collection.find({"tenant_id": ctx["tenant_id"], "assigned_to": ctx["admin_id"]}).sort("created_at", -1):
        rows.append(_serialize(doc))
    return {"data": rows}


@router.get("")
async def list_tasks(ctx: TenantCtx = Depends(get_any_tenant)):
    """Tasks the caller manages — what they've assigned, scoped to their store if store-scoped."""
    if not await _can_assign(ctx):
        raise HTTPException(status_code=403, detail="Only a department head or HQ/Store admin can view assigned tasks.")
    query: dict = {"tenant_id": ctx["tenant_id"]}
    if ctx["scope"] in ("store", "branch"):
        query["store_id"] = ctx.get("store_id")
    elif ctx.get("department") not in FULL_ACCESS_DEPARTMENTS:
        query["assigned_by"] = ctx["admin_id"]
    rows = []
    async for doc in staff_tasks_collection.find(query).sort("created_at", -1):
        rows.append(_serialize(doc))
    return {"data": rows}


@router.post("", status_code=201)
async def create_task(payload: TaskCreate, ctx: TenantCtx = Depends(get_any_tenant)):
    try:
        assignee_oid = ObjectId(payload.assigned_to)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid assignee ID.")
    assignee = await admins_collection.find_one({"_id": assignee_oid})
    if not assignee:
        raise HTTPException(status_code=404, detail="Staff member not found.")
    await _assert_can_assign_to(ctx, assignee)

    priority = payload.priority.strip().lower()
    if priority not in PRIORITIES:
        raise HTTPException(status_code=400, detail=f"Priority must be one of: {sorted(PRIORITIES)}")

    now = datetime.utcnow()
    document = {
        "tenant_id": ctx["tenant_id"], "title": payload.title.strip(), "details": payload.details.strip(),
        "assigned_to": str(assignee["_id"]), "assigned_to_name": assignee.get("name") or assignee.get("email", ""),
        "assigned_by": ctx["admin_id"], "assigned_by_name": ctx.get("admin_name", ""),
        "department": assignee.get("department", ""), "store_id": assignee.get("store_id"), "store_name": assignee.get("store_name", ""),
        "priority": priority, "status": "open", "due_date": (payload.due_date or "").strip(),
        "created_at": now, "updated_at": now,
    }
    result = await staff_tasks_collection.insert_one(document)
    document["_id"] = result.inserted_id
    return {"message": "Task assigned.", "task": _serialize(document)}


@router.patch("/{task_id}")
async def update_task(task_id: str, payload: TaskUpdate, ctx: TenantCtx = Depends(get_any_tenant)):
    try:
        oid = ObjectId(task_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task ID.")
    task = await staff_tasks_collection.find_one({"_id": oid, "tenant_id": ctx["tenant_id"]})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    is_assignee = task.get("assigned_to") == ctx["admin_id"]
    is_assigner = task.get("assigned_by") == ctx["admin_id"]
    is_full_access = ctx.get("department") in FULL_ACCESS_DEPARTMENTS
    if not (is_assignee or is_assigner or is_full_access):
        raise HTTPException(status_code=403, detail="You can only update your own tasks, or tasks you assigned.")

    patch: dict = {}
    if payload.status is not None:
        status_value = payload.status.strip().lower()
        if status_value not in STATUSES:
            raise HTTPException(status_code=400, detail=f"Status must be one of: {sorted(STATUSES)}")
        patch["status"] = status_value
    # Only the assigner (or a full-access admin) may change what the task
    # actually IS — the assignee can only move it through its status.
    if is_assigner or is_full_access:
        if payload.title is not None: patch["title"] = payload.title.strip()
        if payload.details is not None: patch["details"] = payload.details.strip()
        if payload.due_date is not None: patch["due_date"] = payload.due_date.strip()
        if payload.priority is not None:
            priority = payload.priority.strip().lower()
            if priority not in PRIORITIES:
                raise HTTPException(status_code=400, detail=f"Priority must be one of: {sorted(PRIORITIES)}")
            patch["priority"] = priority
    if not patch:
        raise HTTPException(status_code=400, detail="Nothing to update.")
    patch["updated_at"] = datetime.utcnow()
    await staff_tasks_collection.update_one({"_id": oid}, {"$set": patch})
    return {"message": "Task updated."}


@router.delete("/{task_id}")
async def delete_task(task_id: str, ctx: TenantCtx = Depends(get_any_tenant)):
    try:
        oid = ObjectId(task_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task ID.")
    task = await staff_tasks_collection.find_one({"_id": oid, "tenant_id": ctx["tenant_id"]})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    is_assigner = task.get("assigned_by") == ctx["admin_id"]
    is_full_access = ctx.get("department") in FULL_ACCESS_DEPARTMENTS
    if not (is_assigner or is_full_access):
        raise HTTPException(status_code=403, detail="Only the admin who assigned this task can delete it.")
    await staff_tasks_collection.delete_one({"_id": oid})
    return {"message": "Task deleted."}
