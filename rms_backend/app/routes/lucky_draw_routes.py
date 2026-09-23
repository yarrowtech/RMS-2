"""Lucky Draw — a Customer CRM sub-feature for festival slip contests
(Puja, Diwali, anniversary sale, etc).

Stage 1 only: campaign setup, slip-entry capture, and a plain entries list.
The random draw itself (picking the winner) is a later stage and is not
built here yet.

Shared across stores the way the rest of Customer CRM is shared: HQ Admin
can see and manage every store's campaigns and entries, while a store-scoped
login only ever sees its own store's entries. Only HQ Admin (scope == "hq",
never a department-level admin) can create or close a campaign.
"""
import random
from typing import Any, Dict, Optional

import cloudinary
import cloudinary.uploader
from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel

from ..config import settings
from ..db import lucky_draw_campaigns_collection, lucky_draw_entries_collection, lucky_draw_results_collection
from .customer_crm_routes import clean, now_utc, require_crm_tab, scoped_query, serialize_doc
from .deps import get_tenant

cloudinary.config(cloud_name=settings.cloudinary_cloud_name, api_key=settings.cloudinary_api_key, api_secret=settings.cloudinary_api_secret, secure=True)

router = APIRouter(prefix="/api/customer-crm/lucky-draw", tags=["Lucky Draw"])


class CampaignPayload(BaseModel):
    campaign_name: str
    starts_on: str = ""
    ends_on: str = ""
    min_bill_amount: float = 0
    notes: str = ""
    # 0 = no automatic reward. When set, every QR self-entry submitted while
    # this campaign is active gets an instant coupon at this percentage,
    # shown right on the Thank You screen — a small "thanks for entering"
    # perk, separate from actually winning the draw.
    entry_reward_pct: float = 0
    # Optional — carried onto every auto-issued coupon for this campaign,
    # same as an individual coupon's own website_link (coupon_routes.py):
    # shown as a "Start exploring" button and a clickable coupon image, both
    # on the Thank You screen and in the coupon emails.
    website_link: str = ""


class EntryPayload(BaseModel):
    campaign_id: str
    customer_name: str
    email: str = ""
    address: str = ""
    contact_no: str = ""
    profession: str = ""
    bill_no: str


class DrawPayload(BaseModel):
    # HQ only: which store's entries to draw from. Left blank/null by HQ
    # pools every store's entries into one chain-wide "grand draw". A
    # store-scoped login can never set this — it's always forced to their
    # own store.
    store_id: Optional[str] = None
    winner_count: int = 1


class RedoPayload(BaseModel):
    store_id: Optional[str] = None
    winner_count: int = 1
    reason: str


def require_hq(ctx: Dict[str, Any]) -> Dict[str, Any]:
    if ctx.get("scope") != "hq":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only HQ Admin can manage lucky draw campaigns.")
    return ctx


def _resolve_store_scope(ctx: Dict[str, Any], requested_store_id: Optional[str]) -> Optional[str]:
    """A store-scoped login always draws its own store; only HQ may pick a
    specific store or leave it blank for one chain-wide draw across every
    store's entries."""
    if ctx.get("scope") in ("store", "branch"):
        if not ctx.get("store_id"):
            raise HTTPException(status_code=403, detail="No store context found for this login.")
        return ctx["store_id"]
    return clean(requested_store_id) or None


