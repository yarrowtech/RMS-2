from app.product_identity import barcode_policy, identity_fields, is_valid_gtin, stock_identity


def test_gtin_validation_accepts_real_formats_and_rejects_bad_check_digit():
    assert is_valid_gtin("96385074")
    assert is_valid_gtin("036000291452")
    assert is_valid_gtin("4006381333931")
    assert is_valid_gtin("10012345000017")
    assert not is_valid_gtin("4006381333932")
    assert not is_valid_gtin("ABC123")


def test_garment_identity_uses_design_colour_and_size():
    row = {"design_no": "D-278", "color": "Black", "size": "M", "barcode": "NEW-RECEIPT"}
    assert stock_identity(row) == "design:d-278:black:m"


def test_fabric_identity_uses_material_spec_not_design():
    row = {"material_code": "FAB-22", "design_no": "D-278", "color": "Navy", "gsm": "180", "width": "58"}
    assert stock_identity(row) == "material:fab-22:navy:180:58"


def test_fmcg_keeps_vendor_gtin_as_restock_identity():
    row = {"department": "FMCG", "vendorBarcode": "8901234567890", "barcode": "RMS-NEW"}
    assert barcode_policy(row) == "VENDOR_GTIN"
    assert stock_identity(row) == "gtin:8901234567890"


def test_expiring_item_without_gtin_uses_batch_policy():
    assert barcode_policy({"requires_expiry": True}) == "RMS_BATCH"


def test_known_variant_is_stable_when_receipt_barcode_changes():
    first = {"product_id": "P1", "variant_id": "V1", "barcode": "BATCH-A"}
    second = {"product_id": "P1", "variant_id": "V1", "barcode": "BATCH-B"}
    assert stock_identity(first) == stock_identity(second) == "variant:v1"


def test_legacy_item_falls_back_to_barcode_without_breaking():
    fields = identity_fields({"barcode": "LEGACY-001"})
    assert fields["stock_identity"] == "barcode:legacy-001"
    assert fields["barcode_policy"] == "RMS_SKU"
