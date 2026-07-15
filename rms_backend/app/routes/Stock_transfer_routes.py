

from fastapi import APIRouter, HTTPException, Query, Header, Depends
from fastapi.responses import JSONResponse
from typing import Optional, List
from datetime import datetime
from bson import ObjectId

from app.db import stock_transfers_collection, inventory_collection, store_stock_collection, stores_collection
from .store_helper import get_store_context
from .deps import require_permission

router = APIRouter(prefix="/stock-transfers", tags=["Stock Transfers"])

# ─────────────────────────────────────────────────────────────────────────────
# MULTI-STORE DISPATCH / RECEIVE MODEL
#
# A stock movement between Central and a Store (or Store and Store) is now a
# two-step process, matching how goods actually move physically:
#
#   STEP 1 — DISPATCH (creates a "Transfer Out" doc, status="Dispatched")
#     - Stock is deducted from the SOURCE immediately (it has physically left).
#     - Stock is NOT yet added to the destination — it is "in transit".
#
#   STEP 2 — RECEIVE (the destination confirms receipt)
#     - Only the destination (store admin, or HQ if destination is central)
#       can mark a Dispatched transfer as Received.
#     - This creates a linked "Transfer In" doc (status="Received")
#       and is the ONLY moment stock is added to the destination.
#     - The original Transfer Out doc's status flips to "Received" too.
#
# from_store_id / to_store_id:
#   None      → Central / HQ inventory (inventory_collection)
#   "abc123"  → that store's stock (store_stock_collection, filtered by store_id)
#
# ── TENANT ISOLATION ──────────────────────────────────────────────────────────
# Every route below now resolves tenant_id via get_store_context() (fixed in
# store_helper.py to actually return it). Every stock_transfers_collection,
# inventory_collection, and store_stock_collection operation is filtered/
# stamped by tenant_id, so a Citimart admin can never see, dispatch to,
# receive, edit, or cancel a transfer belonging to Zudio or BigBasket — even
# if a transfer_id or store_id happened to be guessable/identical across
# tenants.
# ─────────────────────────────────────────────────────────────────────────────


def _str(v) -> str:
    return str(v) if v else ""


def _float(v, default=0.0) -> float:
    try:    return float(v or default)
    except: return default


def _int(v, default=0) -> int:
    try:    return int(float(v or default))
    except: return default

