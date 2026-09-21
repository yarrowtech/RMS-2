"""Raphaa pilot: Sales & Stock Data Hub — spreadsheet import into RMS.

Two spreadsheet exports, previewed then committed:

  * SALES  (has Barcode + Item Code + category columns)
      -> sales            (type="sale") historical bills for Forecast & Analytics
      -> products         auto-created for any barcode not in the catalogue yet
                          (name/category/rates taken from the sales row), so the
                          rest of RMS shows real names, not bare barcodes.
      NO stock movement, NO finance / GST voucher, NO POS / cashier flow.

  * STOCK  (physical count — Barcode/Item Code preferred; when absent, a row
      is identified by DIVISION|SECTION|DEPARTMENT|CATEGORY1-5, with Vendor
      and RSP/MRP/Standard Rate used only as soft tiebreakers when that
      combination matches more than one product; CATEGORY6 = Ageing, an
      "MM/YY" receipt month, parsed into freshQty/agedQty — see
      RAPHAAA_FRESH_MAX_MONTHS)
      -> inventory        WAREHOUSE column  = Raphaa HQ / central on-hand
      -> store_stock       one column per store
      Each row is resolved to a barcode through the products the sales import
      created (their category attributes ARE the map). Rows that collapse to the
      same product+location (different Ageing) are summed, fresh and aged
      separately. A row that's still genuinely ambiguous after both tiebreakers
      is left unresolved rather than guessing. Absolute snapshot: $set stockQty
      (+ freshQty/agedQty, Raphaaa-only), never $inc. Items absent from the
      file are left untouched. Long-format files also carry the row's own
      Closing Amt (real cost-basis value for that product x site) into
      stockValue (Raphaaa-only) instead of it being recomputed later as
      qty x one shared Product Master cost_price — see _STOCK_VALUE_ALIASES.

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

import cloudinary
import cloudinary.uploader
import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..config import settings
from .deps import get_hq_tenant
from ..raphaaa_product_enrichment import (
    enrichment_patch,
    is_raphaaa_tenant,
    product_quality_issues,
    proposed_product_name,
)
from ..raphaaa_design_performance import best_tech_packs, tech_pack_label
from ..raphaaa_purchase_plan import RAPHAAA_FRESH_MAX_MONTHS
from ..db import (
    data_hub_imports_collection,
    inventory_collection,
    product_collection,
    sales_collection,
    store_stock_collection,
    stores_collection,
    tech_packs_collection,
    unstitched_stock_collection,
)

router = APIRouter(prefix="/api/forecast-analytics/data-hub", tags=["Forecast Data Hub"])
TenantCtx = Dict[str, Any]
MAX_ROWS = 20_000
PREVIEW_ROWS = 500
CENTRAL_LABEL = "Central Warehouse / HQ"

cloudinary.config(cloud_name=settings.cloudinary_cloud_name, api_key=settings.cloudinary_api_key, api_secret=settings.cloudinary_api_secret, secure=True)


def _archive_uploaded_file(tenant_id: str, filename: str, content: bytes) -> str:
    """Best-effort: store the original uploaded workbook so Import History can
    offer it back for re-download later. Never blocks the actual import —
    a Cloudinary hiccup just means that one batch has no download link."""
    try:
        result = cloudinary.uploader.upload(
            content, folder=f"rms/data-hub/{tenant_id}", resource_type="raw",
            use_filename=True, unique_filename=True, filename_override=filename,
        )
        return result.get("secure_url") or ""
    except Exception:
        return ""


class ProductEnrichmentRequest(BaseModel):
    confirm: bool = False

# Column aliases — every list is matched with _key() (case / space / punctuation
# insensitive), so "Cat-1 (Design No.)" and "CATEGORY1" resolve to the same field.
CAT_ALIASES = {
    "cat1": ["category1", "cat-1 (design no.)", "cat1", "cat 1", "design no", "design no."],
    "cat2": ["category2", "cat-2 (brand)", "cat2", "cat 2", "brand"],
    "cat3": ["category3", "cat-3 (style)", "cat3", "cat 3", "style"],
    "cat4": ["category4", "cat-4 (plane, f/s, h/s)", "cat4", "cat 4"],
    "cat5": ["category5", "cat-5 (size)", "cat5", "cat 5", "size"],
}

# CATEGORY6 = Ageing, Raphaaa-only. Comes as an "MM/YY" receipt month (e.g.
# "12/24"), not a ready-made day-bucket, so freshness has to be computed from
# it relative to today rather than read off the file directly.
_AGEING_ALIASES = ["category6", "cat-6 (ageing)", "cat6", "cat 6", "ageing", "age"]


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


# Header keys that appear in the sales and/or stock layouts. A workbook sheet
# is treated as data only when it carries at least three of these — so cover
# pages, filter-parameter tabs and pivot summaries in the same file are skipped.
_KNOWN_COLUMN_KEYS = {
    # shared
    "barcode", "itemcode", "division", "section", "department", "vendor",
    "rsp", "mrp", "description",
    # sales layout
    "billdate", "billtime", "billno", "store", "billqty", "gramt", "netamt",
    "taxrate", "stdrate", "isvoid",
    # stock layout — wide (one row per product, a column per location)
    "standardrate", "warehouse", "grandtotal",
    "category1", "category2", "category3", "category4", "category5", "category6",
    "cat1designno", "cat2brand", "cat3style", "cat4planefshs", "cat5size",
    # stock layout — long (one row per product × site: Locname + a qty column)
    "locname", "sourcesite", "closingqty", "closingamt", "closingamount", "closingvalue", "lastinwardrate", "wsp", "uom",
}

# Long-format stock: the on-hand quantity column and the site/location column.
_STOCK_QTY_ALIASES = (
    "closing_qty", "closingqty", "closing qty", "closing stock", "closing_stock",
    "qty", "quantity", "stock qty", "stockqty", "on hand", "onhand", "balance qty", "balqty",
)
_STOCK_LOC_ALIASES = (
    "locname", "loc name", "location", "location name", "source site", "sourcesite",
    "site", "site name", "branch", "store", "store name", "outlet", "godown",
)
# Long-format stock only (Raphaaa-only downstream use): the row's own cost-basis
# stock value for that product×site, straight from the file rather than
# recomputed as qty x one shared Product Master cost_price (which can drift
# when Standard Rate differs by store/batch). Several header spellings are
# listed since "Closing Amt" / "Closing Amount" / "Closing Value" are
# genuinely different strings after normalization, not just a case difference.
_STOCK_VALUE_ALIASES = (
    "closing amt", "closingamt", "closing amount", "closingamount",
    "closing value", "closingvalue", "closing stock value", "stock value",
)


def _looks_like_data(frame: "pd.DataFrame") -> bool:
    known = sum(1 for column in frame.columns if column in _KNOWN_COLUMN_KEYS)
    return known >= 3 and len(frame.index) > 0


def _read_rows(filename: str, content: bytes) -> List[dict]:
    name = (filename or "").lower()
    try:
        if name.endswith(".csv"):
            frames = [pd.read_csv(io.BytesIO(content), dtype=str)]
        elif name.endswith((".xlsx", ".xls")):
            # sheet_name=None → read every tab. Retail POS/stock exports often
            # split a large report across "Sheet1 / Sheet2 …" or keep the rows
            # on one tab and a filter/summary on another; we want all the rows.
            sheets = pd.read_excel(io.BytesIO(content), dtype=str, sheet_name=None)
            frames = list(sheets.values())
        else:
            raise HTTPException(status_code=400, detail="Upload a CSV or Excel file (.csv, .xlsx, .xls).")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="The file could not be read. Download a template and keep the headers unchanged.")

    for frame in frames:
        frame.columns = [_key(column) for column in frame.columns]

    data_frames = [frame for frame in frames if _looks_like_data(frame)]
    if not data_frames:
        # No sheet matched the expected layout — fall back to the first sheet so
        # the "headers changed" error below is still raised on real data.
        data_frames = frames[:1]

    frame = (
        pd.concat(data_frames, ignore_index=True, sort=False)
        if len(data_frames) > 1
        else data_frames[0]
    )
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


def _cat_key(division: str, section: str, department: str, cats: List[str]) -> str:
    """Normalised product-identity key. Empty when nothing meaningful is set.

    Vendor is deliberately NOT part of this key — a stock file's Vendor
    column frequently differs in spelling/suffix from what the Sales import
    stored ("ABC Textiles" vs "ABC Textiles Pvt Ltd"), and requiring an exact
    match on it silently dropped otherwise-perfectly-identifiable rows.
    Vendor is now used as a soft tiebreaker instead — see _resolve_by_category.
    """
    parts = [division, section, department, *cats]
    if not any(_key(part) for part in parts):
        return ""
    return "|".join(_key(part) for part in parts)


def _row_vendor(row: dict) -> str:
    return _column(row, "vendor", "supplier")


def _row_cat_key(row: dict) -> str:
    return _cat_key(
        _column(row, "division"),
        _column(row, "section"),
        _column(row, "department", "dept"),
        [_column(row, *CAT_ALIASES[name]) for name in ("cat1", "cat2", "cat3", "cat4", "cat5")],
    )


def _row_cats(row: dict) -> List[str]:
    return [_column(row, *CAT_ALIASES[name]) for name in ("cat1", "cat2", "cat3", "cat4", "cat5")]


def _parse_ageing_month(value: Any) -> Optional[datetime]:
    """CATEGORY6 as an "MM/YY" or "MM/YYYY" receipt month, e.g. "12/24" ->
    Dec 2024. Returns None for blank/unparseable values rather than guessing."""
    text = _text(value)
    match = re.match(r"^(\d{1,2})\s*[/-]\s*(\d{2,4})$", text)
    if not match:
        return None
    month, year = int(match.group(1)), int(match.group(2))
    if not 1 <= month <= 12:
        return None
    if year < 100:
        year += 2000
    try:
        return datetime(year, month, 1)
    except ValueError:
        return None


def _age_months(month: datetime, now: datetime) -> int:
    return (now.year - month.year) * 12 + (now.month - month.month)


def _is_aged(value: Any, now: datetime) -> bool:
    """True only when CATEGORY6 parses cleanly AND is older than the fresh
    window. A blank/unparseable ageing value is treated as fresh — we won't
    label stock "aged" on data we can't actually read."""
    month = _parse_ageing_month(value)
    if month is None:
        return False
    return _age_months(month, now) > RAPHAAA_FRESH_MAX_MONTHS


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


