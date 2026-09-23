"""Customer CRM coupons — its own tab, gated the same way Lucky Draw's tab
is (see customer_crm_routes.CRM_TAB_PERMISSIONS / admin_crm_tabs).

Scope decided with the user up front, so this stays intentionally small:
  - Percentage-off only (no flat-amount coupons yet).
  - Redemption is manual — there is no real "apply a coupon" step in
    Cashier/POS today, so staff look a code up here (same phone-lookup
    pattern already built for Lucky Draw), see it's valid, type the
    discount into the bill by hand, then mark it redeemed here. No POS
    integration is attempted; that would be a separate, bigger project.
  - HQ Admin only creates/disables coupons. Any CRM-permitted staff (store
    or HQ) can look one up and mark it redeemed, tenant-wide — a coupon
    isn't locked to the store that issued it, since the customer may well
    redeem it at a different branch.
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import cloudinary
import cloudinary.uploader
from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel

from ..config import settings
from ..db import coupons_collection, lucky_draw_campaigns_collection
from ..email_utils import send_coupon_email, send_coupon_redeemed_email
from .customer_crm_routes import clean, require_crm_tab
from .deps import get_tenant

cloudinary.config(cloud_name=settings.cloudinary_cloud_name, api_key=settings.cloudinary_api_key, api_secret=settings.cloudinary_api_secret, secure=True)

router = APIRouter(prefix="/api/customer-crm/coupons", tags=["Customer CRM Coupons"])


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def serialize(doc: Optional[dict]) -> Optional[dict]:
    if not doc:
        return None
    out = {}
    for key, value in doc.items():
        if key == "_id":
            out["id"] = str(value)
        elif isinstance(value, datetime):
            out[key] = value.isoformat()
        else:
            out[key] = value
    return out


class CouponPayload(BaseModel):
    discount_pct: float
    min_bill_amount: float = 0
    expiry_date: str = ""
    customer_name: str = ""
    contact_no: str = ""
    email: str = ""
    notes: str = ""
    # Optional — HQ's own site, a booking page, an offer page, anything they
    # want the customer to click through to from the coupon itself (shown as
    # a button on the public coupon page and included in coupon emails).
    website_link: str = ""
    # Optional — ties a manually-issued coupon to a Lucky Draw campaign for
    # reporting ("how many coupons came from the Puja campaign"). Purely
    # informational: it changes nothing about how the coupon is redeemed,
    # emailed, or edited.
    campaign_id: str = ""


def require_hq(ctx: Dict[str, Any]) -> Dict[str, Any]:
    if ctx.get("scope") != "hq":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only HQ Admin can manage coupons.")
    return ctx


def _generate_code() -> str:
    return "SAVE-" + uuid.uuid4().hex[:6].upper()


async def _resolve_campaign_name(tenant_id: str, campaign_id: str) -> str:
    """Validates a manually-picked campaign_id belongs to this tenant and
    returns its name to denormalize onto the coupon (so listing coupons
    never needs a join back to Lucky Draw). Empty campaign_id is valid —
    it just means "not linked to a campaign"."""
    campaign_id = clean(campaign_id)
    if not campaign_id:
        return ""
    if not ObjectId.is_valid(campaign_id):
        raise HTTPException(status_code=400, detail="Invalid campaign ID.")
    campaign = await lucky_draw_campaigns_collection.find_one({"_id": ObjectId(campaign_id), "tenant_id": tenant_id})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    return campaign.get("campaign_name") or ""


@router.get("")
async def list_coupons(ctx: Dict[str, Any] = Depends(get_tenant)):
    ctx = require_crm_tab(ctx, "coupons")
    rows = await coupons_collection.find({"tenant_id": ctx["tenant_id"]}).sort("created_at", -1).to_list(500)
    return [serialize(r) for r in rows]


async def issue_coupon(
    tenant_id: str, discount_pct: float, min_bill_amount: float = 0, expiry_date: str = "",
    customer_name: str = "", contact_no: str = "", email: str = "", notes: str = "",
    created_by: Optional[str] = None, created_by_name: str = "", coupon_image_url: str = "",
    website_link: str = "", campaign_id: str = "", campaign_name: str = "",
) -> dict:
    """Shared by HQ's manual "New coupon" and the Lucky Draw auto-issued
    thank-you coupon — one place that actually writes a coupon document.
    email/coupon_image_url are what let the public "Redeem now" button on
    the Lucky Draw Thank You page later email this exact coupon back to the
    customer (see public_email_coupon below). campaign_id/campaign_name are
    purely for reporting — the caller is trusted to resolve/validate them
    (the Lucky Draw auto-issue path already has the campaign in hand;
    create_coupon below validates and resolves it for a manual coupon)."""
    now = now_utc()
    for _ in range(5):
        code = _generate_code()
        if not await coupons_collection.find_one({"tenant_id": tenant_id, "code": code}, {"_id": 1}):
            break
    else:
        raise HTTPException(status_code=500, detail="Could not generate a unique coupon code, try again.")
    doc = {
        "tenant_id": tenant_id,
        "code": code,
        "discount_pct": round(float(discount_pct), 2),
        "min_bill_amount": max(0.0, float(min_bill_amount or 0)),
        "expiry_date": clean(expiry_date),
        "customer_name": clean(customer_name),
        "contact_no": clean(contact_no),
        "email": clean(email),
        "coupon_image_url": clean(coupon_image_url),
        "website_link": clean(website_link),
        "campaign_id": clean(campaign_id),
        "campaign_name": clean(campaign_name),
        "notes": clean(notes),
        "status": "ACTIVE",
        "redeemed_at": None,
        "redeemed_by": None,
        "redeemed_by_name": None,
        "redeemed_store_id": None,
        "redeemed_store_name": None,
        "email_sent_at": None,
        "email_sent_count": 0,
        "created_by": created_by,
        "created_by_name": created_by_name,
        "created_at": now,
        "updated_at": now,
    }
    result = await coupons_collection.insert_one(doc)
    return serialize(await coupons_collection.find_one({"_id": result.inserted_id}))


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_coupon(payload: CouponPayload, ctx: Dict[str, Any] = Depends(get_tenant)):
    ctx = require_hq(require_crm_tab(ctx, "coupons"))
    pct = float(payload.discount_pct or 0)
    if pct <= 0 or pct > 100:
        raise HTTPException(status_code=400, detail="Discount must be a percentage between 1 and 100.")
    campaign_name = await _resolve_campaign_name(ctx["tenant_id"], payload.campaign_id)
    return await issue_coupon(
        ctx["tenant_id"], pct, payload.min_bill_amount, payload.expiry_date,
        payload.customer_name, payload.contact_no, payload.email, payload.notes,
        ctx.get("admin_id"), ctx.get("admin_name"), website_link=payload.website_link,
        campaign_id=payload.campaign_id, campaign_name=campaign_name,
    )


@router.patch("/{coupon_id}")
async def update_coupon(coupon_id: str, payload: CouponPayload, ctx: Dict[str, Any] = Depends(get_tenant)):
    """Everything except the code itself can be edited — the code is what
    was already handed to (or printed for) a customer, so it stays fixed
    once issued. Blocked once redeemed, since the terms it was redeemed
    under shouldn't change retroactively."""
    ctx = require_hq(require_crm_tab(ctx, "coupons"))
    if not ObjectId.is_valid(coupon_id):
        raise HTTPException(status_code=400, detail="Invalid coupon ID.")
    coupon = await coupons_collection.find_one({"_id": ObjectId(coupon_id), "tenant_id": ctx["tenant_id"]})
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found.")
    if coupon.get("status") == "REDEEMED":
        raise HTTPException(status_code=409, detail="This coupon has already been redeemed and can no longer be edited.")
    pct = float(payload.discount_pct or 0)
    if pct <= 0 or pct > 100:
        raise HTTPException(status_code=400, detail="Discount must be a percentage between 1 and 100.")
    campaign_name = await _resolve_campaign_name(ctx["tenant_id"], payload.campaign_id)
    await coupons_collection.update_one({"_id": coupon["_id"]}, {"$set": {
        "discount_pct": round(pct, 2),
        "min_bill_amount": max(0.0, float(payload.min_bill_amount or 0)),
        "expiry_date": clean(payload.expiry_date),
        "customer_name": clean(payload.customer_name),
        "contact_no": clean(payload.contact_no),
        "email": clean(payload.email),
        "notes": clean(payload.notes),
        "website_link": clean(payload.website_link),
        "campaign_id": clean(payload.campaign_id),
        "campaign_name": campaign_name,
        "updated_at": now_utc(),
    }})
    return serialize(await coupons_collection.find_one({"_id": coupon["_id"]}))


