"""Visual Merchandising — Phase 1.

HQ plans product placement at a store (floor/zone/rack/shelf — free-text
location fields rather than a separately managed hierarchy, kept simple on
purpose for this phase) inside a named "layout", publishes it to one or more
stores, and each store executes the work and uploads a before/after photo as
proof. HQ then approves/rejects and gets a compliance view across stores.

Workflow:
    HQ creates a layout (DRAFT)
    -> adds placements (product + location + instruction + optional reference photo)
    -> publishes to store(s) -> one task per (store x placement), status PENDING
    -> store marks a task done + uploads a photo -> status DONE
    -> HQ/supervisor approves or rejects -> APPROVED | back to PENDING with a reason
    -> GET /compliance rolls this up per store

Deliberately NOT in Phase 1 (needs hardware/data RMS doesn't collect yet):
footfall heatmaps, sensor-based traffic, predictive placement — see
GET /suggestions below for the data-backed (not sensor-based) version that
IS in scope: cross-referencing the existing Demand Forecast trend data.

Gated by the "Visual Merchandising" department (require_department), the
same managedDepartments pattern every other department uses — not a new
access-control mechanism.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

import cloudinary
import cloudinary.uploader
from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel

from ..config import settings
from ..db import (
    admins_collection, product_collection, stores_collection, vm_layouts_collection,
    vm_placements_collection, vm_staff_assignments_collection, vm_tasks_collection,
    vm_zone_traffic_collection,
)
from .customer_crm_routes import clean, now_utc, serialize_doc
from .deps import get_tenant, require_department

cloudinary.config(cloud_name=settings.cloudinary_cloud_name, api_key=settings.cloudinary_api_key, api_secret=settings.cloudinary_api_secret, secure=True)

router = APIRouter(prefix="/api/visual-merchandising", tags=["Visual Merchandising"])

TenantCtx = Dict[str, Any]


def _require_hq(ctx: TenantCtx) -> TenantCtx:
    if ctx.get("scope") != "hq":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only HQ can do this.")
    return ctx


async def _own_store_ids(tenant_id: str) -> List[dict]:
    """Flattened {id, name} for every store + branch — same shape as the
    Customer CRM QR-store picker, reused here for the publish-to-stores list."""
    out = []
    async for s in stores_collection.find({"tenant_id": tenant_id}):
        out.append({"id": str(s["_id"]), "name": s.get("name", ""), "type": s.get("type", "store"), "parent_id": s.get("parent_id")})
    return out


# ─────────────────────────────────────────────
# LAYOUTS
# ─────────────────────────────────────────────

class LayoutCreate(BaseModel):
    name: str
    notes: str = ""


@router.get("/layouts")
async def list_layouts(ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    """HQ sees every layout it created. A store only sees layouts that have
    at least one task assigned to it (i.e. were actually published to it) —
    a DRAFT layout HQ hasn't published yet is invisible to stores."""
    tenant_id = ctx["tenant_id"]
    if ctx.get("scope") == "hq":
        rows = await vm_layouts_collection.find({"tenant_id": tenant_id}).sort("created_at", -1).to_list(200)
    else:
        store_id = ctx.get("store_id")
        layout_ids = await vm_tasks_collection.distinct("layout_id", {"tenant_id": tenant_id, "store_id": store_id})
        rows = await vm_layouts_collection.find({"tenant_id": tenant_id, "_id": {"$in": [ObjectId(i) for i in layout_ids if ObjectId.is_valid(i)]}}).sort("created_at", -1).to_list(200)
    return [serialize_doc(r) for r in rows]


