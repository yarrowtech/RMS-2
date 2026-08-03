"""Forecast & Analytics department.

Real, tenant-scoped analytics over data the system already has —
sales_collection, vendor_catalogue_collection, purchaseorders_collection and
grn_collection — not mock/demo data. Deliberately does NOT include a
"footfall" feature: nothing in RMS captures raw store foot traffic today
(POS only records completed sales), so /dashboard says so honestly instead
of shipping another fake chart. Add real footfall wiring later if a data
source (sensor, WiFi counter, etc.) is ever connected.

Forecasting method is a simple moving average over weekly sales buckets,
not a trained ML model — deliberately, since there isn't yet enough
transaction volume per tenant to justify one, and a transparent, auditable
method is more useful for "why did the system suggest this" than a black
box would be at this stage.
"""
import math
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, Field

from .deps import get_hq_tenant
from ..config import settings
from ..db import (
    admins_collection, grn_collection, inventory_collection, product_collection,
    purchaseorders_collection, sales_collection, stores_collection, store_stock_collection,
    vendor_catalogue_collection, vendor_tenant_links_collection, vendors_collection,
    forecast_low_stock_alerts_collection, forecast_restock_drafts_collection,
)

router = APIRouter(prefix="/api/forecast-analytics", tags=["Forecast & Analytics"])
TenantCtx = Dict[str, Any]


async def _require_forecast_context(ctx: TenantCtx = Depends(get_hq_tenant)) -> TenantCtx:
    """Forecast & Analytics department or forecast_analytics-permission admins only."""
    departments = set(ctx.get("_managed_departments") or [])
    permissions = set(ctx.get("_permissions") or [])
    if "Forecast & Analytics" not in departments and "forecast_analytics" not in permissions:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forecast & Analytics department access is required.")
    return ctx


# ═══════════════════════════════════════════════════════════════════════════
# DEMAND FORECAST — simple moving average over real sales history
# ═══════════════════════════════════════════════════════════════════════════

async def _compute_demand_forecast(tenant_id: str, store_id: Optional[str], lookback_days: int, limit: int) -> List[dict]:
    since = datetime.utcnow() - timedelta(days=max(1, lookback_days))
    match: Dict[str, Any] = {"tenant_id": tenant_id, "type": "sale", "created_at": {"$gte": since}}
    if store_id:
        match["store_id"] = store_id

    weekly: Dict[str, Dict[tuple, float]] = defaultdict(lambda: defaultdict(float))
    meta: Dict[str, Dict[str, Any]] = {}

    async for doc in sales_collection.find(match, {"items": 1, "created_at": 1}).sort("created_at", 1):
        created = doc.get("created_at")
        if not isinstance(created, datetime):
            continue
        week_key = created.isocalendar()[:2]  # (iso_year, iso_week) — sorts correctly as a tuple
        for item in doc.get("items", []):
            bc = (item.get("barcode") or "").strip()
            if not bc:
                continue
            qty = float(item.get("qty") or 0)
            price = float(item.get("price") or 0)
            cost = float(item.get("cost_price") or 0)
            weekly[bc][week_key] += qty
            m = meta.setdefault(bc, {
                "name": item.get("name", ""), "sku": item.get("sku", ""),
                "division": item.get("division", ""), "total_qty": 0.0,
                "total_revenue": 0.0, "total_cost": 0.0,
            })
            m["total_qty"] += qty
            m["total_revenue"] += qty * price
            m["total_cost"] += qty * cost

    rows: List[dict] = []
    for bc, weeks in weekly.items():
        m = meta[bc]
        ordered = [weeks[k] for k in sorted(weeks.keys())]
        weeks_active = len(ordered)
        avg_weekly_qty = m["total_qty"] / weeks_active if weeks_active else 0.0
        recent = ordered[-3:]
        forecast_next_period_qty = sum(recent) / len(recent) if recent else 0.0

        trend = "stable"
        if weeks_active >= 4:
            half = weeks_active // 2
            earlier_avg = sum(ordered[:half]) / half if half else 0.0
            later_avg = sum(ordered[half:]) / (weeks_active - half) if (weeks_active - half) else 0.0
            if later_avg > earlier_avg * 1.15:
                trend = "rising"
            elif later_avg < earlier_avg * 0.85:
                trend = "falling"

        avg_price = m["total_revenue"] / m["total_qty"] if m["total_qty"] else 0.0
        avg_cost = m["total_cost"] / m["total_qty"] if m["total_qty"] else 0.0
        if not avg_cost:
            product = await product_collection.find_one({"barcode": bc, "tenant_id": tenant_id}, {"cost_price": 1})
            avg_cost = float((product or {}).get("cost_price") or 0)

        rows.append({
            "barcode": bc, "name": m["name"], "sku": m["sku"], "division": m["division"],
            "weeks_active": weeks_active,
            "total_qty_sold": round(m["total_qty"], 2),
            "avg_weekly_qty": round(avg_weekly_qty, 2),
            "forecast_next_period_qty": round(forecast_next_period_qty, 2),
            "trend": trend,
            "avg_selling_price": round(avg_price, 2),
            "avg_cost_price": round(avg_cost, 2),
            "margin_per_unit": round(avg_price - avg_cost, 2),
        })

    rows.sort(key=lambda r: r["total_qty_sold"], reverse=True)
    return rows[:limit]


