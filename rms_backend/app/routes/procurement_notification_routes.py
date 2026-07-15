from datetime import datetime
from typing import Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException

from ..db import procurement_notifications_collection
from .deps import get_hq_tenant
from .vendor_routes import decode_token

router = APIRouter(prefix="/api/procurement-notifications", tags=["Procurement Notifications"])


def _vendor_id(authorization: Optional[str]) -> ObjectId:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Vendor authorization required.")
    decoded = decode_token(authorization.split(" ", 1)[1])
    value = (decoded or {}).get("vendor_id")
    if not value or not ObjectId.is_valid(value):
        raise HTTPException(status_code=401, detail="Invalid vendor session.")
    return ObjectId(value)


async def notify_buyer(tenant_id: str, event_type: str, title: str, message: str, *, inquiry_id=None, vendor_id=None, metadata=None):
    return await procurement_notifications_collection.insert_one({
        "recipient_type": "buyer", "tenant_id": tenant_id, "vendor_id": vendor_id,
        "event_type": event_type, "category": "quick_order", "title": title, "message": message,
        "inquiry_id": inquiry_id, "metadata": metadata or {}, "read": False, "created_at": datetime.utcnow(),
    })


async def notify_vendor(vendor_id, event_type: str, title: str, message: str, *, tenant_id=None, inquiry_id=None, metadata=None):
    oid = vendor_id if isinstance(vendor_id, ObjectId) else ObjectId(str(vendor_id))
    return await procurement_notifications_collection.insert_one({
        "recipient_type": "vendor", "vendor_id": oid, "tenant_id": tenant_id,
        "event_type": event_type, "category": "inquiries", "title": title, "message": message,
        "inquiry_id": inquiry_id, "metadata": metadata or {}, "read": False, "created_at": datetime.utcnow(),
    })


def _serialize(row):
    return {
        "id": str(row["_id"]), "event_type": row.get("event_type", ""), "category": row.get("category", ""),
        "title": row.get("title", ""), "message": row.get("message", ""), "read": bool(row.get("read")),
        "inquiry_id": str(row.get("inquiry_id") or ""), "metadata": row.get("metadata") or {},
        "created_at": str(row.get("created_at") or ""),
    }


@router.get("/buyer")
async def buyer_notifications(limit: int = 50, ctx: dict = Depends(get_hq_tenant)):
    rows = await procurement_notifications_collection.find({"recipient_type": "buyer", "tenant_id": ctx["tenant_id"]}).sort("created_at", -1).limit(min(max(limit, 1), 100)).to_list(None)
    return {"status": "success", "data": [_serialize(row) for row in rows]}


@router.get("/buyer/unread-count")
async def buyer_unread_count(ctx: dict = Depends(get_hq_tenant)):
    count = await procurement_notifications_collection.count_documents({"recipient_type": "buyer", "tenant_id": ctx["tenant_id"], "read": False})
    return {"status": "success", "count": count}


@router.post("/buyer/read")
async def mark_buyer_read(payload: dict, ctx: dict = Depends(get_hq_tenant)):
    query = {"recipient_type": "buyer", "tenant_id": ctx["tenant_id"], "read": False}
    if payload.get("category"): query["category"] = payload["category"]
    result = await procurement_notifications_collection.update_many(query, {"$set": {"read": True, "read_at": datetime.utcnow()}})
    return {"status": "success", "updated": result.modified_count}


@router.post("/buyer/{notification_id}/read")
async def mark_one_buyer_read(notification_id: str, ctx: dict = Depends(get_hq_tenant)):
    if not ObjectId.is_valid(notification_id): raise HTTPException(status_code=400, detail="Invalid notification ID.")
    result = await procurement_notifications_collection.update_one({"_id": ObjectId(notification_id), "recipient_type": "buyer", "tenant_id": ctx["tenant_id"]}, {"$set": {"read": True, "read_at": datetime.utcnow()}})
    if not result.matched_count: raise HTTPException(status_code=404, detail="Notification not found.")
    return {"status": "success"}


@router.get("/vendor")
async def vendor_notifications(limit: int = 50, authorization: str = Header(None)):
    vendor_id = _vendor_id(authorization)
    rows = await procurement_notifications_collection.find({"recipient_type": "vendor", "vendor_id": vendor_id}).sort("created_at", -1).limit(min(max(limit, 1), 100)).to_list(None)
    return {"status": "success", "data": [_serialize(row) for row in rows]}


@router.get("/vendor/unread-count")
async def vendor_unread_count(authorization: str = Header(None)):
    vendor_id = _vendor_id(authorization)
    count = await procurement_notifications_collection.count_documents({"recipient_type": "vendor", "vendor_id": vendor_id, "read": False})
    return {"status": "success", "count": count}


@router.post("/vendor/read")
async def mark_vendor_read(payload: dict, authorization: str = Header(None)):
    vendor_id = _vendor_id(authorization)
    query = {"recipient_type": "vendor", "vendor_id": vendor_id, "read": False}
    if payload.get("category"): query["category"] = payload["category"]
    result = await procurement_notifications_collection.update_many(query, {"$set": {"read": True, "read_at": datetime.utcnow()}})
    return {"status": "success", "updated": result.modified_count}


@router.post("/vendor/{notification_id}/read")
async def mark_one_vendor_read(notification_id: str, authorization: str = Header(None)):
    vendor_id = _vendor_id(authorization)
    if not ObjectId.is_valid(notification_id): raise HTTPException(status_code=400, detail="Invalid notification ID.")
    result = await procurement_notifications_collection.update_one({"_id": ObjectId(notification_id), "recipient_type": "vendor", "vendor_id": vendor_id}, {"$set": {"read": True, "read_at": datetime.utcnow()}})
    if not result.matched_count: raise HTTPException(status_code=404, detail="Notification not found.")
    return {"status": "success"}
