
from fastapi import APIRouter, Query, HTTPException, Header
from fastapi.responses import JSONResponse
from typing import Optional
from datetime import datetime, timedelta
from bson import ObjectId

from ..db import product_collection, inventory_collection, sales_collection, store_stock_collection
from .store_helper import get_store_context

router = APIRouter(prefix="/cashier", tags=["Cashier POS"])


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

    result = await collection.update_one(
        {"_id": doc_id, "tenant_id": tenant_id, "store_id": store_id},
        {
            "$inc": {"stockQty": qty_change},
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
        "unit":         p.get("unit", "pcs"),
        "stock":        round(inv_qty, 2),
        "has_variants": False,
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
        "unit":         v.get("unit", "pcs"),
        "stock":        round(inv_qty, 2),
        "has_variants": True,
        "size_label":   v.get("size_label", ""),
        "color":        v.get("color", ""),
    }


async def _generate_invoice_no(is_return: bool, tenant_id: str, store_id: str) -> str:
    prefix = "CN" if is_return else "INV"
    count  = await sales_collection.count_documents(
        {"type": "return" if is_return else "sale", "tenant_id": tenant_id, "store_id": store_id}
    )
    now = datetime.utcnow()
    return f"NM/{prefix}/{now.strftime('%y%m')}/{str(count + 1).zfill(5)}"


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
        if _is_vendor_only(p):
            inv = await inventory_collection.find_one({"barcode": barcode, "tenant_id": tenant_id})
            if not inv:
                raise HTTPException(
                    status_code=404,
                    detail="Product not available for sale — not inducted via GRN."
                )
        qty = await _inv_qty(barcode, tenant_id, store_id)
        return JSONResponse({"status": "success", "data": _product_to_pos(p, qty)})

    p = await product_collection.find_one({"variants.barcode": barcode, "tenant_id": tenant_id})
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
        "$or": [{"product_name": regex}, {"barcode": regex}, {"sku": regex}]
    }).limit(30):
        if not p.get("has_variants"):
            bc = (p.get("barcode") or "").strip()
            if bc and bc not in seen:
                if _is_vendor_only(p):
                    inv = await inventory_collection.find_one({"barcode": bc, "tenant_id": tenant_id})
                    if not inv:
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
                    seen.add(bc)
                    qty = await _inv_qty(bc, tenant_id, store_id)
                    results.append(_variant_to_pos(p, v, qty))
        if len(results) >= 20:
            break

    if len(results) < 5:
        async for p in product_collection.find({"variants.barcode": regex, "tenant_id": tenant_id}).limit(10):
            for v in p.get("variants", []):
                bc = (v.get("barcode") or "").strip()
                if bc and bc not in seen and q.lower() in bc.lower():
                    if _is_vendor_only(p):
                        inv = await inventory_collection.find_one({"barcode": bc, "tenant_id": tenant_id})
                        if not inv:
                            continue
                    seen.add(bc)
                    qty = await _inv_qty(bc, tenant_id, store_id)
                    results.append(_variant_to_pos(p, v, qty))

    return JSONResponse({"status": "success", "count": len(results), "data": results})