@router.get("/demand-forecast")
async def get_demand_forecast(
    store_id: Optional[str] = Query(None),
    lookback_days: int = Query(90, ge=7, le=365),
    limit: int = Query(50, ge=1, le=200),
    ctx: TenantCtx = Depends(_require_forecast_context),
):
    rows = await _compute_demand_forecast(ctx["tenant_id"], store_id, lookback_days, limit)
    return {
        "status": "success", "lookback_days": lookback_days, "store_id": store_id,
        "count": len(rows), "method": "simple_moving_average_last_3_weeks",
        "data": rows,
    }


# ═══════════════════════════════════════════════════════════════════════════
# VENDOR RANKING — price + MOQ + this tenant's own order history with them
# ═══════════════════════════════════════════════════════════════════════════

async def _fulfillment_stats(tenant_id: str, vendor_id_str: str) -> dict:
    """Real fulfillment signal from this tenant's own PO -> GRN history with
    the vendor — not a generic vendor rating. po_id/vendor_id are stored as
    strings on purchaseorders_collection (not ObjectId), matched as-is."""
    pos = await purchaseorders_collection.find(
        {"tenant_id": tenant_id, "vendor_id": vendor_id_str}, {"createdAt": 1}
    ).to_list(length=500)
    if not pos:
        return {"po_count": 0, "avg_fulfillment_days": None, "has_history": False}

    po_created = {str(po["_id"]): po.get("createdAt") for po in pos}
    grns = await grn_collection.find(
        {"tenant_id": tenant_id, "po_id": {"$in": list(po_created.keys())}}, {"po_id": 1, "createdAt": 1}
    ).to_list(length=500)

    lead_times = []
    for grn in grns:
        po_date = po_created.get(grn.get("po_id"))
        grn_date = grn.get("createdAt")
        if isinstance(po_date, datetime) and isinstance(grn_date, datetime) and grn_date >= po_date:
            lead_times.append((grn_date - po_date).days)

    return {
        "po_count": len(pos),
        "avg_fulfillment_days": round(sum(lead_times) / len(lead_times), 1) if lead_times else None,
        "has_history": True,
    }


def _normalize_low_is_better(value: float, values: List[float]) -> float:
    """0-100, 100 = lowest (best) in the candidate set."""
    lo, hi = min(values), max(values)
    if hi == lo:
        return 100.0
    return 100.0 * (hi - value) / (hi - lo)


