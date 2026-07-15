"""Vendor-facing accounts receivable analytics and payment disputes."""

from datetime import datetime, timedelta
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Header, HTTPException

from ..db import purchase_invoice_collection, purchaseorders_collection, tenants_collection
from .vendor_routes import decode_token
from .subscription_routes import get_vendor_tier


router = APIRouter(prefix="/api/vendor-finance", tags=["Vendor Finance"])


def _vendor_id(authorization: Optional[str]) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization token missing")
    payload = decode_token(authorization.split(" ", 1)[1])
    vendor_id = (payload or {}).get("vendor_id")
    if not vendor_id or not ObjectId.is_valid(vendor_id):
        raise HTTPException(status_code=401, detail="Invalid or expired vendor session")
    return vendor_id


def _match(vendor_id: str) -> dict:
    return {"vendor_id": {"$in": [vendor_id, ObjectId(vendor_id)]}}


def _month_keys(count: int) -> list[str]:
    now = datetime.utcnow()
    keys = []
    year, month = now.year, now.month
    for _ in range(count):
        keys.append(f"{year:04d}-{month:02d}")
        month -= 1
        if month == 0:
            month, year = 12, year - 1
    return list(reversed(keys))


@router.get("/analytics")
async def vendor_finance_analytics(authorization: str = Header(None)):
    vendor_id = _vendor_id(authorization)
    tier = await get_vendor_tier(vendor_id)
    history_months = tier["finance_history_months"]
    transaction_limit = tier["finance_transaction_limit"]
    today = datetime.utcnow().strftime("%Y-%m-%d")

    summary_rows = await purchase_invoice_collection.aggregate([
        {"$match": _match(vendor_id)},
        {"$group": {
            "_id": None,
            "invoice_count": {"$sum": 1},
            "invoiced": {"$sum": {"$ifNull": ["$invoiceTotal", 0]}},
            "paid": {"$sum": {"$ifNull": ["$paidAmount", 0]}},
            "outstanding": {"$sum": {"$ifNull": ["$balanceDue", 0]}},
            "overdue": {"$sum": {"$cond": [
                {"$and": [
                    {"$lt": ["$dueDate", today]}, {"$gt": [{"$ifNull": ["$balanceDue", 0]}, 0]},
                    {"$ne": ["$paymentStatus", "Paid"]},
                ]},
                {"$ifNull": ["$balanceDue", 0]}, 0,
            ]}},
            "overdue_count": {"$sum": {"$cond": [
                {"$and": [{"$lt": ["$dueDate", today]}, {"$gt": [{"$ifNull": ["$balanceDue", 0]}, 0]}]}, 1, 0,
            ]}},
        }},
    ]).to_list(length=1)
    summary = summary_rows[0] if summary_rows else {"invoice_count": 0, "invoiced": 0, "paid": 0, "outstanding": 0, "overdue": 0, "overdue_count": 0}
    summary.pop("_id", None)
    summary = {key: round(value, 2) if isinstance(value, float) else value for key, value in summary.items()}

    payment_status_rows = await purchase_invoice_collection.aggregate([
        {"$match": _match(vendor_id)},
        {"$group": {"_id": {"$ifNull": ["$paymentStatus", "Unpaid"]}, "count": {"$sum": 1}, "amount": {"$sum": {"$ifNull": ["$balanceDue", 0]}}}},
    ]).to_list(length=None)

    order_rows = await purchaseorders_collection.aggregate([
        {"$match": _match(vendor_id)},
        {"$group": {"_id": {"$ifNull": ["$status", "Unknown"]}, "count": {"$sum": 1}, "value": {"$sum": {"$ifNull": ["$grandTotal", {"$ifNull": ["$totalAmount", {"$ifNull": ["$netAmount", 0]}]}]}}}},
    ]).to_list(length=None)

    transaction_rows = await purchase_invoice_collection.aggregate([
        {"$match": _match(vendor_id)},
        {"$unwind": "$payments"},
        {"$sort": {"payments.recordedAt": -1}},
        {"$limit": transaction_limit},
        {"$project": {
            "_id": 0, "invoice_id": {"$toString": "$_id"}, "invoice_no": "$invoiceNo",
            "tenant_id": 1, "payment_id": "$payments.paymentId", "amount": "$payments.amount",
            "payment_date": "$payments.paymentDate", "payment_mode": "$payments.paymentMode",
            "reference_no": "$payments.referenceNo", "bank_name": "$payments.bankName",
            "remarks": "$payments.remarks", "recorded_at": "$payments.recordedAt",
        }},
    ]).to_list(length=transaction_limit)

    month_keys = _month_keys(history_months)
    monthly_rows = await purchase_invoice_collection.aggregate([
        {"$match": _match(vendor_id)}, {"$unwind": "$payments"},
        {"$match": {"payments.paymentDate": {"$gte": f"{month_keys[0]}-01"}}},
        {"$group": {"_id": {"$substrBytes": ["$payments.paymentDate", 0, 7]}, "received": {"$sum": {"$ifNull": ["$payments.amount", 0]}}}},
    ]).to_list(length=None)
    received_map = {row["_id"]: round(row["received"], 2) for row in monthly_rows if row.get("_id")}
    monthly = [{"month": key, "received": received_map.get(key, 0)} for key in month_keys]

    tenant_ids = {row.get("tenant_id") for row in transaction_rows if row.get("tenant_id")}
    tenant_names = {}
    if tenant_ids:
        async for tenant in tenants_collection.find({"tenant_id": {"$in": list(tenant_ids)}}, {"tenant_id": 1, "company_name": 1}):
            tenant_names[tenant["tenant_id"]] = tenant.get("company_name") or tenant["tenant_id"]
    for row in transaction_rows:
        row["retailer_name"] = tenant_names.get(row.get("tenant_id"), row.get("tenant_id") or "Retailer")

    outstanding_rows = await purchase_invoice_collection.find(
        {**_match(vendor_id), "balanceDue": {"$gt": 0}, "status": {"$nin": ["Cancelled"]}},
        {"invoiceNo": 1, "tenant_id": 1, "invoiceTotal": 1, "balanceDue": 1, "dueDate": 1, "paymentStatus": 1},
    ).sort("dueDate", 1).limit(50).to_list(length=50)
    outstanding = [{
        "invoice_id": str(row["_id"]), "invoice_no": row.get("invoiceNo"),
        "retailer_name": tenant_names.get(row.get("tenant_id"), row.get("tenant_id") or "Retailer"),
        "invoice_total": row.get("invoiceTotal", 0), "balance_due": row.get("balanceDue", 0),
        "due_date": row.get("dueDate"), "payment_status": row.get("paymentStatus", "Unpaid"),
        "overdue": bool(row.get("dueDate") and row.get("dueDate") < today),
    } for row in outstanding_rows]

    retailer_breakdown = []
    if tier["finance_retailer_breakdown"]:
        breakdown_rows = await purchase_invoice_collection.aggregate([
            {"$match": _match(vendor_id)},
            {"$group": {"_id": "$tenant_id", "invoiced": {"$sum": {"$ifNull": ["$invoiceTotal", 0]}}, "paid": {"$sum": {"$ifNull": ["$paidAmount", 0]}}, "outstanding": {"$sum": {"$ifNull": ["$balanceDue", 0]}}}},
            {"$sort": {"invoiced": -1}}, {"$limit": 25},
        ]).to_list(length=25)
        missing_ids = [row["_id"] for row in breakdown_rows if row.get("_id") and row["_id"] not in tenant_names]
        if missing_ids:
            async for tenant in tenants_collection.find({"tenant_id": {"$in": missing_ids}}, {"tenant_id": 1, "company_name": 1}):
                tenant_names[tenant["tenant_id"]] = tenant.get("company_name") or tenant["tenant_id"]
        retailer_breakdown = [{"tenant_id": row.get("_id"), "retailer_name": tenant_names.get(row.get("_id"), row.get("_id") or "Retailer"), "invoiced": round(row["invoiced"], 2), "paid": round(row["paid"], 2), "outstanding": round(row["outstanding"], 2)} for row in breakdown_rows]

    recent_values = [entry["received"] for entry in monthly[-3:]]
    forecast = round(sum(recent_values) / len(recent_values), 2) if tier["finance_forecasting"] and recent_values else None
    return {
        "summary": summary,
        "payment_statuses": [{"status": row["_id"], "count": row["count"], "outstanding": round(row["amount"], 2)} for row in payment_status_rows],
        "order_statuses": [{"status": row["_id"], "count": row["count"], "value": round(row["value"], 2)} for row in order_rows],
        "monthly_receipts": monthly, "transactions": transaction_rows, "outstanding_invoices": outstanding,
        "retailer_breakdown": retailer_breakdown, "forecast_next_month_receipts": forecast,
        "access": {key: tier[key] for key in ("tier", "label", "finance_history_months", "finance_transaction_limit", "finance_export", "finance_retailer_breakdown", "finance_forecasting")},
        "rules": {"transactions_editable": False, "outstanding_is_system_calculated": True},
    }


