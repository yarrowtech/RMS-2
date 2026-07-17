
from fastapi import APIRouter, Query, HTTPException, Depends
from fastapi.responses import JSONResponse
from typing import Optional
from datetime import datetime
from bson import ObjectId
from ..db import product_collection, inventory_collection, grn_collection, vendors_collection, reorder_rules_collection, stock_adjustments_collection, damage_return_collection, store_stock_collection, barcode_label_settings_collection
from .deps import get_hq_tenant, get_any_tenant

router = APIRouter(prefix="/inventory", tags=["Inventory Management"])

DEFAULT_BARCODE_LABEL_FIELDS = [
    "store_name", "barcode", "product_name", "design_no", "aging",
    "brand", "category", "mrp", "size",
]
BARCODE_LABEL_FIELDS = {
    "store_name", "barcode", "barcode_number", "product_name", "design_no",
    "aging", "brand", "vendor", "division", "section", "department",
    "category", "mrp", "size", "color",
}


def _label_template(document: dict | None) -> dict:
    fields = document.get("fields") if document else None
    if not isinstance(fields, list):
        fields = list(DEFAULT_BARCODE_LABEL_FIELDS)
    fields = [field for field in fields if field in BARCODE_LABEL_FIELDS]
    if "barcode" not in fields:
        fields.insert(0, "barcode")
    return {
        "fields": fields,
        "label_size": "38x38",
        "updated_at": document.get("updated_at").isoformat() if document and isinstance(document.get("updated_at"), datetime) else None,
    }


@router.get("/barcode-label-settings")
async def get_barcode_label_settings(ctx: dict = Depends(get_hq_tenant)):
    """Return the HQ-managed print template for this tenant only."""
    document = await barcode_label_settings_collection.find_one({"tenant_id": ctx["tenant_id"]})
    return _label_template(document)


@router.put("/barcode-label-settings")
async def save_barcode_label_settings(payload: dict, ctx: dict = Depends(get_hq_tenant)):
    raw_fields = payload.get("fields")
    if not isinstance(raw_fields, list):
        raise HTTPException(status_code=400, detail="fields must be a list.")
    fields = []
    for field in raw_fields:
        if field in BARCODE_LABEL_FIELDS and field not in fields:
            fields.append(field)
    if "barcode" not in fields:
        fields.insert(0, "barcode")
    if len(fields) > 12:
        raise HTTPException(status_code=400, detail="Choose no more than 12 sticker fields.")
    now = datetime.utcnow()
    await barcode_label_settings_collection.update_one(
        {"tenant_id": ctx["tenant_id"]},
        {"$set": {"fields": fields, "label_size": "38x38", "updated_at": now, "updated_by": ctx.get("admin_id", "")}},
        upsert=True,
    )
    return {"message": "Barcode label template saved for this tenant.", "template": _label_template({"fields": fields, "updated_at": now})}


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def stock_status(qty: float):
    if qty <= 0:
        return {"label": "Out of Stock", "cls": "bg-rose-100 text-rose-700"}
    elif qty <= 20:
        return {"label": "Low Stock",    "cls": "bg-amber-100 text-amber-800"}
    else:
        return {"label": "In Stock",     "cls": "bg-emerald-100 text-emerald-800"}


def active_store_id(ctx: dict) -> Optional[str]:
    """Return the stock location for store users and a single-store owner.

    HQ users continue to work with central inventory. A Store Owner is stored
    as an HQ-scoped account for administration, but has a primary `store_id`;
    operational inventory actions must use that store's stock collection.
    """
    if ctx.get("scope") in ("store", "branch"):
        return ctx.get("store_id") or None
    if ctx.get("department") == "Store Owner":
        return ctx.get("store_id") or None
    return None


def resolve_source(p: dict) -> str:
    """
    Priority:
      1. Explicit source field: "grn", "vendor", "admin"
      2. created_by == "GRN" → "grn"
      3. created_by == "VENDOR" → "vendor"
      4. vendor_id present → "vendor"
      5. Default → "admin"
    """
    source = (p.get("source") or "").lower()
    if source in ("grn", "vendor", "admin"):
        return source
    if (p.get("created_by") or "").upper() == "GRN":
        return "grn"
    if (p.get("created_by") or "").upper() == "VENDOR":
        return "vendor"
    if p.get("vendor_id"):
        return "vendor"
    return "admin"


async def build_vendor_name_map(tenant_id: str) -> dict:
    name_map: dict = {}
    async for v in vendors_collection.find(
        {"tenant_id": tenant_id},
        {"_id": 1, "vendor_id": 1, "name": 1, "business_name": 1, "contact_name": 1},
    ):
        vid = str(v.get("vendor_id") or v["_id"])
        name = (
            v.get("business_name")
            or v.get("name")
            or v.get("contact_name")
            or vid
        )
        name_map[vid] = name
    return name_map


def get_vendor_name(p: dict, name_map: dict) -> str:
    stored = (p.get("vendor_name") or "").strip()
    if stored:
        return stored
    vid = str(p.get("vendor_id") or "")
    if vid:
        return name_map.get(vid, vid)
    return ""


async def build_product_master(tenant_id: str) -> dict:
    """
    Reads product_collection → barcode lookup dict, scoped to tenant_id.
    Includes source (grn/vendor/admin), vendor_name, grn_no.
    """
    vendor_name_map = await build_vendor_name_map(tenant_id)

    master = {}
    async for p in product_collection.find({"tenant_id": tenant_id}):
        source    = resolve_source(p)
        vname     = get_vendor_name(p, vendor_name_map)
        vendor_id = str(p.get("vendor_id") or "")
        grn_no    = p.get("grn_no", "")
        product_id = str(p.get("_id", ""))

        if not p.get("has_variants"):
            bc = (p.get("barcode") or "").strip()
            if bc:
                master[bc] = {
                    "product_id":  product_id,
                    "product":     p.get("product_name", ""),
                    "sku":         p.get("sku", ""),
                    "design_no":   p.get("design_no") or p.get("category1", ""),
                    "brand":       p.get("brand") or p.get("category2", ""),
                    "division":    p.get("division", ""),
                    "section":     p.get("section", ""),
                    "department":  p.get("department", ""),
                    "hsn_code":    p.get("hsn_code", ""),
                    "source":      source,
                    "initial_qty": float(p.get("quantity", 0) or 0),
                    "cost_price":  float(p.get("cost_price", 0) or 0),
                    "mrp":         float(p.get("mrp", 0) or 0),
                    "vendor_id":   vendor_id,
                    "vendor_name": vname,
                    "grn_no":      grn_no,
                }
        else:
            base_name = p.get("product_name", "")
            for v in p.get("variants", []):
                bc = (v.get("barcode") or "").strip()
                if not bc:
                    continue
                parts = [base_name]
                if v.get("size_label"): parts.append(v["size_label"])
                if v.get("color"):      parts.append(v["color"])
                master[bc] = {
                    "product_id":  product_id,
                    "product":     " | ".join(parts),
                    "sku":         v.get("sku", ""),
                    "design_no":   p.get("design_no") or p.get("category1", ""),
                    "brand":       p.get("brand") or p.get("category2", ""),
                    "division":    p.get("division", ""),
                    "section":     p.get("section", ""),
                    "department":  p.get("department", ""),
                    "hsn_code":    p.get("hsn_code", ""),
                    "source":      source,
                    "initial_qty": float(v.get("stock", 0) or 0),
                    "cost_price":  float(v.get("cost_price", 0) or 0),
                    "mrp":         float(p.get("mrp", 0) or 0),
                    "vendor_id":   vendor_id,
                    "vendor_name": vname,
                    "grn_no":      grn_no,
                }
    return master


# ─────────────────────────────────────────────
# GET /inventory/current-stock
# ─────────────────────────────────────────────

