
"""
whatsapp_routes.py
=====================
⚠️⚠️⚠️ STUB — NOT CONNECTED TO ANYTHING REAL YET ⚠️⚠️⚠️

This is a skeleton for WhatsApp Business Platform Catalog+Cart integration,
written so the shape is ready the moment real Meta credentials exist. It
does NOT work today — there is no Meta Business Account, no WhatsApp
Business phone number, and no verify token configured anywhere. Every
remaining placeholder below is marked with "REPLACE WITH REAL" — search
for that string when you're ready to wire this up for real.

REQUIRED — add to db.py:
    vendor_whatsapp_catalogs_collection = db["vendor_whatsapp_catalogs"]
    tenant_whatsapp_numbers_collection  = db["tenant_whatsapp_numbers"]

REQUIRED before this does anything useful:
  1. A verified Meta Business Account + dedicated WhatsApp Business number
     (Cloud API direct, or via a BSP like Twilio/Gupshup/360dialog).
  2. WHATSAPP_VERIFY_TOKEN and WHATSAPP_APP_SECRET set as real environment
     variables (see verify_webhook() and _verify_signature() below).
  3. The vendor's own WhatsApp Business Catalog shared with your Meta App
     via Business Asset sharing (see the module docstring in
     catalogue_routes.py for why this is a real multi-step process the
     vendor has to complete, not a one-click toggle in your app) — THEN
     the vendor calls POST /connect-catalog below with the resulting
     catalog_id. That part IS real and working now, not a placeholder —
     what's still missing is steps 1-2 actually existing.
  4. Each retailer/tenant registers the WhatsApp number their buyers will
     message vendors from, via POST /register-number below — also real
     and working, just has nothing to receive until 1-2 exist.

Until 1-2 are done, treat the webhook handler as a napkin sketch of the
shape, not working code. Nothing in main.py should include this router
until then — including it now just adds a route that will 401 (correctly,
since _verify_signature() always fails with no real secret) or silently
do nothing.

Wire in main.py (ONLY once real credentials exist):
    from .routes.whatsapp_routes import router as whatsapp_router
    app.include_router(whatsapp_router)
"""

from fastapi import APIRouter, HTTPException, Request, Query, Header, Depends
from fastapi.responses import PlainTextResponse
from datetime import datetime
from typing import Optional
from bson import ObjectId
import hashlib
import hmac
import os
import uuid

from ..db import (
    catalogue_inquiries_collection,
    vendor_catalogue_collection,
    vendor_tenant_links_collection,
    vendor_whatsapp_catalogs_collection,   # NEW — vendor_id <-> Meta catalog_id
    tenant_whatsapp_numbers_collection,    # NEW — tenant_id <-> WhatsApp number buyers message from
)
from .deps import get_hq_tenant
from .vendor_routes import decode_token

router = APIRouter(prefix="/api/whatsapp", tags=["WhatsApp (stub — not connected)"])


