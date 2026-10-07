"""Citimart Data Hub — spreadsheet import for inventory + purchase forecasting.

Three sheet types, each previewed then committed:

  * STOCK    (one row per product per store — Locname/Source Site identifies
      the store; Barcode/Item Code identifies the product)
  * SALES    (day-wise bill lines — Bill Date, Store, Item Code/Barcode,
      Bill Qty, Net Amt, plus Cat-1..5 for design/brand/style/size reporting)
  * PURCHASE (GRC/inward receipts — GRC No., Order No., Rec Qty, Rec Dt)

Isolation (the whole point of this being a SEPARATE module rather than
reusing the Raphaa Data Hub or any live route):
  * 404 for any tenant other than "citimart"
  * every read and write filtered by ctx["tenant_id"]
  * uploads first land only in isolated Citimart staging collections. Sales
    and Purchase/GRC remain analytics-only. A stock batch can update live
    inventory/store_stock only through the separate Inventory-authorised
    review and explicit sync endpoint; existing operational logic is reused.
  * each committed batch is logged (citimart_data_hub_imports) with a
    batch_id, so a bad upload can be identified and rolled back.
"""
import hashlib
import io
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List

import pandas as pd
from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status

from .deps import get_hq_tenant
from .products import generate_base_sku
from ..db import (
    citimart_data_hub_imports_collection,
    citimart_purchase_import_collection,
    citimart_sales_import_collection,
    citimart_stock_snapshot_collection,
    citimart_stock_stage_rows_collection,
    citimart_stock_sync_audit_collection,
    inventory_collection,
    product_collection,
    stores_collection,
    store_stock_collection,
    vendors_collection,
    vendor_tenant_links_collection,
)

router = APIRouter(prefix="/api/citimart/data-hub", tags=["Citimart Data Hub"])
TenantCtx = Dict[str, Any]
MAX_ROWS = 20_000
PREVIEW_ROWS = 300

_CENTRAL_SEGMENTS = {
    "MAIN": {"label": "Main Warehouse", "aliases": ("warehouse", "central", "central inventory", "hq", "head office")},
    "SEMI_FRESH": {"label": "Semi Fresh Warehouse", "aliases": ("semi fresh warehouse", "semi fresh")},
    "PACKED": {"label": "Packed / Package", "aliases": ("package", "packed", "packed warehouse")},
}

def _key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").strip().lower())


def _text(value: Any) -> str:
    return str(value or "").strip()


def _number(value: Any) -> float:
    text = _text(value).replace(",", "")
    if not text:
        return 0.0
    try:
        return float(text)
    except ValueError:
        return 0.0


async def _citimart_context(ctx: TenantCtx = Depends(get_hq_tenant)) -> TenantCtx:
    if _key(ctx["tenant_id"]) != "citimart":
        raise HTTPException(status_code=404, detail="The Citimart Data Hub is available only for the Citimart tenant.")
    departments = set(ctx.get("_managed_departments") or [])
    permissions = set(ctx.get("_permissions") or [])
    if not ({"Forecast & Analytics", "Inventory"} & departments or {"forecast_analytics", "inventory"} & permissions):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forecast & Analytics or Inventory department access is required.")
    return ctx


def _read_rows(filename: str, content: bytes) -> List[dict]:
    """Reads every sheet of the workbook (a real export often spreads a
    pivot summary and the actual detail rows across different tabs), keeps
    only sheets that look like genuine data rows, and returns them as plain
    dicts keyed by normalised column name."""
    name = (filename or "").lower()
    try:
        if name.endswith(".csv"):
            frames = [pd.read_csv(io.BytesIO(content), dtype=str)]
        elif name.endswith((".xlsx", ".xls")):
            sheets = pd.read_excel(io.BytesIO(content), dtype=str, sheet_name=None)
            frames = list(sheets.values())
        else:
            raise HTTPException(status_code=400, detail="Upload a CSV or Excel file (.csv, .xlsx, .xls).")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="The file could not be read. Keep the original column headers.")

    for frame in frames:
        frame.columns = [_key(column) for column in frame.columns]
    data_frames = [f for f in frames if len(f.index) > 0 and len(f.columns) >= 3]
    if not data_frames:
        raise HTTPException(status_code=400, detail="The uploaded file has no data rows.")
    frame = pd.concat(data_frames, ignore_index=True, sort=False) if len(data_frames) > 1 else data_frames[0]
    frame = frame.where(pd.notnull(frame), "")
    if len(frame.index) > MAX_ROWS:
        raise HTTPException(status_code=400, detail=f"A maximum of {MAX_ROWS:,} rows is allowed per file.")
    return frame.to_dict(orient="records")


def _column(row: dict, *names: str) -> str:
    for name in names:
        value = row.get(_key(name))
        if _text(value):
            return _text(value)
    return ""


async def _log_batch(tenant_id: str, kind: str, row_count: int, by: str, *, batch_id: str = "", file_name: str = "", file_sha256: str = "") -> str:
    batch_id = batch_id or uuid.uuid4().hex[:12]
    await citimart_data_hub_imports_collection.insert_one({
        "tenant_id": tenant_id, "batch_id": batch_id, "kind": kind, "row_count": row_count,
        "imported_by": by, "imported_at": datetime.utcnow(), "file_name": file_name,
        "file_sha256": file_sha256, "live_sync_status": "NOT_SYNCED" if kind == "stock" else "ANALYTICS_ONLY",
    })
    return batch_id


# Controlled bridge from Citimart's isolated stock staging area into the live
# collections already used by POS and Stock Transfer. Upload remains harmless;
# an authorised user must separately review and approve a batch sync.
_CENTRAL_LOCATION_ALIASES = {
    "central", "centralinventory", "hq", "head office", "headoffice",
    "warehouse", "central warehouse", "centralwarehouse", "main warehouse",
}


def _identity_key(value: Any) -> str:
    return str(value or "").strip().casefold()


def _location_key(value: Any) -> str:
    return _key(value)


def _add_unique(mapping: Dict[str, Any], ambiguous: set, value: Any, resolved: Any) -> None:
    key = _identity_key(value)
    if not key:
        return
    if key in mapping and mapping[key] != resolved:
        ambiguous.add(key)
        mapping.pop(key, None)
    elif key not in ambiguous:
        mapping[key] = resolved


def _build_product_lookup(products: List[dict]) -> tuple:
    """Build unambiguous barcode/SKU maps. Ambiguous identifiers are blocked."""
    barcodes: Dict[str, dict] = {}
    skus: Dict[str, dict] = {}
    ambiguous_barcodes, ambiguous_skus = set(), set()
    for product in products:
        product_id = str(product.get("_id") or "")
        base = {
            "product_id": product_id,
            "barcode": _text(product.get("barcode")),
            "name": _text(product.get("product_name") or product.get("description")),
            "sku": _text(product.get("sku")),
            "rate": _number(product.get("cost_price")),
            "mrp": _number(product.get("mrp")),
        }
        _add_unique(barcodes, ambiguous_barcodes, base["barcode"], base)
        _add_unique(skus, ambiguous_skus, base["sku"], base)
        for variant in product.get("variants") or []:
            variant_barcode = _text(variant.get("barcode"))
            if not variant_barcode:
                continue
            resolved = {
                **base,
                "barcode": variant_barcode,
                "sku": _text(variant.get("sku") or base["sku"]),
                "name": " | ".join(filter(None, [base["name"], _text(variant.get("size_label")), _text(variant.get("color"))])),
                "rate": _number(variant.get("cost_price")) or base["rate"],
                "mrp": _number(variant.get("mrp")) or base["mrp"],
                "variant_id": str(variant.get("id") or variant.get("_id") or variant.get("sku") or ""),
            }
            _add_unique(barcodes, ambiguous_barcodes, variant_barcode, resolved)
            _add_unique(skus, ambiguous_skus, resolved["sku"], resolved)
    return barcodes, skus, ambiguous_barcodes, ambiguous_skus


