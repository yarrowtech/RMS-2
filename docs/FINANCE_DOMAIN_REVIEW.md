# RMS finance system: functional review for finance expert

**Purpose:** Explain the finance-related functions currently present in the RMS source code, where a user encounters them, how the records connect, and what needs an accountant's decision.

**Review date:** 26 November 2026. **Basis:** Source-code review of the current workspace. This is not a live-data audit, a demonstration that every screen has been exercised, or confirmation that the accounting treatment meets statutory requirements. Screens and routes can exist in code without being connected to the active menu. Items described as staging or independent records should not be treated as a completed general ledger.

## 1. Executive picture

The system currently combines operational purchasing, inventory and POS records with a Finance workspace. There are persistent finance records and operational balances, but there is **not yet one fully integrated double-entry accounting system**. There are two distinct voucher stores:

1. **Vouchers & notes:** single-amount finance records, also used to mirror certain invoice payments and advances. These can affect some dashboard calculations but are not balanced journal entries.
2. **Journal & contra:** separate balanced, multi-line records with reversal support. The screen currently creates two lines. These records do not update the dashboard, purchase invoice balances, cash/bank balances or the first voucher store.

The vendor master, creditor account assignments, invoice-to-vendor mappings, and opening balances are additional records. Some are connected for review, but they do not yet form a complete vendor subledger and general ledger. A finance expert should therefore review the logic before using this module for financial reporting or posting actual opening balances.

### Status terminology

| Term in this document | Meaning |
|---|---|
| Connected operational record | A screen reads or updates existing purchase invoices, POS bills, payments or other operational records. This does not by itself establish a GL posting. |
| Persistent but separate | Stored in the database but not fully connected to accounting balances or reports. |
| Staged/unposted | Captured for later review; expressly excluded from live balances. |
| Old screen / not active in Finance workspace | A component is present in the repository but the current Finance route loads a different workspace. |
| Needs validation | Behaviour is inferred from source and should be tested using representative data and a running database. |

## 2. Department and tab map

| Department / portal | Tab or screen | Finance-related purpose | Connection / limitation |
|---|---|---|---|
| Finance | Finance dashboard | AP, AR, revenue, estimated margin, GST figures and recent vouchers | Derived from operational invoices, POS sales and the single-amount finance vouchers. Subject to calculation and record limits described below. |
| Finance | Accounts payable | Lists invoice balances and allows a payment | Reads purchase invoices; the Pay action calls the existing purchase invoice payment route. The list includes non-cancelled positive-balance records, even though its text says approved invoices. Payment itself requires Approved or PartiallyPaid status. |
| Finance | Accounts receivable | Lists credit POS sale balances and records a receipt | Credit/Udhar/Invoice sales less receipts linked using sale ID. No full customer subledger or double-entry AR posting. |
| Finance | Vendor master | Manually create, edit, link approved registered vendors, preview/import vendor CSV | A separate finance master. Existing registered vendor linkage is explicit. Stores only last four bank digits, not a full usable bank account or Aadhaar number. |
| Finance | Cash & bank accounts | Maintain cash, bank, general ledger and creditor-control account records | Master records only. Their creation does not create actual bank/cash balances. |
| Finance | Journal & contra | Record balanced two-account entries and reversals; see movements | Separate from operational payment and voucher records. Creditor control accounts cannot be used until vendor-subledger posting exists. |
| Finance | Link payable vendors | Map approved outstanding invoices to finance vendors; see mapped/unmapped totals; initiate invoice payment | Mapping is manually confirmed and stored separately; the underlying invoice and existing payment path stay unchanged. Corrections retain a reason/history. |
| Finance | Cash & bank openings | Enter a cutoff date, debit or credit amount and reference | Unposted staging; cash credit is rejected. Does not change a bank/cash balance. |
| Finance | Vendor opening balances | Enter vendor amount owed at cutoff and reference | Unposted staging; not included in AP, vendor ledger or financial reports. One staged record per vendor; correction/posting is not yet provided. |
| Finance | Vendor creditor accounts | Assign or correct a vendor's creditor control account | Persistent setup and correction history only; no vendor-payment posting into that account. |
| Finance | Payment reconciliation | Compare invoice payment IDs to purchase-invoice payment mirrors | Read-only exception report; does not reconcile to bank statements or repair mismatches. |
| Finance | Vendor ledger | Vendor statement, open bills, payment allocations, advances and advance adjustment | Primarily finds records by vendor name; separate from finance-master IDs and staged opening balances. Uses the purchase-invoice payment path for bill payments. |
| Finance | Vouchers & notes | Create payment, receipt, contra, journal, debit note and credit note records | Single account/amount records; not the balanced Journal & contra store. Direct vendor payment vouchers do not automatically settle purchase invoices. |
| Finance | Outstanding aging | Groups positive invoice balances by overdue age | Excludes cancelled invoices, but code does not explicitly limit the report to approved status; missing/invalid dates fall in current. |
| Finance | GST & reports | Summary of revenue, purchase, expense, net GST and 30-day voucher totals | Operational estimates, not a complete GST return or audited financial statements. |
| Merchandiser Buyer | Orders / purchase orders; Purchase Invoice | Purchasing and supplier invoicing | Invoices can originate from PO/GRC/GRN flows; approved invoice balances and payments feed Finance and vendor views. Inventory movement remains in receiving/GRN flow. |
| Merchandiser Buyer | Budget & OTB | Budget by season/division/department and committed PO expenditure | Operational purchasing control, not an accounting budget ledger. Section filters department choices; current OTB grouping is division and department. |
| Merchandiser Buyer | Debit Note | Buyer-side note screen | Separate workflow from Finance manual debit-note vouchers. Its accounting connection must be verified before assuming the two are the same. |
| Cashier | POS / transactions and Finance | Sales, payment method, returns and payment-wise summaries | Finance summary AR and revenue query POS sale records. Current Cashier component invokes CashierFinance without passing its optional transactions prop; confirm actual runtime data path before relying on this tab. |
| Vendor / Merchandiser Seller | Purchase Invoices; Finance & Analytics | Vendor can see related invoices, payment information and submit payment disputes | Vendor analytics reads purchase invoices and their payments using vendor ID. Subscription tier can limit history/features. This is the vendor-facing view, not the retailer's GL. |
| Vendor / registration | Registration, tax and KYB | Vendor identity, PAN/GST, bank and supporting documents | Registered vendor identity is separate from the retailer's finance master; finance can link an approved vendor. KYB retains masked account/Aadhaar values rather than full numbers. |

