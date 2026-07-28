"""Secure buyer-vendor conversation threads attached to RMS business documents."""
from datetime import datetime
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from ..db import (
    catalogue_inquiries_collection,
    document_messages_collection,
    purchaseorders_collection,
    supplier_returns_collection,
    vendors_collection,
)
from .deps import get_tenant
from .vendor_routes import require_vendor_identity

router = APIRouter(prefix="/api/document-messages", tags=["Document Messages"])
SUPPORTED_DOCUMENTS = {"rfq", "purchase_order", "supplier_return"}


def _valid_id(value: str, label: str = "document") -> ObjectId:
    if not ObjectId.is_valid(str(value)):
        raise HTTPException(status_code=400, detail=f"Invalid {label} ID.")
    return ObjectId(str(value))


def _message_text(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    if len(text) > 2000:
        raise HTTPException(status_code=400, detail="Message must be 2,000 characters or fewer.")
    return text


def _serialize_message(row: dict) -> dict:
    return {
        "id": str(row["_id"]),
        "document_type": row["document_type"],
        "document_id": row["document_id"],
        "sender_type": row["sender_type"],
        "sender_name": row.get("sender_name") or ("Vendor" if row.get("sender_type") == "vendor" else "Buyer"),
        "message": row.get("message", ""),
        "created_at": row.get("created_at").isoformat() if row.get("created_at") else "",
        "read_by_buyer": bool(row.get("read_by_buyer")),
        "read_by_vendor": bool(row.get("read_by_vendor")),
    }


def _document_summary(document_type: str, document: dict) -> dict:
    if document_type == "rfq":
        return {
            "title": document.get("item_name") or "RFQ",
            "reference": document.get("comparison_group_id") or str(document["_id"]),
            "vendor_name": document.get("vendor_name") or "Vendor",
        }
    if document_type == "purchase_order":
        return {
            "title": document.get("orderNo") or "Purchase Order",
            "reference": document.get("orderNo") or str(document["_id"]),
            "vendor_name": document.get("vendorName") or "Vendor",
        }
    return {
        "title": document.get("srn_no") or "Supplier Return Note",
        "reference": document.get("srn_no") or str(document["_id"]),
        "vendor_name": document.get("vendor_name") or "Vendor",
    }


async def _resolve_for_admin(document_type: str, document_id: str, tenant_id: str) -> tuple[dict, ObjectId]:
    if document_type not in SUPPORTED_DOCUMENTS:
        raise HTTPException(status_code=400, detail="Unsupported document type.")
    object_id = _valid_id(document_id)
    if document_type == "rfq":
        doc = await catalogue_inquiries_collection.find_one({"_id": object_id, "tenant_id": tenant_id})
    elif document_type == "purchase_order":
        doc = await purchaseorders_collection.find_one({"_id": object_id, "tenant_id": tenant_id})
    else:
        doc = await supplier_returns_collection.find_one({"_id": object_id, "tenant_id": tenant_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    vendor_value = doc.get("vendor_id")
    if not vendor_value or not ObjectId.is_valid(str(vendor_value)):
        raise HTTPException(status_code=409, detail="This document is not linked to a registered vendor, so a portal conversation is unavailable.")
    vendor_id = ObjectId(str(vendor_value))
    vendor = await vendors_collection.find_one({"_id": vendor_id}, {"name": 1, "brandName": 1})
    doc["vendor_name"] = doc.get("vendor_name") or doc.get("vendorName") or (vendor or {}).get("name") or (vendor or {}).get("brandName") or "Vendor"
    return doc, vendor_id


async def _resolve_for_vendor(document_type: str, document_id: str, vendor_id: ObjectId) -> dict:
    if document_type not in SUPPORTED_DOCUMENTS:
        raise HTTPException(status_code=400, detail="Unsupported document type.")
    object_id = _valid_id(document_id)
    vendor_filter = {"$in": [vendor_id, str(vendor_id)]}
    if document_type == "rfq":
        doc = await catalogue_inquiries_collection.find_one({"_id": object_id, "vendor_id": vendor_filter})
    elif document_type == "purchase_order":
        doc = await purchaseorders_collection.find_one({"_id": object_id, "vendor_id": vendor_filter})
    else:
        doc = await supplier_returns_collection.find_one({"_id": object_id, "vendor_id": vendor_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found or not assigned to your vendor account.")
    doc["vendor_name"] = doc.get("vendor_name") or doc.get("vendorName") or "Your business"
    return doc


async def _list_messages(document_type: str, document_id: str, tenant_id: str, viewer: str) -> list[dict]:
    query = {"document_type": document_type, "document_id": str(document_id), "tenant_id": tenant_id}
    rows = await document_messages_collection.find(query).sort("created_at", 1).limit(500).to_list(500)
    read_field = "read_by_buyer" if viewer == "buyer" else "read_by_vendor"
    other_sender = "vendor" if viewer == "buyer" else "buyer"
    unread_ids = [row["_id"] for row in rows if row.get("sender_type") == other_sender and not row.get(read_field)]
    if unread_ids:
        await document_messages_collection.update_many({"_id": {"$in": unread_ids}}, {"$set": {read_field: True, "updated_at": datetime.utcnow()}})
        for row in rows:
            if row["_id"] in unread_ids:
                row[read_field] = True
    return [_serialize_message(row) for row in rows]


@router.get("/admin/unread-count")
async def admin_unread_count(ctx: dict = Depends(get_tenant)):
    """Unread vendor messages across every document belonging to this retailer."""
    query = {
        "tenant_id": ctx["tenant_id"],
        "sender_type": "vendor",
        "read_by_buyer": {"$ne": True},
    }
    count = await document_messages_collection.count_documents(query)
    return {"count": count}


@router.get("/vendor/unread-count")
async def vendor_unread_count(vendor: dict = Depends(require_vendor_identity)):
    """Unread buyer messages assigned to the logged-in vendor only."""
    query = {
        "vendor_id": vendor["_id"],
        "sender_type": "buyer",
        "read_by_vendor": {"$ne": True},
    }
    count = await document_messages_collection.count_documents(query)
    return {"count": count}


@router.get("/admin/{document_type}/{document_id}")
async def admin_thread(document_type: str, document_id: str, ctx: dict = Depends(get_tenant)):
    document, vendor_id = await _resolve_for_admin(document_type, document_id, ctx["tenant_id"])
    messages = await _list_messages(document_type, document_id, ctx["tenant_id"], "buyer")
    return {"data": messages, "document": _document_summary(document_type, document), "vendor_id": str(vendor_id)}


@router.post("/admin/{document_type}/{document_id}", status_code=201)
async def send_admin_message(document_type: str, document_id: str, payload: dict, ctx: dict = Depends(get_tenant)):
    document, vendor_id = await _resolve_for_admin(document_type, document_id, ctx["tenant_id"])
    now = datetime.utcnow()
    row = {
        "document_type": document_type,
        "document_id": str(document_id),
        "tenant_id": ctx["tenant_id"],
        "vendor_id": vendor_id,
        "sender_type": "buyer",
        "sender_id": str(ctx.get("admin_id") or ""),
        "sender_name": ctx.get("admin_name") or "Buyer",
        "message": _message_text(payload.get("message")),
        "read_by_buyer": True,
        "read_by_vendor": False,
        "created_at": now,
        "updated_at": now,
    }
    result = await document_messages_collection.insert_one(row)
    row["_id"] = result.inserted_id
    return {"message": "Message sent.", "data": _serialize_message(row), "document": _document_summary(document_type, document)}


@router.get("/vendor/{document_type}/{document_id}")
async def vendor_thread(document_type: str, document_id: str, vendor: dict = Depends(require_vendor_identity)):
    document = await _resolve_for_vendor(document_type, document_id, vendor["_id"])
    messages = await _list_messages(document_type, document_id, document["tenant_id"], "vendor")
    return {"data": messages, "document": _document_summary(document_type, document)}


@router.post("/vendor/{document_type}/{document_id}", status_code=201)
async def send_vendor_message(document_type: str, document_id: str, payload: dict, vendor: dict = Depends(require_vendor_identity)):
    document = await _resolve_for_vendor(document_type, document_id, vendor["_id"])
    now = datetime.utcnow()
    row = {
        "document_type": document_type,
        "document_id": str(document_id),
        "tenant_id": document["tenant_id"],
        "vendor_id": vendor["_id"],
        "sender_type": "vendor",
        "sender_id": str(vendor["_id"]),
        "sender_name": vendor.get("name") or vendor.get("brandName") or "Vendor",
        "message": _message_text(payload.get("message")),
        "read_by_buyer": False,
        "read_by_vendor": True,
        "created_at": now,
        "updated_at": now,
    }
    result = await document_messages_collection.insert_one(row)
    row["_id"] = result.inserted_id
    return {"message": "Message sent.", "data": _serialize_message(row), "document": _document_summary(document_type, document)}