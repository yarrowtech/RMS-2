"""Lucky Draw — public, no-login entry point for a customer's own phone.

A QR code printed at a store points at /lucky-draw-scan/<token> on the
frontend, which calls this router. The token is simply that store's own
Mongo _id (stores_collection) — stable forever once printed, and looking it
up also gives us which tenant it belongs to, so no extra token table is
needed. There is deliberately no per-campaign token: whichever campaign is
currently ACTIVE for that tenant is used automatically, so one QR poster
keeps working across every future festival without being reprinted.

Entries submitted here land in the exact same lucky_draw_entries_collection
staff-typed slips use, tagged source="QR_SELF_ENTRY" and printed=False, so
they pool into the same draw and show up in the staff dashboard's "needs
printing" queue (Stage 3 of this feature — the physical slip still gets
printed by a staff member and dropped in the box, since a customer's own
phone can't drive the counter's printer).
"""
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db import customer_crm_profiles_collection, lucky_draw_campaigns_collection, lucky_draw_entries_collection, stores_collection
from .coupon_routes import issue_coupon
from .customer_crm_routes import clean, customer_key

router = APIRouter(prefix="/api/customer-crm/lucky-draw/public", tags=["Lucky Draw (Public)"])


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class PublicEntryPayload(BaseModel):
    customer_name: str
    email: str = ""
    address: str = ""
    contact_no: str = ""
    profession: str = ""
    bill_no: str
    newsletter_opt_in: bool = False


class NewsletterSignupPayload(BaseModel):
    customer_name: str
    contact_no: str
    email: str = ""


async def _resolve_store(token: str) -> dict:
    if not ObjectId.is_valid(token):
        raise HTTPException(status_code=404, detail="This QR code isn't recognized. Please ask at the counter.")
    store = await stores_collection.find_one({"_id": ObjectId(token)})
    if not store or not store.get("tenant_id"):
        raise HTTPException(status_code=404, detail="This QR code isn't recognized. Please ask at the counter.")
    return store


async def _active_campaign(tenant_id: str) -> Optional[dict]:
    return await lucky_draw_campaigns_collection.find_one(
        {"tenant_id": tenant_id, "status": "ACTIVE"},
        sort=[("created_at", -1)],
    )


async def _upsert_newsletter_profile(tenant_id: str, store_id: str, store_name: str, customer_name: str, contact_no: str, email: str) -> None:
    """Shared by the entry form's own opt-in checkbox AND the "sign up for
    offers" button shown afterward on the Thank You page for anyone who
    skipped it the first time — same profile write either way."""
    if not contact_no:
        return
    now = now_utc()
    existing_profile = await customer_crm_profiles_collection.find_one({
        "tenant_id": tenant_id, "store_id": store_id, "mobile": contact_no,
    })
    if existing_profile:
        await customer_crm_profiles_collection.update_one(
            {"_id": existing_profile["_id"]},
            {"$set": {
                "consent_whatsapp": True, "consent_sms": True, "consent_email": bool(email),
                "email": email or existing_profile.get("email", ""),
                "updated_at": now,
            }},
        )
    else:
        key = customer_key(customer_name, contact_no)
        await customer_crm_profiles_collection.insert_one({
            "tenant_id": tenant_id, "store_id": store_id,
            "name": customer_name, "mobile": contact_no, "email": email,
            "city": "", "birthday": "", "anniversary": "", "segment": "New",
            "tags": ["lucky-draw"], "preferred_channel": "WhatsApp",
            "consent_whatsapp": True, "consent_sms": True, "consent_email": bool(email),
            "notes": f"Signed up via Lucky Draw QR at {store_name}." if store_name else "Signed up via Lucky Draw QR.",
            "created_by": None, "created_by_name": "Customer (QR self-entry)",
            "created_at": now, "updated_at": now,
            "_source_key": key,
        })


