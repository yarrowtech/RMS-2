from datetime import date, timedelta

from app.product_identity import check_fmcg_receipt


def _line(**overrides):
    line = {
        "product_type": "fmcg",
        "description": "Test food",
        "inwardQty": 5,
        "batch_tracking": True,
        "batchNo": "LOT-01",
        "requires_expiry": True,
        "expiryDate": (date.today() + timedelta(days=90)).isoformat(),
    }
    line.update(overrides)
    return line


def test_valid_fmcg_receipt_has_no_warning():
    assert check_fmcg_receipt([_line()]) == ([], [])


def test_near_expiry_receipt_returns_warning():
    errors, warnings = check_fmcg_receipt([_line(expiryDate=(date.today() + timedelta(days=10)).isoformat())])
    assert errors == []
    assert len(warnings) == 1


def test_expired_fmcg_receipt_is_blocked():
    errors, _ = check_fmcg_receipt([_line(expiryDate=date.today().isoformat())])
    assert any("Expired FMCG" in error for error in errors)


def test_missing_required_batch_is_blocked():
    errors, _ = check_fmcg_receipt([_line(batchNo="")])
    assert any("Batch number" in error for error in errors)


def test_legacy_line_is_not_subject_to_new_strict_rules():
    assert check_fmcg_receipt([{"barcode": "OLD-1", "inwardQty": 2}]) == ([], [])
