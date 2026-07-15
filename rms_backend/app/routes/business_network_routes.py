"""Opt-in B2B discovery and vendor-to-vendor connection requests."""

from datetime import datetime
from typing import Optional
import re

from bson import ObjectId
from fastapi import APIRouter, Header, HTTPException, Query
from pymongo.errors import DuplicateKeyError

from ..db import vendors_collection, business_connections_collection
from .vendor_routes import decode_token
from .subscription_routes import get_vendor_tier


router = APIRouter(prefix="/api/business-network", tags=["Business Network"])

VALID_BUSINESS_TYPES = {
    "general_vendor", "wholesaler", "manufacturer", "distributor", "exporter",
    "fabric_supplier", "retailer",
}


def _vendor_id(authorization: Optional[str]) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization token missing")
    decoded = decode_token(authorization.split(" ", 1)[1])
    vendor_id = (decoded or {}).get("vendor_id")
    if not vendor_id or not ObjectId.is_valid(vendor_id):
        raise HTTPException(status_code=401, detail="Invalid or expired vendor session")
    return vendor_id


def _public_profile(vendor: dict, tier: Optional[dict] = None) -> dict:
    return {
        "vendor_id": str(vendor["_id"]),
        "name": vendor.get("name") or vendor.get("vendor_name") or "Business",
        "brand_name": vendor.get("brandName") or "",
        "business_type": vendor.get("business_type") or [],
        "product_categories": vendor.get("product_categories") or [],
        "city": vendor.get("cityName") or "",
        "state": vendor.get("state") or "",
        "website": vendor.get("website") or "",
        "headline": vendor.get("marketplace_headline") or "",
        "description": vendor.get("marketplace_description") or "",
        "featured_badge": bool((tier or {}).get("featured_badge")),
        "plan_label": (tier or {}).get("label", "Free"),
    }


async def _get_vendor(vendor_id: str) -> dict:
    vendor = await vendors_collection.find_one({"_id": ObjectId(vendor_id)})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not found")
    return vendor


@router.get("/me/visibility")
async def get_visibility(authorization: str = Header(None)):
    vendor_id = _vendor_id(authorization)
    vendor = await _get_vendor(vendor_id)
    return {
        "marketplace_visible": bool(vendor.get("marketplace_visible", False)),
        "headline": vendor.get("marketplace_headline") or "",
        "description": vendor.get("marketplace_description") or "",
        "profile": _public_profile(vendor),
    }


@router.patch("/me/visibility")
async def update_visibility(payload: dict, authorization: str = Header(None)):
    vendor_id = _vendor_id(authorization)
    vendor = await _get_vendor(vendor_id)
    visible = bool(payload.get("marketplace_visible", False))
    if visible and not (vendor.get("business_type") or []):
        raise HTTPException(status_code=400, detail="Select a business type in My Categories before joining the network.")

    headline = str(payload.get("headline") or "").strip()[:120]
    description = str(payload.get("description") or "").strip()[:800]
    await vendors_collection.update_one(
        {"_id": ObjectId(vendor_id)},
        {"$set": {
            "marketplace_visible": visible,
            "marketplace_headline": headline,
            "marketplace_description": description,
            "marketplace_updated_at": datetime.utcnow(),
        }},
    )
    return {"message": "Business Network visibility updated.", "marketplace_visible": visible}


