
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import secrets
from bson import ObjectId

from app.db import grc_collection, purchaseorders_collection, product_collection
from .deps import get_receiving_tenant

router = APIRouter(prefix="/grc", tags=["Goods Receipt Certificate"])


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def objid(v):
    return str(v) if isinstance(v, ObjectId) else v


# ─────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────

class GRCItemModel(BaseModel):
    # barcode is the RMS/internal stock barcode.  The supplier's label is
    # deliberately kept separately so it can never overwrite RMS stock IDs.
    barcode:         str   = ""
    vendorBarcode:   str   = ""
    poBarcode:       str   = ""
    description:     str   = ""
    poQty:           float = 0
    receivedQty:     float = 0
    acceptedQty:     float = 0
    rejectedQty:     float = 0
    rejectionReason: str   = ""
    rate:            float = 0
    remarks:         str   = ""


class GRCModel(BaseModel):
    id:               Optional[str]      = None
    grcNo:            Optional[str]      = None
    grcDate:          str
    poNo:             Optional[str]      = ""
    po_id:            Optional[str]      = None
    vendorName:       Optional[str]      = ""
    receivedBy:       str
    deliveryNote:     Optional[str]      = ""
    vehicleNo:        Optional[str]      = ""
    remarks:          Optional[str]      = ""
    status:           Optional[str]      = "Draft"

    # Direct GRC extra fields
    supplierRef:      Optional[str]      = ""
    invoiceNo:        Optional[str]      = ""

    totalReceivedQty: Optional[float]    = 0
    totalAcceptedQty: Optional[float]    = 0
    totalRejectedQty: Optional[float]    = 0
    totalValue:       Optional[float]    = 0

    items:            List[GRCItemModel] = []

    createdAt:        Optional[datetime] = Field(default_factory=datetime.utcnow)
    updatedAt:        Optional[datetime] = Field(default_factory=datetime.utcnow)


# ─────────────────────────────────────────────
# GRC Number Generator
#
# NOTE: number generation is scoped by tenant_id below (passed in explicitly)
# so GRC numbering sequences don't collide/leak across tenants. If two
# tenants each raise their first GRC of the year, both should get .../00000001
# rather than the second tenant silently continuing the first tenant's count.
# ─────────────────────────────────────────────

async def generate_grc_number(tenant_id: str) -> str:
    today = datetime.now()
    year, month = today.year, today.month
    if month >= 4:
        fy_start, fy_end = year, year + 1
    else:
        fy_start, fy_end = year - 1, year
    fy_code = f"{str(fy_start)[-2:]}-{str(fy_end)[-2:]}"

    last = await grc_collection.find_one(
        {"grcNo": {"$regex": f"GRC[/|-]\\d+/{fy_code}$"}, "tenant_id": tenant_id},
        sort=[("_id", -1)]
    )
    last_num = 0
    if last and "grcNo" in last:
        try:
            last_num = int(last["grcNo"].split("/")[1])
        except Exception:
            pass

    return f"GRC/{str(last_num + 1).zfill(8)}/{fy_code}"


# ─────────────────────────────────────────────
# Computation
# ─────────────────────────────────────────────

def compute_grc_totals(grc_dict: dict):
    """
    Per item: rejectedQty = receivedQty - acceptedQty (floor 0).
    Aggregate totals across all items.
    """
    total_received = total_accepted = total_rejected = total_value = 0.0

    for item in grc_dict.get("items", []):
        received = max(0.0, float(item.get("receivedQty", 0)))
        accepted = max(0.0, float(item.get("acceptedQty", 0)))
        rate     = max(0.0, float(item.get("rate", 0)))

        accepted = min(accepted, received)
        rejected = max(0.0, received - accepted)

        item["receivedQty"] = round(received, 4)
        item["acceptedQty"] = round(accepted, 4)
        item["rejectedQty"] = round(rejected, 4)

        total_received += received
        total_accepted += accepted
        total_rejected += rejected
        total_value    += accepted * rate

    grc_dict["totalReceivedQty"] = round(total_received, 4)
    grc_dict["totalAcceptedQty"] = round(total_accepted, 4)
    grc_dict["totalRejectedQty"] = round(total_rejected, 4)
    grc_dict["totalValue"]       = round(total_value, 2)


