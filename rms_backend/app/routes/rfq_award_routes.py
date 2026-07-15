import os
from datetime import datetime
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from ..db import catalogue_inquiries_collection, purchaseorders_collection, rfq_awards_collection, vendor_catalogue_collection, vendors_collection
from .deps import get_hq_tenant
from .purchaseorder_routes import PurchaseOrderModel, create_po
from .procurement_notification_routes import notify_buyer, notify_vendor

router = APIRouter(prefix="/api/catalogue", tags=["RFQ Awards"])
APPROVAL_THRESHOLD = float(os.environ.get("RFQ_AWARD_APPROVAL_THRESHOLD", "100000"))


def _admin_id(ctx):
    return str(ctx.get("admin_id") or ctx.get("user_id") or "")


async def _rfq_po_item(inquiry, quantity, award_id):
    quote = inquiry.get('vendor_response') or {}
    size = str(quote.get('confirmed_size') or inquiry.get('requested_size') or '').strip()
    color = str(quote.get('confirmed_color') or inquiry.get('requested_color') or '').strip()
    barcode = str(quote.get('confirmed_barcode') or quote.get('barcode') or '').strip()
    sku = str(quote.get('confirmed_sku') or quote.get('sku') or '').strip()
    catalogue_id = inquiry.get('catalogue_item_id')

    # Image-only catalogue entries have no SKU. Use an exact variant match
    # when available, but never invent or guess a barcode.
    if catalogue_id and not barcode:
        catalogue = await vendor_catalogue_collection.find_one({'_id': catalogue_id})
        if catalogue:
            barcode = str(catalogue.get('barcode') or '').strip()
            sku = sku or str(catalogue.get('sku') or '').strip()
            for variant in catalogue.get('variants') or []:
                variant_size = str(variant.get('size') or '').strip()
                variant_color = str(variant.get('color') or '').strip()
                size_matches = not size or variant_size.casefold() == size.casefold()
                color_matches = not color or variant_color.casefold() == color.casefold()
                if size_matches and color_matches and variant.get('barcode'):
                    barcode = str(variant['barcode']).strip()
                    sku = sku or str(variant.get('sku') or '').strip()
                    break

    variant_label = ' / '.join(value for value in (size, color) if value)
    description = str(inquiry.get('item_name') or '')
    if variant_label:
        description = '{} - {}'.format(description, variant_label)
    remarks = 'RFQ {}. {}'.format(
        inquiry.get('comparison_group_id') or inquiry['_id'],
        quote.get('vendor_note') or '',
    ).strip()
    return {
        'barcode': barcode,
        'sku': sku,
        'description': description,
        'size': size,
        'color': color,
        'catalogue_item_id': str(catalogue_id) if catalogue_id else None,
        'rfq_inquiry_id': str(inquiry['_id']),
        'rfq_award_id': str(award_id),
        'quantity': int(quantity),
        'rate': float(quote.get('confirmed_price') or 0),
        'remarks': remarks,
    }


def _serialize_award(row):
    return {
        "id": str(row["_id"]), "status": row.get("status"), "total_value": row.get("total_value", 0),
        "justification": row.get("justification", ""), "created_by": str(row.get("created_by") or ""),
        "approved_by": str(row.get("approved_by") or ""), "rejected_by": str(row.get("rejected_by") or ""),
        "approval_comment": row.get("approval_comment", ""), "rejection_reason": row.get("rejection_reason", ""),
        "created_at": str(row.get("created_at") or ""), "lines": [{**line, "inquiry_id": str(line.get("inquiry_id") or ""), "vendor_id": str(line.get("vendor_id") or "")} for line in row.get("lines", [])],
        "purchase_orders": row.get("purchase_orders", []),
    }


