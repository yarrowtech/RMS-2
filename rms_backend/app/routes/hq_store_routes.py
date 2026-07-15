
"""
hq_store_routes.py
==================
HQ Admin manages their own stores, branches and store admins.
SuperAdmin no longer does this — only creates the tenant + HQ Admin.

Add to main.py:
    from .routes.hq_store_routes import router as hq_store_router
    app.include_router(hq_store_router)
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from typing import Any, Dict, List, Optional
from datetime import datetime
from bson import ObjectId

from .deps import get_hq_tenant
from ..db import stores_collection, admins_collection, tenants_collection
from ..auth import create_password_setup_token
from ..email_utils import send_password_setup_email
from ..config import settings

router = APIRouter(prefix="/hq", tags=["HQ Store Management"])

TenantCtx = Dict[str, Any]


# ── helpers ────────────────────────────────────────────────────────────────────
def _str(v): return str(v) if v else ""


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
    "Stock Planning & Forecasting", "Third Party",
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

HQ_PERMISSIONS = [
    "inventory", "purchase_orders", "grn", "grc", "vendors",
    "stock_allocation", "stock_transfer", "mbuyer",
    "cashier", "store_stock", "sales",
    "hr", "finance", "logistics", "reports",
    "user_management",
]

# Suggested default permissions when a department is picked at STORE scope
# specifically (the same department name at HQ scope doesn't auto-apply
# these — HQ uses the PRESETS in the frontend instead). Purely a UX
# convenience for pre-checking sensible boxes; require_permission() in
# deps.py enforces whatever ends up actually saved, regardless of how it
# got there.
STORE_DEPARTMENT_DEFAULT_PERMISSIONS = {
    "Cashier":   ["cashier", "sales"],
    "Inventory": ["store_stock", "stock_ledger", "stock_adjustment", "grc", "grn"],
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


class HQAdminUpdate(BaseModel):
    permissions:        Optional[List[str]] = None
    managedDepartments: Optional[List[str]] = None
    status:             Optional[str] = None   # "ACTIVE" | "SUSPENDED"


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
async def hq_list_admins(ctx: TenantCtx = Depends(get_hq_tenant)):
    """HQ Admin lists all admins under their tenant (excludes superadmin)."""
    owner_store_id = await _single_store_owner_store_id(ctx)
    query = {
        "tenant_id": ctx["tenant_id"],
        "department": {"$ne": "SUPERADMIN"},
    }
    if owner_store_id:
        query.update({"scope": "store", "store_id": owner_store_id})
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
    ctx: TenantCtx = Depends(get_hq_tenant),
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

    owner_store_id = await _single_store_owner_store_id(ctx)
    if owner_store_id and (payload.scope != "store" or payload.store_id != owner_store_id):
        raise HTTPException(
            status_code=403,
            detail="A Store Owner can create staff only for their own primary store.",
        )

    if not payload.managedDepartments:
        raise HTTPException(status_code=400, detail="At least one department is required.")

    if "SUPERADMIN" in payload.managedDepartments:
        raise HTTPException(status_code=403, detail="Cannot create SUPERADMIN accounts.")

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
        "hashed_password":    None,
        "status":             "PENDING",
        "password_set":       False,
        "created_at":         datetime.utcnow(),
        "created_by":         ctx["admin_id"],
    }

    result = await admins_collection.insert_one(doc)
    admin_id = str(result.inserted_id)

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
    ctx: TenantCtx = Depends(get_hq_tenant),
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

    owner_store_id = await _single_store_owner_store_id(ctx)
    if owner_store_id and (
        admin.get("scope") != "store" or admin.get("store_id") != owner_store_id
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
        patch["managedDepartments"] = payload.managedDepartments
    if payload.status             is not None:
        if payload.status not in ("ACTIVE", "SUSPENDED"):
            raise HTTPException(status_code=400, detail="status must be ACTIVE or SUSPENDED")
        patch["status"] = payload.status

    await admins_collection.update_one({"_id": oid}, {"$set": patch})
    return JSONResponse({"status": "success", "message": "Admin updated."})


@router.delete("/admins/{admin_id}")
async def hq_delete_admin(
    admin_id: str,
    ctx: TenantCtx = Depends(get_hq_tenant),
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

    owner_store_id = await _single_store_owner_store_id(ctx)
    if owner_store_id and (
        admin.get("scope") != "store" or admin.get("store_id") != owner_store_id
    ):
        raise HTTPException(status_code=403, detail="You can manage only staff assigned to your own store.")

    if str(admin["_id"]) == ctx["admin_id"]:
        raise HTTPException(status_code=400, detail="You cannot delete your own account.")

    await admins_collection.delete_one({"_id": oid})
    return JSONResponse({"status": "success", "message": f"Admin '{admin.get('name')}' deleted."})
