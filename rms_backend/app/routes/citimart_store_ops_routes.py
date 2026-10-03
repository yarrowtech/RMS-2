"""Citimart Store Ops — live per-store retail floor KPIs.

Modeled on the standalone "CitiMart3 Daily Operations" system (its KPI
formulas, time-slot bands and don't-fabricate-a-ratio rule are carried over
deliberately, so numbers read the same way store managers are already used
to), but rebuilt as a new, isolated module inside RMS:

  * 404 for any tenant other than "citimart" (same isolation as the Data Hub)
  * its own collections (citimart_bill_logs / citimart_footfall_logs /
    citimart_nob_logs / citimart_sales_targets) — never the live sales/
    store_stock collections POS/billing already use
  * every number is computed from these logs at read time; a ratio with a
    zero/missing denominator is returned as null ("not available"), never
    fabricated as 0 — the frontend decides how to display that

KPI formulas (unchanged from the source system):
  ATV              = net_sales / NOB
  RPV              = net_sales / footfall
  Basket size      = bill_quantity / NOB
  Conversion %     = NOB / footfall * 100
  Achievement %    = net_sales / sales_target * 100
  Remaining        = sales_target - net_sales
A store manager may override any of ATV/RPV/basket_size/conversion_pct/
achievement_pct by hand (e.g. a POS export gap) — the raw log sums
(net_sales/bill_quantity/footfall/nob) are never overridable, only the
derived ratios.
"""
import uuid
from datetime import datetime, time as dtime
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from .deps import get_tenant
from ..db import (
    citimart_bill_logs_collection,
    citimart_footfall_logs_collection,
    citimart_nob_logs_collection,
    citimart_sales_targets_collection,
    citimart_kpi_override_audit_collection,
)

router = APIRouter(prefix="/api/citimart/store-ops", tags=["Citimart Store Ops"])
TenantCtx = Dict[str, Any]

STORE_CODE_TO_NAME = {
    # Exact names as actually stored in stores_collection for this tenant
    # (confirmed against the real store list, not guessed from a reference
    # sheet) — including the double-E in "CHOWRINGHEEE", which is genuinely
    # how that store's name is spelled in the live data.
    "NM": "CITIMART-NEW MARKET",
    "HB": "CITIMART-HATIBAGAN",
    "CHW": "CITIMART-CHOWRINGHEEE",
}

TIME_SLOT_ORDER = [
    "11.00 AM - 01.59 PM",
    "02.00 PM - 04.59 PM",
    "05.00 PM - 07.59 PM",
    "08.00 PM - 11.59 PM",
]
_TIME_SLOT_BANDS = [
    (TIME_SLOT_ORDER[0], 10 * 60 + 30, 14 * 60),
    (TIME_SLOT_ORDER[1], 14 * 60, 17 * 60),
    (TIME_SLOT_ORDER[2], 17 * 60, 20 * 60),
    (TIME_SLOT_ORDER[3], 20 * 60, 24 * 60),
]

OVERRIDABLE_KPIS = ("atv", "rpv", "basket_size", "conversion_pct", "achievement_pct")

KPI_THRESHOLDS = {
    "atv": {"red_below": 900, "green_at_or_above": 1100},
    "rpv": {"red_below": 500, "green_at_or_above": 700},
    "conversion": {"red_below": 45.0, "green_at_or_above": 55.0},
    "achievement": {"red_below": 80.0, "green_above": 100.0},
    "basket_size": {"red_below": 2.0, "green_at_or_above": 5.0},
}


def time_slot_for_time(hour: int, minute: int) -> Optional[str]:
    minutes = hour * 60 + minute
    for label, start, end in _TIME_SLOT_BANDS:
        if start <= minutes < end:
            return label
    return None


def safe_divide(numerator: Optional[float], denominator: Optional[float]) -> Optional[float]:
    """Never fabricates a ratio — a zero or missing denominator returns None
    ("not available"), not 0. The caller/frontend decides how that renders."""
    if numerator is None or denominator is None or denominator == 0:
        return None
    return numerator / denominator


def _validate_store(store: str) -> str:
    store = (store or "").strip().upper()
    if store not in STORE_CODE_TO_NAME:
        raise HTTPException(status_code=400, detail=f"Store must be one of {', '.join(STORE_CODE_TO_NAME)}.")
    return store


