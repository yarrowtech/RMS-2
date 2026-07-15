
from fastapi import APIRouter, HTTPException, status, BackgroundTasks, Depends, Header, Request
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from contextvars import ContextVar
from bson import ObjectId
from app.db import (
    purchase_invoice_collection,
    grn_collection,
    grc_collection,
    purchaseorders_collection,
    vendors_collection,
    finance_vouchers_collection,
)

from .deps import get_tenant
from .vendor_routes import decode_token

_invoice_scope: ContextVar[dict] = ContextVar("purchase_invoice_scope", default={})
_raw_purchase_invoice_collection = purchase_invoice_collection

async def bind_invoice_scope(request: Request, authorization: str = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization token missing")
    token = authorization.split(" ", 1)[1]

    if request.url.path.startswith("/purchase-invoices/vendor/"):
        payload = decode_token(token)
        vendor_id = (payload or {}).get("vendor_id")
        if not vendor_id or not ObjectId.is_valid(vendor_id):
            raise HTTPException(status_code=401, detail="Invalid or expired vendor token")
        vendor = await vendors_collection.find_one({"_id": ObjectId(vendor_id)})
        if not vendor:
            raise HTTPException(status_code=401, detail="Vendor account not found")
        scope = {"kind": "vendor", "vendor_id": vendor_id}
    else:
        ctx = await get_tenant(token)
        scope = {"kind": "admin", "tenant_id": ctx["tenant_id"], "store_id": ctx.get("store_id")}

    _invoice_scope.set(scope)
    return scope

class TenantScopedInvoiceCollection:
    def __init__(self, collection):
        self._collection = collection

    def _query(self, query=None):
        scoped = dict(query or {})
        scope = _invoice_scope.get()
        if scope.get("kind") == "vendor":
            scoped["vendor_id"] = scope["vendor_id"]
        elif scope.get("tenant_id"):
            scoped["tenant_id"] = scope["tenant_id"]
        else:
            raise RuntimeError("Purchase invoice scope is not initialized")
        return scoped

    async def find_one(self, query=None, *args, **kwargs):
        return await self._collection.find_one(self._query(query), *args, **kwargs)

    def find(self, query=None, *args, **kwargs):
        return self._collection.find(self._query(query), *args, **kwargs)

    async def insert_one(self, document, *args, **kwargs):
        scope = _invoice_scope.get()
        document["tenant_id"] = scope.get("tenant_id")
        document["store_id"] = scope.get("store_id")
        return await self._collection.insert_one(document, *args, **kwargs)

    async def update_one(self, query, update, *args, **kwargs):
        return await self._collection.update_one(self._query(query), update, *args, **kwargs)

    async def delete_one(self, query, *args, **kwargs):
        return await self._collection.delete_one(self._query(query), *args, **kwargs)

    def __getattr__(self, name):
        return getattr(self._collection, name)

purchase_invoice_collection = TenantScopedInvoiceCollection(_raw_purchase_invoice_collection)
router = APIRouter(
    prefix="/purchase-invoices",
    tags=["Purchase Invoice"],
    dependencies=[Depends(bind_invoice_scope)],
)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def objid(v):
    return str(v) if isinstance(v, ObjectId) else v


def safe_float(v, default: float = 0.0) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


# ─────────────────────────────────────────────────────────────────────────────
# Constants — payment & terms
# ─────────────────────────────────────────────────────────────────────────────

PAYMENT_MODES = {
    "NEFT", "RTGS", "Cash", "Cheque", "PostDatedCheque", "UPI", "DD",
    "Advance", "Net30", "Net45", "Net60", "CreditNote", "Other",
}

PAYMENT_TERMS_DAYS: Dict[str, int] = {
    "Net30": 30, "Net45": 45, "Net60": 60,
    "Immediate": 0, "Advance": 0, "Net15": 15, "Net90": 90,
}

VALID_STATUSES = {
    "Draft", "Submitted", "UnderReview",
    "OnHold", "Approved", "PartiallyPaid", "Paid", "Cancelled",
}


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic Models
# ─────────────────────────────────────────────────────────────────────────────

class InvoiceItemModel(BaseModel):
    barcode:        str   = ""
    description:    str   = ""
    grnQty:         float = 0
    invoicedQty:    float = 0
    rate:           float = 0
    poRate:         float = 0
    taxPct:         float = 0
    discountPct:    float = 0
    taxAmount:      float = 0
    discountAmount: float = 0
    lineAmount:     float = 0
    varianceFlag:   str   = ""
    remarks:        str   = ""


class ThreeWayMatchResult(BaseModel):
    matched:         bool  = False
    po_match:        bool  = False
    grn_match:       bool  = False
    rate_match:      bool  = False
    variance_amount: float = 0.0
    notes:           str   = ""


class PaymentScheduleEntry(BaseModel):
    dueDate:     str
    amount:      float
    paymentMode: str = "NEFT"
    notes:       str = ""
    status:      str = "Pending"


class PurchaseInvoiceModel(BaseModel):
    id:               Optional[str]               = None
    invoiceNo:        Optional[str]               = None

    # "po_linked"  = PO → GRC → GRN → Invoice
    # "direct_grc" = Direct GRC → GRN → Invoice (grcNo required, poNo empty)
    invoiceType:      Optional[str]               = "po_linked"

    vendorInvoiceNo:  str
    invoiceDate:      str
    dueDate:          Optional[str]               = ""
    receivedDate:     Optional[str]               = ""

    poNo:             Optional[str]               = ""
    po_id:            Optional[str]               = None
    grnNos:           List[str]                   = []
    grn_ids:          List[str]                   = []
    grcNos:           List[str]                   = []
    grc_ids:          List[str]                   = []

    directGrcNo:      Optional[str]               = ""
    directGrc_id:     Optional[str]               = None

    vendorName:       Optional[str]               = ""
    vendor_id:        Optional[str]               = None

    # ── Non-registered vendor contact (direct GRC path) ──────────────────────
    # Filled automatically from GRC; AP team can override before notifying.
    vendorEmail:      Optional[str]               = ""
    vendorPhone:      Optional[str]               = ""
    vendorAddress:    Optional[str]               = ""
    isRegisteredVendor: Optional[bool]            = False

    subtotal:         Optional[float]             = 0.0
    totalTax:         Optional[float]             = 0.0
    totalDiscount:    Optional[float]             = 0.0
    freightCharges:   Optional[float]             = 0.0
    otherCharges:     Optional[float]             = 0.0
    roundOff:         Optional[float]             = 0.0
    invoiceTotal:     Optional[float]             = 0.0
    paidAmount:       Optional[float]             = 0.0
    balanceDue:       Optional[float]             = 0.0
    advanceAdjusted:  Optional[float]             = 0.0

    paymentTerms:     Optional[str]               = ""
    paymentMode:      Optional[str]               = "NEFT"
    bankName:         Optional[str]               = ""
    accountNo:        Optional[str]               = ""
    ifscCode:         Optional[str]               = ""
    chequeNo:         Optional[str]               = ""
    chequeDate:       Optional[str]               = ""
    upiId:            Optional[str]               = ""
    ddNo:             Optional[str]               = ""

    paymentSchedule:  List[PaymentScheduleEntry]  = []
    threeWayMatch:    Optional[ThreeWayMatchResult] = None

    status:           Optional[str]               = "Draft"
    paymentStatus:    Optional[str]               = "Unpaid"
    holdReason:       Optional[str]               = ""
    rejectionReason:  Optional[str]               = ""
    approvalNote:     Optional[str]               = ""
    narration:        Optional[str]               = ""

    vendorNotified:         Optional[bool]        = False
    vendorNotifiedAt:       Optional[str]         = ""
    vendorAcknowledged:     Optional[bool]        = False
    vendorAcknowledgedAt:   Optional[str]         = ""

    items:            List[InvoiceItemModel]      = []

    createdAt:        Optional[datetime]          = Field(default_factory=datetime.utcnow)
    updatedAt:        Optional[datetime]          = Field(default_factory=datetime.utcnow)


class PaymentModel(BaseModel):
    amount:        float
    paymentDate:   str
    paymentMode:   str   = "NEFT"
    referenceNo:   str   = ""
    bankName:      str   = ""
    accountNo:     str   = ""
    ifscCode:      str   = ""
    chequeNo:      str   = ""
    chequeDate:    str   = ""
    upiId:         str   = ""
    ddNo:          str   = ""
    remarks:       str   = ""
    isAdvance:     bool  = False
    scheduleId:    str   = ""


class VendorQueryModel(BaseModel):
    subject:     str
    description: str
    queryType:   str = "General"


class VendorQueryReplyModel(BaseModel):
    reply: str


class ManualNotifyModel(BaseModel):
    """Used by AP team to manually send notification to a non-registered vendor."""
    channel:   str   = "email"       # "email" | "sms" | "whatsapp"
    to:        str                   # email address or phone number
    subject:   str   = ""
    message:   str   = ""
    senderName: str  = "Accounts Payable"


class VendorContactPatchModel(BaseModel):
    """Patch contact details on a direct-GRC invoice for non-registered vendors."""
    vendorEmail:   Optional[str] = ""
    vendorPhone:   Optional[str] = ""
    vendorAddress: Optional[str] = ""


# ─────────────────────────────────────────────────────────────────────────────
# Invoice Number Generator
# ─────────────────────────────────────────────────────────────────────────────

async def generate_invoice_number() -> str:
    today = datetime.now()
    year, month = today.year, today.month
    fy_start, fy_end = (year, year + 1) if month >= 4 else (year - 1, year)
    fy_code = f"{str(fy_start)[-2:]}-{str(fy_end)[-2:]}"

    last = await purchase_invoice_collection.find_one(
        {"invoiceNo": {"$regex": f"PI[/|-]\\d+/{fy_code}$"}},
        sort=[("_id", -1)]
    )
    last_num = 0
    if last and "invoiceNo" in last:
        try:
            last_num = int(last["invoiceNo"].split("/")[1])
        except Exception:
            pass
    return f"PI/{str(last_num + 1).zfill(8)}/{fy_code}"


# ─────────────────────────────────────────────────────────────────────────────
# Due-date calculator
# ─────────────────────────────────────────────────────────────────────────────

def compute_due_date(invoice_date: str, payment_terms: str) -> str:
    days = PAYMENT_TERMS_DAYS.get(payment_terms, 30)
    try:
        base = datetime.strptime(invoice_date, "%Y-%m-%d")
        return (base + timedelta(days=days)).strftime("%Y-%m-%d")
    except Exception:
        return invoice_date


# ─────────────────────────────────────────────────────────────────────────────
# Computation
# ─────────────────────────────────────────────────────────────────────────────

def compute_invoice_totals(inv_dict: dict):
    subtotal = tax_total = discount_total = 0.0

    for item in inv_dict.get("items", []):
        qty      = max(0.0, safe_float(item.get("invoicedQty")))
        rate     = max(0.0, safe_float(item.get("rate")))
        tax_pct  = max(0.0, safe_float(item.get("taxPct")))
        disc_pct = max(0.0, safe_float(item.get("discountPct")))

        gross    = qty * rate
        discount = gross * (disc_pct / 100)
        taxable  = gross - discount
        tax      = taxable * (tax_pct / 100)
        line_amt = taxable + tax

        item["discountAmount"] = round(discount, 2)
        item["taxAmount"]      = round(tax, 2)
        item["lineAmount"]     = round(line_amt, 2)

        po_rate  = safe_float(item.get("poRate"))
        grn_qty  = safe_float(item.get("grnQty"))
        rate_ok  = abs(rate - po_rate) < 0.01 if po_rate > 0 else True
        qty_ok   = abs(qty - grn_qty) < 0.001  if grn_qty > 0 else True

        if not rate_ok and not qty_ok:
            item["varianceFlag"] = "Rate & Qty mismatch"
        elif not rate_ok:
            item["varianceFlag"] = "Rate mismatch"
        elif not qty_ok:
            item["varianceFlag"] = "Qty mismatch"
        else:
            item["varianceFlag"] = ""

        subtotal       += gross
        tax_total      += tax
        discount_total += discount

    freight   = safe_float(inv_dict.get("freightCharges"))
    other     = safe_float(inv_dict.get("otherCharges"))
    round_off = safe_float(inv_dict.get("roundOff"))
    paid      = safe_float(inv_dict.get("paidAmount"))
    advance   = safe_float(inv_dict.get("advanceAdjusted"))

    net = subtotal - discount_total + tax_total + freight + other + round_off - advance

    inv_dict["subtotal"]      = round(subtotal, 2)
    inv_dict["totalTax"]      = round(tax_total, 2)
    inv_dict["totalDiscount"] = round(discount_total, 2)
    inv_dict["invoiceTotal"]  = round(net, 2)
    inv_dict["balanceDue"]    = round(max(0.0, net - paid), 2)


# ─────────────────────────────────────────────────────────────────────────────
# Three-way match
# ─────────────────────────────────────────────────────────────────────────────

def run_three_way_match(inv_dict: dict, po: dict | None, grns: list) -> dict:
    grn_qty_map: Dict[str, float] = {}
    for grn in grns:
        for it in grn.get("items", []):
            bc = (it.get("barcode") or "").strip()
            grn_qty_map[bc] = grn_qty_map.get(bc, 0) + safe_float(it.get("inwardQty"))

    po_rate_map: Dict[str, float] = {}
    if po:
        for it in po.get("items", []):
            bc = (it.get("barcode") or "").strip()
            po_rate_map[bc] = safe_float(it.get("rate"))

    grn_match  = True
    rate_match = True
    notes      = []

    for item in inv_dict.get("items", []):
        bc          = (item.get("barcode") or "").strip()
        inv_qty     = safe_float(item.get("invoicedQty"))
        inv_rate    = safe_float(item.get("rate"))
        received    = grn_qty_map.get(bc, 0)
        po_rate_val = po_rate_map.get(bc, 0)

        if inv_qty > received + 0.001:
            grn_match = False
            notes.append(f"{bc}: invoiced {inv_qty} > received {received:.3f}")

        if po_rate_val > 0 and abs(inv_rate - po_rate_val) > 0.01:
            rate_match = False
            notes.append(f"{bc}: rate ₹{inv_rate} ≠ PO ₹{po_rate_val}")

    if po:
        po_net    = safe_float(po.get("netAmount"))
        inv_total = safe_float(inv_dict.get("invoiceTotal"))
        po_match  = abs(inv_total - po_net) / max(po_net, 1) <= 0.01
        variance  = round(abs(inv_total - po_net), 2)
    else:
        po_match = True
        variance = 0.0

    matched = po_match and grn_match and rate_match

    return {
        "matched":         matched,
        "po_match":        po_match,
        "grn_match":       grn_match,
        "rate_match":      rate_match,
        "variance_amount": variance,
        "notes":           "; ".join(notes) if notes else "All checks passed",
    }


# ─────────────────────────────────────────────────────────────────────────────
# PO-linked resolver
# ─────────────────────────────────────────────────────────────────────────────

async def resolve_po_linked(inv_dict: dict):
    tenant_id = _invoice_scope.get().get("tenant_id")
    po_no = inv_dict.get("poNo", "")
    po    = await purchaseorders_collection.find_one({"orderNo": po_no, "tenant_id": tenant_id})
    if not po:
        raise HTTPException(status_code=404, detail=f"PO '{po_no}' not found.")

    inv_dict["po_id"]      = str(po["_id"])
    inv_dict["vendorName"] = po.get("vendorName", inv_dict.get("vendorName", ""))

    po_vendor_id = po.get("vendor_id")
    vendor = None
    if po_vendor_id and ObjectId.is_valid(str(po_vendor_id)):
        vendor = await vendors_collection.find_one({"_id": ObjectId(str(po_vendor_id))})
    if not vendor:
        vendor = await vendors_collection.find_one({
            "$or": [{"vendor_name": inv_dict["vendorName"]}, {"name": inv_dict["vendorName"]}]
        })
    if vendor:
        inv_dict["vendor_id"]           = str(vendor["_id"])
        inv_dict["isRegisteredVendor"]  = True
        # Pull contact from vendor profile if not already set
        if not inv_dict.get("vendorEmail"):
            inv_dict["vendorEmail"] = vendor.get("email", "")
        if not inv_dict.get("vendorPhone"):
            inv_dict["vendorPhone"] = vendor.get("contactMobile", "")
    else:
        inv_dict["isRegisteredVendor"] = False

    grns     = []
    grn_ids  = []
    grc_nos  = []
    grc_ids  = []

    for grn_no in inv_dict.get("grnNos", []):
        grn = await grn_collection.find_one({"grnNo": grn_no, "tenant_id": tenant_id})
        if not grn:
            raise HTTPException(status_code=404, detail=f"GRN '{grn_no}' not found.")
        if grn.get("status") != "Posted":
            raise HTTPException(
                status_code=400,
                detail=(
                    f"GRN '{grn_no}' must be Posted before invoicing. "
                    f"Current status: '{grn.get('status')}'."
                )
            )
        if grn.get("poNo") != po_no:
            raise HTTPException(
                status_code=400,
                detail=f"GRN '{grn_no}' belongs to PO '{grn.get('poNo')}', not '{po_no}'."
            )
        grns.append(grn)
        grn_ids.append(str(grn["_id"]))

        grc_no = grn.get("grcNo", "")
        if grc_no and grc_no not in grc_nos:
            grc_nos.append(grc_no)
            grc = await grc_collection.find_one({"grcNo": grc_no, "tenant_id": tenant_id})
            if grc:
                grc_ids.append(str(grc["_id"]))

    inv_dict["grn_ids"] = grn_ids
    inv_dict["grcNos"]  = grc_nos
    inv_dict["grc_ids"] = grc_ids
    return po, grns


# ─────────────────────────────────────────────────────────────────────────────
# Direct GRC resolver
# ─────────────────────────────────────────────────────────────────────────────

async def resolve_direct_grc(inv_dict: dict):
    tenant_id = _invoice_scope.get().get("tenant_id")
    grc_no = inv_dict.get("directGrcNo", "")
    if not grc_no:
        raise HTTPException(status_code=400, detail="directGrcNo is required for direct GRC invoices.")

    grc = await grc_collection.find_one({"grcNo": grc_no, "tenant_id": tenant_id})
    if not grc:
        raise HTTPException(status_code=404, detail=f"GRC '{grc_no}' not found.")
    if grc.get("status") != "Approved":
        raise HTTPException(
            status_code=400,
            detail=(
                f"GRC '{grc_no}' must be Approved before invoicing. "
                f"Current status: '{grc.get('status')}'."
            )
        )
    if grc.get("poNo"):
        raise HTTPException(
            status_code=400,
            detail=(
                f"GRC '{grc_no}' is PO-linked (PO: {grc.get('poNo')}). "
                f"Use the 'PO-Linked' invoice type instead."
            )
        )

    inv_dict["directGrc_id"] = str(grc["_id"])
    inv_dict["vendorName"]   = grc.get("vendorName", inv_dict.get("vendorName", ""))
    inv_dict["po_id"]        = None
    inv_dict["poNo"]         = ""

    grc_vendor_id = grc.get("vendor_id")
    vendor = None
    if grc_vendor_id and ObjectId.is_valid(str(grc_vendor_id)):
        vendor = await vendors_collection.find_one({"_id": ObjectId(str(grc_vendor_id))})
    if not vendor:
        vendor = await vendors_collection.find_one({
            "$or": [{"vendor_name": inv_dict["vendorName"]}, {"name": inv_dict["vendorName"]}]
        })

    # ── Check if vendor is registered ────────────────────────────────────────

    if vendor:
        inv_dict["vendor_id"]          = str(vendor["_id"])
        inv_dict["isRegisteredVendor"] = True
        if not inv_dict.get("vendorEmail"):
            inv_dict["vendorEmail"] = vendor.get("email", "")
        if not inv_dict.get("vendorPhone"):
            inv_dict["vendorPhone"] = vendor.get("contactMobile", "")
    else:
        # Non-registered vendor — pull contact from GRC if available
        inv_dict["isRegisteredVendor"] = False
        if not inv_dict.get("vendorEmail"):
            inv_dict["vendorEmail"] = grc.get("vendorEmail", "")
        if not inv_dict.get("vendorPhone"):
            inv_dict["vendorPhone"] = grc.get("vendorPhone", "")
        if not inv_dict.get("vendorAddress"):
            inv_dict["vendorAddress"] = grc.get("vendorAddress", "")

    grns    = []
    grn_ids = []

    for grn_no in inv_dict.get("grnNos", []):
        grn = await grn_collection.find_one({"grnNo": grn_no, "tenant_id": tenant_id})
        if not grn:
            raise HTTPException(status_code=404, detail=f"GRN '{grn_no}' not found.")
        if grn.get("status") != "Posted":
            raise HTTPException(
                status_code=400,
                detail=(
                    f"GRN '{grn_no}' must be Posted before invoicing. "
                    f"Current status: '{grn.get('status')}'."
                )
            )
        if grn.get("grcNo") != grc_no:
            raise HTTPException(
                status_code=400,
                detail=f"GRN '{grn_no}' belongs to GRC '{grn.get('grcNo')}', not '{grc_no}'."
            )
        grns.append(grn)
        grn_ids.append(str(grn["_id"]))

    inv_dict["grn_ids"] = grn_ids
    inv_dict["grcNos"]  = [grc_no]
    inv_dict["grc_ids"] = [str(grc["_id"])]
    return None, grns


# ─────────────────────────────────────────────────────────────────────────────
# Unified resolver
# ─────────────────────────────────────────────────────────────────────────────

async def resolve_invoice_links(inv_dict: dict):
    inv_type = inv_dict.get("invoiceType", "po_linked")
    if inv_type == "direct_grc":
        return await resolve_direct_grc(inv_dict)
    else:
        return await resolve_po_linked(inv_dict)


# ─────────────────────────────────────────────────────────────────────────────
# Smart vendor notification
# ─────────────────────────────────────────────────────────────────────────────

async def notify_vendor(inv_dict: dict, event: str = "invoice_created") -> dict:
    """
    Routes notification based on vendor registration status:
      • Registered vendor  → portal notification (in-app) + email via their account
      • Non-registered     → email / SMS to vendorEmail / vendorPhone from GRC contact
    Returns a notification log entry.
    """
    is_registered  = inv_dict.get("isRegisteredVendor", False)
    vendor_name    = inv_dict.get("vendorName", "")
    invoice_no     = inv_dict.get("invoiceNo", "")
    invoice_total  = inv_dict.get("invoiceTotal", 0)
    vendor_email   = inv_dict.get("vendorEmail", "")
    vendor_phone   = inv_dict.get("vendorPhone", "")
    due_date       = inv_dict.get("dueDate", "")

    EVENT_MESSAGES = {
        "invoice_created":   f"Invoice {invoice_no} has been raised against your supplies. Total: ₹{invoice_total:.2f}. Due: {due_date}.",
        "invoice_submitted": f"Invoice {invoice_no} has been submitted for approval. Total: ₹{invoice_total:.2f}.",
        "invoice_approved":  f"Invoice {invoice_no} has been approved and will be processed for payment. Total: ₹{invoice_total:.2f}.",
        "payment_recorded":  f"Payment recorded against Invoice {invoice_no}. Please check your portal for details.",
        "invoice_cancelled": f"Invoice {invoice_no} has been cancelled. Please contact the AP team for queries.",
        "invoice_on_hold":   f"Invoice {invoice_no} has been placed on hold. Reason will be communicated separately.",
    }
    message = EVENT_MESSAGES.get(event, f"Update on Invoice {invoice_no}: {event.replace('_', ' ').title()}.")

    if is_registered:
        # Registered vendor: portal notification (in-app record) + email via registered account
        channel = "portal+email"
        notif_status = "delivered"
        delivery_detail = f"Portal notification created. Email queued to {vendor_email}."
        # TODO: call your actual email service here, e.g.:
        # await send_vendor_invoice_email(vendor_email, vendor_name, invoice_no, message)
        print(f"[notify_vendor:registered] {event} → {vendor_name} | portal+email: {vendor_email}")
    else:
        # Non-registered vendor: email if address available, else SMS/WhatsApp
        if vendor_email:
            channel = "email"
            notif_status = "queued"
            delivery_detail = f"Email queued to {vendor_email} (non-registered vendor)."
            # TODO: call transactional email service (SendGrid / SES / SMTP) here:
            # await send_transactional_email(vendor_email, vendor_name, invoice_no, message)
            print(f"[notify_vendor:non-registered] {event} → {vendor_name} | email: {vendor_email}")
        elif vendor_phone:
            channel = "sms"
            notif_status = "queued"
            delivery_detail = f"SMS queued to {vendor_phone} (non-registered vendor, no email)."
            # TODO: call SMS gateway (Twilio / MSG91) here:
            # await send_sms(vendor_phone, message)
            print(f"[notify_vendor:non-registered] {event} → {vendor_name} | sms: {vendor_phone}")
        else:
            channel = "none"
            notif_status = "no_contact"
            delivery_detail = "No contact info available for non-registered vendor. Manual notification required."
            print(f"[notify_vendor:non-registered] {event} → {vendor_name} | ⚠ no contact info")

    return {
        "event":          event,
        "sentAt":         datetime.utcnow().isoformat(),
        "channel":        channel,
        "status":         notif_status,
        "to":             vendor_email or vendor_phone or vendor_name,
        "isRegistered":   is_registered,
        "message":        message,
        "deliveryDetail": delivery_detail,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Payment schedule builder
# ─────────────────────────────────────────────────────────────────────────────

def build_payment_schedule(inv_dict: dict, payment_mode: str, payment_terms: str) -> List[dict]:
    total    = safe_float(inv_dict.get("invoiceTotal"))
    inv_date = inv_dict.get("invoiceDate", datetime.utcnow().strftime("%Y-%m-%d"))
    schedule = []

    if payment_mode == "PostDatedCheque":
        cheque_date = inv_dict.get("chequeDate") or compute_due_date(inv_date, "Net30")
        schedule.append({
            "dueDate":     cheque_date,
            "amount":      round(total, 2),
            "paymentMode": "PostDatedCheque",
            "notes":       f"PDC #{inv_dict.get('chequeNo', '')}",
            "status":      "Pending",
        })
    elif payment_terms in PAYMENT_TERMS_DAYS:
        due = compute_due_date(inv_date, payment_terms)
        schedule.append({
            "dueDate":     due,
            "amount":      round(total, 2),
            "paymentMode": payment_mode or "NEFT",
            "notes":       payment_terms,
            "status":      "Pending",
        })

    return schedule


# ─────────────────────────────────────────────────────────────────────────────
# Prefill items from GRNs
# ─────────────────────────────────────────────────────────────────────────────

def prefill_items_from_grns(grns: list, po_rate_map: Dict[str, float]) -> list:
    grn_qty_map: Dict[str, Any] = {}
    for grn in grns:
        for it in grn.get("items", []):
            bc = (it.get("barcode") or "").strip()
            if bc not in grn_qty_map:
                grn_qty_map[bc] = {
                    "description": it.get("description", ""),
                    "qty":  0.0,
                    "rate": safe_float(it.get("rate")),
                }
            grn_qty_map[bc]["qty"] += safe_float(it.get("inwardQty"))

    return [
        {
            "barcode":        bc,
            "description":    data["description"],
            "grnQty":         data["qty"],
            "invoicedQty":    data["qty"],
            "rate":           data["rate"],
            "poRate":         po_rate_map.get(bc, data["rate"]),
            "taxPct":         0,
            "discountPct":    0,
            "taxAmount":      0,
            "discountAmount": 0,
            "lineAmount":     0,
            "varianceFlag":   "",
            "remarks":        "",
        }
        for bc, data in grn_qty_map.items()
    ]


# ─────────────────────────────────────────────────────────────────────────────
# CREATE
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_invoice(inv: PurchaseInvoiceModel):
    inv_dict = inv.dict()

    existing = await purchase_invoice_collection.find_one({
        "vendorInvoiceNo": inv_dict["vendorInvoiceNo"],
        "vendorName":      inv_dict.get("vendorName", ""),
    })
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Invoice '{inv_dict['vendorInvoiceNo']}' from this vendor already exists."
        )

    po, grns = await resolve_invoice_links(inv_dict)

    if not inv_dict.get("items"):
        po_rate_map = {}
        if po:
            po_rate_map = {
                (it.get("barcode") or "").strip(): safe_float(it.get("rate"))
                for it in po.get("items", [])
            }
        inv_dict["items"] = prefill_items_from_grns(grns, po_rate_map)

    compute_invoice_totals(inv_dict)
    match_result = run_three_way_match(inv_dict, po, grns)
    inv_dict["threeWayMatch"] = match_result

    if not match_result["matched"] and inv_dict.get("status") not in ("Draft", "OnHold"):
        inv_dict["status"]     = "OnHold"
        inv_dict["holdReason"] = match_result["notes"]

    if not inv_dict.get("dueDate") and inv_dict.get("paymentTerms"):
        inv_dict["dueDate"] = compute_due_date(
            inv_dict.get("invoiceDate", ""),
            inv_dict.get("paymentTerms", ""),
        )

    inv_dict["paymentSchedule"] = build_payment_schedule(
        inv_dict,
        inv_dict.get("paymentMode", "NEFT"),
        inv_dict.get("paymentTerms", ""),
    )

    if not inv_dict.get("invoiceNo"):
        inv_dict["invoiceNo"] = await generate_invoice_number()

    inv_dict["paidAmount"]      = 0.0
    inv_dict["balanceDue"]      = inv_dict["invoiceTotal"]
    inv_dict["paymentStatus"]   = "Unpaid"
    inv_dict["payments"]        = []
    inv_dict["vendorQueries"]   = []
    inv_dict["notificationLog"] = []

    notif = await notify_vendor(inv_dict, "invoice_created")
    inv_dict["notificationLog"].append(notif)
    inv_dict["vendorNotified"]   = True
    inv_dict["vendorNotifiedAt"] = datetime.utcnow().isoformat()

    inv_dict["_id"]       = ObjectId()
    inv_dict["createdAt"] = datetime.utcnow()
    inv_dict["updatedAt"] = datetime.utcnow()

    await purchase_invoice_collection.insert_one(inv_dict)
    inv_dict["id"] = str(inv_dict.pop("_id"))
    return {"message": "Purchase invoice created", "invoice": inv_dict}


# ─────────────────────────────────────────────────────────────────────────────
# GET ALL
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/")
async def get_all_invoices(
    status:       str  = None,
    vendor:       str  = None,
    po_no:        str  = None,
    invoice_type: str  = None,
    overdue:      bool = None,
    registered:   bool = None,      # filter by isRegisteredVendor
):
    query: Dict[str, Any] = {}
    if status:       query["status"]      = status
    if vendor:       query["vendorName"]  = {"$regex": vendor, "$options": "i"}
    if po_no:        query["poNo"]        = po_no
    if invoice_type: query["invoiceType"] = invoice_type
    if registered is not None:
        query["isRegisteredVendor"] = registered
    if overdue is True:
        today_str = datetime.utcnow().strftime("%Y-%m-%d")
        query["dueDate"]       = {"$lt": today_str}
        query["paymentStatus"] = {"$in": ["Unpaid", "Partial"]}

    results = []
    async for doc in purchase_invoice_collection.find(query).sort("_id", -1):
        doc["id"] = objid(doc.pop("_id"))
        doc.pop("items", None)
        doc.pop("notificationLog", None)
        results.append(doc)
    return results


# ─────────────────────────────────────────────────────────────────────────────
# GET by PO
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/by-po/{po_no:path}")
async def get_invoices_by_po(po_no: str):
    results = []
    async for doc in purchase_invoice_collection.find({"poNo": po_no}):
        doc["id"] = objid(doc.pop("_id"))
        results.append(doc)
    return results


# ─────────────────────────────────────────────────────────────────────────────
# GET by GRC
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/by-grc/{grc_no:path}")
async def get_invoices_by_grc(grc_no: str):
    results = []
    async for doc in purchase_invoice_collection.find({"directGrcNo": grc_no}):
        doc["id"] = objid(doc.pop("_id"))
        results.append(doc)
    return results


# ─────────────────────────────────────────────────────────────────────────────
# AP AGING REPORT
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/reports/aging")
async def get_aging_report():
    today   = datetime.utcnow()
    buckets = {"current": [], "0-30": [], "31-60": [], "61-90": [], "90+": []}

    async for doc in purchase_invoice_collection.find({
        "paymentStatus": {"$in": ["Unpaid", "Partial"]},
        "status":        {"$in": ["Approved", "PartiallyPaid"]},
        "dueDate":       {"$ne": "", "$exists": True},
    }):
        try:
            due          = datetime.strptime(doc["dueDate"], "%Y-%m-%d")
            days_overdue = (today - due).days
        except Exception:
            continue

        entry = {
            "invoiceNo":          doc.get("invoiceNo"),
            "vendor":             doc.get("vendorName"),
            "invoiceType":        doc.get("invoiceType", "po_linked"),
            "isRegisteredVendor": doc.get("isRegisteredVendor", False),
            "invoiceTotal":       doc.get("invoiceTotal"),
            "balanceDue":         doc.get("balanceDue"),
            "dueDate":            doc.get("dueDate"),
            "daysOverdue":        days_overdue,
            "paymentMode":        doc.get("paymentMode", ""),
        }

        if days_overdue < 0:       buckets["current"].append(entry)
        elif days_overdue <= 30:   buckets["0-30"].append(entry)
        elif days_overdue <= 60:   buckets["31-60"].append(entry)
        elif days_overdue <= 90:   buckets["61-90"].append(entry)
        else:                      buckets["90+"].append(entry)

    totals = {k: round(sum(e["balanceDue"] for e in v), 2) for k, v in buckets.items()}
    return {"buckets": buckets, "totals": totals}


# ─────────────────────────────────────────────────────────────────────────────
# PAYMENT SCHEDULE
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/payment-schedule/{inv_id}")
async def get_payment_schedule(inv_id: str):
    try:
        doc = await purchase_invoice_collection.find_one({"_id": ObjectId(inv_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid invoice ID")
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {
        "invoiceNo":       doc.get("invoiceNo"),
        "invoiceTotal":    doc.get("invoiceTotal"),
        "paidAmount":      doc.get("paidAmount"),
        "balanceDue":      doc.get("balanceDue"),
        "paymentSchedule": doc.get("paymentSchedule", []),
        "payments":        doc.get("payments", []),
    }


# ─────────────────────────────────────────────────────────────────────────────
# VENDOR PORTAL — registered vendors only
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/vendor-portal/{vendor_name:path}")
async def vendor_portal_invoices(vendor_name: str):
    results = []
    async for doc in purchase_invoice_collection.find(
        {"vendorName": {"$regex": f"^{vendor_name}$", "$options": "i"}}
    ).sort("_id", -1):
        results.append({
            "id":                   objid(doc.get("_id")),
            "invoiceNo":            doc.get("invoiceNo"),
            "vendorInvoiceNo":      doc.get("vendorInvoiceNo"),
            "invoiceDate":          doc.get("invoiceDate"),
            "dueDate":              doc.get("dueDate"),
            "invoiceType":          doc.get("invoiceType", "po_linked"),
            "isRegisteredVendor":   doc.get("isRegisteredVendor", False),
            "poNo":                 doc.get("poNo"),
            "directGrcNo":          doc.get("directGrcNo"),
            "grnNos":               doc.get("grnNos", []),
            "grcNos":               doc.get("grcNos", []),
            "invoiceTotal":         doc.get("invoiceTotal"),
            "paidAmount":           doc.get("paidAmount"),
            "balanceDue":           doc.get("balanceDue"),
            "status":               doc.get("status"),
            "paymentStatus":        doc.get("paymentStatus"),
            "paymentMode":          doc.get("paymentMode"),
            "paymentTerms":         doc.get("paymentTerms"),
            "paymentSchedule":      doc.get("paymentSchedule", []),
            "threeWayMatch":        doc.get("threeWayMatch"),
            "vendorAcknowledged":   doc.get("vendorAcknowledged", False),
            "queries":              doc.get("vendorQueries", []),
            "items":                doc.get("items", []),
            "notificationLog":      doc.get("notificationLog", []),
        })
    return results


# ─────────────────────────────────────────────────────────────────────────────
@router.get("/vendor/my-invoices")
async def get_my_vendor_invoices():
    results = []
    async for doc in purchase_invoice_collection.find({}).sort("_id", -1):
        doc["id"] = objid(doc.pop("_id"))
        doc.pop("notificationLog", None)
        results.append(doc)
    return results


@router.post("/vendor/{inv_id}/acknowledge")
async def acknowledge_my_vendor_invoice(inv_id: str):
    try:
        oid = ObjectId(inv_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid invoice ID")
    result = await purchase_invoice_collection.update_one(
        {"_id": oid},
        {"$set": {
            "vendorAcknowledged": True,
            "vendorAcknowledgedAt": datetime.utcnow().isoformat(),
            "updatedAt": datetime.utcnow(),
        }},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"message": "Invoice acknowledged"}


@router.post("/vendor/{inv_id}/query")
async def query_my_vendor_invoice(inv_id: str, query: VendorQueryModel):
    try:
        oid = ObjectId(inv_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid invoice ID")
    entry = {
        "id": str(ObjectId()),
        "subject": query.subject,
        "description": query.description,
        "queryType": query.queryType,
        "status": "Open",
        "createdAt": datetime.utcnow().isoformat(),
        "reply": "",
    }
    result = await purchase_invoice_collection.update_one(
        {"_id": oid},
        {"$push": {"vendorQueries": entry}, "$set": {"updatedAt": datetime.utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"message": "Query submitted", "query": entry}

# PATCH VENDOR CONTACT — for non-registered vendor invoices
# AP team can add/update contact details so notification can be sent
# ─────────────────────────────────────────────────────────────────────────────

@router.patch("/{inv_id}/vendor-contact")
async def patch_vendor_contact(inv_id: str, body: VendorContactPatchModel):
    """
    Allows AP team to add/correct email, phone, or address for a
    non-registered vendor on a direct-GRC invoice.
    """
    try:
        doc = await purchase_invoice_collection.find_one({"_id": ObjectId(inv_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid invoice ID")
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if doc.get("isRegisteredVendor"):
        raise HTTPException(
            status_code=400,
            detail="Contact details are managed via the vendor's registered profile."
        )

    patch: Dict[str, Any] = {"updatedAt": datetime.utcnow()}
    if body.vendorEmail   is not None: patch["vendorEmail"]   = body.vendorEmail
    if body.vendorPhone   is not None: patch["vendorPhone"]   = body.vendorPhone
    if body.vendorAddress is not None: patch["vendorAddress"] = body.vendorAddress

    await purchase_invoice_collection.update_one(
        {"_id": ObjectId(inv_id)}, {"$set": patch}
    )

    return {"message": "Vendor contact updated successfully.", "updated": patch}


# ─────────────────────────────────────────────────────────────────────────────
# MANUAL NOTIFY — AP team triggers a one-off notification
# Works for both registered (portal+email) and non-registered (email/SMS)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{inv_id}/notify")
async def manual_notify(inv_id: str, body: ManualNotifyModel):
    """
    AP team manually triggers a notification for any invoice.
    For non-registered vendors the 'to' field is used as-is.
    For registered vendors the system also records a portal notification.
    """
    try:
        doc = await purchase_invoice_collection.find_one({"_id": ObjectId(inv_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid invoice ID")
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")

    is_registered = doc.get("isRegisteredVendor", False)
    channel       = body.channel

    if channel not in ("email", "sms", "whatsapp"):
        raise HTTPException(status_code=400, detail="channel must be email, sms, or whatsapp")

    # For registered vendors, always include portal channel
    if is_registered:
        channel = f"portal+{channel}"

    notif_entry = {
        "event":          "manual_notification",
        "sentAt":         datetime.utcnow().isoformat(),
        "channel":        channel,
        "status":         "queued",
        "to":             body.to,
        "isRegistered":   is_registered,
        "message":        body.message or f"Update regarding Invoice {doc.get('invoiceNo')} — {doc.get('vendorName')}.",
        "deliveryDetail": f"Manual notification queued via {channel} to {body.to}. Sender: {body.senderName}.",
        "isManual":       True,
        "subject":        body.subject,
        "senderName":     body.senderName,
    }

    # TODO: dispatch actual email/SMS here based on channel

    print(f"[manual_notify] {doc.get('invoiceNo')} → {body.to} via {channel}")

    await purchase_invoice_collection.update_one(
        {"_id": ObjectId(inv_id)},
        {
            "$push": {"notificationLog": notif_entry},
            "$set":  {
                "vendorNotified":   True,
                "vendorNotifiedAt": datetime.utcnow().isoformat(),
                "updatedAt":        datetime.utcnow(),
            },
        }
    )
    return {"message": f"Notification queued via {channel} to {body.to}.", "entry": notif_entry}


# ─────────────────────────────────────────────────────────────────────────────
# UPDATE (Draft / OnHold only)
# ─────────────────────────────────────────────────────────────────────────────

@router.put("/{inv_id}")
async def update_invoice(inv_id: str, inv: PurchaseInvoiceModel):
    try:
        existing = await purchase_invoice_collection.find_one({"_id": ObjectId(inv_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid invoice ID")
    if not existing:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if existing.get("status") not in ("Draft", "OnHold"):
        raise HTTPException(
            status_code=400,
            detail=f"Only Draft or OnHold invoices can be edited. Status: '{existing.get('status')}'."
        )

    inv_dict              = inv.dict(exclude_unset=True)
    inv_dict["updatedAt"] = datetime.utcnow()

    po, grns = await resolve_invoice_links(inv_dict)
    compute_invoice_totals(inv_dict)
    match_result = run_three_way_match(inv_dict, po, grns)
    inv_dict["threeWayMatch"] = match_result

    if not match_result["matched"] and inv_dict.get("status") not in ("Draft", "OnHold"):
        inv_dict["status"]     = "OnHold"
        inv_dict["holdReason"] = match_result["notes"]

    if "paymentTerms" in inv_dict or "paymentMode" in inv_dict:
        inv_dict["paymentSchedule"] = build_payment_schedule(
            {**existing, **inv_dict},
            inv_dict.get("paymentMode", existing.get("paymentMode", "NEFT")),
            inv_dict.get("paymentTerms", existing.get("paymentTerms", "")),
        )

    inv_dict["balanceDue"] = round(
        max(0.0, inv_dict.get("invoiceTotal", 0) - safe_float(existing.get("paidAmount"))), 2
    )

    await purchase_invoice_collection.update_one(
        {"_id": ObjectId(inv_id)}, {"$set": inv_dict}
    )
    return {"message": "Invoice updated successfully"}


# ─────────────────────────────────────────────────────────────────────────────
# SUBMIT  Draft → Submitted
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{inv_id}/submit")
async def submit_invoice(inv_id: str):
    try:
        doc = await purchase_invoice_collection.find_one({"_id": ObjectId(inv_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid invoice ID")
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if doc.get("status") != "Draft":
        raise HTTPException(status_code=400, detail="Only Draft invoices can be submitted.")

    notif = await notify_vendor({**doc, "invoiceNo": doc.get("invoiceNo")}, "invoice_submitted")
    await purchase_invoice_collection.update_one(
        {"_id": ObjectId(inv_id)},
        {
            "$set":  {"status": "Submitted", "updatedAt": datetime.utcnow()},
            "$push": {"notificationLog": notif},
        }
    )
    return {"message": f"Invoice '{doc.get('invoiceNo')}' submitted for approval."}


# ─────────────────────────────────────────────────────────────────────────────
# VENDOR ACKNOWLEDGE
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{inv_id}/vendor-acknowledge")
async def vendor_acknowledge(inv_id: str):
    try:
        doc = await purchase_invoice_collection.find_one({"_id": ObjectId(inv_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid invoice ID")
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")

    await purchase_invoice_collection.update_one(
        {"_id": ObjectId(inv_id)},
        {"$set": {
            "vendorAcknowledged":   True,
            "vendorAcknowledgedAt": datetime.utcnow().isoformat(),
            "updatedAt":            datetime.utcnow(),
        }}
    )
    return {"message": "Vendor has acknowledged the invoice."}


# ─────────────────────────────────────────────────────────────────────────────
# VENDOR QUERY
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{inv_id}/vendor-query")
async def raise_vendor_query(inv_id: str, query: VendorQueryModel):
    try:
        doc = await purchase_invoice_collection.find_one({"_id": ObjectId(inv_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid invoice ID")
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")

    entry = {
        "queryId":     str(ObjectId()),
        "subject":     query.subject,
        "description": query.description,
        "queryType":   query.queryType,
        "raisedAt":    datetime.utcnow().isoformat(),
        "status":      "Open",
        "replies":     [],
    }

    await purchase_invoice_collection.update_one(
        {"_id": ObjectId(inv_id)},
        {
            "$push": {"vendorQueries": entry},
            "$set":  {"updatedAt": datetime.utcnow()},
        }
    )
    if doc.get("status") not in ("Draft", "OnHold", "Paid", "Cancelled"):
        await purchase_invoice_collection.update_one(
            {"_id": ObjectId(inv_id)},
            {"$set": {"status": "UnderReview"}}
        )

    return {"message": "Query raised successfully.", "queryId": entry["queryId"]}


@router.post("/{inv_id}/vendor-query/{query_id}/reply")
async def reply_to_vendor_query(inv_id: str, query_id: str, body: VendorQueryReplyModel):
    try:
        doc = await purchase_invoice_collection.find_one({"_id": ObjectId(inv_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid invoice ID")
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")

    queries = doc.get("vendorQueries", [])
    found   = False
    for q in queries:
        if q.get("queryId") == query_id:
            q.setdefault("replies", []).append({
                "text":      body.reply,
                "repliedAt": datetime.utcnow().isoformat(),
                "by":        "AP Team",
            })
            q["status"] = "UnderReview"
            found = True
            break

    if not found:
        raise HTTPException(status_code=404, detail=f"Query '{query_id}' not found.")

    await purchase_invoice_collection.update_one(
        {"_id": ObjectId(inv_id)},
        {"$set": {"vendorQueries": queries, "updatedAt": datetime.utcnow()}}
    )
    return {"message": "Reply added to query."}


@router.post("/{inv_id}/vendor-query/{query_id}/resolve")
async def resolve_vendor_query(inv_id: str, query_id: str):
    try:
        doc = await purchase_invoice_collection.find_one({"_id": ObjectId(inv_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid invoice ID")
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")

    queries      = doc.get("vendorQueries", [])
    found        = False
    all_resolved = True
    for q in queries:
        if q.get("queryId") == query_id:
            q["status"]     = "Resolved"
            q["resolvedAt"] = datetime.utcnow().isoformat()
            found = True
        if q.get("status") not in ("Resolved", "Closed"):
            all_resolved = False

    if not found:
        raise HTTPException(status_code=404, detail=f"Query '{query_id}' not found.")

    update_set: Dict[str, Any] = {
        "vendorQueries": queries,
        "updatedAt":     datetime.utcnow(),
    }
    if all_resolved and doc.get("status") == "UnderReview":
        update_set["status"] = "Submitted"

    await purchase_invoice_collection.update_one(
        {"_id": ObjectId(inv_id)}, {"$set": update_set}
    )
    return {"message": "Query resolved.", "allResolved": all_resolved}


# ─────────────────────────────────────────────────────────────────────────────
# APPROVE
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{inv_id}/approve")
async def approve_invoice(inv_id: str):
    try:
        doc = await purchase_invoice_collection.find_one({"_id": ObjectId(inv_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid invoice ID")
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if doc.get("status") not in ("Submitted", "UnderReview", "OnHold"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve from status '{doc.get('status')}'."
        )

    match = doc.get("threeWayMatch", {})
    approval_note = (
        f"Approved with variance: {match.get('notes', '')}"
        if not match.get("matched", False)
        else "Match checks passed"
    )

    notif = await notify_vendor(doc, "invoice_approved")
    await purchase_invoice_collection.update_one(
        {"_id": ObjectId(inv_id)},
        {
            "$set":  {
                "status":       "Approved",
                "approvalNote": approval_note,
                "updatedAt":    datetime.utcnow(),
            },
            "$push": {"notificationLog": notif},
        }
    )
    return {"message": f"Invoice approved. {approval_note}"}


# ─────────────────────────────────────────────────────────────────────────────
# HOLD
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{inv_id}/hold")
async def hold_invoice(inv_id: str, payload: dict = {}):
    reason = (payload.get("reason") or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Hold reason is required.")
    try:
        doc = await purchase_invoice_collection.find_one({"_id": ObjectId(inv_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid invoice ID")
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if doc.get("status") in ("Paid", "Cancelled"):
        raise HTTPException(status_code=400, detail="Cannot hold a Paid or Cancelled invoice.")

    notif = await notify_vendor(doc, "invoice_on_hold")
    await purchase_invoice_collection.update_one(
        {"_id": ObjectId(inv_id)},
        {
            "$set":  {"status": "OnHold", "holdReason": reason, "updatedAt": datetime.utcnow()},
            "$push": {"notificationLog": notif},
        }
    )
    return {"message": "Invoice placed on hold.", "reason": reason}


# ─────────────────────────────────────────────────────────────────────────────
# RECORD PAYMENT
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{inv_id}/pay")
async def record_payment(inv_id: str, payment: PaymentModel):
    try:
        doc = await purchase_invoice_collection.find_one({"_id": ObjectId(inv_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid invoice ID")
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if doc.get("status") not in ("Approved", "PartiallyPaid"):
        raise HTTPException(
            status_code=400,
            detail=f"Payments can only be recorded against Approved invoices. Status: '{doc.get('status')}'."
        )

    if payment.paymentMode not in PAYMENT_MODES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid payment mode '{payment.paymentMode}'. Valid: {sorted(PAYMENT_MODES)}"
        )

    amount_paying = safe_float(payment.amount)
    balance       = safe_float(doc.get("balanceDue"))

    if amount_paying <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be greater than zero.")
    if amount_paying > balance + 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Payment ₹{amount_paying} exceeds balance due ₹{balance:.2f}."
        )

    new_paid    = round(safe_float(doc.get("paidAmount")) + amount_paying, 2)
    new_balance = round(max(0.0, safe_float(doc.get("invoiceTotal")) - new_paid), 2)
    pay_status  = "Paid" if new_balance < 0.01 else "Partial"
    new_status  = "Paid" if new_balance < 0.01 else "PartiallyPaid"

    pdc_pending = payment.paymentMode == "PostDatedCheque" and bool(payment.chequeDate)
    pdc_note    = f"PDC {payment.chequeNo} dated {payment.chequeDate} — pending clearance" if pdc_pending else ""

    payment_entry = {
        "paymentId":   str(ObjectId()),
        "amount":      amount_paying,
        "paymentDate": payment.paymentDate,
        "paymentMode": payment.paymentMode,
        "referenceNo": payment.referenceNo,
        "bankName":    payment.bankName,
        "accountNo":   payment.accountNo,
        "ifscCode":    payment.ifscCode,
        "chequeNo":    payment.chequeNo,
        "chequeDate":  payment.chequeDate,
        "upiId":       payment.upiId,
        "ddNo":        payment.ddNo,
        "remarks":     payment.remarks or pdc_note,
        "isAdvance":   payment.isAdvance,
        "scheduleId":  payment.scheduleId,
        "pdcPending":  pdc_pending,
        "recordedAt":  datetime.utcnow().isoformat(),
    }

    schedule = doc.get("paymentSchedule", [])
    if payment.scheduleId:
        for entry in schedule:
            if entry.get("scheduleId") == payment.scheduleId:
                entry["status"] = "Paid"
                break

    notif = await notify_vendor({**doc, "invoiceNo": doc.get("invoiceNo")}, "payment_recorded")

    await purchase_invoice_collection.update_one(
        {"_id": ObjectId(inv_id)},
        {
            "$set": {
                "paidAmount":      new_paid,
                "balanceDue":      new_balance,
                "paymentStatus":   pay_status,
                "status":          new_status,
                "paymentSchedule": schedule,
                "updatedAt":       datetime.utcnow(),
            },
            "$push": {
                "payments":        payment_entry,
                "notificationLog": notif,
            },
        }
    )

    # Mirror the operational payment into the retailer finance ledger.  The
    # invoice remains the payment source of truth; this record powers the
    # Finance department's voucher and audit views without altering stock.
    await finance_vouchers_collection.insert_one({
        "id": payment_entry["paymentId"],
        "voucher_no": f"AP-PAY-{payment_entry['paymentId'][-8:].upper()}",
        "tenant_id": doc.get("tenant_id"),
        "store_id": doc.get("store_id"),
        "voucher_type": "payment",
        "voucher_date": payment.paymentDate,
        "amount": amount_paying,
        "account": "Accounts Payable",
        "counterparty": doc.get("vendorName") or doc.get("vendor") or "Vendor",
        "payment_mode": payment.paymentMode,
        "reference_no": payment.referenceNo,
        "remarks": payment.remarks or pdc_note,
        "category": "accounts_payable",
        "linked_invoice_id": str(doc.get("_id")),
        "linked_sale_id": "",
        "source": "purchase_invoice_payment",
        "status": "Posted",
        "created_by": "",
        "created_at": datetime.utcnow(),
    })

    if new_balance < 0.01 and doc.get("po_id"):
        try:
            await purchaseorders_collection.update_one(
                {"_id": ObjectId(doc["po_id"])},
                {"$set": {"status": "Paid", "updatedAt": datetime.utcnow()}}
            )
        except Exception:
            pass

    return {
        "message":       "Payment recorded successfully",
        "paidAmount":    new_paid,
        "balanceDue":    new_balance,
        "paymentStatus": pay_status,
        "pdcPending":    pdc_pending,
    }


# ─────────────────────────────────────────────────────────────────────────────
# UPDATE PAYMENT SCHEDULE
# ─────────────────────────────────────────────────────────────────────────────

@router.put("/{inv_id}/payment-schedule")
async def update_payment_schedule(inv_id: str, schedule: List[PaymentScheduleEntry]):
    try:
        doc = await purchase_invoice_collection.find_one({"_id": ObjectId(inv_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid invoice ID")
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if doc.get("status") in ("Paid", "Cancelled"):
        raise HTTPException(status_code=400, detail="Cannot update schedule for Paid/Cancelled invoices.")

    entries = [e.dict() for e in schedule]
    for e in entries:
        if not e.get("scheduleId"):
            e["scheduleId"] = str(ObjectId())

    total_scheduled = round(sum(safe_float(e["amount"]) for e in entries), 2)
    invoice_total   = safe_float(doc.get("invoiceTotal"))
    if abs(total_scheduled - invoice_total) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Schedule total ₹{total_scheduled} does not match invoice total ₹{invoice_total}."
        )

    await purchase_invoice_collection.update_one(
        {"_id": ObjectId(inv_id)},
        {"$set": {"paymentSchedule": entries, "updatedAt": datetime.utcnow()}}
    )
    return {"message": "Payment schedule updated.", "entries": len(entries)}


# ─────────────────────────────────────────────────────────────────────────────
# CANCEL
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{inv_id}/cancel")
async def cancel_invoice(inv_id: str, payload: dict = {}):
    reason = (payload.get("reason") or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Cancellation reason is required.")
    try:
        doc = await purchase_invoice_collection.find_one({"_id": ObjectId(inv_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid invoice ID")
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if doc.get("status") in ("Paid", "Cancelled"):
        raise HTTPException(status_code=400, detail="Paid or already cancelled invoices cannot be cancelled.")

    notif = await notify_vendor(doc, "invoice_cancelled")
    await purchase_invoice_collection.update_one(
        {"_id": ObjectId(inv_id)},
        {
            "$set":  {
                "status":          "Cancelled",
                "rejectionReason": reason,
                "updatedAt":       datetime.utcnow(),
            },
            "$push": {"notificationLog": notif},
        }
    )
    return {"message": f"Invoice '{doc.get('invoiceNo')}' cancelled.", "reason": reason}


# ─────────────────────────────────────────────────────────────────────────────
# DELETE (Draft only)
# ─────────────────────────────────────────────────────────────────────────────

@router.delete("/{inv_id}")
async def delete_invoice(inv_id: str):
    try:
        doc = await purchase_invoice_collection.find_one({"_id": ObjectId(inv_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid invoice ID")
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if doc.get("status") != "Draft":
        raise HTTPException(status_code=400, detail="Only Draft invoices can be deleted.")
    await purchase_invoice_collection.delete_one({"_id": ObjectId(inv_id)})
    return {"message": "Invoice deleted successfully"}


# ─────────────────────────────────────────────────────────────────────────────
# GET SINGLE — wildcard, MUST be last GET route
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{inv_id}")
async def get_invoice(inv_id: str):
    try:
        doc = await purchase_invoice_collection.find_one({"_id": ObjectId(inv_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid invoice ID")
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")
    doc["id"] = objid(doc.pop("_id"))
    return doc