async def _execute_draw(
    ctx: Dict[str, Any],
    campaign: dict,
    store_id: Optional[str],
    winner_count: int,
    redo_of: Optional[str] = None,
    redo_reason: Optional[str] = None,
) -> dict:
    """Randomly pick winner(s) from every eligible entry and record the
    result. One customer (matched by contact number) can only win once per
    draw, even if they hold several entries from separate bills."""
    campaign_id = str(campaign["_id"])
    winner_count = max(1, min(50, int(winner_count or 1)))
    entry_query: Dict[str, Any] = {"tenant_id": ctx["tenant_id"], "campaign_id": campaign_id}
    if store_id:
        entry_query["store_id"] = store_id
    entries = await lucky_draw_entries_collection.find(entry_query).to_list(5000)
    if not entries:
        raise HTTPException(status_code=400, detail="No entries to draw from.")

    store_name = ""
    if store_id:
        store_name = next((e.get("store_name") for e in entries if e.get("store_name")), "")

    pool: Dict[str, dict] = {}
    for entry in entries:
        contact = clean(entry.get("contact_no"))
        key = f"phone:{contact}" if contact else f"entry:{entry['_id']}"
        pool.setdefault(key, entry)
    candidates = list(pool.values())
    picked = random.SystemRandom().sample(candidates, k=min(winner_count, len(candidates)))

    winners = [{
        "entry_id": str(w["_id"]), "customer_name": w.get("customer_name"), "contact_no": w.get("contact_no"),
        "address": w.get("address"), "profession": w.get("profession"), "bill_no": w.get("bill_no"),
        "store_id": w.get("store_id"), "store_name": w.get("store_name"),
    } for w in picked]

    now = now_utc()
    doc = {
        "tenant_id": ctx["tenant_id"], "campaign_id": campaign_id, "campaign_name": campaign.get("campaign_name"),
        "store_id": store_id, "store_name": store_name,
        "eligible_count": len(candidates), "winners": winners,
        "run_by": ctx.get("admin_id"), "run_by_name": ctx.get("admin_name"),
        "created_at": now, "superseded": False,
        "redo_of": redo_of, "redo_reason": redo_reason,
    }
    result = await lucky_draw_results_collection.insert_one(doc)
    saved = await lucky_draw_results_collection.find_one({"_id": result.inserted_id})
    return serialize_doc(saved)


@router.get("/campaigns")
async def list_campaigns(ctx: Dict[str, Any] = Depends(get_tenant)):
    ctx = require_crm_tab(ctx, "luckydraw")
    rows = await lucky_draw_campaigns_collection.find({
        "tenant_id": ctx["tenant_id"],
        "status": {"$ne": "REMOVED"},
    }).sort("created_at", -1).to_list(200)
    return [serialize_doc(r) for r in rows]


@router.post("/campaigns", status_code=status.HTTP_201_CREATED)
async def create_campaign(payload: CampaignPayload, ctx: Dict[str, Any] = Depends(get_tenant)):
    ctx = require_hq(require_crm_tab(ctx, "luckydraw"))
    name = clean(payload.campaign_name)
    if not name:
        raise HTTPException(status_code=400, detail="Campaign name is required.")
    now = now_utc()
    doc = {
        "tenant_id": ctx["tenant_id"],
        "campaign_name": name,
        "starts_on": clean(payload.starts_on),
        "ends_on": clean(payload.ends_on),
        "min_bill_amount": max(0.0, float(payload.min_bill_amount or 0)),
        "notes": clean(payload.notes),
        "entry_reward_pct": max(0.0, min(100.0, float(payload.entry_reward_pct or 0))),
        "coupon_image_url": "",
        "website_link": clean(payload.website_link),
        "status": "ACTIVE",
        "created_by": ctx.get("admin_id"),
        "created_by_name": ctx.get("admin_name"),
        "created_at": now,
        "updated_at": now,
    }
    result = await lucky_draw_campaigns_collection.insert_one(doc)
    saved = await lucky_draw_campaigns_collection.find_one({"_id": result.inserted_id})
    return serialize_doc(saved)


@router.patch("/campaigns/{campaign_id}")
async def update_campaign(campaign_id: str, payload: CampaignPayload, ctx: Dict[str, Any] = Depends(get_tenant)):
    """Lets HQ go back and change a campaign after creating it — most
    importantly, add or change the entry_reward_pct on a campaign that's
    already ACTIVE and collecting entries, since there was previously no
    way to do that once it was created."""
    ctx = require_hq(require_crm_tab(ctx, "luckydraw"))
    if not ObjectId.is_valid(campaign_id):
        raise HTTPException(status_code=400, detail="Invalid campaign ID.")
    campaign = await lucky_draw_campaigns_collection.find_one({"_id": ObjectId(campaign_id), "tenant_id": ctx["tenant_id"], "status": {"$ne": "REMOVED"}})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    name = clean(payload.campaign_name)
    if not name:
        raise HTTPException(status_code=400, detail="Campaign name is required.")
    await lucky_draw_campaigns_collection.update_one({"_id": campaign["_id"]}, {"$set": {
        "campaign_name": name,
        "starts_on": clean(payload.starts_on),
        "ends_on": clean(payload.ends_on),
        "min_bill_amount": max(0.0, float(payload.min_bill_amount or 0)),
        "notes": clean(payload.notes),
        "entry_reward_pct": max(0.0, min(100.0, float(payload.entry_reward_pct or 0))),
        "website_link": clean(payload.website_link),
        "updated_at": now_utc(),
    }})
    return serialize_doc(await lucky_draw_campaigns_collection.find_one({"_id": campaign["_id"]}))


