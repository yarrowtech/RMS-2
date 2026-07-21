
from fastapi import APIRouter, HTTPException, status, Depends, Header
from jose import jwt, JWTError
from ..config import settings, frontend_url
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId
import uuid
import re

from app.db import purchaseorders_collection, vendors_collection, product_collection, vendor_tenant_links_collection
from .deps import get_hq_tenant

router = APIRouter(prefix="/purchaseorders", tags=["Purchase Orders"])

# â”€â”€â”€ App base URL (used for share links) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Change this to your production domain
APP_BASE_URL = frontend_url()

TOKEN_EXPIRY_DAYS = 30


def objid(v):
    return str(v) if isinstance(v, ObjectId) else v


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# MODELS
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class ItemModel(BaseModel):
    sku: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None
    catalogue_item_id: Optional[str] = None
    rfq_inquiry_id: Optional[str] = None
    rfq_award_id: Optional[str] = None
    barcode: str = ""
    description: str = ""
    originalQty: float = 0
    quantity: float = 0
    amendedQty: float = 0
    receivedQty: float = 0
    cancelledQty: float = 0
    pendingQty: float = 0
    rate: float = 0
    tolerancePct: float = 0
    taxPct: float = 0
    discountPct: float = 0
    amount: float = 0
    taxAmount: float = 0
    discountAmount: float = 0
    toleranceFlag: Optional[str] = ""
    dueDate: Optional[str] = None
    remarks: Optional[str] = ""
    removed: bool = False
    buyerRate:      Optional[float] = None
    vendorRate:     Optional[float] = None
    variancePct:    Optional[float] = None
    varianceAmt:    Optional[float] = None
    varianceStatus: Optional[str]   = None


class WalkinVendorModel(BaseModel):
    name:           str = ""
    contact_person: str = ""
    mobile:         str = ""
    email:          str = ""
    address:        str = ""
    gstin:          str = ""
    pan:            str = ""


class PurchaseOrderModel(BaseModel):
    id: Optional[str] = None
    orderNo: Optional[str] = None
    orderDate: str
    vendorName: str
    vendor_id: Optional[str] = None

    status: Optional[str] = "Pending"
    orderType: Optional[str] = ""
    ownerSite: Optional[str] = ""
    ownerSiteShortName: Optional[str] = ""
    tradeGroupName: Optional[str] = ""
    termName: Optional[str] = ""
    netAmount: float = 0
    setApplicable: bool = False

    documentNo: Optional[str] = ""
    validFrom: Optional[str] = ""
    validTill: Optional[str] = ""
    currency: Optional[str] = ""
    exchangeRate: Optional[float] = 0
    agent: Optional[str] = ""
    teamName: Optional[str] = ""
    commissionRate: Optional[float] = 0
    transporter: Optional[str] = ""
    merchandiserName: Optional[str] = ""
    entryMode: Optional[str] = ""
    purchaseType: Optional[str] = ""

    freightCharges: Optional[float] = 0
    overallDiscount: Optional[float] = 0
    basicValue: Optional[float] = 0
    taxAmount: Optional[float] = 0
    grossAmount: Optional[float] = 0

    notes: Optional[str] = ""
    otherTerms: Optional[str] = ""
    items: List[ItemModel] = []

    createdAt: Optional[datetime] = Field(default_factory=datetime.utcnow)
    updatedAt: Optional[datetime] = Field(default_factory=datetime.utcnow)

    # â”€â”€ Walk-in vendor fields â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    vendor_type:   Optional[str]               = "registered"
    walkin_vendor: Optional[WalkinVendorModel] = None


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# HELPERS â€” unchanged from your existing file
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

async def generate_po_number(tenant_id: str):
    """Generate a PO sequence that belongs to one retailer/store tenant only."""
    tenant_id = str(tenant_id or "").strip()
    if not tenant_id:
        raise ValueError("tenant_id is required to generate a purchase-order number")

    today = datetime.now()
    year, month = today.year, today.month
    if month >= 4:
        fy_start, fy_end = year, year + 1
    else:
        fy_start, fy_end = year - 1, year
    fy_code = f"{str(fy_start)[-2:]}-{str(fy_end)[-2:]}"
    last_po = await purchaseorders_collection.find_one(
        {
            "tenant_id": tenant_id,
            "orderNo": {"$regex": f"PO[/|-]\\d+/{fy_code}$"},
        },
        sort=[("_id", -1)]
    )
    last_num = 0
    if last_po and "orderNo" in last_po:
        try:
            last_num = int(last_po["orderNo"].split("/")[1])
        except Exception:
            last_num = 0
    return f"PO/{str(last_num + 1).zfill(8)}/{fy_code}"


async def generate_item_barcode():
    today = datetime.now()
    year, month = today.year, today.month
    if month >= 4:
        fy_start, fy_end = year, year + 1
    else:
        fy_start, fy_end = year - 1, year
    fy_code = f"{str(fy_start)[-2:]}-{str(fy_end)[-2:]}"
    last_po = await purchaseorders_collection.find_one(
        {"items.barcode": {"$regex": f"^ITEM/{fy_code}/\\d+$"}},
        sort=[("_id", -1)]
    )
    last_num = 0
    if last_po and "items" in last_po:
        barcodes = [it.get("barcode", "") for it in last_po["items"] if it.get("barcode")]
        nums = []
        for bc in barcodes:
            try:
                nums.append(int(bc.split("/")[-1]))
            except Exception:
                continue
        if nums:
            last_num = max(nums)
    return f"ITEM/{fy_code}/{str(last_num + 1).zfill(6)}"


async def resolve_real_barcode(item: dict) -> str:
    existing_bc = (item.get("barcode") or "").strip()
    if existing_bc and not existing_bc.startswith("ITEM/"):
        return existing_bc
    desc = (item.get("description") or "").strip()
    if not desc:
        return await generate_item_barcode()
    prod = await product_collection.find_one(
        {"product_name": {"$regex": f"^{desc}$", "$options": "i"}}
    )
    if not prod:
        prod = await product_collection.find_one(
            {"product_name": {"$regex": desc, "$options": "i"}}
        )
    if prod:
        if not prod.get("has_variants"):
            real_bc = (prod.get("barcode") or "").strip()
            if real_bc:
                return real_bc
        else:
            variants = prod.get("variants", [])
            if variants:
                real_bc = (variants[0].get("barcode") or "").strip()
                if real_bc:
                    return real_bc
    return await generate_item_barcode()


