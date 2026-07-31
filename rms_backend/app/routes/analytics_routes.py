"""
Lightweight product-usage analytics — page views, feature usage, session
duration, device type. Separate from audit_logs_collection (a compliance
record of discrete admin actions); this is aggregate behavioural data for
Super Admin's Usage Analytics tab — which pages get visited, which features
get used, how long people stay, what device they're on.

Ingestion is deliberately UNAUTHENTICATED. Half of what needs tracking —
landing page visits, onboarding attempts — happens before anyone has a
login token, so this can't require one. When a token IS present it's
decoded best-effort to attach tenant/role context; a missing or invalid
token just means an anonymous event, never a 401 — a tracking call must
never be able to break the page that fired it.
"""
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from jose import JWTError, jwt
from pydantic import BaseModel, Field

from ..config import settings
from ..db import usage_events_collection

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
        return {"role": "vendor", "vendor_id": payload.get("vendor_id")}
    if payload.get("role") == "super_admin":
        return {"role": "super_admin"}
    if payload.get("role") in ("ADMIN", "admin"):
        return {
            "role": "admin",
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


@router.get("/summary")
async def analytics_summary(days: int = Query(30, ge=1, le=365), admin: dict = Depends(_require_superadmin)):
    since = datetime.utcnow() - timedelta(days=days)
    match: Dict[str, Any] = {"created_at": {"$gte": since}}

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