@router.post("/transactions/{invoice_id}/{payment_id}/dispute", status_code=201)
async def dispute_transaction(invoice_id: str, payment_id: str, payload: dict, authorization: str = Header(None)):
    vendor_id = _vendor_id(authorization)
    if not ObjectId.is_valid(invoice_id):
        raise HTTPException(status_code=400, detail="Invalid invoice ID")
    invoice = await purchase_invoice_collection.find_one({"_id": ObjectId(invoice_id), **_match(vendor_id)})
    if not invoice:
        raise HTTPException(status_code=404, detail="Payment transaction not found")
    payment = next((item for item in invoice.get("payments", []) if item.get("paymentId") == payment_id), None)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment transaction not found")
    description = str(payload.get("description") or "").strip()
    if len(description) < 10:
        raise HTTPException(status_code=400, detail="Please describe the payment issue in at least 10 characters")
    query = {
        "id": str(ObjectId()), "queryId": str(ObjectId()), "subject": f"Payment dispute: {payment_id}",
        "description": description[:1000], "queryType": "PaymentDispute", "status": "Open",
        "paymentId": payment_id, "createdAt": datetime.utcnow().isoformat(), "reply": "",
    }
    await purchase_invoice_collection.update_one({"_id": invoice["_id"], **_match(vendor_id)}, {"$push": {"vendorQueries": query}, "$set": {"updatedAt": datetime.utcnow()}})
    return {"message": "Payment dispute submitted to the retailer accounts team.", "query": query}