@router.get("/vendor-ranking")
async def get_vendor_ranking(
    q: Optional[str] = Query(None, description="Match against item_name or category"),
    limit: int = Query(20, ge=1, le=100),
    ctx: TenantCtx = Depends(_require_forecast_context),
):
    if not q or not q.strip():
        raise HTTPException(status_code=400, detail="Provide a product name or category to rank vendors for (q).")
    tenant_id = ctx["tenant_id"]
    pattern = {"$regex": q.strip(), "$options": "i"}
    candidates = await vendor_catalogue_collection.find({
        "active": True, "$or": [{"item_name": pattern}, {"category": pattern}],
    }).to_list(length=200)
    if not candidates:
        return {"status": "success", "query": q, "count": 0, "data": []}

    vendor_ids = {str(c["vendor_id"]) for c in candidates}
    approved_links = await vendor_tenant_links_collection.find({
        "tenant_id": tenant_id, "status": "Approved", "vendor_id": {"$in": [ObjectId(v) for v in vendor_ids]},
    }).to_list(length=200)
    approved_ids = {str(link["vendor_id"]) for link in approved_links}

    # Only vendors with an Approved relationship to this tenant are ranked —
    # same gate every other purchasing flow in RMS enforces (PO creation,
    # WhatsApp order resolution). A cheaper unapproved vendor is not a
    # purchasing option yet, so it doesn't belong in a purchase ranking.
    approved_candidates = [c for c in candidates if str(c["vendor_id"]) in approved_ids]
    if not approved_candidates:
        return {
            "status": "success", "query": q, "count": 0, "data": [],
            "note": f"{len(candidates)} matching catalogue item(s) found, but none from a vendor with an Approved relationship to your business yet.",
        }

    prices = [c.get("price_range_min", 0) or 0 for c in approved_candidates]
    moqs = [c.get("moq", 0) or 0 for c in approved_candidates]

    # Bug fix: rows only ever carried vendor_id (an ObjectId string), never
    # a human-readable name — there was no way to tell from the UI which
    # vendor a ranked row actually belonged to. vendor_catalogue_collection
    # doesn't store the vendor's name itself, only vendor_id, so it has to
    # be looked up from vendors_collection.
    vendor_oids = [ObjectId(v) for v in approved_ids]
    vendor_docs = await vendors_collection.find(
        {"_id": {"$in": vendor_oids}}, {"name": 1, "vendor_name": 1, "email": 1}
    ).to_list(length=len(vendor_oids))
    vendor_info = {
        str(v["_id"]): {
            "name": v.get("name") or v.get("vendor_name") or "Unnamed vendor",
            "email": v.get("email", ""),
        }
        for v in vendor_docs
    }

    fulfillment_cache: Dict[str, dict] = {}
    rows = []
    for c in approved_candidates:
        vendor_id_str = str(c["vendor_id"])
        if vendor_id_str not in fulfillment_cache:
            fulfillment_cache[vendor_id_str] = await _fulfillment_stats(tenant_id, vendor_id_str)
        fulfillment = fulfillment_cache[vendor_id_str]

        price_score = _normalize_low_is_better(c.get("price_range_min", 0) or 0, prices)
        moq_score = _normalize_low_is_better(c.get("moq", 0) or 0, moqs)
        history_score = 50.0 if not fulfillment["has_history"] else min(fulfillment["po_count"] / 5, 1) * 100

        final_score = round(price_score * 0.5 + moq_score * 0.2 + history_score * 0.3, 1)
        info = vendor_info.get(vendor_id_str, {"name": "Unnamed vendor", "email": ""})
        rows.append({
            "catalogue_item_id": str(c["_id"]),
            "vendor_id": vendor_id_str,
            "vendor_name": info["name"],
            "vendor_email": info["email"],
            "item_name": c.get("item_name", ""),
            "category": c.get("category", ""),
            "price_range_min": c.get("price_range_min", 0),
            "price_range_max": c.get("price_range_max", 0),
            "moq": c.get("moq", 0),
            "po_count_with_you": fulfillment["po_count"],
            "avg_fulfillment_days": fulfillment["avg_fulfillment_days"],
            "has_order_history": fulfillment["has_history"],
            "score": final_score,
        })

    rows.sort(key=lambda r: r["score"], reverse=True)
    return {"status": "success", "query": q, "count": len(rows), "data": rows[:limit]}


# ═══════════════════════════════════════════════════════════════════════════
# PURCHASE PLAN — budget-constrained, ranked by expected ROI
# ═══════════════════════════════════════════════════════════════════════════

