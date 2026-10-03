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
  * data lands ONLY in citimart_stock_snapshot / citimart_sales_import /
    citimart_purchase_import — never in the live store_stock, sales or
    products collections that POS/billing/GRN/stock-transfer already read
    and write. A mistake in this importer cannot corrupt live operational
    data; the Purchase Plan report below only ever reads these three
    isolated collections back, never the live ones.
  * each committed batch is logged (citimart_data_hub_imports) with a
    batch_id, so a bad upload can be identified and rolled back.
"""
import io
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status

from .deps import get_hq_tenant
from ..db import (
    citimart_data_hub_imports_collection,
    citimart_purchase_import_collection,
    citimart_sales_import_collection,
    citimart_stock_snapshot_collection,
)

router = APIRouter(prefix="/api/citimart/data-hub", tags=["Citimart Data Hub"])
TenantCtx = Dict[str, Any]
MAX_ROWS = 20_000
PREVIEW_ROWS = 300


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


async def _log_batch(tenant_id: str, kind: str, row_count: int, by: str) -> str:
    batch_id = uuid.uuid4().hex[:12]
    await citimart_data_hub_imports_collection.insert_one({
        "tenant_id": tenant_id, "batch_id": batch_id, "kind": kind, "row_count": row_count,
        "imported_by": by, "imported_at": datetime.utcnow(),
    })
    return batch_id


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


@router.post("/stock/preview")
async def preview_stock(file: UploadFile = File(...), ctx: TenantCtx = Depends(_citimart_context)):
    rows = _parse_stock_rows(_read_rows(file.filename or "", await file.read()))
    invalid = sum(1 for r in rows if r["errors"])
    stores = sorted({r["store_name"] for r in rows if r["store_name"]})
    return {
        "status": "success", "mode": "preview_only",
        "summary": {"row_count": len(rows), "valid_count": len(rows) - invalid, "invalid_count": invalid, "stores": stores},
        "rows": rows[:PREVIEW_ROWS], "truncated": len(rows) > PREVIEW_ROWS,
    }


@router.post("/stock/commit")
async def commit_stock(file: UploadFile = File(...), ctx: TenantCtx = Depends(_citimart_context)):
    rows = _parse_stock_rows(_read_rows(file.filename or "", await file.read()))
    now = datetime.utcnow()
    saved, skipped = 0, []
    for row in rows:
        if row["errors"]:
            skipped.append({"row_no": row["row_no"], "errors": row["errors"]})
            continue
        key = {"tenant_id": ctx["tenant_id"], "store_name": row["store_name"], "barcode": row["barcode"] or row["item_code"]}
        await citimart_stock_snapshot_collection.update_one(key, {"$set": {**row, **key, "updated_at": now}}, upsert=True)
        saved += 1
    batch_id = await _log_batch(ctx["tenant_id"], "stock", saved, ctx.get("admin_name") or ctx.get("admin_email") or "")
    return {
        "status": "success", "mode": "committed", "batch_id": batch_id,
        "saved": saved, "rows_skipped": len(skipped), "skipped_rows": skipped[:200],
        "message": f"{saved} stock row(s) saved to the Citimart snapshot" + (f", {len(skipped)} skipped" if skipped else "") + ".",
    }


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
async def purchase_plan(days: int = 30, ctx: TenantCtx = Depends(_citimart_context)):
    days = max(1, min(365, days))
    cutoff = (datetime.utcnow().date() - pd.Timedelta(days=days)).isoformat()

    sales_by_item: Dict[str, dict] = {}
    async for row in citimart_sales_import_collection.find({"tenant_id": ctx["tenant_id"], "bill_date": {"$gte": cutoff}}):
        key = row.get("barcode") or row.get("item_code")
        if not key:
            continue
        bucket = sales_by_item.setdefault(key, {"barcode": row.get("barcode"), "item_code": row.get("item_code"), "design_no": row.get("design_no"), "qty_sold": 0.0, "net_amt": 0.0})
        bucket["qty_sold"] += row.get("bill_qty", 0.0)
        bucket["net_amt"] += row.get("net_amt", 0.0)

    stock_by_item: Dict[str, float] = {}
    async for row in citimart_stock_snapshot_collection.find({"tenant_id": ctx["tenant_id"]}):
        key = row.get("barcode") or row.get("item_code")
        if not key:
            continue
        stock_by_item[key] = stock_by_item.get(key, 0.0) + row.get("closing_qty", 0.0)

    rows = []
    for key, bucket in sales_by_item.items():
        current_stock = stock_by_item.get(key, 0.0)
        daily_rate = bucket["qty_sold"] / days
        stock_cover_days = round(current_stock / daily_rate, 1) if daily_rate > 0 else None
        # Target: enough stock for the SAME look-back window as the sales
        # figure itself — a simple, transparent reorder-to-cover-days rule,
        # not a hidden model. Always sense-check before actually ordering.
        suggested_qty = max(0.0, round(daily_rate * days - current_stock, 1))
        rows.append({
            "barcode": bucket["barcode"], "item_code": bucket["item_code"], "design_no": bucket["design_no"],
            "qty_sold": round(bucket["qty_sold"], 2), "net_amt": round(bucket["net_amt"], 2),
            "current_stock": round(current_stock, 2), "daily_sell_rate": round(daily_rate, 3),
            "stock_cover_days": stock_cover_days, "suggested_purchase_qty": suggested_qty,
        })
    rows.sort(key=lambda r: -r["suggested_purchase_qty"])
    return {
        "status": "success",
        "data": {"days": days, "items": rows, "note": None if rows else "No sales imported in this window yet — import a Sales sheet first."},
    }
