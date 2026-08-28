
"""
hq_store_routes.py
==================
HQ Admin manages their own stores, branches and store admins.
SuperAdmin no longer does this — only creates the tenant + HQ Admin.

Add to main.py:
    from .routes.hq_store_routes import router as hq_store_router
    app.include_router(hq_store_router)
"""

from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta
from bson import ObjectId
import re
import cloudinary
import cloudinary.uploader

from .deps import get_hq_tenant, get_hq_or_store_hr_tenant
from ..db import stores_collection, admins_collection, tenants_collection, retailer_store_addons_collection
from ..auth import create_password_setup_token
from ..email_utils import send_password_setup_email
from ..config import settings
from ..retailer_plans import retailer_plan_config

cloudinary.config(
    cloud_name=settings.cloudinary_cloud_name,
    api_key=settings.cloudinary_api_key,
    api_secret=settings.cloudinary_api_secret,
    secure=True,
)

router = APIRouter(prefix="/hq", tags=["HQ Store Management"])

KYB_GRACE_PERIOD_DAYS = 30
PAN_RE = re.compile(r"[A-Z]{5}[0-9]{4}[A-Z]")
GSTIN_RE = re.compile(r"\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]")

TenantCtx = Dict[str, Any]


# ── helpers ────────────────────────────────────────────────────────────────────
def _str(v): return str(v) if v else ""


async def _active_store_addon_quantity(tenant_id: str) -> int:
    """Extra store slots purchased via retailer_store_addon_routes.py — 0
    once the paid period has lapsed, even if the daily sweep hasn't caught
    up yet, so this limit check is never more generous than /me shows."""
    addon = await retailer_store_addons_collection.find_one({"tenant_id": tenant_id})
    if not addon or addon.get("status") != "active":
        return 0
    expires_at = addon.get("expires_at")
    if not expires_at or expires_at <= datetime.utcnow():
        return 0
    return int(addon.get("quantity") or 0)


async def _single_store_owner_store_id(ctx: TenantCtx) -> Optional[str]:
    """Return an owner's primary store, or None for normal HQ administrators."""
    if ctx.get("department") != "Store Owner":
        return None
    tenant = await tenants_collection.find_one(
        {"tenant_id": ctx["tenant_id"]}, {"account_type": 1}
    )
    if (tenant or {}).get("account_type") != "single_store":
        return None
    if not ctx.get("store_id"):
        raise HTTPException(status_code=403, detail="Store Owner has no primary store assigned.")
    return ctx["store_id"]


async def _caller_locked_store_id(ctx: TenantCtx) -> Optional[str]:
    """
    Any genuinely store-scoped caller (a store's own HR admin, reached via
    get_hq_or_store_hr_tenant) is locked to their own store — never another
    store, never tenant-wide. Covers the single-store "Store Owner" special
    case too (that admin is scope=hq but still tied to one store). True HQ
    admins get None back, meaning no lock.
    """
    if ctx.get("scope") in ("store", "branch") and ctx.get("store_id"):
        return ctx["store_id"]
    return await _single_store_owner_store_id(ctx)

def _serialize_store(s: dict) -> dict:
    return {
        "id":         _str(s["_id"]),
        "name":       s.get("name", ""),
        "code":       s.get("code", ""),
        "type":       s.get("type", "store"),
        "tenant_id":  s.get("tenant_id", ""),
        "parent_id":  s.get("parent_id"),
        "city":       s.get("city", ""),
        "address":    s.get("address", ""),
        "phone":      s.get("phone", ""),
        "active":     s.get("active", True),
        "created_at": s["created_at"].isoformat() if isinstance(s.get("created_at"), datetime) else "",
    }


# ── Models ─────────────────────────────────────────────────────────────────────

class StoreCreate(BaseModel):
    name:      str
    code:      str
    type:      str = "store"    # "store" | "branch"
    parent_id: Optional[str] = None   # required if type = "branch"
    city:      Optional[str] = None
    address:   Optional[str] = None
    phone:     Optional[str] = None
    active:    bool = True


class StoreUpdate(BaseModel):
    name:    Optional[str] = None
    city:    Optional[str] = None
    address: Optional[str] = None
    phone:   Optional[str] = None
    active:  Optional[bool] = None


class StoreAdminCreate(BaseModel):
    """
    Legacy single-purpose "Store Admin" creation route — kept for backward
    compatibility with any existing frontend calls, but new admin creation
    should go through POST /hq/admins (hq_create_admin below), which now
    supports real store-level departments instead of one flat role.
    """
    name:               str
    email:              EmailStr
    phone:              Optional[str] = None
    store_id:           str                    # which store/branch this admin manages
    managedDepartments: List[str] = ["Store Management"]
    permissions:        List[str] = ["store_stock", "cashier", "sales"]


