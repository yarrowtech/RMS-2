"""Citimart Store Ops — midnight auto-finalise (Asia/Kolkata).

Once a day, for each Citimart store that has a sales target for yesterday and
has not been finally submitted, records an automatic final submission so the
day is closed even if the manager forgot. Stores without a target are skipped,
matching the source system's rule that a day without a target is not finalised.
"""
import asyncio
import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from .db import (
    citimart_day_submissions_collection,
    citimart_sales_targets_collection,
)
from .routes.citimart_store_ops_routes import STORE_CODE_TO_NAME

IST = ZoneInfo("Asia/Kolkata")
TENANT_ID = "citimart"
logger = logging.getLogger(__name__)


async def finalize_day(entry_date: str) -> int:
    count = 0
    for code in STORE_CODE_TO_NAME:
        target = await citimart_sales_targets_collection.find_one(
            {"tenant_id": TENANT_ID, "store": code, "entry_date": entry_date}
        )
        if not target or target.get("sales_target") is None:
            continue
        key = {"tenant_id": TENANT_ID, "store": code, "entry_date": entry_date}
        existing = await citimart_day_submissions_collection.find_one(key)
        if existing and existing.get("submitted"):
            continue
        stamp = {"submitted": True, "submitted_at": datetime.utcnow(), "submitted_by": "auto (midnight)", "auto_finalized": True}
        if existing:
            await citimart_day_submissions_collection.update_one(key, {"$set": stamp})
        else:
            await citimart_day_submissions_collection.insert_one({**key, "remarks": "", **stamp})
        count += 1
    return count


def _seconds_until_next_ist_midnight() -> float:
    now = datetime.now(IST)
    next_midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return (next_midnight - now).total_seconds() + 60


async def run_citimart_midnight_loop() -> None:
    while True:
        await asyncio.sleep(_seconds_until_next_ist_midnight())
        try:
            yesterday = (datetime.now(IST).date() - timedelta(days=1)).isoformat()
            done = await finalize_day(yesterday)
            logger.info("Citimart midnight finalise: %s store-day(s) for %s", done, yesterday)
        except Exception:
            logger.exception("Citimart midnight finalise failed")
