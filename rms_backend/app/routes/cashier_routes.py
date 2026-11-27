
from fastapi import APIRouter, Query, HTTPException, Header, BackgroundTasks
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from typing import Optional
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from bson import ObjectId
from pymongo import ReturnDocument
import os
import secrets
import re

from ..db import db, product_collection, inventory_collection, sales_collection, store_stock_collection, admins_collection, tenants_collection, grn_collection, stores_collection
from ..retailer_plans import retailer_plan_config
from .store_helper import get_store_context
from ..error_log import log_error
from ..email_utils import send_customer_pos_invoice_email
from ..whatsapp_bill_utils import send_bill_whatsapp, whatsapp_bill_configured
from ..product_identity import identity_fields
from ..utils import verify_password

# Return reasons that mean "this bill was wrong" rather than a genuine
# customer return — these need a manager to confirm before the credit
# note is issued, so a cashier can't self-authorize their own mistakes
# with zero oversight. Kept in sync with the frontend's REASONS_NEEDING_APPROVAL.
RETURN_REASONS_NEEDING_APPROVAL = {"Billing Error", "Wrong Item/Qty", "Price Correction", "Other"}

router = APIRouter(prefix="/cashier", tags=["Cashier POS"])

cashier_audit_collection = db["cashier_pos_audit_logs"]
cashier_shift_collection = db["cashier_shifts"]
cashier_invoice_counters_collection = db["cashier_invoice_counters"]
pos_terminals_collection = db["pos_terminals"]

# Tab-level access roles a physical POS terminal can hold. The login at a
# store is shared across every terminal, so restricted tabs (Dashboard,
# Finance, Reports) can't be gated per-login — they're gated per-device
# instead, keyed by the terminal_id each device already persists locally.
TERMINAL_ROLES = {"cashier", "supervisor"}
DEFAULT_TERMINAL_ROLE = "cashier"


def _public_invoice_url(token: str) -> str:
    frontend = os.getenv("FRONTEND_URL") or os.getenv("PUBLIC_FRONTEND_URL") or "https://rms.raphaaa.com"
    return f"{frontend.rstrip('/')}/invoice/{token}"


@router.get("/public/invoice/{token}")
async def get_public_invoice(token: str):
    """Unauthenticated — this is the page a customer lands on from the
    'View & download invoice' email button/link, so it deliberately returns
    only customer-facing fields. cost_price, tenant/store IDs, division-
    section-department classification, and every internal sync/audit field
    on the bill document are left out."""
    doc = await sales_collection.find_one({"share_token": token})
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    items = [
        {
            "name": item.get("name") or item.get("barcode") or "Item",
            "hsn": item.get("hsn", ""),
            "qty": item.get("qty", 0),
            "price": item.get("price", 0),
            "gst": item.get("gst", 0),
            "total": item.get("total", 0),
        }
        for item in (doc.get("items") or [])
    ]
    summary = doc.get("summary") or {}
    return {
        "status": "success",
        "data": {
            "invoice_no": doc.get("invoice_no", ""),
            "type": doc.get("type", "sale"),
            "original_invoice": doc.get("original_invoice", ""),
            "date": doc.get("date", ""),
            "store_name": doc.get("store_name", ""),
            "customer_name": doc.get("customer_name", ""),
            "payment_method": doc.get("payment_method", "Cash"),
            "items": items,
            "summary": {
                "total_sale": summary.get("total_sale", 0),
                "total_savings": summary.get("total_savings", 0),
                "taxable_amount": summary.get("taxable_amount", 0),
                "cgst_amount": summary.get("cgst_amount", 0),
                "sgst_amount": summary.get("sgst_amount", 0),
                "igst_amount": summary.get("igst_amount", 0),
                "total_gst": summary.get("total_gst", 0),
                "round_off": summary.get("round_off", 0),
                "net_payable": summary.get("net_payable", 0),
            },
        },
    }


async def _audit_pos(ctx: dict, action: str, details: dict = None):
    """Best-effort, but a failure here must not vanish silently — a missed
    POS audit entry is exactly the kind of gap that let the Petpooja-style
    under-reporting go undetected, so it gets escalated to error_logs_collection
    instead of being swallowed."""
    try:
        await cashier_audit_collection.insert_one({
            "tenant_id": ctx.get("tenant_id"),
            "store_id": ctx.get("store_id"),
            "store_name": ctx.get("store_name"),
            "cashier_name": ctx.get("admin_name") or ctx.get("name") or "POS",
            "action": action,
            "details": details or {},
            "created_at": datetime.utcnow(),
        })
    except Exception as exc:
        await log_error(
            source="cashier_routes._audit_pos",
            message=f"Failed to write POS audit entry for action '{action}'",
            exc=exc,
            context={"tenant_id": ctx.get("tenant_id"), "store_id": ctx.get("store_id"), "action": action},
        )


async def _require_store_context(authorization: str = None) -> dict:
    """Require a valid tenant-bound store admin/cashier token."""
    ctx = await get_store_context(authorization)
    if not ctx.get("tenant_id"):
        raise HTTPException(status_code=401, detail="Valid tenant authentication is required.")
    if ctx.get("scope") != "store" or not ctx.get("store_id"):
        raise HTTPException(status_code=403, detail="Cashier POS is available only to store-assigned users.")
    return ctx


def _store_scope(ctx: dict) -> dict:
    return {"tenant_id": ctx["tenant_id"], "store_id": ctx["store_id"]}


