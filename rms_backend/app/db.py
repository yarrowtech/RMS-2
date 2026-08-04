from motor.motor_asyncio import AsyncIOMotorClient
from .config import settings

client = AsyncIOMotorClient(settings.mongodb_uri)
db = client[settings.mongodb_db]

admins_collection = db["admins"]
vendors_collection = db["vendors"]
orders_collection = db["orders"]
purchaseorders_collection = db["purchase_orders"]
items_collection = db["items"]
grc_collection = db["grc"]

grn_collection       = db["grn"]
purchase_invoice_collection = db["purchase_invoices"]
thirdparty_vendors_collection = db["thirdparty_vendors"]
bookings_collection = db["thirdparty_bookings"]
tasklist_collection = db["tasklist"]
checklist_collection = db["checklists"]
product_mapping_collection = db["product_mapping"]
inventory_collection = db["inventory"]
product_collection = db["products"]
reorder_rules_collection = db["reorder_rules"]
stock_adjustments_collection = db["stock_adjustments"]
damage_return_collection     = db["damage_return"]
supplier_returns_collection  = db["supplier_returns"]
document_messages_collection = db["document_messages"]
sales_collection = db["sales"]
stock_transfers_collection = db["stock_transfers"]
budgets_collection = db["budgets"]
calendar_events_collection = db["calendar_events"]
stores_collection = db["stores"]
vendor_invites_collection   = db["vendor_invites"]
questionnaire_collection    = db["vendor_questionnaires"]
store_stock_collection      = db["store_stock"]
stock_allocations_collection = db["stock_allocations"]
mbuyer_order_details_collection = db["mbuyer_order_details"]
sample_real_collection = db["sample_real_records"]
mbuyer_grc_collection = db["mbuyer_grc"]
mbuyer_product_desc_collection   = db["mbuyer_product_descriptions"]
mbuyer_gr_return_collection      = db["mbuyer_gr_returns"]
mbuyer_next_plan_collection      = db["mbuyer_next_plans"]
mbuyer_debit_note_collection     = db["mbuyer_debit_notes"]
tenants_collection = db["tenants"]
vendor_tenant_links_collection = db["vendor_tenant_links"]
vendor_catalogue_collection    = db["vendor_catalogue"]
catalogue_inquiries_collection = db["catalogue_inquiries"]
rfq_awards_collection        = db["rfq_awards"]
procurement_notifications_collection = db["procurement_notifications"]
vendor_subscriptions_collection = db["vendor_subscriptions"]
vendor_subscription_payments_collection = db["vendor_subscription_payments"]
vendor_role_operations_collection = db["vendor_role_operations"]
business_connections_collection = db["business_connections"]
vendor_b2b_rfqs_collection = db["vendor_b2b_rfqs"]
vendor_b2b_orders_collection = db["vendor_b2b_orders"]
vendor_b2b_receipts_collection = db["vendor_b2b_receipts"]
vendor_b2b_invoices_collection = db["vendor_b2b_invoices"]
vendor_b2b_stock_collection = db["vendor_b2b_stock"]
vendor_b2b_stock_ledger_collection = db["vendor_b2b_stock_ledger"]
vendor_tenant_links_collection = db["vendor_tenant_links"]

# SUPERADMIN / PLATFORM COLLECTIONS 
# =========================
settings_collection = db["settings"]
audit_logs_collection = db["audit_logs"]
announcements_collection = db["announcements"]
api_keys_collection = db["api_keys"]
webhooks_collection = db["webhooks"]
content_pages_collection = db["content_pages"]
flagged_content_collection = db["flagged_content"]
users_collection = db["users"]
invoices_collection = db["invoices"]
onboarding_requests_collection = db["onboarding_requests"]
store_upgrade_requests_collection = db["store_upgrade_requests"]
store_upgrade_payments_collection = db["store_upgrade_payments"]
retailer_signups_collection = db["retailer_signups"]
# Every email send failure lands here (SMTP not configured, send exception,
# etc.) so production has something queryable when a user reports "I never
# got the email" — print() output is easy to lose once stdout isn't a
# terminal someone is watching.
email_failures_collection = db["email_failures"]
support_tickets_collection = db["support_tickets"]
retailer_subscription_payments_collection = db["retailer_subscription_payments"]
barcode_label_settings_collection = db["barcode_label_settings"]

