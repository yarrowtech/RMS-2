

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import random
from app.db import (
    grn_collection,
    grc_collection,
    purchaseorders_collection,
    inventory_collection,
    product_collection,
    store_stock_collection,
    stores_collection,
    tenants_collection,
)
from .deps import get_hq_tenant, get_receiving_tenant

router = APIRouter(prefix="/grn", tags=["Goods Receipt Note"])


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def objid(v):
    return str(v) if isinstance(v, ObjectId) else v


# ─────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────

class GRNItemModel(BaseModel):
    barcode:      str            = ""
    description:  str            = ""
    acceptedQty:  float          = 0
    inwardQty:    float          = 0
    rate:         float          = 0
    amount:       float          = 0
    binLocation:  str            = ""
    batchNo:      str            = ""
    expiryDate:   Optional[str]  = None
    remarks:      str            = ""


class GRNModel(BaseModel):
    id:             Optional[str]      = None
    grnNo:          Optional[str]      = None
    grnDate:        str
    grcNo:          str
    grc_id:         Optional[str]      = None
    poNo:           Optional[str]      = ""
    po_id:          Optional[str]      = None
    vendorName:     Optional[str]      = ""
    warehouseCode:  Optional[str]      = ""
    receiving_store_id: Optional[str]  = None
    receiving_store_name: Optional[str] = ""
    inductedBy:     str
    approvedBy:     Optional[str]      = ""
    remarks:        Optional[str]      = ""
    status:         Optional[str]      = "Draft"
    totalInwardQty: Optional[float]    = 0
    totalAmount:    Optional[float]    = 0
    items:          List[GRNItemModel] = []
    createdAt:      Optional[datetime] = Field(default_factory=datetime.utcnow)
    updatedAt:      Optional[datetime] = Field(default_factory=datetime.utcnow)


# ─────────────────────────────────────────────
# GRN Number Generator — scoped by tenant_id, same reasoning as GRC numbers
# ─────────────────────────────────────────────

async def generate_grn_number(tenant_id: str) -> str:
    today = datetime.now()
    year, month = today.year, today.month
    if month >= 4:
        fy_start, fy_end = year, year + 1
    else:
        fy_start, fy_end = year - 1, year
    fy_code = f"{str(fy_start)[-2:]}-{str(fy_end)[-2:]}"
    last = await grn_collection.find_one(
        {"grnNo": {"$regex": f"GRN[/|-]\\d+/{fy_code}$"}, "tenant_id": tenant_id},
        sort=[("_id", -1)]
    )
    last_num = 0
    if last and "grnNo" in last:
        try:
            last_num = int(last["grnNo"].split("/")[1])
        except Exception:
            pass
    return f"GRN/{str(last_num + 1).zfill(8)}/{fy_code}"


# ─────────────────────────────────────────────
# Computation helpers
# ─────────────────────────────────────────────

def compute_grn_totals(grn_dict: dict):
    total_qty = total_amount = 0.0
    for item in grn_dict.get("items", []):
        accepted = max(0.0, float(item.get("acceptedQty", 0)))
        inward   = max(0.0, float(item.get("inwardQty", 0)))
        rate     = max(0.0, float(item.get("rate", 0)))

        # Only clamp when acceptedQty > 0 (PO-linked GRNs).
        # Walk-in/direct GRNs have acceptedQty=0 — clamping would zero inwardQty.
        if accepted > 0:
            inward = min(inward, accepted)

        item["inwardQty"] = round(inward, 4)
        item["amount"]    = round(inward * rate, 2)
        total_qty    += inward
        total_amount += inward * rate

    grn_dict["totalInwardQty"] = round(total_qty, 4)
    grn_dict["totalAmount"]    = round(total_amount, 2)


async def resolve_grc(grc_no: str, tenant_id: str) -> dict:
    """Scoped to tenant_id — a GRN cannot be raised against another tenant's GRC."""
    grc = await grc_collection.find_one({"grcNo": grc_no, "tenant_id": tenant_id})
    if not grc:
        raise HTTPException(status_code=404, detail=f"GRC '{grc_no}' not found.")
    if grc.get("status") != "Approved":
        raise HTTPException(
            status_code=400,
            detail=f"GRN can only be created against an Approved GRC. GRC '{grc_no}' is currently '{grc.get('status')}'."
        )
    return grc


async def check_duplicate_grn(grc_id: str, tenant_id: str, exclude_id: str = None):
    query = {"grc_id": grc_id, "tenant_id": tenant_id, "status": {"$ne": "Cancelled"}}
    if exclude_id:
        query["_id"] = {"$ne": ObjectId(exclude_id)}
    existing = await grn_collection.find_one(query)
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"An active GRN ({existing.get('grnNo')}) already exists for this GRC. Cancel it before creating a new one."
        )


# ─────────────────────────────────────────────
# Product helpers
#
# ⚠️ KNOWN GAP — not fixed in this pass: product_collection and
# inventory_collection do not carry tenant_id yet. Every function below
# (get_product_meta, barcode_in_products, ensure_product_exists,
# sync_product_stock_from_grn, update_inventory) reads/writes these two
# collections globally across all tenants. This means:
#   - A barcode used by Tenant A's products can be matched/updated by
#     Tenant B's GRN posting if the barcodes happen to coincide.
#   - Auto-created products (ensure_product_exists) and inventory rows
#     (update_inventory) land with no tenant tag, so they'd vanish from
#     any future tenant-scoped inventory query, or worse, be visible to
#     every tenant until inventory_collection/product_collection get a
#     tenant_id backfill + schema change.
# This requires the inventory/product schema decision flagged earlier in
# the conversation — fixing it here would mean guessing at how barcode
# uniqueness should work per-tenant, which needs your input, not a guess.
# The GRN/GRC/PO documents themselves (this file's actual collection) ARE
# correctly tenant-scoped below.
# ─────────────────────────────────────────────

