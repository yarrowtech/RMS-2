
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Any, Dict, List, Optional
from jose import jwt, JWTError

from ..auth import decode_token, create_access_token, create_reset_token, decode_reset_token
from ..db import admins_collection
from ..utils import hash_password, verify_password
from ..models import TokenResponse
from ..config import settings
from bson import ObjectId
from ..email_utils import send_reset_password_email
from fastapi import Header

router = APIRouter(prefix="/auth", tags=["auth"])

CurrentAdmin = Dict[str, Any]

DEPARTMENT_ROUTES: Dict[str, str] = {
    "HR":                             "/hr",
    "Cashier":                        "/cashier",
    "Finance":                        "/finance",
    "IT":                             "/admin",
    "Logistics":                      "/logistics",
    "Design & Pattern":               "/design",
    "Inventory":                      "/inventory",
    "Stock Planning & Forecasting":   "/stock",
    "Third Party":                    "/third-party",
    "Production & Job Work":          "/production",
    "Merchandiser Buyer":             "/merchandiser-buyer",
    "Vendor":                         "/merchandiser-seller",
    "Store Owner":                    "/dashboard/store-owner",
}
# NOTE: "Inventory", "Finance", "HR" are shared department names now (see
# hq_store_routes.py) — the SAME route ("/inventory", "/finance", "/hr") is
# correct for both an HQ-scoped and a store-scoped admin with that
# department, since the page component itself branches on
# localStorage.store_id to show central vs store data. This map does not
# need a scope-specific variant and should not get one — that was the
# earlier bug (department strings like "Inventory (Store)") already fixed
# elsewhere. Do not reintroduce it here.


def get_redirect_for_departments(departments: List[str]) -> Dict[str, Any]:
    if not departments:
        return {
            "redirect_type": "direct",
            "redirect_url":  "/admin/login",
            "departments":   [],
            "routes":        {},
        }
    routes = {dept: DEPARTMENT_ROUTES.get(dept, "/admin") for dept in departments}
    if len(departments) == 1:
        return {"redirect_type": "direct",   "redirect_url": routes[departments[0]], "departments": departments, "routes": routes}
    return     {"redirect_type": "selector", "redirect_url": "/dashboard/select",   "departments": departments, "routes": routes}


# ── JWT Auth Setup ────────────────────────────────────────────────────────────
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="superadmin/login")


async def get_current_superadmin(token: str = Depends(oauth2_scheme)) -> CurrentAdmin:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
        user_id: str = payload.get("sub")
        role: str    = payload.get("role")
        if user_id is None or role != "super_admin":
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    admin = await admins_collection.find_one({"_id": ObjectId(user_id), "department": "SUPERADMIN"})
    if not admin:
        raise credentials_exception
    return admin  # type: ignore[return-value]


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _store_info(admin: dict) -> Dict[str, Any]:
    """
    Extract store/scope context from an admin document.

    ⚠️ FIXED BUG: this function used to independently RE-DERIVE `scope`
    from store_id/store_type:

        "scope": "hq" if not admin.get("store_id") else (admin.get("store_type") or "store")

    That duplicated the scope decision hq_store_routes.py's
    hq_create_admin already makes explicitly and stores directly on the
    admin document as admin["scope"] ("hq" or "store", chosen by the Level
    toggle in the Add Admin modal — not inferred from department or
    store_id). Two independent computations of the same fact is the exact
    pattern that caused an earlier department-routing bug in this codebase:
    they can silently disagree, and this one WAS disagreeing — it also
    conflated store_type ("store" vs "branch", i.e. which kind of physical
    location) with scope ("hq" vs "store", i.e. which level of admin
    access), which are different axes entirely. A branch admin would get
    scope="branch" here, which nothing downstream consistently treats as
    equivalent to "store".

    Fix: trust admin["scope"] directly — it's the single source of truth
    written at creation time. Fall back to the old store_id-based inference
    ONLY for legacy admin records created before the scope field existed,
    so old accounts don't break, but every new admin uses the authoritative
    field.
    """
    stored_scope = admin.get("scope")
    if stored_scope in ("hq", "store"):
        scope = stored_scope
    else:
        # Legacy fallback — pre-migration admin record with no scope field.
        scope = "hq" if not admin.get("store_id") else "store"

    return {
        "tenant_id":  admin.get("tenant_id")  or None,
        "store_id":   admin.get("store_id")   or None,
        "store_name": admin.get("store_name") or None,
        "store_type": admin.get("store_type") or None,   # "store" | "branch" | None — location kind, NOT scope
        "scope":      scope,
    }


# ─── 1. Set Password ──────────────────────────────────────────────────────────

class SetPasswordRequest(BaseModel):
    token:        str
    new_password: str


