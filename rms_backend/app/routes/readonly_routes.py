"""Tenant-bound integration reads using a separate MongoDB principal."""
import re
import secrets
from functools import lru_cache
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.encoders import jsonable_encoder
from fastapi.security import APIKeyHeader
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import PyMongoError

from ..config import settings

router = APIRouter(prefix="/api/readonly/v1", tags=["Read-only integration"])
key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# Inclusion projections prevent new database fields from becoming public.
RESOURCES = {
    "products": ("barcode product_name sku hsn_code gst_rate mrp product_type category1 category2 category3 category4 category5 category6 stockQty quantity createdAt updatedAt", ("barcode", "product_name", "sku")),
    "inventory": ("barcode product_name sku product_id store_id quantity stockQty mrp createdAt updatedAt", ("barcode", "product_name", "sku")),
    "stores": ("name store_name store_code store_type status createdAt updatedAt", ("name", "store_name", "store_code")),
}


async def authorize(response: Response, key: Optional[str] = Depends(key_header)):
    response.headers["Cache-Control"] = "no-store"
    if not all((settings.readonly_api_key, settings.readonly_tenant_id, settings.readonly_mongodb_uri)):
        raise HTTPException(503, "Read-only integration is not configured")
    if not key or not secrets.compare_digest(key.encode(), settings.readonly_api_key.encode()):
        raise HTTPException(401, "Invalid API key")
    return settings.readonly_tenant_id


@lru_cache(maxsize=1)
def read_database():
    # Never fall back to the application's write-capable connection.
    client = AsyncIOMotorClient(settings.readonly_mongodb_uri, connectTimeoutMS=5000,
                               serverSelectionTimeoutMS=5000, socketTimeoutMS=10000)
    return client[settings.mongodb_db]


def resource_collection(resource):
    if resource not in RESOURCES:
        raise HTTPException(404, "Unknown resource")
    fields, search_fields = RESOURCES[resource]
    return read_database()[resource], {field: 1 for field in fields.split()}, search_fields


def serialize(doc):
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    return jsonable_encoder(doc, custom_encoder={ObjectId: str})


@router.get("/resources")
async def resources(tenant: str = Depends(authorize)):
    return {"resources": list(RESOURCES)}


@router.get("/{resource}")
async def list_records(resource: str, limit: int = Query(50, ge=1, le=200),
                       after: Optional[str] = None,
                       q: Optional[str] = Query(None, min_length=1, max_length=100),
                       tenant: str = Depends(authorize)):
    collection, projection, search_fields = resource_collection(resource)
    query = {"tenant_id": tenant}
    if after:
        if not ObjectId.is_valid(after):
            raise HTTPException(422, "Invalid pagination cursor")
        query["_id"] = {"$gt": ObjectId(after)}
    if q:
        query["$or"] = [{field: {"$regex": re.escape(q), "$options": "i"}} for field in search_fields]
    try:
        docs = await collection.find(query, projection).sort("_id", 1).limit(limit + 1).max_time_ms(5000).to_list(length=limit + 1)
    except PyMongoError:
        raise HTTPException(503, "Read-only database unavailable") from None
    return {"items": [serialize(doc) for doc in docs[:limit]],
            "next_cursor": str(docs[limit - 1]["_id"]) if len(docs) > limit else None}


@router.get("/{resource}/{record_id}")
async def get_record(resource: str, record_id: str, tenant: str = Depends(authorize)):
    collection, projection, _ = resource_collection(resource)
    if not ObjectId.is_valid(record_id):
        raise HTTPException(422, "Invalid record ID")
    try:
        doc = await collection.find_one({"tenant_id": tenant, "_id": ObjectId(record_id)}, projection, max_time_ms=5000)
    except PyMongoError:
        raise HTTPException(503, "Read-only database unavailable") from None
    if doc is None:
        raise HTTPException(404, "Record not found")
    return serialize(doc)
