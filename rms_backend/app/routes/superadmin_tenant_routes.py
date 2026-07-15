from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Any, Dict, List, Optional
from bson import ObjectId

from ..routes.auth_routes import get_current_superadmin
from ..db import admins_collection, stores_collection
from ..auth import create_password_setup_token
from ..email_utils import send_password_setup_email
from ..config import settings

# Add to db.py:
# tenants_collection = db["tenants"]
from ..db import tenants_collection

router = APIRouter(prefix="/superadmin/tenants", tags=["SuperAdmin Tenants"])

CurrentAdmin = Dict[str, Any]


# ── Models ─────────────────────────────────────────────────────────────────────

class TenantCreate(BaseModel):
    # Retailer info
    company_name: str
    tenant_id:    str          # unique slug e.g. "zudio" — never changes
    gstin:        Optional[str] = ""
    plan:         str = "starter"   # starter | professional | enterprise
    account_type: str = "department_retailer"  # department_retailer | single_store
    phone:        Optional[str] = ""
    address:      Optional[str] = ""
    city:         Optional[str] = ""
    state:        Optional[str] = ""

    # HQ Admin (created automatically with the tenant)
    hq_admin_name:  str
    hq_admin_email: EmailStr
    hq_admin_phone: Optional[str] = ""


class TenantUpdate(BaseModel):
    company_name: Optional[str] = None
    gstin:        Optional[str] = None
    plan:         Optional[str] = None
    phone:        Optional[str] = None
    address:      Optional[str] = None
    city:         Optional[str] = None
    state:        Optional[str] = None
    status:       Optional[str] = None   # "active" | "suspended"


PLAN_LIMITS = {
    "starter":      { "stores": 1,  "admins": 3,   "label": "Starter"      },
    "professional": { "stores": 5,  "admins": 15,  "label": "Professional" },
    "enterprise":   { "stores": 999,"admins": 999,  "label": "Enterprise"  },
}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _str(v): return str(v) if v else ""


async def _tenant_stats(tenant_id: str) -> Dict[str, int]:
    store_count = await stores_collection.count_documents({"tenant_id": tenant_id})
    admin_count = await admins_collection.count_documents({
        "tenant_id":  tenant_id,
        "department": {"$ne": "SUPERADMIN"},
    })
    return {"store_count": store_count, "admin_count": admin_count}


# ── ROUTES ─────────────────────────────────────────────────────────────────────

