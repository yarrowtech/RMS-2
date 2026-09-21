"""Collision-safe Tech Pack numbers.

The original scheme was "TP-<yymmdd>-<count of this tenant's packs + 1>", which
repeats a number once a Draft pack has been deleted (the count drops, the next
pack reuses a number that is still on a later pack). This keeps the exact same
format and starting point, and simply steps forward until the number is free,
so a tenant with no collision gets precisely the number it always would have.
"""
from datetime import datetime

from .db import tech_packs_collection


async def next_tech_pack_no(tenant_id: str, now: datetime) -> str:
    sequence = await tech_packs_collection.count_documents({"tenant_id": tenant_id}) + 1
    while True:
        candidate = f"TP-{now.strftime('%y%m%d')}-{sequence:04d}"
        if not await tech_packs_collection.find_one({"tenant_id": tenant_id, "tech_pack_no": candidate}, {"_id": 1}):
            return candidate
        sequence += 1