def _resolve_product_row(row: dict, lookup: tuple) -> tuple:
    barcodes, skus, ambiguous_barcodes, ambiguous_skus = lookup
    barcode_key = _identity_key(row.get("barcode"))
    item_key = _identity_key(row.get("item_code"))
    errors = []
    if barcode_key in ambiguous_barcodes:
        errors.append(f"Barcode '{row.get('barcode')}' matches more than one Product Master record.")
    if item_key in ambiguous_skus:
        errors.append(f"Item Code '{row.get('item_code')}' matches more than one Product Master record.")
    by_barcode = barcodes.get(barcode_key) if barcode_key else None
    by_sku = skus.get(item_key) if item_key else None
    if by_barcode and by_sku and (by_barcode["product_id"], by_barcode["barcode"]) != (by_sku["product_id"], by_sku["barcode"]):
        errors.append("Barcode and Item Code resolve to different products.")
    resolved = by_barcode or by_sku
    if not resolved and not errors:
        errors.append(f"No Product Master match for barcode/item code '{row.get('barcode') or row.get('item_code')}'.")
    return resolved, errors


def _build_location_lookup(stores: List[dict]) -> tuple:
    mapping: Dict[str, dict] = {}
    ambiguous = set()
    for store in stores:
        resolved = {"kind": "store", "store_id": str(store["_id"]), "store_name": _text(store.get("name")), "store_code": _text(store.get("code"))}
        for value in (store.get("name"), store.get("code")):
            key = _location_key(value)
            if not key:
                continue
            if key in mapping and mapping[key]["store_id"] != resolved["store_id"]:
                ambiguous.add(key); mapping.pop(key, None)
            elif key not in ambiguous:
                mapping[key] = resolved
    for segment, config in _CENTRAL_SEGMENTS.items():
        resolved = {
            "kind": "central", "store_id": None, "store_name": "Central Inventory", "store_code": "HQ",
            "central_segment": segment, "segment_name": config["label"],
            "location_label": f"Central Inventory / {config['label']}",
        }
        for alias in config["aliases"]:
            mapping[_location_key(alias)] = resolved
    return mapping, ambiguous


def _resolve_location(value: Any, lookup: tuple) -> tuple:
    mapping, ambiguous = lookup
    key = _location_key(value)
    if key in ambiguous:
        return None, [f"Location '{value}' is ambiguous in RMS store setup."]
    resolved = mapping.get(key)
    if not resolved:
        return None, [f"Location '{value}' does not match Central Inventory or an existing Citimart store."]
    return resolved, []


async def _resolve_stock_batch(tenant_id: str, batch_id: str) -> dict:
    batch = await citimart_data_hub_imports_collection.find_one({"tenant_id": tenant_id, "batch_id": batch_id, "kind": "stock"})
    if not batch:
        raise HTTPException(status_code=404, detail="Stock import batch not found.")
    rows = await citimart_stock_stage_rows_collection.find({"tenant_id": tenant_id, "batch_id": batch_id}).to_list(length=MAX_ROWS + 1)
    products = await product_collection.find({"tenant_id": tenant_id}).to_list(length=None)
    stores = await stores_collection.find({"tenant_id": tenant_id, "active": True}).to_list(length=None)
    product_lookup = _build_product_lookup(products)
    location_lookup = _build_location_lookup(stores)
    resolved_rows, problems = [], []
    seen = set()
    for row in rows:
        product, product_errors = _resolve_product_row(row, product_lookup)
        location, location_errors = _resolve_location(row.get("store_name"), location_lookup)
        errors = product_errors + location_errors
        if product and location:
            grain = (location["store_id"] or "CENTRAL", location.get("central_segment"), product["barcode"])
            if grain in seen:
                errors.append("Duplicate product/location row in this import batch.")
            seen.add(grain)
        public = {
            "row_no": row.get("row_no"), "source_location": row.get("store_name"),
            "source_barcode": row.get("barcode"), "source_item_code": row.get("item_code"),
            "closing_qty": _number(row.get("closing_qty")), "errors": errors,
            "product": product, "location": location,
        }
        (problems if errors else resolved_rows).append(public)
    return {"batch": batch, "rows": resolved_rows, "problems": problems, "staged_row_count": len(rows)}


async def _live_state(tenant_id: str, barcode: str, store_id: str | None) -> dict:
    collection = store_stock_collection if store_id else inventory_collection
    query = {"tenant_id": tenant_id, "barcode": barcode}
    if store_id:
        query["store_id"] = store_id
    return await collection.find_one(query) or {}


def _central_segments(doc: dict) -> Dict[str, float]:
    raw = doc.get("central_segments") or {}
    segments = {key: _number(raw.get(key)) for key in _CENTRAL_SEGMENTS}
    if not any(segments.values()) and _number(doc.get("stockQty")):
        segments["MAIN"] = _number(doc.get("stockQty"))
    return segments


async def _live_qty(tenant_id: str, barcode: str, store_id: str | None) -> float:
    return _number((await _live_state(tenant_id, barcode, store_id)).get("stockQty"))


async def _set_live_qty(tenant_id: str, product: dict, location: dict, qty: float, batch_id: str, now: datetime) -> float:
    store_id = location.get("store_id")
    if not store_id:
        raise ValueError("Central inventory must be written as an aggregated segment snapshot.")
    query = {"tenant_id": tenant_id, "barcode": product["barcode"], "store_id": store_id}
    before = await _live_qty(tenant_id, product["barcode"], store_id)
    common = {
        "tenant_id": tenant_id, "barcode": product["barcode"], "stockQty": qty,
        "description": product.get("name", ""), "product_name": product.get("name", ""),
        "product_id": product.get("product_id", ""), "rate": product.get("rate", 0),
        "mrp": product.get("mrp", 0), "source": "citimart_data_hub_sync",
        "data_hub_batch_id": batch_id, "updatedAt": now, "store_id": store_id,
        "store_name": location.get("store_name", ""), "store_code": location.get("store_code", ""),
    }
    await store_stock_collection.update_one(query, {"$set": common, "$setOnInsert": {"createdAt": now}}, upsert=True)
    return before


async def _set_central_segments(tenant_id: str, product: dict, segments: dict, batch_id: str, now: datetime) -> dict:
    query = {"tenant_id": tenant_id, "barcode": product["barcode"]}
    before_doc = await inventory_collection.find_one(query) or {}
    before_segments = _central_segments(before_doc)
    clean = {key: _number(segments.get(key)) for key in _CENTRAL_SEGMENTS}
    total = sum(clean.values())
    common = {
        "tenant_id": tenant_id, "barcode": product["barcode"], "stockQty": total,
        "central_segments": clean, "central_segments_total": total,
        "description": product.get("name") or before_doc.get("description", ""),
        "product_name": product.get("name") or before_doc.get("product_name", ""),
        "product_id": product.get("product_id") or before_doc.get("product_id", ""),
        "rate": product.get("rate", before_doc.get("rate", 0)), "mrp": product.get("mrp", before_doc.get("mrp", 0)),
        "source": "citimart_data_hub_sync", "data_hub_batch_id": batch_id, "updatedAt": now,
    }
    await inventory_collection.update_one(query, {"$set": common, "$setOnInsert": {"createdAt": now}}, upsert=True)
    return {"qty": _number(before_doc.get("stockQty")), "segments": before_segments}
# ── STOCK ────────────────────────────────────────────────────────────────
# One row per product × store. Locname/Source Site is the store; whichever
# is present (Locname preferred) becomes store_name. The snapshot is
# absolute ($set, never $inc) — re-uploading the same file twice leaves the
# same end state, and a product absent from a later file simply keeps its
# last-known snapshot rather than being zeroed out silently.
_STOCK_LOC_ALIASES = ("locname", "loc name", "source site", "sourcesite", "store", "store name")
_STOCK_QTY_ALIASES = ("closing_qty", "closing qty", "closingqty", "qty", "quantity")
_STOCK_AMT_ALIASES = ("closing_amt", "closing amt", "closingamt", "amount", "amt")


