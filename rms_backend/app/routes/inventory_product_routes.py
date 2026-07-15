


from fastapi import APIRouter, Query, HTTPException, Depends
from fastapi.responses import JSONResponse
from typing import Optional, List
from datetime import datetime
from bson import ObjectId
from ..db import product_collection, inventory_collection
from .deps import get_hq_tenant
from fastapi.encoders import jsonable_encoder

router = APIRouter(prefix="/inventory/products", tags=["Inventory Products"])

# ── helpers ────────────────────────────────────────────────────────────────────

def _str(v):
    return str(v) if v else ""

def _float(v):
    try:    return float(v or 0)
    except: return 0.0

def _int(v):
    try:    return int(v or 0)
    except: return 0

def _now():
    return datetime.utcnow()

def _serialize_variant(v: dict) -> dict:
    return {
        "barcode":     (v.get("barcode") or "").strip(),
        "size_label":  v.get("size_label",  ""),
        "measurement": v.get("measurement", ""),
        "color":       v.get("color",        ""),
        "pack_size":   v.get("pack_size",    ""),
        "flavor":      v.get("flavor",       ""),
        "spec":        v.get("spec",         ""),
        "pattern":     v.get("pattern",      ""),
        "stock":       _float(v.get("stock",      0)),
        "mrp":         _float(v.get("mrp",        0)),
        "cost_price":  _float(v.get("cost_price", 0)),
        "sku":         v.get("sku", ""),
    }

def _serialize(doc: dict) -> dict:
    """Serialize a product_collection document for API response."""
    doc = dict(doc)
    doc["id"] = _str(doc.pop("_id"))

    variants = [_serialize_variant(v) for v in doc.get("variants", [])]
    doc["variants"] = variants

    # Auto-compute total stock
    if doc.get("has_variants") and variants:
        doc["stockQty"] = sum(v["stock"] for v in variants)
    else:
        doc["stockQty"] = _float(doc.get("stockQty") or doc.get("quantity") or 0)

    # Datetime → string
    for field in ("createdAt", "updatedAt", "grn_date"):
        if isinstance(doc.get(field), datetime):
            doc[field] = doc[field].isoformat()

    return doc


def _build_doc(payload: dict, tenant_id: str, is_update: bool = False) -> dict:
    """
    Build a clean MongoDB document from the frontend payload.
    Supports product_type: garment | fmcg | general
    Categories 1-6 are stored as-is regardless of product type —
    only the frontend labels change; the DB keys stay constant.

    tenant_id is always stamped/kept — on create it's set from the caller's
    auth context; on update it's re-applied here too (rather than trusting
    exclude_unset semantics) so a client can never move a product to a
    different tenant by including a stray tenant_id in the payload.
    """
    product_type = (payload.get("product_type") or "general").strip().lower()
    has_variants = bool(payload.get("has_variants", False))

    variants_raw = payload.get("variants", [])
    variants     = [_serialize_variant(v) for v in variants_raw]

    # Total stock: sum variants if has_variants, else use explicit stockQty
    if has_variants and variants:
        total_stock = sum(v["stock"] for v in variants)
    else:
        total_stock = _float(payload.get("stockQty") or payload.get("quantity") or 0)

    doc = {
        # ── Identity ────────────────────────────────────────────────────────
        "barcode":      (payload.get("barcode") or "").strip(),
        "product_name": (payload.get("description") or payload.get("product_name") or "").strip(),
        "sku":          (payload.get("sku") or "").strip(),
        "hsn_code":     (payload.get("hsn_code") or "").strip(),
        # ⚠️ FIXED: InventoryProductForm.jsx collects this field and sends
        # it in every payload, but it was never read here — silently
        # discarded on every save, not just hidden from some view.
        "gst_rate":     _float(payload.get("gst_rate") or 0),

        # ── Pricing ─────────────────────────────────────────────────────────
        "cost_price":   _float(payload.get("rate") or payload.get("cost_price") or 0),
        "mrp":          _float(payload.get("mrp") or 0),

        # ── Product type ─────────────────────────────────────────────────────
        "product_type": product_type,   # garment | fmcg | general

        # ── Categories 1-6 (labels differ by type, keys are constant) ───────
        "category1":    (payload.get("category1") or "").strip(),
        "category2":    (payload.get("category2") or "").strip(),
        "category3":    (payload.get("category3") or "").strip(),
        "category4":    (payload.get("category4") or "").strip(),
        "category5":    (payload.get("category5") or "").strip(),
        "category6":    (payload.get("category6") or "").strip(),

        # ── Stock ────────────────────────────────────────────────────────────
        "stockQty":     total_stock,
        "quantity":     total_stock,   # legacy alias used by GRN routes
        "has_variants": has_variants,
        "variant_type": payload.get("variant_type", "size-colour" if product_type=="garment" else "pack-size" if product_type=="fmcg" else "spec"),
        "variants":     variants if has_variants else [],

        # ── Classification ───────────────────────────────────────────────────
        "division":     (payload.get("division")   or "").strip(),
        "department":   (payload.get("department") or "").strip(),
        "section":      (payload.get("section")    or "").strip(),

        # ── Meta ─────────────────────────────────────────────────────────────
        "source":       payload.get("source", "admin"),
        "reorderLevel": _float(payload.get("reorderLevel") or 0),
        "tenant_id":    tenant_id,
        "updatedAt":    _now(),
    }

    if not is_update:
        doc["createdAt"] = _now()
        doc["created_by"] = "ADMIN"

    return doc