# Retailer finance is deliberately separate from purchase invoices and POS
# bills.  Those collections remain the operational source of truth; this
# collection stores the accounting vouchers that reference them.
finance_vouchers_collection = db["finance_vouchers"]

# Production / job-work operational records. These are intentionally separate
# from purchase orders and GRNs: materials sent to a cutter/stitcher remain
# owned by the retailer and are reconciled against a job-work order.
job_work_orders_collection = db["job_work_orders"]
job_work_receipts_collection = db["job_work_receipts"]
style_bom_plans_collection = db["style_bom_plans"]

# HR module. Employees are NOT duplicated here — admins_collection is the
# single source of truth for who works at this tenant (name, department,
# store, status). These collections only hold HR-specific data layered on
# top of an existing admin record (keyed by admin_id), never a parallel
# employee list.
hr_employee_profiles_collection = db["hr_employee_profiles"]
hr_attendance_collection        = db["hr_attendance"]
hr_leave_requests_collection    = db["hr_leave_requests"]
hr_salary_records_collection    = db["hr_salary_records"]
hr_holidays_collection          = db["hr_holidays"]

# Forecast & Analytics automation output — recomputed wholesale on every
# cron run (delete-then-insert per tenant), not incrementally patched, so
# these always reflect exactly what the last run saw. Not a source of
# truth for anything; purely a cache of _compute_demand_forecast() output
# so the UI doesn't have to wait for a live computation to show alerts.
forecast_low_stock_alerts_collection = db["forecast_low_stock_alerts"]
forecast_restock_drafts_collection   = db["forecast_restock_drafts"]

# Product-usage analytics (page views, feature clicks, session start/end,
# device type) — separate from audit_logs_collection, which is a
# compliance-style record of discrete admin actions. This is aggregate
# behavioural data for Super Admin's Usage Analytics tab, and ingestion is
# deliberately public (see analytics_routes.py) since half of what needs
# tracking — landing page visits, onboarding attempts — happens before
# anyone has a login token.
usage_events_collection = db["usage_events"]