@router.post("/campaigns/{campaign_id}/coupon-image")
async def upload_campaign_coupon_image(campaign_id: str, file: UploadFile = File(...), ctx: Dict[str, Any] = Depends(get_tenant)):
    """HQ attaches one coupon graphic per campaign — shown on the public
    Thank You page (and in any future coupon email) for every coupon
    auto-issued under this campaign's entry_reward_pct."""
    ctx = require_hq(require_crm_tab(ctx, "luckydraw"))
    if not ObjectId.is_valid(campaign_id):
        raise HTTPException(status_code=400, detail="Invalid campaign ID.")
    campaign = await lucky_draw_campaigns_collection.find_one({"_id": ObjectId(campaign_id), "tenant_id": ctx["tenant_id"]})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="The selected file is empty.")
    if len(raw) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image must be under 15 MB.")
    try:
        result = cloudinary.uploader.upload(raw, folder=f"rms/lucky-draw-coupons/{ctx['tenant_id']}", resource_type="image")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not upload image: {exc}")
    url = result.get("secure_url") or result.get("url")
    await lucky_draw_campaigns_collection.update_one({"_id": campaign["_id"]}, {"$set": {"coupon_image_url": url, "updated_at": now_utc()}})
    return {"message": "Coupon image saved.", "coupon_image_url": url}


@router.patch("/campaigns/{campaign_id}/status")
async def set_campaign_status(campaign_id: str, payload: dict, ctx: Dict[str, Any] = Depends(get_tenant)):
    ctx = require_hq(require_crm_tab(ctx, "luckydraw"))
    if not ObjectId.is_valid(campaign_id):
        raise HTTPException(status_code=400, detail="Invalid campaign ID.")
    new_status = clean(payload.get("status")).upper()
    if new_status not in {"ACTIVE", "CLOSED"}:
        raise HTTPException(status_code=400, detail="Status must be ACTIVE or CLOSED.")
    campaign = await lucky_draw_campaigns_collection.find_one({"_id": ObjectId(campaign_id), "tenant_id": ctx["tenant_id"]})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    await lucky_draw_campaigns_collection.update_one({"_id": campaign["_id"]}, {"$set": {"status": new_status, "updated_at": now_utc()}})
    return {"message": f"Campaign marked {new_status.title()}."}


@router.delete("/campaigns/{campaign_id}")
async def remove_campaign(campaign_id: str, ctx: Dict[str, Any] = Depends(get_tenant)):
    """Remove a campaign from active use without destroying its entry/draw
    history. Only an HQ-scoped CRM administrator can perform this action."""
    ctx = require_hq(require_crm_tab(ctx, "luckydraw"))
    if not ObjectId.is_valid(campaign_id):
        raise HTTPException(status_code=400, detail="Invalid campaign ID.")
    campaign = await lucky_draw_campaigns_collection.find_one({
        "_id": ObjectId(campaign_id),
        "tenant_id": ctx["tenant_id"],
        "status": {"$ne": "REMOVED"},
    })
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    now = now_utc()
    await lucky_draw_campaigns_collection.update_one(
        {"_id": campaign["_id"], "tenant_id": ctx["tenant_id"]},
        {"$set": {
            "status": "REMOVED",
            "removed_at": now,
            "removed_by": ctx.get("admin_id"),
            "removed_by_name": ctx.get("admin_name"),
            "updated_at": now,
        }},
    )
    return {"message": "Campaign removed. Existing entries and draw history were retained for audit."}


@router.get("/entries")
async def list_entries(campaign_id: Optional[str] = Query(None), ctx: Dict[str, Any] = Depends(get_tenant)):
    ctx = require_crm_tab(ctx, "luckydraw")
    query = scoped_query(ctx)
    if campaign_id:
        if not ObjectId.is_valid(campaign_id):
            raise HTTPException(status_code=400, detail="Invalid campaign ID.")
        query["campaign_id"] = campaign_id
    rows = await lucky_draw_entries_collection.find(query).sort("created_at", -1).to_list(2000)
    return [serialize_doc(r) for r in rows]


