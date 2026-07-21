
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from typing import Any, Dict, Optional
from bson import ObjectId

from ..config import settings
from ..db import admins_collection, tenants_collection

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


# â”€â”€ Core tenant context extractor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async def get_tenant(token: str = Depends(oauth2_scheme)) -> Dict[str, Any]:
    """
    Extracts tenant context from JWT token.
    Works for ALL admin roles â€” HQ and Store.

    Returns:
        {
            "tenant_id": "citimart",
            "scope":     "hq" | "store",
            "store_id":  None | "store_001",
            "store_name": None | "New Market",
            "store_type": None | "store" | "branch",
            "admin_id":  "64abc...",
            "department": "Inventory",
        }

    Raises:
        401 â€” invalid/expired token
        403 â€” admin has no tenant_id assigned yet, OR admin is suspended
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError:
        raise credentials_exception

    role    = payload.get("role")
    user_id = payload.get("sub")

    if not user_id or role not in ("ADMIN", "admin"):
        raise credentials_exception

    # â”€â”€ ALWAYS look up the live admin record â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    # Previously this only happened as a fallback when tenant_id was missing
    # from the token. Now it happens every request, because status
    # (ACTIVE/SUSPENDED) and permissions must be checked fresh â€” a JWT
    # issued before an admin was suspended, or before their permissions
    # were changed, must not keep working until it naturally expires.
    # This trades a small amount of latency (one indexed _id lookup) for
    # suspension/permission changes taking effect immediately.
    try:
        admin = await admins_collection.find_one({"_id": ObjectId(user_id)})
    except Exception:
        admin = None

    if not admin:
        raise credentials_exception

    if admin.get("status") == "SUSPENDED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been suspended. Contact your administrator.",
        )

    tenant_id = payload.get("tenant_id") or admin.get("tenant_id")

    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tenant assigned to this admin. Contact your Super Admin.",
        )

    return {
        "tenant_id":   tenant_id,
        "scope":       payload.get("scope") or admin.get("scope", "hq"),
        "store_id":    payload.get("store_id") or admin.get("store_id"),
        "store_name":  payload.get("store_name") or admin.get("store_name"),
        "store_type":  payload.get("store_type") or admin.get("store_type"),
        "admin_id":    user_id,
        "admin_name":  admin.get("name") or admin.get("full_name") or admin.get("email", ""),
        "department":  payload.get("department") or admin.get("department", ""),
        # Carried through so require_permission() below doesn't need a
        # second DB round-trip â€” this dict already reflects the live record.
        "_permissions": admin.get("permissions", []),
        "_managed_departments": admin.get("managedDepartments", []),
    }


# â”€â”€ HQ Admin only â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async def get_hq_tenant(ctx: Dict[str, Any] = Depends(get_tenant)) -> Dict[str, Any]:
    """
    HQ-level routes only.
    Blocks store admins from accessing central operations.

    NOTE: this checks scope only, same as before â€” it does NOT check
    permissions. A route gated only by get_hq_tenant is reachable by ANY
    HQ-scoped admin regardless of department/permissions. Use
    require_permission(...) (below) instead of, or layered with, this
    dependency for anything that should be restricted to specific
    departments (e.g. only Inventory admins touching /grn, only Finance
    admins touching finance reports).
    """
    if ctx["scope"] != "hq":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="HQ access only. Store admins cannot access this resource.",
        )
    return ctx


async def get_receiving_tenant(ctx: Dict[str, Any] = Depends(get_tenant)) -> Dict[str, Any]:
    """Allow receiving at HQ, plus the Inventory role of a single-store tenant.

    Multi-store receiving remains HQ-controlled and continues to use the
    central-allocation model. A single-store Inventory user needs GRC/GRN
    access because their GRN posts directly to their only store.
    """
    if ctx["scope"] == "hq":
        return ctx

    tenant = await tenants_collection.find_one(
        {"tenant_id": ctx["tenant_id"]}, {"account_type": 1}
    )
    has_inventory_role = "Inventory" in (ctx.get("_managed_departments") or [])
    permissions = set(ctx.get("_permissions") or [])
    if (
        (tenant or {}).get("account_type") == "single_store"
        and has_inventory_role
        and {"grc", "grn"}.issubset(permissions)
        and ctx.get("store_id")
    ):
        return ctx

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Receiving is available to HQ users or the Inventory staff of a single-store tenant.",
    )


# â”€â”€ Store Admin only â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async def get_store_tenant(ctx: Dict[str, Any] = Depends(get_tenant)) -> Dict[str, Any]:
    """
    Store-level routes only.
    Blocks HQ admins from accessing store-specific endpoints directly.

    Same caveat as get_hq_tenant: this only checks scope + store_id, not
    permissions. A "Cashier" store admin and an "Inventory (Store)" store
    admin both pass this check identically today â€” pair with
    require_permission(...) to actually differentiate them.
    """
    if ctx["scope"] not in ("store", "branch") or not ctx["store_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Store access only. Please log in as a store admin.",
        )
    return ctx


# â”€â”€ Either HQ or Store (shared routes) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async def get_any_tenant(ctx: Dict[str, Any] = Depends(get_tenant)) -> Dict[str, Any]:
    """
    Both HQ and Store admins can access.
    Use for: stock transfers, reports (with scope-based filtering)

    The route itself checks ctx["scope"] to decide what to return:
        if ctx["scope"] == "hq":    â†’ return all stores' data
        if ctx["scope"] == "store": â†’ return only their store's data
    """
    return ctx


# â”€â”€ Permission enforcement â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def require_permission(permission: str):
    """
    Dependency factory â€” returns a dependency that requires BOTH a valid
    tenant context AND the given permission string present in the admin's
    `permissions` array, checked live against admins_collection (via the
    ctx["_permissions"] already fetched in get_tenant, so no extra query).

    This is the piece that was previously missing entirely: the Add Admin
    modal lets HQ tick boxes like "Inventory", "Purchase Orders",
    "Stock Transfer" â€” those were saved to the DB and displayed back in the
    admin table, but no route ever read them. Every route was reachable by
    any admin with the right scope (hq/store), regardless of which
    permission checkboxes were ticked.

    Usage â€” layer on top of scope, don't replace it:
        @router.post("/{id}/receive")
        async def receive(ctx: dict = Depends(require_permission("stock_transfer"))):
            ...

    This does NOT separately re-check scope â€” it depends on get_tenant,
    which any admin (hq or store) satisfies as long as they're authenticated
    and active. If a route should ALSO be HQ-only or store-only regardless
    of permission, compose explicitly:

        async def route(
            ctx: dict = Depends(get_hq_tenant),
            _perm: dict = Depends(require_permission("vendors")),
        ):
            ...

    (FastAPI dedupes the underlying get_tenant call across both
    dependencies in the same request, so this isn't a double DB hit.)
    """
    async def checker(ctx: Dict[str, Any] = Depends(get_tenant)) -> Dict[str, Any]:
        perms = ctx.get("_permissions") or []
        if permission not in perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permission: '{permission}'. "
                       f"Contact your admin to have this permission granted.",
            )
        return ctx
    return checker


def require_department(department: str):
    """
    Same idea as require_permission, but checks managedDepartments instead.
    Useful when access should be gated by department membership rather than
    (or in addition to) a specific permission â€” e.g. only admins with
    "Inventory (Store)" in their managedDepartments can touch store-level
    GRN receiving, regardless of which individual permission checkboxes
    were set.
    """
    async def checker(ctx: Dict[str, Any] = Depends(get_tenant)) -> Dict[str, Any]:
        depts = ctx.get("_managed_departments") or []
        if department not in depts:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action requires the '{department}' department assignment.",
            )
        return ctx
    return checker