async def resolve_po(po_no: str, tenant_id: str) -> dict:
    """
    Resolve a PO by orderNo — scoped to tenant_id so a GRC cannot be raised
    against another tenant's PO even if the orderNo string happens to match.
    Only Approved and PartiallyReceived POs can have GRCs raised against them.
    - Approved: first GRC for this PO
    - PartiallyReceived: second (or more) GRC for remaining items
    """
    po = await purchaseorders_collection.find_one({"orderNo": po_no, "tenant_id": tenant_id})
    if not po:
        raise HTTPException(status_code=404, detail=f"Purchase Order '{po_no}' not found.")
    allowed_statuses = {"Approved", "PartiallyReceived", "WalkinAccepted"}
    if po.get("status") not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Cannot create GRC against PO '{po_no}' — "
                f"current status is '{po.get('status')}'. "
                f"PO must be Approved or PartiallyReceived."
            )
        )
    return po


# ─────────────────────────────────────────────
# Barcode resolution helper
#
# ⚠️ KNOWN GAP — not fixed in this pass (see conversation): product_collection
# has no tenant_id field yet. This lookup is global across all tenants, so a
# description match here could pull in a product that belongs to a different
# tenant. Flagging rather than guessing at the product_collection schema
# change; this needs the same tenant_id backfill work as inventory_collection
# before it can be scoped correctly.
# ─────────────────────────────────────────────

async def resolve_real_barcode_for_grc(item: dict) -> str:
    """
    Ensure every GRC item carries a real product barcode.

    Priority:
    1. If barcode already exists and is NOT an ITEM/... placeholder → keep it.
    2. Try to match by description against product_collection (exact then partial).
    3. Keep whatever barcode came from PO (even if ITEM/...) as last resort —
       update_inventory will handle ITEM/... as walk-in safely.

    NOTE: For direct/walk-in GRCs, barcodes provided by the user are always
    kept as-is (step 1 catches them). Only ITEM/... placeholders get re-resolved.
    """
    bc   = (item.get("barcode") or "").strip()
    desc = (item.get("description") or "").strip()

    # Already a real barcode — keep it (covers direct GRC barcodes too)
    if bc and not bc.startswith("ITEM/"):
        return bc

    if not desc:
        return bc

    # Exact name match
    prod = await product_collection.find_one(
        {"product_name": {"$regex": f"^{desc}$", "$options": "i"}}
    )

    # Partial name match
    if not prod:
        prod = await product_collection.find_one(
            {"product_name": {"$regex": desc, "$options": "i"}}
        )

    if prod:
        if not prod.get("has_variants"):
            real_bc = (prod.get("barcode") or "").strip()
            if real_bc:
                print(f"[GRC resolve_barcode] '{desc}' → '{real_bc}'")
                return real_bc
        else:
            variants = prod.get("variants", [])
            if variants:
                real_bc = (variants[0].get("barcode") or "").strip()
                if real_bc:
                    print(f"[GRC resolve_barcode] '{desc}' (variant) → '{real_bc}'")
                    return real_bc

    print(f"[GRC resolve_barcode] '{desc}' → no product match, keeping '{bc}'")
    return bc


async def generate_rms_barcode(tenant_id: str) -> str:
    """Generate a compact, scanner-friendly internal EAN-8-style barcode.

    The first seven digits are an RMS-local numeric identifier and the last
    digit is the standard EAN check digit. This is suitable for internal
    labels; do not use it as a GS1-assigned retail barcode outside RMS.
    """
    for _ in range(20):
        payload = f"{secrets.randbelow(10_000_000):07d}"
        weighted_sum = sum(int(digit) * (3 if index % 2 == 0 else 1) for index, digit in enumerate(reversed(payload)))
        check_digit = (10 - (weighted_sum % 10)) % 10
        candidate = f"{payload}{check_digit}"
        # Barcode labels are globally unique even though every document and
        # stock lookup remains tenant-scoped. This prevents two retailers
        # from ever receiving the same generated RMS label.
        exists_in_grc = await grc_collection.find_one({"items.barcode": candidate}, {"_id": 1})
        exists_in_product = await product_collection.find_one(
            {"$or": [{"barcode": candidate}, {"variants.barcode": candidate}]}, {"_id": 1}
        )
        if not exists_in_grc and not exists_in_product:
            return candidate
    raise HTTPException(status_code=500, detail="Could not allocate a unique RMS barcode. Please retry.")