async def _catalogue(tenant_id: str) -> tuple[dict, dict, dict]:
    """Indexes over the tenant's products:
        barcode_index[_key(barcode)] -> payload
        sku_index[_key(item_code)]   -> payload
        cat_index[cat_key]           -> [payload, ...]  every product sharing that
                                        DIVISION|SECTION|DEPARTMENT|VENDOR|CAT1-5 tuple.
    A tuple with more than one payload is ambiguous; _resolve_by_category breaks
    the tie with the stock row's RSP / MRP before falling back to the first one.
    """
    barcode_index: dict = {}
    sku_index: dict = {}
    cat_index: Dict[str, List[dict]] = {}
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
            "vendor_name": _text(product.get("vendor_name")),
            "cost_price": float(product.get("cost_price") or 0),
            "rsp": float(product.get("selling_price") or 0),
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
        ck = _cat_key(payload["division"], payload["section"], payload["department"], cats)
        if ck and payload["barcode"]:
            bucket = cat_index.setdefault(ck, [])
            if not any(existing["barcode"] == payload["barcode"] for existing in bucket):
                bucket.append(payload)
    return barcode_index, sku_index, cat_index


def _vendor_similar(a: str, b: str) -> bool:
    """Loose vendor-name match — exact after normalising, or one name contains
    the other (handles "ABC Textiles" vs "ABC Textiles Pvt Ltd")."""
    ka, kb = _key(a), _key(b)
    if not ka or not kb:
        return False
    return ka == kb or ka in kb or kb in ka


def _resolve_by_category(raw: dict, cat_index: Dict[str, List[dict]]) -> tuple[Optional[dict], Optional[str]]:
    """Resolve a stock row that has no Barcode / Item Code to a product via its
    Division/Section/Department/Category tuple (Vendor is not part of this
    key — see _cat_key). When the tuple maps to several products, narrow using
    the row's MRP -> RSP -> Standard Rate first, then Vendor-name similarity.
    Returns (payload, message). message is None when unambiguous or narrowed
    to exactly one; when genuinely still ambiguous, returns (None, message) —
    the row is left unresolved rather than guessing which product it is."""
    candidates = cat_index.get(_row_cat_key(raw)) or []
    if not candidates:
        return None, None
    if len(candidates) == 1:
        return candidates[0], None

    rsp = _number(_column(raw, "rsp", "selling price")) or 0.0
    mrp = _number(_column(raw, "mrp")) or 0.0
    std = _number(_column(raw, "standard_rate", "standard rate", "std rate")) or 0.0

    def near(a: float, b: float) -> bool:
        return b > 0 and abs(a - b) <= 1.0

    for field, value in (("mrp", mrp), ("rsp", rsp), ("cost_price", std)):
        hits = [c for c in candidates if near(c.get(field, 0.0), value)]
        if len(hits) == 1:
            return hits[0], None

    row_vendor = _row_vendor(raw)
    if row_vendor:
        vendor_hits = [c for c in candidates if _vendor_similar(c.get("vendor_name", ""), row_vendor)]
        if len(vendor_hits) == 1:
            return vendor_hits[0], None

    shown = ", ".join(f"{c['barcode']} (RSP {c['rsp']:g}/MRP {c['mrp']:g})" for c in candidates[:3])
    message = (
        f"Multiple products match this row's Division/Section/Department/Category ({len(candidates)}: {shown}"
        + ("…" if len(candidates) > 3 else "")
        + f"). This row's RSP {rsp:g}/MRP {mrp:g}/Std {std:g} and Vendor '{row_vendor or '(blank)'}' did not narrow it "
        f"to exactly one, so it was left unresolved rather than guessing. Add a Barcode or Item Code to this row to "
        f"resolve it exactly."
    )
    return None, message


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


# Substring tokens are long enough to be unambiguous inside a location name;
# the exact set catches short abbreviations that would be unsafe as substrings.
_CENTRAL_TOKENS = (
    "warehouse", "warehse", "wrhouse", "godown", "central", "headoffice",
    "mainstore", "mainwh", "distributioncentre", "distributioncenter",
)
_CENTRAL_EXACT = {"ho", "wh", "hq", "cw", "cwh", "cws", "main"}

# ERP location names that carry no textual resemblance to the RMS store they
# belong to, so no heuristic could match them. Key = normalised substring of the
# file's Locname, value = a normalised substring of the target RMS store name.
# (Raphaa's Chowringhee outlet is booked as "Megashop" in their stock system.)
_LOCNAME_OVERRIDES = {
    "megashop": "chowringhee",
}


