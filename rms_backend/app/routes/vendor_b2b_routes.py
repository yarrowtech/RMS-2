"""Vendor-to-vendor trade workflow, deliberately isolated from retailer procurement."""

from datetime import datetime
from typing import Optional
import re
from bson import ObjectId
from fastapi import APIRouter, Header, HTTPException

from ..db import (
    vendors_collection,
    business_connections_collection,
    vendor_b2b_rfqs_collection,
    vendor_b2b_orders_collection,
    vendor_b2b_receipts_collection,
    vendor_b2b_invoices_collection,
    vendor_b2b_stock_collection,
    vendor_b2b_stock_ledger_collection,
)
from .vendor_routes import decode_token


router = APIRouter(prefix="/api/vendor-b2b", tags=["Vendor B2B Trade"])


def _vendor_id(authorization: Optional[str]) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization token missing")
    decoded = decode_token(authorization.split(" ", 1)[1])
    vendor_id = (decoded or {}).get("vendor_id")
    if not vendor_id or not ObjectId.is_valid(vendor_id):
        raise HTTPException(status_code=401, detail="Invalid or expired vendor session")
    return vendor_id


def _number(value, field: str, *, minimum: float = 0, required: bool = True) -> float:
    if value in (None, "") and not required:
        return 0
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail=f"{field} must be a number")
    if number < minimum:
        raise HTTPException(status_code=400, detail=f"{field} must be at least {minimum}")
    return number


def _text(value, field: str, *, required: bool = False, maximum: int = 1000) -> str:
    result = str(value or "").strip()
    if required and not result:
        raise HTTPException(status_code=400, detail=f"{field} is required")
    return result[:maximum]


def _serialise(document: dict) -> dict:
    row = dict(document)
    row["_id"] = str(row["_id"])
    for key in ("vendor_id", "buyer_vendor_id", "supplier_vendor_id", "rfq_id", "order_id", "stock_item_id", "reference_id"):
        if row.get(key) is not None:
            row[key] = str(row[key])
    for key in ("created_at", "updated_at", "deadline", "quoted_at", "awarded_at", "confirmed_at", "received_at", "issued_at", "due_date"):
        if row.get(key):
            row[key] = row[key].isoformat() if hasattr(row[key], "isoformat") else str(row[key])
    return row


async def _vendor_summary(vendor_id: ObjectId) -> dict:
    vendor = await vendors_collection.find_one({"_id": vendor_id})
    if not vendor:
        return {"vendor_id": str(vendor_id), "name": "Unknown business", "business_type": []}
    return {
        "vendor_id": str(vendor_id),
        "name": vendor.get("name") or vendor.get("vendor_name") or "Business",
        "brand_name": vendor.get("brandName") or "",
        "business_type": vendor.get("business_type") or [],
        "city": vendor.get("cityName") or "",
        "state": vendor.get("state") or "",
    }


async def _require_partner(vendor_id: str, partner_id: str) -> ObjectId:
    if not ObjectId.is_valid(partner_id) or vendor_id == partner_id:
        raise HTTPException(status_code=400, detail="Select a valid trading partner")
    own_oid, partner_oid = ObjectId(vendor_id), ObjectId(partner_id)
    connection = await business_connections_collection.find_one({
        "status": "accepted",
        "$or": [
            {"requester_vendor_id": own_oid, "target_vendor_id": partner_oid},
            {"requester_vendor_id": partner_oid, "target_vendor_id": own_oid},
        ],
    })
    if not connection:
        raise HTTPException(status_code=403, detail="You can trade only with an accepted Business Network connection")
    if not await vendors_collection.find_one({"_id": partner_oid}):
        raise HTTPException(status_code=404, detail="Trading partner not found")
    return partner_oid


