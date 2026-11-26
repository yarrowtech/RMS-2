from datetime import datetime
import re
import csv
import io
import hashlib
from decimal import Decimal, InvalidOperation
from bson import ObjectId
from fastapi import Depends, HTTPException
from pymongo.errors import DuplicateKeyError
from pydantic import BaseModel, Field, ConfigDict
from ..db import db
from .finance_routes import router, get_finance_context, record_scope

class VendorMasterInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(..., min_length=1, max_length=160)
    vendor_type: str = "manual"
    old_code: str = ""
    creditor_group: str = "Sundry Creditors"
    contact: str = ""
    address: str = ""
    pan: str = ""
    gst_status: str = "Unregistered"
    gstin: str = ""
    bank_name: str = ""
    bank_holder: str = ""
    ifsc: str = ""
    account_last4: str = ""

class AccountMasterInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(..., min_length=1, max_length=120)
    kind: str
    bank_name: str = ""
    ifsc: str = ""
    account_last4: str = ""

def clean(data):
    return {k: v.strip() if isinstance(v, str) else v for k, v in data.items()}

def validate_bank(data):
    if data.get("ifsc") and not re.fullmatch(r"[A-Z]{4}0[A-Z0-9]{6}", data["ifsc"].upper()):
        raise HTTPException(400, "Invalid IFSC")
    if data.get("account_last4") and not re.fullmatch(r"\d{4}", data["account_last4"]):
        raise HTTPException(400, "Enter only the last four account digits")

@router.get("/vendor-master")
async def list_master_vendors(ctx: dict = Depends(get_finance_context)):
    rows = await db.finance_vendor_master.find(record_scope(ctx), {"_id": 0}).sort("name", 1).to_list(length=5000)
    return {"rows": rows}

def validate_vendor(payload: VendorMasterInput):
    data = clean(payload.model_dump())
    if not data["name"] or data["vendor_type"] not in {"manual", "walk_in", "migrated", "registered"}:
        raise HTTPException(400, "Valid name and vendor type are required")
    if data["creditor_group"] not in {"Sundry Creditors", "Service Creditors"}:
        raise HTTPException(400, "Invalid creditor group")
    data["pan"], data["gstin"], data["ifsc"] = data["pan"].upper(), data["gstin"].upper(), data["ifsc"].upper()
    if data["pan"] and not re.fullmatch(r"[A-Z]{5}[0-9]{4}[A-Z]", data["pan"]):
        raise HTTPException(400, "Invalid PAN")
    if data["gstin"] and not re.fullmatch(r"\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]", data["gstin"]):
        raise HTTPException(400, "Invalid GSTIN")
    validate_bank(data)
    return data

@router.post("/vendor-master", status_code=201)
async def create_master_vendor(payload: VendorMasterInput, ctx: dict = Depends(get_finance_context)):
    data = validate_vendor(payload)
    if data["vendor_type"] == "registered":
        raise HTTPException(400, "Use the registered vendor link action")
    oid = ObjectId()
    doc = {**data, **record_scope(ctx), "id": str(oid), "code": f"FMV-{str(oid).upper()}", "created_at": datetime.utcnow().isoformat()}
    await db.finance_vendor_master.insert_one({"_id": oid, **doc})
    return {"vendor": doc}

@router.get("/account-master")
async def list_master_accounts(ctx: dict = Depends(get_finance_context)):
    return {"rows": await db.finance_account_master.find(record_scope(ctx), {"_id": 0}).sort("name", 1).to_list(length=5000)}

@router.post("/account-master", status_code=201)
async def create_master_account(payload: AccountMasterInput, ctx: dict = Depends(get_finance_context)):
    data = clean(payload.model_dump())
    if not data["name"] or data["kind"] not in {"cash", "bank", "ledger", "creditor_control"}:
        raise HTTPException(400, "Valid account name and type are required")
    data["ifsc"] = data["ifsc"].upper()
    validate_bank(data)
    oid = ObjectId()
    doc = {**data, **record_scope(ctx), "id": str(oid), "created_at": datetime.utcnow().isoformat()}
    await db.finance_account_master.insert_one({"_id": oid, **doc})
    return {"account": doc}


@router.put("/vendor-master/{record_id}")
async def update_master_vendor(record_id: str, payload: VendorMasterInput, ctx: dict = Depends(get_finance_context)):
    data = validate_vendor(payload)
    existing = await db.finance_vendor_master.find_one({**record_scope(ctx), "id": record_id}, {"registered_link_id": 1})
    if not existing:
        raise HTTPException(404, "Vendor not found")
    if bool(existing.get("registered_link_id")) != (data["vendor_type"] == "registered"):
        raise HTTPException(400, "Registered status cannot be changed by editing")
    data["updated_at"] = datetime.utcnow().isoformat()
    result = await db.finance_vendor_master.update_one({**record_scope(ctx), "id": record_id}, {"$set": data})
    if not result.matched_count:
        raise HTTPException(404, "Vendor not found")
    return {"vendor": await db.finance_vendor_master.find_one({**record_scope(ctx), "id": record_id}, {"_id": 0})}

