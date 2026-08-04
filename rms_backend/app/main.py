from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .error_log import log_error
from .routes import superadmin_routes, auth_routes, admin_routes
from .db import admins_collection, ensure_procurement_indexes
from .routes import vendor_routes,order_routes, grc_routes , grn_routes,Purchaseinvoice_routes
from .routes.superadmin_tenant_routes import router as tenant_router
from .routes.cashier_routes import router as cashier_router
from .routes.Stock_transfer_routes import router as stock_transfer_router
from .routes.tasklist_routes import router as tasklist_router
from .routes.item_routes import router as item_router
from .routes.inventoryroutes import router as inventory_router
from .routes.products import router as products_router
from .routes.mbuyer_routes import router as mbuyer_router
from .routes.uploads import router as uploads_router
from .routes.stock_allocation_routes import router as stock_allocation_router
from .routes.inventory_product_routes import router as inv_product_router
from .routes.hq_store_routes import router as hq_store_router
from .routes.superadmin_vendor_routes import router as superadmin_vendor_router
from .routes.catalogue_routes import router as catalogue_router
from .routes.rfq_award_routes import router as rfq_award_router
from .routes.procurement_notification_routes import router as procurement_notification_router
from .routes.subscription_routes import router as subscription_router, razorpay_webhook_router
from .routes.tenant_public_routes import router as tenant_public_router
from .routes.business_network_routes import router as business_network_router
from .routes.vendor_finance_routes import router as vendor_finance_router
from .routes.finance_routes import router as finance_router
from .routes.job_work_routes import router as job_work_router
from .routes.onboarding_routes import router as onboarding_router
from .routes.store_upgrade_routes import router as store_upgrade_router
from .routes.retailer_signup_routes import router as retailer_signup_router
from .routes.forecast_analytics_routes import router as forecast_analytics_router
from .routes.retailer_subscription_routes import router as retailer_subscription_router
from .routes.vendor_role_operations_routes import router as vendor_role_operations_router
from .routes.vendor_b2b_routes import router as vendor_b2b_router
from .routes.hr_routes import router as hr_router
from .routes.supplier_return_routes import router as supplier_return_router
from .routes.document_message_routes import router as document_message_router
from .routes.support_routes import router as support_router
from .routes.analytics_routes import router as analytics_router
   


from .routes.thirdparty_routes import router as thirdparty_router
from .routes.purchaseorder_routes import router as purchaseorder_router
from .routes.checklist_routes import router as checklist_router
from .routes.product_mapping_routes import router as product_mapping_router
from .config import settings, allowed_frontend_origins
from .utils import hash_password, verify_password
from datetime import datetime

app = FastAPI(title="RMS Backend - Admin Onboarding")



app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_frontend_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Catches anything NOT already handled by a route's own try/except or
    by FastAPI's own HTTPException handling (that one stays untouched —
    this only ever sees genuinely unexpected failures: bugs, bad third-
    party responses, etc.). Every one of RMS's ~490 routes gets this for
    free with zero per-route changes, which is the entire point — before
    this, an unhandled exception anywhere just vanished into a print()
    nobody was watching."""
    await log_error(
        source=f"{request.method} {request.url.path}",
        message=str(exc) or exc.__class__.__name__,
        exc=exc,
        context={"query": dict(request.query_params)},
    )
    return JSONResponse(status_code=500, content={"detail": "Something went wrong on our end. Our team has been notified."})



app.include_router(superadmin_routes.router)
app.include_router(auth_routes.router)
app.include_router(admin_routes.router)

app.include_router(vendor_routes.vendor_bp)

app.include_router(order_routes.router)
app.include_router(grc_routes.router)
app.include_router(grn_routes.router)
app.include_router(thirdparty_router)
app.include_router(purchaseorder_router)
app.include_router(tasklist_router)
app.include_router(checklist_router)
app.include_router(item_router)
app.include_router(product_mapping_router)
app.include_router(uploads_router)
app.include_router(inventory_router)
app.include_router(products_router)
app.include_router(Purchaseinvoice_routes.router)
app.include_router(cashier_router)
app.include_router(stock_transfer_router)
app.include_router(mbuyer_router)
app.include_router(stock_allocation_router)
app.include_router(inv_product_router)
app.include_router(tenant_router)
app.include_router(hq_store_router)
app.include_router(superadmin_vendor_router)
app.include_router(catalogue_router)
app.include_router(rfq_award_router)
app.include_router(procurement_notification_router)
app.include_router(subscription_router)
app.include_router(razorpay_webhook_router)
app.include_router(tenant_public_router)
app.include_router(business_network_router)
app.include_router(vendor_finance_router)
app.include_router(finance_router)
app.include_router(job_work_router)
app.include_router(onboarding_router)
app.include_router(store_upgrade_router)
app.include_router(retailer_signup_router)
app.include_router(forecast_analytics_router)
app.include_router(retailer_subscription_router)
app.include_router(vendor_role_operations_router)
app.include_router(vendor_b2b_router)
app.include_router(hr_router)
app.include_router(supplier_return_router)
app.include_router(document_message_router)
app.include_router(support_router)
app.include_router(analytics_router)





@app.on_event("startup")
async def startup_event():
    """Ensure Super Admin exists and syncs with .env credentials."""
    await ensure_procurement_indexes()
    existing = await admins_collection.find_one({"email": settings.superadmin_email})

    if not existing:
        
        hashed = hash_password(settings.superadmin_password)
        doc = {
            "name": settings.superadmin_name,
            "email": settings.superadmin_email,
            "department": "SUPERADMIN",
            "hashed_password": hashed,
            "status": "ACTIVE",
            "password_set": True,
            "created_at": datetime.utcnow(),
        }
        await admins_collection.insert_one(doc)
        print(f"✅ Super Admin created: {settings.superadmin_email}")

    else:
        
        current_hash = existing.get("hashed_password")
        if not verify_password(settings.superadmin_password, current_hash):
            new_hash = hash_password(settings.superadmin_password)
            await admins_collection.update_one(
                {"_id": existing["_id"]},
                {"$set": {"hashed_password": new_hash, "updated_at": datetime.utcnow()}},
            )
            print("🔑 Super Admin password updated from .env change.")
        else:
            print("✅ Super Admin already exists and password is up-to-date.")


#  Health check 

@app.get("/")
async def health_check():
    return {"status": "ok", "service": "RMS Backend"}