async def ensure_procurement_indexes():
    """Create the indexes required by catalogue/RFQ hot paths and idempotency."""
    await purchaseorders_collection.create_index([("tenant_id", 1), ("orderNo", 1)], name="po_tenant_number")
    await catalogue_inquiries_collection.create_index([("tenant_id", 1), ("status", 1), ("created_at", -1)], name="inq_tenant_status_created")
    await catalogue_inquiries_collection.create_index([("vendor_id", 1), ("status", 1), ("created_at", -1)], name="inq_vendor_status_created")
    await catalogue_inquiries_collection.create_index([("tenant_id", 1), ("comparison_group_id", 1)], name="inq_tenant_comparison")
    await vendor_catalogue_collection.create_index([("vendor_id", 1), ("active", 1)], name="catalog_vendor_active")
    await vendor_role_operations_collection.create_index([("vendor_id", 1), ("role", 1)], unique=True, name="vendor_role_operations_unique")
    await vendor_subscription_payments_collection.create_index("razorpay_order_id", unique=True, name="vendor_subscription_razorpay_order_unique")
    await vendor_subscription_payments_collection.create_index([("vendor_id", 1), ("created_at", -1)], name="vendor_subscription_payment_history")
    await vendor_catalogue_collection.create_index([("item_name", "text"), ("category", "text"), ("description", "text")], name="catalog_search_text")
    await rfq_awards_collection.create_index([("tenant_id", 1), ("idempotency_key", 1)], unique=True, name="award_tenant_idempotency")
    await rfq_awards_collection.create_index([("tenant_id", 1), ("status", 1), ("created_at", -1)], name="award_tenant_status")
    await procurement_notifications_collection.create_index([("recipient_type", 1), ("tenant_id", 1), ("read", 1), ("created_at", -1)], name="notif_buyer_unread")
    await procurement_notifications_collection.create_index([("recipient_type", 1), ("vendor_id", 1), ("read", 1), ("created_at", -1)], name="notif_vendor_unread")
    await vendors_collection.create_index([("marketplace_visible", 1), ("business_type", 1), ("name", 1)], name="vendor_marketplace_discovery")
    await business_connections_collection.create_index("pair_key", unique=True, name="business_connection_pair")
    await business_connections_collection.create_index([("requester_vendor_id", 1), ("created_at", -1)], name="business_connection_outgoing")
    await business_connections_collection.create_index([("target_vendor_id", 1), ("status", 1), ("created_at", -1)], name="business_connection_incoming")
    await vendor_b2b_rfqs_collection.create_index([("buyer_vendor_id", 1), ("created_at", -1)], name="vendor_b2b_rfq_buyer_created")
    await vendor_b2b_rfqs_collection.create_index([("supplier_vendor_id", 1), ("status", 1), ("created_at", -1)], name="vendor_b2b_rfq_supplier_status")
    await vendor_b2b_orders_collection.create_index([("buyer_vendor_id", 1), ("created_at", -1)], name="vendor_b2b_order_buyer_created")
    await vendor_b2b_orders_collection.create_index([("supplier_vendor_id", 1), ("status", 1), ("created_at", -1)], name="vendor_b2b_order_supplier_status")
    await vendor_b2b_invoices_collection.create_index([("buyer_vendor_id", 1), ("created_at", -1)], name="vendor_b2b_invoice_buyer_created")
    await vendor_b2b_invoices_collection.create_index([("supplier_vendor_id", 1), ("created_at", -1)], name="vendor_b2b_invoice_supplier_created")
    await vendor_b2b_stock_collection.create_index([("vendor_id", 1), ("item_key", 1), ("unit", 1)], unique=True, name="vendor_b2b_stock_vendor_item")
    await vendor_b2b_stock_ledger_collection.create_index([("vendor_id", 1), ("created_at", -1)], name="vendor_b2b_stock_ledger_vendor_created")
    await finance_vouchers_collection.create_index([("tenant_id", 1), ("store_id", 1), ("created_at", -1)], name="finance_voucher_scope_created")
    await finance_vouchers_collection.create_index([("tenant_id", 1), ("voucher_type", 1), ("voucher_date", -1)], name="finance_voucher_type_date")
    await job_work_orders_collection.create_index([("tenant_id", 1), ("status", 1), ("created_at", -1)], name="job_work_tenant_status_created")
    await job_work_orders_collection.create_index([("tenant_id", 1), ("job_worker_name", 1), ("status", 1)], name="job_work_tenant_worker_status")
    await job_work_orders_collection.create_index([("assigned_vendor_id", 1), ("status", 1), ("created_at", -1)], name="job_work_vendor_status_created")
    await job_work_receipts_collection.create_index([("tenant_id", 1), ("order_id", 1), ("received_at", -1)], name="job_work_receipt_order_created")
    await style_bom_plans_collection.create_index([("tenant_id", 1), ("style_name", 1), ("created_at", -1)], name="style_bom_tenant_style_created")
    await onboarding_requests_collection.create_index([("status", 1), ("created_at", -1)], name="onboarding_status_created")
    await onboarding_requests_collection.create_index([("email", 1), ("account_type", 1), ("created_at", -1)], name="onboarding_email_type_created")
    await store_upgrade_requests_collection.create_index([("tenant_id", 1), ("status", 1), ("created_at", -1)], name="store_upgrade_tenant_status_created")
    await store_upgrade_payments_collection.create_index("razorpay_order_id", unique=True, name="store_upgrade_razorpay_order_unique")
    await store_upgrade_payments_collection.create_index([("request_id", 1), ("created_at", -1)], name="store_upgrade_payment_request_created")
    await retailer_signups_collection.create_index("razorpay_order_id", name="retailer_signup_razorpay_order")
    await retailer_signups_collection.create_index([("status", 1), ("created_at", -1)], name="retailer_signup_status_created")
    await retailer_subscription_payments_collection.create_index("razorpay_order_id", unique=True, name="retailer_subscription_razorpay_order_unique")
    await retailer_subscription_payments_collection.create_index([("tenant_id", 1), ("created_at", -1)], name="retailer_subscription_tenant_payment_history")
    await barcode_label_settings_collection.create_index("tenant_id", unique=True, name="barcode_label_settings_tenant")
    await supplier_returns_collection.create_index([('tenant_id', 1), ('created_at', -1)], name='supplier_returns_tenant_created')
    await supplier_returns_collection.create_index([('vendor_id', 1), ('created_at', -1)], name='supplier_returns_vendor_created')
    await document_messages_collection.create_index([("tenant_id", 1), ("document_type", 1), ("document_id", 1), ("created_at", 1)], name="document_messages_thread")
    await document_messages_collection.create_index([("tenant_id", 1), ("read_by_buyer", 1), ("created_at", -1)], name="document_messages_buyer_unread")
    await document_messages_collection.create_index([("vendor_id", 1), ("read_by_vendor", 1), ("created_at", -1)], name="document_messages_vendor_unread")
    await hr_employee_profiles_collection.create_index([("tenant_id", 1), ("admin_id", 1)], unique=True, name="hr_profile_tenant_admin")
    await hr_attendance_collection.create_index([("tenant_id", 1), ("admin_id", 1), ("date", 1)], unique=True, name="hr_attendance_tenant_admin_date")
    await hr_attendance_collection.create_index([("tenant_id", 1), ("date", 1)], name="hr_attendance_tenant_date")
    await hr_attendance_collection.create_index([("tenant_id", 1), ("store_id", 1), ("date", 1)], name="hr_attendance_store_date")
    await hr_leave_requests_collection.create_index([("tenant_id", 1), ("admin_id", 1), ("created_at", -1)], name="hr_leave_tenant_admin_created")
    await hr_leave_requests_collection.create_index([("tenant_id", 1), ("status", 1), ("created_at", -1)], name="hr_leave_tenant_status_created")
    await hr_leave_requests_collection.create_index([("tenant_id", 1), ("store_id", 1), ("status", 1), ("created_at", -1)], name="hr_leave_store_status_created")
    await hr_salary_records_collection.create_index([("tenant_id", 1), ("admin_id", 1), ("month", 1)], unique=True, name="hr_salary_tenant_admin_month")
    await hr_salary_records_collection.create_index([("tenant_id", 1), ("store_id", 1), ("month", -1)], name="hr_salary_store_month")
    await hr_holidays_collection.create_index([("tenant_id", 1), ("date", 1)], name="hr_holidays_tenant_date")
    await email_failures_collection.create_index([("resolved", 1), ("created_at", -1)], name="email_failures_resolved_created")
    await support_tickets_collection.create_index([("vendor_id", 1), ("updated_at", -1)], name="support_tickets_vendor_updated")
    await support_tickets_collection.create_index([("actor_type", 1), ("tenant_id", 1), ("updated_at", -1)], name="support_tickets_tenant_updated")
    await support_tickets_collection.create_index([("status", 1), ("updated_at", -1)], name="support_tickets_status_updated")
    await forecast_low_stock_alerts_collection.create_index([("tenant_id", 1), ("days_remaining", 1)], name="forecast_alerts_tenant_urgency")
    await forecast_restock_drafts_collection.create_index([("tenant_id", 1)], unique=True, name="forecast_restock_draft_tenant_unique")
    await procurement_notifications_collection.create_index(
        [("recipient_type", 1), ("vendor_id", 1), ("event_type", 1), ("tenant_id", 1), ("created_at", -1)],
        name="notif_vendor_demand_signal_dedup",
    )
    await usage_events_collection.create_index([("session_id", 1), ("event_type", 1)], name="usage_events_session_type")
    await usage_events_collection.create_index([("event_type", 1), ("created_at", -1)], name="usage_events_type_created")
    await usage_events_collection.create_index([("path", 1), ("event_type", 1), ("created_at", -1)], name="usage_events_path_type_created")
    await usage_events_collection.create_index([("feature", 1), ("event_type", 1), ("created_at", -1)], name="usage_events_feature_type_created")
    await usage_events_collection.create_index([("role", 1), ("admin_id", 1), ("created_at", -1)], name="usage_events_role_admin_created")
    await usage_events_collection.create_index([("role", 1), ("vendor_id", 1), ("created_at", -1)], name="usage_events_role_vendor_created")
