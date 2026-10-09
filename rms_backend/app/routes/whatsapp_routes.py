
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
  5. ✅ DONE — each catalogue item that should be orderable over WhatsApp
     needs its Meta product_retailer_id recorded via PATCH
     /api/catalogue/my-catalogue/{item_id} ({"whatsapp_retailer_id": "..."}).
     The webhook below now matches incoming order lines on vendor_id +
     whatsapp_retailer_id instead of guessing "any active item from this
     vendor" — an item with no retailer_id set, or a line with no match,
     is reported back as unresolved rather than silently misattributed.
  6. Still undecided: WhatsApp cart items carry no size/color, so
     requested_size/requested_color are always blank on a WhatsApp-sourced
     inquiry. Decide the follow-up mechanism (manual text, or a WhatsApp
     Flow) before relying on this for anything size/color-sensitive.

Until 1-2 are done, treat the webhook handler as a napkin sketch of the
shape, not working code.

✅ WIRED IN — this router IS included in main.py now, deliberately, even
though 1-2 don't exist yet. That's safe: GET /webhook 503s until
WHATSAPP_VERIFY_TOKEN is set, POST /webhook always 401s until
WHATSAPP_APP_SECRET is set. What wiring it in actually enables is the
number/catalog registration endpoints (/connect-catalog, /register-number,
/my-numbers, /numbers/{id}) — those are real, working, auth-gated
endpoints with no dependency on Meta credentials, used to get a retailer's
WhatsApp settings screen ready ahead of time so there's nothing left to
configure the moment real credentials show up.
"""

from fastapi import APIRouter, HTTPException, Request, Query, Header, Depends
from fastapi.responses import PlainTextResponse
from datetime import datetime
from typing import Optional
from bson import ObjectId
import hashlib
import hmac
import os
import secrets
import uuid

from ..db import (
    catalogue_inquiries_collection,
    vendor_catalogue_collection,
    vendor_tenant_links_collection,
    vendor_whatsapp_catalogs_collection,   # NEW — vendor_id <-> Meta catalog_id
    tenant_whatsapp_numbers_collection,    # NEW — tenant_id <-> WhatsApp number buyers message from
    vendor_integration_keys_collection,    # NEW — vendor_id <-> hashed API key, for the generic (non-Meta) order push path
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


async def _create_inquiry_for_catalogue_item(
    catalogue_item: dict, tenant_id: str, qty: float, price: float, from_number: str, source: str, note: str = "",
) -> dict:
    """The actual insert, once a specific catalogue item has already been
    resolved. Shared by every WhatsApp-order path (Meta webhook, generic
    API-key push, and manual entry below) so they all land in the exact
    same catalogue_inquiries_collection pipeline and stay consistent.
    """
    doc = {
        "catalogue_item_id":  catalogue_item["_id"],
        "vendor_id":          catalogue_item["vendor_id"],
        "tenant_id":          tenant_id,
        "item_name":          catalogue_item.get("item_name", ""),
        "item_image":         (catalogue_item.get("images") or [None])[0],
        "requested_size":     "",   # none of these paths carry size/color yet — see module docstring point 6
        "requested_color":    "",
        "requested_qty":      int(qty or 0),
        "requested_price":    float(price or 0),
        "buyer_note":         note.strip() if note else f"Via WhatsApp from {from_number}",
        "status":             "Pending",
        "source":             source,
        "whatsapp_from":      from_number,
        "created_by":         None,
        "created_at":         datetime.utcnow(),
        "vendor_response":    None,
    }
    result = await catalogue_inquiries_collection.insert_one(doc)
    return {"ok": True, "inquiry_id": str(result.inserted_id)}


async def _create_inquiry_from_order_line(
    vendor_id: ObjectId, tenant_id: str, retailer_id: str, qty: float, price: float,
    from_number: str, source: str,
) -> dict:
    """Resolves a catalogue item by its whatsapp_retailer_id (the Meta
    webhook and generic API-key push both identify items this way, since
    neither has a human present to pick from a dropdown) then delegates to
    _create_inquiry_for_catalogue_item(). Returns
    {"ok": True, "inquiry_id": "..."} or {"ok": False, "reason": "..."}.
    """
    retailer_id = str(retailer_id or "").strip()
    if not retailer_id:
        return {"ok": False, "reason": "no retailer_id on item"}
    catalogue_item = await vendor_catalogue_collection.find_one({
        "vendor_id": vendor_id, "whatsapp_retailer_id": retailer_id, "active": True,
    })
    if not catalogue_item:
        return {"ok": False, "reason": "no catalogue item mapped to this retailer_id"}
    return await _create_inquiry_for_catalogue_item(catalogue_item, tenant_id, qty, price, from_number, source)


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
    unresolved_items = []
    for item in product_items:
        # ✅ REAL NOW — matches on Meta's product_retailer_id, which the
        # vendor records against the exact catalogue item via PATCH
        # /api/catalogue/my-catalogue/{item_id} (whatsapp_retailer_id field)
        # once they've synced that item to their Meta Commerce Manager
        # catalog. No retailer_id on the incoming line, or no matching item
        # found, means it's correctly skipped rather than guessed.
        retailer_id = str(item.get("product_retailer_id") or "").strip()
        result = await _create_inquiry_from_order_line(
            vendor_id, tenant_id, retailer_id, item.get("quantity", 0), item.get("item_price", 0), from_number, "whatsapp",
        )
        if result["ok"]:
            created_ids.append(result["inquiry_id"])
        else:
            unresolved_items.append({"product_retailer_id": retailer_id or None, "reason": result["reason"]})

    return {"status": "success", "created_inquiry_ids": created_ids, "unresolved_items": unresolved_items}


# ═══════════════════════════════════════════════════════════════════════════
# 3. GENERIC ORDER PUSH — for a vendor who does NOT connect directly to
#    Meta's raw Cloud API. Most real vendors manage WhatsApp Business through
#    a BSP (Interakt, WATI, Gupshup, Twilio, ...) or their own system — each
#    has its own webhook/API shape, not Meta's exact format the handler
#    above parses. This endpoint sidesteps that entirely: a vendor-specific
#    API key (never Meta credentials) authenticates the call, and the
#    payload is RMS's own simple shape, not Meta's. Whatever tool the vendor
#    actually uses just needs to make ONE outbound call here — a Zapier/Make
#    automation, a tiny script, or code in their own backend all work.
#
#    Downstream is identical to the Meta webhook — same
#    _create_inquiry_from_order_line() helper, same Approved-link gate, same
#    catalogue_inquiries_collection pipeline. Only the "how do we know who's
#    calling" step differs (API key here vs HMAC signature for Meta).
# ═══════════════════════════════════════════════════════════════════════════

def _hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


@router.post("/integration/api-key")
async def generate_integration_api_key(authorization: str = Header(None)):
    """
    Vendor-facing: issues a new API key for the generic order-push endpoint
    below. Generating a new one invalidates any previous key immediately —
    there is only ever one active key per vendor, kept simple on purpose.
    The raw key is returned exactly once, here; only its hash is stored, so
    it can never be shown again — if lost, the vendor generates a new one.
    """
    vendor_id = _decode_vendor(authorization)
    raw_key = "rmswh_" + secrets.token_urlsafe(32)
    await vendor_integration_keys_collection.update_one(
        {"vendor_id": ObjectId(vendor_id)},
        {"$set": {"key_hash": _hash_api_key(raw_key), "created_at": datetime.utcnow()}, "$unset": {"last_used_at": ""}},
        upsert=True,
    )
    return {
        "status": "success",
        "api_key": raw_key,
        "message": "Save this key now — it will not be shown again. Generating a new key immediately disables this one.",
    }


@router.get("/integration/api-key/status")
async def get_integration_api_key_status(authorization: str = Header(None)):
    """Vendor-facing: whether a key exists and when it was last used — never the raw key itself."""
    vendor_id = _decode_vendor(authorization)
    doc = await vendor_integration_keys_collection.find_one({"vendor_id": ObjectId(vendor_id)})
    if not doc:
        return {"status": "success", "has_key": False}
    return {
        "status": "success", "has_key": True,
        "created_at": str(doc.get("created_at", "")),
        "last_used_at": str(doc.get("last_used_at", "")) if doc.get("last_used_at") else None,
    }


@router.delete("/integration/api-key")
async def revoke_integration_api_key(authorization: str = Header(None)):
    """Vendor-facing: revokes the key immediately — the order-push endpoint will reject it afterwards."""
    vendor_id = _decode_vendor(authorization)
    await vendor_integration_keys_collection.delete_one({"vendor_id": ObjectId(vendor_id)})
    return {"status": "success", "message": "API key revoked."}


async def _resolve_vendor_from_api_key(api_key: Optional[str]) -> ObjectId:
    if not api_key:
        raise HTTPException(status_code=401, detail="X-API-Key header is required.")
    doc = await vendor_integration_keys_collection.find_one({"key_hash": _hash_api_key(api_key)})
    if not doc:
        raise HTTPException(status_code=401, detail="Invalid or revoked API key.")
    await vendor_integration_keys_collection.update_one({"_id": doc["_id"]}, {"$set": {"last_used_at": datetime.utcnow()}})
    return doc["vendor_id"]


@router.post("/integration/order")
async def push_order_via_integration(payload: dict, x_api_key: str = Header(None, alias="X-API-Key")):
    """
    The generic, BSP-agnostic order-push endpoint. The vendor's own system
    (or their BSP's outgoing webhook/automation) calls this directly —
    nothing here depends on Meta's webhook format at all.

    Expected payload:
        {
          "from_number": "919876543210",      # the BUYER's WhatsApp number — used to resolve which
                                                # retailer this order belongs to, via the numbers that
                                                # retailer registered in Settings -> WhatsApp
          "whatsapp_retailer_id": "SHIRT-001", # must match an item the VENDOR set via
                                                # PATCH /api/catalogue/my-catalogue/{id}
          "quantity": 3,
          "price": 499.0,                      # optional — falls back to the catalogue item's price if omitted
          "note": "..."                        # optional, free text
        }
    Same safety rules as the Meta path: both the buyer's number and the
    retailer_id must already be registered/mapped, and there must be an
    Approved vendor<->retailer relationship — an order that fails any of
    these is reported back clearly, never silently guessed or dropped.
    """
    vendor_id = await _resolve_vendor_from_api_key(x_api_key)

    from_number = str(payload.get("from_number") or "").strip()
    retailer_id = str(payload.get("whatsapp_retailer_id") or "").strip()
    if not from_number:
        raise HTTPException(status_code=400, detail="from_number is required.")
    if not retailer_id:
        raise HTTPException(status_code=400, detail="whatsapp_retailer_id is required.")

    tenant_id = await resolve_tenant_from_number(from_number)
    if not tenant_id:
        return {"status": "unresolved", "reason": "from_number is not registered to any retailer (Settings -> WhatsApp)."}

    approved_link = await vendor_tenant_links_collection.find_one({
        "vendor_id": vendor_id, "tenant_id": tenant_id, "status": "Approved",
    })
    if not approved_link:
        return {"status": "unresolved", "reason": "no approved relationship between this vendor and tenant"}

    price = payload.get("price")
    if price in (None, ""):
        item = await vendor_catalogue_collection.find_one({"vendor_id": vendor_id, "whatsapp_retailer_id": retailer_id, "active": True})
        price = item.get("price", 0) if item else 0

    result = await _create_inquiry_from_order_line(
        vendor_id, tenant_id, retailer_id, payload.get("quantity", 0), price, from_number, "vendor_integration",
    )
    if not result["ok"]:
        return {"status": "unresolved", "reason": result["reason"]}
    return {"status": "success", "inquiry_id": result["inquiry_id"]}


# ═══════════════════════════════════════════════════════════════════════════
# 4. MANUAL ENTRY — for a vendor with no developer AND no automation tool
#    (Zapier/Make etc.) to wire up either of the two paths above. They just
#    read the WhatsApp message themselves and log it here, logged in with
#    their normal RMS account — no API key, no Meta, no external system.
#    Picks the item from the VENDOR'S OWN catalogue by _id (a dropdown in
#    the UI), so unlike the two paths above, no whatsapp_retailer_id is
#    needed here at all.
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/integration/manual-order")
async def log_whatsapp_order_manually(payload: dict, authorization: str = Header(None)):
    """
    Vendor-facing, authenticated the normal way (their RMS login, not an
    API key). Same downstream safety rules as every other WhatsApp-order
    path: the buyer's number must already be registered by a retailer, and
    that retailer must have an Approved relationship with this vendor —
    an order that fails either check comes back as a clear reason, not a
    silently created inquiry.
    """
    vendor_id = ObjectId(_decode_vendor(authorization))

    from_number = str(payload.get("from_number") or "").strip()
    item_id = str(payload.get("catalogue_item_id") or "").strip()
    if not from_number:
        raise HTTPException(status_code=400, detail="from_number is required.")
    if not item_id or not ObjectId.is_valid(item_id):
        raise HTTPException(status_code=400, detail="A valid catalogue_item_id is required.")

    catalogue_item = await vendor_catalogue_collection.find_one({"_id": ObjectId(item_id), "vendor_id": vendor_id, "active": True})
    if not catalogue_item:
        raise HTTPException(status_code=404, detail="Catalogue item not found in your own catalogue.")

    tenant_id = await resolve_tenant_from_number(from_number)
    if not tenant_id:
        return {"status": "unresolved", "reason": "from_number is not registered to any retailer (Settings -> WhatsApp)."}

    approved_link = await vendor_tenant_links_collection.find_one({
        "vendor_id": vendor_id, "tenant_id": tenant_id, "status": "Approved",
    })
    if not approved_link:
        return {"status": "unresolved", "reason": "no approved relationship between this vendor and tenant"}

    price = payload.get("price")
    if price in (None, ""):
        price = catalogue_item.get("price", 0)

    result = await _create_inquiry_for_catalogue_item(
        catalogue_item, tenant_id, payload.get("quantity", 0), price, from_number, "vendor_manual_whatsapp",
        note=payload.get("note", ""),
    )
    return {"status": "success", "inquiry_id": result["inquiry_id"]}