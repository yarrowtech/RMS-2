"""Supplier Return Note workflow for rejected retailer GRC quantities.

Rejected quantities never enter retailer available stock. A Supplier Return Note
records the commercial/logistics follow-up: vendor acknowledgement, dispatch,
and closure through replacement, credit note, refund, or write-off.
"""
from datetime import datetime
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException

from ..db import (
    grc_collection,
    purchaseorders_collection,
    supplier_returns_collection,
    tenants_collection,
    vendors_collection,
)
from .deps import get_receiving_tenant
from .vendor_routes import require_vendor_identity


router = APIRouter(prefix="/api/supplier-returns", tags=["Supplier Returns"])

OPEN_STATUSES = {"Open", "Closed", "Cancelled"}


def _number(value, field: str, *, minimum: float = 0.0) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail=f"{field} must be a number.")
    if result < minimum:
        raise HTTPException(status_code=400, detail=f"{field} must be at least {minimum}.")
    return result


def _text(value, field: str, *, required: bool = False, maximum: int = 600) -> str:
    result = str(value or "").strip()
    if required and not result:
        raise HTTPException(status_code=400, detail=f"{field} is required.")
    return result[:maximum]


def _serialise(document: dict) -> dict:
    row = dict(document)
    row["id"] = str(row.pop("_id"))
    for key in ("vendor_id", "po_id"):
        if row.get(key) is not None:
            row[key] = str(row[key])
    for key in ("created_at", "updated_at", "dispatched_at", "closed_at", "vendor_responded_at"):
        if row.get(key):
            row[key] = row[key].isoformat() if hasattr(row[key], "isoformat") else str(row[key])
    return row


async def _next_srn_number(tenant_id: str) -> str:
    now = datetime.utcnow()
    financial_year = f"{str(now.year)[-2:]}-{str(now.year + 1)[-2:]}" if now.month >= 4 else f"{str(now.year - 1)[-2:]}-{str(now.year)[-2:]}"
    last = await supplier_returns_collection.find_one(
        {"tenant_id": tenant_id, "srn_no": {"$regex": f"^SRN/\\d+/{financial_year}$"}},
        sort=[("created_at", -1)],
    )
    last_number = 0
    if last:
        try:
            last_number = int(str(last.get("srn_no", "")).split("/")[1])
        except (IndexError, ValueError):
            pass
    return f"SRN/{last_number + 1:06d}/{financial_year}"


async def _resolve_purchase_vendor(grc: dict, tenant_id: str) -> tuple[Optional[ObjectId], str]:
    po = None
    po_id = str(grc.get("po_id") or "")
    if ObjectId.is_valid(po_id):
        po = await purchaseorders_collection.find_one({"_id": ObjectId(po_id), "tenant_id": tenant_id})
    if not po and grc.get("poNo"):
        po = await purchaseorders_collection.find_one({"orderNo": grc["poNo"], "tenant_id": tenant_id})

    vendor_value = (po or {}).get("vendor_id")
    if vendor_value and ObjectId.is_valid(str(vendor_value)):
        vendor_id = ObjectId(str(vendor_value))
        vendor = await vendors_collection.find_one({"_id": vendor_id}, {"name": 1, "brandName": 1})
        if vendor:
            return vendor_id, vendor.get("name") or vendor.get("brandName") or grc.get("vendorName", "Vendor")
    return None, grc.get("vendorName") or (po or {}).get("vendorName") or "Vendor"


async def _returnable_lines(grc: dict, tenant_id: str) -> list[dict]:
    existing = await supplier_returns_collection.find(
        {"tenant_id": tenant_id, "grc_id": str(grc["_id"]), "status": {"$ne": "Cancelled"}},
        {"lines": 1},
    ).to_list(500)
    already_requested: dict[int, float] = {}
    for note in existing:
        for line in note.get("lines", []):
            item_index = int(line.get("grc_item_index", -1))
            already_requested[item_index] = already_requested.get(item_index, 0) + float(line.get("quantity", 0) or 0)

    lines = []
    for item_index, item in enumerate(grc.get("items", [])):
        rejected = max(0.0, float(item.get("rejectedQty", 0) or 0))
        returnable = round(max(0.0, rejected - already_requested.get(item_index, 0)), 4)
        if returnable <= 0:
            continue
        lines.append({
            "grc_item_index": item_index,
            "barcode": item.get("barcode", ""),
            "vendor_barcode": item.get("vendorBarcode", ""),
            "description": item.get("description", ""),
            "rejected_quantity": rejected,
            "already_requested_quantity": round(already_requested.get(item_index, 0), 4),
            "returnable_quantity": returnable,
            "rate": float(item.get("rate", 0) or 0),
            "rejection_reason": item.get("rejectionReason", ""),
        })
    return lines