@router.get("/")
async def list_tenants(
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    """List all retailers/tenants on the RMS platform."""
    tenants = []
    async for t in tenants_collection.find({}).sort("created_at", -1):
        stats = await _tenant_stats(t["tenant_id"])
        created = t.get("created_at")
        tenants.append({
            "id":           _str(t["_id"]),
            "tenant_id":    t.get("tenant_id", ""),
            "company_name": t.get("company_name", ""),
            "gstin":        t.get("gstin", ""),
            "plan":         t.get("plan", "starter"),
            "account_type": t.get("account_type", "department_retailer"),
            "plan_label":   PLAN_LIMITS.get(t.get("plan","starter"), {}).get("label","Starter"),
            "status":       t.get("status", "active"),
            "phone":        t.get("phone", ""),
            "city":         t.get("city", ""),
            "state":        t.get("state", ""),
            "store_count":  stats["store_count"],
            "admin_count":  stats["admin_count"],
            "store_limit":  PLAN_LIMITS.get(t.get("plan","starter"), {}).get("stores", 1),
            "admin_limit":  PLAN_LIMITS.get(t.get("plan","starter"), {}).get("admins", 3),
            "hq_admin_email": t.get("hq_admin_email", ""),
            "hq_admin_name":  t.get("hq_admin_name", ""),
            "created_at":   created.isoformat()[:10] if isinstance(created, datetime) else None,
        })
    return {"count": len(tenants), "tenants": tenants}


@router.post("/", status_code=201)
async def create_tenant(
    payload: TenantCreate,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    """
    Create a new retailer tenant + their HQ Admin in one shot.
    Steps:
      1. Validate tenant_id is unique
      2. Create tenant document
      3. Create HQ Admin linked to tenant
      4. Send setup email to HQ Admin
    """
    # 1. Validate tenant_id unique
    tenant_id = payload.tenant_id.strip().lower().replace(" ", "_")
    account_type = payload.account_type.strip().lower()
    if account_type not in ("department_retailer", "single_store"):
        raise HTTPException(status_code=400, detail="Invalid account_type")
    existing  = await tenants_collection.find_one({"tenant_id": tenant_id})
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Tenant ID '{tenant_id}' already exists. Choose a different one."
        )

    # Validate HQ admin email unique
    existing_admin = await admins_collection.find_one({"email": payload.hq_admin_email})
    if existing_admin:
        raise HTTPException(
            status_code=400,
            detail=f"An admin with email '{payload.hq_admin_email}' already exists."
        )

    # 2. Create tenant document
    tenant_doc = {
        "tenant_id":       tenant_id,
        "company_name":    payload.company_name.strip(),
        "gstin":           (payload.gstin or "").strip().upper(),
        "plan":            payload.plan,
        "account_type":    account_type,
        "status":          "active",
        "phone":           (payload.phone or "").strip(),
        "address":         (payload.address or "").strip(),
        "city":            (payload.city or "").strip(),
        "state":           (payload.state or "").strip(),
        "hq_admin_name":   payload.hq_admin_name.strip(),
        "hq_admin_email":  payload.hq_admin_email,
        "created_at":      datetime.utcnow(),
        "created_by":      _str(current_admin["_id"]),
    }
    tenant_res = await tenants_collection.insert_one(tenant_doc)

    # Single Store accounts receive one ready-to-use store. Existing
    # department-retailer onboarding remains unchanged.
    primary_store = None
    if account_type == "single_store":
        store_doc = {
            "name": payload.company_name.strip(), "code": "MAIN", "type": "store",
            "tenant_id": tenant_id, "parent_id": None,
            "city": (payload.city or "").strip(), "address": (payload.address or "").strip(),
            "phone": (payload.phone or "").strip(), "active": True,
            "created_at": datetime.utcnow(), "created_by": _str(current_admin["_id"]),
        }
        store_res = await stores_collection.insert_one(store_doc)
        primary_store = {"id": str(store_res.inserted_id), "name": store_doc["name"], "type": store_doc["type"]}

    # 3. Create HQ Admin for this tenant
    is_single_store = account_type == "single_store"
    owner_permissions = [
        "cashier", "sales", "store_stock", "stock_ledger", "stock_adjustment"
    ] if is_single_store else []
    admin_doc = {
        "name":               payload.hq_admin_name.strip(),
        "email":              payload.hq_admin_email,
        "phone":              (payload.hq_admin_phone or "").strip(),
        "department":         "Store Owner" if is_single_store else "HQ",
        "managedDepartments": ["Store Owner"] if is_single_store else ["HQ"],
        "permissions":        [
            "inventory", "vendors", "purchase_orders",
            "grn", "grc", "reports", "mbuyer", "stock_allocation"
        ] + owner_permissions,
        "account_type":       account_type,
        "tenant_id":          tenant_id,
        "scope":              "hq",
        "store_id":           primary_store["id"] if primary_store else None,
        "store_name":         primary_store["name"] if primary_store else None,
        "store_type":         primary_store["type"] if primary_store else None,
        "hashed_password":    None,
        "status":             "PENDING",
        "password_set":       False,
        "created_at":         datetime.utcnow(),
        "created_by":         _str(current_admin["_id"]),
    }
    admin_res  = await admins_collection.insert_one(admin_doc)
    admin_id   = _str(admin_res.inserted_id)

    # 4. Send setup email to HQ Admin
    admin_department = "Store Owner" if is_single_store else "HQ"
    token      = create_password_setup_token(payload.hq_admin_email, admin_department)
    setup_link = f"{settings.frontend_base_url}/admin/setup-password?token={token}"
    try:
        await send_password_setup_email(
            payload.hq_admin_email,
            payload.hq_admin_name,
            admin_department,
            setup_link,
        )
    except Exception:
        pass  # Non-fatal

    return {
        "message":    f"Retailer '{payload.company_name}' created successfully.",
        "account_type": account_type,
        "primary_store_id": primary_store["id"] if primary_store else None,
        "tenant_id":  tenant_id,
        "tenant_doc_id": _str(tenant_res.inserted_id),
        "hq_admin_id":   admin_id,
        "setup_link":    setup_link,
    }


@router.put("/{tenant_id}")
async def update_tenant(
    tenant_id: str,
    payload: TenantUpdate,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    """Update tenant details or suspend/activate."""
    tenant = await tenants_collection.find_one({"tenant_id": tenant_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    patch: Dict[str, Any] = {"updated_at": datetime.utcnow()}
    if payload.company_name is not None: patch["company_name"] = payload.company_name.strip()
    if payload.gstin        is not None: patch["gstin"]        = payload.gstin.strip().upper()
    if payload.plan         is not None: patch["plan"]         = payload.plan
    if payload.phone        is not None: patch["phone"]        = payload.phone.strip()
    if payload.address      is not None: patch["address"]      = payload.address.strip()
    if payload.city         is not None: patch["city"]         = payload.city.strip()
    if payload.state        is not None: patch["state"]        = payload.state.strip()
    if payload.status       is not None:
        if payload.status not in ("active", "suspended"):
            raise HTTPException(status_code=400, detail="status must be 'active' or 'suspended'")
        patch["status"] = payload.status

    await tenants_collection.update_one({"tenant_id": tenant_id}, {"$set": patch})
    return {"message": f"Tenant '{tenant_id}' updated."}


@router.delete("/{tenant_id}")
async def delete_tenant(
    tenant_id: str,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    """
    Delete a tenant. Blocks if they have active admins or stores.
    """
    tenant = await tenants_collection.find_one({"tenant_id": tenant_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    admin_count = await admins_collection.count_documents({
        "tenant_id": tenant_id, "department": {"$ne": "SUPERADMIN"}
    })
    if admin_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete — {admin_count} admin(s) exist for this tenant. Remove them first."
        )

    store_count = await stores_collection.count_documents({"tenant_id": tenant_id})
    if store_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete — {store_count} store(s) exist for this tenant. Remove them first."
        )

    await tenants_collection.delete_one({"tenant_id": tenant_id})
    return {"message": f"Tenant '{tenant_id}' deleted."}


@router.get("/{tenant_id}/summary")
async def get_tenant_summary(
    tenant_id: str,
    current_admin: CurrentAdmin = Depends(get_current_superadmin),
):
    """Full summary of a tenant — admins, stores, branches."""
    tenant = await tenants_collection.find_one({"tenant_id": tenant_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Get all admins
    admins = []
    async for a in admins_collection.find({"tenant_id": tenant_id, "department": {"$ne": "SUPERADMIN"}}):
        admins.append({
            "id":    _str(a["_id"]),
            "name":  a.get("name"),
            "email": a.get("email"),
            "scope": a.get("scope", "hq"),
            "store_name": a.get("store_name"),
            "status": a.get("status"),
        })

    # Get all stores + branches
    stores = []
    async for s in stores_collection.find({"tenant_id": tenant_id}):
        stores.append({
            "id":        _str(s["_id"]),
            "name":      s.get("name"),
            "code":      s.get("code"),
            "type":      s.get("type"),
            "parent_id": s.get("parent_id"),
            "active":    s.get("active", True),
        })

    return {
        "tenant_id":    tenant_id,
        "company_name": tenant.get("company_name"),
        "plan":         tenant.get("plan"),
        "status":       tenant.get("status"),
        "admins":       admins,
        "stores":       stores,
    }
