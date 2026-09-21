"""Give duplicate Tech Pack numbers a new, unused number.

Older code issued "TP-<yymmdd>-<count + 1>", which repeats a number after a Draft
is deleted. New packs are now collision-safe (app/tech_pack_numbering.py); this
cleans up duplicates that already exist.

  python migrate_tech_pack_numbers.py                    audit only, nothing changes
  python migrate_tech_pack_numbers.py --tenant raphaaa   audit one tenant
  python migrate_tech_pack_numbers.py --apply            renumber (after reviewing the audit)

Within a group of packs sharing a number, one keeps it: the one already linked to a
job order / production batch / design project, otherwise the oldest. The others are
renumbered ONLY if nothing links to them (those records store the pack's id, but
also snapshot its number, and a renumber would leave a stale number on them). Any
other case is printed and left unchanged for a person to decide.
"""
import asyncio
import sys
from datetime import datetime

from app.db import (
    design_projects_collection,
    job_work_orders_collection,
    production_batches_collection,
    tech_packs_collection,
)

APPLY = "--apply" in sys.argv
TENANT = sys.argv[sys.argv.index("--tenant") + 1] if "--tenant" in sys.argv else None
_EPOCH = datetime.min


async def is_referenced(tenant_id: str, pack_id: str) -> bool:
    if await production_batches_collection.find_one({"tenant_id": tenant_id, "tech_pack_id": pack_id}, {"_id": 1}):
        return True
    if await job_work_orders_collection.find_one({"tenant_id": tenant_id, "design_lines.tech_pack_id": pack_id}, {"_id": 1}):
        return True
    if await design_projects_collection.find_one({"tenant_id": tenant_id, "tech_pack_id": pack_id}, {"_id": 1}):
        return True
    return False


async def free_number(tenant_id: str, stamp: datetime, taken: set) -> str:
    """Same format as the app: TP-<yymmdd of the pack>-<sequence>, stepping to a free one."""
    sequence = await tech_packs_collection.count_documents({"tenant_id": tenant_id}) + 1
    while True:
        candidate = f"TP-{stamp.strftime('%y%m%d')}-{sequence:04d}"
        if candidate not in taken and not await tech_packs_collection.find_one(
            {"tenant_id": tenant_id, "tech_pack_no": candidate}, {"_id": 1}
        ):
            return candidate
        sequence += 1


async def main():
    print("APPLY MODE" if APPLY else "AUDIT MODE - no records will change")
    query = {"tenant_id": TENANT} if TENANT else {}
    groups: dict = {}
    async for pack in tech_packs_collection.find(
        query, {"tenant_id": 1, "tech_pack_no": 1, "design_no": 1, "version": 1, "status": 1, "created_at": 1}
    ):
        number = str(pack.get("tech_pack_no") or "").strip()
        if number:
            groups.setdefault((str(pack.get("tenant_id") or ""), number), []).append(pack)

    duplicates = {key: packs for key, packs in groups.items() if len(packs) > 1}
    if not duplicates:
        print("No duplicate tech pack numbers found.")
        return

    changed = skipped = 0
    now = datetime.utcnow()
    proposed: dict = {}
    for (tenant_id, number), packs in sorted(duplicates.items()):
        packs.sort(key=lambda p: p.get("created_at") or _EPOCH)
        linked = [p for p in packs if await is_referenced(tenant_id, str(p["_id"]))]
        print(f"\nDUPLICATE {number} (tenant {tenant_id}) - {len(packs)} packs")
        for p in packs:
            print(f"   {p['_id']}  design={p.get('design_no')!r}  {p.get('version')}  {p.get('status')}  "
                  f"created={p.get('created_at')}  linked={'YES' if p in linked else 'no'}")
        if len(linked) > 1:
            print("   -> SKIPPED: more than one of these is linked to job orders / batches / projects. Decide by hand.")
            skipped += 1
            continue
        keeper = linked[0] if linked else packs[0]
        for pack in packs:
            if pack is keeper:
                continue
            if pack in linked:
                continue
            taken = proposed.setdefault(tenant_id, set())
            new_number = await free_number(tenant_id, pack.get("created_at") or now, taken)
            taken.add(new_number)
            print(f"   -> {pack['_id']} (design {pack.get('design_no')!r}): {number} => {new_number}")
            if APPLY:
                result = await tech_packs_collection.update_one(
                    {"_id": pack["_id"], "tenant_id": tenant_id, "tech_pack_no": number},
                    {"$set": {"tech_pack_no": new_number, "previous_tech_pack_no": number, "renumbered_at": now}},
                )
                changed += result.modified_count
            else:
                changed += 1
    print(f"\n{len(duplicates)} duplicate number(s): {changed} pack(s) {'renumbered' if APPLY else 'would be renumbered'}; "
          f"{skipped} group(s) skipped for manual review.")


if __name__ == "__main__":
    asyncio.run(main())
