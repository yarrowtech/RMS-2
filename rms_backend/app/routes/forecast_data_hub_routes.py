"""Raphaa pilot: Sales & Stock Data Hub — spreadsheet import into RMS.

Two spreadsheet exports, previewed then committed:

  * SALES  (has Barcode + Item Code + category columns)
      -> sales            (type="sale") historical bills for Forecast & Analytics
      -> products         auto-created for any barcode not in the catalogue yet
                          (name/category/rates taken from the sales row), so the
                          rest of RMS shows real names, not bare barcodes.
      NO stock movement, NO finance / GST voucher, NO POS / cashier flow.

  * STOCK  (physical count — NO barcode, product identified by
      DIVISION|SECTION|DEPARTMENT|VENDOR|CATEGORY1-5; CATEGORY6 = Ageing, ignored)
      -> inventory        WAREHOUSE column  = Raphaa HQ / central on-hand
      -> store_stock       one column per store
      Each row is resolved to a barcode through the products the sales import
      created (their category attributes ARE the map). Rows that collapse to the
      same product+location (different Ageing) are summed. Absolute snapshot:
      $set stockQty, never $inc. Items absent from the file are left untouched.

Isolation (enforced by _pilot_context on every route):
  * 404 for any tenant whose id does not start with "raphaa"
  * 403 without the "Forecast & Analytics" department / permission
  * 403 for any store-scoped admin (HQ scope required)
  * every read and every write is filtered by ctx["tenant_id"]
  * no helper shared with another route is imported-from or modified here
  * each committed run is tagged (source="data_hub_import", data_hub_batch_id)
    and logged to data_hub_imports so it can be listed and rolled back exactly.
"""
import io
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse

from .deps import get_hq_tenant
from ..db import (
    data_hub_imports_collection,
    inventory_collection,
    product_collection,
    sales_collection,
    store_stock_collection,
    stores_collection,
)

router = APIRouter(prefix="/api/forecast-analytics/data-hub", tags=["Forecast Data Hub"])
TenantCtx = Dict[str, Any]
MAX_ROWS = 20_000
PREVIEW_ROWS = 500
CENTRAL_LABEL = "Central Warehouse / HQ"

# Column aliases — every list is matched with _key() (case / space / punctuation
# insensitive), so "Cat-1 (Design No.)" and "CATEGORY1" resolve to the same field.
CAT_ALIASES = {
    "cat1": ["category1", "cat-1 (design no.)", "cat1", "cat 1", "design no", "design no."],
    "cat2": ["category2", "cat-2 (brand)", "cat2", "cat 2", "brand"],
    "cat3": ["category3", "cat-3 (style)", "cat3", "cat 3", "style"],
    "cat4": ["category4", "cat-4 (plane, f/s, h/s)", "cat4", "cat 4"],
    "cat5": ["category5", "cat-5 (size)", "cat5", "cat 5", "size"],
}


def _key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").strip().lower())


def _text(value: Any) -> str:
    return str(value or "").strip()


def _number(value: Any) -> Optional[float]:
    text = _text(value).replace(",", "")
    if not text:
        return 0.0
    try:
        return float(text)
    except ValueError:
        return None


def _truthy(value: Any) -> bool:
    return _key(value) in {"1", "true", "yes", "y"}


def _pilot_enabled(tenant_id: str) -> bool:
    # Pilot is intentionally isolated to Raphaa until its import workflow has
    # been reconciled against real data. Other retailers keep the exact
    # Forecast & Analytics workspace they already had.
    return _key(tenant_id).startswith("raphaa")


async def _forecast_context(ctx: TenantCtx = Depends(get_hq_tenant)) -> TenantCtx:
    departments = set(ctx.get("_managed_departments") or [])
    permissions = set(ctx.get("_permissions") or [])
    if "Forecast & Analytics" not in departments and "forecast_analytics" not in permissions:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forecast & Analytics department access is required.")
    return ctx


async def _pilot_context(ctx: TenantCtx = Depends(_forecast_context)) -> TenantCtx:
    if not _pilot_enabled(ctx["tenant_id"]):
        raise HTTPException(status_code=404, detail="Sales & Stock Data Hub is currently enabled only for the Raphaa pilot tenant.")
    return ctx


