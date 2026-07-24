"""Tenant-scoped HR module.

Employees are NOT a separate list — admins_collection is already the real
record of who works at this tenant (name, department, store, status). This
router only adds HR-specific data on top of an existing admin record
(attendance, leave, salary, holidays) keyed by admin_id. There is no
employee create/delete here; staff lifecycle stays owned by the existing
Admin Management screens (hq_store_routes.py / Store Staff).
"""

from datetime import datetime, timedelta
from typing import Any, Dict, Literal, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from .deps import get_tenant
from ..db import (
    admins_collection,
    hr_attendance_collection,
    hr_employee_profiles_collection,
    hr_holidays_collection,
    hr_leave_requests_collection,
    hr_salary_records_collection,
)

router = APIRouter(prefix="/api/hr", tags=["HR"])
TenantCtx = Dict[str, Any]

LEAVE_TYPES = {"Sick Leave", "Vacation", "Personal Leave", "Maternity Leave", "Paternity Leave", "Unpaid Leave"}


async def get_hr_context(ctx: TenantCtx = Depends(get_tenant)) -> TenantCtx:
    """HR-department or hr-permission admins only. Same shape as get_finance_context."""
    departments = set(ctx.get("_managed_departments") or [])
    permissions = set(ctx.get("_permissions") or [])
    if "HR" not in departments and "hr" not in permissions:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="HR department access is required.")
    return ctx


def _oid(value: str, label: str = "id") -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=400, detail=f"Invalid {label}.")
    return ObjectId(value)


def _serialize(doc: dict, extra_id_fields: tuple = ()) -> dict:
    doc = dict(doc)
    doc["_id"] = str(doc["_id"])
    for f in extra_id_fields:
        if doc.get(f):
            doc[f] = str(doc[f])
    for f in ("created_at", "updated_at", "reviewed_at"):
        if isinstance(doc.get(f), datetime):
            doc[f] = doc[f].isoformat()
    return doc


# ═══════════════════════════════════════════════════════════════════════════
# EMPLOYEE DIRECTORY — reads admins_collection, never duplicates it
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/employees")
async def list_employees(ctx: TenantCtx = Depends(get_hr_context)):
    query: dict = {"tenant_id": ctx["tenant_id"]}
    if ctx.get("scope") in {"store", "branch"}:
        query["store_id"] = ctx.get("store_id")

    employees = []
    async for admin in admins_collection.find(query, {"hashed_password": 0}):
        profile = await hr_employee_profiles_collection.find_one({
            "tenant_id": ctx["tenant_id"], "admin_id": str(admin["_id"]),
        })
        employees.append({
            "id": str(admin["_id"]),
            "name": admin.get("name", ""),
            "email": admin.get("email", ""),
            "phone": admin.get("phone", ""),
            "department": admin.get("department", ""),
            "store_name": admin.get("store_name"),
            "scope": admin.get("scope", "hq"),
            "status": admin.get("status", "ACTIVE"),
            "join_date": (profile or {}).get("join_date") or (
                admin.get("created_at").strftime("%Y-%m-%d") if isinstance(admin.get("created_at"), datetime) else None
            ),
            "employment_type": (profile or {}).get("employment_type", "Full-time"),
            "notes": (profile or {}).get("notes", ""),
        })
    return {"status": "success", "data": employees}


class EmployeeProfileUpdate(BaseModel):
    join_date: Optional[str] = None
    employment_type: Optional[str] = None
    notes: Optional[str] = Field(default=None, max_length=1000)


@router.patch("/employees/{admin_id}/profile")
async def update_employee_profile(admin_id: str, payload: EmployeeProfileUpdate, ctx: TenantCtx = Depends(get_hr_context)):
    admin = await admins_collection.find_one({"_id": _oid(admin_id, "employee id"), "tenant_id": ctx["tenant_id"]})
    if not admin:
        raise HTTPException(status_code=404, detail="Employee not found.")

    patch = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    patch["updated_at"] = datetime.utcnow()
    await hr_employee_profiles_collection.update_one(
        {"tenant_id": ctx["tenant_id"], "admin_id": admin_id},
        {"$set": patch, "$setOnInsert": {"created_at": datetime.utcnow()}},
        upsert=True,
    )
    return {"status": "success", "message": "Employee profile updated."}


# ═══════════════════════════════════════════════════════════════════════════
# ATTENDANCE — self-service check-in/out + HR corrections
# ═══════════════════════════════════════════════════════════════════════════

def _today() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d")


