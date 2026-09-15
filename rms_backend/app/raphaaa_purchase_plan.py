"""Pure helpers for Raphaaa's tenant-specific purchase planning policy.

The database route owns data collection.  This module owns the auditable
period boundaries and arithmetic so those rules can be tested without a
database connection.
"""
from __future__ import annotations

import math
from datetime import datetime
from typing import Dict, List


RAPHAAA_POLICY_CODE = "RAPHAAA_PEAK_PERIOD_18_STOCK_HALF_V1"
RAPHAAA_UPLIFT_PCT = 18.0
RAPHAAA_STOCK_CREDIT_PCT = 50.0


def _month_after(year: int, month: int) -> datetime:
    if month == 12:
        return datetime(year + 1, 1, 1)
    return datetime(year, month + 1, 1)


def completed_periods(
    as_of: datetime,
    history_periods: int,
    period_mode: str = "calendar_year",
    season_start_month: int = 10,
    season_end_month: int = 2,
) -> List[dict]:
    """Return the most recent completed comparable periods, oldest first.

    Seasonal windows can cross a year boundary, e.g. October-February.
    The end is exclusive so Mongo date filters do not lose late-night sales.
    """
    count = max(2, min(int(history_periods), 10))
    if period_mode == "calendar_year":
        return [
            {
                "key": str(year),
                "label": str(year),
                "start": datetime(year, 1, 1),
                "end": datetime(year + 1, 1, 1),
            }
            for year in range(as_of.year - count, as_of.year)
        ]

    if period_mode != "seasonal_window":
        raise ValueError("period_mode must be calendar_year or seasonal_window")
    if not 1 <= season_start_month <= 12 or not 1 <= season_end_month <= 12:
        raise ValueError("season months must be between 1 and 12")

    candidates: List[dict] = []
    # A bounded backward scan also works for same-year and cross-year windows.
    for start_year in range(as_of.year - count - 3, as_of.year + 1):
        end_year = start_year if season_end_month >= season_start_month else start_year + 1
        start = datetime(start_year, season_start_month, 1)
        end = _month_after(end_year, season_end_month)
        if end > as_of:
            continue
        label = (
            str(start_year)
            if start_year == end_year
            else f"{start_year}-{str(end_year)[-2:]}"
        )
        candidates.append({"key": label, "label": label, "start": start, "end": end})
    return candidates[-count:]


def period_for_date(value: datetime, periods: List[dict]) -> str:
    for period in periods:
        if period["start"] <= value < period["end"]:
            return period["key"]
    return ""


def build_purchase_math(
    quantities_by_period: Dict[str, float],
    current_stock: float,
    unit_cost: float,
    avg_selling_price: float,
    uplift_pct: float = RAPHAAA_UPLIFT_PCT,
    stock_credit_pct: float = RAPHAAA_STOCK_CREDIT_PCT,
) -> dict:
    """Apply Raphaaa's explicit peak + uplift - stock-credit formula."""
    values = [max(0.0, float(value or 0)) for value in quantities_by_period.values()]
    historical_peak = max(values, default=0.0)
    purchase_quantity_before_stock = math.ceil(historical_peak * (1 + uplift_pct / 100))
    stock_credit = max(0.0, float(current_stock or 0)) * stock_credit_pct / 100
    final_purchase_quantity = max(0, math.ceil(purchase_quantity_before_stock - stock_credit))
    cost = max(0.0, float(unit_cost or 0))
    selling_price = max(0.0, float(avg_selling_price or 0))
    return {
        "historical_peak_qty": round(historical_peak, 2),
        "uplift_pct": round(uplift_pct, 2),
        "purchase_qty_before_stock": purchase_quantity_before_stock,
        "current_stock_qty": round(max(0.0, float(current_stock or 0)), 2),
        "stock_credit_pct": round(stock_credit_pct, 2),
        "stock_credit_qty": round(stock_credit, 2),
        "final_purchase_qty": final_purchase_quantity,
        "unit_cost": round(cost, 2),
        "estimated_purchase_amount": round(final_purchase_quantity * cost, 2),
        "expected_sales_value": round(final_purchase_quantity * selling_price, 2),
        "expected_margin": round(final_purchase_quantity * max(0.0, selling_price - cost), 2),
    }


def promotion_label(names: List[str], discount_amount: float) -> str:
    clean = sorted({str(name).strip() for name in names if str(name).strip()})
    if clean:
        return ", ".join(clean)
    if float(discount_amount or 0) > 0:
        return "Unlabelled discount / offer"
    return "No promotion"