def _parse_time(value: str) -> dtime:
    try:
        parts = [int(p) for p in value.split(":")]
        return dtime(parts[0], parts[1], parts[2] if len(parts) > 2 else 0)
    except Exception:
        raise HTTPException(status_code=400, detail="Time must be in HH:MM or HH:MM:SS format.")


# "Store Ops" is the dedicated department (added to SHARED_DEPARTMENTS in
# hq_store_routes.py) HQ assigns to a store-level New Market/Hatibagan/
# Chowringhee login so it's scoped to exactly this KPI page — not full
# Inventory access. Forecast & Analytics/Inventory still also work, for an
# HQ admin who already has one of those and shouldn't need a second account.
ALLOWED_DEPARTMENTS = {"Store Ops", "Forecast & Analytics", "Inventory"}


async def _citimart_context(ctx: TenantCtx = Depends(get_tenant)) -> TenantCtx:
    if (ctx["tenant_id"] or "").strip().lower() != "citimart":
        raise HTTPException(status_code=404, detail="Citimart Store Ops is available only for the Citimart tenant.")
    departments = set(ctx.get("_managed_departments") or ([ctx.get("department")] if ctx.get("department") else []))
    if not departments & ALLOWED_DEPARTMENTS:
        raise HTTPException(status_code=403, detail="Store Ops, Forecast & Analytics or Inventory department access is required.")
    return ctx


def _normalize_store_name(value: str) -> str:
    """Case/whitespace-insensitive comparison key — real store records can
    differ in spacing or capitalization from the exact string a reference
    spreadsheet used ("Citimart - New Market" vs "CITIMART - NEW MARKET"),
    and an exact-match failure here would silently lock a store manager out
    of their own dashboard rather than just mis-labelling something."""
    return " ".join((value or "").strip().upper().split())


def _store_scope(ctx: TenantCtx, requested_store: str = "") -> str:
    """Admin can view/log any store (and must pass one explicitly); a store
    manager is confined to whatever's on their own admin record, the same
    store-scoping principle used throughout the rest of RMS."""
    own_store_name = ctx.get("store_name") or ""
    own_key = _normalize_store_name(own_store_name)
    own_store_code = next((code for code, name in STORE_CODE_TO_NAME.items() if _normalize_store_name(name) == own_key), None)
    if ctx.get("scope") == "store":
        if not own_store_code:
            raise HTTPException(status_code=403, detail="Your store isn't recognised as a Citimart store.")
        if requested_store and _validate_store(requested_store) != own_store_code:
            raise HTTPException(status_code=403, detail="You can only log or view your own store.")
        return own_store_code
    return _validate_store(requested_store) if requested_store else ""


# ── Manual timestamped logs (bill / footfall / NOB) ─────────────────────────
async def _log_collection(kind: str):
    return {"bill": citimart_bill_logs_collection, "footfall": citimart_footfall_logs_collection, "nob": citimart_nob_logs_collection}[kind]


@router.get("/bill-log")
async def list_bill_logs(store: str, date: str, ctx: TenantCtx = Depends(_citimart_context)):
    store = _store_scope(ctx, store)
    rows = []
    async for row in citimart_bill_logs_collection.find({"tenant_id": ctx["tenant_id"], "store": store, "entry_date": date}).sort("bill_time", 1):
        row["id"] = str(row.pop("_id"))
        rows.append(row)
    return {"status": "success", "data": rows}


@router.post("/bill-log", status_code=201)
async def add_bill_log(payload: dict, ctx: TenantCtx = Depends(_citimart_context)):
    store = _store_scope(ctx, payload.get("store", ""))
    bill_time = _parse_time(payload.get("bill_time", ""))
    net_amount = float(payload.get("net_amount") or 0)
    bill_quantity = float(payload.get("bill_quantity") or 0)
    if net_amount <= 0:
        raise HTTPException(status_code=400, detail="Net amount must be greater than zero.")
    entry_date = payload.get("entry_date") or datetime.utcnow().date().isoformat()
    row = {
        "tenant_id": ctx["tenant_id"], "store": store, "entry_date": entry_date,
        "bill_time": bill_time.isoformat(), "net_amount": net_amount, "bill_quantity": bill_quantity,
        "time_slot": time_slot_for_time(bill_time.hour, bill_time.minute),
        "created_by": ctx.get("admin_name") or ctx.get("admin_email") or "", "created_at": datetime.utcnow(),
    }
    result = await citimart_bill_logs_collection.insert_one(row)
    row["id"] = str(result.inserted_id); row.pop("_id", None)
    return {"message": "Bill logged.", "data": row}