async def _enrich(rows: list[dict], perspective: str) -> list[dict]:
    vendor_ids = set()
    for row in rows:
        vendor_ids.add(row["buyer_vendor_id"])
        vendor_ids.add(row["supplier_vendor_id"])
    vendor_map = {vendor_id: await _vendor_summary(vendor_id) for vendor_id in vendor_ids}
    result = []
    for row in rows:
        serialised = _serialise(row)
        serialised["buyer"] = vendor_map[row["buyer_vendor_id"]]
        serialised["supplier"] = vendor_map[row["supplier_vendor_id"]]
        serialised["perspective"] = perspective
        result.append(serialised)
    return result


def _document_number(prefix: str) -> str:
    return f"{prefix}-{datetime.utcnow().strftime('%y%m%d')}-{str(ObjectId())[-6:].upper()}"


def _item_key(item_code: str, title: str, category: str, unit: str) -> str:
    supplied = str(item_code or "").strip().upper()
    if supplied:
        return supplied[:80]
    source = " ".join((category or "", title or "", unit or "")).lower()
    normalised = re.sub(r"[^a-z0-9]+", "-", source).strip("-")
    return (normalised or "b2b-material")[:80]


@router.get("/partners")
async def partners(authorization: str = Header(None)):
    vendor_id = _vendor_id(authorization)
    oid = ObjectId(vendor_id)
    partner_ids = []
    async for connection in business_connections_collection.find({
        "status": "accepted",
        "$or": [{"requester_vendor_id": oid}, {"target_vendor_id": oid}],
    }).sort("updated_at", -1):
        partner_ids.append(connection["target_vendor_id"] if connection["requester_vendor_id"] == oid else connection["requester_vendor_id"])
    rows = []
    for partner_id in dict.fromkeys(partner_ids):
        rows.append(await _vendor_summary(partner_id))
    return {"data": rows, "count": len(rows)}


@router.get("/rfqs")
async def list_rfqs(view: str = "all", authorization: str = Header(None)):
    vendor_id = ObjectId(_vendor_id(authorization))
    if view == "buying": query, perspective = {"buyer_vendor_id": vendor_id}, "buying"
    elif view == "selling": query, perspective = {"supplier_vendor_id": vendor_id}, "selling"
    elif view == "all": query, perspective = {"$or": [{"buyer_vendor_id": vendor_id}, {"supplier_vendor_id": vendor_id}]}, "all"
    else: raise HTTPException(status_code=400, detail="view must be buying, selling, or all")
    rows = await vendor_b2b_rfqs_collection.find(query).sort("created_at", -1).to_list(200)
    data = await _enrich(rows, perspective)
    for row in data:
        row["viewer_role"] = "buying" if row["buyer_vendor_id"] == str(vendor_id) else "selling"
    return {"data": data, "count": len(rows)}


@router.post("/rfqs", status_code=201)
async def create_rfq(payload: dict, authorization: str = Header(None)):
    vendor_id = _vendor_id(authorization)
    supplier_id = await _require_partner(vendor_id, str(payload.get("supplier_vendor_id") or ""))
    quantity = _number(payload.get("quantity"), "quantity", minimum=0.001)
    now = datetime.utcnow()
    doc = {
        "rfq_no": _document_number("B2B-RFQ"),
        "buyer_vendor_id": ObjectId(vendor_id), "supplier_vendor_id": supplier_id,
        "title": _text(payload.get("title"), "title", required=True, maximum=160),
        "category": _text(payload.get("category"), "category", maximum=100),
        "item_code": _text(payload.get("item_code"), "item_code", maximum=80),
        "specification": _text(payload.get("specification"), "specification", maximum=3000),
        "quantity": quantity, "unit": _text(payload.get("unit"), "unit", required=True, maximum=30),
        "target_price": _number(payload.get("target_price"), "target_price", required=False),
        "deadline": _text(payload.get("deadline"), "deadline", maximum=30),
        "status": "Sent", "quote": None, "created_at": now, "updated_at": now,
    }
    result = await vendor_b2b_rfqs_collection.insert_one(doc)
    return {"message": "RFQ sent to your trading partner.", "rfq_id": str(result.inserted_id), "rfq_no": doc["rfq_no"]}


