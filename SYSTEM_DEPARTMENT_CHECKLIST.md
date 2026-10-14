# RMS Department-wise System Checklist

Use this checklist for deployment, UAT, migration, or internal-server verification. Record defects beside the failed item and retest after correction.

## 1. Platform and shared services

- [ ] Frontend opens over the approved internal URL or HTTPS domain.
- [ ] Backend health/API endpoint responds without timeout.
- [ ] MongoDB connects and required indexes are created.
- [ ] Environment variables contain the correct API URL, database, JWT secret and integration credentials.
- [ ] Login, logout, password reset and session expiry work.
- [ ] Tenant isolation is verified with two different tenant accounts.
- [ ] HQ users cannot access another tenant's records.
- [ ] Store-scoped users see only their assigned store.
- [ ] Department route guards block unauthorized modules.
- [ ] Notifications and internal chat load without repeated timeout errors.
- [ ] File upload limits and supported CSV/XLSX formats are verified.
- [ ] Large-file test completes without making normal API requests unavailable.
- [ ] Scheduled jobs start once and do not run once per web worker.
- [ ] Application, database and upload backups are scheduled and restore-tested.
- [ ] Audit/error logs are retained and accessible to authorized administrators.

## 2. HQ Administration and IT

- [ ] Create and update the retailer/business profile.
- [ ] Create, edit, activate and deactivate stores.
- [ ] Create an administrator and assign HQ or store scope.
- [ ] Assign one or more departments to an administrator.
- [ ] Assign granular permissions and confirm they take effect.
- [ ] Set or replace a department head.
- [ ] Reset an administrator password.
- [ ] Suspend and reactivate an administrator.
- [ ] Add, edit and search Product Master records.
- [ ] Verify barcode, SKU and product-mapping rules.
- [ ] Confirm plan, seat and store limits are enforced.
- [ ] Verify tenant settings and integrations.

## 3. Inventory and Warehouse

- [ ] Inventory dashboard totals match the underlying stock records.
- [ ] Central Stock List loads without continuous refresh or lag.
- [ ] Product source filters correctly separate Admin, Vendor and GRN stock.
- [ ] Add a product manually and confirm it appears in stock.
- [ ] Bulk-import products/stock and review validation errors.
- [ ] Create and post GRN/GRC receipts.
- [ ] Verify Purchase Invoice linkage.
- [ ] Allocate central stock to a store.
- [ ] Transfer stock between locations.
- [ ] Post a stock adjustment with reason and audit record.
- [ ] Record damage/returns and verify stock movement.
- [ ] Configure reorder levels and verify low-stock alerts.
- [ ] Review stock ledger/movement history.
- [ ] Review expiry and ageing reports.
- [ ] Verify label settings and barcode printing.
- [ ] Confirm stock quantity never becomes ambiguous after re-import/sync.

## 4. Citimart Data Hub

- [ ] Access is available only to the Citimart tenant and authorized departments.
- [ ] Preview Stock file and confirm valid, invalid and skipped row totals.
- [ ] Confirm Source Site aliases map to the intended store or central segment.
- [ ] Confirm Main Warehouse, Semi Fresh and Package/Packed remain separate.
- [ ] Commit a Stock batch without altering live stock before approval.
- [ ] Review and explicitly sync the approved Stock batch.
- [ ] Confirm stock value equals uploaded Closing Amount without a fallback formula.
- [ ] Preview and commit Day-wise Sales with voided rows excluded.
- [ ] Confirm re-upload rules do not create unintended duplicate sales.
- [ ] Preview and commit Purchase/GRC data.
- [ ] Review imported batch history and status.
- [ ] Roll back or permanently remove a test batch and its owned records.
- [ ] Confirm orphaned sales and archived records are not included in analytics.
- [ ] Test a 50,000+ row CSV/XLSX import while monitoring CPU, RAM and API response.

## 5. Forecast and Analytics

- [ ] Overview totals load from the correct tenant data.
- [ ] Demand Forecast uses the selected sales lookback.
- [ ] Citimart forecast groups sales by barcode and active sales week.
- [ ] Vendor Ranking uses the correct tenant/vendor evidence.
- [ ] Purchase Plan subtracts current stock from forecast demand.
- [ ] Purchase Plan excludes missing/zero-cost and fully stocked items.
- [ ] ROI, expected profit and line cost are calculated correctly.
- [ ] Budget allocation and partial-line behavior are correct.
- [ ] Store selection changes the stock scope correctly.
- [ ] Low Stock Alerts show the intended location and severity.
- [ ] Store-wise Inventory shows every mapped stock location.
- [ ] Citimart screens do not show Raphaaa-only instructions or data.
- [ ] CSV/PDF/Excel exports match the visible filters.