@router.put("/bill-log/{log_id}")
async def update_bill_log(log_id: str, payload: dict, ctx: TenantCtx = Depends(_citimart_context)):
    if not ObjectId.is_valid(log_id):
        raise HTTPException(status_code=400, detail="Invalid log id.")
    row = await citimart_bill_logs_collection.find_one({"_id": ObjectId(log_id), "tenant_id": ctx["tenant_id"]})
    if not row:
        raise HTTPException(status_code=404, detail="Bill log not found.")
    _store_scope(ctx, row["store"])
    update: Dict[str, Any] = {}
    if "bill_time" in payload:
        bill_time = _parse_time(payload["bill_time"])
        update["bill_time"] = bill_time.isoformat()
        update["time_slot"] = time_slot_for_time(bill_time.hour, bill_time.minute)
    if "net_amount" in payload:
        update["net_amount"] = float(payload["net_amount"] or 0)
    if "bill_quantity" in payload:
        update["bill_quantity"] = float(payload["bill_quantity"] or 0)
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update.")
    await citimart_bill_logs_collection.update_one({"_id": row["_id"]}, {"$set": update})
    return {"message": "Bill log updated."}


@router.delete("/bill-log/{log_id}")
async def delete_bill_log(log_id: str, ctx: TenantCtx = Depends(_citimart_context)):
    if not ObjectId.is_valid(log_id):
        raise HTTPException(status_code=400, detail="Invalid log id.")
    row = await citimart_bill_logs_collection.find_one({"_id": ObjectId(log_id), "tenant_id": ctx["tenant_id"]})
    if not row:
        raise HTTPException(status_code=404, detail="Bill log not found.")
    _store_scope(ctx, row["store"])
    await citimart_bill_logs_collection.delete_one({"_id": row["_id"]})
    return {"message": "Bill log removed."}


def _count_log_routes(kind: str, collection):
    """Footfall and NOB logs share the exact same shape (store/date/time +
    one integer count field) — this builds both routers from one function
    instead of duplicating the CRUD four times."""
    field = "footfall" if kind == "footfall" else "nob"

    async def list_logs(store: str, date: str, ctx: TenantCtx = Depends(_citimart_context)):
        store = _store_scope(ctx, store)
        rows = []
        async for row in collection.find({"tenant_id": ctx["tenant_id"], "store": store, "entry_date": date}).sort("entry_time", 1):
            row["id"] = str(row.pop("_id"))
            rows.append(row)
        return {"status": "success", "data": rows}

    async def add_log(payload: dict, ctx: TenantCtx = Depends(_citimart_context)):
        store = _store_scope(ctx, payload.get("store", ""))
        entry_time = _parse_time(payload.get("entry_time", ""))
        count = int(payload.get(field) or 0)
        if count <= 0:
            raise HTTPException(status_code=400, detail=f"{field.upper()} count must be greater than zero.")
        entry_date = payload.get("entry_date") or datetime.utcnow().date().isoformat()
        row = {
            "tenant_id": ctx["tenant_id"], "store": store, "entry_date": entry_date,
            "entry_time": entry_time.isoformat(), field: count,
            "time_slot": time_slot_for_time(entry_time.hour, entry_time.minute),
            "created_by": ctx.get("admin_name") or ctx.get("admin_email") or "", "created_at": datetime.utcnow(),
        }
        result = await collection.insert_one(row)
        row["id"] = str(result.inserted_id); row.pop("_id", None)
        return {"message": f"{field.upper()} logged.", "data": row}

    async def update_log(log_id: str, payload: dict, ctx: TenantCtx = Depends(_citimart_context)):
        if not ObjectId.is_valid(log_id):
            raise HTTPException(status_code=400, detail="Invalid log id.")
        row = await collection.find_one({"_id": ObjectId(log_id), "tenant_id": ctx["tenant_id"]})
        if not row:
            raise HTTPException(status_code=404, detail="Log not found.")
        _store_scope(ctx, row["store"])
        update: Dict[str, Any] = {}
        if "entry_time" in payload:
            entry_time = _parse_time(payload["entry_time"])
            update["entry_time"] = entry_time.isoformat()
            update["time_slot"] = time_slot_for_time(entry_time.hour, entry_time.minute)
        if field in payload:
            update[field] = int(payload[field] or 0)
        if not update:
            raise HTTPException(status_code=400, detail="Nothing to update.")
        await collection.update_one({"_id": row["_id"]}, {"$set": update})
        return {"message": "Log updated."}

    async def delete_log(log_id: str, ctx: TenantCtx = Depends(_citimart_context)):
        if not ObjectId.is_valid(log_id):
            raise HTTPException(status_code=400, detail="Invalid log id.")
        row = await collection.find_one({"_id": ObjectId(log_id), "tenant_id": ctx["tenant_id"]})
        if not row:
            raise HTTPException(status_code=404, detail="Log not found.")
        _store_scope(ctx, row["store"])
        await collection.delete_one({"_id": row["_id"]})
        return {"message": "Log removed."}

    return list_logs, add_log, update_log, delete_log


