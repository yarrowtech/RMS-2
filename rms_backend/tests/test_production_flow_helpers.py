import unittest

from app.routes.job_work_routes import _clean_asset_urls, _parse_fabric_references, _parse_measurement_rows, _theme_reference
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

    def test_fabric_references_keep_structured_fields_and_clean_images(self):
        rows = _parse_fabric_references([{
            "reference_name": " Main fabric ", "usage": "Body and sleeves",
            "fabric_type": "Woven cotton", "gsm": "180 GSM", "consumption": "1.8",
            "unit": "metres", "image_urls": ["null", " https://cdn.example.com/main.jpg "],
        }, {"reference_name": ""}])
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["reference_name"], "Main fabric")
        self.assertEqual(rows[0]["usage"], "Body and sleeves")
        self.assertEqual(rows[0]["image_urls"], ["https://cdn.example.com/main.jpg"])

    def test_measurement_rows_keep_pom_instructions_tolerance_and_grading(self):
        rows = _parse_measurement_rows([{
            "pom_code": " P1 ", "point": "Chest width", "measure_instruction": "Measure 2.5 cm below armhole",
            "unit": "cm", "sample_value": "50", "tolerance": "±0.5", "grade_rule": "+2 cm per size",
            "grades": {"S": "48", "M": "50", "L": "52"},
        }])
        self.assertEqual(rows[0]["pom_code"], "P1")
        self.assertEqual(rows[0]["measure_instruction"], "Measure 2.5 cm below armhole")
        self.assertEqual(rows[0]["tolerance"], "±0.5")
        self.assertEqual(rows[0]["grade_rule"], "+2 cm per size")
        self.assertEqual(rows[0]["grades"]["L"], "52")
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