## 6. Stock Planning and Forecasting

- [ ] Sales and stock planning inputs load correctly.
- [ ] Replenishment calculations use current stock.
- [ ] Store or warehouse filters return the correct scope.
- [ ] Planning recommendations can be reviewed before action.
- [ ] Reports and exports match the selected period and filters.

## 7. Merchandiser Buyer and Procurement

- [ ] Search and review approved vendors.
- [ ] Review vendor catalogues and product offers.
- [ ] Send an enquiry/RFQ and receive vendor response.
- [ ] Compare quotations and record an award.
- [ ] Create, approve and send a Purchase Order.
- [ ] Verify PO status changes through fulfilment.
- [ ] Confirm receiving/GRN updates the related procurement record.
- [ ] Review vendor ledger, communication and documents.
- [ ] Verify email/portal notifications.

## 8. Vendor Portal

- [ ] Vendor registration and approval work.
- [ ] Vendor login and password recovery work.
- [ ] Profile, contact and business information can be updated.
- [ ] Catalogue items and permitted images can be managed.
- [ ] Retailer enquiries/RFQs are visible only to the intended vendor.
- [ ] Quotations can be submitted and tracked.
- [ ] Purchase Orders can be acknowledged.
- [ ] Dispatch/fulfilment information can be updated.
- [ ] Vendor finance and ledger views match retailer transactions.
- [ ] Vendor-to-vendor network permissions and limits are enforced.

## 9. Cashier and POS

- [ ] Cashier sees only the assigned store.
- [ ] Product/barcode search returns current store stock and price.
- [ ] Complete a cash sale and verify receipt generation.
- [ ] Complete supported digital/payment-method sales.
- [ ] Discounts, tax and totals calculate correctly.
- [ ] Returns/exchanges update stock and reports correctly.
- [ ] Customer creation/linking works during billing.
- [ ] Duplicate submission does not create duplicate sales.
- [ ] End-of-day totals match transaction history.
- [ ] POS sales flow into inventory, finance, CRM and analytics.

## 10. Finance

- [ ] Finance dashboard totals reconcile with source documents.
- [ ] Sales revenue and payment-method totals match POS.
- [ ] Purchase invoices match GRN/GRC and PO records.
- [ ] Record vendor payments and outstanding balances.
- [ ] Create and review debit/credit notes where supported.
- [ ] Verify vouchers and ledger postings.
- [ ] Filter reports by store, vendor and date.
- [ ] Export financial reports and verify totals.
- [ ] Confirm finance users cannot alter operational stock directly.

## 11. HR

- [ ] Create and update employee profiles.
- [ ] Assign employees to the correct store/department.
- [ ] Record and review attendance.
- [ ] Submit and approve/reject leave.
- [ ] Maintain holiday records.
- [ ] Transfer an employee between stores.
- [ ] Generate/review salary records.
- [ ] Verify HR data access is appropriately restricted.

## 12. Logistics

- [ ] Create and track a delivery/dispatch.
- [ ] Assign the correct origin, destination and responsible party.
- [ ] Update shipment milestones and delivery status.
- [ ] Record proof, notes or exceptions where supported.
- [ ] Confirm linked PO/transfer/order status stays consistent.
- [ ] Review logistics reports and overdue items.

## 13. Design and Pattern

- [ ] Create a design project from Idea stage.
- [ ] Add design number, theme, department and product details.
- [ ] Create and version a Tech Pack.
- [ ] Upload and view approved design artwork.
- [ ] Record pattern/sample stages and approvals.
- [ ] Submit and resolve change requests.
- [ ] Release an approved design for production.
- [ ] Verify design-performance/theme analytics use linked data.

## 14. Production and Job Work

- [ ] Configure departments, operations and floor workers.
- [ ] Create a production/material plan.
- [ ] Verify material readiness against central inventory.
- [ ] Create internal and external job-work orders.
- [ ] Issue material and confirm stock deduction.
- [ ] Generate/print the issue challan.
- [ ] Track operation start, completion, rejection, rework and wastage.
- [ ] Receive finished output and reconcile issued material.
- [ ] Confirm vendor/job-worker portal visibility.
- [ ] Verify production dashboards and audit history.