_footfall_list, _footfall_add, _footfall_update, _footfall_delete = _count_log_routes("footfall", citimart_footfall_logs_collection)
router.add_api_route("/footfall-log", _footfall_list, methods=["GET"])
router.add_api_route("/footfall-log", _footfall_add, methods=["POST"], status_code=201)
router.add_api_route("/footfall-log/{log_id}", _footfall_update, methods=["PUT"])
router.add_api_route("/footfall-log/{log_id}", _footfall_delete, methods=["DELETE"])

_nob_list, _nob_add, _nob_update, _nob_delete = _count_log_routes("nob", citimart_nob_logs_collection)
router.add_api_route("/nob-log", _nob_list, methods=["GET"])
router.add_api_route("/nob-log", _nob_add, methods=["POST"], status_code=201)
router.add_api_route("/nob-log/{log_id}", _nob_update, methods=["PUT"])
router.add_api_route("/nob-log/{log_id}", _nob_delete, methods=["DELETE"])


# ── Sales targets + KPI overrides ───────────────────────────────────────────
@router.put("/target")
async def set_target(payload: dict, ctx: TenantCtx = Depends(_citimart_context)):
    store = _store_scope(ctx, payload.get("store", ""))
    entry_date = payload.get("entry_date") or datetime.utcnow().date().isoformat()
    sales_target = float(payload["sales_target"]) if payload.get("sales_target") not in (None, "") else None
    await citimart_sales_targets_collection.update_one(
        {"tenant_id": ctx["tenant_id"], "store": store, "entry_date": entry_date},
        {"$set": {"sales_target": sales_target, "updated_at": datetime.utcnow()}},
        upsert=True,
    )
    return {"message": "Sales target saved."}


@router.put("/kpi-override")
async def set_override(payload: dict, ctx: TenantCtx = Depends(_citimart_context)):
    store = _store_scope(ctx, payload.get("store", ""))
    entry_date = payload.get("entry_date") or datetime.utcnow().date().isoformat()
    field = payload.get("field")
    if field not in OVERRIDABLE_KPIS:
        raise HTTPException(status_code=400, detail=f"field must be one of {', '.join(OVERRIDABLE_KPIS)}.")
    value = payload.get("value")
    await _record_override_change(ctx, store, entry_date, field, value)
    await citimart_sales_targets_collection.update_one(
        {"tenant_id": ctx["tenant_id"], "store": store, "entry_date": entry_date},
        {"$set": {f"overrides.{field}": float(value) if value is not None else None, "updated_at": datetime.utcnow()}},
        upsert=True,
    )
    return {"message": "KPI override saved."}