class PurchasePlanRequest(BaseModel):
    budget_inr: float = Field(gt=0)
    store_id: Optional[str] = None
    lookback_days: int = Field(90, ge=7, le=365)


def _lines_from_forecast(rows: List[dict]) -> List[dict]:
    """Shared by the interactive /purchase-plan endpoint and the automated
    restock draft below — same ROI-ranked line shape either way, the only
    difference is whether a budget then constrains it."""
    lines = []
    for row in rows:
        unit_cost = row["avg_cost_price"]
        if unit_cost <= 0 or row["forecast_next_period_qty"] <= 0:
            continue
        recommended_qty = max(1, math.ceil(row["forecast_next_period_qty"]))
        line_cost = round(recommended_qty * unit_cost, 2)
        expected_profit = round(recommended_qty * row["margin_per_unit"], 2)
        roi = round(expected_profit / line_cost, 3) if line_cost else 0.0
        lines.append({
            "barcode": row["barcode"], "name": row["name"], "sku": row["sku"],
            "recommended_qty": recommended_qty, "unit_cost": unit_cost,
            "line_cost": line_cost, "expected_profit": expected_profit, "roi": roi,
            "trend": row["trend"],
        })
    lines.sort(key=lambda l: l["roi"], reverse=True)
    return lines


@router.post("/purchase-plan")
async def build_purchase_plan(payload: PurchasePlanRequest, ctx: TenantCtx = Depends(_require_forecast_context)):
    forecast_rows = await _compute_demand_forecast(ctx["tenant_id"], payload.store_id, payload.lookback_days, limit=200)
    lines = _lines_from_forecast(forecast_rows)

    plan, running_total, skipped = [], 0.0, 0
    for line in lines:
        remaining = round(payload.budget_inr - running_total, 2)
        if remaining <= 0:
            skipped += 1
            continue
        if line["line_cost"] <= remaining:
            plan.append({**line, "partial": False})
            running_total += line["line_cost"]
        else:
            affordable_qty = math.floor(remaining / line["unit_cost"])
            if affordable_qty >= 1:
                partial_cost = round(affordable_qty * line["unit_cost"], 2)
                plan.append({
                    **line, "recommended_qty": affordable_qty, "line_cost": partial_cost,
                    "expected_profit": round(affordable_qty * (line["expected_profit"] / line["recommended_qty"]), 2),
                    "partial": True,
                })
                running_total += partial_cost
            else:
                skipped += 1

    return {
        "status": "success",
        "budget_inr": payload.budget_inr,
        "allocated_total": round(running_total, 2),
        "remaining_budget": round(payload.budget_inr - running_total, 2),
        "line_count": len(plan),
        "skipped_count": skipped,
        "lines": plan,
    }


# ═══════════════════════════════════════════════════════════════════════════
# DASHBOARD
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/dashboard")
async def get_dashboard(ctx: TenantCtx = Depends(_require_forecast_context)):
    top_demand = await _compute_demand_forecast(ctx["tenant_id"], None, lookback_days=90, limit=5)
    alert_count = await forecast_low_stock_alerts_collection.count_documents({"tenant_id": ctx["tenant_id"]})
    return {
        "status": "success",
        "top_forecasted_items": top_demand,
        "low_stock_alert_count": alert_count,
        "footfall": {
            "available": False,
            "message": "No footfall data source is connected yet — POS only records completed sales, not raw store traffic. This section will populate once a footfall source (in-store counter, sensor, etc.) is wired in.",
        },
    }