@router.post("/{coupon_id}/image")
async def upload_coupon_image(coupon_id: str, file: UploadFile = File(...), ctx: Dict[str, Any] = Depends(get_tenant)):
    """HQ attaches an image to a manually-issued coupon after creating it —
    a second step (not part of the create payload) since this is a file
    upload, same two-step pattern as the Lucky Draw campaign coupon image."""
    ctx = require_hq(require_crm_tab(ctx, "coupons"))
    if not ObjectId.is_valid(coupon_id):
        raise HTTPException(status_code=400, detail="Invalid coupon ID.")
    coupon = await coupons_collection.find_one({"_id": ObjectId(coupon_id), "tenant_id": ctx["tenant_id"]})
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found.")
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="The selected file is empty.")
    if len(raw) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image must be under 15 MB.")
    try:
        result = cloudinary.uploader.upload(raw, folder=f"rms/coupons/{ctx['tenant_id']}", resource_type="image")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not upload image: {exc}")
    url = result.get("secure_url") or result.get("url")
    await coupons_collection.update_one({"_id": coupon["_id"]}, {"$set": {"coupon_image_url": url, "updated_at": now_utc()}})
    return {"message": "Coupon image saved.", "coupon_image_url": url}


@router.patch("/{coupon_id}/status")
async def set_coupon_status(coupon_id: str, payload: dict, ctx: Dict[str, Any] = Depends(get_tenant)):
    ctx = require_hq(require_crm_tab(ctx, "coupons"))
    if not ObjectId.is_valid(coupon_id):
        raise HTTPException(status_code=400, detail="Invalid coupon ID.")
    new_status = clean(payload.get("status")).upper()
    if new_status not in {"ACTIVE", "DISABLED"}:
        raise HTTPException(status_code=400, detail="Status must be ACTIVE or DISABLED.")
    coupon = await coupons_collection.find_one({"_id": ObjectId(coupon_id), "tenant_id": ctx["tenant_id"]})
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found.")
    if coupon.get("status") == "REDEEMED":
        raise HTTPException(status_code=409, detail="This coupon has already been redeemed.")
    await coupons_collection.update_one({"_id": coupon["_id"]}, {"$set": {"status": new_status, "updated_at": now_utc()}})
    return {"message": f"Coupon marked {new_status.title()}."}