def _read_rows(filename: str, content: bytes) -> List[dict]:
    name = (filename or "").lower()
    try:
        if name.endswith(".csv"):
            frame = pd.read_csv(io.BytesIO(content), dtype=str)
        elif name.endswith((".xlsx", ".xls")):
            frame = pd.read_excel(io.BytesIO(content), dtype=str)
        else:
            raise HTTPException(status_code=400, detail="Upload a CSV or Excel file (.csv, .xlsx, .xls).")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="The file could not be read. Download a template and keep the headers unchanged.")

    frame.columns = [_key(column) for column in frame.columns]
    frame = frame.where(pd.notnull(frame), "")
    if len(frame.index) == 0:
        raise HTTPException(status_code=400, detail="The uploaded file has no data rows.")
    if len(frame.index) > MAX_ROWS:
        raise HTTPException(status_code=400, detail=f"A maximum of {MAX_ROWS:,} rows is allowed per file.")
    return frame.to_dict(orient="records")


def _column(row: dict, *names: str) -> str:
    for name in names:
        value = row.get(_key(name))
        if _text(value):
            return _text(value)
    return ""


def _cat_key(division: str, section: str, department: str, vendor: str, cats: List[str]) -> str:
    """Normalised product-identity key. Empty when nothing meaningful is set."""
    parts = [division, section, department, vendor, *cats]
    if not any(_key(part) for part in parts):
        return ""
    return "|".join(_key(part) for part in parts)


def _row_cat_key(row: dict) -> str:
    return _cat_key(
        _column(row, "division"),
        _column(row, "section"),
        _column(row, "department", "dept"),
        _column(row, "vendor", "supplier"),
        [_column(row, *CAT_ALIASES[name]) for name in ("cat1", "cat2", "cat3", "cat4", "cat5")],
    )


def _row_cats(row: dict) -> List[str]:
    return [_column(row, *CAT_ALIASES[name]) for name in ("cat1", "cat2", "cat3", "cat4", "cat5")]


def _parse_dt(date_text: str, time_text: str = "") -> Optional[datetime]:
    """Bill Date (+ optional Bill Time) -> datetime. Drives the sale's
    `created_at`, which Forecast & Analytics buckets sales history by."""
    date_text = _text(date_text)
    if not date_text:
        return None
    combined = f"{date_text} {_text(time_text)}".strip()
    for candidate in (combined, date_text):
        try:
            parsed = pd.to_datetime(candidate, dayfirst=True, errors="raise")
            if pd.notnull(parsed):
                return parsed.to_pydatetime()
        except Exception:
            continue
    return None


async def _catalogue(tenant_id: str) -> tuple[dict, dict, dict, set]:
    """Indexes over the tenant's products:
        barcode_index[_key(barcode)] -> payload
        sku_index[_key(item_code)]   -> payload
        cat_index[cat_key]           -> payload   (category tuple -> product)
        ambiguous                    -> {cat_key, ...} that map to >1 barcode
    """
    barcode_index: dict = {}
    sku_index: dict = {}
    cat_index: dict = {}
    ambiguous: set = set()
    projection = {
        "barcode": 1, "sku": 1, "base_sku": 1, "product_name": 1, "description": 1, "variants": 1,
        "design_no": 1, "division": 1, "section": 1, "department": 1, "vendor_name": 1,
        "category1": 1, "category2": 1, "category3": 1, "category4": 1, "category5": 1,
        "cost_price": 1, "mrp": 1, "selling_price": 1,
    }
    async for product in product_collection.find({"tenant_id": tenant_id}, projection):
        payload = {
            "barcode": _text(product.get("barcode")),
            "sku": _text(product.get("sku") or product.get("base_sku")),
            "product_name": _text(product.get("product_name") or product.get("description")),
            "design_no": _text(product.get("design_no") or product.get("category1")),
            "division": _text(product.get("division")),
            "section": _text(product.get("section")),
            "department": _text(product.get("department")),
            "cost_price": float(product.get("cost_price") or 0),
            "mrp": float(product.get("mrp") or product.get("selling_price") or 0),
        }
        if payload["barcode"]:
            barcode_index[_key(payload["barcode"])] = payload
        if payload["sku"]:
            sku_index[_key(payload["sku"])] = payload
        for variant in product.get("variants") or []:
            v_barcode = _text(variant.get("barcode"))
            v_sku = _text(variant.get("sku"))
            v_payload = {**payload, "barcode": v_barcode or payload["barcode"], "sku": v_sku or payload["sku"]}
            if v_barcode:
                barcode_index[_key(v_barcode)] = v_payload
            if v_sku:
                sku_index[_key(v_sku)] = v_payload

        cats = [_text(product.get(f"category{n}")) for n in range(1, 6)]
        ck = _cat_key(payload["division"], payload["section"], payload["department"], _text(product.get("vendor_name")), cats)
        if ck and payload["barcode"]:
            if ck in cat_index and cat_index[ck]["barcode"] != payload["barcode"]:
                ambiguous.add(ck)
            else:
                cat_index[ck] = payload
    return barcode_index, sku_index, cat_index, ambiguous


