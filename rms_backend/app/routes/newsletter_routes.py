"""Customer CRM newsletter — HQ sends announcements (offers, coupons, new
lucky draws) by email to customers who ticked "yes" to updates.

Audience = this tenant's customer profiles with consent_email on and an
email on file (that's exactly what the Lucky Draw opt-in tick writes).
Every email carries a per-person unsubscribe link (signed with SECRET_KEY,
so it can't be guessed) that switches consent_email off again. Email only —
WhatsApp/SMS need a paid sender and are deliberately not attempted here.
"""
import asyncio
import hashlib
import hmac
from datetime import datetime, timezone
from typing import Any, Dict

from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel

from ..config import frontend_url, settings
from ..db import customer_crm_profiles_collection, newsletter_sends_collection
from ..email_utils import send_newsletter_email
from .customer_crm_routes import clean, require_crm_tab
from .deps import get_tenant

router = APIRouter(prefix="/api/customer-crm/newsletter", tags=["Customer CRM Newsletter"])


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def require_hq(ctx: Dict[str, Any]) -> Dict[str, Any]:
    if ctx.get("scope") != "hq":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only HQ Admin can send newsletters.")
    return ctx


def _sign(profile_id: str) -> str:
    return hmac.new(settings.secret_key.encode(), profile_id.encode(), hashlib.sha256).hexdigest()[:24]


def _unsubscribe_url(profile_id: str) -> str:
    return frontend_url(f"/newsletter-unsubscribe/{profile_id}.{_sign(profile_id)}")


def _audience_query(tenant_id: str, store_id: str = "") -> dict:
    query: Dict[str, Any] = {"tenant_id": tenant_id, "consent_email": True, "email": {"$nin": ["", None]}}
    if store_id:
        query["store_id"] = store_id
    return query


async def _audience(tenant_id: str, store_id: str = "") -> list:
    """De-duplicated by email (case-insensitive) so nobody gets it twice."""
    seen, out = set(), []
    async for p in customer_crm_profiles_collection.find(_audience_query(tenant_id, store_id)).sort("created_at", -1):
        key = (p.get("email") or "").strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(p)
    return out


class NewsletterPayload(BaseModel):
    subject: str
    message: str
    image_url: str = ""
    link: str = ""
    link_label: str = ""
    store_id: str = ""
    test_email: str = ""


@router.get("/audience")
async def newsletter_audience(store_id: str = "", ctx: Dict[str, Any] = Depends(get_tenant)):
    ctx = require_hq(require_crm_tab(ctx, "coupons"))
    people = await _audience(ctx["tenant_id"], clean(store_id))
    return {
        "total": len(people),
        "subscribers": [
            {"id": str(p["_id"]), "name": p.get("name") or "", "email": p.get("email") or "", "mobile": p.get("mobile") or ""}
            for p in people[:300]
        ],
    }


async def _run_send(send_id: ObjectId, tenant_id: str, data: dict) -> None:
    sent = failed = 0
    people = await _audience(tenant_id, data.get("store_id") or "")
    for p in people:
        try:
            ok = await send_newsletter_email(
                p["email"], p.get("name") or "", data["subject"], data["message"],
                _unsubscribe_url(str(p["_id"])),
                image_url=data.get("image_url") or "", link=data.get("link") or "", link_label=data.get("link_label") or "",
            )
        except Exception:
            ok = False
        sent += 1 if ok else 0
        failed += 0 if ok else 1
        await newsletter_sends_collection.update_one({"_id": send_id}, {"$set": {"sent_count": sent, "failed_count": failed}})
        await asyncio.sleep(0.05)
    await newsletter_sends_collection.update_one(
        {"_id": send_id}, {"$set": {"status": "DONE", "sent_count": sent, "failed_count": failed, "finished_at": now_utc()}}
    )


@router.post("/send")
async def send_newsletter(payload: NewsletterPayload, background: BackgroundTasks, ctx: Dict[str, Any] = Depends(get_tenant)):
    ctx = require_hq(require_crm_tab(ctx, "coupons"))
    subject, message = clean(payload.subject), (payload.message or "").strip()
    if not subject or not message:
        raise HTTPException(status_code=400, detail="Enter a subject and a message.")
    data = {
        "subject": subject, "message": message, "image_url": clean(payload.image_url),
        "link": clean(payload.link), "link_label": clean(payload.link_label), "store_id": clean(payload.store_id),
    }

    test_email = clean(payload.test_email)
    if test_email:
        ok = await send_newsletter_email(
            test_email, "there", "[Test] " + subject, message, frontend_url("/"),
            data["image_url"], data["link"], data["link_label"],
        )
        if not ok:
            raise HTTPException(status_code=502, detail="Test email could not be sent — check the email settings.")
        return {"test": True, "message": f"Test email sent to {test_email}."}

    people = await _audience(ctx["tenant_id"], data["store_id"])
    if not people:
        raise HTTPException(status_code=400, detail="There are no subscribers with an email to send to yet.")
    doc = {
        "tenant_id": ctx["tenant_id"], **data, "recipient_count": len(people), "sent_count": 0, "failed_count": 0,
        "status": "SENDING", "sent_by_name": ctx.get("name") or ctx.get("email") or "", "created_at": now_utc(),
    }
    result = await newsletter_sends_collection.insert_one(doc)
    background.add_task(_run_send, result.inserted_id, ctx["tenant_id"], data)
    return {"test": False, "id": str(result.inserted_id), "recipient_count": len(people), "message": f"Sending to {len(people)} subscriber(s)."}


@router.get("/history")
async def newsletter_history(ctx: Dict[str, Any] = Depends(get_tenant)):
    ctx = require_hq(require_crm_tab(ctx, "coupons"))
    rows = []
    async for d in newsletter_sends_collection.find({"tenant_id": ctx["tenant_id"]}).sort("created_at", -1).limit(50):
        rows.append({
            "id": str(d["_id"]), "subject": d.get("subject"), "status": d.get("status"),
            "recipient_count": d.get("recipient_count", 0), "sent_count": d.get("sent_count", 0), "failed_count": d.get("failed_count", 0),
            "created_at": d["created_at"].isoformat() if isinstance(d.get("created_at"), datetime) else "",
        })
    return rows


@router.post("/public/unsubscribe/{token}")
async def public_unsubscribe(token: str):
    """No login — the signed token in the emailed link is the proof."""
    profile_id, _, sig = token.partition(".")
    if not ObjectId.is_valid(profile_id) or not hmac.compare_digest(sig, _sign(profile_id)):
        raise HTTPException(status_code=404, detail="This unsubscribe link isn't valid.")
    await customer_crm_profiles_collection.update_one(
        {"_id": ObjectId(profile_id)},
        {"$set": {"consent_email": False, "newsletter_unsubscribed_at": now_utc()}},
    )
    return {"message": "You've been unsubscribed. You won't receive these emails any more."}