def _match_location(value: str, stores: List[dict]) -> Optional[str]:
    """Map a long-format Locname / Source Site string to a location label —
    the HQ warehouse (CENTRAL_LABEL) or one of the tenant's store names.
    Returns None when it matches neither."""
    wanted = _key(value)
    if not wanted:
        return None
    for src, dst in _LOCNAME_OVERRIDES.items():
        if src in wanted:
            for store in stores:
                if dst in _key(store["name"]) or dst in store["aliases"]:
                    return store["name"]
    exact = _match_store(value, stores)
    if exact:
        return exact["name"]
    for store in stores:
        if any(len(alias) >= 4 and alias in wanted for alias in store["aliases"]):
            return store["name"]
    if any(token in wanted for token in _CENTRAL_TOKENS) or wanted in _CENTRAL_EXACT:
        return CENTRAL_LABEL
    return None


def _match_product(row: dict, barcode_index: dict, sku_index: dict) -> Optional[dict]:
    barcode = _column(row, "barcode", "rms barcode")
    item_code = _column(row, "item code", "itemcode", "sku", "product code")
    return barcode_index.get(_key(barcode)) or sku_index.get(_key(item_code))


def _stock_new_product_payload(raw: dict) -> Optional[dict]:
    """A stock row with a real Barcode/Item Code that matches nothing yet is
    very likely genuinely new stock that has never been sold (so the Sales
    import never had a chance to create it) — not a data error. Build the
    same shape _catalogue()'s lookup would have returned had the product
    already existed, so this row flows through the rest of _stock_rows
    exactly like a normal match. The real product_name comes from
    enrichment_patch when the product is actually created in commit."""
    barcode = _column(raw, "barcode", "rms barcode")
    item_code = _column(raw, "item code", "itemcode", "sku", "product code")
    if not barcode and not item_code:
        return None
    barcode = barcode or item_code
    cats = _row_cats(raw)
    return {
        "barcode": barcode,
        "sku": item_code or barcode,
        "product_name": barcode,
        "design_no": cats[0],
        "division": _column(raw, "division"),
        "section": _column(raw, "section"),
        "department": _column(raw, "department", "dept"),
        "vendor_name": _row_vendor(raw),
        "cost_price": _number(_column(raw, "standard_rate", "standard rate", "std rate")) or 0.0,
        "rsp": _number(_column(raw, "rsp", "selling price")) or 0.0,
        "mrp": _number(_column(raw, "mrp")) or 0.0,
        "_cats": cats,
    }


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
        # Real promotion/discount evidence, straight from the file — captured
        # verbatim (e.g. Promo Type as "F"/"P") rather than translated, since
        # RMS doesn't know the tenant's own scheme codes.
        promo_name = _column(raw, "promo name", "promotion name", "promoname", "promotionname", "offer name", "scheme name")
        promo_type = _column(raw, "promo type", "promotion type", "promotype", "promotiontype", "discount type")
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
            "promo_name": promo_name,
            "promo_type": promo_type,
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


def _stock_is_long_format(raw_rows: List[dict]) -> bool:
    """A long-format stock export has one row per product × site: a Locname /
    Source Site column plus a single closing-quantity column, and NO per-location
    quantity columns. Ginesys / most ERP stock exports look like this."""
    if not raw_rows:
        return False
    keys = set(raw_rows[0].keys())
    has_qty = any(_key(a) in keys for a in _STOCK_QTY_ALIASES)
    has_loc = any(_key(a) in keys for a in _STOCK_LOC_ALIASES)
    has_wide = "warehouse" in keys or "grandtotal" in keys
    return has_qty and has_loc and not has_wide


def _stock_rows(raw_rows: List[dict], barcode_index: dict, sku_index: dict, cat_index: dict, stores: List[dict]):
    """Returns (rows, totals, store_by_label, meta). Rows are aggregated by resolved barcode — every
    file row that collapses to the same product (e.g. different Ageing, or a
    long-format file's repeated product across sites) is summed per location.
    Rows that can't be resolved are kept individually with errors.

    Two file shapes are accepted:
      • wide — one row per product, a column per location (WAREHOUSE + stores)
      • long — one row per product × site: a Locname / Source Site column and a
        single CLOSING_QTY column. Location is read from the row, not the header.
    """
    long_format = _stock_is_long_format(raw_rows)
    ageing_now = datetime.utcnow()
    # Real per-row stock value (Closing Amt) is only meaningful for a long-format
    # file, where each row already carries its own single location — a wide
    # file's GRANDTOTAL is a row total across every location, not attributable
    # to one of them, so it's deliberately left alone here.
    has_value_col = long_format and bool(raw_rows) and any(_key(a) in raw_rows[0].keys() for a in _STOCK_VALUE_ALIASES)

    location_columns = {"central": ["warehouse", "central", "central warehouse", "hq inventory"]}
    for store in stores:
        location_columns[store["id"]] = list(store["aliases"])
    label_for = {"central": CENTRAL_LABEL, **{store["id"]: store["name"] for store in stores}}
    store_by_label = {store["name"]: store for store in stores}
    all_labels = [CENTRAL_LABEL, *[store["name"] for store in stores]]

    agg: Dict[str, dict] = {}
    unresolved: List[dict] = []
    location_map: Dict[str, Optional[str]] = {}

    for index, raw in enumerate(raw_rows, start=2):
        row_errors: List[str] = []
        has_id_col = bool(_column(raw, "barcode", "rms barcode") or _column(raw, "item code", "itemcode", "sku", "product code"))
        product = _match_product(raw, barcode_index, sku_index)
        matched_via = "barcode"
        if not product and not has_id_col:
            product, message = _resolve_by_category(raw, cat_index)
            matched_via = "category"
            if message:
                row_errors.append(message)
            elif not product:
                row_errors.append("No Barcode / Item Code column, and this DIVISION/SECTION/DEPARTMENT/CATEGORY1-5 combination was not found in imported sales.")
        elif not product:
            new_payload = _stock_new_product_payload(raw)
            if new_payload:
                product = new_payload
                matched_via = "new_from_stock"
            else:
                row_errors.append("Barcode / Item Code in this row does not match any product.")

        loc_qty: Dict[str, float] = {label: 0.0 for label in all_labels}
        # Which locations THIS row actually reported a value for — distinct
        # from loc_qty's 0.0 default, which just fills in every OTHER location
        # so allocation totals add up. Only "touched" locations get written at
        # commit time (see below); a location a product's rows never mention
        # is left completely alone, not zeroed out.
        touched: set = set()
        value_touched: set = set()
        loc_value: Dict[str, float] = {label: 0.0 for label in all_labels}
        # CATEGORY6 / Ageing (Raphaaa-only downstream use — every stock row is
        # classified fresh/aged here so it's available regardless of tenant;
        # only the Raphaaa write path in commit_stock_snapshot actually stores it).
        ageing_month = _parse_ageing_month(_column(raw, *_AGEING_ALIASES))
        row_age_months = _age_months(ageing_month, ageing_now) if ageing_month else None
        row_aged = row_age_months is not None and row_age_months > RAPHAAA_FRESH_MAX_MONTHS
        if long_format:
            loc_raw = _column(raw, *_STOCK_LOC_ALIASES)
            label = _match_location(loc_raw, stores)
            location_map.setdefault(loc_raw or "(blank)", label)
            qty = _number(_column(raw, *_STOCK_QTY_ALIASES))
            if qty is None or qty < 0:
                row_errors.append("Closing quantity must be zero or greater.")
                qty = 0.0
            if label is None:
                row_errors.append(f"Location '{loc_raw or '(blank)'}' does not match the HQ warehouse or any store.")
            else:
                loc_qty[label] = qty
                touched.add(label)
                if has_value_col:
                    loc_value[label] = _number(_column(raw, *_STOCK_VALUE_ALIASES)) or 0.0
                    value_touched.add(label)
        else:
            for location_id, aliases in location_columns.items():
                value = ""
                present = False
                for alias in aliases:
                    if alias in raw:
                        value = raw.get(alias, "")
                        present = True
                        break
                qty = _number(value)
                if qty is None or qty < 0:
                    row_errors.append(f"{'Warehouse' if location_id == 'central' else 'Store'} quantity must be zero or greater.")
                    qty = 0.0
                loc_qty[label_for[location_id]] = qty
                if present:
                    touched.add(label_for[location_id])

        loc_fresh_qty = {label: (0.0 if label in touched and row_aged else loc_qty[label]) for label in all_labels}
        loc_aged_qty = {label: (loc_qty[label] if label in touched and row_aged else 0.0) for label in all_labels}
        # Qty-weighted so a later average (aged_months_weighted / aged_allocation)
        # reflects "how old is the aged portion", not a raw row count.
        loc_aged_months_weighted = {
            label: (loc_qty[label] * row_age_months if label in touched and row_aged else 0.0)
            for label in all_labels
        }

        if product:
            bucket = agg.setdefault(product["barcode"], {
                "product": product,
                "matched_via": matched_via,
                "allocation": {label: 0.0 for label in all_labels},
                "fresh_allocation": {label: 0.0 for label in all_labels},
                "aged_allocation": {label: 0.0 for label in all_labels},
                "aged_months_weighted": {label: 0.0 for label in all_labels},
                "value_allocation": {label: 0.0 for label in all_labels},
                "touched": set(),
                "value_touched": set(),
                "source_rows": [],
                "errors": [],
            })
            for label, qty in loc_qty.items():
                bucket["allocation"][label] += qty
            for label, qty in loc_fresh_qty.items():
                bucket["fresh_allocation"][label] += qty
            for label, qty in loc_aged_qty.items():
                bucket["aged_allocation"][label] += qty
            for label, weighted in loc_aged_months_weighted.items():
                bucket["aged_months_weighted"][label] += weighted
            for label, value in loc_value.items():
                bucket["value_allocation"][label] += value
            bucket["touched"] |= touched
            bucket["value_touched"] |= value_touched
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
            "fresh_allocation": {label: round(value, 2) for label, value in bucket["fresh_allocation"].items()},
            "aged_allocation": {label: round(value, 2) for label, value in bucket["aged_allocation"].items()},
            "aged_avg_months": {
                label: (round(bucket["aged_months_weighted"][label] / bucket["aged_allocation"][label], 1)
                        if bucket["aged_allocation"][label] > 0 else None)
                for label in all_labels
            },
            "value_allocation": {label: round(value, 2) for label, value in bucket["value_allocation"].items()},
            "touched": sorted(bucket["touched"]),
            "value_touched": sorted(bucket["value_touched"]),
            "grand_total": round(sum(allocation.values()), 2),
            "errors": list(dict.fromkeys(bucket["errors"])),
            "_product": bucket["product"],
        })
    for row in unresolved:
        for label, value in row["allocation"].items():
            totals[label] += value
    rows.extend(unresolved)
    meta = {
        "format": "long" if long_format else "wide",
        "location_map": dict(sorted(location_map.items())) if long_format else {},
    }
    return rows, {label: round(value, 2) for label, value in totals.items()}, store_by_label, meta