def _parse_stock_rows(rows: List[dict]) -> List[dict]:
    parsed = []
    for index, row in enumerate(rows, start=2):
        errors: List[str] = []
        store_name = _column(row, *_STOCK_LOC_ALIASES)
        barcode = _column(row, "barcode")
        item_code = _column(row, "item_code", "itemcode")
        if not store_name:
            errors.append("Store / Locname is required.")
        if not barcode and not item_code:
            errors.append("Barcode or Item Code is required.")
        qty = _number(_column(row, *_STOCK_QTY_ALIASES))
        parsed.append({
            "row_no": index, "store_name": store_name, "barcode": barcode, "item_code": item_code,
            "division": _column(row, "division"), "section": _column(row, "section"), "department": _column(row, "department"),
            "vendor": _column(row, "vendor"), "hsn_code": _column(row, "hsn code", "hsncode"),
            "category1": _column(row, "category1", "cat1", "cat 1"), "category2": _column(row, "category2", "cat2", "cat 2"),
            "category3": _column(row, "category3", "cat3", "cat 3"), "category4": _column(row, "category4", "cat4", "cat 4"),
            "category5": _column(row, "category5", "cat5", "cat 5"), "category6": _column(row, "category6", "cat6", "cat 6"),
            "standard_rate": _number(_column(row, "standard_rate", "standardrate")), "rsp": _number(_column(row, "rsp")),
            "mrp": _number(_column(row, "mrp")), "wsp": _number(_column(row, "wsp")), "uom": _column(row, "uom"),
            "closing_qty": qty, "closing_amt": _number(_column(row, *_STOCK_AMT_ALIASES)),
            "errors": errors,
        })
    return parsed


def _mark_stock_duplicates(rows: List[dict]) -> List[dict]:
    seen = set()
    for row in rows:
        grain = (_location_key(row.get("store_name")), _identity_key(row.get("barcode") or row.get("item_code")))
        if grain in seen:
            row["errors"].append("Duplicate product/location row in this file.")
        seen.add(grain)
    return rows


@router.post("/stock/preview")
async def preview_stock(file: UploadFile = File(...), ctx: TenantCtx = Depends(_citimart_context)):
    rows = _mark_stock_duplicates(_parse_stock_rows(_read_rows(file.filename or "", await file.read())))
    invalid = sum(1 for r in rows if r["errors"])
    stores = sorted({r["store_name"] for r in rows if r["store_name"]})
    return {
        "status": "success", "mode": "preview_only",
        "summary": {"row_count": len(rows), "valid_count": len(rows) - invalid, "invalid_count": invalid, "stores": stores},
        "rows": rows[:PREVIEW_ROWS], "truncated": len(rows) > PREVIEW_ROWS,
    }


@router.post("/stock/commit")
async def commit_stock(file: UploadFile = File(...), ctx: TenantCtx = Depends(_citimart_context)):
    content = await file.read()
    rows = _mark_stock_duplicates(_parse_stock_rows(_read_rows(file.filename or "", content)))
    now = datetime.utcnow()
    batch_id = uuid.uuid4().hex[:12]
    file_sha256 = hashlib.sha256(content).hexdigest()
    duplicate = await citimart_data_hub_imports_collection.find_one({
        "tenant_id": ctx["tenant_id"], "kind": "stock", "file_sha256": file_sha256,
    })
    if duplicate:
        raise HTTPException(status_code=409, detail=f"This exact stock file was already imported as batch {duplicate.get('batch_id')}.")

    saved, skipped = 0, []
    for row in rows:
        if row["errors"]:
            skipped.append({"row_no": row["row_no"], "errors": row["errors"]})
            continue
        key = {"tenant_id": ctx["tenant_id"], "store_name": row["store_name"], "barcode": row["barcode"] or row["item_code"]}
        staged = {**row, **key, "batch_id": batch_id, "updated_at": now}
        await citimart_stock_stage_rows_collection.insert_one(staged)
        await citimart_stock_snapshot_collection.update_one(
            key, {"$set": staged}, upsert=True,
        )
        saved += 1
    await _log_batch(
        ctx["tenant_id"], "stock", saved, ctx.get("admin_name") or ctx.get("admin_email") or "",
        batch_id=batch_id, file_name=file.filename or "", file_sha256=file_sha256,
    )
    return {
        "status": "success", "mode": "committed", "batch_id": batch_id,
        "saved": saved, "rows_skipped": len(skipped), "skipped_rows": skipped[:200],
        "message": f"{saved} stock row(s) staged for review" + (f", {len(skipped)} skipped" if skipped else "") + ". Review the mapping, then explicitly sync it to live inventory.",
    }


def _require_live_sync_permission(ctx: TenantCtx) -> None:
    departments = set(ctx.get("_managed_departments") or [])
    permissions = set(ctx.get("_permissions") or [])
    if "Inventory" not in departments and "inventory" not in permissions:
        raise HTTPException(status_code=403, detail="Inventory permission is required to sync staged stock to live operations.")


@router.get("/stock/{batch_id}/sync-preview")
async def stock_sync_preview(batch_id: str, ctx: TenantCtx = Depends(_citimart_context)):
    resolution = await _resolve_stock_batch(ctx["tenant_id"], batch_id)
    rows = resolution["rows"]
    problems = resolution["problems"]
    by_location: Dict[str, dict] = {}
    for row in rows:
        location = row["location"]
        label = location.get("location_label") or location["store_name"]
        summary = by_location.setdefault(label, {"location": label, "store_id": location["store_id"], "product_count": 0, "quantity": 0.0})
        summary["product_count"] += 1
        summary["quantity"] += row["closing_qty"]
    return {
        "status": "success",
        "data": {
            "batch_id": batch_id,
            "live_sync_status": resolution["batch"].get("live_sync_status", "NOT_SYNCED"),
            "staged_row_count": resolution["staged_row_count"],
            "resolved_count": len(rows), "problem_count": len(problems),
            "can_sync": bool(rows) and not problems and resolution["batch"].get("live_sync_status", "NOT_SYNCED") in {"NOT_SYNCED", "FAILED"},
            "locations": [{**item, "quantity": round(item["quantity"], 2)} for item in by_location.values()],
            "rows": rows[:PREVIEW_ROWS], "problems": problems[:PREVIEW_ROWS],
            "truncated": len(rows) > PREVIEW_ROWS or len(problems) > PREVIEW_ROWS,
        },
    }


