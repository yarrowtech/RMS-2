"""
Lightweight product-usage analytics — page views, feature usage, session
duration, device type. Separate from audit_logs_collection (a compliance
record of discrete admin actions); this is aggregate behavioural data for
Super Admin's Usage Analytics tab — which pages get visited, which features
get used, how long people stay, what device they're on. The /tenant/*
endpoints below serve the same data narrowed to one retailer's own HQ
admins, for their own Usage Analytics view — the platform-wide endpoints
stay Super-Admin-only.

Ingestion is deliberately UNAUTHENTICATED. Half of what needs tracking —
landing page visits, onboarding attempts — happens before anyone has a
login token, so this can't require one. When a token IS present it's
decoded best-effort to attach tenant/role context; a missing or invalid
token just means an anonymous event, never a 401 — a tracking call must
never be able to break the page that fired it.
"""
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from jose import JWTError, jwt
from pydantic import BaseModel, Field

from ..config import settings
from ..db import admins_collection, usage_events_collection, vendors_collection
from .deps import get_hq_tenant

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

EVENT_TYPES = {"page_view", "feature_used", "session_start", "session_end"}
DEVICE_TYPES = {"desktop", "mobile", "tablet"}
MAX_DURATION_MS = 1000 * 60 * 60 * 24  # 24h ceiling — guards against a corrupt/huge client value skewing the average


class EventRequest(BaseModel):
    event_type: str
    session_id: str = Field(..., min_length=8, max_length=100)
    path: Optional[str] = Field(None, max_length=300)
    feature: Optional[str] = Field(None, max_length=120)
    device_type: Optional[str] = Field(None, max_length=20)
    duration_ms: Optional[int] = Field(None, ge=0, le=MAX_DURATION_MS)
    meta: Optional[Dict[str, Any]] = None


