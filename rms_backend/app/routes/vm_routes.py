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
from datetime import datetime, timedelta
import re
from typing import Any, Dict, List, Optional

import cloudinary
import cloudinary.uploader
from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel

from ..config import settings
from ..vm_analytics import calculate_optimization_recommendations, calculate_placement_analytics, classify_experiment_result
from ..vm_location_helpers import LOCATION_PARENT, LOCATION_TYPES, calculate_photo_audit, layout_transition, location_snapshot, normalise_location_type, summarize_execution_tasks, validate_campaign_dates, validate_placement_rules
from ..db import (
    admins_collection, product_collection, stores_collection, vm_layouts_collection,
    vm_placements_collection, vm_staff_assignments_collection, vm_tasks_collection, vm_experiments_collection,
    vm_zone_traffic_collection, vm_location_nodes_collection, store_stock_collection, sales_collection,
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


async def _resolve_location_path(tenant_id: str, node_id: str) -> List[dict]:
    if not ObjectId.is_valid(node_id):
        raise HTTPException(status_code=400, detail="Invalid location node ID.")
    path, seen = [], set()
    current = await vm_location_nodes_collection.find_one({"_id": ObjectId(node_id), "tenant_id": tenant_id, "active": True})
    if not current:
        raise HTTPException(status_code=404, detail="The selected store location was not found or is inactive.")
    store_id = current.get("store_id")
    while current:
        current_id = str(current["_id"])
        if current_id in seen:
            raise HTTPException(status_code=409, detail="The store location hierarchy contains a cycle.")
        seen.add(current_id)
        path.append(current)
        parent_id = current.get("parent_id")
        if not parent_id:
            break
        current = await vm_location_nodes_collection.find_one({"_id": ObjectId(parent_id), "tenant_id": tenant_id, "store_id": store_id, "active": True}) if ObjectId.is_valid(parent_id) else None
        if not current:
            raise HTTPException(status_code=409, detail="The selected store location has a broken parent path.")
    path.reverse()
    for index, node in enumerate(path):
        if node.get("type") != LOCATION_TYPES[index]:
            raise HTTPException(status_code=409, detail="The selected store location hierarchy is invalid.")
    return path


class LocationNodeCreate(BaseModel):
    store_id: str
    parent_id: Optional[str] = None
    type: str
    code: str
    name: str
    sort_order: int = 0
    fixture_type: str = ""
    width_cm: Optional[float] = None
    height_cm: Optional[float] = None
    depth_cm: Optional[float] = None
    capacity: Optional[int] = None
    visibility: str = ""


class LocationNodeUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    sort_order: Optional[int] = None
    fixture_type: Optional[str] = None
    width_cm: Optional[float] = None
    height_cm: Optional[float] = None
    depth_cm: Optional[float] = None
    capacity: Optional[int] = None
    visibility: Optional[str] = None
    active: Optional[bool] = None


@router.get("/location-nodes")
async def list_location_nodes(store_id: Optional[str] = Query(None), include_inactive: bool = Query(False), ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    sid = clean(store_id)
    if ctx.get("scope") in ("store", "branch"):
        sid = ctx.get("store_id") or ""
    query: Dict[str, Any] = {"tenant_id": ctx["tenant_id"]}
    if sid:
        query["store_id"] = sid
    if not include_inactive:
        query["active"] = True
    rows = await vm_location_nodes_collection.find(query).sort([("store_id", 1), ("sort_order", 1), ("name", 1)]).to_list(5000)
    return [serialize_doc(r) for r in rows]


@router.post("/location-nodes", status_code=status.HTTP_201_CREATED)
async def create_location_node(payload: LocationNodeCreate, ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    ctx = _require_hq(ctx)
    store_id, code, name = clean(payload.store_id), clean(payload.code).upper(), clean(payload.name)
    node_type = normalise_location_type(payload.type)
    if not store_id or not code or not name:
        raise HTTPException(status_code=400, detail="Store, code and name are required.")
    if store_id not in {s["id"] for s in await _own_store_ids(ctx["tenant_id"])}:
        raise HTTPException(status_code=404, detail="Store not found for this tenant.")
    parent_id, expected_parent = clean(payload.parent_id), LOCATION_PARENT[node_type]
    if expected_parent is None and parent_id:
        raise HTTPException(status_code=400, detail="A floor cannot have a parent.")
    if expected_parent is not None:
        if not ObjectId.is_valid(parent_id):
            raise HTTPException(status_code=400, detail=f"A {node_type} must have a {expected_parent} parent.")
        parent = await vm_location_nodes_collection.find_one({"_id": ObjectId(parent_id), "tenant_id": ctx["tenant_id"], "store_id": store_id, "active": True})
        if not parent or parent.get("type") != expected_parent:
            raise HTTPException(status_code=400, detail=f"A {node_type} must be under a {expected_parent} in the same store.")
    for field, value in (("width_cm", payload.width_cm), ("height_cm", payload.height_cm), ("depth_cm", payload.depth_cm)):
        if value is not None and value <= 0:
            raise HTTPException(status_code=400, detail=f"{field} must be greater than zero.")
    if payload.capacity is not None and payload.capacity < 0:
        raise HTTPException(status_code=400, detail="Capacity cannot be negative.")
    now = now_utc()
    doc = {"tenant_id": ctx["tenant_id"], "store_id": store_id, "parent_id": parent_id or None, "type": node_type, "code": code, "name": name, "sort_order": payload.sort_order, "fixture_type": clean(payload.fixture_type), "width_cm": payload.width_cm, "height_cm": payload.height_cm, "depth_cm": payload.depth_cm, "capacity": payload.capacity, "visibility": clean(payload.visibility), "active": True, "created_by": ctx.get("admin_id"), "created_at": now, "updated_at": now}
    if await vm_location_nodes_collection.find_one({"tenant_id": ctx["tenant_id"], "store_id": store_id, "parent_id": doc["parent_id"], "type": node_type, "code": code}):
        raise HTTPException(status_code=409, detail="That code already exists under this parent.")
    result = await vm_location_nodes_collection.insert_one(doc)
    return serialize_doc(await vm_location_nodes_collection.find_one({"_id": result.inserted_id}))


@router.patch("/location-nodes/{node_id}")
async def update_location_node(node_id: str, payload: LocationNodeUpdate, ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    ctx = _require_hq(ctx)
    if not ObjectId.is_valid(node_id):
        raise HTTPException(status_code=400, detail="Invalid location node ID.")
    node = await vm_location_nodes_collection.find_one({"_id": ObjectId(node_id), "tenant_id": ctx["tenant_id"]})
    if not node:
        raise HTTPException(status_code=404, detail="Location node not found.")
    values = payload.model_dump(exclude_unset=True)
    updates = {k: (clean(v).upper() if k == "code" else clean(v) if isinstance(v, str) else v) for k, v in values.items()}
    if ("code" in updates and not updates["code"]) or ("name" in updates and not updates["name"]):
        raise HTTPException(status_code=400, detail="Code and name cannot be empty.")
    if updates.get("active") is False and await vm_location_nodes_collection.find_one({"tenant_id": ctx["tenant_id"], "parent_id": node_id, "active": True}):
        raise HTTPException(status_code=409, detail="Deactivate active child locations first.")
    updates["updated_at"] = now_utc()
    await vm_location_nodes_collection.update_one({"_id": node["_id"]}, {"$set": updates})
    return serialize_doc(await vm_location_nodes_collection.find_one({"_id": node["_id"]}))


@router.delete("/location-nodes/{node_id}")
async def deactivate_location_node(node_id: str, ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    return await update_location_node(node_id, LocationNodeUpdate(active=False), ctx)


def _product_row(product: dict, variant: Optional[dict] = None) -> dict:
    variant = variant or {}
    barcode = clean(variant.get("barcode") or product.get("barcode") or product.get("base_barcode"))
    name = clean(product.get("product_name"))
    qualifiers = [clean(variant.get("size_label")), clean(variant.get("color"))]
    if any(qualifiers):
        name = " | ".join([name] + [q for q in qualifiers if q])
    selling_price = float(variant.get("selling_price") or product.get("selling_price") or product.get("mrp") or 0)
    cost_price = float(variant.get("cost_price") or product.get("cost_price") or 0)
    margin_pct = round(((selling_price - cost_price) / selling_price) * 100, 1) if selling_price else 0
    return {"product_id": str(product["_id"]), "barcode": barcode, "sku": clean(variant.get("sku") or product.get("sku") or product.get("base_sku")), "product_name": name, "brand": clean(product.get("brand")), "category": clean(product.get("department") or product.get("section") or product.get("division")), "selling_price": selling_price, "cost_price": cost_price, "margin_pct": margin_pct, "image_url": (product.get("images") or [""])[0] if product.get("images") else ""}


@router.get("/products/search")
async def search_products(q: str = Query(""), store_id: str = Query(...), limit: int = Query(20, ge=1, le=50), ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    sid = clean(store_id)
    if ctx.get("scope") in ("store", "branch"):
        sid = ctx.get("store_id") or ""
    if sid not in {s["id"] for s in await _own_store_ids(ctx["tenant_id"])}:
        raise HTTPException(status_code=404, detail="Store not found for this tenant.")
    term = clean(q)
    regex = re.compile(re.escape(term), re.IGNORECASE) if term else re.compile(".*")
    query = {"tenant_id": ctx["tenant_id"], "$or": [{"product_name": regex}, {"barcode": regex}, {"sku": regex}, {"base_sku": regex}, {"variants.barcode": regex}, {"variants.sku": regex}]}
    products = await product_collection.find(query).limit(limit).to_list(limit)
    rows = []
    for product in products:
        base = _product_row(product)
        if base["barcode"] and (not term or regex.search(" ".join([base["product_name"], base["barcode"], base["sku"]]))):
            rows.append(base)
        for variant in product.get("variants") or []:
            row = _product_row(product, variant)
            if row["barcode"] and (not term or regex.search(" ".join([row["product_name"], row["barcode"], row["sku"]]))):
                rows.append(row)
        if len(rows) >= limit:
            break
    barcodes = [row["barcode"] for row in rows]
    stock = {}
    async for item in store_stock_collection.find({"tenant_id": ctx["tenant_id"], "store_id": sid, "barcode": {"$in": barcodes}}, {"barcode": 1, "stockQty": 1}):
        stock[clean(item.get("barcode"))] = float(item.get("stockQty") or 0)
    for row in rows:
        row["store_stock"] = stock.get(row["barcode"], 0)
    return rows[:limit]


# ─────────────────────────────────────────────
# LAYOUTS
# ─────────────────────────────────────────────

class LayoutCreate(BaseModel):
    name: str
    notes: str = ""
    campaign_name: str = ""
    store_format: str = "all"
    start_date: str = ""
    end_date: str = ""
    is_template: bool = False


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
    validate_campaign_dates(payload.start_date, payload.end_date)
    now = now_utc()
    doc = {
        "tenant_id": ctx["tenant_id"], "name": name, "notes": clean(payload.notes),
        "campaign_name": clean(payload.campaign_name), "store_format": clean(payload.store_format) or "all",
        "start_date": clean(payload.start_date), "end_date": clean(payload.end_date), "is_template": payload.is_template,
        "version": 1, "parent_layout_id": None,
        "status": "DRAFT", "created_by": ctx.get("admin_id"), "created_by_name": ctx.get("admin_name"),
        "created_at": now, "updated_at": now, "published_at": None,
        "status_history": [{"from": None, "to": "DRAFT", "action": "create", "by": ctx.get("admin_id"), "by_name": ctx.get("admin_name") or "", "at": now, "note": ""}],
    }
    result = await vm_layouts_collection.insert_one(doc)
    return serialize_doc(await vm_layouts_collection.find_one({"_id": result.inserted_id}))


class LayoutStatusChange(BaseModel):
    action: str
    note: str = ""


@router.post("/layouts/{layout_id}/status")
async def change_layout_status(layout_id: str, payload: LayoutStatusChange, ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    ctx = _require_hq(ctx)
    if not ObjectId.is_valid(layout_id):
        raise HTTPException(status_code=400, detail="Invalid layout ID.")
    layout = await vm_layouts_collection.find_one({"_id": ObjectId(layout_id), "tenant_id": ctx["tenant_id"]})
    if not layout:
        raise HTTPException(status_code=404, detail="Layout not found.")
    if layout.get("is_template") and clean(payload.action).lower() not in {"archive", "return_draft"}:
        raise HTTPException(status_code=409, detail="Templates must be cloned into a campaign layout before review or activation.")
    if clean(payload.action).lower() == "submit_review" and not await vm_placements_collection.find_one({"tenant_id": ctx["tenant_id"], "layout_id": layout_id}):
        raise HTTPException(status_code=400, detail="Add at least one placement before submitting the layout for review.")
    next_status = layout_transition(layout.get("status", "DRAFT"), payload.action)
    if next_status in {"SCHEDULED", "ACTIVE"}:
        validate_campaign_dates(layout.get("start_date", ""), layout.get("end_date", ""), required=True)
    now = now_utc()
    event = {"from": layout.get("status", "DRAFT"), "to": next_status, "action": clean(payload.action).lower(), "by": ctx.get("admin_id"), "by_name": ctx.get("admin_name") or "", "at": now, "note": clean(payload.note)}
    await vm_layouts_collection.update_one({"_id": layout["_id"]}, {"$set": {"status": next_status, "updated_at": now}, "$push": {"status_history": event}})
    return serialize_doc(await vm_layouts_collection.find_one({"_id": layout["_id"]}))


class LayoutClone(BaseModel):
    name: str = ""
    campaign_name: str = ""
    start_date: str = ""
    end_date: str = ""
    as_template: bool = False


@router.post("/layouts/{layout_id}/clone", status_code=status.HTTP_201_CREATED)
async def clone_layout(layout_id: str, payload: LayoutClone, ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    ctx = _require_hq(ctx)
    if not ObjectId.is_valid(layout_id):
        raise HTTPException(status_code=400, detail="Invalid layout ID.")
    source = await vm_layouts_collection.find_one({"_id": ObjectId(layout_id), "tenant_id": ctx["tenant_id"]})
    if not source:
        raise HTTPException(status_code=404, detail="Layout not found.")
    validate_campaign_dates(payload.start_date, payload.end_date)
    now = now_utc()
    root_id = source.get("parent_layout_id") or str(source["_id"])
    latest = await vm_layouts_collection.find_one({"tenant_id": ctx["tenant_id"], "$or": [{"_id": source["_id"]}, {"parent_layout_id": root_id}]}, sort=[("version", -1)])
    version = int((latest or source).get("version") or 1) + 1
    doc = {"tenant_id": ctx["tenant_id"], "name": clean(payload.name) or f"{source.get('name', 'Layout')} v{version}", "notes": source.get("notes", ""), "campaign_name": clean(payload.campaign_name) or source.get("campaign_name", ""), "store_format": source.get("store_format", "all"), "start_date": clean(payload.start_date), "end_date": clean(payload.end_date), "is_template": payload.as_template, "version": version, "parent_layout_id": root_id, "status": "DRAFT", "created_by": ctx.get("admin_id"), "created_by_name": ctx.get("admin_name"), "created_at": now, "updated_at": now, "published_at": None, "status_history": [{"from": source.get("status"), "to": "DRAFT", "action": "clone", "by": ctx.get("admin_id"), "by_name": ctx.get("admin_name") or "", "at": now, "note": f"Cloned from {source.get('name', '')}"}]}
    result = await vm_layouts_collection.insert_one(doc)
    placements = await vm_placements_collection.find({"tenant_id": ctx["tenant_id"], "layout_id": layout_id}).to_list(5000)
    if placements:
        copies = []
        for placement in placements:
            placement.pop("_id", None)
            placement.update({"layout_id": str(result.inserted_id), "created_by": ctx.get("admin_id"), "created_at": now, "updated_at": now})
            copies.append(placement)
        await vm_placements_collection.insert_many(copies)
    return serialize_doc(await vm_layouts_collection.find_one({"_id": result.inserted_id}))


@router.delete("/layouts/{layout_id}")
async def delete_layout(layout_id: str, ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    ctx = _require_hq(ctx)
    if not ObjectId.is_valid(layout_id):
        raise HTTPException(status_code=400, detail="Invalid layout ID.")
    layout = await vm_layouts_collection.find_one({"_id": ObjectId(layout_id), "tenant_id": ctx["tenant_id"]})
    if not layout:
        raise HTTPException(status_code=404, detail="Layout not found.")
    if layout.get("status") != "DRAFT":
        raise HTTPException(status_code=409, detail="Only draft layouts can be deleted. Archive reviewed or released layouts instead.")
    await vm_placements_collection.delete_many({"tenant_id": ctx["tenant_id"], "layout_id": layout_id})
    await vm_layouts_collection.delete_one({"_id": layout["_id"]})
    return {"message": "Draft layout removed."}


# ─────────────────────────────────────────────
# PLACEMENTS — line items within a still-DRAFT layout
# ─────────────────────────────────────────────

class PlacementCreate(BaseModel):
    product_id: str = ""
    barcode: str = ""
    product_name: str = ""
    sku: str = ""
    floor: str = ""
    zone: str = ""
    rack: str = ""
    shelf: str = ""
    location_node_id: str = ""
    facings: int = 1
    display_quantity: int = 1
    orientation: str = "face-out"
    shelf_level: str = ""
    purpose: str = "regular"
    start_date: str = ""
    end_date: str = ""
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
    location_bits = [clean(payload.floor), clean(payload.zone), clean(payload.rack), clean(payload.shelf), clean(payload.location_node_id)]
    if not product_name and not clean(payload.barcode):
        raise HTTPException(status_code=400, detail="Give either a product name or a barcode.")
    if not any(location_bits):
        raise HTTPException(status_code=400, detail="At least one location field (floor/zone/rack/shelf) is required.")

    barcode = clean(payload.barcode)
    sku = clean(payload.sku)
    product = await product_collection.find_one({"tenant_id": ctx["tenant_id"], "$or": [{"barcode": barcode}, {"variants.barcode": barcode}]}) if barcode else None
    if not product:
        raise HTTPException(status_code=404, detail="Select a valid Product Master item before adding a placement.")
    variant = next((v for v in product.get("variants") or [] if clean(v.get("barcode")) == barcode), None)
    product_data = _product_row(product, variant)
    product_name, sku = product_data["product_name"], product_data["sku"]

    if payload.facings < 1 or payload.display_quantity < 1:
        raise HTTPException(status_code=400, detail="Facings and display quantity must be at least 1.")
    location = {}
    if clean(payload.location_node_id):
        location = location_snapshot(await _resolve_location_path(ctx["tenant_id"], clean(payload.location_node_id)))
    leaf_id = clean(payload.location_node_id)
    duplicate = await vm_placements_collection.find_one({"tenant_id": ctx["tenant_id"], "layout_id": layout_id, "barcode": barcode, "location_leaf_id": leaf_id})
    if duplicate:
        raise HTTPException(status_code=409, detail="This product is already placed at the selected rack position in this layout.")
    path = await _resolve_location_path(ctx["tenant_id"], leaf_id)
    capacity_node = next((n for n in reversed(path) if n.get("capacity") is not None), None)
    used = 0
    if capacity_node:
        async for existing in vm_placements_collection.find({"tenant_id": ctx["tenant_id"], "layout_id": layout_id, "location_node_ids." + capacity_node["type"]: str(capacity_node["_id"])}, {"display_quantity": 1}):
            used += int(existing.get("display_quantity") or 0)
    purpose = validate_placement_rules(payload.display_quantity, used, int(capacity_node["capacity"]) if capacity_node else None, payload.purpose, payload.start_date, payload.end_date)
    stock = await store_stock_collection.find_one({"tenant_id": ctx["tenant_id"], "store_id": location.get("store_id"), "barcode": barcode}, {"stockQty": 1})
    stock_qty = float(stock.get("stockQty") or 0) if stock else 0
    stock_warning = ""
    if stock_qty <= 0:
        stock_warning = "Out of stock at the selected store. Replenish before execution."
    elif stock_qty < payload.display_quantity:
        stock_warning = f"Only {stock_qty:g} available; {payload.display_quantity} planned for display."
    now = now_utc()
    doc = {
        "tenant_id": ctx["tenant_id"], "layout_id": layout_id,
        "product_id": str(product["_id"]), "barcode": barcode, "product_name": product_name, "sku": sku,
        "brand": product_data["brand"], "category": product_data["category"], "selling_price": product_data["selling_price"],
        "margin_pct": product_data["margin_pct"], "product_image_url": product_data["image_url"],
        "floor": location.get("floor", clean(payload.floor)), "department": location.get("department", ""),
        "zone": location.get("zone", clean(payload.zone)), "rack": location.get("rack", clean(payload.rack)),
        "fixture": location.get("fixture", ""), "segment": location.get("segment", ""),
        "shelf": location.get("shelf", clean(payload.shelf)), "store_id": location.get("store_id", ""),
        "location_node_ids": location.get("location_node_ids", {}), "location_leaf_id": leaf_id,
        "facings": payload.facings, "display_quantity": payload.display_quantity, "orientation": clean(payload.orientation) or "face-out",
        "shelf_level": clean(payload.shelf_level), "purpose": purpose, "start_date": clean(payload.start_date), "end_date": clean(payload.end_date),
        "store_stock_snapshot": stock_qty, "stock_warning": stock_warning,
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


class PlacementMove(BaseModel):
    location_node_id: str


@router.patch("/placements/{placement_id}/location")
async def move_placement(placement_id: str, payload: PlacementMove, ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    ctx = _require_hq(ctx)
    if not ObjectId.is_valid(placement_id):
        raise HTTPException(status_code=400, detail="Invalid placement ID.")
    placement = await vm_placements_collection.find_one({"_id": ObjectId(placement_id), "tenant_id": ctx["tenant_id"]})
    if not placement:
        raise HTTPException(status_code=404, detail="Placement not found.")
    layout = await vm_layouts_collection.find_one({"_id": ObjectId(placement["layout_id"]), "tenant_id": ctx["tenant_id"]})
    if not layout or layout.get("status") != "DRAFT":
        raise HTTPException(status_code=409, detail="Only draft layout placements can be moved.")
    path = await _resolve_location_path(ctx["tenant_id"], clean(payload.location_node_id))
    if path[-1].get("type") not in {"fixture", "segment", "shelf"}:
        raise HTTPException(status_code=400, detail="Products can only be placed on a fixture, segment or shelf.")
    location = location_snapshot(path)
    if placement.get("store_id") and placement.get("store_id") != location.get("store_id"):
        raise HTTPException(status_code=409, detail="A placement cannot be dragged into another store. Create a separate placement for that store.")
    leaf_id = str(path[-1]["_id"])
    duplicate = await vm_placements_collection.find_one({"_id": {"$ne": placement["_id"]}, "tenant_id": ctx["tenant_id"], "layout_id": placement["layout_id"], "barcode": placement.get("barcode", ""), "location_leaf_id": leaf_id})
    if duplicate:
        raise HTTPException(status_code=409, detail="This product is already placed at that rack position.")
    capacity_node = next((n for n in reversed(path) if n.get("capacity") is not None), None)
    used = 0
    if capacity_node:
        query = {"_id": {"$ne": placement["_id"]}, "tenant_id": ctx["tenant_id"], "layout_id": placement["layout_id"], "location_node_ids." + capacity_node["type"]: str(capacity_node["_id"])}
        async for existing in vm_placements_collection.find(query, {"display_quantity": 1}):
            used += int(existing.get("display_quantity") or 0)
    validate_placement_rules(int(placement.get("display_quantity") or 1), used, int(capacity_node["capacity"]) if capacity_node else None, placement.get("purpose", "regular"), placement.get("start_date", ""), placement.get("end_date", ""))
    await vm_placements_collection.update_one({"_id": placement["_id"]}, {"$set": {**location, "location_leaf_id": leaf_id, "updated_at": now_utc()}})
    return serialize_doc(await vm_placements_collection.find_one({"_id": placement["_id"]}))


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
    due_date: str = ""
    priority: str = "MEDIUM"


@router.post("/layouts/{layout_id}/publish")
async def publish_layout(layout_id: str, payload: PublishPayload, ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    ctx = _require_hq(ctx)
    if not ObjectId.is_valid(layout_id):
        raise HTTPException(status_code=400, detail="Invalid layout ID.")
    layout = await vm_layouts_collection.find_one({"_id": ObjectId(layout_id), "tenant_id": ctx["tenant_id"]})
    if not layout:
        raise HTTPException(status_code=404, detail="Layout not found.")
    if layout.get("is_template"):
        raise HTTPException(status_code=409, detail="Clone this template into a campaign layout before publishing.")
    if layout.get("published_at"):
        raise HTTPException(status_code=409, detail="This campaign has already been released to stores.")
    if layout.get("status") not in {"APPROVED", "SCHEDULED"}:
        raise HTTPException(status_code=409, detail="A layout must be approved or scheduled before publishing.")
    validate_campaign_dates(layout.get("start_date", ""), layout.get("end_date", ""), required=True)
    priority = clean(payload.priority).upper() or "MEDIUM"
    if priority not in {"LOW", "MEDIUM", "HIGH", "URGENT"}:
        raise HTTPException(status_code=400, detail="Priority must be low, medium, high or urgent.")
    try:
        datetime.fromisoformat(payload.due_date).date() if clean(payload.due_date) else None
    except ValueError:
        raise HTTPException(status_code=400, detail="Task due date must use YYYY-MM-DD format.")
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
            if p.get("store_id") and p.get("store_id") != store["id"]:
                continue
            task_docs.append({
                "tenant_id": ctx["tenant_id"], "layout_id": layout_id, "layout_name": layout.get("name"),
                "placement_id": str(p["_id"]),
                "store_id": store["id"], "store_name": store["name"],
                "product_id": p.get("product_id", ""), "barcode": p.get("barcode", ""), "product_name": p.get("product_name", ""), "sku": p.get("sku", ""),
                "brand": p.get("brand", ""), "category": p.get("category", ""), "selling_price": p.get("selling_price", 0),
                "margin_pct": p.get("margin_pct", 0), "product_image_url": p.get("product_image_url", ""),
                "floor": p.get("floor", ""), "department": p.get("department", ""), "zone": p.get("zone", ""),
                "rack": p.get("rack", ""), "fixture": p.get("fixture", ""), "segment": p.get("segment", ""), "shelf": p.get("shelf", ""),
                "location_node_ids": p.get("location_node_ids", {}), "facings": p.get("facings", 1),
                "display_quantity": p.get("display_quantity", 1), "orientation": p.get("orientation", "face-out"),
                "shelf_level": p.get("shelf_level", ""), "purpose": p.get("purpose", "regular"),
                "start_date": p.get("start_date", ""), "end_date": p.get("end_date", ""),
                "store_stock_snapshot": p.get("store_stock_snapshot", 0), "stock_warning": p.get("stock_warning", ""),
                "instruction": p.get("instruction", ""), "reference_image_url": p.get("reference_image_url", ""),
                "status": "PENDING", "priority": priority, "due_date": clean(payload.due_date) or layout.get("start_date", ""),
                "assigned_to": None, "assigned_to_name": "", "supervisor_id": None, "supervisor_name": "",
                "before_photo_url": "", "after_photo_url": "", "done_photo_url": "", "done_by": None, "done_by_name": "", "done_at": None,
                "completion_type": "", "completion_notes": "", "blocker_type": "", "blocker_notes": "", "submissions": [], "review_history": [],
                "approved_by": None, "approved_by_name": "", "approved_at": None, "rejection_reason": "",
                "created_at": now, "updated_at": now,
            })
    if not task_docs:
        raise HTTPException(status_code=400, detail="None of this layout's store-specific placements match the selected stores.")
    await vm_tasks_collection.insert_many(task_docs)
    start = datetime.fromisoformat(layout["start_date"]).date()
    released_status = "SCHEDULED" if start > now.date() else "ACTIVE"
    event = {"from": layout.get("status"), "to": released_status, "action": "publish", "by": ctx.get("admin_id"), "by_name": ctx.get("admin_name") or "", "at": now, "note": f"{len(task_docs)} store tasks created"}
    await vm_layouts_collection.update_one({"_id": layout["_id"]}, {"$set": {"status": released_status, "published_at": now, "updated_at": now}, "$push": {"status_history": event}})
    assigned_store_count = len({task["store_id"] for task in task_docs})
    return {"message": f"Published to {assigned_store_count} store(s) — {len(task_docs)} task(s) created.", "task_count": len(task_docs), "store_count": assigned_store_count}


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


class TaskAssignment(BaseModel):
    assigned_to: str = ""
    supervisor_id: str = ""
    due_date: str = ""
    priority: str = "MEDIUM"


@router.patch("/tasks/{task_id}/assignment")
async def assign_task(task_id: str, payload: TaskAssignment, ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    ctx = _require_hq(ctx)
    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID.")
    task = await vm_tasks_collection.find_one({"_id": ObjectId(task_id), "tenant_id": ctx["tenant_id"]})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    priority = clean(payload.priority).upper() or "MEDIUM"
    if priority not in {"LOW", "MEDIUM", "HIGH", "URGENT"}:
        raise HTTPException(status_code=400, detail="Priority must be low, medium, high or urgent.")
    try:
        datetime.fromisoformat(payload.due_date).date() if clean(payload.due_date) else None
    except ValueError:
        raise HTTPException(status_code=400, detail="Due date must use YYYY-MM-DD format.")
    updates = {"priority": priority, "due_date": clean(payload.due_date), "updated_at": now_utc()}
    for field, name_field, value in (("assigned_to", "assigned_to_name", payload.assigned_to), ("supervisor_id", "supervisor_name", payload.supervisor_id)):
        admin = None
        if clean(value):
            if not ObjectId.is_valid(value):
                raise HTTPException(status_code=400, detail="Invalid staff ID.")
            admin = await admins_collection.find_one({"_id": ObjectId(value), "tenant_id": ctx["tenant_id"], "store_id": task.get("store_id")})
            if not admin:
                raise HTTPException(status_code=404, detail="Selected staff member does not belong to this task's store.")
        updates[field] = clean(value) or None
        updates[name_field] = admin.get("name", "") if admin else ""
    await vm_tasks_collection.update_one({"_id": task["_id"]}, {"$set": updates})
    return serialize_doc(await vm_tasks_collection.find_one({"_id": task["_id"]}))


class TaskBlocker(BaseModel):
    blocker_type: str
    notes: str = ""


@router.post("/tasks/{task_id}/blocker")
async def report_task_blocker(task_id: str, payload: TaskBlocker, ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID.")
    query: Dict[str, Any] = {"_id": ObjectId(task_id), "tenant_id": ctx["tenant_id"]}
    if ctx.get("scope") in ("store", "branch"):
        query["store_id"] = ctx.get("store_id")
    task = await vm_tasks_collection.find_one(query)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found, or belongs to another store.")
    blocker_type = clean(payload.blocker_type).lower()
    if blocker_type not in {"missing_stock", "damaged_fixture", "other"}:
        raise HTTPException(status_code=400, detail="Choose missing stock, damaged fixture or other.")
    now = now_utc()
    event = {"type": blocker_type, "notes": clean(payload.notes), "reported_by": ctx.get("admin_id"), "reported_by_name": ctx.get("admin_name") or "", "reported_at": now, "resolved": False}
    await vm_tasks_collection.update_one({"_id": task["_id"]}, {"$set": {"status": "BLOCKED", "blocker_type": blocker_type, "blocker_notes": clean(payload.notes), "updated_at": now}, "$push": {"blocker_history": event}})
    return {"message": "Blocker reported to the supervisor.", "status": "BLOCKED"}


@router.get("/operations-summary")
async def operations_summary(ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    query: Dict[str, Any] = {"tenant_id": ctx["tenant_id"]}
    if ctx.get("scope") in ("store", "branch"):
        query["store_id"] = ctx.get("store_id")
    tasks = await vm_tasks_collection.find(query, {"status": 1, "due_date": 1, "priority": 1}).to_list(10000)
    return summarize_execution_tasks(tasks, now_utc().date().isoformat())


@router.post("/tasks/{task_id}/complete")
async def complete_task(task_id: str, file: UploadFile = File(...), completion_type: str = Query("COMPLETE"), notes: str = Query(""), ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
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
    completion_kind = clean(completion_type).upper() or "COMPLETE"
    if completion_kind not in {"COMPLETE", "PARTIAL"}:
        raise HTTPException(status_code=400, detail="Completion type must be complete or partial.")
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
    submission = {"completion_type": completion_kind, "notes": clean(notes), "photo_url": url, "submitted_by": ctx.get("admin_id"), "submitted_by_name": ctx.get("admin_name") or "", "submitted_at": now}
    await vm_tasks_collection.update_one({"_id": task["_id"]}, {"$set": {
        "status": "DONE", "after_photo_url": url, "done_photo_url": url, "done_by": ctx.get("admin_id"),
        "done_by_name": ctx.get("admin_name") or "", "done_at": now, "updated_at": now,
        "completion_type": completion_kind, "completion_notes": clean(notes), "rejection_reason": "",
    }, "$push": {"submissions": submission}})
    return {"message": "Marked done — pending approval.", "done_photo_url": url}


class PhotoAuditPayload(BaseModel):
    correct_product: bool = False
    correct_location: bool = False
    facings_quantity: bool = False
    orientation: bool = False
    presentation: bool = False
    comments: str = ""


@router.post("/tasks/{task_id}/photo-audit")
async def photo_audit(task_id: str, payload: PhotoAuditPayload, ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    ctx = _require_hq(ctx)
    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID.")
    task = await vm_tasks_collection.find_one({"_id": ObjectId(task_id), "tenant_id": ctx["tenant_id"]})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    if task.get("status") not in {"DONE", "SUBMITTED"}:
        raise HTTPException(status_code=409, detail="Only submitted proof photos can be audited.")
    if not (task.get("after_photo_url") or task.get("done_photo_url")):
        raise HTTPException(status_code=409, detail="A proof photo is required before audit.")
    result = calculate_photo_audit(payload.model_dump())
    comments = clean(payload.comments)
    if not result["passed"] and not comments:
        raise HTTPException(status_code=400, detail="Correction comments are required when the audit fails.")
    now = now_utc()
    decision = "APPROVED" if result["passed"] else "CORRECTION_REQUIRED"
    audit = {**result, "decision": decision, "comments": comments, "reviewed_by": ctx.get("admin_id"), "reviewed_by_name": ctx.get("admin_name") or "", "reviewed_at": now}
    updates = {"status": decision, "compliance_score": result["score"], "latest_audit": audit, "updated_at": now, "rejection_reason": "" if result["passed"] else comments}
    if result["passed"]:
        updates.update({"approved_by": ctx.get("admin_id"), "approved_by_name": ctx.get("admin_name") or "", "approved_at": now})
    review = {"decision": decision, "reason": comments, "reviewed_by": ctx.get("admin_id"), "reviewed_by_name": ctx.get("admin_name") or "", "reviewed_at": now}
    await vm_tasks_collection.update_one({"_id": task["_id"]}, {"$set": updates, "$push": {"audit_history": audit, "review_history": review}})
    return {"message": "Photo audit completed.", **audit}


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
    if task.get("status") not in {"DONE", "SUBMITTED"}:
        raise HTTPException(status_code=409, detail="Only a task marked done by the store can be approved or rejected.")
    now = now_utc()
    if payload.approved:
        review = {"decision": "APPROVED", "reason": "", "reviewed_by": ctx.get("admin_id"), "reviewed_by_name": ctx.get("admin_name") or "", "reviewed_at": now}
        await vm_tasks_collection.update_one({"_id": task["_id"]}, {"$set": {
            "status": "APPROVED", "approved_by": ctx.get("admin_id"), "approved_by_name": ctx.get("admin_name") or "",
            "approved_at": now, "updated_at": now,
        }, "$push": {"review_history": review}})
        return {"message": "Approved."}
    reason = clean(payload.rejection_reason)
    if not reason:
        raise HTTPException(status_code=400, detail="A reason is required to reject.")
    review = {"decision": "CORRECTION_REQUIRED", "reason": reason, "reviewed_by": ctx.get("admin_id"), "reviewed_by_name": ctx.get("admin_name") or "", "reviewed_at": now}
    await vm_tasks_collection.update_one({"_id": task["_id"]}, {"$set": {"status": "CORRECTION_REQUIRED", "rejection_reason": reason, "updated_at": now}, "$push": {"review_history": review}})
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
        row = by_store.setdefault(t["store_id"], {"store_id": t["store_id"], "store_name": t.get("store_name", ""), "total": 0, "approved": 0, "done": 0, "pending": 0, "corrections": 0, "overdue": 0, "audit_scores": []})
        row["total"] += 1
        if t["status"] == "APPROVED":
            row["approved"] += 1
        elif t["status"] in {"DONE", "SUBMITTED"}:
            row["done"] += 1
        elif t["status"] == "CORRECTION_REQUIRED":
            row["corrections"] += 1
            row["pending"] += 1
        else:
            row["pending"] += 1
        if t.get("due_date") and t["due_date"] < now_utc().date().isoformat() and t["status"] != "APPROVED":
            row["overdue"] += 1
        if t.get("compliance_score") is not None:
            row["audit_scores"].append(float(t["compliance_score"]))
    rows = list(by_store.values())
    for row in rows:
        row["compliance_pct"] = round((row["approved"] / row["total"]) * 100, 1) if row["total"] else 0.0
        row["audit_score"] = round(sum(row["audit_scores"]) / len(row["audit_scores"]), 1) if row["audit_scores"] else None
        del row["audit_scores"]
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


@router.get("/analytics")
async def placement_analytics(layout_id: str = Query(...), store_id: Optional[str] = Query(None), from_date: Optional[str] = Query(None), to_date: Optional[str] = Query(None), ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    ctx = _require_hq(ctx)
    if not ObjectId.is_valid(layout_id):
        raise HTTPException(status_code=400, detail="Invalid layout ID.")
    layout = await vm_layouts_collection.find_one({"_id": ObjectId(layout_id), "tenant_id": ctx["tenant_id"]})
    if not layout:
        raise HTTPException(status_code=404, detail="Layout not found.")
    validate_campaign_dates(from_date or layout.get("start_date", ""), to_date or layout.get("end_date", ""), required=True)
    query: Dict[str, Any] = {"tenant_id": ctx["tenant_id"], "layout_id": layout_id}
    if clean(store_id): query["store_id"] = clean(store_id)
    placements = [serialize_doc(row) for row in await vm_placements_collection.find(query).to_list(5000)]
    if not placements:
        return {"layout": serialize_doc(layout), "summary": {"placements": 0}, "rows": [], "note": "No placements match these filters."}
    barcodes = list({p.get("barcode", "") for p in placements if p.get("barcode")})
    store_ids = list({p.get("store_id", "") for p in placements if p.get("store_id")})
    stock = {}
    async for item in store_stock_collection.find({"tenant_id": ctx["tenant_id"], "store_id": {"$in": store_ids}, "barcode": {"$in": barcodes}}, {"store_id": 1, "barcode": 1, "stockQty": 1}):
        stock[(str(item.get("store_id") or ""), clean(item.get("barcode")))] = float(item.get("stockQty") or 0)
    for placement in placements:
        placement["current_stock"] = stock.get((placement.get("store_id", ""), placement.get("barcode", "")), 0)
    start_text = clean(from_date) or layout.get("start_date", "")
    end_text = clean(to_date) or layout.get("end_date", "") or now_utc().date().isoformat()
    start = datetime.fromisoformat(start_text)
    end = datetime.fromisoformat(end_text)
    duration = max((end.date() - start.date()).days + 1, 1)
    sales_start = start - timedelta(days=duration)
    sales_end = end.replace(hour=23, minute=59, second=59)
    sales_query: Dict[str, Any] = {"tenant_id": ctx["tenant_id"], "store_id": {"$in": store_ids}, "type": {"$in": ["sale", "return"]}, "created_at": {"$gte": sales_start, "$lte": sales_end}}
    sales = await sales_collection.find(sales_query, {"invoice_no": 1, "type": 1, "store_id": 1, "items": 1, "created_at": 1}).to_list(100000)
    result = calculate_placement_analytics(placements, sales, start_text, end_text, now_utc())
    result["layout"] = {"id": layout_id, "name": layout.get("name", ""), "campaign_name": layout.get("campaign_name", ""), "version": layout.get("version", 1)}
    result["note"] = "Sales are attributed by store, SKU and active placement dates. Multiple simultaneous racks for the same SKU are flagged as ambiguous and counted once in campaign totals."
    return result


@router.get("/optimization")
async def placement_optimization(layout_id: str = Query(...), store_id: Optional[str] = Query(None), ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    ctx = _require_hq(ctx)
    analytics = await placement_analytics(layout_id=layout_id, store_id=store_id, from_date=None, to_date=None, ctx=ctx)
    if not analytics.get("rows"):
        return {"layout": analytics.get("layout"), "summary": {"total": 0, "expand": 0, "retain": 0, "attention": 0, "blocked": 0}, "rows": []}
    placement_ids = [row["placement_id"] for row in analytics["rows"] if ObjectId.is_valid(row.get("placement_id", ""))]
    details = {}
    async for placement in vm_placements_collection.find({"tenant_id": ctx["tenant_id"], "_id": {"$in": [ObjectId(value) for value in placement_ids]}}):
        details[str(placement["_id"])] = placement
    audit_totals: Dict[str, dict] = {}
    task_query: Dict[str, Any] = {"tenant_id": ctx["tenant_id"], "layout_id": layout_id, "compliance_score": {"$ne": None}}
    if clean(store_id): task_query["store_id"] = clean(store_id)
    async for task in vm_tasks_collection.find(task_query, {"placement_id": 1, "compliance_score": 1}):
        pid = task.get("placement_id", "")
        score = float(task.get("compliance_score") or 0)
        bucket = audit_totals.setdefault(pid, {"total": 0.0, "count": 0})
        bucket["total"] += score
        bucket["count"] += 1
    audit_scores = {pid: round(bucket["total"] / bucket["count"], 1) for pid, bucket in audit_totals.items() if bucket["count"]}
    result = calculate_optimization_recommendations(analytics["rows"], details, audit_scores)
    result["layout"] = analytics.get("layout")
    result["note"] = "Recommendations are decision support only. Accepting one records HQ intent; it does not silently modify a live planogram."
    return result


class OptimizationDecision(BaseModel):
    decision: str
    notes: str = ""


@router.post("/optimization/{placement_id}/decision")
async def decide_optimization(placement_id: str, payload: OptimizationDecision, ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    ctx = _require_hq(ctx)
    if not ObjectId.is_valid(placement_id):
        raise HTTPException(status_code=400, detail="Invalid placement ID.")
    decision = clean(payload.decision).upper()
    if decision not in {"ACCEPTED", "REJECTED", "PENDING"}:
        raise HTTPException(status_code=400, detail="Decision must be accepted, rejected or pending.")
    placement = await vm_placements_collection.find_one({"_id": ObjectId(placement_id), "tenant_id": ctx["tenant_id"]})
    if not placement:
        raise HTTPException(status_code=404, detail="Placement not found.")
    now = now_utc()
    event = {"decision": decision, "notes": clean(payload.notes), "decided_by": ctx.get("admin_id"), "decided_by_name": ctx.get("admin_name") or "", "decided_at": now}
    await vm_placements_collection.update_one({"_id": placement["_id"]}, {"$set": {"optimization_decision": decision, "optimization_decision_notes": clean(payload.notes), "optimization_decided_at": now, "updated_at": now}, "$push": {"optimization_history": event}})
    return {"message": f"Recommendation {decision.lower()}.", **event}


class ExperimentCreate(BaseModel):
    placement_id: str
    start_date: str
    end_date: str
    proposed_facings: Optional[int] = None
    proposed_display_quantity: Optional[int] = None
    proposed_rack: str = ""
    proposed_shelf: str = ""
    hypothesis: str = ""


@router.get("/experiments")
async def list_experiments(layout_id: Optional[str] = Query(None), ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    ctx = _require_hq(ctx)
    query: Dict[str, Any] = {"tenant_id": ctx["tenant_id"]}
    if clean(layout_id): query["layout_id"] = clean(layout_id)
    return [serialize_doc(row) for row in await vm_experiments_collection.find(query).sort("created_at", -1).to_list(2000)]


@router.post("/experiments", status_code=status.HTTP_201_CREATED)
async def create_experiment(payload: ExperimentCreate, ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    ctx = _require_hq(ctx)
    if not ObjectId.is_valid(payload.placement_id):
        raise HTTPException(status_code=400, detail="Invalid placement ID.")
    placement = await vm_placements_collection.find_one({"_id": ObjectId(payload.placement_id), "tenant_id": ctx["tenant_id"]})
    if not placement:
        raise HTTPException(status_code=404, detail="Placement not found.")
    if placement.get("optimization_decision") != "ACCEPTED":
        raise HTTPException(status_code=409, detail="Accept the optimization recommendation before creating an experiment.")
    validate_campaign_dates(payload.start_date, payload.end_date, required=True)
    before = {key: placement.get(key) for key in ("floor", "zone", "rack", "segment", "shelf", "facings", "display_quantity", "orientation")}
    proposed = dict(before)
    if payload.proposed_facings is not None: proposed["facings"] = max(payload.proposed_facings, 1)
    if payload.proposed_display_quantity is not None: proposed["display_quantity"] = max(payload.proposed_display_quantity, 1)
    if clean(payload.proposed_rack): proposed["rack"] = clean(payload.proposed_rack)
    if clean(payload.proposed_shelf): proposed["shelf"] = clean(payload.proposed_shelf)
    now = now_utc()
    doc = {"tenant_id": ctx["tenant_id"], "layout_id": placement.get("layout_id", ""), "placement_id": payload.placement_id, "store_id": placement.get("store_id", ""), "product_name": placement.get("product_name", ""), "barcode": placement.get("barcode", ""), "status": "DRAFT", "start_date": payload.start_date, "end_date": payload.end_date, "hypothesis": clean(payload.hypothesis), "before": before, "proposed": proposed, "result": None, "decision": "PENDING", "history": [{"action": "CREATED", "by": ctx.get("admin_id"), "by_name": ctx.get("admin_name") or "", "at": now}], "created_at": now, "updated_at": now}
    inserted = await vm_experiments_collection.insert_one(doc)
    return serialize_doc(await vm_experiments_collection.find_one({"_id": inserted.inserted_id}))


class ExperimentAction(BaseModel):
    action: str
    notes: str = ""


@router.post("/experiments/{experiment_id}/action")
async def experiment_action(experiment_id: str, payload: ExperimentAction, ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    ctx = _require_hq(ctx)
    if not ObjectId.is_valid(experiment_id): raise HTTPException(status_code=400, detail="Invalid experiment ID.")
    experiment = await vm_experiments_collection.find_one({"_id": ObjectId(experiment_id), "tenant_id": ctx["tenant_id"]})
    if not experiment: raise HTTPException(status_code=404, detail="Experiment not found.")
    action = clean(payload.action).upper()
    allowed = {"DRAFT": {"APPROVE": "APPROVED"}, "APPROVED": {"LAUNCH": "ACTIVE"}, "COMPLETED": {"RETAIN": "RETAINED", "ROLLBACK": "ROLLBACK_REQUESTED"}}
    next_status = allowed.get(experiment.get("status"), {}).get(action)
    if not next_status: raise HTTPException(status_code=409, detail=f"Cannot {action.lower()} an experiment in {experiment.get('status')} status.")
    now = now_utc()
    event = {"action": action, "notes": clean(payload.notes), "by": ctx.get("admin_id"), "by_name": ctx.get("admin_name") or "", "at": now}
    if action == "LAUNCH":
        placement = await vm_placements_collection.find_one({"_id": ObjectId(experiment["placement_id"]), "tenant_id": ctx["tenant_id"]})
        proposed = experiment.get("proposed", {})
        task = {"tenant_id": ctx["tenant_id"], "layout_id": experiment.get("layout_id"), "placement_id": experiment.get("placement_id"), "experiment_id": experiment_id, "task_type": "OPTIMIZATION_EXPERIMENT", "store_id": experiment.get("store_id"), "store_name": "", "product_id": placement.get("product_id", ""), "barcode": experiment.get("barcode", ""), "product_name": experiment.get("product_name", ""), "sku": placement.get("sku", ""), "floor": proposed.get("floor", ""), "zone": proposed.get("zone", ""), "rack": proposed.get("rack", ""), "segment": proposed.get("segment", ""), "shelf": proposed.get("shelf", ""), "facings": proposed.get("facings", 1), "display_quantity": proposed.get("display_quantity", 1), "orientation": proposed.get("orientation", "face-out"), "instruction": f"Optimization experiment: {experiment.get('hypothesis') or 'Execute the proposed before/after change.'}", "start_date": experiment.get("start_date"), "end_date": experiment.get("end_date"), "status": "PENDING", "priority": "HIGH", "due_date": experiment.get("start_date"), "before_photo_url": "", "after_photo_url": "", "done_photo_url": "", "submissions": [], "review_history": [], "created_at": now, "updated_at": now}
        await vm_tasks_collection.insert_one(task)
    await vm_experiments_collection.update_one({"_id": experiment["_id"]}, {"$set": {"status": next_status, "decision": action if action in {"RETAIN", "ROLLBACK"} else experiment.get("decision", "PENDING"), "updated_at": now}, "$push": {"history": event}})
    return {"message": f"Experiment {next_status.lower()}.", "status": next_status}


@router.post("/experiments/{experiment_id}/calculate-result")
async def calculate_experiment_result(experiment_id: str, ctx: TenantCtx = Depends(require_department("Visual Merchandising"))):
    ctx = _require_hq(ctx)
    if not ObjectId.is_valid(experiment_id): raise HTTPException(status_code=400, detail="Invalid experiment ID.")
    experiment = await vm_experiments_collection.find_one({"_id": ObjectId(experiment_id), "tenant_id": ctx["tenant_id"]})
    if not experiment: raise HTTPException(status_code=404, detail="Experiment not found.")
    if experiment.get("status") != "ACTIVE": raise HTTPException(status_code=409, detail="Only active experiments can be measured.")
    placement = await vm_placements_collection.find_one({"_id": ObjectId(experiment["placement_id"]), "tenant_id": ctx["tenant_id"]})
    shaped = serialize_doc(placement)
    shaped.update({"start_date": experiment["start_date"], "end_date": experiment["end_date"]})
    stock = await store_stock_collection.find_one({"tenant_id": ctx["tenant_id"], "store_id": experiment.get("store_id"), "barcode": experiment.get("barcode")})
    shaped["current_stock"] = float((stock or {}).get("stockQty") or 0)
    start, end = datetime.fromisoformat(experiment["start_date"]), datetime.fromisoformat(experiment["end_date"])
    duration = max((end.date() - start.date()).days + 1, 1)
    sales = await sales_collection.find({"tenant_id": ctx["tenant_id"], "store_id": experiment.get("store_id"), "type": {"$in": ["sale", "return"]}, "created_at": {"$gte": start - timedelta(days=duration), "$lte": end.replace(hour=23, minute=59, second=59)}}).to_list(100000)
    metrics = calculate_placement_analytics([shaped], sales, experiment["start_date"], experiment["end_date"], now_utc())["rows"][0]
    classification = classify_experiment_result(metrics.get("revenue_uplift_pct"))
    result = {"classification": classification, "before": metrics["before"], "during": metrics["during"], "revenue_uplift_pct": metrics.get("revenue_uplift_pct"), "calculated_at": now_utc()}
    await vm_experiments_collection.update_one({"_id": experiment["_id"]}, {"$set": {"status": "COMPLETED", "result": result, "updated_at": now_utc()}, "$push": {"history": {"action": "RESULT_CALCULATED", "notes": classification, "by": ctx.get("admin_id"), "by_name": ctx.get("admin_name") or "", "at": now_utc()}}})
    return result


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