@router.post("/layouts", status_code=status.HTTP_201_CREATED)
async def create_layout(payload: LayoutCreate, ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    ctx = _require_hq(ctx)
    name = clean(payload.name)
    if not name:
        raise HTTPException(status_code=400, detail="Layout name is required.")
    now = now_utc()
    doc = {
        "tenant_id": ctx["tenant_id"], "name": name, "notes": clean(payload.notes),
        "status": "DRAFT", "created_by": ctx.get("admin_id"), "created_by_name": ctx.get("admin_name"),
        "created_at": now, "updated_at": now, "published_at": None,
    }
    result = await vm_layouts_collection.insert_one(doc)
    return serialize_doc(await vm_layouts_collection.find_one({"_id": result.inserted_id}))


@router.delete("/layouts/{layout_id}")
async def delete_layout(layout_id: str, ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    ctx = _require_hq(ctx)
    if not ObjectId.is_valid(layout_id):
        raise HTTPException(status_code=400, detail="Invalid layout ID.")
    layout = await vm_layouts_collection.find_one({"_id": ObjectId(layout_id), "tenant_id": ctx["tenant_id"]})
    if not layout:
        raise HTTPException(status_code=404, detail="Layout not found.")
    if layout.get("status") == "PUBLISHED":
        raise HTTPException(status_code=409, detail="This layout has already been published — it stays on record for the task/compliance history it created.")
    await vm_placements_collection.delete_many({"tenant_id": ctx["tenant_id"], "layout_id": layout_id})
    await vm_layouts_collection.delete_one({"_id": layout["_id"]})
    return {"message": "Draft layout removed."}


# ─────────────────────────────────────────────
# PLACEMENTS — line items within a still-DRAFT layout
# ─────────────────────────────────────────────

class PlacementCreate(BaseModel):
    barcode: str = ""
    product_name: str = ""
    sku: str = ""
    floor: str = ""
    zone: str = ""
    rack: str = ""
    shelf: str = ""
    instruction: str = ""
    reference_image_url: str = ""


@router.get("/layouts/{layout_id}/placements")
async def list_placements(layout_id: str, ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    if not ObjectId.is_valid(layout_id):
        raise HTTPException(status_code=400, detail="Invalid layout ID.")
    rows = await vm_placements_collection.find({"tenant_id": ctx["tenant_id"], "layout_id": layout_id}).sort("created_at", 1).to_list(1000)
    return [serialize_doc(r) for r in rows]


@router.post("/layouts/{layout_id}/placements", status_code=status.HTTP_201_CREATED)
async def add_placement(layout_id: str, payload: PlacementCreate, ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    ctx = _require_hq(ctx)
    if not ObjectId.is_valid(layout_id):
        raise HTTPException(status_code=400, detail="Invalid layout ID.")
    layout = await vm_layouts_collection.find_one({"_id": ObjectId(layout_id), "tenant_id": ctx["tenant_id"]})
    if not layout:
        raise HTTPException(status_code=404, detail="Layout not found.")
    if layout.get("status") != "DRAFT":
        raise HTTPException(status_code=409, detail="Placements can only be added while the layout is still a draft — this one has already been published.")
    product_name = clean(payload.product_name)
    location_bits = [clean(payload.floor), clean(payload.zone), clean(payload.rack), clean(payload.shelf)]
    if not product_name and not clean(payload.barcode):
        raise HTTPException(status_code=400, detail="Give either a product name or a barcode.")
    if not any(location_bits):
        raise HTTPException(status_code=400, detail="At least one location field (floor/zone/rack/shelf) is required.")

    barcode = clean(payload.barcode)
    sku = clean(payload.sku)
    if barcode and not product_name:
        product = await product_collection.find_one({"tenant_id": ctx["tenant_id"], "barcode": barcode}, {"product_name": 1, "sku": 1})
        if product:
            product_name = product.get("product_name") or product_name
            sku = sku or product.get("sku", "")

    now = now_utc()
    doc = {
        "tenant_id": ctx["tenant_id"], "layout_id": layout_id,
        "barcode": barcode, "product_name": product_name, "sku": sku,
        "floor": clean(payload.floor), "zone": clean(payload.zone), "rack": clean(payload.rack), "shelf": clean(payload.shelf),
        "instruction": clean(payload.instruction), "reference_image_url": clean(payload.reference_image_url),
        "created_by": ctx.get("admin_id"), "created_at": now,
    }
    result = await vm_placements_collection.insert_one(doc)
    return serialize_doc(await vm_placements_collection.find_one({"_id": result.inserted_id}))


@router.delete("/placements/{placement_id}")
async def delete_placement(placement_id: str, ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    ctx = _require_hq(ctx)
    if not ObjectId.is_valid(placement_id):
        raise HTTPException(status_code=400, detail="Invalid placement ID.")
    placement = await vm_placements_collection.find_one({"_id": ObjectId(placement_id), "tenant_id": ctx["tenant_id"]})
    if not placement:
        raise HTTPException(status_code=404, detail="Placement not found.")
    layout = await vm_layouts_collection.find_one({"_id": ObjectId(placement["layout_id"]), "tenant_id": ctx["tenant_id"]})
    if layout and layout.get("status") != "DRAFT":
        raise HTTPException(status_code=409, detail="This layout has already been published — placements are locked.")
    await vm_placements_collection.delete_one({"_id": placement["_id"]})
    return {"message": "Placement removed."}


@router.post("/placements/{placement_id}/reference-image")
async def upload_reference_image(placement_id: str, file: UploadFile = File(...), ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    ctx = _require_hq(ctx)
    if not ObjectId.is_valid(placement_id):
        raise HTTPException(status_code=400, detail="Invalid placement ID.")
    placement = await vm_placements_collection.find_one({"_id": ObjectId(placement_id), "tenant_id": ctx["tenant_id"]})
    if not placement:
        raise HTTPException(status_code=404, detail="Placement not found.")
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="The selected file is empty.")
    if len(raw) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image must be under 15 MB.")
    try:
        result = cloudinary.uploader.upload(raw, folder=f"rms/vm-reference/{ctx['tenant_id']}", resource_type="image")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not upload image: {exc}")
    url = result.get("secure_url") or result.get("url")
    await vm_placements_collection.update_one({"_id": placement["_id"]}, {"$set": {"reference_image_url": url}})
    return {"message": "Reference image saved.", "reference_image_url": url}


# ─────────────────────────────────────────────
# PUBLISH — turns every placement into one task per chosen store
# ─────────────────────────────────────────────

class PublishPayload(BaseModel):
    store_ids: List[str] = []  # empty = every store


@router.post("/layouts/{layout_id}/publish")
async def publish_layout(layout_id: str, payload: PublishPayload, ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    ctx = _require_hq(ctx)
    if not ObjectId.is_valid(layout_id):
        raise HTTPException(status_code=400, detail="Invalid layout ID.")
    layout = await vm_layouts_collection.find_one({"_id": ObjectId(layout_id), "tenant_id": ctx["tenant_id"]})
    if not layout:
        raise HTTPException(status_code=404, detail="Layout not found.")
    if layout.get("status") != "DRAFT":
        raise HTTPException(status_code=409, detail="This layout has already been published.")
    placements = await vm_placements_collection.find({"tenant_id": ctx["tenant_id"], "layout_id": layout_id}).to_list(1000)
    if not placements:
        raise HTTPException(status_code=400, detail="Add at least one placement before publishing.")

    all_stores = await _own_store_ids(ctx["tenant_id"])
    chosen_ids = {clean(s) for s in payload.store_ids if clean(s)}
    target_stores = [s for s in all_stores if not chosen_ids or s["id"] in chosen_ids]
    if not target_stores:
        raise HTTPException(status_code=400, detail="No matching store(s) to publish to.")

    now = now_utc()
    task_docs = []
    for store in target_stores:
        for p in placements:
            task_docs.append({
                "tenant_id": ctx["tenant_id"], "layout_id": layout_id, "layout_name": layout.get("name"),
                "placement_id": str(p["_id"]),
                "store_id": store["id"], "store_name": store["name"],
                "barcode": p.get("barcode", ""), "product_name": p.get("product_name", ""), "sku": p.get("sku", ""),
                "floor": p.get("floor", ""), "zone": p.get("zone", ""), "rack": p.get("rack", ""), "shelf": p.get("shelf", ""),
                "instruction": p.get("instruction", ""), "reference_image_url": p.get("reference_image_url", ""),
                "status": "PENDING", "done_photo_url": "", "done_by": None, "done_by_name": "", "done_at": None,
                "approved_by": None, "approved_by_name": "", "approved_at": None, "rejection_reason": "",
                "created_at": now, "updated_at": now,
            })
    if task_docs:
        await vm_tasks_collection.insert_many(task_docs)
    await vm_layouts_collection.update_one({"_id": layout["_id"]}, {"$set": {"status": "PUBLISHED", "published_at": now, "updated_at": now}})
    return {"message": f"Published to {len(target_stores)} store(s) — {len(task_docs)} task(s) created.", "task_count": len(task_docs), "store_count": len(target_stores)}


# ─────────────────────────────────────────────
# TASKS — store execution + HQ/supervisor approval
# ─────────────────────────────────────────────

@router.get("/tasks")
async def list_tasks(
    layout_id: Optional[str] = Query(None),
    store_id: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    ctx: TenantCtx = Depends(require_department("Visual Merchandising")),
):
    query: Dict[str, Any] = {"tenant_id": ctx["tenant_id"]}
    if ctx.get("scope") in ("store", "branch"):
        if not ctx.get("store_id"):
            raise HTTPException(status_code=403, detail="No store context found for this login.")
        query["store_id"] = ctx["store_id"]
    elif store_id:
        query["store_id"] = store_id
    if layout_id:
        query["layout_id"] = layout_id
    if status_filter:
        query["status"] = status_filter.upper()
    rows = await vm_tasks_collection.find(query).sort("created_at", -1).to_list(2000)
    return [serialize_doc(r) for r in rows]


@router.post("/tasks/{task_id}/complete")
async def complete_task(task_id: str, file: UploadFile = File(...), ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    """Store marks a task done and uploads the proof photo in one step —
    there's no meaningful "done, photo later" state since the photo IS the
    evidence a supervisor approves against."""
    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID.")
    query: Dict[str, Any] = {"_id": ObjectId(task_id), "tenant_id": ctx["tenant_id"]}
    if ctx.get("scope") in ("store", "branch"):
        query["store_id"] = ctx.get("store_id")
    task = await vm_tasks_collection.find_one(query)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found, or belongs to another store.")
    if task.get("status") == "APPROVED":
        raise HTTPException(status_code=409, detail="This task is already approved.")
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="The selected photo is empty.")
    if len(raw) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Photo must be under 15 MB.")
    try:
        result = cloudinary.uploader.upload(raw, folder=f"rms/vm-proof/{ctx['tenant_id']}", resource_type="image")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not upload photo: {exc}")
    url = result.get("secure_url") or result.get("url")
    now = now_utc()
    await vm_tasks_collection.update_one({"_id": task["_id"]}, {"$set": {
        "status": "DONE", "done_photo_url": url, "done_by": ctx.get("admin_id"),
        "done_by_name": ctx.get("admin_name") or "", "done_at": now, "updated_at": now,
        "rejection_reason": "",
    }})
    return {"message": "Marked done — pending approval.", "done_photo_url": url}


class ApprovalPayload(BaseModel):
    approved: bool
    rejection_reason: str = ""


@router.post("/tasks/{task_id}/approve")
async def approve_task(task_id: str, payload: ApprovalPayload, ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    ctx = _require_hq(ctx)
    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID.")
    task = await vm_tasks_collection.find_one({"_id": ObjectId(task_id), "tenant_id": ctx["tenant_id"]})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    if task.get("status") != "DONE":
        raise HTTPException(status_code=409, detail="Only a task marked done by the store can be approved or rejected.")
    now = now_utc()
    if payload.approved:
        await vm_tasks_collection.update_one({"_id": task["_id"]}, {"$set": {
            "status": "APPROVED", "approved_by": ctx.get("admin_id"), "approved_by_name": ctx.get("admin_name") or "",
            "approved_at": now, "updated_at": now,
        }})
        return {"message": "Approved."}
    reason = clean(payload.rejection_reason)
    if not reason:
        raise HTTPException(status_code=400, detail="A reason is required to reject.")
    await vm_tasks_collection.update_one({"_id": task["_id"]}, {"$set": {
        "status": "PENDING", "rejection_reason": reason, "done_photo_url": "", "done_by": None, "done_by_name": "", "done_at": None,
        "updated_at": now,
    }})
    return {"message": "Rejected — sent back to the store to redo, with your reason attached."}


# ─────────────────────────────────────────────
# COMPLIANCE — per-store rollup
# ─────────────────────────────────────────────

@router.get("/compliance")
async def compliance_summary(layout_id: Optional[str] = Query(None), ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    ctx = _require_hq(ctx)
    query: Dict[str, Any] = {"tenant_id": ctx["tenant_id"]}
    if layout_id:
        query["layout_id"] = layout_id
    tasks = await vm_tasks_collection.find(query).to_list(5000)
    by_store: Dict[str, dict] = {}
    for t in tasks:
        row = by_store.setdefault(t["store_id"], {"store_id": t["store_id"], "store_name": t.get("store_name", ""), "total": 0, "approved": 0, "done": 0, "pending": 0})
        row["total"] += 1
        if t["status"] == "APPROVED":
            row["approved"] += 1
        elif t["status"] == "DONE":
            row["done"] += 1
        else:
            row["pending"] += 1
    rows = list(by_store.values())
    for row in rows:
        row["compliance_pct"] = round((row["approved"] / row["total"]) * 100, 1) if row["total"] else 0.0
    rows.sort(key=lambda r: r["compliance_pct"], reverse=True)
    return rows


# ─────────────────────────────────────────────
# SUGGESTIONS — data-backed (Demand Forecast), not sensor-based. Flags
# rising-trend items with no active placement, and falling-trend items that
# DO have one (candidates to move to a clearance zone instead).
# "Active" = any task not yet rejected-back-to-pending for that barcode.
# ─────────────────────────────────────────────

@router.get("/suggestions")
async def placement_suggestions(store_id: Optional[str] = Query(None), limit: int = Query(15, ge=1, le=50), ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    ctx = _require_hq(ctx)
    # Local import: avoids a module-load-order cycle (forecast_analytics_routes
    # does not import vm_routes, so this is one-directional and safe — same
    # cross-module reuse pattern already used for Citimart's location helpers).
    from .forecast_analytics_routes import _compute_demand_forecast

    tenant_id = ctx["tenant_id"]
    forecast_rows = await _compute_demand_forecast(tenant_id, clean(store_id) or None, lookback_days=90, limit=200)

    active_barcodes = set(await vm_tasks_collection.distinct("barcode", {"tenant_id": tenant_id, "barcode": {"$ne": ""}}))

    rising_unplaced = [r for r in forecast_rows if r.get("trend") == "rising" and r.get("barcode") and r["barcode"] not in active_barcodes]
    falling_placed = [r for r in forecast_rows if r.get("trend") == "falling" and r.get("barcode") and r["barcode"] in active_barcodes]

    def _shape(r: dict, reason: str) -> dict:
        return {
            "barcode": r.get("barcode", ""), "name": r.get("name", ""), "sku": r.get("sku", ""),
            "avg_weekly_qty": r.get("avg_weekly_qty", 0), "trend": r.get("trend", ""), "reason": reason,
        }

    return {
        "rising_without_placement": [_shape(r, "Rising demand, no active placement — consider a high-visibility spot (entrance, eye level).") for r in rising_unplaced[:limit]],
        "falling_with_placement": [_shape(r, "Falling demand but currently placed — consider moving to a clearance/value zone.") for r in falling_placed[:limit]],
        "note": "Based on real sales trend from Demand Forecast (last 90 days) — not sensor/footfall data, which RMS doesn't collect yet.",
    }


# ═══════════════════════════════════════════════════════════════════════════
# PHASE 2 — Staff / supervisor assignment by floor or zone
# ═══════════════════════════════════════════════════════════════════════════

class StaffAssignmentCreate(BaseModel):
    store_id: str
    admin_id: str
    floor: str = ""
    zone: str = ""
    notes: str = ""


@router.get("/staff-assignments")
async def list_staff_assignments(store_id: Optional[str] = Query(None), ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    query: Dict[str, Any] = {"tenant_id": ctx["tenant_id"]}
    if ctx.get("scope") in ("store", "branch"):
        if not ctx.get("store_id"):
            raise HTTPException(status_code=403, detail="No store context found for this login.")
        query["store_id"] = ctx["store_id"]
    elif store_id:
        query["store_id"] = store_id
    rows = await vm_staff_assignments_collection.find(query).sort("created_at", -1).to_list(500)
    return [serialize_doc(r) for r in rows]


@router.post("/staff-assignments", status_code=status.HTTP_201_CREATED)
async def create_staff_assignment(payload: StaffAssignmentCreate, ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    """HQ assigns one of that store's own admins as the person covering a
    floor/zone — purely an org-chart record for now (who to go to if a zone
    needs attention); it doesn't gate who can complete a VM task, since any
    staff with Visual Merchandising access at that store can already do
    that. Keeping it a plain assignment log, not a new permission layer,
    avoids duplicating access control that already exists."""
    ctx = _require_hq(ctx)
    store_id = clean(payload.store_id)
    if not store_id:
        raise HTTPException(status_code=400, detail="Choose a store.")
    if not ObjectId.is_valid(payload.admin_id):
        raise HTTPException(status_code=400, detail="Invalid admin ID.")
    admin = await admins_collection.find_one({"_id": ObjectId(payload.admin_id), "tenant_id": ctx["tenant_id"], "scope": "store", "store_id": store_id})
    if not admin:
        raise HTTPException(status_code=404, detail="That admin wasn't found at this store.")
    if not clean(payload.floor) and not clean(payload.zone):
        raise HTTPException(status_code=400, detail="At least a floor or a zone is required.")
    now = now_utc()
    doc = {
        "tenant_id": ctx["tenant_id"], "store_id": store_id, "store_name": admin.get("store_name", ""),
        "admin_id": payload.admin_id, "admin_name": admin.get("name", ""),
        "floor": clean(payload.floor), "zone": clean(payload.zone), "notes": clean(payload.notes),
        "assigned_by": ctx.get("admin_id"), "assigned_by_name": ctx.get("admin_name") or "",
        "created_at": now,
    }
    result = await vm_staff_assignments_collection.insert_one(doc)
    return serialize_doc(await vm_staff_assignments_collection.find_one({"_id": result.inserted_id}))


@router.delete("/staff-assignments/{assignment_id}")
async def delete_staff_assignment(assignment_id: str, ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    ctx = _require_hq(ctx)
    if not ObjectId.is_valid(assignment_id):
        raise HTTPException(status_code=400, detail="Invalid assignment ID.")
    result = await vm_staff_assignments_collection.delete_one({"_id": ObjectId(assignment_id), "tenant_id": ctx["tenant_id"]})
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="Assignment not found.")
    return {"message": "Assignment removed."}


# ═══════════════════════════════════════════════════════════════════════════
# PHASE 3 SCAFFOLD — zone traffic / heatmap shell.
#
# No sensor, camera or footfall-counting hardware is integrated anywhere in
# RMS today, so this intentionally reports every zone as "no data yet"
# rather than inventing numbers. The collection and endpoint exist so a real
# integration later only has to START WRITING rows to
# vm_zone_traffic_collection (shape: tenant_id, store_id, floor, zone, date,
# visitor_count, source) — nothing else in this file would need to change,
# and the UI already renders whatever comes back here.
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/zone-traffic")
async def zone_traffic(store_id: Optional[str] = Query(None), ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    tenant_id = ctx["tenant_id"]
    sid = clean(store_id)
    if ctx.get("scope") in ("store", "branch"):
        sid = ctx.get("store_id") or sid
        if not sid:
            raise HTTPException(status_code=403, detail="No store context found for this login.")

    # Zones worth showing come from real placements/tasks already in the
    # system (every floor/zone combination that's actually been used) —
    # not invented, so the shell has something real to label even with zero
    # traffic data behind it yet.
    task_query: Dict[str, Any] = {"tenant_id": tenant_id, "zone": {"$ne": ""}}
    if sid:
        task_query["store_id"] = sid
    zone_pairs = set()
    async for t in vm_tasks_collection.find(task_query, {"store_id": 1, "store_name": 1, "floor": 1, "zone": 1}):
        zone_pairs.add((t["store_id"], t.get("store_name", ""), t.get("floor", ""), t.get("zone", "")))

    traffic_query: Dict[str, Any] = {"tenant_id": tenant_id}
    if sid:
        traffic_query["store_id"] = sid
    traffic_by_zone: Dict[tuple, dict] = {}
    async for row in vm_zone_traffic_collection.find(traffic_query):
        traffic_by_zone[(row["store_id"], row.get("floor", ""), row.get("zone", ""))] = row

    zones = []
    for store_id_, store_name, floor, zone in sorted(zone_pairs):
        traffic = traffic_by_zone.get((store_id_, floor, zone))
        zones.append({
            "store_id": store_id_, "store_name": store_name, "floor": floor, "zone": zone,
            "visitor_count": traffic.get("visitor_count") if traffic else None,
            "has_data": traffic is not None,
        })
    return {
        "zones": zones,
        "data_source_configured": False,
        "note": "No footfall sensor/camera integration is configured. Zones are listed from real published placements; traffic counts stay empty until a hardware integration starts writing to this endpoint's data source.",
    }
