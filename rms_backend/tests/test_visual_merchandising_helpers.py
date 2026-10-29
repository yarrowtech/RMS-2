import unittest

from bson import ObjectId
from fastapi import HTTPException

from app.vm_location_helpers import calculate_photo_audit, layout_transition, location_snapshot, normalise_location_type, summarize_execution_tasks, validate_campaign_dates, validate_placement_rules


class VisualMerchandisingLocationTests(unittest.TestCase):
    def test_location_type_is_normalised(self):
        self.assertEqual(normalise_location_type(" Fixture "), "fixture")

    def test_unknown_location_type_is_rejected(self):
        with self.assertRaises(HTTPException):
            normalise_location_type("aisle")

    def test_snapshot_preserves_ids_and_legacy_labels(self):
        nodes = [
            {"_id": ObjectId(), "type": "floor", "name": "Ground", "store_id": "store-1"},
            {"_id": ObjectId(), "type": "department", "name": "Women", "store_id": "store-1"},
            {"_id": ObjectId(), "type": "zone", "name": "New Arrivals", "store_id": "store-1"},
            {"_id": ObjectId(), "type": "fixture", "name": "Rack 01", "store_id": "store-1"},
            {"_id": ObjectId(), "type": "segment", "name": "Centre", "store_id": "store-1"},
            {"_id": ObjectId(), "type": "shelf", "name": "Eye Level", "store_id": "store-1"},
        ]
        snapshot = location_snapshot(nodes)
        self.assertEqual(snapshot["store_id"], "store-1")
        self.assertEqual(snapshot["floor"], "Ground")
        self.assertEqual(snapshot["rack"], "Rack 01")
        self.assertEqual(snapshot["segment"], "Centre")
        self.assertEqual(snapshot["shelf"], "Eye Level")
        self.assertEqual(set(snapshot["location_node_ids"]), {"floor", "department", "zone", "fixture", "segment", "shelf"})

    def test_capacity_overflow_is_rejected(self):
        with self.assertRaises(HTTPException):
            validate_placement_rules(4, 8, 10, "regular", "", "")

    def test_effective_date_order_is_rejected(self):
        with self.assertRaises(HTTPException):
            validate_placement_rules(2, 0, 10, "promotional", "2026-12-10", "2026-12-01")

    def test_valid_rules_return_normalised_purpose(self):
        self.assertEqual(validate_placement_rules(2, 3, 10, " New-Arrival ", "2026-12-01", "2026-12-10"), "new-arrival")

    def test_layout_review_and_approval_transitions(self):
        self.assertEqual(layout_transition("DRAFT", "submit_review"), "IN_REVIEW")
        self.assertEqual(layout_transition("IN_REVIEW", "approve"), "APPROVED")

    def test_invalid_layout_transition_is_rejected(self):
        with self.assertRaises(HTTPException):
            layout_transition("DRAFT", "activate")

    def test_campaign_date_order_is_rejected(self):
        with self.assertRaises(HTTPException):
            validate_campaign_dates("2027-02-10", "2027-02-01", required=True)

    def test_execution_summary_counts_review_blocked_and_overdue(self):
        summary = summarize_execution_tasks([
            {"status": "DONE", "due_date": "2027-01-01", "priority": "URGENT"},
            {"status": "BLOCKED", "due_date": "2027-01-20", "priority": "HIGH"},
            {"status": "APPROVED", "due_date": "2027-01-01", "priority": "LOW"},
        ], "2027-01-10")
        self.assertEqual(summary["awaiting_review"], 1)
        self.assertEqual(summary["blocked"], 1)
        self.assertEqual(summary["approved"], 1)
        self.assertEqual(summary["overdue"], 1)
        self.assertEqual(summary["urgent"], 1)

    def test_photo_audit_passes_at_eighty_with_critical_checks(self):
        audit = calculate_photo_audit({"correct_product": True, "correct_location": True, "facings_quantity": True, "orientation": True, "presentation": False})
        self.assertEqual(audit["score"], 80)
        self.assertTrue(audit["passed"])
        self.assertEqual(audit["failed_checks"], ["presentation"])

    def test_photo_audit_critical_failure_requires_correction(self):
        audit = calculate_photo_audit({"correct_product": False, "correct_location": True, "facings_quantity": True, "orientation": True, "presentation": True})
        self.assertEqual(audit["score"], 80)
        self.assertFalse(audit["passed"])


if __name__ == "__main__":
    unittest.main()
