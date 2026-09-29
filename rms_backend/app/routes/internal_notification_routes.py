"""
internal_notification_routes.py
================================
RMS Communication Centre — Phase 2, foundation.

A single, generic, tenant-scoped notification record that any module can
raise when something needs another admin's or department's attention
(e.g. a leave decision, a low-stock alert, a delayed PO). It deliberately
does NOT try to be a chat app: every row is meant to point back at the
business record that caused it (`ref_type` + `ref_id`), per the project's
own rule of keeping this business-context communication, not open-ended
messaging.

This file only reads/writes `internal_notifications_collection`. Nothing
else in the app is touched by adding it — other modules opt in later by
calling `notify()` at one extra line, after their own existing logic.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
from datetime import datetime
from bson import ObjectId

from .deps import get_any_tenant
from ..db import (
    internal_notifications_collection, internal_notification_reads_collection,
    internal_chat_preferences_collection,
)

router = APIRouter(prefix="/api/internal-notifications", tags=["Internal Notifications"])

TenantCtx = Dict[str, Any]

PRIORITIES = {"normal", "high", "urgent"}

# Sentinel department value meaning "everyone in the tenant" — an HQ
# announcement, not a real department name. Every admin's inbox query below
# always includes it, on top of whatever department(s) they actually belong to.
BROADCAST = "ALL"

# Same set staff_task_routes.py treats as tenant-wide/full-access — an HQ
# announcement is a bigger megaphone than a staff task, so it's gated at
# least as tightly.
FULL_ACCESS_DEPARTMENTS = {"HQ", "Administrator", "IT", "SUPERADMIN", "Store Owner"}


def _can_announce(ctx: TenantCtx) -> bool:
    if ctx.get("department") in FULL_ACCESS_DEPARTMENTS:
        return True
    return "HQ" in set(ctx.get("_managed_departments") or [])


def _serialize(doc: dict, *, read: bool = False) -> dict:
    return {
        "id": str(doc["_id"]),
        "type": doc.get("type", ""),
        "title": doc.get("title", ""),
        "message": doc.get("message", ""),
        "department": doc.get("department") or "",
        "target_admin_id": doc.get("target_admin_id") or "",
        "ref_type": doc.get("ref_type") or "",
        "ref_id": doc.get("ref_id") or "",
        "priority": doc.get("priority", "normal"),
        "read": read,
        "created_at": doc.get("created_at").isoformat() if isinstance(doc.get("created_at"), datetime) else None,
    }


async def notify(
    tenant_id: str,
    *,
    type: str,
    title: str,
    message: str = "",
    department: Optional[str] = None,
    target_admin_id: Optional[str] = None,
    ref_type: Optional[str] = None,
    ref_id: Optional[str] = None,
    priority: str = "normal",
    exclude_admin_id: Optional[str] = None,
) -> None:
    """Called from OTHER routers, after their own existing logic already ran,
    to raise one notification. Deliberately swallows its own errors — a
    failure here must never break the real action that triggered it."""
    try:
        await internal_notifications_collection.insert_one({
            "tenant_id": tenant_id,
            "type": type,
            "title": title,
            "message": message,
            "department": department,
            "target_admin_id": target_admin_id,
            "ref_type": ref_type,
            "ref_id": ref_id,
            "priority": priority if priority in PRIORITIES else "normal",
            # Legacy rows used one shared read field. New rows use one read
            # pointer per admin in internal_notification_reads_collection.
            "read": False,
            "exclude_admin_id": exclude_admin_id,
            "created_at": datetime.utcnow(),
        })
    except Exception:
        pass


class Announcement(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    message: str = Field(default="", max_length=2000)
    priority: str = "normal"


@router.post("/announce", status_code=201)
async def create_announcement(payload: Announcement, ctx: TenantCtx = Depends(get_any_tenant)):
    """HQ (or an admin with HQ among their managed departments) posts one
    notice that every admin in the tenant sees — one-to-many, e.g. a policy
    change or a festive-sale heads-up. Uses the same `notify()` helper and
    row shape as every other trigger, just with department=BROADCAST."""
    if not _can_announce(ctx):
        raise HTTPException(status_code=403, detail="Only HQ can post a tenant-wide announcement.")
    priority = payload.priority.strip().lower()
    if priority not in PRIORITIES:
        raise HTTPException(status_code=400, detail=f"Priority must be one of: {sorted(PRIORITIES)}")
    await notify(
        ctx["tenant_id"], type="announcement", title=payload.title.strip(), message=payload.message.strip(),
        department=BROADCAST, ref_type=None, ref_id=None, priority=priority,
    )
    return {"message": "Announcement posted."}


def _my_notification_query(ctx: TenantCtx) -> dict:
    """Rows this admin is an intended recipient of, never rows they sent."""
    departments = set(ctx.get("_managed_departments") or [])
    if ctx.get("department"):
        departments.add(ctx["department"])
    departments.add(BROADCAST)
    return {
        "tenant_id": ctx["tenant_id"],
        "exclude_admin_id": {"$ne": ctx["admin_id"]},
        "$or": [
            {"target_admin_id": ctx["admin_id"]},
            {"department": {"$in": list(departments)}},
        ],
    }


async def _is_read_by(tenant_id: str, admin_id: str, notification_id: ObjectId) -> bool:
    row = await internal_notification_reads_collection.find_one({
        "tenant_id": tenant_id, "admin_id": admin_id, "notification_id": notification_id,
    })
    return bool(row)


@router.get("")
async def list_my_notifications(unread_only: bool = False, ctx: TenantCtx = Depends(get_any_tenant)):
    """Notifications addressed to me directly, broadcast to my department(s),
    or a tenant-wide HQ announcement."""
    rows = []
    async for doc in internal_notifications_collection.find(_my_notification_query(ctx)).sort("created_at", -1).limit(200):
        if doc.get("ref_type") in {"chat_dm", "chat_department"} and doc.get("ref_id"):
            preference = await internal_chat_preferences_collection.find_one({
                "tenant_id": ctx["tenant_id"], "admin_id": ctx["admin_id"],
                "conversation_key": doc["ref_id"], "muted": True,
            })
            if preference:
                continue
        read = await _is_read_by(ctx["tenant_id"], ctx["admin_id"], doc["_id"])
        if not unread_only or not read:
            rows.append(_serialize(doc, read=read))
    unread_count = sum(1 for r in rows if not r["read"]) if not unread_only else len(rows)
    return {"data": rows, "unread_count": unread_count}


@router.patch("/{notification_id}/read")
async def mark_read(notification_id: str, ctx: TenantCtx = Depends(get_any_tenant)):
    try:
        oid = ObjectId(notification_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid notification ID.")
    query = _my_notification_query(ctx)
    query["_id"] = oid
    doc = await internal_notifications_collection.find_one(query)
    if not doc:
        raise HTTPException(status_code=404, detail="Notification not found.")
    await internal_notification_reads_collection.update_one(
        {"tenant_id": ctx["tenant_id"], "admin_id": ctx["admin_id"], "notification_id": oid},
        {"$set": {"read_at": datetime.utcnow()}},
        upsert=True,
    )
    return {"message": "Marked as read."}


@router.patch("/read-all")
async def mark_all_read(ctx: TenantCtx = Depends(get_any_tenant)):
    notification_ids = [doc["_id"] async for doc in internal_notifications_collection.find(
        _my_notification_query(ctx), {"_id": 1}
    ).limit(200)]
    updated = 0
    for notification_id in notification_ids:
        result = await internal_notification_reads_collection.update_one(
            {"tenant_id": ctx["tenant_id"], "admin_id": ctx["admin_id"], "notification_id": notification_id},
            {"$set": {"read_at": datetime.utcnow()}},
            upsert=True,
        )
        updated += 1 if result.upserted_id else 0
    return {"message": "All marked as read.", "updated": updated}