@router.post("/rfqs/{rfq_id}/quote")
async def submit_quote(rfq_id: str, payload: dict, authorization: str = Header(None)):
    vendor_id = _vendor_id(authorization)
    if not ObjectId.is_valid(rfq_id): raise HTTPException(status_code=400, detail="Invalid RFQ ID")
    rfq = await vendor_b2b_rfqs_collection.find_one({"_id": ObjectId(rfq_id)})
    if not rfq: raise HTTPException(status_code=404, detail="RFQ not found")
    if rfq["supplier_vendor_id"] != ObjectId(vendor_id): raise HTTPException(status_code=403, detail="Only the selected supplier can quote")
    if rfq.get("status") not in ("Sent", "Quoted"): raise HTTPException(status_code=400, detail="This RFQ is no longer open for quotation")
    quote = {
        "unit_price": _number(payload.get("unit_price"), "unit_price", minimum=0),
        "currency": _text(payload.get("currency") or "INR", "currency", required=True, maximum=10),
        "minimum_order_quantity": _number(payload.get("minimum_order_quantity"), "minimum_order_quantity", required=False),
        "lead_days": _number(payload.get("lead_days"), "lead_days", minimum=0, required=False),
        "valid_until": _text(payload.get("valid_until"), "valid_until", maximum=30),
        "note": _text(payload.get("note"), "note", maximum=1500),
        "quoted_at": datetime.utcnow(),
    }
    await vendor_b2b_rfqs_collection.update_one({"_id": rfq["_id"]}, {"$set": {"quote": quote, "status": "Quoted", "updated_at": datetime.utcnow()}})
    return {"message": "Quotation submitted to buyer."}


@router.post("/rfqs/{rfq_id}/award", status_code=201)
async def award_rfq(rfq_id: str, authorization: str = Header(None)):
    vendor_id = _vendor_id(authorization)
    if not ObjectId.is_valid(rfq_id): raise HTTPException(status_code=400, detail="Invalid RFQ ID")
    rfq = await vendor_b2b_rfqs_collection.find_one({"_id": ObjectId(rfq_id)})
    if not rfq: raise HTTPException(status_code=404, detail="RFQ not found")
    if rfq["buyer_vendor_id"] != ObjectId(vendor_id): raise HTTPException(status_code=403, detail="Only the buying business can award this RFQ")
    if rfq.get("status") != "Quoted" or not rfq.get("quote"): raise HTTPException(status_code=400, detail="A supplier quotation is required before award")
    now = datetime.utcnow()
    order = {
        "order_no": _document_number("B2B-PO"), "rfq_id": rfq["_id"],
        "buyer_vendor_id": rfq["buyer_vendor_id"], "supplier_vendor_id": rfq["supplier_vendor_id"],
        "title": rfq["title"], "category": rfq.get("category", ""), "specification": rfq.get("specification", ""),
        "item_code": _item_key(rfq.get("item_code", ""), rfq["title"], rfq.get("category", ""), rfq["unit"]),
        "quantity": rfq["quantity"], "unit": rfq["unit"], "unit_price": rfq["quote"]["unit_price"],
        "currency": rfq["quote"].get("currency", "INR"), "lead_days": rfq["quote"].get("lead_days", 0),
        "supplier_note": rfq["quote"].get("note", ""), "total_amount": round(rfq["quantity"] * rfq["quote"]["unit_price"], 2),
        "received_quantity": 0, "status": "Sent", "created_at": now, "updated_at": now,
    }
    result = await vendor_b2b_orders_collection.insert_one(order)
    await vendor_b2b_rfqs_collection.update_one({"_id": rfq["_id"]}, {"$set": {"status": "Awarded", "order_id": result.inserted_id, "awarded_at": now, "updated_at": now}})
    return {"message": "Supplier purchase order created.", "order_id": str(result.inserted_id), "order_no": order["order_no"]}