Sources: [active Finance workspace](../src/components/Finance/FinanceWorkspace.jsx), [Finance router](../rms_backend/app/routes/finance_routes.py), [finance masters and additional endpoints](../rms_backend/app/routes/finance_master_routes.py), [buyer screen routing](../src/components/Mbuyer/mbuyer.jsx), [cashier routing](../src/components/Cashier/Cashier.jsx), [vendor sidebar](../src/components/Merchandiser_Seller/MsellerSidebar.jsx).

## 3. Vendor master and party identity

### 3.1 Registered supplier versus finance vendor

The registered-vendor system maintains vendor identity and a retailer/vendor relationship. On approval, the existing registration flow assigns a tenant-specific code such as `VEN-00001`. Tax profile fields include PAN, GST category, GSTIN and state. KYB can capture bank holder, bank name, IFSC, document references and masked identifiers. The existing implementation discards the full submitted bank account number and retains its last four digits; Aadhaar is similarly represented by a last-four value and document reference. Review the suitability and access to documents separately.

Finance has a separate master for manual, walk-in, migrated and linked registered vendors. Manual/imported records receive an `FMV-` code generated from an identifier. Fields include name, type, old code, creditor group (Sundry Creditors or Service Creditors), contact, address, PAN, GST status/GSTIN, bank holder/name, IFSC and account last four digits. Full bank account numbers and Aadhaar numbers are not supported by this master. There is no integrated bank beneficiary verification or bank-payment execution shown here.

Finance users explicitly link an approved registered vendor to create a finance master entry, retaining the registered code when available. The link is an association; changing a finance record is not a demonstrated two-way update of the vendor's registration profile.

### 3.2 Import and duplicates

The finance vendor CSV workflow previews validation and warnings for duplicate names, old codes, PAN and GSTIN. Import requires an old-system code; rows with warnings or validation errors are skipped. This imports vendor master details only, not outstanding invoices, balances or bank account numbers. It does not establish that all legacy invoices and registered vendors have been matched. Preview/import duplicate safeguards must be tested with the intended migration volume and concurrent users.

**Questions for the expert:** What is the minimum onboarding data for each supplier type? How should unregistered suppliers, proprietors, one-time/walk-in suppliers, GST registrations in multiple states and changes to bank accounts be handled? What constitutes a duplicate party? Which party and bank detail changes require approval, evidence and effective dates?