async def _stores(tenant_id: str) -> List[dict]:
    rows = []
    async for store in stores_collection.find({"tenant_id": tenant_id, "active": {"$ne": False}}, {"name": 1, "code": 1}):
        name = _text(store.get("name"))
        aliases = {_key(name), _key(store.get("code"))}
        if "-" in name:
            aliases.add(_key(name.split("-", 1)[1]))
        rows.append({"id": str(store["_id"]), "name": name, "aliases": {alias for alias in aliases if alias}})
    return sorted(rows, key=lambda row: row["name"].lower())


def _match_store(value: str, stores: List[dict]) -> Optional[dict]:
    wanted = _key(value)
    if not wanted:
        return None
    for store in stores:
        if wanted in store["aliases"]:
            return store
    return None


def _match_product(row: dict, barcode_index: dict, sku_index: dict) -> Optional[dict]:
    barcode = _column(row, "barcode", "rms barcode")
    item_code = _column(row, "item code", "itemcode", "sku", "product code")
    return barcode_index.get(_key(barcode)) or sku_index.get(_key(item_code))


# ─────────────────────────────────────────────────────────────────────────────
# Shared row builders — preview and commit run the SAME validation.
# ─────────────────────────────────────────────────────────────────────────────

def _sales_rows(raw_rows: List[dict], barcode_index: dict, sku_index: dict, stores: List[dict]) -> List[dict]:
    rows: List[dict] = []
    seen: set = set()
    for index, raw in enumerate(raw_rows, start=2):
        errors: List[str] = []
        bill_date = _column(raw, "bill date", "date")
        bill_time = _column(raw, "bill time", "time")
        bill_no = _column(raw, "bill no", "bill number", "invoice no")
        raw_barcode = _column(raw, "barcode", "rms barcode")
        raw_item = _column(raw, "item code", "itemcode", "sku", "product code")
        product = _match_product(raw, barcode_index, sku_index)
        store = _match_store(_column(raw, "store", "store name"), stores)
        qty = _number(_column(raw, "bill qty", "qty", "quantity"))
        is_void = _truthy(_column(raw, "isvoid", "is void"))
        net_amt = _number(_column(raw, "net amt", "net amount", "taxable sale"))
        gross_amt = _number(_column(raw, "gr amt", "gross amt", "gross amount"))
        std_rate = _number(_column(raw, "std rate", "standard rate")) or 0.0
        rsp = _number(_column(raw, "rsp", "selling price")) or 0.0
        mrp = _number(_column(raw, "mrp")) or 0.0
        tax_rate = _number(_column(raw, "tax rate")) or 0.0
        parsed_dt = _parse_dt(bill_date, bill_time)
        cats = _row_cats(raw)

        will_create = product is None and bool(raw_barcode)

        if not bill_no:
            errors.append("Bill No. is required.")
        if not bill_date:
            errors.append("Bill Date is required.")
        elif parsed_dt is None:
            errors.append("Bill Date is not a valid date.")
        if not store:
            errors.append("Store does not match an active RMS store.")
        if not product and not raw_barcode:
            errors.append("Row has no Barcode — cannot match or create a product.")
        if qty is None or qty <= 0:
            errors.append("Bill Qty must be greater than zero.")
            qty = 0.0
        if net_amt is None:
            net_amt = 0.0
        if gross_amt is None:
            gross_amt = net_amt

        dedup_key = "|".join([_key(bill_no), _key(raw_barcode), _key(raw_item), _key(_column(raw, "store"))])
        if bill_no and dedup_key in seen:
            errors.append("Duplicate bill / item / store row within this file.")
        seen.add(dedup_key)

        barcode = product["barcode"] if product else raw_barcode
        name = product["product_name"] if product else (_column(raw, "description", "product") or barcode)

        rows.append({
            "row_no": index,
            "bill_date": bill_date,
            "bill_no": bill_no,
            "store": store["name"] if store else _column(raw, "store"),
            "barcode": barcode,
            "item_code": (product["sku"] if product else raw_item),
            "design_no": (product["design_no"] if product else cats[0]),
            "product": name,
            "bill_qty": qty,
            "net_amt": round(net_amt, 2),
            "gross_amt": round(gross_amt, 2),
            "new_product": will_create,
            "is_void": is_void,
            "errors": errors,
            "_store": store,
            "_product": product,
            "_dt": parsed_dt,
            "_std_rate": std_rate,
            "_rsp": rsp,
            "_mrp": mrp,
            "_tax_rate": tax_rate,
            "_cats": cats,
            "_division": _column(raw, "division"),
            "_section": _column(raw, "section"),
            "_department": _column(raw, "department", "dept"),
            "_vendor": _column(raw, "vendor", "supplier"),
        })
    return rows


