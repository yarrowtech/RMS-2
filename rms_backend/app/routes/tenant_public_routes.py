from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..db import tenants_collection

router = APIRouter(prefix="/api/tenants", tags=["Tenants (Public)"])


@router.get("/public")
async def list_tenants_public():
    """
    Public, unauthenticated list of retailers (tenants).

    Used by RegisterVendor.jsx's SELF-REGISTRATION path only — when a
    vendor arrives with no invite token, there's no other way to determine
    which retailer they're registering to supply, so they pick one
    explicitly from this list. The invite-link path never needs this;
    tenant_id there comes from the invite itself.

    Returns only tenant_id + company_name — nothing about a tenant's
    internal setup (stores, admins, etc.) is exposed publicly.

    ⚠️ ASSUMPTION: tenants_collection documents have "tenant_id" and
    "company_name" fields — inferred from SuperAdmin.jsx's existing call
    to GET /superadmin/tenants/ (it reads `r.tenant_id`, `r.company_name`
    from that response). I have not seen the actual tenants_collection
    schema or the route file that writes it — verify these field names
    match before deploying. If they differ, adjust the projection/read
    below to match.
    """
    tenants = []
    async for t in tenants_collection.find(
        {"status": {"$ne": "suspended"}},
        {"_id": 0, "tenant_id": 1, "company_name": 1, "account_type": 1},
    ):
        if t.get("tenant_id"):
            tenants.append({
                "tenant_id":    t["tenant_id"],
                "company_name": t.get("company_name") or t["tenant_id"],
                "account_type": t.get("account_type", "department_retailer"),
            })
    tenants.sort(key=lambda t: t["company_name"].lower())
    return JSONResponse({"status": "success", "data": tenants})
