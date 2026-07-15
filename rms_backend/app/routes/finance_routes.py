"""Tenant-scoped retailer finance workspace.

Purchase invoices and POS bills remain the source of truth for procurement
and sales.  This router reads those documents and stores only accounting
vouchers (receipts, journals, contra entries, notes and manual expenses).
It intentionally does not create GRC/GRN or change stock.
"""

from datetime import datetime, timedelta
from typing import Any, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from ..db import finance_vouchers_collection, purchase_invoice_collection, sales_collection
from .deps import get_tenant


router = APIRouter(prefix="/api/finance", tags=["Retailer Finance"])

VOUCHER_TYPES = {"payment", "receipt", "contra", "journal", "debit_note", "credit_note"}
PAYMENT_MODES = {"Cash", "UPI", "NEFT", "RTGS", "Cheque", "DD", "Card", "Other"}


class VoucherCreate(BaseModel):
    voucher_type: str = Field(..., description="payment, receipt, contra, journal, debit_note or credit_note")
    voucher_date: str = Field(default_factory=lambda: datetime.utcnow().strftime("%Y-%m-%d"))
    amount: float = Field(..., gt=0)
    account: str = Field(..., min_length=2, max_length=120)
    counterparty: str = Field(default="", max_length=160)
    payment_mode: str = Field(default="Cash", max_length=40)
    reference_no: str = Field(default="", max_length=100)
    remarks: str = Field(default="", max_length=1000)
    category: str = Field(default="adjustment", max_length=40)
    linked_invoice_id: str = Field(default="", max_length=64)
    linked_sale_id: str = Field(default="", max_length=64)


async def get_finance_context(ctx: dict = Depends(get_tenant)) -> dict:
    """Require Finance access at HQ or for the caller's assigned store."""
    if ctx.get("scope") not in {"hq", "store", "branch"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Finance access is not available for this account.")
    departments = set(ctx.get("_managed_departments") or [])
    permissions = set(ctx.get("_permissions") or [])
    if "Finance" not in departments and "Full HQ Access" not in departments and "finance" not in permissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Finance department access is required.",
        )
    return ctx