# ══════════════════════════════════════════════════════════════════════════════
# STORES & BRANCHES
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/stores")
async def list_stores(ctx: TenantCtx = Depends(get_hq_tenant)):
    """List all stores and branches for this tenant."""
    stores = []
    async for s in stores_collection.find(
        {"tenant_id": ctx["tenant_id"]}
    ).sort("created_at", -1):
        stores.append(_serialize_store(s))

    # Nest branches under their parent stores
    store_map  = {s["id"]: {**s, "branches": []} for s in stores if s["type"] == "store"}
    for s in stores:
        if s["type"] == "branch" and s["parent_id"] in store_map:
            store_map[s["parent_id"]]["branches"].append(s)

    return JSONResponse({
        "status": "success",
        "data":   list(store_map.values()),
        "total":  len(stores),
    })


@router.post("/stores", status_code=201)
async def create_store(
    payload: StoreCreate,
    ctx: TenantCtx = Depends(get_hq_tenant),
):
    """HQ Admin creates a store or branch under their tenant."""
    tenant = await tenants_collection.find_one({"tenant_id": ctx["tenant_id"]}, {"plan": 1})
    plan_cfg = retailer_plan_config((tenant or {}).get("plan", "basic"))
    base_store_limit = plan_cfg.get("stores")
    addon_stores = await _active_store_addon_quantity(ctx["tenant_id"])
    store_limit = None if base_store_limit is None else base_store_limit + addon_stores
    current_store_count = await stores_collection.count_documents({"tenant_id": ctx["tenant_id"]})
    if store_limit is not None and current_store_count >= store_limit:
        addon_note = f" ({addon_stores} purchased add-on store(s) included)" if addon_stores else ""
        raise HTTPException(
            status_code=403,
            detail=f"Your {plan_cfg['label']} plan allows {store_limit} store(s)/branch(es){addon_note}. Buy more store slots or upgrade the retailer plan to add more.",
        )
    existing = await stores_collection.find_one({
        "tenant_id": ctx["tenant_id"],
        "code":      payload.code.upper().strip(),
    })
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Store code '{payload.code.upper()}' already exists."
        )

    parent_id = None
    if payload.type == "branch":
        if not payload.parent_id:
            raise HTTPException(
                status_code=400,
                detail="parent_id is required when creating a branch."
            )
        parent = await stores_collection.find_one({
            "_id":       ObjectId(payload.parent_id),
            "tenant_id": ctx["tenant_id"],
            "type":      "store",
        })
        if not parent:
            raise HTTPException(
                status_code=404,
                detail="Parent store not found or does not belong to your tenant."
            )
        parent_id = payload.parent_id

    doc = {
        "name":       payload.name.strip(),
        "code":       payload.code.upper().strip(),
        "type":       payload.type,
        "tenant_id":  ctx["tenant_id"],
        "parent_id":  parent_id,
        "city":       (payload.city    or "").strip(),
        "address":    (payload.address or "").strip(),
        "phone":      (payload.phone   or "").strip(),
        "active":     payload.active,
        "created_at": datetime.utcnow(),
        "created_by": ctx["admin_id"],
    }

    result = await stores_collection.insert_one(doc)
    return JSONResponse({
        "status":  "success",
        "message": f"{'Branch' if payload.type == 'branch' else 'Store'} '{payload.name}' created.",
        "id":      str(result.inserted_id),
    }, status_code=201)


@router.put("/stores/{store_id}")
async def update_store(
    store_id: str,
    payload: StoreUpdate,
    ctx: TenantCtx = Depends(get_hq_tenant),
):
    """HQ Admin updates a store/branch — can only update their own tenant's stores."""
    try: oid = ObjectId(store_id)
    except: raise HTTPException(status_code=400, detail="Invalid store ID")

    store = await stores_collection.find_one({"_id": oid})
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    if store.get("tenant_id") and store["tenant_id"] != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Access denied.")

    patch: Dict[str, Any] = {"updated_at": datetime.utcnow()}
    if payload.name    is not None: patch["name"]    = payload.name.strip()
    if payload.city    is not None: patch["city"]    = payload.city.strip()
    if payload.address is not None: patch["address"] = payload.address.strip()
    if payload.phone   is not None: patch["phone"]   = payload.phone.strip()
    if payload.active  is not None: patch["active"]  = payload.active

    await stores_collection.update_one({"_id": oid}, {"$set": patch})
    return JSONResponse({"status": "success", "message": "Store updated."})


@router.delete("/stores/{store_id}")
async def delete_store(
    store_id: str,
    ctx: TenantCtx = Depends(get_hq_tenant),
):
    """HQ Admin deletes a store — blocks if store has active admins."""
    try: oid = ObjectId(store_id)
    except: raise HTTPException(status_code=400, detail="Invalid store ID")

    store = await stores_collection.find_one({"_id": oid})
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    if store.get("tenant_id") and store["tenant_id"] != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Access denied.")

    if not store.get("tenant_id"):
        await stores_collection.update_one(
            {"_id": oid},
            {"$set": {"tenant_id": ctx["tenant_id"]}}
        )

    admin_count = await admins_collection.count_documents({
        "store_id":  store_id,
        "tenant_id": ctx["tenant_id"],
    })
    if admin_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete — {admin_count} admin(s) assigned to this store. Remove them first."
        )

    branch_count = await stores_collection.count_documents({
        "parent_id": store_id,
        "tenant_id": ctx["tenant_id"],
    })
    if branch_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete — {branch_count} branch(es) exist under this store. Remove them first."
        )

    await stores_collection.delete_one({"_id": oid})
    return JSONResponse({"status": "success", "message": "Store deleted."})