async def get_product_meta(barcode: str, tenant_id: str) -> dict:
    """
    ⚠️ FIXED: previously queried product_collection by barcode ALONE, with
    no tenant filter — under the {barcode, tenant_id} compound-key design
    used everywhere else in this codebase (two tenants can share an
    identical barcode as separate products), this could match and read
    another tenant's product. Now scoped.
    """
    barcode = barcode.strip()
    p = await product_collection.find_one({"barcode": barcode, "tenant_id": tenant_id})
    if p:
        return {
            "product_name": p.get("product_name", ""),
            "sku":          p.get("sku", ""),
            "division":     p.get("division", ""),
            "section":      p.get("section", ""),
            "department":   p.get("department", ""),
            "source":       p.get("source", "admin"),
            "vendor_name":  p.get("vendor_name", ""),
            "vendor_id":    str(p.get("vendor_id") or ""),
        }
    p = await product_collection.find_one({"variants.barcode": barcode, "tenant_id": tenant_id})
    if p:
        for v in p.get("variants", []):
            if (v.get("barcode") or "").strip() == barcode:
                parts = [p.get("product_name", "")]
                if v.get("size_label"): parts.append(v["size_label"])
                if v.get("color"):      parts.append(v["color"])
                return {
                    "product_name": " | ".join(parts),
                    "sku":          v.get("sku", ""),
                    "division":     p.get("division", ""),
                    "section":      p.get("section", ""),
                    "department":   p.get("department", ""),
                    "source":       p.get("source", "admin"),
                    "vendor_name":  p.get("vendor_name", ""),
                    "vendor_id":    str(p.get("vendor_id") or ""),
                }
        return {
            "product_name": p.get("product_name", ""),
            "sku":          p.get("sku", ""),
            "division":     p.get("division", ""),
            "section":      p.get("section", ""),
            "department":   p.get("department", ""),
            "source":       p.get("source", "admin"),
            "vendor_name":  p.get("vendor_name", ""),
            "vendor_id":    str(p.get("vendor_id") or ""),
        }
    return {}


async def barcode_in_products(barcode: str, tenant_id: str) -> bool:
    barcode = barcode.strip()
    if await product_collection.find_one({"barcode": barcode, "tenant_id": tenant_id}, {"_id": 1}):
        return True
    if await product_collection.find_one({"variants.barcode": barcode, "tenant_id": tenant_id}, {"_id": 1}):
        return True
    return False


async def ensure_product_exists(item: dict, grn_dict: dict, initial_quantity: float | None = None) -> None:
    barcode = (item.get("_effective_barcode") or item.get("barcode") or "").strip()
    if not barcode:
        return
    tenant_id = grn_dict.get("tenant_id")
    if await barcode_in_products(barcode, tenant_id):
        return

    desc       = (item.get("description") or "").strip() or barcode
    rate       = float(item.get("rate", 0))
    inward_qty = float(item.get("inwardQty", 0)) if initial_quantity is None else float(initial_quantity)
    vendor     = (grn_dict.get("vendorName") or "").strip()
    grn_no     = grn_dict.get("grnNo", "")

    await product_collection.insert_one({
        "product_name":    desc,
        "division":        "",
        "section":         "",
        "department":      "",
        "hsn_code":        "",
        "gst_rate":        0.0,
        "cgst_rate":       0.0,
        "sgst_rate":       0.0,
        "igst_rate":       0.0,
        "requires_expiry": False,
        "expiry_date":     "",
        "shelf_life_days": 0,
        "sku":             "",
        "barcode":         barcode,
        "cost_price":      rate,
        "mrp":             rate,
        "selling_price":   rate,
        "quantity":        inward_qty,
        "unit":            "pcs",
        "description":     f"Auto-created from GRN {grn_no}",
        "specification":   "",
        "has_variants":    False,
        "variant_type":    "none",
        "variants":        [],
        "images":          [],
        "created_at":      datetime.utcnow(),
        "created_by":      "GRN",
        "source":          "grn",
        "vendor_name":     vendor,
        "vendor_id":       None,
        "grn_no":          grn_no,
        # ⚠️ FIXED: this was previously commented out — the exact cause of
        # walk-in/direct-GRC GRN items becoming permanently invisible.
        # product_collection reads elsewhere in this codebase filter by
        # tenant_id; a document created here without one could never be
        # found by any tenant-scoped query again, even though it physically
        # existed in Mongo.
        "tenant_id":       tenant_id,
    })
    print(f"[ensure_product_exists] Created '{desc}' | barcode='{barcode}' | GRN={grn_no} | tenant={tenant_id}")