def calculate_po_totals(po_dict: dict):
    total_basic = total_tax = total_discount = 0.0
    for item in po_dict.get("items", []):
        qty      = float(item.get("quantity", 0))
        rate     = float(item.get("rate", 0))
        tax_pct  = float(item.get("taxPct", 0))
        disc_pct = float(item.get("discountPct", 0))
        basic    = qty * rate
        discount = basic * (disc_pct / 100)
        taxable  = basic - discount
        tax      = taxable * (tax_pct / 100)
        line_total = taxable + tax
        item["discountAmount"] = round(discount, 2)
        item["taxAmount"]      = round(tax, 2)
        item["amount"]         = round(line_total, 2)
        total_basic    += basic
        total_tax      += tax
        total_discount += discount
        tolerance = float(item.get("tolerancePct", 0))
        original  = float(item.get("originalQty", 0))
        if original > 0 and tolerance >= 0:
            min_qty = original * (1 - tolerance / 100)
            max_qty = original * (1 + tolerance / 100)
            if not (min_qty <= qty <= max_qty):
                item["toleranceFlag"] = f"Out of tolerance ({min_qty:.2f}-{max_qty:.2f})"
            else:
                item["toleranceFlag"] = ""
    freight          = float(po_dict.get("freightCharges", 0))
    overall_discount = float(po_dict.get("overallDiscount", 0))
    gross_amount     = total_basic - total_discount + total_tax
    net_amount       = gross_amount + freight - overall_discount
    po_dict["basicValue"]  = round(total_basic, 2)
    po_dict["taxAmount"]   = round(total_tax, 2)
    po_dict["grossAmount"] = round(gross_amount, 2)
    po_dict["netAmount"]   = round(net_amount, 2)


async def adjust_vendor_stock(items: list, vendor_id: str, reverse: bool = False) -> None:
    factor = 1 if reverse else -1
    vid_query = [vendor_id]
    try:
        vid_query.append(ObjectId(vendor_id))
    except Exception:
        pass
    for item in items:
        bc = (item.get("barcode") or "").strip()
        amended = item.get("amendedQty")
        if amended is not None and float(amended or 0) > 0:
            qty = float(amended)
        else:
            qty = float(item.get("quantity") or item.get("originalQty") or 0)
        if not bc or qty == 0:
            continue
        if bc.startswith("ITEM/") or bc.startswith("WALKIN/"):
            continue
        prod = await product_collection.find_one(
            {"barcode": bc, "vendor_id": {"$in": vid_query}},
            {"_id": 1, "quantity": 1}
        )
        if prod:
            current = float(prod.get("quantity", 0) or 0)
            new_qty = max(0.0, round(current + (factor * qty), 4))
            await product_collection.update_one(
                {"_id": prod["_id"]},
                {"$set": {"quantity": new_qty, "updatedAt": datetime.utcnow()}}
            )
            continue
        parent = await product_collection.find_one(
            {"variants.barcode": bc, "vendor_id": {"$in": vid_query}},
            {"_id": 1, "variants": 1}
        )
        if parent:
            for idx, v in enumerate(parent.get("variants", [])):
                if (v.get("barcode") or "").strip() == bc:
                    current   = float(v.get("stock", 0) or 0)
                    new_stock = max(0.0, round(current + (factor * qty), 4))
                    await product_collection.update_one(
                        {"_id": parent["_id"]},
                        {"$set": {
                            f"variants.{idx}.stock": new_stock,
                            "updatedAt": datetime.utcnow(),
                        }}
                    )
                    break


# â”€â”€â”€ Share link helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _make_share_link(token: str) -> str:
    return f"{APP_BASE_URL}/po-view/{token}"


