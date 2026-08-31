"""
inventory_import_routes.py
===========================
Bulk inventory migration — for a retailer moving an existing catalogue/stock
count into RMS from whatever they used before (a spreadsheet, another POS,
paper registers). Purely additive: a brand-new endpoint pair, touching no
existing route. Every write lands in the same product_collection /
store_stock_collection shape add_product() in products.py already writes,
so an imported item is a normal product from every other screen's point of
view — the only difference is `source: "migration"` and a shared
`import_batch_id`, kept so a bad import is traceable and reversible.

Two-step flow, never a blind write:
  POST /inventory-import/preview   — parse + validate only, nothing written
  POST /inventory-import/commit    — writes only the rows the caller
                                      re-submits after reviewing the preview
  GET  /inventory-import/template  — downloadable CSV template
"""
import io
import uuid
from datetime import datetime
from typing import List, Optional

import pandas as pd
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .deps import get_hq_tenant
from .grn_routes import resolve_single_store_destination
from .products import generate_base_sku, generate_barcode, _remember_custom_units
from ..db import product_collection, store_stock_collection, stores_collection, tenants_collection

router = APIRouter(prefix="/inventory-import", tags=["Inventory Bulk Import"])

TEMPLATE_COLUMNS = [
    "product_name", "division", "section", "department", "hsn_code", "gst_rate",
    "unit", "cost_price", "mrp", "selling_price", "opening_qty", "sku", "barcode",
]
# sku/barcode are optional — leave blank to have RMS generate them, the same
# way Add Product does. Fill them in only if you want to keep the identifiers
# already printed on your existing stock/labels.


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]
    return df


def _parse_upload(filename: str, content: bytes) -> List[dict]:
    name = (filename or "").lower()
    try:
        if name.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content), dtype=str)
        elif name.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(content), dtype=str)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type — upload a .csv or .xlsx file.")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read this file. Is it a valid CSV/Excel export?")

    df = _normalize_columns(df)
    df = df.where(pd.notnull(df), "")
    if "product_name" not in df.columns:
        raise HTTPException(
            status_code=400,
            detail="This file has no 'product_name' column. Download the template and match its headers.",
        )
    return df.to_dict(orient="records")


def _to_float(value, default: float = 0.0) -> float | None:
    text = str(value if value is not None else "").strip()
    if not text:
        return default
    try:
        return float(text)
    except ValueError:
        return None


def _validate_rows(raw_rows: List[dict], existing_skus: set, existing_barcodes: set) -> List[dict]:
    """Returns one report row per input row: the cleaned fields plus an
    `errors` list (empty = valid). Never touches the DB — pure validation,
    so preview and commit can share one code path and always agree."""
    seen_skus: set = set()
    seen_barcodes: set = set()
    rows: List[dict] = []

    for i, raw in enumerate(raw_rows):
        row_no = i + 2  # header is row 1, data starts at row 2 in the source file
        errors: List[str] = []

        product_name = str(raw.get("product_name") or "").strip()
        if not product_name:
            errors.append("Product name is required.")

        unit = str(raw.get("unit") or "").strip() or "pcs"

        qty = _to_float(raw.get("opening_qty"), 0.0)
        if qty is None:
            errors.append("Opening qty must be a number.")
            qty = 0.0
        elif qty < 0:
            errors.append("Opening qty cannot be negative.")

        cost_price = _to_float(raw.get("cost_price"), 0.0)
        if cost_price is None:
            errors.append("Cost price must be a number.")
            cost_price = 0.0

        mrp = _to_float(raw.get("mrp"), 0.0)
        if mrp is None:
            errors.append("MRP must be a number.")
            mrp = 0.0

        selling_price = _to_float(raw.get("selling_price"), 0.0)
        if selling_price is None:
            errors.append("Selling price must be a number.")
            selling_price = 0.0

        gst_rate = _to_float(raw.get("gst_rate"), 0.0)
        if gst_rate is None or not (0 <= gst_rate <= 100):
            errors.append("GST rate must be a number between 0 and 100.")
            gst_rate = 0.0

        sku = str(raw.get("sku") or "").strip()
        if sku:
            key = sku.upper()
            if key in existing_skus:
                errors.append(f"SKU '{sku}' already exists in your catalogue.")
            elif key in seen_skus:
                errors.append(f"SKU '{sku}' is duplicated within this file.")
            seen_skus.add(key)

        barcode = str(raw.get("barcode") or "").strip()
        if barcode:
            if barcode in existing_barcodes:
                errors.append(f"Barcode '{barcode}' already exists in your catalogue.")
            elif barcode in seen_barcodes:
                errors.append(f"Barcode '{barcode}' is duplicated within this file.")
            seen_barcodes.add(barcode)

        rows.append({
            "row_no": row_no,
            "product_name": product_name,
            "division": str(raw.get("division") or "").strip(),
            "section": str(raw.get("section") or "").strip(),
            "department": str(raw.get("department") or "").strip(),
            "hsn_code": str(raw.get("hsn_code") or "").strip(),
            "gst_rate": gst_rate,
            "unit": unit,
            "cost_price": cost_price,
            "mrp": mrp,
            "selling_price": selling_price if selling_price > 0 else mrp,
            "opening_qty": qty,
            "sku": sku,
            "barcode": barcode,
            "errors": errors,
        })

    return rows