@router.get("/lookup")
async def lookup_coupon(code: str = Query(...), ctx: Dict[str, Any] = Depends(get_tenant)):
    """Staff-facing check before manually applying a discount at billing —
    tells them whether a code is real, active, and what it's worth."""
    ctx = require_crm_tab(ctx, "coupons")
    cleaned = clean(code).upper()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Enter a coupon code to search.")
    coupon = await coupons_collection.find_one({"tenant_id": ctx["tenant_id"], "code": cleaned})
    if not coupon:
        return {"found": False}
    return {"found": True, "coupon": serialize(coupon)}


@router.post("/{coupon_id}/redeem")
async def redeem_coupon(coupon_id: str, ctx: Dict[str, Any] = Depends(get_tenant)):
    """Staff clicks this after they've already applied the discount on the
    bill by hand — this just records that it happened, once, so the same
    code can't be reused."""
    ctx = require_crm_tab(ctx, "coupons")
    if not ObjectId.is_valid(coupon_id):
        raise HTTPException(status_code=400, detail="Invalid coupon ID.")
    coupon = await coupons_collection.find_one({"_id": ObjectId(coupon_id), "tenant_id": ctx["tenant_id"]})
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found.")
    if coupon.get("status") == "REDEEMED":
        raise HTTPException(status_code=409, detail="This coupon has already been redeemed.")
    if coupon.get("status") == "DISABLED":
        raise HTTPException(status_code=409, detail="This coupon has been disabled.")
    now = now_utc()
    await coupons_collection.update_one({"_id": coupon["_id"]}, {"$set": {
        "status": "REDEEMED", "redeemed_at": now,
        "redeemed_by": ctx.get("admin_id"), "redeemed_by_name": ctx.get("admin_name"),
        "redeemed_store_id": ctx.get("store_id"), "redeemed_store_name": ctx.get("store_name"),
        "updated_at": now,
    }})
    # Only if an email was ever on file for this coupon — no email means no
    # confirmation goes out, and that's fine, staff redemption still works.
    if coupon.get("email"):
        await send_coupon_redeemed_email(
            email=coupon["email"],
            customer_name=coupon.get("customer_name") or "",
            code=coupon.get("code"),
            discount_pct=coupon.get("discount_pct") or 0,
            min_bill_amount=coupon.get("min_bill_amount") or 0,
            store_name=ctx.get("store_name") or "",
            website_link=coupon.get("website_link") or "",
        )
    return {"message": "Coupon marked redeemed."}