# ══════════════════════════════════════════════════════════════════════════════
# STORE ADMINS — legacy single-role route, kept for backward compatibility
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/store-admins")
async def list_store_admins(ctx: TenantCtx = Depends(get_hq_tenant)):
    """HQ Admin lists all store-scoped admins under their tenant."""
    admins = []
    async for a in admins_collection.find({
        "tenant_id": ctx["tenant_id"],
        "scope":     "store",
    }).sort("created_at", -1):
        admins.append({
            "id":         _str(a["_id"]),
            "name":       a.get("name", ""),
            "email":      a.get("email", ""),
            "phone":      a.get("phone", ""),
            "store_id":   a.get("store_id"),
            "store_name": a.get("store_name"),
            "store_type": a.get("store_type"),
            "managedDepartments": a.get("managedDepartments", []),
            "permissions":        a.get("permissions", []),
            "status":     a.get("status", "PENDING"),
            "password_set": a.get("password_set", False),
            "created_at": a["created_at"].isoformat() if isinstance(a.get("created_at"), datetime) else "",
        })
    return JSONResponse({"status": "success", "data": admins})


@router.post("/store-admins", status_code=201)
async def create_store_admin(
    payload: StoreAdminCreate,
    ctx: TenantCtx = Depends(get_hq_tenant),
):
    """
    Legacy route — creates a store admin with a single flat role.
    Prefer POST /hq/admins for new admins, which supports real
    department-scoped store roles (Inventory, Cashier, Finance, HR — all
    store-scoped) instead of one undifferentiated "Store Admin".
    """
    try: store_oid = ObjectId(payload.store_id)
    except: raise HTTPException(status_code=400, detail="Invalid store ID")

    store = await stores_collection.find_one({
        "_id":       store_oid,
        "tenant_id": ctx["tenant_id"],
    })
    if not store:
        raise HTTPException(
            status_code=404,
            detail="Store not found or does not belong to your tenant."
        )

    tenant = await tenants_collection.find_one({"tenant_id": ctx["tenant_id"]}, {"plan": 1, "bonus_admin_seats": 1})
    plan_cfg = retailer_plan_config((tenant or {}).get("plan", "basic"))
    base_limit = plan_cfg.get("admins")
    bonus_seats = int((tenant or {}).get("bonus_admin_seats") or 0)
    # Enterprise's base_limit is already None (unlimited) — bonus seats
    # never apply there, only on Basic/Professional.
    admin_limit = None if base_limit is None else base_limit + bonus_seats
    current_admin_count = await admins_collection.count_documents({
        "tenant_id": ctx["tenant_id"], "department": {"$ne": "SUPERADMIN"},
    })
    if admin_limit is not None and current_admin_count >= admin_limit:
        seat_note = f" ({bonus_seats} purchased add-on seat{'s' if bonus_seats != 1 else ''} included)" if bonus_seats else ""
        raise HTTPException(
            status_code=403,
            detail=f"Your {plan_cfg['label']} plan allows {admin_limit} administrator account(s){seat_note}. Buy more seats or upgrade the retailer plan to add more.",
        )

    existing = await admins_collection.find_one({"email": payload.email})
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"An admin with email '{payload.email}' already exists."
        )

    doc = {
        "name":               payload.name.strip(),
        "email":              payload.email,
        "phone":              (payload.phone or "").strip(),
        "department":         payload.managedDepartments[0] if payload.managedDepartments else "Store Management",
        "managedDepartments": payload.managedDepartments,
        "permissions":        payload.permissions,
        "tenant_id":          ctx["tenant_id"],
        "scope":              "store",
        "store_id":           payload.store_id,
        "store_name":         store.get("name", ""),
        "store_type":         store.get("type", "store"),
        "hashed_password":    None,
        "status":             "PENDING",
        "password_set":       False,
        "created_at":         datetime.utcnow(),
        "created_by":         ctx["admin_id"],
    }

    result = await admins_collection.insert_one(doc)
    admin_id = str(result.inserted_id)

    token      = create_password_setup_token(payload.email, "Store")
    setup_link = f"{settings.frontend_base_url}/admin/setup-password?token={token}"
    try:
        await send_password_setup_email(payload.email, payload.name, "Store", setup_link)
    except Exception:
        pass

    return JSONResponse({
        "status":     "success",
        "message":    f"Store Admin '{payload.name}' created for {store.get('name')}.",
        "id":         admin_id,
        "setup_link": setup_link,
    }, status_code=201)