@router.get("/discover")
async def discover_businesses(
    q: str = "",
    business_type: str = "",
    location: str = "",
    page: int = Query(1, ge=1),
    authorization: str = Header(None),
):
    vendor_id = _vendor_id(authorization)
    tier = await get_vendor_tier(vendor_id)
    page_size = tier["network_page_size"]

    query: dict = {"marketplace_visible": True, "_id": {"$ne": ObjectId(vendor_id)}}
    if business_type:
        if business_type not in VALID_BUSINESS_TYPES:
            raise HTTPException(status_code=400, detail="Invalid business type filter")
        query["business_type"] = business_type
    if q.strip():
        term = re.escape(q.strip())
        query["$or"] = [
            {"name": {"$regex": term, "$options": "i"}},
            {"brandName": {"$regex": term, "$options": "i"}},
            {"product_categories": {"$regex": term, "$options": "i"}},
            {"marketplace_headline": {"$regex": term, "$options": "i"}},
        ]
    if location.strip():
        place = re.escape(location.strip())
        query.setdefault("$and", []).append({"$or": [
            {"cityName": {"$regex": place, "$options": "i"}},
            {"state": {"$regex": place, "$options": "i"}},
        ]})

    total = await vendors_collection.count_documents(query)
    rows = []
    cursor = vendors_collection.find(query).sort("name", 1).skip((page - 1) * page_size).limit(page_size)
    async for vendor in cursor:
        vendor_tier = await get_vendor_tier(str(vendor["_id"]))
        rows.append(_public_profile(vendor, vendor_tier))

    existing = {}
    target_ids = [ObjectId(row["vendor_id"]) for row in rows]
    if target_ids:
        async for connection in business_connections_collection.find({
            "$or": [
                {"requester_vendor_id": ObjectId(vendor_id), "target_vendor_id": {"$in": target_ids}},
                {"target_vendor_id": ObjectId(vendor_id), "requester_vendor_id": {"$in": target_ids}},
            ]
        }):
            other_id = connection["target_vendor_id"] if connection["requester_vendor_id"] == ObjectId(vendor_id) else connection["requester_vendor_id"]
            existing[str(other_id)] = connection.get("status", "pending")
    for row in rows:
        row["connection_status"] = existing.get(row["vendor_id"])

    return {
        "data": rows, "total": total, "page": page,
        "page_size": page_size, "pages": max(1, (total + page_size - 1) // page_size),
        "subscription": {"tier": tier["tier"], "label": tier["label"], "monthly_request_limit": tier["network_requests_per_month"]},
    }


@router.post("/connections", status_code=201)
async def request_connection(payload: dict, authorization: str = Header(None)):
    vendor_id = _vendor_id(authorization)
    target_id = str(payload.get("target_vendor_id") or "")
    if not ObjectId.is_valid(target_id) or target_id == vendor_id:
        raise HTTPException(status_code=400, detail="Valid target_vendor_id is required")
    target = await vendors_collection.find_one({"_id": ObjectId(target_id), "marketplace_visible": True})
    if not target:
        raise HTTPException(status_code=404, detail="This business is not available in the network")

    tier = await get_vendor_tier(vendor_id)
    monthly_limit = tier["network_requests_per_month"]
    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if monthly_limit is not None:
        used = await business_connections_collection.count_documents({
            "requester_vendor_id": ObjectId(vendor_id), "created_at": {"$gte": month_start},
        })
        if used >= monthly_limit:
            raise HTTPException(status_code=403, detail=f"Your {tier['label']} plan allows {monthly_limit} connection requests per month.")

    pair_key = "::".join(sorted((vendor_id, target_id)))
    doc = {
        "pair_key": pair_key,
        "requester_vendor_id": ObjectId(vendor_id),
        "target_vendor_id": ObjectId(target_id),
        "message": str(payload.get("message") or "").strip()[:500],
        "status": "pending",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    try:
        result = await business_connections_collection.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="A connection already exists with this business")
    return {"message": "Connection request sent.", "connection_id": str(result.inserted_id), "status": "pending"}


@router.get("/connections")
async def list_connections(authorization: str = Header(None)):
    vendor_id = _vendor_id(authorization)
    oid = ObjectId(vendor_id)
    docs = []
    other_ids = set()
    async for connection in business_connections_collection.find({
        "$or": [{"requester_vendor_id": oid}, {"target_vendor_id": oid}]
    }).sort("updated_at", -1):
        docs.append(connection)
        other_ids.add(connection["target_vendor_id"] if connection["requester_vendor_id"] == oid else connection["requester_vendor_id"])

    vendor_map = {}
    if other_ids:
        async for vendor in vendors_collection.find({"_id": {"$in": list(other_ids)}}):
            vendor_map[vendor["_id"]] = vendor

    rows = []
    for connection in docs:
        incoming = connection["target_vendor_id"] == oid
        other_id = connection["requester_vendor_id"] if incoming else connection["target_vendor_id"]
        other = vendor_map.get(other_id, {"_id": other_id})
        profile = _public_profile(other)
        if connection.get("status") == "accepted":
            profile["contact"] = {
                "email": other.get("email") or "",
                "mobile": other.get("contactMobile") or "",
            }
        rows.append({
            "connection_id": str(connection["_id"]), "direction": "incoming" if incoming else "outgoing",
            "status": connection.get("status", "pending"), "message": connection.get("message") or "",
            "created_at": str(connection.get("created_at") or ""), "business": profile,
        })
    return {"data": rows, "count": len(rows)}


@router.patch("/connections/{connection_id}")
async def update_connection(connection_id: str, payload: dict, authorization: str = Header(None)):
    vendor_id = _vendor_id(authorization)
    if not ObjectId.is_valid(connection_id):
        raise HTTPException(status_code=400, detail="Invalid connection ID")
    connection = await business_connections_collection.find_one({"_id": ObjectId(connection_id)})
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    action = str(payload.get("action") or "").lower()
    oid = ObjectId(vendor_id)
    if action in ("accept", "decline"):
        if connection["target_vendor_id"] != oid or connection.get("status") != "pending":
            raise HTTPException(status_code=403, detail="Only the receiving business can respond to a pending request")
        status = "accepted" if action == "accept" else "declined"
    elif action == "cancel":
        if connection["requester_vendor_id"] != oid or connection.get("status") != "pending":
            raise HTTPException(status_code=403, detail="Only the requesting business can cancel a pending request")
        status = "cancelled"
    else:
        raise HTTPException(status_code=400, detail="action must be accept, decline, or cancel")

    await business_connections_collection.update_one(
        {"_id": connection["_id"]},
        {"$set": {"status": status, "updated_at": datetime.utcnow()}},
    )
    return {"message": f"Connection {status}.", "status": status}