Sources: [registered vendor routes](../rms_backend/app/routes/vendor_routes.py), [finance vendor master UI](../src/components/Finance/FinanceMasters.jsx), [finance master API](../rms_backend/app/routes/finance_master_routes.py).

## 4. Procurement to vendor payment

### 4.1 Operational sequence

The relevant operational chain is **vendor / purchase order -> goods receipt and invoice -> invoice approval -> payable/payment**. Purchase invoice logic supports PO-linked and direct-GRC paths. It can populate vendor, PO/GRN/GRC references and invoice items; it includes matching and approval workflow, schedules, vendor communication and payments. It is important to confirm the exact business use of GRC and GRN with the operations team.

A purchase invoice has its own total, paid amount, balance due, status and payment list. Finance reads those fields. The invoice's payment route accepts a payment, updates its paid amount/balance/status, appends a payment entry, and creates a single-amount finance voucher mirror. Vendor-facing analytics derives invoice/payment information from purchase invoice records when they are associated with the vendor ID.

**Important controls and gaps:**

- The invoice update and finance voucher mirror are separate writes. Failure between them can leave a missing mirror. Concurrent requests and retries require additional testing and a reliable idempotency/transaction design.
- The existing payment pathway does not post the payment into the new balanced Journal & contra store or use the new creditor and company cash/bank account masters.
- The Finance payable list's implementation includes all non-cancelled invoices with a positive `balanceDue`; the payment endpoint accepts only Approved or PartiallyPaid invoices. The list and dashboard may therefore include amounts that the vendor ledger does not treat as payable.
- Manual Finance payment vouchers are not equivalent to an invoice payment and do not automatically reduce an invoice's due amount.
- Confirm treatment and clearance of cheques, post-dated cheques, advances, TDS, GST, bank charges, deductions and payment approval. Do not assume all are fully accounted for because a payment mode or reference field exists.

### 4.2 Mapping invoices to vendors

Finance > Link payable vendors displays approved/partially paid outstanding invoices from the operational source. The user selects a finance vendor and confirms a separate mapping. A registered-vendor identity mismatch is rejected when both identities are known. Corrections require a reason and keep a change history. The mapping does not rewrite invoice vendor data or automatically change its payment/balance calculation.

The same screen groups **mapped approved outstanding invoice balances** by finance vendor and shows unmapped amounts. It excludes advances, debit notes and opening balances; it is not a full net vendor ledger. The Pay invoice button opens the existing invoice payment form, displaying the finance vendor mapping for context.

### 4.3 Vendor ledger and advances

Finance > Vendor ledger reads approved, partially paid and paid invoices by vendor name, their itemised payments, vendor advances and qualifying Finance debit notes. It builds a running statement and can download a statement. The reported outstanding is based on invoices, cash payments, advances and selected debit notes; it is not currently linked to the staged vendor opening balance.

A payment can be allocated to specific open invoices or, by default, oldest due first; excess can be kept as an advance. The implementation calls the existing invoice payment routine for each allocation, and separately records an advance if needed. Applying an advance changes invoice payment/balance fields and records an advance adjustment, without creating a new cash payment. Multi-invoice operations are sequential, so expert and technical review of partial failure and recovery is required.

The ledger uses vendor-name matching for much of its source data. A change in spelling or two suppliers with the same name can affect grouping. It does not use the new finance vendor mapping as its sole source of identity.

Sources: [purchase invoice routes](../rms_backend/app/routes/Purchaseinvoice_routes.py), [vendor ledger routes](../rms_backend/app/routes/finance_vendor_ledger_routes.py), [vendor ledger screen](../src/components/Finance/FinanceVendorLedger.jsx), [invoice mapping screen](../src/components/Finance/FinanceInvoiceLinks.jsx).

## 5. Sales, customer receipts and cashier

POS sale records supply the Finance dashboard's sales amount and output-GST estimate. Finance receivables considers sales whose payment method is Credit, Udhar or Invoice; it subtracts receipt vouchers linked by the sale ID. Cash/UPI sales are treated by this view as settled at the sale.

The Finance receipt form supports a linked POS sale ID, entered in the voucher form. The code stores that reference and calculates receivable balances from matching receipt amounts. The expert should confirm receipt allocation, overpayments, advances, unidentified receipts, refunds, customer identification, and whether customer balances should also connect to a customer master and a double-entry ledger. The implementation is not a complete customer AR subledger.

