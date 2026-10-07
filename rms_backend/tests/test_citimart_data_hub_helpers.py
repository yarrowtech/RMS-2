from app.routes.citimart_data_hub_routes import (
    _build_location_lookup,
    _build_product_lookup,
    _mark_stock_duplicates,
    _resolve_location,
    _resolve_product_row,
)


def test_existing_citimart_store_names_and_codes_resolve_to_real_ids():
    stores = [
        {"_id": "store-new-market", "name": "CITIMART-NEW MARKET", "code": "001"},
        {"_id": "store-hatibagan", "name": "CITIMART-HATIBAGAN", "code": "002"},
        {"_id": "store-chowringhee", "name": "CITIMART-CHOWRINGHEEE", "code": "003"},
    ]
    lookup = _build_location_lookup(stores)
    new_market, errors = _resolve_location("CITIMART-NEW MARKET", lookup)
    assert not errors
    assert new_market["store_id"] == "store-new-market"
    by_code, errors = _resolve_location("002", lookup)
    assert not errors
    assert by_code["store_name"] == "CITIMART-HATIBAGAN"
    central, errors = _resolve_location("Central Inventory", lookup)
    assert not errors
    assert central["store_id"] is None
    assert central["central_segment"] == "MAIN"

    semi_fresh, errors = _resolve_location("SEMI FRESH WAREHOUSE", lookup)
    assert not errors
    assert semi_fresh["central_segment"] == "SEMI_FRESH"
    assert semi_fresh["location_label"] == "Central Inventory / Semi Fresh Warehouse"

    packed, errors = _resolve_location("Package", lookup)
    assert not errors
    assert packed["central_segment"] == "PACKED"


def test_unknown_location_is_blocked_instead_of_guessed():
    resolved, errors = _resolve_location("Some Other Shop", _build_location_lookup([]))
    assert resolved is None
    assert "does not match" in errors[0]


def test_product_resolves_by_barcode_or_item_code_and_conflicts_are_blocked():
    products = [
        {"_id": "p1", "barcode": "8901001", "sku": "ITEM-1", "product_name": "Shirt", "cost_price": 100, "mrp": 250},
        {"_id": "p2", "barcode": "8901002", "sku": "ITEM-2", "product_name": "Trouser", "cost_price": 200, "mrp": 450},
    ]
    lookup = _build_product_lookup(products)
    product, errors = _resolve_product_row({"barcode": "8901001", "item_code": ""}, lookup)
    assert not errors and product["product_id"] == "p1"
    product, errors = _resolve_product_row({"barcode": "", "item_code": "item-2"}, lookup)
    assert not errors and product["barcode"] == "8901002"
    _, errors = _resolve_product_row({"barcode": "8901001", "item_code": "ITEM-2"}, lookup)
    assert any("different products" in error for error in errors)


def test_duplicate_product_location_rows_are_flagged():
    rows = [
        {"store_name": "CITIMART-NEW MARKET", "barcode": "ABC", "item_code": "", "errors": []},
        {"store_name": "citimart new market", "barcode": "abc", "item_code": "", "errors": []},
    ]
    marked = _mark_stock_duplicates(rows)
    assert not marked[0]["errors"]
    assert "Duplicate product/location" in marked[1]["errors"][0]