@router.post("/entries", status_code=status.HTTP_201_CREATED)
async def create_entry(payload: EntryPayload, ctx: Dict[str, Any] = Depends(get_tenant)):
    ctx = require_crm_tab(ctx, "luckydraw")
    if not ObjectId.is_valid(payload.campaign_id):
        raise HTTPException(status_code=400, detail="Invalid campaign ID.")
    campaign = await lucky_draw_campaigns_collection.find_one({"_id": ObjectId(payload.campaign_id), "tenant_id": ctx["tenant_id"]})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    if campaign.get("status") != "ACTIVE":
        raise HTTPException(status_code=409, detail="This campaign is closed for new entries.")
    customer_name = clean(payload.customer_name)
    bill_no = clean(payload.bill_no)
    if not customer_name:
        raise HTTPException(status_code=400, detail="Customer name is required.")
    if not bill_no:
        raise HTTPException(status_code=400, detail="Bill No. is required.")
    scope = scoped_query(ctx)
    dupe_query = {**scope, "campaign_id": payload.campaign_id, "bill_no": bill_no}
    if await lucky_draw_entries_collection.find_one(dupe_query, {"_id": 1}):
        raise HTTPException(status_code=409, detail=f"Bill No. {bill_no} has already been entered for this store's draw.")
    now = now_utc()
    doc = {
        **scope,
        "store_name": ctx.get("store_name") or "",
        "campaign_id": payload.campaign_id,
        "campaign_name": campaign.get("campaign_name"),
        "customer_name": customer_name,
        "email": clean(payload.email),
        "address": clean(payload.address),
        "contact_no": clean(payload.contact_no),
        "profession": clean(payload.profession),
        "bill_no": bill_no,
        "entered_by": ctx.get("admin_id"),
        "entered_by_name": ctx.get("admin_name"),
        # Staff typed this straight off the physical slip already in hand —
        # nothing further needs printing, unlike a QR self-entry.
        "source": "COUNTER_STAFF",
        "printed": True,
        "created_at": now,
        "updated_at": now,
    }
    result = await lucky_draw_entries_collection.insert_one(doc)
    saved = await lucky_draw_entries_collection.find_one({"_id": result.inserted_id})
    return serialize_doc(saved)


@router.delete("/entries/{entry_id}")
async def delete_entry(entry_id: str, ctx: Dict[str, Any] = Depends(get_tenant)):
    ctx = require_crm_tab(ctx, "luckydraw")
    if not ObjectId.is_valid(entry_id):
        raise HTTPException(status_code=400, detail="Invalid entry ID.")
    query = {**scoped_query(ctx), "_id": ObjectId(entry_id)}
    entry = await lucky_draw_entries_collection.find_one(query)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found, or belongs to another store.")
    await lucky_draw_entries_collection.delete_one({"_id": entry["_id"]})
    return {"message": "Entry removed."}


@router.patch("/entries/{entry_id}/printed")
async def mark_entry_printed(entry_id: str, ctx: Dict[str, Any] = Depends(get_tenant)):
    """Staff clicks Print on a QR self-entry, gets the paper slip out of the
    counter printer, and marks it done here so it drops off the 'needs
    printing' queue. Marking printed does not require the print to have
    visibly succeeded — same as any receipt printer, staff can tell at a
    glance if it misfired and just print again."""
    ctx = require_crm_tab(ctx, "luckydraw")
    if not ObjectId.is_valid(entry_id):
        raise HTTPException(status_code=400, detail="Invalid entry ID.")
    query = {**scoped_query(ctx), "_id": ObjectId(entry_id)}
    entry = await lucky_draw_entries_collection.find_one(query)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found, or belongs to another store.")
    await lucky_draw_entries_collection.update_one(
        {"_id": entry["_id"]},
        {"$set": {"printed": True, "printed_by": ctx.get("admin_id"), "printed_by_name": ctx.get("admin_name"), "printed_at": now_utc()}},
    )
    return {"message": "Marked as printed."}


@router.post("/campaigns/{campaign_id}/draw", status_code=status.HTTP_201_CREATED)
async def run_draw(campaign_id: str, payload: DrawPayload, ctx: Dict[str, Any] = Depends(get_tenant)):
    ctx = require_crm_tab(ctx, "luckydraw")
    if not ObjectId.is_valid(campaign_id):
        raise HTTPException(status_code=400, detail="Invalid campaign ID.")
    campaign = await lucky_draw_campaigns_collection.find_one({"_id": ObjectId(campaign_id), "tenant_id": ctx["tenant_id"]})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    if campaign.get("status") != "CLOSED":
        raise HTTPException(status_code=409, detail="Close the campaign before running its draw.")
    store_id = _resolve_store_scope(ctx, payload.store_id)
    existing = await lucky_draw_results_collection.find_one({
        "tenant_id": ctx["tenant_id"], "campaign_id": campaign_id, "store_id": store_id, "superseded": False,
    })
    if existing:
        raise HTTPException(status_code=409, detail="This draw has already been run. Use Redo draw with a reason if it must be run again.")
    return await _execute_draw(ctx, campaign, store_id, payload.winner_count)


