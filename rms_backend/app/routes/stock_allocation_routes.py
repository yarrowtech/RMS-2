

# stock_allocation_routes.py — FIXED
# Change: allocate_stock() now DEDUCTS stockQty from central inventory
# instead of just incrementing "allocated" field.
# This makes central stock reduce visibly in /inventory/current-stock.


# stock_allocation_routes.py — SIMPLIFIED
#
# Write actions (allocate / transfer / return-to-central) have been REMOVED.
# All stock movement between Central and Stores now goes through the
# Dispatch → Receive flow in stock_transfers_routes.py, which gives a real
# audit trail (refNo, transporter, logistics) and an explicit confirmation
# step at the destination instead of an instant silent transfer.
#
# This file now only provides READ-ONLY summary views:
#   - /central-stock        → current central inventory snapshot
#   - /store-stock/{id}     → current store inventory snapshot (enriched)
#   - /history               → alias over stock_transfers_collection
#
# If old frontend code still calls POST /stock-allocation/allocate etc.,
# it will now 410 Gone with a pointer to the new endpoint.
'''
from datetime import datetime
import secrets

from fastapi import APIRouter, HTTPException, Header
from app.db import inventory_collection, store_stock_collection, stock_transfers_collection

router = APIRouter(prefix="/stock-allocation", tags=["Stock Allocation"])


def _assert_store_access(store: dict, store_id: str) -> None:
    """A store-scoped account may only read or maintain its own location."""
    if store.get("scope") == "store" and store.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="You can only access stock for your assigned store.")


# ─────────────────────────────────────────────────────────────────────────────
# GET /stock-allocation/central-stock
# stockQty already reflects "available" — goods in transit (Dispatched, not
# yet Received) have already been deducted by stock_transfers_routes.py.
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/central-stock")
async def get_central_stock(authorization: str = Header(None)):
    rows = []
    async for doc in inventory_collection.find({}):
        stock_qty = float(doc.get("stockQty", 0))
        rows.append({
            "barcode":     doc.get("barcode", ""),
            "stockQty":    stock_qty,
            "available":   max(0, stock_qty),
            "description": doc.get("description", ""),
            "sku":         doc.get("sku", ""),
            "division":    doc.get("division", ""),
            # Stock transfers are valued at MRP. Keep `rate` for the existing
            # frontend/PDF contract and expose `mrp` explicitly as well.
            "mrp":         float(doc.get("mrp") or doc.get("rate") or 0),
            "rate":        float(doc.get("mrp") or doc.get("rate") or 0),
        })
    return {"status": "success", "count": len(rows), "data": rows}


# ─────────────────────────────────────────────────────────────────────────────
# GET /stock-allocation/store-stock/{store_id}
# Enriches store_stock rows with product info from central inventory.
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/store-stock/{store_id}")
async def get_store_stock(store_id: str, authorization: str = Header(None)):
    rows = []
    async for doc in store_stock_collection.find({"store_id": store_id}):
        barcode = doc.get("barcode", "")
        central = await inventory_collection.find_one({"barcode": barcode}) or {}

        rows.append({
            "barcode":     barcode,
            "stockQty":    float(doc.get("stockQty", 0)),
            "store_id":    doc.get("store_id"),
            "store_name":  doc.get("store_name", ""),
            "description": central.get("description") or central.get("product") or barcode,
            "sku":         central.get("sku", ""),
            "division":    central.get("division", ""),
            "section":     central.get("section", ""),
            "department":  central.get("department", ""),
            "mrp":         float(central.get("mrp") or central.get("rate") or 0),
            "rate":        float(central.get("mrp") or central.get("rate") or 0),
            "vendor_name": central.get("vendor_name", ""),
        })

    return {"status": "success", "store_id": store_id, "count": len(rows), "data": rows}


# ─────────────────────────────────────────────────────────────────────────────
# GET /stock-allocation/history
# Now reads from stock_transfers_collection — every Dispatch and Receive
# event is a real transfer document, so history is just a filtered/flattened
# view over that collection (kept for any old frontend code expecting this
# exact response shape).
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/history")
async def get_allocation_history(store_id: str = None, barcode: str = None, authorization: str = Header(None)):
    query = {}
    if store_id:
        query["$or"] = [{"from_store_id": store_id}, {"to_store_id": store_id}]
    if barcode:
        query["lines.barcode"] = barcode

    rows = []
    async for doc in stock_transfers_collection.find(query).sort("createdAt", -1).limit(200):
        for line in doc.get("lines", []):
            if barcode and line.get("barcode") != barcode:
                continue
            rows.append({
                "id":         str(doc["_id"]),
                "barcode":    line.get("barcode", ""),
                "qty":        line.get("qty", 0),
                "type":       "allocation" if doc.get("type") == "Out" and not doc.get("from_store_id") else
                              "return_to_central" if doc.get("type") == "Out" and not doc.get("to_store_id") else
                              "transfer" if doc.get("type") == "Out" else "receive",
                "status":     doc.get("status", ""),
                "from_store": doc.get("fromWh", "Central"),
                "to_store":   doc.get("toWh", ""),
                "notes":      doc.get("remarks", ""),
                "refNo":      doc.get("refNo", ""),
                "created_at": str(doc.get("createdAt", ""))[:19],
            })

    return {"status": "success", "count": len(rows), "data": rows}


# ─────────────────────────────────────────────────────────────────────────────
# Deprecated write endpoints — return 410 Gone pointing to the new flow.
# Keep these stubs briefly so old frontend builds fail loudly instead of
# silently doing nothing.
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/allocate")
async def allocate_stock_deprecated():
    raise HTTPException(
        status_code=410,
        detail="This endpoint has moved. Use POST /stock-transfers/ (type=Out, to_store_id=<store>) "
               "followed by POST /stock-transfers/{id}/receive at the store."
    )


@router.post("/transfer")
async def transfer_stock_deprecated():
    raise HTTPException(
        status_code=410,
        detail="This endpoint has moved. Use POST /stock-transfers/ (type=Out, from_store_id, to_store_id) "
               "followed by POST /stock-transfers/{id}/receive at the destination."
    )


@router.post("/return-to-central")
async def return_to_central_deprecated():
    raise HTTPException(
        status_code=410,
        detail="This endpoint has moved. Use POST /stock-transfers/ (type=Out, from_store_id=<store>, "
               "to_store_id=null) followed by POST /stock-transfers/{id}/receive at HQ."
    )
'''



