from datetime import datetime
import re

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request

from ..db import (
    product_mapping_collection, tenants_collection, product_collection,
    inventory_collection, store_stock_collection,
)
from .deps import get_hq_tenant, get_any_tenant

router = APIRouter(prefix="/api/product-mapping", tags=["Product Mapping"])


def serialize_doc(doc):
    """Recursively convert MongoDB ObjectIds to strings."""
    if isinstance(doc, list):
        return [serialize_doc(item) for item in doc]
    if isinstance(doc, dict):
        return {
            key: str(value) if isinstance(value, ObjectId) else serialize_doc(value)
            if isinstance(value, (dict, list)) else value
            for key, value in doc.items()
        }
    return doc


def exact_ci(value: str) -> dict:
    """Case-insensitive exact match without treating user text as regex."""
    return {"$regex": f"^{re.escape(value)}$", "$options": "i"}


@router.get("/single-store-suggestions")
async def get_single_store_mapping_suggestions(ctx: dict = Depends(get_any_tenant)):
    """Typeahead values for a single-store owner's own product mapping.

    This read-only endpoint intentionally does not alter the existing HQ-only
    mapping management routes used by department retailers.
    """
    tenant = await tenants_collection.find_one(
        {"tenant_id": ctx["tenant_id"]}, {"account_type": 1}
    )
    if (tenant or {}).get("account_type") != "single_store":
        raise HTTPException(status_code=403, detail="These mapping suggestions are for single-store owners only.")

    mappings = await product_mapping_collection.find(
        {"tenant_id": ctx["tenant_id"]},
        {"_id": 0, "product_type": 1, "division": 1, "section": 1, "department": 1},
    ).to_list(None)
    return {"status": "success", "data": mappings}


def _sku_part(value: str, fallback: str) -> str:
    clean = "".join(re.findall(r"[A-Za-z0-9]+", (value or "").upper()))
    return (clean[:3] or fallback).upper()


async def _sku_exists(tenant_id: str, sku: str) -> bool:
    """Check every current product/stock representation in this tenant."""
    product_match = await product_collection.find_one({
        "tenant_id": tenant_id,
        "$or": [{"sku": sku}, {"base_sku": sku}, {"variants.sku": sku}],
    }, {"_id": 1})
    if product_match:
        return True
    inventory_match = await inventory_collection.find_one(
        {"tenant_id": tenant_id, "sku": sku}, {"_id": 1}
    )
    if inventory_match:
        return True
    return bool(await store_stock_collection.find_one(
        {"tenant_id": tenant_id, "sku": sku}, {"_id": 1}
    ))


@router.post("/single-store-sku")
async def generate_single_store_sku(request: Request, ctx: dict = Depends(get_any_tenant)):
    """Generate a tenant-unique SKU for a single-store owner's stock item."""
    tenant = await tenants_collection.find_one(
        {"tenant_id": ctx["tenant_id"]}, {"account_type": 1}
    )
    if (tenant or {}).get("account_type") != "single_store":
        raise HTTPException(status_code=403, detail="SKU generation here is available only for single-store owners.")

    body = await request.json()
    product = _sku_part(body.get("description", ""), "ITEM")
    division = _sku_part(body.get("division", ""), "GEN")
    section = _sku_part(body.get("section", ""), "SEC")
    department = _sku_part(body.get("department", ""), "DEP")
    prefix = f"{division}-{section}-{department}-{product}"

    for sequence in range(1, 100000):
        sku = f"{prefix}-{sequence:04d}"
        if not await _sku_exists(ctx["tenant_id"], sku):
            return {"status": "success", "sku": sku}
    raise HTTPException(status_code=500, detail="Could not allocate a unique SKU. Please try again.")


@router.post("/")
async def add_or_update_mapping(request: Request, ctx: dict = Depends(get_hq_tenant)):
    body = await request.json()
    product_type = (body.get("product_type") or "").strip()
    division = (body.get("division") or "").strip()
    section = (body.get("section") or "").strip()
    department = (body.get("department") or "").strip()

    if not all([product_type, division, section, department]):
        raise HTTPException(status_code=400, detail="All fields are required")

    tenant_id = ctx["tenant_id"]
    tenant_filter = {
        "tenant_id": tenant_id,
        "product_type": exact_ci(product_type),
        "division": exact_ci(division),
        "section": exact_ci(section),
        "department": exact_ci(department),
    }
    existing = await product_mapping_collection.find_one(tenant_filter)

    if existing:
        await product_mapping_collection.update_one(
            {"_id": existing["_id"], "tenant_id": tenant_id},
            {"$set": {
                "product_type": product_type,
                "division": division,
                "section": section,
                "department": department,
                "updated_at": datetime.utcnow(),
            }},
        )
        return {"message": "Mapping updated successfully"}

    result = await product_mapping_collection.insert_one({
        "tenant_id": tenant_id,
        "product_type": product_type,
        "division": division,
        "section": section,
        "department": department,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    })
    return {"message": "Mapping added successfully", "id": str(result.inserted_id)}


@router.get("/")
async def get_all_mappings(ctx: dict = Depends(get_hq_tenant)):
    mappings = await product_mapping_collection.find(
        {"tenant_id": ctx["tenant_id"]}
    ).sort("created_at", -1).to_list(None)
    return serialize_doc(mappings)


@router.get("/grouped")
async def get_grouped_mappings(ctx: dict = Depends(get_hq_tenant)):
    mappings = await product_mapping_collection.find(
        {"tenant_id": ctx["tenant_id"]}
    ).to_list(None)
    grouped = {}

    for mapping in mappings:
        product_type = (mapping.get("product_type") or "").strip().title()
        division = (mapping.get("division") or "").strip().title()
        section = (mapping.get("section") or "").strip().title()
        department = (mapping.get("department") or "").strip().title()
        if not all([product_type, division, section, department]):
            continue

        departments = (
            grouped.setdefault(product_type, {})
            .setdefault(division, {})
            .setdefault(section, [])
        )
        if department not in departments:
            departments.append(department)

    return {"data": {
        product_type: {
            division: {
                section: sorted(departments)
                for section, departments in sorted(sections.items())
            }
            for division, sections in sorted(divisions.items())
        }
        for product_type, divisions in sorted(grouped.items())
    }}


@router.delete("/{mapping_id}")
async def delete_mapping(mapping_id: str, ctx: dict = Depends(get_hq_tenant)):
    try:
        oid = ObjectId(mapping_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid mapping ID")

    result = await product_mapping_collection.delete_one({
        "_id": oid,
        "tenant_id": ctx["tenant_id"],
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Mapping not found")
    return {"message": "Mapping deleted successfully"}