def _best_effort_identity(authorization: Optional[str]) -> Dict[str, Any]:
    """Never raises — a bad/missing/expired token just means 'anonymous'."""
    if not authorization or not authorization.startswith("Bearer "):
        return {}
    try:
        payload = jwt.decode(authorization.split(" ", 1)[1], settings.secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return {}

    if payload.get("vendor_id"):
        return {"role": "vendor", "vendor_id": payload.get("vendor_id"), "email": payload.get("email")}
    if payload.get("role") == "super_admin":
        return {"role": "super_admin", "admin_id": payload.get("sub")}
    if payload.get("role") in ("ADMIN", "admin"):
        return {
            "role": "admin",
            "admin_id": payload.get("sub"),
            "tenant_id": payload.get("tenant_id"),
            "scope": payload.get("scope"),
            "department": payload.get("department"),
        }
    return {}


@router.post("/event")
async def track_event(payload: EventRequest, authorization: Optional[str] = Header(None)):
    if payload.event_type not in EVENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid event_type '{payload.event_type}'")

    doc = {
        "event_type": payload.event_type,
        "session_id": payload.session_id,
        "path": payload.path,
        "feature": payload.feature,
        "device_type": payload.device_type if payload.device_type in DEVICE_TYPES else "unknown",
        "duration_ms": payload.duration_ms,
        "meta": payload.meta or {},
        "created_at": datetime.utcnow(),
        **_best_effort_identity(authorization),
    }
    await usage_events_collection.insert_one(doc)
    return {"ok": True}


async def _require_superadmin(authorization: str = Header(None)) -> dict:
    # Local, self-contained on purpose — same pattern as support_routes.py's
    # own copy, rather than importing a "private" helper across feature
    # modules.
    from .auth_routes import get_current_superadmin
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization token missing")
    return await get_current_superadmin(authorization.split(" ", 1)[1])


async def _compute_summary(match: Dict[str, Any], days: int) -> dict:
    total_events = await usage_events_collection.count_documents(match)
    unique_sessions = len(await usage_events_collection.distinct("session_id", match))
    page_views = await usage_events_collection.count_documents({**match, "event_type": "page_view"})
    retailer_onboarding_visits = await usage_events_collection.count_documents(
        {**match, "event_type": "page_view", "path": "/onboarding"}
    )
    retailer_onboarding_submits = await usage_events_collection.count_documents(
        {**match, "event_type": "feature_used", "feature": "onboarding.submitted"}
    )
    vendor_onboarding_visits = await usage_events_collection.count_documents(
        {**match, "event_type": "page_view", "path": {"$in": ["/vendor/register", "/merchandiser-seller/register"]}}
    )
    vendor_onboarding_submits = await usage_events_collection.count_documents(
        {**match, "event_type": "feature_used", "feature": "vendor.onboarding_submitted"}
    )
    subscription_taps = await usage_events_collection.count_documents(
        {**match, "event_type": "feature_used", "feature": "subscription.cta_click"}
    )

    top_pages = [
        {"path": row["_id"], "views": row["count"]}
        async for row in usage_events_collection.aggregate([
            {"$match": {**match, "event_type": "page_view", "path": {"$ne": None}}},
            {"$group": {"_id": "$path", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 15},
        ])
    ]

    top_features = [
        {"feature": row["_id"], "count": row["count"]}
        async for row in usage_events_collection.aggregate([
            {"$match": {**match, "event_type": "feature_used", "feature": {"$ne": None}}},
            {"$group": {"_id": "$feature", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 15},
        ])
    ]

    # One session_start per session, so this counts sessions, not page views.
    device_breakdown = {"desktop": 0, "mobile": 0, "tablet": 0, "unknown": 0}
    async for row in usage_events_collection.aggregate([
        {"$match": {**match, "event_type": "session_start"}},
        {"$group": {"_id": "$device_type", "count": {"$sum": 1}}},
    ]):
        key = row["_id"] if row["_id"] in device_breakdown else "unknown"
        device_breakdown[key] += row["count"]

    duration_rows = await usage_events_collection.aggregate([
        {"$match": {**match, "event_type": "session_end", "duration_ms": {"$ne": None}}},
        {"$group": {"_id": None, "avg_ms": {"$avg": "$duration_ms"}, "count": {"$sum": 1}}},
    ]).to_list(length=1)
    avg_session_duration_seconds = round(duration_rows[0]["avg_ms"] / 1000, 1) if duration_rows else 0
    completed_sessions = duration_rows[0]["count"] if duration_rows else 0

    return {
        "range_days": days,
        "total_events": total_events,
        "unique_sessions": unique_sessions,
        "page_views": page_views,
        "avg_session_duration_seconds": avg_session_duration_seconds,
        "completed_sessions": completed_sessions,
        "device_breakdown": device_breakdown,
        "top_pages": top_pages,
        "top_features": top_features,
        "onboarding": {
            "retailer": {"visited": retailer_onboarding_visits, "submitted": retailer_onboarding_submits},
            "vendor": {"visited": vendor_onboarding_visits, "submitted": vendor_onboarding_submits},
        },
        "subscription_cta_taps": subscription_taps,
    }


@router.get("/summary")
async def analytics_summary(days: int = Query(30, ge=1, le=365), admin: dict = Depends(_require_superadmin)):
    since = datetime.utcnow() - timedelta(days=days)
    match: Dict[str, Any] = {"created_at": {"$gte": since}}
    return await _compute_summary(match, days)


@router.get("/tenant/summary")
async def tenant_analytics_summary(days: int = Query(30, ge=1, le=365), ctx: dict = Depends(get_hq_tenant)):
    """Same aggregate shape as /summary, narrowed to this retailer's own HQ
    admins only — tracked events only carry tenant_id for the 'admin' role
    (see _best_effort_identity above), so this naturally excludes vendor
    activity and every other tenant's data without an extra filter."""
    since = datetime.utcnow() - timedelta(days=days)
    match: Dict[str, Any] = {"created_at": {"$gte": since}, "tenant_id": ctx["tenant_id"]}
    return await _compute_summary(match, days)


async def _compute_users(match: Dict[str, Any], days: int, limit: int) -> dict:
    """Per-user drill-down: who's actually using RMS, which portal, which
    pages they open, which features they use. Grouped in Python over the
    matched cursor (same manual-aggregation style as forecast_analytics_routes
    .py's _compute_demand_forecast) rather than a heavy Mongo pipeline, since
    "top N pages/features per user" doesn't collapse cleanly into one
    aggregate stage anyway."""
    users: Dict[str, Dict[str, Any]] = {}
    async for doc in usage_events_collection.find(match, {
        "role": 1, "admin_id": 1, "vendor_id": 1, "tenant_id": 1, "department": 1,
        "scope": 1, "email": 1, "event_type": 1, "path": 1, "feature": 1,
        "session_id": 1, "created_at": 1,
    }):
        role = doc.get("role")
        user_key = doc.get("admin_id") if role == "admin" else doc.get("vendor_id")
        if not user_key:
            continue

        u = users.get(user_key)
        if not u:
            u = users[user_key] = {
                "user_key": user_key, "role": role,
                "tenant_id": doc.get("tenant_id"), "department": doc.get("department"),
                "scope": doc.get("scope"), "email": doc.get("email"),
                "sessions": set(), "page_views": 0, "feature_uses": 0,
                "pages": defaultdict(int), "features": defaultdict(int),
                "last_active": doc.get("created_at"),
            }
        session_id = doc.get("session_id")
        if session_id:
            u["sessions"].add(session_id)
        created = doc.get("created_at")
        if isinstance(created, datetime) and (not u["last_active"] or created > u["last_active"]):
            u["last_active"] = created
        if not u.get("email") and doc.get("email"):
            u["email"] = doc.get("email")

        if doc.get("event_type") == "page_view":
            u["page_views"] += 1
            if doc.get("path"):
                u["pages"][doc["path"]] += 1
        elif doc.get("event_type") == "feature_used":
            u["feature_uses"] += 1
            if doc.get("feature"):
                u["features"][doc["feature"]] += 1

    # Resolve display names in two batched lookups rather than one per user.
    admin_ids = [ObjectId(k) for k, u in users.items() if u["role"] == "admin" and ObjectId.is_valid(k)]
    vendor_ids = [ObjectId(k) for k, u in users.items() if u["role"] == "vendor" and ObjectId.is_valid(k)]
    names: Dict[str, str] = {}
    if admin_ids:
        async for a in admins_collection.find({"_id": {"$in": admin_ids}}, {"name": 1, "email": 1}):
            names[str(a["_id"])] = a.get("name") or a.get("email", "")
    if vendor_ids:
        async for v in vendors_collection.find({"_id": {"$in": vendor_ids}}, {"name": 1, "vendor_name": 1}):
            names[str(v["_id"])] = v.get("name") or v.get("vendor_name", "")

    rows: List[dict] = []
    for key, u in users.items():
        top_pages = sorted(u["pages"].items(), key=lambda kv: kv[1], reverse=True)[:5]
        top_features = sorted(u["features"].items(), key=lambda kv: kv[1], reverse=True)[:5]
        rows.append({
            "user_key": key,
            "role": u["role"],
            "name": names.get(key, ""),
            "email": u.get("email", ""),
            "tenant_id": u.get("tenant_id"),
            "department": u.get("department"),
            "scope": u.get("scope"),
            "sessions": len(u["sessions"]),
            "page_views": u["page_views"],
            "feature_uses": u["feature_uses"],
            "last_active": u["last_active"].isoformat() if isinstance(u["last_active"], datetime) else None,
            "top_pages": [{"path": p, "views": c} for p, c in top_pages],
            "top_features": [{"feature": f, "count": c} for f, c in top_features],
        })

    rows.sort(key=lambda r: r["last_active"] or "", reverse=True)
    return {"range_days": days, "count": len(rows), "data": rows[:limit]}


@router.get("/users")
async def analytics_users(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(50, ge=1, le=200),
    admin: dict = Depends(_require_superadmin),
):
    since = datetime.utcnow() - timedelta(days=days)
    match: Dict[str, Any] = {"created_at": {"$gte": since}, "role": {"$in": ["admin", "vendor"]}}
    return await _compute_users(match, days, limit)


@router.get("/tenant/users")
async def tenant_analytics_users(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(50, ge=1, le=200),
    ctx: dict = Depends(get_hq_tenant),
):
    """Same per-user drill-down as /users, narrowed to this retailer's own
    HQ admins — role locked to 'admin' and tenant_id locked to the caller's
    own tenant, so no vendor telemetry or other tenant's admins ever show up
    here regardless of what a client might try to pass."""
    since = datetime.utcnow() - timedelta(days=days)
    match: Dict[str, Any] = {"created_at": {"$gte": since}, "role": "admin", "tenant_id": ctx["tenant_id"]}
    return await _compute_users(match, days, limit)
