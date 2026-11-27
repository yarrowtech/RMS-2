"""Staff logins -- a lightweight sub-login tier separate from admins_collection.

An HQ admin, or a department admin for their own store/department, can
create one of these for a single store: a username+password login (no real
email needed) capped to a chosen subset of permission tabs. Resolved by
deps.get_tenant / store_helper.get_store_context via JWT role "STAFF" --
every route already gated with require_permission()/require_department()
works for a staff login automatically, with no changes to those routes.

Fully additive: does not read or write admins_collection, and the existing
/auth/login flow is untouched.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from ..auth import create_access_token
from ..db import staff_users_collection, stores_collection
from ..rate_limit import limiter
from ..session_utils import start_session
from ..utils import hash_password, verify_password
from .deps import get_tenant

router = APIRouter(tags=["Staff Logins"])


# ============================================================================
# LOGIN
# ============================================================================

class StaffLoginRequest(BaseModel):
    username: str
    password: str


@router.post("/auth/staff-login")
@limiter.limit("10/minute")
async def staff_login(request: Request, req: StaffLoginRequest):
    username = (req.username or "").strip().lower()
    staff = await staff_users_collection.find_one({"username": username})
    if not staff:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if staff.get("status") != "ACTIVE":
        raise HTTPException(status_code=403, detail="This login has been suspended. Contact your administrator.")

    hashed = staff.get("hashed_password")
    if not hashed or not verify_password(req.password, hashed):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    session_id = await start_session(request, str(staff["_id"]), staff.get("tenant_id"), 480)

    token = create_access_token(
        str(staff["_id"]),
        staff.get("department", ""),
        role="STAFF",
        extra={
            "tenant_id":  staff.get("tenant_id"),
            "store_id":   staff.get("store_id"),
            "store_name": staff.get("store_name"),
            "store_type": staff.get("store_type"),
            "scope":      "store",
            "sid":        session_id,
        },
        expires_minutes=480,
    )

    await staff_users_collection.update_one({"_id": staff["_id"]}, {"$set": {"last_login": datetime.utcnow()}})

    return {
        "access_token": token,
        "role":         "STAFF",
        "department":   staff.get("department", ""),
        "name":         staff.get("name") or staff.get("username", ""),
        "store_name":   staff.get("store_name", ""),
        "permissions":  staff.get("permissions", []),
    }


# ============================================================================
# CREATION / MANAGEMENT -- gated by the SAME ctx an admin already has
# ============================================================================

class StaffCreateRequest(BaseModel):
    name: str
    username: str
    password: str
    store_id: str
    department: str = ""
    permissions: List[str] = Field(default_factory=list)


def _assert_can_manage_staff(ctx: Dict[str, Any], target_store_id: str, requested_permissions: List[str], target_department: str) -> None:
    """HQ admins may create a staff login for any store in their tenant and
    grant any permission (HQ is unrestricted by design in this codebase --
    see get_hq_tenant's own docstring). A store/department admin may only
    create one for their OWN store, and only grant permissions that are a
    subset of permissions they themselves hold -- never more than they
    have."""
    if ctx["scope"] == "hq":
        return
    if ctx["scope"] not in ("store", "branch") or not ctx.get("store_id"):
        raise HTTPException(status_code=403, detail="You are not permitted to create staff logins.")
    if target_store_id != ctx["store_id"]:
        raise HTTPException(status_code=403, detail="You can only create staff logins for your own store.")
    own_permissions = set(ctx.get("_permissions") or [])
    extra = set(requested_permissions) - own_permissions
    if extra:
        raise HTTPException(
            status_code=403,
            detail=f"You cannot grant permissions you do not hold yourself: {', '.join(sorted(extra))}",
        )
    own_departments = set(ctx.get("_managed_departments") or [])
    if target_department and own_departments and target_department not in own_departments:
        raise HTTPException(status_code=403, detail="You can only create staff logins within your own department.")


def _staff_scope_filter(ctx: Dict[str, Any]) -> Dict[str, Any]:
    q: Dict[str, Any] = {"tenant_id": ctx["tenant_id"]}
    if ctx["scope"] in ("store", "branch") and ctx.get("store_id"):
        q["store_id"] = ctx["store_id"]
    return q


@router.post("/staff-users", status_code=201)
async def create_staff_user(payload: StaffCreateRequest, ctx: Dict[str, Any] = Depends(get_tenant)):
    username = (payload.username or "").strip().lower()
    if not username or " " in username:
        raise HTTPException(status_code=400, detail="Username is required and cannot contain spaces.")
    if len(payload.password or "") < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters.")

    try:
        store = await stores_collection.find_one({"_id": ObjectId(payload.store_id), "tenant_id": ctx["tenant_id"]})
    except Exception:
        store = None
    if not store:
        raise HTTPException(status_code=404, detail="Store not found for this tenant.")

    _assert_can_manage_staff(ctx, payload.store_id, payload.permissions, payload.department)

    existing = await staff_users_collection.find_one({"username": username})
    if existing:
        raise HTTPException(status_code=409, detail="That username is already taken -- try adding your store initials.")

    doc = {
        "tenant_id":       ctx["tenant_id"],
        "store_id":        payload.store_id,
        "store_name":      store.get("name", ""),
        "store_type":      store.get("type", ""),
        "scope":           "store",
        "department":      payload.department or ctx.get("department", ""),
        "name":            payload.name.strip(),
        "username":        username,
        "hashed_password": hash_password(payload.password),
        "permissions":      payload.permissions,
        "status":          "ACTIVE",
        "created_by":      ctx.get("admin_id"),
        "created_at":      datetime.utcnow(),
        "updated_at":      datetime.utcnow(),
    }
    result = await staff_users_collection.insert_one(doc)
    return {
        "id":          str(result.inserted_id),
        "name":        doc["name"],
        "username":    doc["username"],
        "store_id":    doc["store_id"],
        "store_name":  doc["store_name"],
        "department":  doc["department"],
        "permissions": doc["permissions"],
        "status":      doc["status"],
    }


@router.get("/staff-users")
async def list_staff_users(ctx: Dict[str, Any] = Depends(get_tenant)):
    cursor = staff_users_collection.find(_staff_scope_filter(ctx)).sort("created_at", -1)
    out = []
    async for s in cursor:
        out.append({
            "id":          str(s["_id"]),
            "name":        s.get("name", ""),
            "username":    s.get("username", ""),
            "store_id":    s.get("store_id", ""),
            "store_name":  s.get("store_name", ""),
            "department":  s.get("department", ""),
            "permissions": s.get("permissions", []),
            "status":      s.get("status", "ACTIVE"),
            "last_login":  s.get("last_login"),
        })
    return out


class StaffPermissionsUpdate(BaseModel):
    permissions: List[str]


@router.patch("/staff-users/{staff_id}/permissions")
async def update_staff_permissions(staff_id: str, payload: StaffPermissionsUpdate, ctx: Dict[str, Any] = Depends(get_tenant)):
    staff = await staff_users_collection.find_one({"_id": ObjectId(staff_id), **_staff_scope_filter(ctx)})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff login not found.")
    _assert_can_manage_staff(ctx, staff["store_id"], payload.permissions, staff.get("department", ""))
    await staff_users_collection.update_one(
        {"_id": staff["_id"]},
        {"$set": {"permissions": payload.permissions, "updated_at": datetime.utcnow()}},
    )
    return {"message": "Permissions updated", "permissions": payload.permissions}


class StaffStatusUpdate(BaseModel):
    status: str  # "ACTIVE" | "SUSPENDED"


@router.patch("/staff-users/{staff_id}/status")
async def update_staff_status(staff_id: str, payload: StaffStatusUpdate, ctx: Dict[str, Any] = Depends(get_tenant)):
    staff = await staff_users_collection.find_one({"_id": ObjectId(staff_id), **_staff_scope_filter(ctx)})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff login not found.")
    if payload.status not in ("ACTIVE", "SUSPENDED"):
        raise HTTPException(status_code=400, detail="status must be ACTIVE or SUSPENDED")
    await staff_users_collection.update_one(
        {"_id": staff["_id"]},
        {"$set": {"status": payload.status, "updated_at": datetime.utcnow()}},
    )
    return {"message": "Status updated", "status": payload.status}


class StaffPasswordReset(BaseModel):
    password: str


@router.post("/staff-users/{staff_id}/reset-password")
async def reset_staff_password(staff_id: str, payload: StaffPasswordReset, ctx: Dict[str, Any] = Depends(get_tenant)):
    staff = await staff_users_collection.find_one({"_id": ObjectId(staff_id), **_staff_scope_filter(ctx)})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff login not found.")
    if len(payload.password or "") < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters.")
    await staff_users_collection.update_one(
        {"_id": staff["_id"]},
        {"$set": {"hashed_password": hash_password(payload.password), "updated_at": datetime.utcnow()}},
    )
    return {"message": "Password reset"}


@router.delete("/staff-users/{staff_id}")
async def delete_staff_user(staff_id: str, ctx: Dict[str, Any] = Depends(get_tenant)):
    staff = await staff_users_collection.find_one({"_id": ObjectId(staff_id), **_staff_scope_filter(ctx)})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff login not found.")
    await staff_users_collection.delete_one({"_id": staff["_id"]})
    return {"message": "Staff login deleted"}
