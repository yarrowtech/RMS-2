"""Production and job-work material issue/receipt workflow.

This module deliberately does not reuse purchase orders or GRNs. Fabric sent
to a cutter or stitcher remains retailer-owned material, so it is moved into a
job-work order balance and reconciled when panels/finished goods return.
"""

from datetime import datetime
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException

from ..db import (
    inventory_collection,
    job_work_orders_collection,
    job_work_receipts_collection,
    purchaseorders_collection,
    style_bom_plans_collection,
    tenants_collection,
    vendor_tenant_links_collection,
    vendors_collection,
)
from .deps import get_hq_tenant
from .vendor_routes import decode_token
from .purchaseorder_routes import calculate_po_totals, generate_po_number, resolve_real_barcode

router = APIRouter(prefix="/api/job-work", tags=["Production & Job Work"])

JOB_WORK_TYPES = {"Cutting", "Stitching", "Finishing", "Embroidery", "Washing", "Packing", "Other"}


def _number(value: Any, default: float = 0.0) -> float:
    try:
        number = float(value if value is not None else default)
        return number if number >= 0 else default
    except (TypeError, ValueError):
        return default


def _serialize(document: dict) -> dict:
    row = dict(document)
    row["id"] = str(row.pop("_id"))
    for key in ("created_at", "updated_at", "issued_at", "due_date"):
        if isinstance(row.get(key), datetime):
            row[key] = row[key].isoformat()
    return row


async def _require_job_work(ctx: dict = Depends(get_hq_tenant)) -> dict:
    """Job work is a central production operation, never a store operation."""
    permissions = set(ctx.get("_permissions") or [])
    departments = set(ctx.get("_managed_departments") or [])
    if "job_work" not in permissions and "Production & Job Work" not in departments:
        raise HTTPException(
            status_code=403,
            detail="Production & Job Work permission is required. Ask an HQ administrator to grant it.",
        )
    return ctx


async def _get_order(order_id: str, tenant_id: str) -> dict:
    if not ObjectId.is_valid(order_id):
        raise HTTPException(status_code=400, detail="Invalid job work order ID.")
    order = await job_work_orders_collection.find_one({"_id": ObjectId(order_id), "tenant_id": tenant_id})
    if not order:
        raise HTTPException(status_code=404, detail="Job work order not found.")
    return order