# ═══════════════════════════════════════════════════════════════════════════
# AUTOMATION — scheduled, not on-demand
#
# Everything above computes live when a tab is opened. This section is the
# other half: a cron-triggered pass (no in-process scheduler here — same
# pattern as subscription_routes.py's /send-expiry-reminders) that, for
# every tenant with this department enabled, checks real on-hand stock
# against the same moving-average demand used everywhere else in this file,
# and:
#   - flags items projected to run out soon (a genuine signal, not a guess —
#     current stock ÷ average daily sales), checked BOTH at HQ/central
#     inventory AND at every individual store that keeps its own stock
#     ledger (store_stock_collection) — a store can be critically low on
#     something even while the central warehouse total looks fine, and the
#     original HQ-only version of this check would have missed that
#     entirely for any multi-store tenant.
#   - saves a ROI-ranked restock draft with NO budget constraint, since a
#     cron job has no budget to apply — that stays a human decision made
#     interactively via /purchase-plan. This is a starting point to review,
#     not an auto-approved order. Restock stays tenant-wide/HQ-scoped (not
#     per-store) — purchasing is a centralized HQ decision everywhere else
#     in RMS (PO creation, vendor approval), so a restock draft follows the
#     same shape rather than fragmenting into per-store purchase drafts.
# Both are recomputed wholesale each run (delete + reinsert per tenant) so
# they never carry stale rows forward.
# ═══════════════════════════════════════════════════════════════════════════

LOW_STOCK_WARNING_DAYS = 14
LOW_STOCK_CRITICAL_DAYS = 3


async def _stock_map(tenant_id: str, store_id: Optional[str]) -> Dict[str, float]:
    """Current on-hand qty per barcode — store_stock_collection for a given
    store, inventory_collection (HQ/central) when store_id is None. Same
    branching already used for live receiving in inventoryroutes.py."""
    collection = store_stock_collection if store_id else inventory_collection
    query: Dict[str, Any] = {"tenant_id": tenant_id}
    if store_id:
        query["store_id"] = store_id

    stock_by_barcode: Dict[str, float] = {}
    async for doc in collection.find(query, {"barcode": 1, "stockQty": 1}):
        bc = (doc.get("barcode") or "").strip()
        if bc:
            stock_by_barcode[bc] = float(doc.get("stockQty", 0) or 0)
    return stock_by_barcode


def _build_alerts(
    tenant_id: str, store_id: Optional[str], store_name: str,
    forecast_rows: List[dict], stock_by_barcode: Dict[str, float], now: datetime,
) -> List[dict]:
    alerts = []
    for row in forecast_rows:
        stock_qty = stock_by_barcode.get(row["barcode"], 0.0)
        daily_qty = row["avg_weekly_qty"] / 7 if row["avg_weekly_qty"] else 0.0
        if daily_qty <= 0:
            continue
        days_remaining = round(stock_qty / daily_qty, 1)
        if days_remaining >= LOW_STOCK_WARNING_DAYS:
            continue
        alerts.append({
            "tenant_id": tenant_id, "store_id": store_id, "store_name": store_name,
            "barcode": row["barcode"], "name": row["name"], "sku": row["sku"],
            "stock_qty": round(stock_qty, 2), "avg_weekly_qty": row["avg_weekly_qty"],
            "days_remaining": days_remaining,
            "severity": "critical" if days_remaining < LOW_STOCK_CRITICAL_DAYS else "warning",
            "created_at": now, "updated_at": now,
        })
    return alerts


async def _run_forecast_automation_for_tenant(tenant_id: str) -> dict:
    now = datetime.utcnow()

    # HQ / central inventory — tenant-wide, store_id=None. Unchanged from
    # before this change, so a tenant with no per-store stock tracking at
    # all still gets exactly the alerts it always did.
    hq_forecast_rows = await _compute_demand_forecast(tenant_id, None, lookback_days=90, limit=500)
    hq_stock = await _stock_map(tenant_id, None)
    alerts = _build_alerts(tenant_id, None, "HQ / Central", hq_forecast_rows, hq_stock, now)

    # Per-store — additive. Only stores that actually have a stock ledger in
    # store_stock_collection get checked; a store with none simply isn't
    # tracked at that level yet, same as before this change.
    stores = await stores_collection.find(
        {"tenant_id": tenant_id, "active": True}, {"_id": 1, "name": 1}
    ).to_list(length=200)
    for store in stores:
        store_id = str(store["_id"])
        store_stock = await _stock_map(tenant_id, store_id)
        if not store_stock:
            continue
        store_forecast_rows = await _compute_demand_forecast(tenant_id, store_id, lookback_days=90, limit=500)
        alerts += _build_alerts(tenant_id, store_id, store.get("name", ""), store_forecast_rows, store_stock, now)

    alerts.sort(key=lambda a: a["days_remaining"])

    restock_lines = _lines_from_forecast(hq_forecast_rows)[:100]

    await forecast_low_stock_alerts_collection.delete_many({"tenant_id": tenant_id})
    if alerts:
        await forecast_low_stock_alerts_collection.insert_many(alerts)

    await forecast_restock_drafts_collection.delete_many({"tenant_id": tenant_id})
    await forecast_restock_drafts_collection.insert_one({
        "tenant_id": tenant_id, "generated_at": now,
        "lines": restock_lines, "line_count": len(restock_lines),
    })

    return {"tenant_id": tenant_id, "alerts": len(alerts), "restock_lines": len(restock_lines)}