@router.get("/current-stock")
async def get_current_stock(
    division:   Optional[str] = Query(None),
    section:    Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    search:     Optional[str] = Query(None),
    ctx:        dict          = Depends(get_hq_tenant),
):
    tenant_id = ctx["tenant_id"]
    product_master = await build_product_master(tenant_id)

    # ── Build GRN date map (barcode → most recent grnDate) ──────────────────
    grn_date_map: dict = {}
    async for grn in grn_collection.find(
        {"status": "Posted", "tenant_id": tenant_id},
        {"grnDate": 1, "items.barcode": 1, "_id": 0}
    ):
        grn_date = (grn.get("grnDate") or "")[:10]
        if not grn_date:
            continue
        for item in grn.get("items", []):
            bc = (item.get("barcode") or "").strip()
            if bc:
                existing = grn_date_map.get(bc, "")
                if grn_date > existing:
                    grn_date_map[bc] = grn_date

    # ── Read inventory_collection ────────────────────────────────────────────
    stock_map = {}
    async for doc in inventory_collection.find({"tenant_id": tenant_id}):
        bc = (doc.get("barcode") or "").strip()
        if bc:
            stock_map[bc] = {
                "stockQty":    float(doc.get("stockQty", 0)),
                "rate":        float(doc.get("rate", 0)),
                "description": doc.get("description", ""),
                "division":    doc.get("division", ""),
                "section":     doc.get("section", ""),
                "department":  doc.get("department", ""),
                "source":      doc.get("source", ""),
                "vendor_name": doc.get("vendor_name", ""),
                "grn_no":      doc.get("grn_no", ""),
                "grn_date":    grn_date_map.get(bc, ""),
                "is_walkin":   doc.get("is_walkin", False),
            }

    all_barcodes = set(product_master.keys()) | set(stock_map.keys())

    rows = []
    for bc in all_barcodes:
        pm  = product_master.get(bc, {})
        stk = stock_map.get(bc, {})

        if pm.get("source") == "vendor" and bc not in stock_map:
            continue

        if bc in stock_map:
            qty        = stk["stockQty"]
            rate       = stk["rate"] if stk["rate"] > 0 else pm.get("cost_price", 0)
            qty_source = "grn"
        else:
            qty        = pm.get("initial_qty", 0)
            rate       = pm.get("cost_price", 0)
            qty_source = "product"

        raw_source  = pm.get("source") or stk.get("source") or "admin"
        vendor_name = pm.get("vendor_name") or stk.get("vendor_name", "")
        vendor_id   = pm.get("vendor_id", "")
        grn_no      = pm.get("grn_no") or stk.get("grn_no", "")
        grn_date    = stk.get("grn_date", "") or grn_date_map.get(bc, "")

        row = {
            "id":          pm.get("product_id", ""),
            "barcode":     bc,
            "sku":         pm.get("sku", ""),
            "design_no":   pm.get("design_no", ""),
            "brand":       pm.get("brand", ""),
            "product":     pm.get("product") or stk.get("description") or bc,
            "division":    pm.get("division") or stk.get("division", ""),
            "section":     pm.get("section")  or stk.get("section",  ""),
            "department":  pm.get("department") or stk.get("department", ""),
            "hsn_code":    pm.get("hsn_code", "") or stk.get("hsn_code", ""),
            "mrp":         pm.get("mrp", 0) or stk.get("mrp", 0),
            "source":      raw_source,
            "vendor_id":   vendor_id,
            "vendor_name": vendor_name,
            "grn_no":      grn_no,
            "grn_date":    grn_date,
            "is_walkin":   stk.get("is_walkin", False),
            "qty":         qty,
            "rate":        rate,
            "qty_source":  qty_source,
            "status":      stock_status(qty),
        }
        rows.append(row)

    if division:
        rows = [r for r in rows if r["division"] == division]
    if section:
        rows = [r for r in rows if r["section"] == section]
    if department:
        rows = [r for r in rows if r["department"] == department]

    if search:
        s = search.strip().lower()
        rows = [
            r for r in rows
            if s in r["product"].lower()
            or s in r["sku"].lower()
            or s in r["barcode"].lower()
            or s in (r["vendor_name"] or "").lower()
            or s in (r["grn_no"] or "").lower()
        ]

    status_order = {"Out of Stock": 2, "Low Stock": 1, "In Stock": 0}
    rows.sort(key=lambda r: (status_order.get(r["status"]["label"], 3), r["product"].lower()))

    return JSONResponse({"status": "success", "count": len(rows), "data": rows})


# ─────────────────────────────────────────────
# GET /inventory/stock-summary
# ─────────────────────────────────────────────

@router.get("/stock-summary")
async def get_stock_summary(ctx: dict = Depends(get_hq_tenant)):
    tenant_id = ctx["tenant_id"]
    product_master = await build_product_master(tenant_id)

    stock_map = {}
    async for doc in inventory_collection.find({"tenant_id": tenant_id}):
        bc = (doc.get("barcode") or "").strip()
        if bc:
            stock_map[bc] = {
                "stockQty": float(doc.get("stockQty", 0)),
                "rate":     float(doc.get("rate", 0)),
                "source":   doc.get("source", ""),
            }

    all_barcodes = set(product_master.keys()) | set(stock_map.keys())

    total = in_stock = low_stock = out_of_stock = 0
    total_value        = 0.0
    division_breakdown = {}
    source_breakdown   = {"admin": 0, "vendor": 0, "grn": 0, "unknown": 0}
    vendor_breakdown   = {}

    for bc in all_barcodes:
        pm  = product_master.get(bc, {})
        stk = stock_map.get(bc, {})

        if bc in stock_map:
            qty  = stk["stockQty"]
            rate = stk["rate"] if stk["rate"] > 0 else pm.get("cost_price", 0)
        else:
            qty  = pm.get("initial_qty", 0)
            rate = pm.get("cost_price", 0)

        total       += 1
        total_value += qty * rate
        s = stock_status(qty)["label"]
        if s == "In Stock":    in_stock     += 1
        elif s == "Low Stock": low_stock    += 1
        else:                  out_of_stock += 1

        source = pm.get("source") or stk.get("source") or "unknown"
        source_breakdown[source] = source_breakdown.get(source, 0) + 1

        div = pm.get("division") or "Unclassified"
        if div not in division_breakdown:
            division_breakdown[div] = {"total": 0, "in_stock": 0, "low_stock": 0, "out_of_stock": 0, "value": 0.0}
        division_breakdown[div]["total"]  += 1
        division_breakdown[div]["value"]  += qty * rate
        if s == "In Stock":    division_breakdown[div]["in_stock"]     += 1
        elif s == "Low Stock": division_breakdown[div]["low_stock"]    += 1
        else:                  division_breakdown[div]["out_of_stock"] += 1

        vname = pm.get("vendor_name") or ""
        if vname:
            if vname not in vendor_breakdown:
                vendor_breakdown[vname] = {"vendor_id": pm.get("vendor_id", ""), "total": 0, "in_stock": 0, "low_stock": 0, "out_of_stock": 0, "value": 0.0}
            vendor_breakdown[vname]["total"]  += 1
            vendor_breakdown[vname]["value"]  += qty * rate
            if s == "In Stock":    vendor_breakdown[vname]["in_stock"]     += 1
            elif s == "Low Stock": vendor_breakdown[vname]["low_stock"]    += 1
            else:                  vendor_breakdown[vname]["out_of_stock"] += 1

    return JSONResponse({
        "status": "success",
        "summary": {
            "total_skus":   total,
            "in_stock":     in_stock,
            "low_stock":    low_stock,
            "out_of_stock": out_of_stock,
            "total_value":  round(total_value, 2),
        },
        "by_division": division_breakdown,
        "by_source":   source_breakdown,
        "by_vendor":   vendor_breakdown,
    })


# ─────────────────────────────────────────────
# GET /inventory/barcode/{barcode}
# ─────────────────────────────────────────────

