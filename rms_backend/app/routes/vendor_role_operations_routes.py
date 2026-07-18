"""Saved operational profiles for the specialist vendor workspaces."""

from datetime import datetime

from bson import ObjectId
from fastapi import APIRouter, Header, HTTPException

from ..db import vendor_role_operations_collection, vendors_collection
from .vendor_routes import decode_token

router = APIRouter(prefix="/api/vendor-role-operations", tags=["Vendor Role Operations"])

ROLE_FIELDS = {
    "wholesaler": {"minimum_order_quantity", "minimum_order_unit", "bulk_price_note", "stock_availability", "service_regions", "dispatch_lead_days"},
    "manufacturer": {"monthly_capacity", "capacity_unit", "minimum_order_quantity", "production_lead_days", "quality_standards", "services"},
    "fabric_supplier": {"fabric_types", "compositions", "gsm_range", "width_range", "shade_colours", "minimum_order_quantity", "sample_available"},
    "distributor": {"brands", "territories", "sales_channels", "stock_availability", "dispatch_lead_days", "minimum_order_quantity"},
    "exporter": {"export_countries", "incoterms", "currencies", "minimum_order_quantity", "export_lead_days", "export_documents"},
    "retailer": {"store_categories", "sourcing_regions", "minimum_order_quantity", "seasonal_requirements", "delivery_locations"},
}


def _vendor_id(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Vendor authorization token missing.")
    decoded = decode_token(authorization.split(" ", 1)[1])
    vendor_id = (decoded or {}).get("vendor_id")
    if not vendor_id or not ObjectId.is_valid(vendor_id):
        raise HTTPException(status_code=401, detail="Invalid or expired vendor session.")
    return str(vendor_id)


async def _require_role(vendor_id: str, role: str) -> None:
    if role not in ROLE_FIELDS:
        raise HTTPException(status_code=404, detail="Unknown vendor workspace.")
    vendor = await vendors_collection.find_one({"_id": ObjectId(vendor_id)}, {"business_type": 1})
    if not vendor or role not in (vendor.get("business_type") or []):
        raise HTTPException(status_code=403, detail="Add this business type in My Categories before using this workspace.")


def _clean_data(role: str, incoming: object) -> dict:
    if not isinstance(incoming, dict):
        raise HTTPException(status_code=400, detail="Workspace data must be an object.")
    cleaned: dict = {}
    for key in ROLE_FIELDS[role]:
        value = incoming.get(key)
        if isinstance(value, list):
            cleaned[key] = [str(item).strip()[:120] for item in value if str(item).strip()][:40]
        elif isinstance(value, bool):
            cleaned[key] = value
        elif value is not None:
            cleaned[key] = str(value).strip()[:1000]
    return cleaned


@router.get("/{role}")
async def get_role_operations(role: str, authorization: str = Header(None)):
    vendor_id = _vendor_id(authorization)
    await _require_role(vendor_id, role)
    doc = await vendor_role_operations_collection.find_one({"vendor_id": ObjectId(vendor_id), "role": role})
    return {"role": role, "data": (doc or {}).get("data", {}), "updated_at": (doc or {}).get("updated_at")}


@router.put("/{role}")
async def save_role_operations(role: str, payload: dict, authorization: str = Header(None)):
    vendor_id = _vendor_id(authorization)
    await _require_role(vendor_id, role)
    now = datetime.utcnow()
    data = _clean_data(role, payload.get("data"))
    await vendor_role_operations_collection.update_one(
        {"vendor_id": ObjectId(vendor_id), "role": role},
        {"$set": {"data": data, "updated_at": now}, "$setOnInsert": {"vendor_id": ObjectId(vendor_id), "role": role, "created_at": now}},
        upsert=True,
    )
    return {"message": "Business operations saved.", "role": role, "data": data, "updated_at": now.isoformat()}
