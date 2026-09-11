import unittest

from app.routes.job_work_routes import _clean_asset_urls, _theme_reference
from app.routes.production_flow_routes import clean_steps, number, safe_barcode


class ProductionFlowHelperTests(unittest.TestCase):
    def test_route_steps_keep_valid_internal_external_sequence(self):
        steps = clean_steps([
            {"name": " Cutting ", "mode": "internal", "instructions": "Use marker", "sections": ["Sketch", "Measurements"]},
            {"name": "Stitching", "mode": "external", "sections": ["details"]},
            {"name": "Invalid", "mode": "unknown"},
        ])
        self.assertEqual([row["name"] for row in steps], ["Cutting", "Stitching"])
        self.assertEqual([row["index"] for row in steps], [0, 1])
        self.assertEqual(steps[0]["mode"], "INTERNAL")
        self.assertEqual(steps[0]["sections"], ["sketch", "measurements"])

    def test_quantity_never_becomes_negative(self):
        self.assertEqual(number("20"), 20)
        self.assertEqual(number(-3), 0)
        self.assertEqual(number("bad", 4), 4)

    def test_asset_urls_reject_json_placeholders(self):
        self.assertEqual(
            _clean_asset_urls(["[]", "null", " https://cdn.example.com/sketch.jpg "]),
            ["https://cdn.example.com/sketch.jpg"],
        )
        self.assertEqual(_clean_asset_urls('["https://cdn.example.com/trim.png"]'), ["https://cdn.example.com/trim.png"])
    def test_theme_reference_contains_locked_creative_and_supplier_details(self):
        result = _theme_reference({
            "_id": "theme-1", "theme_name": "Monsoon Earth", "collection": "Festive 2027",
            "palette": ["#7C3AED", "terracotta"], "creative_direction": "Natural texture",
            "moodboard_urls": ["https://cdn.example.com/mood.jpg"],
            "lines": [{"image_url": "https://cdn.example.com/fabric.jpg", "vendor_name": "Mill A", "color": "Rust"}],
        })
        self.assertEqual(result["theme_name"], "Monsoon Earth")
        self.assertEqual(result["palette"], ["#7C3AED", "terracotta"])
        self.assertEqual(result["swatches"][0]["vendor_name"], "Mill A")
    def test_garment_barcode_is_safe_and_variant_stable(self):
        self.assertEqual(safe_barcode("FG-DES 101-Navy Blue-M"), "FG-DES-101-NAVY-BLUE-M")
        self.assertEqual(safe_barcode("FG-DES 101-Navy Blue-M"), safe_barcode("FG-DES 101-Navy Blue-M"))


if __name__ == "__main__":
    unittest.main()