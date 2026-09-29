"""
internal_document_comment_routes.py
====================================
RMS Communication Centre — Phase 2, Step 9: document-linked approval
comments. A comment thread attached to one specific business record (a
Tech Pack, a wastage/design-change exception, a purchase invoice), not an
open-ended chat. Posting a comment also raises one internal notification
(via internal_notification_routes.notify) to the department(s) that own
that kind of document, so this plugs into the same bell/inbox everything
else in the Communication Centre uses.

Additive only: new collection, new router, and a `ref_type` allow-list that
can grow later without touching anything else.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Any, Dict, List
from datetime import datetime
from bson import ObjectId

from .deps import get_any_tenant
from .internal_notification_routes import notify as notify_internal
from ..db import (
    internal_document_comments_collection, tech_packs_collection,
    design_change_requests_collection, purchase_invoice_collection,
    purchaseorders_collection, grn_collection, stock_transfers_collection,
    production_batches_collection,
)

router = APIRouter(prefix="/api/document-comments", tags=["Document Comments"])

TenantCtx = Dict[str, Any]

# Which collection backs each ref_type (to confirm the document exists and
# belongs to this tenant before allowing a comment on it), and which
# department(s) get notified when a comment is posted. Add a new document
# kind here later by adding one line — nothing else needs to change.
DOC_TYPES: Dict[str, dict] = {
    "tech_pack": {"collection": tech_packs_collection, "notify": ["Design & Pattern", "Production & Job Work"]},
    "wastage_exception": {"collection": design_change_requests_collection, "notify": ["HQ", "Design & Pattern"]},
    "purchase_invoice": {"collection": purchase_invoice_collection, "notify": ["Finance", "Merchandiser Buyer"]},
    "purchase_order": {"collection": purchaseorders_collection, "notify": ["Merchandiser Buyer", "Inventory"]},
    "grn": {"collection": grn_collection, "notify": ["Inventory", "Merchandiser Buyer"]},
    "stock_transfer": {"collection": stock_transfers_collection, "notify": ["Inventory", "Logistics"]},
    "production_batch": {"collection": production_batches_collection, "notify": ["Production & Job Work", "Design & Pattern"]},
}


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "ref_type": doc.get("ref_type", ""),
        "ref_id": doc.get("ref_id", ""),
        "author_id": doc.get("author_id", ""),
        "author_name": doc.get("author_name", ""),
        "author_department": doc.get("author_department", ""),
        "message": doc.get("message", ""),
        "attachments": doc.get("attachments") or [],
        "created_at": doc.get("created_at").isoformat() if isinstance(doc.get("created_at"), datetime) else None,
    }


async def _assert_document_exists(ref_type: str, ref_id: str, tenant_id: str) -> dict:
    if ref_type not in DOC_TYPES:
        raise HTTPException(status_code=400, detail=f"Unknown document type. Must be one of: {sorted(DOC_TYPES)}")
    if not ObjectId.is_valid(ref_id):
        raise HTTPException(status_code=400, detail="Invalid document ID.")
    spec = DOC_TYPES[ref_type]
    doc = await spec["collection"].find_one({"_id": ObjectId(ref_id), "tenant_id": tenant_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    return spec


class Mention(BaseModel):
    type: str  # "admin" | "department"
    value: str  # admin_id, or department name


class Attachment(BaseModel):
    name: str = ""
    url: str
    resource_type: str = ""
    format: str = ""
    bytes: int = 0


class CommentCreate(BaseModel):
    message: str = Field(default="", max_length=2000)
    mentions: List[Mention] = Field(default_factory=list)
    attachments: List[Attachment] = Field(default_factory=list)


@router.get("/{ref_type}/{ref_id}")
async def list_comments(ref_type: str, ref_id: str, ctx: TenantCtx = Depends(get_any_tenant)):
    await _assert_document_exists(ref_type, ref_id, ctx["tenant_id"])
    rows = []
    async for doc in internal_document_comments_collection.find(
        {"tenant_id": ctx["tenant_id"], "ref_type": ref_type, "ref_id": ref_id}
    ).sort("created_at", 1):
        rows.append(_serialize(doc))
    return {"data": rows}


@router.post("/{ref_type}/{ref_id}", status_code=201)
async def add_comment(ref_type: str, ref_id: str, payload: CommentCreate, ctx: TenantCtx = Depends(get_any_tenant)):
    spec = await _assert_document_exists(ref_type, ref_id, ctx["tenant_id"])
    if not payload.message.strip() and not payload.attachments:
        raise HTTPException(status_code=400, detail="Enter a comment or attach a file.")
    now = datetime.utcnow()
    doc = {
        "tenant_id": ctx["tenant_id"], "ref_type": ref_type, "ref_id": ref_id,
        "author_id": ctx["admin_id"], "author_name": ctx.get("admin_name", ""),
        "author_department": ctx.get("department", ""),
        "message": payload.message.strip(), "attachments": [a.dict() for a in payload.attachments], "created_at": now,
    }
    result = await internal_document_comments_collection.insert_one(doc)
    doc["_id"] = result.inserted_id

    label = ref_type.replace("_", " ")
    for department in spec["notify"]:
        await notify_internal(
            ctx["tenant_id"], type="document_comment",
            title=f"New comment on a {label}",
            message=f"{ctx.get('admin_name', 'Someone')}: {payload.message.strip()[:140]}",
            department=department, ref_type=ref_type, ref_id=ref_id, priority="normal",
        )

    for m in payload.mentions[:10]:  # picked from an autocomplete list, not parsed from free text
        title = f"{ctx.get('admin_name', 'Someone')} mentioned you"
        if m.type == "admin" and ObjectId.is_valid(m.value):
            await notify_internal(ctx["tenant_id"], type="mention", title=title, message=payload.message.strip()[:140],
                                   target_admin_id=m.value, ref_type=ref_type, ref_id=ref_id, priority="high")
        elif m.type == "department" and m.value:
            await notify_internal(ctx["tenant_id"], type="mention", title=f"{ctx.get('admin_name', 'Someone')} mentioned {m.value}",
                                   message=payload.message.strip()[:140], department=m.value,
                                   ref_type=ref_type, ref_id=ref_id, priority="high")

    return {"message": "Comment added.", "comment": _serialize(doc)}
