"""Citimart target carry-forward — per store, rebuilt from logged data.

Mirrors the CitiMart3 Target Adjustment Engine (7-day window, month-end close,
equal split). A day's shortfall becomes a deficit bucket that is spread over the
next days in its window and added to those days' targets. Sales above the
original target pay the oldest bucket first. Unpaid balance expires at window
end (or month end). Nothing before POLICY_START_DATE creates or carries a
shortfall. The state is recomputed from logs each time, so nothing is stored.
"""
from datetime import date, timedelta
from typing import Dict, Optional

from .db import citimart_bill_logs_collection, citimart_sales_targets_collection

TENANT_ID = "citimart"
POLICY_START_DATE = date(2026, 9, 16)
RECOVERY_WINDOW = 7


def _month_end(d: date) -> date:
    nxt = date(d.year + (d.month // 12), d.month % 12 + 1, 1)
    return nxt - timedelta(days=1)


def _bucket_end(origin: date) -> date:
    return min(origin + timedelta(days=RECOVERY_WINDOW), _month_end(origin))


async def _store_facts(store: str, start: date, end: date):
    lo, hi = start.isoformat(), end.isoformat()
    targets: Dict[str, Optional[float]] = {}
    async for row in citimart_sales_targets_collection.find({"tenant_id": TENANT_ID, "store": store, "entry_date": {"$gte": lo, "$lte": hi}}):
        targets[row["entry_date"]] = float(row["sales_target"]) if row.get("sales_target") is not None else None
    sales: Dict[str, float] = {}
    async for row in citimart_bill_logs_collection.find({"tenant_id": TENANT_ID, "store": store, "entry_date": {"$gte": lo, "$lte": hi}}, {"entry_date": 1, "net_amount": 1}):
        sales[row["entry_date"]] = sales.get(row["entry_date"], 0.0) + float(row.get("net_amount") or 0)
    return targets, sales


def _simulate(targets: Dict[str, Optional[float]], sales: Dict[str, float], start: date, end: date, want_buckets: bool = False):
    buckets = []
    result = {}
    d = start
    while d <= end:
        iso = d.isoformat()
        orig = targets.get(iso)
        net = round(sales.get(iso, 0.0), 2)
        is_today = d == end
        carry = 0.0
        active = []
        for b in buckets:
            if b["status"] != "ACTIVE":
                continue
            if d < b["start"]:
                continue
            if d > b["end"] or b["remaining"] <= 0.001:
                b["status"] = "EXPIRED" if b["remaining"] > 0.001 else "COMPLETED"
                b["remaining"] = 0.0 if b["status"] == "EXPIRED" else b["remaining"]
                continue
            active.append(b)
            days_left = (b["end"] - d).days + 1
            carry += b["remaining"] if days_left <= 1 else b["remaining"] / days_left
        carry = round(carry, 2)
        outstanding_before = round(sum(b["remaining"] for b in active), 2)
        if orig is not None:
            adjusted = round(orig + carry, 2)
        else:
            adjusted = carry if carry > 0 else None
        recovered = 0.0
        if orig is not None:
            if net < orig:
                short = round(orig - net, 2)
                if short > 0 and not is_today:
                    buckets.append({"start": d + timedelta(days=1), "end": _bucket_end(d), "remaining": short, "status": "ACTIVE"})
            else:
                rem = round(net - orig, 2)
                for b in active:
                    if rem <= 0:
                        break
                    pay = min(rem, b["remaining"])
                    b["remaining"] = round(b["remaining"] - pay, 2)
                    recovered = round(recovered + pay, 2)
                    rem = round(rem - pay, 2)
                    if b["remaining"] <= 0.001:
                        b["remaining"] = 0.0
                        b["status"] = "COMPLETED"
        result[iso] = {
            "original_target": orig,
            "scheduled_carry": carry,
            "adjusted_target": adjusted,
            "net_sales": net,
            "outstanding_before": outstanding_before,
            "recovered_today": recovered,
        }
        d += timedelta(days=1)
    today = result[end.isoformat()]
    if want_buckets:
        active_list = [
            {"origin_date": b["start"] - timedelta(days=1), "recovery_start": b["start"], "recovery_end": b["end"], "remaining": b["remaining"], "status": b["status"]}
            for b in buckets if b["status"] == "ACTIVE" and b["remaining"] > 0.001
        ]
        return today, active_list
    return today


async def store_adjustment(store: str, target_date: date) -> Optional[dict]:
    if target_date < POLICY_START_DATE:
        return None
    targets, sales = await _store_facts(store, POLICY_START_DATE, target_date)
    if not targets and not sales:
        return None
    today = _simulate(targets, sales, POLICY_START_DATE, target_date)
    return today


async def store_buckets(store: str, target_date: date):
    if target_date < POLICY_START_DATE:
        return []
    targets, sales = await _store_facts(store, POLICY_START_DATE, target_date)
    if not targets and not sales:
        return []
    _, buckets = _simulate(targets, sales, POLICY_START_DATE, target_date, want_buckets=True)
    return [
        {
            "origin_date": b["origin_date"].isoformat(),
            "recovery_start": b["recovery_start"].isoformat(),
            "recovery_end": b["recovery_end"].isoformat(),
            "remaining": b["remaining"],
        }
        for b in sorted(buckets, key=lambda x: x["origin_date"])
    ]