# ── ROUTES ─────────────────────────────────────────────────────────────────────

@router.get("/")
async def list_products(
    search:       Optional[str] = Query(None),
    product_type: Optional[str] = Query(None),
    brand:        Optional[str] = Query(None),
    category2:    Optional[str] = Query(None),
    has_variants: Optional[bool]= Query(None),
    limit:        int           = Query(200),
    skip:         int           = Query(0),
    ctx:          dict          = Depends(get_hq_tenant),
):
    """
    List all products with optional filters.
    Supports garment / fmcg / general product types.
    Scoped to the caller's tenant.
    """
    query: dict = {"tenant_id": ctx["tenant_id"]}

    if product_type:
        query["product_type"] = product_type.lower()

    if brand or category2:
        val = (brand or category2 or "").strip()
        query["category2"] = {"$regex": val, "$options": "i"}

    if has_variants is not None:
        query["has_variants"] = has_variants

    if search:
        q = search.strip()
        query["$or"] = [
            {"barcode":      {"$regex": q, "$options": "i"}},
            {"product_name": {"$regex": q, "$options": "i"}},
            {"category1":    {"$regex": q, "$options": "i"}},
            {"category2":    {"$regex": q, "$options": "i"}},
            {"category3":    {"$regex": q, "$options": "i"}},
            {"sku":          {"$regex": q, "$options": "i"}},
            {"variants.barcode": {"$regex": q, "$options": "i"}},
        ]

    total = await product_collection.count_documents(query)
    docs  = []
    async for d in product_collection.find(query).sort("createdAt", -1).skip(skip).limit(limit):
        docs.append(_serialize(d))

    return JSONResponse(jsonable_encoder({
        "status": "success",
        "total":  total,
        "data":   docs,
    }))


@router.get("/barcode/{barcode}")
async def get_product_by_barcode(barcode: str, ctx: dict = Depends(get_hq_tenant)):
    """
    Look up a product by master barcode OR variant barcode.
    Returns full product including which variant matched.
    Scoped to tenant — two tenants can use the same barcode without collision.
    """
    barcode = barcode.strip()

    # 1. Try master barcode
    doc = await product_collection.find_one({"barcode": barcode, "tenant_id": ctx["tenant_id"]})

    # 2. Try variant barcode
    if not doc:
        doc = await product_collection.find_one({"variants.barcode": barcode, "tenant_id": ctx["tenant_id"]})

    if not doc:
        raise HTTPException(status_code=404, detail=f"No product found for barcode: {barcode}")

    serialized = _serialize(doc)

    matched_variant = None
    for v in serialized.get("variants", []):
        if v["barcode"] == barcode:
            matched_variant = v
            break

    return JSONResponse({
        "status":          "success",
        "data":            serialized,
        "matched_variant": matched_variant,
        "is_variant_scan": matched_variant is not None,
    })


