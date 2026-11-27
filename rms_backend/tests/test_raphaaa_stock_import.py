from app.routes.forecast_data_hub_routes import _key, _stock_rows


STORES = [
    {"id": "1", "name": "Raphaaa - Chowringhee", "aliases": {"raphaaachowringhee", "chowringhee", "001"}},
    {"id": "2", "name": "Raphaaa - Other", "aliases": {"raphaaaother", "other", "002"}},
]


def row(**values):
    return {_key(k): str(v) for k, v in values.items()}


def parse(*rows):
    return _stock_rows(list(rows), {}, {}, {}, STORES)


def test_location_fallback_and_source_fields_are_retained():
    rows, totals, _, _ = parse(row(Barcode="123", ITEM_CODE="A", Locname="Unknown", Source_Site="001",
                                   CLOSING_QTY=2, CLOSING_AMT=50, HSN_CODE="0012", UOM="PCS",
                                   LAST_INWARD_RATE=25, RSP_VALUE=80, Date_as_on="2026-01-01"))
    result = rows[0]
    assert not result["errors"]
    assert totals["Raphaaa - Chowringhee"] == 2
    saved = result["_snapshot_rows"]["Raphaaa - Chowringhee"][0]
    assert saved["hsn_code"] == "0012" and saved["last_inward_rate"] == "25"
    assert saved["rsp_value"] == "80" and saved["date_as_on"] == "2026-01-01"
    assert result["_product_values"]["unit"] == "PCS"
    assert result["_product_values"]["item_code"] == "A"
    assert "sku" not in result["_product_values"]
    assert result["_product"]["barcode"] == "123"


def test_conflicting_locations_block_product_and_exclude_totals():
    rows, totals, _, _ = parse(row(Barcode="123", Locname="Megashop", Source_Site="002", CLOSING_QTY=2))
    assert any("Location conflict" in error for error in rows[0]["errors"])
    assert sum(totals.values()) == 0


def test_different_batch_rates_are_retained_without_overwriting_master():
    rows, _, _, _ = parse(
        row(Barcode="123", Source_Site="001", CLOSING_QTY=2, STANDARD_RATE=10, CATEGORY6="01/25"),
        row(Barcode="123", Source_Site="001", CLOSING_QTY=3, STANDARD_RATE=20, CATEGORY6="02/25"),
    )
    result = rows[0]
    assert not result["errors"]
    assert result["allocation"]["Raphaaa - Chowringhee"] == 5
    assert "cost_price" not in result["_product_values"]
    assert len(result["_snapshot_rows"]["Raphaaa - Chowringhee"]) == 2


def test_duplicate_rows_and_invalid_rates_block_import():
    repeated = row(Barcode="123", Source_Site="001", CLOSING_QTY=2, RSP="bad")
    rows, totals, _, _ = parse(repeated, repeated)
    assert any("Duplicate stock row" in error for error in rows[0]["errors"])
    assert any("rsp must be zero or greater" in error for error in rows[0]["errors"])
    assert sum(totals.values()) == 0


def test_missing_barcode_is_not_replaced_with_item_code():
    rows, _, _, _ = parse(row(ITEM_CODE="SOURCE-123", Source_Site="001", CLOSING_QTY=1))
    assert rows[0]["_product"] is None
    assert any("Barcode is required" in error for error in rows[0]["errors"])


def test_conflicting_existing_identifier_match_is_rejected():
    existing = {"barcode": "OLD", "sku": "RMS-1", "item_code": "SOURCE-1", "product_name": "Item", "design_no": ""}
    rows, _, _, _ = _stock_rows([row(Barcode="NEW", ITEM_CODE="SOURCE-1", Source_Site="001", CLOSING_QTY=1)],
                                {"old": existing}, {"source1": existing}, {}, STORES)
    assert any("different products" in error for error in rows[0]["errors"])
