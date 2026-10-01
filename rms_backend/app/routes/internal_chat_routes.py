"""
internal_chat_routes.py
========================
RMS Communication Centre — real chat, on top of (not replacing) the
notification bell and document comments already built. Two kinds of
conversation, both tenant-scoped:

  - "dm"         — one-to-one between any two admins in the tenant.
  - "department" — one running room per department PER LOCATION, i.e.
                    keyed by (department, store_id). This matters: a
                    department name like "Cashier" or "Inventory" exists
                    at HQ and at every store, and those are different
                    teams — Store A's Cashier chat must not be the same
                    room as Store B's or HQ's.

Both message kinds live in one collection (internal_chat_messages) with a
conversation_key that encodes which kind it is, plus a small per-admin
"last read" pointer collection (internal_chat_reads) so unread counts are
correct per person — a real gap the notification bell's shared `read` flag
has today, deliberately not repeated here.

Additive only: two new collections, one new router. Nothing else is read
or written by this file.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta
from bson import ObjectId

from .deps import get_any_tenant
from .internal_notification_routes import notify as notify_internal
from ..db import (
    admins_collection, internal_chat_messages_collection, internal_chat_reads_collection,
    internal_chat_preferences_collection, internal_chat_channel_settings_collection,
)

router = APIRouter(prefix="/api/internal-chat", tags=["Internal Chat"])

TenantCtx = Dict[str, Any]

FULL_ACCESS_DEPARTMENTS = {"HQ", "Administrator", "IT", "SUPERADMIN", "Store Owner"}

# Display order in the Communication Centre. The API only returns a
# department if it is assigned to at least one admin in this tenant, except
# HQ which is always available to HQ/full-access admins.
DEPARTMENT_ORDER = [
    "HQ", "IT", "Merchandiser Buyer", "Inventory", "Cashier", "Finance", "HR",
    "Logistics", "Design & Pattern", "Production & Job Work", "Forecast & Analytics",
    "Third Party", "Marketing", "Customer CRM", "Store Owner",
]


def _dm_key(admin_id_a: str, admin_id_b: str) -> str:
    a, b = sorted([admin_id_a, admin_id_b])
    return f"dm:{a}:{b}"


def _department_key(department: str, store_id: Optional[str]) -> str:
    return f"dept:{department}:{store_id or 'HQ'}"


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "conversation_key": doc.get("conversation_key", ""),
        "sender_id": doc.get("sender_id", ""),
        "sender_name": doc.get("sender_name", ""),
        "sender_department": doc.get("sender_department", ""),
        "message": "" if doc.get("deleted_at") else doc.get("message", ""),
        "attachments": [] if doc.get("deleted_at") else (doc.get("attachments") or []),
        "removed": bool(doc.get("deleted_at")),
        "created_at": doc.get("created_at").isoformat() if isinstance(doc.get("created_at"), datetime) else None,
    }


async def _mark_read(tenant_id: str, admin_id: str, conversation_key: str, when: datetime) -> None:
    await internal_chat_reads_collection.update_one(
        {"tenant_id": tenant_id, "admin_id": admin_id, "conversation_key": conversation_key},
        {"$set": {"last_read_at": when}}, upsert=True,
    )


async def _unread_count(tenant_id: str, admin_id: str, conversation_key: str) -> int:
    read_doc = await internal_chat_reads_collection.find_one(
        {"tenant_id": tenant_id, "admin_id": admin_id, "conversation_key": conversation_key}
    )
    since = read_doc["last_read_at"] if read_doc else datetime.min
    return await internal_chat_messages_collection.count_documents({
        "tenant_id": tenant_id, "conversation_key": conversation_key,
        "sender_id": {"$ne": admin_id}, "created_at": {"$gt": since},
        "$or": [{"deleted_at": {"$exists": False}}, {"deleted_at": None}],
    })


def _my_departments(ctx: TenantCtx) -> set:
    departments = set(ctx.get("_managed_departments") or [])
    if ctx.get("department"):
        departments.add(ctx["department"])
    return departments


def _own_store_id(ctx: TenantCtx) -> Optional[str]:
    return ctx.get("store_id") if ctx.get("scope") in ("store", "branch") else None


def _can_manage_channels(ctx: TenantCtx) -> bool:
    return ctx.get("department") in FULL_ACCESS_DEPARTMENTS or "HQ" in _my_departments(ctx)


def _hidden_for_me(preference: Optional[dict], last_message: Optional[dict]) -> bool:
    hidden_at = (preference or {}).get("hidden_at")
    if not hidden_at:
        return False
    return not last_message or last_message.get("created_at") <= hidden_at


async def _visible_departments(ctx: TenantCtx) -> list[str]:
    """Department channels visible to this admin at their own location."""
    mine = _my_departments(ctx)
    if ctx.get("department") not in FULL_ACCESS_DEPARTMENTS:
        return sorted(d for d in mine if d)

    visible = {"HQ", *mine}
    async for admin in admins_collection.find(
        {"tenant_id": ctx["tenant_id"], "department": {"$ne": "SUPERADMIN"}},
        {"department": 1, "managedDepartments": 1},
    ):
        if admin.get("department"):
            visible.add(admin["department"])
        visible.update(d for d in (admin.get("managedDepartments") or []) if d)
    ordered = [d for d in DEPARTMENT_ORDER if d in visible]
    return ordered + sorted(visible - set(ordered))


class Mention(BaseModel):
    type: str  # "admin" | "department"
    value: str  # admin_id, or department name


class Attachment(BaseModel):
    name: str = ""
    url: str
    resource_type: str = ""
    format: str = ""
    bytes: int = 0


class MessageCreate(BaseModel):
    message: str = Field(default="", max_length=4000)
    mentions: List[Mention] = Field(default_factory=list)
    attachments: List[Attachment] = Field(default_factory=list)


class ConversationPreferenceUpdate(BaseModel):
    conversation_key: str = Field(min_length=5, max_length=300)
    hidden: Optional[bool] = None
    muted: Optional[bool] = None


class ChannelArchiveUpdate(BaseModel):
    archived: bool = True


async def _notify_mentions(tenant_id: str, mentions: List[Mention], *, from_name: str, snippet: str, ref_type: str, ref_id: str) -> None:
    """@mention picked from an autocomplete list (not parsed from free text —
    the frontend sends the exact admin_id/department the user selected), so
    this never misfires on a name that merely appears in the message."""
    for m in mentions[:10]:  # a sane cap; this is a mention, not a broadcast list
        title = f"{from_name} mentioned you"
        message = snippet[:140]
        if m.type == "admin" and ObjectId.is_valid(m.value):
            await notify_internal(tenant_id, type="mention", title=title, message=message,
                                   target_admin_id=m.value, ref_type=ref_type, ref_id=ref_id, priority="high")
        elif m.type == "department" and m.value:
            await notify_internal(tenant_id, type="mention", title=f"{from_name} mentioned {m.value}", message=message,
                                   department=m.value, ref_type=ref_type, ref_id=ref_id, priority="high")


async def _assert_conversation_preference_access(ctx: TenantCtx, conversation_key: str) -> None:
    """A preference is personal, but must still refer to a conversation this
    admin is authorised to open."""
    parts = conversation_key.split(":")
    if len(parts) == 3 and parts[0] == "dm" and ctx["admin_id"] in parts[1:]:
        return
    if len(parts) == 3 and parts[0] == "dept":
        store_id = None if parts[2] == "HQ" else parts[2]
        _assert_department_access(ctx, parts[1], store_id)
        return
    raise HTTPException(status_code=400, detail="Invalid conversation.")


@router.patch("/preferences")
async def update_conversation_preference(payload: ConversationPreferenceUpdate, ctx: TenantCtx = Depends(get_any_tenant)):
    await _assert_conversation_preference_access(ctx, payload.conversation_key)
    changes: dict = {"updated_at": datetime.utcnow()}
    if payload.hidden is not None:
        if payload.hidden:
            changes["hidden_at"] = datetime.utcnow()
        else:
            changes["hidden_at"] = None
    if payload.muted is not None:
        changes["muted"] = payload.muted
    if len(changes) == 1:
        raise HTTPException(status_code=400, detail="Choose hide or mute.")
    await internal_chat_preferences_collection.update_one(
        {"tenant_id": ctx["tenant_id"], "admin_id": ctx["admin_id"], "conversation_key": payload.conversation_key},
        {"$set": changes}, upsert=True,
    )
    return {"message": "Chat preference saved."}


@router.get("/conversations")
async def list_conversations(
    include_hidden: bool = Query(False),
    ctx: TenantCtx = Depends(get_any_tenant),
):
    """My own department-at-my-location channel, plus every DM I'm part of —
    each with a last-message preview and my own unread count."""
    tenant_id = ctx["tenant_id"]
    conversations = []
    preferences = {
        row["conversation_key"]: row
        async for row in internal_chat_preferences_collection.find(
            {"tenant_id": tenant_id, "admin_id": ctx["admin_id"]}
        )
    }

    # HQ sees all active tenant departments; a multi-department admin sees
    # every room assigned to them. Store/branch staff stay in their location.
    my_store_id = _own_store_id(ctx)
    for department in await _visible_departments(ctx):
        if not department:
            continue
        key = _department_key(department, my_store_id)
        last = await internal_chat_messages_collection.find_one(
            {"tenant_id": tenant_id, "conversation_key": key}, sort=[("created_at", -1)]
        )
        hidden = _hidden_for_me(preferences.get(key), last)
        if hidden and not include_hidden:
            continue
        settings = await internal_chat_channel_settings_collection.find_one(
            {"tenant_id": tenant_id, "conversation_key": key}, {"archived": 1}
        )
        conversations.append({
            "conversation_key": key, "type": "department", "department": department,
            "store_id": my_store_id, "label": f"{department}{' · ' + (ctx.get('store_name') or '') if my_store_id else ' (HQ)'}",
            "last_message": "Message removed" if last and last.get("deleted_at") else (last.get("message", "") if last else ""),
            "last_at": last["created_at"].isoformat() if last and isinstance(last.get("created_at"), datetime) else None,
            "unread_count": await _unread_count(tenant_id, ctx["admin_id"], key),
            "muted": bool((preferences.get(key) or {}).get("muted")),
            "hidden": hidden,
            "archived": bool((settings or {}).get("archived")),
            "can_archive": _can_manage_channels(ctx),
        })

    # Every DM conversation I've sent or received a message in.
    dm_keys = await internal_chat_messages_collection.distinct(
        "conversation_key", {"tenant_id": tenant_id, "conversation_key": {"$regex": f"^dm:.*{ctx['admin_id']}.*"}}
    )
    for key in dm_keys:
        parts = key.split(":")
        if len(parts) != 3 or ctx["admin_id"] not in (parts[1], parts[2]):
            continue
        other_id = parts[2] if parts[1] == ctx["admin_id"] else parts[1]
        other = await admins_collection.find_one({"_id": ObjectId(other_id)}, {"name": 1, "email": 1, "department": 1}) if ObjectId.is_valid(other_id) else None
        last = await internal_chat_messages_collection.find_one(
            {"tenant_id": tenant_id, "conversation_key": key}, sort=[("created_at", -1)]
        )
        hidden = _hidden_for_me(preferences.get(key), last)
        if hidden and not include_hidden:
            continue
        conversations.append({
            "conversation_key": key, "type": "dm", "other_admin_id": other_id,
            "label": (other or {}).get("name") or (other or {}).get("email") or "Unknown",
            "department": (other or {}).get("department", ""),
            "last_message": "Message removed" if last and last.get("deleted_at") else (last.get("message", "") if last else ""),
            "last_at": last["created_at"].isoformat() if last and isinstance(last.get("created_at"), datetime) else None,
            "unread_count": await _unread_count(tenant_id, ctx["admin_id"], key),
            "muted": bool((preferences.get(key) or {}).get("muted")),
            "hidden": hidden,
        })

    conversations.sort(key=lambda c: c["last_at"] or "", reverse=True)
    return {"data": conversations}


@router.get("/people")
async def list_people(ctx: TenantCtx = Depends(get_any_tenant)):
    """Who I can start a DM with — every other admin in the tenant."""
    rows = []
    async for a in admins_collection.find(
        {"tenant_id": ctx["tenant_id"], "_id": {"$ne": ObjectId(ctx["admin_id"])}, "department": {"$ne": "SUPERADMIN"}},
        {"name": 1, "email": 1, "department": 1, "managedDepartments": 1, "store_name": 1},
    ):
        departments = list(dict.fromkeys([
            *(a.get("managedDepartments") or []), a.get("department", ""),
        ]))
        rows.append({
            "id": str(a["_id"]), "name": a.get("name") or a.get("email", ""),
            "department": a.get("department", ""), "departments": [d for d in departments if d],
            "store_name": a.get("store_name", ""),
        })
    return {"data": rows}


@router.get("/dm/{other_admin_id}")
async def get_dm(other_admin_id: str, ctx: TenantCtx = Depends(get_any_tenant)):
    if not ObjectId.is_valid(other_admin_id):
        raise HTTPException(status_code=400, detail="Invalid admin ID.")
    other = await admins_collection.find_one({"_id": ObjectId(other_admin_id), "tenant_id": ctx["tenant_id"]})
    if not other:
        raise HTTPException(status_code=404, detail="Admin not found.")
    key = _dm_key(ctx["admin_id"], other_admin_id)
    rows = [{**_serialize(m), "is_sender": m.get("sender_id") == ctx["admin_id"]} async for m in internal_chat_messages_collection.find(
        {"tenant_id": ctx["tenant_id"], "conversation_key": key}
    ).sort("created_at", 1).limit(500)]
    await _mark_read(ctx["tenant_id"], ctx["admin_id"], key, datetime.utcnow())
    return {"data": rows, "other": {"id": str(other["_id"]), "name": other.get("name") or other.get("email", ""), "department": other.get("department", "")}}


@router.post("/dm/{other_admin_id}", status_code=201)
async def post_dm(other_admin_id: str, payload: MessageCreate, ctx: TenantCtx = Depends(get_any_tenant)):
    if not ObjectId.is_valid(other_admin_id):
        raise HTTPException(status_code=400, detail="Invalid admin ID.")
    other = await admins_collection.find_one({"_id": ObjectId(other_admin_id), "tenant_id": ctx["tenant_id"]})
    if not other:
        raise HTTPException(status_code=404, detail="Admin not found.")
    if other_admin_id == ctx["admin_id"]:
        raise HTTPException(status_code=400, detail="You can't message yourself.")
    if not payload.message.strip() and not payload.attachments:
        raise HTTPException(status_code=400, detail="Enter a message or attach a file.")
    key = _dm_key(ctx["admin_id"], other_admin_id)
    now = datetime.utcnow()
    doc = {
        "tenant_id": ctx["tenant_id"], "conversation_type": "dm", "conversation_key": key,
        "sender_id": ctx["admin_id"], "sender_name": ctx.get("admin_name", ""), "sender_department": ctx.get("department", ""),
        "message": payload.message.strip(), "attachments": [a.dict() for a in payload.attachments], "created_at": now,
    }
    result = await internal_chat_messages_collection.insert_one(doc)
    doc["_id"] = result.inserted_id
    await _mark_read(ctx["tenant_id"], ctx["admin_id"], key, now)
    await notify_internal(
        ctx["tenant_id"], type="chat_dm", title=f"{ctx.get('admin_name', 'Someone')} sent you a message",
        message=payload.message.strip()[:140] or "Sent an attachment.", target_admin_id=other_admin_id,
        ref_type="chat_dm", ref_id=key, priority="normal",
    )
    await _notify_mentions(ctx["tenant_id"], payload.mentions, from_name=ctx.get("admin_name", "Someone"),
                            snippet=payload.message.strip(), ref_type="chat_dm", ref_id=key)
    return {"message": "Sent.", "data": _serialize(doc)}


def _assert_department_access(ctx: TenantCtx, department: str, store_id: Optional[str]) -> None:
    if ctx.get("department") not in FULL_ACCESS_DEPARTMENTS and department not in _my_departments(ctx):
        raise HTTPException(status_code=403, detail="You can only use your own department's channel.")
    if ctx.get("scope") in ("store", "branch") and store_id != ctx.get("store_id"):
        raise HTTPException(status_code=403, detail="You can only use your own store's channel.")


@router.get("/department/{department}")
async def get_department_channel(
    department: str, store_id: Optional[str] = Query(None), ctx: TenantCtx = Depends(get_any_tenant),
):
    effective_store_id = _own_store_id(ctx) if ctx.get("scope") in ("store", "branch") else store_id
    _assert_department_access(ctx, department, effective_store_id)
    key = _department_key(department, effective_store_id)
    rows = [{**_serialize(m), "is_sender": m.get("sender_id") == ctx["admin_id"]} async for m in internal_chat_messages_collection.find(
        {"tenant_id": ctx["tenant_id"], "conversation_key": key}
    ).sort("created_at", 1).limit(500)]
    settings = await internal_chat_channel_settings_collection.find_one(
        {"tenant_id": ctx["tenant_id"], "conversation_key": key}, {"archived": 1}
    )
    await _mark_read(ctx["tenant_id"], ctx["admin_id"], key, datetime.utcnow())
    return {"data": rows, "archived": bool((settings or {}).get("archived")), "can_archive": _can_manage_channels(ctx)}


@router.post("/department/{department}", status_code=201)
async def post_department_channel(
    department: str, payload: MessageCreate, store_id: Optional[str] = Query(None), ctx: TenantCtx = Depends(get_any_tenant),
):
    effective_store_id = _own_store_id(ctx) if ctx.get("scope") in ("store", "branch") else store_id
    _assert_department_access(ctx, department, effective_store_id)
    if not payload.message.strip() and not payload.attachments:
        raise HTTPException(status_code=400, detail="Enter a message or attach a file.")
    key = _department_key(department, effective_store_id)
    settings = await internal_chat_channel_settings_collection.find_one(
        {"tenant_id": ctx["tenant_id"], "conversation_key": key}, {"archived": 1}
    )
    if (settings or {}).get("archived"):
        raise HTTPException(status_code=409, detail="This department channel is archived by HQ.")
    now = datetime.utcnow()
    doc = {
        "tenant_id": ctx["tenant_id"], "conversation_type": "department", "conversation_key": key,
        "sender_id": ctx["admin_id"], "sender_name": ctx.get("admin_name", ""), "sender_department": ctx.get("department", ""),
        "message": payload.message.strip(), "attachments": [a.dict() for a in payload.attachments], "created_at": now,
    }
    result = await internal_chat_messages_collection.insert_one(doc)
    doc["_id"] = result.inserted_id
    await _mark_read(ctx["tenant_id"], ctx["admin_id"], key, now)
    await notify_internal(
        ctx["tenant_id"], type="chat_department", title=f"New message in {department}",
        message=payload.message.strip()[:140] or "Sent an attachment.", department=department,
        ref_type="chat_department", ref_id=key, priority="normal", exclude_admin_id=ctx["admin_id"],
    )
    await _notify_mentions(ctx["tenant_id"], payload.mentions, from_name=ctx.get("admin_name", "Someone"),
                            snippet=payload.message.strip(), ref_type="chat_department", ref_id=key)
    return {"message": "Sent.", "data": _serialize(doc)}


@router.patch("/department/{department}/archive")
async def archive_department_channel(
    department: str, payload: ChannelArchiveUpdate, store_id: Optional[str] = Query(None), ctx: TenantCtx = Depends(get_any_tenant),
):
    if not _can_manage_channels(ctx):
        raise HTTPException(status_code=403, detail="Only HQ can archive a department channel.")
    effective_store_id = _own_store_id(ctx) if ctx.get("scope") in ("store", "branch") else store_id
    _assert_department_access(ctx, department, effective_store_id)
    key = _department_key(department, effective_store_id)
    await internal_chat_channel_settings_collection.update_one(
        {"tenant_id": ctx["tenant_id"], "conversation_key": key},
        {"$set": {
            "archived": payload.archived, "archived_at": datetime.utcnow() if payload.archived else None,
            "archived_by": ctx["admin_id"] if payload.archived else None,
        }},
        upsert=True,
    )
    return {"message": "Department channel archived." if payload.archived else "Department channel reopened.", "archived": payload.archived}


@router.delete("/messages/{message_id}")
async def unsend_message(message_id: str, ctx: TenantCtx = Depends(get_any_tenant)):
    if not ObjectId.is_valid(message_id):
        raise HTTPException(status_code=400, detail="Invalid message ID.")
    doc = await internal_chat_messages_collection.find_one({
        "_id": ObjectId(message_id), "tenant_id": ctx["tenant_id"], "sender_id": ctx["admin_id"],
    })
    if not doc:
        raise HTTPException(status_code=404, detail="Message not found.")
    if doc.get("deleted_at"):
        raise HTTPException(status_code=409, detail="Message was already removed.")
    if not isinstance(doc.get("created_at"), datetime) or doc["created_at"] < datetime.utcnow() - timedelta(minutes=5):
        raise HTTPException(status_code=409, detail="A message can only be removed within five minutes.")
    await internal_chat_messages_collection.update_one(
        {"_id": doc["_id"]},
        {"$set": {"deleted_at": datetime.utcnow(), "deleted_by": ctx["admin_id"], "message": "", "attachments": []}},
    )
    return {"message": "Message removed. A visible audit placeholder remains."}
