# ─────────────────────────────────────────────────────────────────────────────
# store_helper.py  — Add this file to app/routes/ or app/
#
# Shared helper used by inventory_routes, grn_routes, cashier_routes, etc.
# to extract store context from the Authorization header.
#
# USAGE in any route:
#   from ..store_helper import get_store_context
#
#   @router.get("/something")
#   async def my_route(authorization: str = Header(None)):
#       store = await get_store_context(authorization)
#       query = store["query"]   # {} for HQ, {"store_id": "KOL_001"} for store
#       store_id   = store["store_id"]    # None or "KOL_001"
#       store_name = store["store_name"]  # None or "CitiMart Kolkata"
#       scope      = store["scope"]       # "hq" or "store"
# ─────────────────────────────────────────────────────────────────────────────
'''
from jose import jwt, JWTError
from ..config import settings
from typing import Optional


def _decode_bearer(authorization: Optional[str]) -> dict:
    """Decode JWT from Authorization header. Returns empty dict on failure."""
    if not authorization or not authorization.startswith("Bearer "):
        return {}
    token = authorization.split(" ")[1]
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
    except (JWTError, Exception):
        return {}


async def get_store_context(authorization: Optional[str] = None) -> dict:
    """
    Extract store context from JWT.

    Returns:
      {
        "store_id":   None | "KOL_001",
        "store_name": None | "CitiMart Kolkata",
        "store_type": None | "store" | "branch",
        "scope":      "hq" | "store",
        "query":      {}   (HQ — no filter)
                   OR {"store_id": "KOL_001"}  (store-scoped)
      }

    KEY RULE:
      store_id = None  → HQ scope → query = {} → sees EVERYTHING
      store_id = "xyz" → store scope → query = {"store_id": "xyz"} → scoped
    """
    payload    = _decode_bearer(authorization)
    store_id   = payload.get("store_id")   or None
    store_name = payload.get("store_name") or None
    store_type = payload.get("store_type") or None
    scope      = "hq" if not store_id else "store"
    query      = {} if not store_id else {"store_id": store_id}

    return {
        "admin_id":   str((admin or {}).get("_id") or payload.get("sub") or ""),
        "admin_name": (admin or {}).get("name") or payload.get("name") or "",
        "store_id":   store_id,
        "store_name": store_name,
        "store_type": store_type,
        "scope":      scope,
        "query":      query,
    }
'''


from jose import jwt, JWTError
from ..config import settings
from ..db import admins_collection
from bson import ObjectId
from typing import Optional


def _decode_bearer(authorization: Optional[str]) -> dict:
    """Decode JWT from Authorization header. Returns empty dict on failure."""
    if not authorization or not authorization.startswith("Bearer "):
        return {}
    token = authorization.split(" ")[1]
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
    except (JWTError, Exception):
        return {}


async def get_store_context(authorization: Optional[str] = None) -> dict:
    """
    Extract store context from JWT.

    Returns:
      {
        "store_id":   None | "KOL_001",
        "store_name": None | "CitiMart Kolkata",
        "store_type": None | "store" | "branch",
        "scope":      "hq" | "store",
        "tenant_id":  None | "citimart",
        "query":      {}   (HQ — no store filter)
                   OR {"store_id": "KOL_001"}  (store-scoped)
      }

    KEY RULE (store scoping, unchanged):
      store_id = None  → HQ scope → query = {} → sees EVERYTHING WITHIN THE TENANT
      store_id = "xyz" → store scope → query = {"store_id": "xyz"} → scoped to that store

    tenant_id (added):
      This is the SEPARATE, tenant-level isolation boundary — HQ scope still
      means "everything belonging to this store's/admin's tenant", never
      "everything across all tenants". Resolved the same way deps.get_tenant()
      resolves it: read tenant_id from the token first (fast path); if it's
      missing (older tokens issued before tenant_id was added to the JWT),
      fall back to looking up the admin record by "sub" in admins_collection.

      If tenant_id cannot be resolved at all, it is returned as None and the
      CALLER is responsible for rejecting the request (403) rather than this
      helper silently proceeding — a missing tenant_id must never be treated
      as "no filter" the way store_id=None correctly means "no store filter".
    """
    payload = _decode_bearer(authorization)

    store_id   = payload.get("store_id")   or None
    store_name = payload.get("store_name") or None
    store_type = payload.get("store_type") or None
    scope      = "hq" if not store_id else "store"

    # Load the live admin record on every request. Permissions can be edited
    # after a JWT is issued, so reading them only from the token would leave
    # permission changes stale until the next login.
    admin = None
    user_id = payload.get("sub")
    if user_id:
        try:
            admin = await admins_collection.find_one({"_id": ObjectId(user_id)})
        except Exception:
            admin = None

    tenant_id = payload.get("tenant_id") or (admin or {}).get("tenant_id") or None
    permissions = (admin or {}).get("permissions", [])

    query = {} if not store_id else {"store_id": store_id}

    return {
        "store_id":   store_id,
        "store_name": store_name,
        "store_type": store_type,
        "scope":      scope,
        "tenant_id":  tenant_id,
        "permissions": permissions,
        "query":      query,
    }
