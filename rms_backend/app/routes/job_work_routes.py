"""Production and job-work material issue/receipt workflow.

This module deliberately does not reuse purchase orders or GRNs. Fabric sent
to a cutter or stitcher remains retailer-owned material, so it is moved into a
job-work order balance and reconciled when panels/finished goods return.
"""

from datetime import datetime, timedelta
from typing import Any
import json
import uuid
from urllib.parse import quote

from bson import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request

from ..db import (
    fabric_themes_collection,
    inventory_collection,
    job_work_orders_collection,
    job_work_receipts_collection,
    purchaseorders_collection,
    store_stock_collection,
    style_bom_plans_collection,
    tech_packs_collection,
    tenants_collection,
    vendor_tenant_links_collection,
    vendors_collection,
)
from .deps import get_hq_tenant
from ..config import settings
import cloudinary
import cloudinary.uploader
from .vendor_routes import decode_token
from .purchaseorder_routes import APP_BASE_URL, TOKEN_EXPIRY_DAYS, _clean_whatsapp_mobile, _make_share_link, _send_po_created_alerts, calculate_po_totals, generate_po_number, resolve_real_barcode
from .grn_routes import resolve_single_store_destination
from .procurement_notification_routes import notify_vendor
from ..email_utils import send_job_work_order_email
from ..retailer_plans import normalize_retailer_plan

cloudinary.config(
    cloud_name=settings.cloudinary_cloud_name,
    api_key=settings.cloudinary_api_key,
    api_secret=settings.cloudinary_api_secret,
    secure=True,
)

router = APIRouter(prefix="/api/job-work", tags=["Production & Job Work"])

JOB_WORK_TYPES = {"Cutting", "Stitching", "Finishing", "Embroidery", "Washing", "Packing", "Other"}
CONSUMPTION_OVERAGE_WARNING_PCT = 10


def _number(value: Any, default: float = 0.0) -> float:
    try:
        number = float(value if value is not None else default)
        return number if number >= 0 else default
    except (TypeError, ValueError):
        return default

def _parse_design_lines(raw: Any) -> list[dict]:
    if isinstance(raw, str):
        try:
            raw = json.loads(raw or "[]")
        except json.JSONDecodeError:
            raw = []
    if not isinstance(raw, list):
        return []
    clean: list[dict] = []
    for line in raw[:50]:
        if not isinstance(line, dict):
            continue
        design_no = str(line.get("design_no") or "").strip()[:120]
        product_type = str(line.get("product_type") or "").strip()[:160]
        qty = _number(line.get("quantity"))
        if not design_no and not product_type and qty <= 0:
            continue
        image_urls = [str(url).strip() for url in (line.get("image_urls") or []) if str(url).strip()]
        clean.append({
            "design_no": design_no,
            "department": str(line.get("department") or "").strip()[:80],
            "product_type": product_type,
            "quantity": qty,
            "unit": str(line.get("unit") or "pcs").strip()[:30] or "pcs",
            "rate": _number(line.get("rate")),
            "remarks": str(line.get("remarks") or "").strip()[:500],
            "tech_pack_id": str(line.get("tech_pack_id") or "").strip(),
            "image_urls": image_urls[:12],
        })
    return clean


def _parse_json_list(raw: Any) -> list:
    """Accepts either a real list (JSON body) or a JSON-encoded string
    (multipart form field, since form values are always strings)."""
    if isinstance(raw, str):
        try:
            raw = json.loads(raw or "[]")
        except json.JSONDecodeError:
            raw = []
    return raw if isinstance(raw, list) else []


def _parse_measurement_rows(raw: Any) -> list[dict]:
    rows = []
    for row in _parse_json_list(raw)[:60]:
        if not isinstance(row, dict):
            continue
        point = str(row.get("point") or "").strip()[:80]
        if not point:
            continue
        grades = row.get("grades") or {}
        if not isinstance(grades, dict):
            grades = {}
        rows.append({
            "point": point,
            "sample_value": str(row.get("sample_value") or "").strip()[:20],
            "grades": {str(size).strip()[:20]: str(value).strip()[:20] for size, value in grades.items() if str(size).strip()},
        })
    return rows


def _parse_trims_items(raw: Any) -> list[dict]:
    items = []
    for row in _parse_json_list(raw)[:100]:
        if not isinstance(row, dict):
            continue
        description = str(row.get("description") or "").strip()[:200]
        if not description:
            continue
        items.append({
            "description": description,
            "color": str(row.get("color") or "").strip()[:60],
            "size": str(row.get("size") or "").strip()[:40],
            "supplier": str(row.get("supplier") or "").strip()[:120],
            "quantity": str(row.get("quantity") or "").strip()[:40],
            "price": str(row.get("price") or "").strip()[:40],
        })
    return items


def _parse_colourways(raw: Any) -> list[dict]:
    rows = []
    for row in _parse_json_list(raw)[:40]:
        if not isinstance(row, dict):
            continue
        name = str(row.get("name") or "").strip()[:80]
        if not name:
            continue
        rows.append({
            "name": name,
            "fabric_ref": str(row.get("fabric_ref") or "").strip()[:120],
            "thread_ref": str(row.get("thread_ref") or "").strip()[:120],
        })
    return rows


TECH_PACK_IMAGE_CATEGORIES = ("sketch", "details", "artwork", "trims", "colourway")


async def _tech_pack_payload_from_request(request: Request) -> tuple[dict, dict[str, list[str]]]:
    """Same multipart/JSON split as _payload_from_request, but keyed by tech
    pack image category (sketch/details/artwork/trims/colourway) instead of
    a design-line index — a tech pack has one image slot per guide page,
    not per line item."""
    content_type = (request.headers.get("content-type") or "").lower()
    if "multipart/form-data" not in content_type:
        return await request.json(), {}
    form = await request.form()
    payload: dict[str, Any] = {}
    uploaded_by_category: dict[str, list[str]] = {}
    for key, value in form.multi_items():
        if hasattr(value, "filename") and hasattr(value, "file"):
            if not str(value.content_type or "").startswith("image/"):
                continue
            if not key.startswith("pack_image_"):
                continue
            category = key[len("pack_image_"):]
            if category not in TECH_PACK_IMAGE_CATEGORIES:
                continue
            try:
                result = cloudinary.uploader.upload(
                    value.file,
                    folder=f"rms/job-work/tech-packs/{category}",
                    resource_type="image",
                    use_filename=True,
                    unique_filename=True,
                )
                url = result.get("secure_url")
                if url:
                    uploaded_by_category.setdefault(category, []).append(url)
            except Exception as exc:
                raise HTTPException(status_code=500, detail=f"Tech pack image upload failed: {exc}")
        else:
            payload[key] = value
    return payload, uploaded_by_category