POS also has return/credit-note logic in the cashier backend. It is a separate flow from a Finance credit-note voucher, and its effect on Finance revenue, GST and customer credit must be reconciled and tested. In particular, Finance summary queries records with `type: sale` and calculates from fields on those records; it should not be assumed to produce net revenue or statutory output tax after every return.

The Cashier > Finance screen has code for payment-wise totals, returns and transactions, but the current caller passes no `transactions` prop and the component defaults to an empty list. Verify whether this screen is populated in the deployed route before presenting it as a reliable store-finance report.

Sources: [cashier UI routing](../src/components/Cashier/Cashier.jsx), [cashier finance component](../src/components/Cashier/CashierFinance.jsx), [cashier backend](../rms_backend/app/routes/cashier_routes.py), [Finance receivable logic](../rms_backend/app/routes/finance_routes.py).

## 6. Accounts, vouchers and opening balances

### 6.1 Account setup

Finance account master permits cash, bank, general ledger and creditor-control types. Account names and limited bank information can be maintained. Type changes after creation are rejected. A finance vendor can be assigned one creditor-control account; corrections retain history. This assignment is currently **setup only**; it does not post the vendor's invoices, advances or payments to the account.

The model does not yet establish a complete chart of accounts with account hierarchy, opening and closing balances, vendor/customer subledger control totals, posting periods and statutory financial statement mapping.

### 6.2 Single-amount vouchers and notes

Finance > Vouchers & notes stores voucher type, date, amount, account text, counterparty text, mode, reference, narration, category and optional invoice/sale IDs. It does not require balanced debit and credit lines. The invoice payment process and advance flow also mirror records into this collection.

A receipt with linked sale ID is used by the AR calculation. The vendor ledger includes qualifying unlinked Finance debit notes by counterparty name, but does not count arbitrary manual payment vouchers as bill settlements. The dashboard treats voucher categories and types using simplified rules: expense category or debit note increases its expense total; income category or credit note increases manual income. These rules require expert review and should not be assumed to represent correct treatment in every transaction.

### 6.3 Balanced journals and contra

Finance > Journal & contra has a separate persistent store. The backend accepts two or more lines with equal debit and credit totals in paise; the current screen enters one debit and one credit with the same amount. Contra requires two different cash/bank accounts. General journals cannot use creditor-control accounts until vendor subledger posting is available. A reversal records the opposite lines, with a reason and date, while preserving the original.

These entries have their own account-movement view. They do **not** currently change operational invoices, company bank/cash balances, the single-amount voucher list, or the Finance dashboard/reports. A reversal likewise stays in this separate system. Posting periods, approvals and a complete financial ledger are not established.

### 6.4 Opening balances

Finance > Vendor opening balances and Finance > Cash & bank openings hold one unposted record per vendor/account with cutoff date, amount and reference. Bank debit/credit directions are supported; a cash credit is rejected. The review view totals staged amounts and warns when cutoff dates differ.

There is no posting into the vendor ledger or GL, no complete opening trial balance, and no demonstrated correction workflow for these staged records. The review deliberately excludes other assets, liabilities, equity and invoice-level opening data. Avoid entering the same liability both as a summary opening and as individual unpaid invoices without an agreed reconciliation and posting policy.

**Questions for the expert:** What account structure and subledger design should be used? Which entries need invoice-wise allocation? What opening trial balance and cutover date should be used? How should historical invoices, unapplied advances, tax balances and unmatched bank items be imported without duplication? Which approvals and reversal rules apply?

Sources: [master and balanced-entry routes](../rms_backend/app/routes/finance_master_routes.py), [balanced-entry screen](../src/components/Finance/FinanceBalancedVouchers.jsx), [opening balance screens](../src/components/Finance/FinanceOpeningBalances.jsx) and [cash/bank openings](../src/components/Finance/FinanceCashBankOpenings.jsx).

## 7. Dashboard, aging, GST and reports: current calculations