def _summary(rows: List[dict]) -> dict:
    invalid = [row for row in rows if row["errors"]]
    return {"row_count": len(rows), "valid_count": len(rows) - len(invalid), "invalid_count": len(invalid)}


# Plain-language buckets for the preview/skip summary — so a non-technical
# admin sees "14 rows: vendor spelling didn't match" instead of having to
# read every row's raw error text one at a time.
_REASON_LABELS = [
    ("does not match any product", "Barcode / Item Code not found in the catalogue"),
    ("multiple products match", "Ambiguous — matches more than one product, needs a Barcode/Item Code to resolve"),
    ("was not found in imported sales", "No matching product by Division/Section/Department/Category — check those columns and the Vendor spelling"),
    ("does not match the hq warehouse or any store", "Store/location name not recognised"),
    ("must be zero or greater", "Quantity column has an invalid (negative or non-numeric) value"),
]


def _error_breakdown(rows: List[dict]) -> List[dict]:
    counts: Dict[str, int] = {}
    for row in rows:
        if not row["errors"]:
            continue
        seen: set = set()
        for error in row["errors"]:
            lowered = error.lower()
            for needle, label in _REASON_LABELS:
                if needle in lowered and label not in seen:
                    counts[label] = counts.get(label, 0) + 1
                    seen.add(label)
    return [{"reason": label, "row_count": count} for label, count in sorted(counts.items(), key=lambda kv: -kv[1])]


def _public(row: dict) -> dict:
    return {key: value for key, value in row.items() if not key.startswith("_")}