def serialize(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    if doc.get("selectedTransferOutId"):
        doc["selectedTransferOutId"] = str(doc["selectedTransferOutId"])
    if doc.get("linked_transfer_id"):
        doc["linked_transfer_id"] = str(doc["linked_transfer_id"])
    if isinstance(doc.get("createdAt"), datetime):
        doc["createdAt"] = doc["createdAt"].isoformat()
    if isinstance(doc.get("updatedAt"), datetime):
        doc["updatedAt"] = doc["updatedAt"].isoformat()
    return doc


async def _require_tenant(authorization: Optional[str], permission: str = "stock_transfer") -> dict:
    """
    Resolve store context, hard-fail if tenant_id couldn't be determined,
    AND hard-fail if the caller doesn't hold the given permission.

    Every route in this file performs an actual dispatch/receive/edit/
    cancel action (or a read that reveals transfer contents/value), so
    "stock_transfer" is the correct default for all of them — it's a
    distinct permission from "store_stock" (viewing/adjusting stock at
    rest) and "inventory" (central catalog), matching the permission list
    presented in Admin Management.
    """
    store = await get_store_context(authorization)
    if not store.get("tenant_id"):
        raise HTTPException(status_code=403, detail="No tenant assigned to this account.")
    if permission not in store.get("permissions", []):
        raise HTTPException(
            status_code=403,
            detail=f"This account does not have the '{permission}' permission. "
                   f"Ask your HQ Admin to grant it in Admin Management.",
        )
    return store


async def _generate_ref(transfer_type: str, tenant_id: str) -> str:
    """Reference number sequence scoped per tenant — two tenants' TRF/TRF-IN
    numbering won't collide or leak counts to each other."""
    prefix = "TRF" if transfer_type == "Out" else "TRF-IN"
    count  = await stock_transfers_collection.count_documents({"type": transfer_type, "tenant_id": tenant_id})
    now    = datetime.utcnow()
    seq    = str(count + 1).zfill(5)
    return f"{prefix}/{now.strftime('%y%m')}/{seq}"


def _clean_lines(lines: list) -> list:
    cleaned = []
    for l in lines:
        qty  = _int(l.get("qty", 0))
        rate = _float(l.get("rate", 0))
        if not (l.get("product") or "").strip() or qty <= 0:
            continue
        cleaned.append({
            "sku":           (l.get("sku") or "").strip(),
            "barcode":       (l.get("barcode") or "").strip(),
            "product":       (l.get("product") or "").strip(),
            "available":     _float(l.get("available", 0)),
            "qty":           qty,
            "rate":          rate,
            "value":         round(qty * rate, 2),
            "ledgerName":    (l.get("ledgerName") or "").strip(),
            "subLedgerName": (l.get("subLedgerName") or "").strip(),
            "remarks":       (l.get("remarks") or "").strip(),
        })
    return cleaned


def _clean_challans(challans: list) -> list:
    return [{"challanNo": (c.get("challanNo") or "").strip(), "challanBarcode": (c.get("challanBarcode") or "").strip(), "challanDate": (c.get("challanDate") or "").strip()} for c in (challans or [])]


def _clean_packets(packets: list) -> list:
    return [{"packetNo": (p.get("packetNo") or "").strip(), "packetBarcode": (p.get("packetBarcode") or "").strip(), "date": (p.get("date") or "").strip()} for p in (packets or [])]


def sumQty(lines): return sum(_int(l.get("qty", 0)) for l in lines)
def sumVal(lines): return sum(_float(l.get("value", 0)) for l in lines)


# ─────────────────────────────────────────────────────────────────────────────
# Inventory helpers — store-aware AND tenant-aware get/set
# ─────────────────────────────────────────────────────────────────────────────

async def _get_stock_qty(barcode: str, store_id: Optional[str], tenant_id: str) -> float:
    """Read current stock for a barcode at a given location (None = central)."""
    if store_id:
        doc = await store_stock_collection.find_one({"barcode": barcode, "store_id": store_id, "tenant_id": tenant_id})
        return float(doc.get("stockQty", 0)) if doc else 0.0
    doc = await inventory_collection.find_one({"barcode": barcode, "tenant_id": tenant_id})
    return float(doc.get("stockQty", 0)) if doc else 0.0


async def _deduct_stock(barcode: str, store_id: Optional[str], qty: float, reason: str, tenant_id: str):
    """Remove qty from the SOURCE location. Raises if insufficient stock."""
    available = await _get_stock_qty(barcode, store_id, tenant_id)
    if qty > available:
        loc = f"store {store_id}" if store_id else "central inventory"
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient stock for '{barcode}' in {loc}. Available: {available}, requested: {qty}."
        )

    if store_id:
        await store_stock_collection.update_one(
            {"barcode": barcode, "store_id": store_id, "tenant_id": tenant_id},
            {"$inc": {"stockQty": -qty}, "$set": {"updatedAt": datetime.utcnow()}}
        )
    else:
        await inventory_collection.update_one(
            {"barcode": barcode, "tenant_id": tenant_id},
            {
                "$inc": {"stockQty": -qty},
                "$set": {"updatedAt": datetime.utcnow()},
                "$push": {"adjustments": {
                    "qty_change": -qty, "reason": reason,
                    "adjustedAt": datetime.utcnow().isoformat(), "source": "stock_transfer_dispatch",
                }},
            }
        )


async def _add_stock(barcode: str, store_id: Optional[str], qty: float, reason: str, tenant_id: str,
                      product_name: str = "", rate: float = 0.0, store_name: str = "", store_type: str = "store"):
    """Add qty to the DESTINATION location. Creates the record if missing."""
    if store_id:
        await store_stock_collection.update_one(
            {"barcode": barcode, "store_id": store_id, "tenant_id": tenant_id},
            {
                "$inc": {"stockQty": qty},
                "$set": {
                    "store_id": store_id, "store_name": store_name, "store_type": store_type,
                    "barcode": barcode, "updatedAt": datetime.utcnow(),
                },
                "$setOnInsert": {"createdAt": datetime.utcnow()},
            },
            upsert=True,
        )
    else:
        existing = await inventory_collection.find_one({"barcode": barcode, "tenant_id": tenant_id})
        if existing:
            await inventory_collection.update_one(
                {"barcode": barcode, "tenant_id": tenant_id},
                {
                    "$inc": {"stockQty": qty},
                    "$set": {"updatedAt": datetime.utcnow()},
                    "$push": {"adjustments": {
                        "qty_change": qty, "reason": reason,
                        "adjustedAt": datetime.utcnow().isoformat(), "source": "stock_transfer_receive",
                    }},
                }
            )
        else:
            await inventory_collection.insert_one({
                "barcode": barcode, "tenant_id": tenant_id, "stockQty": qty, "rate": rate, "description": product_name,
                "source": "stock_transfer_receive", "createdAt": datetime.utcnow(),
                "adjustments": [{
                    "qty_change": qty, "reason": reason,
                    "adjustedAt": datetime.utcnow().isoformat(), "source": "stock_transfer_receive",
                }],
            })