async def _existing_identifiers(tenant_id: str) -> tuple[set, set]:
    skus: set = set()
    barcodes: set = set()
    async for p in product_collection.find({"tenant_id": tenant_id}, {"sku": 1, "base_sku": 1, "barcode": 1, "_id": 0}):
        if p.get("sku"):
            skus.add(str(p["sku"]).upper())
        if p.get("base_sku"):
            skus.add(str(p["base_sku"]).upper())
        if p.get("barcode"):
            barcodes.add(str(p["barcode"]))
    return skus, barcodes


async def _resolve_target_store(tenant_id: str, store_id: Optional[str]) -> dict:
    tenant = await tenants_collection.find_one({"tenant_id": tenant_id}, {"account_type": 1})
    if (tenant or {}).get("account_type") == "single_store":
        store = await resolve_single_store_destination(tenant_id, store_id or "")
        if not store:
            raise HTTPException(status_code=409, detail="Single-store tenant has no primary store configured. Contact Super Admin.")
        return store

    if not store_id:
        raise HTTPException(
            status_code=400,
            detail="store_id is required — choose which store this stock belongs to (each import run covers one store).",
        )
    if not ObjectId.is_valid(store_id):
        raise HTTPException(status_code=400, detail="Invalid store_id.")
    store = await stores_collection.find_one({"_id": ObjectId(store_id), "tenant_id": tenant_id})
    if not store:
        raise HTTPException(status_code=404, detail="Store not found for this tenant.")
    return {"id": str(store["_id"]), "name": store.get("name") or "Store", "type": store.get("type") or "store"}


async def _seed_import_stock(tenant_id: str, store: dict, barcode: str, description: str, quantity: float, rate: float, unit: str, batch_id: str) -> None:
    if quantity <= 0:
        return
    now = datetime.utcnow()
    await store_stock_collection.update_one(
        {"tenant_id": tenant_id, "barcode": barcode, "store_id": store["id"]},
        {
            "$inc": {"stockQty": quantity},
            "$set": {
                "tenant_id": tenant_id, "store_id": store["id"], "store_name": store["name"], "store_type": store["type"],
                "barcode": barcode, "description": description, "rate": rate, "unit": unit or "pcs",
                "source": "migration", "import_batch_id": batch_id, "updatedAt": now,
            },
            "$setOnInsert": {"createdAt": now},
        },
        upsert=True,
    )