@router.post("/attendance/checkin")
async def check_in(ctx: TenantCtx = Depends(get_tenant)):
    today = _today()
    now = datetime.utcnow()
    existing = await hr_attendance_collection.find_one({
        "tenant_id": ctx["tenant_id"], "admin_id": ctx["admin_id"], "date": today,
    })
    if existing and existing.get("check_in"):
        raise HTTPException(status_code=409, detail="Already checked in today.")

    await hr_attendance_collection.update_one(
        {"tenant_id": ctx["tenant_id"], "admin_id": ctx["admin_id"], "date": today},
        {
            "$set": {
                "employee_name": ctx.get("admin_name", ""),
                "store_id": ctx.get("store_id"),
                "check_in": now,
                "status": "Present",
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    return {"status": "success", "message": "Checked in.", "check_in": now.isoformat()}


@router.post("/attendance/checkout")
async def check_out(ctx: TenantCtx = Depends(get_tenant)):
    today = _today()
    now = datetime.utcnow()
    record = await hr_attendance_collection.find_one({
        "tenant_id": ctx["tenant_id"], "admin_id": ctx["admin_id"], "date": today,
    })
    if not record or not record.get("check_in"):
        raise HTTPException(status_code=409, detail="You haven't checked in today.")
    if record.get("check_out"):
        raise HTTPException(status_code=409, detail="Already checked out today.")

    hours = round((now - record["check_in"]).total_seconds() / 3600, 2)
    await hr_attendance_collection.update_one(
        {"_id": record["_id"]},
        {"$set": {"check_out": now, "hours": hours, "updated_at": now}},
    )
    return {"status": "success", "message": "Checked out.", "hours": hours}


@router.get("/attendance")
async def list_attendance(date: str = Query(default_factory=_today), ctx: TenantCtx = Depends(get_hr_context)):
    query: dict = {"tenant_id": ctx["tenant_id"], "date": date}
    if ctx.get("scope") in {"store", "branch"}:
        query["store_id"] = ctx.get("store_id")
    records = []
    async for doc in hr_attendance_collection.find(query).sort("employee_name", 1):
        records.append(_serialize(doc))
    return {"status": "success", "data": records}


class ManualAttendance(BaseModel):
    admin_id: str
    date: str
    status: Literal["Present", "Late", "Absent", "On Leave"]


@router.post("/attendance/manual")
async def mark_attendance_manual(payload: ManualAttendance, ctx: TenantCtx = Depends(get_hr_context)):
    admin = await admins_collection.find_one({"_id": _oid(payload.admin_id, "employee id"), "tenant_id": ctx["tenant_id"]})
    if not admin:
        raise HTTPException(status_code=404, detail="Employee not found.")
    now = datetime.utcnow()
    await hr_attendance_collection.update_one(
        {"tenant_id": ctx["tenant_id"], "admin_id": payload.admin_id, "date": payload.date},
        {
            "$set": {
                "employee_name": admin.get("name", ""),
                "store_id": admin.get("store_id"),
                "status": payload.status,
                "marked_by": ctx["admin_id"],
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    return {"status": "success", "message": "Attendance updated."}


# ═══════════════════════════════════════════════════════════════════════════
# LEAVE — self-service requests, HR approval
# ═══════════════════════════════════════════════════════════════════════════

class LeaveCreate(BaseModel):
    leave_type: str = Field(..., max_length=40)
    start_date: str
    end_date: str
    reason: str = Field(default="", max_length=1000)


@router.post("/leaves")
async def request_leave(payload: LeaveCreate, ctx: TenantCtx = Depends(get_tenant)):
    if payload.leave_type not in LEAVE_TYPES:
        raise HTTPException(status_code=400, detail="Unrecognised leave type.")
    try:
        start = datetime.strptime(payload.start_date, "%Y-%m-%d")
        end = datetime.strptime(payload.end_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Dates must be in YYYY-MM-DD format.")
    if end < start:
        raise HTTPException(status_code=400, detail="End date can't be before start date.")

    now = datetime.utcnow()
    doc = {
        "tenant_id": ctx["tenant_id"],
        "admin_id": ctx["admin_id"],
        "employee_name": ctx.get("admin_name", ""),
        "store_id": ctx.get("store_id"),
        "leave_type": payload.leave_type,
        "start_date": payload.start_date,
        "end_date": payload.end_date,
        "days": (end - start).days + 1,
        "reason": payload.reason.strip(),
        "status": "Pending",
        "created_at": now,
        "updated_at": now,
    }
    result = await hr_leave_requests_collection.insert_one(doc)
    doc["_id"] = result.inserted_id
    return {"status": "success", "message": "Leave request submitted.", "data": _serialize(doc)}


@router.get("/leaves")
async def list_leaves(mine: bool = False, ctx: TenantCtx = Depends(get_tenant)):
    query: dict = {"tenant_id": ctx["tenant_id"]}
    if mine:
        query["admin_id"] = ctx["admin_id"]
    else:
        departments = set(ctx.get("_managed_departments") or [])
        permissions = set(ctx.get("_permissions") or [])
        if "HR" not in departments and "hr" not in permissions:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="HR department access is required.")
        if ctx.get("scope") in {"store", "branch"}:
            query["store_id"] = ctx.get("store_id")

    leaves = []
    async for doc in hr_leave_requests_collection.find(query).sort("created_at", -1):
        leaves.append(_serialize(doc))
    return {"status": "success", "data": leaves}


class LeaveReview(BaseModel):
    action: Literal["approve", "reject"]


@router.patch("/leaves/{leave_id}")
async def review_leave(leave_id: str, payload: LeaveReview, ctx: TenantCtx = Depends(get_hr_context)):
    leave = await hr_leave_requests_collection.find_one({"_id": _oid(leave_id, "leave id"), "tenant_id": ctx["tenant_id"]})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found.")
    if leave.get("status") != "Pending":
        raise HTTPException(status_code=409, detail="This leave request was already reviewed.")

    await hr_leave_requests_collection.update_one(
        {"_id": leave["_id"]},
        {"$set": {
            "status": "Approved" if payload.action == "approve" else "Rejected",
            "reviewed_by": ctx["admin_id"],
            "reviewed_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }},
    )
    return {"status": "success", "message": f"Leave request {payload.action}d."}


# ═══════════════════════════════════════════════════════════════════════════
# SALARY — HR-only, sensitive
# ═══════════════════════════════════════════════════════════════════════════

class SalaryUpsert(BaseModel):
    admin_id: str
    month: str = Field(..., description="e.g. 2026-07")
    basic_salary: float = Field(..., ge=0)
    allowances: float = Field(default=0, ge=0)
    deductions: float = Field(default=0, ge=0)


@router.post("/salary")
async def upsert_salary(payload: SalaryUpsert, ctx: TenantCtx = Depends(get_hr_context)):
    admin = await admins_collection.find_one({"_id": _oid(payload.admin_id, "employee id"), "tenant_id": ctx["tenant_id"]})
    if not admin:
        raise HTTPException(status_code=404, detail="Employee not found.")

    net_salary = payload.basic_salary + payload.allowances - payload.deductions
    now = datetime.utcnow()
    await hr_salary_records_collection.update_one(
        {"tenant_id": ctx["tenant_id"], "admin_id": payload.admin_id, "month": payload.month},
        {
            "$set": {
                "employee_name": admin.get("name", ""),
                "basic_salary": payload.basic_salary,
                "allowances": payload.allowances,
                "deductions": payload.deductions,
                "net_salary": net_salary,
                "updated_by": ctx["admin_id"],
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    return {"status": "success", "message": "Salary record saved.", "net_salary": net_salary}


@router.get("/salary")
async def list_salary(month: Optional[str] = None, ctx: TenantCtx = Depends(get_hr_context)):
    query: dict = {"tenant_id": ctx["tenant_id"]}
    if month:
        query["month"] = month
    records = []
    async for doc in hr_salary_records_collection.find(query).sort("month", -1):
        records.append(_serialize(doc))
    return {"status": "success", "data": records}


# ═══════════════════════════════════════════════════════════════════════════
# HOLIDAYS — visible to everyone, editable by HR
# ═══════════════════════════════════════════════════════════════════════════

class HolidayCreate(BaseModel):
    name: str = Field(..., max_length=120)
    date: str
    type: str = Field(default="Company Holiday", max_length=40)
    description: str = Field(default="", max_length=500)


@router.get("/holidays")
async def list_holidays(ctx: TenantCtx = Depends(get_tenant)):
    holidays = []
    async for doc in hr_holidays_collection.find({"tenant_id": ctx["tenant_id"]}).sort("date", 1):
        holidays.append(_serialize(doc))
    return {"status": "success", "data": holidays}


@router.post("/holidays", status_code=201)
async def add_holiday(payload: HolidayCreate, ctx: TenantCtx = Depends(get_hr_context)):
    now = datetime.utcnow()
    doc = {
        "tenant_id": ctx["tenant_id"],
        "name": payload.name.strip(),
        "date": payload.date,
        "type": payload.type,
        "description": payload.description.strip(),
        "created_by": ctx["admin_id"],
        "created_at": now,
    }
    result = await hr_holidays_collection.insert_one(doc)
    doc["_id"] = result.inserted_id
    return {"status": "success", "data": _serialize(doc)}


@router.delete("/holidays/{holiday_id}")
async def delete_holiday(holiday_id: str, ctx: TenantCtx = Depends(get_hr_context)):
    result = await hr_holidays_collection.delete_one({"_id": _oid(holiday_id, "holiday id"), "tenant_id": ctx["tenant_id"]})
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="Holiday not found.")
    return {"status": "success", "message": "Holiday removed."}


# ═══════════════════════════════════════════════════════════════════════════
# DASHBOARD SUMMARY
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/dashboard")
async def hr_dashboard(ctx: TenantCtx = Depends(get_hr_context)):
    tenant_id = ctx["tenant_id"]
    today = _today()

    employee_query: dict = {"tenant_id": tenant_id}
    if ctx.get("scope") in {"store", "branch"}:
        employee_query["store_id"] = ctx.get("store_id")
    total_employees = await admins_collection.count_documents(employee_query)

    present_today = await hr_attendance_collection.count_documents({
        "tenant_id": tenant_id, "date": today, "status": {"$in": ["Present", "Late"]},
    })
    on_leave_today = await hr_attendance_collection.count_documents({
        "tenant_id": tenant_id, "date": today, "status": "On Leave",
    })
    pending_leaves = await hr_leave_requests_collection.count_documents({
        "tenant_id": tenant_id, "status": "Pending",
    })

    return {
        "status": "success",
        "data": {
            "total_employees": total_employees,
            "present_today": present_today,
            "on_leave_today": on_leave_today,
            "pending_leave_requests": pending_leaves,
        },
    }