async def _record_override_change(ctx: TenantCtx, store: str, entry_date: str, field: str, new_value) -> None:
    existing = await citimart_sales_targets_collection.find_one({"tenant_id": ctx["tenant_id"], "store": store, "entry_date": entry_date})
    old_value = ((existing or {}).get("overrides") or {}).get(field)
    await citimart_kpi_override_audit_collection.insert_one({
        "tenant_id": ctx["tenant_id"], "store": store, "entry_date": entry_date, "field": field,
        "old_value": old_value, "new_value": float(new_value) if new_value is not None else None,
        "changed_by": ctx.get("admin_name") or ctx.get("admin_email") or "", "changed_at": datetime.utcnow(),
    })


@router.delete("/kpi-override")
async def clear_override(store: str, entry_date: str, field: str, ctx: TenantCtx = Depends(_citimart_context)):
    store = _store_scope(ctx, store)
    if field not in OVERRIDABLE_KPIS:
        raise HTTPException(status_code=400, detail=f"field must be one of {', '.join(OVERRIDABLE_KPIS)}.")
    await _record_override_change(ctx, store, entry_date, field, None)
    await citimart_sales_targets_collection.update_one(
        {"tenant_id": ctx["tenant_id"], "store": store, "entry_date": entry_date},
        {"$unset": {f"overrides.{field}": ""}},
    )
    return {"message": "Override cleared."}


# ── Live KPIs ────────────────────────────────────────────────────────────
def _apply_overrides(kpis: dict, overrides: dict) -> dict:
    applied = []
    for field in OVERRIDABLE_KPIS:
        value = overrides.get(field)
        if value is None:
            continue
        kpis[field] = float(value)
        applied.append(field)
    if "achievement_pct" in applied:
        ach = kpis["achievement_pct"]
        kpis["remaining_pct"] = 100.0 - ach
        if kpis.get("sales_target") is not None:
            kpis["remaining"] = kpis["sales_target"] - kpis["sales_target"] * ach / 100.0
    kpis["overridden"] = applied
    return kpis


async def _sum_bill_log(tenant_id: str, store: str, entry_date: str):
    net_sales, bill_quantity = 0.0, 0.0
    found = False
    async for row in citimart_bill_logs_collection.find({"tenant_id": tenant_id, "store": store, "entry_date": entry_date}):
        found = True
        net_sales += row.get("net_amount", 0.0)
        bill_quantity += row.get("bill_quantity", 0.0)
    return (net_sales, bill_quantity) if found else (0.0, 0.0)


async def _sum_count_log(collection, tenant_id: str, store: str, entry_date: str, field: str) -> float:
    total = 0.0
    async for row in collection.find({"tenant_id": tenant_id, "store": store, "entry_date": entry_date}):
        total += row.get(field, 0)
    return total


async def _compute_live_kpis(tenant_id: str, store: str, entry_date: str) -> dict:
    net_sales, bill_quantity = await _sum_bill_log(tenant_id, store, entry_date)
    footfall = await _sum_count_log(citimart_footfall_logs_collection, tenant_id, store, entry_date, "footfall")
    nob = await _sum_count_log(citimart_nob_logs_collection, tenant_id, store, entry_date, "nob")

    target_row = await citimart_sales_targets_collection.find_one({"tenant_id": tenant_id, "store": store, "entry_date": entry_date})
    sales_target = target_row.get("sales_target") if target_row else None
    overrides = (target_row or {}).get("overrides") or {}

    remaining = (sales_target - net_sales) if sales_target is not None else None
    achievement_pct = safe_divide(net_sales, sales_target)
    achievement_pct = achievement_pct * 100 if achievement_pct is not None else None
    remaining_pct = safe_divide(remaining, sales_target)
    remaining_pct = remaining_pct * 100 if remaining_pct is not None else None
    conversion_pct = safe_divide(nob, footfall)
    conversion_pct = conversion_pct * 100 if conversion_pct is not None else None

    kpis = {
        "store": store, "store_name": STORE_CODE_TO_NAME[store], "entry_date": entry_date,
        "sales_target": sales_target, "net_sales": round(net_sales, 2), "bill_quantity": bill_quantity,
        "remaining": remaining, "remaining_pct": remaining_pct, "footfall": footfall, "nob": nob,
        "atv": safe_divide(net_sales, nob), "rpv": safe_divide(net_sales, footfall),
        "basket_size": safe_divide(bill_quantity, nob), "conversion_pct": conversion_pct,
        "achievement_pct": achievement_pct,
    }
    return _apply_overrides(kpis, overrides)


