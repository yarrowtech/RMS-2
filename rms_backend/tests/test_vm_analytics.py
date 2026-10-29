import unittest
from datetime import datetime

from app.vm_analytics import calculate_optimization_recommendations, calculate_placement_analytics, classify_experiment_result


class VisualMerchandisingAnalyticsTests(unittest.TestCase):
    def test_sales_returns_uplift_and_ambiguity(self):
        placements = [
            {"id": "p1", "barcode": "100", "product_name": "Shirt", "store_id": "s1", "rack": "R1", "start_date": "2027-01-10", "end_date": "2027-01-19", "margin_pct": 30, "current_stock": 5},
            {"id": "p2", "barcode": "100", "product_name": "Shirt", "store_id": "s1", "rack": "R2", "start_date": "2027-01-10", "end_date": "2027-01-19", "margin_pct": 30, "current_stock": 5},
        ]
        sales = [
            {"invoice_no": "B1", "type": "sale", "store_id": "s1", "created_at": datetime(2027, 1, 5), "items": [{"barcode": "100", "qty": 1, "total": 100}]},
            {"invoice_no": "D1", "type": "sale", "store_id": "s1", "created_at": datetime(2027, 1, 12), "items": [{"barcode": "100", "qty": 2, "total": 200}]},
            {"invoice_no": "R1", "type": "return", "store_id": "s1", "created_at": datetime(2027, 1, 13), "items": [{"barcode": "100", "qty": 1, "total": 50}]},
        ]
        result = calculate_placement_analytics(placements, sales, "2027-01-10", "2027-01-19", datetime(2027, 1, 20))
        self.assertEqual(result["summary"]["before_revenue"], 100)
        self.assertEqual(result["summary"]["during_revenue"], 150)
        self.assertEqual(result["summary"]["revenue_uplift_pct"], 50)
        self.assertEqual(result["summary"]["during_margin"], 45)
        self.assertEqual(result["summary"]["ambiguous_placements"], 2)
        self.assertTrue(result["rows"][0]["ambiguous_attribution"])

    def test_stockout_recommendation(self):
        result = calculate_placement_analytics([
            {"id": "p1", "barcode": "200", "product_name": "Jeans", "store_id": "s1", "start_date": "2027-01-10", "end_date": "2027-01-12", "margin_pct": 20, "current_stock": 0},
        ], [], "2027-01-10", "2027-01-12", datetime(2027, 1, 13))
        self.assertTrue(result["rows"][0]["stockout_signal"])
        self.assertIn("Replenish", result["rows"][0]["recommendation"])

    def test_optimizer_expands_strong_stocked_compliant_placement(self):
        rows = [{"placement_id": "p1", "product_name": "Shirt", "barcode": "100", "store_id": "s1", "revenue_uplift_pct": 30, "current_stock": 20, "ambiguous_attribution": False, "during": {"margin": 500}}]
        result = calculate_optimization_recommendations(rows, {"p1": {"display_quantity": 5, "facings": 2}}, {"p1": 95})
        self.assertEqual(result["rows"][0]["action"], "EXPAND_FACINGS")
        self.assertEqual(result["summary"]["expand"], 1)

    def test_optimizer_blocks_expansion_when_stock_is_short(self):
        rows = [{"placement_id": "p1", "product_name": "Shirt", "barcode": "100", "store_id": "s1", "revenue_uplift_pct": 40, "current_stock": 2, "ambiguous_attribution": False, "during": {"margin": 500}}]
        result = calculate_optimization_recommendations(rows, {"p1": {"display_quantity": 5, "facings": 2}}, {"p1": 100})
        self.assertEqual(result["rows"][0]["action"], "REPLENISH_HOLD")
        self.assertTrue(result["rows"][0]["blockers"])

    def test_optimizer_requires_attribution_before_position_change(self):
        rows = [{"placement_id": "p1", "product_name": "Shirt", "barcode": "100", "store_id": "s1", "revenue_uplift_pct": 40, "current_stock": 20, "ambiguous_attribution": True, "during": {"margin": 500}}]
        result = calculate_optimization_recommendations(rows, {"p1": {"display_quantity": 5}}, {"p1": 100})
        self.assertEqual(result["rows"][0]["action"], "VERIFY_ATTRIBUTION")

    def test_experiment_result_classification(self):
        self.assertEqual(classify_experiment_result(15, 5), "WINNER")
        self.assertEqual(classify_experiment_result(-12, 2), "LOSER")
        self.assertEqual(classify_experiment_result(4, 3), "NEUTRAL")
        self.assertEqual(classify_experiment_result(None), "INSUFFICIENT_DATA")


if __name__ == "__main__":
    unittest.main()