@router.get("/eligible-grcs")
async def eligible_grcs(ctx: dict = Depends(get_receiving_tenant)):
    """Rejected GRC lines that are still available for a supplier return note."""
    records = []
    async for grc in grc_collection.find({"tenant_id": ctx["tenant_id"], "totalRejectedQty": {"$gt": 0}}).sort("createdAt", -1):
        lines = await _returnable_lines(grc, ctx["tenant_id"])
        if not lines:
            continue
        vendor_id, vendor_name = await _resolve_purchase_vendor(grc, ctx["tenant_id"])
        records.append({
            "grc_id": str(grc["_id"]),
            "grc_no": grc.get("grcNo", ""),
            "grc_date": grc.get("grcDate", ""),
            "po_no": grc.get("poNo", ""),
            "vendor_name": vendor_name,
            "registered_vendor": bool(vendor_id),
            "lines": lines,
        })
    return {"data": records, "count": len(records)}


@router.get("/")
async def list_supplier_returns(ctx: dict = Depends(get_receiving_tenant)):
    rows = await supplier_returns_collection.find({"tenant_id": ctx["tenant_id"]}).sort("created_at", -1).to_list(500)
    return {"data": [_serialise(row) for row in rows], "count": len(rows)}


@router.post("/", status_code=201)
async def create_supplier_return(payload: dict, ctx: dict = Depends(get_receiving_tenant)):
    grc_id = str(payload.get("grc_id") or "")
    if not ObjectId.is_valid(grc_id):
        raise HTTPException(status_code=400, detail="Select a valid GRC.")
    grc = await grc_collection.find_one({"_id": ObjectId(grc_id), "tenant_id": ctx["tenant_id"]})
    if not grc:
        raise HTTPException(status_code=404, detail="GRC not found.")

    available = {line["grc_item_index"]: line for line in await _returnable_lines(grc, ctx["tenant_id"])}
    requested_lines = payload.get("lines") or []
    if not isinstance(requested_lines, list) or not requested_lines:
        raise HTTPException(status_code=400, detail="Select at least one rejected item to return.")

    lines = []
    selected_indexes = set()
    for request_line in requested_lines:
        try:
            item_index = int(request_line.get("grc_item_index"))
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Invalid GRC item.")
        if item_index in selected_indexes or item_index not in available:
            raise HTTPException(status_code=400, detail="One or more selected lines are no longer returnable.")
        selected_indexes.add(item_index)
        source = available[item_index]
        quantity = _number(request_line.get("quantity"), "Return quantity", minimum=0.0001)
        if quantity > source["returnable_quantity"] + 0.000001:
            raise HTTPException(status_code=400, detail=f"Return quantity exceeds the rejected quantity available for '{source['description']}'.")
        lines.append({
            **source,
            "quantity": round(quantity, 4),
            "reason": _text(request_line.get("reason") or source.get("rejection_reason"), "Return reason", required=True),
            "line_value": round(quantity * source["rate"], 2),
        })

    vendor_id, vendor_name = await _resolve_purchase_vendor(grc, ctx["tenant_id"])
    tenant = await tenants_collection.find_one({"tenant_id": ctx["tenant_id"]}, {"company_name": 1})
    now = datetime.utcnow()
    document = {
        "srn_no": await _next_srn_number(ctx["tenant_id"]),
        "tenant_id": ctx["tenant_id"],
        "retailer_name": (tenant or {}).get("company_name") or ctx["tenant_id"],
        "grc_id": str(grc["_id"]),
        "grc_no": grc.get("grcNo", ""),
        "po_no": grc.get("poNo", ""),
        "vendor_id": vendor_id,
        "vendor_name": vendor_name,
        "lines": lines,
        "total_value": round(sum(line["line_value"] for line in lines), 2),
        "note": _text(payload.get("note"), "Note", maximum=1000),
        "status": "Open",
        "dispatch_status": "PendingDispatch",
        "vendor_response_status": "AwaitingResponse" if vendor_id else "ExternalVendor",
        "created_by": ctx.get("admin_name") or "Inventory",
        "created_at": now,
        "updated_at": now,
    }
    result = await supplier_returns_collection.insert_one(document)
    document["_id"] = result.inserted_id
    return {"message": "Supplier Return Note created. Rejected goods remain outside available inventory.", "data": _serialise(document)}