# ─────────────────────────────────────────────────────────────────────────────
# Public, no-login — "Redeem now" on the Lucky Draw Thank You page. Unlike
# every route above, this one takes no tenant context: the coupon_id itself
# (a Mongo ObjectId, unguessable) is the only credential, exactly like the
# public Lucky Draw entry endpoints. It only ever emails the address already
# stored on the coupon at issuance — never one supplied by the caller — so
# there's nothing here an attacker could redirect to their own inbox.
# ─────────────────────────────────────────────────────────────────────────────
def _public_view(coupon: dict) -> dict:
    """Only what a shareable coupon link needs to display — never the
    tenant_id, contact_no, notes, or redeemed_by/staff fields."""
    return {
        "code": coupon.get("code"),
        "discount_pct": coupon.get("discount_pct"),
        "min_bill_amount": coupon.get("min_bill_amount"),
        "expiry_date": coupon.get("expiry_date"),
        "coupon_image_url": coupon.get("coupon_image_url") or "",
        "customer_name": coupon.get("customer_name") or "",
        "status": coupon.get("status"),
        "has_email": bool(coupon.get("email")),
        "website_link": coupon.get("website_link") or "",
    }


@router.get("/public/{coupon_id}")
async def public_view_coupon(coupon_id: str):
    """The page a shared coupon link (e.g. sent over WhatsApp) opens to —
    read-only, no login. Anyone with the link can see this one coupon, same
    trust model as the rest of the public Lucky Draw/coupon surface: the
    ObjectId itself is the only credential."""
    if not ObjectId.is_valid(coupon_id):
        raise HTTPException(status_code=404, detail="This coupon link isn't recognized.")
    coupon = await coupons_collection.find_one({"_id": ObjectId(coupon_id)})
    if not coupon:
        raise HTTPException(status_code=404, detail="This coupon link isn't recognized.")
    return {"id": coupon_id, **_public_view(coupon)}


@router.post("/public/{coupon_id}/email")
async def public_email_coupon(coupon_id: str):
    if not ObjectId.is_valid(coupon_id):
        raise HTTPException(status_code=400, detail="Invalid coupon.")
    coupon = await coupons_collection.find_one({"_id": ObjectId(coupon_id)})
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found.")
    email = coupon.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="No email address was given for this entry.")
    ok = await send_coupon_email(
        email=email,
        customer_name=coupon.get("customer_name") or "",
        code=coupon.get("code"),
        discount_pct=coupon.get("discount_pct") or 0,
        min_bill_amount=coupon.get("min_bill_amount") or 0,
        expiry_date=coupon.get("expiry_date") or "",
        coupon_image_url=coupon.get("coupon_image_url") or "",
        website_link=coupon.get("website_link") or "",
    )
    await coupons_collection.update_one(
        {"_id": coupon["_id"]},
        {"$set": {"email_sent_at": now_utc()}, "$inc": {"email_sent_count": 1}},
    )
    return {
        "message": "Coupon emailed! Check your inbox." if ok else "Could not send the email right now — you can still redeem using the code shown here.",
        "sent": ok,
    }