async def sync_product_stock_from_grn(item: dict, grn_dict: dict, reverse: bool = False) -> None:
    barcode   = (item.get("_effective_barcode") or item.get("barcode") or "").strip()
    tenant_id = grn_dict.get("tenant_id")

    if not barcode or barcode.startswith("WALKIN/"):
        return

    inward = float(item.get("inwardQty", 0))
    if inward == 0:
        return

    grn_no = grn_dict.get("grnNo", "")
    rate   = float(item.get("rate", 0))
    factor = -1 if reverse else 1
    delta  = factor * inward

    simple = await product_collection.find_one(
        {"barcode": barcode, "tenant_id": tenant_id}, {"_id": 1, "quantity": 1, "posted_grns": 1}
    )
    if simple:
        posted_grns = simple.get("posted_grns") or []

        # ── Idempotency guard ─────────────────────────────────────────
        if not reverse and grn_no in posted_grns:
            print(f"[sync_product_stock] SKIP — GRN '{grn_no}' already synced to product '{barcode}'")
            return
        # ─────────────────────────────────────────────────────────────

        current_qty = float(simple.get("quantity", 0) or 0)
        new_qty     = max(0.0, round(current_qty + delta, 4))
        update: dict = {
            "$set": {"quantity": new_qty, "updatedAt": datetime.utcnow()},
        }
        if not reverse and rate > 0:
            update["$set"]["cost_price"] = rate
        # Track which GRNs have been applied — prevents double-counting
        if not reverse:
            update["$addToSet"] = {"posted_grns": grn_no}
        else:
            update["$pull"] = {"posted_grns": grn_no}

        await product_collection.update_one({"_id": simple["_id"]}, update)
        print(f"[sync_product_stock] simple | '{barcode}' | qty {current_qty} → {new_qty} | tenant={tenant_id}")
        return

    parent = await product_collection.find_one(
        {"variants.barcode": barcode, "tenant_id": tenant_id}, {"_id": 1, "variants": 1}
    )
    if parent:
        for idx, v in enumerate(parent.get("variants", [])):
            if (v.get("barcode") or "").strip() == barcode:
                posted_grns = v.get("posted_grns") or []

                # ── Idempotency guard ─────────────────────────────────
                if not reverse and grn_no in posted_grns:
                    print(f"[sync_product_stock] SKIP — GRN '{grn_no}' already synced to variant '{barcode}'")
                    return
                # ─────────────────────────────────────────────────────

                current_stock = float(v.get("stock", 0) or 0)
                new_stock     = max(0.0, round(current_stock + delta, 4))
                patch: dict   = {
                    f"variants.{idx}.stock": new_stock,
                    "updatedAt": datetime.utcnow(),
                }
                if not reverse and rate > 0:
                    patch[f"variants.{idx}.cost_price"] = rate

                update: dict = {"$set": patch}
                if not reverse:
                    update["$addToSet"] = {f"variants.{idx}.posted_grns": grn_no}
                else:
                    update["$pull"] = {f"variants.{idx}.posted_grns": grn_no}

                await product_collection.update_one({"_id": parent["_id"]}, update)
                print(f"[sync_product_stock] variant | '{barcode}' | stock {current_stock} → {new_stock} | tenant={tenant_id}")
                return