@router.put("/account-master/{record_id}")
async def update_master_account(record_id: str, payload: AccountMasterInput, ctx: dict = Depends(get_finance_context)):
    data = clean(payload.model_dump())
    if not data["name"] or data["kind"] not in {"cash", "bank", "ledger", "creditor_control"}:
        raise HTTPException(400, "Valid account name and type are required")
    existing = await db.finance_account_master.find_one({**record_scope(ctx), "id": record_id}, {"kind": 1})
    if not existing:
        raise HTTPException(404, "Account not found")
    if data["kind"] != existing["kind"]:
        raise HTTPException(400, "Account type cannot be changed after creation")
    data["ifsc"] = data["ifsc"].upper()
    validate_bank(data)
    data["updated_at"] = datetime.utcnow().isoformat()
    result = await db.finance_account_master.update_one({**record_scope(ctx), "id": record_id}, {"$set": data})
    if not result.matched_count:
        raise HTTPException(404, "Account not found")
    return {"account": await db.finance_account_master.find_one({**record_scope(ctx), "id": record_id}, {"_id": 0})}

@router.get("/registered-vendors")
async def registered_vendors(ctx: dict = Depends(get_finance_context)):
    links = await db.vendor_tenant_links.find({"tenant_id": ctx["tenant_id"], "status": "Approved"}).to_list(length=5000)
    ids = [link["vendor_id"] for link in links if link.get("vendor_id")]
    identities = await db.vendors.find({"_id": {"$in": ids}}, {"name": 1, "vendor_name": 1, "pan": 1, "gstin": 1}).to_list(length=5000)
    by_id = {str(v["_id"]): v for v in identities}
    existing = await db.finance_vendor_master.find({**record_scope(ctx), "registered_link_id": {"$exists": True}}, {"registered_link_id": 1}).to_list(length=5000)
    linked = {row["registered_link_id"] for row in existing}
    rows = []
    for link in links:
        identity = by_id.get(str(link.get("vendor_id")))
        if identity and str(link["_id"]) not in linked:
            rows.append({"link_id": str(link["_id"]), "code": link.get("vendor_code", ""), "name": identity.get("name") or identity.get("vendor_name") or "Unnamed vendor"})
    return {"rows": rows}

@router.post("/registered-vendors/{link_id}/link", status_code=201)
async def link_registered_vendor(link_id: str, ctx: dict = Depends(get_finance_context)):
    if not ObjectId.is_valid(link_id):
        raise HTTPException(404, "Registered vendor not found")
    link = await db.vendor_tenant_links.find_one({"_id": ObjectId(link_id), "tenant_id": ctx["tenant_id"], "status": "Approved"})
    if not link:
        raise HTTPException(404, "Registered vendor not found")
    identity = await db.vendors.find_one({"_id": link.get("vendor_id")})
    if not identity:
        raise HTTPException(404, "Vendor identity not found")
    scope = record_scope(ctx)
    # A deterministic Mongo ID makes concurrent link requests idempotent.
    key = "registered:" + ctx["tenant_id"] + ":" + scope.get("store_id", "hq") + ":" + link_id
    oid = ObjectId()
    data = VendorMasterInput(name=identity.get("name") or identity.get("vendor_name") or "Unnamed vendor", pan=identity.get("pan") or "", gstin=identity.get("gstin") or "").model_dump()
    data["vendor_type"] = "registered"
    data["gst_status"] = "Registered" if data["gstin"] else "Unregistered"
    doc = {**data, **scope, "id": str(oid), "code": link.get("vendor_code") or f"FMV-{str(oid).upper()}", "registered_link_id": link_id, "registered_vendor_id": str(link["vendor_id"]), "created_at": datetime.utcnow().isoformat()}
    try:
        await db.finance_vendor_master.insert_one({"_id": key, **doc})
    except DuplicateKeyError:
        raise HTTPException(409, "This registered vendor is already linked")
    return {"vendor": doc}


class VendorImportPreview(BaseModel):
    csv_text: str = Field(..., max_length=1000000)