@router.patch("/{return_id}/dispatch")
async def mark_dispatched(return_id: str, ctx: dict = Depends(get_receiving_tenant)):
    if not ObjectId.is_valid(return_id):
        raise HTTPException(status_code=400, detail="Invalid Supplier Return Note ID.")
    note = await supplier_returns_collection.find_one({"_id": ObjectId(return_id), "tenant_id": ctx["tenant_id"]})
    if not note:
        raise HTTPException(status_code=404, detail="Supplier Return Note not found.")
    if note.get("status") != "Open":
        raise HTTPException(status_code=400, detail="Only open Supplier Return Notes can be dispatched.")
    await supplier_returns_collection.update_one(
        {"_id": note["_id"]},
        {"$set": {"dispatch_status": "Dispatched", "dispatched_at": datetime.utcnow(), "updated_at": datetime.utcnow()}},
    )
    return {"message": "Return marked as dispatched. No inventory was reduced because rejected GRC quantity was never received into stock."}


@router.patch("/{return_id}/close")
async def close_supplier_return(return_id: str, payload: dict, ctx: dict = Depends(get_receiving_tenant)):
    if not ObjectId.is_valid(return_id):
        raise HTTPException(status_code=400, detail="Invalid Supplier Return Note ID.")
    resolution = _text(payload.get("resolution"), "Resolution", required=True)
    reference_no = _text(payload.get("reference_no"), "Reference number", maximum=120)
    note = await supplier_returns_collection.find_one({"_id": ObjectId(return_id), "tenant_id": ctx["tenant_id"]})
    if not note:
        raise HTTPException(status_code=404, detail="Supplier Return Note not found.")
    await supplier_returns_collection.update_one(
        {"_id": note["_id"]},
        {"$set": {"status": "Closed", "resolution": resolution, "resolution_reference": reference_no, "closed_at": datetime.utcnow(), "updated_at": datetime.utcnow()}},
    )
    return {"message": "Supplier Return Note closed."}


@router.get("/vendor/me")
async def vendor_supplier_returns(vendor: dict = Depends(require_vendor_identity)):
    rows = await supplier_returns_collection.find({"vendor_id": vendor["_id"]}).sort("created_at", -1).to_list(500)
    return {"data": [_serialise(row) for row in rows], "count": len(rows)}


@router.patch("/vendor/{return_id}/respond")
async def vendor_respond_to_return(return_id: str, payload: dict, vendor: dict = Depends(require_vendor_identity)):
    if not ObjectId.is_valid(return_id):
        raise HTTPException(status_code=400, detail="Invalid Supplier Return Note ID.")
    note = await supplier_returns_collection.find_one({"_id": ObjectId(return_id), "vendor_id": vendor["_id"]})
    if not note:
        raise HTTPException(status_code=404, detail="Supplier Return Note not found.")
    if note.get("status") != "Open":
        raise HTTPException(status_code=400, detail="This Supplier Return Note is already closed.")
    action = str(payload.get("action") or "").strip().lower()
    statuses = {
        "acknowledge": "Acknowledged",
        "replacement": "ReplacementAgreed",
        "credit_note": "CreditNoteAgreed",
        "dispute": "Disputed",
    }
    if action not in statuses:
        raise HTTPException(status_code=400, detail="Choose acknowledge, replacement, credit_note, or dispute.")
    await supplier_returns_collection.update_one(
        {"_id": note["_id"]},
        {"$set": {
            "vendor_response_status": statuses[action],
            "vendor_response_note": _text(payload.get("note"), "Response note", maximum=1000),
            "vendor_responded_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }},
    )
    return {"message": "Supplier Return response recorded.", "status": statuses[action]}