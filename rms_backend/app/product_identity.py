"""Stable replenishment identity helpers with legacy barcode fallback."""
from typing import Any
from datetime import date, timedelta

BARCODE_POLICIES = {"VENDOR_GTIN", "RMS_SKU", "RMS_BATCH", "RMS_SERIAL"}
GTIN_LENGTHS = {8, 12, 13, 14}

def clean(value: Any) -> str:
    return str(value or "").strip()

def normalize_gtin(value: Any) -> str:
    """Return digits-only GTIN text; separators are not silently accepted."""
    return clean(value)

def is_valid_gtin(value: Any) -> bool:
    """Validate GTIN-8, UPC-A/GTIN-12, EAN-13 and GTIN-14 check digits."""
    gtin = normalize_gtin(value)
    if len(gtin) not in GTIN_LENGTHS or not gtin.isdigit():
        return False
    payload, supplied = gtin[:-1], int(gtin[-1])
    total = sum(int(digit) * (3 if index % 2 == 0 else 1) for index, digit in enumerate(reversed(payload)))
    return (10 - total % 10) % 10 == supplied

def check_fmcg_receipt(items: list[dict], today: date | None = None) -> tuple[list[str], list[str]]:
    """Return blocking errors and near-expiry warnings for explicit FMCG lines."""
    errors: list[str] = []
    warnings: list[str] = []
    today = today or date.today()
    for item in items or []:
        if clean(item.get("product_type")).lower() != "fmcg" or float(item.get("inwardQty") or 0) <= 0:
            continue
        label = clean(item.get("description") or item.get("barcode")) or "FMCG item"
        if item.get("batch_tracking") and not clean(item.get("batchNo")):
            errors.append(f"Batch number is required for '{label}'.")
        expiry_text = clean(item.get("expiryDate"))
        if item.get("requires_expiry") and not expiry_text:
            errors.append(f"Expiry date is required for '{label}'.")
            continue
        if expiry_text:
            try:
                expiry = date.fromisoformat(expiry_text[:10])
            except ValueError:
                errors.append(f"Expiry date for '{label}' must use YYYY-MM-DD.")
                continue
            if expiry <= today:
                errors.append(f"Expired FMCG stock cannot be posted for '{label}'.")
            elif expiry <= today + timedelta(days=30):
                warnings.append(f"'{label}' expires on {expiry.isoformat()} (within 30 days).")
    return errors, warnings

def barcode_policy(row: dict) -> str:
    explicit = clean(row.get("barcode_policy")).upper()
    if explicit in BARCODE_POLICIES:
        return explicit
    category = " ".join(clean(row.get(key)).lower() for key in ("product_type", "division", "section", "department", "category"))
    is_fmcg = bool(row.get("requires_expiry")) or any(word in category for word in ("fmcg", "grocery", "food", "beverage", "cosmetic"))
    if is_fmcg:
        return "VENDOR_GTIN" if clean(row.get("vendorBarcode") or row.get("vendor_barcode")) else "RMS_BATCH"
    if row.get("serial_tracking"):
        return "RMS_SERIAL"
    if row.get("batch_tracking"):
        return "RMS_BATCH"
    return "RMS_SKU"

def stock_identity(row: dict) -> str:
    colour = clean(row.get("color") or row.get("colour"))
    size = clean(row.get("size"))
    material_code = clean(row.get("material_code") or row.get("fabric_code"))
    if material_code:
        parts = (material_code, colour, clean(row.get("gsm")), clean(row.get("width")))
        return "material:" + ":".join(value.lower() for value in parts if value)
    design_no = clean(row.get("design_no") or row.get("designNo"))
    if design_no:
        suffix = ":".join(value.lower() for value in (colour, size) if value)
        return f"design:{design_no.lower()}" + (f":{suffix}" if suffix else "")
    candidates = [("variant", row.get("variant_id")), ("product", row.get("product_id")), ("catalogue", row.get("catalogue_item_id"))]
    if barcode_policy(row) == "VENDOR_GTIN":
        candidates.append(("gtin", row.get("vendorBarcode") or row.get("vendor_barcode")))
    candidates.extend([("sku", row.get("sku") or row.get("vendorSku") or row.get("vendor_sku")), ("barcode", row.get("barcode") or row.get("rms_barcode"))])
    for prefix, value in candidates:
        value = clean(value)
        if value:
            return f"{prefix}:{value.lower()}"
    return ""

def identity_fields(row: dict) -> dict:
    result = {
        "product_id": clean(row.get("product_id")),
        "variant_id": clean(row.get("variant_id")),
        "design_no": clean(row.get("design_no") or row.get("designNo")),
        "material_code": clean(row.get("material_code") or row.get("fabric_code")),
        "catalogue_item_id": clean(row.get("catalogue_item_id")),
        "sku": clean(row.get("sku") or row.get("vendorSku") or row.get("vendor_sku")),
        "vendor_barcode": clean(row.get("vendorBarcode") or row.get("vendor_barcode")),
        "barcode_policy": barcode_policy(row),
    }
    result["stock_identity"] = stock_identity({**row, **result})
    return result
