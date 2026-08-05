"""Vendor-owned inventory, independent from retailer inventory and B2B stock."""
from datetime import datetime
from typing import Optional
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Header

from ..db import vendor_catalogue_collection, vendor_inventory_collection, vendor_inventory_ledger_collection, purchaseorders_collection
from .vendor_routes import decode_token

router = APIRouter(prefix="/api/vendor-inventory", tags=["Vendor Inventory"])


def _vendor_id(authorization: Optional[str]) -> ObjectId:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization token missing")
    decoded = decode_token(authorization.split(" ", 1)[1])
    raw = (decoded or {}).get("vendor_id")
    if not raw or not ObjectId.is_valid(str(raw)):
        raise HTTPException(status_code=401, detail="Vendor login required")
    return ObjectId(str(raw))


def _num(value, field: str) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail=f"{field} must be a number")
    if number <= 0:
        raise HTTPException(status_code=400, detail=f"{field} must be greater than zero")
    return round(number, 3)


async def _write_ledger(inventory: dict, movement: str, quantity_in=0, quantity_out=0, note="", reference_no="", reserved_quantity=0):
    await vendor_inventory_ledger_collection.insert_one({
        "vendor_id": inventory["vendor_id"], "inventory_id": inventory["_id"],
        "product_name": inventory.get("product_name", ""), "variant_label": inventory.get("variant_label", ""),
        "movement_type": movement, "quantity_in": quantity_in, "quantity_out": quantity_out,
        "reference_no": reference_no, "note": note[:500], "reserved_quantity": reserved_quantity, "created_at": datetime.utcnow(),
    })


async def _seed_from_catalogue(vendor_id: ObjectId):
    """Create ledger opening balances once from the vendor's existing catalogue quantities."""
    async for product in vendor_catalogue_collection.find({"vendor_id": vendor_id}):
        variants = product.get("variants") or []
        rows = variants or [{"label": "", "sku": product.get("sku", ""), "stock": product.get("stock", product.get("quantity", 0))}]
        for index, variant in enumerate(rows):
            key = f"{product['_id']}:{index}" if variants else f"{product['_id']}:base"
            existing = await vendor_inventory_collection.find_one({"vendor_id": vendor_id, "catalogue_key": key})
            if existing:
                continue
            quantity = max(0.0, float(variant.get("stock", 0) or 0))
            doc = {
                "vendor_id": vendor_id, "catalogue_item_id": product["_id"], "catalogue_key": key,
                "product_name": product.get("item_name") or product.get("name") or "Untitled product",
                "variant_label": variant.get("label", ""), "sku": variant.get("sku") or product.get("sku", ""),
                "unit": product.get("unit") or "pcs", "on_hand": quantity, "reserved": 0.0,
                "reorder_level": float(product.get("reorder_level", 10) or 10), "created_at": datetime.utcnow(), "updated_at": datetime.utcnow(),
            }
            result = await vendor_inventory_collection.insert_one(doc)
            doc["_id"] = result.inserted_id
            if quantity:
                await _write_ledger(doc, "Opening balance", quantity_in=quantity, note="Imported from catalogue availability")


def _serialize(doc: dict) -> dict:
    available = round(float(doc.get("on_hand", 0) or 0) - float(doc.get("reserved", 0) or 0), 3)
    return {
        "_id": str(doc["_id"]), "product_name": doc.get("product_name", ""), "variant_label": doc.get("variant_label", ""),
        "sku": doc.get("sku", ""), "unit": doc.get("unit", "pcs"), "on_hand": float(doc.get("on_hand", 0) or 0),
        "reserved": float(doc.get("reserved", 0) or 0), "available": available,
        "reorder_level": float(doc.get("reorder_level", 10) or 0), "low_stock": available <= float(doc.get("reorder_level", 10) or 0),
    }


@router.get("/items")
async def list_items(authorization: str = Header(None)):
    vendor_id = _vendor_id(authorization)
    await _seed_from_catalogue(vendor_id)
    items = []
    async for item in vendor_inventory_collection.find({"vendor_id": vendor_id}).sort("product_name", 1):
        items.append(_serialize(item))
    return {"data": items, "low_stock_count": sum(1 for item in items if item["low_stock"]) }