@router.post("/vendor-master/import-preview")
async def preview_vendor_import(payload: VendorImportPreview, ctx: dict = Depends(get_finance_context)):
    """Validate a CSV without creating or modifying any master records."""
    try:
        reader = csv.DictReader(io.StringIO(payload.csv_text.lstrip("\ufeff")), strict=True)
        if not reader.fieldnames or "name" not in [h.strip().lower() for h in reader.fieldnames if h]:
            raise HTTPException(400, "CSV must include a name column")
        reader.fieldnames = [h.strip().lower() if h else "" for h in reader.fieldnames]
        if len(reader.fieldnames) != len(set(reader.fieldnames)):
            raise HTTPException(400, "CSV contains duplicate column names")
        unknown = set(reader.fieldnames) - set(VendorMasterInput.model_fields)
        if unknown:
            raise HTTPException(400, "Unsupported CSV columns: " + ", ".join(sorted(unknown)))
        entries = list(reader)
    except csv.Error as exc:
        raise HTTPException(400, f"Invalid CSV: {exc}")
    if len(entries) > 1000:
        raise HTTPException(400, "Preview at most 1,000 rows at a time")
    existing = await db.finance_vendor_master.find(record_scope(ctx), {"_id": 0, "name": 1, "old_code": 1, "gstin": 1, "pan": 1, "code": 1}).to_list(length=5000)
    seen = {key: {} for key in ("old_code", "gstin", "pan", "name")}
    for row in existing:
        for key in seen:
            value = str(row.get(key) or "").strip().upper()
            if value:
                seen[key].setdefault(value, []).append(row.get("code") or "existing record")
    results = []
    allowed = set(VendorMasterInput.model_fields)
    for index, raw in enumerate(entries, start=2):
        errors, warnings = [], []
        if None in raw:
            errors.append("Too many values for the CSV header")
        values = {k: (v or "").strip() for k, v in raw.items() if k in allowed}
        values["vendor_type"] = "migrated"
        if not values.get("creditor_group"):
            values["creditor_group"] = "Sundry Creditors"
        if not values.get("gst_status"):
            values["gst_status"] = "Unregistered"
        try:
            normalized = validate_vendor(VendorMasterInput(**values))
        except Exception as exc:
            normalized = values
            errors.append(str(exc.detail) if isinstance(exc, HTTPException) else "Missing or invalid fields")
        for key in seen:
            value = str(normalized.get(key) or "").strip().upper()
            if not value:
                continue
            if value in seen[key]:
                warnings.append(f"Possible duplicate {key.replace('_', ' ')}: " + ", ".join(seen[key][value][:3]))
            seen[key].setdefault(value, []).append(f"CSV row {index}")
        results.append({"row": index, "name": values.get("name", ""), "errors": errors, "warnings": warnings})
    return {"rows": results, "total": len(results), "valid": sum(not row["errors"] for row in results), "note": "Preview only. No vendors or balances were imported."}


@router.post("/vendor-master/import")
async def import_vendor_master(payload: VendorImportPreview, ctx: dict = Depends(get_finance_context)):
    """Import only valid, unambiguous rows; each old code is idempotent."""
    preview = await preview_vendor_import(payload, ctx)
    reader = csv.DictReader(io.StringIO(payload.csv_text.lstrip("\ufeff")), strict=True)
    reader.fieldnames = [h.strip().lower() if h else "" for h in reader.fieldnames]
    entries = list(reader)
    scope = record_scope(ctx)
    results = []
    for raw, check in zip(entries, preview["rows"]):
        errors = list(check["errors"])
        if check["warnings"]:
            errors.extend(check["warnings"])
        old_code = str(raw.get("old_code") or "").strip()
        if not old_code:
            errors.append("Old system code is required for import")
        if errors:
            results.append({"row": check["row"], "name": check["name"], "status": "skipped", "reasons": errors})
            continue
        allowed = set(VendorMasterInput.model_fields)
        values = {k: (v or "").strip() for k, v in raw.items() if k in allowed}
        values.update(vendor_type="migrated", creditor_group=values.get("creditor_group") or "Sundry Creditors", gst_status=values.get("gst_status") or "Unregistered")
        data = validate_vendor(VendorMasterInput(**values))
        # Recheck after preview to reduce duplicate creation when another request ran.
        query = {**scope, "$or": [{"old_code": {"$regex": "^" + re.escape(old_code) + "$", "$options": "i"}}]}
        if await db.finance_vendor_master.find_one(query, {"_id": 1}):
            results.append({"row": check["row"], "name": check["name"], "status": "skipped", "reasons": ["Old system code already exists"]})
            continue
        scope_key = scope["tenant_id"] + "\0" + scope.get("store_id", "hq") + "\0" + old_code.upper()
        import_key = "import:" + hashlib.sha256(scope_key.encode("utf-8")).hexdigest()
        oid = ObjectId()
        doc = {**data, **scope, "id": str(oid), "code": f"FMV-{str(oid).upper()}", "created_at": datetime.utcnow().isoformat()}
        try:
            await db.finance_vendor_master.insert_one({"_id": import_key, **doc})
        except DuplicateKeyError:
            results.append({"row": check["row"], "name": check["name"], "status": "skipped", "reasons": ["Old system code already imported"]})
            continue
        results.append({"row": check["row"], "name": check["name"], "status": "imported", "code": doc["code"], "reasons": []})
    return {"rows": results, "imported": sum(r["status"] == "imported" for r in results), "skipped": sum(r["status"] == "skipped" for r in results), "note": "Vendor details only; opening balances and invoices were not imported."}


class PostingLine(BaseModel):
    account_id: str
    debit: str = "0"
    credit: str = "0"

class BalancedVoucherInput(BaseModel):
    voucher_type: str
    voucher_date: str
    narration: str = Field(default="", max_length=1000)
    lines: list[PostingLine] = Field(..., min_length=2, max_length=100)