# stock_allocation_routes.py — TENANT-SCOPED
#
# ⚠️ ASSUMPTION FLAGGED: this file authenticates via get_store_context()
# from .store_helper, which I have not seen the source of. Every other file
# in this pass uses deps.get_tenant()/get_hq_tenant(), which returns a dict
# containing "tenant_id" (confirmed from deps.py earlier in this
# conversation). I'm assuming get_store_context() returns a comparable dict
# that ALSO includes "tenant_id" — since store admins are still admins of
# one tenant, just scoped further to one store within it, that would be the
# consistent design. If store_helper.py's get_store_context() does NOT
# currently return tenant_id, every "store[\"tenant_id\"]" reference below
# will KeyError at runtime and store_helper.py needs the same tenant_id
# resolution added to it that deps.get_tenant() already has. Please check
# store_helper.py against this assumption before deploying.
#
# Everything else follows the same pattern as the rest of this pass:
# every query against inventory_collection and store_stock_collection is
# now scoped to tenant_id, so Citimart's central/store stock is invisible
# to Zudio or BigBasket even if store_id values happened to collide.

from datetime import datetime

from fastapi import APIRouter, HTTPException, Header
from app.db import (
    inventory_collection, store_stock_collection, stock_transfers_collection,
    tenants_collection, product_collection, stock_adjustments_collection,
    grc_collection, stores_collection,
)
from .store_helper import get_store_context

router = APIRouter(prefix="/stock-allocation", tags=["Stock Allocation"])


def _assert_store_access(store: dict, store_id: str) -> None:
    """A store-scoped account may only read or maintain its own location."""
    if store.get("scope") == "store" and store.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="You can only access stock for your assigned store.")