async def update_inventory(grn_dict: dict, reverse: bool = False) -> None:
    factor       = -1 if reverse else 1
    items        = grn_dict.get("items", [])
    grn_no       = grn_dict.get("grnNo", "unknown")
    vendor       = (grn_dict.get("vendorName") or "").strip()
    is_po_linked = bool(grn_dict.get("po_id"))
    tenant_id    = grn_dict.get("tenant_id")

    # ── Idempotency guard ─────────────────────────────────────────────
    # Check inventory_collection to see if this GRN was already applied.
    # If any item for this grn_no already exists with stockQty > 0 and
    # we are not reversing, skip to prevent double-counting.
    # ⚠️ FIXED: this guard query was also missing tenant_id — could match
    # another tenant's inventory doc that happens to share this GRN number
    # format (unlikely but possible) and skip incorrectly.
    if not reverse:
        already_posted = await inventory_collection.find_one(
            {"grn_no": grn_no, "tenant_id": tenant_id, "stockQty": {"$gt": 0}}
        )
        if already_posted:
            print(f"[update_inventory] SKIP — GRN '{grn_no}' already applied to inventory. Use resync to correct.")
            return
    # ─────────────────────────────────────────────────────────────────

    print(f"[update_inventory] START — {len(items)} item(s) | reverse={reverse} | GRN={grn_no} | po_linked={is_po_linked} | tenant={tenant_id}")
    skipped = updated = 0

    for idx, item in enumerate(items):
        raw_bc = (item.get("barcode") or "").strip()
        inward = float(item.get("inwardQty", 0))
        desc   = (item.get("description") or "").strip()

        if inward == 0:
            print(f"[update_inventory] SKIP — inwardQty=0 | barcode='{raw_bc}'")
            skipped += 1
            continue

        if is_po_linked:
            if raw_bc and not raw_bc.startswith("ITEM/"):
                barcode = raw_bc
            else:
                barcode = f"WALKIN/{grn_no}/{idx + 1}"
                print(f"[update_inventory] PO-linked unresolved barcode → synthetic '{barcode}' for desc='{desc}'")
        else:
            barcode = raw_bc if raw_bc else f"WALKIN/{grn_no}/{idx + 1}"
            if not raw_bc:
                print(f"[update_inventory] DIRECT GRC — synthetic barcode '{barcode}' for desc='{desc}'")

        item["_effective_barcode"] = barcode

        is_walkin = barcode.startswith("WALKIN/") or barcode.startswith("ITEM/")
        meta = {} if is_walkin else await get_product_meta(barcode, tenant_id)

        display_name    = meta.get("product_name") or desc or barcode
        inv_source      = (
            "grn" if is_walkin else
            "grn" if not meta  else
            meta.get("source", "admin")
        )
        inv_vendor_name = vendor if (is_walkin or not meta) else (meta.get("vendor_name") or vendor)

        # ⚠️ FIXED — THE CORE BUG: this upsert previously matched by
        # {"barcode": barcode} alone, with tenant_id commented out and
        # never actually set. Under the {barcode, tenant_id} compound-key
        # design used everywhere else in this app, that meant:
        #   (a) it could match and silently update ANOTHER tenant's
        #       inventory document with the same barcode, and
        #   (b) for a genuinely new barcode (the common case for direct-
        #       GRC/walk-in receipts), it created a fresh document with NO
        #       tenant_id at all — permanently invisible to every
        #       tenant-scoped read afterward, indistinguishable from "never
        #       saved." PO-linked items mostly avoided this by accident,
        #       since those barcodes usually already existed in the
        #       catalog (added earlier through a flow that DID stamp
        #       tenant_id) — the upsert just updated that existing,
        #       correctly-tagged document instead of creating a new one.
        await inventory_collection.update_one(
            {"barcode": barcode, "tenant_id": tenant_id},
            {
                "$inc": {"stockQty": factor * inward},
                "$set": {
                    "description": display_name,
                    "rate":        float(item.get("rate", 0)),
                    "sku":         meta.get("sku", ""),
                    "division":    meta.get("division", ""),
                    "section":     meta.get("section", ""),
                    "department":  meta.get("department", ""),
                    "updatedAt":   datetime.utcnow(),
                    "is_walkin":   is_walkin,
                    "source":      inv_source,
                    "vendor_name": inv_vendor_name,
                    "grn_no":      grn_no,
                    "grn_date":    grn_dict.get("grnDate", ""),
                    "flow_type":   "po_linked" if is_po_linked else "direct",
                },
                "$setOnInsert": {
                    "barcode":   barcode,
                    "tenant_id": tenant_id,
                    "createdAt": datetime.utcnow(),
                }
            },
            upsert=True
        )

        action = "REVERSED" if reverse else "ADDED"
        print(f"[update_inventory] {action} | barcode='{barcode}' | qty={inward} | flow={'po' if is_po_linked else 'direct'} | walkin={is_walkin} | tenant={tenant_id}")

        if not reverse:
            await ensure_product_exists(item, grn_dict)

        await sync_product_stock_from_grn(item, grn_dict, reverse=reverse)
        updated += 1

    print(f"[update_inventory] DONE — updated={updated} skipped={skipped}")

# ═══════════════════════════════════════════════════════════════════
# ROUTES — fixed paths FIRST, wildcard /{grn_id} routes LAST
# ═══════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────
# POST / — Create GRN
# ─────────────────────────────────────────────

async def resolve_single_store_destination(tenant_id: str, preferred_store_id: str = "") -> dict | None:
    """Return the primary store only for a single-store tenant."""
    tenant = await tenants_collection.find_one(
        {"tenant_id": tenant_id}, {"account_type": 1}
    )
    if not tenant or tenant.get("account_type") != "single_store":
        return None

    store = None
    if preferred_store_id and ObjectId.is_valid(preferred_store_id):
        store = await stores_collection.find_one({
            "_id": ObjectId(preferred_store_id), "tenant_id": tenant_id,
        })
    if not store:
        store = await stores_collection.find_one(
            {"tenant_id": tenant_id, "type": "store", "parent_id": None},
            sort=[("created_at", 1)],
        )
    if not store:
        raise HTTPException(
            status_code=409,
            detail="Single-store tenant has no primary store configured. Contact Super Admin.",
        )
    return {
        "id": str(store["_id"]),
        "name": store.get("name") or "Main Store",
        "type": store.get("type") or "store",
    }


async def resolve_recorded_store_destination(tenant_id: str, store_id: str) -> dict:
    """Validate a GRN's already-recorded receiving store within its tenant."""
    if not ObjectId.is_valid(store_id):
        raise HTTPException(status_code=409, detail="GRN has an invalid receiving store.")
    store = await stores_collection.find_one({
        "_id": ObjectId(store_id), "tenant_id": tenant_id,
    })
    if not store:
        raise HTTPException(status_code=409, detail="GRN receiving store no longer exists.")
    return {
        "id": str(store["_id"]),
        "name": store.get("name") or "Main Store",
        "type": store.get("type") or "store",
    }