async def _resolve_store_name(store_id: Optional[str], tenant_id: str) -> dict:
    """Scoped to tenant so a store_id that happens to collide with another
    tenant's store can never be resolved/named cross-tenant."""
    if not store_id:
        return {"name": "Central Inventory", "type": "central"}
    try:
        s = await stores_collection.find_one({"_id": ObjectId(store_id), "tenant_id": tenant_id})
    except Exception:
        s = None
    if not s:
        return {"name": store_id, "type": "store"}
    return {"name": s.get("name", store_id), "type": s.get("type", "store")}


# ═══════════════════════════════════════════════════════════════════════════════
# GET /stock-transfers
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/")
async def get_all_transfers(
    type_filter:   Optional[str] = Query(None, alias="type"),
    search:        Optional[str] = Query(None),
    from_date:     Optional[str] = Query(None),
    to_date:       Optional[str] = Query(None),
    status:        Optional[str] = Query(None),
    from_store_id: Optional[str] = Query(None),
    to_store_id:   Optional[str] = Query(None),
    limit:         int           = Query(200, le=1000),
    authorization: Optional[str] = Header(None),
):
    store = await _require_tenant(authorization)
    query: dict = {"tenant_id": store["tenant_id"]}

    if type_filter and type_filter.lower() in ("out", "in"):
        query["type"] = "Out" if type_filter.lower() == "out" else "In"
    if status:
        query["status"] = {"$regex": status, "$options": "i"}
    if from_date or to_date:
        date_q: dict = {}
        if from_date: date_q["$gte"] = from_date
        if to_date:   date_q["$lte"] = to_date + " 99:99"
        query["date"] = date_q
    if from_store_id:
        query["from_store_id"] = from_store_id
    if to_store_id:
        query["to_store_id"] = to_store_id
    if search:
        s = search.strip()
        query["$or"] = [
            {"refNo":         {"$regex": s, "$options": "i"}},
            {"documentNo":    {"$regex": s, "$options": "i"}},
            {"invoiceNo":     {"$regex": s, "$options": "i"}},
            {"transporter":   {"$regex": s, "$options": "i"}},
            {"lines.product": {"$regex": s, "$options": "i"}},
            {"lines.barcode": {"$regex": s, "$options": "i"}},
            {"lines.sku":     {"$regex": s, "$options": "i"}},
        ]

    docs = []
    async for doc in stock_transfers_collection.find(query).sort("createdAt", -1).limit(limit):
        docs.append(serialize(doc))

    return JSONResponse({"status": "success", "count": len(docs), "data": docs})


@router.get("/transfer-outs")
async def get_transfer_outs(authorization: Optional[str] = Header(None)):
    store = await _require_tenant(authorization)
    docs = []
    async for doc in stock_transfers_collection.find({"type": "Out", "tenant_id": store["tenant_id"]}).sort("createdAt", -1):
        docs.append({
            "id":            str(doc["_id"]),
            "refNo":         doc.get("refNo", ""),
            "date":          doc.get("date", ""),
            "fromWh":        doc.get("fromWh", ""),
            "toWh":          doc.get("toWh", ""),
            "from_store_id": doc.get("from_store_id"),
            "to_store_id":   doc.get("to_store_id"),
            "status":        doc.get("status", "Dispatched"),
            "lines":         doc.get("lines", []),
            "totalQty":      sum(_int(l.get("qty", 0)) for l in doc.get("lines", [])),
            "totalVal":      sum(_float(l.get("value", 0)) for l in doc.get("lines", [])),
        })
    return JSONResponse({"status": "success", "data": docs})