# ─────────────────────────────────────────────
# CREATE GRC  — supports PO-linked AND Direct/Walk-in
# ─────────────────────────────────────────────

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_grc(grc: GRCModel, ctx: dict = Depends(get_receiving_tenant)):
    grc_dict = grc.dict()
    grc_dict["tenant_id"] = ctx["tenant_id"]

    po_no        = (grc_dict.get("poNo") or "").strip()
    is_po_linked = bool(po_no)

    if is_po_linked:
        # ── PO-linked flow ────────────────────────────────────────────
        po = await resolve_po(po_no, ctx["tenant_id"])
        grc_dict["po_id"]      = str(po["_id"])
        grc_dict["vendorName"] = po.get("vendorName", grc_dict.get("vendorName", ""))

        # Build barcode → PO item map for rate/qty cross-reference
        po_item_map = {}
        for it in po.get("items", []):
            po_bc = (it.get("barcode") or "").strip()
            if po_bc:
                po_item_map[po_bc] = it

    else:
        # ── Direct / walk-in flow ─────────────────────────────────────
        grc_dict["po_id"] = None
        grc_dict["poNo"]  = ""
        if not grc_dict.get("vendorName", "").strip():
            raise HTTPException(
                status_code=400,
                detail="vendorName is required for direct/walk-in GRCs."
            )

    if not grc_dict.get("grcNo"):
        grc_dict["grcNo"] = await generate_grc_number(ctx["tenant_id"])

    # ── Enrich items with real barcodes + inherit rate from PO ───────
    for item in grc_dict.get("items", []):
        item["vendorBarcode"] = (item.get("vendorBarcode") or "").strip()
        if is_po_linked and not (item.get("poBarcode") or "").strip():
            item["poBarcode"] = (item.get("barcode") or "").strip()
        item["barcode"] = await resolve_real_barcode_for_grc(item)
        if not item["barcode"] or item["barcode"].startswith("ITEM/"):
            item["barcode"] = await generate_rms_barcode(ctx["tenant_id"])

        # rate inherit is strictly inside is_po_linked block, po_match
        # check is properly nested
        if is_po_linked and not float(item.get("rate", 0)):
            po_match = po_item_map.get((item.get("poBarcode") or item["barcode"]).strip())
            if po_match:
                # Prefer vendorRate (locked-in agreed rate after buyer approval)
                # Falls back to rate (buyer's original) if PO not yet approved
                item["rate"] = float(
                    po_match.get("vendorRate") or
                    po_match.get("rate") or 0
                )

    # ── Filter ghost ITEM/ items — PO-linked only ─────────────────────
    # Direct/walk-in GRCs keep ALL items regardless of barcode format.
    if is_po_linked:
        before_count = len(grc_dict.get("items", []))
        grc_dict["items"] = [
            it for it in grc_dict.get("items", [])
            if float(it.get("receivedQty", 0)) > 0
            or not (it.get("barcode") or "").startswith("ITEM/")
        ]
        after_count = len(grc_dict["items"])
        if before_count != after_count:
            print(
                f"[create_grc] Filtered {before_count - after_count} "
                f"unresolved ITEM/ ghost item(s) from PO-linked GRC"
            )

    compute_grc_totals(grc_dict)

    grc_dict["_id"]       = ObjectId()
    grc_dict["createdAt"] = datetime.utcnow()
    grc_dict["updatedAt"] = datetime.utcnow()

    await grc_collection.insert_one(grc_dict)
    grc_dict["id"] = str(grc_dict.pop("_id"))
    return {"message": "GRC created successfully", "grc": grc_dict}


@router.get("/barcode/generate")
async def generate_barcode(ctx: dict = Depends(get_receiving_tenant)):
    """Return a new tenant-specific RMS barcode for a GRC item row."""
    return {"barcode": await generate_rms_barcode(ctx["tenant_id"])}


# ─────────────────────────────────────────────
# GET ALL GRCs
# ─────────────────────────────────────────────

@router.get("/")
async def get_all_grcs(ctx: dict = Depends(get_receiving_tenant)):
    results = []
    async for doc in grc_collection.find({"tenant_id": ctx["tenant_id"]}).sort("_id", -1):
        doc["id"] = objid(doc.pop("_id"))
        results.append(doc)
    return results


# ─────────────────────────────────────────────
# GET GRCs BY GRC NUMBER
# ─────────────────────────────────────────────

@router.get("/by-grc/{grc_no:path}")
async def get_grcs_by_grc(grc_no: str, ctx: dict = Depends(get_receiving_tenant)):
    results = []
    async for doc in grc_collection.find({"grcNo": grc_no, "tenant_id": ctx["tenant_id"]}):
        doc["id"] = objid(doc.pop("_id"))
        results.append(doc)
    return results


# ─────────────────────────────────────────────
# GET ALL GRCs FOR A PO
# ─────────────────────────────────────────────