async def _is_single_store_tenant(tenant_id: str) -> bool:
    tenant = await tenants_collection.find_one({"tenant_id": tenant_id}, {"account_type": 1})
    return (tenant or {}).get("account_type") == "single_store"


def _variant_token(value: str, fallback: str) -> str:
    cleaned = "".join(ch for ch in str(value or "").upper() if ch.isalnum())
    return cleaned[:4] or fallback


async def _variant_sku_available(tenant_id: str, sku: str) -> bool:
    if await product_collection.find_one(
        {"tenant_id": tenant_id, "$or": [{"sku": sku}, {"base_sku": sku}, {"variants.sku": sku}]}, {"_id": 1}
    ):
        return False
    if await inventory_collection.find_one({"tenant_id": tenant_id, "sku": sku}, {"_id": 1}):
        return False
    return not bool(await store_stock_collection.find_one({"tenant_id": tenant_id, "sku": sku}, {"_id": 1}))


async def _generate_variant_sku(tenant_id: str, base_sku: str, size: str, color: str) -> str:
    base = (base_sku or "ITEM").strip().upper()
    suffix = "-".join([_variant_token(size, "ONE"), _variant_token(color, "CLR")])
    for sequence in range(1, 1000):
        candidate = f"{base}-{suffix}" if sequence == 1 else f"{base}-{suffix}-{sequence:02d}"
        if await _variant_sku_available(tenant_id, candidate):
            return candidate
    raise HTTPException(status_code=500, detail="Could not allocate a unique variant SKU. Please try again.")


async def _generate_variant_barcode() -> str:
    """Internal eight-digit barcode, unique across RMS product/receipt data."""
    for _ in range(30):
        payload = f"{secrets.randbelow(10_000_000):07d}"
        weighted = sum(int(digit) * (3 if index % 2 == 0 else 1) for index, digit in enumerate(reversed(payload)))
        barcode = f"{payload}{(10 - weighted % 10) % 10}"
        exists = await product_collection.find_one(
            {"$or": [{"barcode": barcode}, {"variants.barcode": barcode}]}, {"_id": 1}
        )
        if not exists:
            exists = await grc_collection.find_one({"items.barcode": barcode}, {"_id": 1})
        if not exists:
            return barcode
    raise HTTPException(status_code=500, detail="Could not allocate a unique barcode. Please try again.")


# ─────────────────────────────────────────────────────────────────────────────
# GET /stock-allocation/central-stock
# stockQty already reflects "available" — goods in transit (Dispatched, not
# yet Received) have already been deducted by stock_transfers_routes.py.
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/central-stock")
async def get_central_stock(authorization: str = Header(None)):
    store = await get_store_context(authorization)
    tenant_id = store.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=403, detail="No tenant assigned to this account.")

    rows = []
    async for doc in inventory_collection.find({"tenant_id": tenant_id}):
        stock_qty = float(doc.get("stockQty", 0))
        rows.append({
            "barcode":     doc.get("barcode", ""),
            "stockQty":    stock_qty,
            "available":   max(0, stock_qty),
            "description": doc.get("description", ""),
            "sku":         doc.get("sku", ""),
            "division":    doc.get("division", ""),
            "mrp":         float(doc.get("mrp") or doc.get("rate") or 0),
            "rate":        float(doc.get("mrp") or doc.get("rate") or 0),
        })
    return {"status": "success", "count": len(rows), "data": rows}