## 15. Third Party

- [ ] Create and maintain third-party records.
- [ ] Link the correct orders/documents.
- [ ] Track status, handoffs and completion.
- [ ] Verify tenant and department access restrictions.
- [ ] Export or report third-party activity.

## 16. Marketing

- [ ] Create and schedule a campaign.
- [ ] Configure target audience, offer and validity.
- [ ] Activate/deactivate campaigns.
- [ ] Record and report redemptions.
- [ ] Verify campaign/customer segmentation.
- [ ] Confirm marketing access to CRM follows permissions.
- [ ] Review campaign performance reports.

## 17. Customer CRM

- [ ] Customer profiles are created from POS and manual entry without duplicates.
- [ ] Search customers by supported identifiers.
- [ ] Review purchase history and store scope.
- [ ] Record follow-ups, notes and feedback.
- [ ] Verify consent/contact preferences where applicable.
- [ ] Confirm CRM access is available only to authorized roles.

## 18. Store Owner and Store Operations

- [ ] Store Owner dashboard reflects only owned/assigned stores.
- [ ] Purchasing workflow works within the store scope.
- [ ] Staff and permission management works.
- [ ] Verification and approval queues work.
- [ ] Usage analytics display correct activity.
- [ ] Store settings save and reload.
- [ ] Citimart daily store operations and targets load correctly.
- [ ] Closing/operational updates are auditable.

## 19. Support, notifications and communications

- [ ] Create, view and update a support ticket.
- [ ] Internal notifications arrive for intended recipients.
- [ ] Notification read/unread status persists.
- [ ] Internal chat loads and sends messages.
- [ ] Document comments/messages stay linked to the correct record.
- [ ] Email failures are logged and recoverable.
- [ ] WhatsApp links/messages use the intended recipient and text.

## 20. Final acceptance

- [ ] Every failed test has an owner and ticket.
- [ ] Critical and high-severity defects are closed.
- [ ] Department heads have signed off their modules.
- [ ] Opening stock and migration totals are formally reconciled.
- [ ] Sales, stock, purchase and finance cross-module totals reconcile.
- [ ] Backup restore has been tested before go-live.
- [ ] Production monitoring covers CPU, RAM, disk, API errors and database health.
- [ ] Rollback plan and responsible contacts are documented.
- [ ] Go-live approval is recorded.

## 21. Raphaaa tenant — Data Hub and analytics

### Data Hub

- [x] Raphaaa tenant detection and tenant-specific feature gating are implemented.
- [x] Historical Sales import with preview, validation, commit and history is implemented.
- [x] Physical Stock snapshot import with preview, validation, commit and history is implemented.
- [x] Unstitched Stock import is implemented for Raphaaa.
- [x] Multi-sheet workbook reading and irrelevant-sheet filtering are implemented.
- [x] Wide and long stock layouts are supported.
- [x] Warehouse stock maps to Raphaaa HQ/central inventory.
- [x] Stock quantities are applied as absolute snapshot values rather than increments.
- [x] Fresh and aged quantities are stored separately for Raphaaa.
- [x] Uploaded stock value is preserved on Raphaaa stock records.
- [x] Import-history export and rollback controls are implemented.
- [x] Raphaaa Product Master cleanup/enrichment preview and apply actions are implemented.
- [x] Original imported product names are preserved for audit.
- [ ] Test all Raphaaa imports with current production files.
- [ ] Reconcile imported totals against the source workbooks.
- [ ] Verify rollback using a non-production test batch.

### Forecast and purchasing

- [x] Raphaaa-enriched Demand Forecast is implemented.
- [x] Division, Section, Department, Design, Brand, Style, Type, Size and Vendor context is supported.
- [x] Raphaaa Vendor Sales Ranking is implemented.
- [x] Vendor comparison across completed calendar years or seasonal windows is implemented.
- [x] Raphaaa tenant-specific Purchase Plan endpoint and screen are implemented.
- [x] Winter/peak-period comparison is implemented.
- [x] Current stock, sales, returns, discounts and repurchase need are included as purchase evidence.
- [x] Promotion evidence and filters are implemented.
- [x] Aged-stock clearance is kept separate from the main purchase recommendation.
- [x] Filtered Purchase Plan CSV export is implemented.
- [x] Separate ageing-clearance CSV export is implemented.
- [x] Raphaaa-specific guide entries are hidden from other tenants.
- [ ] Validate recommended quantities with Raphaaa Procurement.
- [ ] Validate period and seasonal-window settings.
- [ ] Confirm vendor attribution for products linked only through GRN history.
- [ ] Approve the business rules before using recommendations for real orders.