@router.post("/items/{inventory_id}/add-stock")
async def add_stock(inventory_id: str, payload: dict, authorization: str = Header(None)):
    vendor_id = _vendor_id(authorization)
    if not ObjectId.is_valid(inventory_id):
        raise HTTPException(status_code=404, detail="Stock item not found")
    item = await vendor_inventory_collection.find_one({"_id": ObjectId(inventory_id), "vendor_id": vendor_id})
    if not item:
        raise HTTPException(status_code=404, detail="Stock item not found")
    quantity = _num(payload.get("quantity"), "Quantity")
    note = str(payload.get("note") or "Stock received / production completed").strip()
    await vendor_inventory_collection.update_one({"_id": item["_id"]}, {"$inc": {"on_hand": quantity}, "$set": {"updated_at": datetime.utcnow()}})
    item["on_hand"] = float(item.get("on_hand", 0)) + quantity
    await _write_ledger(item, "Stock added", quantity_in=quantity, note=note)
    return {"message": "Stock added"}


@router.post("/items/{inventory_id}/reserve")
async def reserve_stock(inventory_id: str, payload: dict, authorization: str = Header(None)):
    vendor_id = _vendor_id(authorization)
    if not ObjectId.is_valid(inventory_id) or not ObjectId.is_valid(str(payload.get("po_id") or "")):
        raise HTTPException(status_code=400, detail="Choose a stock item and confirmed purchase order")
    po = await purchaseorders_collection.find_one({"_id": ObjectId(str(payload["po_id"])), "$or": [{"vendor_id": vendor_id}, {"vendor_id": str(vendor_id)}], "status": {"$in": ["VendorSubmitted", "Approved"]}})
    if not po:
        raise HTTPException(status_code=400, detail="Only vendor-submitted or retailer-approved purchase orders can reserve vendor stock")
    item = await vendor_inventory_collection.find_one({"_id": ObjectId(inventory_id), "vendor_id": vendor_id})
    if not item:
        raise HTTPException(status_code=404, detail="Stock item not found")
    quantity = _num(payload.get("quantity"), "Quantity")
    available = float(item.get("on_hand", 0) or 0) - float(item.get("reserved", 0) or 0)
    if quantity > available:
        raise HTTPException(status_code=400, detail=f"Only {available:g} {item.get('unit', 'pcs')} is available to reserve")
    reference = po.get("orderNo") or po.get("po_number") or str(po["_id"])
    await vendor_inventory_collection.update_one({"_id": item["_id"]}, {"$inc": {"reserved": quantity}, "$set": {"updated_at": datetime.utcnow()}})
    await _write_ledger(item, "Reserved for PO", note="Reserved for submitted retailer order", reference_no=reference)
    reservation = await vendor_inventory_ledger_collection.find_one({"inventory_id": item["_id"], "reference_no": reference, "movement_type": "Reserved for PO"}, sort=[("created_at", -1)])
    if reservation:
        await vendor_inventory_ledger_collection.update_one({"_id": reservation["_id"]}, {"$set": {"reserved_quantity": quantity}})
    return {"message": f"{quantity:g} {item.get('unit', 'pcs')} reserved for {reference}"}

async def auto_reserve_for_approved_po(vendor_id: ObjectId, po: dict) -> dict:
    """Reserve matching vendor stock after buyer approval; never blocks the PO approval."""
    await _seed_from_catalogue(vendor_id)
    reference = po.get("orderNo") or po.get("po_number") or str(po["_id"])
    reserved, shortages = 0.0, []
    inventory = await vendor_inventory_collection.find({"vendor_id": vendor_id}).to_list(length=None)
    for line in po.get("items") or []:
        codes = {str(line.get(field) or "").strip().lower() for field in ("vendorBarcode", "vendorSku", "sku", "barcode")}
        codes.discard("")
        name = str(line.get("productName") or line.get("product") or line.get("itemName") or line.get("description") or "").strip().lower()
        item = next((row for row in inventory if str(row.get("sku") or "").strip().lower() in codes), None)
        if not item and name:
            item = next((row for row in inventory if str(row.get("product_name") or "").strip().lower() == name), None)
        try:
            ordered = float(line.get("quantity") or line.get("amendedQty") or 0)
        except (TypeError, ValueError):
            ordered = 0.0
        if not item or ordered <= 0:
            if ordered > 0:
                shortages.append({"item": name or next(iter(codes), "Unmatched item"), "quantity": ordered, "reason": "No matching vendor inventory item"})
            continue
        existing = 0.0
        async for entry in vendor_inventory_ledger_collection.find({"vendor_id": vendor_id, "inventory_id": item["_id"], "reference_no": reference, "movement_type": "Reserved for PO", "dispatch_consumed": {"$ne": True}}):
            existing += float(entry.get("reserved_quantity", 0) or 0)
        needed = max(0.0, ordered - existing)
        available = max(0.0, float(item.get("on_hand", 0) or 0) - float(item.get("reserved", 0) or 0))
        to_reserve = min(needed, available)
        if to_reserve:
            await vendor_inventory_collection.update_one({"_id": item["_id"]}, {"$inc": {"reserved": to_reserve}, "$set": {"updated_at": datetime.utcnow()}})
            await _write_ledger(item, "Reserved for PO", note="Automatically reserved when retailer approved the PO", reference_no=reference, reserved_quantity=to_reserve)
            reserved += to_reserve
        if needed > to_reserve:
            shortages.append({"item": item.get("product_name", name), "quantity": needed - to_reserve, "reason": "Insufficient available stock"})
    return {"reserved": round(reserved, 3), "shortages": shortages}