def _vendor_session(authorization: str | None) -> str:
    """Return the calling vendor identity from the normal vendor JWT."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Vendor authorization token missing.")
    decoded = decode_token(authorization.split(" ", 1)[1])
    vendor_id = (decoded or {}).get("vendor_id")
    if not vendor_id or not ObjectId.is_valid(vendor_id):
        raise HTTPException(status_code=401, detail="Invalid or expired vendor session.")
    return str(vendor_id)


async def _approved_vendor(tenant_id: str, vendor_id: str) -> tuple[dict, dict]:
    if not ObjectId.is_valid(vendor_id):
        raise HTTPException(status_code=400, detail="Invalid registered vendor.")
    vendor_oid = ObjectId(vendor_id)
    link = await vendor_tenant_links_collection.find_one({
        "vendor_id": vendor_oid, "tenant_id": tenant_id, "status": "Approved",
    })
    vendor = await vendors_collection.find_one({"_id": vendor_oid})
    if not link or not vendor:
        raise HTTPException(status_code=400, detail="Choose an approved vendor belonging to this retailer.")
    return vendor, link


async def _job_work_enabled_vendor(vendor: dict) -> bool:
    """Job Work is a business capability, independent of subscription tier."""
    business_types = {str(item).strip().lower() for item in (vendor.get("business_type") or [])}
    return "job_worker" in business_types


async def _require_vendor_job_work_access(vendor_id: str) -> dict:
    vendor = await vendors_collection.find_one({"_id": ObjectId(vendor_id)})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor account not found.")
    if not await _job_work_enabled_vendor(vendor):
        raise HTTPException(
            status_code=403,
            detail="Job Work is available only to vendors with the Job-work partner business type.",
        )
    return vendor


async def _increase_central_stock(tenant_id: str, barcode: str, quantity: float, product: str, rate: float, reason: str) -> None:
    existing = await inventory_collection.find_one({"tenant_id": tenant_id, "barcode": barcode})
    adjustment = {
        "qty_change": quantity,
        "reason": reason,
        "adjustedAt": datetime.utcnow().isoformat(),
        "source": "job_work_receipt",
    }
    if existing:
        await inventory_collection.update_one(
            {"_id": existing["_id"], "tenant_id": tenant_id},
            {"$inc": {"stockQty": quantity}, "$set": {"updatedAt": datetime.utcnow()}, "$push": {"adjustments": adjustment}},
        )
        return
    await inventory_collection.insert_one({
        "tenant_id": tenant_id,
        "barcode": barcode,
        "stockQty": quantity,
        "rate": rate,
        "mrp": rate,
        "description": product,
        "source": "job_work_receipt",
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
        "adjustments": [adjustment],
    })


@router.get("/material-stock")
async def material_stock(ctx: dict = Depends(_require_job_work)):
    """Central stock available to issue to a job worker."""
    rows = []
    cursor = inventory_collection.find(
        {"tenant_id": ctx["tenant_id"], "stockQty": {"$gt": 0}},
        {"barcode": 1, "sku": 1, "description": 1, "product": 1, "stockQty": 1, "rate": 1, "mrp": 1, "unit": 1},
    ).sort("description", 1).limit(1000)
    async for item in cursor:
        rows.append({
            "barcode": item.get("barcode", ""), "sku": item.get("sku", ""),
            "product": item.get("description") or item.get("product") or item.get("barcode", ""),
            "available_qty": _number(item.get("stockQty")),
            "rate": _number(item.get("rate") or item.get("mrp")),
            "unit": item.get("unit") or "units",
        })
    return {"data": rows}


@router.get("/vendors")
async def approved_job_work_vendors(ctx: dict = Depends(_require_job_work)):
    """Approved RMS vendors available as registered job-work partners."""
    rows = []
    async for link in vendor_tenant_links_collection.find({
        "tenant_id": ctx["tenant_id"], "status": "Approved",
    }).sort("created_at", -1):
        vendor = await vendors_collection.find_one({"_id": link.get("vendor_id")})
        if not vendor or not await _job_work_enabled_vendor(vendor):
            continue
        rows.append({
            "id": str(vendor["_id"]),
            "name": vendor.get("name") or vendor.get("vendor_name") or "Registered vendor",
            "business_type": vendor.get("business_type") or [],
            "product_categories": vendor.get("product_categories") or [],
            "vendor_code": link.get("vendor_code") or "",
        })
    return {"data": rows}


@router.get("/material-plans")
async def list_material_plans(ctx: dict = Depends(_require_job_work)):
    """Style BOMs with calculated fabric/material quantities for a planned run."""
    rows = []
    async for plan in style_bom_plans_collection.find({"tenant_id": ctx["tenant_id"]}).sort("created_at", -1).limit(300):
        rows.append(_serialize(plan))
    return {"data": rows}


@router.post("/material-plans", status_code=201)
async def create_material_plan(payload: dict, ctx: dict = Depends(_require_job_work)):
    """Save a style BOM and calculate material requirements before purchasing."""
    style_name = str(payload.get("style_name") or "").strip()
    planned_quantity = _number(payload.get("planned_quantity"))
    wastage_pct = _number(payload.get("wastage_pct"))
    if not style_name or planned_quantity <= 0:
        raise HTTPException(status_code=400, detail="Style name and planned output quantity are required.")
    if wastage_pct > 100:
        raise HTTPException(status_code=400, detail="Wastage cannot exceed 100%.")

    supplied_materials = payload.get("materials") or []
    if not isinstance(supplied_materials, list) or not supplied_materials:
        raise HTTPException(status_code=400, detail="Add at least one fabric or material line.")
    materials = []
    for line in supplied_materials:
        material_name = str(line.get("material_name") or "").strip()
        consumption = _number(line.get("consumption_per_unit"))
        if not material_name or consumption <= 0:
            raise HTTPException(status_code=400, detail="Every material needs a name and consumption per garment.")
        line_wastage = _number(line.get("wastage_pct"), wastage_pct)
        if line_wastage > 100:
            raise HTTPException(status_code=400, detail=f"Wastage for {material_name} cannot exceed 100%.")
        required = round(planned_quantity * consumption * (1 + line_wastage / 100), 3)
        materials.append({
            "material_name": material_name,
            "specification": str(line.get("specification") or "").strip()[:500],
            "consumption_per_unit": consumption,
            "unit": str(line.get("unit") or "m").strip() or "m",
            "wastage_pct": line_wastage,
            "required_quantity": required,
            "rate": _number(line.get("rate")),
        })

    now = datetime.utcnow()
    plan = {
        "tenant_id": ctx["tenant_id"],
        "plan_no": f"BOM-{now.strftime('%y%m%d')}-{(await style_bom_plans_collection.count_documents({'tenant_id': ctx['tenant_id']})) + 1:04d}",
        "style_name": style_name,
        "style_code": str(payload.get("style_code") or "").strip()[:100],
        "planned_quantity": planned_quantity,
        "finished_unit": str(payload.get("finished_unit") or "pcs").strip() or "pcs",
        "wastage_pct": wastage_pct,
        "materials": materials,
        "purchase_order_id": None,
        "purchase_order_no": None,
        "created_by": ctx.get("admin_id"),
        "created_at": now,
        "updated_at": now,
    }
    result = await style_bom_plans_collection.insert_one(plan)
    plan["_id"] = result.inserted_id
    return {"message": "Material plan calculated. Choose a fabric supplier to create the purchase-order draft.", "data": _serialize(plan)}


@router.post("/material-plans/{plan_id}/purchase-order", status_code=201)
async def create_fabric_purchase_order(plan_id: str, payload: dict, ctx: dict = Depends(_require_job_work)):
    """Create one existing-system Fabric PO from a calculated material plan."""
    if not ObjectId.is_valid(plan_id):
        raise HTTPException(status_code=400, detail="Invalid material plan ID.")
    plan = await style_bom_plans_collection.find_one({"_id": ObjectId(plan_id), "tenant_id": ctx["tenant_id"]})
    if not plan:
        raise HTTPException(status_code=404, detail="Material plan not found.")
    if plan.get("purchase_order_id"):
        raise HTTPException(status_code=400, detail=f"This plan already created PO {plan.get('purchase_order_no') or ''}.".strip())

    vendor_id = str(payload.get("vendor_id") or "").strip()
    vendor, _link = await _approved_vendor(ctx["tenant_id"], vendor_id)
    vendor_name = vendor.get("name") or vendor.get("vendor_name") or "Fabric supplier"
    tenant = await tenants_collection.find_one({"tenant_id": ctx["tenant_id"]}, {"company_name": 1, "name": 1})
    owner_name = (tenant or {}).get("company_name") or (tenant or {}).get("name") or ctx["tenant_id"]

    items = []
    for material in plan.get("materials") or []:
        description = material["material_name"]
        if material.get("specification"):
            description = f"{description} | {material['specification']}"
        quantity = _number(material.get("required_quantity"))
        rate = _number(material.get("rate"))
        item = {
            "description": description,
            "quantity": quantity,
            "originalQty": quantity,
            "pendingQty": quantity,
            "receivedQty": 0,
            "cancelledQty": 0,
            "rate": rate,
            "amount": round(quantity * rate, 2),
            "remarks": f"{material.get('unit', 'm')} required for {plan.get('style_name')}",
        }
        item["barcode"] = await resolve_real_barcode(item)
        items.append(item)

    now = datetime.utcnow()
    po = {
        "_id": ObjectId(),
        "tenant_id": ctx["tenant_id"],
        "orderNo": await generate_po_number(ctx["tenant_id"]),
        "orderDate": str(payload.get("order_date") or now.date().isoformat()),
        "vendorName": vendor_name,
        "vendor_id": ObjectId(vendor_id),
        "vendor_type": "registered",
        "status": "Draft",
        "orderType": "Fabric / Raw Material",
        "purchaseType": "Fabric / Raw Material",
        "ownerSite": owner_name,
        "ownerSiteShortName": owner_name[:20],
        "currency": str(payload.get("currency") or "INR"),
        "exchangeRate": 1,
        "notes": f"Auto-created from material plan {plan['plan_no']} for style {plan['style_name']}.",
        "items": items,
        "createdAt": now,
        "updatedAt": now,
    }
    calculate_po_totals(po)
    await purchaseorders_collection.insert_one(po)
    await style_bom_plans_collection.update_one(
        {"_id": plan["_id"], "tenant_id": ctx["tenant_id"]},
        {"$set": {"purchase_order_id": str(po["_id"]), "purchase_order_no": po["orderNo"], "updated_at": now}},
    )
    return {"message": f"Fabric PO {po['orderNo']} created as Draft. Review it in Merchandiser Buyer before sending.", "purchase_order_id": str(po["_id"]), "purchase_order_no": po["orderNo"]}


@router.get("/orders")
async def list_orders(status: str = "", ctx: dict = Depends(_require_job_work)):
    query: dict = {"tenant_id": ctx["tenant_id"]}
    if status.strip():
        query["status"] = status.strip().upper()
    rows = []
    async for order in job_work_orders_collection.find(query).sort("created_at", -1).limit(300):
        rows.append(_serialize(order))
    return {"data": rows}


@router.get("/dashboard")
async def dashboard(ctx: dict = Depends(_require_job_work)):
    tenant_id = ctx["tenant_id"]
    active = await job_work_orders_collection.count_documents({"tenant_id": tenant_id, "status": {"$in": ["DRAFT", "ISSUED", "PARTIALLY_RECEIVED"]}})
    issued = await job_work_orders_collection.count_documents({"tenant_id": tenant_id, "status": {"$in": ["ISSUED", "PARTIALLY_RECEIVED"]}})
    completed = await job_work_orders_collection.count_documents({"tenant_id": tenant_id, "status": "COMPLETED"})
    waste_rows = await job_work_receipts_collection.aggregate([
        {"$match": {"tenant_id": tenant_id}},
        {"$unwind": "$materials"},
        {"$group": {"_id": None, "waste": {"$sum": "$materials.waste_qty"}}},
    ]).to_list(length=1)
    return {
        "active_orders": active,
        "with_job_workers": issued,
        "completed_orders": completed,
        "recorded_wastage": round(_number((waste_rows[0] if waste_rows else {}).get("waste")), 3),
    }


@router.post("/orders", status_code=201)
async def create_order(payload: dict, ctx: dict = Depends(_require_job_work)):
    job_worker_name = str(payload.get("job_worker_name") or "").strip()
    registered_vendor_id = str(payload.get("vendor_id") or "").strip()
    job_work_type = str(payload.get("job_work_type") or "").strip()
    finished_product = str(payload.get("finished_product") or "").strip()
    expected_quantity = _number(payload.get("expected_quantity"))
    vendor_link = None
    if registered_vendor_id:
        vendor, vendor_link = await _approved_vendor(ctx["tenant_id"], registered_vendor_id)
        job_worker_name = vendor.get("name") or vendor.get("vendor_name") or job_worker_name
    if not job_worker_name or not finished_product or expected_quantity <= 0:
        raise HTTPException(status_code=400, detail="Job worker, finished product and expected quantity are required.")
    if job_work_type not in JOB_WORK_TYPES:
        raise HTTPException(status_code=400, detail="Select a valid job work type.")

    sequence = await job_work_orders_collection.count_documents({"tenant_id": ctx["tenant_id"]}) + 1
    now = datetime.utcnow()
    order = {
        "tenant_id": ctx["tenant_id"],
        "order_no": f"JWO-{now.strftime('%y%m%d')}-{sequence:04d}",
        "job_worker_name": job_worker_name,
        "assigned_vendor_id": registered_vendor_id or None,
        "assigned_vendor_link_id": str(vendor_link["_id"]) if vendor_link else None,
        "job_work_type": job_work_type,
        "finished_product": finished_product,
        "expected_quantity": expected_quantity,
        "unit": str(payload.get("unit") or "pcs").strip() or "pcs",
        "due_date": str(payload.get("due_date") or "").strip(),
        "remarks": str(payload.get("remarks") or "").strip()[:1000],
        "status": "DRAFT",
        "materials": [],
        "outputs": [],
        "created_by": ctx.get("admin_id"),
        "created_at": now,
        "updated_at": now,
    }
    result = await job_work_orders_collection.insert_one(order)
    order["_id"] = result.inserted_id
    return {"message": "Job work order created. Issue material when it is physically sent.", "data": _serialize(order)}


@router.post("/orders/{order_id}/issue")
async def issue_material(order_id: str, payload: dict, ctx: dict = Depends(_require_job_work)):
    tenant_id = ctx["tenant_id"]
    order = await _get_order(order_id, tenant_id)
    if order.get("status") != "DRAFT":
        raise HTTPException(status_code=400, detail="Material can be issued only once for a draft job work order.")

    lines = payload.get("materials") or []
    if not isinstance(lines, list) or not lines:
        raise HTTPException(status_code=400, detail="Add at least one material line.")

    # Validate the requested total for each barcode before changing any stock.
    # This prevents two duplicate UI lines from issuing more than is available.
    requested_by_barcode: dict[str, float] = {}
    for line in lines:
        barcode = str(line.get("barcode") or "").strip()
        quantity = _number(line.get("issued_qty"))
        if not barcode or quantity <= 0:
            raise HTTPException(status_code=400, detail="Every material requires a barcode and issued quantity.")
        requested_by_barcode[barcode] = requested_by_barcode.get(barcode, 0.0) + quantity
    for barcode, requested_quantity in requested_by_barcode.items():
        stock = await inventory_collection.find_one({"tenant_id": tenant_id, "barcode": barcode})
        if not stock or _number(stock.get("stockQty")) < requested_quantity:
            available = _number((stock or {}).get("stockQty"))
            raise HTTPException(status_code=400, detail=f"Insufficient central stock for {barcode}. Available: {available}.")

    materials = []
    for line in lines:
        barcode = str(line.get("barcode") or "").strip()
        quantity = _number(line.get("issued_qty"))
        stock = await inventory_collection.find_one({"tenant_id": tenant_id, "barcode": barcode})
        product = str(line.get("product") or stock.get("description") or stock.get("product") or barcode).strip()
        rate = _number(line.get("rate") or stock.get("rate") or stock.get("mrp"))
        await inventory_collection.update_one(
            {"_id": stock["_id"], "tenant_id": tenant_id},
            {"$inc": {"stockQty": -quantity}, "$set": {"updatedAt": datetime.utcnow()}, "$push": {"adjustments": {
                "qty_change": -quantity,
                "reason": f"Job work issue {order['order_no']} to {order['job_worker_name']}",
                "adjustedAt": datetime.utcnow().isoformat(),
                "source": "job_work_issue",
            }}},
        )
        materials.append({
            "barcode": barcode, "product": product, "unit": str(line.get("unit") or stock.get("unit") or "units"),
            "rate": rate, "issued_qty": quantity, "used_qty": 0.0, "returned_qty": 0.0, "waste_qty": 0.0,
        })

    now = datetime.utcnow()
    challan_no = str(payload.get("challan_no") or f"JWC-{now.strftime('%y%m%d')}-{order['order_no'].split('-')[-1]}").strip()
    await job_work_orders_collection.update_one(
        {"_id": order["_id"], "tenant_id": tenant_id},
        {"$set": {"materials": materials, "issue_challan_no": challan_no, "issued_at": now, "status": "ISSUED", "updated_at": now}},
    )
    return {"message": "Material issue challan created. Material is now tracked as with the job worker.", "challan_no": challan_no}


@router.get("/vendor/orders")
async def vendor_job_work_orders(authorization: str = Header(None)):
    """Vendor portal: only job-work orders assigned to this vendor identity."""
    vendor_id = _vendor_session(authorization)
    await _require_vendor_job_work_access(vendor_id)
    tenant_names: dict[str, str] = {}
    orders = []
    async for order in job_work_orders_collection.find({"assigned_vendor_id": vendor_id}).sort("created_at", -1).limit(300):
        tenant_id = order.get("tenant_id", "")
        if tenant_id not in tenant_names:
            tenant = await tenants_collection.find_one({"tenant_id": tenant_id}, {"company_name": 1, "name": 1})
            tenant_names[tenant_id] = (tenant or {}).get("company_name") or (tenant or {}).get("name") or tenant_id
        row = _serialize(order)
        row["retailer_name"] = tenant_names[tenant_id]
        orders.append(row)
    return {"data": orders}


@router.post("/vendor/orders/{order_id}/acknowledge")
async def vendor_acknowledge_job_work(order_id: str, payload: dict | None = None, authorization: str = Header(None)):
    """Vendor confirms receipt of the job-work instruction/material challan."""
    vendor_id = _vendor_session(authorization)
    await _require_vendor_job_work_access(vendor_id)
    if not ObjectId.is_valid(order_id):
        raise HTTPException(status_code=400, detail="Invalid job work order ID.")
    order = await job_work_orders_collection.find_one({"_id": ObjectId(order_id), "assigned_vendor_id": vendor_id})
    if not order:
        raise HTTPException(status_code=404, detail="Job work order not found for this vendor.")
    if order.get("status") not in {"ISSUED", "PARTIALLY_RECEIVED"}:
        raise HTTPException(status_code=400, detail="Material must be issued before it can be acknowledged.")
    now = datetime.utcnow()
    note = str((payload or {}).get("note") or "").strip()[:1000]
    await job_work_orders_collection.update_one(
        {"_id": order["_id"], "assigned_vendor_id": vendor_id},
        {"$set": {"vendor_acknowledged_at": now, "vendor_acknowledgement_note": note, "updated_at": now}},
    )
    return {"message": "Job work instruction acknowledged. The retailer will record the physical receipt."}


@router.post("/vendor/orders/{order_id}/progress")
async def vendor_update_job_work_progress(order_id: str, payload: dict, authorization: str = Header(None)):
    """Vendor can report progress; this never changes retailer stock."""
    vendor_id = _vendor_session(authorization)
    await _require_vendor_job_work_access(vendor_id)
    if not ObjectId.is_valid(order_id):
        raise HTTPException(status_code=400, detail="Invalid job work order ID.")
    order = await job_work_orders_collection.find_one({"_id": ObjectId(order_id), "assigned_vendor_id": vendor_id})
    if not order:
        raise HTTPException(status_code=404, detail="Job work order not found for this vendor.")
    stage = str(payload.get("stage") or "UPDATE").strip().upper()
    if stage not in {"CUTTING_STARTED", "STITCHING_STARTED", "READY_FOR_RETURN", "DELAYED", "UPDATE"}:
        raise HTTPException(status_code=400, detail="Invalid job-work progress stage.")
    message = str(payload.get("message") or "").strip()[:1000]
    if not message and stage == "UPDATE":
        raise HTTPException(status_code=400, detail="Add a progress message.")
    now = datetime.utcnow()
    update = {"stage": stage, "message": message, "at": now.isoformat(), "vendor_id": vendor_id}
    await job_work_orders_collection.update_one(
        {"_id": order["_id"], "assigned_vendor_id": vendor_id},
        {"$push": {"vendor_progress": update}, "$set": {"vendor_progress_stage": stage, "updated_at": now}},
    )
    return {"message": "Progress update shared with the retailer."}


@router.post("/orders/{order_id}/receipts", status_code=201)
async def receive_job_work(order_id: str, payload: dict, ctx: dict = Depends(_require_job_work)):
    tenant_id = ctx["tenant_id"]
    order = await _get_order(order_id, tenant_id)
    if order.get("status") not in {"ISSUED", "PARTIALLY_RECEIVED"}:
        raise HTTPException(status_code=400, detail="Issue material before recording a job work receipt.")

    incoming = payload.get("materials") or []
    if not isinstance(incoming, list) or not incoming:
        raise HTTPException(status_code=400, detail="Enter the material reconciliation for this receipt.")

    received_map = {str(line.get("barcode") or "").strip(): line for line in incoming}
    materials = [dict(line) for line in order.get("materials") or []]
    receipt_materials = []
    for material in materials:
        entry = received_map.get(material["barcode"], {})
        used = _number(entry.get("used_qty"))
        returned = _number(entry.get("returned_qty"))
        waste = _number(entry.get("waste_qty"))
        outstanding = _number(material.get("issued_qty")) - _number(material.get("used_qty")) - _number(material.get("returned_qty")) - _number(material.get("waste_qty"))
        if used + returned + waste > outstanding + 0.000001:
            raise HTTPException(status_code=400, detail=f"Reconciliation exceeds material outstanding balance for {material['product']}.")
        material["used_qty"] = round(_number(material.get("used_qty")) + used, 3)
        material["returned_qty"] = round(_number(material.get("returned_qty")) + returned, 3)
        material["waste_qty"] = round(_number(material.get("waste_qty")) + waste, 3)
        if returned:
            await _increase_central_stock(tenant_id, material["barcode"], returned, material["product"], _number(material.get("rate")), f"Job work material return {order['order_no']}")
        receipt_materials.append({"barcode": material["barcode"], "product": material["product"], "used_qty": used, "returned_qty": returned, "waste_qty": waste})

    output = payload.get("output") or {}
    output_barcode = str(output.get("barcode") or "").strip()
    output_product = str(output.get("product") or order.get("finished_product") or "").strip()
    output_qty = _number(output.get("quantity"))
    output_rate = _number(output.get("rate"))
    if output_qty > 0 and not output_barcode:
        raise HTTPException(status_code=400, detail="Finished output barcode is required when receiving finished quantity.")
    if output_qty:
        await _increase_central_stock(tenant_id, output_barcode, output_qty, output_product, output_rate, f"Job work output receipt {order['order_no']}")

    now = datetime.utcnow()
    all_reconciled = all(
        _number(line.get("issued_qty")) - _number(line.get("used_qty")) - _number(line.get("returned_qty")) - _number(line.get("waste_qty")) <= 0.000001
        for line in materials
    )
    status = "COMPLETED" if all_reconciled else "PARTIALLY_RECEIVED"
    receipt = {
        "tenant_id": tenant_id, "order_id": order["_id"], "order_no": order["order_no"],
        "receipt_no": f"JWR-{now.strftime('%y%m%d')}-{str(ObjectId())[-5:].upper()}",
        "materials": receipt_materials,
        "output": {"barcode": output_barcode, "product": output_product, "quantity": output_qty, "rate": output_rate},
        "remarks": str(payload.get("remarks") or "").strip()[:1000],
        "received_by": ctx.get("admin_id"), "received_at": now,
    }
    result = await job_work_receipts_collection.insert_one(receipt)
    outputs = list(order.get("outputs") or [])
    if output_qty:
        outputs.append({"receipt_id": str(result.inserted_id), **receipt["output"], "received_at": now.isoformat()})
    await job_work_orders_collection.update_one(
        {"_id": order["_id"], "tenant_id": tenant_id},
        {"$set": {"materials": materials, "outputs": outputs, "status": status, "updated_at": now}},
    )
    return {"message": f"Job work receipt recorded. Order status: {status.replace('_', ' ').title()}.", "receipt_id": str(result.inserted_id), "status": status}