def _stock_rows(raw_rows: List[dict], barcode_index: dict, sku_index: dict, cat_index: dict, ambiguous: set, stores: List[dict]):
    """Returns (rows, totals). Rows are aggregated by resolved barcode — every
    file row that collapses to the same product (e.g. different Ageing) is summed
    per location. Rows that can't be resolved are kept individually with errors."""
    location_columns = {"central": ["warehouse", "central", "central warehouse", "hq inventory"]}
    for store in stores:
        location_columns[store["id"]] = list(store["aliases"])
    label_for = {"central": CENTRAL_LABEL, **{store["id"]: store["name"] for store in stores}}
    store_by_label = {store["name"]: store for store in stores}
    all_labels = [CENTRAL_LABEL, *[store["name"] for store in stores]]

    agg: Dict[str, dict] = {}
    unresolved: List[dict] = []

    for index, raw in enumerate(raw_rows, start=2):
        row_errors: List[str] = []
        has_id_col = bool(_column(raw, "barcode", "rms barcode") or _column(raw, "item code", "itemcode", "sku", "product code"))
        product = _match_product(raw, barcode_index, sku_index)
        matched_via = "barcode"
        if not product and not has_id_col:
            ck = _row_cat_key(raw)
            product = cat_index.get(ck)
            matched_via = "category"
            if product and ck in ambiguous:
                row_errors.append("This category combination maps to more than one product; used the most common.")
            if not product:
                row_errors.append("No Barcode column, and this DIVISION/SECTION/DEPARTMENT/VENDOR/CAT1-5 combination was not found in imported sales.")
        elif not product:
            row_errors.append("Barcode / Item Code in this row does not match any product.")

        loc_qty: Dict[str, float] = {}
        for location_id, aliases in location_columns.items():
            value = ""
            for alias in aliases:
                if alias in raw:
                    value = raw.get(alias, "")
                    break
            qty = _number(value)
            if qty is None or qty < 0:
                row_errors.append(f"{'Warehouse' if location_id == 'central' else 'Store'} quantity must be zero or greater.")
                qty = 0.0
            loc_qty[label_for[location_id]] = qty

        if product:
            bucket = agg.setdefault(product["barcode"], {
                "product": product,
                "matched_via": matched_via,
                "allocation": {label: 0.0 for label in all_labels},
                "source_rows": [],
                "errors": [],
            })
            for label, qty in loc_qty.items():
                bucket["allocation"][label] += qty
            bucket["source_rows"].append(index)
            bucket["errors"].extend(row_errors)
        else:
            unresolved.append({
                "row_no": index,
                "barcode": _column(raw, "barcode"),
                "item_code": _column(raw, "item code", "sku"),
                "design_no": _column(raw, *CAT_ALIASES["cat1"]),
                "product": _column(raw, "description", "product") or _row_cat_key(raw),
                "allocation": {label: round(loc_qty.get(label, 0.0), 2) for label in all_labels},
                "grand_total": round(sum(loc_qty.values()), 2),
                "errors": row_errors,
                "_product": None,
            })

    totals = {label: 0.0 for label in all_labels}
    rows: List[dict] = []
    for barcode, bucket in agg.items():
        allocation = {label: round(value, 2) for label, value in bucket["allocation"].items()}
        for label, value in allocation.items():
            totals[label] += value
        rows.append({
            "row_no": bucket["source_rows"][0],
            "source_rows": bucket["source_rows"],
            "barcode": barcode,
            "item_code": bucket["product"]["sku"],
            "design_no": bucket["product"]["design_no"],
            "product": bucket["product"]["product_name"],
            "matched_via": bucket["matched_via"],
            "allocation": allocation,
            "grand_total": round(sum(allocation.values()), 2),
            "errors": list(dict.fromkeys(bucket["errors"])),
            "_product": bucket["product"],
        })
    for row in unresolved:
        for label, value in row["allocation"].items():
            totals[label] += value
    rows.extend(unresolved)
    return rows, {label: round(value, 2) for label, value in totals.items()}, store_by_label


def _summary(rows: List[dict]) -> dict:
    invalid = [row for row in rows if row["errors"]]
    return {"row_count": len(rows), "valid_count": len(rows) - len(invalid), "invalid_count": len(invalid)}