async def consume_reservations_for_po(vendor_id: ObjectId, po: dict):
    """Called only when a vendor marks an approved PO as Dispatched."""
    reference = po.get("orderNo") or po.get("po_number") or str(po["_id"])
    cursor = vendor_inventory_ledger_collection.find({"vendor_id": vendor_id, "reference_no": reference, "movement_type": "Reserved for PO", "dispatch_consumed": {"$ne": True}})
    async for reservation in cursor:
        qty = float(reservation.get("reserved_quantity", 0) or 0)
        if qty <= 0:
            continue
        item = await vendor_inventory_collection.find_one({"_id": reservation["inventory_id"], "vendor_id": vendor_id})
        if not item:
            continue
        qty = min(qty, float(item.get("reserved", 0) or 0), float(item.get("on_hand", 0) or 0))
        if qty <= 0:
            continue
        await vendor_inventory_collection.update_one({"_id": item["_id"]}, {"$inc": {"on_hand": -qty, "reserved": -qty}, "$set": {"updated_at": datetime.utcnow()}})
        await vendor_inventory_ledger_collection.update_one({"_id": reservation["_id"]}, {"$set": {"dispatch_consumed": True, "dispatched_at": datetime.utcnow()}})
        await _write_ledger(item, "Dispatched for PO", quantity_out=qty, note="Deducted when vendor marked the PO dispatched", reference_no=reference)


@router.post("/items/{inventory_id}/reorder-level")
async def update_reorder_level(inventory_id: str, payload: dict, authorization: str = Header(None)):
    vendor_id = _vendor_id(authorization)
    try:
        level = max(0.0, float(payload.get("reorder_level")))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Reorder level must be a number")
    result = await vendor_inventory_collection.update_one({"_id": ObjectId(inventory_id), "vendor_id": vendor_id}, {"$set": {"reorder_level": level, "updated_at": datetime.utcnow()}})
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Stock item not found")
    return {"message": "Low-stock level updated"}


@router.get("/purchase-orders")
async def approved_purchase_orders(authorization: str = Header(None)):
    vendor_id = _vendor_id(authorization)
    rows = []
    async for po in purchaseorders_collection.find({"$or": [{"vendor_id": vendor_id}, {"vendor_id": str(vendor_id)}], "status": {"$in": ["VendorSubmitted", "Approved"]}}, {"orderNo": 1, "orderDate": 1, "expectedDeliveryDate": 1, "tenant_id": 1}).sort("updatedAt", -1).limit(100):
        rows.append({"id": str(po["_id"]), "order_no": po.get("orderNo") or str(po["_id"]), "order_date": str(po.get("orderDate") or ""), "delivery_date": str(po.get("expectedDeliveryDate") or ""), "tenant_id": po.get("tenant_id", "")})
    return {"data": rows}


@router.get("/items/{inventory_id}/ledger")
async def item_ledger(inventory_id: str, authorization: str = Header(None)):
    vendor_id = _vendor_id(authorization)
    if not ObjectId.is_valid(inventory_id):
        raise HTTPException(status_code=404, detail="Stock item not found")
    rows = []
    async for entry in vendor_inventory_ledger_collection.find({"vendor_id": vendor_id, "inventory_id": ObjectId(inventory_id)}).sort("created_at", -1).limit(80):
        rows.append({**{key: entry.get(key) for key in ("movement_type", "quantity_in", "quantity_out", "reference_no", "note")}, "created_at": entry.get("created_at").isoformat() if entry.get("created_at") else None})
    return {"data": rows}