async def _authorize_cron_or_superadmin(authorization: Optional[str], x_cron_secret: Optional[str]) -> None:
    """Same either/or auth as subscription_routes.py's expiry-reminder cron:
    a CRON_SECRET header for an external scheduler with no login, or a real
    Super Admin bearer token for triggering it manually."""
    if settings.cron_secret and x_cron_secret == settings.cron_secret:
        return
    if authorization and authorization.startswith("Bearer "):
        from .auth_routes import get_current_superadmin
        try:
            await get_current_superadmin(token=authorization.split(" ", 1)[1])
            return
        except HTTPException:
            pass
    raise HTTPException(status_code=401, detail="Provide a valid X-Cron-Secret header, or a Super Admin bearer token.")


@router.post("/auto-run")
async def auto_run_forecast_automation(
    authorization: Optional[str] = Header(None),
    x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret"),
):
    """Meant to run daily from an external scheduler (this process has no
    in-process cron). Processes every tenant that has Forecast & Analytics
    enabled for at least one admin — same gate _require_forecast_context
    checks per-request, applied here per-tenant instead."""
    await _authorize_cron_or_superadmin(authorization, x_cron_secret)

    tenant_ids = await admins_collection.distinct("tenant_id", {
        "tenant_id": {"$ne": None},
        "$or": [
            {"managedDepartments": "Forecast & Analytics"},
            {"permissions": "forecast_analytics"},
        ],
    })

    results = [await _run_forecast_automation_for_tenant(tenant_id) for tenant_id in tenant_ids if tenant_id]
    return {"status": "success", "tenants_processed": len(results), "results": results}


@router.get("/alerts")
async def get_low_stock_alerts(ctx: TenantCtx = Depends(_require_forecast_context)):
    cursor = forecast_low_stock_alerts_collection.find(
        {"tenant_id": ctx["tenant_id"]}
    ).sort("days_remaining", 1)
    rows = []
    async for doc in cursor:
        rows.append({
            "barcode": doc["barcode"], "name": doc.get("name", ""), "sku": doc.get("sku", ""),
            "store_id": doc.get("store_id"), "store_name": doc.get("store_name") or "HQ / Central",
            "stock_qty": doc.get("stock_qty", 0), "avg_weekly_qty": doc.get("avg_weekly_qty", 0),
            "days_remaining": doc.get("days_remaining"), "severity": doc.get("severity", "warning"),
            "updated_at": doc.get("updated_at").isoformat() if isinstance(doc.get("updated_at"), datetime) else None,
        })
    return {"status": "success", "count": len(rows), "data": rows}


@router.get("/restock-draft")
async def get_restock_draft(ctx: TenantCtx = Depends(_require_forecast_context)):
    doc = await forecast_restock_drafts_collection.find_one({"tenant_id": ctx["tenant_id"]})
    if not doc:
        return {"status": "success", "generated_at": None, "lines": [], "line_count": 0}
    return {
        "status": "success",
        "generated_at": doc["generated_at"].isoformat() if isinstance(doc.get("generated_at"), datetime) else None,
        "lines": doc.get("lines", []),
        "line_count": doc.get("line_count", 0),
    }