@router.delete("/store-admins/{admin_id}")
async def delete_store_admin(
    admin_id: str,
    ctx: TenantCtx = Depends(get_hq_tenant),
):
    """HQ Admin removes a store admin — only from their own tenant."""
    try: oid = ObjectId(admin_id)
    except: raise HTTPException(status_code=400, detail="Invalid admin ID")

    admin = await admins_collection.find_one({
        "_id":       oid,
        "tenant_id": ctx["tenant_id"],
        "scope":     "store",
    })
    if not admin:
        raise HTTPException(status_code=404, detail="Store admin not found")

    await admins_collection.delete_one({"_id": oid})
    return JSONResponse({"status": "success", "message": "Store admin removed."})


# ══════════════════════════════════════════════════════════════════════════════
# SUMMARY — HQ overview of their entire setup
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/setup-summary")
async def get_setup_summary(ctx: TenantCtx = Depends(get_hq_tenant)):
    """HQ Admin sees their complete setup at a glance."""
    store_count  = await stores_collection.count_documents({
        "tenant_id": ctx["tenant_id"], "type": "store"
    })
    branch_count = await stores_collection.count_documents({
        "tenant_id": ctx["tenant_id"], "type": "branch"
    })
    admin_count  = await admins_collection.count_documents({
        "tenant_id": ctx["tenant_id"], "scope": "store"
    })

    return JSONResponse({
        "status": "success",
        "tenant_id":    ctx["tenant_id"],
        "store_count":  store_count,
        "branch_count": branch_count,
        "admin_count":  admin_count,
        "setup_complete": store_count > 0 and admin_count > 0,
        "checklist": {
            "stores_added":       store_count > 0,
            "branches_added":     branch_count > 0,
            "store_admins_added": admin_count > 0,
        }
    })


# ══════════════════════════════════════════════════════════════════════════════
# HQ ADMIN MANAGEMENT
# HQ Admin creates/manages all admins under their tenant — HQ-scoped AND
# store-scoped, both using the same real department model now.
# ══════════════════════════════════════════════════════════════════════════════

from ..models import AdminCreate

# ── Departments — CORRECTED MODEL ──────────────────────────────────────────────
# Department NAMES are shared across HQ and store level (e.g. "Inventory"
# means the same department whether the admin works at HQ or at one store —
# the frontend route /dashboard/inventory is the SAME route either way, and
# the page component itself already reads localStorage.store_id to decide
# whether to show central stock or that store's stock).
#
# Previously this used suffixed names like "Inventory (Store)" to encode
# scope INTO the department string. That broke DepartmentSelector.jsx,
# whose DEPT_ROUTES map only has an entry for "Inventory" — the suffixed
# variant fell through to an auto-generated garbage path and admins landed
# nowhere. Scope must never be encoded in the department string; it's now
# always a separate, explicit field (see HQAdminCreate.scope below).

# Departments that ONLY make sense at HQ (no per-store equivalent).
HQ_ONLY_DEPARTMENTS = [
    "Merchandiser Buyer", "Logistics", "IT", "Design & Pattern",
    "Stock Planning & Forecasting", "Third Party", "Production & Job Work",
    "Forecast & Analytics", "Marketing", "Customer CRM",
]

# Departments that ONLY make sense at a single store (no HQ equivalent).
STORE_ONLY_DEPARTMENTS = [
    "Cashier",   # POS / sales transactions at that store
]

# Departments that exist at BOTH levels under the exact same name — an
# "Inventory" admin can be created at HQ (manages central stock) or at a
# specific store (manages that store's stock, receives transfers) using
# the identical department string "Inventory". Which one they are is
# determined by the explicit `scope` field + `store_id` at creation time,
# not by which checkbox they ticked.
SHARED_DEPARTMENTS = [
    "Inventory", "Finance", "HR",
]

HQ_DEPARTMENTS    = HQ_ONLY_DEPARTMENTS + SHARED_DEPARTMENTS
STORE_DEPARTMENTS = STORE_ONLY_DEPARTMENTS + SHARED_DEPARTMENTS

# A store's own HR admin can hire freely for Cashier/Inventory/etc., but
# creating another HR or Finance admin at their store is sensitive enough
# that it stays HQ-only — a store-scoped caller must ask HQ to do it.
STORE_HR_RESTRICTED_DEPARTMENTS = {"HR", "Finance"}

HQ_PERMISSIONS = [
    "inventory", "purchase_orders", "grn", "grc", "vendors",
    "stock_allocation", "stock_transfer", "mbuyer",
    "job_work",
    "cashier", "store_stock", "sales",
    "hr", "finance", "logistics", "reports",
    "user_management", "forecast_analytics", "marketing", "customer_crm",
]

# Suggested default permissions when a department is picked at STORE scope
# specifically (the same department name at HQ scope doesn't auto-apply
# these — HQ uses the PRESETS in the frontend instead). Purely a UX
# convenience for pre-checking sensible boxes; require_permission() in
# deps.py enforces whatever ends up actually saved, regardless of how it
# got there.
STORE_DEPARTMENT_DEFAULT_PERMISSIONS = {
    "Cashier":   ["cashier", "sales"],
    "Inventory": ["store_stock", "stock_ledger", "stock_adjustment", "stock_transfer", "grc", "grn"],
    "Finance":   ["finance", "reports"],
    "HR":        ["hr"],
}


