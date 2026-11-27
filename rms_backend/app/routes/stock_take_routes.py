"""Stock Take (cycle count).

A session is scoped to one stock location (a store, or HQ's central
inventory when store_id is blank), optionally tagged to a division/section/
department just for the counter's own reference. Counting writes only to
stock_take_lines_collection -- nothing in inventory_collection/
store_stock_collection changes until "Post" is explicitly called, and even
then posting does not duplicate any inventory-mutation logic: it hands the
computed variances to the existing create_stock_adjustment() in
inventoryroutes.py, the exact same path a manual stock adjustment already
goes through, so it's fully visible in the existing Stock Adjustments
history with no parallel bookkeeping.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .deps import get_any_tenant
from .inventoryroutes import active_store_id, create_stock_adjustment
from ..db import (
    product_collection, inventory_collection, store_stock_collection,
    stock_take_sessions_collection, stock_take_lines_collection,
)

router = APIRouter(prefix="/stock-take", tags=["Stock Take"])

TenantCtx = Dict[str, Any]


def _serialize_session(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]), "store_id": doc.get("store_id") or "", "store_name": doc.get("store_name", ""),
        "division": doc.get("division", ""), "section": doc.get("section", ""), "department": doc.get("department", ""),
        "note": doc.get("note", ""), "status": doc.get("status", "open"),
        "created_by": doc.get("created_by", ""), "created_at": doc.get("created_at"),
        "posted_at": doc.get("posted_at"), "adjustment_id": doc.get("adjustment_id", ""),
        "line_count": doc.get("line_count", 0), "variance_count": doc.get("variance_count", 0),
    }


def _serialize_line(doc: dict) -> dict:
    system_qty = float(doc.get("system_qty", 0))
    counted_qty = float(doc.get("counted_qty", 0))
    return {
        "id": str(doc["_id"]), "barcode": doc.get("barcode", ""), "sku": doc.get("sku", ""),
        "product": doc.get("product", ""), "division": doc.get("division", ""), "section": doc.get("section", ""),
        "department": doc.get("department", ""), "system_qty": system_qty, "counted_qty": counted_qty,
        "variance": round(counted_qty - system_qty, 3), "counted_by": doc.get("counted_by", ""),
        "counted_at": doc.get("counted_at"),
    }


async def _get_session(ctx: TenantCtx, session_id: str) -> dict:
    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session ID.")
    doc = await stock_take_sessions_collection.find_one({"_id": oid, "tenant_id": ctx["tenant_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Stock take session not found.")
    own_store = active_store_id(ctx)
    if own_store and doc.get("store_id") != own_store:
        raise HTTPException(status_code=403, detail="This session belongs to another store.")
    return doc


async def _lookup_product(tenant_id: str, barcode: str) -> dict:
    """Light, per-scan product lookup -- deliberately NOT build_product_master()
    (that scans the whole tenant catalog; fine for a one-off report, far too
    slow called once per barcode scan on a large catalog)."""
    p = await product_collection.find_one({"barcode": barcode, "tenant_id": tenant_id})
    if p and not p.get("has_variants"):
        return {
            "sku": p.get("sku", ""), "product": p.get("product_name", ""),
            "division": p.get("division", ""), "section": p.get("section", ""), "department": p.get("department", ""),
        }
    p = await product_collection.find_one({"variants.barcode": barcode, "tenant_id": tenant_id})
    if p:
        for v in p.get("variants", []):
            if (v.get("barcode") or "").strip() == barcode:
                parts = [p.get("product_name", "")]
                if v.get("size_label"): parts.append(v["size_label"])
                if v.get("color"): parts.append(v["color"])
                return {
                    "sku": v.get("sku", ""), "product": " | ".join(filter(None, parts)),
                    "division": p.get("division", ""), "section": p.get("section", ""), "department": p.get("department", ""),
                }
    return {}


async def _system_qty(tenant_id: str, store_id: Optional[str], barcode: str) -> float:
    if store_id:
        doc = await store_stock_collection.find_one({"barcode": barcode, "store_id": store_id, "tenant_id": tenant_id}, {"stockQty": 1})
    else:
        doc = await inventory_collection.find_one({"barcode": barcode, "tenant_id": tenant_id}, {"stockQty": 1})
    return float((doc or {}).get("stockQty") or 0)


class SessionCreate(BaseModel):
    division: Optional[str] = ""
    section: Optional[str] = ""
    department: Optional[str] = ""
    note: Optional[str] = ""


@router.post("/sessions", status_code=201)
async def start_session(payload: SessionCreate, ctx: TenantCtx = Depends(get_any_tenant)):
    # Deliberately always the CALLER's own location (their store, or HQ's
    # central inventory if HQ-scoped) -- never an arbitrary store_id picked
    # from a payload. create_stock_adjustment() (reused at /post below)
    # resolves which stock collection to touch the exact same way, from
    # ctx alone; letting a session claim a different store here than the
    # one posting will actually touch would silently adjust the wrong
    # location's stock.
    store_id = active_store_id(ctx)

    existing_open = await stock_take_sessions_collection.find_one({
        "tenant_id": ctx["tenant_id"], "store_id": store_id, "status": "open",
        "division": payload.division or "", "section": payload.section or "", "department": payload.department or "",
    })
    if existing_open:
        raise HTTPException(
            status_code=409,
            detail=f"An open stock take already exists for this scope (started by {existing_open.get('created_by', 'someone')}). Post or cancel it first.",
        )

    doc = {
        "tenant_id": ctx["tenant_id"], "store_id": store_id, "store_name": ctx.get("store_name", "") if store_id else "",
        "division": payload.division or "", "section": payload.section or "", "department": payload.department or "",
        "note": (payload.note or "").strip(), "status": "open",
        "created_by": ctx.get("admin_name", ""), "created_at": datetime.utcnow(),
        "line_count": 0, "variance_count": 0,
    }
    result = await stock_take_sessions_collection.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize_session(doc)


@router.get("/sessions")
async def list_sessions(ctx: TenantCtx = Depends(get_any_tenant)):
    query: dict = {"tenant_id": ctx["tenant_id"]}
    own_store = active_store_id(ctx)
    if own_store:
        query["store_id"] = own_store
    rows = []
    async for doc in stock_take_sessions_collection.find(query).sort("created_at", -1).limit(100):
        rows.append(_serialize_session(doc))
    return {"data": rows}


@router.get("/sessions/{session_id}")
async def get_session(session_id: str, ctx: TenantCtx = Depends(get_any_tenant)):
    session = await _get_session(ctx, session_id)
    lines = []
    async for doc in stock_take_lines_collection.find({"session_id": str(session["_id"])}).sort("counted_at", -1):
        lines.append(_serialize_line(doc))
    return {"session": _serialize_session(session), "lines": lines}


class ScanPayload(BaseModel):
    barcode: str = Field(min_length=1)
    qty: float = 1.0  # how many units this scan represents -- usually 1 per physical scan


@router.post("/sessions/{session_id}/scan")
async def scan_item(session_id: str, payload: ScanPayload, ctx: TenantCtx = Depends(get_any_tenant)):
    session = await _get_session(ctx, session_id)
    if session.get("status") != "open":
        raise HTTPException(status_code=409, detail="This session is no longer open.")

    barcode = payload.barcode.strip()
    if not barcode:
        raise HTTPException(status_code=400, detail="Barcode is required.")

    existing = await stock_take_lines_collection.find_one({"session_id": session_id, "barcode": barcode})
    if existing:
        new_counted = float(existing.get("counted_qty", 0)) + payload.qty
        await stock_take_lines_collection.update_one(
            {"_id": existing["_id"]},
            {"$set": {"counted_qty": new_counted, "counted_by": ctx.get("admin_name", ""), "counted_at": datetime.utcnow()}},
        )
        existing["counted_qty"] = new_counted
        return _serialize_line(existing)

    info = await _lookup_product(ctx["tenant_id"], barcode)
    system_qty = await _system_qty(ctx["tenant_id"], session.get("store_id"), barcode)
    doc = {
        "session_id": session_id, "tenant_id": ctx["tenant_id"], "barcode": barcode,
        "sku": info.get("sku", ""), "product": info.get("product", "") or barcode,
        "division": info.get("division", ""), "section": info.get("section", ""), "department": info.get("department", ""),
        "system_qty": system_qty, "counted_qty": payload.qty,
        "counted_by": ctx.get("admin_name", ""), "counted_at": datetime.utcnow(),
        "unlisted": not bool(info),
    }
    result = await stock_take_lines_collection.insert_one(doc)
    doc["_id"] = result.inserted_id
    await stock_take_sessions_collection.update_one({"_id": session["_id"]}, {"$inc": {"line_count": 1}})
    return _serialize_line(doc)


class LineUpdate(BaseModel):
    counted_qty: float


@router.patch("/sessions/{session_id}/lines/{line_id}")
async def update_line(session_id: str, line_id: str, payload: LineUpdate, ctx: TenantCtx = Depends(get_any_tenant)):
    session = await _get_session(ctx, session_id)
    if session.get("status") != "open":
        raise HTTPException(status_code=409, detail="This session is no longer open.")
    try:
        oid = ObjectId(line_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid line ID.")
    result = await stock_take_lines_collection.update_one(
        {"_id": oid, "session_id": session_id},
        {"$set": {"counted_qty": payload.counted_qty, "counted_by": ctx.get("admin_name", ""), "counted_at": datetime.utcnow()}},
    )
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Line not found in this session.")
    doc = await stock_take_lines_collection.find_one({"_id": oid})
    return _serialize_line(doc)


@router.delete("/sessions/{session_id}/lines/{line_id}")
async def delete_line(session_id: str, line_id: str, ctx: TenantCtx = Depends(get_any_tenant)):
    session = await _get_session(ctx, session_id)
    if session.get("status") != "open":
        raise HTTPException(status_code=409, detail="This session is no longer open.")
    try:
        oid = ObjectId(line_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid line ID.")
    result = await stock_take_lines_collection.delete_one({"_id": oid, "session_id": session_id})
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="Line not found in this session.")
    await stock_take_sessions_collection.update_one({"_id": session["_id"]}, {"$inc": {"line_count": -1}})
    return {"message": "Line removed."}


@router.post("/sessions/{session_id}/post")
async def post_session(session_id: str, ctx: TenantCtx = Depends(get_any_tenant)):
    session = await _get_session(ctx, session_id)
    if session.get("status") != "open":
        raise HTTPException(status_code=409, detail="This session has already been posted or cancelled.")

    lines = [doc async for doc in stock_take_lines_collection.find({"session_id": session_id})]
    variance_lines = [l for l in lines if abs(float(l.get("counted_qty", 0)) - float(l.get("system_qty", 0))) > 0.0001]

    adjustment_id = ""
    if variance_lines:
        adj_payload = {
            "warehouse": session.get("store_name", "") if not session.get("store_id") else "",
            "ref_no": f"STOCKTAKE-{session_id}",
            "created_by": ctx.get("admin_name", "Stock Take"),
            "note": f"Posted from Stock Take session {session_id}" + (f" ({session.get('note')})" if session.get("note") else ""),
            "lines": [
                {
                    "barcode": l["barcode"], "sku": l.get("sku", ""), "product": l.get("product", ""),
                    "division": l.get("division", ""), "section": l.get("section", ""), "department": l.get("department", ""),
                    "qty_change": round(float(l.get("counted_qty", 0)) - float(l.get("system_qty", 0)), 3),
                    "reason": "Physical count correction",
                    "remarks": f"Stock take: system {l.get('system_qty', 0)} -> counted {l.get('counted_qty', 0)}",
                }
                for l in variance_lines
            ],
        }
        result = await create_stock_adjustment(adj_payload, ctx)
        adjustment_id = result.get("id", "")

    await stock_take_sessions_collection.update_one(
        {"_id": session["_id"]},
        {"$set": {
            "status": "posted", "posted_at": datetime.utcnow(), "adjustment_id": adjustment_id,
            "variance_count": len(variance_lines),
        }},
    )
    return {"message": "Stock take posted.", "variance_count": len(variance_lines), "adjustment_id": adjustment_id}


@router.post("/sessions/{session_id}/cancel")
async def cancel_session(session_id: str, ctx: TenantCtx = Depends(get_any_tenant)):
    session = await _get_session(ctx, session_id)
    if session.get("status") != "open":
        raise HTTPException(status_code=409, detail="Only an open session can be cancelled.")
    await stock_take_sessions_collection.update_one({"_id": session["_id"]}, {"$set": {"status": "cancelled"}})
    return {"message": "Stock take cancelled."}