async def update_single_store_stock(grn_dict: dict, destination: dict, reverse: bool = False) -> None:
    """Post or reverse a single-store GRN directly into its store stock.

    Multi-store retailers deliberately keep using update_inventory() and the
    existing central-to-store allocation process. `posted_grns` prevents a
    retry from double-counting a direct store receipt.
    """
    factor = -1 if reverse else 1
    tenant_id = grn_dict["tenant_id"]
    grn_no = grn_dict.get("grnNo", "")
    vendor = (grn_dict.get("vendorName") or "").strip()

    for index, item in enumerate(grn_dict.get("items", [])):
        inward = float(item.get("inwardQty", 0) or 0)
        if inward <= 0:
            continue

        raw_barcode = (item.get("barcode") or "").strip()
        barcode = raw_barcode if raw_barcode and not raw_barcode.startswith("ITEM/") else f"WALKIN/{grn_no}/{index + 1}"
        item["_effective_barcode"] = barcode
        existing = await store_stock_collection.find_one({
            "barcode": barcode,
            "tenant_id": tenant_id,
            "store_id": destination["id"],
        })
        posted_grns = (existing or {}).get("posted_grns") or []
        if not reverse and grn_no in posted_grns:
            continue
        if reverse and grn_no not in posted_grns:
            continue

        meta = await get_product_meta(barcode, tenant_id) if not barcode.startswith("WALKIN/") else {}
        if not reverse:
            # The catalogue record is not a second stock bucket for a
            # single-store tenant; the inbound quantity lives only in the
            # primary store's stock record.
            await ensure_product_exists(item, grn_dict, initial_quantity=0)
        description = meta.get("product_name") or item.get("description") or barcode
        update = {
            "$inc": {"stockQty": factor * inward},
            "$set": {
                "tenant_id": tenant_id,
                "store_id": destination["id"],
                "store_name": destination["name"],
                "store_type": destination["type"],
                "barcode": barcode,
                "description": description,
                "rate": float(item.get("rate", 0) or 0),
                "source": "grn_direct_single_store",
                "vendor_name": vendor,
                "grn_no": grn_no,
                "grn_date": grn_dict.get("grnDate", ""),
                "updatedAt": datetime.utcnow(),
            },
            "$setOnInsert": {"createdAt": datetime.utcnow()},
        }
        if reverse:
            update["$pull"] = {"posted_grns": grn_no}
        else:
            update["$addToSet"] = {"posted_grns": grn_no}

        await store_stock_collection.update_one(
            {"barcode": barcode, "tenant_id": tenant_id, "store_id": destination["id"]},
            update,
            upsert=True,
        )


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_grn(grn: GRNModel, ctx: dict = Depends(get_receiving_tenant)):
    grn_dict = grn.dict()
    grn_dict["tenant_id"] = ctx["tenant_id"]
    destination = await resolve_single_store_destination(
        ctx["tenant_id"], ctx.get("store_id") or ""
    )
    if destination:
        # Store the destination at draft time so posting/cancelling remains
        # deterministic even if the owner later changes account settings.
        grn_dict["receiving_store_id"] = destination["id"]
        grn_dict["receiving_store_name"] = destination["name"]

    grc = await resolve_grc(grn_dict["grcNo"], ctx["tenant_id"])
    await check_duplicate_grn(str(grc["_id"]), ctx["tenant_id"])

    grn_dict["grc_id"]     = str(grc["_id"])
    grn_dict["poNo"]       = grc.get("poNo", "") or ""
    grn_dict["po_id"]      = str(grc.get("po_id", "")) if grc.get("po_id") else ""
    grn_dict["vendorName"] = grc.get("vendorName", "")

    if not grn_dict.get("items"):
        grn_dict["items"] = [
            {
                "barcode":     (it.get("barcode") or "").strip(),
                "description": it.get("description", ""),
                "acceptedQty": float(it.get("acceptedQty", 0)),
                "inwardQty":   float(it.get("acceptedQty", 0)),
                "rate":        float(it.get("rate", 0)),
                "amount":      0.0,
                "binLocation": "",
                "batchNo":     "",
                "expiryDate":  None,
                "remarks":     "",
            }
            for it in grc.get("items", [])
            if float(it.get("acceptedQty", 0)) > 0
        ]
    else:
        grc_item_map = {
            (it.get("barcode") or "").strip(): float(it.get("acceptedQty", 0))
            for it in grc.get("items", [])
        }
        for item in grn_dict["items"]:
            bc = (item.get("barcode") or "").strip()
            item["barcode"] = bc
            if bc in grc_item_map:
                max_qty = grc_item_map[bc]
                inward  = float(item.get("inwardQty", 0))
                if inward > max_qty:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Item '{bc}': inwardQty ({inward}) exceeds GRC acceptedQty ({max_qty})."
                    )
                item["acceptedQty"] = max_qty
            else:
                # Walk-in item (not in GRC map): set acceptedQty = inwardQty
                # so compute_grn_totals won't clamp to 0
                item["acceptedQty"] = float(item.get("inwardQty", 0))

    if not grn_dict.get("grnNo"):
        grn_dict["grnNo"] = await generate_grn_number(ctx["tenant_id"])

    compute_grn_totals(grn_dict)
    grn_dict["_id"]       = ObjectId()
    grn_dict["createdAt"] = datetime.utcnow()
    grn_dict["updatedAt"] = datetime.utcnow()

    await grn_collection.insert_one(grn_dict)
    grn_dict["id"] = str(grn_dict.pop("_id"))
    return {"message": "GRN created successfully", "grn": grn_dict}


# ─────────────────────────────────────────────
# GET / — List all GRNs
# ─────────────────────────────────────────────

@router.get("/", response_model=List[GRNModel])
async def get_all_grns(ctx: dict = Depends(get_receiving_tenant)):
    results = []
    async for doc in grn_collection.find({"tenant_id": ctx["tenant_id"]}).sort("_id", -1):
        doc["id"] = objid(doc.pop("_id"))
        results.append(GRNModel(**doc))
    return results


# ─────────────────────────────────────────────
# FIXED-PATH routes — MUST be before /{grn_id}
# ─────────────────────────────────────────────