def _department_allowed_for_scope(department: str, scope: str) -> bool:
    if scope == "hq":
        return department in HQ_DEPARTMENTS
    if scope == "store":
        return department in STORE_DEPARTMENTS
    return False


class HQAdminCreate(BaseModel):
    name:               str
    email:              EmailStr
    phone:              Optional[str] = None
    # Explicit — no longer inferred from department name. "hq" or "store".
    scope:              str
    managedDepartments: List[str]    = []
    permissions:        List[str]    = []
    # Required when scope == "store"
    store_id:           Optional[str] = None
    # Finer org placement within a department — purely descriptive, doesn't
    # affect access/permissions. is_department_head marks this person as the
    # one head of their primary department (see _promote_department_head).
    division:           Optional[str] = ""
    section:            Optional[str] = ""
    floor:              Optional[str] = ""
    is_department_head: Optional[bool] = False


class HQAdminUpdate(BaseModel):
    permissions:        Optional[List[str]] = None
    managedDepartments: Optional[List[str]] = None
    status:             Optional[str] = None   # "ACTIVE" | "SUSPENDED"
    store_department:   Optional[str] = None
    division:           Optional[str] = None
    section:            Optional[str] = None
    floor:              Optional[str] = None
    is_department_head: Optional[bool] = None


async def _promote_department_head(tenant_id: str, department: str, scope: str, store_id: Optional[str], admin_id: ObjectId) -> None:
    """Only one head per department (per store, at store scope). Promoting
    a new head demotes whoever previously held it — never two heads at once."""
    demote_query: Dict[str, Any] = {
        "tenant_id": tenant_id, "department": department, "scope": scope,
        "_id": {"$ne": admin_id},
    }
    if scope == "store":
        demote_query["store_id"] = store_id
    await admins_collection.update_many(demote_query, {"$set": {"is_department_head": False}})


@router.get("/departments")
async def get_department_config():
    """
    Returns the full department configuration. Frontend renders the Add
    Admin modal from this instead of hardcoding department lists, so
    backend and frontend can't drift apart.

    hq_departments / store_departments: the full picklist for each scope
    (each already includes the shared departments where applicable).
    shared_departments: departments valid at EITHER scope under the same
    name — useful if the frontend wants to badge these differently.
    """
    return JSONResponse({
        "status": "success",
        "data": {
            "hq_departments":     HQ_DEPARTMENTS,
            "store_departments":  STORE_DEPARTMENTS,
            "shared_departments": SHARED_DEPARTMENTS,
            "hq_only_departments":    HQ_ONLY_DEPARTMENTS,
            "store_only_departments": STORE_ONLY_DEPARTMENTS,
            "permissions":        HQ_PERMISSIONS,
            "store_department_default_permissions": STORE_DEPARTMENT_DEFAULT_PERMISSIONS,
        }
    })


@router.get("/admins")
async def hq_list_admins(ctx: TenantCtx = Depends(get_hq_or_store_hr_tenant)):
    """HQ Admin lists all admins under their tenant (excludes superadmin).
    A store's own HR admin sees only their store's staff."""
    locked_store_id = await _caller_locked_store_id(ctx)
    query = {
        "tenant_id": ctx["tenant_id"],
        "department": {"$ne": "SUPERADMIN"},
    }
    if locked_store_id:
        query.update({"scope": "store", "store_id": locked_store_id})
    admins = []
    async for a in admins_collection.find(query).sort("created_at", -1):
        admins.append({
            "id":                 _str(a["_id"]),
            "name":               a.get("name", ""),
            "email":              a.get("email", ""),
            "phone":              a.get("phone", ""),
            "department":         a.get("department", ""),
            "managedDepartments": a.get("managedDepartments", []),
            "permissions":        a.get("permissions", []),
            "store_department":   a.get("store_department", ""),
            "division":           a.get("division", ""),
            "section":            a.get("section", ""),
            "floor":              a.get("floor", ""),
            "is_department_head": bool(a.get("is_department_head", False)),
            "scope":              a.get("scope", "hq"),
            "store_id":           a.get("store_id"),
            "store_name":         a.get("store_name"),
            "status":             a.get("status", "PENDING"),
            "password_set":       a.get("password_set", False),
            "tenant_id":          a.get("tenant_id", ""),
            "created_at":         a["created_at"].isoformat() if isinstance(a.get("created_at"), datetime) else "",
        })
    return JSONResponse({"status": "success", "data": admins})


