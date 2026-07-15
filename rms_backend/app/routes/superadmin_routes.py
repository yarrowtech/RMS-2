

from fastapi import APIRouter, HTTPException, Header, status, Depends, Query
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from bson import ObjectId
from fastapi import Request

from ..routes.auth_routes import get_current_superadmin
from ..models import AdminCreate
from ..db import admins_collection
from ..auth import create_password_setup_token, create_reset_token
#from ..email_utils import send_password_setup_email, send_reset_password_email
from ..email_utils import (
    send_password_setup_email,
    send_reset_password_email,
    send_multi_department_setup_email,
    send_department_added_email,
    send_store_created_email,
)
from ..utils import verify_password, create_access_token
from app.config import settings
from .deps import get_hq_tenant

router = APIRouter(prefix="/superadmin", tags=["SuperAdmin"])

CurrentAdmin = Dict[str, Any]


# ============================================================
# 1. LOGIN — Super Admin
# ============================================================

class SuperAdminLogin(BaseModel):
    email: EmailStr
    password: str


@router.post("/login")
async def superadmin_login(payload: SuperAdminLogin):
    admin = await admins_collection.find_one(
        {"email": payload.email, "department": "SUPERADMIN"}
    )
    if not admin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Super admin not found")

    if not verify_password(payload.password, admin["hashed_password"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(
        {"sub": str(admin["_id"]), "role": "super_admin"},
        expires_delta=timedelta(days=1),
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": "super_admin",
        "user": {"id": str(admin["_id"]), "name": admin["name"], "email": admin["email"]},
    }


@router.options("/login")
async def options_login(request: Request):
    return {"message": "OK"}


# ============================================================
# 2. GET ALL ADMINS
# ============================================================


@router.get("/admins")
async def get_all_admins(current_admin: CurrentAdmin = Depends(get_current_superadmin)):
    admins_cursor = admins_collection.find({"department": {"$ne": "SUPERADMIN"}})
    admins_list: List[Dict[str, Any]] = []
    async for admin in admins_cursor:
        created_at = admin.get("created_at")
        admins_list.append({
            "id":                 str(admin["_id"]),
            "name":               admin["name"],
            "email":              admin["email"],
            "department":         admin.get("department"),
            "managedDepartments": admin.get(
                "managedDepartments",
                [admin["department"]] if admin.get("department") else [],
            ),
            "permissions":        admin.get("permissions", []),
            "status":             admin.get("status", "PENDING"),
            "password_set":       admin.get("password_set", False),
            "createdDate":        created_at.isoformat()[:10] if isinstance(created_at, datetime) else None,
            "managedUsersCount":  admin.get("managedUsersCount", 0),
            "last_login":         admin.get("last_login"),
            "phone":              admin.get("phone"),
            # ── Store fields ──────────────────────────────
            "tenant_id":  admin.get("tenant_id", ""),
            "store_id":           admin.get("store_id", ""),
            "store_name":         admin.get("store_name", ""),
            "store_type":         admin.get("store_type", ""),
        })
    return {"count": len(admins_list), "admins": admins_list}
 


# ============================================================
# 3. CREATE ADMIN  ← FIXED
# ============================================================

'''
@router.post("/admins/create", status_code=201)
async def create_admin(
    payload: AdminCreate,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    # Check duplicate email
    existing = await admins_collection.find_one({"email": payload.email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin with this email already exists",
        )
 
    # Build managedDepartments — always includes primary dept
    managed_depts = payload.managedDepartments or []
    if payload.department and payload.department not in managed_depts:
        managed_depts = [payload.department] + managed_depts
 
    primary_dept = managed_depts[0] if managed_depts else payload.department
 
    admin_doc: Dict[str, Any] = {
        "name":               payload.name,
        "email":              payload.email,
        "department":         primary_dept,
        "managedDepartments": managed_depts,
        "permissions":        payload.permissions,
        "phone":              payload.phone,
        "hashed_password":    None,
        "status":             "PENDING",
        "password_set":       False,
        "created_at":         datetime.utcnow(),
        "created_by":         str(current_admin["_id"]),
    }
 
    res = await admins_collection.insert_one(admin_doc)
    admin_id = str(res.inserted_id)
 
    # Generate password setup link
    token = create_password_setup_token(payload.email, primary_dept)
    setup_link = f"{settings.frontend_base_url}/admin/setup-password?token={token}"
 
    # ── Send correct email based on department count ──────────────────────────
    try:
        if len(managed_depts) > 1:
            # Admin manages multiple departments — list them all
            await send_multi_department_setup_email(
                payload.email,
                payload.name,
                managed_depts,
                setup_link,
            )
        else:
            # Single department — department-colored email
            await send_password_setup_email(
                payload.email,
                payload.name,
                primary_dept,
                setup_link,
            )
    except Exception as e:
        print(f"⚠️ Email failed for new admin {payload.email}: {e}")
        # Non-fatal — admin is still created
 
    return {
        "message":            "Admin created successfully. Setup email sent.",
        "admin_id":           admin_id,
        "managedDepartments": managed_depts,
        "permissions":        payload.permissions,
    }
 '''

@router.post("/admins/create", status_code=201)
async def create_admin(
    payload: AdminCreate,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    existing = await admins_collection.find_one({"email": payload.email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin with this email already exists",
        )
 
    managed_depts = payload.managedDepartments or []
    if payload.department and payload.department not in managed_depts:
        managed_depts = [payload.department] + managed_depts
 
    primary_dept = managed_depts[0] if managed_depts else payload.department
 
    # ── Resolve store info if store_id provided ───────────────────────────────
    store_id   = getattr(payload, "store_id",   None) or None
    store_name = ""
    store_type = ""
 
    if store_id:
        try:
            from bson import ObjectId as ObjId
            store_doc = await stores_collection.find_one({"_id": ObjId(store_id)})
            if store_doc:
                store_name = store_doc.get("name", "")
                store_type = store_doc.get("type", "store")
            else:
                store_id = None
        except Exception as e:
            print(f"⚠️ Invalid store_id '{store_id}': {e}")
            store_id = None  # clear bad store_id, continue with admin creation
 
    admin_doc: Dict[str, Any] = {
        "name":               payload.name,
        "email":              payload.email,
        "department":         primary_dept,
        "managedDepartments": managed_depts,
        "permissions":        payload.permissions,
        "phone":              payload.phone,
        "tenant_id":          payload.tenant_id,        
        "store_id":           payload.store_id or None, 
        "store_name":         payload.store_name or None, 
        "store_type":         payload.store_type or None, 
        "scope":              "hq" if not payload.store_id else "store", # ← ADD
        "hashed_password":    None,
        "status":             "PENDING",
        "password_set":       False,
        "created_at":         datetime.utcnow(),
        "created_by":         str(current_admin["_id"]),
    }
 
    res      = await admins_collection.insert_one(admin_doc)
    admin_id = str(res.inserted_id)
 
    token      = create_password_setup_token(payload.email, primary_dept)
    setup_link = f"{settings.frontend_base_url}/admin/setup-password?token={token}"
 
    try:
        if len(managed_depts) > 1:
            await send_multi_department_setup_email(
                payload.email, payload.name, managed_depts, setup_link,
            )
        else:
            await send_password_setup_email(
                payload.email, payload.name, primary_dept, setup_link,
            )
    except Exception as e:
        import traceback
        print(f"⚠️ Email failed for new admin {payload.email}: {e}")
        print(traceback.format_exc())   # ← shows exact line that failed
 
    return {
        "message":            "Admin created successfully. Setup email sent.",
        "admin_id":           admin_id,
        "managedDepartments": managed_depts,
        "permissions":        payload.permissions,
        "store_id":           store_id,
        "store_name":         store_name,
    }
 

# ============================================================
# 4. GET SINGLE ADMIN
# ============================================================

@router.get("/admins/{admin_id}")
async def get_admin(
    admin_id: str,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    admin = await admins_collection.find_one({"_id": ObjectId(admin_id)})
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    return {
        "id": str(admin["_id"]),
        "name": admin["name"],
        "email": admin["email"],
        "department": admin.get("department"),
        "managedDepartments": admin.get("managedDepartments", []),
        "permissions": admin.get("permissions", []),
        "status": admin.get("status"),
        "password_set": admin.get("password_set", False),
        "phone": admin.get("phone"),
        "created_at": admin.get("created_at"),
        "last_login": admin.get("last_login"),
    }


# ============================================================
# 5. DELETE ADMIN
# ============================================================

@router.delete("/admins/{admin_id}")
async def delete_admin(
    admin_id: str,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    try:
        result = await admins_collection.delete_one({"_id": ObjectId(admin_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Admin not found")
        return {"message": "Admin deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# 6. UPDATE ADMIN PERMISSIONS
# ============================================================

class UpdatePermissionsPayload(BaseModel):
    permissions: List[str]


@router.patch("/admins/{admin_id}/permissions")
async def update_admin_permissions(
    admin_id: str,
    payload: UpdatePermissionsPayload,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    result = await admins_collection.update_one(
        {"_id": ObjectId(admin_id)},
        {"$set": {"permissions": payload.permissions, "updated_at": datetime.utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Admin not found")
    return {"message": "Permissions updated", "permissions": payload.permissions}


# ============================================================
# 7. SUSPEND / ACTIVATE ADMIN
# ============================================================

class UpdateStatusPayload(BaseModel):
    status: str  # "Active" | "Suspended"


@router.patch("/admins/{admin_id}/status")
async def update_admin_status(
    admin_id: str,
    payload: UpdateStatusPayload,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    if payload.status not in ("Active", "Suspended"):
        raise HTTPException(status_code=400, detail="status must be 'Active' or 'Suspended'")

    result = await admins_collection.update_one(
        {"_id": ObjectId(admin_id)},
        {"$set": {"status": payload.status, "updated_at": datetime.utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Admin not found")
    return {"message": f"Admin status set to {payload.status}"}


# ============================================================
# 8. UPDATE ADMIN DEPARTMENTS
# ============================================================

class UpdateDepartmentsPayload(BaseModel):
    managedDepartments: List[str]
    department: Optional[str] = None

@router.patch("/admins/{admin_id}/departments")
async def update_admin_departments(
    admin_id: str,
    payload: UpdateDepartmentsPayload,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    primary = payload.department or (
        payload.managedDepartments[0] if payload.managedDepartments else None
    )
 
    # Fetch admin BEFORE update so we can compare old vs new departments
    admin_before = await admins_collection.find_one({"_id": ObjectId(admin_id)})
    if not admin_before:
        raise HTTPException(status_code=404, detail="Admin not found")
 
    old_depts = set(admin_before.get("managedDepartments", []))
    new_depts = set(payload.managedDepartments)
    added_depts = list(new_depts - old_depts)  # departments that are newly added
 
    result = await admins_collection.update_one(
        {"_id": ObjectId(admin_id)},
        {"$set": {
            "managedDepartments": payload.managedDepartments,
            "department":         primary,
            "updated_at":         datetime.utcnow(),
        }},
    )
 
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Admin not found")
 
    # ── Send email only if new departments were added ─────────────────────────
    if added_depts:
        dashboard_link = f"{settings.frontend_base_url}/dashboard/select"
        try:
            # Notify about the first newly added department
            # (if multiple added at once, mention the first one in subject)
            new_dept_label = added_depts[0] if len(added_depts) == 1 else f"{len(added_depts)} departments"
            await send_department_added_email(
                admin_before["email"],
                admin_before.get("name", "Admin"),
                new_dept_label,
                payload.managedDepartments,   # full updated list
                dashboard_link,
            )
        except Exception as e:
            print(f"⚠️ Department email failed for {admin_before['email']}: {e}")
 
    return {
        "message":            "Departments updated successfully",
        "managedDepartments": payload.managedDepartments,
        "newly_added":        added_depts,
    }
 

# ============================================================
# 9. RESEND SETUP EMAIL
# ============================================================

@router.post("/admins/{admin_id}/resend-setup")
async def resend_setup_email(
    admin_id: str,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    admin = await admins_collection.find_one({"_id": ObjectId(admin_id)})
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    if admin.get("password_set"):
        raise HTTPException(status_code=400, detail="Admin has already set their password")

    token = create_password_setup_token(admin["email"], admin.get("department", ""))
    setup_link = f"{settings.frontend_base_url}/admin/setup-password?token={token}"

    try:
        await send_password_setup_email(admin["email"], admin["name"], admin.get("department", ""), setup_link)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

    return {"message": f"Setup email re-sent to {admin['email']}"}


# ============================================================
# 10. GET RESET REQUESTS
# ============================================================

@router.get("/reset-requests")
async def get_reset_requests(current_admin: CurrentAdmin = Depends(get_current_superadmin)):
    cursor = admins_collection.find({
        "reset_requested": True,
        "reset_approved": {"$ne": True},
    })
    requests: List[Dict[str, Any]] = []
    async for user in cursor:
        requested_at = user.get("reset_requested_at")
        requests.append({
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "department": user.get("department"),
            "requested_at": requested_at.isoformat() if isinstance(requested_at, datetime) else None,
        })
    return {"count": len(requests), "requests": requests}


# ============================================================
# 11. APPROVE RESET
# ============================================================

@router.post("/approve-reset/{admin_id}")
async def approve_reset(
    admin_id: str,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    user = await admins_collection.find_one({"_id": ObjectId(admin_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.get("reset_requested"):
        raise HTTPException(status_code=400, detail="No pending reset request for this admin")

    token = create_reset_token(str(user["_id"]))

    await admins_collection.update_one(
        {"_id": ObjectId(admin_id)},
        {"$set": {"reset_approved": True, "reset_token": token}},
    )

    reset_link = f"{settings.frontend_base_url}/reset-password?token={token}"

    try:
        await send_reset_password_email(
            email=user["email"],
            name=user.get("name", "Admin"),
            link=reset_link,
        )
    except Exception as e:
        print(f"EMAIL ERROR (approve-reset): {e}")

    return {
        "message": "Reset approved. Email sent to admin with reset link.",
        "reset_link": reset_link,
    }


# ============================================================
# 12. REJECT RESET
# ============================================================

@router.post("/reject-reset/{admin_id}")
async def reject_reset(
    admin_id: str,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    result = await admins_collection.update_one(
        {"_id": ObjectId(admin_id)},
        {"$unset": {
            "reset_requested": "",
            "reset_approved": "",
            "reset_requested_at": "",
            "reset_token": "",
        }},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Admin not found")
    return {"message": "Reset request rejected. Admin must re-submit to try again."}


# ============================================================
# 13. SECURITY POLICIES
# ============================================================

class SecurityPoliciesPayload(BaseModel):
    minPasswordLength: int = 8
    requireUppercase: bool = True
    requireNumbers: bool = True
    requireSpecialChars: bool = False
    sessionTimeoutMinutes: int = 60
    maxLoginAttempts: int = 5
    enforce2FA: bool = False
    ipWhitelist: Optional[str] = ""


@router.get("/security/policies")
async def get_security_policies(current_admin: CurrentAdmin = Depends(get_current_superadmin)):
    from ..db import settings_collection
    doc = await settings_collection.find_one({"type": "security_policies"})
    if not doc:
        return {
            "minPasswordLength": 8, "requireUppercase": True,
            "requireNumbers": True, "requireSpecialChars": False,
            "sessionTimeoutMinutes": 60, "maxLoginAttempts": 5,
            "enforce2FA": False, "ipWhitelist": "",
        }
    doc.pop("_id", None)
    doc.pop("type", None)
    return doc


@router.put("/security/policies")
async def update_security_policies(
    payload: SecurityPoliciesPayload,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    from ..db import settings_collection
    await settings_collection.update_one(
        {"type": "security_policies"},
        {"$set": {**payload.dict(), "updated_at": datetime.utcnow(), "updated_by": str(current_admin["_id"])}},
        upsert=True,
    )
    return {"message": "Security policies updated successfully"}


# ============================================================
# 14. AUDIT LOGS
# ============================================================

@router.get("/audit-logs")
async def get_audit_logs(
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
    limit: int = Query(50, ge=1, le=500),
    skip: int = Query(0, ge=0),
    actor: Optional[str] = None,
    action_type: Optional[str] = None,
):
    from ..db import audit_logs_collection
    query: Dict[str, Any] = {}
    if actor:
        query["actor"] = {"$regex": actor, "$options": "i"}
    if action_type:
        query["type"] = action_type

    cursor = audit_logs_collection.find(query).sort("created_at", -1).skip(skip).limit(limit)
    logs: List[Dict[str, Any]] = []
    async for log in cursor:
        created = log.get("created_at")
        logs.append({
            "id": str(log["_id"]),
            "actor": log.get("actor"),
            "action": log.get("action"),
            "type": log.get("type"),
            "ip": log.get("ip"),
            "time": created.isoformat() if isinstance(created, datetime) else None,
        })
    total = await audit_logs_collection.count_documents(query)
    return {"total": total, "logs": logs}


# ============================================================
# 15. FEATURE FLAGS
# ============================================================

class FeatureFlagsPayload(BaseModel):
    flags: Dict[str, Any]


@router.get("/settings/feature-flags")
async def get_feature_flags(current_admin: CurrentAdmin = Depends(get_current_superadmin)):
    from ..db import settings_collection
    doc = await settings_collection.find_one({"type": "feature_flags"})
    defaults: Dict[str, Any] = {
        "chat": True, "fileUploads": True, "analytics": True,
        "notifications": True, "auditLogs": True, "apiAccess": False,
    }
    if not doc:
        return defaults
    doc.pop("_id", None); doc.pop("type", None)
    doc.pop("updated_at", None); doc.pop("updated_by", None)
    return {**defaults, **doc}


@router.put("/settings/feature-flags")
async def update_feature_flags(
    payload: FeatureFlagsPayload,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    from ..db import settings_collection
    await settings_collection.update_one(
        {"type": "feature_flags"},
        {"$set": {**payload.flags, "updated_at": datetime.utcnow(), "updated_by": str(current_admin["_id"])}},
        upsert=True,
    )
    return {"message": "Feature flags updated", "flags": payload.flags}


# ============================================================
# 16. BRANDING
# ============================================================

class BrandingPayload(BaseModel):
    appName: Optional[str] = None
    primaryColor: Optional[str] = None
    tagline: Optional[str] = None
    logoUrl: Optional[str] = None
    faviconUrl: Optional[str] = None


@router.get("/settings/branding")
async def get_branding(current_admin: CurrentAdmin = Depends(get_current_superadmin)):
    from ..db import settings_collection
    doc = await settings_collection.find_one({"type": "branding"})
    if not doc:
        return {"appName": "AdminPanel", "primaryColor": "#f59e0b", "tagline": ""}
    doc.pop("_id", None); doc.pop("type", None)
    return doc


@router.put("/settings/branding")
async def update_branding(
    payload: BrandingPayload,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    from ..db import settings_collection
    update_fields: Dict[str, Any] = {k: v for k, v in payload.dict().items() if v is not None}
    update_fields["updated_at"] = datetime.utcnow()
    update_fields["updated_by"] = str(current_admin["_id"])
    await settings_collection.update_one({"type": "branding"}, {"$set": update_fields}, upsert=True)
    return {"message": "Branding updated successfully"}


# ============================================================
# 17. MAINTENANCE MODE
# ============================================================

class MaintenanceModePayload(BaseModel):
    enabled: bool
    message: Optional[str] = "We are currently performing scheduled maintenance."


@router.get("/settings/maintenance")
async def get_maintenance_mode(current_admin: CurrentAdmin = Depends(get_current_superadmin)):
    from ..db import settings_collection
    doc = await settings_collection.find_one({"type": "maintenance"})
    if not doc:
        return {"enabled": False, "message": ""}
    return {"enabled": doc.get("enabled", False), "message": doc.get("message", "")}


@router.put("/settings/maintenance")
async def update_maintenance_mode(
    payload: MaintenanceModePayload,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    from ..db import settings_collection
    await settings_collection.update_one(
        {"type": "maintenance"},
        {"$set": {"enabled": payload.enabled, "message": payload.message, "updated_at": datetime.utcnow(), "updated_by": str(current_admin["_id"])}},
        upsert=True,
    )
    return {"message": f"Maintenance mode {'enabled' if payload.enabled else 'disabled'}"}


# ============================================================
# 18. SYSTEM ANNOUNCEMENTS
# ============================================================

class AnnouncementPayload(BaseModel):
    text: str
    active: bool = True


@router.get("/announcements")
async def get_announcements(current_admin: CurrentAdmin = Depends(get_current_superadmin)):
    from ..db import announcements_collection
    cursor = announcements_collection.find({}).sort("created_at", -1)
    items: List[Dict[str, Any]] = []
    async for a in cursor:
        created = a.get("created_at")
        items.append({"id": str(a["_id"]), "text": a["text"], "active": a.get("active", True), "created": created.isoformat() if isinstance(created, datetime) else None})
    return {"announcements": items}


@router.post("/announcements", status_code=201)
async def create_announcement(
    payload: AnnouncementPayload,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    from ..db import announcements_collection
    res = await announcements_collection.insert_one({"text": payload.text, "active": payload.active, "created_at": datetime.utcnow(), "created_by": str(current_admin["_id"])})
    return {"message": "Announcement published", "id": str(res.inserted_id)}


@router.delete("/announcements/{announcement_id}")
async def delete_announcement(
    announcement_id: str,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    from ..db import announcements_collection
    result = await announcements_collection.delete_one({"_id": ObjectId(announcement_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return {"message": "Announcement deleted"}


# ============================================================
# 19. API KEY MANAGEMENT
# ============================================================

class ApiKeyCreatePayload(BaseModel):
    name: str


@router.get("/api-keys")
async def list_api_keys(current_admin: CurrentAdmin = Depends(get_current_superadmin)):
    from ..db import api_keys_collection
    cursor = api_keys_collection.find({}).sort("created_at", -1)
    keys: List[Dict[str, Any]] = []
    async for k in cursor:
        raw: str = k.get("key", "")
        masked = raw[:10] + "****" + raw[-4:] if len(raw) > 14 else raw
        last_used = k.get("last_used")
        keys.append({"id": str(k["_id"]), "name": k["name"], "key": masked, "active": k.get("active", True), "created": k.get("created_at").isoformat()[:10] if k.get("created_at") else None, "last_used": last_used.isoformat() if isinstance(last_used, datetime) else last_used})
    return {"keys": keys}


@router.post("/api-keys", status_code=201)
async def generate_api_key(
    payload: ApiKeyCreatePayload,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    import secrets as sec
    from ..db import api_keys_collection
    key = "sk-prod-" + sec.token_hex(16)
    res = await api_keys_collection.insert_one({"name": payload.name, "key": key, "active": True, "created_at": datetime.utcnow(), "created_by": str(current_admin["_id"]), "last_used": None})
    return {"message": "API key generated", "id": str(res.inserted_id), "key": key}


@router.delete("/api-keys/{key_id}")
async def revoke_api_key(
    key_id: str,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    from ..db import api_keys_collection
    result = await api_keys_collection.update_one({"_id": ObjectId(key_id)}, {"$set": {"active": False, "revoked_at": datetime.utcnow()}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="API key not found")
    return {"message": "API key revoked"}


# ============================================================
# 20. INFRASTRUCTURE STATS
# ============================================================

@router.get("/infrastructure/stats")
async def get_infrastructure_stats(current_admin: CurrentAdmin = Depends(get_current_superadmin)):
    total_admins = await admins_collection.count_documents({"department": {"$ne": "SUPERADMIN"}})
    active_admins = await admins_collection.count_documents({"status": "Active", "department": {"$ne": "SUPERADMIN"}})
    return {"uptime_percent": 99.9, "storage_used_gb": 4.2, "storage_limit_gb": 50, "active_sessions": active_admins, "cache_hit_rate_percent": 94, "total_admins": total_admins, "database": "MongoDB Atlas", "status": "healthy"}


@router.post("/infrastructure/clear-cache")
async def clear_cache(current_admin: CurrentAdmin = Depends(get_current_superadmin)):
    return {"message": "Application cache cleared successfully"}


# ============================================================
# 21. WEBHOOK MONITORING
# ============================================================

@router.get("/webhooks")
async def list_webhooks(current_admin: CurrentAdmin = Depends(get_current_superadmin)):
    from ..db import webhooks_collection
    cursor = webhooks_collection.find({}).sort("created_at", -1)
    hooks: List[Dict[str, Any]] = []
    async for h in cursor:
        hooks.append({"id": str(h["_id"]), "url": h["url"], "event": h["event"], "status": h.get("status", "active"), "last_ping": h.get("last_ping"), "success_rate": h.get("success_rate", 100)})
    return {"webhooks": hooks}


@router.post("/webhooks/{webhook_id}/retry")
async def retry_webhook(
    webhook_id: str,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    from ..db import webhooks_collection
    hook = await webhooks_collection.find_one({"_id": ObjectId(webhook_id)})
    if not hook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    await webhooks_collection.update_one({"_id": ObjectId(webhook_id)}, {"$set": {"last_ping": datetime.utcnow().isoformat(), "status": "active"}})
    return {"message": "Webhook retry triggered"}


# ============================================================
# 22. CONTENT PAGES
# ============================================================

class ContentPagePayload(BaseModel):
    content: str


@router.get("/content/pages")
async def list_content_pages(current_admin: CurrentAdmin = Depends(get_current_superadmin)):
    from ..db import content_pages_collection
    cursor = content_pages_collection.find({})
    pages: List[Dict[str, Any]] = []
    async for p in cursor:
        updated = p.get("updated_at")
        pages.append({"id": str(p["_id"]), "name": p["name"], "slug": p["slug"], "content": p.get("content", ""), "last_updated": updated.isoformat() if isinstance(updated, datetime) else None})
    return {"pages": pages}


@router.put("/content/pages/{page_id}")
async def update_content_page(
    page_id: str,
    payload: ContentPagePayload,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    from ..db import content_pages_collection
    result = await content_pages_collection.update_one(
        {"_id": ObjectId(page_id)},
        {"$set": {"content": payload.content, "updated_at": datetime.utcnow(), "updated_by": str(current_admin["_id"])}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Page not found")
    return {"message": "Page updated successfully"}


# ============================================================
# 23. MODERATION
# ============================================================

@router.get("/moderation/flagged")
async def get_flagged_content(current_admin: CurrentAdmin = Depends(get_current_superadmin)):
    from ..db import flagged_content_collection
    cursor = flagged_content_collection.find({"status": "pending"}).sort("created_at", -1)
    items: List[Dict[str, Any]] = []
    async for f in cursor:
        created = f.get("created_at")
        items.append({"id": str(f["_id"]), "user": f.get("user_id"), "reason": f.get("reason"), "content": f.get("content"), "time": created.isoformat() if isinstance(created, datetime) else None})
    return {"count": len(items), "items": items}


@router.post("/moderation/flagged/{item_id}/dismiss")
async def dismiss_flagged(item_id: str, current_admin: CurrentAdmin = Depends(get_current_superadmin)):
    from ..db import flagged_content_collection
    await flagged_content_collection.update_one({"_id": ObjectId(item_id)}, {"$set": {"status": "dismissed", "reviewed_by": str(current_admin["_id"]), "reviewed_at": datetime.utcnow()}})
    return {"message": "Flagged item dismissed"}


class BanUserPayload(BaseModel):
    reason: Optional[str] = "Violation of terms of service"


@router.post("/moderation/flagged/{item_id}/ban-user")
async def ban_user_from_flag(
    item_id: str,
    payload: BanUserPayload,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    from ..db import flagged_content_collection, users_collection
    flag = await flagged_content_collection.find_one({"_id": ObjectId(item_id)})
    if not flag:
        raise HTTPException(status_code=404, detail="Flagged item not found")
    user_id: Optional[str] = flag.get("user_id")
    if user_id:
        await users_collection.update_one({"_id": ObjectId(user_id)}, {"$set": {"banned": True, "ban_reason": payload.reason, "banned_at": datetime.utcnow()}})
    await flagged_content_collection.update_one({"_id": ObjectId(item_id)}, {"$set": {"status": "banned", "reviewed_by": str(current_admin["_id"]), "reviewed_at": datetime.utcnow()}})
    return {"message": f"User {user_id} banned and item resolved"}


# ============================================================
# 24. BILLING
# ============================================================

@router.get("/billing/invoices")
async def list_invoices(current_admin: CurrentAdmin = Depends(get_current_superadmin)):
    from ..db import invoices_collection
    cursor = invoices_collection.find({}).sort("date", -1)
    invoices: List[Dict[str, Any]] = []
    async for inv in cursor:
        date = inv.get("date")
        invoices.append({"id": str(inv["_id"]), "invoice_number": inv.get("invoice_number"), "date": date.isoformat()[:10] if isinstance(date, datetime) else None, "amount": inv.get("amount"), "currency": inv.get("currency", "USD"), "status": inv.get("status"), "plan": inv.get("plan")})
    return {"invoices": invoices}


@router.get("/billing/usage")
async def get_usage_stats(current_admin: CurrentAdmin = Depends(get_current_superadmin)):
    total_admins = await admins_collection.count_documents({"department": {"$ne": "SUPERADMIN"}})
    return {"api_calls_this_month": 84200, "api_calls_limit": 100000, "storage_used_gb": 4.2, "storage_limit_gb": 50, "active_admins": total_admins, "admin_limit": 25, "email_credits_used": 312, "email_credits_limit": 1000}


# ============================================================
# 25. IMPERSONATION
# ============================================================

@router.post("/admins/{admin_id}/impersonate")
async def impersonate_admin(
    admin_id: str,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    target = await admins_collection.find_one({"_id": ObjectId(admin_id)})
    if not target:
        raise HTTPException(status_code=404, detail="Admin not found")
    if target.get("department") == "SUPERADMIN":
        raise HTTPException(status_code=403, detail="Cannot impersonate another Super Admin")

    impersonation_token = create_access_token(
        {"sub": str(target["_id"]), "role": target.get("department", "ADMIN"), "impersonated_by": str(current_admin["_id"])},
        expires_delta=timedelta(minutes=15),
    )
    return {
        "access_token": impersonation_token,
        "token_type": "bearer",
        "expires_in_minutes": 15,
        "target_admin": {"id": str(target["_id"]), "name": target["name"], "email": target["email"]},
        "warning": "This token is valid for 15 minutes only. All actions will be logged.",
    }


# ============================================================
# 26. STORE & BRANCH MANAGEMENT
# ============================================================
# db.py — add:  stores_collection = db["stores"]

from ..db import stores_collection   # noqa: E402  (add to db.py first)


class StoreCreatePayload(BaseModel):
    name:        str
    code:        str                          # short code e.g. "NMK", "SLK"
    type:        str = "store"  
    tenant_id:   str                 # "store" | "branch"
    city:        Optional[str] = None
    address:     Optional[str] = None
    phone:       Optional[str] = None
    parent_id:   Optional[str] = None        # required if type == "branch"
    manager_id:  Optional[str] = None        # admin _id to assign as manager
    active:      bool = True


class StoreUpdatePayload(BaseModel):
    name:       Optional[str] = None
    code:       Optional[str] = None
    city:       Optional[str] = None
    address:    Optional[str] = None
    phone:      Optional[str] = None
    parent_id:  Optional[str] = None
    manager_id: Optional[str] = None
    active:     Optional[bool] = None


class AssignStorePayload(BaseModel):
    store_id: str   # ObjectId string of the store/branch


@router.get("/stores")
async def list_stores(
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
    type_filter: Optional[str] = Query(None),   # "store" | "branch"
    active_only: bool = Query(False),
):
    """
    Returns all stores and branches.
    Each store includes its branches nested under 'branches'.
    Each store/branch includes assigned admin count.
    """
    query: Dict[str, Any] = {}
    if type_filter: query["type"] = type_filter
    if active_only: query["active"] = True

    stores_list: List[Dict[str, Any]] = []
    async for s in stores_collection.find(query).sort("created_at", -1):
        store_id_str = str(s["_id"])

        # Count admins assigned to this store
        admin_count = await admins_collection.count_documents({
            "store_id": store_id_str,
            "department": {"$ne": "SUPERADMIN"},
        })

        # Resolve manager name if set
        manager_name = ""
        if s.get("manager_id"):
            mgr = await admins_collection.find_one(
                {"_id": ObjectId(s["manager_id"])},
                {"name": 1}
            )
            if mgr: manager_name = mgr.get("name", "")

        # Resolve parent store name for branches
        parent_name = ""
        if s.get("parent_id"):
            parent = await stores_collection.find_one(
                {"_id": ObjectId(s["parent_id"])},
                {"name": 1, "code": 1}
            )
            if parent: parent_name = f"{parent.get('name','')} ({parent.get('code','')})"

        created = s.get("created_at")
        stores_list.append({
            "id":           store_id_str,
            "name":         s.get("name", ""),
            "code":         s.get("code", ""),
            "type":         s.get("type", "store"),
            "city":         s.get("city", ""),
            "address":      s.get("address", ""),
            "phone":        s.get("phone", ""),
            "parent_id":    s.get("parent_id"),
            "parent_name":  parent_name,
            "manager_id":   s.get("manager_id"),
            "manager_name": manager_name,
            "active":       s.get("active", True),
            "admin_count":  admin_count,
            "created_at":   created.isoformat()[:10] if isinstance(created, datetime) else None,
        })

    # Nest branches under their parent stores
    store_map: Dict[str, Any] = {}
    branches: List[Dict[str, Any]] = []
    for s in stores_list:
        if s["type"] == "store":
            s["branches"] = []
            store_map[s["id"]] = s
        else:
            branches.append(s)

    for b in branches:
        pid = b.get("parent_id")
        if pid and pid in store_map:
            store_map[pid]["branches"].append(b)

    # Return stores (with nested branches) first, then any orphan branches
    orphan_branches = [b for b in branches if not b.get("parent_id") or b.get("parent_id") not in store_map]
    result = list(store_map.values()) + orphan_branches

    return {"count": len(result), "stores": result}

'''
@router.post("/stores", status_code=201)
async def create_store(
    payload: StoreCreatePayload,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    """Create a new store or branch."""
    # Validate type
    if payload.type not in ("store", "branch"):
        raise HTTPException(status_code=400, detail="type must be 'store' or 'branch'")

    # Branch must have a parent
    if payload.type == "branch" and not payload.parent_id:
        raise HTTPException(status_code=400, detail="branch requires a parent_id (parent store _id)")

    # Validate parent exists
    if payload.parent_id:
        parent = await stores_collection.find_one({"_id": ObjectId(payload.parent_id)})
        if not parent:
            raise HTTPException(status_code=404, detail="Parent store not found")
        if parent.get("type") != "store":
            raise HTTPException(status_code=400, detail="parent_id must point to a store, not another branch")

    # Unique code check
    existing = await stores_collection.find_one({"code": payload.code.upper().strip()})
    if existing:
        raise HTTPException(status_code=400, detail=f"Store code '{payload.code}' already exists")

    # Validate manager if provided
    manager_id = None
    if payload.manager_id:
        mgr = await admins_collection.find_one({"_id": ObjectId(payload.manager_id)})
        if not mgr:
            raise HTTPException(status_code=404, detail="Manager admin not found")
        manager_id = payload.manager_id

    doc: Dict[str, Any] = {
        "name":       payload.name.strip(),
        "code":       payload.code.upper().strip(),
        "type":       payload.type,
        "city":       (payload.city or "").strip(),
        "address":    (payload.address or "").strip(),
        "phone":      (payload.phone or "").strip(),
        "parent_id":  payload.parent_id or None,
        "manager_id": manager_id,
        "active":     payload.active,
        "created_at": datetime.utcnow(),
        "created_by": str(current_admin["_id"]),
    }

    res = await stores_collection.insert_one(doc)
    store_id = str(res.inserted_id)

    # If manager assigned, update admin's store_id
    if manager_id:
        await admins_collection.update_one(
            {"_id": ObjectId(manager_id)},
            {"$set": {
                "store_id":   store_id,
                "store_name": payload.name.strip(),
                "store_type": payload.type,
                "updated_at": datetime.utcnow(),
            }}
        )

    return {
        "message": f"{'Branch' if payload.type == 'branch' else 'Store'} '{payload.name}' created successfully",
        "id": store_id,
        "code": payload.code.upper().strip(),
        "type": payload.type,
    }
'''

@router.post("/stores", status_code=201)
async def create_store(
    payload: StoreCreatePayload,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    """Create a new store or branch."""
 
    # Validate type
    if payload.type not in ("store", "branch"):
        raise HTTPException(status_code=400, detail="type must be 'store' or 'branch'")
 
    # Branch must have a parent
    if payload.type == "branch" and not payload.parent_id:
        raise HTTPException(
            status_code=400,
            detail="branch requires a parent_id (parent store _id)"
        )
 
    # Validate parent exists and is a store (not another branch)
    if payload.parent_id:
        parent = await stores_collection.find_one({"_id": ObjectId(payload.parent_id)})
        if not parent:
            raise HTTPException(status_code=404, detail="Parent store not found")
        if parent.get("type") != "store":
            raise HTTPException(
                status_code=400,
                detail="parent_id must point to a store, not another branch"
            )
 
    # Unique store code check
    existing = await stores_collection.find_one({"code": payload.code.upper().strip()})
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Store code '{payload.code}' already exists"
        )
 
    # Validate manager admin if provided
    manager_id = None
    if payload.manager_id:
        mgr = await admins_collection.find_one({"_id": ObjectId(payload.manager_id)})
        if not mgr:
            raise HTTPException(status_code=404, detail="Manager admin not found")
        manager_id = payload.manager_id
 
    # Build store document
    doc: Dict[str, Any] = {
        "name":       payload.name.strip(),
        "code":       payload.code.upper().strip(),
        "type":       payload.type,
        "tenant_id":  payload.tenant_id, 
        "city":       (payload.city    or "").strip(),
        "address":    (payload.address or "").strip(),
        "phone":      (payload.phone   or "").strip(),
        "parent_id":  payload.parent_id or None,
        "manager_id": manager_id,
        "active":     payload.active,
        "tenant_id":  payload.tenant_id, 
        "created_at": datetime.utcnow(),
        "created_by": str(current_admin["_id"]),
    }
 
    res      = await stores_collection.insert_one(doc)
    store_id = str(res.inserted_id)
 
    # If manager assigned, update that admin's store context
    if manager_id:
        await admins_collection.update_one(
            {"_id": ObjectId(manager_id)},
            {"$set": {
                "store_id":   store_id,
                "store_name": payload.name.strip(),
                "store_type": payload.type,
                "updated_at": datetime.utcnow(),
            }}
        )
 
    # ── Email SuperAdmin confirmation ─────────────────────────────────────────
    try:
        superadmin = await admins_collection.find_one(
            {"_id": current_admin["_id"]}
        )
        if superadmin and superadmin.get("email"):
            await send_store_created_email(
                superadmin["email"],
                superadmin.get("name", "SuperAdmin"),
                payload.name.strip(),
                payload.type,
                store_id,
                payload.city or "—",
            )
    except Exception as e:
        print(f"⚠️ Store created email failed: {e}")
 
    store_type_label = "Branch" if payload.type == "branch" else "Store"
    return {
        "message":  f"{store_type_label} '{payload.name}' created successfully",
        "id":       store_id,
        "code":     payload.code.upper().strip(),
        "type":     payload.type,
        "city":     payload.city or "",
        "active":   payload.active,
    }
 

@router.put("/stores/{store_id}")
async def update_store(
    store_id: str,
    payload: StoreUpdatePayload,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    """Update an existing store or branch."""
    try: oid = ObjectId(store_id)
    except: raise HTTPException(status_code=400, detail="Invalid store ID")

    store = await stores_collection.find_one({"_id": oid})
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    patch: Dict[str, Any] = {"updated_at": datetime.utcnow(), "updated_by": str(current_admin["_id"])}

    if payload.name    is not None: patch["name"]    = payload.name.strip()
    if payload.city    is not None: patch["city"]    = payload.city.strip()
    if payload.address is not None: patch["address"] = payload.address.strip()
    if payload.phone   is not None: patch["phone"]   = payload.phone.strip()
    if payload.active  is not None: patch["active"]  = payload.active

    if payload.code is not None:
        code_upper = payload.code.upper().strip()
        existing = await stores_collection.find_one({"code": code_upper, "_id": {"$ne": oid}})
        if existing:
            raise HTTPException(status_code=400, detail=f"Store code '{code_upper}' already in use")
        patch["code"] = code_upper

    if payload.parent_id is not None:
        parent = await stores_collection.find_one({"_id": ObjectId(payload.parent_id)})
        if not parent:
            raise HTTPException(status_code=404, detail="Parent store not found")
        patch["parent_id"] = payload.parent_id

    if payload.manager_id is not None:
        mgr = await admins_collection.find_one({"_id": ObjectId(payload.manager_id)})
        if not mgr:
            raise HTTPException(status_code=404, detail="Manager admin not found")
        patch["manager_id"] = payload.manager_id

        # Update admin's store assignment
        await admins_collection.update_one(
            {"_id": ObjectId(payload.manager_id)},
            {"$set": {
                "store_id":   store_id,
                "store_name": patch.get("name", store.get("name", "")),
                "store_type": store.get("type", "store"),
                "updated_at": datetime.utcnow(),
            }}
        )

    await stores_collection.update_one({"_id": oid}, {"$set": patch})

    # If name changed, sync store_name on all assigned admins
    if "name" in patch:
        await admins_collection.update_many(
            {"store_id": store_id},
            {"$set": {"store_name": patch["name"], "updated_at": datetime.utcnow()}}
        )

    return {"message": "Store updated successfully"}


@router.delete("/stores/{store_id}")
async def delete_store(
    store_id: str,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    """
    Delete a store or branch.
    Blocks deletion if admins are still assigned to it.
    Branches of this store are NOT auto-deleted — must be deleted separately.
    """
    try: oid = ObjectId(store_id)
    except: raise HTTPException(status_code=400, detail="Invalid store ID")

    store = await stores_collection.find_one({"_id": oid})
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    # Check for assigned admins
    assigned = await admins_collection.count_documents({"store_id": store_id})
    if assigned > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete — {assigned} admin(s) are assigned to this store. Reassign them first."
        )

    # Check for child branches (only relevant for stores)
    if store.get("type") == "store":
        child_branches = await stores_collection.count_documents({"parent_id": store_id})
        if child_branches > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete — {child_branches} branch(es) belong to this store. Delete branches first."
            )

    await stores_collection.delete_one({"_id": oid})
    return {"message": f"{'Branch' if store.get('type') == 'branch' else 'Store'} deleted successfully"}


@router.get("/stores/{store_id}/admins")
async def get_store_admins(
    store_id: str,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    """Return all admins assigned to a specific store or branch."""
    try: ObjectId(store_id)
    except: raise HTTPException(status_code=400, detail="Invalid store ID")

    store = await stores_collection.find_one({"_id": ObjectId(store_id)})
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    admins_list: List[Dict[str, Any]] = []
    async for admin in admins_collection.find({
        "store_id": store_id,
        "department": {"$ne": "SUPERADMIN"},
    }):
        created = admin.get("created_at")
        admins_list.append({
            "id":                 str(admin["_id"]),
            "name":               admin["name"],
            "email":              admin["email"],
            "department":         admin.get("department"),
            "managedDepartments": admin.get("managedDepartments", []),
            "permissions":        admin.get("permissions", []),
            "status":             admin.get("status", "PENDING"),
            "password_set":       admin.get("password_set", False),
            "is_manager":         str(store.get("manager_id", "")) == str(admin["_id"]),
            "createdDate":        created.isoformat()[:10] if isinstance(created, datetime) else None,
        })

    return {
        "store_id":   store_id,
        "store_name": store.get("name"),
        "store_type": store.get("type"),
        "count":      len(admins_list),
        "admins":     admins_list,
    }


@router.patch("/admins/{admin_id}/store")
async def assign_admin_to_store(
    admin_id: str,
    payload: AssignStorePayload,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    """
    Assign (or reassign) an admin to a store or branch.
    Pass store_id = "" to unassign.
    """
    try: oid = ObjectId(admin_id)
    except: raise HTTPException(status_code=400, detail="Invalid admin ID")

    admin = await admins_collection.find_one({"_id": oid})
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")

    if not payload.store_id:
        # Unassign
        await admins_collection.update_one(
            {"_id": oid},
            {"$unset": {"store_id": "", "store_name": "", "store_type": ""},
             "$set": {"updated_at": datetime.utcnow()}}
        )
        return {"message": "Admin unassigned from store"}

    # Validate store exists
    store = await stores_collection.find_one({"_id": ObjectId(payload.store_id)})
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    await admins_collection.update_one(
        {"_id": oid},
        {"$set": {
            "store_id":   payload.store_id,
            "store_name": store.get("name", ""),
            "store_type": store.get("type", "store"),
            "updated_at": datetime.utcnow(),
        }}
    )

    return {
        "message":    f"Admin assigned to {store.get('type', 'store')} '{store.get('name')}'",
        "store_id":   payload.store_id,
        "store_name": store.get("name"),
        "store_type": store.get("type"),
    }
'''
# Add this new route — uses regular admin JWT, not superadmin
@router.get("/stores/list")
async def list_stores_for_admin(authorization: str = Header(None)):
    """
    Returns active stores + branches for admin use.
    Used by Inventory admin's Stock Allocation page to pick destination.
    No superadmin auth required — any logged-in admin can call this.
    """
    from fastapi import Header
    from ..auth import decode_token

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization required")

    token = authorization.split(" ")[1]
    try:
        payload = decode_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    stores_list = []
    async for s in stores_collection.find({"active": True}).sort("name", 1):
        stores_list.append({
            "id":   str(s["_id"]),
            "name": s.get("name", ""),
            "code": s.get("code", ""),
            "type": s.get("type", "store"),
            "city": s.get("city", ""),
        })

    return {"count": len(stores_list), "stores": stores_list}
'''
@router.get("/stores/list")
async def list_stores_for_admin(
    ctx: dict = Depends(get_hq_tenant),
):
    """
    Return only active stores and branches belonging to the
    authenticated HQ admin's tenant.
    """
    tenant_id = ctx["tenant_id"]

    stores_list = []

    async for store in stores_collection.find({
        "tenant_id": tenant_id,
        "active": True,
    }).sort("name", 1):
        stores_list.append({
            "id": str(store["_id"]),
            "name": store.get("name", ""),
            "code": store.get("code", ""),
            "type": store.get("type", "store"),
            "city": store.get("city", ""),
            "tenant_id": store.get("tenant_id", ""),
        })

    return {
        "count": len(stores_list),
        "stores": stores_list,
    }

class UpdateTenantPayload(BaseModel):
    tenant_id: str

@router.patch("/admins/{admin_id}/tenant")
async def update_admin_tenant(
    admin_id: str,
    payload: UpdateTenantPayload,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    try: oid = ObjectId(admin_id)
    except: raise HTTPException(status_code=400, detail="Invalid admin ID")

    if not payload.tenant_id.strip():
        raise HTTPException(status_code=400, detail="tenant_id cannot be empty")

    result = await admins_collection.update_one(
        {"_id": oid},
        {"$set": {
            "tenant_id":  payload.tenant_id.strip(),
            "updated_at": datetime.utcnow(),
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Admin not found")

    return {"message": f"tenant_id updated to '{payload.tenant_id.strip()}'"}





# ============================================================
# 27. UPDATE ADMIN TENANT ID
# ============================================================
'''
class UpdateTenantPayload(BaseModel):
    tenant_id: str

@router.patch("/admins/{admin_id}/tenant")
async def update_admin_tenant(
    admin_id: str,
    payload: UpdateTenantPayload,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    """SuperAdmin sets or updates the tenant_id for an existing admin."""
    try: oid = ObjectId(admin_id)
    except: raise HTTPException(status_code=400, detail="Invalid admin ID")

    if not payload.tenant_id.strip():
        raise HTTPException(status_code=400, detail="tenant_id cannot be empty")

    result = await admins_collection.update_one(
        {"_id": oid},
        {"$set": {
            "tenant_id":  payload.tenant_id.strip(),
            "updated_at": datetime.utcnow(),
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Admin not found")

    return {"message": f"tenant_id updated to '{payload.tenant_id.strip()}'"}
'''
    