@router.get("/barcode/{barcode}")
async def get_stock_by_barcode(barcode: str, ctx: dict = Depends(get_hq_tenant)):
    tenant_id      = ctx["tenant_id"]
    barcode        = barcode.strip()
    product_master = await build_product_master(tenant_id)
    stk_doc        = await inventory_collection.find_one({"barcode": barcode, "tenant_id": tenant_id})
    pm             = product_master.get(barcode, {})

    if not pm and not stk_doc:
        raise HTTPException(status_code=404, detail=f"Barcode '{barcode}' not found in products or stock.")

    if stk_doc:
        qty  = float(stk_doc.get("stockQty", 0))
        rate = float(stk_doc.get("rate", 0)) or pm.get("cost_price", 0)
    else:
        qty  = pm.get("initial_qty", 0)
        rate = pm.get("cost_price", 0)

    return {
        "barcode":     barcode,
        "sku":         pm.get("sku", ""),
        "product":     pm.get("product", stk_doc.get("description", barcode) if stk_doc else barcode),
        "division":    pm.get("division", ""),
        "section":     pm.get("section", ""),
        "department":  pm.get("department", ""),
        "source":      pm.get("source") or (stk_doc.get("source", "unknown") if stk_doc else "unknown"),
        "vendor_id":   pm.get("vendor_id", ""),
        "vendor_name": pm.get("vendor_name", "") or (stk_doc.get("vendor_name", "") if stk_doc else ""),
        "grn_no":      pm.get("grn_no", "") or (stk_doc.get("grn_no", "") if stk_doc else ""),
        "qty":         qty,
        "rate":        rate,
        "status":      stock_status(qty),
    }


# ─────────────────────────────────────────────
# POST /inventory/adjust
# ─────────────────────────────────────────────

@router.post("/adjust")
async def manual_adjustment(payload: dict, ctx: dict = Depends(get_hq_tenant)):
    tenant_id   = ctx["tenant_id"]
    barcode     = (payload.get("barcode") or "").strip()
    qty_change  = float(payload.get("qty_change", 0))
    reason      = (payload.get("reason") or "").strip()
    adjusted_by = (payload.get("adjustedBy") or "").strip()

    if not barcode:
        raise HTTPException(status_code=400, detail="barcode is required")
    if qty_change == 0:
        raise HTTPException(status_code=400, detail="qty_change cannot be zero")
    if not reason:
        raise HTTPException(status_code=400, detail="reason is required for audit trail")

    product_master = await build_product_master(tenant_id)
    stk_doc        = await inventory_collection.find_one({"barcode": barcode, "tenant_id": tenant_id})
    pm             = product_master.get(barcode, {})

    if not stk_doc:
        await inventory_collection.insert_one({
            "barcode":     barcode,
            "tenant_id":   tenant_id,
            "stockQty":    pm.get("initial_qty", 0),
            "rate":        pm.get("cost_price", 0),
            "description": pm.get("product", ""),
            "sku":         pm.get("sku", ""),
            "division":    pm.get("division", ""),
            "section":     pm.get("section", ""),
            "department":  pm.get("department", ""),
            "source":      pm.get("source", "admin"),
            "vendor_name": pm.get("vendor_name", ""),
            "grn_no":      pm.get("grn_no", ""),
            "createdAt":   datetime.utcnow(),
        })

    await inventory_collection.update_one(
        {"barcode": barcode, "tenant_id": tenant_id},
        {
            "$inc": {"stockQty": qty_change},
            "$push": {
                "adjustments": {
                    "qty_change":  qty_change,
                    "reason":      reason,
                    "adjustedBy":  adjusted_by,
                    "adjustedAt":  datetime.utcnow().isoformat(),
                }
            },
        },
        upsert=True,
    )

    doc     = await inventory_collection.find_one({"barcode": barcode, "tenant_id": tenant_id})
    new_qty = float(doc.get("stockQty", 0)) if doc else 0.0
    return {"status": "success", "barcode": barcode, "qty_change": qty_change, "new_qty": new_qty, "reason": reason}


# ─────────────────────────────────────────────
# GET /inventory/low-stock-alerts
# ─────────────────────────────────────────────

@router.get("/low-stock-alerts")
async def get_low_stock_alerts(threshold: int = Query(20), ctx: dict = Depends(get_hq_tenant)):
    tenant_id = ctx["tenant_id"]
    product_master = await build_product_master(tenant_id)

    stock_map = {}
    async for doc in inventory_collection.find({"tenant_id": tenant_id}):
        bc = (doc.get("barcode") or "").strip()
        if bc:
            stock_map[bc] = float(doc.get("stockQty", 0))

    alerts = []
    all_barcodes = set(product_master.keys()) | set(stock_map.keys())

    for bc in all_barcodes:
        pm  = product_master.get(bc, {})
        qty = stock_map[bc] if bc in stock_map else pm.get("initial_qty", 0)
        if qty <= threshold:
            alerts.append({
                "barcode":     bc,
                "product":     pm.get("product", bc),
                "sku":         pm.get("sku", ""),
                "division":    pm.get("division", ""),
                "source":      pm.get("source", "unknown"),
                "vendor_id":   pm.get("vendor_id", ""),
                "vendor_name": pm.get("vendor_name", ""),
                "grn_no":      pm.get("grn_no", ""),
                "qty":         qty,
                "status":      stock_status(qty),
            })

    alerts.sort(key=lambda r: r["qty"])
    return JSONResponse({"status": "success", "count": len(alerts), "data": alerts})


# ─────────────────────────────────────────────
# DELETE /inventory/delete/{barcode}
# ─────────────────────────────────────────────