# ─────────────────────────────────────────────────────────────────────────────
# GET /stock-allocation/store-stock/{store_id}
# Enriches store_stock rows with product info from central inventory.
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/store-stock/{store_id}")
async def get_store_stock(store_id: str, authorization: str = Header(None)):
    store = await get_store_context(authorization)
    tenant_id = store.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=403, detail="No tenant assigned to this account.")
    _assert_store_access(store, store_id)
    is_single_store = await _is_single_store_tenant(tenant_id)

    rows = []
    async for doc in store_stock_collection.find({"store_id": store_id, "tenant_id": tenant_id}):
        barcode = doc.get("barcode", "")
        central = await inventory_collection.find_one({"barcode": barcode, "tenant_id": tenant_id}) or {}

        rows.append({
            "barcode":     barcode,
            "stockQty":    float(doc.get("stockQty", 0)),
            "store_id":    doc.get("store_id"),
            "store_name":  doc.get("store_name", ""),
            # Existing retailer stores continue to use central product master
            # data. A single-store owner may maintain local item details.
            "description": (doc.get("description") if is_single_store else None) or central.get("description") or central.get("product") or barcode,
            "sku":         (doc.get("sku") if is_single_store else None) or central.get("sku", ""),
            "division":    (doc.get("division") if is_single_store else None) or central.get("division", ""),
            "section":     (doc.get("section") if is_single_store else None) or central.get("section", ""),
            "department":  (doc.get("department") if is_single_store else None) or central.get("department", ""),
            "mrp":         float(((doc.get("mrp") or doc.get("rate")) if is_single_store else None) or central.get("mrp") or central.get("rate") or 0),
            "rate":        float(((doc.get("rate") or doc.get("mrp")) if is_single_store else None) or central.get("rate") or central.get("mrp") or 0),
            "vendor_name": (doc.get("vendor_name") if is_single_store else None) or central.get("vendor_name", ""),
            "size_label": doc.get("size_label", ""),
            "color":      doc.get("color", ""),
        })

    return {"status": "success", "store_id": store_id, "count": len(rows), "data": rows}


# ─────────────────────────────────────────────────────────────────────────────
# GET /stock-allocation/store-summary
# One row per store/branch PLUS Central, side by side — for HQ oversight
# that needs to compare stock across locations at a glance, not pick one
# store at a time via /store-stock/{store_id}.
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/store-summary")
async def get_store_stock_summary(authorization: str = Header(None)):
    store = await get_store_context(authorization)
    tenant_id = store.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=403, detail="No tenant assigned to this account.")
    if store.get("scope") == "store":
        raise HTTPException(status_code=403, detail="Store-wise summary is an HQ view.")
    is_single_store = await _is_single_store_tenant(tenant_id)

    # Multi-store retailers price stock from the central product master —
    # store_stock documents don't carry their own mrp/rate (same rule
    # get_store_stock applies). Build a barcode -> price lookup once instead
    # of a query per store_stock row.
    central_prices: dict = {}
    central_qty = 0.0
    central_value = 0.0
    central_items = 0
    async for doc in inventory_collection.find({"tenant_id": tenant_id}):
        barcode = doc.get("barcode", "")
        price = float(doc.get("mrp") or doc.get("rate") or 0)
        if barcode:
            central_prices[barcode] = price
        qty = float(doc.get("stockQty", 0))
        if qty > 0:
            central_items += 1
        central_qty += qty
        central_value += qty * price

    # Seed every active store/branch so locations with zero stock still show
    # a row, not just whichever ones happen to have store_stock documents.
    rows_by_store: dict = {}
    async for s in stores_collection.find({"tenant_id": tenant_id, "active": True}):
        rows_by_store[str(s["_id"])] = {
            "store_id": str(s["_id"]), "store_name": s.get("name", ""),
            "item_count": 0, "total_qty": 0.0, "total_value": 0.0,
        }

    async for doc in store_stock_collection.find({"tenant_id": tenant_id}):
        store_id = doc.get("store_id")
        if not store_id:
            continue
        barcode = doc.get("barcode", "")
        qty = float(doc.get("stockQty", 0))
        own_price = float(doc.get("mrp") or doc.get("rate") or 0) if is_single_store else 0.0
        price = own_price or central_prices.get(barcode, 0.0)
        value = qty * price
        row = rows_by_store.setdefault(store_id, {
            "store_id": store_id, "store_name": doc.get("store_name", ""),
            "item_count": 0, "total_qty": 0.0, "total_value": 0.0,
        })
        if qty > 0:
            row["item_count"] += 1
        row["total_qty"] += qty
        row["total_value"] += value

    rows = [
        {"store_id": None, "store_name": "Central (unallocated)",
         "item_count": central_items, "total_qty": round(central_qty, 2), "total_value": round(central_value, 2)},
        *[{**r, "total_qty": round(r["total_qty"], 2), "total_value": round(r["total_value"], 2)}
          for r in sorted(rows_by_store.values(), key=lambda r: r["store_name"])],
    ]
    return {"status": "success", "data": rows}