@router.post("/")
async def create_product(payload: dict, ctx: dict = Depends(get_hq_tenant)):
    """
    Create a new product.
    Validates:
      - barcode required and unique WITHIN THIS TENANT
      - description required
      - if has_variants, at least one variant with a barcode
      - all variant barcodes must be unique within this tenant
    """
    barcode = (payload.get("barcode") or "").strip()
    if not barcode:
        raise HTTPException(status_code=400, detail="Master barcode is required.")

    desc = (payload.get("description") or payload.get("product_name") or "").strip()
    if not desc:
        raise HTTPException(status_code=400, detail="Product description is required.")

    # Check master barcode uniqueness — scoped to tenant
    existing = await product_collection.find_one({"barcode": barcode, "tenant_id": ctx["tenant_id"]})
    if existing:
        raise HTTPException(status_code=400, detail=f"Barcode '{barcode}' already exists.")

    # Check variant barcodes
    variants = payload.get("variants", [])
    if payload.get("has_variants") and not variants:
        raise HTTPException(status_code=400, detail="Add at least one variant when has_variants is true.")

    variant_barcodes = [v.get("barcode", "").strip() for v in variants if v.get("barcode", "").strip()]

    if len(variant_barcodes) != len(set(variant_barcodes)):
        raise HTTPException(status_code=400, detail="Variant barcodes must be unique within the product.")

    # Check for conflicts with existing products — scoped to tenant
    if variant_barcodes:
        conflict = await product_collection.find_one({
            "tenant_id": ctx["tenant_id"],
            "$or": [
                {"barcode": {"$in": variant_barcodes}},
                {"variants.barcode": {"$in": variant_barcodes}},
            ],
        })
        if conflict:
            raise HTTPException(status_code=400, detail="One or more variant barcodes already exist in another product.")

    doc    = _build_doc(payload, ctx["tenant_id"], is_update=False)
    result = await product_collection.insert_one(doc)

    # Also sync to inventory_collection (so barcode lookup works immediately)
    await _sync_to_inventory(doc, str(result.inserted_id), ctx["tenant_id"])

    return JSONResponse({
        "status":  "success",
        "message": f"Product '{desc}' created.",
        "id":      str(result.inserted_id),
    }, status_code=201)


