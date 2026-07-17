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
business_connections_collection = db["business_connections"]
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

async def ensure_procurement_indexes():
    """Create the indexes required by catalogue/RFQ hot paths and idempotency."""
    await catalogue_inquiries_collection.create_index([("tenant_id", 1), ("status", 1), ("created_at", -1)], name="inq_tenant_status_created")
    await catalogue_inquiries_collection.create_index([("vendor_id", 1), ("status", 1), ("created_at", -1)], name="inq_vendor_status_created")
    await catalogue_inquiries_collection.create_index([("tenant_id", 1), ("comparison_group_id", 1)], name="inq_tenant_comparison")
    await vendor_catalogue_collection.create_index([("vendor_id", 1), ("active", 1)], name="catalog_vendor_active")
    await vendor_catalogue_collection.create_index([("item_name", "text"), ("category", "text"), ("description", "text")], name="catalog_search_text")
    await rfq_awards_collection.create_index([("tenant_id", 1), ("idempotency_key", 1)], unique=True, name="award_tenant_idempotency")
    await rfq_awards_collection.create_index([("tenant_id", 1), ("status", 1), ("created_at", -1)], name="award_tenant_status")
    await procurement_notifications_collection.create_index([("recipient_type", 1), ("tenant_id", 1), ("read", 1), ("created_at", -1)], name="notif_buyer_unread")
    await procurement_notifications_collection.create_index([("recipient_type", 1), ("vendor_id", 1), ("read", 1), ("created_at", -1)], name="notif_vendor_unread")
    await vendors_collection.create_index([("marketplace_visible", 1), ("business_type", 1), ("name", 1)], name="vendor_marketplace_discovery")
    await business_connections_collection.create_index("pair_key", unique=True, name="business_connection_pair")
    await business_connections_collection.create_index([("requester_vendor_id", 1), ("created_at", -1)], name="business_connection_outgoing")
    await business_connections_collection.create_index([("target_vendor_id", 1), ("status", 1), ("created_at", -1)], name="business_connection_incoming")
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
    await barcode_label_settings_collection.create_index("tenant_id", unique=True, name="barcode_label_settings_tenant")