# ─────────────────────────────────────────────────────────────────────────────
# GET /stock-allocation/item-matrix
# Item-level version of store-summary: one row per product, one column per
# store (+ Central), so HQ can see exactly which branch holds how much of a
# specific SKU — not just each store's aggregate total.
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/item-matrix")
async def get_item_matrix(
    search: str = "",
    limit: int = 200,
    authorization: str = Header(None),
):
    store = await get_store_context(authorization)
    tenant_id = store.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=403, detail="No tenant assigned to this account.")
    if store.get("scope") == "store":
        raise HTTPException(status_code=403, detail="Item-level store comparison is an HQ view.")
    limit = max(1, min(limit, 1000))

    stores_list = []
    async for s in stores_collection.find({"tenant_id": tenant_id, "active": True}).sort("name", 1):
        stores_list.append({"id": str(s["_id"]), "name": s.get("name", "")})

    products: dict = {}

    async for doc in inventory_collection.find({"tenant_id": tenant_id}):
        barcode = doc.get("barcode", "")
        if not barcode:
            continue
        products[barcode] = {
            "barcode": barcode,
            "description": doc.get("description", "") or doc.get("product", "") or barcode,
            "sku": doc.get("sku", ""),
            "central_qty": float(doc.get("stockQty", 0)),
            "store_qty": {},
        }

    async for doc in store_stock_collection.find({"tenant_id": tenant_id}):
        barcode = doc.get("barcode", "")
        store_id = doc.get("store_id")
        if not barcode or not store_id:
            continue
        row = products.setdefault(barcode, {
            "barcode": barcode,
            "description": doc.get("description", "") or barcode,
            "sku": doc.get("sku", ""),
            "central_qty": 0.0,
            "store_qty": {},
        })
        row["store_qty"][store_id] = row["store_qty"].get(store_id, 0) + float(doc.get("stockQty", 0))

    rows = list(products.values())
    if search:
        needle = search.strip().lower()
        rows = [r for r in rows if needle in r["barcode"].lower() or needle in r["description"].lower() or needle in r["sku"].lower()]
    rows.sort(key=lambda r: r["description"] or r["barcode"])
    total_count = len(rows)
    rows = rows[:limit]

    return {"status": "success", "stores": stores_list, "count": total_count, "data": rows}