def _po_public_payload(po: dict) -> dict:
    """Sanitised PO data safe to expose on the public link (no internal IDs)."""
    wv = po.get("walkin_vendor") or {}
    return {
        "orderNo":      po.get("orderNo", ""),
        "orderDate":    po.get("orderDate", ""),
        "validTill":    po.get("validTill", ""),
        "ownerSite":    po.get("ownerSite", ""),
        "vendorName":   po.get("vendorName", ""),
        "vendor_type":  po.get("vendor_type", "registered"),
        "walkin_vendor": {
            "name":           wv.get("name", ""),
            "contact_person": wv.get("contact_person", ""),
            "mobile":         wv.get("mobile", ""),
            "email":          wv.get("email", ""),
            "address":        wv.get("address", ""),
            "gstin":          wv.get("gstin", ""),
        },
        "currency":     po.get("currency", "INR"),
        "status":       po.get("status", ""),
        "netAmount":    po.get("netAmount", 0),
        "basicValue":   po.get("basicValue", 0),
        "taxAmount":    po.get("taxAmount", 0),
        "grossAmount":  po.get("grossAmount", 0),
        "notes":        po.get("notes", ""),
        "otherTerms":   po.get("otherTerms", ""),
        "po_viewed_at": po.get("po_viewed_at", None),
        "vendor_accepted_at": po.get("vendor_accepted_at", None),
        "token_expires_at":   str(po.get("token_expires_at", "")),
        "items": [
            {
                "barcode":     it.get("barcode", ""),
                "description": it.get("description", ""),
                "quantity":    it.get("quantity", 0),
                "rate":        it.get("rate", 0),
                "amount":      it.get("amount", 0),
                "dueDate":     it.get("dueDate", ""),
                "remarks":     it.get("remarks", ""),
                "taxPct":      it.get("taxPct", 0),
                "taxAmount":   it.get("taxAmount", 0),
            }
            for it in po.get("items", [])
            if not it.get("removed")
        ],
    }


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# STANDARD ROUTES â€” all now tenant-scoped via get_hq_tenant
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
'''
@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_po(po: PurchaseOrderModel, ctx: dict = Depends(get_hq_tenant)):
    po_dict = po.dict()
    po_dict["tenant_id"] = ctx["tenant_id"]

    if not po_dict.get("orderNo"):
        po_dict["orderNo"] = await generate_po_number(ctx["tenant_id"])

    for item in po_dict.get("items", []):
        item["barcode"] = await resolve_real_barcode(item)

    # â”€â”€ Vendor resolution â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if po_dict.get("vendor_type") == "walkin":
        po_dict["vendor_id"] = None
        # Generate share token for walkin vendors
        token = str(uuid.uuid4())
        po_dict["share_token"]      = token
        po_dict["token_expires_at"] = datetime.utcnow() + timedelta(days=TOKEN_EXPIRY_DAYS)
        po_dict["po_viewed_at"]     = None
        po_dict["vendor_accepted_at"] = None
        share_link = _make_share_link(token)
    else:
        vendor_name = po_dict.get("vendorName")
        if vendor_name:
            # âš ï¸ FIXED: previously filtered vendors_collection by "tenant_id"
            # directly â€” that field no longer exists on vendor identities
            # (moved to vendor_tenant_links_collection under the identity/
            # tenant-link split). This 404'd EVERY registered-vendor PO
            # creation, every time, since the split shipped. Fixed to find
            # the identity by name, then separately verify an Approved link
            # exists for this tenant.
            vendor = await vendors_collection.find_one({
                "$or": [{"vendor_name": vendor_name}, {"name": vendor_name}],
            })
            if not vendor:
                raise HTTPException(
                    status_code=404,
                    detail=f"Vendor '{vendor_name}' not found. "
                           f"For unregistered vendors set vendor_type to 'walkin'."
                )
            approved_link = await vendor_tenant_links_collection.find_one({
                "vendor_id": vendor["_id"],
                "tenant_id": ctx["tenant_id"],
                "status":    "Approved",
            })
            if not approved_link:
                raise HTTPException(
                    status_code=404,
                    detail=f"Vendor '{vendor_name}' does not have an approved relationship "
                           f"with your retailer. For unregistered vendors set vendor_type to 'walkin'."
                )
            po_dict["vendor_id"] = vendor["_id"]
        share_link = None

    calculate_po_totals(po_dict)
    po_dict["_id"]       = ObjectId()
    po_dict["createdAt"] = datetime.utcnow()
    po_dict["updatedAt"] = datetime.utcnow()

    await purchaseorders_collection.insert_one(po_dict)

    po_dict["id"] = str(po_dict.pop("_id"))
    if po_dict.get("vendor_id"):
        po_dict["vendor_id"] = str(po_dict["vendor_id"])

    response = {"message": "Purchase Order created successfully", "order": po_dict}
    if share_link:
        response["share_link"] = share_link
        response["share_token"] = token
        # WhatsApp message pre-filled
        wv   = po_dict.get("walkin_vendor") or {}
        mob  = wv.get("mobile", "")
        name = wv.get("name") or po_dict.get("vendorName", "")
        wa_text = (
            f"Dear {name},\n\n"
            f"A Purchase Order {po_dict['orderNo']} has been raised for you "
            f"from {po_dict.get('ownerSite', 'us')} "
            f"dated {po_dict.get('orderDate', '')}.\n\n"
            f"Total Value: {po_dict.get('currency','INR')} {po_dict.get('netAmount',0):,.2f}\n\n"
            f"Please view and accept your PO here:\n{share_link}\n\n"
            f"This link is valid for {TOKEN_EXPIRY_DAYS} days.\n"
            f"Regards,\n{po_dict.get('ownerSite', 'RMS')}"
        )
        response["whatsapp_message"] = wa_text
        response["whatsapp_mobile"]  = mob

    return response
'''
@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_po(po: PurchaseOrderModel, ctx: dict = Depends(get_hq_tenant)):
    po_dict = po.dict()
    po_dict["tenant_id"] = ctx["tenant_id"]
    # Immutable audit identity: always use the authenticated HQ buyer,
    # never the editable PO form contact field.
    po_dict["raised_by_user_id"] = str(ctx.get("admin_id") or "")
    po_dict["raised_by_name"] = ctx.get("admin_name") or "HQ Buyer"
    po_dict["raised_by_department"] = ctx.get("department") or ""
    if not po_dict.get("orderNo"):
        po_dict["orderNo"] = await generate_po_number(ctx["tenant_id"])

    for item in po_dict.get("items", []):
        item["barcode"] = await resolve_real_barcode(item)

    # â”€â”€ Vendor resolution â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if po_dict.get("vendor_type") == "walkin":
        po_dict["vendor_id"] = None
        # Generate share token for walkin vendors
        token = str(uuid.uuid4())
        po_dict["share_token"]      = token
        po_dict["token_expires_at"] = datetime.utcnow() + timedelta(days=TOKEN_EXPIRY_DAYS)
        po_dict["po_viewed_at"]     = None
        po_dict["vendor_accepted_at"] = None
        share_link = _make_share_link(token)
    else:
        vendor_name = po_dict.get("vendorName")
        if vendor_name:
            # Case/whitespace-insensitive match â€” prevents a slightly
            # different typing of the same vendor's name from failing to
            # resolve to the correct (single, deduplicated) identity.
            name_pattern = re.escape(vendor_name.strip())
            vendor = await vendors_collection.find_one({
                "$or": [
                    {"vendor_name": {"$regex": f"^{name_pattern}$", "$options": "i"}},
                    {"name":        {"$regex": f"^{name_pattern}$", "$options": "i"}},
                ],
            })
            if not vendor:
                raise HTTPException(
                    status_code=404,
                    detail=f"Vendor '{vendor_name}' not found. "
                           f"For unregistered vendors set vendor_type to 'walkin'."
                )
            approved_link = await vendor_tenant_links_collection.find_one({
                "vendor_id": vendor["_id"],
                "tenant_id": ctx["tenant_id"],
                "status":    "Approved",
            })
            if not approved_link:
                raise HTTPException(
                    status_code=404,
                    detail=f"Vendor '{vendor_name}' does not have an approved relationship "
                           f"with your retailer. For unregistered vendors set vendor_type to 'walkin'."
                )
            po_dict["vendor_id"] = vendor["_id"]
        share_link = None

    calculate_po_totals(po_dict)
    po_dict["_id"]       = ObjectId()
    po_dict["createdAt"] = datetime.utcnow()
    po_dict["updatedAt"] = datetime.utcnow()

    await purchaseorders_collection.insert_one(po_dict)

    po_dict["id"] = str(po_dict.pop("_id"))
    if po_dict.get("vendor_id"):
        po_dict["vendor_id"] = str(po_dict["vendor_id"])

    response = {"message": "Purchase Order created successfully", "order": po_dict}
    if share_link:
        response["share_link"] = share_link
        response["share_token"] = token
        # WhatsApp message pre-filled
        wv   = po_dict.get("walkin_vendor") or {}
        mob  = wv.get("mobile", "")
        name = wv.get("name") or po_dict.get("vendorName", "")
        wa_text = (
            f"Dear {name},\n\n"
            f"A Purchase Order {po_dict['orderNo']} has been raised for you "
            f"from {po_dict.get('ownerSite', 'us')} "
            f"dated {po_dict.get('orderDate', '')}.\n\n"
            f"Total Value: {po_dict.get('currency','INR')} {po_dict.get('netAmount',0):,.2f}\n\n"
            f"Please view and accept your PO here:\n{share_link}\n\n"
            f"This link is valid for {TOKEN_EXPIRY_DAYS} days.\n"
            f"Regards,\n{po_dict.get('ownerSite', 'RMS')}"
        )
        response["whatsapp_message"] = wa_text
        response["whatsapp_mobile"]  = mob

    return response

@router.get("/")
async def get_all_purchase_orders(ctx: dict = Depends(get_hq_tenant)):
    orders = []
    async for o in purchaseorders_collection.find({"tenant_id": ctx["tenant_id"]}):
        o["id"]        = objid(o["_id"])
        del o["_id"]
        o["vendor_id"] = objid(o.get("vendor_id"))
        orders.append(o)
    return orders