@router.get("/live")
async def live_kpis(store: str, date: str, ctx: TenantCtx = Depends(_citimart_context)):
    store = _store_scope(ctx, store)
    return {"status": "success", "data": await _compute_live_kpis(ctx["tenant_id"], store, date)}


@router.get("/live/overall")
async def live_kpis_overall(date: str, ctx: TenantCtx = Depends(_citimart_context)):
    if ctx.get("scope") == "store":
        raise HTTPException(status_code=403, detail="Overall Stores Summary is for Admin only.")
    stores = [await _compute_live_kpis(ctx["tenant_id"], code, date) for code in STORE_CODE_TO_NAME]
    net_sales = sum(s["net_sales"] for s in stores)
    footfall = sum(s["footfall"] for s in stores)
    nob = sum(s["nob"] for s in stores)
    bill_quantity = sum(s["bill_quantity"] for s in stores)
    sales_target = sum(s["sales_target"] for s in stores if s["sales_target"] is not None) or None
    achievement_pct = safe_divide(net_sales, sales_target)
    achievement_pct = achievement_pct * 100 if achievement_pct is not None else None
    conversion_pct = safe_divide(nob, footfall)
    conversion_pct = conversion_pct * 100 if conversion_pct is not None else None
    overall = {
        "entry_date": date, "net_sales": round(net_sales, 2), "footfall": footfall, "nob": nob,
        "bill_quantity": bill_quantity, "sales_target": sales_target,
        "remaining": (sales_target - net_sales) if sales_target is not None else None,
        "atv": safe_divide(net_sales, nob), "rpv": safe_divide(net_sales, footfall),
        "basket_size": safe_divide(bill_quantity, nob), "conversion_pct": conversion_pct,
        "achievement_pct": achievement_pct,
    }
    return {"status": "success", "data": {"overall": overall, "stores": stores}}


@router.get("/kpi-thresholds")
async def kpi_thresholds(ctx: TenantCtx = Depends(_citimart_context)):
    return {"status": "success", "data": KPI_THRESHOLDS}


# ── History ──────────────────────────────────────────────────────────────
@router.get("/history/dates")
async def history_dates(store: str = "ALL", ctx: TenantCtx = Depends(_citimart_context)):
    stores = [_store_scope(ctx, store)] if store != "ALL" else list(STORE_CODE_TO_NAME)
    if ctx.get("scope") == "store":
        stores = [_store_scope(ctx)]
    dates = set()
    for s in stores:
        async for row in citimart_bill_logs_collection.find({"tenant_id": ctx["tenant_id"], "store": s}, {"entry_date": 1}):
            dates.add((s, row["entry_date"]))
    rows = []
    for s, d in sorted(dates, key=lambda x: x[1], reverse=True):
        rows.append({**await _compute_live_kpis(ctx["tenant_id"], s, d)})
    return {"status": "success", "data": rows}


@router.get("/history/details")
async def history_details(store: str, date: str, ctx: TenantCtx = Depends(_citimart_context)):
    store = _store_scope(ctx, store)
    slots = {label: {"time_slot": label, "net_sales": 0.0, "bill_quantity": 0.0, "footfall": 0.0, "nob": 0.0} for label in TIME_SLOT_ORDER}
    bills, footfalls, nobs = [], [], []
    async for row in citimart_bill_logs_collection.find({"tenant_id": ctx["tenant_id"], "store": store, "entry_date": date}).sort("bill_time", 1):
        row["id"] = str(row.pop("_id")); bills.append(row)
        if row["time_slot"] in slots:
            slots[row["time_slot"]]["net_sales"] += row["net_amount"]
            slots[row["time_slot"]]["bill_quantity"] += row["bill_quantity"]
    async for row in citimart_footfall_logs_collection.find({"tenant_id": ctx["tenant_id"], "store": store, "entry_date": date}).sort("entry_time", 1):
        row["id"] = str(row.pop("_id")); footfalls.append(row)
        if row["time_slot"] in slots:
            slots[row["time_slot"]]["footfall"] += row["footfall"]
    async for row in citimart_nob_logs_collection.find({"tenant_id": ctx["tenant_id"], "store": store, "entry_date": date}).sort("entry_time", 1):
        row["id"] = str(row.pop("_id")); nobs.append(row)
        if row["time_slot"] in slots:
            slots[row["time_slot"]]["nob"] += row["nob"]
    time_slots = []
    for label in TIME_SLOT_ORDER:
        cell = slots[label]
        time_slots.append({**cell, "basket_size": round(cell["bill_quantity"] / cell["nob"], 2) if cell["nob"] else None,
                            "conversion_pct": round(cell["nob"] / cell["footfall"] * 100, 2) if cell["footfall"] else None})
    return {"status": "success", "data": {"store": store, "entry_date": date, "time_slots": time_slots, "bills": bills, "footfall_logs": footfalls, "nob_logs": nobs}}