async def _payload_from_request(request: Request) -> tuple[dict, dict[int, list[str]]]:
    content_type = (request.headers.get("content-type") or "").lower()
    if "multipart/form-data" not in content_type:
        return await request.json(), {}
    form = await request.form()
    payload: dict[str, Any] = {}
    uploaded_by_line: dict[int, list[str]] = {}
    for key, value in form.multi_items():
        if hasattr(value, "filename") and hasattr(value, "file"):
            if not str(value.content_type or "").startswith("image/"):
                continue
            if not key.startswith("design_image_"):
                continue
            try:
                line_index = int(key.rsplit("_", 1)[-1])
            except ValueError:
                continue
            try:
                result = cloudinary.uploader.upload(
                    value.file,
                    folder="rms/job-work/designs",
                    resource_type="image",
                    use_filename=True,
                    unique_filename=True,
                )
                url = result.get("secure_url")
                if url:
                    uploaded_by_line.setdefault(line_index, []).append(url)
            except Exception as exc:
                raise HTTPException(status_code=500, detail=f"Design image upload failed: {exc}")
        else:
            payload[key] = value
    return payload, uploaded_by_line


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
    for key in ("created_at", "updated_at", "issued_at", "due_date", "token_expires_at", "order_viewed_at"):
        if isinstance(row.get(key), datetime):
            row[key] = row[key].isoformat()
    if isinstance(row.get("comments"), list):
        row["comments"] = [
            {**comment, "date": comment["date"].isoformat() if isinstance(comment.get("date"), datetime) else comment.get("date")}
            for comment in row["comments"]
        ]
    row["is_overdue"] = _is_overdue(row)
    return row


async def _ensure_job_work_addon_enabled(ctx: dict) -> None:
    """Production & Job Work is an independent, purchasable add-on — not tied
    to plan tier. A tenant needs `production_job_work_enabled` set on their
    tenant record; Enterprise-plan tenants are grandfathered in automatically
    since Job Work used to be bundled into that plan."""
    tenant = await tenants_collection.find_one(
        {"tenant_id": ctx["tenant_id"]}, {"plan": 1, "production_job_work_enabled": 1}
    )
    if (tenant or {}).get("production_job_work_enabled"):
        return
    if normalize_retailer_plan((tenant or {}).get("plan")) == "enterprise":
        return
    raise HTTPException(
        status_code=403,
        detail="Production & Job Work is not enabled for this account. Ask your Super Admin to activate this add-on.",
    )


async def _require_job_work(ctx: dict = Depends(get_hq_tenant)) -> dict:
    """Job work is a central production operation, never a store operation."""
    permissions = set(ctx.get("_permissions") or [])
    departments = set(ctx.get("_managed_departments") or [])
    if "job_work" not in permissions and "Production & Job Work" not in departments:
        raise HTTPException(
            status_code=403,
            detail="Production & Job Work permission is required. Ask an HQ administrator to grant it.",
        )
    await _ensure_job_work_addon_enabled(ctx)
    return ctx


async def _require_job_work_or_buyer(ctx: dict = Depends(get_hq_tenant)) -> dict:
    """Same as _require_job_work, but also lets a Merchandiser Buyer through —
    used only for the fabric-supplier list and manual fabric PO creation, so
    a buyer can raise a Fabric PO directly without needing the rest of the
    Production & Job Work workflow (material stock, job orders, receipts).
    The add-on check only applies to the job-work path — a Merchandiser
    Buyer's own fabric purchasing is a separate capability and is never
    gated by the Production & Job Work add-on."""
    permissions = set(ctx.get("_permissions") or [])
    departments = set(ctx.get("_managed_departments") or [])
    is_buyer = "mbuyer" in permissions or "Merchandiser Buyer" in departments
    is_job_work_role = "job_work" in permissions or "Production & Job Work" in departments
    if not (is_buyer or is_job_work_role):
        raise HTTPException(
            status_code=403,
            detail="Production & Job Work or Merchandiser Buyer permission is required.",
        )
    if is_job_work_role and not is_buyer:
        await _ensure_job_work_addon_enabled(ctx)
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


async def _stock_scope(tenant_id: str) -> dict | None:
    """A single-store tenant's fabric never lands in inventory_collection —
    GRN posts it straight to store_stock_collection (see grn_routes.py's
    update_single_store_stock), because that IS their central stock; there
    is no separate "central" pool for a business with only one location.
    Every job-work touchpoint below must read/write wherever the tenant's
    stock actually lives, or a single-store tenant's fabric would be
    invisible to /material-stock and any receipt would leak into a shadow
    pool their own POS/store screens never show. Returns None for a
    multi-store tenant (keep using inventory_collection as before)."""
    return await resolve_single_store_destination(tenant_id)


def _stock_collection(store: dict | None):
    return store_stock_collection if store else inventory_collection


def _stock_query(tenant_id: str, barcode: str, store: dict | None) -> dict:
    query = {"tenant_id": tenant_id, "barcode": barcode}
    if store:
        query["store_id"] = store["id"]
    return query


async def _add_leftover_stock(tenant_id: str, parent_barcode: str, quantity: float, product: str, rate: float, reason: str, store: dict | None = None) -> None:
    """A reusable fabric remnant — NOT the same as job-work waste_qty, which
    is a true write-off that never touches inventory. This is recorded as
    its own stock line, one running pool per source material (not one row
    per order), so it stays distinctly visible/searchable in material
    stock — a job worker can consciously draw down a leftover pool for a
    small job instead of issuing fresh fabric for it."""
    leftover_barcode = f"{parent_barcode}{LEFTOVER_BARCODE_SUFFIX}"
    collection = _stock_collection(store)
    query = _stock_query(tenant_id, leftover_barcode, store)
    existing = await collection.find_one(query)
    adjustment = {
        "qty_change": quantity, "reason": reason,
        "adjustedAt": datetime.utcnow().isoformat(), "source": "job_work_leftover",
    }
    if existing:
        await collection.update_one(
            {"_id": existing["_id"]},
            {"$inc": {"stockQty": quantity}, "$set": {"updatedAt": datetime.utcnow()}, "$push": {"adjustments": adjustment}},
        )
        return
    document = {
        **query,
        "stockQty": quantity,
        "rate": rate, "mrp": rate,
        "description": f"{product} — leftover remnant",
        "is_leftover": True,
        "parent_barcode": parent_barcode,
        "source": "job_work_leftover",
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
        "adjustments": [adjustment],
    }
    if store:
        document.update({"store_name": store["name"], "store_type": store["type"]})
    await collection.insert_one(document)


async def _increase_central_stock(tenant_id: str, barcode: str, quantity: float, product: str, rate: float, reason: str, store: dict | None = None) -> None:
    collection = _stock_collection(store)
    query = _stock_query(tenant_id, barcode, store)
    existing = await collection.find_one(query)
    adjustment = {
        "qty_change": quantity,
        "reason": reason,
        "adjustedAt": datetime.utcnow().isoformat(),
        "source": "job_work_receipt",
    }
    if existing:
        await collection.update_one(
            {"_id": existing["_id"]},
            {"$inc": {"stockQty": quantity}, "$set": {"updatedAt": datetime.utcnow()}, "$push": {"adjustments": adjustment}},
        )
        return
    document = {
        **query,
        "stockQty": quantity,
        "rate": rate,
        "mrp": rate,
        "description": product,
        "source": "job_work_receipt",
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
        "adjustments": [adjustment],
    }
    if store:
        document.update({"store_name": store["name"], "store_type": store["type"]})
    await collection.insert_one(document)