@router.post("/campaigns/{campaign_id}/draw/redo", status_code=status.HTTP_201_CREATED)
async def redo_draw(campaign_id: str, payload: RedoPayload, ctx: Dict[str, Any] = Depends(get_tenant)):
    ctx = require_crm_tab(ctx, "luckydraw")
    reason = clean(payload.reason)
    if not reason:
        raise HTTPException(status_code=400, detail="A reason is required to redo a draw.")
    if not ObjectId.is_valid(campaign_id):
        raise HTTPException(status_code=400, detail="Invalid campaign ID.")
    campaign = await lucky_draw_campaigns_collection.find_one({"_id": ObjectId(campaign_id), "tenant_id": ctx["tenant_id"]})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    store_id = _resolve_store_scope(ctx, payload.store_id)
    existing = await lucky_draw_results_collection.find_one({
        "tenant_id": ctx["tenant_id"], "campaign_id": campaign_id, "store_id": store_id, "superseded": False,
    })
    if not existing:
        raise HTTPException(status_code=404, detail="No existing draw to redo for this scope — use Run Draw instead.")
    now = now_utc()
    await lucky_draw_results_collection.update_one({"_id": existing["_id"]}, {"$set": {
        "superseded": True, "superseded_at": now, "superseded_by": ctx.get("admin_id"),
        "superseded_by_name": ctx.get("admin_name"), "superseded_reason": reason,
    }})
    return await _execute_draw(ctx, campaign, store_id, payload.winner_count, redo_of=str(existing["_id"]), redo_reason=reason)


@router.get("/results")
async def list_results(campaign_id: Optional[str] = Query(None), ctx: Dict[str, Any] = Depends(get_tenant)):
    ctx = require_crm_tab(ctx, "luckydraw")
    query: Dict[str, Any] = {"tenant_id": ctx["tenant_id"]}
    if campaign_id:
        if not ObjectId.is_valid(campaign_id):
            raise HTTPException(status_code=400, detail="Invalid campaign ID.")
        query["campaign_id"] = campaign_id
    if ctx.get("scope") in ("store", "branch") and ctx.get("store_id"):
        # A store sees its own draws plus any chain-wide grand draw HQ ran.
        query["$or"] = [{"store_id": ctx["store_id"]}, {"store_id": None}]
    rows = await lucky_draw_results_collection.find(query).sort("created_at", -1).to_list(200)
    return [serialize_doc(r) for r in rows]


@router.get("/lookup")
async def lookup_by_phone(contact_no: str = Query(...), ctx: Dict[str, Any] = Depends(get_tenant)):
    """Staff-facing single-customer check — used to tell one customer at the
    counter whether they won, without showing the whole winner list or
    anyone else's entries."""
    ctx = require_crm_tab(ctx, "luckydraw")
    contact = clean(contact_no)
    if not contact:
        raise HTTPException(status_code=400, detail="Enter a contact number to search.")
    query = scoped_query(ctx)
    query["contact_no"] = contact
    entries = await lucky_draw_entries_collection.find(query).sort("created_at", -1).to_list(200)
    if not entries:
        return {"found": False, "entries": [], "wins": []}
    entry_ids = {str(e["_id"]) for e in entries}
    result_query: Dict[str, Any] = {"tenant_id": ctx["tenant_id"], "superseded": False}
    if ctx.get("scope") in ("store", "branch") and ctx.get("store_id"):
        result_query["$or"] = [{"store_id": ctx["store_id"]}, {"store_id": None}]
    results = await lucky_draw_results_collection.find(result_query).to_list(200)
    wins = []
    for r in results:
        for rank, winner in enumerate(r.get("winners", []), start=1):
            if winner.get("entry_id") in entry_ids:
                wins.append({
                    "campaign_name": r.get("campaign_name"), "rank": rank,
                    "scope": "All stores (grand draw)" if not r.get("store_id") else (r.get("store_name") or "Store draw"),
                    "bill_no": winner.get("bill_no"),
                })
    return {"found": True, "entries": [serialize_doc(e) for e in entries], "wins": wins}