def _public(row: dict) -> dict:
    return {key: value for key, value in row.items() if not key.startswith("_")}


def _new_product_doc(tenant_id: str, batch_id: str, row: dict, now: datetime) -> dict:
    cats = row["_cats"]
    return {
        "product_name": row["product"],
        "division": row["_division"], "section": row["_section"], "department": row["_department"],
        "hsn_code": "", "gst_rate": 0.0, "cgst_rate": 0.0, "sgst_rate": 0.0, "igst_rate": 0.0,
        "sku": row["item_code"] or f"DH-{row['barcode']}",
        "barcode": row["barcode"],
        "design_no": cats[0],
        "category1": cats[0], "category2": cats[1], "category3": cats[2], "category4": cats[3], "category5": cats[4],
        "cost_price": row["_std_rate"],
        "mrp": row["_mrp"],
        "selling_price": row["_rsp"] or row["_mrp"] or row["_std_rate"],
        "quantity": 0, "unit": "pcs", "description": "", "specification": "",
        "has_variants": False, "variant_type": "none", "variants": [], "images": [],
        "vendor_id": None, "vendor_name": row["_vendor"],
        "created_at": now, "created_by": "DATA_HUB",
        "tenant_id": tenant_id,
        "source": "data_hub_import", "data_hub_batch_id": batch_id,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Status / template
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/status")
async def get_data_hub_status(ctx: TenantCtx = Depends(_forecast_context)):
    enabled = _pilot_enabled(ctx["tenant_id"])
    stores = await _stores(ctx["tenant_id"]) if enabled else []
    catalogue_size = 0
    if enabled:
        catalogue_size = await product_collection.count_documents({"tenant_id": ctx["tenant_id"]})
    return {
        "status": "success",
        "enabled": enabled,
        "mode": "preview_then_commit",
        "message": "Import the sales file first (it also builds the product catalogue), then the stock file. Finance, GST and POS flows are never touched.",
        "catalogue_size": catalogue_size,
        "locations": [{"id": "central", "name": CENTRAL_LABEL}, *[{"id": store["id"], "name": store["name"]} for store in stores]],
    }


@router.get("/template/{kind}")
async def download_template(kind: str, ctx: TenantCtx = Depends(_pilot_context)):
    stores = await _stores(ctx["tenant_id"])
    if kind == "sales":
        headers = ["Bill Date", "Bill Time", "Bill No.", "Store", "Barcode", "Item Code",
                   "Division", "Section", "Department", "Vendor",
                   "Cat-1 (Design No.)", "Cat-2 (Brand)", "Cat-3 (Style)", "Cat-4 (Plane, F/S, H/S)", "Cat-5 (Size)",
                   "Description", "Bill Qty", "Gr Amt", "Net Amt", "Tax Rate", "Std Rate", "RSP", "Mrp", "IsVoid"]
    elif kind == "stock":
        store_headers = [store["name"].split("-", 1)[-1].strip() or store["name"] for store in stores]
        headers = ["Division", "Section", "Department", "Vendor",
                   "Category1", "Category2", "Category3", "Category4", "Category5", "Category6",
                   "Standard_Rate", "RSP", "MRP", *store_headers, "WAREHOUSE", "Grand Total"]
    else:
        raise HTTPException(status_code=404, detail="Template type must be 'sales' or 'stock'.")
    body = ",".join(f'"{header}"' for header in headers) + "\n"
    return StreamingResponse(io.BytesIO(body.encode("utf-8")), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=raphaa-{kind}-template.csv"})


# ─────────────────────────────────────────────────────────────────────────────
# Preview — nothing is written
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/sales/preview")
async def preview_sales_history(file: UploadFile = File(...), ctx: TenantCtx = Depends(_pilot_context)):
    raw_rows = _read_rows(file.filename or "", await file.read())
    barcode_index, sku_index, _, _ = await _catalogue(ctx["tenant_id"])
    stores = await _stores(ctx["tenant_id"])
    rows = _sales_rows(raw_rows, barcode_index, sku_index, stores)
    clean = [row for row in rows if not row["errors"] and not row["is_void"]]
    bills = {row["bill_no"] for row in clean if row["bill_no"]}
    new_products = {row["barcode"] for row in clean if row["new_product"]}
    return {
        "status": "success",
        "mode": "preview_only",
        "import_type": "sales_history",
        "summary": {
            **_summary(rows),
            "bill_count": len(bills),
            "new_products": len(new_products),
            "void_rows": sum(1 for row in rows if row["is_void"]),
        },
        "rows": [_public(row) for row in rows[:PREVIEW_ROWS]],
        "truncated": len(rows) > PREVIEW_ROWS,
    }


@router.post("/stock/preview")
async def preview_stock_snapshot(file: UploadFile = File(...), ctx: TenantCtx = Depends(_pilot_context)):
    raw_rows = _read_rows(file.filename or "", await file.read())
    barcode_index, sku_index, cat_index, ambiguous = await _catalogue(ctx["tenant_id"])
    stores = await _stores(ctx["tenant_id"])
    rows, totals, _ = _stock_rows(raw_rows, barcode_index, sku_index, cat_index, ambiguous, stores)
    resolved_via_category = sum(1 for row in rows if row.get("matched_via") == "category")
    return {
        "status": "success",
        "mode": "preview_only",
        "import_type": "stock_snapshot",
        "summary": {
            **_summary(rows),
            "products_in_snapshot": sum(1 for row in rows if row.get("matched_via")),
            "resolved_via_category": resolved_via_category,
            "unresolved_rows": sum(1 for row in rows if row["errors"] and not row.get("matched_via")),
            "catalogue_size": len(barcode_index),
            "location_totals": totals,
        },
        "rows": [_public(row) for row in rows[:PREVIEW_ROWS]],
        "truncated": len(rows) > PREVIEW_ROWS,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Commit
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/sales/commit")
async def commit_sales_history(
    file: UploadFile = File(...),
    confirm: bool = Form(False),
    ctx: TenantCtx = Depends(_pilot_context),
):
    if not confirm:
        raise HTTPException(status_code=400, detail="Send confirm=true to write these historical sales into RMS.")

    tenant_id = ctx["tenant_id"]
    raw_rows = _read_rows(file.filename or "", await file.read())
    barcode_index, sku_index, _, _ = await _catalogue(tenant_id)
    stores = await _stores(tenant_id)
    rows = _sales_rows(raw_rows, barcode_index, sku_index, stores)

    batch_id = uuid.uuid4().hex
    now = datetime.utcnow()

    # 1. create catalogue entries for barcodes we've never seen.
    known = set(barcode_index.keys())
    created_products: List[str] = []
    new_docs: List[dict] = []
    for row in rows:
        if row["errors"] or row["is_void"] or not row["new_product"]:
            continue
        bkey = _key(row["barcode"])
        if bkey in known:
            continue
        known.add(bkey)
        new_docs.append(_new_product_doc(tenant_id, batch_id, row, now))
        created_products.append(row["barcode"])
    if new_docs:
        await product_collection.insert_many(new_docs, ordered=False)

    # 2. group clean, non-void rows into bills.
    bills: Dict[tuple, dict] = {}
    skipped: List[dict] = []
    for row in rows:
        if row["errors"]:
            skipped.append({"row_no": row["row_no"], "bill_no": row["bill_no"], "errors": row["errors"]})
            continue
        if row["is_void"]:
            skipped.append({"row_no": row["row_no"], "bill_no": row["bill_no"], "errors": ["Row marked IsVoid — not imported."]})
            continue
        store = row["_store"]
        key = (row["bill_no"], store["id"])
        bill = bills.setdefault(key, {
            "invoice_no": row["bill_no"], "store_id": store["id"], "store_name": store["name"],
            "created_at": row["_dt"], "items": [], "gross": 0.0, "net": 0.0,
        })
        if row["_dt"] and (bill["created_at"] is None or row["_dt"] < bill["created_at"]):
            bill["created_at"] = row["_dt"]
        product = row["_product"]
        qty = row["bill_qty"]
        bill["items"].append({
            "barcode": row["barcode"],
            "name": row["product"],
            "sku": row["item_code"],
            "division": product["division"] if product else row["_division"],
            "section": product["section"] if product else row["_section"],
            "department": product["department"] if product else row["_department"],
            "qty": qty,
            "price": round(row["net_amt"] / qty, 4) if qty else 0.0,
            "cost_price": row["_std_rate"] or (product["cost_price"] if product else 0.0),
            "mrp": row["_mrp"] or (product["mrp"] if product else 0.0),
            "gross_amount": row["gross_amt"],
            "net_amount": row["net_amt"],
            "tax_rate": row["_tax_rate"],
        })
        bill["gross"] += row["gross_amt"]
        bill["net"] += row["net_amt"]

    # 3. idempotency — never re-insert a bill number this tenant already imported.
    wanted = list({inv for inv, _ in bills.keys()})
    already: set = set()
    if wanted:
        async for doc in sales_collection.find(
            {"tenant_id": tenant_id, "source": "data_hub_import", "invoice_no": {"$in": wanted}},
            {"invoice_no": 1},
        ):
            already.add(doc.get("invoice_no"))

    docs: List[dict] = []
    duplicate_bills = 0
    for (invoice_no, _store_id), bill in bills.items():
        if invoice_no in already:
            duplicate_bills += 1
            continue
        if bill["created_at"] is None:
            skipped.append({"bill_no": invoice_no, "errors": ["Bill has no usable date — skipped."]})
            continue
        docs.append({
            "invoice_no": invoice_no, "type": "sale",
            "date": bill["created_at"].strftime("%Y-%m-%d %H:%M"), "created_at": bill["created_at"],
            "tenant_id": tenant_id, "store_id": bill["store_id"], "store_name": bill["store_name"],
            "items": bill["items"],
            "summary": {"total_sale": round(bill["gross"], 2), "taxable_amount": round(bill["net"], 2), "net_payable": round(bill["net"], 2)},
            "payment_method": "", "cashier_name": "", "customer_name": "",
            "sync_source": "excel_import", "source": "data_hub_import", "data_hub_batch_id": batch_id,
            "imported_at": now, "imported_by": ctx.get("admin_id"),
        })

    inserted = 0
    if docs:
        result = await sales_collection.insert_many(docs, ordered=False)
        inserted = len(result.inserted_ids)

    log = {
        "tenant_id": tenant_id, "kind": "sales", "batch_id": batch_id,
        "file_name": file.filename or "", "created_at": now,
        "created_by": ctx.get("admin_id"), "created_by_name": ctx.get("admin_name") or ctx.get("admin_email") or "",
        "bills_inserted": inserted,
        "line_items": sum(len(doc["items"]) for doc in docs),
        "products_created": created_products,
        "products_created_count": len(created_products),
        "duplicate_bills_skipped": duplicate_bills,
        "rows_skipped": len(skipped),
        "rolled_back": False,
    }
    await data_hub_imports_collection.insert_one(log)

    return {
        "status": "success", "mode": "committed", "import_type": "sales_history", "batch_id": batch_id,
        "bills_inserted": inserted, "line_items": log["line_items"],
        "products_created": len(created_products),
        "duplicate_bills_skipped": duplicate_bills, "rows_skipped": len(skipped),
        "skipped_rows": skipped[:PREVIEW_ROWS],
    }


@router.post("/stock/commit")
async def commit_stock_snapshot(
    file: UploadFile = File(...),
    confirm: bool = Form(False),
    ctx: TenantCtx = Depends(_pilot_context),
):
    if not confirm:
        raise HTTPException(status_code=400, detail="Send confirm=true to write this stock snapshot into RMS.")

    tenant_id = ctx["tenant_id"]
    raw_rows = _read_rows(file.filename or "", await file.read())
    barcode_index, sku_index, cat_index, ambiguous = await _catalogue(tenant_id)
    stores = await _stores(tenant_id)
    rows, totals, store_by_label = _stock_rows(raw_rows, barcode_index, sku_index, cat_index, ambiguous, stores)

    blocking = ("does not match any product", "was not found in imported sales", "must be zero or greater")
    batch_id = uuid.uuid4().hex
    now = datetime.utcnow()
    changes: List[dict] = []
    skipped: List[dict] = []
    applied = 0

    for row in rows:
        if row["_product"] is None or any(any(b in error for b in blocking) for error in row["errors"]):
            skipped.append({"row_no": row["row_no"], "product": row["product"], "errors": row["errors"]})
            continue
        barcode = row["_product"]["barcode"]
        description = row["_product"]["product_name"]
        for label, qty in row["allocation"].items():
            if label == CENTRAL_LABEL:
                collection = inventory_collection
                flt = {"tenant_id": tenant_id, "barcode": barcode}
                extra: Dict[str, Any] = {}
            else:
                store = store_by_label[label]
                collection = store_stock_collection
                flt = {"tenant_id": tenant_id, "barcode": barcode, "store_id": store["id"]}
                extra = {"store_id": store["id"], "store_name": store["name"]}

            existing = await collection.find_one(flt, {"stockQty": 1})
            previous_qty = float((existing or {}).get("stockQty") or 0)
            await collection.update_one(
                flt,
                {
                    "$set": {**flt, **extra, "stockQty": float(qty), "description": description,
                             "source": "data_hub_import", "data_hub_batch_id": batch_id, "updatedAt": now},
                    "$setOnInsert": {"createdAt": now},
                },
                upsert=True,
            )
            changes.append({
                "location": label, "store_id": extra.get("store_id"), "barcode": barcode,
                "previous_qty": previous_qty, "new_qty": float(qty), "existed": bool(existing),
            })
        applied += 1

    log = {
        "tenant_id": tenant_id, "kind": "stock", "batch_id": batch_id,
        "file_name": file.filename or "", "created_at": now,
        "created_by": ctx.get("admin_id"), "created_by_name": ctx.get("admin_name") or ctx.get("admin_email") or "",
        "rows_applied": applied, "rows_skipped": len(skipped),
        "location_totals": totals, "changes": changes, "rolled_back": False,
    }
    await data_hub_imports_collection.insert_one(log)

    return {
        "status": "success", "mode": "committed", "import_type": "stock_snapshot", "batch_id": batch_id,
        "rows_applied": applied, "rows_skipped": len(skipped), "locations_written": len(changes),
        "location_totals": totals, "skipped_rows": skipped[:PREVIEW_ROWS],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Import history + rollback
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/imports")
async def list_imports(ctx: TenantCtx = Depends(_pilot_context)):
    rows = []
    async for doc in data_hub_imports_collection.find({"tenant_id": ctx["tenant_id"]}).sort("created_at", -1).limit(100):
        rows.append({
            "batch_id": doc.get("batch_id"), "kind": doc.get("kind"),
            "file_name": doc.get("file_name", ""), "created_at": doc.get("created_at"),
            "created_by_name": doc.get("created_by_name", ""),
            "rows_applied": doc.get("rows_applied"),
            "bills_inserted": doc.get("bills_inserted"), "line_items": doc.get("line_items"),
            "products_created_count": doc.get("products_created_count", 0),
            "rows_skipped": doc.get("rows_skipped", 0),
            "duplicate_bills_skipped": doc.get("duplicate_bills_skipped", 0),
            "location_totals": doc.get("location_totals"),
            "rolled_back": doc.get("rolled_back", False), "rolled_back_at": doc.get("rolled_back_at"),
        })
    return {"status": "success", "imports": rows}


@router.post("/imports/{batch_id}/rollback")
async def rollback_import(batch_id: str, ctx: TenantCtx = Depends(_pilot_context)):
    tenant_id = ctx["tenant_id"]
    doc = await data_hub_imports_collection.find_one({"tenant_id": tenant_id, "batch_id": batch_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Import batch not found for this tenant.")
    if doc.get("rolled_back"):
        raise HTTPException(status_code=400, detail="This import has already been rolled back.")

    now = datetime.utcnow()
    reverted = 0
    products_removed = 0

    if doc["kind"] == "sales":
        result = await sales_collection.delete_many({"tenant_id": tenant_id, "data_hub_batch_id": batch_id})
        reverted = result.deleted_count
        # remove products this batch created — but only if no stock has since
        # been written against them.
        async for product in product_collection.find(
            {"tenant_id": tenant_id, "source": "data_hub_import", "data_hub_batch_id": batch_id},
            {"barcode": 1},
        ):
            barcode = product.get("barcode")
            has_stock = await inventory_collection.find_one({"tenant_id": tenant_id, "barcode": barcode, "stockQty": {"$gt": 0}}) \
                or await store_stock_collection.find_one({"tenant_id": tenant_id, "barcode": barcode, "stockQty": {"$gt": 0}})
            if not has_stock:
                await product_collection.delete_one({"_id": product["_id"]})
                products_removed += 1
    else:
        for change in doc.get("changes", []):
            if change["location"] == CENTRAL_LABEL:
                collection = inventory_collection
                flt = {"tenant_id": tenant_id, "barcode": change["barcode"], "data_hub_batch_id": batch_id}
            else:
                collection = store_stock_collection
                flt = {"tenant_id": tenant_id, "barcode": change["barcode"], "store_id": change["store_id"], "data_hub_batch_id": batch_id}
            if change["existed"]:
                updated = await collection.update_one(flt, {"$set": {"stockQty": change["previous_qty"], "source": "data_hub_rollback", "updatedAt": now}})
                reverted += updated.modified_count
            else:
                deleted = await collection.delete_one(flt)
                reverted += deleted.deleted_count

    await data_hub_imports_collection.update_one(
        {"_id": doc["_id"]},
        {"$set": {"rolled_back": True, "rolled_back_at": now, "rolled_back_by": ctx.get("admin_id"),
                  "rollback_touched": reverted, "rollback_products_removed": products_removed}},
    )
    return {"status": "success", "batch_id": batch_id, "kind": doc["kind"], "reverted": reverted, "products_removed": products_removed}
