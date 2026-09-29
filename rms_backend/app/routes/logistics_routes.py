"""Logistics dashboard — an independent, opt-in add-on (see
logistics_addon_routes.py). Deliberately reads off data that already
exists elsewhere instead of introducing a parallel tracking system:

  - "Inbound" = purchase orders sent to a vendor and not yet fully
    closed, plus whatever dispatch info the vendor has already filled in
    (grc_routes.py already reads this same `delivery.vendor` sub-doc when
    a GRC is raised against a PO).
  - "Transfers" = stock_transfers_collection rows still `Dispatched`
    (Stock_transfer_routes.py's two-step dispatch/receive model) — these
    already carry transporter/transit-due-date fields.

No new source of truth, no e-way bill/GSTN integration — just a single
place to see what's still moving.
"""
from datetime import datetime, timedelta
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException

from .deps import get_hq_tenant
from .internal_notification_routes import notify as notify_internal
from ..db import (
    internal_notifications_collection, purchaseorders_collection, stock_transfers_collection, tenants_collection,
)

router = APIRouter(prefix="/api/logistics", tags=["Logistics"])
TenantCtx = Dict[str, Any]

INBOUND_STATUSES = ["SentToVendor", "VendorSubmitted", "Approved"]


def _number(value) -> float:
    try:
        return round(float(value or 0), 2)
    except (TypeError, ValueError):
        return 0.0


async def _ensure_logistics_addon_enabled(ctx: dict) -> None:
    """Logistics is a pure opt-in add-on — no plan-based grandfather, since
    the need for it depends on how a retailer moves goods, not their plan."""
    tenant = await tenants_collection.find_one(
        {"tenant_id": ctx["tenant_id"]}, {"logistics_enabled": 1}
    )
    if (tenant or {}).get("logistics_enabled"):
        return
    raise HTTPException(
        status_code=403,
        detail="Logistics is not enabled for this account. Ask your Super Admin to activate this add-on.",
    )


async def _require_logistics(ctx: dict = Depends(get_hq_tenant)) -> dict:
    permissions = set(ctx.get("_permissions") or [])
    departments = set(ctx.get("_managed_departments") or [])
    if "logistics" not in permissions and "Logistics" not in departments:
        raise HTTPException(
            status_code=403,
            detail="Logistics permission is required. Ask an HQ administrator to grant it.",
        )
    await _ensure_logistics_addon_enabled(ctx)
    return ctx


DELAYED_PO_NOTIFY_COOLDOWN_HOURS = 20  # this dashboard is opened often; don't re-notify every visit


async def _notify_delayed_pos(tenant_id: str, overdue_pos: list, now: datetime) -> None:
    """Tells Merchandiser Buyer, Inventory and HQ, inside the tenant, that a
    purchase order has passed its expected delivery date without arriving.
    Runs on-demand whenever this dashboard is read (same shared-data pull
    cadence as the rest of this file) rather than a separate scheduled job.
    Additive: only reads/writes internal_notifications_collection."""
    if not overdue_pos:
        return
    cutoff = now - timedelta(hours=DELAYED_PO_NOTIFY_COOLDOWN_HOURS)
    recent = await internal_notifications_collection.find_one({
        "tenant_id": tenant_id, "type": "po_delayed", "created_at": {"$gte": cutoff},
    })
    if recent:
        return
    top = overdue_pos[:3]
    names = ", ".join(f"{p['order_no']} ({p['vendor_name']})" for p in top)
    title = f"{len(overdue_pos)} purchase order(s) are past their delivery date"
    message = f"{names}{' and more' if len(overdue_pos) > 3 else ''}."
    for department in ("Merchandiser Buyer", "Inventory", "HQ"):
        await notify_internal(
            tenant_id, type="po_delayed", title=title, message=message,
            department=department, ref_type="purchase_order", priority="high",
        )


@router.get("/dashboard")
async def logistics_dashboard(ctx: TenantCtx = Depends(_require_logistics)):
    tenant_id = ctx["tenant_id"]
    now = datetime.utcnow()

    inbound = []
    overdue_pos = []
    cursor = purchaseorders_collection.find(
        {"tenant_id": tenant_id, "status": {"$in": INBOUND_STATUSES}},
        {
            "orderNo": 1, "vendorName": 1, "status": 1, "orderType": 1,
            "orderDate": 1, "expectedDeliveryDate": 1, "netAmount": 1, "delivery": 1,
        },
    ).sort("orderDate", -1).limit(50)
    async for po in cursor:
        dispatch = (po.get("delivery") or {}).get("vendor") or {}
        expected = (po.get("expectedDeliveryDate") or "").strip()
        is_late = False
        if expected:
            try:
                is_late = datetime.strptime(expected, "%Y-%m-%d") < now
            except ValueError:
                is_late = False
        row = {
            "order_no": po.get("orderNo", ""),
            "vendor_name": po.get("vendorName", ""),
            "status": po.get("status", ""),
            "order_type": po.get("orderType") or "Goods",
            "order_date": po.get("orderDate", ""),
            "expected_delivery_date": expected,
            "net_amount": _number(po.get("netAmount")),
            "vehicle_number": dispatch.get("vehicle_number", ""),
            "transporter_name": dispatch.get("transporter_name", ""),
            "tracking_number": dispatch.get("tracking_number", ""),
            "dispatched": bool(dispatch.get("vehicle_number") or dispatch.get("tracking_number")),
            "is_late": is_late,
        }
        inbound.append(row)
        if is_late:
            overdue_pos.append(row)

    await _notify_delayed_pos(tenant_id, overdue_pos, now)

    transfers = []
    overdue_transfers = 0
    cursor = stock_transfers_collection.find(
        {"tenant_id": tenant_id, "type": "Out", "status": "Dispatched"},
    ).sort("createdAt", -1).limit(50)
    async for row in cursor:
        due = (row.get("transitDueDate") or "").strip()
        is_overdue = False
        if due:
            try:
                is_overdue = datetime.strptime(due, "%Y-%m-%d") < now
            except ValueError:
                is_overdue = False
        if is_overdue:
            overdue_transfers += 1
        transfers.append({
            "id": str(row["_id"]),
            "ref_no": row.get("refNo", ""),
            "from": row.get("fromWh", "") or "Central",
            "to": row.get("toWh", "") or "Central",
            "transporter": row.get("transporter", ""),
            "transit_days": row.get("transitDays", 0),
            "transit_due_date": due,
            "is_overdue": is_overdue,
            "total_qty": row.get("totalQty", 0),
            "total_value": _number(row.get("totalValue")),
            "created_at": row["_id"].generation_time.isoformat() if not row.get("createdAt") else (
                row["createdAt"].isoformat() if isinstance(row.get("createdAt"), datetime) else str(row.get("createdAt"))
            ),
        })

    return {
        "inbound": inbound,
        "transfers": transfers,
        "summary": {
            "inbound_in_transit": sum(1 for row in inbound if row["dispatched"]),
            "inbound_awaiting_dispatch": sum(1 for row in inbound if not row["dispatched"]),
            "transfers_in_transit": len(transfers),
            "overdue_transfers": overdue_transfers,
            "overdue_pos": len(overdue_pos),
        },
    }