@router.post("/admins", status_code=201)
async def hq_create_admin(
    payload: HQAdminCreate,
    ctx: TenantCtx = Depends(get_hq_or_store_hr_tenant),
):
    """
    HQ Admin creates a department admin — HQ-scoped or store-scoped.
    tenant_id is auto-set from JWT — cannot be faked.
    Cannot create SUPERADMIN accounts.

    scope is now an EXPLICIT field on the request, not inferred from the
    department string. Departments like "Inventory", "Finance", "HR" can
    be created at either scope under the identical name — an HQ Inventory
    admin and a Store Inventory admin both route to the same frontend page
    (/dashboard/inventory), which already differentiates central vs store
    stock internally via localStorage.store_id. This is what makes
    multiple department-scoped admins per store possible (a store's
    Inventory admin, its Cashier, its Finance admin — each a separate
    account with separate permissions) instead of one flat "Store Admin".
    """
    if payload.scope not in ("hq", "store"):
        raise HTTPException(status_code=400, detail="scope must be 'hq' or 'store'.")

    locked_store_id = await _caller_locked_store_id(ctx)
    if locked_store_id and (payload.scope != "store" or payload.store_id != locked_store_id):
        raise HTTPException(
            status_code=403,
            detail="You can create staff only for your own store.",
        )

    if not payload.managedDepartments:
        raise HTTPException(status_code=400, detail="At least one department is required.")

    if "SUPERADMIN" in payload.managedDepartments:
        raise HTTPException(status_code=403, detail="Cannot create SUPERADMIN accounts.")

    if locked_store_id and STORE_HR_RESTRICTED_DEPARTMENTS.intersection(payload.managedDepartments):
        raise HTTPException(
            status_code=403,
            detail="Creating an HR or Finance admin needs HQ approval — ask your HQ admin to create this account.",
        )

    tenant = await tenants_collection.find_one({"tenant_id": ctx["tenant_id"]}, {"plan": 1, "bonus_admin_seats": 1})
    plan_cfg = retailer_plan_config((tenant or {}).get("plan", "basic"))
    base_limit = plan_cfg.get("admins")
    bonus_seats = int((tenant or {}).get("bonus_admin_seats") or 0)
    # Enterprise's base_limit is already None (unlimited) — bonus seats
    # never apply there, only on Basic/Professional.
    admin_limit = None if base_limit is None else base_limit + bonus_seats
    current_admin_count = await admins_collection.count_documents({
        "tenant_id": ctx["tenant_id"], "department": {"$ne": "SUPERADMIN"},
    })
    if admin_limit is not None and current_admin_count >= admin_limit:
        seat_note = f" ({bonus_seats} purchased add-on seat{'s' if bonus_seats != 1 else ''} included)" if bonus_seats else ""
        raise HTTPException(
            status_code=403,
            detail=f"Your {plan_cfg['label']} plan allows {admin_limit} administrator account(s){seat_note}. Buy more seats or upgrade the retailer plan to add more.",
        )

    invalid = [
        d for d in payload.managedDepartments
        if not _department_allowed_for_scope(d, payload.scope)
    ]
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Department(s) not valid for scope '{payload.scope}': {', '.join(invalid)}. "
                f"See GET /hq/departments for valid values per scope."
            )
        )

    existing = await admins_collection.find_one({"email": payload.email})
    if existing:
        raise HTTPException(status_code=400, detail=f"Admin with email '{payload.email}' already exists.")

    primary_dept = payload.managedDepartments[0]

    store_id   = None
    store_name = None
    store_type = None

    if payload.scope == "store":
        if not payload.store_id:
            raise HTTPException(
                status_code=400,
                detail="store_id is required when scope is 'store'."
            )
        try: store_oid = ObjectId(payload.store_id)
        except: raise HTTPException(status_code=400, detail="Invalid store_id")

        store = await stores_collection.find_one({
            "_id":       store_oid,
            "tenant_id": ctx["tenant_id"],
        })
        if not store:
            raise HTTPException(status_code=404, detail="Store not found under your tenant.")

        store_id   = payload.store_id
        store_name = store.get("name", "")
        store_type = store.get("type", "store")

    doc = {
        "name":               payload.name.strip(),
        "email":              payload.email,
        "phone":              (payload.phone or "").strip(),
        "department":         primary_dept,
        "managedDepartments": payload.managedDepartments,
        "permissions":        payload.permissions,
        "tenant_id":          ctx["tenant_id"],
        "scope":              payload.scope,
        "store_id":           store_id,
        "store_name":         store_name,
        "store_type":         store_type,
        "store_department":   (payload.store_department or "").strip(),
        "division":           (payload.division or "").strip(),
        "section":            (payload.section or "").strip(),
        "floor":              (payload.floor or "").strip(),
        "is_department_head": bool(payload.is_department_head),
        "hashed_password":    None,
        "status":             "PENDING",
        "password_set":       False,
        "created_at":         datetime.utcnow(),
        "created_by":         ctx["admin_id"],
    }

    result = await admins_collection.insert_one(doc)
    admin_id = str(result.inserted_id)

    if payload.is_department_head:
        await _promote_department_head(ctx["tenant_id"], primary_dept, payload.scope, store_id, result.inserted_id)

    token      = create_password_setup_token(payload.email, primary_dept)
    setup_link = f"{settings.frontend_base_url}/admin/setup-password?token={token}"
    try:
        await send_password_setup_email(payload.email, payload.name, primary_dept, setup_link)
    except Exception:
        pass

    return JSONResponse({
        "status":     "success",
        "message":    f"Admin '{payload.name}' created for {primary_dept} ({payload.scope.upper()}).",
        "id":         admin_id,
        "setup_link": setup_link,
    }, status_code=201)


