"""Analytics Hub — Phase 2 of the RMS analytics plan.

Phase 1 (done) gave each department its own Overview tab, scoped to that
department's own collections. This module is the different, DELIBERATELY
separate piece: a cross-department roll-up for HQ, and a cross-tenant
roll-up for a vendor looking at their own business across every retailer
they supply — neither of which belongs inside a single department's route
file, because neither is scoped to one department.

This is also where a trained ML model belongs once one exists. Today
`_predict_demand_stub` below just calls the same simple-moving-average
forecaster Forecast & Analytics already uses (see forecast_analytics_routes
._compute_demand_forecast) — deliberately, so this module becomes the ONE
place a real model gets wired in later. Swapping the implementation inside
that one function upgrades every caller (HQ overview, a future per-vendor
risk score, anything else built against this module) at once, instead of
retrofitting N separate department dashboards one at a time.

Does NOT replace Finance's own dashboard, Forecast & Analytics' own demand
tabs, etc — those stay the deep, department-specific view. This module is
the shallow, wide view across all of them.
"""
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException

from .deps import get_hq_tenant
from .vendor_routes import require_vendor_identity
from ..db import (
    coupons_collection,
    customer_crm_profiles_collection,
    forecast_low_stock_alerts_collection,
    grn_collection,
    lucky_draw_campaigns_collection,
    purchaseorders_collection,
    sales_collection,
    vendor_tenant_links_collection,
    vendors_collection,
)

router = APIRouter(prefix="/api/analytics", tags=["Analytics Hub"])
TenantCtx = Dict[str, Any]


# ═══════════════════════════════════════════════════════════════════════════
# HQ — cross-department roll-up
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/hq-overview")
async def hq_overview(lookback_days: int = 30, ctx: TenantCtx = Depends(get_hq_tenant)):
    tenant_id = ctx["tenant_id"]
    since = datetime.utcnow() - timedelta(days=max(1, lookback_days))

    # Sales — same shape forecast_analytics_routes already reads.
    total_revenue = 0.0
    total_units = 0.0
    bill_count = 0
    async for doc in sales_collection.find(
        {"tenant_id": tenant_id, "type": "sale", "created_at": {"$gte": since}}, {"items": 1}
    ):
        bill_count += 1
        for item in doc.get("items", []):
            qty = float(item.get("qty") or 0)
            total_units += qty
            total_revenue += qty * float(item.get("price") or 0)

    low_stock_alerts = await forecast_low_stock_alerts_collection.count_documents({"tenant_id": tenant_id})
    approved_vendors = await vendor_tenant_links_collection.count_documents({"tenant_id": tenant_id, "status": "Approved"})
    pending_vendors = await vendor_tenant_links_collection.count_documents({"tenant_id": tenant_id, "status": "Pending"})
    pending_pos = await purchaseorders_collection.count_documents({"tenant_id": tenant_id, "status": "Pending"})
    known_customers = await customer_crm_profiles_collection.count_documents({"tenant_id": tenant_id})
    active_lucky_draw_campaigns = await lucky_draw_campaigns_collection.count_documents({"tenant_id": tenant_id, "status": "ACTIVE"})
    active_coupons = await coupons_collection.count_documents({"tenant_id": tenant_id, "status": "ACTIVE"})

    return {
        "status": "success",
        "lookback_days": lookback_days,
        "sales": {
            "total_revenue": round(total_revenue, 2),
            "total_units_sold": round(total_units, 2),
            "bill_count": bill_count,
        },
        "procurement": {
            "approved_vendors": approved_vendors,
            "pending_vendor_requests": pending_vendors,
            "pending_purchase_orders": pending_pos,
        },
        "inventory": {
            "low_stock_alerts": low_stock_alerts,
        },
        "customer_engagement": {
            "known_customers": known_customers,
            "active_lucky_draw_campaigns": active_lucky_draw_campaigns,
            "active_coupons": active_coupons,
        },
        "note": "Cross-department snapshot. For deep numbers open Finance, Forecast & Analytics or Customer CRM directly — this view stays shallow on purpose.",
    }


# ═══════════════════════════════════════════════════════════════════════════
# VENDOR — a vendor's own business across every retailer they supply
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/vendor-overview")
async def vendor_overview(vendor: dict = Depends(require_vendor_identity)):
    vendor_id = vendor["_id"]
    vendor_id_str = str(vendor_id)

    links = await vendor_tenant_links_collection.find({"vendor_id": vendor_id, "status": "Approved"}).to_list(length=200)
    if not links:
        links = await vendor_tenant_links_collection.find({"vendor_id": vendor_id_str, "status": "Approved"}).to_list(length=200)
    tenant_ids = [link["tenant_id"] for link in links if link.get("tenant_id")]

    pos = await purchaseorders_collection.find(
        {"vendor_id": {"$in": [vendor_id, vendor_id_str]}}, {"tenant_id": 1, "status": 1, "createdAt": 1, "_id": 1}
    ).to_list(length=1000)
    po_created = {str(po["_id"]): po.get("createdAt") for po in pos}
    pending_pos = len([po for po in pos if po.get("status") == "Pending"])

    grns = await grn_collection.find(
        {"po_id": {"$in": list(po_created.keys())}}, {"po_id": 1, "createdAt": 1}
    ).to_list(length=1000) if po_created else []
    lead_times = []
    for grn in grns:
        po_date = po_created.get(grn.get("po_id"))
        grn_date = grn.get("createdAt")
        if isinstance(po_date, datetime) and isinstance(grn_date, datetime) and grn_date >= po_date:
            lead_times.append((grn_date - po_date).days)

    return {
        "status": "success",
        "retailers_supplying": len(tenant_ids),
        "purchase_orders": {
            "total": len(pos),
            "pending": pending_pos,
            "fulfilled": len(grns),
            "avg_fulfillment_days": round(sum(lead_times) / len(lead_times), 1) if lead_times else None,
        },
        "note": "Your own performance across every retailer you're approved with — a slower average here hurts your ranking in every retailer's Vendor Ranking tab.",
    }


# ═══════════════════════════════════════════════════════════════════════════
# ML extension point — not wired to a real model yet
#
# Deliberately NOT imported from forecast_analytics_routes (that module's
# _compute_demand_forecast is Raphaaa/Citimart-branching and tied to that
# route file's own request context) — this is a clean seam a trained model
# replaces later without touching any department's existing code. Until a
# model exists, this intentionally returns "not available" rather than a
# fake prediction.
# ═══════════════════════════════════════════════════════════════════════════

def predict_demand_ml(tenant_id: str, barcode: str) -> Optional[Dict[str, Any]]:
    """Placeholder seam for a trained demand-forecasting model.

    Every department's "forecast" today is a simple moving average computed
    inline where it's used. Once a real model is trained, this function is
    where it gets called from — give it tenant_id + barcode (+ whatever
    feature set the model needs), return its prediction, and any caller
    that starts checking this function instead of/in addition to the
    moving average picks it up with no other code changes.
    """
    return None