@router.post("/set-password")
async def set_password(req: SetPasswordRequest):
    try:
        payload = decode_token(req.token)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    if payload.get("type") != "password_setup":
        raise HTTPException(status_code=400, detail="Invalid token type")

    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Invalid token payload")

    admin = await admins_collection.find_one({"email": email})
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")

    hashed = hash_password(req.new_password)
    await admins_collection.update_one(
        {"email": email},
        {"$set": {"hashed_password": hashed, "status": "ACTIVE", "password_set": True, "updated_at": datetime.utcnow()}},
    )

    managed: List[str] = admin.get("managedDepartments", [admin["department"]] if admin.get("department") else [])
    redirect_info = get_redirect_for_departments(managed)
    store = _store_info(admin)
    access_token = create_access_token(
        str(admin["_id"]),
        admin.get("department", ""),
        role="ADMIN",
        extra={
            "tenant_id":  store["tenant_id"],
            "store_id":   store["store_id"],
            "store_name": store["store_name"],
            "store_type": store["store_type"],
            "scope":      store["scope"],
        },
    )

    return {
        "message":    "Password set successfully.",
        "access_token": access_token,
        "role":       "ADMIN",
        "email":      email,
        "name":       admin.get("name", ""),
        "account_type": admin.get("account_type", "department_retailer"),
        **store,          # ← store_id, store_name, store_type, scope
        **redirect_info,
    }


# ─── 2. Admin Login ───────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email:    str
    password: str


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    admin = await admins_collection.find_one({"email": req.email})
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if admin.get("status") not in ("ACTIVE", "Active"):
        raise HTTPException(status_code=403, detail="Admin is not active")

    hashed = admin.get("hashed_password")
    if not hashed or not verify_password(req.password, hashed):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    store = _store_info(admin)

    if not store["tenant_id"]:
        raise HTTPException(
            status_code=403,
            detail="Admin has no tenant assigned. Contact your Super Admin."
        )

    # ── JWT now carries store context ─────────────────────────────────────────
    token = create_access_token(
        str(admin["_id"]),
        admin.get("department", ""),
        role="ADMIN",
        extra={
            "tenant_id":  store["tenant_id"],
            "store_id":   store["store_id"],
            "store_name": store["store_name"],
            "store_type": store["store_type"],
            "scope":      store["scope"],
        }
    )

    managed: List[str] = admin.get("managedDepartments", [admin["department"]] if admin.get("department") else [])
    redirect_info = get_redirect_for_departments(managed)

    await admins_collection.update_one({"_id": admin["_id"]}, {"$set": {"last_login": datetime.utcnow()}})

    return {
        "access_token": token,
        "role":         "ADMIN",
        "department":   admin.get("department"),
        "account_type": admin.get("account_type", "department_retailer"),
        "name":         admin.get("name", ""),
        **store,          # ← store_id, store_name, store_type, scope
        **redirect_info,
    }


# ─── 3. /admin/me ─────────────────────────────────────────────────────────────
@router.get("/me")
async def get_admin_me(authorization: str = Header(None)):
    """
    Returns current admin's profile including updated managedDepartments.
    Used by DepartmentSelector to get fresh dept list after SuperAdmin edits.
    """
    from fastapi import Header
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization token missing")

    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
        user_id = payload.get("sub")
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

    admin = await admins_collection.find_one({"_id": ObjectId(user_id)})
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")

    return {
        "id":                 str(admin["_id"]),
        "name":               admin.get("name", ""),
        "email":              admin.get("email", ""),
        "department":         admin.get("department"),
        "managedDepartments": admin.get("managedDepartments", [admin.get("department")] if admin.get("department") else []),
        "permissions":        admin.get("permissions", []),
        "store_id":           admin.get("store_id"),
        "store_name":         admin.get("store_name"),
        "store_type":         admin.get("store_type"),
        "scope":              _store_info(admin)["scope"],
        "account_type":       admin.get("account_type", "department_retailer"),
    }

@router.get("/superadmin/me")
async def get_superadmin_me(current_admin: CurrentAdmin = Depends(get_current_superadmin)):
    return {
        "id":    str(current_admin["_id"]),
        "name":  current_admin["name"],
        "email": current_admin["email"],
        "role":  "super_admin",
    }


# ─── 4. Forgot Password ───────────────────────────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    user = await admins_collection.find_one({"email": req.email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    department = user.get("department")
    if department == "Administrator":
        await admins_collection.update_one(
            {"email": req.email},
            {"$set": {"reset_requested": True, "reset_approved": False, "reset_requested_at": datetime.utcnow()}},
        )
        return {"message": "Request sent to Super Admin for approval"}

    token = create_reset_token(str(user["_id"]))
    await admins_collection.update_one({"_id": user["_id"]}, {"$set": {"reset_token": token}})

    reset_link = f"{settings.frontend_base_url}/reset-password?token={token}"
    try:
        await send_reset_password_email(email=req.email, name=user.get("name", "User"), link=reset_link)
    except Exception as e:
        print("❌ EMAIL ERROR:", str(e))

    print("RESET LINK:", reset_link)
    return {"message": "Password reset link sent to email"}


# ─── 5. Reset Password ────────────────────────────────────────────────────────

class ResetPasswordRequest(BaseModel):
    token:        str
    new_password: str


@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest):
    try:
        payload = decode_reset_token(req.token)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    if payload.get("type") != "password_reset":
        raise HTTPException(status_code=400, detail="Invalid token")

    user_id = payload.get("sub")
    user    = await admins_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.get("reset_token") != req.token:
        raise HTTPException(status_code=403, detail="Token already used or invalid")

    if user.get("department") == "Administrator":
        if not user.get("reset_approved"):
            raise HTTPException(status_code=403, detail="Waiting for approval")

    hashed = hash_password(req.new_password)
    await admins_collection.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set":   {"hashed_password": hashed, "updated_at": datetime.utcnow()},
            "$unset": {"reset_token": "", "reset_requested": "", "reset_approved": "", "reset_requested_at": ""},
        },
    )
    return {"message": "Password reset successful"}
