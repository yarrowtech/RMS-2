from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from ..auth import decode_token

router = APIRouter(prefix="/admin", tags=["admin"])

security = HTTPBearer()

def get_current_admin_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = decode_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if payload.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Not an admin")
    return payload

from ..db import admins_collection, db
from .deps import get_tenant
from ..utils import hash_password, verify_password
from bson import ObjectId

@router.get("/me")
async def me(payload = Depends(get_current_admin_token)):
    admin_id = payload.get("sub")

    # fetch admin details from database
    admin = await admins_collection.find_one({"_id": ObjectId(admin_id)})

    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")

    return {
        "admin_id": str(admin["_id"]),
        "name": admin.get("name"),
        "email": admin.get("email"),
        "role": payload.get("role"),
        "department": admin.get("department"),
    }


@router.get("/dashboard")
async def dashboard(payload = Depends(get_current_admin_token)):
    department = payload.get("department")
    return {"msg": f"Welcome to {department} dashboard", "department": department}
# Role-aware account and organisation settings.  These routes deliberately use
# the live tenant context, never client-supplied tenant or role values.
tenant_admin_settings_collection = db["tenant_admin_settings"]

class ProfileSettingsUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: Optional[str] = Field(default="", max_length=40)
    city: Optional[str] = Field(default="", max_length=100)
    notification_email: bool = True
    notification_whatsapp: bool = False

class PasswordSettingsUpdate(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)

class OrganisationSettingsUpdate(BaseModel):
    legal_name: str = Field(default="", max_length=180)
    gstin: str = Field(default="", max_length=30)
    address: str = Field(default="", max_length=600)
    financial_year_start_month: int = Field(default=4, ge=1, le=12)
    currency: str = Field(default="INR", min_length=3, max_length=3)
    timezone: str = Field(default="Asia/Kolkata", max_length=80)
    po_prefix: str = Field(default="PO", max_length=20)
    grn_prefix: str = Field(default="GRN", max_length=20)
    invoice_prefix: str = Field(default="PI", max_length=20)


def _serialise_settings(value: dict) -> dict:
    return {
        "legal_name": value.get("legal_name", ""), "gstin": value.get("gstin", ""),
        "address": value.get("address", ""), "financial_year_start_month": value.get("financial_year_start_month", 4),
        "currency": value.get("currency", "INR"), "timezone": value.get("timezone", "Asia/Kolkata"),
        "po_prefix": value.get("po_prefix", "PO"), "grn_prefix": value.get("grn_prefix", "GRN"),
        "invoice_prefix": value.get("invoice_prefix", "PI"),
    }

@router.get("/settings")
async def get_admin_settings(ctx: dict = Depends(get_tenant)):
    admin = await admins_collection.find_one({"_id": ObjectId(ctx["admin_id"]), "tenant_id": ctx["tenant_id"]})
    if not admin:
        raise HTTPException(status_code=404, detail="Admin account not found")
    org = await tenant_admin_settings_collection.find_one({"tenant_id": ctx["tenant_id"]}) or {}
    return {
        "profile": {"name": admin.get("name", ""), "email": admin.get("email", ""), "phone": admin.get("phone", ""), "city": admin.get("city", ""), "notification_email": admin.get("notification_email", True), "notification_whatsapp": admin.get("notification_whatsapp", False)},
        "access": {"department": ctx.get("department", ""), "scope": ctx.get("scope", "hq"), "store_name": ctx.get("store_name"), "managed_departments": admin.get("managedDepartments", []), "permissions": admin.get("permissions", [])},
        "organisation": _serialise_settings(org),
        "can_manage_organisation": ctx.get("scope") == "hq",
    }

@router.patch("/settings/profile")
async def update_admin_profile(payload: ProfileSettingsUpdate, ctx: dict = Depends(get_tenant)):
    await admins_collection.update_one({"_id": ObjectId(ctx["admin_id"]), "tenant_id": ctx["tenant_id"]}, {"$set": {"name": payload.name.strip(), "phone": payload.phone.strip(), "city": payload.city.strip(), "notification_email": payload.notification_email, "notification_whatsapp": payload.notification_whatsapp, "updated_at": datetime.utcnow()}})
    return {"message": "Profile settings saved"}

@router.patch("/settings/password")
async def update_admin_password(payload: PasswordSettingsUpdate, ctx: dict = Depends(get_tenant)):
    admin = await admins_collection.find_one({"_id": ObjectId(ctx["admin_id"]), "tenant_id": ctx["tenant_id"]})
    if not admin or not verify_password(payload.current_password, admin.get("hashed_password", "")):
        raise HTTPException(status_code=400, detail="Your current password is incorrect")
    await admins_collection.update_one({"_id": admin["_id"]}, {"$set": {"hashed_password": hash_password(payload.new_password), "updated_at": datetime.utcnow()}})
    return {"message": "Password updated"}

@router.put("/settings/organisation")
async def update_organisation_settings(payload: OrganisationSettingsUpdate, ctx: dict = Depends(get_tenant)):
    if ctx.get("scope") != "hq":
        raise HTTPException(status_code=403, detail="Only an HQ admin can change organisation settings")
    document = {**payload.model_dump(), "tenant_id": ctx["tenant_id"], "updated_at": datetime.utcnow(), "updated_by": ctx["admin_id"]}
    await tenant_admin_settings_collection.update_one({"tenant_id": ctx["tenant_id"]}, {"$set": document, "$setOnInsert": {"created_at": datetime.utcnow()}}, upsert=True)
    return {"message": "Organisation settings saved", "organisation": _serialise_settings(document)}