@router.get("/by-grc/{grc_no:path}")
async def get_grns_by_grc(grc_no: str, ctx: dict = Depends(get_receiving_tenant)):
    results = []
    async for doc in grn_collection.find({"grcNo": grc_no, "tenant_id": ctx["tenant_id"]}):
        doc["id"] = objid(doc.pop("_id"))
        results.append(doc)
    return results


@router.get("/by-po/{po_no:path}")
async def get_grns_by_po(po_no: str, ctx: dict = Depends(get_receiving_tenant)):
    results = []
    async for doc in grn_collection.find({"poNo": po_no, "tenant_id": ctx["tenant_id"]}):
        doc["id"] = objid(doc.pop("_id"))
        results.append(doc)
    return results


@router.get("/inventory/snapshot")
async def get_inventory_snapshot(ctx: dict = Depends(get_hq_tenant)):
    """
    Return current stock levels from inventory_collection, scoped to the
    caller's tenant.

    ⚠️ FIXED: previously returned inventory_collection.find({}) with no
    filter at all — since tenant_id is now correctly stamped on every
    document by update_inventory()/backfill_posted_grns(), this can now
    actually filter by it.

    Existing documents written before this fix have no tenant_id and will
    not appear here. Running backfill_posted_grns() will NOT repair them
    in place — its upsert filter now requires tenant_id, so it won't match
    an old untagged document; instead it creates a fresh, correctly-tagged
    document with the recalculated stockQty. The old untagged documents
    become orphaned duplicates in the collection (harmless — permanently
    invisible to every tenant-scoped query, same as before, just now dead
    weight rather than a live bug) and should be cleaned up with a direct
    one-off script (e.g. delete any inventory_collection/product_collection
    document with no tenant_id field) rather than assumed fixed by this route.
    """
    results = []
    async for doc in inventory_collection.find({"tenant_id": ctx["tenant_id"]}, {"_id": 0}):
        results.append(doc)
    return results