@router.get("/orders")
async def list_orders(view: str = "all", authorization: str = Header(None)):
    vendor_id = ObjectId(_vendor_id(authorization))
    if view == "buying": query, perspective = {"buyer_vendor_id": vendor_id}, "buying"
    elif view == "selling": query, perspective = {"supplier_vendor_id": vendor_id}, "selling"
    elif view == "all": query, perspective = {"$or": [{"buyer_vendor_id": vendor_id}, {"supplier_vendor_id": vendor_id}]}, "all"
    else: raise HTTPException(status_code=400, detail="view must be buying, selling, or all")
    rows = await vendor_b2b_orders_collection.find(query).sort("created_at", -1).to_list(200)
    data = await _enrich(rows, perspective)
    for row in data:
        row["viewer_role"] = "buying" if row["buyer_vendor_id"] == str(vendor_id) else "selling"
    return {"data": data, "count": len(rows)}


@router.patch("/orders/{order_id}/status")
async def update_order_status(order_id: str, payload: dict, authorization: str = Header(None)):
    vendor_id = ObjectId(_vendor_id(authorization))
    if not ObjectId.is_valid(order_id): raise HTTPException(status_code=400, detail="Invalid order ID")
    order = await vendor_b2b_orders_collection.find_one({"_id": ObjectId(order_id)})
    if not order: raise HTTPException(status_code=404, detail="Order not found")
    action = str(payload.get("action") or "").lower()
    if action in ("accept", "reject"):
        if order["supplier_vendor_id"] != vendor_id or order.get("status") != "Sent": raise HTTPException(status_code=403, detail="Only the supplier can respond to a new order")
        status = "Confirmed" if action == "accept" else "Rejected"
    elif action == "cancel":
        if order["buyer_vendor_id"] != vendor_id or order.get("status") not in ("Sent", "Confirmed"): raise HTTPException(status_code=403, detail="Only the buyer can cancel an open order")
        status = "Cancelled"
    else: raise HTTPException(status_code=400, detail="action must be accept, reject, or cancel")
    now = datetime.utcnow()
    await vendor_b2b_orders_collection.update_one({"_id": order["_id"]}, {"$set": {"status": status, "updated_at": now, **({"confirmed_at": now} if status == "Confirmed" else {})}})
    return {"message": f"Order {status.lower()}.", "status": status}