@router.get("/vendor/{vendor_name}")
async def get_vendor_purchase_orders(vendor_name: str):
    raise HTTPException(
        status_code=410,
        detail="This name-based vendor lookup is retired. Use /api/vendors/my-purchaseorders with a vendor token.",
    )
    """
    Vendor-facing route â€” intentionally NOT tenant-gated with get_hq_tenant,
    since this is called by a logged-in vendor (not an HQ admin) using their
    own vendor session. Vendor identity is already implicitly tenant-scoped
    because a vendor account belongs to exactly one tenant.

    NOTE: if this route is called with no vendor auth at all today, that's a
    separate issue â€” it should require vendor auth (see vendor_routes.py's
    get_my_purchase_orders for the authenticated equivalent) and this
    name-only lookup route should probably be retired in favor of that one.
    """
    query = {
        "vendorName": {"$regex": f"^{vendor_name.strip()}\\s*$", "$options": "i"},
        "status": {"$in": ["SentToVendor", "VendorSubmitted", "Approved"]}
    }
    docs = await purchaseorders_collection.find(query).to_list(None)
    orders = []
    for o in docs:
        o["_id"] = objid(o["_id"])
        o["id"]  = o["_id"]
        if o.get("vendor_id"):
            o["vendor_id"] = objid(o["vendor_id"])
        orders.append(o)
    return orders


