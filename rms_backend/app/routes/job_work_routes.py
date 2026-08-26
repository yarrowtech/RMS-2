"""Production and job-work material issue/receipt workflow.

This module deliberately does not reuse purchase orders or GRNs. Fabric sent
to a cutter or stitcher remains retailer-owned material, so it is moved into a
job-work order balance and reconciled when panels/finished goods return.
"""

from datetime import datetime, timedelta
from typing import Any
import uuid
from urllib.parse import quote

from bson import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException, Query

from ..db import (
    fabric_themes_collection,
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
from .purchaseorder_routes import TOKEN_EXPIRY_DAYS, _clean_whatsapp_mobile, _make_share_link, calculate_po_totals, generate_po_number, resolve_real_barcode

router = APIRouter(prefix="/api/job-work", tags=["Production & Job Work"])

JOB_WORK_TYPES = {"Cutting", "Stitching", "Finishing", "Embroidery", "Washing", "Packing", "Other"}
CONSUMPTION_OVERAGE_WARNING_PCT = 10


def _number(value: Any, default: float = 0.0) -> float:
    try:
        number = float(value if value is not None else default)
        return number if number >= 0 else default
    except (TypeError, ValueError):
        return default


def _is_overdue(row: dict) -> bool:
    promised = (row.get("vendor_acknowledgement") or {}).get("promised_ready_date") or ""
    if not promised or row.get("status") == "COMPLETED" or row.get("vendor_progress_stage") == "READY_FOR_RETURN":
        return False
    try:
        return datetime.strptime(promised, "%Y-%m-%d").date() < datetime.utcnow().date()
    except ValueError:
        return False


def _serialize(document: dict) -> dict:
    row = dict(document)
    row["id"] = str(row.pop("_id"))
    for key in ("created_at", "updated_at", "issued_at", "due_date"):
        if isinstance(row.get(key), datetime):
            row[key] = row[key].isoformat()
    row["is_overdue"] = _is_overdue(row)
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


async def _require_job_work_or_buyer(ctx: dict = Depends(get_hq_tenant)) -> dict:
    """Same as _require_job_work, but also lets a Merchandiser Buyer through —
    used only for the fabric-supplier list and manual fabric PO creation, so
    a buyer can raise a Fabric PO directly without needing the rest of the
    Production & Job Work workflow (material stock, job orders, receipts)."""
    permissions = set(ctx.get("_permissions") or [])
    departments = set(ctx.get("_managed_departments") or [])
    allowed = (
        "job_work" in permissions or "Production & Job Work" in departments
        or "mbuyer" in permissions or "Merchandiser Buyer" in departments
    )
    if not allowed:
        raise HTTPException(
            status_code=403,
            detail="Production & Job Work or Merchandiser Buyer permission is required.",
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
    return _vendor_has_business_type(vendor, "job_worker")


def _vendor_has_business_type(vendor: dict, business_type: str) -> bool:
    business_types = {str(item).strip().lower() for item in (vendor.get("business_type") or [])}
    return business_type in business_types


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


LEFTOVER_BARCODE_SUFFIX = "-LEFTOVER"


async def _add_leftover_stock(tenant_id: str, parent_barcode: str, quantity: float, product: str, rate: float, reason: str) -> None:
    """A reusable fabric remnant — NOT the same as job-work waste_qty, which
    is a true write-off that never touches inventory. This is recorded as
    its own inventory line, one running pool per source material (not one
    row per order), so it stays distinctly visible/searchable in material
    stock — a job worker can consciously draw down a leftover pool for a
    small job instead of issuing fresh fabric for it."""
    leftover_barcode = f"{parent_barcode}{LEFTOVER_BARCODE_SUFFIX}"
    existing = await inventory_collection.find_one({"tenant_id": tenant_id, "barcode": leftover_barcode})
    adjustment = {
        "qty_change": quantity, "reason": reason,
        "adjustedAt": datetime.utcnow().isoformat(), "source": "job_work_leftover",
    }
    if existing:
        await inventory_collection.update_one(
            {"_id": existing["_id"], "tenant_id": tenant_id},
            {"$inc": {"stockQty": quantity}, "$set": {"updatedAt": datetime.utcnow()}, "$push": {"adjustments": adjustment}},
        )
        return
    await inventory_collection.insert_one({
        "tenant_id": tenant_id,
        "barcode": leftover_barcode,
        "stockQty": quantity,
        "rate": rate, "mrp": rate,
        "description": f"{product} — leftover remnant",
        "is_leftover": True,
        "parent_barcode": parent_barcode,
        "source": "job_work_leftover",
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
        "adjustments": [adjustment],
    })


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
        {
            "barcode": 1, "sku": 1, "description": 1, "product": 1, "stockQty": 1, "rate": 1, "mrp": 1, "unit": 1,
            "is_leftover": 1, "is_fabric": 1, "fabric_type": 1, "gsm": 1, "width": 1, "color": 1,
        },
    ).sort("description", 1).limit(1000)
    async for item in cursor:
        rows.append({
            "barcode": item.get("barcode", ""), "sku": item.get("sku", ""),
            "product": item.get("description") or item.get("product") or item.get("barcode", ""),
            "available_qty": _number(item.get("stockQty")),
            "rate": _number(item.get("rate") or item.get("mrp")),
            "unit": item.get("unit") or "units",
            "is_leftover": bool(item.get("is_leftover")),
            # ⚠️ NEW — now that GRC/GRN receipt preserves fabric identity
            # (see grc_routes.py/grn_routes.py), surface it here too so the
            # job-work material picker can show real fabric detail instead
            # of a bare description string.
            "is_fabric": bool(item.get("is_fabric")),
            "fabric_type": item.get("fabric_type") or "",
            "gsm": item.get("gsm") or "",
            "width": item.get("width") or "",
            "color": item.get("color") or "",
        })
    return {"data": rows}


@router.get("/vendors")
async def approved_job_work_vendors(
    kind: str = Query("job_worker", description="job_worker (stitching/cutting partners) or fabric_supplier (fabric/raw-material vendors) — two distinct business types, never conflated."),
    ctx: dict = Depends(_require_job_work_or_buyer),
):
    """Approved RMS vendors available for this module — job-work partners by
    default, or fabric/raw-material suppliers when kind=fabric_supplier.
    These were previously the same hardcoded job_worker-only list, which
    silently hid every registered fabric supplier from the Fabric buying
    cart's "Approved fabric supplier" dropdown."""
    business_type = "fabric_supplier" if kind == "fabric_supplier" else "job_worker"
    rows = []
    async for link in vendor_tenant_links_collection.find({
        "tenant_id": ctx["tenant_id"], "status": "Approved",
    }).sort("created_at", -1):
        vendor = await vendors_collection.find_one({"_id": link.get("vendor_id")})
        if not vendor or not _vendor_has_business_type(vendor, business_type):
            continue
        rows.append({
            "id": str(vendor["_id"]),
            "name": vendor.get("name") or vendor.get("vendor_name") or "Registered vendor",
            "business_type": vendor.get("business_type") or [],
            "product_categories": vendor.get("product_categories") or [],
            "vendor_code": link.get("vendor_code") or "",
        })
    return {"data": rows}


def _fabric_specs_from_item(item: dict) -> str:
    parts = []
    for label, key in (("Type", "fabric_type"), ("GSM", "gsm"), ("Width", "width"), ("Colour", "color")):
        value = str(item.get(key) or "").strip()
        if value:
            parts.append(f"{label}: {value}")
    extra = str(item.get("specification") or item.get("remarks") or "").strip()
    if extra:
        parts.append(extra)
    return " | ".join(parts)


async def _create_fabric_po_document(ctx: dict, payload: dict, plan: dict | None = None) -> dict:
    vendor_id = str(payload.get("vendor_id") or "").strip()
    vendor_type = "registered" if vendor_id else "walkin"
    vendor = None
    walkin_vendor = {}
    if vendor_id:
        vendor, _link = await _approved_vendor(ctx["tenant_id"], vendor_id)
        vendor_name = vendor.get("name") or vendor.get("vendor_name") or "Fabric supplier"
    else:
        walkin_vendor = dict(payload.get("walkin_vendor") or {})
        vendor_name = str(walkin_vendor.get("name") or payload.get("vendor_name") or "").strip()
        if not vendor_name:
            raise HTTPException(status_code=400, detail="Enter walk-in fabric supplier name or choose an approved supplier.")
        walkin_vendor = {
            "name": vendor_name,
            "mobile": str(walkin_vendor.get("mobile") or "").strip(),
            "email": str(walkin_vendor.get("email") or "").strip(),
            "address": str(walkin_vendor.get("address") or "").strip(),
            "gstin": str(walkin_vendor.get("gstin") or "").strip(),
            "contact_person": str(walkin_vendor.get("contact_person") or "").strip(),
            "business_type": "fabric_supplier",
        }
    tenant = await tenants_collection.find_one({"tenant_id": ctx["tenant_id"]}, {"company_name": 1, "name": 1})
    owner_name = (tenant or {}).get("company_name") or (tenant or {}).get("name") or ctx["tenant_id"]

    source_items = payload.get("items") or []
    if plan and not source_items:
        source_items = plan.get("materials") or []
    if not source_items:
        raise HTTPException(status_code=400, detail="Add at least one fabric/material line before creating the PO.")

    items = []
    sheet_rows = []
    for index, material in enumerate(source_items, start=1):
        name = str(material.get("material_name") or material.get("fabric_name") or material.get("description") or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail=f"Fabric/material name is required on line {index}.")
        quantity = _number(material.get("required_quantity", material.get("total_quantity", material.get("quantity"))))
        if quantity <= 0:
            raise HTTPException(status_code=400, detail=f"Total fabric quantity is required on line {index}.")
        unit = str(material.get("unit") or "m").strip() or "m"
        rate = _number(material.get("rate"))
        specs = _fabric_specs_from_item(material)
        description = f"{name} | {specs}" if specs else name
        remarks = str(material.get("remarks") or "").strip()
        image_url = str(material.get("image_url") or material.get("image") or material.get("catalogue_image") or "").strip()
        if plan and not remarks:
            remarks = f"{unit} required for {plan.get('style_name')}"
        item = {
            "description": description,
            "quantity": quantity,
            "originalQty": quantity,
            "pendingQty": quantity,
            "receivedQty": 0,
            "cancelledQty": 0,
            "rate": rate,
            "amount": round(quantity * rate, 2),
            "remarks": remarks,
            "fabric_type": str(material.get("fabric_type") or "").strip(),
            "gsm": str(material.get("gsm") or "").strip(),
            "width": str(material.get("width") or "").strip(),
            "color": str(material.get("color") or "").strip(),
            "unit": unit,
            "image_url": image_url,
            "catalogue_item_id": str(material.get("catalogue_item_id") or "").strip(),
        }
        item["barcode"] = await resolve_real_barcode(item)
        items.append(item)
        sheet_rows.append({
            "sl_no": index,
            "fabric_material": name,
            "fabric_type": item["fabric_type"],
            "gsm": item["gsm"],
            "width": item["width"],
            "color": item["color"],
            "quantity": quantity,
            "unit": unit,
            "rate": rate,
            "amount": item["amount"],
            "remarks": remarks,
            "image_url": image_url,
        })

    now = datetime.utcnow()
    source_note = f" from material plan {plan.get('plan_no')} for style {plan.get('style_name')}" if plan else " from manual fabric cart"
    po = {
        "_id": ObjectId(),
        "tenant_id": ctx["tenant_id"],
        "orderNo": await generate_po_number(ctx["tenant_id"]),
        "orderDate": str(payload.get("order_date") or now.date().isoformat()),
        "expectedDeliveryDate": str(payload.get("expected_delivery_date") or ""),
        "vendorName": vendor_name,
        "vendor_id": ObjectId(vendor_id) if vendor_id else None,
        "vendor_type": vendor_type,
        "walkin_vendor": walkin_vendor if vendor_type == "walkin" else None,
        # Matches the regular PO flow's default (PurchaseOrderModel.status =
        # "Pending") — this used to be hard-coded to "Draft" with no code
        # path anywhere that ever advanced it, so the buyer's "Send to
        # Vendor" button (gated on status == "Pending") could never fire
        # while the vendor could already see the full PO regardless.
        "status": "Pending",
        "orderType": "Fabric / Raw Material",
        "purchaseType": "Fabric / Raw Material",
        "ownerSite": owner_name,
        "ownerSiteShortName": owner_name[:20],
        "currency": str(payload.get("currency") or "INR"),
        "exchangeRate": 1,
        "paymentTerms": str(payload.get("payment_terms") or "").strip(),
        "notes": str(payload.get("notes") or f"Fabric PO created{source_note}. Review tax, freight and terms before sending.").strip(),
        "fabric_po_sheet": sheet_rows,
        "items": items,
        "createdAt": now,
        "updatedAt": now,
    }
    calculate_po_totals(po)
    share_link = ""
    whatsapp_message = ""
    whatsapp_url = ""
    if vendor_type == "walkin":
        token = str(uuid.uuid4())
        expires_at = now + timedelta(days=TOKEN_EXPIRY_DAYS)
        po["share_token"] = token
        po["token_expires_at"] = expires_at
        po["po_viewed_at"] = None
        po["vendor_accepted_at"] = None
        share_link = _make_share_link(token)
        whatsapp_message = (
            f"Dear {vendor_name},\n\n"
            f"A Fabric Purchase Order {po['orderNo']} has been raised for you from {owner_name}.\n\n"
            f"Total Value: {po.get('currency', 'INR')} {po.get('netAmount', 0):,.2f}\n\n"
            f"Please view/accept the PO and register with RMS here:\n{share_link}\n\n"
            f"Link valid for {TOKEN_EXPIRY_DAYS} days.\nRegards,\n{owner_name}"
        )
        mobile = _clean_whatsapp_mobile(walkin_vendor.get("mobile", ""))
        if mobile:
            whatsapp_url = f"https://wa.me/{mobile}?text={quote(whatsapp_message)}"

    await purchaseorders_collection.insert_one(po)
    if plan:
        await style_bom_plans_collection.update_one(
            {"_id": plan["_id"], "tenant_id": ctx["tenant_id"]},
            {"$set": {"purchase_order_id": str(po["_id"]), "purchase_order_no": po["orderNo"], "updated_at": now}},
        )
    return {
        "message": f"Fabric PO {po['orderNo']} created. Download the sheet here, then go to Purchase Order to send it to the vendor.",
        "purchase_order_id": str(po["_id"]),
        "purchase_order_no": po["orderNo"],
        "sheet": sheet_rows,
        "vendor_name": vendor_name,
        "order_date": po["orderDate"],
        "vendor_type": vendor_type,
        "share_link": share_link,
        "whatsapp_message": whatsapp_message,
        "whatsapp_url": whatsapp_url,
        "whatsapp_mobile": walkin_vendor.get("mobile", "") if vendor_type == "walkin" else "",
    }


# ═══════════════════════════════════════════════════════════════════════════
# FABRIC THEMES — group fabric selections from several vendors under one
# named requirement (e.g. "Summer 2026"), then finalize into one Fabric PO
# PER VENDOR at once. purchaseorders_collection is always single-vendor per
# document, so a theme is the layer that lets a buyer shop fabric across
# several suppliers for one seasonal/collection requirement and still end
# up with clean per-vendor POs, plus a combined view of what the theme cost
# across all of them.
# ═══════════════════════════════════════════════════════════════════════════

def _serialize_theme(doc: dict) -> dict:
    row = dict(doc)
    row["id"] = str(row.pop("_id"))
    for key in ("created_at", "updated_at"):
        if isinstance(row.get(key), datetime):
            row[key] = row[key].isoformat()
    for line in row.get("lines") or []:
        if isinstance(line.get("added_at"), datetime):
            line["added_at"] = line["added_at"].isoformat()
    return row


async def _get_theme(theme_id: str, tenant_id: str) -> dict:
    if not ObjectId.is_valid(theme_id):
        raise HTTPException(status_code=400, detail="Invalid fabric theme ID.")
    theme = await fabric_themes_collection.find_one({"_id": ObjectId(theme_id), "tenant_id": tenant_id})
    if not theme:
        raise HTTPException(status_code=404, detail="Fabric theme not found.")
    return theme


@router.get("/fabric-themes")
async def list_fabric_themes(ctx: dict = Depends(_require_job_work_or_buyer)):
    rows = []
    async for theme in fabric_themes_collection.find({"tenant_id": ctx["tenant_id"]}).sort("created_at", -1).limit(200):
        rows.append(_serialize_theme(theme))
    return {"data": rows}


@router.post("/fabric-themes", status_code=201)
async def create_fabric_theme(payload: dict, ctx: dict = Depends(_require_job_work_or_buyer)):
    theme_name = str(payload.get("theme_name") or "").strip()
    if not theme_name:
        raise HTTPException(status_code=400, detail="Theme name is required.")
    now = datetime.utcnow()
    doc = {
        "tenant_id": ctx["tenant_id"],
        "theme_name": theme_name,
        "target_date": str(payload.get("target_date") or "").strip(),
        "notes": str(payload.get("notes") or "").strip(),
        "status": "draft",   # draft | ordered
        "lines": [],
        "purchase_orders": [],
        "created_by": ctx.get("admin_id"),
        "created_at": now,
        "updated_at": now,
    }
    result = await fabric_themes_collection.insert_one(doc)
    doc["_id"] = result.inserted_id
    return {
        "message": f'Theme "{theme_name}" created. Add fabric selections from any approved supplier, then finalize to create purchase orders.',
        "data": _serialize_theme(doc),
    }


@router.get("/fabric-themes/{theme_id}")
async def get_fabric_theme(theme_id: str, ctx: dict = Depends(_require_job_work_or_buyer)):
    theme = await _get_theme(theme_id, ctx["tenant_id"])
    return {"data": _serialize_theme(theme)}


@router.delete("/fabric-themes/{theme_id}")
async def delete_fabric_theme(theme_id: str, ctx: dict = Depends(_require_job_work_or_buyer)):
    theme = await _get_theme(theme_id, ctx["tenant_id"])
    if theme.get("status") != "draft":
        raise HTTPException(status_code=400, detail="Only a draft theme (not yet finalized into POs) can be deleted.")
    await fabric_themes_collection.delete_one({"_id": theme["_id"]})
    return {"message": "Theme deleted."}


@router.post("/fabric-themes/{theme_id}/lines", status_code=201)
async def add_fabric_theme_line(theme_id: str, payload: dict, ctx: dict = Depends(_require_job_work_or_buyer)):
    theme = await _get_theme(theme_id, ctx["tenant_id"])
    if theme.get("status") != "draft":
        raise HTTPException(status_code=400, detail="This theme is already finalized into POs — create a new theme for further fabric.")

    vendor_id = str(payload.get("vendor_id") or "").strip()
    fabric_name = str(payload.get("fabric_name") or "").strip()
    quantity = _number(payload.get("quantity"))
    if not fabric_name:
        raise HTTPException(status_code=400, detail="Fabric/material name is required.")
    if quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity is required.")

    walkin_vendor = None
    if vendor_id:
        vendor, _link = await _approved_vendor(ctx["tenant_id"], vendor_id)
        vendor_name = vendor.get("name") or vendor.get("vendor_name") or "Fabric supplier"
        group_key = vendor_id
    else:
        raw_walkin = payload.get("walkin_vendor") or {}
        vendor_name = str(raw_walkin.get("name") or "").strip()
        if not vendor_name:
            raise HTTPException(status_code=400, detail="Enter a walk-in supplier name or choose an approved supplier.")
        walkin_vendor = {
            "name": vendor_name,
            "mobile": str(raw_walkin.get("mobile") or "").strip(),
            "email": str(raw_walkin.get("email") or "").strip(),
            "address": str(raw_walkin.get("address") or "").strip(),
            "gstin": str(raw_walkin.get("gstin") or "").strip(),
            "contact_person": str(raw_walkin.get("contact_person") or "").strip(),
            "business_type": "fabric_supplier",
        }
        group_key = f"walkin::{vendor_name.strip().lower()}"

    line = {
        "line_id": str(uuid.uuid4()),
        "group_key": group_key,
        "vendor_id": vendor_id or None,
        "vendor_name": vendor_name,
        "walkin_vendor": walkin_vendor,
        "catalogue_item_id": str(payload.get("catalogue_item_id") or "").strip(),
        "fabric_name": fabric_name,
        "fabric_type": str(payload.get("fabric_type") or "").strip(),
        "gsm": str(payload.get("gsm") or "").strip(),
        "width": str(payload.get("width") or "").strip(),
        "color": str(payload.get("color") or "").strip(),
        "quantity": quantity,
        "unit": str(payload.get("unit") or "m").strip() or "m",
        "rate": _number(payload.get("rate")),
        "remarks": str(payload.get("remarks") or "").strip(),
        "image_url": str(payload.get("image_url") or "").strip(),
        "added_at": datetime.utcnow(),
    }
    await fabric_themes_collection.update_one(
        {"_id": theme["_id"]},
        {"$push": {"lines": line}, "$set": {"updated_at": datetime.utcnow()}},
    )
    theme = await _get_theme(theme_id, ctx["tenant_id"])
    return {"message": f"Added {fabric_name} to the theme.", "data": _serialize_theme(theme)}


@router.patch("/fabric-themes/{theme_id}/lines/{line_id}")
async def update_fabric_theme_line(theme_id: str, line_id: str, payload: dict, ctx: dict = Depends(_require_job_work_or_buyer)):
    theme = await _get_theme(theme_id, ctx["tenant_id"])
    if theme.get("status") != "draft":
        raise HTTPException(status_code=400, detail="This theme is already finalized into POs.")
    if not any(line.get("line_id") == line_id for line in (theme.get("lines") or [])):
        raise HTTPException(status_code=404, detail="Line not found on this theme.")

    editable_numeric = {"quantity", "rate"}
    editable_text = {"unit", "remarks", "color", "width", "gsm"}
    updates = {}
    for key in editable_numeric | editable_text:
        if key in payload:
            value = payload[key]
            updates[f"lines.$.{key}"] = _number(value) if key in editable_numeric else str(value or "").strip()
    if updates:
        updates["updated_at"] = datetime.utcnow()
        await fabric_themes_collection.update_one(
            {"_id": theme["_id"], "lines.line_id": line_id},
            {"$set": updates},
        )
    theme = await _get_theme(theme_id, ctx["tenant_id"])
    return {"message": "Line updated.", "data": _serialize_theme(theme)}


@router.delete("/fabric-themes/{theme_id}/lines/{line_id}")
async def remove_fabric_theme_line(theme_id: str, line_id: str, ctx: dict = Depends(_require_job_work_or_buyer)):
    theme = await _get_theme(theme_id, ctx["tenant_id"])
    if theme.get("status") != "draft":
        raise HTTPException(status_code=400, detail="This theme is already finalized into POs.")
    await fabric_themes_collection.update_one(
        {"_id": theme["_id"]},
        {"$pull": {"lines": {"line_id": line_id}}, "$set": {"updated_at": datetime.utcnow()}},
    )
    theme = await _get_theme(theme_id, ctx["tenant_id"])
    return {"message": "Line removed.", "data": _serialize_theme(theme)}


@router.post("/fabric-themes/{theme_id}/finalize", status_code=201)
async def finalize_fabric_theme(theme_id: str, payload: dict, ctx: dict = Depends(_require_job_work_or_buyer)):
    """Groups this theme's lines by vendor and creates one Fabric PO per
    vendor group via the same _create_fabric_po_document the regular fabric
    cart uses — a PO is always single-vendor, so a multi-vendor theme
    naturally splits into several POs here, all recorded back onto the
    theme for a combined view of what it cost across every supplier."""
    theme = await _get_theme(theme_id, ctx["tenant_id"])
    if theme.get("status") != "draft":
        raise HTTPException(status_code=400, detail="This theme has already been finalized.")
    lines = theme.get("lines") or []
    if not lines:
        raise HTTPException(status_code=400, detail="Add at least one fabric selection before finalizing this theme.")

    groups: dict = {}
    group_vendor_meta: dict = {}
    for line in lines:
        key = line.get("group_key") or line.get("vendor_id") or f"walkin::{(line.get('vendor_name') or '').strip().lower()}"
        groups.setdefault(key, []).append(line)
        group_vendor_meta.setdefault(key, {
            "vendor_id": line.get("vendor_id"),
            "vendor_name": line.get("vendor_name"),
            "walkin_vendor": line.get("walkin_vendor"),
        })

    order_date = str(payload.get("order_date") or datetime.utcnow().date().isoformat())
    expected_delivery_date = str(payload.get("expected_delivery_date") or "")
    payment_terms = str(payload.get("payment_terms") or "")

    results = []
    for key, group_lines in groups.items():
        meta = group_vendor_meta[key]
        items = [{
            "material_name": line.get("fabric_name"),
            "fabric_type": line.get("fabric_type"),
            "gsm": line.get("gsm"),
            "width": line.get("width"),
            "color": line.get("color"),
            "required_quantity": line.get("quantity"),
            "unit": line.get("unit"),
            "rate": line.get("rate"),
            "remarks": line.get("remarks"),
            "image_url": line.get("image_url"),
            "catalogue_item_id": line.get("catalogue_item_id"),
        } for line in group_lines]
        po_payload = {
            "vendor_id": meta.get("vendor_id") or "",
            "walkin_vendor": meta.get("walkin_vendor") or {},
            "vendor_name": meta.get("vendor_name") or "",
            "order_date": order_date,
            "expected_delivery_date": expected_delivery_date,
            "payment_terms": payment_terms,
            "notes": f'Fabric PO created from theme "{theme.get("theme_name")}".',
            "items": items,
        }
        result = await _create_fabric_po_document(ctx, po_payload)
        results.append({
            "vendor_name": meta.get("vendor_name"),
            "purchase_order_id": result["purchase_order_id"],
            "purchase_order_no": result["purchase_order_no"],
            "share_link": result.get("share_link", ""),
            "whatsapp_url": result.get("whatsapp_url", ""),
        })

    await fabric_themes_collection.update_one(
        {"_id": theme["_id"]},
        {"$set": {"status": "ordered", "purchase_orders": results, "updated_at": datetime.utcnow()}},
    )
    theme = await _get_theme(theme_id, ctx["tenant_id"])
    return {
        "message": f"Theme finalized into {len(results)} purchase order(s), one per supplier.",
        "purchase_orders": results,
        "data": _serialize_theme(theme),
    }


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
    return await _create_fabric_po_document(ctx, payload, plan=plan)


@router.post("/fabric-purchase-orders", status_code=201)
async def create_manual_fabric_purchase_order(payload: dict, ctx: dict = Depends(_require_job_work_or_buyer)):
    """Create a Fabric PO from the fabric cart without touching job-work orders — reachable from both
    Production & Job Work and the Merchandiser Buyer's own Fabric Purchasing tab."""
    return await _create_fabric_po_document(ctx, payload, plan=None)


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
        {"$group": {"_id": None, "waste": {"$sum": "$materials.waste_qty"}, "leftover": {"$sum": "$materials.leftover_qty"}}},
    ]).to_list(length=1)
    return {
        "active_orders": active,
        "with_job_workers": issued,
        "completed_orders": completed,
        "recorded_wastage": round(_number((waste_rows[0] if waste_rows else {}).get("waste")), 3),
        "recorded_leftover": round(_number((waste_rows[0] if waste_rows else {}).get("leftover")), 3),
    }