class CommitRow(BaseModel):
    product_name: str
    division: str = ""
    section: str = ""
    department: str = ""
    hsn_code: str = ""
    gst_rate: float = 0.0
    unit: str = "pcs"
    cost_price: float = 0.0
    mrp: float = 0.0
    selling_price: float = 0.0
    opening_qty: float = 0.0
    sku: str = ""
    barcode: str = ""


class CommitPayload(BaseModel):
    store_id: Optional[str] = None
    rows: List[CommitRow]


@router.get("/template")
async def download_template():
    csv_text = ",".join(TEMPLATE_COLUMNS) + "\n"
    return StreamingResponse(
        io.BytesIO(csv_text.encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=inventory-import-template.csv"},
    )


@router.post("/preview")
async def preview_import(file: UploadFile = File(...), ctx: dict = Depends(get_hq_tenant)):
    content = await file.read()
    raw_rows = _parse_upload(file.filename, content)
    if not raw_rows:
        raise HTTPException(status_code=400, detail="This file has no data rows.")

    existing_skus, existing_barcodes = await _existing_identifiers(ctx["tenant_id"])
    rows = _validate_rows(raw_rows, existing_skus, existing_barcodes)
    valid_count = sum(1 for r in rows if not r["errors"])

    tenant = await tenants_collection.find_one({"tenant_id": ctx["tenant_id"]}, {"account_type": 1})
    needs_store_selection = (tenant or {}).get("account_type") != "single_store"

    return {
        "status": "success",
        "total_rows": len(rows),
        "valid_rows": valid_count,
        "error_rows": len(rows) - valid_count,
        "needs_store_selection": needs_store_selection,
        "rows": rows,
    }


@router.post("/commit")
async def commit_import(payload: CommitPayload, ctx: dict = Depends(get_hq_tenant)):
    if not payload.rows:
        raise HTTPException(status_code=400, detail="No rows to import.")

    store = await _resolve_target_store(ctx["tenant_id"], payload.store_id)

    existing_skus, existing_barcodes = await _existing_identifiers(ctx["tenant_id"])
    raw_rows = [r.dict() for r in payload.rows]
    validated = _validate_rows(raw_rows, existing_skus, existing_barcodes)

    tenant_id = ctx["tenant_id"]
    batch_id = uuid.uuid4().hex
    imported = 0
    skipped_rows = []
    units_used = []

    for row in validated:
        if row["errors"]:
            skipped_rows.append({"row_no": row["row_no"], "product_name": row["product_name"], "errors": row["errors"]})
            continue

        sku = row["sku"] or await generate_base_sku(row["division"], row["product_name"], tenant_id)
        barcode = row["barcode"] or generate_barcode()

        doc = {
            "product_name": row["product_name"], "division": row["division"], "section": row["section"], "department": row["department"],
            "hsn_code": row["hsn_code"], "gst_rate": row["gst_rate"], "cgst_rate": round(row["gst_rate"] / 2, 2), "sgst_rate": round(row["gst_rate"] / 2, 2), "igst_rate": row["gst_rate"],
            "sku": sku, "barcode": barcode, "cost_price": row["cost_price"], "mrp": row["mrp"], "selling_price": row["selling_price"] or row["mrp"],
            "quantity": row["opening_qty"], "unit": row["unit"], "description": "", "specification": "",
            "has_variants": False, "variant_type": "none", "variants": [], "images": [],
            "created_at": datetime.utcnow(), "created_by": "ADMIN", "vendor_id": None, "vendor_name": "", "tenant_id": tenant_id,
            "source": "migration", "import_batch_id": batch_id,
        }
        await product_collection.insert_one(doc)
        await _seed_import_stock(tenant_id, store, barcode, row["product_name"], row["opening_qty"], row["cost_price"], row["unit"], batch_id)

        units_used.append(row["unit"])
        imported += 1

    await _remember_custom_units(tenant_id, units_used)

    return {
        "status": "success",
        "import_batch_id": batch_id,
        "store": {"id": store["id"], "name": store["name"]},
        "imported": imported,
        "skipped": len(skipped_rows),
        "skipped_rows": skipped_rows,
    }