@router.post("/orders/{order_id}/receipts", status_code=201)
async def record_receipt(order_id: str, payload: dict, authorization: str = Header(None)):
    vendor_id = ObjectId(_vendor_id(authorization))
    if not ObjectId.is_valid(order_id): raise HTTPException(status_code=400, detail="Invalid order ID")
    order = await vendor_b2b_orders_collection.find_one({"_id": ObjectId(order_id)})
    if not order: raise HTTPException(status_code=404, detail="Order not found")
    if order["buyer_vendor_id"] != vendor_id: raise HTTPException(status_code=403, detail="Only the buyer can record receipt")
    if order.get("status") not in ("Confirmed", "PartiallyReceived"): raise HTTPException(status_code=400, detail="Only a confirmed order can be received")
    quantity = _number(payload.get("received_quantity"), "received_quantity", minimum=0.001)
    remaining = order["quantity"] - order.get("received_quantity", 0)
    if quantity > remaining + 0.000001: raise HTTPException(status_code=400, detail=f"Receipt exceeds the remaining quantity ({remaining:g} {order['unit']})")
    now = datetime.utcnow()
    item_key = _item_key(order.get("item_code", ""), order["title"], order.get("category", ""), order["unit"])
    stock_filter = {"vendor_id": order["buyer_vendor_id"], "item_key": item_key, "unit": order["unit"]}
    stock = await vendor_b2b_stock_collection.find_one(stock_filter)
    old_qty = float((stock or {}).get("quantity", 0))
    old_value = float((stock or {}).get("total_value", 0))
    received_value = round(quantity * float(order.get("unit_price", 0)), 2)
    next_qty = round(old_qty + quantity, 4)
    next_value = round(old_value + received_value, 2)
    stock_update = {
        "vendor_id": order["buyer_vendor_id"], "item_key": item_key, "item_code": order.get("item_code") or item_key,
        "title": order["title"], "category": order.get("category", ""), "unit": order["unit"],
        "quantity": next_qty, "total_value": next_value, "average_cost": round(next_value / next_qty, 4) if next_qty else 0,
        "currency": order.get("currency", "INR"), "updated_at": now,
    }
    await vendor_b2b_stock_collection.update_one(stock_filter, {"$set": stock_update}, upsert=True)
    saved_stock = await vendor_b2b_stock_collection.find_one(stock_filter, {"_id": 1})
    stock_id = (saved_stock or {}).get("_id")
    receipt = {"receipt_no": _document_number("B2B-GRN"), "order_id": order["_id"], "buyer_vendor_id": order["buyer_vendor_id"], "supplier_vendor_id": order["supplier_vendor_id"], "stock_item_id": stock_id, "received_quantity": quantity, "note": _text(payload.get("note"), "note", maximum=1000), "received_at": now}
    receipt_result = await vendor_b2b_receipts_collection.insert_one(receipt)
    await vendor_b2b_stock_ledger_collection.insert_one({"vendor_id": order["buyer_vendor_id"], "stock_item_id": stock_id, "item_key": item_key, "movement_type": "B2B Receipt", "quantity_in": quantity, "quantity_out": 0, "unit_cost": float(order.get("unit_price", 0)), "value": received_value, "reference_type": "receipt", "reference_id": receipt_result.inserted_id, "reference_no": receipt["receipt_no"], "note": receipt["note"], "created_at": now})
    total_received = round(order.get("received_quantity", 0) + quantity, 4)
    status = "Received" if total_received >= order["quantity"] else "PartiallyReceived"
    await vendor_b2b_orders_collection.update_one({"_id": order["_id"]}, {"$set": {"received_quantity": total_received, "status": status, "updated_at": now}})
    return {"message": "Vendor-side material receipt recorded.", "receipt_no": receipt["receipt_no"], "status": status}


@router.get("/stock")
async def list_b2b_stock(authorization: str = Header(None)):
    vendor_id = ObjectId(_vendor_id(authorization))
    rows = await vendor_b2b_stock_collection.find({"vendor_id": vendor_id}).sort("updated_at", -1).to_list(500)
    data = []
    for row in rows:
        item = _serialise(row)
        item["vendor_id"] = str(vendor_id)
        data.append(item)
    total_value = round(sum(float(row.get("total_value", 0)) for row in rows), 2)
    return {"data": data, "count": len(data), "total_value": total_value}


@router.get("/stock/{stock_id}/ledger")
async def stock_ledger(stock_id: str, authorization: str = Header(None)):
    vendor_id = ObjectId(_vendor_id(authorization))
    if not ObjectId.is_valid(stock_id): raise HTTPException(status_code=400, detail="Invalid stock item ID")
    stock = await vendor_b2b_stock_collection.find_one({"_id": ObjectId(stock_id), "vendor_id": vendor_id})
    if not stock: raise HTTPException(status_code=404, detail="B2B stock item not found")
    rows = await vendor_b2b_stock_ledger_collection.find({"stock_item_id": stock["_id"], "vendor_id": vendor_id}).sort("created_at", -1).to_list(200)
    return {"data": [_serialise(row) for row in rows], "count": len(rows)}


