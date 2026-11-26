import unittest
from unittest.mock import patch, AsyncMock
from types import SimpleNamespace
from pymongo.errors import DuplicateKeyError
from bson import ObjectId
from fastapi import HTTPException, FastAPI
from fastapi.testclient import TestClient
from app.routes.deps import get_tenant
from app.routes.finance_routes import router
from app.routes import finance_master_routes as api

class Cursor:
    def __init__(self, rows): self.rows = rows
    def sort(self, *args): return self
    def __aiter__(self):
        async def iterator():
            for row in self.rows: yield row
        return iterator()
    async def to_list(self, length): return self.rows[:length] if length is not None else self.rows

class Collection:
    def __init__(self): self.rows = []
    def match(self, row, query):
        for key, value in query.items():
            if key == "$or":
                if not any(self.match(row, part) for part in value): return False
            elif isinstance(value, dict):
                if "$exists" in value and (key in row) != value["$exists"]: return False
                if "$regex" in value:
                    import re
                    if not re.search(value["$regex"], str(row.get(key, "")), re.I if value.get("$options") == "i" else 0): return False
            elif row.get(key) != value: return False
        return True
    def find(self, query, projection=None):
        rows = [dict(row) for row in self.rows if self.match(row, query)]
        if projection and projection.get("_id") == 0:
            for row in rows: row.pop("_id", None)
        return Cursor(rows)
    async def find_one(self, query, projection=None):
        return next((dict(row) for row in self.rows if self.match(row, query)), None)
    async def insert_one(self, doc):
        if any(row["_id"] == doc["_id"] for row in self.rows): raise DuplicateKeyError("duplicate")
        self.rows.append(dict(doc))
    async def update_one(self, query, update):
        for row in self.rows:
            if self.match(row, query):
                row.update(update["$set"])
                for key, value in update.get("$push", {}).items(): row.setdefault(key, []).append(value)
                return SimpleNamespace(matched_count=1, modified_count=1)
        return SimpleNamespace(matched_count=0, modified_count=0)

class FinanceMasterTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.vendor, self.accounts, self.vouchers = Collection(), Collection(), Collection()
        self.invoices, self.links, self.openings, self.cash_openings, self.control_links, self.mirrors = Collection(), Collection(), Collection(), Collection(), Collection(), Collection()
        self.db = SimpleNamespace(finance_vendor_master=self.vendor, finance_account_master=self.accounts, finance_balanced_vouchers=self.vouchers, purchase_invoices=self.invoices, finance_invoice_vendor_links=self.links, finance_vendor_opening_balances=self.openings, finance_cash_bank_openings=self.cash_openings, finance_vendor_control_links=self.control_links, finance_vouchers=self.mirrors)
        self.patcher = patch.object(api, "db", self.db)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)
        self.ctx = {"tenant_id": "tenant1", "scope": "hq", "admin_id": "admin1"}
    async def test_import_validation_and_repeat(self):
        payload = api.VendorImportPreview(csv_text="name,old_code,pan\nFirst,A1,\nSecond,A1,\nThird,,\nFourth,A4,BAD\n")
        first = await api.import_vendor_master(payload, self.ctx)
        self.assertEqual((first["imported"], first["skipped"]), (1, 3))
        again = await api.import_vendor_master(payload, self.ctx)
        self.assertEqual(again["imported"], 0)
        self.assertEqual(len(self.vendor.rows), 1)
    async def test_balanced_contra_and_reversal(self):
        a = (await api.create_master_account(api.AccountMasterInput(name="Cash", kind="cash"), self.ctx))["account"]
        b = (await api.create_master_account(api.AccountMasterInput(name="Bank", kind="bank"), self.ctx))["account"]
        payload = api.BalancedVoucherInput(voucher_type="contra", voucher_date="2026-01-01", lines=[api.PostingLine(account_id=a["id"], debit="10.00"), api.PostingLine(account_id=b["id"], credit="10.00")])
        original = (await api.create_balanced_voucher(payload, self.ctx))["voucher"]
        rev = (await api.reverse_balanced_voucher(original["id"], api.VoucherReversalInput(reversal_date="2026-01-02", reason="Correction"), self.ctx))["voucher"]
        self.assertEqual(rev["lines"][0]["credit_paise"], 1000)
        with self.assertRaises(HTTPException): await api.reverse_balanced_voucher(original["id"], api.VoucherReversalInput(reversal_date="2026-01-02", reason="Again"), self.ctx)
        other = {"tenant_id": "tenant2", "scope": "hq"}
        with self.assertRaises(HTTPException): await api.reverse_balanced_voucher(original["id"], api.VoucherReversalInput(reversal_date="2026-01-02", reason="Other tenant"), other)
        self.assertEqual(len((await api.list_balanced_vouchers(self.ctx))["rows"]), 2)
        movement = (await api.balanced_account_movements(self.ctx))["rows"]
        self.assertTrue(all(row["debit_paise"] == row["credit_paise"] == 1000 for row in movement))
    async def test_invoice_link_is_scoped_and_cannot_be_duplicated(self):
        vendor = (await api.create_master_vendor(api.VendorMasterInput(name="Supplier"), self.ctx))["vendor"]
        invoice_id = ObjectId()
        await self.invoices.insert_one({"_id": invoice_id, "tenant_id": "tenant1", "status": "Approved", "vendorName": "Supplier"})
        payload = api.InvoiceVendorLink(vendor_id=vendor["id"])
        other = {"tenant_id": "tenant2", "scope": "hq"}
        with self.assertRaises(HTTPException):
            await api.link_invoice_vendor(str(invoice_id), payload, other)
        result = await api.link_invoice_vendor(str(invoice_id), payload, self.ctx)
        self.assertEqual(result["link"]["vendor_id"], vendor["id"])
        with self.assertRaises(HTTPException):
            await api.link_invoice_vendor(str(invoice_id), payload, self.ctx)
        self.assertEqual(self.invoices.rows[0]["vendorName"], "Supplier")
        self.assertNotIn("finance_vendor_id", self.invoices.rows[0])
        second = (await api.create_master_vendor(api.VendorMasterInput(name="Correct supplier"), self.ctx))["vendor"]
        correction = api.InvoiceVendorCorrection(vendor_id=second["id"], expected_vendor_id=vendor["id"], reason="Corrected after review")
        corrected = await api.correct_invoice_vendor_link(str(invoice_id), correction, self.ctx)
        self.assertEqual(corrected["link"]["vendor_id"], second["id"])
        self.assertEqual(corrected["link"]["history"][0]["from_vendor_id"], vendor["id"])
        with self.assertRaises(HTTPException):
            await api.correct_invoice_vendor_link(str(invoice_id), correction, self.ctx)
    async def test_reconciliation_only_counts_approved_and_separates_unmapped(self):
        await self.links.insert_one({"_id": "invoice:i1", "tenant_id": "tenant1", "invoice_id": "i1", "vendor_id": "v1", "vendor_code": "V1", "vendor_name": "Supplier"})
        invoices = {"rows": [{"id": "i1", "status": "Approved", "balance_due": 10.25}, {"id": "i2", "status": "PartiallyPaid", "balance_due": 2.5}, {"id": "i3", "status": "Draft", "balance_due": 50}]}
        with patch("app.routes.finance_routes.payables", new=AsyncMock(return_value=invoices)):
            report = await api.vendor_payables_reconciliation(self.ctx)
        self.assertEqual(report["mapped_paise"], 1025)
        self.assertEqual(report["unmapped_paise"], 250)
        self.assertEqual(report["unmapped"][0]["id"], "i2")
    async def test_opening_balance_is_staged_once_and_scoped(self):
        vendor = (await api.create_master_vendor(api.VendorMasterInput(name="Supplier"), self.ctx))["vendor"]
        data = api.VendorOpeningBalanceInput(vendor_id=vendor["id"], cutoff_date="2026-01-01", amount="23.50")
        created = (await api.create_vendor_opening_balance(data, self.ctx))["opening_balance"]
        self.assertEqual((created["amount_paise"], created["status"]), (2350, "unposted"))
        with self.assertRaises(HTTPException): await api.create_vendor_opening_balance(data, self.ctx)
        other = {"tenant_id": "tenant2", "scope": "hq"}
        self.assertEqual((await api.list_vendor_opening_balances(other))["total_paise"], 0)
        self.assertEqual(len(self.vouchers.rows), 0)
    async def test_cash_openings_and_cutoff_review(self):
        cash = (await api.create_master_account(api.AccountMasterInput(name="Cash", kind="cash"), self.ctx))["account"]
        bank = (await api.create_master_account(api.AccountMasterInput(name="Bank", kind="bank"), self.ctx))["account"]
        entry = api.CashBankOpeningInput(account_id=cash["id"], cutoff_date="2026-01-01", amount="100")
        await api.create_cash_bank_opening(entry, self.ctx)
        with self.assertRaises(HTTPException): await api.create_cash_bank_opening(entry, self.ctx)
        with self.assertRaises(HTTPException): await api.create_cash_bank_opening(api.CashBankOpeningInput(account_id=cash["id"], cutoff_date="2026-01-01", amount="1", direction="credit"), self.ctx)
        await api.create_cash_bank_opening(api.CashBankOpeningInput(account_id=bank["id"], cutoff_date="2026-01-02", amount="5", direction="credit"), self.ctx)
        report = await api.opening_reconciliation(self.ctx)
        self.assertEqual((report["account_debit_paise"], report["account_credit_paise"]), (10000, 500))
        self.assertTrue(report["mixed_cutoffs"])
        self.assertEqual(len(self.vouchers.rows), 0)
    async def test_creditor_assignment_requires_correct_account_and_no_duplicate(self):
        vendor = (await api.create_master_vendor(api.VendorMasterInput(name="Supplier"), self.ctx))["vendor"]
        cash = (await api.create_master_account(api.AccountMasterInput(name="Cash", kind="cash"), self.ctx))["account"]
        control = (await api.create_master_account(api.AccountMasterInput(name="Creditors", kind="creditor_control"), self.ctx))["account"]
        with self.assertRaises(HTTPException): await api.assign_vendor_control_account(vendor["id"], api.VendorControlAccountInput(account_id=cash["id"]), self.ctx)
        await api.assign_vendor_control_account(vendor["id"], api.VendorControlAccountInput(account_id=control["id"]), self.ctx)
        with self.assertRaises(HTTPException): await api.assign_vendor_control_account(vendor["id"], api.VendorControlAccountInput(account_id=control["id"]), self.ctx)
        replacement = (await api.create_master_account(api.AccountMasterInput(name="Service Creditors", kind="creditor_control"), self.ctx))["account"]
        correction = api.VendorControlCorrection(account_id=replacement["id"], expected_account_id=control["id"], reason="Wrong account")
        updated = (await api.correct_vendor_control_account(vendor["id"], correction, self.ctx))["link"]
        self.assertEqual(updated["history"][0]["from_account_id"], control["id"])
        with self.assertRaises(HTTPException): await api.correct_vendor_control_account(vendor["id"], correction, self.ctx)
        journal = api.BalancedVoucherInput(voucher_type="journal", voucher_date="2026-01-01", lines=[api.PostingLine(account_id=cash["id"], debit="5"), api.PostingLine(account_id=control["id"], credit="5")])
        with self.assertRaises(HTTPException): await api.create_balanced_voucher(journal, self.ctx)
    async def test_payment_reconciliation_detects_missing_and_wrong_mirrors(self):
        invoice_id = ObjectId()
        await self.invoices.insert_one({"_id": invoice_id, "tenant_id": "tenant1", "invoiceNo": "I1", "payments": [{"paymentId": "p1", "amount": 10}, {"paymentId": "p2", "amount": 4}]})
        await self.mirrors.insert_one({"_id": ObjectId(), "tenant_id": "tenant1", "source": "purchase_invoice_payment", "id": "p1", "linked_invoice_id": str(invoice_id), "amount": 9})
        await self.mirrors.insert_one({"_id": ObjectId(), "tenant_id": "tenant1", "source": "purchase_invoice_payment", "id": "orphan", "linked_invoice_id": str(invoice_id), "amount": 1})
        report = await api.invoice_payment_reconciliation(self.ctx)
        self.assertEqual((report["invoice_payment_count"], report["mirror_count"], len(report["issues"])), (2, 2, 3))
        self.assertTrue(any("amount differs" in row["issue"] for row in report["issues"]))
        self.assertTrue(any("mirror missing" in row["issue"] for row in report["issues"]))
        self.assertTrue(any("no matching" in row["issue"] for row in report["issues"]))
    async def test_reject_unbalanced(self):
        a = (await api.create_master_account(api.AccountMasterInput(name="Cash", kind="cash"), self.ctx))["account"]
        b = (await api.create_master_account(api.AccountMasterInput(name="Bank", kind="bank"), self.ctx))["account"]
        payload = api.BalancedVoucherInput(voucher_type="journal", voucher_date="2026-01-01", lines=[api.PostingLine(account_id=a["id"], debit="10"), api.PostingLine(account_id=b["id"], credit="9")])
        with self.assertRaises(HTTPException): await api.create_balanced_voucher(payload, self.ctx)
        self.assertEqual(len(self.vouchers.rows), 0)