@router.get("/{token}")
async def public_campaign_status(token: str):
    """The scan page's first call — tells it whether there's a live contest
    to show a form for, and what to call it."""
    store = await _resolve_store(token)
    campaign = await _active_campaign(store["tenant_id"])
    if not campaign:
        return {"campaign_active": False, "store_name": store.get("name") or store.get("store_name") or ""}
    return {
        "campaign_active": True,
        "store_name": store.get("name") or store.get("store_name") or "",
        "campaign_name": campaign.get("campaign_name"),
        "notes": campaign.get("notes") or "",
        "entry_reward_pct": campaign.get("entry_reward_pct") or 0,
    }


@router.post("/{token}/entries")
async def public_create_entry(token: str, payload: PublicEntryPayload):
    store = await _resolve_store(token)
    tenant_id = store["tenant_id"]
    store_id = str(store["_id"])
    store_name = store.get("name") or store.get("store_name") or ""

    campaign = await _active_campaign(tenant_id)
    if not campaign:
        raise HTTPException(status_code=409, detail="There's no lucky draw running right now — please check at the counter.")

    customer_name = clean(payload.customer_name)
    bill_no = clean(payload.bill_no)
    if not customer_name:
        raise HTTPException(status_code=400, detail="Please enter your name.")
    if not bill_no:
        raise HTTPException(status_code=400, detail="Please enter the bill number from your purchase.")

    campaign_id = str(campaign["_id"])
    dupe_query = {"tenant_id": tenant_id, "store_id": store_id, "campaign_id": campaign_id, "bill_no": bill_no}
    if await lucky_draw_entries_collection.find_one(dupe_query, {"_id": 1}):
        raise HTTPException(status_code=409, detail=f"Bill No. {bill_no} has already been entered for this contest.")

    now = now_utc()
    contact_no = clean(payload.contact_no)
    entry_doc = {
        "tenant_id": tenant_id,
        "store_id": store_id,
        "store_name": store_name,
        "campaign_id": campaign_id,
        "campaign_name": campaign.get("campaign_name"),
        "customer_name": customer_name,
        "email": clean(payload.email),
        "address": clean(payload.address),
        "contact_no": contact_no,
        "profession": clean(payload.profession),
        "bill_no": bill_no,
        "entered_by": None,
        "entered_by_name": "Customer (QR self-entry)",
        "source": "QR_SELF_ENTRY",
        "printed": False,
        "created_at": now,
        "updated_at": now,
    }
    result = await lucky_draw_entries_collection.insert_one(entry_doc)

    if payload.newsletter_opt_in and contact_no:
        await _upsert_newsletter_profile(tenant_id, store_id, store_name, customer_name, contact_no, clean(payload.email))

    coupon = None
    reward_pct = float(campaign.get("entry_reward_pct") or 0)
    if reward_pct > 0:
        coupon = await issue_coupon(
            tenant_id=tenant_id, discount_pct=reward_pct,
            customer_name=customer_name, contact_no=contact_no, email=clean(payload.email),
            coupon_image_url=campaign.get("coupon_image_url") or "",
            notes=f"Auto-issued for entering {campaign.get('campaign_name')} at {store_name}." if store_name else f"Auto-issued for entering {campaign.get('campaign_name')}.",
            created_by_name="Lucky Draw (auto-issued)",
        )

    return {
        "message": "Entry received! A staff member will print your slip at the counter — drop it in the box to complete your entry.",
        "entry_id": str(result.inserted_id),
        "coupon": coupon,
    }


@router.post("/{token}/newsletter")
async def public_newsletter_signup(token: str, payload: NewsletterSignupPayload):
    """Lets someone who skipped the opt-in checkbox on the entry form sign up
    afterward, right from the Thank You screen."""
    store = await _resolve_store(token)
    customer_name = clean(payload.customer_name)
    contact_no = clean(payload.contact_no)
    if not contact_no:
        raise HTTPException(status_code=400, detail="A contact number is needed to sign up.")
    await _upsert_newsletter_profile(
        store["tenant_id"], str(store["_id"]), store.get("name") or store.get("store_name") or "",
        customer_name, contact_no, clean(payload.email),
    )
    return {"message": "You're signed up for offers and festival updates."}