@router.get("/by-po/{po_no:path}")
async def get_grcs_by_po(po_no: str, ctx: dict = Depends(get_receiving_tenant)):
    results = []
    async for doc in grc_collection.find({"poNo": po_no, "tenant_id": ctx["tenant_id"]}):
        doc["id"] = objid(doc.pop("_id"))
        results.append(doc)
    return results


# ─────────────────────────────────────────────
# GET SINGLE GRC
# ─────────────────────────────────────────────

@router.get("/{grc_id}")
async def get_grc(grc_id: str, ctx: dict = Depends(get_receiving_tenant)):
    try:
        doc = await grc_collection.find_one({"_id": ObjectId(grc_id), "tenant_id": ctx["tenant_id"]})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid GRC ID")
    if not doc:
        raise HTTPException(status_code=404, detail="GRC not found")
    doc["id"] = objid(doc.pop("_id"))
    return doc


# ─────────────────────────────────────────────
# UPDATE GRC
# ─────────────────────────────────────────────

@router.put("/{grc_id}")
async def update_grc(grc_id: str, grc: GRCModel, ctx: dict = Depends(get_receiving_tenant)):
    try:
        existing = await grc_collection.find_one({"_id": ObjectId(grc_id), "tenant_id": ctx["tenant_id"]})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid GRC ID")
    if not existing:
        raise HTTPException(status_code=404, detail="GRC not found")
    if existing.get("status") == "Approved":
        raise HTTPException(
            status_code=400,
            detail="Approved GRCs cannot be edited. They are legal documents."
        )

    grc_dict = grc.dict(exclude_unset=True)
    grc_dict.pop("tenant_id", None)   # never let the client body overwrite this
    grc_dict["updatedAt"] = datetime.utcnow()

    po_no        = (grc_dict.get("poNo") or "").strip()
    is_po_linked = bool(po_no)

    if is_po_linked and po_no != existing.get("poNo"):
        po = await resolve_po(po_no, ctx["tenant_id"])
        grc_dict["po_id"]      = str(po["_id"])
        grc_dict["vendorName"] = po.get("vendorName", "")
    elif not is_po_linked:
        grc_dict["po_id"] = None
        grc_dict["poNo"]  = ""

    # Re-resolve barcodes on update
    for item in grc_dict.get("items", []):
        item["vendorBarcode"] = (item.get("vendorBarcode") or "").strip()
        if is_po_linked and not (item.get("poBarcode") or "").strip():
            item["poBarcode"] = (item.get("barcode") or "").strip()
        item["barcode"] = await resolve_real_barcode_for_grc(item)
        if not item["barcode"] or item["barcode"].startswith("ITEM/"):
            item["barcode"] = await generate_rms_barcode(ctx["tenant_id"])

    # Filter ghost items only for PO-linked GRCs
    if is_po_linked:
        grc_dict["items"] = [
            it for it in grc_dict.get("items", [])
            if float(it.get("receivedQty", 0)) > 0
            or not (it.get("barcode") or "").startswith("ITEM/")
        ]

    compute_grc_totals(grc_dict)

    try:
        result = await grc_collection.update_one(
            {"_id": ObjectId(grc_id), "tenant_id": ctx["tenant_id"]}, {"$set": grc_dict}
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid GRC ID")

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="GRC not found")

    return {"message": "GRC updated successfully"}


# ─────────────────────────────────────────────
# APPROVE GRC
# ─────────────────────────────────────────────