@router.post("/stock/{batch_id}/sync")
async def sync_stock_to_live(batch_id: str, payload: dict, ctx: TenantCtx = Depends(_citimart_context)):
    _require_live_sync_permission(ctx)
    mode = str(payload.get("snapshot_mode") or "partial").strip().lower()
    if mode not in {"partial", "full"}:
        raise HTTPException(status_code=400, detail="snapshot_mode must be 'partial' or 'full'.")
    if payload.get("confirm") is not True:
        raise HTTPException(status_code=400, detail="Explicit confirmation is required before live inventory is changed.")
    resolution = await _resolve_stock_batch(ctx["tenant_id"], batch_id)
    if resolution["problems"]:
        raise HTTPException(status_code=409, detail=f"Resolve all {len(resolution['problems'])} product/location mapping problem(s) before syncing.")
    if not resolution["rows"]:
        raise HTTPException(status_code=400, detail="This batch has no valid stock rows to sync.")
    if resolution["batch"].get("live_sync_status", "NOT_SYNCED") in {"SYNCED", "SYNCING"}:
        raise HTTPException(status_code=409, detail="This stock batch has already been synced or is syncing.")
    claim = await citimart_data_hub_imports_collection.update_one(
        {"tenant_id": ctx["tenant_id"], "batch_id": batch_id, "kind": "stock", "live_sync_status": {"$in": ["NOT_SYNCED", "FAILED"]}},
        {"$set": {"live_sync_status": "SYNCING", "sync_started_at": datetime.utcnow(), "snapshot_mode": mode}},
    )
    if claim.modified_count != 1:
        raise HTTPException(status_code=409, detail="This batch cannot be synced in its current state.")
    now = datetime.utcnow()
    audit_rows, written = [], []
    try:
        central_by_barcode: Dict[str, dict] = {}
        for row in resolution["rows"]:
            product, location, qty = row["product"], row["location"], row["closing_qty"]
            if not location.get("store_id"):
                entry = central_by_barcode.setdefault(product["barcode"], {"product": product, "values": {}})
                entry["values"][location["central_segment"]] = qty
                continue
            before = await _set_live_qty(ctx["tenant_id"], product, location, qty, batch_id, now)
            audit_rows.append({"tenant_id": ctx["tenant_id"], "batch_id": batch_id, "barcode": product["barcode"], "product_id": product.get("product_id", ""), "product_name": product.get("name", ""), "store_id": location["store_id"], "store_name": location.get("store_name"), "previous_qty": before, "new_qty": qty, "difference": qty-before, "change_type": "FILE_ROW", "synced_at": now})
            written.append({"barcode": product["barcode"], "store_id": location["store_id"], "expected": qty})

        for barcode, entry in central_by_barcode.items():
            live = await _live_state(ctx["tenant_id"], barcode, None)
            segments = _central_segments(live)
            segments.update(entry["values"])
            before = await _set_central_segments(ctx["tenant_id"], entry["product"], segments, batch_id, now)
            total = sum(segments.values())
            audit_rows.append({"tenant_id": ctx["tenant_id"], "batch_id": batch_id, "barcode": barcode, "product_id": entry["product"].get("product_id", ""), "product_name": entry["product"].get("name", ""), "store_id": None, "store_name": "Central Inventory", "previous_qty": before["qty"], "new_qty": total, "previous_segments": before["segments"], "new_segments": segments, "difference": total-before["qty"], "change_type": "CENTRAL_SEGMENT_SNAPSHOT", "synced_at": now})
            written.append({"barcode": barcode, "store_id": None, "expected": total, "expected_segments": segments})

        if audit_rows:
            await citimart_stock_sync_audit_collection.insert_many(audit_rows, ordered=True)
        mismatches = []
        for item in written:
            state = await _live_state(ctx["tenant_id"], item["barcode"], item["store_id"])
            actual = _number(state.get("stockQty"))
            if abs(actual-item["expected"]) > 0.0001 or (item.get("expected_segments") is not None and _central_segments(state) != item["expected_segments"]):
                mismatches.append({**item, "actual": actual})
        if mismatches:
            raise RuntimeError(f"Live-stock reconciliation failed for {len(mismatches)} row(s).")
        await citimart_data_hub_imports_collection.update_one(
            {"tenant_id": ctx["tenant_id"], "batch_id": batch_id},
            {"$set": {"live_sync_status": "SYNCED", "synced_at": now, "synced_by": ctx.get("admin_name") or ctx.get("admin_email") or "", "synced_change_count": len(audit_rows), "reconciliation_status": "MATCHED"}},
        )
        return {"status": "success", "batch_id": batch_id, "snapshot_mode": mode, "changed_records": len(audit_rows), "reconciliation_status": "MATCHED", "message": "Citimart inventory synced; only supplied rows changed, and central segment totals were reconciled."}
    except Exception as exc:
        await citimart_data_hub_imports_collection.update_one({"tenant_id": ctx["tenant_id"], "batch_id": batch_id}, {"$set": {"live_sync_status": "FAILED", "sync_error": str(exc), "sync_failed_at": datetime.utcnow()}})
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"Live inventory sync failed: {exc}")

@router.post("/stock/{batch_id}/rollback")
async def rollback_stock_sync(batch_id: str, payload: dict, ctx: TenantCtx = Depends(_citimart_context)):
    _require_live_sync_permission(ctx)
    if payload.get("confirm") is not True:
        raise HTTPException(status_code=400, detail="Explicit confirmation is required before rollback.")
    batch = await citimart_data_hub_imports_collection.find_one({"tenant_id": ctx["tenant_id"], "batch_id": batch_id, "kind": "stock"})
    if not batch or batch.get("live_sync_status") != "SYNCED":
        raise HTTPException(status_code=409, detail="Only a successfully synced stock batch can be rolled back.")
    changes = await citimart_stock_sync_audit_collection.find({"tenant_id": ctx["tenant_id"], "batch_id": batch_id}).to_list(length=MAX_ROWS * 3)
    conflicts = []
    for change in changes:
        state = await _live_state(ctx["tenant_id"], change["barcode"], change.get("store_id"))
        actual = _number(state.get("stockQty"))
        segments_match = change.get("new_segments") is None or _central_segments(state) == change.get("new_segments")
        if abs(actual - _number(change.get("new_qty"))) > 0.0001 or not segments_match:
            conflicts.append({"barcode": change["barcode"], "store_name": change.get("store_name"), "expected": change.get("new_qty"), "actual": actual})
    if conflicts:
        raise HTTPException(status_code=409, detail=f"Rollback blocked: {len(conflicts)} stock record(s) changed after this sync. Use reviewed stock adjustments instead.")
    now = datetime.utcnow()
    for change in changes:
        store_id = change.get("store_id")
        collection = store_stock_collection if store_id else inventory_collection
        query = {"tenant_id": ctx["tenant_id"], "barcode": change["barcode"]}
        if store_id:
            query["store_id"] = store_id
        restore = {"stockQty": change["previous_qty"], "source": "citimart_data_hub_rollback", "updatedAt": now}
        if not store_id and change.get("previous_segments") is not None:
            restore["central_segments"] = change["previous_segments"]
            restore["central_segments_total"] = sum(change["previous_segments"].values())
        await collection.update_one(query, {"$set": restore})
    await citimart_data_hub_imports_collection.update_one(
        {"tenant_id": ctx["tenant_id"], "batch_id": batch_id},
        {"$set": {"live_sync_status": "ROLLED_BACK", "rolled_back_at": now, "rolled_back_by": ctx.get("admin_name") or ctx.get("admin_email") or ""}},
    )
    return {"status": "success", "restored_records": len(changes), "message": "Live stock was restored to its pre-sync quantities."}

# ── SALES ────────────────────────────────────────────────────────────────
def _parse_sales_rows(rows: List[dict]) -> List[dict]:
    parsed = []
    for index, row in enumerate(rows, start=2):
        errors: List[str] = []
        bill_no = _column(row, "bill no", "billno", "bill_no")
        bill_date_raw = _column(row, "bill date", "billdate")
        bill_date = ""
        if bill_date_raw:
            try:
                bill_date = pd.to_datetime(bill_date_raw, dayfirst=True, errors="raise").date().isoformat()
            except Exception:
                errors.append(f"Bill Date '{bill_date_raw}' is not a valid date.")
        else:
            errors.append("Bill Date is required.")
        if not bill_no:
            errors.append("Bill No. is required.")
        barcode = _column(row, "barcode")
        item_code = _column(row, "item code", "itemcode", "item_code")
        if not barcode and not item_code:
            errors.append("Barcode or Item Code is required.")
        is_void = _key(_column(row, "isvoid", "is void")) in {"1", "true", "yes", "y"}
        parsed.append({
            "row_no": index, "bill_no": bill_no, "bill_date": bill_date, "bill_time": _column(row, "bill time", "billtime"),
            "store": _column(row, "store"), "terminal_no": _column(row, "terminal no", "terminalno"),
            "division": _column(row, "division"), "section": _column(row, "section"), "department": _column(row, "department"),
            "vendor": _column(row, "vendor"), "item_code": item_code, "barcode": barcode, "is_void": is_void,
            "hsn_code": _column(row, "hsn_code", "hsncode"),
            "design_no": _column(row, "cat-1 (design no.)", "cat1", "design no"), "brand": _column(row, "cat-2 (brand)", "cat2", "brand"),
            "style": _column(row, "cat-3 (style)", "cat3", "style"), "plan_fs_hs": _column(row, "cat-4 (plane, f/s, h/s)", "cat4"),
            "size": _column(row, "cat-5 (size)", "cat5", "size"),
            "bill_qty": _number(_column(row, "bill qty", "billqty")), "gr_amt": _number(_column(row, "gr amt", "gramt")),
            "net_amt": _number(_column(row, "net amt", "netamt")), "taxable_sale": _number(_column(row, "taxable sale", "taxablesale")),
            "year": _column(row, "year"),
            "errors": errors,
        })
    return parsed


