from decimal import Decimal
from app.routes.cashier_routes import _sales_detail_rows, _sale_product_snapshot


def total(rows, field):
    return sum(Decimal(str(row[field])) for row in rows)


def test_sale_lines_reconcile_and_keep_separate_identifiers():
    doc = {
        "type": "sale", "date": "2026-11-27 13:05", "invoice_no": "B1", "applied_offer": 1,
        "summary": {"total_sale": 30, "total_savings": 3, "net_payable": 27, "taxable_amount": 25.45},
        "items": [
            {"barcode": "001", "sku": "RMS-1", "item_code": "V-1", "qty": 1, "price": 10, "gst": 5},
            {"barcode": "002", "qty": 1, "price": 20, "gst": 12},
        ],
    }
    rows = _sales_detail_rows(doc)
    assert total(rows, "Gr Amt") == Decimal("30")
    assert total(rows, "Promo Amt") == Decimal("1")
    assert total(rows, "Discount Amt") == Decimal("2")
    assert total(rows, "Net Amt") == Decimal("27")
    assert total(rows, "Taxable Sale") == Decimal("25.45")
    assert rows[0]["Item Code"] == "V-1" and rows[0]["Barcode"] == "001"
    assert rows[0]["Bill Time"] == "13:05" and "Disc Amt" not in rows[0]


def test_return_is_negative_and_preserves_reference_and_missing_history():
    rows = _sales_detail_rows({"type": "return", "invoice_no": "CN1", "original_invoice": "B1",
                               "summary": {"net_payable": 9},
                               "items": [{"qty": 1, "price": 10, "barcode": "001"}]})
    assert rows[0]["Bill Qty"] == -1 and rows[0]["Net Amt"] == -9
    assert rows[0]["Original Bill No."] == "B1"
    assert rows[0]["Taxable Sale"] == "" and rows[0]["Item Code"] == ""


def test_product_snapshot_prefers_variant_and_preserves_item_code():
    snap = _sale_product_snapshot({"item_code": "SOURCE", "category2": "Brand"}, {"category2": "Variant"})
    assert snap["item_code"] == "SOURCE" and snap["category2"] == "Variant"


def test_ageing_uses_recorded_grn_date_with_imported_month_fallback():
    rows = _sales_detail_rows({"type": "sale", "items": [
        {"barcode": "1", "qty": 1, "price": 10, "ageing_receipt_date": "2026-01-15", "category6": "12/25"},
        {"barcode": "2", "qty": 1, "price": 10, "category6": "12/25"},
    ]})
    assert rows[0]["Ageing"] == "2026-01-15"
    assert rows[1]["Ageing"] == "12/25"