def posting_amount(value: str) -> int:
    try:
        amount = Decimal(value)
        if not amount.is_finite() or amount < 0 or amount != amount.quantize(Decimal("0.01")) or amount > Decimal("1000000000000"):
            raise ValueError()
        return int(amount * 100)
    except (InvalidOperation, ValueError):
        raise HTTPException(400, "Amounts must be non-negative and have at most two decimal places")

@router.get("/balanced-vouchers")
async def list_balanced_vouchers(ctx: dict = Depends(get_finance_context)):
    rows = await db.finance_balanced_vouchers.find(record_scope(ctx), {"_id": 0}).sort("created_at", -1).to_list(length=1000)
    entries = []
    for row in rows:
        reversal = row.pop("reversal", None)
        row["reversed"] = bool(reversal)
        entries.append(row)
        if reversal:
            entries.append(reversal)
    return {"rows": entries}

@router.post("/balanced-vouchers", status_code=201)
async def create_balanced_voucher(payload: BalancedVoucherInput, ctx: dict = Depends(get_finance_context)):
    if payload.voucher_type not in {"journal", "contra"}:
        raise HTTPException(400, "Only journal and contra entries are supported")
    try:
        datetime.strptime(payload.voucher_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(400, "Invalid voucher date")
    scope = record_scope(ctx)
    lines, debit_total, credit_total = [], 0, 0
    for line in payload.lines:
        debit, credit = posting_amount(line.debit), posting_amount(line.credit)
        if (debit > 0) == (credit > 0):
            raise HTTPException(400, "Each line must have a debit or a credit, but not both")
        account = await db.finance_account_master.find_one({**scope, "id": line.account_id}, {"_id": 0})
        if not account:
            raise HTTPException(400, "An account was not found in your finance scope")
        if account["kind"] == "creditor_control":
            raise HTTPException(400, "Creditor control accounts require a vendor subledger posting, which is not available yet")
        if payload.voucher_type == "contra" and account["kind"] not in {"cash", "bank"}:
            raise HTTPException(400, "Contra entries require cash or bank accounts")
        lines.append({"account_id": account["id"], "account_name": account["name"], "debit_paise": debit, "credit_paise": credit})
        debit_total += debit
        credit_total += credit
    if debit_total != credit_total:
        raise HTTPException(400, "Debits and credits must balance")
    if len({line["account_id"] for line in lines}) < 2:
        raise HTTPException(400, "At least two different accounts are required")
    if payload.voucher_type == "contra" and (len(lines) != 2 or lines[0]["account_id"] == lines[1]["account_id"]):
        raise HTTPException(400, "Contra requires two different cash or bank accounts")
    oid = ObjectId()
    doc = {**scope, "id": str(oid), "voucher_no": f"{'JV' if payload.voucher_type == 'journal' else 'CV'}-{str(oid).upper()}", "voucher_type": payload.voucher_type, "voucher_date": payload.voucher_date, "narration": payload.narration.strip(), "lines": lines, "total_paise": debit_total, "created_at": datetime.utcnow().isoformat()}
    await db.finance_balanced_vouchers.insert_one({"_id": oid, **doc})
    return {"voucher": doc}


class VoucherReversalInput(BaseModel):
    reversal_date: str
    reason: str = Field(..., min_length=1, max_length=1000)

@router.post("/balanced-vouchers/{voucher_id}/reverse", status_code=201)
async def reverse_balanced_voucher(voucher_id: str, payload: VoucherReversalInput, ctx: dict = Depends(get_finance_context)):
    try:
        datetime.strptime(payload.reversal_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(400, "Invalid reversal date")
    reason = payload.reason.strip()
    if not reason:
        raise HTTPException(400, "A reversal reason is required")
    scope = record_scope(ctx)
    original = await db.finance_balanced_vouchers.find_one({**scope, "id": voucher_id}, {"_id": 0})
    if not original:
        raise HTTPException(404, "Voucher not found")
    if original.get("reversal"):
        raise HTTPException(409, "Voucher has already been reversed")
    if payload.reversal_date < original["voucher_date"]:
        raise HTTPException(400, "Reversal date cannot precede the original voucher")
    oid = ObjectId()
    reversal = {**scope, "id": str(oid), "voucher_no": f"REV-{str(oid).upper()}", "voucher_type": original["voucher_type"], "voucher_date": payload.reversal_date, "narration": reason, "created_by": str(ctx.get("admin_id") or ""), "reversal_of": original["id"], "reversal_of_no": original["voucher_no"], "lines": [{**line, "debit_paise": line["credit_paise"], "credit_paise": line["debit_paise"]} for line in original["lines"]], "total_paise": original["total_paise"], "created_at": datetime.utcnow().isoformat()}
    # Original and reversal are saved atomically in one document; concurrent
    # requests cannot create a second reversal for the same voucher.
    result = await db.finance_balanced_vouchers.update_one({**scope, "id": voucher_id, "reversal": {"$exists": False}}, {"$set": {"reversal": reversal}})
    if not result.modified_count:
        raise HTTPException(409, "Voucher has already been reversed")
    return {"voucher": reversal}


@router.get("/balanced-account-movements")
async def balanced_account_movements(ctx: dict = Depends(get_finance_context)):
    """Report movements of the new balanced entries, excluding legacy flows."""
    scope = record_scope(ctx)
    accounts = await db.finance_account_master.find(scope, {"_id": 0}).to_list(length=None)
    totals = {a["id"]: {"account_id": a["id"], "name": a["name"], "kind": a["kind"], "debit_paise": 0, "credit_paise": 0} for a in accounts}
    cursor = db.finance_balanced_vouchers.find(scope, {"_id": 0})
    async for voucher in cursor:
        for entry in (voucher, voucher.get("reversal")):
            if not entry:
                continue
            for line in entry.get("lines", []):
                if line["account_id"] not in totals:
                    totals[line["account_id"]] = {"account_id": line["account_id"], "name": line["account_name"], "kind": "unknown", "debit_paise": 0, "credit_paise": 0}
                item = totals[line["account_id"]]
                item["debit_paise"] += line["debit_paise"]
                item["credit_paise"] += line["credit_paise"]
    rows = sorted(totals.values(), key=lambda row: row["name"].lower())
    return {"rows": rows, "note": "Movement from balanced journal and contra entries only. This is not an account balance; opening balances and legacy payments are excluded."}


class InvoiceVendorLink(BaseModel):
    vendor_id: str

@router.post("/invoice-vendor-links/{invoice_id}", status_code=201)
async def link_invoice_vendor(invoice_id: str, payload: InvoiceVendorLink, ctx: dict = Depends(get_finance_context)):
    if not ObjectId.is_valid(invoice_id):
        raise HTTPException(404, "Invoice not found")
    scope = record_scope(ctx)
    invoice = await db.purchase_invoices.find_one({**scope, "_id": ObjectId(invoice_id)})
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    if invoice.get("status") not in {"Approved", "PartiallyPaid", "Paid"}:
        raise HTTPException(400, "Only approved invoices can be linked")
    vendor = await db.finance_vendor_master.find_one({**scope, "id": payload.vendor_id}, {"_id": 0})
    if not vendor:
        raise HTTPException(404, "Finance vendor not found")
    if vendor.get("store_id") and vendor.get("store_id") != invoice.get("store_id"):
        raise HTTPException(400, "The vendor and invoice belong to different stores")
    invoice_vendor = str(invoice.get("vendor_id") or "")
    registered_vendor = vendor.get("registered_vendor_id")
    if invoice_vendor and registered_vendor and invoice_vendor != registered_vendor:
        raise HTTPException(400, "Registered vendor identity does not match this invoice")
    doc = {"_id": "invoice:" + invoice_id, "tenant_id": ctx["tenant_id"], "store_id": invoice.get("store_id"), "invoice_id": invoice_id, "vendor_id": vendor["id"], "vendor_code": vendor["code"], "vendor_name": vendor["name"], "invoice_vendor_name": invoice.get("vendorName") or invoice.get("vendor") or "", "created_by": str(ctx.get("admin_id") or ""), "created_at": datetime.utcnow().isoformat()}
    try:
        await db.finance_invoice_vendor_links.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(409, "Invoice is already linked to a finance vendor")
    doc.pop("_id")
    return {"link": doc}

@router.get("/invoice-vendor-links")
async def list_invoice_vendor_links(ctx: dict = Depends(get_finance_context)):
    return {"rows": await db.finance_invoice_vendor_links.find(record_scope(ctx), {"_id": 0}).to_list(length=None)}


class InvoiceVendorCorrection(BaseModel):
    vendor_id: str
    expected_vendor_id: str
    reason: str = Field(..., min_length=1, max_length=1000)

@router.put("/invoice-vendor-links/{invoice_id}")
async def correct_invoice_vendor_link(invoice_id: str, payload: InvoiceVendorCorrection, ctx: dict = Depends(get_finance_context)):
    if not ObjectId.is_valid(invoice_id):
        raise HTTPException(404, "Invoice not found")
    reason = payload.reason.strip()
    if not reason:
        raise HTTPException(400, "A correction reason is required")
    scope = record_scope(ctx)
    invoice = await db.purchase_invoices.find_one({**scope, "_id": ObjectId(invoice_id)})
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    link = await db.finance_invoice_vendor_links.find_one({**scope, "invoice_id": invoice_id})
    if not link:
        raise HTTPException(404, "Invoice link not found")
    if link["vendor_id"] != payload.expected_vendor_id:
        raise HTTPException(409, "Link changed since it was loaded; refresh and try again")
    if payload.vendor_id == payload.expected_vendor_id:
        raise HTTPException(400, "Choose a different vendor")
    vendor = await db.finance_vendor_master.find_one({**scope, "id": payload.vendor_id}, {"_id": 0})
    if not vendor:
        raise HTTPException(404, "Finance vendor not found")
    if vendor.get("store_id") and vendor.get("store_id") != invoice.get("store_id"):
        raise HTTPException(400, "The vendor and invoice belong to different stores")
    if invoice.get("vendor_id") and vendor.get("registered_vendor_id") and str(invoice["vendor_id"]) != vendor["registered_vendor_id"]:
        raise HTTPException(400, "Registered vendor identity does not match this invoice")
    now = datetime.utcnow().isoformat()
    history = {"from_vendor_id": link["vendor_id"], "from_vendor_code": link["vendor_code"], "from_vendor_name": link["vendor_name"], "to_vendor_id": vendor["id"], "to_vendor_code": vendor["code"], "to_vendor_name": vendor["name"], "reason": reason, "changed_by": str(ctx.get("admin_id") or ""), "changed_at": now}
    result = await db.finance_invoice_vendor_links.update_one({**scope, "invoice_id": invoice_id, "vendor_id": payload.expected_vendor_id}, {"$set": {"vendor_id": vendor["id"], "vendor_code": vendor["code"], "vendor_name": vendor["name"], "updated_at": now}, "$push": {"history": history}})
    if not result.modified_count:
        raise HTTPException(409, "Link changed since it was loaded; refresh and try again")
    return {"link": await db.finance_invoice_vendor_links.find_one({**scope, "invoice_id": invoice_id}, {"_id": 0})}


@router.get("/vendor-payables-reconciliation")
async def vendor_payables_reconciliation(ctx: dict = Depends(get_finance_context)):
    # Use the existing payables endpoint as the balance source; the mapping
    # changes grouping only and never writes to invoices or payments.
    from .finance_routes import payables
    source = await payables(ctx)
    links = await db.finance_invoice_vendor_links.find(record_scope(ctx), {"_id": 0}).to_list(length=None)
    by_invoice = {item["invoice_id"]: item for item in links}
    groups = {}
    unmapped = []
    for invoice in source["rows"]:
        # Draft and held invoices are not approved liabilities. Expose them
        # separately rather than presenting them as vendor balances.
        if invoice["status"] not in {"Approved", "PartiallyPaid"}:
            continue
        mapping = by_invoice.get(invoice["id"])
        if not mapping:
            unmapped.append(invoice)
            continue
        group = groups.setdefault(mapping["vendor_id"], {"vendor_id": mapping["vendor_id"], "vendor_code": mapping["vendor_code"], "vendor_name": mapping["vendor_name"], "invoice_count": 0, "amount_paise": 0})
        group["invoice_count"] += 1
        group["amount_paise"] += int((Decimal(str(invoice["balance_due"])) * 100).to_integral_value())
    rows = sorted(groups.values(), key=lambda row: row["vendor_name"].lower())
    unmapped_paise = sum(int((Decimal(str(row["balance_due"])) * 100).to_integral_value()) for row in unmapped)
    return {"rows": rows, "unmapped": unmapped, "mapped_paise": sum(row["amount_paise"] for row in rows), "unmapped_paise": unmapped_paise, "note": "Approved outstanding purchase invoices only; excludes advances, debit notes, opening balances, journals and draft invoices."}


class VendorOpeningBalanceInput(BaseModel):
    vendor_id: str
    cutoff_date: str
    amount: str
    reference: str = Field(default="", max_length=300)

@router.get("/vendor-opening-balances")
async def list_vendor_opening_balances(ctx: dict = Depends(get_finance_context)):
    rows = await db.finance_vendor_opening_balances.find(record_scope(ctx), {"_id": 0}).to_list(length=None)
    return {"rows": rows, "total_paise": sum(row["amount_paise"] for row in rows), "note": "Unposted migration records only; not included in payable balances or accounting reports."}

@router.post("/vendor-opening-balances", status_code=201)
async def create_vendor_opening_balance(payload: VendorOpeningBalanceInput, ctx: dict = Depends(get_finance_context)):
    scope = record_scope(ctx)
    try:
        datetime.strptime(payload.cutoff_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(400, "Invalid cutoff date")
    amount_paise = posting_amount(payload.amount)
    if amount_paise <= 0:
        raise HTTPException(400, "Opening payable must be greater than zero")
    vendor = await db.finance_vendor_master.find_one({**scope, "id": payload.vendor_id}, {"_id": 0})
    if not vendor:
        raise HTTPException(404, "Finance vendor not found")
    # Master IDs are globally unique, which makes the insert atomic and allows
    # one opening record per vendor; later changes need an auditable workflow.
    key = "vendor:" + vendor["id"]
    doc = {**scope, "vendor_id": vendor["id"], "vendor_code": vendor["code"], "vendor_name": vendor["name"], "cutoff_date": payload.cutoff_date, "amount_paise": amount_paise, "reference": payload.reference.strip(), "status": "unposted", "created_by": str(ctx.get("admin_id") or ""), "created_at": datetime.utcnow().isoformat()}
    try:
        await db.finance_vendor_opening_balances.insert_one({"_id": key, **doc})
    except DuplicateKeyError:
        raise HTTPException(409, "An opening record already exists for this vendor")
    return {"opening_balance": doc}


class CashBankOpeningInput(BaseModel):
    account_id: str
    cutoff_date: str
    amount: str
    direction: str = "debit"
    reference: str = Field(default="", max_length=300)

@router.get("/cash-bank-opening-balances")
async def list_cash_bank_openings(ctx: dict = Depends(get_finance_context)):
    rows = await db.finance_cash_bank_openings.find(record_scope(ctx), {"_id": 0}).to_list(length=None)
    return {"rows": rows, "note": "Unposted migration records only; excluded from live balances and accounting reports."}

@router.post("/cash-bank-opening-balances", status_code=201)
async def create_cash_bank_opening(payload: CashBankOpeningInput, ctx: dict = Depends(get_finance_context)):
    scope = record_scope(ctx)
    try:
        datetime.strptime(payload.cutoff_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(400, "Invalid cutoff date")
    amount = posting_amount(payload.amount)
    if amount <= 0 or payload.direction not in {"debit", "credit"}:
        raise HTTPException(400, "Enter a positive amount and a valid debit or credit direction")
    account = await db.finance_account_master.find_one({**scope, "id": payload.account_id}, {"_id": 0})
    if not account or account["kind"] not in {"cash", "bank"}:
        raise HTTPException(404, "Cash or bank account not found")
    if account["kind"] == "cash" and payload.direction == "credit":
        raise HTTPException(400, "Cash opening balance cannot be a credit")
    doc = {**scope, "account_id": account["id"], "account_name": account["name"], "account_kind": account["kind"], "cutoff_date": payload.cutoff_date, "amount_paise": amount, "direction": payload.direction, "reference": payload.reference.strip(), "status": "unposted", "created_by": str(ctx.get("admin_id") or ""), "created_at": datetime.utcnow().isoformat()}
    try:
        await db.finance_cash_bank_openings.insert_one({"_id": "account:" + account["id"], **doc})
    except DuplicateKeyError:
        raise HTTPException(409, "An opening record already exists for this account")
    return {"opening_balance": doc}


@router.get("/opening-reconciliation")
async def opening_reconciliation(ctx: dict = Depends(get_finance_context)):
    scope = record_scope(ctx)
    vendors = await db.finance_vendor_opening_balances.find(scope, {"_id": 0}).to_list(length=None)
    accounts = await db.finance_cash_bank_openings.find(scope, {"_id": 0}).to_list(length=None)
    dates = sorted({row["cutoff_date"] for row in vendors + accounts})
    return {"vendor_count": len(vendors), "vendor_credit_paise": sum(row["amount_paise"] for row in vendors), "account_count": len(accounts), "account_debit_paise": sum(row["amount_paise"] for row in accounts if row["direction"] == "debit"), "account_credit_paise": sum(row["amount_paise"] for row in accounts if row["direction"] == "credit"), "cutoff_dates": dates, "mixed_cutoffs": len(dates) > 1, "note": "Unposted staging totals only. Other assets, liabilities, equity and invoices are not included; these totals cannot establish a balanced opening trial balance."}


class VendorControlAccountInput(BaseModel):
    account_id: str

@router.post("/vendor-master/{vendor_id}/creditor-account", status_code=201)
async def assign_vendor_control_account(vendor_id: str, payload: VendorControlAccountInput, ctx: dict = Depends(get_finance_context)):
    scope = record_scope(ctx)
    vendor = await db.finance_vendor_master.find_one({**scope, "id": vendor_id}, {"_id": 0})
    if not vendor:
        raise HTTPException(404, "Finance vendor not found")
    account = await db.finance_account_master.find_one({**scope, "id": payload.account_id}, {"_id": 0})
    if not account or account["kind"] != "creditor_control":
        raise HTTPException(400, "Choose a creditor control account")
    if account.get("store_id") and account.get("store_id") != vendor.get("store_id"):
        raise HTTPException(400, "Vendor and creditor account scopes do not match")
    link_scope = {"tenant_id": ctx["tenant_id"]}
    if vendor.get("store_id"):
        link_scope["store_id"] = vendor["store_id"]
    link = {**link_scope, "vendor_id": vendor["id"], "vendor_name": vendor["name"], "vendor_code": vendor["code"], "account_id": account["id"], "account_name": account["name"], "created_by": str(ctx.get("admin_id") or ""), "created_at": datetime.utcnow().isoformat()}
    try:
        await db.finance_vendor_control_links.insert_one({"_id": "vendor:" + vendor_id, **link})
    except DuplicateKeyError:
        raise HTTPException(409, "Vendor already has a creditor account assignment")
    return {"link": link}

@router.get("/vendor-creditor-accounts")
async def list_vendor_control_accounts(ctx: dict = Depends(get_finance_context)):
    return {"rows": await db.finance_vendor_control_links.find(record_scope(ctx), {"_id": 0}).to_list(length=None)}


class VendorControlCorrection(BaseModel):
    account_id: str
    expected_account_id: str
    reason: str = Field(..., min_length=1, max_length=1000)

@router.put("/vendor-master/{vendor_id}/creditor-account")
async def correct_vendor_control_account(vendor_id: str, payload: VendorControlCorrection, ctx: dict = Depends(get_finance_context)):
    scope = record_scope(ctx)
    reason = payload.reason.strip()
    if not reason:
        raise HTTPException(400, "A correction reason is required")
    link = await db.finance_vendor_control_links.find_one({**scope, "vendor_id": vendor_id})
    vendor = await db.finance_vendor_master.find_one({**scope, "id": vendor_id}, {"_id": 0})
    if not link or not vendor:
        raise HTTPException(404, "Vendor assignment not found")
    if link["account_id"] != payload.expected_account_id:
        raise HTTPException(409, "Assignment changed since it was loaded; refresh and try again")
    if payload.account_id == payload.expected_account_id:
        raise HTTPException(400, "Choose a different creditor account")
    account = await db.finance_account_master.find_one({**scope, "id": payload.account_id}, {"_id": 0})
    if not account or account["kind"] != "creditor_control":
        raise HTTPException(400, "Choose a creditor control account")
    if account.get("store_id") and account.get("store_id") != vendor.get("store_id"):
        raise HTTPException(400, "Vendor and creditor account scopes do not match")
    now = datetime.utcnow().isoformat()
    change = {"from_account_id": link["account_id"], "from_account_name": link["account_name"], "to_account_id": account["id"], "to_account_name": account["name"], "reason": reason, "changed_by": str(ctx.get("admin_id") or ""), "changed_at": now}
    result = await db.finance_vendor_control_links.update_one({**scope, "vendor_id": vendor_id, "account_id": payload.expected_account_id}, {"$set": {"account_id": account["id"], "account_name": account["name"], "updated_at": now}, "$push": {"history": change}})
    if not result.modified_count:
        raise HTTPException(409, "Assignment changed since it was loaded; refresh and try again")
    return {"link": await db.finance_vendor_control_links.find_one({**scope, "vendor_id": vendor_id}, {"_id": 0})}


@router.get("/invoice-payment-reconciliation")
async def invoice_payment_reconciliation(ctx: dict = Depends(get_finance_context)):
    """Compare invoice payment IDs against legacy finance mirrors, without writes."""
    scope = record_scope(ctx)
    invoices = await db.purchase_invoices.find(scope, {"_id": 1, "invoiceNo": 1, "vendorName": 1, "payments": 1}).to_list(length=None)
    mirrors = await db.finance_vouchers.find({**scope, "source": "purchase_invoice_payment"}, {"_id": 0, "id": 1, "linked_invoice_id": 1, "amount": 1, "voucher_no": 1}).to_list(length=None)
    payments, vouchers = {}, {}
    missing_ids = []
    for invoice in invoices:
        for payment in invoice.get("payments") or []:
            payment_id = str(payment.get("paymentId") or "")
            item = {"invoice_id": str(invoice["_id"]), "invoice_no": invoice.get("invoiceNo") or "", "vendor": invoice.get("vendorName") or "", "payment_id": payment_id, "amount": payment.get("amount", 0)}
            if payment_id:
                payments.setdefault(payment_id, []).append(item)
            else:
                missing_ids.append({**item, "issue": "Invoice payment has no payment ID"})
    for voucher in mirrors:
        vouchers.setdefault(str(voucher.get("id") or ""), []).append(voucher)
    issues = list(missing_ids)
    for payment_id, items in payments.items():
        matches = vouchers.get(payment_id, [])
        for payment in items:
            reasons = []
            if len(items) > 1: reasons.append("Duplicate payment ID on invoices")
            if not matches: reasons.append("Finance mirror missing")
            if len(matches) > 1: reasons.append("Multiple finance mirrors")
            if len(matches) == 1:
                mirror = matches[0]
                if str(mirror.get("linked_invoice_id") or "") != payment["invoice_id"]: reasons.append("Mirror references a different invoice")
                try:
                    if Decimal(str(mirror.get("amount") or 0)) != Decimal(str(payment["amount"] or 0)): reasons.append("Mirror amount differs")
                except InvalidOperation:
                    reasons.append("Invalid payment or mirror amount")
            if reasons: issues.append({**payment, "issue": "; ".join(reasons)})
    for payment_id, matches in vouchers.items():
        if payment_id not in payments:
            for mirror in matches:
                issues.append({"invoice_id": mirror.get("linked_invoice_id") or "", "invoice_no": "", "vendor": "", "payment_id": payment_id, "amount": mirror.get("amount", 0), "issue": "Finance mirror has no matching invoice payment"})
    return {"invoice_payment_count": sum(len(items) for items in payments.values()) + len(missing_ids), "mirror_count": len(mirrors), "issues": issues, "note": "Read-only comparison of purchase invoice payments and their legacy finance mirrors. It does not check bank statements or post accounting entries."}