async def _execute_award(award, ctx):
    tenant_id, award_id = ctx["tenant_id"], award["_id"]
    inquiry_ids = [line["inquiry_id"] for line in award.get("lines", [])]
    inquiries = await catalogue_inquiries_collection.find({"_id": {"$in": inquiry_ids}, "tenant_id": tenant_id, "status": "Responded"}).to_list(None)
    if len(inquiries) != len(inquiry_ids):
        raise HTTPException(status_code=409, detail="One or more quotations changed before approval. Review and submit a new award.")
    inquiry_map = {row["_id"]: row for row in inquiries}
    groups = {}
    for line in award["lines"]:
        inquiry = inquiry_map[line["inquiry_id"]]
        quote = inquiry.get("vendor_response") or {}
        vendor_key = str(inquiry["vendor_id"])
        group = groups.setdefault(vendor_key, {"vendor_id": inquiry["vendor_id"], "entries": [], "items": []})
        group["entries"].append((inquiry, int(line["awarded_quantity"])))
        group["items"].append({
            "description": f"{inquiry.get('item_name', '')} ? {quote.get('confirmed_size', '')} / {quote.get('confirmed_color', '')}".strip(" ?/"),
            "quantity": int(line["awarded_quantity"]), "rate": float(line["unit_price"]),
            "remarks": f"RFQ {inquiry.get('comparison_group_id') or inquiry['_id']}. {quote.get('vendor_note', '')}".strip(),
        })

    # Feed metadata-rich lines into the existing PO creator. Everything after
    # PO creation continues through the existing approval/GRC/GRN/stock flow.
    for group in groups.values():
        group['items'] = [
            await _rfq_po_item(inquiry, quantity, award_id)
            for inquiry, quantity in group['entries']
        ]

    created_ids, po_rows = [], []
    try:
        for vendor_key, group in groups.items():
            vendor = await vendors_collection.find_one({"_id": group["vendor_id"]})
            vendor_name = (vendor or {}).get("name") or (vendor or {}).get("vendor_name")
            if not vendor_name: raise RuntimeError(f"Vendor {vendor_key} was not found.")
            response = await create_po(PurchaseOrderModel(
                orderDate=datetime.utcnow().strftime("%Y-%m-%d"), vendorName=vendor_name, vendor_id=vendor_key,
                vendor_type="registered", status="Pending", notes=f"RFQ award {award_id}. {award.get('justification','')}".strip(), items=group["items"],
            ), ctx)
            order = response.get("order") or {}; po_id = order.get("id")
            if not po_id: raise RuntimeError(f"PO creation for {vendor_name} returned no ID.")
            created_ids.append(ObjectId(po_id)); po_rows.append({"vendor_id": vendor_key, "vendor_name": vendor_name, "po_id": po_id, "order_no": order.get("orderNo", "")})

        for vendor_key, group in groups.items():
            po_info = next(row for row in po_rows if row["vendor_id"] == vendor_key)
            for inquiry, quantity in group["entries"]:
                result = await catalogue_inquiries_collection.update_one(
                    {"_id": inquiry["_id"], "tenant_id": tenant_id, "status": "Responded"},
                    {"$set": {"status": "Converted", "converted_at": datetime.utcnow(), "award_id": award_id, "awarded_quantity": quantity,
                              "purchase_order_id": ObjectId(po_info["po_id"]), "purchase_order_no": po_info["order_no"]}},
                )
                if result.modified_count != 1: raise RuntimeError(f"Inquiry {inquiry['_id']} changed during processing.")
        for po in po_rows:
            await notify_vendor(po["vendor_id"], "award_and_po_created", "RFQ awarded and purchase order created", f"Purchase order {po['order_no']} is ready.", tenant_id=tenant_id, metadata={"award_id": str(award_id), **po})
        await rfq_awards_collection.update_one({"_id": award_id}, {"$set": {"status": "PO Created", "completed_at": datetime.utcnow(), "purchase_orders": po_rows}})
        return po_rows
    except Exception as exc:
        if created_ids: await purchaseorders_collection.delete_many({"_id": {"$in": created_ids}, "tenant_id": tenant_id})
        await catalogue_inquiries_collection.update_many({"award_id": award_id, "tenant_id": tenant_id}, {"$set": {"status": "Responded"}, "$unset": {"converted_at":"", "award_id":"", "awarded_quantity":"", "purchase_order_id":"", "purchase_order_no":""}})
        await rfq_awards_collection.update_one({"_id": award_id}, {"$set": {"status": "Failed", "failed_at": datetime.utcnow(), "error": str(exc)}})
        raise HTTPException(status_code=500, detail=f"Award failed; changes were rolled back: {exc}")


