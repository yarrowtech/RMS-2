from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
from .routes.vendor_role_operations_routes import router as vendor_role_operations_router
from .routes.vendor_b2b_routes import router as vendor_b2b_router
   


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
app.include_router(vendor_role_operations_router)
app.include_router(vendor_b2b_router)





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