# ── HQ review (admin only) ───────────────────────────────────────────────
def _require_hq(ctx: TenantCtx) -> None:
    if ctx.get("scope") == "store":
        raise HTTPException(status_code=403, detail="This view is for HQ admins only.")


@router.get("/review/comparison")
async def review_comparison(date: str, ctx: TenantCtx = Depends(_citimart_context)):
    """All stores side by side for one date, ranked by achievement %."""
    _require_hq(ctx)
    rows = [await _compute_live_kpis(ctx["tenant_id"], code, date) for code in STORE_CODE_TO_NAME]
    rows.sort(key=lambda r: (r["achievement_pct"] is None, -(r["achievement_pct"] or 0)))
    return {"status": "success", "data": {"entry_date": date, "stores": rows}}


@router.get("/review/exceptions")
async def review_exceptions(date: str, ctx: TenantCtx = Depends(_citimart_context)):
    """Things that need HQ attention for one date: KPIs in the red band per
    store, stores with no entries at all, and time slots with footfall but
    red conversion. Thresholds are the same ones the dashboard uses."""
    _require_hq(ctx)
    items = []
    for code in STORE_CODE_TO_NAME:
        kpis = await _compute_live_kpis(ctx["tenant_id"], code, date)
        has_entries = bool(kpis["net_sales"] or kpis["footfall"] or kpis["nob"])
        if not has_entries:
            items.append({"store": code, "store_name": kpis["store_name"], "type": "no_entries", "message": "No bill, footfall or NOB entries for this date."})
            continue
        for field, band_key, label in (
            ("achievement_pct", "achievement", "Achievement %"), ("conversion_pct", "conversion", "Conversion %"),
            ("atv", "atv", "ATV"), ("rpv", "rpv", "RPV"), ("basket_size", "basket_size", "Basket size"),
        ):
            value = kpis.get(field)
            band = KPI_THRESHOLDS[band_key]
            if value is not None and value < band["red_below"]:
                items.append({"store": code, "store_name": kpis["store_name"], "type": "red_kpi", "message": f"{label} is {round(value, 2)} (red below {band['red_below']})."})
        slot_data = (await history_details(store=code, date=date, ctx=ctx))["data"]["time_slots"]
        for slot in slot_data:
            if slot["footfall"] and slot["conversion_pct"] is not None and slot["conversion_pct"] < KPI_THRESHOLDS["conversion"]["red_below"]:
                items.append({"store": code, "store_name": kpis["store_name"], "type": "slot_conversion", "message": f"{slot['time_slot']}: conversion {slot['conversion_pct']}% with {slot['footfall']} footfall."})
    return {"status": "success", "data": {"entry_date": date, "items": items}}


@router.get("/review/override-audit")
async def review_override_audit(date: str = "", ctx: TenantCtx = Depends(_citimart_context)):
    """Every manual KPI override change, newest first — who set or cleared
    which figure, from what value to what. Optionally one date only."""
    _require_hq(ctx)
    query: Dict[str, Any] = {"tenant_id": ctx["tenant_id"]}
    if date:
        query["entry_date"] = date
    rows = []
    async for row in citimart_kpi_override_audit_collection.find(query).sort("changed_at", -1).limit(500):
        row["id"] = str(row.pop("_id"))
        row["changed_at"] = row["changed_at"].isoformat()
        rows.append(row)
    return {"status": "success", "data": rows}