@router.delete("/delete/{barcode}")
async def delete_stock(barcode: str, ctx: dict = Depends(get_hq_tenant)):
    barcode = barcode.strip()
    result  = await inventory_collection.delete_one({"barcode": barcode, "tenant_id": ctx["tenant_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found in inventory")
    return {"status": "success", "deleted": True, "barcode": barcode}


# ─────────────────────────────────────────────
# GET /inventory/diagnose/{barcode}
# ─────────────────────────────────────────────

@router.get("/diagnose/{barcode}")
async def diagnose_barcode(barcode: str, ctx: dict = Depends(get_hq_tenant)):
    tenant_id  = ctx["tenant_id"]
    barcode    = barcode.strip()
    inv_doc    = await inventory_collection.find_one({"barcode": barcode, "tenant_id": tenant_id})
    actual_qty = float(inv_doc.get("stockQty", 0)) if inv_doc else 0.0

    prod_simple  = await product_collection.find_one({"barcode": barcode, "tenant_id": tenant_id}, {"_id": 0})
    prod_variant = await product_collection.find_one(
        {"variants.barcode": barcode, "tenant_id": tenant_id},
        {"_id": 0, "product_name": 1, "variants.$": 1, "vendor_id": 1, "vendor_name": 1, "created_by": 1, "source": 1, "grn_no": 1}
    )

    if inv_doc:
        effective_qty = actual_qty
        qty_source    = "grn (inventory_collection)"
    elif prod_simple:
        effective_qty = float(prod_simple.get("quantity", 0) or 0)
        qty_source    = "product fallback (quantity field)"
    elif prod_variant:
        v = prod_variant.get("variants", [{}])[0]
        effective_qty = float(v.get("stock", 0) or 0)
        qty_source    = "product fallback (variant.stock field)"
    else:
        effective_qty = 0
        qty_source    = "not found anywhere"

    grn_entries  = []
    expected_qty = 0.0
    async for grn in grn_collection.find({"status": "Posted", "items.barcode": barcode, "tenant_id": tenant_id}):
        for item in grn.get("items", []):
            if (item.get("barcode") or "").strip() == barcode:
                inward = float(item.get("inwardQty", 0))
                expected_qty += inward
                grn_entries.append({"grnNo": grn.get("grnNo"), "grnDate": grn.get("grnDate"), "grcNo": grn.get("grcNo"), "poNo": grn.get("poNo"), "inwardQty": inward, "status": grn.get("status")})

    cancelled_entries = []
    cancelled_qty     = 0.0
    async for grn in grn_collection.find({"status": "Cancelled", "items.barcode": barcode, "tenant_id": tenant_id}):
        for item in grn.get("items", []):
            if (item.get("barcode") or "").strip() == barcode:
                inward = float(item.get("inwardQty", 0))
                cancelled_qty += inward
                cancelled_entries.append({"grnNo": grn.get("grnNo"), "inwardQty": inward, "status": "Cancelled (reversed)"})

    net_expected = round(expected_qty - cancelled_qty, 4)
    diff         = round(net_expected - actual_qty, 4)

    source_doc      = prod_simple or prod_variant
    resolved_source = resolve_source(source_doc) if source_doc else "unknown"
    vendor_name_map = await build_vendor_name_map(tenant_id)
    resolved_vname  = get_vendor_name(source_doc, vendor_name_map) if source_doc else ""
    resolved_vid    = str((source_doc or {}).get("vendor_id") or "")
    resolved_grn_no = (source_doc or {}).get("grn_no", "") or (inv_doc.get("grn_no", "") if inv_doc else "")

    return {
        "barcode":     barcode,
        "source":      resolved_source,
        "vendor_id":   resolved_vid,
        "vendor_name": resolved_vname,
        "grn_no":      resolved_grn_no,
        "inventory_record": {
            "exists":      inv_doc is not None,
            "stockQty":    actual_qty,
            "rate":        float(inv_doc.get("rate", 0)) if inv_doc else 0,
            "description": inv_doc.get("description", "") if inv_doc else "",
        },
        "product_record": {
            "simple_product":  prod_simple  is not None,
            "variant_product": prod_variant is not None,
            "name": (
                prod_simple.get("product_name")  if prod_simple
                else prod_variant.get("product_name") if prod_variant
                else "NOT FOUND"
            ),
        },
        "effective_display": {"qty": effective_qty, "source": qty_source},
        "grn_history": {
            "posted_grns":      grn_entries,
            "posted_total":     round(expected_qty, 4),
            "cancelled_grns":   cancelled_entries,
            "cancelled_total":  round(cancelled_qty, 4),
            "net_expected_qty": net_expected,
        },
        "stock_check": {
            "actual_qty":   actual_qty,
            "expected_qty": net_expected,
            "difference":   diff,
            "in_sync":      abs(diff) < 0.001,
            "verdict": "✓ In sync" if abs(diff) < 0.001 else f"✗ Out of sync by {diff}",
        },
    }


# ─────────────────────────────────────────────
# POST /inventory/resync-from-grns
# ─────────────────────────────────────────────

@router.post("/resync-from-grns")
async def resync_from_grns(payload: dict = {}, ctx: dict = Depends(get_hq_tenant)):
    if not payload.get("confirm"):
        raise HTTPException(status_code=400, detail="Pass { confirm: true } to run resync.")

    tenant_id = ctx["tenant_id"]
    qty_map: dict = {}
    async for grn in grn_collection.find({"status": "Posted", "tenant_id": tenant_id}):
        for item in grn.get("items", []):
            bc     = (item.get("barcode") or "").strip()
            inward = float(item.get("inwardQty", 0))
            rate   = float(item.get("rate", 0))
            desc   = item.get("description", "")
            if not bc or inward == 0:
                continue
            if bc not in qty_map:
                qty_map[bc] = {"qty": 0.0, "rate": rate, "description": desc,
                               "grn_no": grn.get("grnNo", ""), "vendor": grn.get("vendorName", "")}
            qty_map[bc]["qty"] += inward

    async for grn in grn_collection.find({"status": "Cancelled", "tenant_id": tenant_id}):
        for item in grn.get("items", []):
            bc     = (item.get("barcode") or "").strip()
            inward = float(item.get("inwardQty", 0))
            if not bc or inward == 0:
                continue
            if bc in qty_map:
                qty_map[bc]["qty"] -= inward

    product_master = await build_product_master(tenant_id)

    updated = 0
    for bc, data in qty_map.items():
        net_qty = round(data["qty"], 4)
        pm      = product_master.get(bc, {})
        is_walkin = bc.startswith("ITEM/") or bc.startswith("WALKIN/")
        source  = pm.get("source") or ("grn" if is_walkin else "admin")
        await inventory_collection.update_one(
            {"barcode": bc, "tenant_id": tenant_id},
            {"$set": {
                "barcode":     bc,
                "tenant_id":   tenant_id,
                "stockQty":    net_qty,
                "rate":        data["rate"],
                "description": data["description"],
                "vendor_name": pm.get("vendor_name", "") or data.get("vendor", ""),
                "source":      source,
                "grn_no":      pm.get("grn_no", "") or data.get("grn_no", ""),
                "is_walkin":   is_walkin,
                "resynced_at": datetime.utcnow(),
            }},
            upsert=True,
        )
        updated += 1

    return {"status": "success", "message": f"Resynced {updated} barcode(s) from GRN history.", "barcodes_updated": list(qty_map.keys())}


# ─────────────────────────────────────────────
# GET /inventory/stock-ledger
# ─────────────────────────────────────────────

@router.get("/stock-ledger")
async def get_stock_ledger(
    division:      Optional[str] = Query(None),
    section:       Optional[str] = Query(None),
    department:    Optional[str] = Query(None),
    movement_type: Optional[str] = Query(None),
    warehouse:     Optional[str] = Query(None),
    from_date:     Optional[str] = Query(None),
    to_date:       Optional[str] = Query(None),
    search:        Optional[str] = Query(None),
    ctx:           dict          = Depends(get_any_tenant),
):
    """
    Unified stock ledger combining:
      1. GRN Posted items     → doc_type = "GRN (Purchase In)"
      2. GRN Cancelled items  → doc_type = "GRN Reversal"
      3. inventory adjustments → doc_type = "Adjustment"
    """
    tenant_id = ctx["tenant_id"]
    store_id = active_store_id(ctx)
    product_master = await build_product_master(tenant_id)
    rows = []

    # ── 1. GRN movements ────────────────────────────────────────────────
    grn_query = {"status": {"$in": ["Posted", "Cancelled"]}, "tenant_id": tenant_id}
    if store_id:
        grn_query["receiving_store_id"] = store_id
    async for grn in grn_collection.find(grn_query):
        grn_no    = grn.get("grnNo", "")
        grn_date  = (grn.get("grnDate") or "")[:10]
        vendor    = grn.get("vendorName", "")
        wh        = grn.get("receiving_store_name", "") or grn.get("warehouseCode", "") or (ctx.get("store_name") if store_id else "Main Warehouse") or "Store"
        is_posted = grn.get("status") == "Posted"
        doc_type  = "GRN (Purchase In)" if is_posted else "GRN Reversal"

        for item in grn.get("items", []):
            bc     = (item.get("barcode") or "").strip()
            inward = float(item.get("inwardQty", 0))
            rate   = float(item.get("rate", 0))
            desc   = item.get("description", "")
            if not bc or inward == 0:
                continue

            pm      = product_master.get(bc, {})
            in_qty  = inward if is_posted else 0
            out_qty = inward if not is_posted else 0

            rows.append({
                "date":       grn_date,
                "doc_type":   doc_type,
                "doc_no":     grn_no,
                "barcode":    bc,
                "sku":        pm.get("sku", ""),
                "product":    pm.get("product") or desc or bc,
                "division":   pm.get("division", ""),
                "section":    pm.get("section", ""),
                "department": pm.get("department", ""),
                "warehouse":  wh,
                "in_qty":     round(in_qty, 3),
                "out_qty":    round(out_qty, 3),
                "rate":       rate,
                "value":      round(inward * rate, 2),
                "ref":        f"Vendor: {vendor}" if vendor else grn_no,
                "remarks":    grn.get("remarks", ""),
                "source":     "grn",
            })

    # ── 2. Manual adjustments from inventory_collection ──────────────────
    adjustment_query = {"tenant_id": tenant_id, "adjustments": {"$exists": True, "$not": {"$size": 0}}}
    adjustment_collection = inventory_collection
    if store_id:
        adjustment_collection = store_stock_collection
        adjustment_query["store_id"] = store_id
    async for doc in adjustment_collection.find(adjustment_query):
        bc = (doc.get("barcode") or "").strip()
        if not bc:
            continue
        pm = product_master.get(bc, {})

        for adj in doc.get("adjustments", []):
            qty_change  = float(adj.get("qty_change", 0))
            adjusted_at = (adj.get("adjustedAt") or "")[:10]
            reason      = adj.get("reason", "")
            adjusted_by = adj.get("adjustedBy", "")

            in_qty  = qty_change if qty_change > 0 else 0
            out_qty = abs(qty_change) if qty_change < 0 else 0

            source = adj.get("source", "")
            doc_type = "POS Return" if source == "pos_sale" and qty_change > 0 else "POS Sale" if source == "pos_sale" else "Adjustment"
            rows.append({
                "date":       adjusted_at,
                "doc_type":   doc_type,
                "doc_no":     adj.get("ref_no") or f"ADJ-{bc[:8]}",
                "barcode":    bc,
                "sku":        pm.get("sku", ""),
                "product":    pm.get("product") or doc.get("description", bc),
                "division":   pm.get("division", ""),
                "section":    pm.get("section", ""),
                "department": pm.get("department", ""),
                "warehouse":  doc.get("store_name", "") or (ctx.get("store_name") if store_id else "Main Warehouse") or "Store",
                "in_qty":     round(in_qty, 3),
                "out_qty":    round(out_qty, 3),
                "rate":       float(doc.get("rate", 0)),
                "value":      0.0,
                "ref":        f"By: {adjusted_by}" if adjusted_by else "Manual",
                "remarks":    reason,
                "source":     "adjustment",
            })

    # ── Apply filters ─────────────────────────────────────────────────────
    if division:
        rows = [r for r in rows if r["division"] == division]
    if section:
        rows = [r for r in rows if r["section"] == section]
    if department:
        rows = [r for r in rows if r["department"] == department]
    if movement_type and movement_type != "All":
        rows = [r for r in rows if r["doc_type"] == movement_type]
    if warehouse and warehouse != "All":
        rows = [r for r in rows if r["warehouse"] == warehouse]
    if from_date:
        rows = [r for r in rows if r["date"] >= from_date]
    if to_date:
        rows = [r for r in rows if r["date"] <= to_date]
    if search:
        s = search.strip().lower()
        rows = [
            r for r in rows
            if s in r["product"].lower()
            or s in r["sku"].lower()
            or s in r["barcode"].lower()
            or s in r["doc_no"].lower()
        ]

    rows.sort(key=lambda r: r["date"], reverse=True)

    return JSONResponse({
        "status": "success",
        "count":  len(rows),
        "data":   rows,
    })


# ─────────────────────────────────────────────────────────────────────────────
# REORDER RULES ROUTES
# ─────────────────────────────────────────────────────────────────────────────

def reorder_status(current: float, level: float) -> str:
    if not level:
        return "NA"
    return "LOW" if current <= level else "OK"


@router.get("/reorder-rules")
async def get_reorder_rules(
    division:   Optional[str] = Query(None),
    section:    Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    warehouse:  Optional[str] = Query(None),
    search:     Optional[str] = Query(None),
    low_only:   bool          = Query(False),
    ctx:        dict          = Depends(get_hq_tenant),
):
    tenant_id = ctx["tenant_id"]

    stock_map: dict = {}
    async for doc in inventory_collection.find({"tenant_id": tenant_id}, {"barcode": 1, "stockQty": 1, "_id": 0}):
        bc = (doc.get("barcode") or "").strip()
        if bc:
            stock_map[bc] = float(doc.get("stockQty", 0) or 0)

    product_qty_map: dict = {}
    async for p in product_collection.find(
        {"has_variants": False, "tenant_id": tenant_id},
        {"barcode": 1, "quantity": 1, "_id": 0}
    ):
        bc = (p.get("barcode") or "").strip()
        if bc:
            product_qty_map[bc] = float(p.get("quantity", 0) or 0)

    rows = []
    async for doc in reorder_rules_collection.find({"tenant_id": tenant_id}):
        bc            = (doc.get("barcode") or "").strip()
        reorder_level = float(doc.get("reorder_level", 0) or 0)
        reorder_qty   = float(doc.get("reorder_qty", 0) or 0)
        lead_time     = int(doc.get("lead_time_days", 0) or 0)

        current_stock = stock_map.get(bc, product_qty_map.get(bc, 0))

        status = reorder_status(current_stock, reorder_level)

        rows.append({
            "id":            str(doc["_id"]),
            "division":      doc.get("division", ""),
            "section":       doc.get("section", ""),
            "department":    doc.get("department", ""),
            "sku":           doc.get("sku", ""),
            "barcode":       bc,
            "product":       doc.get("product", ""),
            "warehouse":     doc.get("warehouse", ""),
            "current_stock": round(current_stock, 3),
            "reorder_level": reorder_level,
            "reorder_qty":   reorder_qty,
            "lead_time_days":lead_time,
            "supplier":      doc.get("supplier", ""),
            "remarks":       doc.get("remarks", ""),
            "status":        status,
            "created_at":    str(doc.get("created_at", "")),
            "updated_at":    str(doc.get("updated_at", "")),
        })

    if division:
        rows = [r for r in rows if r["division"] == division]
    if section:
        rows = [r for r in rows if r["section"] == section]
    if department:
        rows = [r for r in rows if r["department"] == department]
    if warehouse and warehouse != "All":
        rows = [r for r in rows if r["warehouse"] == warehouse]
    if low_only:
        rows = [r for r in rows if r["status"] == "LOW"]
    if search:
        s = search.strip().lower()
        rows = [
            r for r in rows
            if s in r["product"].lower()
            or s in r["sku"].lower()
            or s in r["barcode"].lower()
        ]

    rows.sort(key=lambda r: (r["status"] != "LOW", r["product"].lower()))

    return JSONResponse({"status": "success", "count": len(rows), "data": rows})


@router.post("/reorder-rules", status_code=201)
async def create_reorder_rule(payload: dict, ctx: dict = Depends(get_hq_tenant)):
    tenant_id = ctx["tenant_id"]
    barcode = (payload.get("barcode") or "").strip()
    sku     = (payload.get("sku") or "").strip()
    product = (payload.get("product") or "").strip()

    if not barcode and not sku:
        raise HTTPException(status_code=400, detail="barcode or sku is required")

    warehouse = (payload.get("warehouse") or "").strip()
    existing  = await reorder_rules_collection.find_one(
        {"barcode": barcode, "warehouse": warehouse, "tenant_id": tenant_id}
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"A reorder rule already exists for barcode '{barcode}' in warehouse '{warehouse}'."
        )

    doc = {
        "division":       (payload.get("division")    or "").strip(),
        "section":        (payload.get("section")     or "").strip(),
        "department":     (payload.get("department")  or "").strip(),
        "sku":            sku,
        "barcode":        barcode,
        "product":        product,
        "warehouse":      warehouse,
        "reorder_level":  float(payload.get("reorder_level",  0) or 0),
        "reorder_qty":    float(payload.get("reorder_qty",    0) or 0),
        "lead_time_days": int(payload.get("lead_time_days",   0) or 0),
        "supplier":       (payload.get("supplier") or "").strip(),
        "remarks":        (payload.get("remarks")  or "").strip(),
        "tenant_id":      tenant_id,
        "created_at":     datetime.utcnow(),
        "updated_at":     datetime.utcnow(),
    }

    result = await reorder_rules_collection.insert_one(doc)
    return {"message": "Reorder rule created", "id": str(result.inserted_id)}


@router.put("/reorder-rules/{rule_id}")
async def update_reorder_rule(rule_id: str, payload: dict, ctx: dict = Depends(get_hq_tenant)):
    try:
        oid = ObjectId(rule_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid rule ID")

    existing = await reorder_rules_collection.find_one({"_id": oid, "tenant_id": ctx["tenant_id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Reorder rule not found")

    update = {
        "division":       (payload.get("division")    or "").strip(),
        "section":        (payload.get("section")     or "").strip(),
        "department":     (payload.get("department")  or "").strip(),
        "sku":            (payload.get("sku")         or "").strip(),
        "barcode":        (payload.get("barcode")     or "").strip(),
        "product":        (payload.get("product")     or "").strip(),
        "warehouse":      (payload.get("warehouse")   or "").strip(),
        "reorder_level":  float(payload.get("reorder_level",  0) or 0),
        "reorder_qty":    float(payload.get("reorder_qty",    0) or 0),
        "lead_time_days": int(payload.get("lead_time_days",   0) or 0),
        "supplier":       (payload.get("supplier") or "").strip(),
        "remarks":        (payload.get("remarks")  or "").strip(),
        "updated_at":     datetime.utcnow(),
    }

    await reorder_rules_collection.update_one({"_id": oid, "tenant_id": ctx["tenant_id"]}, {"$set": update})
    return {"message": "Reorder rule updated"}


@router.delete("/reorder-rules/{rule_id}")
async def delete_reorder_rule(rule_id: str, ctx: dict = Depends(get_hq_tenant)):
    try:
        oid = ObjectId(rule_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid rule ID")

    result = await reorder_rules_collection.delete_one({"_id": oid, "tenant_id": ctx["tenant_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reorder rule not found")
    return {"message": "Reorder rule deleted"}


# ─────────────────────────────────────────────────────────────────────────────
# STOCK ADJUSTMENTS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/stock-adjustments")
async def get_stock_adjustments(
    division:   Optional[str] = Query(None),
    section:    Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    warehouse:  Optional[str] = Query(None),
    search:     Optional[str] = Query(None),
    from_date:  Optional[str] = Query(None),
    to_date:    Optional[str] = Query(None),
    ctx:        dict          = Depends(get_any_tenant),
):
    rows = []
    store_id = active_store_id(ctx)
    query = {"tenant_id": ctx["tenant_id"]}
    if store_id:
        query["store_id"] = store_id
    async for doc in stock_adjustments_collection.find(query).sort("created_at", -1):
        rec = {
            "id":         str(doc["_id"]),
            "date":       doc.get("date", ""),
            "warehouse":  doc.get("warehouse", ""),
            "ref_no":     doc.get("ref_no", ""),
            "created_by": doc.get("created_by", ""),
            "note":       doc.get("note", ""),
            "lines":      doc.get("lines", []),
            "created_at": str(doc.get("created_at", "")),
        }
        rows.append(rec)

    if warehouse and warehouse != "All":
        rows = [r for r in rows if r["warehouse"] == warehouse]
    if from_date:
        rows = [r for r in rows if r["date"][:10] >= from_date]
    if to_date:
        rows = [r for r in rows if r["date"][:10] <= to_date]

    if division or section or department or search:
        filtered = []
        s = (search or "").strip().lower()
        for rec in rows:
            match = any(
                ((not division   or l.get("division")   == division)  and
                 (not section    or l.get("section")    == section)   and
                 (not department or l.get("department") == department) and
                 (not s or
                  s in (l.get("product", "") or "").lower() or
                  s in (l.get("sku", "") or "").lower() or
                  s in str(l.get("barcode", "") or "").lower() or
                  s in (rec.get("ref_no", "") or "").lower() or
                  s in (l.get("reason", "") or "").lower()))
                for l in rec["lines"]
            )
            if match:
                filtered.append(rec)
        rows = filtered

    return JSONResponse({"status": "success", "count": len(rows), "data": rows})


@router.post("/stock-adjustments", status_code=201)
async def create_stock_adjustment(payload: dict, ctx: dict = Depends(get_any_tenant)):
    tenant_id = ctx["tenant_id"]
    store_id = active_store_id(ctx)
    lines = payload.get("lines", [])
    if not lines:
        raise HTTPException(status_code=400, detail="At least one line is required.")

    clean_lines = []
    for l in lines:
        bc         = (l.get("barcode") or "").strip()
        sku        = (l.get("sku") or "").strip()
        qty_change = int(l.get("qty_change", 0) or 0)
        reason     = (l.get("reason") or "").strip()

        if not (bc or sku):
            continue
        if qty_change == 0:
            continue
        if not reason:
            raise HTTPException(status_code=400, detail=f"Reason is required for SKU '{sku}'.")

        clean_lines.append({
            "sku":        sku,
            "barcode":    bc,
            "product":    (l.get("product") or "").strip(),
            "division":   (l.get("division") or "").strip(),
            "section":    (l.get("section") or "").strip(),
            "department": (l.get("department") or "").strip(),
            "qty_change": qty_change,
            "reason":     reason,
            "remarks":    (l.get("remarks") or "").strip(),
        })

    if not clean_lines:
        raise HTTPException(status_code=400, detail="No valid lines (need SKU/barcode, non-zero qty, reason).")

    warehouse  = (payload.get("warehouse") or "").strip()
    created_by = (payload.get("created_by") or "Admin").strip()

    doc = {
        "date":       payload.get("date", datetime.utcnow().strftime("%Y-%m-%d %H:%M")),
        "warehouse":  warehouse,
        "ref_no":     (payload.get("ref_no") or "").strip(),
        "created_by": created_by,
        "note":       (payload.get("note") or "").strip(),
        "lines":      clean_lines,
        "tenant_id":  tenant_id,
        "store_id":   store_id,
        "store_name": ctx.get("store_name", "") if store_id else "",
        "created_at": datetime.utcnow(),
    }

    result = await stock_adjustments_collection.insert_one(doc)

    # ── Apply each line to inventory_collection ────────────────────────────
    product_master_cache = None
    stock_collection = store_stock_collection if store_id else inventory_collection
    for l in clean_lines:
        bc         = l["barcode"]
        qty_change = l["qty_change"]
        reason     = l["reason"]
        adj_by     = created_by

        if not bc:
            continue

        stock_query = {"barcode": bc, "tenant_id": tenant_id}
        if store_id:
            stock_query["store_id"] = store_id
        stk_doc = await stock_collection.find_one(stock_query)
        if not stk_doc:
            if product_master_cache is None:
                product_master_cache = await build_product_master(tenant_id)
            pm = product_master_cache.get(bc, {})
            initial_qty = 0 if store_id else pm.get("initial_qty", 0)
            await stock_collection.insert_one({
                "barcode":     bc,
                "tenant_id":   tenant_id,
                "store_id":    store_id,
                "store_name":  ctx.get("store_name", "") if store_id else "",
                "stockQty":    initial_qty,
                "rate":        pm.get("cost_price", 0),
                "description": pm.get("product", ""),
                "sku":         pm.get("sku", ""),
                "division":    pm.get("division", ""),
                "section":     pm.get("section", ""),
                "department":  pm.get("department", ""),
                "source":      pm.get("source", "admin"),
                "vendor_name": pm.get("vendor_name", ""),
                "createdAt":   datetime.utcnow(),
            })

        current_qty = float((stk_doc or {}).get("stockQty", 0))
        if current_qty + qty_change < 0:
            raise HTTPException(status_code=400, detail=f"Adjustment would make '{l['product'] or bc}' stock negative.")

        await stock_collection.update_one(
            stock_query,
            {
                "$inc": {"stockQty": qty_change},
                "$push": {
                    "adjustments": {
                        "qty_change": qty_change,
                        "reason":     reason,
                        "adjustedBy": adj_by,
                        "adjustedAt": datetime.utcnow().isoformat(),
                        "ref_no":     doc["ref_no"],
                        "source":     "stock_adjustment",
                    }
                },
            },
            upsert=True,
        )

    return {"message": "Stock adjustment saved and inventory updated.", "id": str(result.inserted_id)}


# ─────────────────────────────────────────────────────────────────────────────
# DAMAGE & RETURN
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/damage-return")
async def get_damage_return(
    type_filter: Optional[str] = Query(None, alias="type"),
    warehouse:   Optional[str] = Query(None),
    division:    Optional[str] = Query(None),
    section:     Optional[str] = Query(None),
    department:  Optional[str] = Query(None),
    search:      Optional[str] = Query(None),
    ctx:         dict          = Depends(get_hq_tenant),
):
    rows = []
    async for doc in damage_return_collection.find({"tenant_id": ctx["tenant_id"]}).sort("created_at", -1):
        rec = {
            "id":         str(doc["_id"]),
            "type":       doc.get("type", "Damage"),
            "date":       doc.get("date", ""),
            "ref_no":     doc.get("ref_no", ""),
            "created_by": doc.get("created_by", ""),
            "warehouse":  doc.get("warehouse", ""),
            "note":       doc.get("note", ""),
            "status":     doc.get("status", "Completed"),
            "lines":      doc.get("lines", []),
            "created_at": str(doc.get("created_at", "")),
        }
        rows.append(rec)

    if type_filter and type_filter != "All":
        rows = [r for r in rows if r["type"] == type_filter]
    if warehouse and warehouse != "All":
        rows = [r for r in rows if r["warehouse"] == warehouse]

    if division or section or department or search:
        filtered = []
        s = (search or "").strip().lower()
        for rec in rows:
            match = any(
                ((not division   or l.get("division")   == division)  and
                 (not section    or l.get("section")    == section)   and
                 (not department or l.get("department") == department) and
                 (not s or
                  s in (l.get("product", "") or "").lower() or
                  s in (l.get("sku", "") or "").lower() or
                  s in str(l.get("barcode", "") or "").lower() or
                  s in (rec.get("ref_no", "") or "").lower() or
                  s in (l.get("action", "") or "").lower()))
                for l in rec["lines"]
            )
            if match:
                filtered.append(rec)
        rows = filtered

    return JSONResponse({"status": "success", "count": len(rows), "data": rows})


@router.post("/damage-return", status_code=201)
async def create_damage_return(payload: dict, ctx: dict = Depends(get_hq_tenant)):
    tenant_id = ctx["tenant_id"]
    rec_type = (payload.get("type") or "Damage").strip()
    if rec_type not in ("Damage", "Return"):
        raise HTTPException(status_code=400, detail="type must be 'Damage' or 'Return'.")

    lines = payload.get("lines", [])
    if not lines:
        raise HTTPException(status_code=400, detail="At least one line is required.")

    stock_map: dict = {}
    async for doc in inventory_collection.find({"tenant_id": tenant_id}, {"barcode": 1, "stockQty": 1, "_id": 0}):
        bc = (doc.get("barcode") or "").strip()
        if bc:
            stock_map[bc] = float(doc.get("stockQty", 0) or 0)

    clean_lines = []
    for l in lines:
        bc      = (l.get("barcode") or "").strip()
        sku     = (l.get("sku") or "").strip()
        qty     = int(l.get("qty", 0) or 0)
        action  = (l.get("action") or "").strip()

        if not (bc or sku) or qty <= 0:
            continue

        if rec_type == "Damage" and bc:
            available = stock_map.get(bc, 0)
            if qty > available:
                raise HTTPException(
                    status_code=400,
                    detail=f"Damage qty ({qty}) exceeds available stock ({available}) for barcode '{bc}'."
                )

        clean_lines.append({
            "sku":        sku,
            "barcode":    bc,
            "product":    (l.get("product") or "").strip(),
            "division":   (l.get("division") or "").strip(),
            "section":    (l.get("section") or "").strip(),
            "department": (l.get("department") or "").strip(),
            "available":  stock_map.get(bc, 0),
            "qty":        qty,
            "action":     action,
            "remarks":    (l.get("remarks") or "").strip(),
        })

    if not clean_lines:
        raise HTTPException(status_code=400, detail="No valid lines (need SKU/barcode and qty > 0).")

    warehouse  = (payload.get("warehouse") or "").strip()
    created_by = (payload.get("created_by") or "Inventory").strip()
    ref_no     = (payload.get("ref_no") or "").strip()

    doc = {
        "type":       rec_type,
        "date":       payload.get("date", datetime.utcnow().strftime("%Y-%m-%d %H:%M")),
        "ref_no":     ref_no,
        "created_by": created_by,
        "warehouse":  warehouse,
        "note":       (payload.get("note") or "").strip(),
        "status":     "Completed",
        "lines":      clean_lines,
        "tenant_id":  tenant_id,
        "created_at": datetime.utcnow(),
    }

    result = await damage_return_collection.insert_one(doc)

    # ── Update inventory ──────────────────────────────────────────────────────
    for l in clean_lines:
        bc     = l["barcode"]
        qty    = l["qty"]
        action = l["action"]

        if not bc:
            continue

        if rec_type == "Damage":
            qty_change = -qty
        elif rec_type == "Return" and action == "Restock":
            qty_change = qty
        else:
            continue

        await inventory_collection.update_one(
            {"barcode": bc, "tenant_id": tenant_id},
            {
                "$inc": {"stockQty": qty_change},
                "$push": {
                    "adjustments": {
                        "qty_change": qty_change,
                        "reason":     f"{rec_type} - {action}",
                        "adjustedBy": created_by,
                        "adjustedAt": datetime.utcnow().isoformat(),
                        "ref_no":     ref_no,
                        "source":     "damage_return",
                    }
                },
            },
            upsert=True,
        )

    return {"message": f"{rec_type} record saved and inventory updated.", "id": str(result.inserted_id)}


# ─────────────────────────────────────────────────────────────────────────────
# INVENTORY DASHBOARD ROUTE
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/dashboard")
async def get_inventory_dashboard(ctx: dict = Depends(get_hq_tenant)):
    """
    Single endpoint that returns all data needed for the inventory dashboard.
    """
    tenant_id = ctx["tenant_id"]
    product_master = await build_product_master(tenant_id)

    stock_map: dict = {}
    async for doc in inventory_collection.find({"tenant_id": tenant_id}):
        bc = (doc.get("barcode") or "").strip()
        if bc:
            stock_map[bc] = {
                "stockQty":    float(doc.get("stockQty", 0) or 0),
                "rate":        float(doc.get("rate", 0) or 0),
                "source":      doc.get("source", "admin"),
                "vendor_name": doc.get("vendor_name", ""),
                "description": doc.get("description", ""),
                "grn_no":      doc.get("grn_no", ""),
            }

    all_barcodes = set(product_master.keys()) | set(stock_map.keys())

    total_skus     = 0
    total_value    = 0.0
    in_stock_count = 0
    low_stock_count= 0
    out_stock_count= 0
    division_map: dict = {}
    source_breakdown = {"admin": 0, "vendor": 0, "grn": 0}
    low_stock_items  = []
    out_stock_items  = []
    top_items        = []

    for bc in all_barcodes:
        pm  = product_master.get(bc, {})
        stk = stock_map.get(bc, {})

        if pm.get("source") == "vendor" and bc not in stock_map:
            continue

        qty  = stk.get("stockQty", pm.get("initial_qty", 0)) if bc in stock_map else pm.get("initial_qty", 0)
        rate = stk.get("rate", 0) if bc in stock_map else pm.get("cost_price", 0)
        if rate == 0:
            rate = pm.get("cost_price", 0)

        value       = qty * rate
        source      = pm.get("source") or stk.get("source") or "admin"
        division    = pm.get("division") or "Unclassified"
        product_name= pm.get("product") or stk.get("description") or bc

        total_skus  += 1
        total_value += value

        s = stock_status(qty)["label"]
        if s == "In Stock":    in_stock_count  += 1
        elif s == "Low Stock": low_stock_count += 1
        else:                  out_stock_count += 1

        src_key = source if source in source_breakdown else "admin"
        source_breakdown[src_key] = source_breakdown.get(src_key, 0) + 1

        if division not in division_map:
            division_map[division] = {"count": 0, "value": 0.0, "in_stock": 0, "low_stock": 0, "out_of_stock": 0}
        division_map[division]["count"]   += 1
        division_map[division]["value"]   += value
        if s == "In Stock":    division_map[division]["in_stock"]   += 1
        elif s == "Low Stock": division_map[division]["low_stock"]  += 1
        else:                  division_map[division]["out_of_stock"] += 1

        if 0 < qty <= 20:
            low_stock_items.append({
                "barcode":  bc,
                "sku":      pm.get("sku", ""),
                "product":  product_name,
                "division": division,
                "qty":      round(qty, 2),
                "value":    round(value, 2),
                "source":   source,
            })

        if qty <= 0:
            out_stock_items.append({
                "barcode":  bc,
                "sku":      pm.get("sku", ""),
                "product":  product_name,
                "division": division,
                "source":   source,
            })

        top_items.append({
            "barcode":  bc,
            "sku":      pm.get("sku", ""),
            "product":  product_name,
            "division": division,
            "qty":      round(qty, 2),
            "rate":     round(rate, 2),
            "value":    round(value, 2),
            "source":   source,
        })

    low_stock_items.sort(key=lambda x: x["qty"])
    out_stock_items = out_stock_items[:20]
    top_items       = sorted(top_items, key=lambda x: x["value"], reverse=True)[:10]

    division_chart = sorted(
        [{"division": k, **v, "value": round(v["value"], 2)} for k, v in division_map.items()],
        key=lambda x: x["value"],
        reverse=True
    )[:10]

    now         = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)

    grn_this_month = await grn_collection.count_documents({
        "status": "Posted",
        "tenant_id": tenant_id,
        "createdAt": {"$gte": month_start},
    })

    adj_this_month = await stock_adjustments_collection.count_documents({
        "tenant_id": tenant_id,
        "created_at": {"$gte": month_start},
    })

    dmg_this_month = await damage_return_collection.count_documents({
        "tenant_id": tenant_id,
        "created_at": {"$gte": month_start},
    })

    recent_movements = []

    async for grn in grn_collection.find({"status": "Posted", "tenant_id": tenant_id}).sort("createdAt", -1).limit(6):
        recent_movements.append({
            "date":     str(grn.get("grnDate") or "")[:10],
            "type":     "GRN",
            "ref":      grn.get("grnNo", ""),
            "vendor":   grn.get("vendorName", ""),
            "qty":      round(float(grn.get("totalInwardQty", 0) or 0), 2),
            "value":    round(float(grn.get("totalAmount", 0) or 0), 2),
            "color":    "green",
        })

    async for adj in stock_adjustments_collection.find({"tenant_id": tenant_id}).sort("created_at", -1).limit(4):
        net = sum(int(l.get("qty_change", 0) or 0) for l in adj.get("lines", []))
        recent_movements.append({
            "date":   str(adj.get("date") or "")[:10],
            "type":   "Adjustment",
            "ref":    adj.get("ref_no", ""),
            "vendor": adj.get("note", ""),
            "qty":    net,
            "value":  0,
            "color":  "amber",
        })

    async for dr in damage_return_collection.find({"tenant_id": tenant_id}).sort("created_at", -1).limit(4):
        total_qty = sum(int(l.get("qty", 0) or 0) for l in dr.get("lines", []))
        recent_movements.append({
            "date":   str(dr.get("date") or "")[:10],
            "type":   dr.get("type", "Damage"),
            "ref":    dr.get("ref_no", ""),
            "vendor": dr.get("note", ""),
            "qty":    -total_qty if dr.get("type") == "Damage" else total_qty,
            "value":  0,
            "color":  "red" if dr.get("type") == "Damage" else "blue",
        })

    recent_movements.sort(key=lambda x: x["date"], reverse=True)
    recent_movements = recent_movements[:12]

    return JSONResponse({
        "status": "success",
        "data": {
            "kpis": {
                "total_skus":       total_skus,
                "total_value":      round(total_value, 2),
                "in_stock":         in_stock_count,
                "low_stock":        low_stock_count,
                "out_of_stock":     out_stock_count,
                "grn_this_month":   grn_this_month,
                "adj_this_month":   adj_this_month,
                "dmg_this_month":   dmg_this_month,
            },
            "division_chart":    division_chart,
            "source_breakdown":  source_breakdown,
            "low_stock_items":   low_stock_items[:10],
            "out_stock_items":   out_stock_items[:10],
            "top_value_items":   top_items,
            "recent_movements":  recent_movements,
        },
    })


# ─────────────────────────────────────────────────────────────────────────────
# EXPIRY & AGING ITEMS ROUTE
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/expiry-aging")
async def get_expiry_aging(
    search:     Optional[str] = Query(None),
    status:     Optional[str] = Query(None),   # "Expired" | "Expiring Soon" | "OK"
    min_aging:  Optional[int] = Query(None),   # filter rows with aging >= this value
    ctx:        dict          = Depends(get_hq_tenant),
):
    """
    Returns all GRN items that have an expiryDate set.
    Aging = days since the GRN was posted (grnDate → today).
    Deduplicates by barcode+batch — keeps the most recent GRN entry.
    """
    tenant_id = ctx["tenant_id"]
    today = datetime.utcnow().date()

    stock_map: dict = {}
    async for doc in inventory_collection.find({"tenant_id": tenant_id}, {"barcode": 1, "stockQty": 1, "_id": 0}):
        bc = (doc.get("barcode") or "").strip()
        if bc:
            stock_map[bc] = float(doc.get("stockQty", 0) or 0)

    product_master = await build_product_master(tenant_id)

    seen: dict = {}

    async for grn in grn_collection.find({"status": "Posted", "tenant_id": tenant_id}):
        grn_no   = grn.get("grnNo", "")
        grn_date = (grn.get("grnDate") or "")[:10]
        vendor   = grn.get("vendorName", "")

        try:
            grn_dt    = datetime.strptime(grn_date, "%Y-%m-%d").date()
            aging_days = (today - grn_dt).days
        except Exception:
            aging_days = 0

        for item in grn.get("items", []):
            expiry_raw = (item.get("expiryDate") or "").strip()
            if not expiry_raw or expiry_raw in ("null", "None", ""):
                continue

            bc       = (item.get("barcode") or "").strip()
            batch_no = (item.get("batchNo") or "").strip() or "—"
            key      = (bc, batch_no)

            if key in seen and seen[key]["grn_date"] >= grn_date:
                continue

            pm           = product_master.get(bc, {})
            current_stock = stock_map.get(bc, 0)

            seen[key] = {
                "sku":           pm.get("sku", ""),
                "barcode":       bc,
                "item":          pm.get("product") or item.get("description", bc) or bc,
                "division":      pm.get("division", ""),
                "section":       pm.get("section", ""),
                "department":    pm.get("department", ""),
                "batch":         batch_no,
                "expiry":        expiry_raw[:10],
                "grn_no":        grn_no,
                "grn_date":      grn_date,
                "vendor":        vendor,
                "current_stock": round(current_stock, 2),
                "aging_days":    aging_days,
            }

    rows = []
    for entry in seen.values():
        expiry_str = entry["expiry"]
        try:
            exp_date   = datetime.strptime(expiry_str, "%Y-%m-%d").date()
            days_left  = (exp_date - today).days
        except Exception:
            days_left  = 9999

        if days_left <= 0:
            expiry_status = "Expired"
        elif days_left <= 30:
            expiry_status = "Expiring Soon"
        else:
            expiry_status = "OK"

        rows.append({
            **entry,
            "days_left":     days_left if days_left >= 0 else 0,
            "expiry_status": expiry_status,
        })

    if status and status != "All":
        rows = [r for r in rows if r["expiry_status"] == status]

    if min_aging is not None:
        rows = [r for r in rows if r["aging_days"] >= min_aging]

    if search:
        s = search.strip().lower()
        rows = [
            r for r in rows
            if s in r["item"].lower()
            or s in r["sku"].lower()
            or s in r["barcode"].lower()
            or s in r["batch"].lower()
            or s in r["grn_no"].lower()
            or s in (r["vendor"] or "").lower()
        ]

    status_order = {"Expired": 0, "Expiring Soon": 1, "OK": 2}
    rows.sort(key=lambda r: (status_order.get(r["expiry_status"], 3), r["days_left"]))

    summary = {
        "total":        len(rows),
        "expired":      sum(1 for r in rows if r["expiry_status"] == "Expired"),
        "expiring_soon":sum(1 for r in rows if r["expiry_status"] == "Expiring Soon"),
        "ok":           sum(1 for r in rows if r["expiry_status"] == "OK"),
        "aging_90_plus":sum(1 for r in rows if r["aging_days"] >= 90),
        "aging_120_plus":sum(1 for r in rows if r["aging_days"] >= 120),
    }

    return JSONResponse({
        "status":  "success",
        "count":   len(rows),
        "summary": summary,
        "data":    rows,
    })

