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
import asyncio
import random
from typing import Any, Dict, List, Optional
from uuid import uuid4

import cloudinary
import cloudinary.uploader
from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from pymongo import InsertOne, UpdateOne

from ..config import frontend_url, settings
from ..db import (
    lucky_draw_campaigns_collection, lucky_draw_entries_collection,
    lucky_draw_import_batches_collection, lucky_draw_reminders_collection,
    lucky_draw_results_collection,
)
from ..email_utils import send_newsletter_email
from ..sms_utils import send_sms, sms_configured
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
    # HQ only — which physical store this slip belongs to. A store-scoped
    # login ignores this; it's always forced to its own store.
    store_id: str = ""
    store_name: str = ""


class EntryEditPayload(BaseModel):
    customer_name: str
    bill_no: str
    email: str = ""
    address: str = ""
    contact_no: str = ""
    profession: str = ""


class EntryBulkRow(BaseModel):
    customer_name: str = ""
    email: str = ""
    address: str = ""
    contact_no: str = ""
    profession: str = ""
    bill_no: str = ""


class EntryBulkPayload(BaseModel):
    campaign_id: str
    rows: List[EntryBulkRow] = []
    # Groups every chunk of one logical upload (the frontend splits a large
    # file into several requests) under one batch so it can be listed and
    # undone as a single unit. The first chunk's call leaves this blank and
    # gets one generated; the frontend then reuses it for every later chunk
    # of the same upload.
    batch_id: str = ""
    source_label: str = ""
    # HQ only — which physical store this batch of slips belongs to. A
    # store-scoped login ignores this; it's always forced to its own store,
    # same as a single counter entry.
    store_id: str = ""
    store_name: str = ""
    # Off by default (today's safe behaviour: a Bill No. already on file is
    # rejected as an error, nothing changes). Switched on, a matching Bill
    # No. instead UPDATES that existing entry's details from this row — the
    # intended way to fix a bad earlier upload by re-uploading a corrected
    # sheet with the same bill numbers.
    update_existing: bool = False