@router.get("/inquiries/awards")
async def list_awards(status: str = "", ctx: dict = Depends(get_hq_tenant)):
    query = {"tenant_id": ctx["tenant_id"]}
    if status: query["status"] = status
    rows = await rfq_awards_collection.find(query).sort("created_at", -1).limit(100).to_list(None)
    return {"status": "success", "approval_threshold": APPROVAL_THRESHOLD, "data": [_serialize_award(row) for row in rows]}


@router.post("/inquiries/awards/create-pos", status_code=201)
async def create_award_purchase_orders(payload: dict, ctx: dict = Depends(get_hq_tenant)):
    tenant_id = ctx["tenant_id"]; key = (payload.get("idempotency_key") or "").strip(); awards = payload.get("awards") or []
    if not key or not awards: raise HTTPException(status_code=400, detail="Idempotency key and at least one award are required.")
    existing = await rfq_awards_collection.find_one({"tenant_id": tenant_id, "idempotency_key": key})
    if existing:
        if existing.get("status") in ("Submitted", "Approved", "PO Created"):
            return {"status": existing.get("status"), "idempotent_replay": True, "award_id": str(existing["_id"]), "purchase_orders": existing.get("purchase_orders", [])}
        raise HTTPException(status_code=409, detail=f"Award already exists with status {existing.get('status')}.")

    seen=set(); normalized=[]
    for entry in awards:
        iid=str(entry.get("inquiry_id") or ""); qty=max(0,int(entry.get("quantity") or 0))
        if not ObjectId.is_valid(iid) or iid in seen or qty<=0: raise HTTPException(status_code=400, detail="Invalid, duplicate, or zero-quantity award line.")
        seen.add(iid); normalized.append((ObjectId(iid),qty))
    inquiries=await catalogue_inquiries_collection.find({"_id":{"$in":[i for i,_ in normalized]},"tenant_id":tenant_id,"status":"Responded"}).to_list(None)
    if len(inquiries)!=len(normalized): raise HTTPException(status_code=400, detail="Every quotation must belong to this tenant and have Responded status.")
    inquiry_map={row["_id"]:row for row in inquiries}; lines=[]; new_totals={}
    for iid,qty in normalized:
        inquiry=inquiry_map[iid]; quote=inquiry.get("vendor_response") or {}; confirmed=int(quote.get("confirmed_qty") or 0); price=float(quote.get("confirmed_price") or 0)
        if qty>confirmed or price<=0: raise HTTPException(status_code=400, detail=f"Invalid award quantity or price for {inquiry.get('item_name','item')}.")
        req=f"{inquiry.get('comparison_group_id') or iid}::{inquiry.get('item_name','')}"; new_totals[req]=new_totals.get(req,0)+qty
        lines.append({"inquiry_id":iid,"vendor_id":inquiry["vendor_id"],"item_name":inquiry.get("item_name",""),"awarded_quantity":qty,"unit_price":price,"requirement_key":req})
    prior={}
    async for award in rfq_awards_collection.find({"tenant_id":tenant_id,"status":"PO Created"},{"lines":1}):
        for line in award.get("lines",[]): prior[line.get("requirement_key")]=prior.get(line.get("requirement_key"),0)+int(line.get("awarded_quantity") or 0)
    for req,qty in new_totals.items():
        sample=next(row for row in inquiries if req==f"{row.get('comparison_group_id') or row['_id']}::{row.get('item_name','')}"); requested=int(sample.get("requested_qty") or 0)
        if requested and prior.get(req,0)+qty>requested: raise HTTPException(status_code=400, detail=f"Total award exceeds requested quantity ({requested}) for {sample.get('item_name','item')}.")

    total=sum(line["awarded_quantity"]*line["unit_price"] for line in lines); needs_approval=total>=APPROVAL_THRESHOLD
    doc={"tenant_id":tenant_id,"idempotency_key":key,"status":"Submitted" if needs_approval else "Approved","total_value":total,"justification":(payload.get("justification") or "").strip(),"lines":lines,"purchase_orders":[],"created_by":_admin_id(ctx),"created_at":datetime.utcnow(),"approval_required":needs_approval}
    result=await rfq_awards_collection.insert_one(doc); doc["_id"]=result.inserted_id
    if needs_approval:
        await notify_buyer(tenant_id,"award_approval_required","Award approval required",f"An RFQ award worth ?{total:,.2f} requires approval.",metadata={"award_id":str(result.inserted_id),"total_value":total})
        return {"status":"Submitted","award_id":str(result.inserted_id),"approval_required":True,"approval_threshold":APPROVAL_THRESHOLD,"purchase_orders":[]}
    po_rows=await _execute_award(doc,ctx)
    return {"status":"PO Created","award_id":str(result.inserted_id),"approval_required":False,"purchase_orders":po_rows}