@router.post("/stock/{stock_id}/adjust")
async def adjust_b2b_stock(stock_id: str, payload: dict, authorization: str = Header(None)):
    vendor_id = ObjectId(_vendor_id(authorization))
    if not ObjectId.is_valid(stock_id): raise HTTPException(status_code=400, detail="Invalid stock item ID")
    stock = await vendor_b2b_stock_collection.find_one({"_id": ObjectId(stock_id), "vendor_id": vendor_id})
    if not stock: raise HTTPException(status_code=404, detail="B2B stock item not found")
    delta = _number(payload.get("quantity_delta"), "quantity_delta", minimum=float("-inf"), required=True)
    if delta == 0: raise HTTPException(status_code=400, detail="quantity_delta cannot be zero")
    next_qty = round(float(stock.get("quantity", 0)) + delta, 4)
    if next_qty < 0: raise HTTPException(status_code=400, detail="Adjustment would make B2B stock negative")
    average_cost = float(stock.get("average_cost", 0))
    next_value = round(float(stock.get("total_value", 0)) + delta * average_cost, 2)
    now = datetime.utcnow()
    await vendor_b2b_stock_collection.update_one({"_id": stock["_id"]}, {"$set": {"quantity": next_qty, "total_value": max(next_value, 0), "average_cost": average_cost if next_qty else 0, "updated_at": now}})
    await vendor_b2b_stock_ledger_collection.insert_one({"vendor_id": vendor_id, "stock_item_id": stock["_id"], "item_key": stock.get("item_key", ""), "movement_type": "Adjustment In" if delta > 0 else "Adjustment Out", "quantity_in": delta if delta > 0 else 0, "quantity_out": abs(delta) if delta < 0 else 0, "unit_cost": average_cost, "value": round(abs(delta) * average_cost, 2), "reference_type": "adjustment", "reference_no": _document_number("B2B-ADJ"), "note": _text(payload.get("note"), "note", required=True, maximum=500), "created_at": now})
    return {"message": "B2B stock adjusted.", "quantity": next_qty, "total_value": max(next_value, 0)}


@router.get("/invoices")
async def list_invoices(authorization: str = Header(None)):
    vendor_id = ObjectId(_vendor_id(authorization))
    rows = await vendor_b2b_invoices_collection.find({"$or": [{"buyer_vendor_id": vendor_id}, {"supplier_vendor_id": vendor_id}]}).sort("created_at", -1).to_list(200)
    return {"data": await _enrich(rows, "all"), "count": len(rows)}


@router.post("/orders/{order_id}/invoices", status_code=201)
async def create_invoice(order_id: str, payload: dict, authorization: str = Header(None)):
    vendor_id = ObjectId(_vendor_id(authorization))
    if not ObjectId.is_valid(order_id): raise HTTPException(status_code=400, detail="Invalid order ID")
    order = await vendor_b2b_orders_collection.find_one({"_id": ObjectId(order_id)})
    if not order: raise HTTPException(status_code=404, detail="Order not found")
    if order["supplier_vendor_id"] != vendor_id: raise HTTPException(status_code=403, detail="Only the selling supplier can issue an invoice")
    if order.get("status") not in ("Confirmed", "PartiallyReceived", "Received"): raise HTTPException(status_code=400, detail="Confirm the order before issuing an invoice")
    now = datetime.utcnow()
    invoice = {"invoice_no": _text(payload.get("invoice_no"), "invoice_no", maximum=100) or _document_number("B2B-INV"), "order_id": order["_id"], "order_no": order["order_no"], "buyer_vendor_id": order["buyer_vendor_id"], "supplier_vendor_id": order["supplier_vendor_id"], "title": order["title"], "currency": order.get("currency", "INR"), "amount": _number(payload.get("amount"), "amount", minimum=0, required=False) or order["total_amount"], "due_date": _text(payload.get("due_date"), "due_date", maximum=30), "status": "Issued", "issued_at": now, "created_at": now}
    result = await vendor_b2b_invoices_collection.insert_one(invoice)
    return {"message": "Vendor sales invoice issued.", "invoice_id": str(result.inserted_id), "invoice_no": invoice["invoice_no"]}