@router.post("/sales/preview")
async def preview_sales(file: UploadFile = File(...), ctx: TenantCtx = Depends(_citimart_context)):
    rows = _parse_sales_rows(_read_rows(file.filename or "", await file.read()))
    invalid = sum(1 for r in rows if r["errors"])
    return {
        "status": "success", "mode": "preview_only",
        "summary": {"row_count": len(rows), "valid_count": len(rows) - invalid, "invalid_count": invalid},
        "rows": rows[:PREVIEW_ROWS], "truncated": len(rows) > PREVIEW_ROWS,
    }


@router.post("/sales/commit")
async def commit_sales(file: UploadFile = File(...), ctx: TenantCtx = Depends(_citimart_context)):
    rows = _parse_sales_rows(_read_rows(file.filename or "", await file.read()))
    now = datetime.utcnow()
    docs, skipped = [], []
    for row in rows:
        if row["errors"] or row["is_void"]:
            if row["errors"]:
                skipped.append({"row_no": row["row_no"], "errors": row["errors"]})
            continue
        docs.append({"tenant_id": ctx["tenant_id"], **row, "imported_at": now})
    if docs:
        await citimart_sales_import_collection.insert_many(docs, ordered=False)
    batch_id = await _log_batch(ctx["tenant_id"], "sales", len(docs), ctx.get("admin_name") or ctx.get("admin_email") or "")
    voided = sum(1 for r in rows if r["is_void"])
    return {
        "status": "success", "mode": "committed", "batch_id": batch_id,
        "saved": len(docs), "rows_skipped": len(skipped), "skipped_rows": skipped[:200], "voided_rows_excluded": voided,
        "message": f"{len(docs)} sales row(s) imported" + (f", {len(skipped)} skipped" if skipped else "") + (f", {voided} voided row(s) excluded" if voided else "") + ".",
    }


# ── PURCHASE / GRC ───────────────────────────────────────────────────────
def _parse_purchase_rows(rows: List[dict]) -> List[dict]:
    parsed = []
    for index, row in enumerate(rows, start=2):
        errors: List[str] = []
        grc_no = _column(row, "grc no.", "grc no", "grcno")
        rec_dt_raw = _column(row, "rec dt", "recdt", "received date")
        rec_dt = ""
        if rec_dt_raw:
            try:
                rec_dt = pd.to_datetime(rec_dt_raw, dayfirst=True, errors="raise").date().isoformat()
            except Exception:
                errors.append(f"Rec Dt '{rec_dt_raw}' is not a valid date.")
        barcode = _column(row, "barcode")
        item_code = _column(row, "item code", "itemcode")
        if not barcode and not item_code:
            errors.append("Barcode or Item Code is required.")
        rec_qty = _number(_column(row, "rec qty", "recqty"))
        if rec_qty <= 0:
            errors.append("Rec Qty must be greater than zero.")
        parsed.append({
            "row_no": index, "grc_no": grc_no, "order_no": _column(row, "order no", "orderno"), "rec_dt": rec_dt,
            "division": _column(row, "division"), "section": _column(row, "section"), "department": _column(row, "department"),
            "item_code": item_code, "ageing": _column(row, "ageing"), "barcode": barcode,
            "std_rate": _number(_column(row, "std rate", "stdrate")), "rsp": _number(_column(row, "rsp")),
            "vendor": _column(row, "vendor"), "brand": _column(row, "brand"),
            "category1": _column(row, "catagory - 1", "catagory-1", "category1"), "category2": _column(row, "catagory-2", "category2"),
            "category3": _column(row, "catagory-3", "category3"), "category4": _column(row, "catagory-4", "category4"),
            "category5": _column(row, "catagory-5", "category5"),
            "rec_qty": rec_qty, "gr_amt": _number(_column(row, "gr amt", "gramt")), "net_amt": _number(_column(row, "net amt", "netamt")),
            "stockpoint": _column(row, "stockpoint"),
            "errors": errors,
        })
    return parsed


@router.post("/purchase/preview")
async def preview_purchase(file: UploadFile = File(...), ctx: TenantCtx = Depends(_citimart_context)):
    rows = _parse_purchase_rows(_read_rows(file.filename or "", await file.read()))
    invalid = sum(1 for r in rows if r["errors"])
    return {
        "status": "success", "mode": "preview_only",
        "summary": {"row_count": len(rows), "valid_count": len(rows) - invalid, "invalid_count": invalid},
        "rows": rows[:PREVIEW_ROWS], "truncated": len(rows) > PREVIEW_ROWS,
    }


@router.post("/purchase/commit")
async def commit_purchase(file: UploadFile = File(...), ctx: TenantCtx = Depends(_citimart_context)):
    rows = _parse_purchase_rows(_read_rows(file.filename or "", await file.read()))
    now = datetime.utcnow()
    docs, skipped = [], []
    for row in rows:
        if row["errors"]:
            skipped.append({"row_no": row["row_no"], "errors": row["errors"]})
            continue
        docs.append({"tenant_id": ctx["tenant_id"], **row, "imported_at": now})
    if docs:
        await citimart_purchase_import_collection.insert_many(docs, ordered=False)
    batch_id = await _log_batch(ctx["tenant_id"], "purchase", len(docs), ctx.get("admin_name") or ctx.get("admin_email") or "")
    return {
        "status": "success", "mode": "committed", "batch_id": batch_id,
        "saved": len(docs), "rows_skipped": len(skipped), "skipped_rows": skipped[:200],
        "message": f"{len(docs)} purchase/GRC row(s) imported" + (f", {len(skipped)} skipped" if skipped else "") + ".",
    }


@router.get("/imports")
async def list_imports(ctx: TenantCtx = Depends(_citimart_context)):
    rows = []
    async for row in citimart_data_hub_imports_collection.find({"tenant_id": ctx["tenant_id"]}).sort("imported_at", -1).limit(200):
        rows.append({
            "batch_id": row["batch_id"], "kind": row["kind"], "row_count": row["row_count"],
            "imported_by": row.get("imported_by", ""), "imported_at": row["imported_at"].isoformat(),
            "live_sync_status": row.get("live_sync_status", "NOT_SYNCED" if row.get("kind") == "stock" else "ANALYTICS_ONLY"),
            "synced_at": row.get("synced_at").isoformat() if row.get("synced_at") else None,
            "snapshot_mode": row.get("snapshot_mode"), "reconciliation_status": row.get("reconciliation_status"),
        })
    return {"status": "success", "data": rows}


