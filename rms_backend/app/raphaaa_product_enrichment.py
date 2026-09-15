"""Raphaaa-only helpers for cleaning historical Data Hub product metadata.

The historical sales export contains a useful product hierarchy, but its
Description column frequently contains a short garment code (for example F/S)
instead of a customer-readable product name.  These helpers deliberately do
not participate in another tenant's catalogue flow.
"""

import re
from datetime import datetime
from typing import Any, Dict, List


RAPHAAA_TENANT_KEY = "raphaaa"

_SHORT_CODE = re.compile(r"^[A-Z0-9]+(?:[/-][A-Z0-9]+)*$")
_DATE_LIKE = re.compile(
    r"^(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})(?:\s+00:00:00)?$"
)
_TRAILING_INTERNAL_CODE = re.compile(r"\s*\([A-Z0-9 /_-]{1,14}\)\s*$", re.IGNORECASE)

_TYPE_LABELS = {
    "fs": "Full Sleeve",
    "f/s": "Full Sleeve",
    "hs": "Half Sleeve",
    "h/s": "Half Sleeve",
    "sl": "Sleeveless",
    "lpo": "Ladies Pullover",
    "mpo": "Men's Pullover",
    "lws": "Ladies Sweater",
    "mws": "Men's Sweater",
    "lwj": "Ladies Winter Jacket",
    "mwj": "Men's Winter Jacket",
}


def _key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").strip().lower())


def _text(value: Any) -> str:
    return str(value or "").strip()


def is_raphaaa_tenant(tenant_id: Any) -> bool:
    """True only for the real Raphaaa tenant, never for lookalike tenants."""
    return _key(tenant_id) == RAPHAAA_TENANT_KEY


def clean_hierarchy_label(value: Any) -> str:
    """Remove a trailing internal department code while retaining the label."""
    value = re.sub(r"\s+", " ", _text(value))
    value = _TRAILING_INTERNAL_CODE.sub("", value).strip()
    if len(value) > 5 and value.isupper() and not any(char.isdigit() for char in value):
        value = value.title()
    return value


def is_poor_product_name(value: Any, *, barcode: Any = "", sku: Any = "") -> bool:
    """Identify imported values that are identifiers/codes rather than names."""
    value = _text(value)
    if not value:
        return True
    if _key(value) in {_key(barcode), _key(sku)} - {""}:
        return True
    if _DATE_LIKE.match(value):
        return True
    compact = value.replace(" ", "")
    return len(compact) <= 5 and bool(_SHORT_CODE.fullmatch(compact))


def _audience(section: Any) -> str:
    key = _key(section)
    if any(token in key for token in ("ladies", "women", "woman", "female")):
        return "Ladies"
    if any(token in key for token in ("mens", "men", "male")):
        return "Men's"
    if "girls" in key:
        return "Girls"
    if "boys" in key:
        return "Boys"
    if any(token in key for token in ("kids", "children", "child")):
        return "Kids"
    return ""


def _expanded_type(value: Any) -> str:
    value = clean_hierarchy_label(value)
    return _TYPE_LABELS.get(value.lower(), value)


def _product_type(value: Any) -> str:
    value = _expanded_type(value)
    return "" if value.replace(".", "", 1).isdigit() else value


def _append_unique(parts: List[str], value: Any) -> None:
    value = clean_hierarchy_label(value)
    if not value:
        return
    value_key = _key(value)
    if not value_key:
        return
    existing = _key(" ".join(parts))
    if existing and (value_key in existing or existing in value_key):
        return
    parts.append(value)


def proposed_product_name(product: Dict[str, Any]) -> str:
    """Return a readable name while keeping a genuine source name unchanged."""
    raw_name = _text(product.get("product_name") or product.get("description"))
    barcode = product.get("barcode")
    sku = product.get("sku") or product.get("base_sku")
    if not is_poor_product_name(raw_name, barcode=barcode, sku=sku):
        return raw_name

    department = clean_hierarchy_label(product.get("department"))
    section = clean_hierarchy_label(product.get("section"))
    division = clean_hierarchy_label(product.get("division"))
    audience = _audience(section)

    if department:
        base = department
        if audience and _key(audience) not in _key(base):
            base = f"{audience} {base}"
    else:
        base = section or division or "Product"

    parts: List[str] = []
    _append_unique(parts, base)

    style = _expanded_type(product.get("style") or product.get("category3"))
    if style and not is_poor_product_name(style):
        _append_unique(parts, style)

    product_type = _product_type(product.get("product_type") or product.get("category4"))
    if product_type and not is_poor_product_name(product_type):
        _append_unique(parts, product_type)

    source_type = _TYPE_LABELS.get(raw_name.lower(), "")
    if source_type and not is_poor_product_name(source_type):
        _append_unique(parts, source_type)

    design_no = product.get("design_no") or product.get("category1")
    if design_no and _key(design_no) not in {_key(barcode), _key(sku)}:
        _append_unique(parts, design_no)

    return " - ".join(parts) or raw_name or _text(barcode) or _text(sku) or "Product"


def product_quality_issues(product: Dict[str, Any]) -> List[str]:
    issues: List[str] = []
    if is_poor_product_name(
        product.get("product_name"),
        barcode=product.get("barcode"),
        sku=product.get("sku") or product.get("base_sku"),
    ):
        issues.append("poor_product_name")
    if not _text(product.get("brand") or product.get("category2")):
        issues.append("missing_brand")
    if not _text(product.get("hsn_code")):
        issues.append("missing_hsn")
    if float(product.get("gst_rate") or 0) <= 0:
        issues.append("missing_gst")
    if not _text(product.get("description")):
        issues.append("missing_description")
    if not product.get("images"):
        issues.append("missing_images")
    if _text(product.get("vendor_name")) and not product.get("vendor_id"):
        issues.append("vendor_unlinked")
    return issues


def enrichment_patch(product: Dict[str, Any], *, applied_at: Any = None) -> Dict[str, Any]:
    """Build the additive fields used by preview, apply and future imports."""
    original_name = _text(product.get("source_product_name") or product.get("product_name"))
    display_name = proposed_product_name(product)
    patch: Dict[str, Any] = {
        "display_product_name": display_name,
        "source_product_name": original_name,
        "classification_path": [
            _text(product.get("division")),
            _text(product.get("section")),
            _text(product.get("department")),
            _text(product.get("design_no") or product.get("category1")),
            _text(product.get("style") or product.get("category3")),
            _text(product.get("product_type") or product.get("category4")),
            _text(product.get("size") or product.get("category5")),
        ],
        "brand": _text(product.get("brand") or product.get("category2")),
        "style": _expanded_type(product.get("style") or product.get("category3")),
        "product_type": _product_type(product.get("product_type") or product.get("category4")),
        "size": _text(product.get("size") or product.get("category5")),
        "imported_vendor_name": _text(product.get("imported_vendor_name") or product.get("vendor_name")),
        "vendor_match_status": "linked" if product.get("vendor_id") else ("unlinked" if _text(product.get("vendor_name")) else "missing"),
    }
    if is_poor_product_name(
        product.get("product_name"), barcode=product.get("barcode"), sku=product.get("sku") or product.get("base_sku")
    ):
        patch["product_name"] = display_name

    merged = {**product, **patch}
    issues = product_quality_issues(merged)
    patch["data_quality_issues"] = issues
    patch["data_quality_status"] = "ready" if not issues else "needs_enrichment"
    if applied_at is not None:
        patch["data_hub_enriched_at"] = applied_at if isinstance(applied_at, datetime) else datetime.utcnow()
    return patch