@router.get("/material-stock")
async def material_stock(ctx: dict = Depends(_require_job_work)):
    """Central stock available to issue to a job worker."""
    tenant_id = ctx["tenant_id"]
    store = await _stock_scope(tenant_id)
    query: dict = {"tenant_id": tenant_id, "stockQty": {"$gt": 0}}
    if store:
        # store_stock_collection holds this tenant's ENTIRE store — finished
        # goods and everything else, not just raw material — so the picker
        # must stay scoped to fabric/leftover lines the same way
        # inventory_collection already is by construction (only job-work and
        # Fabric-PO receipts ever land there).
        query["store_id"] = store["id"]
        query["$or"] = [{"is_fabric": True}, {"is_leftover": True}]
    rows = []
    cursor = _stock_collection(store).find(
        query,
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
        vendor_gstin = str(vendor.get("gstin") or "").strip()
        vendor_mobile = str(vendor.get("mobile") or vendor.get("phone") or "").strip()
        vendor_address = str(vendor.get("address") or "").strip()
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
        vendor_gstin = walkin_vendor["gstin"]
        vendor_mobile = walkin_vendor["mobile"]
        vendor_address = walkin_vendor["address"]
    tenant = await tenants_collection.find_one(
        {"tenant_id": ctx["tenant_id"]}, {"company_name": 1, "name": 1, "gstin": 1, "address": 1, "city": 1, "state": 1}
    )
    owner_name = (tenant or {}).get("company_name") or (tenant or {}).get("name") or ctx["tenant_id"]
    owner_gstin = (tenant or {}).get("gstin", "")
    owner_address = ", ".join(part for part in [(tenant or {}).get("address", ""), (tenant or {}).get("city", ""), (tenant or {}).get("state", "")] if part)

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
        "ownerGstin": owner_gstin,
        "ownerAddress": owner_address,
        "vendorGstin": vendor_gstin,
        "vendorMobile": vendor_mobile,
        "vendorAddress": vendor_address,
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
    if vendor_type == "walkin":
        token = str(uuid.uuid4())
        expires_at = now + timedelta(days=TOKEN_EXPIRY_DAYS)
        po["share_token"] = token
        po["token_expires_at"] = expires_at
        po["po_viewed_at"] = None
        po["vendor_accepted_at"] = None
        share_link = _make_share_link(token)

    await purchaseorders_collection.insert_one(po)
    if plan:
        await style_bom_plans_collection.update_one(
            {"_id": plan["_id"], "tenant_id": ctx["tenant_id"]},
            {"$set": {"purchase_order_id": str(po["_id"]), "purchase_order_no": po["orderNo"], "updated_at": now}},
        )
    # Real email (registered or walk-in, whichever has an address on file) +
    # a portal notification for a registered vendor, plus a manual-send
    # WhatsApp link/message — same alert helper the regular PO flow uses,
    # since a Fabric PO is stored in the same purchase_orders collection.
    # Auto WhatsApp send still isn't possible: no Meta WhatsApp Business
    # credentials are configured anywhere in this codebase.
    alert = await _send_po_created_alerts(po, ctx, vendor, share_link)
    return {
        "message": f"Fabric PO {po['orderNo']} created. Download the sheet here, then go to Purchase Order to send it to the vendor.",
        "purchase_order_id": str(po["_id"]),
        "purchase_order_no": po["orderNo"],
        "sheet": sheet_rows,
        "vendor_name": vendor_name,
        "order_date": po["orderDate"],
        "vendor_type": vendor_type,
        "share_link": share_link,
        "whatsapp_message": alert["whatsapp_message"],
        "whatsapp_url": alert["whatsapp_url"],
        "whatsapp_mobile": alert["whatsapp_mobile"],
        "email_sent": alert["email_sent"],
        # ⚠️ NEW — surfaced so the downloadable Fabric PO sheet can show a
        # real buyer/vendor identity block, delivery/payment terms and a
        # Subtotal/Tax/Grand Total footer instead of a bare line-item list.
        "expected_delivery_date": po["expectedDeliveryDate"],
        "payment_terms": po["paymentTerms"],
        "vendor_gstin": po["vendorGstin"],
        "vendor_mobile": po["vendorMobile"],
        "vendor_address": po["vendorAddress"],
        "company_name": owner_name,
        "company_gstin": owner_gstin,
        "company_address": owner_address,
        "subtotal_amount": po["basicValue"],
        "tax_amount": po["taxAmount"],
        "net_amount": po["netAmount"],
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


def _material_key(value: Any) -> str:
    """Create a forgiving key when matching BOM fabric to received stock."""
    return " ".join(str(value or "").lower().replace("-", " ").split())


async def _theme_requirement_summary(theme: dict, tenant_id: str) -> list[dict]:
    """Planning-only requirement, stock and supplier-allocation summary."""
    plan_ids = [plan_id for plan_id in (theme.get("plan_ids") or []) if ObjectId.is_valid(plan_id)]
    requirements: dict[str, dict] = {}
    if plan_ids:
        object_ids = [ObjectId(plan_id) for plan_id in plan_ids]
        async for plan in style_bom_plans_collection.find({"_id": {"$in": object_ids}, "tenant_id": tenant_id}):
            for material in plan.get("materials") or []:
                name = str(material.get("material_name") or "").strip()
                if not name:
                    continue
                key = _material_key(name)
                row = requirements.setdefault(key, {"material_name": name, "unit": str(material.get("unit") or "m"), "required_qty": 0.0, "available_qty": 0.0, "selected_qty": 0.0, "plans": []})
                row["required_qty"] += _number(material.get("required_quantity"))
                row["plans"].append({"plan_no": plan.get("plan_no") or "", "style_name": plan.get("style_name") or "", "quantity": _number(material.get("required_quantity"))})

    store = await _stock_scope(tenant_id)
    query: dict = {"tenant_id": tenant_id, "stockQty": {"$gt": 0}}
    if store:
        query["store_id"] = store["id"]
        query["$or"] = [{"is_fabric": True}, {"is_leftover": True}]
    cursor = _stock_collection(store).find(query, {"description": 1, "product": 1, "stockQty": 1})
    async for stock in cursor:
        key = _material_key(stock.get("description") or stock.get("product"))
        if key in requirements:
            requirements[key]["available_qty"] += _number(stock.get("stockQty"))

    for line in theme.get("lines") or []:
        key = _material_key(line.get("fabric_name"))
        if key in requirements:
            requirements[key]["selected_qty"] += _number(line.get("quantity"))

    rows = []
    for row in requirements.values():
        row["required_qty"] = round(row["required_qty"], 3)
        row["available_qty"] = round(row["available_qty"], 3)
        row["selected_qty"] = round(row["selected_qty"], 3)
        row["to_buy_qty"] = round(max(0, row["required_qty"] - row["available_qty"]), 3)
        row["unallocated_qty"] = round(max(0, row["to_buy_qty"] - row["selected_qty"]), 3)
        rows.append(row)
    return sorted(rows, key=lambda row: row["material_name"].lower())

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
    raw_plan_ids = payload.get("plan_ids") or []
    if not isinstance(raw_plan_ids, list):
        raw_plan_ids = []
    plan_ids = list(dict.fromkeys(str(plan_id) for plan_id in raw_plan_ids if ObjectId.is_valid(str(plan_id))))[:50]
    now = datetime.utcnow()
    doc = {
        "tenant_id": ctx["tenant_id"],
        "theme_name": theme_name,
        "target_date": str(payload.get("target_date") or "").strip(),
        "notes": str(payload.get("notes") or "").strip(),
        "plan_ids": plan_ids,
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
    data = _serialize_theme(theme)
    data["requirements"] = await _theme_requirement_summary(theme, ctx["tenant_id"])
    return {"data": data}


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


def _fabric_key(fabric_type: str, gsm, width: str, color: str) -> tuple[str, str, str, str]:
    """Same fabric, matched the only way there is to match it across
    separately-typed lines from different vendors/themes — no shared SKU
    exists between a theme line and a stock row, so normalized
    type+GSM+width+colour is the join key everywhere in this feature."""
    return (
        str(fabric_type or "").strip().lower(),
        str(gsm or "").strip().lower(),
        str(width or "").strip().lower(),
        str(color or "").strip().lower(),
    )


@router.get("/fabric-requirement-summary")
async def fabric_requirement_summary(ctx: dict = Depends(_require_job_work_or_buyer)):
    """Same fabric, requested across several DRAFT themes, collapsed into
    one line: total demand, what's already in stock (leftover called out
    separately), and the net still to buy. Ordered themes are excluded —
    that demand already became a PO, it's no longer an open requirement.
    Deliberately does NOT pull in Style BOM material plans: those use a
    free-text material_name/specification with no structured GSM/width/
    colour fields, so there is no reliable key to join them against a
    theme line's fabric_type/gsm/width/color without guessing at parsing
    free text — guessed matches would be worse than no match at all here.
    """
    tenant_id = ctx["tenant_id"]

    groups: dict[tuple, dict] = {}

    async for theme in fabric_themes_collection.find({"tenant_id": tenant_id, "status": "draft"}):
        theme_id = str(theme["_id"])
        theme_name = theme.get("theme_name") or "Untitled theme"
        for line in theme.get("lines") or []:
            key = _fabric_key(line.get("fabric_type"), line.get("gsm"), line.get("width"), line.get("color"))
            if not key[0]:
                continue  # a line with no fabric_type can't be pooled with anything
            quantity = _number(line.get("quantity"))
            vendor_name = line.get("vendor_name") or (line.get("walkin_vendor") or {}).get("name") or "Unassigned"
            group = groups.setdefault(key, {
                "fabric_type": line.get("fabric_type") or "",
                "gsm": line.get("gsm") or "",
                "width": line.get("width") or "",
                "color": line.get("color") or "",
                "unit": line.get("unit") or "m",
                "total_required": 0.0,
                "contributions": [],
                "vendors": set(),
            })
            group["total_required"] += quantity
            group["contributions"].append({
                "theme_id": theme_id, "theme_name": theme_name, "line_id": line.get("line_id", ""),
                "vendor_name": vendor_name, "quantity": quantity, "unit": line.get("unit") or "m", "rate": _number(line.get("rate")),
            })
            group["vendors"].add(vendor_name)

    if not groups:
        return {"data": []}

    store = await _stock_scope(tenant_id)
    stock_query: dict = {"tenant_id": tenant_id, "stockQty": {"$gt": 0}}
    if store:
        stock_query["store_id"] = store["id"]
        stock_query["$or"] = [{"is_fabric": True}, {"is_leftover": True}]
    stock_totals: dict[tuple, dict] = {}
    async for item in _stock_collection(store).find(
        stock_query, {"stockQty": 1, "is_leftover": 1, "is_fabric": 1, "fabric_type": 1, "gsm": 1, "width": 1, "color": 1},
    ):
        if not item.get("is_fabric") and not item.get("is_leftover"):
            continue
        key = _fabric_key(item.get("fabric_type"), item.get("gsm"), item.get("width"), item.get("color"))
        if key not in groups:
            continue  # no open theme requirement for this fabric — irrelevant to this summary
        totals = stock_totals.setdefault(key, {"available": 0.0, "leftover": 0.0})
        qty = _number(item.get("stockQty"))
        totals["available"] += qty
        if item.get("is_leftover"):
            totals["leftover"] += qty

    data = []
    for key, group in groups.items():
        totals = stock_totals.get(key, {"available": 0.0, "leftover": 0.0})
        available = round(totals["available"], 3)
        net_to_buy = round(max(0.0, group["total_required"] - available), 3)
        data.append({
            "fabric_type": group["fabric_type"], "gsm": group["gsm"], "width": group["width"], "color": group["color"],
            "unit": group["unit"],
            "total_required": round(group["total_required"], 3),
            "available_stock": available,
            "leftover_stock": round(totals["leftover"], 3),
            "net_to_buy": net_to_buy,
            "theme_count": len({c["theme_id"] for c in group["contributions"]}),
            "vendor_count": len(group["vendors"]),
            "vendors": sorted(group["vendors"]),
            "contributions": sorted(group["contributions"], key=lambda c: -c["quantity"]),
        })

    data.sort(key=lambda row: -row["net_to_buy"])
    return {"data": data}


def _normalize_style_name(value: str) -> str:
    return str(value or "").strip().lower()


@router.get("/material-plans")
async def list_material_plans(ctx: dict = Depends(_require_job_work)):
    """Style BOMs with calculated fabric/material quantities for a planned run.

    A BOM and a Tech Pack are deliberately separate records (one calculates
    fabric quantity, the other documents the approved design) — the only
    connection is the Tech Pack's optional `material_plan_id`. That link only
    ever got set from the Tech Pack side, so a BOM had no way to show "a tech
    pack already exists for this style" even when one did. This enriches
    each plan with whichever applies: an existing reverse link, or (if none)
    a same-style-name tech pack that isn't linked to anything yet, so the UI
    can offer a one-click "Link it" instead of the connection staying silent.
    """
    tech_packs_by_plan: dict[str, dict] = {}
    unlinked_by_style: dict[str, dict] = {}
    async for pack in tech_packs_collection.find({"tenant_id": ctx["tenant_id"]}, {
        "tech_pack_no": 1, "design_no": 1, "version": 1, "style_name": 1, "material_plan_id": 1,
    }):
        summary = {"id": str(pack["_id"]), "tech_pack_no": pack.get("tech_pack_no", ""), "design_no": pack.get("design_no", ""), "version": pack.get("version", "")}
        linked_plan_id = pack.get("material_plan_id")
        if linked_plan_id:
            tech_packs_by_plan[str(linked_plan_id)] = summary
        else:
            key = _normalize_style_name(pack.get("style_name"))
            if key and key not in unlinked_by_style:
                unlinked_by_style[key] = summary

    rows = []
    async for plan in style_bom_plans_collection.find({"tenant_id": ctx["tenant_id"]}).sort("created_at", -1).limit(300):
        row = _serialize(plan)
        plan_id = str(plan["_id"])
        row["linked_tech_pack"] = tech_packs_by_plan.get(plan_id)
        row["suggested_tech_pack"] = None if row["linked_tech_pack"] else unlinked_by_style.get(_normalize_style_name(plan.get("style_name")))
        rows.append(row)
    return {"data": rows}


@router.patch("/tech-packs/{tech_pack_id}/link-material-plan")
async def link_tech_pack_to_material_plan(tech_pack_id: str, payload: dict, ctx: dict = Depends(_require_job_work)):
    """Reverse-link an existing Tech Pack to a Style BOM plan — same field
    the Tech Pack creation form already sets, just settable after the fact
    from the BOM side too (see list_material_plans's suggestion above)."""
    if not ObjectId.is_valid(tech_pack_id):
        raise HTTPException(status_code=400, detail="Invalid tech pack.")
    material_plan_id = str(payload.get("material_plan_id") or "").strip()
    if not material_plan_id or not ObjectId.is_valid(material_plan_id):
        raise HTTPException(status_code=400, detail="Invalid material plan.")
    plan = await style_bom_plans_collection.find_one({"_id": ObjectId(material_plan_id), "tenant_id": ctx["tenant_id"]})
    if not plan:
        raise HTTPException(status_code=404, detail="Material plan not found.")
    result = await tech_packs_collection.update_one(
        {"_id": ObjectId(tech_pack_id), "tenant_id": ctx["tenant_id"]},
        {"$set": {"material_plan_id": material_plan_id, "updated_at": datetime.utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tech pack not found.")
    return {"message": f"Tech pack linked to {plan.get('plan_no', 'the material plan')}."}


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


async def _linked_theme_swatch(tenant_id: str, material_plan_id: str | None) -> dict | None:
    """A Tech Pack's optional material_plan_id points at a Style BOM plan;
    a Fabric Theme separately points at zero or more BOM plans via
    plan_ids. Neither record points at the other directly, so this walks
    BOM -> Theme to surface the theme name + its vendor fabric swatches on
    the Tech Pack — read-only enrichment, no new field stored on either
    record, nothing to keep in sync."""
    if not material_plan_id:
        return None
    theme = await fabric_themes_collection.find_one({"tenant_id": tenant_id, "plan_ids": material_plan_id})
    if not theme:
        return None
    swatches = [{
        "image_url": line.get("image_url", ""),
        "fabric_type": line.get("fabric_type", ""), "gsm": line.get("gsm", ""),
        "width": line.get("width", ""), "color": line.get("color", ""),
        "vendor_name": line.get("vendor_name") or (line.get("walkin_vendor") or {}).get("name") or "",
    } for line in (theme.get("lines") or [])]
    return {"id": str(theme["_id"]), "theme_name": theme.get("theme_name", ""), "swatches": swatches}


@router.get("/tech-packs")
async def list_tech_packs(ctx: dict = Depends(_require_job_work)):
    rows = []
    async for pack in tech_packs_collection.find({"tenant_id": ctx["tenant_id"]}).sort("updated_at", -1).limit(300):
        row = _serialize(pack)
        row["linked_theme"] = await _linked_theme_swatch(ctx["tenant_id"], pack.get("material_plan_id"))
        rows.append(row)
    return {"data": rows}


@router.post("/tech-packs", status_code=201)
async def create_tech_pack(request: Request, ctx: dict = Depends(_require_job_work)):
    payload, uploaded_by_category = await _tech_pack_payload_from_request(request)
    design_no = str(payload.get("design_no") or "").strip()[:120]
    style_name = str(payload.get("style_name") or "").strip()[:160]
    if not design_no or not style_name:
        raise HTTPException(status_code=400, detail="Design number and style name are required for a tech pack.")
    version = str(payload.get("version") or "v1").strip()[:30] or "v1"
    raw_images = payload.get("reference_images") or []
    if isinstance(raw_images, str):
        raw_images = [line.strip() for line in raw_images.splitlines()]
    if not isinstance(raw_images, list):
        raw_images = []
    raw_documents = payload.get("document_urls") or []
    if isinstance(raw_documents, str):
        raw_documents = [line.strip() for line in raw_documents.splitlines()]
    if not isinstance(raw_documents, list):
        raw_documents = []
    material_plan_id = str(payload.get("material_plan_id") or "").strip()
    if material_plan_id and not ObjectId.is_valid(material_plan_id):
        raise HTTPException(status_code=400, detail="Invalid linked material plan.")
    if material_plan_id:
        plan = await style_bom_plans_collection.find_one({"_id": ObjectId(material_plan_id), "tenant_id": ctx["tenant_id"]})
        if not plan:
            raise HTTPException(status_code=404, detail="Linked material plan not found.")

    def _category_images(category: str) -> list[str]:
        existing = payload.get(f"{category}_images") or []
        existing = _parse_json_list(existing) if isinstance(existing, str) else existing
        uploaded = uploaded_by_category.get(category, [])
        return [str(url).strip() for url in (*existing, *uploaded) if str(url).strip()][:20]

    now = datetime.utcnow()
    sequence = await tech_packs_collection.count_documents({"tenant_id": ctx["tenant_id"]}) + 1
    pack = {
        "tenant_id": ctx["tenant_id"],
        "tech_pack_no": f"TP-{now.strftime('%y%m%d')}-{sequence:04d}",
        "design_no": design_no,
        "style_name": style_name,
        "department": str(payload.get("department") or "").strip()[:80],
        "version": version,
        "status": "Draft",
        "theme_name": str(payload.get("theme_name") or "").strip()[:120],
        "collection": str(payload.get("collection") or "").strip()[:120],
        "designer_name": str(payload.get("designer_name") or "").strip()[:120],
        "sample_size": str(payload.get("sample_size") or "").strip()[:40],
        "description": str(payload.get("description") or "").strip()[:1200],
        "fabric_notes": str(payload.get("fabric_notes") or "").strip()[:2000],
        "measurement_notes": str(payload.get("measurement_notes") or "").strip()[:3000],
        "construction_notes": str(payload.get("construction_notes") or "").strip()[:3000],
        "artwork_notes": str(payload.get("artwork_notes") or "").strip()[:3000],
        "trims_labels_notes": str(payload.get("trims_labels_notes") or "").strip()[:3000],
        "colourway_notes": str(payload.get("colourway_notes") or "").strip()[:3000],
        "reference_images": [str(url).strip() for url in raw_images if str(url).strip()][:20],
        "document_urls": [str(url).strip() for url in raw_documents if str(url).strip()][:20],
        "material_plan_id": material_plan_id or None,
        # Structured Spec Sheet — measurement points × size grading, matching
        # a proper POM/grading table instead of a free-text description.
        "sizes": [str(size).strip()[:20] for size in _parse_json_list(payload.get("sizes")) if str(size).strip()][:20],
        "measurement_rows": _parse_measurement_rows(payload.get("measurement_rows")),
        # Structured Trims & Label line items — description/color/size/supplier/qty/price.
        "trims_items": _parse_trims_items(payload.get("trims_items")),
        # Artwork placement + real dimensions, alongside the artwork image(s).
        "artwork_width_cm": str(payload.get("artwork_width_cm") or "").strip()[:20],
        "artwork_height_cm": str(payload.get("artwork_height_cm") or "").strip()[:20],
        "artwork_placement": str(payload.get("artwork_placement") or "").strip()[:300],
        # Structured colourways — one row per fabric/thread combo.
        "colourways": _parse_colourways(payload.get("colourways")),
        # Per-guide-page image slots (Sketch / Details / Artwork / Trims & Label / Colourways).
        "sketch_images": _category_images("sketch"),
        "details_images": _category_images("details"),
        "artwork_images": _category_images("artwork"),
        "trims_images": _category_images("trims"),
        "colourway_images": _category_images("colourway"),
        "comments": [],
        "created_by": ctx.get("admin_id"),
        "created_at": now,
        "updated_at": now,
    }
    result = await tech_packs_collection.insert_one(pack)
    pack["_id"] = result.inserted_id
    return {"message": f"Tech pack {pack['tech_pack_no']} saved as {version}.", "data": _serialize(pack)}


@router.get("/tech-packs/{tech_pack_id}")
async def get_tech_pack(tech_pack_id: str, ctx: dict = Depends(_require_job_work)):
    if not ObjectId.is_valid(tech_pack_id):
        raise HTTPException(status_code=400, detail="Invalid tech pack.")
    pack = await tech_packs_collection.find_one({"_id": ObjectId(tech_pack_id), "tenant_id": ctx["tenant_id"]})
    if not pack:
        raise HTTPException(status_code=404, detail="Tech pack not found.")
    row = _serialize(pack)
    row["linked_theme"] = await _linked_theme_swatch(ctx["tenant_id"], pack.get("material_plan_id"))
    return {"data": row}


@router.post("/tech-packs/{tech_pack_id}/comments", status_code=201)
async def add_tech_pack_comment(tech_pack_id: str, payload: dict, ctx: dict = Depends(_require_job_work)):
    """A dated, appended note — for a small correction ('use the right
    button reference') that doesn't warrant cutting a whole new version.
    Never edited or removed once added, so it stays a genuine history."""
    if not ObjectId.is_valid(tech_pack_id):
        raise HTTPException(status_code=400, detail="Invalid tech pack.")
    note = str(payload.get("note") or "").strip()[:1000]
    if not note:
        raise HTTPException(status_code=400, detail="Comment cannot be empty.")
    comment = {
        "note": note,
        "author": ctx.get("admin_name") or ctx.get("admin_email") or "",
        "date": datetime.utcnow(),
    }
    result = await tech_packs_collection.update_one(
        {"_id": ObjectId(tech_pack_id), "tenant_id": ctx["tenant_id"]},
        {"$push": {"comments": comment}, "$set": {"updated_at": datetime.utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tech pack not found.")
    pack = await tech_packs_collection.find_one({"_id": ObjectId(tech_pack_id), "tenant_id": ctx["tenant_id"]})
    return {"message": "Comment added.", "data": _serialize(pack)}


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


def _make_job_work_share_link(token: str) -> str:
    return f"{APP_BASE_URL}/job-work-view/{token}"


def _job_work_public_payload(order: dict, retailer_name: str) -> dict:
    """Sanitised job-work order data safe to expose on the public link — no
    internal IDs, just enough for a walk-in job worker to see what's being
    asked of them, including the tech pack(s) already embedded on each
    design line at order-creation time (see create_order below)."""
    return {
        "order_no":         order.get("order_no", ""),
        "retailer_name":    retailer_name,
        "job_worker_name":  order.get("job_worker_name", ""),
        "job_work_type":    order.get("job_work_type", ""),
        "finished_product": order.get("finished_product", ""),
        "expected_quantity": order.get("expected_quantity", 0),
        "unit":             order.get("unit", "pcs"),
        "due_date":         order.get("due_date", ""),
        "remarks":          order.get("remarks", ""),
        "status":           order.get("status", ""),
        "order_viewed_at":  order.get("order_viewed_at"),
        "token_expires_at": str(order.get("token_expires_at", "")),
        "design_lines": [
            {
                "design_no":    line.get("design_no", ""),
                "product_type": line.get("product_type", ""),
                "quantity":     line.get("quantity", 0),
                "image_urls":   line.get("image_urls", []),
                "tech_pack":    line.get("tech_pack"),
            }
            for line in order.get("design_lines", [])
        ],
    }


@router.get("/orders/public/{token}")
async def public_view_job_work_order(token: str):
    """Public route — no login needed. A walk-in job worker opens this link
    from their email/WhatsApp message to see the order AND any tech pack
    linked to it (full spec content, same as a registered vendor gets in
    their portal — see VendorJobWork.jsx's TechPackSnapshot)."""
    order = await job_work_orders_collection.find_one({"share_token": token})
    if not order:
        raise HTTPException(status_code=404, detail="Invalid or expired link.")

    expires_at = order.get("token_expires_at")
    if expires_at and datetime.utcnow() > expires_at:
        raise HTTPException(status_code=410, detail="This link has expired. Please contact the buyer.")

    if not order.get("order_viewed_at"):
        await job_work_orders_collection.update_one(
            {"share_token": token},
            {"$set": {"order_viewed_at": datetime.utcnow(), "updated_at": datetime.utcnow()}},
        )
        order["order_viewed_at"] = datetime.utcnow()

    tenant = await tenants_collection.find_one({"tenant_id": order["tenant_id"]}, {"company_name": 1})
    retailer_name = (tenant or {}).get("company_name") or order["tenant_id"]
    return {"status": "success", "data": _job_work_public_payload(order, retailer_name)}


async def _send_job_work_order_alerts(order: dict, ctx: dict, vendor_doc: dict | None) -> dict:
    """Registered job worker: portal notification + email linking to their
    account portal. Walk-in job worker: email/WhatsApp link to the public,
    no-login order view (share_token, generated at creation — see
    create_order) — this carries the full order AND its tech pack, the same
    way the Fabric PO share-link flow already works for fabric vendors."""
    walkin = order.get("walkin_vendor") or {}
    job_worker_name = order.get("job_worker_name") or "Job worker"
    tenant = await tenants_collection.find_one({"tenant_id": ctx["tenant_id"]}, {"company_name": 1})
    retailer_name = (tenant or {}).get("company_name") or ctx["tenant_id"]
    is_registered = bool(vendor_doc)
    if is_registered:
        link = f"{APP_BASE_URL}/merchandiser-seller"
    elif order.get("share_token"):
        link = _make_job_work_share_link(order["share_token"])
    else:
        link = ""
    due = order.get("due_date") or "Not set"
    message = (
        f"Dear {job_worker_name},\n\n"
        f"A new job work order {order.get('order_no', '')} has been created for you by {retailer_name}.\n"
        f"Work type: {order.get('job_work_type', '')}\n"
        f"Finished product: {order.get('finished_product', '')}\n"
        f"Expected quantity: {order.get('expected_quantity', '')} {order.get('unit', '')}\n"
        f"Due date: {due}\n\n"
        + (f"View order & tech pack here:\n{link}\n\n" if link else "Please contact us for full order details and material handover.\n\n")
        + f"Regards,\n{retailer_name}"
    )
    mobile = ((vendor_doc or {}).get("contactMobile") or (vendor_doc or {}).get("mobile") or (vendor_doc or {}).get("phone") or walkin.get("mobile") or "")
    clean_mobile = _clean_whatsapp_mobile(mobile)
    whatsapp_url = f"https://wa.me/{clean_mobile}?text={quote(message)}" if clean_mobile else ""

    portal_notified = False
    if order.get("assigned_vendor_id"):
        await notify_vendor(
            order["assigned_vendor_id"], "job_work_order_created", "New job work order assigned",
            f"{retailer_name} created job work order {order.get('order_no', '')} for {order.get('finished_product', '')}.",
            tenant_id=ctx.get("tenant_id"),
            metadata={"order_id": str(order.get("_id", "")), "order_no": order.get("order_no", ""), "portal_link": link},
            category="job_work",
        )
        portal_notified = True

    recipient_email = (vendor_doc or {}).get("email") or walkin.get("email") or ""
    email_sent = False
    if recipient_email:
        email_sent = await send_job_work_order_email(
            recipient_email, job_worker_name, retailer_name, order.get("order_no", ""),
            order.get("job_work_type", ""), order.get("finished_product", ""),
            order.get("expected_quantity", 0), order.get("unit", "pcs"), due, link,
            requires_login=is_registered,
        )

    return {
        "portal_notification_created": portal_notified,
        "email_sent": email_sent,
        "whatsapp_url": whatsapp_url,
        "whatsapp_message": message,
        "whatsapp_mobile": clean_mobile,
        "whatsapp_auto_sent": False,
        "whatsapp_note": "Auto WhatsApp needs Meta WhatsApp Business credentials; use whatsapp_url/message for manual sending now." if clean_mobile else "",
    }


@router.post("/orders", status_code=201)
async def create_order(request: Request, ctx: dict = Depends(_require_job_work)):
    payload, uploaded_by_line = await _payload_from_request(request)
    design_lines = _parse_design_lines(payload.get("design_lines"))
    for index, urls in uploaded_by_line.items():
        if index < len(design_lines):
            design_lines[index]["image_urls"] = [*(design_lines[index].get("image_urls") or []), *urls][:12]
    for line in design_lines:
        tech_pack_id = line.get("tech_pack_id") or ""
        if not tech_pack_id:
            continue
        if not ObjectId.is_valid(tech_pack_id):
            raise HTTPException(status_code=400, detail="Invalid tech pack selected on a design line.")
        tech_pack = await tech_packs_collection.find_one({"_id": ObjectId(tech_pack_id), "tenant_id": ctx["tenant_id"]})
        if not tech_pack:
            raise HTTPException(status_code=404, detail="Selected tech pack was not found.")
        line["tech_pack"] = {
            "id": str(tech_pack["_id"]), "tech_pack_no": tech_pack.get("tech_pack_no", ""),
            "version": tech_pack.get("version", ""), "design_no": tech_pack.get("design_no", ""),
            "style_name": tech_pack.get("style_name", ""), "department": tech_pack.get("department", ""),
            "theme_name": tech_pack.get("theme_name", ""), "collection": tech_pack.get("collection", ""),
            "designer_name": tech_pack.get("designer_name", ""),
            "description": tech_pack.get("description", ""), "fabric_notes": tech_pack.get("fabric_notes", ""),
            "measurement_notes": tech_pack.get("measurement_notes", ""), "construction_notes": tech_pack.get("construction_notes", ""),
            "artwork_notes": tech_pack.get("artwork_notes", ""), "trims_labels_notes": tech_pack.get("trims_labels_notes", ""),
            "colourway_notes": tech_pack.get("colourway_notes", ""), "reference_images": tech_pack.get("reference_images", []),
            "document_urls": tech_pack.get("document_urls", []), "material_plan_id": tech_pack.get("material_plan_id"),
            "sizes": tech_pack.get("sizes", []), "measurement_rows": tech_pack.get("measurement_rows", []),
            "trims_items": tech_pack.get("trims_items", []),
            "artwork_width_cm": tech_pack.get("artwork_width_cm", ""), "artwork_height_cm": tech_pack.get("artwork_height_cm", ""),
            "artwork_placement": tech_pack.get("artwork_placement", ""), "colourways": tech_pack.get("colourways", []),
            "sketch_images": tech_pack.get("sketch_images", []), "details_images": tech_pack.get("details_images", []),
            "artwork_images": tech_pack.get("artwork_images", []), "trims_images": tech_pack.get("trims_images", []),
            "colourway_images": tech_pack.get("colourway_images", []),
        }
        if not line.get("image_urls"):
            line["image_urls"] = list(tech_pack.get("reference_images") or [])[:12]
    job_worker_name = str(payload.get("job_worker_name") or "").strip()
    registered_vendor_id = str(payload.get("vendor_id") or "").strip()
    job_worker_mobile = str(payload.get("job_worker_mobile") or "").strip()
    job_worker_email = str(payload.get("job_worker_email") or "").strip()
    job_work_type = str(payload.get("job_work_type") or "").strip()
    finished_product = str(payload.get("finished_product") or "").strip()
    expected_quantity = _number(payload.get("expected_quantity"))
    if design_lines:
        first = design_lines[0]
        if not finished_product:
            finished_product = first.get("product_type") or first.get("design_no") or "Design job"
        if expected_quantity <= 0:
            expected_quantity = sum(_number(line.get("quantity")) for line in design_lines)
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
    # A walk-in job worker has no portal login, so they need a public,
    # no-login link to see the order and its tech pack — same share_token
    # pattern as the walk-in Fabric PO flow (see purchaseorder_routes.py).
    share_token = str(uuid.uuid4()) if not registered_vendor_id else None
    order = {
        "tenant_id": ctx["tenant_id"],
        "order_no": f"JWO-{now.strftime('%y%m%d')}-{sequence:04d}",
        "job_worker_name": job_worker_name,
        "assigned_vendor_id": registered_vendor_id or None,
        "assigned_vendor_link_id": str(vendor_link["_id"]) if vendor_link else None,
        "job_work_type": job_work_type,
        "finished_product": finished_product,
        "expected_quantity": expected_quantity,
        "design_lines": design_lines,
        "unit": str(payload.get("unit") or "pcs").strip() or "pcs",
        "due_date": str(payload.get("due_date") or "").strip(),
        "remarks": str(payload.get("remarks") or "").strip()[:1000],
        "material_plan_id": str(material_plan["_id"]) if material_plan else None,
        "material_plan_no": material_plan.get("plan_no") if material_plan else None,
        "planned_materials": list(material_plan.get("materials") or []) if material_plan else [],
        "walkin_vendor": ({"mobile": job_worker_mobile, "email": job_worker_email} if not registered_vendor_id and (job_worker_mobile or job_worker_email) else None),
        "share_token": share_token,
        "token_expires_at": (now + timedelta(days=TOKEN_EXPIRY_DAYS)) if share_token else None,
        "order_viewed_at": None,
        "status": "DRAFT",
        "materials": [],
        "outputs": [],
        "created_by": ctx.get("admin_id"),
        "created_at": now,
        "updated_at": now,
    }
    result = await job_work_orders_collection.insert_one(order)
    order["_id"] = result.inserted_id
    # Real email to whichever address is on file (registered vendor or
    # walk-in), a portal notification for a registered vendor, and a
    # manual-send WhatsApp link/message — same honest limitation as the
    # regular PO flow: no Meta WhatsApp Business credentials are configured
    # anywhere in this codebase, so WhatsApp can't be auto-sent server-side.
    alert = await _send_job_work_order_alerts(order, ctx, vendor if registered_vendor_id else None)
    return {"message": "Job work order created. Issue material when it is physically sent.", "data": _serialize(order), **alert}


@router.post("/orders/{order_id}/issue")
async def issue_material(order_id: str, payload: dict, ctx: dict = Depends(_require_job_work)):
    tenant_id = ctx["tenant_id"]
    order = await _get_order(order_id, tenant_id)
    if order.get("status") != "DRAFT":
        raise HTTPException(status_code=400, detail="Material can be issued only once for a draft job work order.")

    lines = payload.get("materials") or []
    if not isinstance(lines, list) or not lines:
        raise HTTPException(status_code=400, detail="Add at least one material line.")

    store = await _stock_scope(tenant_id)
    collection = _stock_collection(store)

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
        stock = await collection.find_one(_stock_query(tenant_id, barcode, store))
        if not stock or _number(stock.get("stockQty")) < requested_quantity:
            available = _number((stock or {}).get("stockQty"))
            raise HTTPException(status_code=400, detail=f"Insufficient central stock for {barcode}. Available: {available}.")

    materials = []
    for line in lines:
        barcode = str(line.get("barcode") or "").strip()
        quantity = _number(line.get("issued_qty"))
        stock = await collection.find_one(_stock_query(tenant_id, barcode, store))
        product = str(line.get("product") or stock.get("description") or stock.get("product") or barcode).strip()
        rate = _number(line.get("rate") or stock.get("rate") or stock.get("mrp"))
        await collection.update_one(
            {"_id": stock["_id"]},
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
    # AWAITING_QC/REWORK_PENDING are allowed starting states too — a rework
    # redo, or another batch, can physically arrive while an earlier
    # receipt on this same order is still waiting on inspection.
    if order.get("status") not in {"ISSUED", "PARTIALLY_RECEIVED", "AWAITING_QC", "REWORK_PENDING"}:
        raise HTTPException(status_code=400, detail="Issue material before recording a job work receipt.")

    store = await _stock_scope(tenant_id)
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
            await _increase_central_stock(tenant_id, material["barcode"], returned, material["product"], _number(material.get("rate")), f"Job work material return {order['order_no']}", store=store)
        if leftover:
            await _add_leftover_stock(tenant_id, material["barcode"], leftover, material["product"], _number(material.get("rate")), f"Job work leftover from {order['order_no']}", store=store)
        receipt_materials.append({"barcode": material["barcode"], "product": material["product"], "used_qty": used, "returned_qty": returned, "leftover_qty": leftover, "waste_qty": waste})

    output = payload.get("output") or {}
    output_barcode = str(output.get("barcode") or "").strip()
    output_product = str(output.get("product") or order.get("finished_product") or "").strip()
    output_qty = _number(output.get("quantity"))
    output_rate = _number(output.get("rate"))
    if output_qty > 0 and not output_barcode:
        raise HTTPException(status_code=400, detail="Finished output barcode is required when receiving finished quantity.")
    # Finished goods from a job worker are NOT sellable stock yet — they sit
    # here as "received, not inspected" until a retailer-side QC pass
    # (POST .../receipts/{id}/qc below) accepts/rejects/sends-back-for-rework
    # each unit. Only accepted_qty ever reaches _increase_central_stock.
    output_doc = {
        "barcode": output_barcode, "product": output_product, "rate": output_rate,
        "quantity": output_qty, "received_qty": output_qty,
        "qc_status": "pending" if output_qty > 0 else "not_applicable",
        "accepted_qty": 0.0, "rejected_qty": 0.0, "rework_qty": 0.0,
        "qc_notes": "", "qc_by": None, "qc_at": None,
    }

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
    receipt = {
        "tenant_id": tenant_id, "order_id": order["_id"], "order_no": order["order_no"],
        "receipt_no": f"JWR-{now.strftime('%y%m%d')}-{str(ObjectId())[-5:].upper()}",
        "materials": receipt_materials,
        "output": output_doc,
        "consumption_warnings": consumption_warnings,
        "remarks": str(payload.get("remarks") or "").strip()[:1000],
        "received_by": ctx.get("admin_id"), "received_at": now,
    }
    result = await job_work_receipts_collection.insert_one(receipt)
    outputs = list(order.get("outputs") or [])
    if output_qty:
        outputs.append({"receipt_id": str(result.inserted_id), **output_doc, "received_at": now.isoformat()})

    if any((o or {}).get("qc_status") == "pending" for o in outputs):
        status = "AWAITING_QC"
    elif all_reconciled:
        status = "COMPLETED"
    else:
        status = "PARTIALLY_RECEIVED"

    await job_work_orders_collection.update_one(
        {"_id": order["_id"], "tenant_id": tenant_id},
        {"$set": {"materials": materials, "outputs": outputs, "status": status, "updated_at": now}},
    )
    message = f"Job work receipt recorded. Order status: {status.replace('_', ' ').title()}."
    if output_qty:
        message += f" {output_qty} {output_product or 'unit(s)'} received — run QC before it counts as sellable stock."
    if consumption_warnings:
        flagged = ", ".join(f"{w['material']} ({w['over_pct']}% over)" for w in consumption_warnings)
        message += f" Note: fabric use is above the design's expected consumption for {flagged}."
    return {
        "message": message, "receipt_id": str(result.inserted_id), "status": status,
        "consumption_warnings": consumption_warnings,
    }


@router.post("/orders/{order_id}/receipts/{receipt_id}/qc")
async def qc_job_work_receipt(order_id: str, receipt_id: str, payload: dict, ctx: dict = Depends(_require_job_work)):
    """Retailer-side quality check on finished goods a job worker sent back.
    This is the gate that was missing: only accepted_qty ever becomes
    sellable stock. rejected_qty is a permanent write-off (bad workmanship,
    unusable). rework_qty goes back to the job worker — it stays out of
    stock and out of waste; the retailer records another receipt against
    this same order once the corrected batch comes back, which is why
    receive_job_work above accepts AWAITING_QC/REWORK_PENDING as valid
    starting states."""
    tenant_id = ctx["tenant_id"]
    order = await _get_order(order_id, tenant_id)
    if not ObjectId.is_valid(receipt_id):
        raise HTTPException(status_code=400, detail="Invalid receipt ID.")

    outputs = list(order.get("outputs") or [])
    target_index = next((i for i, o in enumerate(outputs) if o.get("receipt_id") == receipt_id), None)
    if target_index is None:
        raise HTTPException(status_code=404, detail="No finished-goods receipt found with that ID on this order.")
    target = outputs[target_index]
    if target.get("qc_status") != "pending":
        raise HTTPException(status_code=400, detail="This receipt has already been QC'd.")

    received_qty = _number(target.get("received_qty"))
    accepted_qty = _number(payload.get("accepted_qty"))
    rejected_qty = _number(payload.get("rejected_qty"))
    rework_qty = _number(payload.get("rework_qty"))
    if round(accepted_qty + rejected_qty + rework_qty, 3) != round(received_qty, 3):
        raise HTTPException(
            status_code=400,
            detail=f"Accepted + rejected + rework must add up to the received quantity ({received_qty}).",
        )

    store = await _stock_scope(tenant_id)
    if accepted_qty > 0:
        await _increase_central_stock(
            tenant_id, target["barcode"], accepted_qty, target["product"], _number(target.get("rate")),
            f"Job work QC accepted — {order['order_no']} / {target.get('receipt_id')}", store=store,
        )

    now = datetime.utcnow()
    outputs[target_index] = {
        **target,
        "qc_status": "completed",
        "accepted_qty": accepted_qty, "rejected_qty": rejected_qty, "rework_qty": rework_qty,
        "qc_notes": str(payload.get("qc_notes") or "").strip()[:1000],
        "qc_by": ctx.get("admin_id"), "qc_at": now.isoformat(),
    }

    materials = order.get("materials") or []
    all_reconciled = all(
        _number(line.get("issued_qty")) - _number(line.get("used_qty")) - _number(line.get("returned_qty"))
        - _number(line.get("leftover_qty")) - _number(line.get("waste_qty")) <= 0.000001
        for line in materials
    )
    if any((o or {}).get("qc_status") == "pending" for o in outputs):
        status = "AWAITING_QC"
    elif rework_qty > 0:
        status = "REWORK_PENDING"
    else:
        status = "COMPLETED" if all_reconciled else "PARTIALLY_RECEIVED"

    await job_work_orders_collection.update_one(
        {"_id": order["_id"], "tenant_id": tenant_id},
        {"$set": {"outputs": outputs, "status": status, "updated_at": now}},
    )

    if order.get("assigned_vendor_id") and rework_qty > 0:
        await notify_vendor(
            order["assigned_vendor_id"], "job_work_rework_requested", "Rework requested",
            f"{rework_qty} unit(s) from job work order {order.get('order_no', '')} did not pass QC and need rework.",
            tenant_id=tenant_id,
            metadata={"order_id": str(order["_id"]), "order_no": order.get("order_no", ""), "rework_qty": rework_qty},
            category="job_work",
        )

    message = f"QC recorded: {accepted_qty} accepted"
    if rejected_qty: message += f", {rejected_qty} rejected"
    if rework_qty: message += f", {rework_qty} sent back for rework"
    message += "."
    return {"message": message, "status": status, "accepted_qty": accepted_qty, "rejected_qty": rejected_qty, "rework_qty": rework_qty}