@router.post("/backfill-posted")
async def backfill_posted_grns(payload: dict = {}, ctx: dict = Depends(get_hq_tenant)):
    """
    Recalculates correct stockQty for every barcode from GRN history and
    writes the correct value using $set (not $inc) — safe even when existing
    inventory records have corrupt/negative values from old code.

    Also auto-creates product_collection entries for any missing barcodes.

    POST /grn/backfill-posted   body: { "confirm": true }
    Safe to call multiple times — idempotent.

    ⚠️ FIXED: this route's docstring used to warn it shared the same
    unfixed tenant_id gap as update_inventory() — that's now fixed in both
    places. This route only scans the caller's own tenant's GRNs
    (grn_collection.find already filters tenant_id) and now also stamps
    tenant_id on every inventory_collection/product_collection write it
    performs, matching the fix applied to the live posting path.
    """
    if not payload.get("confirm"):
        raise HTTPException(
            status_code=400,
            detail='Pass { "confirm": true } in the request body to run the backfill.'
        )

    barcode_data: dict = {}

    async for grn in grn_collection.find({"status": {"$in": ["Posted", "Cancelled"]}, "tenant_id": ctx["tenant_id"]}):
        grn_no    = grn.get("grnNo", str(grn["_id"]))
        vendor    = (grn.get("vendorName") or "").strip()
        is_posted = grn.get("status") == "Posted"
        factor    = 1 if is_posted else -1

        for idx, item in enumerate(grn.get("items", [])):
            raw_bc = (item.get("barcode") or "").strip()
            inward = float(item.get("inwardQty", 0))
            if inward == 0:
                continue

            barcode   = raw_bc if raw_bc else f"WALKIN/{grn_no}/{idx + 1}"
            is_walkin = barcode.startswith("ITEM/") or barcode.startswith("WALKIN/")

            if barcode not in barcode_data:
                barcode_data[barcode] = {
                    "qty":       0.0,
                    "rate":      float(item.get("rate", 0)),
                    "desc":      (item.get("description") or "").strip(),
                    "grn_no":    grn_no,
                    "vendor":    vendor,
                    "is_walkin": is_walkin,
                }
            barcode_data[barcode]["qty"] = round(
                barcode_data[barcode]["qty"] + (factor * inward), 4
            )
            if is_posted:
                barcode_data[barcode]["rate"]   = float(item.get("rate", 0))
                barcode_data[barcode]["grn_no"] = grn_no
                barcode_data[barcode]["vendor"] = vendor

    inventory_written = 0
    products_created  = 0
    products_synced   = 0
    errors            = []

    for barcode, data in barcode_data.items():
        net_qty   = max(0.0, data["qty"])
        rate      = data["rate"]
        desc      = data["desc"]
        grn_no    = data["grn_no"]
        vendor    = data["vendor"]
        is_walkin = data["is_walkin"]

        meta            = {} if is_walkin else await get_product_meta(barcode, ctx["tenant_id"])
        display_name    = meta.get("product_name") or desc or barcode
        inv_source      = "grn" if is_walkin else meta.get("source", "admin")
        inv_vendor_name = vendor if is_walkin else (meta.get("vendor_name") or vendor)

        try:
            await inventory_collection.update_one(
                {"barcode": barcode, "tenant_id": ctx["tenant_id"]},
                {
                    "$set": {
                        "barcode":     barcode,
                        "stockQty":    net_qty,
                        "description": display_name,
                        "rate":        rate,
                        "sku":         meta.get("sku", ""),
                        "division":    meta.get("division", ""),
                        "section":     meta.get("section", ""),
                        "department":  meta.get("department", ""),
                        "updatedAt":   datetime.utcnow(),
                        "is_walkin":   is_walkin,
                        "source":      inv_source,
                        "vendor_name": inv_vendor_name,
                        "grn_no":      grn_no,
                    },
                    "$setOnInsert": {"tenant_id": ctx["tenant_id"], "createdAt": datetime.utcnow()}
                },
                upsert=True
            )
            inventory_written += 1
        except Exception as e:
            errors.append(f"inv write failed | barcode='{barcode}' | {e}")
            continue

        try:
            if not await barcode_in_products(barcode, ctx["tenant_id"]):
                await product_collection.insert_one({
                    "product_name":    desc or barcode,
                    "division":        "",
                    "section":         "",
                    "department":      "",
                    "hsn_code":        "",
                    "gst_rate":        0.0,
                    "cgst_rate":       0.0,
                    "sgst_rate":       0.0,
                    "igst_rate":       0.0,
                    "requires_expiry": False,
                    "expiry_date":     "",
                    "shelf_life_days": 0,
                    "sku":             "",
                    "barcode":         barcode,
                    "cost_price":      rate,
                    "mrp":             rate,
                    "selling_price":   rate,
                    "quantity":        net_qty,
                    "unit":            "pcs",
                    "description":     f"Auto-created from GRN {grn_no} (backfill)",
                    "specification":   "",
                    "has_variants":    False,
                    "variant_type":    "none",
                    "variants":        [],
                    "images":          [],
                    "created_at":      datetime.utcnow(),
                    "created_by":      "GRN",
                    "source":          "grn",
                    "vendor_name":     vendor,
                    "vendor_id":       None,
                    "grn_no":          grn_no,
                    "tenant_id":       ctx["tenant_id"],
                })
                products_created += 1
            else:
                simple = await product_collection.find_one(
                    {"barcode": barcode, "tenant_id": ctx["tenant_id"]}, {"_id": 1}
                )
                if simple:
                    upd: dict = {"$set": {"quantity": net_qty, "updatedAt": datetime.utcnow()}}
                    if rate > 0:
                        upd["$set"]["cost_price"] = rate
                    await product_collection.update_one({"_id": simple["_id"]}, upd)
                    products_synced += 1
                else:
                    parent = await product_collection.find_one(
                        {"variants.barcode": barcode, "tenant_id": ctx["tenant_id"]}, {"_id": 1, "variants": 1}
                    )
                    if parent:
                        for vidx, v in enumerate(parent.get("variants", [])):
                            if (v.get("barcode") or "").strip() == barcode:
                                patch = {
                                    f"variants.{vidx}.stock": net_qty,
                                    "updatedAt": datetime.utcnow(),
                                }
                                if rate > 0:
                                    patch[f"variants.{vidx}.cost_price"] = rate
                                await product_collection.update_one(
                                    {"_id": parent["_id"]}, {"$set": patch}
                                )
                                products_synced += 1
                                break
        except Exception as e:
            errors.append(f"product write failed | barcode='{barcode}' | {e}")

    return {
        "status":             "success",
        "message":            f"Backfill complete. Processed {len(barcode_data)} unique barcode(s).",
        "barcodes_processed": len(barcode_data),
        "inventory_written":  inventory_written,
        "products_created":   products_created,
        "products_synced":    products_synced,
        "barcode_summary":    {bc: d["qty"] for bc, d in barcode_data.items()},
        "errors":             errors,
    }


# ─────────────────────────────────────────────
# WILDCARD /{grn_id} routes — MUST be LAST
# ─────────────────────────────────────────────

@router.get("/{grn_id}", response_model=GRNModel)
async def get_grn(grn_id: str, ctx: dict = Depends(get_receiving_tenant)):
    try:
        doc = await grn_collection.find_one({"_id": ObjectId(grn_id), "tenant_id": ctx["tenant_id"]})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid GRN ID")
    if not doc:
        raise HTTPException(status_code=404, detail="GRN not found")
    doc["id"] = objid(doc.pop("_id"))
    return GRNModel(**doc)


@router.put("/{grn_id}")
async def update_grn(grn_id: str, grn: GRNModel, ctx: dict = Depends(get_receiving_tenant)):
    try:
        existing = await grn_collection.find_one({"_id": ObjectId(grn_id), "tenant_id": ctx["tenant_id"]})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid GRN ID")
    if not existing:
        raise HTTPException(status_code=404, detail="GRN not found")
    if existing.get("status") != "Draft":
        raise HTTPException(
            status_code=400,
            detail=f"Only Draft GRNs can be edited. This GRN is '{existing.get('status')}'."
        )

    grn_dict = grn.dict(exclude_unset=True)
    grn_dict.pop("tenant_id", None)   # never let the client body overwrite this
    # Receipt destination is server-owned. A client editing a draft must not
    # redirect stock to another location.
    grn_dict.pop("receiving_store_id", None)
    grn_dict.pop("receiving_store_name", None)
    destination = (
        await resolve_recorded_store_destination(ctx["tenant_id"], existing["receiving_store_id"])
        if existing.get("receiving_store_id")
        else await resolve_single_store_destination(ctx["tenant_id"], ctx.get("store_id") or "")
    )
    if destination:
        grn_dict["receiving_store_id"] = destination["id"]
        grn_dict["receiving_store_name"] = destination["name"]
    grn_dict["updatedAt"] = datetime.utcnow()

    if "grcNo" in grn_dict and grn_dict["grcNo"] != existing.get("grcNo"):
        grc = await resolve_grc(grn_dict["grcNo"], ctx["tenant_id"])
        await check_duplicate_grn(str(grc["_id"]), ctx["tenant_id"], exclude_id=grn_id)
        grn_dict["grc_id"]     = str(grc["_id"])
        grn_dict["poNo"]       = grc.get("poNo", "") or ""
        grn_dict["po_id"]      = str(grc.get("po_id", ""))
        grn_dict["vendorName"] = grc.get("vendorName", "")

    for item in grn_dict.get("items", []):
        item["barcode"] = (item.get("barcode") or "").strip()

    compute_grn_totals(grn_dict)
    await grn_collection.update_one({"_id": ObjectId(grn_id), "tenant_id": ctx["tenant_id"]}, {"$set": grn_dict})
    return {"message": "GRN updated successfully"}


