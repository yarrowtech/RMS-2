"""
Support ticketing — three surfaces sharing one collection (support_tickets):
  - /api/support/vendor      vendor portal:   create/view/reply to own tickets
  - /api/support/retailer    retailer portal: create/view/reply to tenant tickets
  - /api/support/superadmin  RMS ops inbox:   view all tickets, reply, set status/priority

Reconstructed from the three already-built frontend pages (VendorHelpSupport.jsx,
RetailerHelpSupport.jsx, SuperAdminSupportInbox.jsx) after the original route file
was found empty/never committed — the request/response shapes here are dictated by
what those pages already call.
"""
from datetime import datetime
from typing import Any, Dict, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field

from ..config import settings
from ..db import support_tickets_collection
from ..email_utils import send_support_ticket_created_email, send_support_ticket_reply_email
from .deps import get_tenant
from .vendor_routes import require_vendor_identity

router = APIRouter(prefix="/api/support", tags=["Support"])

STATUS_VALUES = {
    "open", "in_progress", "waiting_on_vendor", "waiting_on_rms",
    "waiting_on_requester", "resolved", "closed",
}
PRIORITY_VALUES = {"low", "normal", "high"}
CLOSED_STATUSES = {"resolved", "closed"}


# ── request bodies ─────────────────────────────────────────────────────────

class TicketCreateRequest(BaseModel):
    category: str = Field(..., max_length=60)
    subject: str = Field(..., min_length=3, max_length=160)
    description: str = Field(..., min_length=10, max_length=5000)
    attachment_url: Optional[str] = Field(None, max_length=2000)


class TicketReplyRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)


class TicketUpdateRequest(BaseModel):
    status: str
    priority: str
    reply: Optional[str] = Field(None, max_length=5000)


# ── serialization ──────────────────────────────────────────────────────────

def _iso(value: Any) -> Any:
    return value.isoformat() if isinstance(value, datetime) else value


def _serialize_message(msg: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "sender_type": msg.get("sender_type"),
        "sender_name": msg.get("sender_name", ""),
        "message": msg.get("message", ""),
        "created_at": _iso(msg.get("created_at")),
    }


def _serialize_ticket(doc: Dict[str, Any], can_reply: bool) -> Dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "actor_type": doc.get("actor_type"),
        "category": doc.get("category"),
        "subject": doc.get("subject"),
        "description": doc.get("description"),
        "attachment_url": doc.get("attachment_url"),
        "status": doc.get("status", "open"),
        "priority": doc.get("priority", "normal"),
        "vendor_id": str(doc["vendor_id"]) if doc.get("vendor_id") else None,
        "vendor_name": doc.get("vendor_name", ""),
        "vendor_email": doc.get("vendor_email", ""),
        "tenant_id": doc.get("tenant_id"),
        "admin_id": doc.get("admin_id"),
        "requester_name": doc.get("requester_name", ""),
        "requester_email": doc.get("requester_email", ""),
        "department": doc.get("department"),
        "store_id": doc.get("store_id"),
        "store_name": doc.get("store_name"),
        "scope": doc.get("scope"),
        "escalated": bool(doc.get("escalated", False)),
        "escalated_at": _iso(doc.get("escalated_at")),
        "escalated_by": doc.get("escalated_by"),
        "messages": [_serialize_message(m) for m in doc.get("messages", [])],
        "created_at": _iso(doc.get("created_at")),
        "updated_at": _iso(doc.get("updated_at")),
        "can_reply": can_reply,
    }


def _ticket_object_id(ticket_id: str) -> ObjectId:
    if not ObjectId.is_valid(ticket_id):
        raise HTTPException(status_code=400, detail="Invalid ticket ID")
    return ObjectId(ticket_id)


# ═════════════════════════════════════════════════════════════════════════
# VENDOR
# ═════════════════════════════════════════════════════════════════════════

@router.get("/vendor/tickets")
async def vendor_list_tickets(vendor: dict = Depends(require_vendor_identity)):
    cursor = support_tickets_collection.find(
        {"actor_type": "vendor", "vendor_id": vendor["_id"]}
    ).sort("updated_at", -1)
    rows = [_serialize_ticket(doc, can_reply=doc.get("status") not in CLOSED_STATUSES) async for doc in cursor]
    return {"data": rows}