@router.patch("/store-stock/{store_id}/{barcode}")
async def update_store_stock_details(
    store_id: str,
    barcode: str,
    payload: dict,
    authorization: str = Header(None),
):
    """Update non-quantity details for an item at a store.

    Stock quantities deliberately cannot be edited here. Quantity changes must
    use `/inventory/stock-adjustments`, which records the reason and keeps the
    ledger correct for audit and reconciliation.
    """
    store = await get_store_context(authorization)
    tenant_id = store.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=403, detail="No tenant assigned to this account.")
    _assert_store_access(store, store_id)
    if not await _is_single_store_tenant(tenant_id):
        raise HTTPException(status_code=403, detail="Store item editing is available only for single-store owners.")

    if "stockQty" in payload or "quantity" in payload:
        raise HTTPException(
            status_code=400,
            detail="Use Stock Adjustment to change quantity so the stock ledger remains accurate.",
        )

    allowed = {"description", "sku", "division", "section", "department", "rate", "mrp", "vendor_name"}
    changes = {key: payload[key] for key in allowed if key in payload}
    if not changes:
        raise HTTPException(status_code=400, detail="No editable item details were supplied.")

    for key in ("rate", "mrp"):
        if key in changes:
            try:
                changes[key] = max(0, float(changes[key] or 0))
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail=f"{key.upper()} must be a valid number.")
    for key in allowed - {"rate", "mrp"}:
        if key in changes:
            changes[key] = str(changes[key] or "").strip()

    changes["updatedAt"] = datetime.utcnow()
    result = await store_stock_collection.update_one(
        {"store_id": store_id, "tenant_id": tenant_id, "barcode": barcode},
        {"$set": changes},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Store stock item was not found.")

    return {"status": "success", "message": "Store item details updated. Quantity was not changed."}


@router.get("/store-stock/{store_id}/{barcode}/variants")
async def get_single_store_variants(store_id: str, barcode: str, authorization: str = Header(None)):
    """Return the sellable variants for a single-store product."""
    store = await get_store_context(authorization)
    tenant_id = store.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=403, detail="No tenant assigned to this account.")
    _assert_store_access(store, store_id)
    if not await _is_single_store_tenant(tenant_id):
        raise HTTPException(status_code=403, detail="Variant management is available only for single-store owners.")

    product = await product_collection.find_one({
        "tenant_id": tenant_id,
        "$or": [{"barcode": barcode}, {"variants.barcode": barcode}],
    })
    variants = []
    if product and product.get("has_variants"):
        for item in product.get("variants", []):
            variant_barcode = (item.get("barcode") or "").strip()
            stock = await store_stock_collection.find_one(
                {"tenant_id": tenant_id, "store_id": store_id, "barcode": variant_barcode},
                {"stockQty": 1, "_id": 0},
            ) or {}
            variants.append({
                "barcode": variant_barcode,
                "sku": item.get("sku", ""),
                "size_label": item.get("size_label", ""),
                "color": item.get("color", ""),
                "rate": float(item.get("cost_price") or product.get("cost_price") or 0),
                "mrp": float(item.get("mrp") or product.get("mrp") or 0),
                "stockQty": float(stock.get("stockQty", 0)),
            })
    return {"status": "success", "variants": variants}