@router.post("/{grn_id}/post")
async def post_grn(grn_id: str, ctx: dict = Depends(get_receiving_tenant)):
    try:
        grn = await grn_collection.find_one({"_id": ObjectId(grn_id), "tenant_id": ctx["tenant_id"]})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid GRN ID")
    if not grn:
        raise HTTPException(status_code=404, detail="GRN not found")
    if grn.get("status") != "Draft":
        raise HTTPException(
            status_code=400,
            detail=f"GRN is already '{grn.get('status')}'. Only Draft GRNs can be posted."
        )

    destination = (
        await resolve_recorded_store_destination(ctx["tenant_id"], grn["receiving_store_id"])
        if grn.get("receiving_store_id")
        else await resolve_single_store_destination(ctx["tenant_id"], ctx.get("store_id") or "")
    )
    if destination:
        await update_single_store_stock(grn, destination)
    else:
        await update_inventory(grn)

    await grn_collection.update_one(
        {"_id": ObjectId(grn_id), "tenant_id": ctx["tenant_id"]},
        {"$set": {
            "status": "Posted",
            "receiving_store_id": destination["id"] if destination else None,
            "receiving_store_name": destination["name"] if destination else "",
            "updatedAt": datetime.utcnow(),
        }}
    )

    if grn.get("po_id"):
        try:
            await purchaseorders_collection.update_one(
                {"_id": ObjectId(grn["po_id"]), "tenant_id": ctx["tenant_id"]},
                {"$set": {"status": "StockUpdated", "updatedAt": datetime.utcnow()}}
            )
        except Exception:
            pass

    flow = "PO-linked" if grn.get("po_id") else "Direct/walk-in"
    return {
        "message":        f"GRN '{grn.get('grnNo')}' posted. Stock updated.",
        "flow":           flow,
        "stock_destination": destination["name"] if destination else "Central Inventory",
        "totalInwardQty": grn.get("totalInwardQty"),
        "totalAmount":    grn.get("totalAmount"),
    }


@router.post("/{grn_id}/cancel")
async def cancel_grn(grn_id: str, payload: dict = Depends(get_receiving_tenant)):
    reason = (payload.get("reason") or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="A cancellation reason is required.")

    try:
        grn = await grn_collection.find_one({"_id": ObjectId(grn_id), "tenant_id": ctx["tenant_id"]})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid GRN ID")
    if not grn:
        raise HTTPException(status_code=404, detail="GRN not found")
    if grn.get("status") == "Cancelled":
        raise HTTPException(status_code=400, detail="GRN is already cancelled.")

    if grn.get("status") == "Posted":
        destination = (
            await resolve_recorded_store_destination(ctx["tenant_id"], grn["receiving_store_id"])
            if grn.get("receiving_store_id")
            else None
        )
        if destination:
            await update_single_store_stock(grn, destination, reverse=True)
        else:
            await update_inventory(grn, reverse=True)
        if grn.get("po_id"):
            try:
                await purchaseorders_collection.update_one(
                    {"_id": ObjectId(grn["po_id"]), "tenant_id": ctx["tenant_id"]},
                    {"$set": {"status": "FullyReceived", "updatedAt": datetime.utcnow()}}
                )
            except Exception:
                pass

    await grn_collection.update_one(
        {"_id": ObjectId(grn_id), "tenant_id": ctx["tenant_id"]},
        {"$set": {
            "status":             "Cancelled",
            "cancellationReason": reason,
            "updatedAt":          datetime.utcnow(),
        }}
    )
    return {"message": f"GRN '{grn.get('grnNo')}' cancelled.", "reason": reason}


@router.delete("/{grn_id}")
async def delete_grn(grn_id: str, ctx: dict = Depends(get_receiving_tenant)):
    try:
        existing = await grn_collection.find_one({"_id": ObjectId(grn_id), "tenant_id": ctx["tenant_id"]})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid GRN ID")
    if not existing:
        raise HTTPException(status_code=404, detail="GRN not found")
    if existing.get("status") != "Draft":
        raise HTTPException(
            status_code=400,
            detail="Only Draft GRNs can be deleted. Use Cancel for Posted GRNs."
        )
    await grn_collection.delete_one({"_id": ObjectId(grn_id), "tenant_id": ctx["tenant_id"]})
    return {"message": "GRN deleted successfully"}