def _valid_email(value: str) -> bool:
    return bool(re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", str(value or "").strip()))


async def _require_report_context(authorization: str = None) -> dict:
    """Sales reports only: HQ sees every store in the tenant, a store admin
    sees only their own store. POS/billing operations stay store-only via
    _require_store_context above — this is deliberately looser, for
    read-only reporting only."""
    ctx = await get_store_context(authorization)
    if not ctx.get("tenant_id"):
        raise HTTPException(status_code=401, detail="Valid tenant authentication is required.")
    if ctx.get("scope") == "store" and not ctx.get("store_id"):
        raise HTTPException(status_code=403, detail="Store reports require a store-assigned account.")
    return ctx


def _report_scope(ctx: dict) -> dict:
    scope = {"tenant_id": ctx["tenant_id"]}
    if ctx.get("scope") == "store":
        scope["store_id"] = ctx["store_id"]
    return scope


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def _str(v) -> str:
    return str(v) if v else ""

def _float(v, default: float = 0.0) -> float:
    try:
        f = float(v or default)
        return f if f == f else default
    except Exception:
        return default

def _int(v, default: int = 0) -> int:
    try:
        return int(float(v or default))
    except Exception:
        return default


def _sale_product_snapshot(product: dict, variant: dict = None) -> dict:
    """category1-6/item_code/tax_description were never actually written
    anywhere in products.py -- they'd come out blank on every real bill
    even though this function reads them correctly. Falling back to the
    real fields that DO get written (design_no, brand, size_label, sku,
    gst_rate) means the Reports-tab export's Cat-1/Cat-2/Cat-5/Item
    Code/Tax Description columns show real data instead of staying empty
    forever. Cat-3 (Style) and Cat-4 (Plane/F-S/H-S) have no fallback --
    those attributes genuinely don't exist in the product model yet."""
    variant = variant or {}

    def pick(*keys):
        for key in keys:
            value = variant.get(key) or product.get(key)
            if value:
                return value
        return ""

    gst_rate = _float(product.get("gst_rate"))
    return {
        "item_code":       pick("item_code", "sku"),
        "vendor_name":     pick("vendor_name"),
        "category1":       pick("category1", "design_no"),
        "category2":       pick("category2", "brand"),
        "category3":       pick("category3"),
        "category4":       pick("category4"),
        "category5":       pick("category5", "size_label"),
        "category6":       pick("category6"),
        "tax_description": pick("tax_description") or (f"GST@{gst_rate:.0f}%" if gst_rate else ""),
    }


async def _latest_grn_receipt_date(tenant_id: str, barcode: str, through_date: str) -> str:
    next_day = (datetime.strptime(through_date, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")
    grn = await grn_collection.find_one(
        {"tenant_id": tenant_id, "status": "Posted", "items.barcode": barcode,
         "grnDate": {"$lt": next_day}},
        {"grnDate": 1}, sort=[("grnDate", -1)],
    )
    return str((grn or {}).get("grnDate") or "")[:10]


async def _get_product_info(barcode: str, tenant_id: str) -> dict:
    barcode = barcode.strip()

    p = await product_collection.find_one({"barcode": barcode, "tenant_id": tenant_id})
    if p and not p.get("has_variants"):
        price = (
            _float(p.get("selling_price")) or
            _float(p.get("mrp")) or
            _float(p.get("cost_price"))
        )
        return {
            "product_name": p.get("product_name", ""),
            "sku":          p.get("sku", ""),
            "cost_price":   _float(p.get("cost_price")),
            "rate":         price,
            "gst_rate":     _float(p.get("gst_rate")),
            "division":     p.get("division", ""),
            "section":      p.get("section", ""),
            "department":   p.get("department", ""),
            "unit":         p.get("unit", "pcs"),
            "quantity":     _float(p.get("quantity", 0)),
            "source":       (p.get("source") or "admin"),
            **_sale_product_snapshot(p),
            **identity_fields({**p, "product_id": str(p["_id"]), "barcode": barcode}),
        }

    p = await product_collection.find_one({"variants.barcode": barcode, "tenant_id": tenant_id})
    if p:
        for v in p.get("variants", []):
            if (v.get("barcode") or "").strip() == barcode:
                price = (
                    _float(v.get("selling_price")) or
                    _float(v.get("mrp")) or
                    _float(p.get("selling_price")) or
                    _float(p.get("mrp")) or
                    _float(p.get("cost_price"))
                )
                variant_id = str(v.get("id") or v.get("_id") or v.get("sku") or "")
                return {
                    "product_name": p.get("product_name", ""),
                    "sku":          v.get("sku", ""),
                    "cost_price":   _float(v.get("cost_price") or p.get("cost_price")),
                    "rate":         price,
                    "gst_rate":     _float(p.get("gst_rate")),
                    "division":     p.get("division", ""),
                    "section":      p.get("section", ""),
                    "department":   p.get("department", ""),
                    "unit":         v.get("unit", "pcs"),
                    "quantity":     _float(v.get("stock", 0)),
                    "source":       (p.get("source") or "admin"),
                    **_sale_product_snapshot(p, v),
                    **identity_fields({**p, **v, "product_id": str(p["_id"]), "variant_id": variant_id, "barcode": barcode}),
                }
    return {}


async def _inv_qty(barcode: str, tenant_id: str, store_id: str) -> float:
    """
    Stock lookup with store awareness.
    store_id = None  → reads from central inventory_collection
    store_id = "xyz" → reads from store_stock_collection
    """
    barcode = barcode.strip()
    if not barcode:
        return 0.0

    if store_id:
        doc = await store_stock_collection.find_one(
            {"barcode": barcode, "store_id": store_id, "tenant_id": tenant_id},
            {"stockQty": 1, "_id": 0}
        )
        if doc is not None:
            return float(doc.get("stockQty") or 0)
        return 0.0

    # Central inventory
    doc = await inventory_collection.find_one(
        {"barcode": barcode, "tenant_id": tenant_id}, {"stockQty": 1, "_id": 0}
    )
    if doc is not None:
        return float(doc.get("stockQty") or 0)

    p = await product_collection.find_one({"barcode": barcode, "tenant_id": tenant_id}, {"quantity": 1, "_id": 0})
    if p is not None:
        return float(p.get("quantity") or 0)

    p = await product_collection.find_one(
        {"variants.barcode": barcode, "tenant_id": tenant_id}, {"variants.$": 1, "_id": 0}
    )
    if p:
        variants = p.get("variants", [])
        if variants:
            return float(variants[0].get("stock") or 0)

    return 0.0


async def _is_allocated_to_store(barcode: str, tenant_id: str, store_id: str) -> bool:
    """True only if a store_stock_collection record exists for this exact
    barcode+store — i.e. it was actually transferred/allocated from central,
    not just that it exists somewhere in the tenant's catalogue. A record
    with stockQty 0 still counts (it was allocated, just sold out); only a
    missing record means central never sent it to this store at all, which
    is the case that let a cashier bill an item with nothing to deduct."""
    barcode = barcode.strip()
    if not barcode or not store_id:
        return False
    doc = await store_stock_collection.find_one(
        {"barcode": barcode, "store_id": store_id, "tenant_id": tenant_id}, {"_id": 1}
    )
    return doc is not None


async def _ensure_inventory_record(
    barcode:    str,
    store_id:   str = None,
    store_name: str = None,
    tenant_id:  str = None,
) -> dict | None:
    """
    Ensures a stock record exists for this barcode.
    store_id = None  → works on central inventory_collection (creates if missing)
    store_id = "xyz" → works on store_stock_collection (returns None if not allocated)
    """
    barcode = barcode.strip()

    if store_id:
        # Store mode — only sell what has been allocated from central
        stk = await store_stock_collection.find_one(
            {"barcode": barcode, "store_id": store_id, "tenant_id": tenant_id}
        )
        return stk  # None if not allocated

    # Central / HQ — create record from product data if missing
    stk = await inventory_collection.find_one({"barcode": barcode, "tenant_id": tenant_id})
    if stk:
        return stk

    product_info = await _get_product_info(barcode, tenant_id)
    if not product_info:
        return None

    new_doc = {
        "barcode":     barcode,
        "tenant_id":   tenant_id,
        "stockQty":    product_info.get("quantity", 0),
        "rate":        product_info.get("rate", 0),
        "description": product_info.get("product_name", ""),
        "sku":         product_info.get("sku", ""),
        "division":    product_info.get("division", ""),
        "section":     product_info.get("section", ""),
        "department":  product_info.get("department", ""),
        "source":      product_info.get("source", "admin"),
        "vendor_name": "",
        "grn_no":      "",
        "store_id":    None,
        "adjustments": [],
        "createdAt":   datetime.utcnow(),
        "createdBy":   "pos_auto_init",
        **identity_fields({**product_info, "barcode": barcode}),
    }
    result = await inventory_collection.insert_one(new_doc)
    new_doc["_id"] = result.inserted_id
    return new_doc


async def _apply_stock_change(
    bc:           str,
    qty_change:   int,
    invoice_no:   str,
    cashier_name: str,
    is_return:    bool,
    now:          datetime,
    store_id:     str = None,
    store_name:   str = None,
    tenant_id:    str = None,
) -> dict:
    """
    Apply stock change using _id (guaranteed match).
    store_id = None  → updates central inventory_collection
    store_id = "xyz" → updates store_stock_collection
    """
    stk = await _ensure_inventory_record(bc, store_id=store_id, store_name=store_name, tenant_id=tenant_id)
    if stk is None:
        reason = "not_allocated_to_store" if store_id else "product_not_found"
        return {"updated": False, "reason": reason, "barcode": bc}

    doc_id      = stk["_id"]
    current_qty = float(stk.get("stockQty") or 0)
    new_qty     = current_qty + qty_change

    collection = store_stock_collection if store_id else inventory_collection

    central_segment_set = None
    if not store_id and str(tenant_id or "").strip().lower() == "citimart":
        raw = stk.get("central_segments") or {}
        segments = {key: float(raw.get(key, 0) or 0) for key in ("MAIN", "PACKED", "SEMI_FRESH")}
        if not any(segments.values()) and current_qty:
            segments["MAIN"] = current_qty
        if qty_change >= 0:
            segments["MAIN"] += qty_change
        else:
            remaining = -qty_change
            for key in ("MAIN", "PACKED", "SEMI_FRESH"):
                used = min(segments[key], remaining)
                segments[key] -= used
                remaining -= used
            if remaining:
                segments["MAIN"] -= remaining
        central_segment_set = {"central_segments": segments, "central_segments_total": sum(segments.values()), "stockQty": sum(segments.values())}

    result = await collection.update_one(
        {"_id": doc_id, "tenant_id": tenant_id, "store_id": store_id},
        {
            **({"$set": central_segment_set} if central_segment_set else {"$inc": {"stockQty": qty_change}}),
            "$push": {
                "adjustments": {
                    "qty_change": qty_change,
                    "reason":     f"POS {'Return' if is_return else 'Sale'} · {invoice_no}",
                    "adjustedBy": cashier_name or "POS",
                    "adjustedAt": now.isoformat(),
                    "ref_no":     invoice_no,
                    "source":     "pos_sale",
                    "is_return":  is_return,
                    "store_id":   store_id,
                }
            },
        }
    )

    return {
        "updated":       result.modified_count == 1,
        "barcode":       bc,
        "old_qty":       current_qty,
        "new_qty":       new_qty,
        "qty_change":    qty_change,
        "went_negative": new_qty < 0,
        "was_auto_init": stk.get("createdBy") == "pos_auto_init",
    }


def _product_to_pos(p: dict, inv_qty: float = 0.0) -> dict:
    price = (
        _float(p.get("selling_price")) or
        _float(p.get("mrp"))           or
        _float(p.get("cost_price"))
    )
    return {
        "_id":          _str(p.get("_id")),
        "name":         p.get("product_name", ""),
        "barcode":      (p.get("barcode") or "").strip(),
        "hsn":          p.get("hsn_code", ""),
        "price":        price,
        "mrp":          _float(p.get("mrp")),
        "cost_price":   _float(p.get("cost_price")),
        "gst":          _float(p.get("gst_rate")),
        "itemDiscount": _float(p.get("item_discount")),
        "sku":          p.get("sku", ""),
        "division":     p.get("division", ""),
        "section":      p.get("section", ""),
        "department":   p.get("department", ""),
        "vendor_name":  p.get("vendor_name", ""),
        "brand":        p.get("brand", ""),
        "unit":         p.get("unit", "pcs"),
        "stock":        round(inv_qty, 2),
        "has_variants": False,
        **identity_fields({**p, "product_id": _str(p.get("_id"))}),
    }


def _variant_to_pos(p: dict, v: dict, inv_qty: float = 0.0) -> dict:
    parts = [p.get("product_name", "")]
    if v.get("size_label"): parts.append(v["size_label"])
    if v.get("color"):      parts.append(v["color"])
    price = (
        _float(v.get("selling_price")) or _float(v.get("mrp")) or
        _float(p.get("selling_price")) or _float(p.get("mrp")) or
        _float(p.get("cost_price"))
    )
    variant_id = _str(v.get("id") or v.get("_id") or v.get("sku"))
    return {
        "_id":          _str(p.get("_id")) + "_" + (v.get("barcode", "").strip()),
        "name":         " | ".join(filter(None, parts)),
        "barcode":      (v.get("barcode") or "").strip(),
        "hsn":          p.get("hsn_code", ""),
        "price":        price,
        "mrp":          _float(v.get("mrp") or p.get("mrp")),
        "cost_price":   _float(v.get("cost_price") or p.get("cost_price")),
        "gst":          _float(p.get("gst_rate")),
        "itemDiscount": 0.0,
        "sku":          v.get("sku", ""),
        "division":     p.get("division", ""),
        "section":      p.get("section", ""),
        "department":   p.get("department", ""),
        "vendor_name":  p.get("vendor_name", ""),
        "brand":        p.get("brand", ""),
        "unit":         v.get("unit", "pcs"),
        "stock":        round(inv_qty, 2),
        "has_variants": True,
        "size_label":   v.get("size_label", ""),
        "color":        v.get("color", ""),
        **identity_fields({**p, **v, "product_id": _str(p.get("_id")), "variant_id": variant_id}),
    }


async def _generate_invoice_no(is_return: bool, tenant_id: str, store_id: str) -> str:
    """Was `count_documents(...) + 1` — a read-then-use race: two cashiers at
    the same store finalizing a bill within the same moment could both read
    the same count and generate the identical invoice number, with no
    unique index to even catch the collision. A MongoDB atomic
    find_one_and_update $inc can't lose an increment under concurrency,
    which count-then-use fundamentally can.

    $setOnInsert seeds the counter from the real historical count only on
    the very first call ever for this tenant+store+type — existing stores
    already have thousands of real invoices under the old scheme, and this
    keeps their next number continuing from there instead of restarting at
    00001 and colliding with history. That seed read can itself race on the
    very first call (two requests both computing the base before either's
    document exists), but the upsert's insert is still atomic — only one
    request actually creates the counter document, so the sequence is
    still race-free from that point on; at worst the one-time seed is off
    by the few concurrent requests that lost that single race, which is
    far better than the unbounded, permanent duplication this replaces.
    """
    prefix = "CN" if is_return else "INV"
    sale_type = "return" if is_return else "sale"
    key = {"tenant_id": tenant_id, "store_id": store_id, "type": sale_type}

    existing = await cashier_invoice_counters_collection.find_one(key, {"_id": 1})
    if existing is None:
        base_count = await sales_collection.count_documents({**key})
        await cashier_invoice_counters_collection.update_one(
            key, {"$setOnInsert": {**key, "seq": base_count}}, upsert=True
        )

    doc = await cashier_invoice_counters_collection.find_one_and_update(
        key, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER
    )
    seq = int(doc["seq"])
    now = datetime.utcnow()
    return f"NM/{prefix}/{now.strftime('%y%m')}/{str(seq).zfill(5)}"


def _is_vendor_only(p: dict) -> bool:
    source     = (p.get("source") or "").lower()
    created_by = (p.get("created_by") or "").upper()
    return (
        source == "vendor" or
        created_by == "VENDOR" or
        (p.get("vendor_id") and source not in ("grn", "admin"))
    )


def _default_dates():
    today = datetime.utcnow()
    first_of_month = today.replace(day=1).strftime("%Y-%m-%d")
    return first_of_month, today.strftime("%Y-%m-%d")


def _date_query(from_date: str, to_date: str) -> dict:
    return {"date": {"$gte": from_date, "$lte": to_date + " 23:59"}}


# ═══════════════════════════════════════════════════════════════════════════════
# DEBUG
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/debug/{barcode}")
async def debug_barcode(barcode: str, authorization: str = Header(None)):
    ctx = await _require_store_context(authorization)
    tenant_id = ctx["tenant_id"]
    barcode = barcode.strip()
    inv  = await inventory_collection.find_one({"barcode": barcode, "tenant_id": tenant_id})
    prod = await product_collection.find_one({"barcode": barcode, "tenant_id": tenant_id})
    var  = await product_collection.find_one({"variants.barcode": barcode, "tenant_id": tenant_id})
    pinfo = await _get_product_info(barcode, tenant_id)

    return {
        "barcode": barcode,
        "inventory_collection": {
            "found":    inv is not None,
            "doc_id":   str(inv["_id"]) if inv else None,
            "stockQty": inv.get("stockQty") if inv else None,
            "fields":   list(inv.keys()) if inv else [],
        },
        "product_simple": {
            "found":         prod is not None,
            "quantity":      prod.get("quantity") if prod else None,
            "selling_price": prod.get("selling_price") if prod else None,
            "mrp":           prod.get("mrp") if prod else None,
            "gst_rate":      prod.get("gst_rate") if prod else None,
        },
        "product_variant": {
            "found":  var is not None,
            "parent": var.get("product_name") if var else None,
        },
        "resolved_stock":        await _inv_qty(barcode, tenant_id, ctx["store_id"]),
        "resolved_product_info": pinfo,
        "ensure_would_create":   inv is None and bool(pinfo),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# GET /cashier/lookup/{barcode}
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/lookup/{barcode}")
async def lookup_barcode(
    barcode:       str,
    authorization: str = Header(None),
):
    barcode  = barcode.strip()
    if not barcode:
        raise HTTPException(status_code=400, detail="Barcode cannot be empty.")

    store     = await _require_store_context(authorization)
    tenant_id = store["tenant_id"]
    store_id  = store["store_id"]

    p = await product_collection.find_one({"barcode": barcode, "tenant_id": tenant_id})
    if p and not p.get("has_variants"):
        if p.get("is_fabric"):
            raise HTTPException(status_code=404, detail="This is raw fabric stock, not a sellable product.")
        if _is_vendor_only(p):
            inv = await inventory_collection.find_one({"barcode": barcode, "tenant_id": tenant_id})
            if not inv:
                raise HTTPException(
                    status_code=404,
                    detail="Product not available for sale — not inducted via GRN."
                )
        if not await _is_allocated_to_store(barcode, tenant_id, store_id):
            raise HTTPException(
                status_code=409,
                detail=f"'{p.get('product_name') or barcode}' has not been allocated/transferred to this store yet — request a Stock Transfer from HQ before selling it."
            )
        qty = await _inv_qty(barcode, tenant_id, store_id)
        return JSONResponse({"status": "success", "data": _product_to_pos(p, qty)})

    p = await product_collection.find_one({"variants.barcode": barcode, "tenant_id": tenant_id})
    if p and p.get("is_fabric"):
        raise HTTPException(status_code=404, detail="This is raw fabric stock, not a sellable product.")
    if p:
        for v in p.get("variants", []):
            if (v.get("barcode") or "").strip() == barcode:
                if _is_vendor_only(p):
                    inv = await inventory_collection.find_one({"barcode": barcode, "tenant_id": tenant_id})
                    if not inv:
                        raise HTTPException(
                            status_code=404,
                            detail="Product not available for sale — not inducted via GRN."
                        )
                if not await _is_allocated_to_store(barcode, tenant_id, store_id):
                    raise HTTPException(
                        status_code=409,
                        detail=f"'{p.get('product_name') or barcode}' has not been allocated/transferred to this store yet — request a Stock Transfer from HQ before selling it."
                    )
                qty = await _inv_qty(barcode, tenant_id, store_id)
                return JSONResponse({"status": "success", "data": _variant_to_pos(p, v, qty)})

    raise HTTPException(status_code=404, detail=f"No product found for barcode '{barcode}'.")


# ═══════════════════════════════════════════════════════════════════════════════
# GET /cashier/search?q=
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/search")
async def search_products(
    q:             str = Query(..., min_length=1),
    authorization: str = Header(None),
):
    q        = q.strip()
    results  = []
    seen     = set()
    regex    = {"$regex": q, "$options": "i"}
    store     = await _require_store_context(authorization)
    tenant_id = store["tenant_id"]
    store_id  = store["store_id"]

    async for p in product_collection.find({
        "tenant_id": tenant_id,
        "is_fabric": {"$ne": True},
        "$or": [{"product_name": regex}, {"barcode": regex}, {"sku": regex}]
    }).limit(30):
        if not p.get("has_variants"):
            bc = (p.get("barcode") or "").strip()
            if bc and bc not in seen:
                if _is_vendor_only(p):
                    inv = await inventory_collection.find_one({"barcode": bc, "tenant_id": tenant_id})
                    if not inv:
                        continue
                if not await _is_allocated_to_store(bc, tenant_id, store_id):
                    continue
                seen.add(bc)
                qty = await _inv_qty(bc, tenant_id, store_id)
                results.append(_product_to_pos(p, qty))
        else:
            for v in p.get("variants", []):
                bc    = (v.get("barcode") or "").strip()
                vname = f"{p.get('product_name','')} {v.get('size_label','')} {v.get('color','')}".lower()
                if bc and bc not in seen and (
                    q.lower() in vname or q.lower() in bc.lower() or
                    q.lower() in p.get("product_name", "").lower()
                ):
                    if _is_vendor_only(p):
                        inv = await inventory_collection.find_one({"barcode": bc, "tenant_id": tenant_id})
                        if not inv:
                            continue
                    if not await _is_allocated_to_store(bc, tenant_id, store_id):
                        continue
                    seen.add(bc)
                    qty = await _inv_qty(bc, tenant_id, store_id)
                    results.append(_variant_to_pos(p, v, qty))
        if len(results) >= 20:
            break

    if len(results) < 5:
        async for p in product_collection.find({"variants.barcode": regex, "tenant_id": tenant_id, "is_fabric": {"$ne": True}}).limit(10):
            for v in p.get("variants", []):
                bc = (v.get("barcode") or "").strip()
                if bc and bc not in seen and q.lower() in bc.lower():
                    if _is_vendor_only(p):
                        inv = await inventory_collection.find_one({"barcode": bc, "tenant_id": tenant_id})
                        if not inv:
                            continue
                    if not await _is_allocated_to_store(bc, tenant_id, store_id):
                        continue
                    seen.add(bc)
                    qty = await _inv_qty(bc, tenant_id, store_id)
                    results.append(_variant_to_pos(p, v, qty))

    return JSONResponse({"status": "success", "count": len(results), "data": results})


# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/product-cache")
async def product_cache(
    authorization: str = Header(None),
    limit: int = Query(5000, ge=1, le=10000),
):
    """
    Store-wise POS catalogue snapshot for offline cashier billing.
    This is read-only: it does not create stock, invoices, or sales entries.
    """
    store = await _require_store_context(authorization)
    tenant_id = store["tenant_id"]
    store_id = store["store_id"]

    results = []
    seen = set()
    cursor = product_collection.find({"tenant_id": tenant_id, "is_fabric": {"$ne": True}}).limit(limit)
    async for p in cursor:
        if not p.get("has_variants"):
            bc = (p.get("barcode") or "").strip()
            if not bc or bc in seen:
                continue
            if _is_vendor_only(p):
                inv = await inventory_collection.find_one({"barcode": bc, "tenant_id": tenant_id})
                if not inv:
                    continue
            if not await _is_allocated_to_store(bc, tenant_id, store_id):
                continue
            qty = await _inv_qty(bc, tenant_id, store_id)
            seen.add(bc)
            results.append(_product_to_pos(p, qty))
        else:
            for v in p.get("variants", []):
                bc = (v.get("barcode") or "").strip()
                if not bc or bc in seen:
                    continue
                if _is_vendor_only(p):
                    inv = await inventory_collection.find_one({"barcode": bc, "tenant_id": tenant_id})
                    if not inv:
                        continue
                if not await _is_allocated_to_store(bc, tenant_id, store_id):
                    continue
                qty = await _inv_qty(bc, tenant_id, store_id)
                seen.add(bc)
                results.append(_variant_to_pos(p, v, qty))
                if len(results) >= limit:
                    break
        if len(results) >= limit:
            break

    return JSONResponse({
        "status": "success",
        "count": len(results),
        "cached_at": datetime.utcnow().isoformat(),
        "store_id": store_id,
        "data": results,
    })

# POST /cashier/verify-manager
# ═══════════════════════════════════════════════════════════════════════════════
# A cashier correcting their own billing mistake needs a manager/HQ admin
# to confirm it before the system issues a credit note — otherwise any
# cashier could self-authorize unlimited "returns" with no oversight. This
# checks credentials inline without creating a session, so the cashier's
# own login is untouched; it never issues a token, only a yes/no plus the
# approving admin's name for the audit trail.

@router.post("/verify-manager")
async def verify_manager(payload: dict, authorization: str = Header(None)):
    store = await _require_store_context(authorization)
    username = str(payload.get("username") or "").strip().lower()
    password = str(payload.get("password") or "")
    if not username or not password:
        raise HTTPException(status_code=400, detail="Manager username and password are required.")

    admin = await admins_collection.find_one({
        "tenant_id": store["tenant_id"],
        "email": {"$regex": f"^{re.escape(username)}$", "$options": "i"},
    })
    if not admin or admin.get("scope") != "hq":
        raise HTTPException(status_code=401, detail="No HQ manager account found with that username.")
    if admin.get("status") not in (None, "ACTIVE"):
        raise HTTPException(status_code=401, detail="That manager account is not active.")

    hashed = admin.get("hashed_password")
    if not hashed or not verify_password(password, hashed):
        raise HTTPException(status_code=401, detail="Incorrect manager password.")

    await _audit_pos(store, "manager_override_verified", {"manager_name": admin.get("name", username)})
    return {"status": "success", "manager_name": admin.get("name") or username}


# POST /cashier/bill
# ═══════════════════════════════════════════════════════════════════════════════

async def _send_bill_email_background(sale_id, customer_email, customer_name, store_name, invoice_no, date_label, net_payable, share_url, clean_items, payment_method):
    """Runs after the bill response has already gone back to the cashier —
    an SMTP send can take several seconds, and offline-sync was stacking
    that wait on every single queued bill, one after another. The send
    result is recorded on the sale afterwards instead of being returned
    inline, since the caller no longer waits for it."""
    email_sent = await send_customer_pos_invoice_email(
        customer_email, customer_name, store_name, invoice_no, date_label,
        net_payable, share_url, clean_items, payment_method,
    )
    await sales_collection.update_one({"_id": sale_id}, {"$set": {
        "customer_email_sent": email_sent,
        "customer_email_sent_at": datetime.utcnow() if email_sent else None,
    }})


async def _send_bill_whatsapp_background(sale_id, mobile, store_name, share_url):
    """Same fire-and-forget pattern as _send_bill_email_background above --
    the cashier's response doesn't wait on this, the result is just
    recorded onto the sale afterward."""
    sent = await send_bill_whatsapp(mobile, store_name, share_url, context=f"bill:{sale_id}")
    await sales_collection.update_one({"_id": sale_id}, {"$set": {
        "customer_whatsapp_sent": sent,
        "customer_whatsapp_sent_at": datetime.utcnow() if sent else None,
    }})


@router.post("/bill", status_code=201)
async def save_bill(
    payload:         dict,
    background_tasks: BackgroundTasks,
    authorization:   str = Header(None),
):
    is_return    = bool(payload.get("isReturn", False))
    items        = payload.get("items", [])
    summary      = payload.get("summary", {})
    bill_meta    = payload.get("bill", {})
    # Who assisted the sale on the floor — separate from the cashier
    # operating the till, for staff-level commission/performance tracking.
    salesman_code = str(bill_meta.get("salesmanCode") or "").strip()
    payment_split = bill_meta.get("paymentSplit") or payload.get("paymentSplit") or {}
    if not isinstance(payment_split, dict):
        payment_split = {}
    clean_payment_split = {
        "Cash": _float(payment_split.get("Cash")),
        "Card": _float(payment_split.get("Card")),
        "UPI":  _float(payment_split.get("UPI")),
    }
    split_total = sum(clean_payment_split.values())
    client_offline_id = str(payload.get("clientOfflineId") or "").strip()
    offline_invoice_no = str(payload.get("offlineInvoiceNo") or "").strip()
    created_offline_at = str(payload.get("createdOfflineAt") or "").strip()
    sync_source = str(payload.get("syncSource") or "").strip()
    # Identifies the physical POS machine, not the login — a store's shared
    # cashier login is used across several terminals, so this is a
    # per-device id/name the frontend generates and stores locally, carried
    # along on every bill independent of which shared credential signed in.
    terminal_id = str(payload.get("terminalId") or "").strip()
    terminal_name = str(payload.get("terminalName") or "").strip()

    store = await _require_store_context(authorization)
    tenant_id  = store["tenant_id"]
    store_id   = store["store_id"]
    store_name = store["store_name"]

    if client_offline_id:
        existing = await sales_collection.find_one({
            "tenant_id": tenant_id,
            "store_id": store_id,
            "client_offline_id": client_offline_id,
        })
        if existing:
            await _audit_pos(store, "offline_sync_duplicate", {
                "client_offline_id": client_offline_id,
                "invoice_no": existing.get("invoice_no", ""),
            })
            return {
                "status": "success",
                "invoice_no": existing.get("invoice_no", ""),
                "id": str(existing.get("_id", "")),
                "message": "Offline bill already synced.",
                "store_id": store_id,
                "duplicate": True,
                "sync_status": "already_synced",
                "share_url": existing.get("share_url", ""),
                "inventory_warnings": existing.get("inventory_warnings", []),
                "inventory_not_found": existing.get("inventory_not_found", []),
                "stock_conflicts": existing.get("stock_conflicts", []),
            }

    if not terminal_id or not terminal_name:
        raise HTTPException(status_code=400, detail="Set up this terminal with a name before saving a bill or credit note.")
    if len(terminal_name) > 40:
        raise HTTPException(status_code=400, detail="Terminal name must be 40 characters or fewer.")

    cashier_name = (store.get("admin_name") or bill_meta.get("cashierName") or "POS").strip()

    if is_return:
        original_invoice = (payload.get("originalInvoice") or "").strip()
        if not original_invoice:
            raise HTTPException(status_code=400, detail="Original invoice is required for a return.")
        original = await sales_collection.find_one({
            "invoice_no": original_invoice,
            "type": "sale",
            **_store_scope(store),
        })
        if not original:
            raise HTTPException(status_code=404, detail="Original invoice was not found in this store.")
        original_items = {str(i.get("barcode") or ""): i for i in original.get("items", [])}
        original_total = sum(_float(i.get("price")) * abs(_int(i.get("qty"))) for i in original.get("items", []))
        if original_total <= 0:
            raise HTTPException(status_code=400, detail="The original bill has no valid item value.")
        requested = {}
        for item in items:
            barcode = str(item.get("barcode") or "").strip()
            requested[barcode] = requested.get(barcode, 0) + abs(_int(item.get("qty")))
        if not requested or any(b not in original_items or qty <= 0 or qty > abs(_int(original_items[b].get("qty"))) for b, qty in requested.items()):
            raise HTTPException(status_code=400, detail="Return items and quantities must match the original bill.")
        returned_quantities = {}
        previous_credit = 0.0
        async for previous in sales_collection.find({"type": "return", "original_invoice": original_invoice, **_store_scope(store)}):
            previous_credit += _float(previous.get("summary", {}).get("net_payable"))
            for line in previous.get("items", []):
                barcode = str(line.get("barcode") or "")
                returned_quantities[barcode] = returned_quantities.get(barcode, 0) + abs(_int(line.get("qty")))
        if any(qty + returned_quantities.get(b, 0) > abs(_int(original_items[b].get("qty"))) for b, qty in requested.items()):
            raise HTTPException(status_code=400, detail="Return quantity exceeds the remaining quantity on the original bill.")
        returned_value = sum(_float(original_items[b].get("price")) * qty for b, qty in requested.items())
        original_paid = _float(original.get("summary", {}).get("net_payable"))
        expected_credit = min(int(returned_value * original_paid / original_total + 0.5), max(0.0, original_paid - previous_credit))
        if abs(_float(summary.get("netPayable")) - expected_credit) > 0.01:
            raise HTTPException(status_code=400, detail="Credit note value must match the amount paid for the returned items.")

        return_reason = str(payload.get("returnReason") or "").strip()
        if not return_reason:
            raise HTTPException(status_code=400, detail="A reason is required for every return.")
        if return_reason in RETURN_REASONS_NEEDING_APPROVAL and not payload.get("managerVerified"):
            raise HTTPException(status_code=403, detail="This return reason needs manager approval before it can be saved.")

    # Exchange: spend an earlier return's refund value against this new
    # purchase instead of it only ever being a standalone refund/credit
    # note with nothing to apply it to in the moment. Only valid on a new
    # sale, never on another return, and only once per original return —
    # re-validated server-side rather than trusting the claimed amount the
    # client sends, since that number drives real money.
    exchange_payload = payload.get("exchangeCredit") if not is_return else None
    exchange_original = None
    exchange_claimed_amount = 0.0
    exchange_against_invoice = ""
    if exchange_payload:
        exchange_against_invoice = str(exchange_payload.get("againstInvoice") or "").strip()
        exchange_claimed_amount = _float(exchange_payload.get("amount"))
        if not exchange_against_invoice or exchange_claimed_amount <= 0:
            raise HTTPException(status_code=400, detail="Invalid exchange credit reference.")
        exchange_original = await sales_collection.find_one({
            "invoice_no": exchange_against_invoice, "type": "return", **_store_scope(store),
        })
        if not exchange_original:
            raise HTTPException(status_code=404, detail="The return this exchange credit refers to was not found.")
        if not exchange_original.get("credit_note_only"):
            raise HTTPException(status_code=400, detail="This older return is not marked as an unused credit note; ask a manager to review it.")
        if exchange_original.get("exchange_consumed"):
            raise HTTPException(status_code=409, detail="This return's credit has already been used on another bill.")
        allowed_amount = _float(exchange_original.get("summary", {}).get("net_payable"))
        if abs(exchange_claimed_amount - allowed_amount) > 0.01:
            raise HTTPException(status_code=400, detail="Exchange credit amount does not match the original return.")
        if _float(summary.get("netPayable")) + 0.009 < allowed_amount:
            raise HTTPException(status_code=400, detail="The replacement purchase must be at least the credit note value.")

    if not items:
        raise HTTPException(status_code=400, detail="No items in bill.")

    now = datetime.utcnow()
    invoice_no = await _generate_invoice_no(is_return, tenant_id, store_id)

    clean_items = []
    for item in items:
        bc = (item.get("barcode") or "").strip()
        qty = abs(_int(item.get("qty", 0)))
        if not bc or qty == 0:
            continue
        product_info = await _get_product_info(bc, tenant_id)
        original_line = original_items.get(bc, {}) if is_return else {}
        receipt_date = (original_line.get("ageing_receipt_date", "") if is_return
                        else await _latest_grn_receipt_date(tenant_id, bc, now.strftime("%Y-%m-%d")))
        identity = identity_fields({**product_info, **item, "barcode": bc})
        clean_items.append({
            "barcode": bc,
            "sku": item.get("sku", ""),
            "name": item.get("name", ""),
            "hsn": item.get("hsn", ""),
            "qty": qty,
            "price": _float(item.get("price")),
            "mrp": _float(item.get("mrp")),
            "cost_price": _float(item.get("cost_price")),
            "gst": _float(item.get("gst")),
            "itemDiscount": _float(item.get("itemDiscount")),
            "total": _float(item.get("total")),
            "division": item.get("division", ""),
            "section": item.get("section", ""),
            "department": item.get("department", ""),
            "ageing_receipt_date": receipt_date,
            **{key: original_line.get(key, "") if is_return else product_info.get(key, "")
               for key in ("item_code", "vendor_name", "category1", "category2", "category3", "category4", "category5", "category6", "tax_description")},
            **identity,
        })

    if not clean_items:
        raise HTTPException(status_code=400, detail="No valid line items.")

    if exchange_original:
        gross = sum(item["qty"] * item["price"] for item in clean_items)
        discount = _float(bill_meta.get("discount"))
        offer = _float(bill_meta.get("appliedOffer"))
        if gross < 0 or discount < 0 or offer < 0 or (bill_meta.get("discountType") != "amount" and discount > 100):
            raise HTTPException(status_code=400, detail="Invalid bill discount.")
        deduction = min(discount, gross) if bill_meta.get("discountType") == "amount" else gross * discount / 100
        if deduction + offer > gross + 0.001:
            raise HTTPException(status_code=400, detail="Discount cannot exceed the bill total.")
        calculated_net = int(max(0.0, gross - deduction - offer) + 0.5)
        if abs(calculated_net - _float(summary.get("netPayable"))) > 0.01:
            raise HTTPException(status_code=400, detail="Bill total does not match its items and discount.")
        due = calculated_net - exchange_claimed_amount
        if due < -0.009:
            raise HTTPException(status_code=400, detail="The replacement purchase must be at least the credit note value.")
        if split_total > 0 and abs(split_total - due) > 0.01:
            raise HTTPException(status_code=400, detail="Split payments must match the amount due after credit.")
        if split_total <= 0 and bill_meta.get("paymentMethod", "Cash") == "Cash" and _float(payload.get("paidAmount")) + 0.01 < due:
            raise HTTPException(status_code=400, detail="Cash paid is less than the amount due after credit.")

    stock_conflicts = []
    if client_offline_id and not is_return:
        for item in clean_items:
            current_qty = await _inv_qty(item["barcode"], tenant_id, store_id)
            if current_qty < item["qty"]:
                stock_conflicts.append({
                    "barcode": item["barcode"],
                    "name": item.get("name", item["barcode"]),
                    "ordered_qty": item["qty"],
                    "available_at_sync": current_qty,
                    "short_by": item["qty"] - current_qty,
                })

    # The new bill's own net payable isn't known until its summary is
    # built below — but it's already in the incoming payload's `summary`
    # dict (same one the response/receipt uses), so the credit applied
    # here can never exceed what this specific bill actually costs.
    exchange_net_payable = _float(summary.get("netPayable"))
    exchange_applied = min(exchange_claimed_amount, exchange_net_payable) if exchange_original else 0.0
    exchange_refund_due = max(0.0, exchange_claimed_amount - exchange_net_payable) if exchange_original else 0.0

    share_token = secrets.token_urlsafe(18)
    bill_doc = {
        "invoice_no": invoice_no,
        "type": "return" if is_return else "sale",
        "credit_note_only": is_return,
        "original_invoice": payload.get("originalInvoice", ""),
        "return_reason": str(payload.get("returnReason") or "") if is_return else "",
        "return_approved_by": str(payload.get("managerName") or "") if is_return else "",
        "exchange_against_invoice": exchange_against_invoice,
        "exchange_credit_applied": exchange_applied,
        "exchange_refund_due": exchange_refund_due,
        "date": now.strftime("%Y-%m-%d %H:%M"),
        "cashier_name": cashier_name,
        "salesman_code": salesman_code,
        "customer_name": bill_meta.get("customerName", ""),
        "mobile": bill_meta.get("mobile", ""),
        "customer_email": str(bill_meta.get("customerEmail") or bill_meta.get("email") or "").strip().lower(),
        "payment_method": "Credit Note" if is_return else bill_meta.get("paymentMethod", "Cash"),
        "payment_split": clean_payment_split if split_total > 0 else {},
        "applied_offer": _float(bill_meta.get("appliedOffer")),
        "discount_pct": _float(bill_meta.get("discount")),
        "discount_type": str(bill_meta.get("discountType") or "percent"),
        "promotion_name": str(bill_meta.get("promotionName") or "").strip()[:120],
        "promotion_type": str(bill_meta.get("promotionType") or "").strip().lower()[:40],
        "paid_amount": _float(payload.get("paidAmount")),
        "change_return": _float(payload.get("changeReturn")),
        "items": clean_items,
        "tenant_id": tenant_id,
        "store_id": store_id,
        "store_name": store_name,
        "terminal_id": terminal_id,
        "terminal_name": terminal_name,
        "client_offline_id": client_offline_id,
        "offline_invoice_no": offline_invoice_no,
        "created_offline_at": created_offline_at,
        # client_offline_id is now also sent on the normal online Finalize
        # path (as an idempotency key, so a frozen tab retrying the same
        # request can't double-bill/double-deduct stock) — it no longer
        # implies this bill actually came through the offline queue.
        # sync_source is the only thing that means that.
        "sync_source": sync_source or "online_pos",
        "synced_from_offline": sync_source == "offline_pos",
        "sync_status": "synced" if sync_source == "offline_pos" else "online",
        "stock_conflicts": stock_conflicts,
        "inventory_warnings": [],
        "inventory_not_found": [],
        "share_token": share_token,
        "share_url": _public_invoice_url(share_token),
        "share_ready": True,
        "summary": {
            "total_sale": _float(summary.get("totalSale")),
            "total_savings": _float(summary.get("totalSavings")),
            "taxable_amount": _float(summary.get("taxableAmount")),
            "cgst_amount": _float(summary.get("cgstAmount")),
            "sgst_amount": _float(summary.get("sgstAmount")),
            "igst_amount": _float(summary.get("igstAmount")),
            "total_gst": _float(summary.get("totalGstAmount")),
            "round_off": _float(summary.get("roundOff")),
            "net_payable": _float(summary.get("netPayable")),
        },
        "created_at": now,
    }

    if exchange_original:
        claimed = await sales_collection.update_one(
            {"_id": exchange_original["_id"], "exchange_consumed": {"$ne": True}},
            {"$set": {
                "exchange_consumed": True,
                "exchange_consumed_by_invoice": invoice_no,
                "exchange_consumed_amount": exchange_applied,
            }},
        )
        if not claimed.modified_count:
            raise HTTPException(status_code=409, detail="This return's credit has already been used on another bill.")

    return_locked = False
    if is_return:
        lock = await sales_collection.update_one(
            {"_id": original["_id"], "return_processing": {"$exists": False}},
            {"$set": {"return_processing": invoice_no}},
        )
        if not lock.modified_count:
            raise HTTPException(status_code=409, detail="Another return is being processed for this invoice. Try again shortly.")
        return_locked = True
    try:
        if is_return:
            returned_quantities = {}
            previous_credit = 0.0
            async for previous in sales_collection.find({"type": "return", "original_invoice": original_invoice, **_store_scope(store)}):
                previous_credit += _float(previous.get("summary", {}).get("net_payable"))
                for line in previous.get("items", []):
                    barcode = str(line.get("barcode") or "")
                    returned_quantities[barcode] = returned_quantities.get(barcode, 0) + abs(_int(line.get("qty")))
            if any(qty + returned_quantities.get(b, 0) > abs(_int(original_items[b].get("qty"))) for b, qty in requested.items()):
                raise HTTPException(status_code=409, detail="Return quantity exceeds the remaining quantity on the original bill.")
            if expected_credit > max(0.0, original_paid - previous_credit) + 0.01:
                raise HTTPException(status_code=409, detail="Credit available changed. Reload the original bill.")
        result = await sales_collection.insert_one(bill_doc)
    except Exception:
        if exchange_original:
            await sales_collection.update_one(
                {"_id": exchange_original["_id"], "exchange_consumed_by_invoice": invoice_no},
                {"$unset": {"exchange_consumed": "", "exchange_consumed_by_invoice": "", "exchange_consumed_amount": ""}},
            )
        raise
    finally:
        if return_locked:
            await sales_collection.update_one({"_id": original["_id"], "return_processing": invoice_no}, {"$unset": {"return_processing": ""}})

    inventory_warnings = []
    inventory_not_found = []
    for item in clean_items:
        qty_change = item["qty"] if is_return else -item["qty"]
        update_result = await _apply_stock_change(
            bc=item["barcode"],
            qty_change=qty_change,
            invoice_no=invoice_no,
            cashier_name=cashier_name,
            is_return=is_return,
            now=now,
            store_id=store_id,
            store_name=store_name,
            tenant_id=tenant_id,
        )
        if not update_result["updated"]:
            inventory_not_found.append({
                "barcode": item["barcode"],
                "name": item.get("name", item["barcode"]),
                "reason": update_result.get("reason", "unknown"),
            })
        elif update_result.get("went_negative"):
            inventory_warnings.append(
                f"'{item['name']}' stock went negative ({update_result['old_qty']} -> {update_result['new_qty']})."
            )

    await sales_collection.update_one({"_id": result.inserted_id}, {"$set": {
        "inventory_warnings": inventory_warnings,
        "inventory_not_found": inventory_not_found,
        "stock_conflicts": stock_conflicts,
    }})
    await _audit_pos(store, "bill_saved", {
        "invoice_no": invoice_no,
        "type": "return" if is_return else "sale",
        "net_payable": bill_doc.get("summary", {}).get("net_payable", 0),
        "payment_method": bill_doc.get("payment_method"),
        "payment_split": bill_doc.get("payment_split", {}),
        "synced_from_offline": sync_source == "offline_pos",
        "stock_conflicts": stock_conflicts,
        "inventory_not_found": inventory_not_found,
    })

    customer_email = bill_doc.get("customer_email", "")
    email_queued = bool(customer_email and _valid_email(customer_email))
    if email_queued:
        background_tasks.add_task(
            _send_bill_email_background,
            result.inserted_id,
            customer_email,
            bill_doc.get("customer_name") or "Customer",
            store_name,
            invoice_no,
            bill_doc.get("date", ""),
            bill_doc.get("summary", {}).get("net_payable", 0),
            bill_doc.get("share_url", ""),
            clean_items,
            bill_doc.get("payment_method", "Cash"),
        )
        await _audit_pos(store, "bill_email_queued", {
            "invoice_no": invoice_no,
            "customer_email": customer_email,
        })

    mobile = bill_doc.get("mobile", "")
    whatsapp_queued = bool(mobile and whatsapp_bill_configured())
    if whatsapp_queued:
        background_tasks.add_task(
            _send_bill_whatsapp_background,
            result.inserted_id,
            mobile,
            store_name,
            bill_doc.get("share_url", ""),
        )
        await _audit_pos(store, "bill_whatsapp_queued", {
            "invoice_no": invoice_no,
            "mobile": mobile,
        })

    return {
        "status": "success",
        "invoice_no": invoice_no,
        "id": str(result.inserted_id),
        "message": f"{'Return bill' if is_return else 'Bill'} saved.",
        "store_id": store_id,
        "sync_status": bill_doc["sync_status"],
        "share_url": bill_doc.get("share_url", ""),
        "customer_email": bill_doc.get("customer_email", ""),
        "email_sent": False,
        "email_queued": email_queued,
        "whatsapp_sent": False,
        "whatsapp_queued": whatsapp_queued,
        "inventory_warnings": inventory_warnings,
        "inventory_not_found": inventory_not_found,
        "stock_conflicts": stock_conflicts,
        "exchange_credit_applied": exchange_applied,
        "exchange_refund_due": exchange_refund_due,
    }


# ???????????????????????????????????????????????????????????????????????????????
# CASHIER SHIFT + BILL SHARING
# ???????????????????????????????????????????????????????????????????????????????

def _shift_scope(ctx: dict, terminal_id: str) -> dict:
    """A store's shared cashier login runs on several physical POS
    terminals, so a shift must be scoped per-machine, not per-store —
    otherwise two terminals at the same store would share one shift record
    and each would see the other's sales in its own reconciliation.

    Backward compatible with shifts opened before terminal identity
    existed: those have no terminal_id field at all, so they also match
    here (querying None matches both an explicit null and a missing
    field) — any terminal can still find/close that one legacy shared
    shift, and every shift opened from here on is properly terminal-scoped.
    """
    scope = {**_store_scope(ctx), "status": "open"}
    if terminal_id:
        scope["$or"] = [{"terminal_id": terminal_id}, {"terminal_id": {"$in": [None, ""]}}]
    else:
        scope["terminal_id"] = {"$in": [None, ""]}
    return scope


@router.get("/shift/current")
async def current_shift(terminal_id: str = Query(""), authorization: str = Header(None)):
    ctx = await _require_store_context(authorization)
    shift = await cashier_shift_collection.find_one(_shift_scope(ctx, terminal_id), sort=[("opened_at", -1)])
    if not shift:
        return {"status": "success", "shift": None}
    shift["_id"] = str(shift["_id"])
    return {"status": "success", "shift": shift}


@router.post("/shift/open")
async def open_shift(payload: dict, authorization: str = Header(None)):
    ctx = await _require_store_context(authorization)
    terminal_id = str(payload.get("terminalId") or "").strip()
    terminal_name = str(payload.get("terminalName") or "").strip()
    existing = await cashier_shift_collection.find_one(_shift_scope(ctx, terminal_id))
    if existing:
        existing["_id"] = str(existing["_id"])
        return {"status": "success", "shift": existing, "message": "Shift already open."}
    now = datetime.utcnow()
    doc = {
        **_store_scope(ctx),
        "store_name": ctx.get("store_name", ""),
        "terminal_id": terminal_id,
        "terminal_name": terminal_name,
        "cashier_name": ctx.get("admin_name") or ctx.get("name") or "POS",
        "opening_cash": _float(payload.get("openingCash")),
        "status": "open",
        "opened_at": now,
        "opened_at_label": now.strftime("%Y-%m-%d %H:%M"),
    }
    result = await cashier_shift_collection.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    await _audit_pos(ctx, "shift_opened", {"shift_id": doc["_id"], "opening_cash": doc["opening_cash"], "terminal_name": terminal_name})
    return {"status": "success", "shift": doc}


@router.post("/shift/close")
async def close_shift(payload: dict, authorization: str = Header(None)):
    ctx = await _require_store_context(authorization)
    terminal_id = str(payload.get("terminalId") or "").strip()
    shift = await cashier_shift_collection.find_one(_shift_scope(ctx, terminal_id), sort=[("opened_at", -1)])
    if not shift:
        raise HTTPException(status_code=400, detail="No open shift found.")
    opened_at = shift.get("opened_at") or datetime.utcnow()
    now = datetime.utcnow()
    q = {**_store_scope(ctx), "type": "sale", "created_at": {"$gte": opened_at, "$lte": now}}
    # Reconciliation must only count THIS terminal's own sales once shifts
    # are per-machine — otherwise closing Counter 1's shift would also
    # pull in whatever Counter 2 sold during the same window. A legacy
    # shift (no terminal_id) predates per-terminal billing entirely, so it
    # keeps the old store-wide total on purpose.
    shift_terminal_id = shift.get("terminal_id") or ""
    if shift_terminal_id:
        q["terminal_id"] = shift_terminal_id
    cash_sales = 0.0
    total_sales = 0.0
    bill_count = 0
    async for doc in sales_collection.find(q):
        bill_count += 1
        amount = _float(doc.get("summary", {}).get("net_payable"))
        total_sales += amount
        split = doc.get("payment_split") or {}
        if split:
            cash_sales += _float(split.get("Cash"))
        elif (doc.get("payment_method") or "Cash") == "Cash":
            cash_sales += max(0.0, amount - _float(doc.get("exchange_credit_applied")))
    expected_cash = _float(shift.get("opening_cash")) + cash_sales
    counted_cash = _float(payload.get("countedCash"))
    mismatch = counted_cash - expected_cash
    update = {
        "status": "closed",
        "closed_at": now,
        "closed_at_label": now.strftime("%Y-%m-%d %H:%M"),
        "counted_cash": counted_cash,
        "expected_cash": expected_cash,
        "cash_sales": cash_sales,
        "total_sales": total_sales,
        "bill_count": bill_count,
        "cash_mismatch": mismatch,
        "notes": payload.get("notes", ""),
    }
    await cashier_shift_collection.update_one({"_id": shift["_id"]}, {"$set": update})
    await _audit_pos(ctx, "shift_closed", {"shift_id": str(shift["_id"]), **update})
    shift.update(update)
    shift["_id"] = str(shift["_id"])
    return {"status": "success", "shift": shift}


@router.get("/shift/last-closed")
async def last_closed_shift(terminal_id: str = Query(""), authorization: str = Header(None)):
    """What a cashier counted in the drawer when THIS terminal last closed
    — offered as a suggested opening cash for the new shift, since in
    practice that's usually the same float carried forward day to day.
    Always just a suggestion: the open-shift screen still lets it be
    edited before confirming, it's never applied automatically."""
    ctx = await _require_store_context(authorization)
    query = {**_store_scope(ctx), "status": "closed"}
    if terminal_id:
        query["terminal_id"] = terminal_id
    shift = await cashier_shift_collection.find_one(query, sort=[("closed_at", -1)])
    if not shift:
        return {"status": "success", "found": False}
    return {
        "status": "success", "found": True,
        "counted_cash": _float(shift.get("counted_cash")),
        "closed_at_label": shift.get("closed_at_label", ""),
    }


@router.get("/shift/drawer-summary")
async def drawer_summary(terminal_id: str = Query(""), authorization: str = Header(None)):
    """Read-only preview of the SAME reconciliation close_shift computes —
    a cashier can check what's in the drawer mid-shift without actually
    closing it. Nothing here is written anywhere; the real recorded
    reconciliation still only happens at an actual shift close."""
    ctx = await _require_store_context(authorization)
    shift = await cashier_shift_collection.find_one(_shift_scope(ctx, terminal_id), sort=[("opened_at", -1)])
    if not shift:
        raise HTTPException(status_code=400, detail="No open shift found for this terminal.")
    opened_at = shift.get("opened_at") or datetime.utcnow()
    now = datetime.utcnow()
    q = {**_store_scope(ctx), "type": "sale", "created_at": {"$gte": opened_at, "$lte": now}}
    shift_terminal_id = shift.get("terminal_id") or ""
    if shift_terminal_id:
        q["terminal_id"] = shift_terminal_id

    payment_totals = {"Cash": 0.0, "Card": 0.0, "UPI": 0.0}
    total_sales = 0.0
    bill_count = 0
    async for doc in sales_collection.find(q):
        bill_count += 1
        amount = _float(doc.get("summary", {}).get("net_payable"))
        total_sales += amount
        split = doc.get("payment_split") or {}
        if split:
            for method in ("Cash", "Card", "UPI"):
                payment_totals[method] += _float(split.get(method))
        else:
            method = doc.get("payment_method") or "Cash"
            payment_totals[method] = payment_totals.get(method, 0.0) + max(0.0, amount - _float(doc.get("exchange_credit_applied")))

    expected_cash = _float(shift.get("opening_cash")) + payment_totals["Cash"]
    return_query = {**q, "type": "return"}
    return_count = 0
    return_total = 0.0
    async for doc in sales_collection.find(return_query):
        return_count += 1
        return_total += _float(doc.get("summary", {}).get("net_payable"))
    return {
        "status": "success",
        "shift_id": str(shift["_id"]),
        "terminal_id": shift_terminal_id,
        "terminal_name": shift.get("terminal_name", ""),
        "opened_at_label": shift.get("opened_at_label", ""),
        "opening_cash": _float(shift.get("opening_cash")),
        "payment_totals": {k: round(v, 2) for k, v in payment_totals.items()},
        "total_sales": round(total_sales, 2),
        "bill_count": bill_count,
        "return_count": return_count,
        "return_total": round(return_total, 2),
        "expected_cash": round(expected_cash, 2),
    }


@router.post("/bill/{invoice_no:path}/share")
async def prepare_bill_share(invoice_no: str, authorization: str = Header(None)):
    ctx = await _require_store_context(authorization)
    doc = await sales_collection.find_one({"invoice_no": invoice_no, **_store_scope(ctx)})
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    token = doc.get("share_token") or secrets.token_urlsafe(18)
    share_url = doc.get("share_url") or _public_invoice_url(token)
    await sales_collection.update_one({"_id": doc["_id"]}, {"$set": {"share_token": token, "share_url": share_url, "share_ready": True}})
    await _audit_pos(ctx, "bill_share_prepared", {"invoice_no": invoice_no, "mobile": doc.get("mobile", ""), "share_url": share_url})
    whatsapp_url = ""
    mobile = "".join(ch for ch in str(doc.get("mobile", "")) if ch.isdigit())
    if mobile:
        whatsapp_url = f"https://wa.me/91{mobile[-10:]}?text=Your%20RMS%20invoice%20{invoice_no}%20is%20ready:%20{share_url}"
    return {"status": "success", "invoice_no": invoice_no, "share_url": share_url, "whatsapp_url": whatsapp_url, "mobile": doc.get("mobile", "")}


@router.post("/bill/{invoice_no:path}/email")
async def email_bill_to_customer(invoice_no: str, payload: dict = None, authorization: str = Header(None)):
    ctx = await _require_store_context(authorization)
    doc = await sales_collection.find_one({"invoice_no": invoice_no, **_store_scope(ctx)})
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    payload = payload or {}
    customer_email = str(payload.get("email") or doc.get("customer_email") or "").strip().lower()
    if not customer_email or not _valid_email(customer_email):
        raise HTTPException(status_code=400, detail="Valid customer email is required.")
    token = doc.get("share_token") or secrets.token_urlsafe(18)
    share_url = doc.get("share_url") or _public_invoice_url(token)
    if not doc.get("share_url"):
        await sales_collection.update_one({"_id": doc["_id"]}, {"$set": {"share_token": token, "share_url": share_url, "share_ready": True}})
    sent = await send_customer_pos_invoice_email(
        customer_email,
        doc.get("customer_name") or "Customer",
        doc.get("store_name") or ctx.get("store_name") or "RMS Store",
        doc.get("invoice_no") or invoice_no,
        doc.get("date", ""),
        doc.get("summary", {}).get("net_payable", 0),
        share_url,
        doc.get("items", []),
        doc.get("payment_method", "Cash"),
    )
    await sales_collection.update_one({"_id": doc["_id"]}, {"$set": {
        "customer_email": customer_email,
        "customer_email_sent": sent,
        "customer_email_sent_at": datetime.utcnow() if sent else None,
    }})
    await _audit_pos(ctx, "bill_email_sent" if sent else "bill_email_failed", {"invoice_no": invoice_no, "customer_email": customer_email})
    if not sent:
        raise HTTPException(status_code=502, detail="Email could not be sent. Check SMTP/email failure logs.")
    return {"status": "success", "invoice_no": invoice_no, "email": customer_email, "email_sent": True, "share_url": share_url}


# GET /cashier/bills
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/bills")
async def get_bills(
    type_filter: Optional[str] = Query(None, alias="type"),
    search:      Optional[str] = Query(None),
    from_date:   Optional[str] = Query(None),
    to_date:     Optional[str] = Query(None),
    limit:       int           = Query(50, le=200),
    authorization: str = Header(None),
):
    ctx = await _require_store_context(authorization)

    query: dict = _store_scope(ctx)
    if type_filter and type_filter.lower() not in ("all", ""):
        query["type"] = type_filter.lower()
    if from_date:
        query.setdefault("date", {})["$gte"] = from_date
    if to_date:
        query.setdefault("date", {})["$lte"] = to_date + " 23:59"
    if search:
        s = search.strip()
        query["$or"] = [
            {"invoice_no":    {"$regex": s, "$options": "i"}},
            {"customer_name": {"$regex": s, "$options": "i"}},
            {"mobile":        {"$regex": s, "$options": "i"}},
            {"cashier_name":  {"$regex": s, "$options": "i"}},
        ]

    bills = []
    async for doc in sales_collection.find(query).sort("created_at", -1).limit(limit):
        bills.append({
            "id":               str(doc["_id"]),
            "invoice_no":       doc.get("invoice_no", ""),
            "type":             doc.get("type", "sale"),
            "date":             doc.get("date", ""),
            "cashier_name":     doc.get("cashier_name", ""),
            "customer_name":    doc.get("customer_name", ""),
            "mobile":           doc.get("mobile", ""),
            "payment_method":   doc.get("payment_method", ""),
            "items_count":      len(doc.get("items", [])),
            "net_payable":      doc.get("summary", {}).get("net_payable", 0),
            "total_gst":        doc.get("summary", {}).get("total_gst", 0),
            "original_invoice": doc.get("original_invoice", ""),
        })

    return JSONResponse({"status": "success", "count": len(bills), "data": bills})


# ═══════════════════════════════════════════════════════════════════════════════
# GET /cashier/bill/{invoice_no}
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/bill/{invoice_no:path}")
async def get_bill_by_invoice(invoice_no: str, authorization: str = Header(None)):
    ctx = await _require_store_context(authorization)
    invoice_no = invoice_no.strip()
    doc = await sales_collection.find_one({"invoice_no": invoice_no, **_store_scope(ctx)})
    if not doc:
        raise HTTPException(status_code=404, detail=f"Invoice '{invoice_no}' not found.")

    returned = {}
    returned_credit = 0.0
    async for previous in sales_collection.find({"type": "return", "original_invoice": invoice_no, **_store_scope(ctx)}):
        returned_credit += _float(previous.get("summary", {}).get("net_payable"))
        for item in previous.get("items", []):
            barcode = str(item.get("barcode") or "")
            returned[barcode] = returned.get(barcode, 0) + abs(_int(item.get("qty")))

    return JSONResponse({
        "status": "success",
        "data": {
            "id":               str(doc["_id"]),
            "invoice_no":       doc.get("invoice_no", ""),
            "type":             doc.get("type", "sale"),
            "date":             doc.get("date", ""),
            "cashier_name":     doc.get("cashier_name", ""),
            "customer_name":    doc.get("customer_name", ""),
            "mobile":           doc.get("mobile", ""),
            "payment_method":   doc.get("payment_method", ""),
            "items":            doc.get("items", []),
            "summary":          doc.get("summary", {}),
            "payment_split":    doc.get("payment_split", {}),
            "paid_amount":      doc.get("paid_amount", 0),
            "change_return":    doc.get("change_return", 0),
            "applied_offer":    doc.get("applied_offer", 0),
            "discount_pct":     doc.get("discount_pct", 0),
            "original_invoice": doc.get("original_invoice", ""),
            "exchange_credit_applied": doc.get("exchange_credit_applied", 0),
            "exchange_against_invoice": doc.get("exchange_against_invoice", ""),
            "exchange_consumed": bool(doc.get("exchange_consumed")),
            "credit_note_only": bool(doc.get("credit_note_only")),
            "returned_quantities": returned,
            "returned_credit": returned_credit,
        }
    })


# ═══════════════════════════════════════════════════════════════════════════════
# POS TERMINALS — per-device identity + tab-access role
# ═══════════════════════════════════════════════════════════════════════════════

# Departments allowed to assign terminal roles at store scope. Deliberately
# an allowlist, not "anything except Cashier" — HR, Customer CRM and Visual
# Merchandising have no operational reason to control which POS terminal can
# see Dashboard/Finance/Reports. Store Ops is the closest thing this system
# has to floor-level supervision; Finance already sees those same tabs by
# department default, so letting them also gate terminal access isn't a
# scope increase.
TERMINAL_MANAGER_DEPARTMENTS = {"Store Ops", "Finance"}


async def _is_terminal_manager(ctx: dict) -> bool:
    """HQ logins can always manage terminal roles. A store-scoped login can
    too, but only from one of TERMINAL_MANAGER_DEPARTMENTS — the shared
    'Cashier' login (and every other store department) is excluded."""
    if ctx.get("scope") == "hq":
        return True
    admin_id = ctx.get("admin_id")
    if not admin_id:
        return False
    try:
        admin = await admins_collection.find_one({"_id": ObjectId(admin_id), "tenant_id": ctx.get("tenant_id"), "store_id": ctx.get("store_id")})
    except Exception:
        admin = None
    return bool(admin) and str(admin.get("status") or "ACTIVE").upper() == "ACTIVE" and admin.get("department") in TERMINAL_MANAGER_DEPARTMENTS


async def _enforce_terminal_restriction(ctx: dict, terminal_id: Optional[str]):
    """Backend half of the tab-access gate — the frontend already hides these
    tabs for a non-supervisor terminal, but that's cosmetic. This is what
    actually blocks the request if someone calls the API directly. Only
    enforced when the caller identifies itself as a POS terminal (terminal_id
    present) — HQ/admin-dashboard callers that aren't a POS device at all
    don't send one, and are governed by their own login's scope instead."""
    if not terminal_id:
        return
    doc = await pos_terminals_collection.find_one({**_store_scope(ctx), "terminal_id": terminal_id})
    role = (doc or {}).get("role", DEFAULT_TERMINAL_ROLE)
    if role != "supervisor":
        raise HTTPException(status_code=403, detail="This POS terminal doesn't have access to this data. Ask a store admin to grant it Supervisor access.")


@router.post("/terminals/register")
async def register_terminal(payload: dict, authorization: str = Header(None)):
    """Called by the POS app whenever a terminal is named/renamed, so HQ/store
    admins have a central list of devices to assign roles to. Idempotent —
    the role is only set on first insert, never overwritten here."""
    ctx = await _require_store_context(authorization)
    terminal_id = str(payload.get("terminal_id") or "").strip()
    terminal_name = str(payload.get("terminal_name") or "").strip()
    if not terminal_id:
        raise HTTPException(status_code=400, detail="terminal_id is required.")

    now = datetime.utcnow()
    existing = await pos_terminals_collection.find_one({**_store_scope(ctx), "terminal_id": terminal_id})

    if not existing:
        # Plan/add-on limit only blocks a BRAND-NEW device — a terminal
        # already registered keeps working even if the tenant later drops
        # to a smaller plan than its current device count.
        tenant = await tenants_collection.find_one({"tenant_id": ctx["tenant_id"]}, {"plan": 1, "bonus_pos_seats": 1})
        plan_cfg = retailer_plan_config((tenant or {}).get("plan", "basic"))
        base_limit = plan_cfg.get("pos")
        if base_limit is not None:
            bonus_pos = int((tenant or {}).get("bonus_pos_seats") or 0)
            limit = base_limit + bonus_pos
            current_count = await pos_terminals_collection.count_documents({"tenant_id": ctx["tenant_id"]})
            if current_count >= limit:
                raise HTTPException(
                    status_code=402,
                    detail=f"POS terminal limit reached ({limit} on the {plan_cfg.get('label')} plan). "
                           "Buy an extra-POS add-on or upgrade your plan to register another device.",
                )

    await pos_terminals_collection.update_one(
        {**_store_scope(ctx), "terminal_id": terminal_id},
        {
            "$set": {
                "terminal_name": terminal_name,
                "store_name": ctx.get("store_name"),
                "last_seen_at": now,
            },
            "$setOnInsert": {
                "tenant_id": ctx["tenant_id"],
                "store_id": ctx["store_id"],
                "terminal_id": terminal_id,
                "role": DEFAULT_TERMINAL_ROLE,
                "created_at": now,
            },
        },
        upsert=True,
    )
    role = existing.get("role", DEFAULT_TERMINAL_ROLE) if existing else DEFAULT_TERMINAL_ROLE
    return {"status": "success", "role": role}


@router.get("/store-upi")
async def get_store_upi(authorization: str = Header(None)):
    """The store's own UPI ID (VPA) for showing a scan-to-pay QR at
    billing when UPI is selected. Readable by any store-scoped login so
    the POS screen can render the QR; only a store manager/HQ can set it
    (see set_store_upi below)."""
    ctx = await _require_store_context(authorization)
    store = await stores_collection.find_one({"_id": ObjectId(ctx["store_id"])}, {"upi_id": 1, "name": 1})
    return {"status": "success", "upi_id": (store or {}).get("upi_id", ""), "store_name": ctx.get("store_name") or (store or {}).get("name", "")}


@router.patch("/store-upi")
async def set_store_upi(payload: dict, authorization: str = Header(None)):
    ctx = await _require_store_context(authorization)
    if not await _is_terminal_manager(ctx):
        raise HTTPException(status_code=403, detail="Only a store manager or HQ admin can set the store's UPI ID.")
    upi_id = str(payload.get("upi_id") or "").strip()
    if upi_id and not re.match(r"^[\w.\-]{2,256}@[a-zA-Z]{2,64}$", upi_id):
        raise HTTPException(status_code=400, detail="Enter a valid UPI ID, e.g. storename@okaxis")
    await stores_collection.update_one({"_id": ObjectId(ctx["store_id"])}, {"$set": {"upi_id": upi_id}})
    return {"status": "success", "upi_id": upi_id}


@router.get("/terminals")
async def list_terminals(authorization: str = Header(None)):
    ctx = await _require_store_context(authorization)
    rows = []
    async for doc in pos_terminals_collection.find(_store_scope(ctx)).sort("terminal_name", 1):
        rows.append({
            "terminal_id":   doc.get("terminal_id"),
            "terminal_name": doc.get("terminal_name") or "Unnamed terminal",
            "role":          doc.get("role", DEFAULT_TERMINAL_ROLE),
            "last_seen_at":  doc.get("last_seen_at"),
        })
    return JSONResponse(content=jsonable_encoder({"status": "success", "data": rows, "can_manage_roles": await _is_terminal_manager(ctx)}))


@router.get("/terminals/role")
async def get_terminal_role(terminal_id: str = Query(...), authorization: str = Header(None)):
    """Read-only, called by the POS app itself on load/after rename to decide
    which tabs this device is allowed to show. Any store-scoped login
    (including the shared Cashier login) may read this — only ASSIGNING a
    role is restricted."""
    ctx = await _require_store_context(authorization)
    doc = await pos_terminals_collection.find_one({**_store_scope(ctx), "terminal_id": terminal_id})
    return {"status": "success", "role": (doc or {}).get("role", DEFAULT_TERMINAL_ROLE)}


@router.post("/terminals/{terminal_id}/role")
async def set_terminal_role(terminal_id: str, payload: dict, authorization: str = Header(None)):
    ctx = await _require_store_context(authorization)
    if not await _is_terminal_manager(ctx):
        raise HTTPException(status_code=403, detail="Only a store admin can assign terminal roles.")
    role = str(payload.get("role") or "").strip().lower()
    if role not in TERMINAL_ROLES:
        raise HTTPException(status_code=400, detail=f"role must be one of {sorted(TERMINAL_ROLES)}.")
    result = await pos_terminals_collection.update_one(
        {**_store_scope(ctx), "terminal_id": terminal_id},
        {"$set": {"role": role}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Terminal not found — it must open the POS once before a role can be assigned.")
    await _audit_pos(ctx, "terminal_role_changed", {"terminal_id": terminal_id, "role": role})
    return {"status": "success", "role": role}


# ═══════════════════════════════════════════════════════════════════════════════
# GET /cashier/dashboard
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/dashboard")
async def get_cashier_dashboard(
    date: Optional[str] = Query(None),
    terminal_id: Optional[str] = Query(None),
    authorization: str = Header(None),
):
    ctx = await _require_store_context(authorization)
    await _enforce_terminal_restriction(ctx, terminal_id)
    today_str = date or datetime.utcnow().strftime("%Y-%m-%d")

    today_dt      = datetime.strptime(today_str, "%Y-%m-%d")
    yesterday_dt  = today_dt - timedelta(days=1)
    yesterday_str = yesterday_dt.strftime("%Y-%m-%d")

    async def _get_day_bills(day_str: str) -> list:
        bills = []
        async for doc in sales_collection.find(
            {"date": {"$gte": day_str, "$lt": day_str + " 99:99"}, **_store_scope(ctx)}
        ).sort("date", 1):
            bills.append(doc)
        return bills

    today_bills     = await _get_day_bills(today_str)
    yesterday_bills = await _get_day_bills(yesterday_str)

    def _compute_kpis(bills: list) -> dict:
        sales   = [b for b in bills if b.get("type") != "return"]
        returns = [b for b in bills if b.get("type") == "return"]

        gross_revenue = sum(b.get("summary", {}).get("net_payable", 0) for b in sales)
        return_amount = sum(b.get("summary", {}).get("net_payable", 0) for b in returns)
        net_revenue   = gross_revenue - return_amount
        items_sold    = sum(sum(l.get("qty", 0) for l in b.get("items", [])) for b in sales)
        avg_bill      = gross_revenue / len(sales) if sales else 0
        total_gst     = sum(b.get("summary", {}).get("total_gst", 0) for b in sales)

        pay_counts: dict = {}
        for b in sales:
            pm = b.get("payment_method", "Cash")
            pay_counts[pm] = pay_counts.get(pm, 0) + 1
        top_payment = max(pay_counts, key=pay_counts.get) if pay_counts else "—"

        return {
            "sale_count":    len(sales),
            "return_count":  len(returns),
            "gross_revenue": round(gross_revenue, 2),
            "return_amount": round(return_amount, 2),
            "net_revenue":   round(net_revenue, 2),
            "items_sold":    items_sold,
            "avg_bill":      round(avg_bill, 2),
            "total_gst":     round(total_gst, 2),
            "top_payment":   top_payment,
            "pay_counts":    pay_counts,
        }

    today_kpis     = _compute_kpis(today_bills)
    yesterday_kpis = _compute_kpis(yesterday_bills)

    hourly: dict = {str(h).zfill(2): {"sales": 0, "revenue": 0.0, "count": 0} for h in range(24)}
    for b in today_bills:
        if b.get("type") == "return":
            continue
        date_str = b.get("date", "")
        if len(date_str) >= 13:
            hour = date_str[11:13]
            if hour in hourly:
                hourly[hour]["revenue"] += b.get("summary", {}).get("net_payable", 0)
                hourly[hour]["count"]   += 1

    hourly_trend = [
        {"hour": f"{h}:00", "revenue": round(hourly[h]["revenue"], 2), "count": hourly[h]["count"]}
        for h in sorted(hourly.keys())
        if hourly[h]["revenue"] > 0 or hourly[h]["count"] > 0
    ]

    product_map: dict = {}
    for b in today_bills:
        if b.get("type") == "return":
            continue
        for item in b.get("items", []):
            bc  = item.get("barcode", "")
            qty = int(item.get("qty", 0) or 0)
            rev = float(item.get("qty", 0) or 0) * float(item.get("price", 0) or 0)
            if bc not in product_map:
                product_map[bc] = {"barcode": bc, "name": item.get("name", bc), "sku": item.get("sku", ""), "qty": 0, "revenue": 0.0}
            product_map[bc]["qty"]     += qty
            product_map[bc]["revenue"] += rev

    top_products = sorted(product_map.values(), key=lambda x: x["qty"], reverse=True)[:8]
    for p in top_products:
        p["revenue"] = round(p["revenue"], 2)

    recent_bills = []
    for b in reversed(today_bills[-12:]):
        recent_bills.append({
            "invoice_no":    b.get("invoice_no", ""),
            "type":          b.get("type", "sale"),
            "date":          b.get("date", ""),
            "customer_name": b.get("customer_name", ""),
            "cashier_name":  b.get("cashier_name", ""),
            "payment_method":b.get("payment_method", ""),
            "items_count":   len(b.get("items", [])),
            "net_payable":   b.get("summary", {}).get("net_payable", 0),
        })

    cashier_map: dict = {}
    for b in today_bills:
        if b.get("type") == "return":
            continue
        name = b.get("cashier_name", "Unknown") or "Unknown"
        if name not in cashier_map:
            cashier_map[name] = {"name": name, "bills": 0, "revenue": 0.0}
        cashier_map[name]["bills"]   += 1
        cashier_map[name]["revenue"] += b.get("summary", {}).get("net_payable", 0)

    cashier_leaderboard = sorted(cashier_map.values(), key=lambda x: x["revenue"], reverse=True)
    for c in cashier_leaderboard:
        c["revenue"] = round(c["revenue"], 2)

    def _pct(today_val, yest_val):
        if yest_val == 0:
            return None
        return round(((today_val - yest_val) / yest_val) * 100, 1)

    return JSONResponse({
        "status": "success",
        "date":   today_str,
        "data": {
            "kpis":               today_kpis,
            "yesterday":          yesterday_kpis,
            "changes": {
                "net_revenue": _pct(today_kpis["net_revenue"],  yesterday_kpis["net_revenue"]),
                "sale_count":  _pct(today_kpis["sale_count"],   yesterday_kpis["sale_count"]),
                "items_sold":  _pct(today_kpis["items_sold"],   yesterday_kpis["items_sold"]),
                "avg_bill":    _pct(today_kpis["avg_bill"],      yesterday_kpis["avg_bill"]),
            },
            "hourly_trend":        hourly_trend,
            "top_products":        top_products,
            "recent_bills":        recent_bills,
            "cashier_leaderboard": cashier_leaderboard,
            "payment_breakdown":   today_kpis["pay_counts"],
        },
    })


# ═══════════════════════════════════════════════════════════════════════════════
# GET /cashier/reports
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/reports")
async def get_sales_report(
    type_filter:    Optional[str]   = Query(None, alias="type"),
    from_date:      Optional[str]   = Query(None),
    to_date:        Optional[str]   = Query(None),
    cashier_name:   Optional[str]   = Query(None),
    payment_method: Optional[str]   = Query(None),
    search:         Optional[str]   = Query(None),
    min_amount:     Optional[float] = Query(None),
    max_amount:     Optional[float] = Query(None),
    store_id:       Optional[str]   = Query(None, description="HQ only — filter to one store/branch."),
    terminal_id:    Optional[str]   = Query(None, description="Filter to one physical POS machine within the store."),
    limit:          int             = Query(500, le=2000),
    skip:           int             = Query(0, ge=0),
    authorization: str = Header(None),
):
    ctx = await _require_report_context(authorization)
    await _enforce_terminal_restriction(ctx, terminal_id)

    query: dict = _report_scope(ctx)
    # A store-scoped caller is already locked to their own store by
    # _report_scope above — only honor this filter for HQ, which otherwise
    # sees every store's bills combined.
    if store_id and ctx.get("scope") == "hq":
        query["store_id"] = store_id
    if terminal_id:
        query["terminal_id"] = terminal_id

    if type_filter and type_filter.lower() not in ("all", ""):
        query["type"] = type_filter.lower()
    if from_date or to_date:
        date_q: dict = {}
        if from_date: date_q["$gte"] = from_date
        if to_date:   date_q["$lte"] = to_date + " 23:59"
        query["date"] = date_q
    if cashier_name:
        query["cashier_name"] = {"$regex": cashier_name.strip(), "$options": "i"}
    if payment_method and payment_method.lower() != "all":
        query["payment_method"] = payment_method
    if search:
        s = search.strip()
        query["$or"] = [
            {"invoice_no":    {"$regex": s, "$options": "i"}},
            {"customer_name": {"$regex": s, "$options": "i"}},
            {"mobile":        {"$regex": s, "$options": "i"}},
        ]
    if min_amount is not None or max_amount is not None:
        amt_q: dict = {}
        if min_amount is not None: amt_q["$gte"] = min_amount
        if max_amount is not None: amt_q["$lte"] = max_amount
        query["summary.net_payable"] = amt_q

    total_count = await sales_collection.count_documents(query)

    bills = []
    async for doc in sales_collection.find(query).sort("date", -1).skip(skip).limit(limit):
        s = doc.get("summary", {})
        line_items = []
        for item in doc.get("items", []):
            qty   = int(item.get("qty", 0) or 0)
            price = _float(item.get("price"))
            gst   = _float(item.get("gst"))
            total = _float(item.get("total"))
            item_total_abs = abs(total)
            item_taxable   = item_total_abs / (1 + gst / 100) if gst else item_total_abs
            item_gst_amt   = item_total_abs - item_taxable
            line_items.append({
                "barcode":      item.get("barcode", ""),
                "sku":          item.get("sku", ""),
                "name":         item.get("name", ""),
                "hsn":          item.get("hsn", ""),
                "qty":          qty,
                "price":        price,
                "mrp":          _float(item.get("mrp")),
                "gst_rate":     gst,
                "item_discount":_float(item.get("itemDiscount")),
                "total":        abs(total),
                "taxable":      round(item_taxable, 2),
                "cgst":         round(item_gst_amt / 2, 2),
                "sgst":         round(item_gst_amt / 2, 2),
                "igst":         0.0,
                "division":     item.get("division", ""),
                "section":      item.get("section", ""),
                "department":   item.get("department", ""),
            })
        bills.append({
            "id":               str(doc["_id"]),
            "invoice_no":       doc.get("invoice_no", ""),
            "type":             doc.get("type", "sale"),
            "date":             doc.get("date", ""),
            "store_id":         doc.get("store_id", ""),
            "store_name":       doc.get("store_name", ""),
            "terminal_id":      doc.get("terminal_id", ""),
            "terminal_name":    doc.get("terminal_name", ""),
            "cashier_name":     doc.get("cashier_name", ""),
            "salesman_code":    doc.get("salesman_code", ""),
            "customer_name":    doc.get("customer_name", ""),
            "mobile":           doc.get("mobile", ""),
            "payment_method":   doc.get("payment_method", ""),
            "original_invoice": doc.get("original_invoice", ""),
            "items_count":      len(doc.get("items", [])),
            "items":            line_items,
            "summary": {
                "total_sale":     _float(s.get("total_sale")),
                "total_savings":  _float(s.get("total_savings")),
                "taxable_amount": _float(s.get("taxable_amount")),
                "cgst_amount":    _float(s.get("cgst_amount")),
                "sgst_amount":    _float(s.get("sgst_amount")),
                "igst_amount":    _float(s.get("igst_amount")),
                "total_gst":      _float(s.get("total_gst")),
                "round_off":      _float(s.get("round_off")),
                "net_payable":    _float(s.get("net_payable")),
            },
        })

    stats = {
        "total_bills": 0, "sale_bills": 0, "return_bills": 0,
        "gross_revenue": 0.0, "return_amount": 0.0, "net_revenue": 0.0,
        "total_gst": 0.0, "total_savings": 0.0, "total_items": 0,
        "cashiers": set(), "payment_split": {},
    }
    async for doc in sales_collection.find(query, {
        "type": 1, "summary": 1, "items": 1, "cashier_name": 1, "payment_method": 1, "_id": 0
    }):
        s   = doc.get("summary", {})
        typ = doc.get("type", "sale")
        net = _float(s.get("net_payable"))
        gst = _float(s.get("total_gst"))
        sav = _float(s.get("total_savings"))
        itc = sum(int(i.get("qty", 0) or 0) for i in doc.get("items", []))
        pm  = doc.get("payment_method", "Cash")
        cn  = doc.get("cashier_name", "")
        stats["total_bills"] += 1
        stats["total_items"] += itc
        stats["total_gst"]   += gst
        stats["total_savings"] += sav
        if cn: stats["cashiers"].add(cn)
        stats["payment_split"][pm] = stats["payment_split"].get(pm, 0) + 1
        if typ == "return":
            stats["return_bills"]  += 1
            stats["return_amount"] += net
        else:
            stats["sale_bills"]    += 1
            stats["gross_revenue"] += net

    stats["net_revenue"]   = round(stats["gross_revenue"] - stats["return_amount"], 2)
    stats["gross_revenue"] = round(stats["gross_revenue"], 2)
    stats["return_amount"] = round(stats["return_amount"], 2)
    stats["total_gst"]     = round(stats["total_gst"], 2)
    stats["total_savings"] = round(stats["total_savings"], 2)
    stats["cashiers"]      = sorted(list(stats["cashiers"]))

    return JSONResponse({
        "status": "success", "total_count": total_count,
        "page_size": limit, "skip": skip, "stats": stats, "data": bills,
    })


# ═══════════════════════════════════════════════════════════════════════════════
# GET /cashier/reports/summary
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/reports/summary")
async def reports_summary(
    from_date: Optional[str] = Query(None),
    to_date:   Optional[str] = Query(None),
    authorization: str = Header(None),
    terminal_id: Optional[str] = Query(None),
):
    ctx = await _require_report_context(authorization)
    await _enforce_terminal_restriction(ctx, terminal_id)

    fd, td = from_date or _default_dates()[0], to_date or _default_dates()[1]
    q = _date_query(fd, td)
    q.update(_report_scope(ctx))

    kpis = {
        "sale_count": 0, "return_count": 0,
        "gross_revenue": 0.0, "return_amount": 0.0, "net_revenue": 0.0,
        "total_savings": 0.0, "total_gst": 0.0, "items_sold": 0, "avg_bill": 0.0,
    }
    daily: dict = {}

    async for doc in sales_collection.find(q):
        s   = doc.get("summary", {})
        typ = doc.get("type", "sale")
        net = _float(s.get("net_payable"))
        gst = _float(s.get("total_gst"))
        sav = _float(s.get("total_savings"))
        qty = sum(int(i.get("qty", 0) or 0) for i in doc.get("items", []))
        day = (doc.get("date") or "")[:10]

        if day not in daily:
            daily[day] = {"date": day, "sales": 0, "returns": 0, "gross": 0.0, "net": 0.0, "gst": 0.0, "items": 0}

        if typ == "return":
            kpis["return_count"]  += 1
            kpis["return_amount"] += net
            daily[day]["returns"] += 1
        else:
            kpis["sale_count"]    += 1
            kpis["gross_revenue"] += net
            kpis["items_sold"]    += qty
            daily[day]["sales"]   += 1
            daily[day]["gross"]   += net
            daily[day]["items"]   += qty

        kpis["total_gst"]     += gst
        kpis["total_savings"] += sav
        daily[day]["gst"]     += gst
        daily[day]["net"]     += net if typ == "sale" else -net

    kpis["net_revenue"] = round(kpis["gross_revenue"] - kpis["return_amount"], 2)
    kpis["avg_bill"]    = round(kpis["gross_revenue"] / kpis["sale_count"], 2) if kpis["sale_count"] else 0.0
    for k in ("gross_revenue", "return_amount", "net_revenue", "total_gst", "total_savings"):
        kpis[k] = round(kpis[k], 2)

    trend = sorted(
        [{"date": d, **v, "gross": round(v["gross"], 2), "net": round(v["net"], 2), "gst": round(v["gst"], 2)}
         for d, v in daily.items()],
        key=lambda x: x["date"]
    )
    return JSONResponse({"status": "success", "from_date": fd, "to_date": td, "kpis": kpis, "trend": trend})


# ═══════════════════════════════════════════════════════════════════════════════
# Sales detail uses bill-line snapshots; older bills remain blank where the
# original value was not captured. Allocate bill totals in paise so the
# exported lines reconcile exactly even when the bill has a round-off.
def _allocate_report_amount(amount, weights):
    total = Decimal(str(amount or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    positive = [Decimal(str(max(0, w))) for w in weights]
    denominator = sum(positive)
    if not positive:
        return []
    if not denominator:
        positive = [Decimal(1)] * len(positive)
        denominator = sum(positive)
    raw = [total * w / denominator for w in positive]
    rounded = [v.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) for v in raw]
    residual = int((total - sum(rounded)) * 100)
    order = sorted(range(len(raw)), key=lambda i: raw[i] - rounded[i], reverse=residual > 0)
    for i in range(abs(residual)):
        rounded[order[i % len(order)]] += Decimal("0.01") if residual > 0 else Decimal("-0.01")
    return [float(value) for value in rounded]


def _ageing_days(bill_date: str, receipt_date: str) -> "int | str":
    """ageing_receipt_date is stored as a plain YYYY-MM-DD string (the
    latest posted GRN on/before this bill) -- "Ageing" in retail reporting
    means days-since-received, not the raw date itself."""
    if not receipt_date:
        return ""
    try:
        received = datetime.strptime(receipt_date[:10], "%Y-%m-%d")
        as_of = datetime.strptime((bill_date or "")[:10], "%Y-%m-%d") if bill_date else datetime.utcnow()
        return max(0, (as_of - received).days)
    except ValueError:
        return ""


def _sales_detail_rows(doc):
    items = doc.get("items") or []
    summary = doc.get("summary") or {}
    weights = [abs(_float(item.get("price")) * _float(item.get("qty"))) for item in items]
    gross = _allocate_report_amount(summary.get("total_sale", sum(weights)), weights)
    promo_total = _float(doc.get("applied_offer"))
    savings = _float(summary.get("total_savings"))
    promo = _allocate_report_amount(promo_total, weights)
    discount = _allocate_report_amount(max(0, savings - promo_total), weights)
    net = _allocate_report_amount(summary.get("net_payable", sum(weights) - savings), weights)
    tax_weights = [weight / (1 + max(0, _float(item.get("gst"))) / 100) for weight, item in zip(weights, items)]
    taxable = _allocate_report_amount(summary.get("taxable_amount", 0), tax_weights) if "taxable_amount" in summary else [None] * len(items)
    sign = -1 if doc.get("type") == "return" else 1
    date, _, time = str(doc.get("date") or "").partition(" ")
    rows = []
    for i, item in enumerate(items):
        rows.append({
            "Bill Date": date, "Store": doc.get("store_name", ""), "Terminal No.": doc.get("terminal_name") or doc.get("terminal_id", ""),
            "DIVISION": item.get("division", ""), "SECTION": item.get("section", ""), "DEPARTMENT": item.get("department", ""),
            "VENDOR": item.get("vendor_name", ""), "Item Code": item.get("item_code") or item.get("sku", ""),
            "IsVoid": doc.get("is_void", False), "Barcode": item.get("barcode", ""), "HSN_CODE": item.get("hsn", ""),
            "Cat-1 (Design No.)": item.get("category1", ""), "Cat-2 (Brand)": item.get("category2", ""),
            "Cat-3 (Style)": item.get("category3", ""), "Cat-4 (Plane, F/S, H/S)": item.get("category4", ""),
            "Cat-5 (Size)": item.get("category5", ""), "Ageing": _ageing_days(date, item.get("ageing_receipt_date", "")),
            "Std Rate": item.get("cost_price", ""), "RSP": item.get("price", ""), "Mrp": item.get("mrp", ""),
            "Promo Type": doc.get("promotion_type", ""), "Promo Name": doc.get("promotion_name", ""),
            "Bill Qty": sign * abs(_float(item.get("qty"))), "Gr Amt": sign * gross[i],
            "Promo Amt": sign * promo[i], "Discount Amt": sign * discount[i], "Net Amt": sign * net[i],
            "Tax Description": item.get("tax_description", ""), "Tax Rate": item.get("gst", ""),
            "Taxable Sale": sign * taxable[i] if taxable[i] is not None else "",
            "Description": item.get("name", ""), "Bill No.": doc.get("invoice_no", ""), "Bill Time": time,
            "Original Bill No.": doc.get("original_invoice", ""),
        })
    return rows


@router.get("/reports/sales-detail")
async def reports_sales_detail(from_date: str = Query(...), to_date: str = Query(...),
                               terminal_id: Optional[str] = Query(None),
                               store_id: Optional[str] = Query(None), type_filter: Optional[str] = Query(None, alias="type"),
                               cashier_name: Optional[str] = Query(None), payment_method: Optional[str] = Query(None),
                               search: Optional[str] = Query(None), min_amount: Optional[float] = Query(None),
                               max_amount: Optional[float] = Query(None),
                               skip: int = Query(0, ge=0), limit: int = Query(200, ge=1, le=500),
                               authorization: str = Header(None)):
    ctx = await _require_report_context(authorization)
    await _enforce_terminal_restriction(ctx, terminal_id)
    try:
        datetime.strptime(from_date, "%Y-%m-%d")
        datetime.strptime(to_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Enter valid dates in YYYY-MM-DD format.")
    if from_date > to_date:
        raise HTTPException(status_code=400, detail="Start date must not be after end date.")
    query = _date_query(from_date, to_date)
    query.update(_report_scope(ctx))
    if store_id and ctx.get("scope") == "hq":
        query["store_id"] = store_id
    if type_filter and type_filter.lower() != "all":
        query["type"] = type_filter.lower()
    else:
        query["$and"] = [{"$or": [{"type": {"$in": ["sale", "return"]}}, {"type": {"$exists": False}}]}]
    if cashier_name:
        query["cashier_name"] = {"$regex": cashier_name.strip(), "$options": "i"}
    if payment_method and payment_method.lower() != "all":
        query["payment_method"] = payment_method
    if search:
        query["$or"] = [{key: {"$regex": search.strip(), "$options": "i"}} for key in ("invoice_no", "customer_name", "mobile")]
    if min_amount is not None or max_amount is not None:
        query["summary.net_payable"] = {}
        if min_amount is not None: query["summary.net_payable"]["$gte"] = min_amount
        if max_amount is not None: query["summary.net_payable"]["$lte"] = max_amount
    count = await sales_collection.count_documents(query)
    rows = []
    async for doc in sales_collection.find(query).sort([("date", 1), ("_id", 1)]).skip(skip).limit(limit):
        rows.extend(_sales_detail_rows(doc))
    return {"status": "success", "data": rows, "bill_count": count, "next_skip": skip + limit if skip + limit < count else None}


# GET /cashier/reports/items
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/reports/items")
async def reports_items(
    from_date: Optional[str] = Query(None),
    to_date:   Optional[str] = Query(None),
    sort_by:   Optional[str] = Query("qty"),
    limit:     int           = Query(50, le=200),
    authorization: str = Header(None),
    terminal_id: Optional[str] = Query(None),
):
    ctx = await _require_report_context(authorization)
    await _enforce_terminal_restriction(ctx, terminal_id)

    fd, td = from_date or _default_dates()[0], to_date or _default_dates()[1]
    q = _date_query(fd, td)
    q.update(_report_scope(ctx))
    item_map: dict = {}

    async for doc in sales_collection.find(q):
        typ = doc.get("type", "sale")
        for item in doc.get("items", []):
            bc  = item.get("barcode", "")
            qty = int(item.get("qty", 0) or 0)
            rev = _float(item.get("price")) * qty
            if bc not in item_map:
                item_map[bc] = {
                    "barcode": bc, "sku": item.get("sku", ""), "name": item.get("name", ""),
                    "hsn": item.get("hsn", ""), "division": item.get("division", ""),
                    "section": item.get("section", ""), "gst_rate": _float(item.get("gst")),
                    "qty_sold": 0, "qty_returned": 0, "revenue": 0.0,
                    "return_value": 0.0, "net_revenue": 0.0, "bill_count": 0,
                }
            if typ == "return":
                item_map[bc]["qty_returned"] += qty
                item_map[bc]["return_value"] += rev
            else:
                item_map[bc]["qty_sold"]   += qty
                item_map[bc]["revenue"]    += rev
                item_map[bc]["bill_count"] += 1

    rows = []
    for r in item_map.values():
        r["revenue"]      = round(r["revenue"], 2)
        r["return_value"] = round(r["return_value"], 2)
        r["net_revenue"]  = round(r["revenue"] - r["return_value"], 2)
        r["net_qty"]      = r["qty_sold"] - r["qty_returned"]
        rows.append(r)

    sort_key = {"qty": "qty_sold", "revenue": "net_revenue", "returns": "qty_returned"}.get(sort_by, "qty_sold")
    rows.sort(key=lambda x: x[sort_key], reverse=True)
    return JSONResponse({"status": "success", "from_date": fd, "to_date": td, "count": len(rows), "data": rows[:limit]})


# ═══════════════════════════════════════════════════════════════════════════════
# GET /cashier/reports/gst
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/reports/gst")
async def reports_gst(
    from_date: Optional[str] = Query(None),
    to_date:   Optional[str] = Query(None),
    authorization: str = Header(None),
    terminal_id: Optional[str] = Query(None),
):
    ctx = await _require_report_context(authorization)
    await _enforce_terminal_restriction(ctx, terminal_id)

    fd, td = from_date or _default_dates()[0], to_date or _default_dates()[1]
    q = {**_date_query(fd, td), "type": "sale", **_report_scope(ctx)}
    bracket_map: dict = {}
    totals = {"taxable": 0.0, "cgst": 0.0, "sgst": 0.0, "igst": 0.0, "total_gst": 0.0, "gross": 0.0}

    async for doc in sales_collection.find(q):
        s          = doc.get("summary", {})
        total_sale = _float(s.get("total_sale"))
        taxable    = _float(s.get("taxable_amount"))
        for item in doc.get("items", []):
            rate       = _float(item.get("gst"))
            item_total = _float(item.get("price")) * int(item.get("qty", 0) or 0)
            share      = item_total / total_sale if total_sale else 0
            item_tax   = taxable * share
            gst_amt    = item_tax - (item_tax / (1 + rate / 100)) if rate else 0
            item_taxable = item_tax - gst_amt
            key = f"{rate:.0f}"
            if key not in bracket_map:
                bracket_map[key] = {
                    "rate": rate, "label": f"GST {rate:.0f}%",
                    "taxable": 0.0, "cgst": 0.0, "sgst": 0.0, "igst": 0.0,
                    "total_gst": 0.0, "gross_sales": 0.0, "bill_count": 0,
                }
            bracket_map[key]["taxable"]     += item_taxable
            bracket_map[key]["cgst"]        += gst_amt / 2
            bracket_map[key]["sgst"]        += gst_amt / 2
            bracket_map[key]["total_gst"]   += gst_amt
            bracket_map[key]["gross_sales"] += item_total
            bracket_map[key]["bill_count"]  += 1
            totals["taxable"]   += item_taxable
            totals["cgst"]      += gst_amt / 2
            totals["sgst"]      += gst_amt / 2
            totals["total_gst"] += gst_amt
            totals["gross"]     += item_total

    brackets = []
    for b in sorted(bracket_map.values(), key=lambda x: x["rate"]):
        for k in ("taxable", "cgst", "sgst", "igst", "total_gst", "gross_sales"):
            b[k] = round(b[k], 2)
        brackets.append(b)
    for k in totals:
        totals[k] = round(totals[k], 2)

    return JSONResponse({"status": "success", "from_date": fd, "to_date": td, "brackets": brackets, "totals": totals})


# ═══════════════════════════════════════════════════════════════════════════════
# GET /cashier/reports/cashiers
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/reports/cashiers")
async def reports_cashiers(
    from_date: Optional[str] = Query(None),
    to_date:   Optional[str] = Query(None),
    authorization: str = Header(None),
    terminal_id: Optional[str] = Query(None),
):
    ctx = await _require_report_context(authorization)
    await _enforce_terminal_restriction(ctx, terminal_id)

    fd, td = from_date or _default_dates()[0], to_date or _default_dates()[1]
    q = _date_query(fd, td)
    q.update(_report_scope(ctx))
    cashier_map: dict = {}

    async for doc in sales_collection.find(q):
        s    = doc.get("summary", {})
        typ  = doc.get("type", "sale")
        name = (doc.get("cashier_name") or "Unknown").strip()
        net  = _float(s.get("net_payable"))
        gst  = _float(s.get("total_gst"))
        qty  = sum(int(i.get("qty", 0) or 0) for i in doc.get("items", []))
        pm   = doc.get("payment_method", "Cash")

        if name not in cashier_map:
            cashier_map[name] = {
                "cashier": name, "sale_count": 0, "return_count": 0,
                "gross_revenue": 0.0, "return_amount": 0.0, "net_revenue": 0.0,
                "total_gst": 0.0, "items_sold": 0, "avg_bill": 0.0, "payment_split": {},
            }
        c = cashier_map[name]
        c["total_gst"] += gst
        if typ == "return":
            c["return_count"]  += 1
            c["return_amount"] += net
        else:
            c["sale_count"]    += 1
            c["gross_revenue"] += net
            c["items_sold"]    += qty
            c["payment_split"][pm] = c["payment_split"].get(pm, 0) + 1

    rows = []
    for c in cashier_map.values():
        c["net_revenue"]   = round(c["gross_revenue"] - c["return_amount"], 2)
        c["avg_bill"]      = round(c["gross_revenue"] / c["sale_count"], 2) if c["sale_count"] else 0.0
        c["gross_revenue"] = round(c["gross_revenue"], 2)
        c["return_amount"] = round(c["return_amount"], 2)
        c["total_gst"]     = round(c["total_gst"], 2)
        rows.append(c)

    rows.sort(key=lambda x: x["net_revenue"], reverse=True)
    return JSONResponse({"status": "success", "from_date": fd, "to_date": td, "count": len(rows), "data": rows})


# ═══════════════════════════════════════════════════════════════════════════════
# GET /cashier/reports/terminals
# Per-machine totals, plus a day × terminal breakdown — "which POS at this
# store did how much, and on which day" in one call. A bill with no
# terminal_id (saved before per-terminal identity existed) is grouped
# under "Unassigned" rather than dropped, so historical totals still add
# up to the same grand total the other report tabs already show.
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/reports/terminals")
async def reports_terminals(
    from_date: Optional[str] = Query(None),
    to_date:   Optional[str] = Query(None),
    authorization: str = Header(None),
    terminal_id: Optional[str] = Query(None),
):
    ctx = await _require_report_context(authorization)
    await _enforce_terminal_restriction(ctx, terminal_id)

    fd, td = from_date or _default_dates()[0], to_date or _default_dates()[1]
    q = _date_query(fd, td)
    q.update(_report_scope(ctx))

    terminal_map: dict = {}
    daily_map: dict = {}  # (terminal_key, day) -> row

    async for doc in sales_collection.find(q):
        s    = doc.get("summary", {})
        typ  = doc.get("type", "sale")
        terminal_id = doc.get("terminal_id") or ""
        terminal_name = (doc.get("terminal_name") or "").strip() or "Unassigned"
        terminal_key = terminal_id or "unassigned"
        net  = _float(s.get("net_payable"))
        qty  = sum(int(i.get("qty", 0) or 0) for i in doc.get("items", []))
        day  = (doc.get("date") or "")[:10]

        if terminal_key not in terminal_map:
            terminal_map[terminal_key] = {
                "terminal_id": terminal_id, "terminal_name": terminal_name,
                "sale_count": 0, "return_count": 0,
                "gross_revenue": 0.0, "return_amount": 0.0, "net_revenue": 0.0,
                "items_sold": 0,
            }
        t = terminal_map[terminal_key]

        daily_key = (terminal_key, day)
        if daily_key not in daily_map:
            daily_map[daily_key] = {
                "terminal_id": terminal_id, "terminal_name": terminal_name, "date": day,
                "bill_count": 0, "sale_amount": 0.0,
            }
        d = daily_map[daily_key]

        if typ == "return":
            t["return_count"]  += 1
            t["return_amount"] += net
        else:
            t["sale_count"]    += 1
            t["gross_revenue"] += net
            t["items_sold"]    += qty
            d["bill_count"]    += 1
            d["sale_amount"]   += net

    terminals = []
    for t in terminal_map.values():
        t["net_revenue"]   = round(t["gross_revenue"] - t["return_amount"], 2)
        t["gross_revenue"] = round(t["gross_revenue"], 2)
        t["return_amount"] = round(t["return_amount"], 2)
        terminals.append(t)
    terminals.sort(key=lambda x: x["net_revenue"], reverse=True)

    daily_rows = sorted(
        [{**v, "sale_amount": round(v["sale_amount"], 2)} for v in daily_map.values()],
        key=lambda x: (x["date"], x["terminal_name"])
    )

    return JSONResponse({
        "status": "success", "from_date": fd, "to_date": td,
        "terminals": terminals, "daily": daily_rows,
    })


# ═══════════════════════════════════════════════════════════════════════════════
# GET /cashier/reports/by-store
# One row per store/branch, side by side — HQ oversight comparing every
# location's sales at a glance, instead of picking one store_id at a time
# via the ?store_id= filter on the base /reports endpoint.
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/reports/by-store")
async def reports_by_store(
    from_date: Optional[str] = Query(None),
    to_date:   Optional[str] = Query(None),
    authorization: str = Header(None),
    terminal_id: Optional[str] = Query(None),
):
    ctx = await _require_report_context(authorization)
    await _enforce_terminal_restriction(ctx, terminal_id)
    if ctx.get("scope") != "hq":
        raise HTTPException(status_code=403, detail="Store-wise summary is an HQ view.")

    fd, td = from_date or _default_dates()[0], to_date or _default_dates()[1]
    q = {**_date_query(fd, td), "tenant_id": ctx["tenant_id"]}
    store_map: dict = {}

    async for doc in sales_collection.find(q):
        s        = doc.get("summary", {})
        typ      = doc.get("type", "sale")
        store_id = doc.get("store_id") or ""
        net      = _float(s.get("net_payable"))
        qty      = sum(int(i.get("qty", 0) or 0) for i in doc.get("items", []))

        row = store_map.setdefault(store_id, {
            "store_id": store_id or None,
            "store_name": doc.get("store_name", "") or "Unassigned",
            "sale_count": 0, "return_count": 0,
            "gross_revenue": 0.0, "return_amount": 0.0, "net_revenue": 0.0,
            "items_sold": 0,
        })
        if typ == "return":
            row["return_count"]  += 1
            row["return_amount"] += net
        else:
            row["sale_count"]    += 1
            row["gross_revenue"] += net
            row["items_sold"]    += qty

    rows = []
    for r in store_map.values():
        r["net_revenue"]   = round(r["gross_revenue"] - r["return_amount"], 2)
        r["gross_revenue"] = round(r["gross_revenue"], 2)
        r["return_amount"] = round(r["return_amount"], 2)
        rows.append(r)
    rows.sort(key=lambda x: x["net_revenue"], reverse=True)

    return JSONResponse({"status": "success", "from_date": fd, "to_date": td, "count": len(rows), "data": rows})


# ═══════════════════════════════════════════════════════════════════════════════
# GET /cashier/reports/payments
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/reports/payments")
async def reports_payments(
    from_date: Optional[str] = Query(None),
    to_date:   Optional[str] = Query(None),
    authorization: str = Header(None),
    terminal_id: Optional[str] = Query(None),
):
    ctx = await _require_report_context(authorization)
    await _enforce_terminal_restriction(ctx, terminal_id)

    fd, td = from_date or _default_dates()[0], to_date or _default_dates()[1]
    q = {**_date_query(fd, td), "type": "sale", **_report_scope(ctx)}
    pay_map: dict = {}
    grand_total = 0.0

    async for doc in sales_collection.find(q):
        s   = doc.get("summary", {})
        pm  = doc.get("payment_method", "Cash") or "Cash"
        net = _float(s.get("net_payable"))
        day = (doc.get("date") or "")[:10]

        if pm not in pay_map:
            pay_map[pm] = {"method": pm, "count": 0, "revenue": 0.0, "daily": {}}
        pay_map[pm]["count"]   += 1
        pay_map[pm]["revenue"] += net
        grand_total            += net

        if day not in pay_map[pm]["daily"]:
            pay_map[pm]["daily"][day] = {"date": day, "count": 0, "revenue": 0.0}
        pay_map[pm]["daily"][day]["count"]   += 1
        pay_map[pm]["daily"][day]["revenue"] += net

    rows = []
    for p in pay_map.values():
        p["revenue"] = round(p["revenue"], 2)
        p["pct"]     = round((p["revenue"] / grand_total * 100), 1) if grand_total else 0.0
        p["daily"]   = sorted(
            [{"date": d, "count": v["count"], "revenue": round(v["revenue"], 2)} for d, v in p["daily"].items()],
            key=lambda x: x["date"]
        )
        rows.append(p)

    rows.sort(key=lambda x: x["revenue"], reverse=True)
    return JSONResponse({"status": "success", "from_date": fd, "to_date": td, "grand_total": round(grand_total, 2), "data": rows})