@router.post("/store-stock/{store_id}/{barcode}/variants", status_code=201)
async def create_single_store_variants(
    store_id: str,
    barcode: str,
    payload: dict,
    authorization: str = Header(None),
):
    """Create size/colour combinations as distinct POS-ready store SKUs.

    This route is deliberately exclusive to a `single_store` tenant. Each
    combination gets a barcode, SKU, product-master variant, store stock row,
    and an opening-stock ledger entry where quantity was supplied.
    """
    store = await get_store_context(authorization)
    tenant_id = store.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=403, detail="No tenant assigned to this account.")
    _assert_store_access(store, store_id)
    if not await _is_single_store_tenant(tenant_id):
        raise HTTPException(status_code=403, detail="Variant management is available only for single-store owners.")

    source_row = await store_stock_collection.find_one(
        {"tenant_id": tenant_id, "store_id": store_id, "barcode": barcode}
    )
    if not source_row:
        raise HTTPException(status_code=404, detail="Store stock item was not found.")

    requested = payload.get("variants") or []
    if not isinstance(requested, list) or not requested:
        raise HTTPException(status_code=400, detail="Add at least one size/colour combination.")
    if len(requested) > 100:
        raise HTTPException(status_code=400, detail="A maximum of 100 variants can be created at once.")

    product = await product_collection.find_one({
        "tenant_id": tenant_id,
        "$or": [{"barcode": barcode}, {"variants.barcode": barcode}],
    })
    if product and product.get("has_variants"):
        parent_barcode = product.get("barcode") or barcode
        existing_variants = list(product.get("variants") or [])
    else:
        parent_barcode = barcode
        # Keep any pre-existing/unclassified stock as its own variant rather
        # than silently moving or losing it during the conversion.
        existing_variants = [{
            "barcode": barcode,
            "sku": source_row.get("sku", ""),
            "size_label": "",
            "color": "",
            "cost_price": float(source_row.get("rate") or 0),
            "mrp": float(source_row.get("mrp") or source_row.get("rate") or 0),
            "stock": float(source_row.get("stockQty") or 0),
        }]

    seen = {
        ((item.get("size_label") or "").strip().lower(), (item.get("color") or "").strip().lower())
        for item in existing_variants
    }
    new_variants, adjustment_lines = [], []
    base_sku = (payload.get("sku") or source_row.get("sku") or "ITEM").strip()
    for incoming in requested:
        size = str(incoming.get("size_label") or "").strip()
        color = str(incoming.get("color") or "").strip()
        if not size and not color:
            raise HTTPException(status_code=400, detail="Every variant needs at least a size or a colour.")
        key = (size.lower(), color.lower())
        if key in seen:
            raise HTTPException(status_code=400, detail=f"Duplicate variant: {size or 'One Size'} / {color or 'Default colour'}.")
        seen.add(key)
        try:
            opening_qty = int(float(incoming.get("opening_qty") or 0))
            rate = max(0, float(incoming.get("rate") or source_row.get("rate") or 0))
            mrp = max(0, float(incoming.get("mrp") or source_row.get("mrp") or rate))
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Variant quantity, rate, and MRP must be valid numbers.")
        if opening_qty < 0:
            raise HTTPException(status_code=400, detail="Opening quantity cannot be negative.")

        variant_barcode = await _generate_variant_barcode()
        variant_sku = await _generate_variant_sku(tenant_id, base_sku, size, color)
        variant = {
            "barcode": variant_barcode,
            "sku": variant_sku,
            "size_label": size,
            "color": color,
            "cost_price": rate,
            "mrp": mrp,
            "selling_price": mrp,
            "stock": opening_qty,
        }
        new_variants.append(variant)
        adjustment_lines.append({
            "barcode": variant_barcode,
            "sku": variant_sku,
            "product": payload.get("description") or source_row.get("description") or barcode,
            "division": payload.get("division") or source_row.get("division") or "",
            "section": payload.get("section") or source_row.get("section") or "",
            "department": payload.get("department") or source_row.get("department") or "",
            "qty_change": opening_qty,
            "reason": "Variant opening stock",
            "remarks": f"Created {size or 'one size'} / {color or 'default colour'} variant",
        })

    all_variants = existing_variants + new_variants
    product_details = {
        "tenant_id": tenant_id,
        "barcode": parent_barcode,
        "sku": base_sku,
        "product_name": payload.get("description") or source_row.get("description") or barcode,
        "description": payload.get("description") or source_row.get("description") or barcode,
        "division": payload.get("division") or source_row.get("division") or "",
        "section": payload.get("section") or source_row.get("section") or "",
        "department": payload.get("department") or source_row.get("department") or "",
        "cost_price": float(payload.get("rate") or source_row.get("rate") or 0),
        "mrp": float(payload.get("mrp") or source_row.get("mrp") or source_row.get("rate") or 0),
        "has_variants": True,
        "variant_type": "size-colour",
        "variants": all_variants,
        "stockQty": sum(float(item.get("stock") or 0) for item in all_variants),
        "quantity": sum(float(item.get("stock") or 0) for item in all_variants),
        "updatedAt": datetime.utcnow(),
    }
    await product_collection.update_one(
        {"tenant_id": tenant_id, "barcode": parent_barcode},
        {"$set": product_details, "$setOnInsert": {"createdAt": datetime.utcnow(), "source": "single_store"}},
        upsert=True,
    )

    for variant in new_variants:
        await store_stock_collection.insert_one({
            "tenant_id": tenant_id,
            "store_id": store_id,
            "store_name": store.get("store_name") or source_row.get("store_name", ""),
            "barcode": variant["barcode"],
            "sku": variant["sku"],
            "description": product_details["description"],
            "division": product_details["division"],
            "section": product_details["section"],
            "department": product_details["department"],
            "rate": variant["cost_price"],
            "mrp": variant["mrp"],
            "size_label": variant["size_label"],
            "color": variant["color"],
            "stockQty": variant["stock"],
            "source": "single_store_variant",
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
            "adjustments": [{
                "qty_change": variant["stock"], "reason": "Variant opening stock",
                "adjustedBy": "Store Owner", "adjustedAt": datetime.utcnow().isoformat(),
                "source": "single_store_variant_creation",
            }],
        })

    if any(line["qty_change"] for line in adjustment_lines):
        await stock_adjustments_collection.insert_one({
            "date": datetime.utcnow().strftime("%Y-%m-%d %H:%M"),
            "warehouse": store.get("store_name") or source_row.get("store_name", "Store"),
            "ref_no": f"VAR-OPEN-{datetime.utcnow().strftime('%y%m%d%H%M%S')}",
            "created_by": "Store Owner",
            "note": "Opening stock recorded while creating product variants.",
            "lines": adjustment_lines,
            "tenant_id": tenant_id,
            "store_id": store_id,
            "store_name": store.get("store_name", ""),
            "created_at": datetime.utcnow(),
        })

    return {"status": "success", "message": f"Created {len(new_variants)} product variant(s).", "variants": new_variants}


