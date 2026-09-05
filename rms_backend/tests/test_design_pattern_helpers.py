import unittest
from datetime import datetime

from bson import ObjectId

from app.routes.design_pattern_routes import clean, number, serialize


class DesignPatternHelperTests(unittest.TestCase):
    def test_clean_trims_and_limits_text(self):
        self.assertEqual(clean("  approved  ", 20), "approved")
        self.assertEqual(clean("abcdef", 3), "abc")
        self.assertEqual(clean(None), "")

    def test_number_rejects_invalid_and_negative_values(self):
        self.assertEqual(number("12.5"), 12.5)
        self.assertEqual(number("invalid", 7), 7)
        self.assertEqual(number(-4), 0)

    def test_serialize_converts_object_id_and_datetimes(self):
        oid = ObjectId()
        row = serialize({"_id": oid, "created_at": datetime(2026, 1, 2, 3, 4, 5), "name": "Style"})
        self.assertEqual(row["id"], str(oid))
        self.assertEqual(row["created_at"], "2026-01-02T03:04:05")
        self.assertEqual(row["name"], "Style")


if __name__ == "__main__":
    unittest.main()
