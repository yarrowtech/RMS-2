"""Safely backfill tenant_id on legacy products/inventory records.
Run `python migrate_tenant_scope.py` first (audit only). Add --apply only after
reviewing ambiguous IDs; ambiguous records are never modified by this script.
"""
import asyncio
import sys
from bson import ObjectId
from app.db import product_collection, inventory_collection, grn_collection, grc_collection

APPLY = "--apply" in sys.argv

async def tenant_candidates(barcode: str, document: dict) -> set:
    candidates = set()
    if document.get("tenant_id"):
        candidates.add(str(document["tenant_id"]))
    for field in ("grn_no", "last_grn_no"):
        if document.get(field):
            async for grn in grn_collection.find({"grnNo": document[field]}, {"tenant_id": 1}):
                if grn.get("tenant_id"): candidates.add(str(grn["tenant_id"]))
    if barcode:
        async for grn in grn_collection.find({"items.barcode": barcode}, {"tenant_id": 1}):
            if grn.get("tenant_id"): candidates.add(str(grn["tenant_id"]))
    if barcode:
        # Direct/walk-in GRCs are tenant-scoped even before a GRN exists.
        async for grc in grc_collection.find({"items.barcode": barcode}, {"tenant_id": 1}):
            if grc.get("tenant_id"): candidates.add(str(grc["tenant_id"]))
    return candidates

async def backfill(collection, label):
    safe = ambiguous = 0
    async for document in collection.find({"tenant_id": {"$exists": False}}):
        barcode = str(document.get("barcode") or "")
        candidates = await tenant_candidates(barcode, document)
        if len(candidates) == 1:
            safe += 1
            if APPLY:
                await collection.update_one({"_id": document["_id"], "tenant_id": {"$exists": False}}, {"$set": {"tenant_id": candidates.pop()}})
        else:
            ambiguous += 1
            print(f"AMBIGUOUS {label} {document['_id']} barcode={barcode!r} tenants={sorted(candidates)}")
    print(f"{label}: {safe} safe {'updated' if APPLY else 'to update'}; {ambiguous} ambiguous (unchanged).")

async def main():
    print("APPLY MODE" if APPLY else "AUDIT MODE — no records will change")
    await backfill(product_collection, "products")
    await backfill(inventory_collection, "inventory")

if __name__ == "__main__":
    asyncio.run(main())