# ─────────────────────────────────────────────────────────────────────────────
# GET /stock-allocation/history
# Reads from stock_transfers_collection — every Dispatch and Receive event
# is a real transfer document, so history is a filtered/flattened view over
# that collection.
#
# NOTE: stock_transfers_collection itself isn't one of the files reviewed in
# this conversation. If it doesn't yet carry tenant_id, this filter is a
# no-op the same way inventory_collection was before this pass — it needs
# the same tenant_id stamp added at the point stock_transfers documents are
# created (in stock_transfers_routes.py, not shown here).
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/history")
async def get_allocation_history(store_id: str = None, barcode: str = None, authorization: str = Header(None)):
    store = await get_store_context(authorization)
    tenant_id = store.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=403, detail="No tenant assigned to this account.")

    query = {"tenant_id": tenant_id}
    if store_id:
        query["$or"] = [{"from_store_id": store_id}, {"to_store_id": store_id}]
    if barcode:
        query["lines.barcode"] = barcode

    rows = []
    async for doc in stock_transfers_collection.find(query).sort("createdAt", -1).limit(200):
        for line in doc.get("lines", []):
            if barcode and line.get("barcode") != barcode:
                continue
            rows.append({
                "id":         str(doc["_id"]),
                "barcode":    line.get("barcode", ""),
                "qty":        line.get("qty", 0),
                "type":       "allocation" if doc.get("type") == "Out" and not doc.get("from_store_id") else
                              "return_to_central" if doc.get("type") == "Out" and not doc.get("to_store_id") else
                              "transfer" if doc.get("type") == "Out" else "receive",
                "status":     doc.get("status", ""),
                "from_store": doc.get("fromWh", "Central"),
                "to_store":   doc.get("toWh", ""),
                "notes":      doc.get("remarks", ""),
                "refNo":      doc.get("refNo", ""),
                "created_at": str(doc.get("createdAt", ""))[:19],
            })

    return {"status": "success", "count": len(rows), "data": rows}


# ─────────────────────────────────────────────────────────────────────────────
# Deprecated write endpoints — return 410 Gone pointing to the new flow.
# No tenant scoping needed here since these never touch data — they only
# raise. Left exactly as before.
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/allocate")
async def allocate_stock_deprecated():
    raise HTTPException(
        status_code=410,
        detail="This endpoint has moved. Use POST /stock-transfers/ (type=Out, to_store_id=<store>) "
               "followed by POST /stock-transfers/{id}/receive at the store."
    )


@router.post("/transfer")
async def transfer_stock_deprecated():
    raise HTTPException(
        status_code=410,
        detail="This endpoint has moved. Use POST /stock-transfers/ (type=Out, from_store_id, to_store_id) "
               "followed by POST /stock-transfers/{id}/receive at the destination."
    )


@router.post("/return-to-central")
async def return_to_central_deprecated():
    raise HTTPException(
        status_code=410,
        detail="This endpoint has moved. Use POST /stock-transfers/ (type=Out, from_store_id=<store>, "
               "to_store_id=null) followed by POST /stock-transfers/{id}/receive at HQ."
    )