# ── Purchase Plan (forecasting) ──────────────────────────────────────────
# Reads ONLY the three isolated import collections above — current stock
# (latest snapshot per store), real sell-through (sales import, void rows
# already excluded at commit), and what's already on order (purchase
# import's own-vendor rows aren't "incoming" by themselves, so this treats
# every purchase row simply as import history for now; "already on order"
# would need a live Purchase Order feed, which this module deliberately
# does not touch).
@router.get("/purchase-plan")
async def purchase_plan(
    days: int = 30, include_vendor: bool = False,
    division: str = "", section: str = "", department: str = "", design_no: str = "", size: str = "", vendor_name: str = "",
    ctx: TenantCtx = Depends(_citimart_context),
):
    """Reorder suggestions from imported sell-through vs stock. Once a stock
    batch has been synced (see /stock/{batch_id}/sync above), current_stock
    switches automatically to the real, live store_stock/inventory figure for
    any item whose product now exists in the live catalogue -- so the plan
    reflects POS sales and transfers since the import, not a frozen snapshot.
    Items never synced keep using the import snapshot, clearly marked."""
    tenant_id = ctx["tenant_id"]
    days = max(1, min(365, days))
    cutoff = (datetime.utcnow().date() - pd.Timedelta(days=days)).isoformat()

    PROMO_TOLERANCE = 0.5

    def _first(existing: str, candidate: str) -> str:
        return existing or (candidate or "").strip()

    sales_by_item: Dict[str, dict] = {}
    async for row in citimart_sales_import_collection.find({"tenant_id": tenant_id, "bill_date": {"$gte": cutoff}}):
        key = row.get("barcode") or row.get("item_code")
        if not key:
            continue
        bucket = sales_by_item.setdefault(key, {
            "barcode": row.get("barcode"), "item_code": row.get("item_code"), "design_no": "",
            "division": "", "section": "", "department": "", "brand": "", "style": "", "size": "", "vendor": "",
            "qty_sold": 0.0, "net_amt": 0.0, "full_qty": 0.0, "promo_qty": 0.0,
        })
        qty = row.get("bill_qty", 0.0) or 0.0
        gross = row.get("gr_amt", 0.0) or 0.0
        net = row.get("net_amt", 0.0) or 0.0
        discount = max(0.0, gross - net) if gross > 0 else 0.0
        bucket["qty_sold"] += qty
        bucket["net_amt"] += net
        if discount > PROMO_TOLERANCE:
            bucket["promo_qty"] += qty
        else:
            bucket["full_qty"] += qty
        bucket["design_no"] = _first(bucket["design_no"], row.get("design_no"))
        bucket["division"] = _first(bucket["division"], row.get("division"))
        bucket["section"] = _first(bucket["section"], row.get("section"))
        bucket["department"] = _first(bucket["department"], row.get("department"))
        bucket["brand"] = _first(bucket["brand"], row.get("brand"))
        bucket["style"] = _first(bucket["style"], row.get("style"))
        bucket["size"] = _first(bucket["size"], row.get("size"))
        bucket["vendor"] = _first(bucket["vendor"], row.get("vendor"))

    # Stock import rows carry division/section/department/vendor too -- fills
    # gaps for an item that has stock history but no sales yet in this window.
    stock_by_item: Dict[str, float] = {}
    async for row in citimart_stock_snapshot_collection.find({"tenant_id": tenant_id}):
        key = row.get("barcode") or row.get("item_code")
        if not key:
            continue
        stock_by_item[key] = stock_by_item.get(key, 0.0) + row.get("closing_qty", 0.0)
        bucket = sales_by_item.get(key)
        if bucket:
            bucket["division"] = _first(bucket["division"], row.get("division"))
            bucket["section"] = _first(bucket["section"], row.get("section"))
            bucket["department"] = _first(bucket["department"], row.get("department"))
            bucket["vendor"] = _first(bucket["vendor"], row.get("vendor"))

    # Live stock, once synced: only for barcodes with a real product record --
    # the same gate /stock/{batch_id}/sync itself requires before writing.
    barcodes = [bucket["barcode"] for bucket in sales_by_item.values() if bucket["barcode"]]
    synced_products = {}
    if barcodes:
        async for p in product_collection.find({"tenant_id": tenant_id, "barcode": {"$in": barcodes}}, {"barcode": 1}):
            synced_products[p["barcode"]] = True
    live_stock_by_barcode: Dict[str, float] = {}
    if synced_products:
        async for row in store_stock_collection.find({"tenant_id": tenant_id, "barcode": {"$in": list(synced_products)}}, {"barcode": 1, "stockQty": 1}):
            live_stock_by_barcode[row["barcode"]] = live_stock_by_barcode.get(row["barcode"], 0.0) + _number(row.get("stockQty"))
        async for row in inventory_collection.find({"tenant_id": tenant_id, "barcode": {"$in": list(synced_products)}}, {"barcode": 1, "stockQty": 1}):
            live_stock_by_barcode[row["barcode"]] = live_stock_by_barcode.get(row["barcode"], 0.0) + _number(row.get("stockQty"))

    def _match(value: str, wanted: str) -> bool:
        return not wanted or _key(value) == _key(wanted)

    rows = []
    for key, bucket in sales_by_item.items():
        if not (_match(bucket["division"], division) and _match(bucket["section"], section)
                and _match(bucket["department"], department) and _match(bucket["design_no"], design_no)
                and _match(bucket["size"], size) and _match(bucket["vendor"], vendor_name)):
            continue
        has_live = bucket["barcode"] in live_stock_by_barcode
        current_stock = live_stock_by_barcode[bucket["barcode"]] if has_live else stock_by_item.get(key, 0.0)
        daily_rate = bucket["qty_sold"] / days
        stock_cover_days = round(current_stock / daily_rate, 1) if daily_rate > 0 else None
        # Target: enough stock for the SAME look-back window as the sales
        # figure itself -- a simple, transparent reorder-to-cover-days rule,
        # not a hidden model. Always sense-check before actually ordering.
        suggested_qty = max(0.0, round(daily_rate * days - current_stock, 1))
        promo_total = bucket["full_qty"] + bucket["promo_qty"]
        promo_share_pct = round(bucket["promo_qty"] / promo_total * 100, 1) if promo_total > 0 else None
        rows.append({
            "barcode": bucket["barcode"], "item_code": bucket["item_code"], "design_no": bucket["design_no"],
            "division": bucket["division"], "section": bucket["section"], "department": bucket["department"],
            "brand": bucket["brand"], "style": bucket["style"], "size": bucket["size"],
            "qty_sold": round(bucket["qty_sold"], 2), "net_amt": round(bucket["net_amt"], 2),
            "full_price_qty": round(bucket["full_qty"], 2), "promo_qty": round(bucket["promo_qty"], 2), "promo_share_pct": promo_share_pct,
            "current_stock": round(current_stock, 2), "stock_source": "live" if has_live else "import_snapshot",
            "daily_sell_rate": round(daily_rate, 3), "stock_cover_days": stock_cover_days, "suggested_purchase_qty": suggested_qty,
            "vendor": bucket["vendor"] or None,
        })
    rows.sort(key=lambda r: -r["suggested_purchase_qty"])

    # Optional add-on, off by default: once purchase history has named a
    # vendor for an item, and that vendor has been onboarded (see
    # /vendors/review + /vendors/onboard above), show who to order from and
    # whether they are Approved yet. Ranked by FULL-PRICE units, same rule as
    # Vendor Sales Ranking -- a vendor that only sells well on promotion is
    # never counted as a strong vendor from this alone.
    vendor_summary = []
    if include_vendor and rows:
        wanted_names = {r["vendor"] for r in rows if r["vendor"]}
        vendor_docs = await vendors_collection.find({"name": {"$in": list(wanted_names)}}, {"name": 1}).to_list(length=None) if wanted_names else []
        vendor_id_by_name = {v["name"]: v["_id"] for v in vendor_docs}
        links = await vendor_tenant_links_collection.find(
            {"tenant_id": tenant_id, "vendor_id": {"$in": list(vendor_id_by_name.values())}}, {"vendor_id": 1, "status": 1}
        ).to_list(length=None) if vendor_id_by_name else []
        status_by_vendor_id = {str(link["vendor_id"]): link.get("status") for link in links}

        by_vendor: Dict[str, dict] = {}
        for r in rows:
            if not r["vendor"]:
                continue
            entry = by_vendor.setdefault(r["vendor"], {
                "vendor_name": r["vendor"], "full_price_qty": 0.0, "promo_qty": 0.0,
                "items_count": 0, "suggested_purchase_qty_total": 0.0,
            })
            entry["full_price_qty"] += r["full_price_qty"]
            entry["promo_qty"] += r["promo_qty"]
            entry["items_count"] += 1
            entry["suggested_purchase_qty_total"] += r["suggested_purchase_qty"]
        for r in rows:
            if not r["vendor"]:
                continue
            vendor_id = vendor_id_by_name.get(r["vendor"])
            r["vendor"] = {
                "vendor_name": r["vendor"],
                "onboarded": vendor_id is not None,
                "status": status_by_vendor_id.get(str(vendor_id)) if vendor_id else None,
            }
        MIN_UNITS_FOR_GRADE = 5

        def _grade(full_qty: float, promo_qty: float):
            total = full_qty + promo_qty
            if total < MIN_UNITS_FOR_GRADE:
                return None, "Not enough sales history yet to grade this vendor."
            promo_pct = promo_qty / total * 100
            if promo_pct <= 20:
                return "A", "Mostly full-price sales."
            if promo_pct <= 50:
                return "B", "A meaningful share of sales were on promotion."
            return "C", "Most sales were on promotion — treat the volume as discount-driven, not demand."

        grade_by_vendor: Dict[str, tuple] = {}
        for name, entry in by_vendor.items():
            total = entry["full_price_qty"] + entry["promo_qty"]
            vendor_id = vendor_id_by_name.get(name)
            grade, grade_reason = _grade(entry["full_price_qty"], entry["promo_qty"])
            grade_by_vendor[name] = (grade, grade_reason)
            vendor_summary.append({
                **entry, "suggested_purchase_qty_total": round(entry["suggested_purchase_qty_total"], 1),
                "promo_share_pct": round(entry["promo_qty"] / total * 100, 1) if total > 0 else None,
                "onboarded": vendor_id is not None, "status": status_by_vendor_id.get(str(vendor_id)) if vendor_id else None,
                "grade": grade, "grade_reason": grade_reason,
            })
        vendor_summary.sort(key=lambda v: (v["grade"] or "Z", -v["full_price_qty"]))
        for r in rows:
            if r["vendor"]:
                g = grade_by_vendor.get(r["vendor"]["vendor_name"])
                if g:
                    r["vendor"]["grade"], r["vendor"]["grade_reason"] = g
    elif rows:
        for r in rows:
            r["vendor"] = None

    return {
        "status": "success",
        "data": {
            "days": days, "items": rows, "vendor_info_included": include_vendor, "vendor_summary": vendor_summary,
            "note": None if rows else "No sales imported in this window yet -- import a Sales sheet first.",
        },
    }