def _new_product_doc(tenant_id: str, batch_id: str, row: dict, now: datetime) -> dict:
    cats = row["_cats"]
    base = {
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
    if is_raphaaa_tenant(tenant_id):
        base.update(enrichment_patch(base))
    return base


def _new_product_doc_from_stock(tenant_id: str, batch_id: str, payload: dict, now: datetime) -> dict:
    """Same shape as _new_product_doc, sourced from a stock row instead of a
    sales row — for genuinely new stock that has never been sold yet, so the
    Sales import never had a barcode to create it from. product_name starts
    as the barcode itself; enrichment_patch (always applied — this whole
    module is Raphaaa-only) replaces it with a real hierarchy-derived name,
    the same way a poor sales-side name would be replaced."""
    cats = payload.get("_cats") or ["", "", "", "", ""]
    base = {
        "product_name": payload["barcode"],
        "division": payload["division"], "section": payload["section"], "department": payload["department"],
        "hsn_code": "", "gst_rate": 0.0, "cgst_rate": 0.0, "sgst_rate": 0.0, "igst_rate": 0.0,
        "sku": payload["sku"] or f"DH-{payload['barcode']}",
        "barcode": payload["barcode"],
        "design_no": cats[0],
        "category1": cats[0], "category2": cats[1], "category3": cats[2], "category4": cats[3], "category5": cats[4],
        "cost_price": payload["cost_price"],
        "mrp": payload["mrp"],
        "selling_price": payload["rsp"] or payload["mrp"] or payload["cost_price"],
        "quantity": 0, "unit": "pcs", "description": "", "specification": "",
        "has_variants": False, "variant_type": "none", "variants": [], "images": [],
        "vendor_id": None, "vendor_name": payload["vendor_name"],
        "created_at": now, "created_by": "DATA_HUB",
        "tenant_id": tenant_id,
        "source": "data_hub_import", "data_hub_batch_id": batch_id,
    }
    if is_raphaaa_tenant(tenant_id):
        base.update(enrichment_patch(base))
    return base


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
        "product_enrichment_enabled": enabled and is_raphaaa_tenant(ctx["tenant_id"]),
        "unstitched_import_enabled": enabled and is_raphaaa_tenant(ctx["tenant_id"]),
        "mode": "preview_then_commit",
        "message": "Import the sales file first (it also builds the product catalogue), then the stock file. Multi-sheet workbooks are read in full — every tab whose headers match is combined, cover/filter/summary tabs are skipped. The stock file can be wide (a column per location: WAREHOUSE + store columns) or long (one row per product per site: a Locname / Source Site column plus CLOSING_QTY) — both are auto-detected. Matching uses ITEM_CODE / BARCODE first, then DIVISION/SECTION/DEPARTMENT/VENDOR/CAT1-5 with RSP/MRP. Finance, GST and POS flows are never touched.",
        "catalogue_size": catalogue_size,
        "locations": [{"id": "central", "name": CENTRAL_LABEL}, *[{"id": store["id"], "name": store["name"]} for store in stores]],
        "tenant_id": ctx["tenant_id"],
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
        headers = ["Item Code", "Barcode", "Division", "Section", "Department", "Vendor",
                   "Category1", "Category2", "Category3", "Category4", "Category5", "Category6",
                   "Standard_Rate", "RSP", "MRP", *store_headers, "WAREHOUSE", "Grand Total"]
    elif kind == "unstitched" and is_raphaaa_tenant(ctx["tenant_id"]):
        headers = ["Design No.", "Department", "Description", "PCS", "Fabric Consume"]
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
    barcode_index, sku_index, _ = await _catalogue(ctx["tenant_id"])
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
    barcode_index, sku_index, cat_index = await _catalogue(ctx["tenant_id"])
    stores = await _stores(ctx["tenant_id"])
    rows, totals, _, meta = _stock_rows(raw_rows, barcode_index, sku_index, cat_index, stores)
    resolved_via_category = sum(1 for row in rows if row.get("matched_via") == "category")
    new_from_stock = sum(1 for row in rows if row.get("matched_via") == "new_from_stock")
    return {
        "status": "success",
        "mode": "preview_only",
        "import_type": "stock_snapshot",
        "summary": {
            **_summary(rows),
            "products_in_snapshot": sum(1 for row in rows if row.get("matched_via")),
            "resolved_via_category": resolved_via_category,
            "new_products_from_stock": new_from_stock,
            "unresolved_rows": sum(1 for row in rows if row["errors"] and not row.get("matched_via")),
            "catalogue_size": len(barcode_index),
            "location_totals": totals,
            "file_format": meta["format"],
            "location_map": meta["location_map"],
            "error_breakdown": _error_breakdown(rows),
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
    file_content = await file.read()
    raw_rows = _read_rows(file.filename or "", file_content)
    file_url = _archive_uploaded_file(tenant_id, file.filename or "sales.xlsx", file_content)
    barcode_index, sku_index, _ = await _catalogue(tenant_id)
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
            "promotion_name": row["promo_name"],
            "promotion_type": row["promo_type"],
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
        "file_name": file.filename or "", "file_url": file_url, "created_at": now,
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
    file_content = await file.read()
    raw_rows = _read_rows(file.filename or "", file_content)
    file_url = _archive_uploaded_file(tenant_id, file.filename or "stock.xlsx", file_content)
    barcode_index, sku_index, cat_index = await _catalogue(tenant_id)
    stores = await _stores(tenant_id)
    rows, totals, store_by_label, _ = _stock_rows(raw_rows, barcode_index, sku_index, cat_index, stores)

    blocking = ("does not match any product", "was not found in imported sales", "must be zero or greater")
    batch_id = uuid.uuid4().hex
    now = datetime.utcnow()
    changes: List[dict] = []
    skipped: List[dict] = []
    created_products: List[str] = []
    applied = 0

    for row in rows:
        if row["_product"] is None or any(any(b in error for b in blocking) for error in row["errors"]):
            skipped.append({"row_no": row["row_no"], "product": row["product"], "errors": row["errors"]})
            continue

        if row.get("matched_via") == "new_from_stock":
            # Genuinely new stock that's never been sold, so the Sales import
            # never had a barcode to create it from. Create it now — but
            # check first in case an earlier row in this same file already
            # created it (two rows for the same new barcode at different
            # sites), or a concurrent import beat us to it.
            existing_product = await product_collection.find_one({"tenant_id": tenant_id, "barcode": row["_product"]["barcode"]}, {"product_name": 1})
            if existing_product:
                row["_product"]["product_name"] = existing_product.get("product_name") or row["_product"]["barcode"]
            else:
                new_doc = _new_product_doc_from_stock(tenant_id, batch_id, row["_product"], now)
                await product_collection.insert_one(new_doc)
                row["_product"]["product_name"] = new_doc["product_name"]
                created_products.append(new_doc["barcode"])

        barcode = row["_product"]["barcode"]
        description = row["_product"]["product_name"]
        touched_labels = set(row.get("touched") or [])
        raphaaa = is_raphaaa_tenant(tenant_id)
        for label, qty in row["allocation"].items():
            if label not in touched_labels:
                # This product's rows in the file never mentioned this
                # location — leave whatever is already there untouched,
                # instead of silently zeroing it out just because every
                # OTHER location for this product got a real value.
                continue
            if label == CENTRAL_LABEL:
                collection = inventory_collection
                flt = {"tenant_id": tenant_id, "barcode": barcode}
                extra: Dict[str, Any] = {}
            else:
                store = store_by_label[label]
                collection = store_stock_collection
                flt = {"tenant_id": tenant_id, "barcode": barcode, "store_id": store["id"]}
                extra = {"store_id": store["id"], "store_name": store["name"]}

            existing = await collection.find_one(flt, {"stockQty": 1, "freshQty": 1, "agedQty": 1, "agedAvgMonths": 1, "stockValue": 1})
            previous_qty = float((existing or {}).get("stockQty") or 0)
            set_fields: Dict[str, Any] = {
                **flt, **extra, "stockQty": float(qty), "description": description,
                "source": "data_hub_import", "data_hub_batch_id": batch_id, "updatedAt": now,
            }
            previous_fresh_qty = previous_aged_qty = previous_aged_avg_months = None
            previous_stock_value = None
            if raphaaa:
                previous_fresh_qty = float((existing or {}).get("freshQty") or 0)
                previous_aged_qty = float((existing or {}).get("agedQty") or 0)
                previous_aged_avg_months = (existing or {}).get("agedAvgMonths")
                set_fields["freshQty"] = float(row["fresh_allocation"].get(label, 0.0))
                set_fields["agedQty"] = float(row["aged_allocation"].get(label, 0.0))
                set_fields["agedAvgMonths"] = row["aged_avg_months"].get(label)
                value_touched_labels = set(row.get("value_touched") or [])
                if label in value_touched_labels:
                    previous_stock_value = (existing or {}).get("stockValue")
                    set_fields["stockValue"] = float(row["value_allocation"].get(label, 0.0))
            await collection.update_one(
                flt,
                {
                    "$set": set_fields,
                    "$setOnInsert": {"createdAt": now},
                },
                upsert=True,
            )
            changes.append({
                "location": label, "store_id": extra.get("store_id"), "barcode": barcode,
                "previous_qty": previous_qty, "new_qty": float(qty), "existed": bool(existing),
                "previous_fresh_qty": previous_fresh_qty, "previous_aged_qty": previous_aged_qty,
                "previous_aged_avg_months": previous_aged_avg_months,
                "value_written": label in value_touched_labels if raphaaa else False,
                "previous_stock_value": previous_stock_value,
            })
        applied += 1

    log = {
        "tenant_id": tenant_id, "kind": "stock", "batch_id": batch_id,
        "file_name": file.filename or "", "file_url": file_url, "created_at": now,
        "created_by": ctx.get("admin_id"), "created_by_name": ctx.get("admin_name") or ctx.get("admin_email") or "",
        "rows_applied": applied, "rows_skipped": len(skipped),
        "location_totals": totals, "changes": changes, "rolled_back": False,
        "products_created": created_products, "products_created_count": len(created_products),
    }
    await data_hub_imports_collection.insert_one(log)

    return {
        "status": "success", "mode": "committed", "import_type": "stock_snapshot", "batch_id": batch_id,
        "rows_applied": applied, "rows_skipped": len(skipped), "locations_written": len(changes),
        "location_totals": totals, "skipped_rows": skipped[:PREVIEW_ROWS],
        "skipped_breakdown": _error_breakdown(rows),
        "products_created": created_products, "products_created_count": len(created_products),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Product catalogue enrichment (Raphaaa only)
# -----------------------------------------------------------------------------

async def _raphaaa_enrichment_context(ctx: TenantCtx = Depends(_pilot_context)) -> TenantCtx:
    if not is_raphaaa_tenant(ctx["tenant_id"]):
        raise HTTPException(status_code=404, detail="Product cleanup is enabled only for the Raphaaa tenant.")
    return ctx


def _enrichment_preview_row(product: dict) -> dict:
    patch = enrichment_patch(product)
    current_issues = product_quality_issues(product)
    return {
        "product_id": str(product["_id"]),
        "barcode": _text(product.get("barcode")),
        "sku": _text(product.get("sku") or product.get("base_sku")),
        "current_name": _text(product.get("product_name")),
        "proposed_name": proposed_product_name(product),
        "name_will_change": "product_name" in patch and patch["product_name"] != _text(product.get("product_name")),
        "division": _text(product.get("division")),
        "section": _text(product.get("section")),
        "department": _text(product.get("department")),
        "design_no": _text(product.get("design_no") or product.get("category1")),
        "brand": patch["brand"],
        "style": patch["style"],
        "product_type": patch["product_type"],
        "size": patch["size"],
        "vendor_name": _text(product.get("vendor_name")),
        "vendor_linked": bool(product.get("vendor_id")),
        "issues": current_issues,
        "remaining_issues": patch["data_quality_issues"],
    }


@router.get("/products/enrichment/preview")
async def preview_product_enrichment(ctx: TenantCtx = Depends(_raphaaa_enrichment_context)):
    query = {"tenant_id": ctx["tenant_id"], "source": "data_hub_import"}
    products = await product_collection.find(query).sort("created_at", 1).to_list(length=PREVIEW_ROWS)
    rows = [_enrichment_preview_row(product) for product in products]
    total = await product_collection.count_documents(query)
    return {
        "status": "success",
        "mode": "preview_only",
        "summary": {
            "imported_products": total,
            "names_to_fix": sum(1 for row in rows if row["name_will_change"]),
            "brands_available_from_hierarchy": sum(1 for row in rows if row["brand"]),
            "vendors_unlinked": sum(1 for row in rows if row["vendor_name"] and not row["vendor_linked"]),
            "missing_hsn": sum(1 for row in rows if "missing_hsn" in row["remaining_issues"]),
            "missing_gst": sum(1 for row in rows if "missing_gst" in row["remaining_issues"]),
        },
        "rows": rows,
        "truncated": total > len(rows),
    }


@router.post("/products/enrichment/apply")
async def apply_product_enrichment(
    payload: ProductEnrichmentRequest,
    ctx: TenantCtx = Depends(_raphaaa_enrichment_context),
):
    if not payload.confirm:
        raise HTTPException(status_code=400, detail="Preview the cleanup first, then send confirm=true.")

    query = {"tenant_id": ctx["tenant_id"], "source": "data_hub_import"}
    now = datetime.utcnow()
    scanned = updated = names_fixed = stock_docs_synced = 0
    async for product in product_collection.find(query):
        scanned += 1
        patch = enrichment_patch(product, applied_at=now)
        patch["data_hub_enriched_by"] = ctx.get("admin_id")
        if patch.get("product_name") and patch["product_name"] != _text(product.get("product_name")):
            names_fixed += 1
        result = await product_collection.update_one(
            {"_id": product["_id"], "tenant_id": ctx["tenant_id"], "source": "data_hub_import"},
            {"$set": patch},
        )
        updated += result.modified_count

        # HQ Admin's Store-wise Inventory reads `description` off the physical
        # stock documents (a frozen snapshot from the last stock import), not
        # the Product Master — so without this it silently falls out of sync
        # with the name just fixed above, with no re-import to notice by.
        barcodes = [_text(product.get("barcode"))] + [
            _text(v.get("barcode")) for v in (product.get("variants") or []) if _text(v.get("barcode"))
        ]
        barcodes = [b for b in barcodes if b]
        if barcodes:
            new_description = patch.get("display_product_name") or _text(product.get("product_name"))
            stock_filter = {"tenant_id": ctx["tenant_id"], "barcode": {"$in": barcodes}}
            inv_result = await inventory_collection.update_many(stock_filter, {"$set": {"description": new_description}})
            store_result = await store_stock_collection.update_many(stock_filter, {"$set": {"description": new_description}})
            stock_docs_synced += inv_result.modified_count + store_result.modified_count

    return {
        "status": "success",
        "mode": "applied",
        "products_scanned": scanned,
        "products_updated": updated,
        "product_names_fixed": names_fixed,
        "stock_descriptions_synced": stock_docs_synced,
        "message": "Product Master metadata was enriched and matching stock-record descriptions (used by HQ Admin's Store-wise Inventory) were refreshed to match. Stock quantities, barcodes and prices were not changed.",
    }


# ─────────────────────────────────────────────────────────────────────────────
# Unstitched stock import (Raphaaa only)
#
# Cut / unstitched pieces waiting to be stitched: Design No., Department,
# Description, PCS, Fabric Consume. Stored per design in its own collection —
# never in products / inventory / store_stock — so these pieces can never be
# counted as sellable stock by any existing screen. The Design Performance view
# reads it to suggest "stitch N pcs" for designs that are selling well.
# Absolute snapshot per design (a design absent from the file is untouched;
# put 0 pieces to clear one). Reversible through the normal import rollback.
# ─────────────────────────────────────────────────────────────────────────────

_UNSTITCHED_DESIGN_ALIASES = ("design no.", "design no", "design number", "design", "cat-1 (design no.)", "category1", "cat1")
_UNSTITCHED_PCS_ALIASES = ("pcs", "pieces", "piece", "unstitched pcs", "unstitched qty", "qty", "quantity")
_UNSTITCHED_FABRIC_ALIASES = ("fabric consume", "fabric consumed", "fabric consumption", "fabric used", "fabric")
_UNSTITCHED_SKIP_DESIGNS = {"total", "grandtotal", "subtotal"}
_LEADING_NUMBER_RE = re.compile(r"^\s*(-?\d+(?:\.\d+)?)")
_UNIT_TAIL_RE = re.compile(r"([a-zA-Z]+)\s*$")


def _number_and_unit(value: Any) -> tuple:
    """Fabric Consume routinely carries its unit in the same cell ("22.372 KG",
    "26.10 MTR") — the number is parsed by taking the leading numeric token and
    the unit is whatever alphabetic text trails it, rather than requiring the
    cell to be a bare number."""
    text = _text(value).replace(",", "")
    if not text:
        return 0.0, ""
    match = _LEADING_NUMBER_RE.match(text)
    if not match:
        return None, ""
    unit_match = _UNIT_TAIL_RE.search(text)
    unit = unit_match.group(1).strip().upper() if unit_match else ""
    try:
        return float(match.group(1)), unit
    except ValueError:
        return None, ""


def _design_key(value: Any) -> str:
    return re.sub(r"\s+", " ", _text(value)).lower()


def _read_unstitched_rows(filename: str, content: bytes) -> List[dict]:
    name = (filename or "").lower()
    try:
        if name.endswith(".csv"):
            frames = [pd.read_csv(io.BytesIO(content), dtype=str)]
        elif name.endswith((".xlsx", ".xls")):
            frames = list(pd.read_excel(io.BytesIO(content), dtype=str, sheet_name=None).values())
        else:
            raise HTTPException(status_code=400, detail="Upload a CSV or Excel file (.csv, .xlsx, .xls).")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="The file could not be read. Download the template and keep the headers unchanged.")

    design_keys = {_key(alias) for alias in _UNSTITCHED_DESIGN_ALIASES}
    pcs_keys = {_key(alias) for alias in _UNSTITCHED_PCS_ALIASES}
    usable = []
    for frame in frames:
        frame.columns = [_key(column) for column in frame.columns]
        columns = set(frame.columns)
        if columns & design_keys and columns & pcs_keys and len(frame.index) > 0:
            usable.append(frame)
    if not usable:
        raise HTTPException(status_code=400, detail="No sheet with both a 'Design No.' and a 'PCS' column was found. Download the template and keep the headers unchanged.")
    frame = pd.concat(usable, ignore_index=True, sort=False) if len(usable) > 1 else usable[0]
    frame = frame.where(pd.notnull(frame), "")
    if len(frame.index) > MAX_ROWS:
        raise HTTPException(status_code=400, detail=f"A maximum of {MAX_ROWS:,} rows is allowed per file.")
    return frame.to_dict(orient="records")


def _unstitched_rows(raw_rows: List[dict], fabric_basis: str = "total") -> tuple[List[dict], List[dict]]:
    """Returns (designs, error_rows). Rows of the same design are summed.

    fabric_basis "total": the Fabric Consume value is the total for that row's
    PCS. "per_piece": it is the fabric for one piece, so the row total is
    value x PCS. Either way both figures are stored.
    """
    designs: Dict[str, dict] = {}
    error_rows: List[dict] = []
    for index, raw in enumerate(raw_rows, start=2):
        design_no = re.sub(r"\s+", " ", _column(raw, *_UNSTITCHED_DESIGN_ALIASES))
        pcs_text = _column(raw, *_UNSTITCHED_PCS_ALIASES)
        fabric_text = _column(raw, *_UNSTITCHED_FABRIC_ALIASES)
        department = _column(raw, "department", "dept")
        description = _column(raw, "description", "desc")
        if not design_no and not pcs_text and not fabric_text:
            continue
        if _key(design_no) in _UNSTITCHED_SKIP_DESIGNS:
            continue
        errors: List[str] = []
        pcs = _number(pcs_text)
        fabric, fabric_unit = _number_and_unit(fabric_text)
        if not design_no:
            errors.append("Design No. is missing.")
        if pcs is None:
            errors.append("PCS must be a number.")
        elif pcs < 0:
            errors.append("PCS must be zero or greater.")
        if fabric is None:
            errors.append("Fabric Consume must be a number.")
        elif fabric < 0:
            errors.append("Fabric Consume must be zero or greater.")
        if errors:
            error_rows.append({"row_no": index, "design_no": design_no, "department": department,
                               "description": description, "pcs": pcs_text, "fabric_total": fabric_text, "errors": errors})
            continue
        row_fabric_total = fabric * pcs if fabric_basis == "per_piece" else fabric
        key = _design_key(design_no)
        entry = designs.setdefault(key, {
            "design_key": key, "design_no": design_no, "department": "", "description": "",
            "pcs": 0.0, "fabric_total": 0.0, "fabric_unit": "", "unit_mismatch": False, "rows": 0, "errors": [],
        })
        entry["pcs"] += pcs
        entry["fabric_total"] += row_fabric_total
        entry["rows"] += 1
        entry["department"] = entry["department"] or department
        entry["description"] = entry["description"] or description
        if fabric_unit:
            if entry["fabric_unit"] and entry["fabric_unit"] != fabric_unit:
                entry["unit_mismatch"] = True
            else:
                entry["fabric_unit"] = fabric_unit
    result = []
    for entry in designs.values():
        entry["pcs"] = round(entry["pcs"], 2)
        entry["fabric_total"] = round(entry["fabric_total"], 3)
        entry["fabric_per_piece"] = round(entry["fabric_total"] / entry["pcs"], 3) if entry["pcs"] > 0 else 0.0
        result.append(entry)
    return result, error_rows


async def _catalogue_design_keys(tenant_id: str) -> set:
    keys: set = set()
    async for product in product_collection.find({"tenant_id": tenant_id}, {"design_no": 1, "category1": 1}):
        key = _design_key(product.get("design_no") or product.get("category1"))
        if key:
            keys.add(key)
    return keys


def _clean_fabric_basis(value: str) -> str:
    return "per_piece" if _key(value) == "perpiece" else "total"


def _fabric_by_unit(designs: List[dict]) -> Dict[str, float]:
    totals: Dict[str, float] = {}
    for entry in designs:
        unit = entry.get("fabric_unit") or "Unspecified"
        totals[unit] = round(totals.get(unit, 0.0) + entry["fabric_total"], 3)
    return totals


@router.post("/unstitched/preview")
async def preview_unstitched_stock(
    file: UploadFile = File(...),
    fabric_basis: str = Form("total"),
    ctx: TenantCtx = Depends(_raphaaa_enrichment_context),
):
    basis = _clean_fabric_basis(fabric_basis)
    raw_rows = _read_unstitched_rows(file.filename or "", await file.read())
    designs, error_rows = _unstitched_rows(raw_rows, basis)
    known = await _catalogue_design_keys(ctx["tenant_id"])
    packs = best_tech_packs([
        pack async for pack in tech_packs_collection.find(
            {"tenant_id": ctx["tenant_id"]},
            {"design_no": 1, "tech_pack_no": 1, "version": 1, "status": 1, "updated_at": 1, "created_at": 1},
        )
    ])
    rows = [
        {
            **entry, "in_catalogue": entry["design_key"] in known, "errors": [],
            "tech_pack_no": (packs.get(entry["design_key"]) or {}).get("tech_pack_no", ""),
            "tech_pack_label": tech_pack_label((packs.get(entry["design_key"]) or {}).get("state")),
        }
        for entry in designs
    ]
    rows.sort(key=lambda row: row["pcs"], reverse=True)
    return {
        "status": "success", "mode": "preview_only", "import_type": "unstitched_stock",
        "fabric_basis": basis,
        "summary": {
            "designs": len(designs), "total_pcs": round(sum(entry["pcs"] for entry in designs), 2),
            "fabric_by_unit": _fabric_by_unit(designs),
            "error_rows": len(error_rows),
            "designs_not_in_catalogue": sum(1 for row in rows if not row["in_catalogue"]),
            "unit_mismatch_designs": sum(1 for entry in designs if entry.get("unit_mismatch")),
            "designs_without_tech_pack": sum(1 for row in rows if row["tech_pack_label"] == "Missing"),
        },
        "rows": (error_rows + rows)[:PREVIEW_ROWS],
        "truncated": len(rows) + len(error_rows) > PREVIEW_ROWS,
    }


@router.post("/unstitched/commit")
async def commit_unstitched_stock(
    file: UploadFile = File(...),
    confirm: bool = Form(False),
    fabric_basis: str = Form("total"),
    ctx: TenantCtx = Depends(_raphaaa_enrichment_context),
):
    if not confirm:
        raise HTTPException(status_code=400, detail="Send confirm=true to write this unstitched stock into RMS.")
    tenant_id = ctx["tenant_id"]
    basis = _clean_fabric_basis(fabric_basis)
    file_content = await file.read()
    raw_rows = _read_unstitched_rows(file.filename or "", file_content)
    designs, error_rows = _unstitched_rows(raw_rows, basis)
    if not designs:
        raise HTTPException(status_code=400, detail="No valid rows to import.")
    file_url = _archive_uploaded_file(tenant_id, file.filename or "unstitched.xlsx", file_content)

    batch_id = uuid.uuid4().hex
    now = datetime.utcnow()
    changes: List[dict] = []
    for entry in designs:
        flt = {"tenant_id": tenant_id, "design_key": entry["design_key"]}
        existing = await unstitched_stock_collection.find_one(flt)
        previous = {
            "design_no": (existing or {}).get("design_no"), "department": (existing or {}).get("department"),
            "description": (existing or {}).get("description"), "pcs": (existing or {}).get("pcs"),
            "fabric_total": (existing or {}).get("fabric_total"),
            "fabric_per_piece": (existing or {}).get("fabric_per_piece"),
            "fabric_unit": (existing or {}).get("fabric_unit"),
            "data_hub_batch_id": (existing or {}).get("data_hub_batch_id"),
        }
        await unstitched_stock_collection.update_one(
            flt,
            {
                "$set": {
                    **flt, "design_no": entry["design_no"], "department": entry["department"],
                    "description": entry["description"], "pcs": entry["pcs"],
                    "fabric_total": entry["fabric_total"], "fabric_per_piece": entry["fabric_per_piece"],
                    "fabric_unit": entry.get("fabric_unit") or "",
                    "source": "data_hub_import", "data_hub_batch_id": batch_id, "updatedAt": now,
                },
                "$setOnInsert": {"createdAt": now},
            },
            upsert=True,
        )
        changes.append({
            "design_key": entry["design_key"], "design_no": entry["design_no"],
            "existed": existing is not None, "previous": previous,
        })

    total_pcs = round(sum(entry["pcs"] for entry in designs), 2)
    await data_hub_imports_collection.insert_one({
        "tenant_id": tenant_id, "kind": "unstitched", "batch_id": batch_id,
        "file_name": file.filename or "", "file_url": file_url, "created_at": now,
        "created_by": ctx.get("admin_id"), "created_by_name": ctx.get("admin_name") or ctx.get("admin_email") or "",
        "rows_applied": len(designs), "rows_skipped": len(error_rows),
        "location_totals": {"Unstitched pieces": total_pcs}, "changes": changes, "rolled_back": False,
        "fabric_basis": basis,
    })
    return {
        "status": "success", "mode": "committed", "import_type": "unstitched_stock", "batch_id": batch_id,
        "rows_applied": len(designs), "rows_skipped": len(error_rows), "total_pcs": total_pcs,
        "fabric_by_unit": _fabric_by_unit(designs),
        "skipped_rows": error_rows[:PREVIEW_ROWS],
    }


# Import history + rollback
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/imports")
async def list_imports(ctx: TenantCtx = Depends(_pilot_context)):
    rows = []
    async for doc in data_hub_imports_collection.find({"tenant_id": ctx["tenant_id"]}).sort("created_at", -1).limit(100):
        rows.append({
            "batch_id": doc.get("batch_id"), "kind": doc.get("kind"),
            "file_name": doc.get("file_name", ""), "file_url": doc.get("file_url", ""), "created_at": doc.get("created_at"),
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
    elif doc["kind"] == "unstitched":
        for change in doc.get("changes", []):
            flt = {"tenant_id": tenant_id, "design_key": change["design_key"], "data_hub_batch_id": batch_id}
            if change["existed"]:
                previous = change.get("previous") or {}
                updated = await unstitched_stock_collection.update_one(flt, {"$set": {
                    "design_no": previous.get("design_no"), "department": previous.get("department"),
                    "description": previous.get("description"), "pcs": previous.get("pcs") or 0,
                    "fabric_total": previous.get("fabric_total") or 0,
                    "fabric_per_piece": previous.get("fabric_per_piece") or 0,
                    "fabric_unit": previous.get("fabric_unit") or "",
                    "data_hub_batch_id": previous.get("data_hub_batch_id") or "",
                    "source": "data_hub_rollback", "updatedAt": now,
                }})
                reverted += updated.modified_count
            else:
                deleted = await unstitched_stock_collection.delete_one(flt)
                reverted += deleted.deleted_count
    else:
        for change in doc.get("changes", []):
            if change["location"] == CENTRAL_LABEL:
                collection = inventory_collection
                flt = {"tenant_id": tenant_id, "barcode": change["barcode"], "data_hub_batch_id": batch_id}
            else:
                collection = store_stock_collection
                flt = {"tenant_id": tenant_id, "barcode": change["barcode"], "store_id": change["store_id"], "data_hub_batch_id": batch_id}
            if change["existed"]:
                revert_fields: Dict[str, Any] = {"stockQty": change["previous_qty"], "source": "data_hub_rollback", "updatedAt": now}
                if change.get("previous_fresh_qty") is not None:
                    revert_fields["freshQty"] = change["previous_fresh_qty"]
                    revert_fields["agedQty"] = change["previous_aged_qty"]
                    revert_fields["agedAvgMonths"] = change.get("previous_aged_avg_months")
                if change.get("value_written"):
                    revert_fields["stockValue"] = change.get("previous_stock_value")
                updated = await collection.update_one(flt, {"$set": revert_fields})
                reverted += updated.modified_count
            else:
                deleted = await collection.delete_one(flt)
                reverted += deleted.deleted_count

        # This batch may have created genuinely-new products for stock that
        # had never been sold (see _new_product_doc_from_stock) — remove
        # them too, same safety rule as the sales-side rollback: only if no
        # stock is left against them (the reverts just above already zeroed
        # or removed this batch's own stock for that barcode).
        for barcode in doc.get("products_created", []):
            has_stock = await inventory_collection.find_one({"tenant_id": tenant_id, "barcode": barcode, "stockQty": {"$gt": 0}}) \
                or await store_stock_collection.find_one({"tenant_id": tenant_id, "barcode": barcode, "stockQty": {"$gt": 0}})
            if not has_stock:
                removed = await product_collection.delete_one(
                    {"tenant_id": tenant_id, "barcode": barcode, "source": "data_hub_import", "data_hub_batch_id": batch_id}
                )
                products_removed += removed.deleted_count

    await data_hub_imports_collection.update_one(
        {"_id": doc["_id"]},
        {"$set": {"rolled_back": True, "rolled_back_at": now, "rolled_back_by": ctx.get("admin_id"),
                  "rollback_touched": reverted, "rollback_products_removed": products_removed}},
    )
    return {"status": "success", "batch_id": batch_id, "kind": doc["kind"], "reverted": reverted, "products_removed": products_removed}


@router.delete("/imports/{batch_id}")
async def delete_import_log(batch_id: str, ctx: TenantCtx = Depends(_pilot_context)):
    """Remove a history entry. Only permitted once the import has been rolled
    back — deleting an active entry would leave its committed sales/stock in RMS
    with no audit trail and no way to revert it. Touches nothing but the log."""
    tenant_id = ctx["tenant_id"]
    doc = await data_hub_imports_collection.find_one({"tenant_id": tenant_id, "batch_id": batch_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Import batch not found for this tenant.")
    if not doc.get("rolled_back"):
        raise HTTPException(status_code=400, detail="Roll this import back before deleting its history entry.")
    await data_hub_imports_collection.delete_one({"_id": doc["_id"]})
    return {"status": "success", "batch_id": batch_id, "deleted": True}
