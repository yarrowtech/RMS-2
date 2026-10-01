"""Operational Design & Pattern workflow linked to Production tech packs."""
import io
import re
import secrets
from datetime import datetime, timedelta
from typing import Any, Dict

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
import cloudinary
import cloudinary.uploader
import pandas as pd
from ..config import settings

from ..db import (
    design_artworks_collection, design_change_requests_collection,
    design_patterns_collection, design_projects_collection,
    design_queries_collection, design_research_collection, design_samples_collection,
    design_settings_collection,
    daily_production_logs_collection, floor_ops_settings_collection, floor_workers_collection, floor_log_deletions_collection,
    fabric_themes_collection, job_work_orders_collection, sales_collection,
    style_bom_plans_collection, tech_packs_collection,
    fabric_lots_collection, purchaseorders_collection, internal_notifications_collection,
    production_batches_collection,
)
from ..tech_pack_numbering import next_tech_pack_no
from .deps import get_hq_tenant
from .internal_notification_routes import notify as notify_internal

router = APIRouter(prefix="/api/design-pattern", tags=["Design & Pattern"])
cloudinary.config(cloud_name=settings.cloudinary_cloud_name, api_key=settings.cloudinary_api_key, api_secret=settings.cloudinary_api_secret, secure=True)

PROJECT_STATUSES = {"IDEA", "IN_DEVELOPMENT", "PATTERN_DEVELOPMENT", "SAMPLE_DEVELOPMENT", "REVISION_REQUIRED", "AWAITING_APPROVAL", "APPROVED_FOR_PRODUCTION", "RELEASED_TO_PRODUCTION", "ON_HOLD", "REJECTED", "ARCHIVED"}
SAMPLE_DECISIONS = {"PENDING", "APPROVED", "APPROVED_WITH_COMMENTS", "REVISION_REQUIRED", "REJECTED", "RESAMPLE_REQUIRED"}

# Standard pattern-making vocabulary so construction method is picked from a
# fixed list on a Pattern record instead of typed free text each time — makes
# it consistent across patternmakers and filterable/reportable later. Not
# tenant-configurable (unlike DEFAULT_SETTINGS above); this is generic
# garment-construction terminology, not a business preference.
PATTERN_VOCABULARY = {
    "base_block": [
        "Bodice block", "Sleeve block", "Skirt block", "Trouser block",
        "Dress block", "Collar block", "Custom / draped",
    ],
    "seam_types": [
        "Plain (open) seam", "French seam", "Flat-felled seam", "Overlocked seam",
        "Bound seam", "Lapped seam", "Welt seam", "Mock flat-felled seam",
    ],
    "closure_types": [
        "Concealed zipper", "Exposed zipper", "Buttons", "Hooks & eyes",
        "Drawstring", "Elastic", "Snap buttons", "Velcro", "None",
    ],
    "dart_pleat_tuck_details": [
        "Bust dart", "Waist dart", "Box pleat", "Knife pleat", "Accordion pleat",
        "Pin tucks", "Shirring", "Smocking", "None",
    ],
    "hem_finishes": [
        "Blind hem", "Rolled hem", "Bound hem", "Overlocked hem",
        "Double-fold hem", "Lettuce hem", "Raw / unfinished edge",
    ],
}

# Suggested pattern-piece names per garment category, so the piece register
# offers the right starting list (a shirt gets Collar/Placket/Cuff, a pant
# gets Waistband/Pocket) instead of the same generic list for everything.
# Purely a UI convenience — "piece_name" on a pattern piece stays free text,
# so any custom piece not in this list can still be added by typing it.
PIECE_NAME_SUGGESTIONS = {
    "Shirt": ["Front body", "Back body", "Collar", "Collar stand", "Sleeve", "Cuff", "Placket", "Yoke", "Pocket"],
    "T-Shirt": ["Front body", "Back body", "Sleeve", "Neckband/Collar", "Yoke", "Pocket"],
    "Tunic": ["Front body", "Back body", "Sleeve", "Neckline/Collar", "Yoke", "Side slit panel", "Pocket"],
    "Kurta": ["Front body", "Back body", "Sleeve", "Neckline/Collar", "Yoke", "Side slit panel", "Placket"],
    "Dress": ["Front bodice", "Back bodice", "Skirt panel", "Sleeve", "Neckline/Collar", "Waistband", "Zipper facing"],
    "Pant": ["Front panel", "Back panel", "Waistband", "Pocket", "Fly facing", "Hem"],
    "Trouser": ["Front panel", "Back panel", "Waistband", "Pocket", "Fly facing", "Hem"],
    "Skirt": ["Front panel", "Back panel", "Waistband", "Pocket", "Zipper facing", "Hem"],
    "Jacket": ["Front body", "Back body", "Sleeve", "Collar", "Lapel", "Lining", "Pocket"],
}
DEFAULT_PIECE_NAME_SUGGESTIONS = ["Front body", "Back body", "Sleeve", "Collar/Neckline", "Pocket", "Yoke", "Waistband", "Cuff"]

# Garment type / gender options offered on the Floor Log Kiosk (and HQ's own
# manual entry) — a simple pick list so a worker can say "Shirt" / "Pant" /
# "Other" even for a design_no the system doesn't recognise yet, rather than
# only ever getting this from an auto Design Project lookup. Free text is
# still accepted (the kiosk lets "Other" be typed), this is just the common
# starting list. Manual entry, when given, always takes priority over the
# auto-looked-up value from the Design Project — see _lookup_design_context.
GARMENT_TYPE_OPTIONS = ["Shirt", "T-Shirt", "Pant", "Trouser", "Tunic", "Kurta", "Dress", "Skirt", "Jacket", "Other"]
GENDER_SEGMENT_OPTIONS = ["Men", "Women", "Kids", "Unisex"]

# Wastage taxonomy — Fabric & Production module, Step 5. Replaces one generic
# "wastage_mtrs" number with a real breakdown of WHY fabric was lost, so
# management can tell a bad marker from a bad fabric batch from a genuine
# production reject. Scoped per department/stage so a floor worker is only
# ever offered categories that make sense for what they're doing — Cutting
# never sees "Shade issue", QC never sees "Marker waste" — rather than one
# long dropdown everyone defaults to guessing at.
#
# This is only the factory default (10 categories this codebase ships with,
# matching general garment-industry terminology) — it lives inside
# DEFAULT_SETTINGS below, so every tenant can rename, remove, add or re-scope
# these via PUT /settings (settings.wastage_categories), the SAME
# per-tenant-configurable pattern as departments/sample_types/allowance_limits,
# not a hardcoded global. "is_recoverable": true marks fabric that left the
# roll but can still be reused elsewhere (feeds Step 7 — fabric reuse
# matching), as opposed to true scrap which cannot.
DEFAULT_WASTAGE_CATEGORIES = [
    {"code": "marker_waste", "label": "Marker waste", "is_recoverable": False, "departments": ["Cutting"]},
    {"code": "cutting_waste", "label": "Cutting waste", "is_recoverable": False, "departments": ["Cutting"]},
    {"code": "end_loss", "label": "End loss", "is_recoverable": False, "departments": ["Cutting"]},
    {"code": "spreading_loss", "label": "Spreading loss", "is_recoverable": False, "departments": ["Layering", "Cutting"]},
    {"code": "fabric_defect", "label": "Fabric defect", "is_recoverable": False, "departments": ["Layering", "Embroidery"]},
    {"code": "shade_issue", "label": "Shade issue", "is_recoverable": False, "departments": ["Layering"]},
    {"code": "production_waste", "label": "Production waste", "is_recoverable": False, "departments": ["Stitching", "Embroidery", "Pattern Making"]},
    {"code": "rejection", "label": "Rejection", "is_recoverable": False, "departments": ["Stitching", "Embroidery", "Finishing & Packing"]},
    {"code": "recoverable_fabric", "label": "Recoverable fabric", "is_recoverable": True, "departments": ["Cutting"]},
    {"code": "scrap", "label": "Scrap", "is_recoverable": False, "departments": ["Stitching", "Finishing & Packing"]},
]

DEFAULT_SETTINGS = {
    "departments": ["Men", "Women", "Kids Boys", "Kids Girls", "Infant", "Accessories", "Other"],
    "sample_types": ["Proto sample", "Development sample", "Fit sample", "Size-set sample", "Print / embroidery sample", "Wash sample", "Pre-production sample", "Production sample"],
    "default_base_size": "M",
    "default_size_run": "S, M, L, XL",
    # These are approval limits, never automatic wastage. Designers enter
    # every allowance manually on the Tech Pack; crossing the relevant limit
    # sends the pack to HQ for an exception decision.
    "allowance_limits": {
        "PATTERN": {"value": 7, "unit": "inches"},
        "LAYERING": {"value": 7, "unit": "inches_per_lay"},
        "CUTTING": {"value": 5, "unit": "percent"},
        "STITCHING": {"value": 2, "unit": "percent"},
        "FINISHING": {"value": 2, "unit": "percent"},
    },
    # Production-handoff gates. A shop with a full design team keeps all three
    # ON; a solo / production-led shop turns off the ceremony it doesn't run.
    # `release_project` skips a check when its gate is off. Default ON = the
    # exact behaviour before this became configurable.
    "require_sample_approval": True,
    "require_design_head_approval": True,
    "require_production_feasibility": True,
    "wastage_categories": DEFAULT_WASTAGE_CATEGORIES,
}

_GATE_KEYS = ("require_sample_approval", "require_design_head_approval", "require_production_feasibility")

# ─────────────────────────────────────────────────────────────────────────────
# Daily shop-floor KPI logging — Pattern / Layering / Cutting / Stitching /
# Embroidery etc. Floor workers have no login, so a supervisor (Design &
# Pattern or Production & Job Work) logs each entry on their behalf against a
# plain name directory (floor_workers), not a user account. One field set,
# adapted per department via config below, rather than a form per department.
# ─────────────────────────────────────────────────────────────────────────────

# Every numeric/boolean/text field the log form can show. A department's
# config picks a subset of these — adding a new department needs a config
# entry, not new code.
FLOOR_LOG_FIELD_KEYS = {
    "target_qty", "completed_qty", "rework_qty", "rejected_qty",
    "fabric_used_mtrs", "wastage_mtrs", "vendor_name", "on_time", "remarks",
}
FLOOR_LOG_NUMERIC_FIELDS = ("target_qty", "completed_qty", "rework_qty", "rejected_qty", "fabric_used_mtrs", "wastage_mtrs")

DEFAULT_FLOOR_DEPARTMENTS = [
    {"name": "Pattern Making", "fields": ["target_qty", "completed_qty", "rework_qty", "on_time", "remarks"],
     "labels": {"target_qty": "Target patterns", "completed_qty": "Completed patterns", "rework_qty": "Rework qty"}},
    {"name": "Layering", "fields": ["fabric_used_mtrs", "wastage_mtrs", "vendor_name", "on_time", "remarks"],
     "labels": {"fabric_used_mtrs": "Fabric used (mtrs)", "wastage_mtrs": "Wastage (mtrs)", "vendor_name": "Vendor (fabric source)"}},
    {"name": "Cutting", "fields": ["fabric_used_mtrs", "vendor_name", "target_qty", "completed_qty", "rejected_qty", "wastage_mtrs", "on_time", "remarks"],
     "labels": {"target_qty": "Target pcs", "completed_qty": "Cut pcs", "rejected_qty": "Rejected pcs", "fabric_used_mtrs": "Fabric used (mtrs)", "wastage_mtrs": "Wastage (mtrs)", "vendor_name": "Vendor (fabric source)"}},
    {"name": "Stitching", "fields": ["target_qty", "completed_qty", "rework_qty", "rejected_qty", "on_time", "remarks"],
     "labels": {"target_qty": "Target pcs", "completed_qty": "Stitched pcs", "rework_qty": "Rework pcs", "rejected_qty": "Rejected pcs"}},
    {"name": "Embroidery", "fields": ["target_qty", "completed_qty", "rejected_qty", "on_time", "remarks"],
     "labels": {"target_qty": "Target pcs", "completed_qty": "Embroidered pcs", "rejected_qty": "Rejected pcs"}},
]


def _wastage_categories_for(department: str, categories: list = None) -> list:
    """categories = the TENANT's own list (from settings.wastage_categories,
    already merged against the default by _merge_settings) — callers fetch
    this once per request rather than reading a hardcoded global, so a
    tenant's customization is always what's actually enforced. Falls back to
    the factory default only if a tenant has no settings row yet at all."""
    categories = categories if categories else DEFAULT_WASTAGE_CATEGORIES
    if not department:
        matches = categories
    else:
        matches = [c for c in categories if department in (c.get("departments") or [])] or categories
    return [{"code": c["code"], "label": c.get("label") or c["code"], "is_recoverable": bool(c.get("is_recoverable"))} for c in matches]


def _wastage_category_lookup(categories: list = None) -> dict:
    categories = categories if categories else DEFAULT_WASTAGE_CATEGORIES
    return {c["code"]: {"label": c.get("label") or c["code"], "is_recoverable": bool(c.get("is_recoverable"))} for c in categories}


def clean(value: Any, limit: int = 500) -> str:
    return str(value or "").strip()[:limit]

def number(value: Any, default: float = 0) -> float:
    try: return max(0, float(value or default))
    except (TypeError, ValueError): return default

def serialize(row: dict) -> dict:
    result = dict(row)
    result["id"] = str(result.pop("_id"))
    for key, value in list(result.items()):
        if isinstance(value, datetime): result[key] = value.isoformat()
    return result

async def require_design(ctx: dict = Depends(get_hq_tenant)) -> dict:
    depts = set(ctx.get("_managed_departments") or [])
    permissions = set(ctx.get("_permissions") or [])
    if "Design & Pattern" not in depts and "design_pattern" not in permissions:
        raise HTTPException(status_code=403, detail="Design & Pattern department access is required.")
    return ctx

async def require_design_or_production(ctx: dict = Depends(get_hq_tenant)) -> dict:
    depts = set(ctx.get("_managed_departments") or []); permissions = set(ctx.get("_permissions") or [])
    if not ({"Design & Pattern", "Production & Job Work"} & depts or {"design_pattern", "job_work"} & permissions):
        raise HTTPException(status_code=403, detail="Design or Production access is required.")
    return ctx

async def project_or_404(project_id: str, tenant_id: str) -> dict:
    if not ObjectId.is_valid(project_id): raise HTTPException(status_code=400, detail="Invalid design project.")
    row = await design_projects_collection.find_one({"_id": ObjectId(project_id), "tenant_id": tenant_id})
    if not row: raise HTTPException(status_code=404, detail="Design project not found.")
    return row

def _theme_snapshot(theme: dict) -> dict:
    """Stable creative brief copied into a Tech Pack or project handoff."""
    return {
        "id": str(theme["_id"]), "theme_name": theme.get("theme_name", ""),
        "collection": theme.get("collection", ""), "season": theme.get("season", ""),
        "department": theme.get("department", ""), "target_customer": theme.get("target_customer", ""),
        "creative_direction": theme.get("creative_direction", ""), "palette": theme.get("palette", []),
        "moodboard_urls": theme.get("moodboard_urls", []), "document_urls": theme.get("document_urls", []),
        "design_status": theme.get("design_status", "DRAFT"),
    }

async def _design_theme_or_404(theme_id: str, tenant_id: str) -> dict:
    if not ObjectId.is_valid(theme_id):
        raise HTTPException(status_code=400, detail="Invalid collection or theme.")
    theme = await fabric_themes_collection.find_one({"_id": ObjectId(theme_id), "tenant_id": tenant_id, "source_department": "Design & Pattern"})
    if not theme:
        raise HTTPException(status_code=404, detail="Collection or theme not found.")
    return theme

@router.post("/assets", status_code=201)
async def upload_assets(files: list[UploadFile] = File(...), ctx: dict = Depends(require_design)):
    if not files or len(files) > 12: raise HTTPException(status_code=400, detail="Upload between 1 and 12 files at a time.")
    rows = []
    for file in files:
        raw = await file.read()
        if not raw: continue
        if len(raw) > 25 * 1024 * 1024: raise HTTPException(status_code=413, detail=f"{file.filename} exceeds 25 MB.")
        try:
            result = cloudinary.uploader.upload(raw, folder=f"rms/design-pattern/{ctx['tenant_id']}", resource_type="auto", use_filename=True, unique_filename=True)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Could not upload {file.filename}: {exc}")
        rows.append({"name": clean(file.filename, 240), "url": result.get("secure_url") or result.get("url"), "resource_type": result.get("resource_type"), "format": result.get("format"), "bytes": len(raw)})
    return {"message": f"{len(rows)} asset(s) uploaded.", "data": rows}

@router.get("/themes")
async def list_design_themes(ctx: dict = Depends(require_design)):
    rows = []
    query = {"tenant_id": ctx["tenant_id"], "source_department": "Design & Pattern"}
    async for theme in fabric_themes_collection.find(query).sort("updated_at", -1).limit(200):
        item = serialize(theme)
        item["linked_projects"] = await design_projects_collection.count_documents({"tenant_id": ctx["tenant_id"], "theme_id": item["id"]})
        item["linked_tech_packs"] = await tech_packs_collection.count_documents({"tenant_id": ctx["tenant_id"], "theme_id": item["id"]})
        rows.append(item)
    return {"data": rows}

@router.post("/themes", status_code=201)
async def create_design_theme(payload: dict, ctx: dict = Depends(require_design)):
    name = clean(payload.get("theme_name"), 160)
    if not name:
        raise HTTPException(status_code=400, detail="Theme name is required.")
    now = datetime.utcnow()
    palette = payload.get("palette") if isinstance(payload.get("palette"), list) else []
    doc = {
        "tenant_id": ctx["tenant_id"], "theme_name": name,
        "collection": clean(payload.get("collection"), 120), "season": clean(payload.get("season"), 80),
        "department": clean(payload.get("department"), 80), "target_customer": clean(payload.get("target_customer"), 160),
        "target_date": clean(payload.get("target_date"), 20), "creative_direction": clean(payload.get("creative_direction"), 3000),
        "palette": [clean(value, 60) for value in palette if clean(value, 60)][:30],
        "moodboard_urls": [clean(value, 1000) for value in (payload.get("moodboard_urls") or []) if clean(value, 1000)][:30],
        "document_urls": [clean(value, 1000) for value in (payload.get("document_urls") or []) if clean(value, 1000)][:30],
        "design_status": "DRAFT", "source_department": "Design & Pattern",
        "status": "draft", "notes": "", "plan_ids": [], "lines": [], "purchase_orders": [],
        "created_by": ctx.get("admin_id"), "created_at": now, "updated_at": now,
    }
    result = await fabric_themes_collection.insert_one(doc); doc["_id"] = result.inserted_id
    return {"message": f'Collection/theme "{name}" saved as draft.', "data": serialize(doc)}

@router.patch("/themes/{theme_id}")
async def update_design_theme(theme_id: str, payload: dict, ctx: dict = Depends(require_design)):
    theme = await _design_theme_or_404(theme_id, ctx["tenant_id"])
    if theme.get("design_status", "DRAFT") != "DRAFT":
        raise HTTPException(status_code=409, detail="Approved themes are locked. Create a new theme/version for changed creative direction.")
    update = {}
    limits = {"theme_name": 160, "collection": 120, "season": 80, "department": 80, "target_customer": 160, "target_date": 20, "creative_direction": 3000}
    for key, limit in limits.items():
        if key in payload: update[key] = clean(payload.get(key), limit)
    if "theme_name" in update and not update["theme_name"]:
        raise HTTPException(status_code=400, detail="Theme name is required.")
    for key in ("palette", "moodboard_urls", "document_urls"):
        if key in payload:
            raw = payload.get(key) if isinstance(payload.get(key), list) else []
            update[key] = [clean(value, 1000 if key != "palette" else 60) for value in raw if clean(value)][:30]
    update["updated_at"] = datetime.utcnow()
    await fabric_themes_collection.update_one({"_id": theme["_id"]}, {"$set": update})
    return {"message": "Collection/theme draft updated."}

@router.post("/themes/{theme_id}/approve")
async def approve_design_theme(theme_id: str, ctx: dict = Depends(require_design)):
    theme = await _design_theme_or_404(theme_id, ctx["tenant_id"])
    if theme.get("design_status", "DRAFT") != "DRAFT":
        raise HTTPException(status_code=409, detail="Only a draft theme can be approved.")
    if not clean(theme.get("creative_direction"), 3000):
        raise HTTPException(status_code=400, detail="Add the creative direction before approving this theme.")
    now = datetime.utcnow()
    await fabric_themes_collection.update_one({"_id": theme["_id"]}, {"$set": {"design_status": "APPROVED", "approved_at": now, "approved_by": ctx.get("admin_id"), "updated_at": now}})
    return {"message": f'Collection/theme "{theme.get("theme_name", "")}" approved and available to Production and Tech Packs.'}