@router.get("/{po_id}", response_model=PurchaseOrderModel)
async def get_purchase_order(po_id: str, ctx: dict = Depends(get_hq_tenant)):
    try:
        po = await purchaseorders_collection.find_one({
            "_id": ObjectId(po_id),
            "tenant_id": ctx["tenant_id"],
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Purchase Order ID")
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    po["id"]        = objid(po["_id"])
    del po["_id"]
    po["vendor_id"] = objid(po.get("vendor_id"))
    return PurchaseOrderModel(**po)

'''
@router.put("/{po_id}")
async def update_purchase_order(po_id: str, po: PurchaseOrderModel, ctx: dict = Depends(get_hq_tenant)):
    po_dict = po.dict(exclude_unset=True)
    po_dict.pop("tenant_id", None)   # never let the client body overwrite this
    po_dict["updatedAt"] = datetime.utcnow()

    if po_dict.get("vendor_type") == "walkin":
        pass  # no vendor lookup for walk-in
    elif "vendorName" in po_dict:
        # Same fix as create_po above â€” vendors_collection has no tenant_id
        # anymore; verify via an Approved link instead.
        vendor = await vendors_collection.find_one({
            "$or": [{"vendor_name": po_dict["vendorName"]}, {"name": po_dict["vendorName"]}],
        })
        if not vendor:
            raise HTTPException(
                status_code=400,
                detail=f"Vendor '{po_dict['vendorName']}' not found."
            )
        approved_link = await vendor_tenant_links_collection.find_one({
            "vendor_id": vendor["_id"],
            "tenant_id": ctx["tenant_id"],
            "status":    "Approved",
        })
        if not approved_link:
            raise HTTPException(
                status_code=400,
                detail=f"Vendor '{po_dict['vendorName']}' does not have an approved "
                       f"relationship with your retailer."
            )
        po_dict["vendor_id"] = vendor["_id"]

    for item in po_dict.get("items", []):
        item["barcode"] = await resolve_real_barcode(item)

    calculate_po_totals(po_dict)

    try:
        result = await purchaseorders_collection.update_one(
            {"_id": ObjectId(po_id), "tenant_id": ctx["tenant_id"]},
            {"$set": po_dict}
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Purchase Order ID")

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    return {"message": "Purchase order updated successfully"}
'''


@router.put("/{po_id}")
async def update_purchase_order(po_id: str, po: PurchaseOrderModel, ctx: dict = Depends(get_hq_tenant)):
    po_dict = po.dict(exclude_unset=True)
    po_dict.pop("tenant_id", None)   # never let the client body overwrite this
    po_dict["updatedAt"] = datetime.utcnow()

    if po_dict.get("vendor_type") == "walkin":
        pass  # no vendor lookup for walk-in
    elif "vendorName" in po_dict:
        # Same case/whitespace-insensitive fix as create_po above.
        name_pattern = re.escape(po_dict["vendorName"].strip())
        vendor = await vendors_collection.find_one({
            "$or": [
                {"vendor_name": {"$regex": f"^{name_pattern}$", "$options": "i"}},
                {"name":        {"$regex": f"^{name_pattern}$", "$options": "i"}},
            ],
        })
        if not vendor:
            raise HTTPException(
                status_code=400,
                detail=f"Vendor '{po_dict['vendorName']}' not found."
            )
        approved_link = await vendor_tenant_links_collection.find_one({
            "vendor_id": vendor["_id"],
            "tenant_id": ctx["tenant_id"],
            "status":    "Approved",
        })
        if not approved_link:
            raise HTTPException(
                status_code=400,
                detail=f"Vendor '{po_dict['vendorName']}' does not have an approved "
                       f"relationship with your retailer."
            )
        po_dict["vendor_id"] = vendor["_id"]

    for item in po_dict.get("items", []):
        item["barcode"] = await resolve_real_barcode(item)

    calculate_po_totals(po_dict)

    try:
        result = await purchaseorders_collection.update_one(
            {"_id": ObjectId(po_id), "tenant_id": ctx["tenant_id"]},
            {"$set": po_dict}
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Purchase Order ID")

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    return {"message": "Purchase order updated successfully"}

@router.post("/{po_id}/send-to-vendor")
async def send_po_to_vendor(po_id: str, ctx: dict = Depends(get_hq_tenant)):
    try:
        po = await purchaseorders_collection.find_one({
            "_id": ObjectId(po_id),
            "tenant_id": ctx["tenant_id"],
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Purchase Order ID")
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if po.get("vendor_type") == "walkin":
        raise HTTPException(
            status_code=400,
            detail="Walk-in vendors cannot use the portal send flow. Share the PO link instead."
        )
    if not po.get("vendor_id"):
        raise HTTPException(status_code=400, detail="Vendor not linked to this PO")
    if po.get("status") != "Pending":
        raise HTTPException(status_code=400, detail="PO already sent or processed")
    await purchaseorders_collection.update_one(
        {"_id": ObjectId(po_id), "tenant_id": ctx["tenant_id"]},
        {"$set": {"status": "SentToVendor", "updatedAt": datetime.utcnow()}}
    )
    return {"message": f"PO sent to vendor '{po.get('vendorName')}' successfully"}


@router.post("/{po_id}/approve-vendor")
async def approve_vendor_submission(po_id: str, ctx: dict = Depends(get_hq_tenant)):
    po = await purchaseorders_collection.find_one({
        "_id": ObjectId(po_id),
        "tenant_id": ctx["tenant_id"],
    })
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if po.get("status") != "VendorSubmitted":
        raise HTTPException(status_code=400, detail="No vendor submission to approve")

    updated_items = []
    total_basic = 0.0
    for item in po.get("items", []):
        item = dict(item)
        vendor_rate = float(item.get("vendorRate") or item.get("rate") or 0)
        amended_qty = float(item.get("amendedQty") or item.get("quantity") or 0)
        tax_pct     = float(item.get("taxPct", 0) or 0)
        disc_pct    = float(item.get("discountPct", 0) or 0)
        basic        = amended_qty * vendor_rate
        discount_amt = round(basic * (disc_pct / 100), 2)
        taxable      = basic - discount_amt
        tax_amt      = round(taxable * (tax_pct / 100), 2)
        line_total   = round(taxable + tax_amt, 2)
        item["rate"]           = vendor_rate
        item["quantity"]       = amended_qty
        item["amount"]         = line_total
        item["taxAmount"]      = tax_amt
        item["discountAmount"] = discount_amt
        item["pendingQty"]     = max(0.0, amended_qty - float(item.get("receivedQty", 0) or 0))
        item["agreedRate"]     = vendor_rate
        item["approvedAt"]     = datetime.utcnow().isoformat()
        updated_items.append(item)
        total_basic += basic

    freight          = float(po.get("freightCharges", 0) or 0)
    overall_discount = float(po.get("overallDiscount", 0) or 0)
    gross_amount     = round(total_basic - overall_discount, 2)
    total_tax        = sum(float(it.get("taxAmount", 0) or 0) for it in updated_items)
    net_amount       = round(gross_amount + freight + total_tax, 2)

    await purchaseorders_collection.update_one(
        {"_id": ObjectId(po_id), "tenant_id": ctx["tenant_id"]},
        {"$set": {
            "status":                 "Approved",
            "vendor_response.status": "Approved",
            "items":                  updated_items,
            "basicValue":             round(total_basic, 2),
            "grossAmount":            gross_amount,
            "taxAmount":              round(total_tax, 2),
            "netAmount":              net_amount,
            "updatedAt":              datetime.utcnow(),
        }}
    )
    return {"message": "Vendor submission approved", "netAmount": net_amount}


@router.post("/{po_id}/reject")
async def reject_po(po_id: str, payload: dict = {}, ctx: dict = Depends(get_hq_tenant)):
    reason = (payload.get("reason") or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="A rejection reason is required.")
    try:
        po = await purchaseorders_collection.find_one({
            "_id": ObjectId(po_id),
            "tenant_id": ctx["tenant_id"],
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid PO ID")
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if po.get("status") != "VendorSubmitted":
        raise HTTPException(status_code=400, detail=f"Only VendorSubmitted POs can be rejected.")
    vendor_id = str(po.get("vendor_id") or "")
    if vendor_id:
        await adjust_vendor_stock(po.get("items", []), vendor_id, reverse=True)
    await purchaseorders_collection.update_one(
        {"_id": ObjectId(po_id), "tenant_id": ctx["tenant_id"]},
        {"$set": {"status": "Rejected", "rejectionReason": reason, "updatedAt": datetime.utcnow()}}
    )
    return {"message": f"PO '{po.get('orderNo')}' rejected.", "reason": reason}


@router.post("/{po_id}/cancel")
async def cancel_po(po_id: str, payload: dict = {}, ctx: dict = Depends(get_hq_tenant)):
    reason = (payload.get("reason") or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="A cancellation reason is required.")
    try:
        po = await purchaseorders_collection.find_one({
            "_id": ObjectId(po_id),
            "tenant_id": ctx["tenant_id"],
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid PO ID")
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if po.get("status") in ("Cancelled", "StockUpdated"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel a PO with status '{po.get('status')}'.")
    stock_action = "skipped"
    if po.get("status") in ("VendorSubmitted", "Approved", "PartiallyReceived", "FullyReceived"):
        vendor_id = str(po.get("vendor_id") or "")
        if vendor_id:
            await adjust_vendor_stock(po.get("items", []), vendor_id, reverse=True)
            stock_action = "restored"
    await purchaseorders_collection.update_one(
        {"_id": ObjectId(po_id), "tenant_id": ctx["tenant_id"]},
        {"$set": {"status": "Cancelled", "cancellationReason": reason, "updatedAt": datetime.utcnow()}}
    )
    return {"message": f"PO '{po.get('orderNo')}' cancelled.", "stock_action": stock_action}


@router.delete("/{po_id}")
async def delete_purchase_order(po_id: str, ctx: dict = Depends(get_hq_tenant)):
    try:
        po = await purchaseorders_collection.find_one({
            "_id": ObjectId(po_id),
            "tenant_id": ctx["tenant_id"],
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Purchase Order ID")
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    stock_action = "skipped"
    if po.get("status") in ("VendorSubmitted", "Approved", "PartiallyReceived", "FullyReceived"):
        vendor_id = str(po.get("vendor_id") or "")
        if vendor_id:
            await adjust_vendor_stock(po.get("items", []), vendor_id, reverse=True)
            stock_action = "restored"
    await purchaseorders_collection.delete_one({"_id": ObjectId(po_id), "tenant_id": ctx["tenant_id"]})
    return {"message": f"Purchase order '{po.get('orderNo')}' deleted successfully", "stock_action": stock_action}


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Vendor-session auth for the two vendor-facing routes below.
#
# âš ï¸ FIX APPLIED: vendor_add_items and vendor_submit_po previously took NO
# auth parameter at all â€” anyone who knew or guessed a PO's Mongo _id could
# submit fake items/rates and flip its status, with no login required. This
# was flagged early in this conversation but never actually implemented
# until now. Uses the same JWT shape vendor_routes.py's vendor login issues
# ({"vendor_id": ..., "email": ...}), decoded with the same secret/algorithm
# deps.py uses for admin tokens â€” vendor tokens and admin tokens are
# distinguished by payload shape (vendor_id present vs role="ADMIN"), not by
# a different secret.
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _decode_vendor_token(authorization: str) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization token missing")
    token = authorization.split(" ")[1]
    try:
        decoded = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    vendor_id = decoded.get("vendor_id")
    if not vendor_id:
        raise HTTPException(status_code=403, detail="This endpoint requires a vendor account.")
    return decoded


def _verify_po_belongs_to_vendor(po: dict, vendor_id: str):
    po_vendor_id = str(po.get("vendor_id") or "")
    if not po_vendor_id or po_vendor_id != str(vendor_id):
        raise HTTPException(
            status_code=403,
            detail="This purchase order is not assigned to your vendor account."
        )


@router.post("/{po_id}/items")
async def vendor_add_items(po_id: str, payload: dict, authorization: str = Header(None)):
    """
    Vendor-facing route (vendor adds draft items to a PO sent to them).
    Not gated by get_hq_tenant â€” this is the vendor's own session, not an
    HQ admin's â€” but NOW requires a valid vendor JWT, and verifies the PO
    is actually assigned to the calling vendor before allowing any writes.
    """
    decoded   = _decode_vendor_token(authorization)
    vendor_id = decoded["vendor_id"]

    try:
        po = await purchaseorders_collection.find_one({"_id": ObjectId(po_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Purchase Order ID")
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    _verify_po_belongs_to_vendor(po, vendor_id)

    if po.get("status") not in ("SentToVendor", "VendorSubmitted", "WalkinAccepted"):
        raise HTTPException(
            status_code=400,
            detail="Items can only be added when PO status is SentToVendor, VendorSubmitted or WalkinAccepted"
        )
    new_items = payload.get("items", [])
    for item in new_items:
        item["barcode"] = await resolve_real_barcode(item)

    existing_items = list(po.get("vendor_response", {}).get("items", []))

    # Build description index for ITEM/ entries so vendor's real barcode replaces them
    # instead of creating a duplicate entry
    desc_to_idx: dict = {}
    for i, it in enumerate(existing_items):
        desc = (it.get("description") or "").strip().lower()
        bc   = (it.get("barcode") or "").strip()
        if desc and bc.startswith("ITEM/"):
            desc_to_idx[desc] = i

    for item in new_items:
        bc   = (item.get("barcode") or "").strip()
        desc = (item.get("description") or "").strip().lower()

        if desc and desc in desc_to_idx and not bc.startswith("ITEM/"):
            # Vendor's real barcode replaces ITEM/ placeholder â€” no duplicate
            existing_items[desc_to_idx[desc]] = item
            del desc_to_idx[desc]
        else:
            # Check by exact barcode match first
            found = False
            for i, ex in enumerate(existing_items):
                if (ex.get("barcode") or "").strip() == bc:
                    existing_items[i] = item
                    found = True
                    break
            if not found:
                existing_items.append(item)

    vendor_items_merged = existing_items
    await purchaseorders_collection.update_one(
        {"_id": ObjectId(po_id)},
        {"$set": {"vendor_response.items": vendor_items_merged, "updatedAt": datetime.utcnow()}}
    )
    return {"message": "Items saved successfully", "item_count": len(vendor_items_merged)}


@router.post("/{po_id}/submit")
async def vendor_submit_po(po_id: str, authorization: str = Header(None)):
    """
    Vendor-facing route â€” now requires a valid vendor JWT and verifies PO
    ownership before allowing submission, same as vendor_add_items above.
    """
    decoded   = _decode_vendor_token(authorization)
    vendor_id = decoded["vendor_id"]

    try:
        po = await purchaseorders_collection.find_one({"_id": ObjectId(po_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Purchase Order ID")
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    _verify_po_belongs_to_vendor(po, vendor_id)

    if po.get("status") not in ("SentToVendor", "WalkinAccepted"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot submit: PO status is '{po.get('status')}', expected 'SentToVendor' or 'WalkinAccepted'"
        )
    vendor_items = po.get("vendor_response", {}).get("items", [])
    if not vendor_items:
        raise HTTPException(status_code=400, detail="Vendor has not added any items yet")
    for item in vendor_items:
        item["barcode"] = await resolve_real_barcode(item)

    merged_items = [dict(it) for it in po.get("items", [])]

    # Barcode index â€” for exact barcode match (registered vendor flow)
    bc_index: dict = {}
    for i, it in enumerate(merged_items):
        bc = (it.get("barcode") or "").strip()
        if bc:
            bc_index[bc] = i

    # Description index â€” for walkin PO items with ITEM/ barcodes
    # Vendor submits real products â†’ match by description â†’ replace ITEM/ barcode
    desc_index: dict = {}
    for i, it in enumerate(merged_items):
        desc = (it.get("description") or "").strip().lower()
        bc   = (it.get("barcode") or "").strip()
        if desc and bc.startswith("ITEM/"):
            desc_index[desc] = i

    blocked_items = []
    flagged_items = []

    for item in vendor_items:
        bc   = (item.get("barcode") or "").strip()
        desc = (item.get("description") or "").strip().lower()

        # â”€â”€ Description match: walkin flow â€” real barcode replaces ITEM/ â”€â”€â”€â”€â”€
        if not (bc and bc in bc_index) and desc and desc in desc_index:
            idx    = desc_index[desc]
            old_bc = (merged_items[idx].get("barcode") or "").strip()
            buyer_rate  = float(merged_items[idx].get("rate") or 0)
            vendor_rate = float(item.get("rate") or buyer_rate)
            qty         = float(item.get("quantity") or 0)
            merged_items[idx] = {
                **merged_items[idx],
                "barcode":        bc,           # real barcode replaces ITEM/
                "amendedQty":     qty,
                "remarks":        item.get("remarks", merged_items[idx].get("remarks", "")),
                "buyerRate":      buyer_rate,
                "vendorRate":     vendor_rate,
                "variancePct":    0.0,
                "varianceAmt":    0.0,
                "varianceStatus": "walkin_matched",
            }
            # Update bc_index with new real barcode; remove old ITEM/ entry
            if old_bc in bc_index:
                del bc_index[old_bc]
            bc_index[bc] = idx
            # Remove from desc_index â€” same description cannot match twice
            del desc_index[desc]
            continue

        # â”€â”€ Exact barcode match (registered vendor flow â€” unchanged) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if bc and bc in bc_index:
            idx         = bc_index[bc]
            buyer_rate  = float(merged_items[idx].get("rate") or 0)
            vendor_rate = float(item.get("rate") or buyer_rate)
            qty         = float(item.get("quantity") or 0)
            if buyer_rate > 0 and vendor_rate != buyer_rate:
                variance_pct = ((vendor_rate - buyer_rate) / buyer_rate) * 100
                variance_amt = (vendor_rate - buyer_rate) * qty
            else:
                variance_pct = 0.0
                variance_amt = 0.0
            abs_var = abs(variance_pct)
            if abs_var <= 3.0:
                variance_status = "auto_accepted"
            elif abs_var <= 10.0:
                variance_status = "flagged"
                flagged_items.append({"barcode": bc, "variance_pct": round(variance_pct, 2)})
            else:
                variance_status = "blocked"
                blocked_items.append({"barcode": bc, "variance_pct": round(variance_pct, 2), "variance_amt": round(variance_amt, 2)})
            merged_items[idx] = {
                **merged_items[idx],
                "amendedQty":     qty,
                "remarks":        item.get("remarks", merged_items[idx].get("remarks", "")),
                "buyerRate":      buyer_rate,
                "vendorRate":     vendor_rate,
                "variancePct":    round(variance_pct, 2),
                "varianceAmt":    round(variance_amt, 2),
                "varianceStatus": variance_status,
            }
        elif bc:
            vendor_rate = float(item.get("rate") or 0)
            merged_items.append({**item, "buyerRate": None, "vendorRate": vendor_rate, "variancePct": 0.0, "varianceAmt": 0.0, "varianceStatus": "new_item"})
            bc_index[bc] = len(merged_items) - 1
        else:
            merged_items.append(item)

    if blocked_items and not po.get("variance_override"):
        raise HTTPException(status_code=400, detail={"message": f"{len(blocked_items)} item(s) have variance > 10%.", "blocked_items": blocked_items, "action_required": "buyer_override"})

    # â”€â”€ Step 4: Remove ITEM/ duplicates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    # If vendor submitted a real barcode for same description, ITEM/ entry is
    # now redundant â€” remove it to prevent duplicates in review modal
    real_desc_set = {
        (it.get("description") or "").strip().lower()
        for it in merged_items
        if not (it.get("barcode") or "").startswith("ITEM/")
    }
    merged_items = [
        it for it in merged_items
        if not (
            (it.get("barcode") or "").startswith("ITEM/") and
            (it.get("description") or "").strip().lower() in real_desc_set
        )
    ]

    vendor_total = sum(
        float(it.get("amendedQty") or it.get("quantity") or 0) *
        float(it.get("vendorRate") or it.get("rate") or 0)
        for it in merged_items
    )

    vendor_id    = str(po.get("vendor_id") or "")
    stock_action = "skipped"
    # Only deduct stock on first submission â€” prevent double deduction on resubmit
    was_already_submitted = po.get("status") == "VendorSubmitted"
    if vendor_id and not was_already_submitted:
        await adjust_vendor_stock(vendor_items, vendor_id, reverse=False)
        stock_action = "deducted"
    elif vendor_id and was_already_submitted:
        stock_action = "skipped_resubmission"

    await purchaseorders_collection.update_one(
        {"_id": ObjectId(po_id)},
        {"$set": {
            "status":                       "VendorSubmitted",
            "items":                        merged_items,
            "vendorSubmittedAmount":        round(vendor_total, 2),
            "vendor_response.status":       "Submitted",
            "vendor_response.submittedAt":  datetime.utcnow().isoformat(),
            "updatedAt":                    datetime.utcnow(),
            "variance_override":            False,
        }}
    )
    return {"message": "PO submitted successfully", "stock_action": stock_action, "items_merged": len(merged_items)}


@router.post("/{po_id}/override-variance")
async def override_variance(po_id: str, payload: dict = {}, ctx: dict = Depends(get_hq_tenant)):
    reason = (payload.get("reason") or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="A reason is required for variance override.")
    try:
        po = await purchaseorders_collection.find_one({
            "_id": ObjectId(po_id),
            "tenant_id": ctx["tenant_id"],
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid PO ID")
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if po.get("status") not in ("SentToVendor", "WalkinAccepted"):
        raise HTTPException(
            status_code=400,
            detail=f"Override only applicable for SentToVendor or WalkinAccepted POs. Current: '{po.get('status')}'"
        )
    await purchaseorders_collection.update_one(
        {"_id": ObjectId(po_id), "tenant_id": ctx["tenant_id"]},
        {"$set": {"variance_override": True, "variance_override_reason": reason, "variance_override_at": datetime.utcnow(), "updatedAt": datetime.utcnow()}}
    )
    return {"message": f"Variance override granted. Vendor can now resubmit.", "reason": reason}


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# WALKIN VENDOR â€” SHARE LINK ROUTES
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

@router.get("/share/{po_id}/link")
async def get_share_link(po_id: str, ctx: dict = Depends(get_hq_tenant)):
    """
    Admin calls this to get/regenerate the share link for a walkin PO.
    Also returns a pre-filled WhatsApp message.
    """
    try:
        po = await purchaseorders_collection.find_one({
            "_id": ObjectId(po_id),
            "tenant_id": ctx["tenant_id"],
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid PO ID")
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")
    if po.get("vendor_type") != "walkin":
        raise HTTPException(status_code=400, detail="Share links are only for walk-in vendor POs.")

    token = po.get("share_token")
    expires_at = po.get("token_expires_at")

    # Regenerate token if expired or missing
    if not token or (expires_at and datetime.utcnow() > expires_at):
        token = str(uuid.uuid4())
        expires_at = datetime.utcnow() + timedelta(days=TOKEN_EXPIRY_DAYS)
        await purchaseorders_collection.update_one(
            {"_id": ObjectId(po_id), "tenant_id": ctx["tenant_id"]},
            {"$set": {"share_token": token, "token_expires_at": expires_at, "updatedAt": datetime.utcnow()}}
        )

    share_link = _make_share_link(token)
    wv   = po.get("walkin_vendor") or {}
    mob  = wv.get("mobile", "")
    name = wv.get("name") or po.get("vendorName", "Vendor")

    wa_text = (
        f"Dear {name},\n\n"
        f"A Purchase Order *{po.get('orderNo')}* has been raised for you "
        f"from {po.get('ownerSite', 'us')} dated {po.get('orderDate', '')}.\n\n"
        f"*Total Value: {po.get('currency','INR')} {po.get('netAmount',0):,.2f}*\n\n"
        f"Please view and accept your PO using this link:\n{share_link}\n\n"
        f"_(Link valid for {TOKEN_EXPIRY_DAYS} days)_\n"
        f"Regards,\n{po.get('ownerSite', 'RMS')}"
    )

    return {
        "share_link":       share_link,
        "share_token":      token,
        "expires_at":       str(expires_at),
        "po_viewed_at":     str(po.get("po_viewed_at") or "Not yet viewed"),
        "vendor_accepted_at": str(po.get("vendor_accepted_at") or "Not yet accepted"),
        "whatsapp_message": wa_text,
        "whatsapp_mobile":  mob,
        "whatsapp_url":     f"https://wa.me/{mob.replace('+','').replace(' ','')}?text={wa_text}" if mob else "",
    }


# â”€â”€â”€ PUBLIC â€” no auth required â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# These three routes are correctly left un-gated: the walk-in vendor has no
# account/session yet. Instead of tenant_id coming from a JWT, it comes from
# the PO itself (looked up via the unguessable share_token), and is then
# propagated onto anything these routes create.

@router.get("/public/{token}")
async def public_view_po(token: str):
    """
    Public route â€” no login needed.
    Vendor opens the share link, this returns the PO data.
    Marks po_viewed_at on first access.
    """
    po = await purchaseorders_collection.find_one({"share_token": token})
    if not po:
        raise HTTPException(status_code=404, detail="Invalid or expired link.")

    expires_at = po.get("token_expires_at")
    if expires_at and datetime.utcnow() > expires_at:
        raise HTTPException(status_code=410, detail="This PO link has expired. Please contact the buyer.")

    # Mark first view timestamp
    if not po.get("po_viewed_at"):
        await purchaseorders_collection.update_one(
            {"share_token": token},
            {"$set": {"po_viewed_at": datetime.utcnow(), "updatedAt": datetime.utcnow()}}
        )
        po["po_viewed_at"] = datetime.utcnow()

    return {"status": "success", "data": _po_public_payload(po)}


@router.post("/public/{token}/accept")
async def public_accept_po(token: str, payload: dict = {}):
    """
    Vendor accepts the PO from the public link.
    Optionally updates contact details.
    Sets status to WalkinAccepted â€” admin can then proceed to GRN.
    """
    po = await purchaseorders_collection.find_one({"share_token": token})
    if not po:
        raise HTTPException(status_code=404, detail="Invalid or expired link.")

    expires_at = po.get("token_expires_at")
    if expires_at and datetime.utcnow() > expires_at:
        raise HTTPException(status_code=410, detail="This link has expired.")

    if po.get("status") in ("Approved", "Cancelled", "Rejected"):
        raise HTTPException(status_code=400, detail=f"PO cannot be accepted â€” current status: {po.get('status')}")

    # Optionally update walkin vendor contact details from what vendor fills in
    update: dict = {
        "vendor_accepted_at": datetime.utcnow(),
        "status":             "WalkinAccepted",
        "updatedAt":          datetime.utcnow(),
    }

    # If vendor provided updated contact info, merge it
    contact = payload.get("contact") or {}
    if contact:
        existing_wv = dict(po.get("walkin_vendor") or {})
        for field in ("mobile", "email", "address", "gstin", "contact_person"):
            if contact.get(field):
                existing_wv[field] = contact[field]
        update["walkin_vendor"] = existing_wv

    # Vendor remarks on acceptance
    if payload.get("remarks"):
        update["vendor_acceptance_remarks"] = payload["remarks"]

    await purchaseorders_collection.update_one(
        {"share_token": token},
        {"$set": update}
    )

    return {
        "status":  "success",
        "message": f"PO {po.get('orderNo')} accepted successfully.",
        "orderNo": po.get("orderNo"),
    }


@router.post("/public/{token}/register")
async def public_register_vendor(token: str, payload: dict):
    """
    Vendor self-registers from the public PO link.

    âš ï¸ SCHEMA CHANGE: vendors_collection now holds only IDENTITY (name,
    contact info) â€” status/tenant_id/vendor_code live on a separate
    vendor_tenant_links_collection document, one per (vendor, tenant) pair.
    See vendor_routes.py's module docstring for the full explanation.

    SECURE FLOW:
    1. Resolves or creates a vendor IDENTITY by name/mobile/email â€” if this
       same real-world company already has an identity from working with
       a DIFFERENT retailer, that identity is REUSED rather than creating
       a duplicate login. A brand-new PENDING link is always created for
       THIS PO's tenant, regardless of whether the identity is new or
       reused.
    2. Does NOT generate a password â€” vendor sets one only the first time
       any of their relationships gets approved anywhere (see
       vendor_routes.py's approve_vendor).
    3. Admin sees new Pending vendor (relationship) in their vendor panel.
    4. Admin approves â†’ confirmation email sent (only if no password set yet).
    5. Vendor clicks email link â†’ sets password â†’ logs in â†’ sees every
       retailer relationship on their "Retailers" tab.
    """
    po = await purchaseorders_collection.find_one({"share_token": token})
    if not po:
        raise HTTPException(status_code=404, detail="Invalid or expired link.")

    expires_at = po.get("token_expires_at")
    if expires_at and datetime.utcnow() > expires_at:
        raise HTTPException(status_code=410, detail="This link has expired.")

    tenant_id = po.get("tenant_id")
    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="This PO is missing tenant information. Please contact support."
        )

    wv           = po.get("walkin_vendor") or {}
    vendor_name  = payload.get("name")          or wv.get("name")          or po.get("vendorName", "")
    mobile       = payload.get("mobile")         or wv.get("mobile",   "")
    email        = payload.get("email")          or wv.get("email",    "")
    gstin        = payload.get("gstin")          or wv.get("gstin",    "")
    address      = payload.get("address")        or wv.get("address",  "")
    contact      = payload.get("contact_person") or wv.get("contact_person", "")
    pan          = payload.get("pan", "")

    if not vendor_name:
        raise HTTPException(status_code=400, detail="Vendor name is required.")
    if not mobile:
        raise HTTPException(status_code=400, detail="Mobile number is required.")

    # â”€â”€ Resolve identity by name/mobile/email â€” GLOBALLY, not tenant-scoped â”€â”€
    # This is the crux of the multi-tenant fix: identity lookup deliberately
    # is NOT filtered by tenant_id anymore, so the same real-world vendor
    # walking into two different retailers' walk-in flows gets ONE identity
    # and TWO link documents, instead of two disconnected logins.
    or_clauses = [{"vendor_name": vendor_name}, {"name": vendor_name}]
    if mobile: or_clauses.append({"mobile": mobile})
    if email:  or_clauses.append({"email":  email})

    identity = await vendors_collection.find_one({"$or": or_clauses})

    if identity:
        existing_link = await vendor_tenant_links_collection.find_one({
            "vendor_id": identity["_id"],
            "tenant_id": tenant_id,
        })
        if existing_link:
            status = existing_link.get("status", "")
            if status == "Approved":
                await purchaseorders_collection.update_one(
                    {"share_token": token},
                    {"$set": {
                        "vendor_id":   identity["_id"],
                        "vendor_type": "registered",
                        "updatedAt":   datetime.utcnow(),
                    }}
                )
                return {
                    "status":    "already_registered",
                    "message":   (
                        f"'{vendor_name}' is already a registered vendor with this retailer. "
                        f"PO has been linked to your account. Please log in to the vendor portal."
                    ),
                    "vendor_id": str(identity["_id"]),
                }
            if status == "Pending":
                return {
                    "status":  "already_pending",
                    "message": (
                        f"A registration for '{vendor_name}' with this retailer is already "
                        f"pending admin approval. Please wait for the approval email."
                    ),
                }
            # Rejected/Deactivated with this tenant specifically â€” fall
            # through and create a fresh Pending link below, since a past
            # rejection by ONE retailer shouldn't permanently block a new
            # attempt (the retailer can review and decide again).
        vendor_id = identity["_id"]
    else:
        new_identity = {
            "vendor_name":   vendor_name,
            "name":          vendor_name,
            "contact_name":  contact,
            "contactName":   contact,
            "mobile":        mobile,
            "contactMobile": mobile,
            "email":         email,
            "address":       address,
            "gstin":         gstin,
            "pan":           pan,
            "password":      None,
            "password_set":  False,
            "createdAt":     datetime.utcnow(),
            "updatedAt":     datetime.utcnow(),
        }
        result = await vendors_collection.insert_one(new_identity)
        vendor_id = result.inserted_id

    # â”€â”€ Create the per-tenant relationship link â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    new_link = {
        "vendor_id":   vendor_id,
        "tenant_id":   tenant_id,
        "status":      "Pending",
        "division":    None,
        "section":     None,
        "department":  None,
        "source":      "walkin_po_self_register",
        "source_po":   po.get("orderNo", ""),
        "created_at":  datetime.utcnow(),
        "registration_note": (
            f"Self-registered via PO public link. "
            f"PO: {po.get('orderNo', '')} | "
            f"Accepted: {'Yes' if po.get('vendor_accepted_at') else 'No'}"
        ),
    }
    await vendor_tenant_links_collection.insert_one(new_link)

    # Link PO to vendor â€” vendor_type stays "walkin" until admin approves
    await purchaseorders_collection.update_one(
        {"share_token": token},
        {"$set": {
            "vendor_id":            vendor_id,
            "vendor_registered_at": datetime.utcnow(),
            "updatedAt":            datetime.utcnow(),
        }}
    )

    return {
        "status":  "pending_approval",
        "message": (
            f"Registration submitted successfully! "
            f"'{vendor_name}' is pending admin approval. "
            f"Once approved, you will receive an email with a link to set up "
            f"your password and access the vendor portal."
        ),
        "vendor_id": str(vendor_id),
    }