# ═══════════════════════════════════════════════════════════════════════════
# 1. WEBHOOK VERIFICATION — Meta calls this once, when you register the
#    webhook URL in Meta's App Dashboard, to prove you control this server.
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/webhook")
async def verify_webhook(
    hub_mode:      str = Query(None, alias="hub.mode"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
):
    """
    Meta's required GET handshake. When you register this URL in the App
    Dashboard, Meta sends these three query params; you must echo back
    hub_challenge as plain text if hub_verify_token matches what you
    configured in the dashboard.

    REPLACE WITH REAL: set WHATSAPP_VERIFY_TOKEN to a real secret string of
    your choosing (not from Meta — you invent this one yourself) as an
    environment variable, and enter that SAME string in Meta's App
    Dashboard's webhook config screen.
    """
    expected_token = os.environ.get("WHATSAPP_VERIFY_TOKEN")
    if not expected_token:
        raise HTTPException(status_code=503, detail="WHATSAPP_VERIFY_TOKEN not configured — this integration is not active.")

    if hub_mode == "subscribe" and hub_verify_token == expected_token:
        return PlainTextResponse(hub_challenge or "")
    raise HTTPException(status_code=403, detail="Webhook verification failed.")


def _verify_signature(raw_body: bytes, signature_header: str) -> bool:
    """
    Meta signs every webhook POST with your app secret (HMAC-SHA256) in the
    X-Hub-Signature-256 header. Verifying this stops anyone who guesses
    your webhook URL from injecting fake orders. REPLACE WITH REAL:
    WHATSAPP_APP_SECRET comes from your Meta App's dashboard, NOT invented
    by you (unlike the verify token above).
    """
    app_secret = os.environ.get("WHATSAPP_APP_SECRET")
    if not app_secret or not signature_header:
        return False
    expected = "sha256=" + hmac.new(app_secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header)


# ═══════════════════════════════════════════════════════════════════════════
# 1b. CONNECTION MAPPINGS — real and working, unlike the webhook handler
#     below. These close the two "REPLACE WITH REAL" gaps that made the
#     webhook handler unable to resolve who an order belongs to. Both are
#     independent of whether Meta credentials exist yet — a vendor or
#     tenant can register their side ahead of time.
# ═══════════════════════════════════════════════════════════════════════════

def _decode_vendor(authorization: Optional[str]) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization token missing")
    decoded = decode_token(authorization.split(" ")[1])
    if not decoded:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    vendor_id = decoded.get("vendor_id")
    if not vendor_id:
        raise HTTPException(status_code=403, detail="This endpoint requires a vendor account.")
    return vendor_id


@router.post("/connect-catalog")
async def connect_vendor_catalog(payload: dict, authorization: str = Header(None)):
    """
    Vendor-facing: links their Meta WhatsApp Catalog ID to their RMS
    vendor_id. The catalog_id itself comes from Meta Commerce Manager,
    AFTER the vendor completes the Business Asset sharing flow described
    in catalogue_routes.py's module docstring — this route doesn't create
    that catalog or do the sharing for them, it only records the mapping
    once they have it.

    One catalog_id maps to exactly one vendor_id — enforced with a unique
    index recommendation (see db.py note in the module docstring). If a
    vendor re-submits a different catalog_id, this overwrites their
    previous mapping rather than creating a second one.
    """
    vendor_id = _decode_vendor(authorization)
    catalog_id = (payload.get("catalog_id") or "").strip()
    if not catalog_id:
        raise HTTPException(status_code=400, detail="catalog_id is required.")

    existing_owner = await vendor_whatsapp_catalogs_collection.find_one({
        "catalog_id": catalog_id, "vendor_id": {"$ne": ObjectId(vendor_id)}
    })
    if existing_owner:
        raise HTTPException(status_code=409, detail="This catalog_id is already connected to a different vendor account.")

    await vendor_whatsapp_catalogs_collection.update_one(
        {"vendor_id": ObjectId(vendor_id)},
        {"$set": {"catalog_id": catalog_id, "connected_at": datetime.utcnow()}},
        upsert=True,
    )
    return {"status": "success", "message": "WhatsApp catalog connected.", "catalog_id": catalog_id}


@router.get("/my-catalog-connection")
async def get_my_catalog_connection(authorization: str = Header(None)):
    """Vendor-facing: check whether/what they've connected."""
    vendor_id = _decode_vendor(authorization)
    doc = await vendor_whatsapp_catalogs_collection.find_one({"vendor_id": ObjectId(vendor_id)})
    if not doc:
        return {"status": "success", "connected": False}
    return {"status": "success", "connected": True, "catalog_id": doc["catalog_id"], "connected_at": str(doc.get("connected_at", ""))}


@router.post("/register-number")
async def register_tenant_whatsapp_number(payload: dict, ctx: dict = Depends(get_hq_tenant)):
    """
    HQ-facing: registers a WhatsApp number this retailer's buyers message
    vendors from. This is how an incoming order gets tied back to a
    tenant — Meta's webhook payload includes the buyer's WhatsApp number
    in the "from" field, and this mapping is what turns that number into
    a tenant_id.

    ⚠️ FIXED: this previously used update_one({"tenant_id": ...}, upsert)
    keyed ONLY on tenant_id — meaning registering a second number silently
    overwrote the first, with no error and no warning. A retailer that
    genuinely negotiates through several different WhatsApp numbers (one
    per vendor relationship, or one per purchasing agent — a real case
    described directly) could never have more than one registered at a
    time. Now inserts a new document per number instead of upserting one
    per tenant — a tenant can register as many numbers as they actually
    use. Each individual number still maps to exactly one tenant (a
    number can't represent two different retailers at once), enforced by
    the same-number-different-tenant check below.
    """
    phone_number = (payload.get("phone_number") or "").strip()
    label        = (payload.get("label") or "").strip()
    if not phone_number:
        raise HTTPException(status_code=400, detail="phone_number is required.")

    existing = await tenant_whatsapp_numbers_collection.find_one({"phone_number": phone_number})
    if existing and existing["tenant_id"] != ctx["tenant_id"]:
        raise HTTPException(status_code=409, detail="This number is already registered to a different retailer.")
    if existing and existing["tenant_id"] == ctx["tenant_id"]:
        raise HTTPException(status_code=400, detail="This number is already registered to your account.")

    doc = {
        "tenant_id":     ctx["tenant_id"],
        "phone_number":  phone_number,
        "label":         label,  # optional, e.g. "Fabric vendors" or the buyer's name
        "registered_at": datetime.utcnow(),
    }
    result = await tenant_whatsapp_numbers_collection.insert_one(doc)
    return {"status": "success", "message": "WhatsApp number registered.", "id": str(result.inserted_id), "phone_number": phone_number}


@router.get("/my-numbers")
async def list_my_whatsapp_numbers(ctx: dict = Depends(get_hq_tenant)):
    """HQ-facing: lists every WhatsApp number registered to this tenant."""
    rows = []
    async for doc in tenant_whatsapp_numbers_collection.find({"tenant_id": ctx["tenant_id"]}).sort("registered_at", -1):
        rows.append({
            "id":            str(doc["_id"]),
            "phone_number":  doc["phone_number"],
            "label":         doc.get("label", ""),
            "registered_at": str(doc.get("registered_at", "")),
        })
    return {"status": "success", "data": rows}


@router.delete("/numbers/{number_id}")
async def delete_whatsapp_number(number_id: str, ctx: dict = Depends(get_hq_tenant)):
    """HQ-facing: removes one registered number. Tenant-scoped — can't delete another tenant's number even by guessing an ID."""
    if not ObjectId.is_valid(number_id):
        raise HTTPException(status_code=400, detail="Invalid ID.")
    result = await tenant_whatsapp_numbers_collection.delete_one({
        "_id": ObjectId(number_id), "tenant_id": ctx["tenant_id"],
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Number not found.")
    return {"status": "success", "message": "Number removed."}


async def resolve_vendor_from_catalog(catalog_id: str) -> Optional[ObjectId]:
    """Real resolver — replaces the old `vendor_id = None` placeholder."""
    doc = await vendor_whatsapp_catalogs_collection.find_one({"catalog_id": catalog_id})
    return doc["vendor_id"] if doc else None


async def resolve_tenant_from_number(phone_number: str) -> Optional[str]:
    """Real resolver — replaces the old `tenant_id = None` placeholder."""
    doc = await tenant_whatsapp_numbers_collection.find_one({"phone_number": phone_number})
    return doc["tenant_id"] if doc else None


# ═══════════════════════════════════════════════════════════════════════════
# 2. INCOMING WEBHOOK — Meta POSTs here for every message/order/status
#    update on your WhatsApp Business number, once connected.
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/webhook")
async def receive_webhook(request: Request):
    """
    Receives WhatsApp Cloud API webhook events. The payload shape below
    (order.product_items etc.) is Meta's documented format for a "cart"
    order message as of their current API — REPLACE WITH REAL once you
    have live traffic to confirm the exact shape hasn't shifted; Meta does
    version their webhook payloads.

    This function deliberately does the MINIMUM to turn a WhatsApp cart
    into a catalogue_inquiries_collection document — everything downstream
    (vendor responds, buyer converts to PO) reuses the exact same pipeline
    that in-app inquiries already go through in catalogue_routes.py. A
    WhatsApp order becomes just another way to CREATE an inquiry, not a
    shortcut around the negotiation/PO-safety gate.
    """
    raw_body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256", "")

    if not _verify_signature(raw_body, signature):
        # REPLACE WITH REAL: once WHATSAPP_APP_SECRET is actually set,
        # this correctly rejects unsigned/forged requests. Until then,
        # _verify_signature() always returns False, so this stub always
        # 401s — that's intentional, not a bug: don't process anything
        # from an unconfigured, unverified endpoint.
        raise HTTPException(status_code=401, detail="Invalid webhook signature (or WhatsApp integration not configured).")

    payload = await request.json()

    try:
        entry   = payload["entry"][0]
        change  = entry["changes"][0]
        value   = change["value"]
        message = value["messages"][0]
    except (KeyError, IndexError):
        # Not every webhook call is an order — status updates, read
        # receipts, etc. also land here. Silently acknowledge those.
        return {"status": "ignored"}

    if message.get("type") != "order":
        return {"status": "ignored", "reason": "not an order message"}

    order        = message["order"]
    catalog_id   = order.get("catalog_id")
    product_items = order.get("product_items", [])
    from_number  = message.get("from", "")

    # ✅ REAL NOW — resolves via connect_vendor_catalog() and
    # register_tenant_whatsapp_number() above, instead of the old
    # hardcoded None placeholders. Still requires BOTH the vendor and the
    # tenant to have actually registered their side (see the module
    # docstring) — an order from an unregistered pairing correctly comes
    # back unresolved rather than guessing.
    vendor_id = await resolve_vendor_from_catalog(catalog_id)
    tenant_id = await resolve_tenant_from_number(from_number)

    if not vendor_id or not tenant_id:
        # Can't safely file this anywhere without knowing whose it is.
        # In a real implementation, log this for manual reconciliation
        # rather than silently dropping it.
        return {
            "status": "unresolved",
            "reason": "catalog_id or from_number not registered",
            "vendor_resolved": bool(vendor_id),
            "tenant_resolved": bool(tenant_id),
        }

    # Same ownership check every other inquiry-creation path in this app
    # already enforces (create_inquiry, create_comparison_inquiries) — a
    # resolved tenant number and a resolved vendor catalog don't
    # automatically mean that tenant is allowed to inquire with that
    # vendor; they still need an Approved link, same as the in-app flow.
    approved_link = await vendor_tenant_links_collection.find_one({
        "vendor_id": vendor_id, "tenant_id": tenant_id, "status": "Approved",
    })
    if not approved_link:
        return {"status": "unresolved", "reason": "no approved relationship between this vendor and tenant"}

    created_ids = []
    for item in product_items:
        catalogue_item = await vendor_catalogue_collection.find_one({
            # ⚠️ STILL A PLACEHOLDER — this only narrows to "some catalogue
            # item this vendor owns," not the SPECIFIC item the buyer
            # picked in their WhatsApp cart. Meta's product_items entries
            # carry a `product_retailer_id` that needs to map to a
            # specific vendor_catalogue_collection document — that
            # per-product mapping isn't built yet (it depends on how/
            # whether you sync catalogues to Meta at all, see
            # catalogue_routes.py's module docstring on that being a
            # separate, heavier integration). Until then, if a vendor has
            # more than one active catalogue item, this will pick
            # whichever one Mongo returns first — REPLACE WITH REAL by
            # storing Meta's retailer_id on vendor_catalogue_collection
            # items once catalogue sync exists, and matching on that here.
            "vendor_id": vendor_id,
            "active": True,
        })
        if not catalogue_item:
            continue

        doc = {
            "catalogue_item_id":  catalogue_item["_id"],
            "vendor_id":          catalogue_item["vendor_id"],
            "tenant_id":          tenant_id,
            "item_name":          catalogue_item.get("item_name", ""),
            "item_image":         (catalogue_item.get("images") or [None])[0],
            "requested_size":     "",   # WhatsApp cart items don't carry size/color natively — REPLACE WITH REAL once you decide how buyers specify this (a follow-up text message? a WhatsApp Flow form?)
            "requested_color":    "",
            "requested_qty":      int(item.get("quantity", 0)),
            "requested_price":    float(item.get("item_price", 0)),
            "buyer_note":         f"Via WhatsApp from {from_number}",
            "status":             "Pending",
            "source":             "whatsapp",   # distinguishes from in-app inquiries in reporting
            "whatsapp_from":      from_number,
            "created_by":         None,
            "created_at":         datetime.utcnow(),
            "vendor_response":    None,
        }
        result = await catalogue_inquiries_collection.insert_one(doc)
        created_ids.append(str(result.inserted_id))

    return {"status": "success", "created_inquiry_ids": created_ids}