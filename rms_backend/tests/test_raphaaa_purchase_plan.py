from datetime import datetime

from app.raphaaa_purchase_plan import (
    build_purchase_math,
    completed_periods,
    period_for_date,
    promotion_label,
)


def test_calendar_periods_are_completed_and_oldest_first():
    periods = completed_periods(datetime(2026, 9, 15), 2)
    assert [p["label"] for p in periods] == ["2024", "2025"]
    assert period_for_date(datetime(2025, 12, 31, 23, 59), periods) == "2025"
    assert period_for_date(datetime(2026, 1, 1), periods) == ""


def test_cross_year_winter_periods_are_comparable():
    periods = completed_periods(datetime(2026, 9, 15), 2, "seasonal_window", 10, 2)
    assert [p["label"] for p in periods] == ["2024-25", "2025-26"]
    assert period_for_date(datetime(2026, 2, 28, 20, 0), periods) == "2025-26"
    assert period_for_date(datetime(2026, 3, 1), periods) == ""


def test_raphaaa_formula_uses_peak_uplift_and_half_stock():
    result = build_purchase_math({"2024": 100, "2025": 130}, 40, 250, 499)
    assert result["historical_peak_qty"] == 130
    assert result["purchase_qty_before_stock"] == 154
    assert result["stock_credit_qty"] == 20
    assert result["final_purchase_qty"] == 134
    assert result["estimated_purchase_amount"] == 33500


def test_recommendation_never_goes_negative_and_rounds_units_up():
    result = build_purchase_math({"2024": 1, "2025": 1}, 3, 10, 20)
    assert result["purchase_qty_before_stock"] == 2
    assert result["stock_credit_qty"] == 1.5
    assert result["final_purchase_qty"] == 1
    zero = build_purchase_math({"2024": 1}, 50, 10, 20)
    assert zero["final_purchase_qty"] == 0


def test_existing_discount_without_name_is_not_given_a_fake_campaign():
    assert promotion_label([], 15) == "Unlabelled discount / offer"
    assert promotion_label([], 0) == "No promotion"
    assert promotion_label(["Winter Offer", "Winter Offer"], 15) == "Winter Offer"