@router.post("/inquiries/awards/{award_id}/approve")
async def approve_award(award_id: str, payload: dict, ctx: dict = Depends(get_hq_tenant)):
    if not ObjectId.is_valid(award_id): raise HTTPException(status_code=400,detail="Invalid award ID.")
    award=await rfq_awards_collection.find_one({"_id":ObjectId(award_id),"tenant_id":ctx["tenant_id"]})
    if not award: raise HTTPException(status_code=404,detail="Award not found.")
    if award.get("status")=="PO Created": return {"status":"PO Created","idempotent_replay":True,"purchase_orders":award.get("purchase_orders",[])}
    if award.get("status")!="Submitted": raise HTTPException(status_code=409,detail=f"Award cannot be approved from {award.get('status')} status.")
    approver=_admin_id(ctx)
    if approver and approver==str(award.get("created_by") or ""): raise HTTPException(status_code=403,detail="The submitting buyer cannot approve their own high-value award.")
    result=await rfq_awards_collection.update_one({"_id":award["_id"],"status":"Submitted"},{"$set":{"status":"Approved","approved_by":approver,"approved_at":datetime.utcnow(),"approval_comment":(payload.get("comment") or "").strip()}})
    if result.modified_count!=1: raise HTTPException(status_code=409,detail="Award status changed; refresh and try again.")
    award["status"]="Approved"; po_rows=await _execute_award(award,ctx)
    return {"status":"PO Created","award_id":award_id,"purchase_orders":po_rows}


@router.post("/inquiries/awards/{award_id}/reject")
async def reject_award(award_id: str, payload: dict, ctx: dict = Depends(get_hq_tenant)):
    if not ObjectId.is_valid(award_id): raise HTTPException(status_code=400,detail="Invalid award ID.")
    reason=(payload.get("reason") or "").strip()
    if not reason: raise HTTPException(status_code=400,detail="Rejection reason is required.")
    approver=_admin_id(ctx)
    award=await rfq_awards_collection.find_one({"_id":ObjectId(award_id),"tenant_id":ctx["tenant_id"],"status":"Submitted"})
    if not award: raise HTTPException(status_code=404,detail="Submitted award not found.")
    if approver and approver==str(award.get("created_by") or ""): raise HTTPException(status_code=403,detail="The submitting buyer cannot reject their own award.")
    await rfq_awards_collection.update_one({"_id":award["_id"],"status":"Submitted"},{"$set":{"status":"Rejected","rejected_by":approver,"rejected_at":datetime.utcnow(),"rejection_reason":reason}})
    await notify_buyer(ctx["tenant_id"],"award_rejected","RFQ award rejected",reason,metadata={"award_id":award_id})
    return {"status":"Rejected","award_id":award_id}