@router.delete("/themes/{theme_id}")
async def delete_design_theme(theme_id: str, ctx: dict = Depends(require_design)):
    theme = await _design_theme_or_404(theme_id, ctx["tenant_id"])
    if theme.get("design_status", "DRAFT") != "DRAFT":
        raise HTTPException(status_code=409, detail="Approved themes are retained for audit history.")
    used = await design_projects_collection.count_documents({"tenant_id": ctx["tenant_id"], "theme_id": theme_id})
    used += await tech_packs_collection.count_documents({"tenant_id": ctx["tenant_id"], "theme_id": theme_id})
    if used or theme.get("lines") or theme.get("purchase_orders"):
        raise HTTPException(status_code=409, detail="This theme is already in use and cannot be deleted.")
    await fabric_themes_collection.delete_one({"_id": theme["_id"]})
    return {"message": "Unused draft theme deleted."}
@router.get("/workspace")
async def workspace(ctx: dict = Depends(require_design)):
    tenant = ctx["tenant_id"]
    async def rows(collection, limit=300):
        return [serialize(r) async for r in collection.find({"tenant_id": tenant}).sort("updated_at", -1).limit(limit)]
    projects = await rows(design_projects_collection)
    patterns = await rows(design_patterns_collection)
    samples = await rows(design_samples_collection)
    queries = await rows(design_queries_collection)
    research = await rows(design_research_collection)
    artworks = await rows(design_artworks_collection)
    changes = await rows(design_change_requests_collection)
    packs = [serialize(r) async for r in tech_packs_collection.find({"tenant_id": tenant}).sort("updated_at", -1).limit(300)]
    plans = [serialize(r) async for r in style_bom_plans_collection.find({"tenant_id": tenant}).sort("updated_at", -1).limit(300)]
    themes = []
    async for theme in fabric_themes_collection.find({"tenant_id": tenant, "source_department": "Design & Pattern"}).sort("updated_at", -1).limit(200):
        item = serialize(theme)
        item["linked_projects"] = await design_projects_collection.count_documents({"tenant_id": tenant, "theme_id": item["id"]})
        item["linked_tech_packs"] = await tech_packs_collection.count_documents({"tenant_id": tenant, "theme_id": item["id"]})
        themes.append(item)
    return {"themes": themes, "projects": projects, "patterns": patterns, "samples": samples, "queries": queries, "research": research, "artworks": artworks, "change_requests": changes, "tech_packs": packs, "material_plans": plans}

@router.get("/collaboration")
async def collaboration(ctx: dict = Depends(require_design_or_production)):
    tenant = ctx["tenant_id"]
    projects = [serialize(r) async for r in design_projects_collection.find({"tenant_id": tenant}, {"design_no": 1, "style_name": 1, "status": 1, "updated_at": 1}).sort("updated_at", -1).limit(300)]
    queries = [serialize(r) async for r in design_queries_collection.find({"tenant_id": tenant}).sort("updated_at", -1).limit(300)]
    changes = [serialize(r) async for r in design_change_requests_collection.find({"tenant_id": tenant}).sort("updated_at", -1).limit(300)]
    samples = [serialize(r) async for r in design_samples_collection.find({"tenant_id": tenant}).sort("updated_at", -1).limit(300)]
    today = datetime.utcnow().date().isoformat()
    notifications = ([{"kind":"QUERY", "title":q["query_no"], "message":q.get("description",""), "priority":q.get("priority","MEDIUM")} for q in queries if q.get("status") not in {"RESOLVED","CLOSED"}] +
        [{"kind":"CHANGE", "title":c["change_no"], "message":c.get("reason",""), "priority":"HIGH"} for c in changes if c.get("status")=="PENDING_PRODUCTION_REVIEW"] +
        [{"kind":"OVERDUE_SAMPLE", "title":s["sample_no"], "message":f"Sample for {s.get('design_no')} was due {s.get('required_date')}", "priority":"URGENT"} for s in samples if s.get("decision")=="PENDING" and s.get("required_date") and s["required_date"] < today])
    return {"projects": projects, "queries": queries, "change_requests": changes, "samples": samples, "notifications": notifications}

@router.get("/insights")
async def insights(ctx: dict = Depends(require_design)):
    tenant=ctx["tenant_id"]; projects=[r async for r in design_projects_collection.find({"tenant_id":tenant})]
    samples=[r async for r in design_samples_collection.find({"tenant_id":tenant})]; plans=[r async for r in style_bom_plans_collection.find({"tenant_id":tenant})]
    sales_by_design={}
    async for row in sales_collection.find({"tenant_id":tenant}, {"CAT1":1,"category1":1,"BILLQTY":1,"quantity":1}):
        key=clean(row.get("CAT1") or row.get("category1"),120); sales_by_design[key]=sales_by_design.get(key,0)+number(row.get("BILLQTY") or row.get("quantity"))
    plan_by_id={str(p["_id"]):p for p in plans}; rows=[]
    for p in projects:
        plan=plan_by_id.get(p.get("material_plan_id")); material_cost=sum(number(x.get("required_quantity"))*number(x.get("rate")) for x in (plan or {}).get("materials",[]))
        sample_cost=sum(number(s.get("actual_cost") or s.get("estimated_cost")) for s in samples if s.get("project_id")==str(p["_id"]))
        rows.append({"project_id":str(p["_id"]),"design_no":p.get("design_no"),"style_name":p.get("style_name"),"status":p.get("status"),"material_cost":round(material_cost,2),"sample_cost":round(sample_cost,2),"target_cost":number(p.get("target_cost")),"sales_units":round(sales_by_design.get(p.get("design_no"),0),2)})
    return {"data":rows}

def _merge_settings(stored: dict) -> dict:
    merged = dict(DEFAULT_SETTINGS)
    for key in DEFAULT_SETTINGS:
        value = (stored or {}).get(key)
        if isinstance(DEFAULT_SETTINGS[key], dict):
            if isinstance(value, dict):
                merged[key] = {**DEFAULT_SETTINGS[key], **value}
        elif isinstance(DEFAULT_SETTINGS[key], list):
            if isinstance(value, list) and value:
                merged[key] = value
        elif isinstance(DEFAULT_SETTINGS[key], bool):
            if isinstance(value, bool):
                merged[key] = value
        elif value not in (None, ""):
            merged[key] = value
    return merged

@router.get("/settings")
async def get_settings(ctx: dict = Depends(require_design)):
    stored = await design_settings_collection.find_one({"tenant_id": ctx["tenant_id"]})
    return {"status": "success", "data": _merge_settings(stored or {})}

@router.put("/settings")
async def save_settings(payload: dict, ctx: dict = Depends(require_design)):
    def string_list(raw, fallback):
        items = [clean(x, 60) for x in raw] if isinstance(raw, list) else []
        items = [x for x in items if x][:60]
        return items or fallback
    raw_limits = payload.get("allowance_limits") if isinstance(payload.get("allowance_limits"), dict) else {}
    allowance_limits = {}
    for process, fallback in DEFAULT_SETTINGS["allowance_limits"].items():
        supplied = raw_limits.get(process) if isinstance(raw_limits.get(process), dict) else {}
        allowance_limits[process] = {
            "value": min(1000.0, number(supplied.get("value"), fallback["value"])),
            "unit": clean(supplied.get("unit"), 40) or fallback["unit"],
        }
    # Wastage categories (Fabric & Production, Step 5) — a tenant can rename,
    # remove, add or re-scope these to their own departments. Each row needs
    # at least a code; a blank label falls back to the code itself, and a
    # blank/missing departments list means "offer this category everywhere"
    # (same as _wastage_categories_for's own fallback). Duplicate codes are
    # dropped (first one wins) so two rows can never silently collide.
    raw_categories = payload.get("wastage_categories") if isinstance(payload.get("wastage_categories"), list) else []
    wastage_categories = []
    seen_codes = set()
    for row in raw_categories[:40]:
        if not isinstance(row, dict):
            continue
        code = clean(row.get("code"), 60).lower().replace(" ", "_")
        if not code or code in seen_codes:
            continue
        seen_codes.add(code)
        wastage_categories.append({
            "code": code,
            "label": clean(row.get("label"), 80) or code,
            "is_recoverable": bool(row.get("is_recoverable")),
            "departments": [clean(d, 80) for d in (row.get("departments") or []) if clean(d, 80)][:30],
        })
    doc = {
        "departments": string_list(payload.get("departments"), DEFAULT_SETTINGS["departments"]),
        "sample_types": string_list(payload.get("sample_types"), DEFAULT_SETTINGS["sample_types"]),
        "default_base_size": clean(payload.get("default_base_size"), 16) or DEFAULT_SETTINGS["default_base_size"],
        "default_size_run": clean(payload.get("default_size_run"), 160) or DEFAULT_SETTINGS["default_size_run"],
        "allowance_limits": allowance_limits,
        "wastage_categories": wastage_categories or DEFAULT_WASTAGE_CATEGORIES,
        **{key: payload.get(key, True) is not False for key in _GATE_KEYS},
        "tenant_id": ctx["tenant_id"],
        "updated_at": datetime.utcnow(),
        "updated_by": ctx.get("admin_name") or ctx.get("admin_email") or "",
    }
    await design_settings_collection.update_one({"tenant_id": ctx["tenant_id"]}, {"$set": doc}, upsert=True)
    return {"status": "success", "message": "Design & Pattern settings saved.", "data": _merge_settings(doc)}

@router.post("/projects", status_code=201)
async def create_project(payload: dict, ctx: dict = Depends(require_design)):
    style = clean(payload.get("style_name"), 160)
    if not style: raise HTTPException(status_code=400, detail="Style name is required.")
    now = datetime.utcnow(); tenant = ctx["tenant_id"]
    theme_id = clean(payload.get("theme_id"), 40)
    linked_theme = await _design_theme_or_404(theme_id, tenant) if theme_id else None
    seq = await design_projects_collection.count_documents({"tenant_id": tenant}) + 1
    row = {
        "tenant_id": tenant, "design_no": clean(payload.get("design_no"), 120) or f"DES-{now.strftime('%y%m%d')}-{seq:04d}",
        "style_name": style, "department": clean(payload.get("department"), 80) or (linked_theme or {}).get("department", ""), "category": clean(payload.get("category"), 100),
        "theme_id": theme_id or None, "theme": clean(payload.get("theme"), 120) or (linked_theme or {}).get("theme_name", ""),
        "collection": clean(payload.get("collection"), 120) or (linked_theme or {}).get("collection", ""), "season": clean(payload.get("season"), 80) or (linked_theme or {}).get("season", ""),
        "designer": clean(payload.get("designer"), 120), "target_customer": clean(payload.get("target_customer"), 160) or (linked_theme or {}).get("target_customer", ""),
        "target_cost": number(payload.get("target_cost")), "planned_quantity": number(payload.get("planned_quantity")),
        "launch_date": clean(payload.get("launch_date"), 20), "priority": clean(payload.get("priority"), 30) or "MEDIUM",
        "description": clean(payload.get("description"), 2000), "moodboard_urls": [clean(x, 1000) for x in payload.get("moodboard_urls", []) if clean(x)],
        "document_urls": [clean(x, 1000) for x in payload.get("document_urls", []) if clean(x)], "status": "IDEA", "tech_pack_id": None, "material_plan_id": None,
        "created_by": ctx.get("admin_id"), "created_at": now, "updated_at": now,
    }
    if await design_projects_collection.find_one({"tenant_id": tenant, "design_no": row["design_no"]}):
        raise HTTPException(status_code=409, detail="This design number already exists.")
    result = await design_projects_collection.insert_one(row); row["_id"] = result.inserted_id
    return {"message": f"Design project {row['design_no']} created.", "data": serialize(row)}

@router.patch("/projects/{project_id}")
async def update_project(project_id: str, payload: dict, ctx: dict = Depends(require_design)):
    row = await project_or_404(project_id, ctx["tenant_id"])
    allowed = {"style_name", "department", "category", "theme", "collection", "season", "designer", "target_customer", "launch_date", "priority", "description"}
    update = {k: clean(payload[k], 2000 if k == "description" else 160) for k in allowed if k in payload}
    if "theme_id" in payload:
        theme_id = clean(payload.get("theme_id"), 40)
        linked_theme = await _design_theme_or_404(theme_id, ctx["tenant_id"]) if theme_id else None
        update["theme_id"] = theme_id or None
        if linked_theme:
            update.update({
                "theme": linked_theme.get("theme_name", ""), "collection": linked_theme.get("collection", ""),
                "season": linked_theme.get("season", ""), "department": linked_theme.get("department", ""),
                "target_customer": linked_theme.get("target_customer", ""),
            })
    if "status" in payload:
        status = clean(payload["status"], 40).upper()
        if status not in PROJECT_STATUSES: raise HTTPException(status_code=400, detail="Invalid project status.")
        update["status"] = status
    update["updated_at"] = datetime.utcnow()
    for key in ("moodboard_urls", "document_urls"):
        if key in payload: update[key] = [clean(x, 1000) for x in payload[key] if clean(x)][:30]
    await design_projects_collection.update_one({"_id": row["_id"]}, {"$set": update})
    return {"message": "Design project updated."}

@router.post("/projects/{project_id}/approval")
async def record_approval(project_id: str, payload: dict, ctx: dict = Depends(require_design_or_production)):
    project = await project_or_404(project_id, ctx["tenant_id"])
    approval_type = clean(payload.get("approval_type"), 50).upper()
    if approval_type not in {"DESIGN_HEAD", "PRODUCTION_FEASIBILITY"}: raise HTTPException(status_code=400, detail="Invalid approval type.")
    depts = set(ctx.get("_managed_departments") or []); permissions = set(ctx.get("_permissions") or [])
    if approval_type == "DESIGN_HEAD" and not ("Design & Pattern" in depts or "design_pattern" in permissions): raise HTTPException(status_code=403, detail="Design approval requires Design & Pattern access.")
    if approval_type == "PRODUCTION_FEASIBILITY" and not ("Production & Job Work" in depts or "job_work" in permissions): raise HTTPException(status_code=403, detail="Feasibility approval requires Production access.")
    approval = {"type": approval_type, "decision": clean(payload.get("decision"), 30).upper() or "APPROVED", "note": clean(payload.get("note"), 1000), "by": ctx.get("admin_name"), "at": datetime.utcnow()}
    await design_projects_collection.update_one({"_id": project["_id"]}, {"$pull": {"approvals": {"type": approval_type}}})
    await design_projects_collection.update_one({"_id": project["_id"]}, {"$push": {"approvals": approval}, "$set": {"updated_at": datetime.utcnow()}})
    return {"message": f"{approval_type.replace('_', ' ').title()} decision recorded."}

@router.get("/pattern-vocabulary")
async def get_pattern_vocabulary(ctx: dict = Depends(require_design)):
    return {"status": "success", "data": {**PATTERN_VOCABULARY, "piece_name_suggestions": PIECE_NAME_SUGGESTIONS, "default_piece_name_suggestions": DEFAULT_PIECE_NAME_SUGGESTIONS}}

@router.post("/patterns", status_code=201)
async def create_pattern(payload: dict, ctx: dict = Depends(require_design)):
    project = await project_or_404(clean(payload.get("project_id"), 40), ctx["tenant_id"])
    version = clean(payload.get("version"), 30) or "v1"; now = datetime.utcnow()
    seq = await design_patterns_collection.count_documents({"tenant_id": ctx["tenant_id"]}) + 1
    row = {"tenant_id": ctx["tenant_id"], "project_id": str(project["_id"]), "design_no": project["design_no"],
           "pattern_no": clean(payload.get("pattern_no"), 100) or f"PAT-{now.strftime('%y%m%d')}-{seq:04d}", "pattern_name": clean(payload.get("pattern_name"), 160),
           "version": version, "base_size": clean(payload.get("base_size"), 30), "sizes": [clean(x, 20) for x in payload.get("sizes", []) if clean(x, 20)],
           "measurement_rows": [{"point": clean(r.get("point"), 80), "base_value": clean(r.get("base_value"), 30), "grades": {clean(k,20): clean(v,30) for k,v in (r.get("grades") or {}).items()}} for r in payload.get("measurement_rows", []) if isinstance(r, dict) and clean(r.get("point"))][:100],
           "fabric_width": clean(payload.get("fabric_width"), 50), "consumption_per_unit": number(payload.get("consumption_per_unit")),
           "wastage_pct": number(payload.get("wastage_pct")), "marker_length": clean(payload.get("marker_length"), 50), "marker_efficiency": number(payload.get("marker_efficiency")),
           # Size ratio (grading) — set once per pattern so an order/batch
           # quantity can be auto-split into planned per-size cut quantities
           # (see /patterns/{id}/size-plan below) instead of anyone doing
           # that maths by hand. consumption_per_unit is an optional per-size
           # override of the pattern-level figure above, since a larger size
           # genuinely uses more fabric than a smaller one.
           "size_ratio": [
               {"size": clean(r.get("size"), 20), "ratio_pct": number(r.get("ratio_pct")), "consumption_per_unit": number(r.get("consumption_per_unit")) or None}
               for r in (payload.get("size_ratio") or []) if isinstance(r, dict) and clean(r.get("size"), 20)
           ][:20],
           "seam_allowance": clean(payload.get("seam_allowance"), 100), "shrinkage_allowance": clean(payload.get("shrinkage_allowance"), 100),
           # Structured construction vocabulary — picked from a fixed list
           # (PATTERN_VOCABULARY below) instead of typed free text, so
           # construction method is consistent and filterable across styles.
           # "notes" still stays free text for anything non-standard.
           "base_block": clean(payload.get("base_block"), 60),
           "seam_types": [clean(x, 60) for x in (payload.get("seam_types") or []) if clean(x, 60)][:20],
           "closure_types": [clean(x, 60) for x in (payload.get("closure_types") or []) if clean(x, 60)][:20],
           "dart_pleat_tuck_details": [clean(x, 60) for x in (payload.get("dart_pleat_tuck_details") or []) if clean(x, 60)][:20],
           "hem_finishes": [clean(x, 60) for x in (payload.get("hem_finishes") or []) if clean(x, 60)][:20],
           "pattern_pieces": [],
           # Pattern family — a reusable base-silhouette tag (e.g. "Classic
           # Shirt", "Straight Pant") that groups patterns across DIFFERENT
           # design numbers, so the same block can be found and reused
           # instead of every new design starting construction from scratch.
           # variation_notes is the short "what's different" line (e.g. "same
           # base, Mandarin collar instead of classic") shown in the library.
           # Both optional and free text — nothing here blocks a pattern with
           # no family from being created exactly as before.
           "family_name": clean(payload.get("family_name"), 120), "variation_notes": clean(payload.get("variation_notes"), 500),
           "cloned_from": clean(payload.get("cloned_from"), 40) or None,
           "file_urls": [clean(x, 1000) for x in payload.get("file_urls", []) if clean(x)][:30], "notes": clean(payload.get("notes"), 2000), "status": clean(payload.get("status"), 40) or "DRAFT",
           "created_by": ctx.get("admin_id"), "created_at": now, "updated_at": now}
    result = await design_patterns_collection.insert_one(row); row["_id"] = result.inserted_id
    await design_projects_collection.update_one({"_id": project["_id"]}, {"$set": {"status": "PATTERN_DEVELOPMENT", "updated_at": now}})
    return {"message": f"Pattern {row['pattern_no']} saved.", "data": serialize(row)}