def record_scope(ctx: dict) -> dict:
    """HQ sees tenant finance; a store Finance admin sees only its store."""
    scope = {"tenant_id": ctx["tenant_id"]}
    if ctx.get("scope") in {"store", "branch"}:
        if not ctx.get("store_id"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Store finance requires an assigned store.")
        scope["store_id"] = ctx["store_id"]
    return scope


def number(value: Any) -> float:
    try:
        return round(float(value or 0), 2)
    except (TypeError, ValueError):
        return 0.0


def date_value(value: Any) -> str:
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    return str(value or "")[:10]


def document_id(doc: dict) -> str:
    return str(doc.get("_id") or doc.get("id") or "")


def aging_bucket(due_date: str, today: datetime) -> str:
    try:
        days = (today.date() - datetime.strptime(due_date[:10], "%Y-%m-%d").date()).days
    except (TypeError, ValueError):
        return "current"
    if days <= 0:
        return "current"
    if days <= 30:
        return "0-30"
    if days <= 60:
        return "31-60"
    if days <= 90:
        return "61-90"
    return "90+"


async def finance_summary(ctx: dict) -> dict:
    today = datetime.utcnow()
    month_start = today.replace(day=1).strftime("%Y-%m-%d")
    scope = record_scope(ctx)
    invoices = await purchase_invoice_collection.find(scope).to_list(length=2000)
    sales = await sales_collection.find({**scope, "type": "sale"}).to_list(length=5000)
    vouchers = await finance_vouchers_collection.find(scope).to_list(length=5000)

    payable = 0.0
    overdue_payable = 0.0
    purchase_total = 0.0
    gst_input = 0.0
    for inv in invoices:
        if inv.get("status") == "Cancelled":
            continue
        total = number(inv.get("invoiceTotal"))
        balance = number(inv.get("balanceDue"))
        purchase_total += total
        payable += balance
        gst_input += sum(number(item.get("taxAmount")) for item in inv.get("items", []))
        due = date_value(inv.get("dueDate"))
        if balance > 0 and due and due < today.strftime("%Y-%m-%d"):
            overdue_payable += balance

    revenue = sum(number((sale.get("summary") or {}).get("net_payable")) for sale in sales)
    gst_output = sum(number((sale.get("summary") or {}).get("total_gst")) for sale in sales)
    credit_sales = [sale for sale in sales if str(sale.get("payment_method") or "").lower() in {"credit", "udhar", "invoice"}]

    receipts_by_sale: dict[str, float] = {}
    expenses = 0.0
    manual_income = 0.0
    cash_transfers = 0.0
    for voucher in vouchers:
        voucher_type = voucher.get("voucher_type")
        category = str(voucher.get("category") or "").lower()
        amount = number(voucher.get("amount"))
        if voucher_type == "receipt" and voucher.get("linked_sale_id"):
            sale_id = str(voucher.get("linked_sale_id"))
            receipts_by_sale[sale_id] = receipts_by_sale.get(sale_id, 0) + amount
        if category == "expense" or voucher_type == "debit_note":
            expenses += amount
        if category == "income" or voucher_type == "credit_note":
            manual_income += amount
        if voucher_type == "contra":
            cash_transfers += amount

    receivable = sum(
        max(0, number((sale.get("summary") or {}).get("net_payable")) - receipts_by_sale.get(document_id(sale), 0))
        for sale in credit_sales
    )
    month_vouchers = [v for v in vouchers if date_value(v.get("voucher_date")) >= month_start]
    return {
        "revenue": round(revenue + manual_income, 2),
        "purchase_total": round(purchase_total, 2),
        "expense_total": round(expenses, 2),
        "estimated_margin": round(revenue + manual_income - purchase_total - expenses, 2),
        "accounts_payable": round(payable, 2),
        "accounts_receivable": round(receivable, 2),
        "overdue_payable": round(overdue_payable, 2),
        "gst_input": round(gst_input, 2),
        "gst_output": round(gst_output, 2),
        "gst_net": round(gst_output - gst_input, 2),
        "cash_transfers": round(cash_transfers, 2),
        "voucher_count_month": len(month_vouchers),
    }


@router.get("/dashboard")
async def dashboard(ctx: dict = Depends(get_finance_context)):
    scope = record_scope(ctx)
    summary = await finance_summary(ctx)
    recent = await finance_vouchers_collection.find(
        scope, {"_id": 0}
    ).sort("created_at", -1).limit(8).to_list(length=8)
    for row in recent:
        row["created_at"] = date_value(row.get("created_at"))
    return {"summary": summary, "recent_vouchers": recent}


@router.get("/payables")
async def payables(ctx: dict = Depends(get_finance_context)):
    today = datetime.utcnow()
    rows = []
    async for inv in purchase_invoice_collection.find(record_scope(ctx)):
        if inv.get("status") == "Cancelled":
            continue
        balance = number(inv.get("balanceDue"))
        if balance <= 0:
            continue
        due = date_value(inv.get("dueDate"))
        rows.append({
            "id": document_id(inv), "invoice_no": inv.get("invoiceNo") or "—",
            "vendor": inv.get("vendorName") or inv.get("vendor") or "Vendor",
            "po_no": inv.get("poNo") or inv.get("purchaseOrderNo") or "—",
            "grn_no": inv.get("grnNo") or "—", "invoice_date": date_value(inv.get("invoiceDate")),
            "due_date": due, "invoice_total": number(inv.get("invoiceTotal")),
            "paid_amount": number(inv.get("paidAmount")), "balance_due": balance,
            "payment_status": inv.get("paymentStatus") or "Unpaid", "status": inv.get("status") or "Draft",
            "days_overdue": max(0, (today.date() - datetime.strptime(due, "%Y-%m-%d").date()).days) if due else 0,
            "aging_bucket": aging_bucket(due, today),
        })
    rows.sort(key=lambda item: (item["due_date"] or "9999-12-31", -item["balance_due"]))
    return {"rows": rows, "total_due": round(sum(row["balance_due"] for row in rows), 2)}


@router.get("/receivables")
async def receivables(ctx: dict = Depends(get_finance_context)):
    scope = record_scope(ctx)
    receipts = await finance_vouchers_collection.find({
        **scope, "voucher_type": "receipt", "linked_sale_id": {"$ne": ""},
    }).to_list(length=5000)
    receipt_map: dict[str, float] = {}
    for receipt in receipts:
        sale_id = str(receipt.get("linked_sale_id"))
        receipt_map[sale_id] = receipt_map.get(sale_id, 0) + number(receipt.get("amount"))
    rows = []
    async for sale in sales_collection.find({**scope, "type": "sale"}):
        if str(sale.get("payment_method") or "").lower() not in {"credit", "udhar", "invoice"}:
            continue
        total = number((sale.get("summary") or {}).get("net_payable"))
        received = number(receipt_map.get(document_id(sale)))
        balance = max(0, total - received)
        rows.append({
            "id": document_id(sale), "invoice_no": sale.get("invoice_no") or "—",
            "customer": sale.get("customer_name") or "Walk-in customer", "mobile": sale.get("mobile") or "",
            "sale_date": date_value(sale.get("date")), "invoice_total": total,
            "received_amount": received, "balance_due": round(balance, 2),
            "payment_method": sale.get("payment_method") or "Credit",
        })
    rows.sort(key=lambda item: (item["sale_date"] or "9999-12-31", -item["balance_due"]))
    return {"rows": rows, "total_due": round(sum(row["balance_due"] for row in rows), 2),
            "note": "AR is created only for POS bills marked Credit, Udhar, or Invoice. Cash and UPI bills are settled at sale."}


@router.get("/vouchers")
async def vouchers(
    voucher_type: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    ctx: dict = Depends(get_finance_context),
):
    query: dict[str, Any] = record_scope(ctx)
    if voucher_type:
        if voucher_type not in VOUCHER_TYPES:
            raise HTTPException(status_code=400, detail="Unsupported voucher type")
        query["voucher_type"] = voucher_type
    rows = await finance_vouchers_collection.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(length=limit)
    for row in rows:
        row["created_at"] = date_value(row.get("created_at"))
    return {"rows": rows}


@router.post("/vouchers", status_code=status.HTTP_201_CREATED)
async def create_voucher(payload: VoucherCreate, ctx: dict = Depends(get_finance_context)):
    voucher_type = payload.voucher_type.lower().strip()
    if voucher_type not in VOUCHER_TYPES:
        raise HTTPException(status_code=400, detail="Voucher type is not supported")
    if payload.payment_mode not in PAYMENT_MODES:
        raise HTTPException(status_code=400, detail="Payment mode is not supported")
    try:
        datetime.strptime(payload.voucher_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Voucher date must use YYYY-MM-DD")
    now = datetime.utcnow()
    voucher_id = str(ObjectId())
    document = {
        "id": voucher_id,
        "voucher_no": f"FIN-{now.strftime('%Y%m%d')}-{voucher_id[-6:].upper()}",
        "tenant_id": ctx["tenant_id"], "store_id": ctx.get("store_id") if ctx.get("scope") in {"store", "branch"} else None,
        "voucher_type": voucher_type,
        "voucher_date": payload.voucher_date, "amount": round(payload.amount, 2),
        "account": payload.account.strip(), "counterparty": payload.counterparty.strip(),
        "payment_mode": payload.payment_mode, "reference_no": payload.reference_no.strip(),
        "remarks": payload.remarks.strip(), "category": payload.category.strip().lower() or "adjustment",
        "linked_invoice_id": payload.linked_invoice_id.strip(), "linked_sale_id": payload.linked_sale_id.strip(),
        "source": "finance_workspace", "status": "Posted", "created_by": ctx.get("admin_id", ""),
        "created_at": now,
    }
    await finance_vouchers_collection.insert_one(document)
    document.pop("_id", None)
    document["created_at"] = date_value(document["created_at"])
    return {"message": "Voucher posted", "voucher": document}


@router.get("/aging")
async def aging(ctx: dict = Depends(get_finance_context)):
    today = datetime.utcnow()
    buckets: dict[str, float] = {"current": 0, "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0}
    async for inv in purchase_invoice_collection.find({**record_scope(ctx), "balanceDue": {"$gt": 0}}):
        if inv.get("status") == "Cancelled":
            continue
        buckets[aging_bucket(date_value(inv.get("dueDate")), today)] += number(inv.get("balanceDue"))
    return {"buckets": {key: round(value, 2) for key, value in buckets.items()}}


@router.get("/reports")
async def reports(ctx: dict = Depends(get_finance_context)):
    summary = await finance_summary(ctx)
    since = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
    vouchers = await finance_vouchers_collection.find({**record_scope(ctx), "voucher_date": {"$gte": since}}).to_list(length=5000)
    by_type: dict[str, float] = {}
    for voucher in vouchers:
        kind = voucher.get("voucher_type") or "journal"
        by_type[kind] = round(by_type.get(kind, 0) + number(voucher.get("amount")), 2)
    return {
        "summary": summary,
        "voucher_totals_30_days": [{"type": key, "amount": value} for key, value in sorted(by_type.items())],
        "rules": {
            "stock_flow": "Finance is read-only for PO, GRC, GRN and inventory. Stock is updated only by the existing GRN flow.",
            "ap_source": "Accounts payable comes from approved purchase invoices and their recorded payments.",
            "ar_source": "Accounts receivable comes from credit POS bills and receipt vouchers.",
        },
    }