@router.patch("/admins/{admin_id}")
async def hq_update_admin(
    admin_id: str,
    payload: HQAdminUpdate,
    ctx: TenantCtx = Depends(get_hq_or_store_hr_tenant),
):
    """
    HQ Admin updates permissions or suspends/activates an admin.

    Suspension now takes effect IMMEDIATELY on the next request that admin
    makes, rather than only once their existing JWT expires — see deps.py's
    get_tenant(), which now looks up the live admin record and checks
    status on every request instead of only reading it from the token.
    """
    try: oid = ObjectId(admin_id)
    except: raise HTTPException(status_code=400, detail="Invalid ID")

    admin = await admins_collection.find_one({
        "_id":       oid,
        "tenant_id": ctx["tenant_id"],
        "department": {"$ne": "SUPERADMIN"},
    })
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")

    locked_store_id = await _caller_locked_store_id(ctx)
    if locked_store_id and (
        admin.get("scope") != "store" or admin.get("store_id") != locked_store_id
    ):
        raise HTTPException(status_code=403, detail="You can manage only staff assigned to your own store.")

    patch: Dict[str, Any] = {"updated_at": datetime.utcnow()}
    if payload.permissions        is not None: patch["permissions"]        = payload.permissions
    if payload.managedDepartments is not None:
        # An admin's scope (hq/store) is fixed at creation and not editable
        # here — updating managedDepartments must stay within that same
        # scope, using the admin's existing "scope" field, not a scope
        # re-derived from the new department list.
        admin_scope = admin.get("scope", "hq")
        invalid = [
            d for d in payload.managedDepartments
            if not _department_allowed_for_scope(d, admin_scope)
        ]
        if invalid:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Department(s) not valid for this admin's scope ('{admin_scope}'): "
                    f"{', '.join(invalid)}."
                )
            )
        if not payload.managedDepartments:
            raise HTTPException(status_code=400, detail="An admin must have at least one department.")
        if locked_store_id and STORE_HR_RESTRICTED_DEPARTMENTS.intersection(payload.managedDepartments):
            raise HTTPException(
                status_code=403,
                detail="Assigning HR or Finance needs HQ approval — ask your HQ admin to make this change.",
            )
        patch["managedDepartments"] = payload.managedDepartments
        # Keep the legacy single department field aligned with the first
        # selected department. Older screens and setup emails still read it.
        patch["department"] = payload.managedDepartments[0]
    if payload.status             is not None:
        if payload.status not in ("ACTIVE", "SUSPENDED"):
            raise HTTPException(status_code=400, detail="status must be ACTIVE or SUSPENDED")
        patch["status"] = payload.status
    if payload.store_department   is not None: patch["store_department"] = payload.store_department.strip()
    if payload.division           is not None: patch["division"] = payload.division.strip()
    if payload.section            is not None: patch["section"]  = payload.section.strip()
    if payload.floor              is not None: patch["floor"]    = payload.floor.strip()
    if payload.is_department_head is not None: patch["is_department_head"] = payload.is_department_head

    await admins_collection.update_one({"_id": oid}, {"$set": patch})

    if payload.is_department_head:
        department = patch.get("department", admin.get("department", ""))
        await _promote_department_head(ctx["tenant_id"], department, admin.get("scope", "hq"), admin.get("store_id"), oid)

    return JSONResponse({"status": "success", "message": "Admin updated."})


@router.delete("/admins/{admin_id}")
async def hq_delete_admin(
    admin_id: str,
    ctx: TenantCtx = Depends(get_hq_or_store_hr_tenant),
):
    """HQ Admin deletes an admin under their tenant."""
    try: oid = ObjectId(admin_id)
    except: raise HTTPException(status_code=400, detail="Invalid ID")

    admin = await admins_collection.find_one({
        "_id":       oid,
        "tenant_id": ctx["tenant_id"],
        "department": {"$ne": "SUPERADMIN"},
    })
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")

    locked_store_id = await _caller_locked_store_id(ctx)
    if locked_store_id and (
        admin.get("scope") != "store" or admin.get("store_id") != locked_store_id
    ):
        raise HTTPException(status_code=403, detail="You can manage only staff assigned to your own store.")

    if str(admin["_id"]) == ctx["admin_id"]:
        raise HTTPException(status_code=400, detail="You cannot delete your own account.")

    await admins_collection.delete_one({"_id": oid})
    return JSONResponse({"status": "success", "message": "Admin deleted."})


# ══════════════════════════════════════════════════════════════════════════
# BUSINESS VERIFICATION (KYB) — retailer's own tenant, reviewed by SuperAdmin
# ══════════════════════════════════════════════════════════════════════════