# ── VENDOR ONBOARDING — from imported purchase history (opt-in, Pending only) ──
# Mirrors the staged-review-then-explicit-action shape the stock sync bridge
# above uses: this never auto-approves a vendor into live purchasing. It only
# creates a Pending vendor_tenant_links row, the exact same state a vendor
# reaches by self-registering — so every existing approval/KYB/PO gate still
# applies untouched. A vendor record created here has no email/password yet,
# so it cannot log in until someone invites it properly; it exists purely as
# a record of "this vendor appears in our purchase history."
def _normalize_vendor_name(value: Any) -> str:
    return " ".join(str(value or "").strip().split()).lower()


@router.get("/vendors/review")
async def review_import_vendors(ctx: TenantCtx = Depends(_citimart_context)):
    tenant_id = ctx["tenant_id"]
    names: Dict[str, dict] = {}
    cursor = citimart_purchase_import_collection.find(
        {"tenant_id": tenant_id, "vendor": {"$nin": [None, ""]}}, {"vendor": 1}
    )
    async for row in cursor:
        raw = str(row.get("vendor") or "").strip()
        if not raw:
            continue
        key = _normalize_vendor_name(raw)
        entry = names.setdefault(key, {"vendor_name": raw, "purchase_rows": 0})
        entry["purchase_rows"] += 1

    if not names:
        return {"status": "success", "count": 0, "data": []}

    existing_vendors = await vendors_collection.find(
        {"name": {"$in": [v["vendor_name"] for v in names.values()]}}, {"name": 1}
    ).to_list(length=None)
    existing_by_key = {_normalize_vendor_name(v.get("name")): str(v["_id"]) for v in existing_vendors}
    existing_ids = [ObjectId(v) for v in existing_by_key.values()]
    links = await vendor_tenant_links_collection.find(
        {"tenant_id": tenant_id, "vendor_id": {"$in": existing_ids}}, {"vendor_id": 1, "status": 1}
    ).to_list(length=None) if existing_ids else []
    link_status_by_vendor = {str(link["vendor_id"]): link.get("status", "Pending") for link in links}

    rows = []
    for key, entry in names.items():
        vendor_id = existing_by_key.get(key)
        rows.append({
            "vendor_name": entry["vendor_name"],
            "purchase_rows": entry["purchase_rows"],
            "existing_vendor_id": vendor_id,
            "relationship_status": link_status_by_vendor.get(vendor_id) if vendor_id else None,
            "suggested_action": (
                "already_linked" if vendor_id and link_status_by_vendor.get(vendor_id) in {"Pending", "Approved"}
                else "link_existing" if vendor_id
                else "create_pending"
            ),
        })
    rows.sort(key=lambda r: r["vendor_name"].lower())
    return {"status": "success", "count": len(rows), "data": rows}


@router.post("/vendors/onboard")
async def onboard_import_vendors(payload: dict, ctx: TenantCtx = Depends(_citimart_context)):
    tenant_id = ctx["tenant_id"]
    requested = payload.get("vendor_names")
    if not isinstance(requested, list) or not requested:
        raise HTTPException(status_code=400, detail="vendor_names must be a non-empty list.")
    requested_names = [str(v).strip() for v in requested if str(v or "").strip()]
    if not requested_names:
        raise HTTPException(status_code=400, detail="vendor_names must be a non-empty list.")

    now = datetime.utcnow()
    by = ctx.get("admin_name") or ctx.get("admin_email") or ""
    created_vendors, linked_existing, already_linked, skipped = [], [], [], []

    for name in requested_names:
        existing = await vendors_collection.find_one({"name": name})
        if not existing:
            result = await vendors_collection.insert_one({
                "name": name, "email": "", "password": None, "password_set": False,
                "business_type": [], "brandName": "", "brandNames": [],
                "source": "citimart_data_hub_import", "created_at": now,
            })
            vendor_id = result.inserted_id
            created_vendors.append(name)
        else:
            vendor_id = existing["_id"]

        link = await vendor_tenant_links_collection.find_one({"tenant_id": tenant_id, "vendor_id": vendor_id})
        if link:
            if link.get("status") in {"Pending", "Approved"}:
                already_linked.append(name)
                continue
            skipped.append({"vendor_name": name, "reason": f"Existing relationship is '{link.get('status')}'."})
            continue

        await vendor_tenant_links_collection.insert_one({
            "vendor_id": vendor_id, "tenant_id": tenant_id,
            "product_type": "", "division": None, "section": None, "department": None,
            "status": "Pending", "source": "citimart_data_hub_import",
            "requested_plan": None, "created_at": now, "onboarded_by": by,
        })
        if name not in created_vendors:
            linked_existing.append(name)

    return {
        "status": "success",
        "created_vendors": created_vendors, "linked_existing_vendors": linked_existing,
        "already_linked": already_linked, "skipped": skipped,
        "message": (
            f"{len(created_vendors) + len(linked_existing)} vendor(s) added as Pending — "
            "they still need the normal Approve step before they can receive orders."
        ),
    }


