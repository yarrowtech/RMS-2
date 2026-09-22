import unittest

from fastapi import HTTPException

from app.routes.job_work_routes import (
    DEFAULT_ALLOWANCE_LIMITS,
    _allowance_approval_state,
    _evaluate_allowances,
    _parse_process_allowances,
)


class AllowanceHelperTests(unittest.TestCase):
    def test_within_limit_needs_no_hq_approval(self):
        rows = _parse_process_allowances([
            {"process": "pattern", "value": 6.5, "unit": "inches", "reason": "Seam and hem"}
        ])
        evaluated, needs_approval = _evaluate_allowances(rows, DEFAULT_ALLOWANCE_LIMITS)
        self.assertFalse(needs_approval)
        self.assertFalse(evaluated[0]["exceeds_limit"])

    def test_length_units_are_converted_before_comparison(self):
        rows = _parse_process_allowances([
            {"process": "pattern", "value": 20, "unit": "centimetres", "reason": "Large shaped hem"}
        ])
        evaluated, needs_approval = _evaluate_allowances(rows, DEFAULT_ALLOWANCE_LIMITS)
        self.assertTrue(needs_approval)
        self.assertTrue(evaluated[0]["exceeds_limit"])

    def test_over_limit_requires_reason(self):
        rows = _parse_process_allowances([
            {"process": "cutting", "value": 6, "unit": "percent"}
        ])
        with self.assertRaises(HTTPException):
            _evaluate_allowances(rows, DEFAULT_ALLOWANCE_LIMITS)

    def test_approved_state_is_preserved_when_rows_are_unchanged(self):
        previous = {"status": "APPROVED", "note": "Checked by HQ"}
        self.assertIs(_allowance_approval_state(True, previous, True), previous)


if __name__ == "__main__":
    unittest.main()