@router.get("/kyb")
async def get_tenant_kyb(ctx: TenantCtx = Depends(get_hq_tenant)):
    """HQ-facing view of this retailer's own business verification."""
    tenant = await tenants_collection.find_one(
        {"tenant_id": ctx["tenant_id"]},
        {"kyb": 1, "kyb_status": 1, "kyb_note": 1, "kyb_reviewed_at": 1, "kyb_required_after": 1},
    )
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found.")
    kyb = dict(tenant.get("kyb") or {})
    return {"data": {
        "status": tenant.get("kyb_status", "Not started"),
        "note": tenant.get("kyb_note", ""),
        "reviewed_at": tenant.get("kyb_reviewed_at"),
        "required_after": tenant.get("kyb_required_after"),
        "legal_name": kyb.get("legal_name", ""),
        "business_address": kyb.get("business_address", ""),
        "pan": kyb.get("pan", ""),
        "gstin": kyb.get("gstin", ""),
        "gst_certificate_url": kyb.get("gst_certificate_url", ""),
        "pan_document_url": kyb.get("pan_document_url", ""),
        "cancelled_cheque_url": kyb.get("cancelled_cheque_url", ""),
        "bank_account_holder": kyb.get("bank_account_holder", ""),
        "bank_name": kyb.get("bank_name", ""),
        "account_last4": kyb.get("account_last4", ""),
        "ifsc": kyb.get("ifsc", ""),
        "submitted_at": kyb.get("submitted_at"),
    }}


@router.post("/kyb/documents/{document_type}")
async def upload_tenant_kyb_document(
    document_type: str,
    file: UploadFile = File(...),
    ctx: TenantCtx = Depends(get_hq_tenant),
):
    """Upload a retailer business-verification document and return its HTTPS storage URL."""
    field_by_type = {
        "gst_certificate": "gst_certificate_url",
        "pan_document": "pan_document_url",
        "cancelled_cheque": "cancelled_cheque_url",
    }
    if document_type not in field_by_type:
        raise HTTPException(status_code=400, detail="Choose a valid business verification document type.")
    allowed_types = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Upload JPG, PNG, WEBP or PDF only.")
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="The selected file is empty.")
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Business verification documents must be 10 MB or smaller.")
    try:
        result = cloudinary.uploader.upload(
            raw,
            folder=f"rms/retailer-kyb/{ctx['tenant_id']}",
            resource_type="auto",
            public_id=f"{document_type}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            use_filename=True,
            unique_filename=True,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Could not upload the document. Please try again.") from exc
    url = result.get("secure_url")
    if not url:
        raise HTTPException(status_code=502, detail="Document storage did not return a secure URL.")
    await tenants_collection.update_one(
        {"tenant_id": ctx["tenant_id"]},
        {"$set": {f"kyb.{field_by_type[document_type]}": url, "kyb.updated_at": datetime.utcnow()}},
    )
    return {"url": url, "name": file.filename, "content_type": file.content_type}


@router.patch("/kyb")
async def submit_tenant_kyb(request: Request, ctx: TenantCtx = Depends(get_hq_tenant)):
    """Submit this retailer's business verification for SuperAdmin review."""
    body = await request.json()
    required = ("legal_name", "business_address", "pan", "gstin")
    values = {key: str(body.get(key) or "").strip() for key in required}
    missing = [key.replace("_", " ") for key, value in values.items() if not value]
    if missing:
        raise HTTPException(status_code=400, detail=f"Complete: {', '.join(missing)}.")
    pan = values["pan"].upper()
    if not PAN_RE.fullmatch(pan):
        raise HTTPException(status_code=400, detail="PAN must be in the format AAAAA9999A.")
    gstin = values["gstin"].upper()
    if not GSTIN_RE.fullmatch(gstin):
        raise HTTPException(status_code=400, detail="GSTIN must be a valid 15-character GST number.")
    urls = {}
    for key in ("gst_certificate_url", "pan_document_url", "cancelled_cheque_url"):
        value = str(body.get(key) or "").strip()
        if value and not re.match(r"^https://", value, re.I):
            raise HTTPException(status_code=400, detail=f"{key.replace('_', ' ')} must be a secure https link.")
        urls[key] = value
    if not urls.get("gst_certificate_url") or not urls.get("pan_document_url"):
        raise HTTPException(status_code=400, detail="Upload both the GST certificate and PAN document before submitting.")

    account_number = str(body.get("account_number") or "").strip()
    account_last4 = account_number[-4:] if account_number else str(body.get("account_last4") or "").strip()[-4:]
    kyb = {
        "legal_name": values["legal_name"][:200], "business_address": values["business_address"][:600],
        "pan": pan, "gstin": gstin, **urls,
        "bank_account_holder": str(body.get("bank_account_holder") or "").strip()[:160],
        "bank_name": str(body.get("bank_name") or "").strip()[:160],
        "account_last4": account_last4,
        "ifsc": str(body.get("ifsc") or "").strip().upper()[:20],
        "submitted_at": datetime.utcnow(), "updated_at": datetime.utcnow(),
    }
    await tenants_collection.update_one(
        {"tenant_id": ctx["tenant_id"]},
        {"$set": {"kyb": kyb, "gstin": gstin, "kyb_status": "Submitted", "kyb_note": "Awaiting SuperAdmin verification."}},
    )
    return {"message": "Business verification submitted for review.", "status": "Submitted"}
    return JSONResponse({"status": "success", "message": f"Admin '{admin.get('name')}' deleted."})