# ── PRODUCT MAPPING — create a Citimart product straight from an unmatched
# staged row. This is the only remaining gap in product mapping: the
# resolver above can only LINK to a product that already exists; rows whose
# barcode/item code matches nothing simply block sync as a "problem" with no
# path forward other than already having a matching Product Master record.
# This closes that gap, opt-in and per-row, using exactly the attributes the
# imported sheet carried (division/section/department/vendor/rates) —
# nothing invented. The staged row's own barcode is kept as-is (not
# regenerated) so the resolver immediately matches it afterward.
@router.post("/stock/{batch_id}/create-products")
async def create_products_from_stock_batch(batch_id: str, payload: dict, ctx: TenantCtx = Depends(_citimart_context)):
    _require_live_sync_permission(ctx)
    tenant_id = ctx["tenant_id"]
    barcodes = payload.get("barcodes")
    if not isinstance(barcodes, list) or not barcodes:
        raise HTTPException(status_code=400, detail="barcodes must be a non-empty list.")
    batch = await citimart_data_hub_imports_collection.find_one({"tenant_id": tenant_id, "batch_id": batch_id, "kind": "stock"})
    if not batch:
        raise HTTPException(status_code=404, detail="Stock import batch not found.")

    wanted = {_identity_key(b) for b in barcodes}
    rows = await citimart_stock_stage_rows_collection.find({"tenant_id": tenant_id, "batch_id": batch_id}).to_list(length=MAX_ROWS + 1)
    by_key: Dict[str, dict] = {}
    for row in rows:
        key = _identity_key(row.get("barcode") or row.get("item_code"))
        if key in wanted and key not in by_key:
            by_key[key] = row
    missing = wanted - set(by_key)
    if missing:
        raise HTTPException(status_code=400, detail=f"{len(missing)} barcode(s)/item code(s) not found among this batch's staged rows.")

    now = datetime.utcnow()
    by = ctx.get("admin_name") or ctx.get("admin_email") or ""
    created, already_existed = [], []
    for row in by_key.values():
        barcode = (row.get("barcode") or row.get("item_code") or "").strip()
        if not barcode:
            continue
        existing = await product_collection.find_one({"tenant_id": tenant_id, "barcode": barcode})
        if existing:
            already_existed.append(barcode)
            continue
        name = " ".join(filter(None, [row.get("category1"), row.get("category2"), row.get("department")])) or barcode
        sku = await generate_base_sku(row.get("division") or "GEN", name, tenant_id)
        mrp = _number(row.get("mrp"))
        selling_price = _number(row.get("rsp")) or mrp
        doc = {
            "tenant_id": tenant_id, "product_name": name, "product_type": "general",
            "sku": sku, "barcode": barcode,
            "division": row.get("division", ""), "section": row.get("section", ""), "department": row.get("department", ""),
            "vendor_name": row.get("vendor", ""), "hsn_code": row.get("hsn_code", ""),
            "cost_price": _number(row.get("standard_rate")), "mrp": mrp, "selling_price": selling_price,
            "quantity": 0, "unit": row.get("uom") or "pcs", "description": "", "specification": "",
            "has_variants": False, "variant_type": "none", "variants": [], "images": [],
            "source": "citimart_data_hub_import", "import_batch_id": batch_id,
            "created_at": now, "created_by": by,
        }
        await product_collection.insert_one(doc)
        created.append(barcode)

    resolution = await _resolve_stock_batch(tenant_id, batch_id)
    return {
        "status": "success", "created_count": len(created), "created_barcodes": created,
        "already_existed": already_existed,
        "resolved_count": len(resolution["rows"]), "problem_count": len(resolution["problems"]),
        "message": f"{len(created)} product(s) created." + (f" {len(already_existed)} already existed." if already_existed else ""),
    }


# ── STORE-WISE INVENTORY -- read-only, searchable ───────────────────────────
# Built from the same isolated citimart_stock_snapshot used everywhere else
# in this file. Where a product has been synced to live (see
# /stock/{batch_id}/sync above), the quantity and value shown here switch to
# the real, live store_stock/inventory figure for that store -- same rule
# the Purchase Plan already follows -- so this never shows two different
# "truths" for the same item depending on which screen you are on.
@router.get("/inventory")
async def store_inventory(
    q: str = "", store: str = "", division: str = "", section: str = "", department: str = "", vendor: str = "",
    ctx: TenantCtx = Depends(_citimart_context),
):
    tenant_id = ctx["tenant_id"]
    snapshot_rows = await citimart_stock_snapshot_collection.find({"tenant_id": tenant_id}).to_list(length=MAX_ROWS)

    barcodes = list({(r.get("barcode") or r.get("item_code") or "").strip() for r in snapshot_rows if (r.get("barcode") or r.get("item_code"))})
    synced_barcodes = set()
    if barcodes:
        async for p in product_collection.find({"tenant_id": tenant_id, "barcode": {"$in": barcodes}}, {"barcode": 1}):
            synced_barcodes.add(p["barcode"])

    stores_live = await stores_collection.find({"tenant_id": tenant_id, "active": True}).to_list(length=None)
    location_lookup = _build_location_lookup(stores_live)

    live_qty_by_key: Dict[tuple, float] = {}
    if synced_barcodes:
        async for row in store_stock_collection.find(
            {"tenant_id": tenant_id, "barcode": {"$in": list(synced_barcodes)}}, {"barcode": 1, "store_id": 1, "stockQty": 1}
        ):
            key = (row.get("store_id"), row["barcode"])
            live_qty_by_key[key] = live_qty_by_key.get(key, 0.0) + _number(row.get("stockQty"))

    items = []
    for row in snapshot_rows:
        barcode = (row.get("barcode") or row.get("item_code") or "").strip()
        if not barcode:
            continue
        location, _errors = _resolve_location(row.get("store_name"), location_lookup)
        store_id = location["store_id"] if location else None
        live_key = (store_id, barcode)
        has_live = barcode in synced_barcodes and live_key in live_qty_by_key
        qty = live_qty_by_key[live_key] if has_live else _number(row.get("closing_qty"))
        rate = _number(row.get("rsp")) or _number(row.get("mrp")) or _number(row.get("standard_rate"))
        value = qty * rate if rate else _number(row.get("closing_amt"))
        items.append({
            "store_name": row.get("store_name") or "Unknown store", "barcode": row.get("barcode"), "item_code": row.get("item_code"),
            "division": row.get("division"), "section": row.get("section"), "department": row.get("department"),
            "vendor": row.get("vendor"), "category1": row.get("category1"), "uom": row.get("uom"),
            "qty": round(qty, 2), "rate": round(rate, 2), "value": round(value, 2),
            "stock_source": "live" if has_live else "import_snapshot",
        })

    summary: Dict[str, dict] = {}
    for item in items:
        bucket = summary.setdefault(item["store_name"], {"store_name": item["store_name"], "item_count": 0, "total_qty": 0.0, "total_value": 0.0})
        bucket["item_count"] += 1
        bucket["total_qty"] += item["qty"]
        bucket["total_value"] += item["value"]
    stores_summary = sorted(
        [{**s, "total_qty": round(s["total_qty"], 2), "total_value": round(s["total_value"], 2)} for s in summary.values()],
        key=lambda s: -s["total_value"],
    )

    facets = {
        "divisions": sorted({i["division"] for i in items if i["division"]}),
        "sections": sorted({i["section"] for i in items if i["section"]}),
        "departments": sorted({i["department"] for i in items if i["department"]}),
        "vendors": sorted({i["vendor"] for i in items if i["vendor"]}),
    }

    def _exact(value: str, wanted: str) -> bool:
        return not wanted or _key(value) == _key(wanted)

    filtered = [
        i for i in items
        if _exact(i["store_name"], store) and _exact(i["division"], division)
        and _exact(i["section"], section) and _exact(i["department"], department) and _exact(i["vendor"], vendor)
    ]
    if q:
        wanted = _key(q)
        filtered = [
            i for i in filtered
            if wanted in _key(" ".join(str(i.get(k) or "") for k in ("barcode", "item_code", "category1", "division", "section", "department", "vendor")))
        ]
    filtered = sorted(filtered, key=lambda i: -i["value"])
    truncated = len(filtered) > 500

    return {
        "status": "success",
        "data": {
            "stores": stores_summary, "items": filtered[:500], "item_count": len(filtered), "truncated": truncated,
            "facets": facets,
            "total_value": round(sum(s["total_value"] for s in stores_summary), 2),
            "total_qty": round(sum(s["total_qty"] for s in stores_summary), 2),
            "note": None if items else "No stock imported yet -- import a Stock sheet first.",
        },
    }
