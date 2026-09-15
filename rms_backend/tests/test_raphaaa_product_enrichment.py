import unittest

from app.raphaaa_product_enrichment import (
    enrichment_patch,
    is_poor_product_name,
    is_raphaaa_tenant,
    proposed_product_name,
)


class RaphaaaProductEnrichmentTests(unittest.TestCase):
    def test_tenant_gate_is_exact(self):
        self.assertTrue(is_raphaaa_tenant("raphaaa"))
        self.assertTrue(is_raphaaa_tenant("RAPHAAA"))
        self.assertFalse(is_raphaaa_tenant("raphaaa-demo"))
        self.assertFalse(is_raphaaa_tenant("another-tenant"))

    def test_code_date_and_barcode_are_poor_names(self):
        self.assertTrue(is_poor_product_name("F/S"))
        self.assertTrue(is_poor_product_name("MPO"))
        self.assertTrue(is_poor_product_name("2026-03-04 00:00:00"))
        self.assertTrue(is_poor_product_name("C839444", barcode="C839444"))
        self.assertFalse(is_poor_product_name("Quilted Winter Jacket"))

    def test_readable_name_uses_hierarchy(self):
        product = {
            "product_name": "F/S",
            "barcode": "C839444",
            "sku": "C839444",
            "section": "Ladies Winter Garments (R)",
            "department": "Dress (RWL)",
            "category1": "RGW1624",
            "category4": "F/S",
        }
        self.assertEqual(proposed_product_name(product), "Ladies Dress - Full Sleeve - RGW1624")

    def test_valid_source_name_is_retained(self):
        product = {"product_name": "Cable Knit Pullover", "department": "Pullover", "category1": "LPO100"}
        self.assertEqual(proposed_product_name(product), "Cable Knit Pullover")

    def test_barcode_name_is_not_reintroduced_as_a_type(self):
        product = {
            "product_name": "C804251", "barcode": "C804251", "sku": "C804251",
            "section": "Ladies Winter Garments (R)", "department": "Scarf (RWL)",
            "category1": "2717 (SCARF)", "category4": "PRINTED",
        }
        self.assertEqual(proposed_product_name(product), "Ladies Scarf - Printed - 2717")

    def test_patch_preserves_source_and_copies_category_metadata(self):
        product = {
            "product_name": "MWS",
            "section": "Men Winter Garments",
            "department": "Sweater",
            "category1": "MW100",
            "category2": "Eretailms Winter",
            "category3": "Cable Knit",
            "category4": "F/S",
            "category5": "L",
            "vendor_name": "Supplier A (1001)",
            "vendor_id": None,
        }
        patch = enrichment_patch(product)
        self.assertEqual(patch["source_product_name"], "MWS")
        self.assertEqual(patch["product_name"], "Men's Sweater - Cable Knit - Full Sleeve - MW100")
        self.assertEqual(patch["brand"], "Eretailms Winter")
        self.assertEqual(patch["style"], "Cable Knit")
        self.assertEqual(patch["size"], "L")
        self.assertEqual(patch["vendor_match_status"], "unlinked")
        self.assertIn("vendor_unlinked", patch["data_quality_issues"])
        self.assertNotIn("poor_product_name", patch["data_quality_issues"])


if __name__ == "__main__":
    unittest.main()