# ─────────────────────────────────────────────────────────────────────────────
# GET /stock-transfers/pending/{location}
# Pending receipts for a destination — location = store_id, or "central"
# This drives the "Goods In Transit — Awaiting Receipt" panel
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/pending/{location}")
async def get_pending_receipts(location: str, authorization: Optional[str] = Header(None)):
    store = await _require_tenant(authorization)
    to_store_id = None if location == "central" else location
    query = {"type": "Out", "status": "Dispatched", "to_store_id": to_store_id, "tenant_id": store["tenant_id"]}

    docs = []
    async for doc in stock_transfers_collection.find(query).sort("createdAt", -1):
        docs.append({
            "id":          str(doc["_id"]),
            "refNo":       doc.get("refNo", ""),
            "date":        doc.get("date", ""),
            "fromWh":      doc.get("fromWh", ""),
            "toWh":        doc.get("toWh", ""),
            "from_store_id": doc.get("from_store_id"),
            "to_store_id":   doc.get("to_store_id"),
            "transporter": doc.get("transporter", ""),
            "lines":       doc.get("lines", []),
            "totalQty":    sumQty(doc.get("lines", [])),
            "totalVal":    sumVal(doc.get("lines", [])),
            "createdAt":   str(doc.get("createdAt", "")),
        })

    return JSONResponse({"status": "success", "count": len(docs), "data": docs})