class FinanceMasterHttpTest(unittest.TestCase):
    def setUp(self):
        self.collection = Collection()
        self.patcher = patch.object(api, "db", SimpleNamespace(finance_vendor_master=self.collection))
        self.patcher.start()
        self.addCleanup(self.patcher.stop)
        self.app = FastAPI()
        self.app.include_router(router)
        self.client = TestClient(self.app)
        self.addCleanup(self.client.close)
    def test_finance_permission_and_tenant_boundary(self):
        self.app.dependency_overrides[get_tenant] = lambda: {"tenant_id": "one", "scope": "hq", "_managed_departments": []}
        self.assertEqual(self.client.post("/api/finance/vendor-master", json={"name": "Supplier"}).status_code, 403)
        self.app.dependency_overrides[get_tenant] = lambda: {"tenant_id": "one", "scope": "hq", "_managed_departments": ["Finance"]}
        result = self.client.post("/api/finance/vendor-master", json={"name": "Supplier", "account_number": "123456789012"})
        self.assertEqual(result.status_code, 422)
        result = self.client.post("/api/finance/vendor-master", json={"name": "Supplier"})
        self.assertEqual(result.status_code, 201)
        bad_csv = self.client.post("/api/finance/vendor-master/import-preview", json={"csv_text": "name,account_number\nSupplier,123456789012\n"})
        self.assertEqual(bad_csv.status_code, 400)
        self.assertEqual(len(self.client.get("/api/finance/vendor-master").json()["rows"]), 1)
        self.app.dependency_overrides[get_tenant] = lambda: {"tenant_id": "two", "scope": "hq", "_managed_departments": ["Finance"]}
        self.assertEqual(self.client.get("/api/finance/vendor-master").json()["rows"], [])

if __name__ == "__main__": unittest.main()