@router.put("/{product_id}")
async def update_product(product_id: str, payload: dict, ctx: dict = Depends(get_hq_tenant)):
    """
    Update an existing product.
    Recalculates total stock from variants.
    Re-syncs to inventory_collection.
    Scoped to tenant — an admin can only edit their own tenant's products.
    """
    try:    oid = ObjectId(product_id)
    except: raise HTTPException(status_code=400, detail="Invalid product ID.")

    existing = await product_collection.find_one({"_id": oid, "tenant_id": ctx["tenant_id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found.")

    # Barcode change: check uniqueness within tenant
    new_barcode = (payload.get("barcode") or "").strip()
    if new_barcode and new_barcode != existing.get("barcode", ""):
        conflict = await product_collection.find_one({
            "barcode": new_barcode,
            "tenant_id": ctx["tenant_id"],
            "_id": {"$ne": oid},
        })
        if conflict:
            raise HTTPException(status_code=400, detail=f"Barcode '{new_barcode}' is used by another product.")

    patch = _build_doc(payload, ctx["tenant_id"], is_update=True)
    await product_collection.update_one({"_id": oid, "tenant_id": ctx["tenant_id"]}, {"$set": patch})

    # Re-sync inventory
    updated = await product_collection.find_one({"_id": oid, "tenant_id": ctx["tenant_id"]})
    await _sync_to_inventory(updated, product_id, ctx["tenant_id"])

    return JSONResponse({"status": "success", "message": "Product updated."})


@router.delete("/{product_id}")
async def delete_product(product_id: str, ctx: dict = Depends(get_hq_tenant)):
    """
    Delete a product and remove it from inventory_collection.
    Scoped to tenant.
    """
    try:    oid = ObjectId(product_id)
    except: raise HTTPException(status_code=400, detail="Invalid product ID.")

    doc = await product_collection.find_one({"_id": oid, "tenant_id": ctx["tenant_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Product not found.")

    barcode  = doc.get("barcode", "")
    variants = doc.get("variants", [])
    all_barcodes = [barcode] + [v.get("barcode","") for v in variants if v.get("barcode")]

    # Remove from inventory_collection — scoped to tenant so a barcode that
    # coincidentally matches another tenant's product is left untouched
    for bc in all_barcodes:
        if bc:
            await inventory_collection.delete_many({"barcode": bc, "tenant_id": ctx["tenant_id"]})

    await product_collection.delete_one({"_id": oid, "tenant_id": ctx["tenant_id"]})

    return JSONResponse({"status": "success", "message": f"Product '{doc.get('product_name','')}' deleted."})


@router.get("/types/labels")
async def get_category_labels():
    """
    Returns the category label config for each product type.
    Static reference data, identical for every tenant — intentionally left
    without get_hq_tenant since there is nothing tenant-specific to leak.
    """
    return JSONResponse({
        "status": "success",
        "data": {
            "garment": {
                "category1": "Design No.",
                "category2": "Brand",
                "category3": "Style",
                "category4": "Pattern",
                "category5": "Size Range",
                "category6": "Ageing / Season",
                "category4_type": "text",
                "category6_type": "dropdown",
                "category6_options": ["Summer","Winter","Monsoon","Festive","All Season","Spring","N/A"],
                "variant_type": "size-colour",
                "variant_fields": ["size_label","measurement","color"],
                "quickfill_sizes": ["S","M","L","XL","XXL","3XL","Free Size"],
                "quickfill_label": "Select sizes",
            },
            "fmcg": {
                "category1": "Item Code / SKU",
                "category2": "Brand",
                "category3": "Pack Type",
                "category4": "Weight / Volume",
                "category5": "Flavour / Variant",
                "category6": "Shelf Life (days)",
                "category3_type": "dropdown",
                "category3_options": ["Packet","Bottle","Tin","Can","Box","Pouch","Sachet","Jar","N/A"],
                "category4_type": "dropdown",
                "category4_options": ["50g","100g","200g","250g","500g","1kg","2kg","5kg","50ml","100ml","200ml","250ml","500ml","1L","2L","5L","N/A"],
                "category6_type": "text",
                "variant_type": "pack-size",
                "variant_fields": ["pack_size","flavor"],
                "quickfill_sizes": ["50g","100g","200g","250g","500g","1kg","2kg","50ml","100ml","200ml","500ml","1L"],
                "quickfill_label": "Select pack sizes",
            },
            "general": {
                "category1": "Item Code",
                "category2": "Brand",
                "category3": "Type / Model",
                "category4": "Specification",
                "category5": "Unit",
                "category6": "Warranty / Expiry",
                "category6_type": "text",
                "variant_type": "spec",
                "variant_fields": ["spec"],
                "quickfill_sizes": [],
                "quickfill_label": "No quick-fill for general items",
            },
        }
    })


# ── Internal: sync product to inventory_collection ─────────────────────────────

async def _sync_to_inventory(doc: dict, product_id: str, tenant_id: str):
    """
    After create/update, keep inventory_collection in sync.
    inventory_collection is the source for stock lookups at POS and transfers.
    Every upsert here now carries tenant_id, and every query key includes it,
    so a barcode collision between two tenants can never cross-write.
    """
    base = {
        "product_name":  doc.get("product_name", ""),
        "description":   doc.get("product_name", ""),
        "product_type":  doc.get("product_type", "general"),
        "hsn_code":      doc.get("hsn_code", ""),
        "gst_rate":      doc.get("gst_rate", 0),
        "category1":     doc.get("category1", ""),
        "category2":     doc.get("category2", ""),
        "category3":     doc.get("category3", ""),
        "category4":     doc.get("category4", ""),
        "category5":     doc.get("category5", ""),
        "category6":     doc.get("category6", ""),
        "division":      doc.get("division", ""),
        "department":    doc.get("department", ""),
        "section":       doc.get("section", ""),
        "reorderLevel":  doc.get("reorderLevel", 0),
        "tenant_id":     tenant_id,
        "updatedAt":     _now(),
        "product_id":    product_id,
    }

    if not doc.get("has_variants"):
        # Single SKU — upsert one record, keyed by barcode + tenant_id so
        # two tenants sharing a barcode string get two separate rows
        await inventory_collection.update_one(
            {"barcode": doc["barcode"], "tenant_id": tenant_id},
            {"$set": {
                **base,
                "barcode":    doc["barcode"],
                "rate":       doc.get("cost_price", 0),
                "mrp":        doc.get("mrp", 0),
                "stockQty":   doc.get("stockQty", 0),
                "source":     doc.get("source", "admin"),
            }},
            upsert=True,
        )
    else:
        # Variant product — upsert one record per variant barcode
        for v in doc.get("variants", []):
            bc = (v.get("barcode") or "").strip()
            if not bc:
                continue

            parts = [doc.get("product_name", "")]
            if v.get("size_label"):  parts.append(v["size_label"])
            if v.get("measurement"): parts.append(v["measurement"])
            if v.get("color"):       parts.append(v["color"])
            if v.get("pattern"):     parts.append(v["pattern"])
            if v.get("pack_size"):   parts.append(v["pack_size"])
            if v.get("flavor"):      parts.append(v["flavor"])
            if v.get("spec"):        parts.append(v["spec"])
            display_name = " | ".join(p for p in parts if p)

            await inventory_collection.update_one(
                {"barcode": bc, "tenant_id": tenant_id},
                {"$set": {
                    **base,
                    "barcode":       bc,
                    "master_barcode":doc["barcode"],
                    "description":   display_name,
                    "product_name":  display_name,
                    "rate":          v.get("cost_price") or doc.get("cost_price", 0),
                    "mrp":           v.get("mrp")        or doc.get("mrp", 0),
                    "stockQty":      v.get("stock", 0),
                    "size_label":    v.get("size_label", ""),
                    "measurement":   v.get("measurement",""),
                    "color":         v.get("color",""),
                    "pattern":       v.get("pattern",""),
                    "pack_size":     v.get("pack_size",""),
                    "flavor":        v.get("flavor",""),
                    "spec":          v.get("spec",""),
                    "source":        doc.get("source", "admin"),
                    "is_variant":    True,
                }},
                upsert=True,
            )

        # Also keep a master record for the parent barcode
        await inventory_collection.update_one(
            {"barcode": doc["barcode"], "tenant_id": tenant_id},
            {"$set": {
                **base,
                "barcode":     doc["barcode"],
                "rate":        doc.get("cost_price", 0),
                "mrp":         doc.get("mrp", 0),
                "stockQty":    doc.get("stockQty", 0),
                "has_variants":True,
                "source":      doc.get("source", "admin"),
                "is_master":   True,
            }},
            upsert=True,
        )

# ═══════════════════════════════════════════════════════════════════════════════
# ADD THIS TO: app/routes/inventory_product_routes.py
#
# Two changes:
#   (A) Fix the datetime-serialization 500 error you already hit (jsonable_encoder)
#   (B) Add the /generate-barcode/{product_id} endpoint
#
# Both are shown below. Copy the pieces into the existing file.
# ═══════════════════════════════════════════════════════════════════════════════


# ───────────────────────────────────────────────────────────────────────────────
# (A) IMPORTS — add these two lines near the top of the file, with the other imports
# ───────────────────────────────────────────────────────────────────────────────
import random
from fastapi.encoders import jsonable_encoder


# ───────────────────────────────────────────────────────────────────────────────
# (A) FIX list_products RETURN (around line 702) so datetime fields never 500.
#     Replace:
#         return JSONResponse({
#             "status": "success",
#             "total":  total,
#             "data":   docs,
#         })
#     WITH:
# ───────────────────────────────────────────────────────────────────────────────
#     return JSONResponse(jsonable_encoder({
#         "status": "success",
#         "total":  total,
#         "data":   docs,
#     }))
#
#  (Do the same jsonable_encoder(...) wrap on get_product_by_barcode's return too,
#   for safety — same one-line change.)


# ───────────────────────────────────────────────────────────────────────────────
# (B) BARCODE HELPERS — paste these in the "helpers" section of the file
#     (near _str / _float / _now, above the ROUTES section)
# ───────────────────────────────────────────────────────────────────────────────

def _gen_master_barcode() -> str:
    """
    EAN-13-style master barcode: same shape as products.py generate_barcode()
    ('890' + 9 random digits). Used only as a fallback when a product genuinely
    has no design-based identifier to key off.
    """
    return "890" + str(random.randint(100000000, 999999999))


def _slug(s, n: int = 5) -> str:
    """Uppercase alphanumeric slice, used to build readable variant barcodes."""
    return "".join(ch for ch in str(s or "").upper() if ch.isalnum())[:n]


def _gen_variant_barcode(design_no: str, *parts) -> str:
    """
    Design-based variant barcode, e.g. 'KRT-001-M-WHT'.
    Empty parts are skipped, so a size-only variant becomes 'KRT-001-M'.
    """
    base = (design_no or "").strip().upper()
    suffix = "-".join(_slug(p) for p in parts if p and str(p).strip())
    return f"{base}-{suffix}" if suffix else base


def _is_real_manufacturer_barcode(bc: str) -> bool:
    """
    A pure 8-13 digit numeric code is treated as a real (FMCG/EAN/UPC) barcode
    that must NOT be regenerated. Design codes like 'KRT-001' are not numeric,
    so they don't match and can be (re)built as needed.
    """
    bc = (bc or "").strip()
    return bc.isdigit() and 8 <= len(bc) <= 13


# ───────────────────────────────────────────────────────────────────────────────
# (B) ROUTE — paste this with the other @router routes
# ───────────────────────────────────────────────────────────────────────────────

@router.post("/generate-barcode/{product_id}")
async def generate_barcode_for_product(product_id: str, ctx: dict = Depends(get_hq_tenant)):
    """
    Generate missing barcodes for one product, then re-sync inventory_collection
    so POS lookups work immediately.

    Rules:
      - FMCG (or any) product whose master barcode is already a real 8-13 digit
        manufacturer code is LEFT UNTOUCHED at the master level.
      - Garments typically key off category1 (Design No.). If a master barcode is
        missing, we use the Design No. as the master; if there's no Design No.
        either, we fall back to an EAN-style '890...' code.
      - Variant barcodes are only filled where EMPTY. Existing ones are preserved.
      - Variant barcodes are de-duplicated within the product.

    Idempotent: calling it again when everything already has a barcode is a no-op.
    """
    try:
        oid = ObjectId(product_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid product ID.")

    doc = await product_collection.find_one({"_id": oid, "tenant_id": ctx["tenant_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Product not found.")

    updates: dict = {}

    old_master = (doc.get("barcode") or "").strip()
    design_no  = (doc.get("category1") or "").strip()

    # Decide the master barcode.
    if old_master and (_is_real_manufacturer_barcode(old_master) or not old_master.startswith(("ITEM/", "WALKIN/")) and "/" not in old_master):
        # Keep a barcode that already looks legitimate (real EAN or a clean design code)
        master = old_master
    elif design_no:
        master = design_no          # garment: use Design No. as master
        updates["barcode"] = master
    elif old_master:
        master = old_master         # keep whatever blob exists rather than losing the link
    else:
        master = _gen_master_barcode()
        updates["barcode"] = master

    # The key used to build variant barcodes: prefer Design No., else the master.
    variant_key = design_no or master

    # Fill empty variant barcodes only.
    if doc.get("has_variants") and doc.get("variants"):
        new_variants = []
        seen = set()
        # seed 'seen' with existing, already-present barcodes so we don't collide
        for v in doc["variants"]:
            existing = (v.get("barcode") or "").strip()
            if existing:
                seen.add(existing)

        changed = False
        for v in doc["variants"]:
            v = dict(v)
            bc = (v.get("barcode") or "").strip()
            if not bc:
                bc = _gen_variant_barcode(
                    variant_key,
                    v.get("size_label") or v.get("pack_size") or v.get("spec"),
                    v.get("color") or v.get("flavor"),
                    v.get("pattern"),
                )
                candidate, i = bc, 1
                while candidate in seen:
                    i += 1
                    candidate = f"{bc}-{i}"
                bc = candidate
                changed = True
            seen.add(bc)
            v["barcode"] = bc
            new_variants.append(v)

        if changed:
            updates["variants"] = new_variants

    if not updates:
        return JSONResponse(jsonable_encoder({
            "status":  "success",
            "message": "Barcodes already present — nothing to generate.",
            "barcode": master,
            "variant_barcodes": [ (v.get("barcode") or "") for v in doc.get("variants", []) ],
        }))

    updates["updatedAt"] = _now()
    await product_collection.update_one(
        {"_id": oid, "tenant_id": ctx["tenant_id"]},
        {"$set": updates},
    )

    updated = await product_collection.find_one({"_id": oid, "tenant_id": ctx["tenant_id"]})
    await _sync_to_inventory(updated, product_id, ctx["tenant_id"])

    return JSONResponse(jsonable_encoder({
        "status":  "success",
        "message": "Barcodes generated.",
        "barcode": updated.get("barcode", ""),
        "variant_barcodes": [ (v.get("barcode") or "") for v in updated.get("variants", []) ],
    }))        