@router.post("/{grc_id}/approve")
async def approve_grc(grc_id: str, ctx: dict = Depends(get_receiving_tenant)):
    """
    Approve the GRC:
    1. Marks GRC status as Approved
    2. For PO-linked GRCs:
       - Accumulates receivedQty per item on the PO (+=, never reset)
       - Compares against amendedQty (vendor's committed qty) — not original quantity
       - Flips PO to FullyReceived when all committed units are received
       - Otherwise keeps PO as PartiallyReceived for next delivery
    3. Direct/walk-in GRCs: approved without any PO changes
    """
    try:
        grc = await grc_collection.find_one({"_id": ObjectId(grc_id), "tenant_id": ctx["tenant_id"]})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid GRC ID")
    if not grc:
        raise HTTPException(status_code=404, detail="GRC not found")
    if grc.get("status") == "Approved":
        raise HTTPException(status_code=400, detail="GRC is already approved")
    if grc.get("status") == "Rejected":
        raise HTTPException(status_code=400, detail="Rejected GRCs cannot be approved")

    await grc_collection.update_one(
        {"_id": ObjectId(grc_id), "tenant_id": ctx["tenant_id"]},
        {"$set": {"status": "Approved", "updatedAt": datetime.utcnow()}}
    )

    # Build barcode → acceptedQty map from this GRC
    grc_items_map: dict = {}
    for item in grc.get("items", []):
        bc  = (item.get("poBarcode") or item.get("barcode") or "").strip()
        qty = float(item.get("acceptedQty", 0))
        if bc:
            grc_items_map[bc] = grc_items_map.get(bc, 0) + qty

    # Only update PO for PO-linked GRCs — scoped to tenant so approving a
    # GRC can never mutate another tenant's PO even if po_id were guessed
    if grc.get("po_id"):
        try:
            po = await purchaseorders_collection.find_one({
                "_id": ObjectId(grc["po_id"]),
                "tenant_id": ctx["tenant_id"],
            })
        except Exception:
            po = None

        if po:
            po_items       = po.get("items", [])
            fully_received = True

            for po_item in po_items:
                bc = (po_item.get("barcode") or "").strip()

                # Accumulate — never reset (supports multiple GRCs per PO)
                received  = float(po_item.get("receivedQty", 0))
                received += grc_items_map.get(bc, 0)
                po_item["receivedQty"] = round(received, 4)

                # Compare against amendedQty (vendor's committed qty)
                # not quantity (buyer's original order qty).
                ordered = float(
                    po_item.get("amendedQty") or
                    po_item.get("quantity") or 0
                )

                if received < ordered:
                    fully_received = False

                po_item["pendingQty"] = round(max(0.0, ordered - received), 4)

            new_po_status = "FullyReceived" if fully_received else "PartiallyReceived"

            await purchaseorders_collection.update_one(
                {"_id": ObjectId(grc["po_id"]), "tenant_id": ctx["tenant_id"]},
                {"$set": {
                    "items":     po_items,
                    "status":    new_po_status,
                    "updatedAt": datetime.utcnow(),
                }}
            )

            print(
                f"[approve_grc] PO '{po.get('orderNo')}' → {new_po_status} | "
                f"GRC '{grc.get('grcNo')}' accepted {sum(grc_items_map.values()):.3f} units"
            )

    flow = "PO-linked" if grc.get("po_id") else "Direct/walk-in"
    return {
        "message":          f"GRC '{grc.get('grcNo')}' approved successfully",
        "flow":             flow,
        "grcNo":            grc.get("grcNo"),
        "totalAcceptedQty": grc.get("totalAcceptedQty"),
        "totalRejectedQty": grc.get("totalRejectedQty"),
    }


# ─────────────────────────────────────────────
# REJECT GRC
# ─────────────────────────────────────────────

@router.post("/{grc_id}/reject")
async def reject_grc(grc_id: str, payload: dict = {}, ctx: dict = Depends(get_receiving_tenant)):
    reason = (payload.get("reason") or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="A rejection reason is required.")

    try:
        grc = await grc_collection.find_one({"_id": ObjectId(grc_id), "tenant_id": ctx["tenant_id"]})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid GRC ID")
    if not grc:
        raise HTTPException(status_code=404, detail="GRC not found")
    if grc.get("status") == "Approved":
        raise HTTPException(status_code=400, detail="Approved GRCs cannot be rejected.")

    await grc_collection.update_one(
        {"_id": ObjectId(grc_id), "tenant_id": ctx["tenant_id"]},
        {"$set": {
            "status":          "Rejected",
            "rejectionReason": reason,
            "updatedAt":       datetime.utcnow(),
        }}
    )
    return {"message": f"GRC '{grc.get('grcNo')}' rejected.", "reason": reason}


# ─────────────────────────────────────────────
# DELETE GRC
# ─────────────────────────────────────────────

@router.delete("/{grc_id}")
async def delete_grc(grc_id: str, ctx: dict = Depends(get_receiving_tenant)):
    try:
        existing = await grc_collection.find_one({"_id": ObjectId(grc_id), "tenant_id": ctx["tenant_id"]})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid GRC ID")
    if not existing:
        raise HTTPException(status_code=404, detail="GRC not found")
    if existing.get("status") == "Approved":
        raise HTTPException(status_code=400, detail="Approved GRCs cannot be deleted.")

    await grc_collection.delete_one({"_id": ObjectId(grc_id), "tenant_id": ctx["tenant_id"]})
    return {"message": "GRC deleted successfully"}