@router.post("/orders", status_code=201)
async def create_order(payload: dict, ctx: dict = Depends(_require_job_work)):
    job_worker_name = str(payload.get("job_worker_name") or "").strip()
    registered_vendor_id = str(payload.get("vendor_id") or "").strip()
    job_work_type = str(payload.get("job_work_type") or "").strip()
    finished_product = str(payload.get("finished_product") or "").strip()
    expected_quantity = _number(payload.get("expected_quantity"))
    material_plan_id = str(payload.get("material_plan_id") or "").strip()
    material_plan = None
    if material_plan_id:
        if not ObjectId.is_valid(material_plan_id):
            raise HTTPException(status_code=400, detail="Invalid material plan.")
        material_plan = await style_bom_plans_collection.find_one({"_id": ObjectId(material_plan_id), "tenant_id": ctx["tenant_id"]})
        if not material_plan:
            raise HTTPException(status_code=404, detail="Material plan not found.")
        if not finished_product: finished_product = material_plan.get("style_name", "")
        if expected_quantity <= 0: expected_quantity = _number(material_plan.get("planned_quantity"))
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
        "material_plan_id": str(material_plan["_id"]) if material_plan else None,
        "material_plan_no": material_plan.get("plan_no") if material_plan else None,
        "planned_materials": list(material_plan.get("materials") or []) if material_plan else [],
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
            "rate": rate, "issued_qty": quantity, "used_qty": 0.0, "returned_qty": 0.0, "leftover_qty": 0.0, "waste_qty": 0.0,
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
    """
    Vendor confirms receipt of the job-work instruction/material challan.
    This is the "scan and fill" step: the vendor states the date they took
    the material, how many pieces they received, and the date by which
    they promise finished goods will be ready — that promise then drives
    the is_overdue flag everywhere this order is shown.
    """
    vendor_id = _vendor_session(authorization)
    await _require_vendor_job_work_access(vendor_id)
    if not ObjectId.is_valid(order_id):
        raise HTTPException(status_code=400, detail="Invalid job work order ID.")
    order = await job_work_orders_collection.find_one({"_id": ObjectId(order_id), "assigned_vendor_id": vendor_id})
    if not order:
        raise HTTPException(status_code=404, detail="Job work order not found for this vendor.")
    if order.get("status") not in {"ISSUED", "PARTIALLY_RECEIVED"}:
        raise HTTPException(status_code=400, detail="Material must be issued before it can be acknowledged.")

    payload = payload or {}
    taken_date = str(payload.get("taken_date") or "").strip()
    promised_ready_date = str(payload.get("promised_ready_date") or "").strip()
    pieces_received = _number(payload.get("pieces_received"))
    note = str(payload.get("note") or "").strip()[:1000]

    if not taken_date or not promised_ready_date or pieces_received <= 0:
        raise HTTPException(status_code=400, detail="Date taken, pieces received and a promised ready-by date are required.")
    try:
        datetime.strptime(taken_date, "%Y-%m-%d")
        datetime.strptime(promised_ready_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Dates must be in YYYY-MM-DD format.")

    now = datetime.utcnow()
    acknowledgement = {
        "taken_date": taken_date,
        "pieces_received": pieces_received,
        "promised_ready_date": promised_ready_date,
        "note": note,
        "acknowledged_at": now.isoformat(),
    }
    await job_work_orders_collection.update_one(
        {"_id": order["_id"], "assigned_vendor_id": vendor_id},
        {"$set": {"vendor_acknowledged_at": now, "vendor_acknowledgement": acknowledgement, "updated_at": now}},
    )
    return {"message": "Job work instruction acknowledged. The retailer will record the physical receipt.", "data": acknowledgement}


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
        leftover = _number(entry.get("leftover_qty"))
        waste = _number(entry.get("waste_qty"))
        outstanding = (
            _number(material.get("issued_qty")) - _number(material.get("used_qty"))
            - _number(material.get("returned_qty")) - _number(material.get("leftover_qty"))
            - _number(material.get("waste_qty"))
        )
        if used + returned + leftover + waste > outstanding + 0.000001:
            raise HTTPException(status_code=400, detail=f"Reconciliation exceeds material outstanding balance for {material['product']}.")
        material["used_qty"] = round(_number(material.get("used_qty")) + used, 3)
        material["returned_qty"] = round(_number(material.get("returned_qty")) + returned, 3)
        material["leftover_qty"] = round(_number(material.get("leftover_qty")) + leftover, 3)
        material["waste_qty"] = round(_number(material.get("waste_qty")) + waste, 3)
        if returned:
            await _increase_central_stock(tenant_id, material["barcode"], returned, material["product"], _number(material.get("rate")), f"Job work material return {order['order_no']}")
        if leftover:
            await _add_leftover_stock(tenant_id, material["barcode"], leftover, material["product"], _number(material.get("rate")), f"Job work leftover from {order['order_no']}")
        receipt_materials.append({"barcode": material["barcode"], "product": material["product"], "used_qty": used, "returned_qty": returned, "leftover_qty": leftover, "waste_qty": waste})

    output = payload.get("output") or {}
    output_barcode = str(output.get("barcode") or "").strip()
    output_product = str(output.get("product") or order.get("finished_product") or "").strip()
    output_qty = _number(output.get("quantity"))
    output_rate = _number(output.get("rate"))
    if output_qty > 0 and not output_barcode:
        raise HTTPException(status_code=400, detail="Finished output barcode is required when receiving finished quantity.")
    if output_qty:
        await _increase_central_stock(tenant_id, output_barcode, output_qty, output_product, output_rate, f"Job work output receipt {order['order_no']}")

    # ⚠️ NEW — BOM-vs-actual consumption check. The Style BOM (planned_materials,
    # snapshotted onto the order at creation from style_bom_plans_collection)
    # says how much fabric a design SHOULD take per finished unit; nothing
    # before this compared that to what was actually reconciled as used_qty
    # THIS receipt. Purely advisory — never blocks the save, just flags a
    # line that's notably over (>CONSUMPTION_OVERAGE_WARNING_PCT%) so a
    # buyer/production lead can catch overuse or a wasteful cutter early.
    consumption_warnings = []
    planned_by_name = {
        str(pm.get("material_name") or "").strip().lower(): pm
        for pm in (order.get("planned_materials") or [])
    }
    if output_qty > 0 and planned_by_name:
        for receipt_line in receipt_materials:
            used_this_receipt = _number(receipt_line.get("used_qty"))
            if used_this_receipt <= 0:
                continue
            planned = planned_by_name.get(str(receipt_line.get("product") or "").strip().lower())
            expected_per_unit = _number((planned or {}).get("consumption_per_unit"))
            if expected_per_unit <= 0:
                continue
            actual_per_unit = round(used_this_receipt / output_qty, 4)
            over_pct = round(((actual_per_unit - expected_per_unit) / expected_per_unit) * 100)
            if over_pct > CONSUMPTION_OVERAGE_WARNING_PCT:
                consumption_warnings.append({
                    "material": receipt_line.get("product"),
                    "expected_per_unit": expected_per_unit,
                    "actual_per_unit": actual_per_unit,
                    "over_pct": over_pct,
                })

    now = datetime.utcnow()
    all_reconciled = all(
        _number(line.get("issued_qty")) - _number(line.get("used_qty")) - _number(line.get("returned_qty"))
        - _number(line.get("leftover_qty")) - _number(line.get("waste_qty")) <= 0.000001
        for line in materials
    )
    status = "COMPLETED" if all_reconciled else "PARTIALLY_RECEIVED"
    receipt = {
        "tenant_id": tenant_id, "order_id": order["_id"], "order_no": order["order_no"],
        "receipt_no": f"JWR-{now.strftime('%y%m%d')}-{str(ObjectId())[-5:].upper()}",
        "materials": receipt_materials,
        "output": {"barcode": output_barcode, "product": output_product, "quantity": output_qty, "rate": output_rate},
        "consumption_warnings": consumption_warnings,
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
    message = f"Job work receipt recorded. Order status: {status.replace('_', ' ').title()}."
    if consumption_warnings:
        flagged = ", ".join(f"{w['material']} ({w['over_pct']}% over)" for w in consumption_warnings)
        message += f" Note: fabric use is above the design's expected consumption for {flagged}."
    return {
        "message": message, "receipt_id": str(result.inserted_id), "status": status,
        "consumption_warnings": consumption_warnings,
    }