### Design and theme intelligence

- [x] Financial-year Design Performance is implemented.
- [x] Good-seller percentage control is implemented.
- [x] Decline-threshold control is implemented.
- [x] Design action recommendations are implemented.
- [x] Theme Planning is implemented.
- [x] Theme grouping from Tech Pack tags or Collection text is implemented.
- [x] Theme-tag saving is implemented.
- [x] Moving a design between themes is implemented.
- [x] New design-project creation from Theme Planning is implemented.
- [x] Design Performance CSV export is implemented.
- [ ] Validate good-seller and decline thresholds with Merchandising.
- [ ] Review designs currently assigned to “No theme.”
- [ ] Confirm every production design has an approved Tech Pack.

### Raphaaa automation and ML status

- [x] Automated moving-average demand forecasting is implemented.
- [x] Automated rising, stable and falling trend classification is implemented.
- [x] Automated vendor ranking from operational evidence is implemented.
- [x] Automated peak-period purchase calculations are implemented.
- [x] Automated design-performance classification is implemented.
- [x] Automated theme-level planning roll-up is implemented.
- [x] Automated low-stock alert calculation is implemented.
- [ ] A trained machine-learning demand model is not yet implemented.
- [ ] Add seasonal ML forecasting with financial-year and winter-period features.
- [ ] Add promotion-uplift prediction.
- [ ] Add supplier lead-time and late-delivery prediction.
- [ ] Add dead-stock and ageing-risk prediction.
- [ ] Add design-success prediction using historical sell-through.
- [ ] Add forecast-accuracy reporting using MAE, MAPE or WAPE.
- [ ] Add model versioning, retraining and drift monitoring.
- [ ] Require human approval before an ML recommendation creates a live PO or changes stock.

## 22. Remaining platform modules

- [x] Public portals, Retailer/Vendor onboarding, subscriptions, extra seats/stores and Razorpay routing are implemented.
- [x] Super Admin tenant management, approvals, platform support and email-failure visibility are implemented.
- [x] Coupons, Lucky Draw, Newsletter, Staff Tasks, Checklists and Escalations are implemented.
- [x] Supplier Returns, document messages, comments, attachments and buyer/vendor communication are implemented.
- [x] Email, WhatsApp, Razorpay and portal-notification integration points are implemented.
- [ ] Validate payments, external secrets/callbacks, retries, attachment security and operational SLAs.

## 23. Whole-system automation

- [x] Import validation, batch processing, chunked writes and off-event-loop parsing are implemented.
- [x] Low-stock calculations, scheduled jobs, approved stock sync and supported notifications are automated.
- [x] Demand, purchase, vendor, design and theme calculations are automated as documented above.
- [ ] Add a durable job queue with progress, cancellation, retry and dead-letter handling.
- [ ] Add distributed job locks, nightly reconciliation, stale/orphan reports and automatic backup verification.

## 24. Whole-system machine learning

- [x] Rule-based moving-average forecasts, trend classification and ranking calculations are implemented.
- [ ] A trained production ML model is not yet implemented.
- [ ] Build tenant-isolated datasets with seasonality, promotion, holiday, store, product and stockout features.
- [ ] Track MAE, MAPE/WAPE, bias and business impact against the rule baseline.
- [ ] Add model registry, versioning, retraining, rollback, drift monitoring and explanations.
- [ ] Retain human approval before PO creation or live-stock changes.

## 25. Security, reliability and scaling

- [x] Tenant filters, department guards, permissions, scopes, password hashing, CORS and core indexes are implemented.
- [ ] Add MFA, rate limiting, secret rotation, encrypted backups and tenant-isolation security tests.
- [ ] Replace t2.small for large imports; prefer 4 vCPU and 8 GB RAM for frequent large files.
- [ ] Monitor CPU, RAM, disk, latency, errors and slow queries.
- [ ] Load-test normal users during a 50,000+ row import and test interrupted jobs.

## 26. QA and release management

- [ ] Add backend, frontend, route-guard and tenant-isolation automated tests.
- [ ] Add Citimart/Raphaaa fixtures and cross-module end-to-end tests.
- [ ] Run tests in CI with separate staging/production environments.
- [ ] Document releases, database migrations and rollback procedures.
