"""Backfill design_no/style_key onto products created before the walk-in/GRN
vendor-blind style-matching fix (app/product_identity.py:derive_style_key,
app/routes/grn_routes.py:_style_group_design_no).

Only ever fills a BLANK design_no — a product that already has a real one
(set by Add Product, Split, or a previous run of this script) is never
touched. Products sharing a style_key inherit one existing design_no if any
product in that group already has one; otherwise the group mints
design_no = style_key. This is additive/$set-only, same as
migrate_tenant_scope.py / migrate_tech_pack_numbers.py.

  python migrate_style_keys.py                    audit only, nothing changes
  python migrate_style_keys.py --tenant citimart   audit one tenant
  python migrate_style_keys.py --apply             backfill (after reviewing the audit)
"""
import asyncio
import sys

from app.db import product_collection
from app.product_identity import derive_style_key

APPLY = "--apply" in sys.argv
TENANT = sys.argv[sys.argv.index("--tenant") + 1] if "--tenant" in sys.argv else None


async def main():
    print("APPLY MODE" if APPLY else "AUDIT MODE - no records will change")
    query = {"design_no": {"$in": ["", None]}}
    if TENANT:
        query["tenant_id"] = TENANT

    # (tenant_id, style_key) -> list of product docs with no design_no yet
    groups: dict = {}
    skipped_no_name = 0
    async for p in product_collection.find(query, {"_id": 1, "tenant_id": 1, "product_name": 1, "barcode": 1, "style_key": 1}):
        style_key = derive_style_key(p.get("product_name") or "")
        if not style_key:
            skipped_no_name += 1
            continue
        key = (p.get("tenant_id"), style_key)
        groups.setdefault(key, []).append(p)

    print(f"Found {len(groups)} style group(s) to backfill, {skipped_no_name} product(s) skipped (no usable name).")

    total_updated = 0
    for (tenant_id, style_key), members in sorted(groups.items(), key=lambda kv: -len(kv[1])):
        # A sibling outside this blank-design_no query might already carry a
        # real design_no for this exact style_key — inherit it instead of
        # minting a new one, so curated design numbers aren't orphaned.
        existing = await product_collection.find_one(
            {"tenant_id": tenant_id, "style_key": style_key, "design_no": {"$nin": ["", None]}},
            {"design_no": 1},
        )
        design_no = (existing or {}).get("design_no") or style_key

        label = f"[{len(members)} item(s)]" if len(members) > 1 else "[single]"
        print(f"  tenant={tenant_id} style_key='{style_key}' {label} -> design_no='{design_no}'")
        for m in members:
            print(f"      - {m.get('product_name')} (barcode={m.get('barcode')})")

        if APPLY:
            ids = [m["_id"] for m in members]
            result = await product_collection.update_many(
                {"_id": {"$in": ids}},
                {"$set": {"design_no": design_no, "style_key": style_key}},
            )
            total_updated += result.modified_count

    if APPLY:
        print(f"\nUpdated {total_updated} product(s).")
    else:
        print("\nAudit only — re-run with --apply to write these changes.")


if __name__ == "__main__":
    asyncio.run(main())