| Figure | Current code basis | Expert review point |
|---|---|---|
| AP / purchases | Non-cancelled purchase invoices: balance due and invoice total | Draft/held status handling differs from vendor ledger; confirm recognition rules, period boundaries and returns. |
| Overdue AP | Positive invoice balance with due date before today | Confirm due-date rules and treatment of holds, disputed invoices, credit terms and missing dates. |
| AR | Credit/Udhar/Invoice POS sales, less receipt vouchers linked to sale ID; floored at zero | Check partial receipts, overpayments, refunds, write-offs and customer-level allocation. |
| Revenue | Sum of POS sale `net_payable` plus manually classified income/credit-note vouchers | May include GST and omit or misstate return handling; determine net sales and tax treatment. |
| Purchases | Sum of invoice totals | This is not automatically cost of goods sold; stock and closing inventory treatment are not represented in this calculation. |
| Estimated margin | Revenue plus manual income minus purchase totals and manually counted expenses | An operational estimate, not an accounting profit-and-loss statement. |
| Input GST | Sum of invoice item `taxAmount` | Confirm eligible ITC, status, GST split, tax periods, returns, reversals and source document validation. |
| Output GST | Sum of POS sale `summary.total_gst` | Confirm tax periods, returns, credit notes, exemptions and sale-type coverage. |
| Net GST | Estimated output minus estimated input | Not a GST return, payment liability calculation, or reconciliation with tax portals. |
| Voucher totals | Last 30 days of single-amount finance vouchers grouped by type | Excludes the separate balanced journal/contra store. |

Dashboard calculation reads at most 2,000 purchase invoices, 5,000 sales and 5,000 single-amount vouchers, without a full accounting-period selection. These limits can understate totals for larger datasets. Other endpoints have their own limits and status rules. All figures need reconciliation and performance/load testing.

Sources: [finance summary and aging](../rms_backend/app/routes/finance_routes.py), [Finance workspace UI](../src/components/Finance/FinanceWorkspace.jsx).

## 8. Reconciliation and controls currently visible

- **Invoice-to-vendor reconciliation:** mapped and unmapped approved outstanding invoice amounts; mapping corrections recorded. It is not a net vendor statement.
- **Payment reconciliation:** compares invoice payment IDs and purchase-invoice payment mirrors, flags missing, duplicate, orphaned, wrong-invoice or different-amount mirrors. It does not check bank statements, repair entries or check all possible business conditions. Advance-adjustment entries have payment IDs but deliberately have no new payment mirror, so they can appear as missing mirrors and need manual interpretation.
- **Opening staging review:** displays staged vendor/cash/bank totals and distinct cutoff dates. It does not prove that an opening trial balance balances.
- **Balanced journal reversal:** records a reversing entry while retaining the original, but remains confined to the separate journal system.
- **Finance access:** Finance endpoints require Finance department/full HQ access or the `finance` permission. HQ data is tenant scoped; store/branch finance is additionally store scoped in these routes. Confirm all interconnected purchase-invoice and vendor routes enforce the intended store-level restrictions consistently.

Finance should define maker/checker roles, approval thresholds, attachments, change history, numbering, backdating, closing dates, reversal authorisation, export access, and bank-detail controls. The presence of an access check or history field does not establish a complete internal-control framework.

## 9. Screens present in source but not the active Finance workspace

The active `/dashboard/finance`, `/finance` and `/admin/finance/dashboard` routes load `Finance.jsx`, which loads `FinanceWorkspace`. The repository also contains a separate legacy `FinanceSidebar` and screens named Finance AP Voucher, AR Voucher, General Voucher, Contra Voucher, Vendor, Revenue, Expenses, Payroll, GST and Profit & Loss. Several of the old voucher screens hold their lists in React component state and show example values. They are not the active workspace routing described above and should not be represented as working accounting modules merely because their files or labels exist.

This distinction matters when the finance expert reviews screenshots, old demonstrations or code: identify the actual logged-in route and verify save/reload and downstream effects for each operation.

Sources: [application routes](../src/App.jsx), [active Finance entry](../src/components/Finance/Finance.jsx), [older sidebar](../src/components/Finance/FinanceSidebar.jsx), [old AP screen](../src/components/Finance/FinanceAPVoucher.jsx), [old general voucher](../src/components/Finance/FinanceGeneralVoucher.jsx).

## 10. Recommended finance expert review agenda

### A. Chart of accounts and ledgers

1. Define account groups, account codes, legal entity and branch structure, financial year and posting periods.
2. Decide whether Sundry Creditors and Service Creditors are control accounts, vendor classifications, or both; specify the vendor-level subledger and reconciliation to GL.
3. Define customer, supplier, bank, cash, advance, expense, purchase, inventory, revenue, GST and withholding accounts.
4. Specify trial balance, balance sheet, P&L, cash flow, account ledger and supporting schedules.