@router.post("/vendor/tickets")
async def vendor_create_ticket(payload: TicketCreateRequest, vendor: dict = Depends(require_vendor_identity)):
    now = datetime.utcnow()
    doc = {
        "actor_type": "vendor",
        "vendor_id": vendor["_id"],
        "vendor_name": vendor.get("name") or vendor.get("vendor_name") or "",
        "vendor_email": vendor.get("email", ""),
        "category": payload.category,
        "subject": payload.subject.strip(),
        "description": payload.description.strip(),
        "attachment_url": (payload.attachment_url or "").strip() or None,
        "status": "open",
        "priority": "normal",
        "messages": [],
        "created_at": now,
        "updated_at": now,
    }
    result = await support_tickets_collection.insert_one(doc)
    doc["_id"] = result.inserted_id
    await send_support_ticket_created_email(
        settings.superadmin_email, f"{doc['vendor_name']} (Vendor)", doc["category"], doc["subject"], doc["description"],
    )
    return {"data": _serialize_ticket(doc, can_reply=True)}


@router.post("/vendor/tickets/{ticket_id}/reply")
async def vendor_reply_ticket(ticket_id: str, payload: TicketReplyRequest, vendor: dict = Depends(require_vendor_identity)):
    oid = _ticket_object_id(ticket_id)
    doc = await support_tickets_collection.find_one({"_id": oid, "actor_type": "vendor", "vendor_id": vendor["_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Support ticket not found")
    if doc.get("status") in CLOSED_STATUSES:
        raise HTTPException(status_code=400, detail="This ticket is closed. Create a new ticket if you need further help.")

    now = datetime.utcnow()
    message = {
        "sender_type": "vendor",
        "sender_name": vendor.get("name") or vendor.get("vendor_name") or "",
        "message": payload.message.strip(),
        "created_at": now,
    }
    await support_tickets_collection.update_one(
        {"_id": oid},
        {"$push": {"messages": message}, "$set": {"status": "waiting_on_rms", "updated_at": now}},
    )
    doc = await support_tickets_collection.find_one({"_id": oid})
    return {"data": _serialize_ticket(doc, can_reply=True)}


# ═════════════════════════════════════════════════════════════════════════
# RETAILER
#
# Visibility is two-tiered, matching the store hierarchy that already
# exists elsewhere in this codebase (get_tenant's scope/store_id — there is
# no separate monolithic "Store Admin" role here, just department-scoped
# admins at either "hq" or "store" scope):
#   - HQ scope:    sees every ticket for the tenant (any department, any
#                  store) — "Retailer HQ Admin" / "Department Admin" tier.
#   - Store scope: sees their own tickets PLUS every ticket raised by
#                  anyone else at their own store_id — this is what makes a
#                  Cashier's ticket visible to their Store's other admins,
#                  not just to HQ.
#
# Escalation to Super Admin is separate from visibility above:
#   - A ticket raised by an HQ-scope admin is auto-escalated at creation —
#     HQ tickets reach Super Admin immediately (no gate).
#   - A ticket raised at store scope starts NOT escalated — only visible to
#     HQ/store peers until an HQ admin explicitly escalates it, then (and
#     only then) it also appears in the Super Admin inbox.
# ═════════════════════════════════════════════════════════════════════════

def _retailer_can_manage(ctx: Dict[str, Any]) -> bool:
    """Tenant-wide manage rights — HQ scope only."""
    return ctx.get("scope") == "hq"


def _retailer_visibility_query(ctx: Dict[str, Any]) -> Dict[str, Any]:
    query: Dict[str, Any] = {"actor_type": "retailer", "tenant_id": ctx["tenant_id"]}
    if _retailer_can_manage(ctx):
        return query
    store_id = ctx.get("store_id")
    if store_id:
        query["$or"] = [{"admin_id": ctx["admin_id"]}, {"store_id": store_id}]
    else:
        query["admin_id"] = ctx["admin_id"]
    return query


def _retailer_can_touch(ctx: Dict[str, Any], doc: Dict[str, Any]) -> bool:
    """Can view/reply to this specific ticket: self, HQ, or a same-store peer."""
    if doc.get("admin_id") == ctx.get("admin_id"):
        return True
    if _retailer_can_manage(ctx):
        return True
    return bool(ctx.get("store_id")) and doc.get("store_id") == ctx.get("store_id")


@router.get("/retailer/tickets")
async def retailer_list_tickets(ctx: dict = Depends(get_tenant)):
    can_manage = _retailer_can_manage(ctx)
    cursor = support_tickets_collection.find(_retailer_visibility_query(ctx)).sort("updated_at", -1)
    rows = []
    async for doc in cursor:
        can_reply = doc.get("status") not in CLOSED_STATUSES and _retailer_can_touch(ctx, doc)
        rows.append(_serialize_ticket(doc, can_reply=can_reply))

    return {
        "data": rows,
        "workspace": {
            "department": ctx.get("department"),
            "store_name": ctx.get("store_name"),
            "scope": ctx.get("scope"),
        },
        "can_manage_tenant_tickets": can_manage,
    }


@router.post("/retailer/tickets")
async def retailer_create_ticket(payload: TicketCreateRequest, ctx: dict = Depends(get_tenant)):
    now = datetime.utcnow()
    hq_origin = ctx.get("scope") == "hq"
    doc = {
        "actor_type": "retailer",
        "tenant_id": ctx["tenant_id"],
        "admin_id": ctx["admin_id"],
        "requester_name": ctx.get("admin_name", ""),
        "requester_email": ctx.get("admin_email", ""),
        "department": ctx.get("department"),
        "store_id": ctx.get("store_id"),
        "store_name": ctx.get("store_name"),
        "scope": ctx.get("scope"),
        "category": payload.category,
        "subject": payload.subject.strip(),
        "description": payload.description.strip(),
        "attachment_url": (payload.attachment_url or "").strip() or None,
        "status": "open",
        "priority": "normal",
        "messages": [],
        # HQ-raised tickets reach Super Admin immediately; store-raised
        # tickets stay HQ-only until an HQ admin explicitly escalates.
        "escalated": hq_origin,
        "escalated_at": now if hq_origin else None,
        "escalated_by": ctx.get("admin_name", "") if hq_origin else None,
        "created_at": now,
        "updated_at": now,
    }
    result = await support_tickets_collection.insert_one(doc)
    doc["_id"] = result.inserted_id
    requester_label = f"{doc['requester_name']} — {doc['tenant_id']}" + (f" ({doc['department']})" if doc.get("department") else "")
    await send_support_ticket_created_email(
        settings.superadmin_email, requester_label, doc["category"], doc["subject"], doc["description"],
    )
    return {"data": _serialize_ticket(doc, can_reply=True)}


@router.post("/retailer/tickets/{ticket_id}/reply")
async def retailer_reply_ticket(ticket_id: str, payload: TicketReplyRequest, ctx: dict = Depends(get_tenant)):
    oid = _ticket_object_id(ticket_id)
    doc = await support_tickets_collection.find_one({"_id": oid, "actor_type": "retailer", "tenant_id": ctx["tenant_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Support ticket not found")

    if not _retailer_can_touch(ctx, doc):
        raise HTTPException(status_code=403, detail="You do not have access to this support ticket.")
    if doc.get("status") in CLOSED_STATUSES:
        raise HTTPException(status_code=400, detail="This ticket is closed. Create a new one if you need further help.")

    now = datetime.utcnow()
    message = {
        "sender_type": "retailer",
        "sender_name": ctx.get("admin_name", ""),
        "message": payload.message.strip(),
        "created_at": now,
    }
    await support_tickets_collection.update_one(
        {"_id": oid},
        {"$push": {"messages": message}, "$set": {"status": "waiting_on_rms", "updated_at": now}},
    )
    doc = await support_tickets_collection.find_one({"_id": oid})

    # Notify the original requester when someone ELSE (HQ, or a same-store
    # peer) replies — not when they're replying to their own ticket.
    if doc.get("admin_id") != ctx["admin_id"] and doc.get("requester_email"):
        replier_label = ctx.get("admin_name", "") + (f" ({ctx['department']})" if ctx.get("department") else "")
        await send_support_ticket_reply_email(
            doc["requester_email"], doc.get("requester_name", ""), doc["subject"], replier_label, message["message"],
        )

    return {"data": _serialize_ticket(doc, can_reply=_retailer_can_touch(ctx, doc))}


@router.post("/retailer/tickets/{ticket_id}/escalate")
async def retailer_escalate_ticket(ticket_id: str, ctx: dict = Depends(get_tenant)):
    """HQ-only: hand a store-raised ticket up to the Super Admin inbox."""
    if not _retailer_can_manage(ctx):
        raise HTTPException(status_code=403, detail="Only an HQ Admin can escalate a ticket to Super Admin.")

    oid = _ticket_object_id(ticket_id)
    doc = await support_tickets_collection.find_one({"_id": oid, "actor_type": "retailer", "tenant_id": ctx["tenant_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Support ticket not found")
    if doc.get("escalated"):
        raise HTTPException(status_code=400, detail="This ticket is already visible to Super Admin.")

    now = datetime.utcnow()
    await support_tickets_collection.update_one(
        {"_id": oid},
        {"$set": {"escalated": True, "escalated_at": now, "escalated_by": ctx.get("admin_name", ""), "updated_at": now}},
    )
    doc = await support_tickets_collection.find_one({"_id": oid})
    return {"data": _serialize_ticket(doc, can_reply=_retailer_can_touch(ctx, doc))}


# ═════════════════════════════════════════════════════════════════════════
# SUPERADMIN
# ═════════════════════════════════════════════════════════════════════════

async def _require_superadmin(authorization: str = Header(None)) -> dict:
    # Local import avoids a circular import: auth_routes.py doesn't import
    # this module, but importing it at module load time would still make
    # main.py's router-registration order matter more than it should.
    from .auth_routes import get_current_superadmin
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization token missing")
    return await get_current_superadmin(authorization.split(" ", 1)[1])


@router.get("/superadmin/tickets")
async def superadmin_list_tickets(
    status_filter: Optional[str] = Query(None),
    admin: dict = Depends(_require_superadmin),
):
    # Vendor tickets are always visible to Super Admin (that surface has no
    # escalation tier). Retailer tickets only show up here once escalated
    # (auto-true for HQ-raised tickets, or set explicitly by HQ via
    # /retailer/tickets/{id}/escalate for store-raised ones) — Store/Cashier
    # tickets stay HQ-only until then.
    query: Dict[str, Any] = {"$or": [{"actor_type": "vendor"}, {"actor_type": "retailer", "escalated": True}]}
    if status_filter and status_filter != "all":
        query["status"] = status_filter

    cursor = support_tickets_collection.find(query).sort("updated_at", -1).limit(500)
    rows = [_serialize_ticket(doc, can_reply=doc.get("status") not in CLOSED_STATUSES) async for doc in cursor]
    return {"data": rows}


@router.patch("/superadmin/tickets/{ticket_id}")
async def superadmin_update_ticket(ticket_id: str, payload: TicketUpdateRequest, admin: dict = Depends(_require_superadmin)):
    if payload.status not in STATUS_VALUES:
        raise HTTPException(status_code=400, detail=f"Invalid status '{payload.status}'")
    if payload.priority not in PRIORITY_VALUES:
        raise HTTPException(status_code=400, detail=f"Invalid priority '{payload.priority}'")

    oid = _ticket_object_id(ticket_id)
    doc = await support_tickets_collection.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Support ticket not found")

    now = datetime.utcnow()
    update: Dict[str, Any] = {"status": payload.status, "priority": payload.priority, "updated_at": now}
    push: Dict[str, Any] = {}
    reply_text = (payload.reply or "").strip()
    if reply_text:
        push["messages"] = {
            "sender_type": "rms_support",
            "sender_name": admin.get("name") or admin.get("full_name") or "RMS Support",
            "message": reply_text,
            "created_at": now,
        }

    mongo_update: Dict[str, Any] = {"$set": update}
    if push:
        mongo_update["$push"] = push
    await support_tickets_collection.update_one({"_id": oid}, mongo_update)

    doc = await support_tickets_collection.find_one({"_id": oid})

    if reply_text:
        if doc.get("actor_type") == "vendor":
            recipient, name = doc.get("vendor_email"), doc.get("vendor_name", "")
        else:
            recipient, name = doc.get("requester_email"), doc.get("requester_name", "")
        if recipient:
            await send_support_ticket_reply_email(recipient, name, doc["subject"], "RMS Support", reply_text)

    return {"data": _serialize_ticket(doc, can_reply=doc.get("status") not in CLOSED_STATUSES)}
