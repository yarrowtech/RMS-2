"""Vendor-to-vendor trade workflow, deliberately isolated from retailer procurement."""

from datetime import datetime
from typing import Optional
import re
from bson import ObjectId
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from io import BytesIO

from ..db import (
    vendors_collection,
    business_connections_collection,
    vendor_b2b_rfqs_collection,
    vendor_b2b_orders_collection,
    vendor_b2b_receipts_collection,
    vendor_b2b_invoices_collection,
    vendor_b2b_returns_collection,
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
    for key in ("created_at", "updated_at", "deadline", "quoted_at", "awarded_at", "confirmed_at", "received_at", "issued_at", "due_date", "dispatched_at"):
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


@router.put("/orders/{order_id}/dispatch")
async def dispatch_order(order_id: str, payload: dict, authorization: str = Header(None)):
    vendor_id = ObjectId(_vendor_id(authorization))
    if not ObjectId.is_valid(order_id): raise HTTPException(status_code=400, detail="Invalid order ID")
    order = await vendor_b2b_orders_collection.find_one({"_id": ObjectId(order_id)})
    if not order: raise HTTPException(status_code=404, detail="Order not found")
    if order["supplier_vendor_id"] != vendor_id: raise HTTPException(status_code=403, detail="Only the selling supplier can dispatch this order")
    if order.get("status") not in ("Confirmed", "PartiallyReceived"):
        raise HTTPException(status_code=400, detail="Confirm the B2B order before dispatching")
    expected_date = _text(payload.get("expected_delivery_date"), "expected delivery date", required=True, maximum=30)
    dispatch = {
        "challan_no": _text(payload.get("challan_no"), "challan number", maximum=100) or _document_number("B2B-DC"),
        "dispatch_date": _text(payload.get("dispatch_date"), "dispatch date", maximum=30) or datetime.utcnow().strftime("%Y-%m-%d"),
        "expected_delivery_date": expected_date,
        "transporter_name": _text(payload.get("transporter_name"), "transporter name", maximum=160),
        "tracking_number": _text(payload.get("tracking_number"), "tracking number", maximum=160),
        "vehicle_number": _text(payload.get("vehicle_number"), "vehicle number", maximum=80),
        "note": _text(payload.get("note"), "dispatch note", maximum=1000), "dispatched_at": datetime.utcnow(),
    }
    await vendor_b2b_orders_collection.update_one({"_id": order["_id"]}, {"$set": {"dispatch": dispatch, "updated_at": datetime.utcnow()}})
    return {"message": "B2B dispatch saved.", "dispatch": {**dispatch, "dispatched_at": dispatch["dispatched_at"].isoformat()}}


def _pdf_response(title: str, rows: list[tuple[str, str]], filename: str):
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib import colors
    except ImportError:
        raise HTTPException(status_code=503, detail="PDF export is not installed on the server")
    buf = BytesIO(); styles = getSampleStyleSheet(); doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=42, leftMargin=42, topMargin=42)
    table = Table([[Paragraph("<b>Field</b>", styles["BodyText"]), Paragraph("<b>Details</b>", styles["BodyText"])]] + [[str(a), str(b)] for a,b in rows], colWidths=[150, 350])
    table.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,0), colors.HexColor("#4f46e5")), ("TEXTCOLOR", (0,0), (-1,0), colors.white), ("GRID", (0,0), (-1,-1), .25, colors.HexColor("#cbd5e1")), ("VALIGN", (0,0), (-1,-1), "TOP"), ("PADDING", (0,0), (-1,-1), 7)]))
    doc.build([Paragraph(title, styles["Title"]), Spacer(1, 16), table])
    buf.seek(0); return StreamingResponse(buf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/orders/{order_id}/download")
async def download_order(order_id: str, authorization: str = Header(None)):
    vendor_id = ObjectId(_vendor_id(authorization)); order = await vendor_b2b_orders_collection.find_one({"_id": ObjectId(order_id)}) if ObjectId.is_valid(order_id) else None
    if not order or vendor_id not in (order["buyer_vendor_id"], order["supplier_vendor_id"]): raise HTTPException(status_code=404, detail="Order not found")
    rows = [("B2B PO", order["order_no"]), ("Buyer", (await _vendor_summary(order["buyer_vendor_id"]))["name"]), ("Supplier", (await _vendor_summary(order["supplier_vendor_id"]))["name"]), ("Item", order["title"]), ("SKU / code", order.get("item_code", "—")), ("Quantity", f'{order["quantity"]} {order["unit"]}'), ("Rate", f'{order.get("currency", "INR")} {order.get("unit_price", 0)}'), ("Total", f'{order.get("currency", "INR")} {order.get("total_amount", 0)}'), ("Status", order.get("status", ""))]
    return _pdf_response("B2B Purchase Order", rows, f'{order["order_no"]}.pdf')


@router.get("/orders/{order_id}/challan")
async def download_challan(order_id: str, authorization: str = Header(None)):
    vendor_id = ObjectId(_vendor_id(authorization)); order = await vendor_b2b_orders_collection.find_one({"_id": ObjectId(order_id)}) if ObjectId.is_valid(order_id) else None
    if not order or vendor_id not in (order["buyer_vendor_id"], order["supplier_vendor_id"]): raise HTTPException(status_code=404, detail="Order not found")
    dispatch = order.get("dispatch") or {}
    if not dispatch: raise HTTPException(status_code=400, detail="Create dispatch details before downloading a delivery challan")
    rows = [("Challan no.", dispatch.get("challan_no", "")), ("B2B PO", order["order_no"]), ("Supplier", (await _vendor_summary(order["supplier_vendor_id"]))["name"]), ("Buyer", (await _vendor_summary(order["buyer_vendor_id"]))["name"]), ("Item", order["title"]), ("Quantity", f'{order["quantity"]} {order["unit"]}'), ("Dispatch date", dispatch.get("dispatch_date", "")), ("Expected delivery", dispatch.get("expected_delivery_date", "")), ("Transporter", dispatch.get("transporter_name") or "—"), ("Tracking / vehicle", " / ".join(filter(None, [dispatch.get("tracking_number"), dispatch.get("vehicle_number")])) or "—"), ("Note", dispatch.get("note") or "—")]
    return _pdf_response("B2B Delivery Challan", rows, f'{dispatch.get("challan_no", "b2b-challan")}.pdf')

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


@router.get("/returns")
async def list_returns(authorization: str = Header(None)):
    vendor_id = ObjectId(_vendor_id(authorization))
    rows = await vendor_b2b_returns_collection.find({"$or": [{"buyer_vendor_id": vendor_id}, {"supplier_vendor_id": vendor_id}]}).sort("created_at", -1).to_list(200)
    data = await _enrich(rows, "all")
    for row in data:
        row["viewer_role"] = "buying" if row["buyer_vendor_id"] == str(vendor_id) else "selling"
    return {"data": data, "count": len(rows)}


@router.post("/orders/{order_id}/returns", status_code=201)
async def request_return(order_id: str, payload: dict, authorization: str = Header(None)):
    vendor_id = ObjectId(_vendor_id(authorization)); order = await vendor_b2b_orders_collection.find_one({"_id": ObjectId(order_id)}) if ObjectId.is_valid(order_id) else None
    if not order: raise HTTPException(status_code=404, detail="Order not found")
    if order["buyer_vendor_id"] != vendor_id: raise HTTPException(status_code=403, detail="Only the B2B buyer can request a return")
    if order.get("status") not in ("PartiallyReceived", "Received"): raise HTTPException(status_code=400, detail="Receive goods before requesting a B2B return")
    quantity = _number(payload.get("quantity"), "return quantity", minimum=0.001); returned = float(order.get("returned_quantity", 0) or 0)
    if quantity > float(order.get("received_quantity", 0) or 0) - returned + .000001: raise HTTPException(status_code=400, detail="Return quantity exceeds goods currently held")
    now = datetime.utcnow(); doc = {"return_no": _document_number("B2B-RET"), "order_id": order["_id"], "order_no": order["order_no"], "buyer_vendor_id": order["buyer_vendor_id"], "supplier_vendor_id": order["supplier_vendor_id"], "title": order["title"], "item_code": order.get("item_code", ""), "unit": order["unit"], "quantity": quantity, "currency": order.get("currency", "INR"), "credit_amount": round(quantity * float(order.get("unit_price", 0) or 0), 2), "reason": _text(payload.get("reason"), "return reason", required=True, maximum=1000), "status": "Requested", "created_at": now, "updated_at": now}
    result = await vendor_b2b_returns_collection.insert_one(doc)
    return {"message": "B2B return request sent to supplier.", "return_id": str(result.inserted_id), "return_no": doc["return_no"]}


@router.patch("/returns/{return_id}/status")
async def update_return_status(return_id: str, payload: dict, authorization: str = Header(None)):
    vendor_id = ObjectId(_vendor_id(authorization)); ret = await vendor_b2b_returns_collection.find_one({"_id": ObjectId(return_id)}) if ObjectId.is_valid(return_id) else None
    if not ret: raise HTTPException(status_code=404, detail="B2B return not found")
    action = str(payload.get("action") or "").lower(); now = datetime.utcnow()
    if action in ("approve", "reject"):
        if ret["supplier_vendor_id"] != vendor_id or ret.get("status") != "Requested": raise HTTPException(status_code=403, detail="Only the supplier can respond to a requested return")
        status = "Approved" if action == "approve" else "Rejected"; update = {"status": status, "supplier_note": _text(payload.get("note"), "note", maximum=500), "updated_at": now}
    elif action == "dispatch":
        if ret["buyer_vendor_id"] != vendor_id or ret.get("status") != "Approved": raise HTTPException(status_code=403, detail="Supplier approval is required before dispatching the return")
        update = {"status": "Dispatched", "return_dispatch": {"challan_no": _text(payload.get("challan_no"), "challan", maximum=100) or _document_number("B2B-RET-DC"), "expected_delivery_date": _text(payload.get("expected_delivery_date"), "expected delivery date", required=True, maximum=30), "transporter_name": _text(payload.get("transporter_name"), "transporter", maximum=160), "tracking_number": _text(payload.get("tracking_number"), "tracking", maximum=160), "dispatched_at": now}, "updated_at": now}
    elif action == "receive":
        if ret["supplier_vendor_id"] != vendor_id or ret.get("status") != "Dispatched": raise HTTPException(status_code=403, detail="Only the supplier can receive a dispatched return")
        order = await vendor_b2b_orders_collection.find_one({"_id": ret["order_id"]}); item_key = _item_key(ret.get("item_code", ""), ret["title"], (order or {}).get("category", ""), ret["unit"])
        stock = await vendor_b2b_stock_collection.find_one({"vendor_id": ret["buyer_vendor_id"], "item_key": item_key, "unit": ret["unit"]})
        if not stock or float(stock.get("quantity", 0) or 0) < float(ret["quantity"]): raise HTTPException(status_code=400, detail="Buyer B2B stock is insufficient to complete this return")
        qty = float(ret["quantity"]); cost = float(stock.get("average_cost", 0) or 0); await vendor_b2b_stock_collection.update_one({"_id": stock["_id"]}, {"$inc": {"quantity": -qty, "total_value": -round(qty * cost, 2)}, "$set": {"updated_at": now}})
        await vendor_b2b_stock_ledger_collection.insert_one({"vendor_id": ret["buyer_vendor_id"], "stock_item_id": stock["_id"], "item_key": item_key, "movement_type": "B2B Return", "quantity_in": 0, "quantity_out": qty, "unit_cost": cost, "value": round(qty * cost, 2), "reference_type": "return", "reference_id": ret["_id"], "reference_no": ret["return_no"], "note": ret["reason"], "created_at": now})
        await vendor_b2b_orders_collection.update_one({"_id": ret["order_id"]}, {"$inc": {"returned_quantity": qty}, "$set": {"updated_at": now}})
        invoice = await vendor_b2b_invoices_collection.find_one({"order_id": ret["order_id"]}, sort=[("issued_at", -1)])
        credit_note = {"credit_no": _document_number("B2B-CN"), "amount": ret["credit_amount"], "return_no": ret["return_no"], "issued_at": now}
        if invoice:
            balance = max(0, round(float(invoice.get("balance_due", invoice.get("amount", 0)) or 0) - float(ret["credit_amount"]), 2)); credits = round(float(invoice.get("credit_amount", 0) or 0) + float(ret["credit_amount"]), 2)
            await vendor_b2b_invoices_collection.update_one({"_id": invoice["_id"]}, {"$set": {"balance_due": balance, "credit_amount": credits, "payment_status": "Credited" if balance == 0 else "PartiallyPaid", "updated_at": now}, "$push": {"credit_notes": credit_note}})
        update = {"status": "Received", "credit_note": credit_note, "updated_at": now}
    else: raise HTTPException(status_code=400, detail="action must be approve, reject, dispatch, or receive")
    await vendor_b2b_returns_collection.update_one({"_id": ret["_id"]}, {"$set": update})
    return {"message": f"B2B return {update['status'].lower()}.", "status": update["status"]}

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
    invoice = {"invoice_no": _text(payload.get("invoice_no"), "invoice_no", maximum=100) or _document_number("B2B-INV"), "order_id": order["_id"], "order_no": order["order_no"], "buyer_vendor_id": order["buyer_vendor_id"], "supplier_vendor_id": order["supplier_vendor_id"], "title": order["title"], "currency": order.get("currency", "INR"), "amount": _number(payload.get("amount"), "amount", minimum=0, required=False) or order["total_amount"], "due_date": _text(payload.get("due_date"), "due_date", maximum=30), "status": "Issued", "payment_status": "Unpaid", "paid_amount": 0.0, "balance_due": _number(payload.get("amount"), "amount", minimum=0, required=False) or order["total_amount"], "payments": [], "issued_at": now, "created_at": now}
    result = await vendor_b2b_invoices_collection.insert_one(invoice)
    return {"message": "Vendor sales invoice issued.", "invoice_id": str(result.inserted_id), "invoice_no": invoice["invoice_no"]}


@router.post("/invoices/{invoice_id}/payments", status_code=201)
async def record_invoice_payment(invoice_id: str, payload: dict, authorization: str = Header(None)):
    vendor_id = ObjectId(_vendor_id(authorization))
    if not ObjectId.is_valid(invoice_id): raise HTTPException(status_code=400, detail="Invalid invoice ID")
    invoice = await vendor_b2b_invoices_collection.find_one({"_id": ObjectId(invoice_id)})
    if not invoice: raise HTTPException(status_code=404, detail="B2B invoice not found")
    if invoice["buyer_vendor_id"] != vendor_id: raise HTTPException(status_code=403, detail="Only the B2B buyer can record payment")
    amount = _number(payload.get("amount"), "payment amount", minimum=0.01)
    balance = float(invoice.get("balance_due", invoice.get("amount", 0)) or 0)
    if amount > balance + 0.000001: raise HTTPException(status_code=400, detail=f"Payment exceeds outstanding balance ({balance:g})")
    now = datetime.utcnow(); paid = round(float(invoice.get("paid_amount", 0) or 0) + amount, 2); due = round(balance - amount, 2)
    payment = {"payment_no": _document_number("B2B-PAY"), "amount": amount, "payment_date": _text(payload.get("payment_date"), "payment date", maximum=30) or now.strftime("%Y-%m-%d"), "payment_mode": _text(payload.get("payment_mode"), "payment mode", maximum=50) or "Bank transfer", "reference_no": _text(payload.get("reference_no"), "reference no", maximum=100), "note": _text(payload.get("note"), "note", maximum=500), "recorded_at": now}
    payment_status = "Paid" if due <= 0.000001 else "PartiallyPaid"
    await vendor_b2b_invoices_collection.update_one({"_id": invoice["_id"]}, {"$set": {"paid_amount": paid, "balance_due": max(0, due), "payment_status": payment_status, "updated_at": now}, "$push": {"payments": payment}})
    return {"message": "B2B payment recorded.", "payment": {**payment, "recorded_at": payment["recorded_at"].isoformat()}, "balance_due": max(0, due), "payment_status": payment_status}


@router.get("/finance-ledger")
async def b2b_finance_ledger(authorization: str = Header(None)):
    vendor_id = ObjectId(_vendor_id(authorization)); today = datetime.utcnow().strftime("%Y-%m-%d")
    invoices = await vendor_b2b_invoices_collection.find({"$or": [{"buyer_vendor_id": vendor_id}, {"supplier_vendor_id": vendor_id}]}).sort("issued_at", -1).to_list(300)
    receivable = [row for row in invoices if row["supplier_vendor_id"] == vendor_id]; payable = [row for row in invoices if row["buyer_vendor_id"] == vendor_id]
    def summary(rows):
        return {"invoiced": round(sum(float(r.get("amount", 0) or 0) for r in rows), 2), "paid": round(sum(float(r.get("paid_amount", 0) or 0) for r in rows), 2), "outstanding": round(sum(float(r.get("balance_due", r.get("amount", 0)) or 0) for r in rows), 2), "overdue": round(sum(float(r.get("balance_due", 0) or 0) for r in rows if r.get("due_date") and r.get("due_date") < today), 2)}
    return {"receivable": summary(receivable), "payable": summary(payable), "invoices": await _enrich(invoices, "all")}


@router.get("/invoices/{invoice_id}/download")
async def download_invoice(invoice_id: str, authorization: str = Header(None)):
    vendor_id = ObjectId(_vendor_id(authorization)); invoice = await vendor_b2b_invoices_collection.find_one({"_id": ObjectId(invoice_id)}) if ObjectId.is_valid(invoice_id) else None
    if not invoice or vendor_id not in (invoice["buyer_vendor_id"], invoice["supplier_vendor_id"]): raise HTTPException(status_code=404, detail="Invoice not found")
    rows = [("Invoice", invoice["invoice_no"]), ("B2B PO", invoice.get("order_no", "")), ("Supplier", (await _vendor_summary(invoice["supplier_vendor_id"]))["name"]), ("Buyer", (await _vendor_summary(invoice["buyer_vendor_id"]))["name"]), ("Item", invoice.get("title", "")), ("Invoice amount", f'{invoice.get("currency", "INR")} {invoice.get("amount", 0)}'), ("Paid", f'{invoice.get("currency", "INR")} {invoice.get("paid_amount", 0)}'), ("Outstanding", f'{invoice.get("currency", "INR")} {invoice.get("balance_due", invoice.get("amount", 0))}'), ("Due date", invoice.get("due_date") or "—")]
    return _pdf_response("B2B Tax / Sales Invoice", rows, f'{invoice["invoice_no"]}.pdf')