### B. Accounting entries for representative events

Please provide the debit/credit entries, dates, taxes, source documents, approvals and reversal treatment for:

- Purchase order and goods receipt, including unbilled goods.
- Supplier invoice with GST, discount, freight, rounding and any TDS.
- Supplier credit/debit note, purchase return and price/quantity difference.
- Supplier advance, partial payment, multi-invoice allocation, excess payment and advance adjustment.
- POS cash, bank/UPI/card and credit sales; settlement and charges.
- Customer receipt, sale return, credit note, refund, exchange and write-off.
- Cash deposit/withdrawal, bank-to-bank transfer and petty cash.
- Expenses, accruals, prepaid expenses, depreciation, payroll and period-end adjustments.
- Opening balance, cutover, reconciliation and corrections after closing a period.

### C. Taxes and statutory treatment

Confirm the exact GST treatment for each event, tax types/rates, input credit eligibility, debit/credit notes, return periods and reconciliation. Specify when TDS or other deductions apply and the required master fields and reports. These are questions for the business's qualified finance/tax adviser; the current summary calculations should not be considered filing-ready.

### D. Operational controls

- Who creates, verifies and approves vendors, bank accounts, invoices, payments, journals and reversals?
- Can a single person create and approve a beneficiary or payment? What evidence is retained?
- Which balances are legal-entity-wide versus branch/store-specific? How are inter-branch transactions handled?
- Which documents are mandatory and who can see PAN, Aadhaar, bank details and uploaded files?
- How are duplicate invoices and parties detected? How are disputes, stale payments, failed writes and bank reconciliation resolved?
- Which reports must reconcile daily, monthly and at year end? Who signs off the reconciliation?

### E. Migration and cutover

Agree on a single cutover date, source system, master-code mapping, trial balance, invoice-wise unpaid balances, advances and bank reconciliation. Decide whether opening payables come from detailed invoices or control totals and document how duplication will be prevented. Validate totals and sample individual vendors before posting, then obtain finance sign-off.

## 11. Known implementation priorities before finance go-live

1. Reconcile the current code's status filters, date handling, report limits, summary formulas, tax and return treatment with approved finance definitions.
2. Complete a unified double-entry GL and vendor/customer subledgers with stable IDs, chart of accounts, periods, approvals and traceable source transactions.
3. Make invoice payment, allocation, finance mirror and GL posting reliable and idempotent, including concurrency and partial failures. Preserve existing PO/GRN/stock behaviour.
4. Implement approved opening-balance import/posting, control totals, corrections and reconciliation; current openings are staged only.
5. Complete cash/bank account balances, payment modes, bank reconciliation and secure beneficiary details with appropriate access and change controls.
6. Connect sales, returns, AR, vendor advances and debit/credit notes to the agreed ledger without double counting.
7. Test the actual UI, permissions, multi-store scope, large data volumes, database failures, backup/restore and financial reports with a running test database and expert-approved examples.

## 12. Evidence and review limitations

This write-up describes the current repository and the changes made in the working session. It does not certify the deployed version or live settings. Some tests in the workspace use simulated database collections; they do not replace end-to-end testing against MongoDB. The main source files for further review are:

- [Finance workspace](../src/components/Finance/FinanceWorkspace.jsx) and [finance masters UI](../src/components/Finance/FinanceMasters.jsx).
- [Finance summary, receivables and single-amount vouchers](../rms_backend/app/routes/finance_routes.py).
- [Finance master, mapping, openings, journal and reconciliation endpoints](../rms_backend/app/routes/finance_master_routes.py).
- [Vendor ledger and advance endpoints](../rms_backend/app/routes/finance_vendor_ledger_routes.py).
- [Purchase invoice and payment routes](../rms_backend/app/routes/Purchaseinvoice_routes.py).
- [Registered vendor identity and KYB routes](../rms_backend/app/routes/vendor_routes.py).
- [Vendor-facing finance analytics](../rms_backend/app/routes/vendor_finance_routes.py).
- [Cashier routes](../rms_backend/app/routes/cashier_routes.py) and [cashier finance UI](../src/components/Cashier/CashierFinance.jsx).
- [Buyer budget and OTB screen](../src/components/Mbuyer/Budgetotb.jsx) and [buyer routes](../rms_backend/app/routes/mbuyer_routes.py).