@router.get("/{transfer_id}")
async def get_transfer(transfer_id: str, authorization: Optional[str] = Header(None)):
    store = await _require_tenant(authorization)
    try:    oid = ObjectId(transfer_id)
    except: raise HTTPException(status_code=400, detail="Invalid transfer ID")

    doc = await stock_transfers_collection.find_one({"_id": oid, "tenant_id": store["tenant_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Stock transfer not found")
    return JSONResponse({"status": "success", "data": serialize(doc)})


# ═══════════════════════════════════════════════════════════════════════════════
# POST /stock-transfers — Create a Transfer Out (DISPATCH)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/", status_code=201)
async def create_transfer_out(payload: dict, authorization: str = Header(None)):
    store = await _require_tenant(authorization)
    tenant_id = store["tenant_id"]
    now = datetime.utcnow()
    ref_no = payload.get("refNo") or await _generate_ref("Out", tenant_id)

    from_store_id: Optional[str] = payload.get("from_store_id") or None
    to_store_id: Optional[str] = payload.get("to_store_id") or None

    if to_store_id:
        try:
            destination = await stores_collection.find_one({
                "_id": ObjectId(to_store_id),
                "tenant_id": tenant_id,
                "active": True,
            })
        except Exception:
            destination = None

        if not destination:
            raise HTTPException(
                status_code=403,
                detail="The selected destination store does not belong to your tenant.",
            )

    if from_store_id == to_store_id:
        raise HTTPException(
            status_code=400,
            detail="Source and destination cannot be the same.",
        )

    invoice_no = (payload.get("invoiceNo") or "").strip()
    if not invoice_no:
        invoice_no = f"DSP-{now.strftime('%Y%m%d')}-{ref_no.split('/')[-1]}"

    lines = _clean_lines(payload.get("lines", []))
    if not lines:
        raise HTTPException(status_code=400, detail="At least one valid line is required.")

    from_info = await _resolve_store_name(from_store_id, tenant_id)
    to_info   = await _resolve_store_name(to_store_id, tenant_id)

    # ── Deduct from source NOW (goods physically leaving) ──────────────────────
    for line in lines:
        bc, qty = line["barcode"], line["qty"]
        if bc:
            await _deduct_stock(bc, from_store_id, qty,
                reason=f"Dispatched to {to_info['name']} (Ref: {ref_no})", tenant_id=tenant_id)

    doc = {
        "_id":               ObjectId(),
        "tenant_id":         tenant_id,
        "type":              "Out",
        "refNo":             ref_no,
        "date":              payload.get("date", now.strftime("%d-%m-%Y %H:%M")),
        "createdBy":         (payload.get("createdBy") or "Inventory").strip(),
        "from_store_id":     from_store_id,
        "to_store_id":       to_store_id,
        "ownerSite":         payload.get("ownerSite", from_info["name"]).strip(),
        "fromWh":            from_info["name"],
        "toWh":              to_info["name"],
        "invoiceNo":         invoice_no,
        "documentNo":        payload.get("documentNo", "").strip(),
        "documentDate":      payload.get("documentDate", "").strip(),
        "tradeGroup":        payload.get("tradeGroup", "").strip(),
        "transferLedger":    payload.get("transferLedger", "").strip(),
        "transferSubLedger": payload.get("transferSubLedger", "").strip(),
        "transitDays":       _int(payload.get("transitDays", 0)),
        "transporter":       payload.get("transporter", "").strip(),
        "agent":             payload.get("agent", "").strip(),
        "status":            "Dispatched",
        "customer":          payload.get("customer", "").strip(),
        "salesTerm":         payload.get("salesTerm", "").strip(),
        "transitInLedger":   payload.get("transitInLedger", "").strip(),
        "transitInSubLedger":payload.get("transitInSubLedger", "").strip(),
        "transitDueDate":    payload.get("transitDueDate", "").strip(),
        "creditDueDate":     payload.get("creditDueDate", "").strip(),
        "commissionRate":    payload.get("commissionRate", ""),
        "logisticsNo":       payload.get("logisticsNo", "").strip(),
        "declarationAmount": _float(payload.get("declarationAmount", 0)),
        "logisticsDate":     payload.get("logisticsDate", "").strip(),
        "remarks":           payload.get("remarks", "").strip(),
        "challans":          _clean_challans(payload.get("challans", [])),
        "lines":             lines,
        "totalQty":          sumQty(lines),
        "totalValue":        round(sumVal(lines), 2),
        "linked_transfer_id": None,
        "createdAt":         now,
        "updatedAt":         now,
    }

    await stock_transfers_collection.insert_one(doc)

    dest_label = "Central Inventory" if not to_store_id else to_info["name"]
    return JSONResponse({
        "status":  "success",
        "message": f"Dispatched {sumQty(lines)} unit(s) to {dest_label}. Awaiting receipt confirmation.",
        "data":    serialize(doc),
        "refNo":   ref_no,
    }, status_code=201)


# ═══════════════════════════════════════════════════════════════════════════════
# POST /stock-transfers/{id}/receive — RECEIVE
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/{transfer_id}/receive")
async def receive_transfer(
    transfer_id: str,
    payload: dict = {},
    authorization: str = Header(None),
    _perm=Depends(require_permission("stock_transfer")),
):
    """
    ⚠️ NOTE ON DUAL AUTH: this route (like the rest of this file) resolves
    its tenant/store context via get_store_context() (store_helper.py),
    which decodes the Bearer token manually rather than through FastAPI's
    OAuth2PasswordBearer flow. require_permission() above independently
    decodes the SAME token through deps.get_tenant()'s OAuth2 flow to check
    the permissions array. Both reads happen on every call to this route —
    redundant, but not incorrect, since both decode the identical JWT.
    Fixing the duplication properly means migrating this file from
    get_store_context to deps.get_tenant/get_store_tenant everywhere, which
    is a larger refactor than this one route needed. Flagging rather than
    silently doing that migration as a side effect here.

    The actual enforcement added: only an admin whose `permissions` array
    includes "stock_transfer" can confirm receipt — not just whoever
    happens to be assigned to the destination store. A Cashier-only store
    admin, for example, can no longer receive incoming stock transfers.
    """
    store     = await _require_tenant(authorization)
    tenant_id = store["tenant_id"]

    try:    oid = ObjectId(transfer_id)
    except: raise HTTPException(status_code=400, detail="Invalid transfer ID")

    out_doc = await stock_transfers_collection.find_one({"_id": oid, "tenant_id": tenant_id})
    if not out_doc:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if out_doc.get("type") != "Out":
        raise HTTPException(status_code=400, detail="Only a Transfer Out document can be received.")
    if out_doc.get("status") == "Received":
        raise HTTPException(status_code=400, detail="This transfer has already been received.")

    # ── Authorization: caller must be the destination (within the same tenant,
    # already guaranteed by the tenant-scoped find_one above) ──────────────────
    caller_store_id = store.get("store_id") or None   # None = HQ/central
    expected_to      = out_doc.get("to_store_id")
    if caller_store_id != expected_to:
        raise HTTPException(
            status_code=403,
            detail="Only the receiving store (or HQ, if destination is Central) can confirm receipt."
        )

    lines         = out_doc.get("lines", [])
    to_store_id   = out_doc.get("to_store_id")
    to_info       = await _resolve_store_name(to_store_id, tenant_id)
    now           = datetime.utcnow()

    received_overrides = {l.get("barcode"): _int(l.get("receivedQty", 0)) for l in payload.get("lines", [])} if payload.get("lines") else {}

    received_lines = []
    for line in lines:
        bc       = line["barcode"]
        dispatched_qty = line["qty"]
        recv_qty = received_overrides.get(bc, dispatched_qty) if received_overrides else dispatched_qty
        recv_qty = min(recv_qty, dispatched_qty)
        if recv_qty <= 0:
            continue

        await _add_stock(
            bc, to_store_id, recv_qty,
            reason=f"Received from {out_doc.get('fromWh','Central')} (Ref: {out_doc.get('refNo')})",
            tenant_id=tenant_id,
            product_name=line.get("product", ""), rate=line.get("rate", 0),
            store_name=to_info["name"], store_type=to_info["type"],
        )
        received_lines.append({**line, "qty": recv_qty, "value": round(recv_qty * line.get("rate", 0), 2)})

    if not received_lines:
        raise HTTPException(status_code=400, detail="No quantity to receive.")

    in_ref = await _generate_ref("In", tenant_id)
    in_doc = {
        "_id":               ObjectId(),
        "tenant_id":         tenant_id,
        "type":              "In",
        "refNo":             in_ref,
        "date":              now.strftime("%d-%m-%Y %H:%M"),
        "createdBy":         (payload.get("receivedBy") or "Store Admin").strip(),
        "from_store_id":     out_doc.get("from_store_id"),
        "to_store_id":       to_store_id,
        "ownerSite":         to_info["name"],
        "fromWh":            out_doc.get("fromWh", ""),
        "toWh":              to_info["name"],
        "selectedTransferOutId": oid,
        "linked_transfer_id":    oid,
        "documentNo":        out_doc.get("documentNo", ""),
        "documentDate":      out_doc.get("documentDate", ""),
        "gateEntryNo":       payload.get("gateEntryNo", "").strip() if payload.get("gateEntryNo") else "",
        "gateEntryDate":     now.strftime("%d-%m-%Y"),
        "logisticNo":        out_doc.get("logisticsNo", ""),
        "logisticDate":      out_doc.get("logisticsDate", ""),
        "gateEntryQty":      sumQty(received_lines),
        "logisticQty":       sumQty(received_lines),
        "declarationAmount": sumVal(received_lines),
        "status":            "Received",
        "outDocNo":          out_doc.get("refNo", ""),
        "outRemarks":        out_doc.get("remarks", ""),
        "lines":             received_lines,
        "totalQty":          sumQty(received_lines),
        "totalValue":        round(sumVal(received_lines), 2),
        "createdAt":         now,
        "updatedAt":         now,
    }
    await stock_transfers_collection.insert_one(in_doc)

    is_partial = sumQty(received_lines) < sumQty(lines)
    await stock_transfers_collection.update_one(
        {"_id": oid, "tenant_id": tenant_id},
        {"$set": {
            "status":             "Partially Received" if is_partial else "Received",
            "linked_transfer_id": in_doc["_id"],
            "updatedAt":          now,
        }}
    )

    updated_out = await stock_transfers_collection.find_one({"_id": oid, "tenant_id": tenant_id})
    return JSONResponse({
        "status":  "success",
        "message": f"Received {sumQty(received_lines)} unit(s). Stock added to {to_info['name']}.",
        "data":    {"out": serialize(updated_out), "in": serialize(in_doc)},
    })


# ═══════════════════════════════════════════════════════════════════════════════
# PUT /stock-transfers/{id} — edit a Dispatched (not yet received) Out doc
# ═══════════════════════════════════════════════════════════════════════════════

@router.put("/{transfer_id}")
async def update_transfer(transfer_id: str, payload: dict, authorization: Optional[str] = Header(None)):
    store     = await _require_tenant(authorization)
    tenant_id = store["tenant_id"]

    try:    oid = ObjectId(transfer_id)
    except: raise HTTPException(status_code=400, detail="Invalid transfer ID")

    existing = await stock_transfers_collection.find_one({"_id": oid, "tenant_id": tenant_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Stock transfer not found")
    if existing.get("type") != "Out":
        raise HTTPException(status_code=400, detail="Transfer In documents cannot be edited directly.")
    if existing.get("status") != "Dispatched":
        raise HTTPException(status_code=400, detail="Only Dispatched (not yet received) transfers can be edited.")

    now = datetime.utcnow()
    old_from = existing.get("from_store_id")
    old_to   = existing.get("to_store_id")
    old_lines = existing.get("lines", [])

    # Reverse old deduction from source
    for line in old_lines:
        bc, qty = line.get("barcode"), line.get("qty", 0)
        if bc and qty:
            await _add_stock(bc, old_from, qty, reason=f"Edit reversal — {existing.get('refNo')}", tenant_id=tenant_id)

    new_from = payload.get("from_store_id", old_from)
    new_to   = payload.get("to_store_id", old_to)
    new_lines = _clean_lines(payload.get("lines", old_lines))

    from_info = await _resolve_store_name(new_from, tenant_id)
    to_info   = await _resolve_store_name(new_to, tenant_id)

    # Apply new deduction
    for line in new_lines:
        bc, qty = line["barcode"], line["qty"]
        if bc:
            await _deduct_stock(bc, new_from, qty, reason=f"Re-dispatch — {existing.get('refNo')}", tenant_id=tenant_id)

    patch = {
        "from_store_id":  new_from,
        "to_store_id":    new_to,
        "fromWh":         from_info["name"],
        "toWh":            to_info["name"],
        "date":            payload.get("date", existing.get("date")),
        "createdBy":       payload.get("createdBy", existing.get("createdBy", "")),
        "invoiceNo":       payload.get("invoiceNo", existing.get("invoiceNo", "")),
        "documentNo":      payload.get("documentNo", existing.get("documentNo", "")),
        "documentDate":    payload.get("documentDate", existing.get("documentDate", "")),
        "tradeGroup":      payload.get("tradeGroup", existing.get("tradeGroup", "")),
        "transferLedger":  payload.get("transferLedger", existing.get("transferLedger", "")),
        "transitDays":     _int(payload.get("transitDays", existing.get("transitDays", 0))),
        "transporter":     payload.get("transporter", existing.get("transporter", "")),
        "agent":           payload.get("agent", existing.get("agent", "")),
        "remarks":         payload.get("remarks", existing.get("remarks", "")),
        "challans":        _clean_challans(payload.get("challans", existing.get("challans", []))),
        "lines":           new_lines,
        "totalQty":        sumQty(new_lines),
        "totalValue":      round(sumVal(new_lines), 2),
        "updatedAt":       now,
    }

    await stock_transfers_collection.update_one({"_id": oid, "tenant_id": tenant_id}, {"$set": patch})
    updated = await stock_transfers_collection.find_one({"_id": oid, "tenant_id": tenant_id})
    return JSONResponse({"status": "success", "message": "Transfer updated.", "data": serialize(updated)})


# ═══════════════════════════════════════════════════════════════════════════════
# DELETE /stock-transfers/{id} — cancel a Dispatched (not yet received) Out doc
# ═══════════════════════════════════════════════════════════════════════════════

@router.delete("/{transfer_id}")
async def delete_transfer(transfer_id: str, authorization: Optional[str] = Header(None)):
    store     = await _require_tenant(authorization)
    tenant_id = store["tenant_id"]

    try:    oid = ObjectId(transfer_id)
    except: raise HTTPException(status_code=400, detail="Invalid transfer ID")

    doc = await stock_transfers_collection.find_one({"_id": oid, "tenant_id": tenant_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Stock transfer not found")
    if doc.get("type") != "Out":
        raise HTTPException(status_code=400, detail="Only Transfer Out documents can be cancelled.")
    if doc.get("status") != "Dispatched":
        raise HTTPException(status_code=400, detail="Cannot cancel a transfer that has already been received.")

    from_store = doc.get("from_store_id")
    for line in doc.get("lines", []):
        bc, qty = line.get("barcode"), line.get("qty", 0)
        if bc and qty:
            await _add_stock(bc, from_store, qty, reason=f"Transfer cancelled — {doc.get('refNo')}", tenant_id=tenant_id)

    await stock_transfers_collection.delete_one({"_id": oid, "tenant_id": tenant_id})

    return JSONResponse({
        "status":  "success",
        "message": f"Transfer {doc.get('refNo', transfer_id)} cancelled. Stock returned to source.",
    })