class ReminderPayload(BaseModel):
    message: str = ""
    test_email: str = ""
    test_phone: str = ""


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
    # Must never silently exclude entrants from the draw pool itself — a cap
    # here would mean some people who legitimately entered could never win,
    # with no error to show it happened. 20000 matches the entries-list cap.
    entries = await lucky_draw_entries_collection.find(entry_query).to_list(20000)
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
    # 20,000 cap, not unbounded — this is a live festival-slip count that can
    # genuinely grow past a few thousand across several stores/campaigns;
    # the old 2000 cap silently hid real entries once a tenant passed it
    # (the on-screen "N entries" count just stopped increasing with no
    # error), which is what this raise fixes.
    rows = await lucky_draw_entries_collection.find(query).sort("created_at", -1).to_list(20000)
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
    store_name = ctx.get("store_name") or ""
    if ctx.get("scope") not in ("store", "branch"):
        store_id = clean(payload.store_id)
        if not store_id:
            raise HTTPException(status_code=400, detail="Choose which store this slip belongs to.")
        scope["store_id"] = store_id
        store_name = clean(payload.store_name)
    dupe_query = {**scope, "campaign_id": payload.campaign_id, "bill_no": bill_no}
    if await lucky_draw_entries_collection.find_one(dupe_query, {"_id": 1}):
        raise HTTPException(status_code=409, detail=f"Bill No. {bill_no} has already been entered for this store's draw.")
    now = now_utc()
    doc = {
        **scope,
        "store_name": store_name,
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


MAX_BULK_ENTRY_ROWS = 2000
BULK_WRITE_CHUNK = 300


@router.post("/entries/bulk", status_code=status.HTTP_201_CREATED)
async def create_entries_bulk(payload: EntryBulkPayload, ctx: Dict[str, Any] = Depends(get_tenant)):
    """Counter staff collected a pile of pen-and-paper slips (alongside the
    QR scanner, which self-enters customers directly) — this lets them
    upload one sheet instead of re-typing each slip through the single-entry
    form. Same validation and per-store duplicate-bill check as a single
    entry, just batched: one bulk existence check instead of a find_one per
    row, and inserts go through bulk_write in bounded chunks instead of one
    insert_one per row — a large sheet can't turn into thousands of
    sequential DB round-trips and hang the request. The frontend additionally
    splits a very large file into several of these calls (see the bulk
    import modal), so even a single request here stays bounded."""
    ctx = require_crm_tab(ctx, "luckydraw")
    if not ObjectId.is_valid(payload.campaign_id):
        raise HTTPException(status_code=400, detail="Invalid campaign ID.")
    campaign = await lucky_draw_campaigns_collection.find_one({"_id": ObjectId(payload.campaign_id), "tenant_id": ctx["tenant_id"]})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    if campaign.get("status") != "ACTIVE":
        raise HTTPException(status_code=409, detail="This campaign is closed for new entries.")
    if not payload.rows:
        raise HTTPException(status_code=400, detail="No rows provided.")
    if len(payload.rows) > MAX_BULK_ENTRY_ROWS:
        raise HTTPException(status_code=400, detail=f"Bulk import is limited to {MAX_BULK_ENTRY_ROWS} rows per request — split a larger file into smaller uploads.")

    # A store-scoped login is always forced to its own store (scoped_query
    # already does this). HQ has no store of its own, so without an explicit
    # choice these rows would carry no store_id at all — unattributed,
    # invisible to that store's own staff. HQ must say which store this
    # batch of physical slips actually came from.
    if ctx.get("scope") == "hq":
        store_id = clean(payload.store_id)
        if not store_id:
            raise HTTPException(status_code=400, detail="Choose which store these slip entries belong to.")
        scope = {"tenant_id": ctx["tenant_id"], "store_id": store_id}
        store_name = clean(payload.store_name)
    else:
        scope = scoped_query(ctx)
        store_name = ctx.get("store_name") or ""

    # One batch groups every chunk of a single logical upload (the frontend
    # splits a large file into several requests of this same endpoint), so
    # the whole upload can be listed and undone as one unit later. The first
    # chunk creates the batch document; later chunks of the same upload just
    # increment its counters via upsert.
    batch_id = clean(payload.batch_id) or uuid4().hex
    await lucky_draw_import_batches_collection.update_one(
        {"tenant_id": ctx["tenant_id"], "batch_id": batch_id},
        {
            "$setOnInsert": {
                "tenant_id": ctx["tenant_id"], "batch_id": batch_id,
                "campaign_id": payload.campaign_id, "campaign_name": campaign.get("campaign_name"),
                "store_id": scope.get("store_id", ""), "store_name": store_name,
                "source_label": clean(payload.source_label),
                "uploaded_by": ctx.get("admin_id"), "uploaded_by_name": ctx.get("admin_name"),
                "created_at": now_utc(),
            },
            "$inc": {"row_count": len(payload.rows)},
            "$set": {"updated_at": now_utc()},
        },
        upsert=True,
    )

    # Pass 1 (in memory): clean every row, catch missing-field errors and
    # duplicate bill numbers WITHIN this same upload, without touching the DB.
    now = now_utc()
    results: List[Optional[dict]] = [None] * len(payload.rows)
    candidates: List[dict] = []
    seen_bill_nos: set = set()
    for i, row in enumerate(payload.rows):
        customer_name = clean(row.customer_name)
        bill_no = clean(row.bill_no)
        if not customer_name or not bill_no:
            results[i] = {"customer_name": customer_name or "(blank)", "bill_no": bill_no, "status": "error", "reason": "Customer name and Bill No. are both required."}
            continue
        if bill_no in seen_bill_nos:
            results[i] = {"customer_name": customer_name, "bill_no": bill_no, "status": "error", "reason": f"Bill No. {bill_no} appears more than once in this upload."}
            continue
        seen_bill_nos.add(bill_no)
        candidates.append({
            "i": i, "customer_name": customer_name, "bill_no": bill_no,
            "email": clean(row.email), "address": clean(row.address),
            "contact_no": clean(row.contact_no), "profession": clean(row.profession),
        })

    # Pass 2: ONE query for every bill_no already on file for this
    # campaign/store, instead of one find_one per row.
    if candidates:
        existing_cursor = lucky_draw_entries_collection.find(
            {**scope, "campaign_id": payload.campaign_id, "bill_no": {"$in": [c["bill_no"] for c in candidates]}},
            {"bill_no": 1},
        )
        existing_bill_nos = {doc["bill_no"] async for doc in existing_cursor}
    else:
        existing_bill_nos = set()

    write_ops: List[Any] = []
    pending_rows: List[dict] = []
    for c in candidates:
        is_update = c["bill_no"] in existing_bill_nos
        if is_update and not payload.update_existing:
            results[c["i"]] = {"customer_name": c["customer_name"], "bill_no": c["bill_no"], "status": "error", "reason": f"Bill No. {c['bill_no']} has already been entered for this store's draw."}
            continue
        if is_update:
            # Fixes a bad earlier upload: same Bill No., corrected details —
            # updates the existing entry in place rather than creating a
            # second one. Campaign/store/bill_no (the match key) are left
            # untouched; only the slip's own fields change.
            update_fields = {
                "customer_name": c["customer_name"], "email": c["email"], "address": c["address"],
                "contact_no": c["contact_no"], "profession": c["profession"], "updated_at": now,
            }
            write_ops.append(UpdateOne({**scope, "campaign_id": payload.campaign_id, "bill_no": c["bill_no"]}, {"$set": update_fields}))
        else:
            doc = {
                **scope,
                "store_name": store_name,
                "campaign_id": payload.campaign_id,
                "campaign_name": campaign.get("campaign_name"),
                "customer_name": c["customer_name"],
                "email": c["email"],
                "address": c["address"],
                "contact_no": c["contact_no"],
                "profession": c["profession"],
                "bill_no": c["bill_no"],
                "entered_by": ctx.get("admin_id"),
                "entered_by_name": ctx.get("admin_name"),
                "source": "COUNTER_STAFF_BULK",
                "batch_id": batch_id,
                "printed": True,
                "created_at": now,
                "updated_at": now,
            }
            write_ops.append(InsertOne(doc))
        pending_rows.append({**c, "_status": "updated" if is_update else "created"})

    # Pass 3: write in bounded chunks rather than one giant bulk_write (or,
    # worse, one insert_one/update_one per row) — keeps each DB round-trip
    # small and predictable regardless of how large the sheet is.
    for start in range(0, len(write_ops), BULK_WRITE_CHUNK):
        chunk = write_ops[start:start + BULK_WRITE_CHUNK]
        if chunk:
            await lucky_draw_entries_collection.bulk_write(chunk, ordered=False)
        for c in pending_rows[start:start + BULK_WRITE_CHUNK]:
            results[c["i"]] = {"customer_name": c["customer_name"], "bill_no": c["bill_no"], "status": c["_status"]}

    final_results = [r for r in results if r is not None]
    created = sum(1 for r in final_results if r["status"] == "created")
    updated = sum(1 for r in final_results if r["status"] == "updated")
    if created or updated:
        await lucky_draw_import_batches_collection.update_one({"tenant_id": ctx["tenant_id"], "batch_id": batch_id}, {"$inc": {"created_count": created, "updated_count": updated}})
    message = f"{created} of {len(payload.rows)} entries created."
    if updated:
        message += f" {updated} existing entr{'y' if updated == 1 else 'ies'} updated."
    return {"message": message, "created_count": created, "updated_count": updated, "results": final_results, "batch_id": batch_id}


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


@router.patch("/entries/{entry_id}")
async def edit_entry(entry_id: str, payload: EntryEditPayload, ctx: Dict[str, Any] = Depends(get_tenant)):
    """Fix a typo in a slip already saved — name, bill no, contact, etc —
    without deleting and re-adding it (which would lose entered_by/created_at
    history for no reason)."""
    ctx = require_crm_tab(ctx, "luckydraw")
    if not ObjectId.is_valid(entry_id):
        raise HTTPException(status_code=400, detail="Invalid entry ID.")
    query = {**scoped_query(ctx), "_id": ObjectId(entry_id)}
    entry = await lucky_draw_entries_collection.find_one(query)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found, or belongs to another store.")
    customer_name = clean(payload.customer_name)
    bill_no = clean(payload.bill_no)
    if not customer_name:
        raise HTTPException(status_code=400, detail="Customer name is required.")
    if not bill_no:
        raise HTTPException(status_code=400, detail="Bill No. is required.")
    if bill_no != entry.get("bill_no"):
        dupe_query = {"tenant_id": entry["tenant_id"], "store_id": entry.get("store_id", ""), "campaign_id": entry["campaign_id"], "bill_no": bill_no}
        if await lucky_draw_entries_collection.find_one(dupe_query, {"_id": 1}):
            raise HTTPException(status_code=409, detail=f"Bill No. {bill_no} is already used by another entry in this store's draw.")
    patch = {
        "customer_name": customer_name, "bill_no": bill_no,
        "email": clean(payload.email), "address": clean(payload.address),
        "contact_no": clean(payload.contact_no), "profession": clean(payload.profession),
        "updated_at": now_utc(),
    }
    await lucky_draw_entries_collection.update_one({"_id": entry["_id"]}, {"$set": patch})
    return serialize_doc(await lucky_draw_entries_collection.find_one({"_id": entry["_id"]}))


@router.get("/import-batches")
async def list_import_batches(ctx: Dict[str, Any] = Depends(get_tenant)):
    """Upload history — one row per bulk-import run (a large file may have
    been split into several chunked requests by the frontend, but they all
    share one batch_id, so this still shows one row per actual upload)."""
    ctx = require_crm_tab(ctx, "luckydraw")
    rows = await lucky_draw_import_batches_collection.find(scoped_query(ctx)).sort("created_at", -1).to_list(200)
    return [serialize_doc(r) for r in rows]


@router.delete("/import-batches/{batch_id}")
async def undo_import_batch(batch_id: str, ctx: Dict[str, Any] = Depends(get_tenant)):
    """Deletes only the entries created by this one upload — identified by
    batch_id, not a blind wipe — leaving manual entries and every other
    batch untouched."""
    ctx = require_crm_tab(ctx, "luckydraw")
    query = {**scoped_query(ctx), "batch_id": batch_id}
    batch = await lucky_draw_import_batches_collection.find_one({**scoped_query(ctx), "batch_id": batch_id})
    if not batch:
        raise HTTPException(status_code=404, detail="Import batch not found, or belongs to another store.")
    result = await lucky_draw_entries_collection.delete_many(query)
    await lucky_draw_import_batches_collection.delete_one({"_id": batch["_id"]})
    return {"message": f"{result.deleted_count} entries removed from this import.", "deleted_count": result.deleted_count}


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


# ─────────────────────────────────────────────
# COUNTDOWN REMINDER — email every entrant of one campaign (not the whole
# Newsletter audience) that the draw date is coming up. Reuses the same
# per-recipient send_newsletter_email the Customer CRM Newsletter tab already
# uses — only the audience and the message differ. WhatsApp reminders are
# deliberately not attempted here: there's no customer-facing WhatsApp
# sender wired up in RMS yet (only the separate vendor-catalog push), so an
# "email only for now" note is in the response rather than silently no-op.
# ─────────────────────────────────────────────

async def _reminder_audience(tenant_id: str, campaign_id: str) -> List[dict]:
    """Every entrant of this campaign with an email AND/OR a phone number on
    file, de-duplicated by whichever contact they have — one customer with
    several slips only gets one reminder. Each entry carries a "channel" tag
    so the sender below knows email vs SMS without re-checking."""
    seen, out = set(), []
    async for e in lucky_draw_entries_collection.find({
        "tenant_id": tenant_id, "campaign_id": campaign_id,
        "$or": [{"email": {"$nin": ["", None]}}, {"contact_no": {"$nin": ["", None]}}],
    }):
        email = (e.get("email") or "").strip().lower()
        phone = (e.get("contact_no") or "").strip()
        key = f"email:{email}" if email else f"phone:{phone}"
        if key in seen:
            continue
        seen.add(key)
        e["_channel"] = "email" if email else "sms"
        out.append(e)
    return out


def _sms_countdown_body(campaign: dict, message: str) -> str:
    """Short SMS version — Twilio/DLT templates don't carry the richer HTML
    email body, so this is a separate, shorter line using the same message
    text the admin typed."""
    link = frontend_url("/")
    return f"{message} {link}".strip()


async def _run_reminder_send(send_id: ObjectId, tenant_id: str, campaign: dict, message: str) -> None:
    sent = failed = skipped = 0
    sent_email = sent_sms = 0
    people = await _reminder_audience(tenant_id, str(campaign["_id"]))
    subject = f"Countdown: {campaign.get('campaign_name')} draw is coming up!"
    sms_body = _sms_countdown_body(campaign, message)
    for p in people:
        ok = False
        try:
            if p["_channel"] == "email":
                ok = await send_newsletter_email(
                    p["email"], p.get("customer_name") or "", subject, message,
                    frontend_url("/"), link=campaign.get("website_link") or "",
                )
                if ok:
                    sent_email += 1
            else:
                ok = await send_sms(p["contact_no"], sms_body, context=f"lucky_draw_reminder:{campaign.get('_id')}")
                if ok:
                    sent_sms += 1
                elif not sms_configured():
                    skipped += 1
                    ok = None  # distinguish "no SMS provider" from a real send failure
        except Exception:
            ok = False
        if ok is None:
            pass  # counted as skipped above, not a failure
        else:
            sent += 1 if ok else 0
            failed += 0 if ok else 1
        await lucky_draw_reminders_collection.update_one(
            {"_id": send_id},
            {"$set": {"sent_count": sent, "failed_count": failed, "skipped_count": skipped, "sent_email_count": sent_email, "sent_sms_count": sent_sms}},
        )
        await asyncio.sleep(0.05)
    await lucky_draw_reminders_collection.update_one(
        {"_id": send_id},
        {"$set": {
            "status": "DONE", "sent_count": sent, "failed_count": failed, "skipped_count": skipped,
            "sent_email_count": sent_email, "sent_sms_count": sent_sms, "finished_at": now_utc(),
        }},
    )


@router.post("/campaigns/{campaign_id}/send-reminder")
async def send_campaign_reminder(campaign_id: str, payload: ReminderPayload, background: BackgroundTasks, ctx: Dict[str, Any] = Depends(get_tenant)):
    ctx = require_hq(require_crm_tab(ctx, "luckydraw"))
    if not ObjectId.is_valid(campaign_id):
        raise HTTPException(status_code=400, detail="Invalid campaign ID.")
    campaign = await lucky_draw_campaigns_collection.find_one({"_id": ObjectId(campaign_id), "tenant_id": ctx["tenant_id"]})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    draw_date = campaign.get("ends_on") or ""
    message = (payload.message or "").strip() or (
        f"The {campaign.get('campaign_name')} lucky draw"
        + (f" will be held on {draw_date}." if draw_date else " will be held soon.")
        + " Thank you for entering — good luck!"
    )

    test_email = clean(payload.test_email)
    if test_email:
        ok = await send_newsletter_email(
            test_email, "there", f"[Test] Countdown: {campaign.get('campaign_name')} draw is coming up!", message,
            frontend_url("/"), link=campaign.get("website_link") or "",
        )
        if not ok:
            raise HTTPException(status_code=502, detail="Test email could not be sent — check the email settings.")
        return {"test": True, "message": f"Test reminder sent to {test_email}."}

    test_phone = clean(payload.test_phone)
    if test_phone:
        if not sms_configured():
            raise HTTPException(status_code=503, detail="SMS isn't configured yet — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and a sender (TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID).")
        ok = await send_sms(test_phone, _sms_countdown_body(campaign, message), context=f"lucky_draw_reminder_test:{campaign_id}")
        if not ok:
            raise HTTPException(status_code=502, detail="Test SMS could not be sent — check the Twilio settings.")
        return {"test": True, "message": f"Test SMS sent to {test_phone}."}

    people = await _reminder_audience(ctx["tenant_id"], campaign_id)
    if not people:
        raise HTTPException(status_code=400, detail="No entrants with an email or phone number on file for this campaign yet.")
    email_count = sum(1 for p in people if p["_channel"] == "email")
    sms_count = len(people) - email_count
    doc = {
        "tenant_id": ctx["tenant_id"], "campaign_id": campaign_id, "campaign_name": campaign.get("campaign_name"),
        "message": message, "recipient_count": len(people), "sent_count": 0, "failed_count": 0, "skipped_count": 0,
        "sent_email_count": 0, "sent_sms_count": 0,
        "status": "SENDING", "sent_by_name": ctx.get("admin_name") or "", "created_at": now_utc(),
    }
    result = await lucky_draw_reminders_collection.insert_one(doc)
    background.add_task(_run_reminder_send, result.inserted_id, ctx["tenant_id"], campaign, message)
    note = (
        f"{email_count} by email, {sms_count} by SMS."
        if sms_configured()
        else f"{email_count} by email now. {sms_count} more have no email but a phone number — SMS isn't configured yet (set TWILIO_ACCOUNT_SID/AUTH_TOKEN), so they'll be skipped until it is."
    )
    return {
        "test": False, "id": str(result.inserted_id), "recipient_count": len(people),
        "email_count": email_count, "sms_count": sms_count,
        "message": f"Sending reminder to {len(people)} entrant(s).",
        "note": note,
    }


@router.get("/campaigns/{campaign_id}/reminders")
async def list_campaign_reminders(campaign_id: str, ctx: Dict[str, Any] = Depends(get_tenant)):
    ctx = require_crm_tab(ctx, "luckydraw")
    if not ObjectId.is_valid(campaign_id):
        raise HTTPException(status_code=400, detail="Invalid campaign ID.")
    rows = await lucky_draw_reminders_collection.find(
        {"tenant_id": ctx["tenant_id"], "campaign_id": campaign_id}
    ).sort("created_at", -1).to_list(50)
    return [serialize_doc(r) for r in rows]