# ═══════════════════════════════════════════════════════════════════════════════
# POST /cashier/bill
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/bill", status_code=201)
async def save_bill(
    payload:       dict,
    authorization: str = Header(None),
):
    is_return    = bool(payload.get("isReturn", False))
    items        = payload.get("items", [])
    summary      = payload.get("summary", {})
    bill_meta = payload.get("bill", {})
    store     = await _require_store_context(authorization)
    tenant_id  = store["tenant_id"]
    store_id   = store["store_id"]
    store_name = store["store_name"]

    # A bill must show the person authenticated to the POS, rather than a
    # browser-provided value that can be stale or manually changed.
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
        duplicate_return = await sales_collection.find_one({
            "type": "return",
            "original_invoice": original_invoice,
            **_store_scope(store),
        })
        if duplicate_return:
            raise HTTPException(status_code=400, detail="This invoice has already been returned.")

    if not items:
        raise HTTPException(status_code=400, detail="No items in bill.")

    now        = datetime.utcnow()
    invoice_no = await _generate_invoice_no(is_return, tenant_id, store_id)

    clean_items = []
    for item in items:
        bc  = (item.get("barcode") or "").strip()
        qty = abs(_int(item.get("qty", 0)))
        if not bc or qty == 0:
            continue
        clean_items.append({
            "barcode":      bc,
            "sku":          item.get("sku", ""),
            "name":         item.get("name", ""),
            "hsn":          item.get("hsn", ""),
            "qty":          qty,
            "price":        _float(item.get("price")),
            "mrp":          _float(item.get("mrp")),
            "cost_price":   _float(item.get("cost_price")),
            "gst":          _float(item.get("gst")),
            "itemDiscount": _float(item.get("itemDiscount")),
            "total":        _float(item.get("total")),
            "division":     item.get("division", ""),
            "section":      item.get("section", ""),
            "department":   item.get("department", ""),
        })

    if not clean_items:
        raise HTTPException(status_code=400, detail="No valid line items.")

    bill_doc = {
        "invoice_no":       invoice_no,
        "type":             "return" if is_return else "sale",
        "original_invoice": payload.get("originalInvoice", ""),
        "date":             now.strftime("%Y-%m-%d %H:%M"),
        "cashier_name":     cashier_name,
        "customer_name":    bill_meta.get("customerName", ""),
        "mobile":           bill_meta.get("mobile", ""),
        "payment_method":   bill_meta.get("paymentMethod", "Cash"),
        "applied_offer":    _float(bill_meta.get("appliedOffer")),
        "discount_pct":     _float(bill_meta.get("discount")),
        "paid_amount":      _float(payload.get("paidAmount")),
        "change_return":    _float(payload.get("changeReturn")),
        "items":            clean_items,
        "tenant_id":        tenant_id,
        "store_id":         store_id,
        "store_name":       store_name,
        "summary": {
            "total_sale":     _float(summary.get("totalSale")),
            "total_savings":  _float(summary.get("totalSavings")),
            "taxable_amount": _float(summary.get("taxableAmount")),
            "cgst_amount":    _float(summary.get("cgstAmount")),
            "sgst_amount":    _float(summary.get("sgstAmount")),
            "igst_amount":    _float(summary.get("igstAmount")),
            "total_gst":      _float(summary.get("totalGstAmount")),
            "round_off":      _float(summary.get("roundOff")),
            "net_payable":    _float(summary.get("netPayable")),
        },
        "created_at": now,
    }

    result = await sales_collection.insert_one(bill_doc)

    inventory_warnings  = []
    inventory_not_found = []

    for item in clean_items:
        bc         = item["barcode"]
        qty        = item["qty"]
        qty_change = qty if is_return else -qty

        update_result = await _apply_stock_change(
            bc           = bc,
            qty_change   = qty_change,
            invoice_no   = invoice_no,
            cashier_name = cashier_name,
            is_return    = is_return,
            now          = now,
            store_id     = store_id,
            store_name   = store_name,
            tenant_id    = tenant_id,
        )

        if not update_result["updated"]:
            inventory_not_found.append({
                "barcode": bc,
                "name":    item.get("name", bc),
                "reason":  update_result.get("reason", "unknown"),
            })
        elif update_result.get("went_negative"):
            inventory_warnings.append(
                f"'{item['name']}' stock went negative "
                f"({update_result['old_qty']} → {update_result['new_qty']})."
            )

    return {
        "status":              "success",
        "invoice_no":          invoice_no,
        "id":                  str(result.inserted_id),
        "message":             f"{'Return bill' if is_return else 'Bill'} saved.",
        "store_id":            store_id,
        "inventory_warnings":  inventory_warnings,
        "inventory_not_found": inventory_not_found,
    }


# ═══════════════════════════════════════════════════════════════════════════════
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

    existing_return = await sales_collection.find_one({
        "type": "return", "original_invoice": invoice_no, **_store_scope(ctx),
    })

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
            "already_returned": existing_return is not None,
            "return_invoice":   existing_return.get("invoice_no") if existing_return else None,
        }
    })


# ═══════════════════════════════════════════════════════════════════════════════
# GET /cashier/dashboard
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/dashboard")
async def get_cashier_dashboard(
    date: Optional[str] = Query(None),
    authorization: str = Header(None),
):
    ctx = await _require_store_context(authorization)
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
    limit:          int             = Query(500, le=2000),
    skip:           int             = Query(0, ge=0),
    authorization: str = Header(None),
):
    ctx = await _require_store_context(authorization)

    query: dict = _store_scope(ctx)

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
            "cashier_name":     doc.get("cashier_name", ""),
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
):
    ctx = await _require_store_context(authorization)

    fd, td = from_date or _default_dates()[0], to_date or _default_dates()[1]
    q = _date_query(fd, td)
    q.update(_store_scope(ctx))

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
# GET /cashier/reports/items
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/reports/items")
async def reports_items(
    from_date: Optional[str] = Query(None),
    to_date:   Optional[str] = Query(None),
    sort_by:   Optional[str] = Query("qty"),
    limit:     int           = Query(50, le=200),
    authorization: str = Header(None),
):
    ctx = await _require_store_context(authorization)

    fd, td = from_date or _default_dates()[0], to_date or _default_dates()[1]
    q = _date_query(fd, td)
    q.update(_store_scope(ctx))
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
):
    ctx = await _require_store_context(authorization)

    fd, td = from_date or _default_dates()[0], to_date or _default_dates()[1]
    q = {**_date_query(fd, td), "type": "sale", **_store_scope(ctx)}
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
):
    ctx = await _require_store_context(authorization)

    fd, td = from_date or _default_dates()[0], to_date or _default_dates()[1]
    q = _date_query(fd, td)
    q.update(_store_scope(ctx))
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
# GET /cashier/reports/payments
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/reports/payments")
async def reports_payments(
    from_date: Optional[str] = Query(None),
    to_date:   Optional[str] = Query(None),
    authorization: str = Header(None),
):
    ctx = await _require_store_context(authorization)

    fd, td = from_date or _default_dates()[0], to_date or _default_dates()[1]
    q = {**_date_query(fd, td), "type": "sale", **_store_scope(ctx)}
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