@router.get("/patterns/families")
async def list_pattern_families(ctx: dict = Depends(require_design)):
    """Distinct family names in use for this tenant, with how many pattern
    variations exist under each — powers the family picker/typeahead on the
    pattern form, and the entry point into the library browse below."""
    cursor = design_patterns_collection.aggregate([
        {"$match": {"tenant_id": ctx["tenant_id"], "family_name": {"$nin": [None, ""]}}},
        {"$group": {"_id": "$family_name", "variations": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ])
    families = [{"family_name": row["_id"], "variations": row["variations"]} async for row in cursor]
    return {"status": "success", "data": families}

@router.get("/patterns/library")
async def browse_pattern_library(family: str = "", ctx: dict = Depends(require_design)):
    """Every pattern tagged with the given family, across ALL design
    numbers/projects — not scoped to one project the way the pattern list
    inside a project is. This is the "does a shirt pattern like this already
    exist" check: before starting a new pattern from scratch, search here
    for the base block/family and reuse or clone the closest match."""
    family = clean(family, 120)
    if not family:
        raise HTTPException(status_code=400, detail="family is required.")
    cursor = design_patterns_collection.find({"tenant_id": ctx["tenant_id"], "family_name": family}).sort("created_at", -1)
    rows = [serialize(row) async for row in cursor]
    for row in rows:
        first_image = next((p.get("image_front") for p in (row.get("pattern_pieces") or []) if p.get("image_front")), "")
        row["preview_image"] = first_image
    return {"status": "success", "data": rows}

@router.post("/patterns/{pattern_id}/clone", status_code=201)
async def clone_pattern(pattern_id: str, payload: dict, ctx: dict = Depends(require_design)):
    """Start a new design's pattern from an existing one in the same family
    instead of from scratch — copies construction vocabulary, measurements,
    size ratio and pattern pieces (including their reference images) onto a
    NEW pattern tied to a different design_no/project. Unlike /revision
    (which creates a new version of the SAME design), this targets a
    DIFFERENT project — that's what makes it a variation, not a revision."""
    if not ObjectId.is_valid(pattern_id):
        raise HTTPException(status_code=400, detail="Invalid pattern.")
    source = await design_patterns_collection.find_one({"_id": ObjectId(pattern_id), "tenant_id": ctx["tenant_id"]})
    if not source:
        raise HTTPException(status_code=404, detail="Source pattern not found.")
    project = await project_or_404(clean(payload.get("project_id"), 40), ctx["tenant_id"])
    now = datetime.utcnow()
    seq = await design_patterns_collection.count_documents({"tenant_id": ctx["tenant_id"]}) + 1
    row = {
        "tenant_id": ctx["tenant_id"], "project_id": str(project["_id"]), "design_no": project["design_no"],
        "pattern_no": f"PAT-{now.strftime('%y%m%d')}-{seq:04d}", "pattern_name": clean(payload.get("pattern_name"), 160) or source.get("pattern_name", ""),
        "version": "v1", "base_size": source.get("base_size", ""), "sizes": list(source.get("sizes") or []),
        "measurement_rows": list(source.get("measurement_rows") or []),
        "fabric_width": source.get("fabric_width", ""), "consumption_per_unit": source.get("consumption_per_unit"),
        "wastage_pct": source.get("wastage_pct"), "marker_length": source.get("marker_length", ""), "marker_efficiency": source.get("marker_efficiency"),
        "size_ratio": list(source.get("size_ratio") or []),
        "seam_allowance": source.get("seam_allowance", ""), "shrinkage_allowance": source.get("shrinkage_allowance", ""),
        "base_block": source.get("base_block", ""), "seam_types": list(source.get("seam_types") or []),
        "closure_types": list(source.get("closure_types") or []), "dart_pleat_tuck_details": list(source.get("dart_pleat_tuck_details") or []),
        "hem_finishes": list(source.get("hem_finishes") or []),
        # Pieces (and their front/back/side images) copy over as-is; the
        # patternmaker then edits just the pieces that make this a
        # variation (e.g. swap the Collar piece), not every piece again.
        "pattern_pieces": [dict(p, piece_id=secrets.token_hex(8)) for p in (source.get("pattern_pieces") or [])],
        "family_name": source.get("family_name", ""),
        "variation_notes": clean(payload.get("variation_notes"), 500),
        "cloned_from": pattern_id,
        "file_urls": [], "notes": clean(payload.get("notes"), 2000), "status": "DRAFT",
        "created_by": ctx.get("admin_id"), "created_at": now, "updated_at": now,
    }
    result = await design_patterns_collection.insert_one(row); row["_id"] = result.inserted_id
    await design_projects_collection.update_one({"_id": project["_id"]}, {"$set": {"status": "PATTERN_DEVELOPMENT", "updated_at": now}})
    return {"message": f"Pattern {row['pattern_no']} created as a variation of {source.get('pattern_no')}.", "data": serialize(row)}

@router.post("/patterns/{pattern_id}/revision", status_code=201)
async def revise_pattern(pattern_id: str, payload: dict, ctx: dict = Depends(require_design)):
    if not ObjectId.is_valid(pattern_id): raise HTTPException(status_code=400, detail="Invalid pattern.")
    source = await design_patterns_collection.find_one({"_id": ObjectId(pattern_id), "tenant_id": ctx["tenant_id"]})
    if not source: raise HTTPException(status_code=404, detail="Pattern not found.")
    source.pop("_id"); now = datetime.utcnow(); source.update({"version": clean(payload.get("version"),30) or f"{source.get('version','v1')}-revision", "status":"DRAFT", "revision_reason":clean(payload.get("reason"),1000), "revised_from":pattern_id, "created_at":now, "updated_at":now, "created_by":ctx.get("admin_id")})
    result = await design_patterns_collection.insert_one(source); source["_id"] = result.inserted_id
    return {"message": f"Pattern revision {source['version']} created.", "data": serialize(source)}


@router.post("/patterns/{pattern_id}/pieces", status_code=201)
async def add_pattern_piece(pattern_id: str, payload: dict, ctx: dict = Depends(require_design)):
    if not ObjectId.is_valid(pattern_id):
        raise HTTPException(status_code=400, detail="Invalid pattern.")
    pattern = await design_patterns_collection.find_one({"_id": ObjectId(pattern_id), "tenant_id": ctx["tenant_id"]})
    if not pattern:
        raise HTTPException(status_code=404, detail="Pattern not found.")
    if str(pattern.get("status") or "DRAFT").upper() != "DRAFT":
        raise HTTPException(status_code=409, detail="Create a pattern revision before changing its pieces.")
    piece_name = clean(payload.get("piece_name"), 120)
    if not piece_name:
        raise HTTPException(status_code=400, detail="Pattern piece name is required.")
    piece = {
        "piece_id": secrets.token_hex(8), "piece_name": piece_name,
        "piece_code": clean(payload.get("piece_code"), 60), "callout_no": clean(payload.get("callout_no"), 40),
        "fabric_reference": clean(payload.get("fabric_reference"), 120), "cut_quantity": clean(payload.get("cut_quantity"), 40),
        "grainline": clean(payload.get("grainline"), 120), "seam_allowance": clean(payload.get("seam_allowance"), 80),
        "grading_note": clean(payload.get("grading_note"), 500), "file_url": clean(payload.get("file_url"), 1000),
        # Front/back/side reference images of THIS piece (e.g. what the
        # collar looks like from each view) — separate from file_url, which
        # stays for the CAD/DXF/PDF technical file. Purely visual reference.
        "image_front": clean(payload.get("image_front"), 1000), "image_back": clean(payload.get("image_back"), 1000),
        "image_side": clean(payload.get("image_side"), 1000),
        "notes": clean(payload.get("notes"), 700), "created_at": datetime.utcnow(),
    }
    await design_patterns_collection.update_one({"_id": pattern["_id"]}, {"$push": {"pattern_pieces": piece}, "$set": {"updated_at": datetime.utcnow()}})
    return {"message": f"{piece_name} added to {pattern.get('pattern_no')}.", "data": piece}


@router.delete("/patterns/{pattern_id}/pieces/{piece_id}")
async def delete_pattern_piece(pattern_id: str, piece_id: str, ctx: dict = Depends(require_design)):
    if not ObjectId.is_valid(pattern_id):
        raise HTTPException(status_code=400, detail="Invalid pattern.")
    pattern = await design_patterns_collection.find_one({"_id": ObjectId(pattern_id), "tenant_id": ctx["tenant_id"]})
    if not pattern:
        raise HTTPException(status_code=404, detail="Pattern not found.")
    if str(pattern.get("status") or "DRAFT").upper() != "DRAFT":
        raise HTTPException(status_code=409, detail="Create a pattern revision before changing its pieces.")
    await design_patterns_collection.update_one({"_id": pattern["_id"]}, {"$pull": {"pattern_pieces": {"piece_id": piece_id}}, "$set": {"updated_at": datetime.utcnow()}})
    return {"message": "Pattern piece removed."}

def _compute_size_plan(pattern: dict, qty: float) -> dict:
    """Shared by /size-plan and /fabric-requirement below — auto-splits an
    order/batch quantity into planned per-size cut quantities using the
    pattern's size_ratio (largest-remainder rounding, so pieces always sum
    back exactly to qty, never drift by ±1-2 pcs the way a flat round() per
    size can), and the fabric each size needs using its own consumption
    figure or the pattern-level one if a size has no override. Nobody
    re-types this ratio or does this arithmetic by hand."""
    size_ratio = pattern.get("size_ratio") or []
    qty = max(0, number(qty))
    if not size_ratio:
        return {"pattern_id": str(pattern["_id"]), "design_no": pattern.get("design_no"), "quantity": qty, "sizes": [], "total_fabric_required": 0.0, "note": "No size ratio set on this pattern yet."}

    total_ratio = sum(number(r.get("ratio_pct")) for r in size_ratio) or 100
    default_consumption = number(pattern.get("consumption_per_unit"))
    wastage_pct = number(pattern.get("wastage_pct"))

    raw = [(r, qty * number(r.get("ratio_pct")) / total_ratio) for r in size_ratio]
    floors = [(r, int(v), v - int(v)) for r, v in raw]
    allocated = sum(f for _, f, _ in floors)
    remainder = int(round(qty - allocated))
    floors.sort(key=lambda x: -x[2])
    sizes_out = []
    for i, (r, base, _frac) in enumerate(floors):
        pcs = base + (1 if i < remainder else 0)
        consumption = number(r.get("consumption_per_unit")) or default_consumption
        fabric_needed = round(pcs * consumption * (1 + wastage_pct / 100), 3)
        sizes_out.append({
            "size": r.get("size"), "ratio_pct": number(r.get("ratio_pct")),
            "planned_qty": pcs, "consumption_per_unit": consumption, "fabric_required": fabric_needed,
        })
    return {
        "pattern_id": str(pattern["_id"]), "design_no": pattern.get("design_no"), "quantity": qty,
        "sizes": sizes_out, "total_fabric_required": round(sum(s["fabric_required"] for s in sizes_out), 3),
    }


@router.get("/patterns/{pattern_id}/size-plan")
async def pattern_size_plan(pattern_id: str, quantity: float = 0, ctx: dict = Depends(require_design_or_production)):
    if not ObjectId.is_valid(pattern_id):
        raise HTTPException(status_code=400, detail="Invalid pattern.")
    pattern = await design_patterns_collection.find_one({"_id": ObjectId(pattern_id), "tenant_id": ctx["tenant_id"]})
    if not pattern:
        raise HTTPException(status_code=404, detail="Pattern not found.")
    return {"status": "success", "data": _compute_size_plan(pattern, quantity)}


# Same "open" statuses logistics_routes.py's inbound-PO dashboard uses —
# duplicated locally (rather than imported) to avoid a cross-module coupling
# for one small constant, matching how internal_escalation_routes.py handles
# its own small shared helper.
_OPEN_PO_STATUSES = ["SentToVendor", "VendorSubmitted", "Approved"]

FABRIC_SHORTFALL_NOTIFY_COOLDOWN_HOURS = 20  # a design's requirement can be checked many times a day; don't re-notify every time


async def _open_po_qty_for_design(tenant_id: str, design_no: str) -> float:
    """Sums the still-outstanding quantity (not yet received) across every
    open PO line item tagged with this design_no, so the net-to-purchase
    calculation below doesn't double-count fabric that's already on order."""
    if not design_no:
        return 0.0
    total = 0.0
    cursor = purchaseorders_collection.find({"tenant_id": tenant_id, "status": {"$in": _OPEN_PO_STATUSES}})
    async for po in cursor:
        for item in po.get("items") or []:
            if item.get("design_no") != design_no:
                continue
            pending = item.get("pendingQty")
            if pending is None:
                original = number(item.get("originalQty") or item.get("quantity"))
                received = number(item.get("receivedQty"))
                pending = max(0.0, original - received)
            total += number(pending)
    return round(total, 3)


@router.get("/fabric-requirement")
async def fabric_requirement(pattern_id: str, quantity: float = 0, ctx: dict = Depends(require_design_or_production)):
    """Step 3 of the Fabric & Production plan — automatic fabric requirement
    and net-to-purchase. Given a pattern + order/batch quantity:
      required        = _compute_size_plan's total_fabric_required (Step 2)
      available        = sum of closing_balance across fabric lots (Step 1)
                          already linked to this design_no
      open_po_qty      = fabric already on order but not yet received
      net_to_purchase  = max(0, required - available - open_po_qty)
    Nothing here is typed by hand — Design/Production just picks a pattern
    and a quantity and gets a purchase-ready number back."""
    if not ObjectId.is_valid(pattern_id):
        raise HTTPException(status_code=400, detail="Invalid pattern.")
    pattern = await design_patterns_collection.find_one({"_id": ObjectId(pattern_id), "tenant_id": ctx["tenant_id"]})
    if not pattern:
        raise HTTPException(status_code=404, detail="Pattern not found.")
    plan = _compute_size_plan(pattern, quantity)
    design_no = pattern.get("design_no") or ""

    available = 0.0
    async for lot in fabric_lots_collection.find({"tenant_id": ctx["tenant_id"], "design_no": design_no}):
        available += number(lot.get("closing_balance"))
    available = round(available, 3)

    open_po_qty = await _open_po_qty_for_design(ctx["tenant_id"], design_no)
    required = number(plan.get("total_fabric_required"))
    net_to_purchase = round(max(0.0, required - available - open_po_qty), 3)

    return {
        "status": "success",
        "data": {
            **plan,
            "fabric_available": available,
            "open_po_qty": open_po_qty,
            "net_to_purchase": net_to_purchase,
        },
    }


@router.post("/fabric-requirement/notify-shortfall")
async def notify_fabric_shortfall(payload: dict, ctx: dict = Depends(require_design_or_production)):
    """Explicit action (a button on the requirement screen) rather than a
    side-effect of the GET above, so checking the requirement repeatedly
    while planning a batch never spams Merchandiser Buyer/Inventory — one
    notification per design, then a cooldown, same pattern as the low-stock
    and delayed-PO automations elsewhere in this codebase."""
    pattern_id = clean(payload.get("pattern_id"), 40)
    if not ObjectId.is_valid(pattern_id):
        raise HTTPException(status_code=400, detail="Invalid pattern.")
    pattern = await design_patterns_collection.find_one({"_id": ObjectId(pattern_id), "tenant_id": ctx["tenant_id"]})
    if not pattern:
        raise HTTPException(status_code=404, detail="Pattern not found.")
    plan = _compute_size_plan(pattern, payload.get("quantity"))
    design_no = pattern.get("design_no") or ""

    available = 0.0
    async for lot in fabric_lots_collection.find({"tenant_id": ctx["tenant_id"], "design_no": design_no}):
        available += number(lot.get("closing_balance"))
    open_po_qty = await _open_po_qty_for_design(ctx["tenant_id"], design_no)
    required = number(plan.get("total_fabric_required"))
    net_to_purchase = round(max(0.0, required - available - open_po_qty), 3)

    if net_to_purchase <= 0:
        return {"message": "No shortfall to raise — fabric on hand plus open POs already cover this requirement.", "net_to_purchase": 0}

    now = datetime.utcnow()
    cutoff = now - timedelta(hours=FABRIC_SHORTFALL_NOTIFY_COOLDOWN_HOURS)
    recent = await internal_notifications_collection.find_one({
        "tenant_id": ctx["tenant_id"], "type": "fabric_shortfall", "ref_id": design_no, "created_at": {"$gte": cutoff},
    })
    if recent:
        return {"message": "A shortfall alert for this design was already sent recently — not sending a duplicate.", "net_to_purchase": net_to_purchase}

    title = f"Fabric shortfall for {design_no or pattern.get('pattern_no')}: {net_to_purchase} short"
    message = f"Required {required}, on hand {available}, {open_po_qty} already on open PO(s). Net {net_to_purchase} still needs to be purchased."
    # Who actually buys fabric varies by tenant: a retailer-with-manufacturing
    # tenant has a Merchandiser Buyer department for it, but a pure/mostly
    # manufacturer tenant often has no Merchandiser Buyer at all and instead
    # raises fabric purchases straight out of Production & Job Work. notify()
    # targeting a department with no admin managing it is harmless (the
    # notification just sits unread by nobody), so it's safer to alert every
    # department that could plausibly own fabric purchasing than to guess
    # which one this tenant actually uses.
    for department in ("Merchandiser Buyer", "Production & Job Work", "Inventory"):
        await notify_internal(
            ctx["tenant_id"], type="fabric_shortfall", title=title, message=message,
            department=department, ref_type="design_pattern_fabric_requirement", ref_id=design_no, priority="high",
        )
    return {"message": "Shortfall alert sent to Merchandiser Buyer, Production & Job Work and Inventory.", "net_to_purchase": net_to_purchase}


@router.post("/tech-packs/{tech_pack_id}/revision", status_code=201)
async def revise_tech_pack(tech_pack_id: str, payload: dict, ctx: dict = Depends(require_design)):
    if not ObjectId.is_valid(tech_pack_id): raise HTTPException(status_code=400, detail="Invalid tech pack.")
    source = await tech_packs_collection.find_one({"_id": ObjectId(tech_pack_id), "tenant_id": ctx["tenant_id"]})
    if not source: raise HTTPException(status_code=404, detail="Tech pack not found.")
    source.pop("_id"); now=datetime.utcnow()
    source.update({"tech_pack_no":await next_tech_pack_no(ctx["tenant_id"], now), "version":clean(payload.get("version"),30) or f"{source.get('version','v1')}-revision", "status":"Draft", "revision_reason":clean(payload.get("reason"),1000), "revised_from":tech_pack_id, "created_at":now, "updated_at":now, "created_by":ctx.get("admin_id")})
    result=await tech_packs_collection.insert_one(source); source["_id"]=result.inserted_id
    return {"message":f"Tech Pack revision {source['version']} created.", "data":serialize(source)}

@router.post("/samples", status_code=201)
async def create_sample(payload: dict, ctx: dict = Depends(require_design)):
    project = await project_or_404(clean(payload.get("project_id"), 40), ctx["tenant_id"]); now = datetime.utcnow()
    decision = clean(payload.get("decision"), 40).upper() or "PENDING"
    if decision not in SAMPLE_DECISIONS: raise HTTPException(status_code=400, detail="Invalid sample decision.")
    seq = await design_samples_collection.count_documents({"tenant_id": ctx["tenant_id"]}) + 1
    row = {"tenant_id": ctx["tenant_id"], "project_id": str(project["_id"]), "design_no": project["design_no"], "sample_no": f"SMP-{now.strftime('%y%m%d')}-{seq:04d}",
           "sample_type": clean(payload.get("sample_type"), 80) or "Development sample", "pattern_id": clean(payload.get("pattern_id"), 40) or None,
           "quantity": max(1, number(payload.get("quantity"), 1)), "required_date": clean(payload.get("required_date"), 20), "received_date": clean(payload.get("received_date"), 20),
           "assigned_to": clean(payload.get("assigned_to"), 160), "estimated_cost": number(payload.get("estimated_cost")), "actual_cost": number(payload.get("actual_cost")),
           "materials": clean(payload.get("materials"), 1500), "image_urls": [clean(x, 1000) for x in payload.get("image_urls", []) if clean(x)][:20],
           "decision": decision, "fit_result": clean(payload.get("fit_result"), 1000), "construction_result": clean(payload.get("construction_result"), 1000),
           "review_notes": clean(payload.get("review_notes"), 2000), "created_by": ctx.get("admin_id"), "created_at": now, "updated_at": now}
    result = await design_samples_collection.insert_one(row); row["_id"] = result.inserted_id
    status = "AWAITING_APPROVAL" if decision in {"APPROVED", "APPROVED_WITH_COMMENTS"} else "REVISION_REQUIRED" if decision != "PENDING" else "SAMPLE_DEVELOPMENT"
    await design_projects_collection.update_one({"_id": project["_id"]}, {"$set": {"status": status, "updated_at": now}})
    return {"message": f"Sample review {row['sample_no']} saved.", "data": serialize(row)}

@router.patch("/samples/{sample_id}")
async def update_sample(sample_id: str, payload: dict, ctx: dict = Depends(require_design)):
    """Correct or advance an existing sample round (e.g. fill in fit/decision
    once the physical sample comes back) instead of creating a duplicate
    record. Changing the decision re-derives the parent project's status the
    same way create_sample does."""
    if not ObjectId.is_valid(sample_id): raise HTTPException(status_code=400, detail="Invalid sample.")
    sample = await design_samples_collection.find_one({"_id": ObjectId(sample_id), "tenant_id": ctx["tenant_id"]})
    if not sample: raise HTTPException(status_code=404, detail="Sample not found.")
    update: Dict[str, Any] = {}
    for key, limit in {"sample_type": 80, "pattern_id": 40, "required_date": 20, "received_date": 20, "assigned_to": 160, "materials": 1500, "fit_result": 1000, "construction_result": 1000, "review_notes": 2000}.items():
        if key in payload: update[key] = clean(payload[key], limit)
    if "quantity" in payload: update["quantity"] = max(1, number(payload.get("quantity"), sample.get("quantity", 1)))
    if "estimated_cost" in payload: update["estimated_cost"] = number(payload.get("estimated_cost"))
    if "actual_cost" in payload: update["actual_cost"] = number(payload.get("actual_cost"))
    if "image_urls" in payload: update["image_urls"] = [clean(x, 1000) for x in (payload.get("image_urls") or []) if clean(x)][:20]
    if "decision" in payload:
        decision = clean(payload["decision"], 40).upper()
        if decision not in SAMPLE_DECISIONS: raise HTTPException(status_code=400, detail="Invalid sample decision.")
        update["decision"] = decision
    if not update: raise HTTPException(status_code=400, detail="Nothing to update.")
    update["updated_at"] = datetime.utcnow()
    await design_samples_collection.update_one({"_id": sample["_id"]}, {"$set": update})
    if "decision" in update:
        status = "AWAITING_APPROVAL" if update["decision"] in {"APPROVED", "APPROVED_WITH_COMMENTS"} else "REVISION_REQUIRED" if update["decision"] != "PENDING" else "SAMPLE_DEVELOPMENT"
        await design_projects_collection.update_one({"_id": ObjectId(sample["project_id"])}, {"$set": {"status": status, "updated_at": datetime.utcnow()}})
    return {"message": "Sample updated."}

@router.post("/samples/{sample_id}/job-order", status_code=201)
async def create_sample_job_order(sample_id: str, payload: dict, ctx: dict = Depends(require_design_or_production)):
    depts=set(ctx.get("_managed_departments") or []); permissions=set(ctx.get("_permissions") or [])
    if "Production & Job Work" not in depts and "job_work" not in permissions: raise HTTPException(status_code=403, detail="Production approval is required to create a sample job order.")
    if not ObjectId.is_valid(sample_id): raise HTTPException(status_code=400, detail="Invalid sample.")
    sample=await design_samples_collection.find_one({"_id":ObjectId(sample_id),"tenant_id":ctx["tenant_id"]})
    if not sample: raise HTTPException(status_code=404, detail="Sample not found.")
    if sample.get("job_work_order_id"): raise HTTPException(status_code=400, detail="This sample already has a job work order.")
    project=await project_or_404(sample["project_id"],ctx["tenant_id"]); worker=clean(payload.get("job_worker_name") or sample.get("assigned_to"),160)
    if not worker: raise HTTPException(status_code=400, detail="Job worker name is required.")
    now=datetime.utcnow(); seq=await job_work_orders_collection.count_documents({"tenant_id":ctx["tenant_id"]})+1
    pack=await tech_packs_collection.find_one({"tenant_id":ctx["tenant_id"],"design_no":project["design_no"]},sort=[("updated_at",-1)])
    line={"design_no":project["design_no"],"department":project.get("department",""),"product_type":project.get("style_name",""),"quantity":number(sample.get("quantity"),1),"unit":"pcs","rate":0,"remarks":f"{sample.get('sample_type')} · {sample.get('review_notes','')}","tech_pack_id":str(pack["_id"]) if pack else "","image_urls":sample.get("image_urls",[])}
    if pack: line["tech_pack"]={k:pack.get(k) for k in ("tech_pack_no","version","design_no","style_name","department","description","fabric_notes","fabric_references","measurement_rows","construction_notes","artwork_notes","trims_items","colourways","sketch_images","spec_images","details_images","artwork_images","trims_images","colourway_images")}
    order={"tenant_id":ctx["tenant_id"],"order_no":f"JWO-{now.strftime('%y%m%d')}-{seq:04d}","job_worker_name":worker,"assigned_vendor_id":clean(payload.get("vendor_id"),40) or None,"job_work_type":clean(payload.get("job_work_type"),40) or "Stitching","finished_product":f"Sample · {project['style_name']}","expected_quantity":number(sample.get("quantity"),1),"unit":"pcs","design_lines":[line],"due_date":sample.get("required_date",""),"remarks":f"Sample order {sample.get('sample_no')}. {sample.get('materials','')}","materials":[],"outputs":[],"status":"DRAFT","source":"DESIGN_SAMPLE","sample_id":sample_id,"created_by":ctx.get("admin_id"),"created_at":now,"updated_at":now}
    result=await job_work_orders_collection.insert_one(order)
    await design_samples_collection.update_one({"_id":sample["_id"]},{"$set":{"job_work_order_id":str(result.inserted_id),"job_work_order_no":order["order_no"],"assigned_to":worker,"updated_at":now}})
    return {"message":f"Sample job {order['order_no']} created. Issue its material from Job Work Orders.","order_id":str(result.inserted_id)}

@router.post("/queries", status_code=201)
async def create_query(payload: dict, ctx: dict = Depends(require_design_or_production)):
    project = await project_or_404(clean(payload.get("project_id"), 40), ctx["tenant_id"]); now = datetime.utcnow()
    seq = await design_queries_collection.count_documents({"tenant_id": ctx["tenant_id"]}) + 1
    row = {"tenant_id": ctx["tenant_id"], "project_id": str(project["_id"]), "design_no": project["design_no"], "query_no": f"DQ-{now.strftime('%y%m%d')}-{seq:04d}",
           "category": clean(payload.get("category"), 80), "description": clean(payload.get("description"), 2000), "priority": clean(payload.get("priority"), 30) or "MEDIUM",
           "attachment_urls": [clean(x, 1000) for x in payload.get("attachment_urls", []) if clean(x)][:20],
           "response": "", "status": "OPEN", "source_department": ctx.get("department") or "", "raised_by": ctx.get("admin_name"), "created_at": now, "updated_at": now}
    result = await design_queries_collection.insert_one(row); row["_id"] = result.inserted_id
    return {"message": f"Query {row['query_no']} created.", "data": serialize(row)}

@router.patch("/queries/{query_id}")
async def resolve_query(query_id: str, payload: dict, ctx: dict = Depends(require_design_or_production)):
    if not ObjectId.is_valid(query_id): raise HTTPException(status_code=400, detail="Invalid query.")
    status = clean(payload.get("status"), 40).upper() or "RESOLVED"
    if status not in {"OPEN", "ASSIGNED", "CLARIFICATION_PROVIDED", "REVISION_REQUIRED", "RESOLVED", "CLOSED"}: raise HTTPException(status_code=400, detail="Invalid query status.")
    result = await design_queries_collection.update_one({"_id": ObjectId(query_id), "tenant_id": ctx["tenant_id"]}, {"$set": {"status": status, "response": clean(payload.get("response"), 2000), "updated_at": datetime.utcnow()}})
    if not result.matched_count: raise HTTPException(status_code=404, detail="Query not found.")
    return {"message": "Query updated."}

@router.post("/research", status_code=201)
async def create_research(payload: dict, ctx: dict = Depends(require_design)):
    title = clean(payload.get("title"), 200)
    if not title: raise HTTPException(status_code=400, detail="Research title is required.")
    now = datetime.utcnow(); row = {"tenant_id": ctx["tenant_id"], "title": title, "category": clean(payload.get("category"), 80),
        "season": clean(payload.get("season"), 80), "department": clean(payload.get("department"), 80), "market_segment": clean(payload.get("market_segment"), 120),
        "notes": clean(payload.get("notes"), 3000), "tags": [clean(x, 50) for x in payload.get("tags", []) if clean(x)][:30],
        "reference_urls": [clean(x, 1000) for x in payload.get("reference_urls", []) if clean(x)][:30], "created_by": ctx.get("admin_name"), "created_at": now, "updated_at": now}
    result = await design_research_collection.insert_one(row); row["_id"] = result.inserted_id
    return {"message": "Research reference saved.", "data": serialize(row)}

@router.patch("/research/{research_id}")
async def update_research(research_id: str, payload: dict, ctx: dict = Depends(require_design)):
    if not ObjectId.is_valid(research_id): raise HTTPException(status_code=400, detail="Invalid research reference.")
    row = await design_research_collection.find_one({"_id": ObjectId(research_id), "tenant_id": ctx["tenant_id"]})
    if not row: raise HTTPException(status_code=404, detail="Research reference not found.")
    update: Dict[str, Any] = {}
    if "title" in payload:
        title = clean(payload["title"], 200)
        if not title: raise HTTPException(status_code=400, detail="Research title is required.")
        update["title"] = title
    for key, limit in {"category": 80, "season": 80, "department": 80, "market_segment": 120, "notes": 3000}.items():
        if key in payload: update[key] = clean(payload[key], limit)
    if "tags" in payload: update["tags"] = [clean(x, 50) for x in (payload.get("tags") or []) if clean(x)][:30]
    if "reference_urls" in payload: update["reference_urls"] = [clean(x, 1000) for x in (payload.get("reference_urls") or []) if clean(x)][:30]
    if not update: raise HTTPException(status_code=400, detail="Nothing to update.")
    update["updated_at"] = datetime.utcnow()
    await design_research_collection.update_one({"_id": row["_id"]}, {"$set": update})
    return {"message": "Research reference updated."}

@router.post("/artworks", status_code=201)
async def create_artwork(payload: dict, ctx: dict = Depends(require_design)):
    project = await project_or_404(clean(payload.get("project_id"), 40), ctx["tenant_id"]); now = datetime.utcnow()
    seq = await design_artworks_collection.count_documents({"tenant_id": ctx["tenant_id"]}) + 1
    row = {"tenant_id": ctx["tenant_id"], "project_id": str(project["_id"]), "design_no": project["design_no"], "artwork_no": f"ART-{now.strftime('%y%m%d')}-{seq:04d}",
        "name": clean(payload.get("name"), 160), "kind": clean(payload.get("kind"), 80), "version": clean(payload.get("version"), 30) or "v1",
        "width": clean(payload.get("width"), 40), "height": clean(payload.get("height"), 40), "placement": clean(payload.get("placement"), 300),
        "technique": clean(payload.get("technique"), 120), "colours": clean(payload.get("colours"), 500), "file_urls": [clean(x, 1000) for x in payload.get("file_urls", []) if clean(x)][:30],
        "notes": clean(payload.get("notes"), 2000), "status": clean(payload.get("status"), 40) or "DRAFT", "created_at": now, "updated_at": now}
    result = await design_artworks_collection.insert_one(row); row["_id"] = result.inserted_id
    return {"message": f"Artwork {row['artwork_no']} saved.", "data": serialize(row)}

@router.patch("/artworks/{artwork_id}")
async def update_artwork(artwork_id: str, payload: dict, ctx: dict = Depends(require_design)):
    if not ObjectId.is_valid(artwork_id): raise HTTPException(status_code=400, detail="Invalid artwork.")
    row = await design_artworks_collection.find_one({"_id": ObjectId(artwork_id), "tenant_id": ctx["tenant_id"]})
    if not row: raise HTTPException(status_code=404, detail="Artwork not found.")
    update: Dict[str, Any] = {}
    for key, limit in {"name": 160, "kind": 80, "version": 30, "width": 40, "height": 40, "placement": 300, "technique": 120, "colours": 500, "notes": 2000, "status": 40}.items():
        if key in payload: update[key] = clean(payload[key], limit)
    if "file_urls" in payload: update["file_urls"] = [clean(x, 1000) for x in (payload.get("file_urls") or []) if clean(x)][:30]
    if not update: raise HTTPException(status_code=400, detail="Nothing to update.")
    update["updated_at"] = datetime.utcnow()
    await design_artworks_collection.update_one({"_id": row["_id"]}, {"$set": update})
    return {"message": "Artwork updated."}

@router.post("/change-requests", status_code=201)
async def create_change_request(payload: dict, ctx: dict = Depends(require_design_or_production)):
    project = await project_or_404(clean(payload.get("project_id"), 40), ctx["tenant_id"]); now = datetime.utcnow()
    seq = await design_change_requests_collection.count_documents({"tenant_id": ctx["tenant_id"]}) + 1
    affected=[]
    async for order in job_work_orders_collection.find({"tenant_id":ctx["tenant_id"],"status":{"$ne":"COMPLETED"},"design_lines.design_no":project["design_no"]},{"order_no":1}): affected.append({"id":str(order["_id"]),"order_no":order.get("order_no")})
    row = {"tenant_id": ctx["tenant_id"], "project_id": str(project["_id"]), "design_no": project["design_no"], "change_no": f"DCR-{now.strftime('%y%m%d')}-{seq:04d}",
        "reason": clean(payload.get("reason"), 1000), "previous_spec": clean(payload.get("previous_spec"), 1500), "new_spec": clean(payload.get("new_spec"), 1500),
        "material_impact": clean(payload.get("material_impact"), 1000), "cost_impact": clean(payload.get("cost_impact"), 500), "delivery_impact": clean(payload.get("delivery_impact"), 500),
        "before_urls": [clean(x, 1000) for x in payload.get("before_urls", []) if clean(x)][:20], "after_urls": [clean(x, 1000) for x in payload.get("after_urls", []) if clean(x)][:20],
        "affected_orders":affected, "status": "PENDING_PRODUCTION_REVIEW", "raised_by": ctx.get("admin_name"), "decision_note": "", "created_at": now, "updated_at": now}
    result = await design_change_requests_collection.insert_one(row); row["_id"] = result.inserted_id
    return {"message": f"Change request {row['change_no']} submitted.", "data": serialize(row)}

@router.patch("/change-requests/{change_id}")
async def decide_change_request(change_id: str, payload: dict, ctx: dict = Depends(require_design_or_production)):
    if not ObjectId.is_valid(change_id): raise HTTPException(status_code=400, detail="Invalid change request.")
    status = clean(payload.get("status"), 40).upper()
    if status not in {"PENDING_PRODUCTION_REVIEW", "ACCEPTED", "REJECTED", "IMPLEMENTED"}: raise HTTPException(status_code=400, detail="Invalid change status.")
    result = await design_change_requests_collection.update_one({"_id": ObjectId(change_id), "tenant_id": ctx["tenant_id"]}, {"$set": {"status": status, "decision_note": clean(payload.get("decision_note"), 1000), "decided_by": ctx.get("admin_name"), "acknowledged_at":datetime.utcnow() if status in {"ACCEPTED","REJECTED"} else None, "updated_at": datetime.utcnow()}})
    if not result.matched_count: raise HTTPException(status_code=404, detail="Change request not found.")
    return {"message": "Change request updated."}

@router.post("/projects/{project_id}/release")
async def release_project(project_id: str, payload: dict, ctx: dict = Depends(require_design)):
    project = await project_or_404(project_id, ctx["tenant_id"])
    tech_pack_id = clean(payload.get("tech_pack_id"), 40)
    if not ObjectId.is_valid(tech_pack_id): raise HTTPException(status_code=400, detail="Select an approved tech pack.")
    pack = await tech_packs_collection.find_one({"_id": ObjectId(tech_pack_id), "tenant_id": ctx["tenant_id"], "design_no": project["design_no"]})
    if not pack: raise HTTPException(status_code=400, detail="The selected tech pack must belong to this design number.")
    allowance_status = str((pack.get("allowance_approval") or {}).get("status") or "NOT_REQUIRED").upper()
    if allowance_status in {"PENDING", "REJECTED", "CHANGES_REQUESTED"}:
        raise HTTPException(status_code=400, detail="The Tech Pack's manual allowance exception must be approved by HQ before release.")

    # A tech pack is always mandatory (above). The three sign-off checks are
    # per-tenant configurable in Settings, and a design/HQ admin can override
    # them for one style with a mandatory written reason (force).
    gates = _merge_settings(await design_settings_collection.find_one({"tenant_id": ctx["tenant_id"]}) or {})
    force = bool(payload.get("force"))
    force_reason = clean(payload.get("force_reason"), 500)
    if force and not force_reason:
        raise HTTPException(status_code=400, detail="Enter a reason to release without full sign-off.")
    if not force:
        approvals = {a.get("type"): a.get("decision") for a in project.get("approvals", [])}
        if gates["require_sample_approval"]:
            approved_sample = await design_samples_collection.find_one({"tenant_id": ctx["tenant_id"], "project_id": project_id, "decision": {"$in": ["APPROVED", "APPROVED_WITH_COMMENTS"]}})
            if not approved_sample: raise HTTPException(status_code=400, detail="Approve at least one sample before releasing to Production.")
        if gates["require_design_head_approval"] and approvals.get("DESIGN_HEAD") != "APPROVED":
            raise HTTPException(status_code=400, detail="Design Head approval is required before release.")
        if gates["require_production_feasibility"] and approvals.get("PRODUCTION_FEASIBILITY") != "APPROVED":
            raise HTTPException(status_code=400, detail="Production feasibility approval is required before release.")
    now = datetime.utcnow(); plan_id = clean(payload.get("material_plan_id"), 40) or None
    if not plan_id and payload.get("auto_create_bom"):
        pattern = await design_patterns_collection.find_one({"tenant_id": ctx["tenant_id"], "project_id": project_id, "consumption_per_unit": {"$gt": 0}}, sort=[("created_at", -1)])
        if not pattern or not project.get("planned_quantity"): raise HTTPException(status_code=400, detail="Automatic BOM needs planned quantity and a pattern with consumption.")
        material_name = clean(payload.get("material_name"), 160) or "Main fabric"
        required = round(number(project.get("planned_quantity")) * number(pattern.get("consumption_per_unit")) * (1 + number(pattern.get("wastage_pct")) / 100), 3)
        plan = {"tenant_id": ctx["tenant_id"], "plan_no": f"BOM-{now.strftime('%y%m%d')}-{(await style_bom_plans_collection.count_documents({'tenant_id': ctx['tenant_id']}))+1:04d}",
            "style_name": project["style_name"], "style_code": project["design_no"], "planned_quantity": number(project.get("planned_quantity")), "finished_unit": "pcs", "wastage_pct": number(pattern.get("wastage_pct")),
            "materials": [{"material_name": material_name, "specification": f"Pattern {pattern.get('pattern_no')} {pattern.get('version')}; width {pattern.get('fabric_width','')}", "consumption_per_unit": number(pattern.get("consumption_per_unit")), "unit": "m", "wastage_pct": number(pattern.get("wastage_pct")), "required_quantity": required, "rate": 0}],
            "purchase_order_id": None, "purchase_order_no": None, "source": "DESIGN_HANDOFF", "created_by": ctx.get("admin_id"), "created_at": now, "updated_at": now}
        result = await style_bom_plans_collection.insert_one(plan); plan_id = str(result.inserted_id)
    if plan_id and (not ObjectId.is_valid(plan_id) or not await style_bom_plans_collection.find_one({"_id": ObjectId(plan_id), "tenant_id": ctx["tenant_id"]})): raise HTTPException(status_code=400, detail="Invalid material plan.")
    release_meta = {"released_forced": force, "released_force_reason": force_reason if force else ""}
    await tech_packs_collection.update_one({"_id": pack["_id"]}, {"$set": {"status": "Released to Production", "approved_by": ctx.get("admin_name"), "approved_at": now, "design_project_id": project_id, "material_plan_id": plan_id or pack.get("material_plan_id"), "updated_at": now, **release_meta}})
    await design_projects_collection.update_one({"_id": project["_id"]}, {"$set": {"status": "RELEASED_TO_PRODUCTION", "tech_pack_id": tech_pack_id, "material_plan_id": plan_id, "released_by": ctx.get("admin_name"), "released_at": now, "updated_at": now, **release_meta}})
    suffix = " (released without full sign-off)" if force else ""
    return {"message": f"{project['design_no']} released to Production with tech pack {pack.get('tech_pack_no', '')}{suffix}."}


# ─────────────────────────────────────────────────────────────────────────────
# Daily shop-floor KPI logging
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/floor-departments")
async def get_floor_departments(ctx: dict = Depends(require_design_or_production)):
    stored = await floor_ops_settings_collection.find_one({"tenant_id": ctx["tenant_id"]})
    departments = (stored or {}).get("departments") or DEFAULT_FLOOR_DEPARTMENTS
    return {"status": "success", "data": departments}


@router.put("/floor-departments")
async def save_floor_departments(payload: dict, ctx: dict = Depends(require_design)):
    raw = payload.get("departments")
    if not isinstance(raw, list) or not raw:
        raise HTTPException(status_code=400, detail="At least one department is required.")
    cleaned = []
    for row in raw[:40]:
        if not isinstance(row, dict):
            continue
        name = clean(row.get("name"), 80)
        if not name:
            continue
        fields = [f for f in (row.get("fields") or []) if f in FLOOR_LOG_FIELD_KEYS][:len(FLOOR_LOG_FIELD_KEYS)]
        labels = {k: clean(v, 60) for k, v in (row.get("labels") or {}).items() if k in FLOOR_LOG_FIELD_KEYS and clean(v)}
        cleaned.append({"name": name, "fields": fields or ["target_qty", "completed_qty", "on_time", "remarks"], "labels": labels})
    if not cleaned:
        raise HTTPException(status_code=400, detail="At least one valid department is required.")
    await floor_ops_settings_collection.update_one(
        {"tenant_id": ctx["tenant_id"]},
        {"$set": {"departments": cleaned, "updated_at": datetime.utcnow(), "updated_by": ctx.get("admin_name") or ctx.get("admin_email") or ""}},
        upsert=True,
    )
    return {"status": "success", "message": "Floor department setup saved.", "data": cleaned}


@router.get("/floor-workers")
async def list_floor_workers(ctx: dict = Depends(require_design_or_production)):
    rows = [serialize(r) async for r in floor_workers_collection.find({"tenant_id": ctx["tenant_id"]}).sort("name", 1)]
    return {"status": "success", "data": rows}


@router.post("/floor-workers", status_code=201)
async def create_floor_worker(payload: dict, ctx: dict = Depends(require_design_or_production)):
    name = clean(payload.get("name"), 120)
    if not name:
        raise HTTPException(status_code=400, detail="Worker name is required.")
    now = datetime.utcnow()
    row = {
        "tenant_id": ctx["tenant_id"], "name": name,
        "phone": clean(payload.get("phone"), 20),
        "departments": [clean(x, 80) for x in (payload.get("departments") or []) if clean(x)][:10],
        "active": payload.get("active", True) is not False,
        "notes": clean(payload.get("notes"), 300),
        "created_by": ctx.get("admin_name") or ctx.get("admin_email") or "",
        "created_at": now, "updated_at": now,
    }
    result = await floor_workers_collection.insert_one(row)
    row["_id"] = result.inserted_id
    return {"message": f"{name} added to the floor worker directory.", "data": serialize(row)}


@router.patch("/floor-workers/{worker_id}")
async def update_floor_worker(worker_id: str, payload: dict, ctx: dict = Depends(require_design_or_production)):
    if not ObjectId.is_valid(worker_id):
        raise HTTPException(status_code=400, detail="Invalid worker.")
    update: Dict[str, Any] = {}
    if "name" in payload:
        update["name"] = clean(payload["name"], 120)
    if "phone" in payload:
        update["phone"] = clean(payload["phone"], 20)
    if "departments" in payload:
        update["departments"] = [clean(x, 80) for x in (payload["departments"] or []) if clean(x)][:10]
    if "active" in payload:
        update["active"] = bool(payload["active"])
    if "notes" in payload:
        update["notes"] = clean(payload["notes"], 300)
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update.")
    update["updated_at"] = datetime.utcnow()
    result = await floor_workers_collection.update_one({"_id": ObjectId(worker_id), "tenant_id": ctx["tenant_id"]}, {"$set": update})
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Worker not found.")
    return {"message": "Worker updated."}


@router.get("/wastage-categories")
async def get_wastage_categories(department: str = "", ctx: dict = Depends(require_design_or_production)):
    settings = _merge_settings(await design_settings_collection.find_one({"tenant_id": ctx["tenant_id"]}) or {})
    return {"status": "success", "data": _wastage_categories_for(clean(department, 80), settings["wastage_categories"])}


@router.get("/floor-logs")
async def list_floor_logs(
    date_from: str = "", date_to: str = "", department: str = "", worker_id: str = "", design_no: str = "",
    ctx: dict = Depends(require_design_or_production),
):
    query: Dict[str, Any] = {"tenant_id": ctx["tenant_id"]}
    if date_from or date_to:
        rng: Dict[str, str] = {}
        if date_from:
            rng["$gte"] = clean(date_from, 10)
        if date_to:
            rng["$lte"] = clean(date_to, 10)
        query["date"] = rng
    if department:
        query["department"] = clean(department, 80)
    if worker_id:
        query["worker_id"] = clean(worker_id, 40)
    if design_no:
        query["design_no"] = {"$regex": clean(design_no, 60), "$options": "i"}
    rows = [serialize(r) async for r in daily_production_logs_collection.find(query).sort([("date", -1), ("created_at", -1)]).limit(500)]
    return {"status": "success", "data": rows}


async def _reverse_floor_log_fabric_sync(tenant_id: str, floor_log_id) -> list:
    """Undoes whatever a deleted floor log already posted to the Fabric Lot
    ledger (see _sync_floor_log_to_fabric_lots), so a mistaken/duplicate
    entry doesn't leave a permanent dent in a lot's consumed/waste/balance
    figures after it's removed. Never edits or deletes the original history
    entries (audit trail stays intact) — instead pushes an equal-and-opposite
    REVERSAL entry, the same way an accounting ledger corrects a mis-posting."""
    now = datetime.utcnow()
    reversed_lot_ids = []
    async for lot in fabric_lots_collection.find({"tenant_id": tenant_id, "history.floor_log_id": str(floor_log_id)}):
        entries = [h for h in (lot.get("history") or []) if h.get("source") == "floor_log" and h.get("floor_log_id") == str(floor_log_id)]
        if not entries:
            continue
        update: Dict[str, Any] = {"updated_at": now}
        consumed_delta = sum(number(h.get("qty")) for h in entries if h.get("type") == "CONSUME")
        waste_delta = sum(number(h.get("qty")) for h in entries if h.get("type") == "WASTE")
        recoverable_delta = sum(number(h.get("qty")) for h in entries if h.get("type") == "WASTE" and h.get("is_recoverable"))
        if consumed_delta:
            update["consumed_qty"] = round(number(lot.get("consumed_qty")) - consumed_delta, 3)
        if waste_delta:
            update["waste_qty"] = round(number(lot.get("waste_qty")) - waste_delta, 3)
        if recoverable_delta:
            update["recoverable_qty"] = round(number(lot.get("recoverable_qty")) - recoverable_delta, 3)
        reversal_entry = {
            "type": "REVERSAL", "qty": round(consumed_delta + waste_delta, 3),
            "note": "Floor log entry deleted — auto-synced Consume/Waste reversed.",
            "design_no": entries[0].get("design_no"), "at": now, "source": "floor_log_deletion",
            "floor_log_id": str(floor_log_id),
        }
        await fabric_lots_collection.update_one({"_id": lot["_id"]}, {"$set": update, "$push": {"history": reversal_entry}})
        reversed_lot_ids.append(str(lot["_id"]))
    return reversed_lot_ids


@router.delete("/floor-logs/{log_id}")
async def delete_floor_log(log_id: str, reason: str = "", ctx: dict = Depends(require_design_or_production)):
    """HQ-only, deliberately NOT available from the Floor Log Kiosk (workers
    have no path to this at all) or to a store-scoped admin — only an HQ
    Design & Pattern / Production & Job Work admin, matching who can create
    and view these entries in the first place. A floor log is otherwise
    append-only by design (see create_floor_log/_build_floor_log_breakdowns)
    so real output history can't quietly change; this exists only for a
    genuine mistake — duplicate kiosk tap, wrong worker selected, a test
    entry — not as a general edit path. A reason is mandatory and kept
    permanently on an audit trail record even after the row itself is gone,
    and any Consume/Waste it already posted to the Fabric Lot ledger is
    reversed in the same step so fabric balances never go stale."""
    if not ObjectId.is_valid(log_id):
        raise HTTPException(status_code=400, detail="Invalid floor log entry.")
    row = await daily_production_logs_collection.find_one({"_id": ObjectId(log_id), "tenant_id": ctx["tenant_id"]})
    if not row:
        raise HTTPException(status_code=404, detail="Floor log entry not found.")
    reason = clean(reason, 500)
    if not reason:
        raise HTTPException(status_code=400, detail="A reason is required to delete a floor log entry.")

    reversed_lots = await _reverse_floor_log_fabric_sync(ctx["tenant_id"], row["_id"])

    audit_entry = {
        "tenant_id": ctx["tenant_id"], "floor_log_id": str(row["_id"]), "snapshot": serialize(row),
        "reason": reason, "deleted_by": ctx.get("admin_id"), "deleted_by_name": ctx.get("admin_name") or ctx.get("admin_email") or "",
        "deleted_at": datetime.utcnow(), "fabric_lots_reversed": reversed_lots,
    }
    await floor_log_deletions_collection.insert_one(audit_entry)
    await daily_production_logs_collection.delete_one({"_id": row["_id"]})

    message = f"Floor log entry for {row.get('worker_name', 'worker')} deleted."
    if reversed_lots:
        message += f" Reversed its fabric lot posting on {len(reversed_lots)} lot(s)."
    return {"message": message}


@router.get("/floor-logs/deletions")
async def list_floor_log_deletions(ctx: dict = Depends(require_design_or_production)):
    """Audit trail of every deleted floor log entry — who deleted what, when
    and why, with the full original entry preserved in `snapshot`, even
    though the live row is gone. Nothing here can be deleted or edited."""
    rows = [serialize(r) async for r in floor_log_deletions_collection.find({"tenant_id": ctx["tenant_id"]}).sort("deleted_at", -1).limit(200)]
    return {"status": "success", "data": rows}


# ─────────────────────────────────────────────────────────────────────────────
# Daily Floor Log <-> Fabric Lot ledger bridge. Before this, a supervisor
# effectively had to log fabric usage TWICE: once in the Daily Floor Log (for
# KPIs) and again as a manual Consume/Waste transaction on a fabric lot (for
# balance/utilization/net-to-purchase). This makes the floor log the single
# entry point — its fabric_used_mtrs and categorised wastage automatically
# post as real ledger transactions against a matching lot, when one exists.
#
# Deliberately best-effort: if there's no design_no on the entry, no fabric
# lot exists yet for that design, or the lot has less fabric outstanding at
# the floor than the entry reports, whatever CAN be matched is posted and
# the rest is simply left unmatched (reported back, never an error) — this
# never blocks or fails the floor log save. The manual
# /fabric-lots/{id}/transactions endpoint still exists for anything this
# can't auto-match (e.g. fabric that was never formally Issued in the
# ledger, or a design with fabric split across an ambiguous set of lots).
# ─────────────────────────────────────────────────────────────────────────────

async def _sync_floor_log_to_fabric_lots(tenant_id: str, design_no: str, consume_qty: float, waste_rows: list, ctx: dict, floor_log_id, fabric_lot_id: str = None) -> dict:
    result = {"consumed_posted": 0.0, "consumed_unmatched": 0.0, "waste_posted": [], "waste_unmatched": []}
    consume_qty = number(consume_qty)
    if consume_qty <= 0 and not waste_rows:
        return result

    if fabric_lot_id:
        # Explicit lot picked at the kiosk (Step 3) — deterministic, no
        # guessing across multiple lots for the same design/fabric type.
        if not ObjectId.is_valid(fabric_lot_id):
            result["note"] = "Invalid fabric lot reference — recorded in the floor log only."
            return result
        lot = await fabric_lots_collection.find_one({"_id": ObjectId(fabric_lot_id), "tenant_id": tenant_id})
        if not lot:
            result["note"] = "The selected fabric lot could not be found — recorded in the floor log only."
            return result
        lots = [lot]
    elif design_no:
        # No explicit lot chosen — fall back to matching every lot for this
        # design_no, oldest first (FIFO), same as before this fabric-lot
        # picker existed.
        lots = [l async for l in fabric_lots_collection.find({"tenant_id": tenant_id, "design_no": design_no}).sort("received_at", 1)]
    else:
        lots = []
    if not lots:
        result["note"] = f"No fabric lot found for design {design_no} — recorded in the floor log only." if design_no else "No fabric lot selected — recorded in the floor log only."
        return result

    available = {str(l["_id"]): _fabric_lot_outstanding_wip(l) for l in lots}
    now = datetime.utcnow()

    async def draw(qty_needed: float, kind: str, category: str = None, category_label: str = None, is_recoverable: bool = False) -> float:
        remaining = qty_needed
        for lot in lots:
            if remaining <= 0:
                break
            lot_id = str(lot["_id"])
            take = min(available[lot_id], remaining)
            if take <= 0:
                continue
            update: Dict[str, Any] = {"updated_at": now}
            if kind == "CONSUME":
                update["consumed_qty"] = number(lot.get("consumed_qty")) + take
                lot["consumed_qty"] = update["consumed_qty"]
            else:
                update["waste_qty"] = number(lot.get("waste_qty")) + take
                lot["waste_qty"] = update["waste_qty"]
                if is_recoverable:
                    update["recoverable_qty"] = number(lot.get("recoverable_qty")) + take
                    lot["recoverable_qty"] = update["recoverable_qty"]
            history_entry = {
                "type": kind, "qty": round(take, 3), "note": "Auto-synced from Daily Floor Log entry",
                "design_no": design_no, "category": category, "category_label": category_label,
                "is_recoverable": is_recoverable, "by": ctx.get("admin_id"), "by_name": ctx.get("admin_name"), "at": now,
                "source": "floor_log", "floor_log_id": str(floor_log_id),
            }
            await fabric_lots_collection.update_one({"_id": lot["_id"]}, {"$set": update, "$push": {"history": history_entry}})
            available[lot_id] -= take
            remaining -= take
        return round(qty_needed - remaining, 3)

    if consume_qty > 0:
        posted = await draw(consume_qty, "CONSUME")
        result["consumed_posted"] = posted
        result["consumed_unmatched"] = round(consume_qty - posted, 3)

    for row in waste_rows or []:
        qty = number(row.get("qty"))
        if qty <= 0:
            continue
        posted = await draw(qty, "WASTE", category=row.get("category"), category_label=row.get("label"), is_recoverable=bool(row.get("is_recoverable")))
        entry = {"category": row.get("category"), "posted": posted}
        if posted < qty:
            entry["unmatched"] = round(qty - posted, 3)
        result["waste_posted"].append(entry)

    return result


async def _build_floor_log_breakdowns(tenant_id: str, department: str, payload: dict) -> tuple:
    """Shared by the HQ-side /floor-logs and the worker-side kiosk /end below
    — same minimal-entry principle, same validation, same auto-sum, so a
    kiosk entry and an HQ-entered one are computed identically. Returns
    (numeric_fields, size_breakdown, wastage_breakdown)."""
    numeric_fields = {field: number(payload.get(field)) for field in FLOOR_LOG_NUMERIC_FIELDS}
    # Size-wise entry (Cutting/Stitching etc.): the worker/supervisor only
    # types pieces per size — Design No → Operation → Worker/Line → Size →
    # Quantity, per the floor-entry principle — completed_qty is then the
    # SUM of those, computed here, never a second number someone re-types
    # and which could silently disagree with the size breakdown.
    size_breakdown = [
        {"size": clean(r.get("size"), 20), "qty": number(r.get("qty"))}
        for r in (payload.get("size_breakdown") or []) if isinstance(r, dict) and clean(r.get("size"), 20)
    ][:20]
    if size_breakdown:
        numeric_fields["completed_qty"] = round(sum(r["qty"] for r in size_breakdown), 2)

    # Wastage breakdown — same minimal-entry principle as size_breakdown
    # above: the worker picks a category (scoped to their department, per
    # this tenant's own settings.wastage_categories) and types a quantity;
    # wastage_mtrs is then the derived SUM, never a second number someone
    # re-types and which could silently disagree with the category
    # breakdown. An unknown category for this department is rejected rather
    # than silently recorded under the wrong bucket.
    tenant_settings = _merge_settings(await design_settings_collection.find_one({"tenant_id": tenant_id}) or {})
    tenant_categories = tenant_settings["wastage_categories"]
    category_lookup = _wastage_category_lookup(tenant_categories)
    allowed_categories = {c["code"] for c in _wastage_categories_for(department, tenant_categories)}
    wastage_breakdown = []
    for r in (payload.get("wastage_breakdown") or [])[:20]:
        if not isinstance(r, dict):
            continue
        category = clean(r.get("category"), 40)
        if not category:
            continue
        if category not in allowed_categories:
            raise HTTPException(status_code=400, detail=f"'{category_lookup.get(category, {}).get('label', category)}' is not a valid wastage category for {department}.")
        wastage_breakdown.append({"category": category, "label": category_lookup[category]["label"], "is_recoverable": category_lookup[category]["is_recoverable"], "qty": number(r.get("qty"))})
    if wastage_breakdown:
        numeric_fields["wastage_mtrs"] = round(sum(r["qty"] for r in wastage_breakdown), 3)
    return numeric_fields, size_breakdown, wastage_breakdown


@router.post("/floor-logs", status_code=201)
async def create_floor_log(payload: dict, ctx: dict = Depends(require_design_or_production)):
    department = clean(payload.get("department"), 80)
    if not department:
        raise HTTPException(status_code=400, detail="Department is required.")
    worker_id = clean(payload.get("worker_id"), 40)
    worker_name = clean(payload.get("worker_name"), 120)
    if worker_id:
        if not ObjectId.is_valid(worker_id):
            raise HTTPException(status_code=400, detail="Invalid worker.")
        worker = await floor_workers_collection.find_one({"_id": ObjectId(worker_id), "tenant_id": ctx["tenant_id"]})
        if not worker:
            raise HTTPException(status_code=404, detail="Worker not found.")
        worker_name = worker.get("name") or worker_name
    if not worker_name:
        raise HTTPException(status_code=400, detail="Select or name the worker this entry is for.")
    date = clean(payload.get("date"), 10) or datetime.utcnow().date().isoformat()
    job_work_order_id = clean(payload.get("job_work_order_id"), 40)
    now = datetime.utcnow()
    numeric_fields, size_breakdown, wastage_breakdown = await _build_floor_log_breakdowns(ctx["tenant_id"], department, payload)
    design_no = clean(payload.get("design_no"), 120)
    design_context = await _lookup_design_context(ctx["tenant_id"], design_no) if design_no else {}

    row = {
        "tenant_id": ctx["tenant_id"], "date": date, "time": clean(payload.get("time"), 10),
        "department": department, "worker_id": worker_id or None, "worker_name": worker_name,
        "design_no": design_no,
        "garment_type": clean(payload.get("garment_type"), 80) or design_context.get("garment_type", ""),
        "gender_segment": clean(payload.get("gender_segment"), 80) or design_context.get("gender_segment", ""),
        # Explicit fabric lot this entry draws from (Fabric & Production,
        # Step 3) — optional; when set, the sync bridge below posts against
        # THIS lot deterministically instead of guessing across every lot
        # for the design_no.
        "fabric_lot_id": clean(payload.get("fabric_lot_id"), 40) or None,
        "size_breakdown": size_breakdown,
        "wastage_breakdown": wastage_breakdown,
        # Same log covers in-house floor staff and an outsourced job worker's
        # daily output — job_work_order_id links it to that JWO for reference;
        # the receipt/QC reconciliation on job_work_routes.py is unaffected.
        "source": "JOB_WORK" if job_work_order_id else "INTERNAL",
        "job_work_order_id": job_work_order_id or None,
        "vendor_name": clean(payload.get("vendor_name"), 160),
        # entry_mode/status/started_at/ended_at/elapsed_minutes exist so this
        # HQ-entered row and a worker's own kiosk Start->End session (below)
        # share one schema. A manual entry is filled in one shot after the
        # fact, so it's simply born COMPLETED with no start/end timestamps.
        "entry_mode": "MANUAL", "status": "COMPLETED", "started_at": None, "ended_at": None,
        "elapsed_minutes": None, "elapsed_days": None,
        **numeric_fields,
        "on_time": bool(payload.get("on_time", True)),
        "remarks": clean(payload.get("remarks"), 1000),
        "created_by": ctx.get("admin_id"), "created_by_name": ctx.get("admin_name") or ctx.get("admin_email") or "",
        "created_at": now, "updated_at": now,
    }
    result = await daily_production_logs_collection.insert_one(row)
    row["_id"] = result.inserted_id

    # Bridge to the Fabric Lot ledger (Step 1): best-effort, never blocks or
    # fails this save. See _sync_floor_log_to_fabric_lots for the full
    # reasoning — this is what makes "the floor logs it once" actually drive
    # the fabric balance too, not just the floor KPIs.
    try:
        fabric_sync = await _sync_floor_log_to_fabric_lots(
            ctx["tenant_id"], row["design_no"], numeric_fields.get("fabric_used_mtrs", 0), wastage_breakdown, ctx, row["_id"], row.get("fabric_lot_id"),
        )
    except Exception:
        fabric_sync = {"error": "Could not sync to the fabric lot ledger — this entry was still saved to the floor log."}
    if fabric_sync:
        await daily_production_logs_collection.update_one({"_id": row["_id"]}, {"$set": {"fabric_lot_sync": fabric_sync}})
        row["fabric_lot_sync"] = fabric_sync

    message = f"Logged {department} entry for {worker_name}."
    if fabric_sync.get("consumed_posted") or any(w.get("posted") for w in fabric_sync.get("waste_posted", [])):
        message += " Matching fabric lot balance updated automatically."
    return {"message": message, "data": serialize(row)}


# ─────────────────────────────────────────────────────────────────────────────
# Floor Log Kiosk — a worker's OWN side of the Daily Floor Log. Floor workers
# still have no personal login anywhere in RMS (by design, throughout this
# codebase) — same public-token pattern as production_flow_routes.py's
# Workstation Display (a shared floor tablet/TV opens a link, no auth). HQ
# generates one link per tenant; a worker picks their own name, taps Start
# when beginning a task (their own department + name gets stamped and
# stored, per the ask), and later taps End on that same open session to
# enter what they actually did — completed_qty/size/wastage go through the
# exact same _build_floor_log_breakdowns + fabric-lot-sync pipeline as an
# HQ-entered row, so a kiosk entry and a manual one are indistinguishable
# downstream. This is purely an additional entry point: HQ's own Daily
# Floor Log tab (manual entry AND bulk Excel upload) is completely
# untouched and keeps full access to every row, kiosk-created or not.
# ─────────────────────────────────────────────────────────────────────────────

async def _resolve_kiosk_tenant(kiosk_token: str) -> str:
    settings = await floor_ops_settings_collection.find_one({"kiosk_token": clean(kiosk_token, 100)})
    if not settings:
        raise HTTPException(status_code=404, detail="This floor log kiosk link is invalid or has been reset.")
    return settings["tenant_id"]


@router.get("/floor-kiosk/link")
async def get_floor_kiosk_link(ctx: dict = Depends(require_design_or_production)):
    settings = await floor_ops_settings_collection.find_one({"tenant_id": ctx["tenant_id"]})
    return {"status": "success", "data": {"kiosk_token": (settings or {}).get("kiosk_token") or None}}


@router.post("/floor-kiosk/link")
async def generate_floor_kiosk_link(ctx: dict = Depends(require_design_or_production)):
    """Generates (first time) or rotates (any time after) this tenant's
    kiosk link. Rotating immediately invalidates the old link/QR — use that
    if a printed QR is lost or a link leaks, same idea as a display_token
    reissue would be for Workstation Display."""
    token = secrets.token_urlsafe(24)
    await floor_ops_settings_collection.update_one(
        {"tenant_id": ctx["tenant_id"]},
        {"$set": {"kiosk_token": token, "kiosk_token_updated_at": datetime.utcnow(), "kiosk_token_updated_by": ctx.get("admin_name") or ctx.get("admin_email") or ""}},
        upsert=True,
    )
    return {"status": "success", "message": "Floor log kiosk link ready.", "data": {"kiosk_token": token}}


@router.get("/floor-kiosk/{kiosk_token}/context")
async def floor_kiosk_context(kiosk_token: str):
    tenant_id = await _resolve_kiosk_tenant(kiosk_token)
    dept_settings = await floor_ops_settings_collection.find_one({"tenant_id": tenant_id})
    departments = (dept_settings or {}).get("departments") or DEFAULT_FLOOR_DEPARTMENTS
    workers = [serialize(w) async for w in floor_workers_collection.find({"tenant_id": tenant_id, "active": {"$ne": False}}).sort("name", 1).limit(500)]
    # Wastage categories, with their department scoping, so the kiosk's own
    # End form can filter to the right list per department client-side —
    # this public endpoint can't call the authenticated /wastage-categories
    # route, so the full tenant list (same one Settings edits) rides along
    # here instead.
    tenant_settings = _merge_settings(await design_settings_collection.find_one({"tenant_id": tenant_id}) or {})
    return {"status": "success", "data": {
        "departments": departments, "workers": workers, "wastage_categories": tenant_settings["wastage_categories"],
        "garment_type_options": GARMENT_TYPE_OPTIONS, "gender_segment_options": GENDER_SEGMENT_OPTIONS,
    }}


async def _lookup_design_context(tenant_id: str, design_no: str) -> dict:
    """Design No. -> style name, garment type, gender/segment and the
    latest pattern's size ratio — all pulled from records Design & Pattern
    already created, so a kiosk worker never has to know or re-type these;
    they just pick the design and the rest shows itself. size_ratio (Step 4)
    lets the End form pre-fill size rows (e.g. S/M/L) instead of the worker
    typing size labels from scratch every time — they just fill in actual
    counts. Returns found=False (never an error) when the design_no doesn't
    match any project — an older/untracked design can still be logged, just
    without this extra context."""
    design_no = clean(design_no, 120)
    if not design_no:
        return {"found": False}
    project = await design_projects_collection.find_one({"tenant_id": tenant_id, "design_no": {"$regex": f"^{re.escape(design_no)}$", "$options": "i"}})
    if not project:
        return {"found": False}
    pattern = await design_patterns_collection.find_one({"tenant_id": tenant_id, "design_no": project.get("design_no")}, sort=[("created_at", -1)])
    size_ratio = [{"size": r.get("size"), "ratio_pct": r.get("ratio_pct")} for r in (pattern.get("size_ratio") or [])] if pattern else []
    return {
        "found": True, "design_no": project.get("design_no"), "style_name": project.get("style_name"),
        "garment_type": project.get("category") or "", "gender_segment": project.get("department") or "",
        "size_ratio": size_ratio,
    }


@router.get("/floor-kiosk/{kiosk_token}/design-lookup")
async def floor_kiosk_design_lookup(kiosk_token: str, design_no: str = ""):
    tenant_id = await _resolve_kiosk_tenant(kiosk_token)
    return {"status": "success", "data": await _lookup_design_context(tenant_id, design_no)}


@router.get("/floor-kiosk/{kiosk_token}/fabric-lots")
async def floor_kiosk_fabric_lots(kiosk_token: str, design_no: str = ""):
    """Lets the kiosk's End form show which physical rolls are actually
    available for this design, so the worker picks the lot they're drawing
    from instead of the system guessing FIFO across every lot with that
    design_no. Only lots with something still outstanding at the floor (or
    still in the store) are worth showing — a fully drawn-down lot is
    correctly left off the list."""
    tenant_id = await _resolve_kiosk_tenant(kiosk_token)
    design_no = clean(design_no, 80)
    query: Dict[str, Any] = {"tenant_id": tenant_id}
    if design_no:
        query["design_no"] = design_no
    rows = []
    async for lot in fabric_lots_collection.find(query).sort("received_at", 1).limit(100):
        if number(lot.get("closing_balance")) <= 0 and _fabric_lot_outstanding_wip(lot) <= 0:
            continue
        rows.append({
            "id": str(lot["_id"]), "lot_no": lot.get("lot_no"), "fabric_name": lot.get("fabric_name"),
            "colour": lot.get("colour"), "width": lot.get("width"), "gsm": lot.get("gsm"), "unit": lot.get("unit"),
            "closing_balance": lot.get("closing_balance"), "design_no": lot.get("design_no"),
        })
    return {"status": "success", "data": rows}


@router.post("/floor-kiosk/{kiosk_token}/quick-lot", status_code=201)
async def floor_kiosk_quick_lot(kiosk_token: str, payload: dict):
    """A worker holding a roll HQ never logged yet can add it right here —
    same fields, same validation as the authenticated Receive Lot form
    (_build_fabric_lot_doc), just reachable without a login. It becomes a
    completely normal fabric lot afterwards — editable/reusable from Design
    & Pattern → Fabric & Production exactly like any other."""
    tenant_id = await _resolve_kiosk_tenant(kiosk_token)
    worker_name = clean(payload.get("worker_name"), 120) or "Kiosk"
    doc = _build_fabric_lot_doc(tenant_id, payload, None, worker_name)
    result = await fabric_lots_collection.insert_one(doc)
    saved = await fabric_lots_collection.find_one({"_id": result.inserted_id})
    return {"message": f"Fabric lot {doc['lot_no']} added.", "data": serialize(saved)}


@router.get("/floor-kiosk/{kiosk_token}/open")
async def floor_kiosk_open_sessions(kiosk_token: str, worker_name: str = ""):
    """Lets a worker who just tapped their name find their own still-open
    session (if any) to End — scoped to their name so one shared kiosk
    device doesn't show everyone else's in-progress work."""
    tenant_id = await _resolve_kiosk_tenant(kiosk_token)
    query: Dict[str, Any] = {"tenant_id": tenant_id, "status": "OPEN"}
    if clean(worker_name, 120):
        query["worker_name"] = clean(worker_name, 120)
    rows = [serialize(r) async for r in daily_production_logs_collection.find(query).sort("started_at", -1).limit(20)]
    return {"status": "success", "data": rows}


@router.post("/floor-kiosk/{kiosk_token}/start", status_code=201)
async def floor_kiosk_start(kiosk_token: str, payload: dict):
    tenant_id = await _resolve_kiosk_tenant(kiosk_token)
    department = clean(payload.get("department"), 80)
    if not department:
        raise HTTPException(status_code=400, detail="Choose a department first.")
    worker_id = clean(payload.get("worker_id"), 40)
    worker_name = clean(payload.get("worker_name"), 120)
    if worker_id:
        if not ObjectId.is_valid(worker_id):
            raise HTTPException(status_code=400, detail="Invalid worker.")
        worker = await floor_workers_collection.find_one({"_id": ObjectId(worker_id), "tenant_id": tenant_id})
        if not worker:
            raise HTTPException(status_code=404, detail="Worker not found.")
        worker_name = worker.get("name") or worker_name
    if not worker_name:
        raise HTTPException(status_code=400, detail="Select your name, or type it if you're not in the list yet.")
    design_no = clean(payload.get("design_no"), 120)
    if not design_no:
        raise HTTPException(status_code=400, detail="Enter the Design No. you're working on before starting.")
    design_context = await _lookup_design_context(tenant_id, design_no)
    now = datetime.utcnow()
    row = {
        "tenant_id": tenant_id, "date": now.date().isoformat(), "time": now.strftime("%H:%M"),
        "department": department, "worker_id": worker_id or None, "worker_name": worker_name,
        "design_no": design_no,
        # Pulled from the matching Design Project when one exists — but the
        # worker can always type/pick their own Item (Shirt/Pant/Other) and
        # Gender too, and that manual pick always wins over the auto lookup.
        # This covers a design_no the system doesn't recognise yet (no
        # Design Project on file), where auto lookup alone would leave both
        # blank with no way to fill them in.
        "garment_type": clean(payload.get("garment_type"), 80) or design_context.get("garment_type", ""),
        "gender_segment": clean(payload.get("gender_segment"), 80) or design_context.get("gender_segment", ""),
        # Informational only (Step 4) — the End form pre-fills its size
        # rows from this so the worker just fills in counts instead of
        # typing "S"/"M"/"L" from scratch; the actual saved size_breakdown
        # is still whatever they confirm at End, never this ratio itself.
        "pattern_size_ratio": design_context.get("size_ratio", []),
        "fabric_lot_id": clean(payload.get("fabric_lot_id"), 40) or None,
        "size_breakdown": [], "wastage_breakdown": [],
        "source": "INTERNAL", "job_work_order_id": None, "vendor_name": "",
        "entry_mode": "KIOSK", "status": "OPEN", "started_at": now, "ended_at": None,
        "elapsed_minutes": None, "elapsed_days": None,
        **{field: 0.0 for field in FLOOR_LOG_NUMERIC_FIELDS},
        "on_time": True, "remarks": "",
        "created_by": None, "created_by_name": worker_name,
        "created_at": now, "updated_at": now,
    }
    result = await daily_production_logs_collection.insert_one(row)
    row["_id"] = result.inserted_id
    return {"message": f"Started {department} on {design_no} for {worker_name}. Tap End when the work is done.", "data": serialize(row)}


@router.post("/floor-kiosk/{kiosk_token}/{log_id}/end")
async def floor_kiosk_end(kiosk_token: str, log_id: str, payload: dict):
    tenant_id = await _resolve_kiosk_tenant(kiosk_token)
    if not ObjectId.is_valid(log_id):
        raise HTTPException(status_code=400, detail="Invalid session.")
    log = await daily_production_logs_collection.find_one({"_id": ObjectId(log_id), "tenant_id": tenant_id})
    if not log:
        raise HTTPException(status_code=404, detail="Session not found.")
    if log.get("status") != "OPEN":
        raise HTTPException(status_code=409, detail="This session was already ended.")

    numeric_fields, size_breakdown, wastage_breakdown = await _build_floor_log_breakdowns(tenant_id, log["department"], payload)
    now = datetime.utcnow()
    started_at = log.get("started_at") or now
    elapsed_minutes = round((now - started_at).total_seconds() / 60, 1)
    end_design_no = clean(payload.get("design_no"), 120) or log.get("design_no", "")
    design_context = await _lookup_design_context(tenant_id, end_design_no) if end_design_no != log.get("design_no", "") else None
    fabric_lot_id = clean(payload.get("fabric_lot_id"), 40) or log.get("fabric_lot_id")
    # A manual garment_type/gender_segment typed/picked at End always wins —
    # over a re-looked-up design context, and over whatever was stamped at
    # Start — so a worker can correct or fill these in even for a design_no
    # with no matching Design Project.
    manual_garment_type = clean(payload.get("garment_type"), 80)
    manual_gender_segment = clean(payload.get("gender_segment"), 80)
    update = {
        "status": "COMPLETED", "ended_at": now, "elapsed_minutes": elapsed_minutes, "elapsed_days": _minutes_to_days_floor(elapsed_minutes),
        "design_no": end_design_no, "fabric_lot_id": fabric_lot_id,
        **({"garment_type": design_context.get("garment_type", ""), "gender_segment": design_context.get("gender_segment", ""), "pattern_size_ratio": design_context.get("size_ratio", [])} if design_context else {}),
        **({"garment_type": manual_garment_type} if manual_garment_type else {}),
        **({"gender_segment": manual_gender_segment} if manual_gender_segment else {}),
        "size_breakdown": size_breakdown, "wastage_breakdown": wastage_breakdown,
        "remarks": clean(payload.get("remarks"), 1000), "on_time": bool(payload.get("on_time", True)),
        "updated_at": now,
        **numeric_fields,
    }
    await daily_production_logs_collection.update_one({"_id": log["_id"]}, {"$set": update})
    saved = await daily_production_logs_collection.find_one({"_id": log["_id"]})

    try:
        fabric_sync = await _sync_floor_log_to_fabric_lots(
            tenant_id, saved.get("design_no"), numeric_fields.get("fabric_used_mtrs", 0), wastage_breakdown,
            {"admin_id": None, "admin_name": saved.get("worker_name")}, saved["_id"], saved.get("fabric_lot_id"),
        )
    except Exception:
        fabric_sync = {"error": "Could not sync to the fabric lot ledger — this entry was still saved."}
    if fabric_sync:
        await daily_production_logs_collection.update_one({"_id": saved["_id"]}, {"$set": {"fabric_lot_sync": fabric_sync}})
        saved["fabric_lot_sync"] = fabric_sync

    return {"message": f"Nice work, {saved.get('worker_name')}! Your entry is saved.", "data": serialize(saved)}


def _minutes_to_days_floor(minutes: float) -> float:
    return round(minutes / 60 / 8, 2) if minutes else 0.0


# ── Bulk upload — one spreadsheet covers a whole day across every department ──
# The floor keeps its paper register; a supervisor transcribes it into this one
# sheet and uploads it, instead of the admin re-keying a form per worker.

_FLOOR_TEMPLATE_HEADERS = [
    "Date", "Time", "Department", "Worker Name", "Style / Design No.",
    "Target Qty", "Completed Qty", "Rework Qty", "Rejected Qty",
    "Fabric Used (mtrs)", "Wastage (mtrs)", "Vendor", "On Time (Yes/No)", "Remarks",
]
_FLOOR_COL_ALIASES = {
    "date": ("date", "logdate", "workdate"),
    "time": ("time", "shift"),
    "department": ("department", "dept"),
    "worker_name": ("workername", "worker", "name", "employee", "staff", "employeename", "operator"),
    "design_no": ("style", "designno", "designnumber", "styleno", "styledesignno"),
    "target_qty": ("targetqty", "target", "targetpcs", "targetpatterns"),
    "completed_qty": ("completedqty", "completed", "done", "completedpcs", "cutpcs", "stitchedpcs", "embroideredpcs", "completedpatterns", "output", "outputqty"),
    "rework_qty": ("reworkqty", "rework", "reworkpcs"),
    "rejected_qty": ("rejectedqty", "rejected", "reject", "rejectedpcs", "rejectpcs"),
    "fabric_used_mtrs": ("fabricusedmtrs", "fabricused", "fabricusedmtr", "fabricm", "fabric", "fabricusedmeters", "fabricusedm"),
    "wastage_mtrs": ("wastagemtrs", "wastage", "waste", "wastagemtr", "wastem", "wastagem"),
    "vendor_name": ("vendor", "vendorname", "vendorfabricsource", "fabricvendor"),
    "on_time": ("ontime", "ontimeyesno"),
    "remarks": ("remarks", "remark", "note", "notes", "comment", "comments"),
}


def _floor_key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").strip().lower())


def _parse_floor_upload(content: bytes, filename: str, dept_names: list) -> list:
    name = (filename or "").lower()
    try:
        if name.endswith(".csv"):
            frame = pd.read_csv(io.BytesIO(content), dtype=str)
        elif name.endswith((".xlsx", ".xls")):
            frame = pd.read_excel(io.BytesIO(content), dtype=str)
        else:
            raise HTTPException(status_code=400, detail="Upload a .csv or .xlsx file.")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="The file could not be read. Download the template and keep the headers.")
    frame = frame.where(pd.notnull(frame), "")

    colmap: Dict[str, str] = {}
    for column in frame.columns:
        key = _floor_key(column)
        for field, aliases in _FLOOR_COL_ALIASES.items():
            if key in aliases and field not in colmap:
                colmap[field] = column
    if "department" not in colmap or "worker_name" not in colmap:
        raise HTTPException(status_code=400, detail="The file needs at least a Department and a Worker Name column.")

    dept_by_key = {_floor_key(d): d for d in dept_names}
    rows = []
    for index, record in enumerate(frame.to_dict(orient="records"), start=2):
        def cell(field: str) -> str:
            return str(record.get(colmap.get(field, ""), "") or "").strip()

        errors: list = []
        raw_date = cell("date")
        iso_date = ""
        if raw_date:
            try:
                parsed = pd.to_datetime(raw_date, dayfirst=True, errors="raise")
                iso_date = parsed.date().isoformat()
            except Exception:
                errors.append(f"Date '{raw_date}' is not a valid date.")
        else:
            errors.append("Date is required.")

        department = dept_by_key.get(_floor_key(cell("department")), "")
        if not department:
            errors.append(f"Department '{cell('department') or '(blank)'}' is not one of your floor departments.")

        worker_name = cell("worker_name")
        if not worker_name:
            errors.append("Worker Name is required.")

        numbers: Dict[str, float] = {}
        for field in FLOOR_LOG_NUMERIC_FIELDS:
            text = cell(field).replace(",", "")
            if not text:
                numbers[field] = 0.0
                continue
            try:
                value = float(text)
            except ValueError:
                errors.append(f"{field.replace('_', ' ')} '{text}' is not a number.")
                numbers[field] = 0.0
                continue
            if value < 0:
                errors.append(f"{field.replace('_', ' ')} cannot be negative.")
            numbers[field] = max(0.0, value)

        on_time_raw = _floor_key(cell("on_time"))
        on_time = on_time_raw not in {"no", "n", "0", "false"} if on_time_raw else True

        rows.append({
            "row_no": index, "date": iso_date, "time": cell("time")[:10],
            "department": department, "worker_name": worker_name[:120],
            "design_no": cell("design_no")[:120], "vendor_name": cell("vendor_name")[:160],
            "on_time": on_time, "remarks": cell("remarks")[:1000], **numbers, "errors": errors,
        })
    if not rows:
        raise HTTPException(status_code=400, detail="The file has no data rows.")
    return rows


@router.get("/floor-logs/template")
async def floor_log_template(ctx: dict = Depends(require_design_or_production)):
    body = ",".join(f'"{h}"' for h in _FLOOR_TEMPLATE_HEADERS) + "\r\n"
    return Response(content=body, media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="daily-floor-log-template.csv"'})


@router.post("/floor-logs/bulk/preview")
async def preview_floor_logs(file: UploadFile = File(...), ctx: dict = Depends(require_design_or_production)):
    stored = await floor_ops_settings_collection.find_one({"tenant_id": ctx["tenant_id"]})
    dept_names = [d["name"] for d in ((stored or {}).get("departments") or DEFAULT_FLOOR_DEPARTMENTS)]
    rows = _parse_floor_upload(await file.read(), file.filename or "", dept_names)
    known = {_floor_key(r["name"]) async for r in floor_workers_collection.find({"tenant_id": ctx["tenant_id"]}, {"name": 1})}
    new_workers = sorted({r["worker_name"] for r in rows if not r["errors"] and r["worker_name"] and _floor_key(r["worker_name"]) not in known})
    invalid = sum(1 for r in rows if r["errors"])
    return {
        "status": "success", "mode": "preview_only",
        "summary": {"row_count": len(rows), "valid_count": len(rows) - invalid, "invalid_count": invalid, "new_workers": new_workers},
        "rows": rows[:200], "truncated": len(rows) > 200,
    }


@router.post("/floor-logs/bulk/commit")
async def commit_floor_logs(file: UploadFile = File(...), ctx: dict = Depends(require_design_or_production)):
    stored = await floor_ops_settings_collection.find_one({"tenant_id": ctx["tenant_id"]})
    dept_names = [d["name"] for d in ((stored or {}).get("departments") or DEFAULT_FLOOR_DEPARTMENTS)]
    rows = _parse_floor_upload(await file.read(), file.filename or "", dept_names)
    now = datetime.utcnow()

    worker_id_by_key: Dict[str, Any] = {}
    async for w in floor_workers_collection.find({"tenant_id": ctx["tenant_id"]}, {"name": 1}):
        worker_id_by_key[_floor_key(w.get("name"))] = w["_id"]

    docs, skipped, new_workers = [], [], []
    for row in rows:
        if row["errors"]:
            skipped.append({"row_no": row["row_no"], "worker": row["worker_name"], "errors": row["errors"]})
            continue
        wkey = _floor_key(row["worker_name"])
        worker_oid = worker_id_by_key.get(wkey)
        if worker_oid is None:
            result = await floor_workers_collection.insert_one({
                "tenant_id": ctx["tenant_id"], "name": row["worker_name"], "phone": "",
                "departments": [row["department"]], "active": True, "notes": "Added from a daily-log upload.",
                "created_by": ctx.get("admin_name") or ctx.get("admin_email") or "", "created_at": now, "updated_at": now,
            })
            worker_oid = result.inserted_id
            worker_id_by_key[wkey] = worker_oid
            new_workers.append(row["worker_name"])
        docs.append({
            "tenant_id": ctx["tenant_id"], "date": row["date"], "time": row["time"],
            "department": row["department"], "worker_id": str(worker_oid), "worker_name": row["worker_name"],
            "design_no": row["design_no"], "source": "INTERNAL", "job_work_order_id": None,
            "vendor_name": row["vendor_name"],
            **{f: row[f] for f in FLOOR_LOG_NUMERIC_FIELDS},
            "on_time": row["on_time"], "remarks": row["remarks"],
            "created_by": ctx.get("admin_id"), "created_by_name": ctx.get("admin_name") or ctx.get("admin_email") or "",
            "import_source": "bulk_upload", "created_at": now, "updated_at": now,
        })
    if docs:
        await daily_production_logs_collection.insert_many(docs, ordered=False)
    return {
        "status": "success", "mode": "committed",
        "inserted": len(docs), "rows_skipped": len(skipped), "skipped_rows": skipped[:200],
        "new_workers": sorted(set(new_workers)),
        "message": f"{len(docs)} floor log entr{'y' if len(docs) == 1 else 'ies'} imported"
                   + (f", {len(skipped)} row(s) skipped" if skipped else "")
                   + (f", {len(set(new_workers))} new worker(s) added" if new_workers else "") + ".",
    }


@router.get("/floor-kpis")
async def floor_kpis(date_from: str = "", date_to: str = "", ctx: dict = Depends(require_design_or_production)):
    query: Dict[str, Any] = {"tenant_id": ctx["tenant_id"]}
    if date_from or date_to:
        rng: Dict[str, str] = {}
        if date_from:
            rng["$gte"] = clean(date_from, 10)
        if date_to:
            rng["$lte"] = clean(date_to, 10)
        query["date"] = rng
    rows = [r async for r in daily_production_logs_collection.find(query)]

    def rollup(key_fn) -> list:
        buckets: Dict[str, dict] = {}
        for r in rows:
            key = key_fn(r)
            if not key:
                continue
            bucket = buckets.setdefault(key, {
                "key": key, "entries": 0, "target_qty": 0.0, "completed_qty": 0.0,
                "rework_qty": 0.0, "rejected_qty": 0.0, "fabric_used_mtrs": 0.0,
                "wastage_mtrs": 0.0, "on_time_count": 0,
            })
            bucket["entries"] += 1
            for field in FLOOR_LOG_NUMERIC_FIELDS:
                bucket[field] += number(r.get(field))
            if r.get("on_time"):
                bucket["on_time_count"] += 1
        out = []
        for bucket in buckets.values():
            target, completed = bucket["target_qty"], bucket["completed_qty"]
            out.append({
                **{k: (round(v, 2) if isinstance(v, float) else v) for k, v in bucket.items()},
                "efficiency_pct": round(completed / target * 100, 1) if target else None,
                "rejection_pct": round(bucket["rejected_qty"] / completed * 100, 1) if completed else None,
                "rework_pct": round(bucket["rework_qty"] / completed * 100, 1) if completed else None,
                "on_time_pct": round(bucket["on_time_count"] / bucket["entries"] * 100, 1) if bucket["entries"] else None,
            })
        return sorted(out, key=lambda x: -x["entries"])

    totals = rollup(lambda r: "All departments")

    # Size-wise cut/stitched pieces — flattened out of each entry's
    # size_breakdown (Design No → Operation → Worker → Size → Qty), so
    # management can see "how many S/M/L/XL actually got cut today" without
    # anyone entering that total separately.
    size_totals: Dict[str, float] = {}
    for r in rows:
        for item in (r.get("size_breakdown") or []):
            size = item.get("size")
            if size:
                size_totals[size] = size_totals.get(size, 0) + number(item.get("qty"))
    by_size = sorted(({"size": k, "qty": round(v, 2)} for k, v in size_totals.items()), key=lambda x: -x["qty"])

    # Wastage by category — flattened out of each entry's wastage_breakdown,
    # so management can see WHY fabric was lost (marker vs shade vs
    # rejection etc.), not just one lump wastage_mtrs total.
    wastage_category_totals: Dict[str, dict] = {}
    for r in rows:
        for item in (r.get("wastage_breakdown") or []):
            category = item.get("category")
            if not category:
                continue
            bucket = wastage_category_totals.setdefault(category, {"category": category, "label": item.get("label") or category, "is_recoverable": bool(item.get("is_recoverable")), "qty": 0.0})
            bucket["qty"] += number(item.get("qty"))
    by_wastage_category = sorted(({**v, "qty": round(v["qty"], 2)} for v in wastage_category_totals.values()), key=lambda x: -x["qty"])

    return {
        "status": "success",
        "entry_count": len(rows),
        "totals": totals[0] if totals else None,
        "by_department": rollup(lambda r: r.get("department")),
        "by_worker": rollup(lambda r: r.get("worker_name")),
        "by_design": rollup(lambda r: r.get("design_no")),
        "by_size": by_size,
        "by_wastage_category": by_wastage_category,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Fabric Lot/Roll Ledger — Fabric & Production module, Step 1 (foundation).
#
# One document per physical fabric roll/lot received. Every later step of the
# Fabric & Production plan (auto fabric requirement, cutting reconciliation,
# wastage taxonomy, utilization dashboard, reuse matching) reads its "fabric
# received / on hand" numbers from here, so this ledger is the single source
# of truth for physical fabric stock — never recomputed by re-summing floor
# logs on every read.
#
# Balance model (kept deliberately simple — a WIP-aware store ledger, not a
# full moving-average costing engine):
#   closing_balance = opening_qty + received_qty - issued_qty + returned_qty
#     — this is what's physically sitting in the fabric store right now.
#   issued fabric leaves the store and becomes "outstanding WIP" at the floor:
#     outstanding_wip = issued_qty - consumed_qty - waste_qty - returned_qty
#   consumed/waste are informational splits of what happened to issued fabric,
#   they do NOT further reduce closing_balance (it already left via issue).
#   returned adds fabric back to the store and reduces outstanding WIP.
# Every change is also appended to `history` for a full audit trail — who
# issued/consumed/wasted/returned how much, when, and against which design.
# ─────────────────────────────────────────────────────────────────────────────

FABRIC_LOT_TXN_TYPES = {"ISSUE", "CONSUME", "WASTE", "RETURN"}
FABRIC_LOT_UNITS = {"MTR", "KG", "UNIT"}
FABRIC_LOT_QC_STATUSES = {"PENDING", "PASSED", "FAILED"}


def _fabric_lot_outstanding_wip(lot: dict) -> float:
    return max(0.0, number(lot.get("issued_qty")) - number(lot.get("consumed_qty")) - number(lot.get("waste_qty")) - number(lot.get("returned_qty")))


async def _fabric_lot_or_404(lot_id: str, tenant_id: str) -> dict:
    if not ObjectId.is_valid(lot_id):
        raise HTTPException(status_code=400, detail="Invalid fabric lot.")
    lot = await fabric_lots_collection.find_one({"_id": ObjectId(lot_id), "tenant_id": tenant_id})
    if not lot:
        raise HTTPException(status_code=404, detail="Fabric lot not found.")
    return lot


@router.get("/fabric-lots")
async def list_fabric_lots(design_no: str = "", ctx: dict = Depends(require_design_or_production)):
    query: Dict[str, Any] = {"tenant_id": ctx["tenant_id"]}
    design_no = clean(design_no, 80)
    if design_no:
        query["design_no"] = design_no
    rows = [serialize(r) async for r in fabric_lots_collection.find(query).sort("received_at", -1).limit(1000)]
    return {"status": "success", "data": rows}


def _build_fabric_lot_doc(tenant_id: str, payload: dict, created_by: str = None, created_by_name: str = "") -> dict:
    """Shared by the authenticated Receive Lot form and the kiosk's own
    quick-add (a worker who's holding a roll HQ never logged yet) — same
    validation, same shape, either way."""
    fabric_name = clean(payload.get("fabric_name"), 160)
    if not fabric_name:
        raise HTTPException(status_code=400, detail="Fabric name is required.")
    lot_no = clean(payload.get("lot_no"), 80)
    if not lot_no:
        raise HTTPException(status_code=400, detail="Lot No. is required.")
    unit = clean(payload.get("unit"), 10).upper() or "MTR"
    if unit not in FABRIC_LOT_UNITS:
        raise HTTPException(status_code=400, detail="Unit must be MTR, KG or UNIT.")
    received_qty = number(payload.get("received_qty"))
    if received_qty <= 0:
        raise HTTPException(status_code=400, detail="Received quantity must be greater than zero.")
    opening_qty = number(payload.get("opening_qty"))
    qc_status = clean(payload.get("qc_status"), 20).upper() or "PENDING"
    if qc_status not in FABRIC_LOT_QC_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid QC status.")
    now = datetime.utcnow()
    return {
        "tenant_id": tenant_id,
        "lot_no": lot_no, "roll_no": clean(payload.get("roll_no"), 80),
        "fabric_name": fabric_name, "colour": clean(payload.get("colour"), 80),
        "width": clean(payload.get("width"), 40), "gsm": clean(payload.get("gsm"), 40),
        "vendor_name": clean(payload.get("vendor_name"), 160),
        "unit": unit, "rate": number(payload.get("rate")),
        "qc_status": qc_status, "qc_note": clean(payload.get("qc_note"), 500),
        "swatch_image_url": clean(payload.get("swatch_image_url") or payload.get("image_url"), 1000),
        "design_no": clean(payload.get("design_no"), 80),
        # What the fabric is actually destined to become — set once at
        # receiving time (often already known from the Design Project the
        # fabric was bought for), shown alongside the design_no so a roll
        # isn't just "D-205", it's "D-205 · Tunic · Women".
        "garment_type": clean(payload.get("garment_type"), 80), "gender_segment": clean(payload.get("gender_segment"), 80),
        # Invoice-based receiving (Step: Receive invoice) — bill_date and
        # received_date are the real-world dates on the paper invoice/GRN;
        # received_at below stays the system timestamp of when this record
        # was actually entered, same as before. invoice_no groups multiple
        # fabric rows received together on one bill.
        "invoice_no": clean(payload.get("invoice_no"), 80), "bill_date": clean(payload.get("bill_date"), 10),
        "received_date": clean(payload.get("received_date"), 10),
        "opening_qty": opening_qty, "received_qty": received_qty,
        "issued_qty": 0.0, "consumed_qty": 0.0, "waste_qty": 0.0, "returned_qty": 0.0, "recoverable_qty": 0.0,
        "closing_balance": round(opening_qty + received_qty, 3),
        "notes": clean(payload.get("notes"), 1000),
        "history": [{
            "type": "RECEIVED", "qty": received_qty, "note": "Fabric lot received.",
            "design_no": clean(payload.get("design_no"), 80) or None,
            "by": created_by, "by_name": created_by_name, "at": now,
        }],
        "received_at": now,
        "created_by": created_by, "created_by_name": created_by_name,
        "created_at": now, "updated_at": now,
    }


@router.post("/fabric-lots/invoice", status_code=201)
async def receive_fabric_invoice(payload: dict, ctx: dict = Depends(require_design_or_production)):
    """One invoice/GRN often brings in several DIFFERENT fabrics on the same
    day (e.g. 3 colours of cotton + 1 linen) — this records all of them in
    one go instead of repeating the single-roll Receive Lot form per fabric,
    sharing the invoice header (invoice_no/bill_date/received_date/vendor)
    across every row. Each row still becomes its own ordinary Fabric Lot —
    same balance/ledger machinery as a single Receive Lot, nothing new there.
    "Leftover fabric" is never typed here; it's each lot's own live balance,
    visible the moment the roll starts being issued/consumed."""
    invoice_no = clean(payload.get("invoice_no"), 80)
    bill_date = clean(payload.get("bill_date"), 10)
    received_date = clean(payload.get("received_date"), 10)
    vendor_name = clean(payload.get("vendor_name"), 160)
    rows = payload.get("rows") or []
    if not isinstance(rows, list) or not rows:
        raise HTTPException(status_code=400, detail="Add at least one fabric row to this invoice.")
    if len(rows) > 50:
        raise HTTPException(status_code=400, detail="Too many rows in one invoice — split into more than one invoice entry.")

    now = datetime.utcnow()
    docs = []
    for index, row in enumerate(rows, start=1):
        if not isinstance(row, dict):
            continue
        row_payload = {
            **row,
            "vendor_name": row.get("vendor_name") or vendor_name,
            "invoice_no": invoice_no, "bill_date": bill_date, "received_date": received_date,
            "lot_no": clean(row.get("lot_no"), 80) or (f"{invoice_no}-{index}" if invoice_no else f"INV-{now.strftime('%y%m%d')}-{index}"),
        }
        doc = _build_fabric_lot_doc(ctx["tenant_id"], row_payload, ctx.get("admin_id"), ctx.get("admin_name"))
        docs.append(doc)
    if not docs:
        raise HTTPException(status_code=400, detail="Add at least one fabric row to this invoice.")
    result = await fabric_lots_collection.insert_many(docs)
    saved = [serialize(await fabric_lots_collection.find_one({"_id": _id})) for _id in result.inserted_ids]
    return {"message": f"{len(saved)} fabric lot(s) received against invoice {invoice_no or '(no invoice no.)'}.", "data": saved}


# ─────────────────────────────────────────────────────────────────────────────
# Bulk fabric-receiving upload — same idea as the Daily Floor Log's Excel
# upload (template/preview/commit), for whoever still receives fabric
# against a paper invoice and transcribes it at day's end. The SAME
# Invoice No. repeated across several spreadsheet rows is exactly how more
# than one fabric on one bill gets captured — no special multi-row syntax.
# ─────────────────────────────────────────────────────────────────────────────

_FABRIC_TEMPLATE_HEADERS = [
    "Invoice No", "Bill Date", "Received Date", "Vendor", "Fabric Name", "Colour",
    "Width", "GSM", "Unit (MTR/KG/UNIT)", "Rate", "Received Qty", "Opening Qty",
    "Design No", "Item / Garment Type", "Gender", "Notes",
]
_FABRIC_COL_ALIASES = {
    "invoice_no": ("invoiceno", "invoicenumber", "billno", "grnno"),
    "bill_date": ("billdate", "invoicedate"),
    "received_date": ("receiveddate", "grndate", "date"),
    "vendor_name": ("vendor", "vendorname", "supplier", "suppliername"),
    "fabric_name": ("fabricname", "fabrictype", "fabric", "material", "materialname"),
    "colour": ("colour", "color", "shade"),
    "width": ("width", "fabricwidth"),
    "gsm": ("gsm",),
    "unit": ("unit", "uom"),
    "rate": ("rate", "ratepermtr", "unitrate", "price"),
    "received_qty": ("receivedqty", "totalfabric", "qty", "quantity", "receivedquantity"),
    "opening_qty": ("openingqty", "opening"),
    "design_no": ("designno", "designnumber", "style", "styleno"),
    "garment_type": ("item", "itemgarmenttype", "garmenttype", "itemtype", "garment"),
    "gender_segment": ("gender", "gendersegment", "department"),
    "notes": ("notes", "note", "remarks"),
}


def _fabric_key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").strip().lower())


def _parse_fabric_upload(content: bytes, filename: str) -> list:
    name = (filename or "").lower()
    try:
        if name.endswith(".csv"):
            frame = pd.read_csv(io.BytesIO(content), dtype=str)
        elif name.endswith((".xlsx", ".xls")):
            frame = pd.read_excel(io.BytesIO(content), dtype=str)
        else:
            raise HTTPException(status_code=400, detail="Upload a .csv or .xlsx file.")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="The file could not be read. Download the template and keep the headers.")
    frame = frame.where(pd.notnull(frame), "")

    colmap: Dict[str, str] = {}
    for column in frame.columns:
        key = _fabric_key(column)
        for field, aliases in _FABRIC_COL_ALIASES.items():
            if key in aliases and field not in colmap:
                colmap[field] = column
    if "fabric_name" not in colmap or "received_qty" not in colmap:
        raise HTTPException(status_code=400, detail="The file needs at least a Fabric Name and a Received Qty column.")

    rows = []
    for index, record in enumerate(frame.to_dict(orient="records"), start=2):
        def cell(field: str) -> str:
            return str(record.get(colmap.get(field, ""), "") or "").strip()

        errors: list = []

        def parse_date(field: str, label: str) -> str:
            raw = cell(field)
            if not raw:
                return ""
            try:
                return pd.to_datetime(raw, dayfirst=True, errors="raise").date().isoformat()
            except Exception:
                errors.append(f"{label} '{raw}' is not a valid date.")
                return ""

        bill_date = parse_date("bill_date", "Bill Date")
        received_date = parse_date("received_date", "Received Date")

        fabric_name = cell("fabric_name")
        if not fabric_name:
            errors.append("Fabric Name is required.")

        unit = cell("unit").upper() or "MTR"
        if unit not in FABRIC_LOT_UNITS:
            errors.append(f"Unit '{unit}' must be MTR, KG or UNIT.")

        def parse_number(field: str, label: str, required: bool = False) -> float:
            text = cell(field).replace(",", "")
            if not text:
                if required:
                    errors.append(f"{label} is required.")
                return 0.0
            try:
                value = float(text)
            except ValueError:
                errors.append(f"{label} '{text}' is not a number.")
                return 0.0
            if value < 0:
                errors.append(f"{label} cannot be negative.")
            return max(0.0, value)

        received_qty = parse_number("received_qty", "Received Qty", required=True)
        rate = parse_number("rate", "Rate")
        opening_qty = parse_number("opening_qty", "Opening Qty")

        rows.append({
            "row_no": index, "invoice_no": cell("invoice_no")[:80], "bill_date": bill_date, "received_date": received_date,
            "vendor_name": cell("vendor_name")[:160], "fabric_name": fabric_name[:160], "colour": cell("colour")[:80],
            "width": cell("width")[:40], "gsm": cell("gsm")[:40], "unit": unit, "rate": rate,
            "received_qty": received_qty, "opening_qty": opening_qty,
            "design_no": cell("design_no")[:80], "garment_type": cell("garment_type")[:80], "gender_segment": cell("gender_segment")[:80],
            "notes": cell("notes")[:1000], "errors": errors,
        })
    if not rows:
        raise HTTPException(status_code=400, detail="The file has no data rows.")
    return rows


@router.get("/fabric-lots/template")
async def fabric_lot_template(ctx: dict = Depends(require_design_or_production)):
    body = ",".join(f'"{h}"' for h in _FABRIC_TEMPLATE_HEADERS) + "\r\n"
    return Response(content=body, media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="fabric-receiving-template.csv"'})


@router.post("/fabric-lots/bulk/preview")
async def preview_fabric_lots(file: UploadFile = File(...), ctx: dict = Depends(require_design_or_production)):
    rows = _parse_fabric_upload(await file.read(), file.filename or "")
    invalid = sum(1 for r in rows if r["errors"])
    return {
        "status": "success", "mode": "preview_only",
        "summary": {"row_count": len(rows), "valid_count": len(rows) - invalid, "invalid_count": invalid},
        "rows": rows[:200], "truncated": len(rows) > 200,
    }


@router.post("/fabric-lots/bulk/commit")
async def commit_fabric_lots(file: UploadFile = File(...), ctx: dict = Depends(require_design_or_production)):
    rows = _parse_fabric_upload(await file.read(), file.filename or "")
    now = datetime.utcnow()
    docs, skipped = [], []
    # Per-invoice row counters so auto-generated lot numbers (when a row has
    # no lot_no of its own — this upload path never asks for one) don't
    # collide when the same Invoice No. repeats across several rows.
    seq_by_invoice: Dict[str, int] = {}
    for row in rows:
        if row["errors"]:
            skipped.append({"row_no": row["row_no"], "fabric_name": row["fabric_name"], "errors": row["errors"]})
            continue
        invoice_no = row["invoice_no"]
        seq_by_invoice[invoice_no] = seq_by_invoice.get(invoice_no, 0) + 1
        row_payload = {**row, "lot_no": f"{invoice_no}-{seq_by_invoice[invoice_no]}" if invoice_no else f"INV-{now.strftime('%y%m%d')}-{len(docs) + 1}"}
        docs.append(_build_fabric_lot_doc(ctx["tenant_id"], row_payload, ctx.get("admin_id"), ctx.get("admin_name")))
    if docs:
        await fabric_lots_collection.insert_many(docs, ordered=False)
    return {
        "status": "success", "mode": "committed",
        "inserted": len(docs), "rows_skipped": len(skipped), "skipped_rows": skipped[:200],
        "message": f"{len(docs)} fabric lot(s) imported" + (f", {len(skipped)} row(s) skipped" if skipped else "") + ".",
    }


@router.post("/fabric-lots", status_code=201)
async def create_fabric_lot(payload: dict, ctx: dict = Depends(require_design_or_production)):
    doc = _build_fabric_lot_doc(ctx["tenant_id"], payload, ctx.get("admin_id"), ctx.get("admin_name"))
    result = await fabric_lots_collection.insert_one(doc)
    saved = await fabric_lots_collection.find_one({"_id": result.inserted_id})
    return {"message": f"Fabric lot {doc['lot_no']} recorded.", "data": serialize(saved)}


@router.get("/fabric-lots/{lot_id}")
async def get_fabric_lot(lot_id: str, ctx: dict = Depends(require_design_or_production)):
    lot = await _fabric_lot_or_404(lot_id, ctx["tenant_id"])
    return {"status": "success", "data": serialize(lot)}


@router.patch("/fabric-lots/{lot_id}")
async def update_fabric_lot(lot_id: str, payload: dict, ctx: dict = Depends(require_design_or_production)):
    """Corrects lot master details (vendor, colour, width, GSM, QC, notes,
    design linkage) — never the quantity fields, which only ever move through
    the /transactions endpoint below so the audit trail can't be bypassed."""
    lot = await _fabric_lot_or_404(lot_id, ctx["tenant_id"])
    update: Dict[str, Any] = {}
    for key, limit in {"roll_no": 80, "fabric_name": 160, "colour": 80, "width": 40, "gsm": 40, "vendor_name": 160, "qc_note": 500, "design_no": 80, "notes": 1000}.items():
        if key in payload:
            update[key] = clean(payload[key], limit)
    if "qc_status" in payload:
        qc_status = clean(payload["qc_status"], 20).upper()
        if qc_status not in FABRIC_LOT_QC_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid QC status.")
        update["qc_status"] = qc_status
    if "rate" in payload:
        update["rate"] = number(payload.get("rate"))
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update.")
    update["updated_at"] = datetime.utcnow()
    await fabric_lots_collection.update_one({"_id": lot["_id"]}, {"$set": update})
    return {"message": "Fabric lot updated."}


@router.post("/fabric-lots/{lot_id}/swatch")
async def upload_fabric_swatch(lot_id: str, file: UploadFile = File(...), ctx: dict = Depends(require_design_or_production)):
    lot = await _fabric_lot_or_404(lot_id, ctx["tenant_id"])
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="The selected file is empty.")
    if len(raw) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image must be under 15 MB.")
    try:
        result = cloudinary.uploader.upload(raw, folder=f"rms/fabric-swatches/{ctx['tenant_id']}", resource_type="image")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not upload image: {exc}")
    url = result.get("secure_url") or result.get("url")
    await fabric_lots_collection.update_one({"_id": lot["_id"]}, {"$set": {"swatch_image_url": url, "updated_at": datetime.utcnow()}})
    return {"message": "Swatch image saved.", "swatch_image_url": url}


@router.post("/fabric-lots/{lot_id}/transactions", status_code=201)
async def record_fabric_lot_transaction(lot_id: str, payload: dict, ctx: dict = Depends(require_design_or_production)):
    """The only way a lot's quantity fields move, so every mtr/kg drawn down
    or returned is traceable to who did it, when, and against which design —
    same audit principle as the rest of this module (approvals, releases)."""
    lot = await _fabric_lot_or_404(lot_id, ctx["tenant_id"])
    txn_type = clean(payload.get("type"), 20).upper()
    if txn_type not in FABRIC_LOT_TXN_TYPES:
        raise HTTPException(status_code=400, detail="Type must be ISSUE, CONSUME, WASTE or RETURN.")
    qty = number(payload.get("qty"))
    if qty <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than zero.")
    design_no = clean(payload.get("design_no"), 80) or lot.get("design_no") or None
    note = clean(payload.get("note"), 500)

    # A WASTE transaction on a physical lot isn't tied to one floor
    # department, so it picks from this tenant's FULL wastage taxonomy
    # (Step 5) rather than a department-scoped subset — same categories,
    # same labels, so a lot's waste and a floor log's wastage roll up
    # together later.
    tenant_settings = _merge_settings(await design_settings_collection.find_one({"tenant_id": ctx["tenant_id"]}) or {})
    category_lookup = _wastage_category_lookup(tenant_settings["wastage_categories"])
    wastage_category = None
    if txn_type == "WASTE":
        wastage_category = clean(payload.get("category"), 40)
        if wastage_category not in category_lookup:
            raise HTTPException(status_code=400, detail=f"A valid wastage category is required ({', '.join(category_lookup.keys())}).")

    update: Dict[str, Any] = {}
    if txn_type == "ISSUE":
        if qty > number(lot.get("closing_balance")):
            raise HTTPException(status_code=409, detail=f"Only {lot.get('closing_balance')} {lot.get('unit')} left in this lot — cannot issue {qty}.")
        update["issued_qty"] = number(lot.get("issued_qty")) + qty
        update["closing_balance"] = round(number(lot.get("closing_balance")) - qty, 3)
    else:
        outstanding = _fabric_lot_outstanding_wip(lot)
        if qty > outstanding:
            raise HTTPException(status_code=409, detail=f"Only {round(outstanding, 3)} {lot.get('unit')} of issued fabric is still unaccounted for at the floor — cannot record {qty}.")
        if txn_type == "CONSUME":
            update["consumed_qty"] = number(lot.get("consumed_qty")) + qty
        elif txn_type == "WASTE":
            update["waste_qty"] = number(lot.get("waste_qty")) + qty
            if category_lookup[wastage_category]["is_recoverable"]:
                update["recoverable_qty"] = number(lot.get("recoverable_qty")) + qty
        elif txn_type == "RETURN":
            update["returned_qty"] = number(lot.get("returned_qty")) + qty
            update["closing_balance"] = round(number(lot.get("closing_balance")) + qty, 3)

    now = datetime.utcnow()
    update["updated_at"] = now
    history_entry = {
        "type": txn_type, "qty": qty, "note": note, "design_no": design_no,
        "category": wastage_category, "category_label": category_lookup.get(wastage_category, {}).get("label") if wastage_category else None,
        "by": ctx.get("admin_id"), "by_name": ctx.get("admin_name"), "at": now,
    }
    await fabric_lots_collection.update_one({"_id": lot["_id"]}, {"$set": update, "$push": {"history": history_entry}})
    saved = await fabric_lots_collection.find_one({"_id": lot["_id"]})
    return {"message": f"{txn_type.title()} of {qty} {lot.get('unit')} recorded.", "data": serialize(saved)}


# ─────────────────────────────────────────────────────────────────────────────
# Fabric Utilization Dashboard — Fabric & Production module, Step 6. A
# read-only rollup joining Steps 1-5: nothing new is stored here, it only
# aggregates the fabric lot ledger (received/issued/consumed/waste/
# recoverable/returned/closing balance) and, when a design has only one
# fabric unit in play (the common case), reports Utilization % and
# Wastage % against that design's TOTAL issued fabric. Optionally also
# compares against a pattern's planned requirement (Step 3) when a
# pattern_id + quantity are supplied, for a Planned vs Actual consumption
# view per design.
# ─────────────────────────────────────────────────────────────────────────────

def _fabric_utilization_row(design_no: str, lots: list) -> dict:
    received = sum(number(l.get("opening_qty")) + number(l.get("received_qty")) for l in lots)
    issued = sum(number(l.get("issued_qty")) for l in lots)
    consumed = sum(number(l.get("consumed_qty")) for l in lots)
    waste = sum(number(l.get("waste_qty")) for l in lots)
    recoverable = sum(number(l.get("recoverable_qty")) for l in lots)
    returned = sum(number(l.get("returned_qty")) for l in lots)
    closing_balance = sum(number(l.get("closing_balance")) for l in lots)

    waste_by_category: Dict[str, dict] = {}
    for lot in lots:
        for h in (lot.get("history") or []):
            if h.get("type") != "WASTE" or not h.get("category"):
                continue
            bucket = waste_by_category.setdefault(h["category"], {"category": h["category"], "label": h.get("category_label") or h["category"], "qty": 0.0})
            bucket["qty"] += number(h.get("qty"))

    # Utilization/Wastage % are both measured against ISSUED fabric (what
    # actually left the store for this design), not received — received can
    # include fabric still sitting unused in the store, which isn't a
    # utilization outcome yet.
    utilization_pct = round(consumed / issued * 100, 1) if issued else None
    wastage_pct = round(waste / issued * 100, 1) if issued else None

    return {
        "design_no": design_no, "lot_count": len(lots),
        "fabric_received": round(received, 3), "fabric_issued": round(issued, 3),
        "fabric_consumed": round(consumed, 3), "fabric_waste": round(waste, 3),
        "fabric_recoverable": round(recoverable, 3), "fabric_returned": round(returned, 3),
        "closing_balance": round(closing_balance, 3),
        "waste_by_category": sorted(({**v, "qty": round(v["qty"], 2)} for v in waste_by_category.values()), key=lambda x: -x["qty"]),
        "utilization_pct": utilization_pct, "wastage_pct": wastage_pct,
    }


@router.get("/fabric-utilization")
async def fabric_utilization(design_no: str = "", pattern_id: str = "", quantity: float = 0, ctx: dict = Depends(require_design_or_production)):
    query: Dict[str, Any] = {"tenant_id": ctx["tenant_id"]}
    design_no = clean(design_no, 80)
    if design_no:
        query["design_no"] = design_no
    all_lots = [l async for l in fabric_lots_collection.find(query)]

    by_design: Dict[str, list] = {}
    for lot in all_lots:
        by_design.setdefault(lot.get("design_no") or "(unlinked)", []).append(lot)
    rows = [_fabric_utilization_row(d, lots) for d, lots in by_design.items()]
    rows.sort(key=lambda r: r["design_no"])
    overall = _fabric_utilization_row("ALL DESIGNS", all_lots) if all_lots else None

    planned_vs_actual = None
    if design_no and pattern_id and ObjectId.is_valid(pattern_id):
        pattern = await design_patterns_collection.find_one({"_id": ObjectId(pattern_id), "tenant_id": ctx["tenant_id"]})
        if pattern:
            plan = _compute_size_plan(pattern, quantity)
            actual_consumed = sum(number(l.get("consumed_qty")) for l in all_lots)
            planned_required = number(plan.get("total_fabric_required"))
            planned_vs_actual = {
                "planned_required": planned_required, "actual_consumed": round(actual_consumed, 3),
                "variance": round(actual_consumed - planned_required, 3) if planned_required else None,
                "variance_pct": round((actual_consumed - planned_required) / planned_required * 100, 1) if planned_required else None,
            }

    return {
        "status": "success",
        "data": {
            "by_design": rows, "overall": overall,
            "planned_vs_actual": planned_vs_actual,
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# Fabric Reuse Matching — Fabric & Production module, Step 7. Given a lot
# with leftover fabric (closing_balance > 0), finds other designs already
# using the exact same fabric spec — type + colour + width + GSM — so
# leftover stock can be redirected to a design that still needs more of it
# instead of buying fresh fabric while this sits idle. A suggestion only —
# nothing is auto-reallocated; the transaction endpoints above are still the
# only way fabric actually moves.
# ─────────────────────────────────────────────────────────────────────────────

def _fabric_signature(lot: dict) -> tuple:
    return (
        (lot.get("fabric_name") or "").strip().lower(),
        (lot.get("colour") or "").strip().lower(),
        (lot.get("width") or "").strip().lower(),
        (lot.get("gsm") or "").strip().lower(),
    )


@router.get("/fabric-lots/{lot_id}/reuse-matches")
async def fabric_lot_reuse_matches(lot_id: str, ctx: dict = Depends(require_design_or_production)):
    source = await _fabric_lot_or_404(lot_id, ctx["tenant_id"])
    leftover = number(source.get("closing_balance"))
    if leftover <= 0:
        return {
            "status": "success",
            "data": {"lot_id": lot_id, "leftover_qty": 0, "unit": source.get("unit"), "matches": [], "note": "Nothing leftover on this lot to reuse."},
        }
    signature = _fabric_signature(source)
    if signature == ("", "", "", ""):
        return {
            "status": "success",
            "data": {"lot_id": lot_id, "leftover_qty": leftover, "unit": source.get("unit"), "matches": [], "note": "Fabric name, colour, width and GSM aren't recorded on this lot yet — add them to enable reuse matching."},
        }

    other_lots = [
        l async for l in fabric_lots_collection.find({"tenant_id": ctx["tenant_id"], "_id": {"$ne": source["_id"]}})
        if _fabric_signature(l) == signature and (l.get("design_no") or None) != (source.get("design_no") or None)
    ]

    by_design: Dict[str, dict] = {}
    for l in other_lots:
        design_no = l.get("design_no") or "(unlinked stock)"
        bucket = by_design.setdefault(design_no, {"design_no": design_no, "lot_count": 0, "own_balance": 0.0})
        bucket["lot_count"] += 1
        bucket["own_balance"] += number(l.get("closing_balance"))
    matches = sorted(({**v, "own_balance": round(v["own_balance"], 3)} for v in by_design.values()), key=lambda x: x["design_no"])

    return {
        "status": "success",
        "data": {
            "lot_id": lot_id, "design_no": source.get("design_no"), "leftover_qty": leftover, "unit": source.get("unit"),
            "fabric_name": source.get("fabric_name"), "colour": source.get("colour"), "width": source.get("width"), "gsm": source.get("gsm"),
            "matches": matches,
            "note": None if matches else "No other design currently uses this exact fabric spec (type, colour, width and GSM).",
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# Annual / FY Planning Rollup — Fabric & Production module, Step 9 (final).
# The most useful once a full season of real data exists, but the
# calculation logic is complete now: it reads what Steps 1-8 already
# produce/store (fabric lots, patterns, production batches, real sales) and
# turns it into next-year guidance — nothing new is entered by anyone for
# this, it's a pure rollup.
#   - utilization_ranking: which designs used fabric best/worst (Step 6)
#   - time_efficiency: actual vs standard time per internal worker and
#     external job worker (Step 4), across every batch
#   - sales_by_design: real sell-through by design + size over the period
#   - next_fy_suggestions: sold_qty x this design's own fabric consumption
#     (from its pattern, Step 2/3) = a size-ratio-aware fabric purchase
#     suggestion for next year, plus how well the current pattern's size
#     ratio matches what actually sold (a mismatch is worth re-grading).
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/fy-planning")
async def fy_planning(days: int = 365, ctx: dict = Depends(require_design_or_production)):
    tenant_id = ctx["tenant_id"]
    days = max(1, min(days, 1095))
    since = datetime.utcnow() - timedelta(days=days)

    # 1) Utilization ranking (reuses Step 6's per-design rollup logic).
    all_lots = [l async for l in fabric_lots_collection.find({"tenant_id": tenant_id})]
    by_design_lots: Dict[str, list] = {}
    for lot in all_lots:
        by_design_lots.setdefault(lot.get("design_no") or "(unlinked)", []).append(lot)
    utilization_rows = [_fabric_utilization_row(d, lots) for d, lots in by_design_lots.items() if d != "(unlinked)"]
    ranked = [r for r in utilization_rows if r["utilization_pct"] is not None]
    ranked_by_utilization = sorted(ranked, key=lambda r: -r["utilization_pct"])
    utilization_ranking = {
        "best": ranked_by_utilization[:5],
        "worst": list(reversed(ranked_by_utilization[-5:])) if ranked_by_utilization else [],
    }

    # 2) Time efficiency by internal worker and external job worker, across
    # every batch's completed operations that had a standard time set.
    worker_buckets: Dict[str, dict] = {}
    vendor_buckets: Dict[str, dict] = {}
    async for batch in production_batches_collection.find({"tenant_id": tenant_id, "updated_at": {"$gte": since}}):
        for op in batch.get("operations") or []:
            planned = op.get("planned_minutes")
            elapsed = op.get("elapsed_minutes")
            if not planned or not elapsed:
                continue
            if op.get("mode") == "EXTERNAL":
                vendor_name = ((op.get("external_party") or {}).get("vendor_name")) or "Unknown vendor"
                bucket = vendor_buckets.setdefault(vendor_name, {"name": vendor_name, "planned_minutes": 0.0, "elapsed_minutes": 0.0, "operations": 0})
            else:
                worker_name = op.get("worker_name") or "Unassigned"
                bucket = worker_buckets.setdefault(worker_name, {"name": worker_name, "planned_minutes": 0.0, "elapsed_minutes": 0.0, "operations": 0})
            bucket["planned_minutes"] += planned
            bucket["elapsed_minutes"] += elapsed
            bucket["operations"] += 1

    def _finalize_time_bucket(bucket: dict) -> dict:
        variance_pct = round((bucket["elapsed_minutes"] - bucket["planned_minutes"]) / bucket["planned_minutes"] * 100, 1) if bucket["planned_minutes"] else None
        return {**bucket, "planned_minutes": round(bucket["planned_minutes"], 1), "elapsed_minutes": round(bucket["elapsed_minutes"], 1), "variance_pct": variance_pct}

    time_efficiency = {
        "by_worker": sorted((_finalize_time_bucket(b) for b in worker_buckets.values()), key=lambda x: x["name"]),
        "by_vendor": sorted((_finalize_time_bucket(b) for b in vendor_buckets.values()), key=lambda x: x["name"]),
    }

    # 3) Real sell-through by design + size over the period.
    sold_by_design: Dict[str, dict] = {}
    async for doc in sales_collection.find({"tenant_id": tenant_id, "type": "sale", "created_at": {"$gte": since}}, {"items.design_no": 1, "items.qty": 1, "items.size": 1}):
        for item in doc.get("items", []):
            design_no = clean(item.get("design_no"), 120)
            if not design_no:
                continue
            bucket = sold_by_design.setdefault(design_no, {"design_no": design_no, "sold_qty": 0.0, "by_size": {}})
            qty = number(item.get("qty"))
            bucket["sold_qty"] += qty
            size = clean(item.get("size"), 20) or "Unspecified"
            bucket["by_size"][size] = bucket["by_size"].get(size, 0.0) + qty
    sales_by_design = sorted((
        {"design_no": v["design_no"], "sold_qty": round(v["sold_qty"], 2), "by_size": [{"size": s, "qty": round(q, 2)} for s, q in sorted(v["by_size"].items(), key=lambda x: -x[1])]}
        for v in sold_by_design.values()
    ), key=lambda x: -x["sold_qty"])

    # 4) Next-FY fabric purchase suggestion per sale-proven design, using
    # each design's own latest pattern for consumption/wastage/size ratio —
    # and flagging when actual sell-through by size doesn't match the
    # pattern's size ratio (worth re-grading before next year's cut plan).
    next_fy_suggestions = []
    for row in sales_by_design[:50]:
        design_no = row["design_no"]
        pattern = await design_patterns_collection.find_one({"tenant_id": tenant_id, "design_no": design_no}, sort=[("created_at", -1)])
        suggestion = {"design_no": design_no, "sold_qty": row["sold_qty"], "actual_size_split": row["by_size"]}
        if pattern:
            plan = _compute_size_plan(pattern, row["sold_qty"])
            suggestion["suggested_fabric_qty"] = plan.get("total_fabric_required")
            suggestion["pattern_size_ratio"] = pattern.get("size_ratio") or []
            total_sold = sum(item["qty"] for item in row["by_size"]) or 1
            actual_pct = {item["size"]: round(item["qty"] / total_sold * 100, 1) for item in row["by_size"]}
            mismatches = []
            for r in (pattern.get("size_ratio") or []):
                actual = actual_pct.get(r.get("size"))
                if actual is not None and abs(actual - number(r.get("ratio_pct"))) >= 10:
                    mismatches.append({"size": r.get("size"), "pattern_ratio_pct": number(r.get("ratio_pct")), "actual_sold_pct": actual})
            suggestion["size_ratio_mismatches"] = mismatches
        else:
            suggestion["note"] = "No pattern found for this design — cannot estimate fabric requirement."
        next_fy_suggestions.append(suggestion)

    return {
        "status": "success",
        "data": {
            "period_days": days,
            "utilization_ranking": utilization_ranking,
            "time_efficiency": time_efficiency,
            "sales_by_design": sales_by_design,
            "next_fy_suggestions": next_fy_suggestions,
        },
    }
