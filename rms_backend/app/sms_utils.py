"""SMS sending via Fast2SMS's DLT route — the fallback channel for
customers who have no email on file (Lucky Draw countdown reminders,
winner announcements, etc).

Unconfigured means skipped, not broken: every function here returns False
and logs nothing destructive when FAST2SMS_API_KEY/FAST2SMS_SENDER_ID
aren't both set — the same "not configured yet" pattern email_utils.py
and whatsapp_routes.py already use. Nothing needs to change in code once
real credentials are added to the environment; it just starts working.

India-specific note, important: this uses Fast2SMS's `dlt_manual` route,
NOT their `q` ("Quick SMS") route. Quick SMS is unregistered/non-DLT and
is ONLY legal for OTP/transactional messages — using it to send a
promotional message (a lucky draw winner announcement, a marketing
reminder) violates TRAI regulations and risks the sender number/account
being blocked. `dlt_manual` requires:
  1. A DLT-registered Principal Entity (your business) on one of the
     telecom DLT portals — Fast2SMS's own dashboard walks you through
     this registration, you don't deal with the raw DLT portal directly.
  2. A DLT-registered Sender ID (FAST2SMS_SENDER_ID, 6 letters, e.g.
     "RAPHAA") — shows as the sender name on the customer's phone.
  3. A DLT-registered message TEMPLATE whose content matches what you
     actually send, variable-for-variable. Fast2SMS checks the outgoing
     text against your registered templates and rejects anything that
     doesn't match one — so whoever registers the template needs to use
     the exact wording this app generates (see
     lucky_draw_routes._winner_announcement_text /
     _sms_countdown_body), with the dynamic parts (winner names, campaign
     name, date) as the template's variable placeholders.
"""
import asyncio
from typing import Optional

import requests

from .config import settings
from .db import sms_failures_collection

FAST2SMS_API_URL = "https://www.fast2sms.com/dev/bulkV2"


def sms_configured() -> bool:
    return bool(settings.fast2sms_api_key and settings.fast2sms_sender_id)


def _send_sync(to_number: str, body: str) -> bool:
    response = requests.post(
        FAST2SMS_API_URL,
        headers={"authorization": settings.fast2sms_api_key},
        data={
            "route": "dlt_manual",
            "sender_id": settings.fast2sms_sender_id,
            "message": body,
            "numbers": to_number,
            "flash": "0",
        },
        timeout=15,
    )
    if not response.ok:
        return False
    try:
        return bool(response.json().get("return"))
    except Exception:
        return False


async def send_sms(to_number: str, body: str, context: str = "") -> bool:
    """One SMS to one recipient. Never raises — a send failure is logged to
    sms_failures_collection and reported back as False, the same way a bulk
    reminder send already tolerates individual email failures without
    aborting the whole batch."""
    if not sms_configured():
        return False
    # Fast2SMS expects a bare 10-digit Indian number, no "+91"/"91" prefix
    # and no spaces/dashes — strip anything else off, including a leading
    # country code, so numbers saved in any of those shapes still work.
    digits = "".join(ch for ch in (to_number or "") if ch.isdigit())
    if len(digits) > 10 and digits.startswith("91"):
        digits = digits[-10:]
    if len(digits) != 10:
        return False
    try:
        return await asyncio.to_thread(_send_sync, digits, body)
    except Exception as exc:
        await sms_failures_collection.insert_one({
            "to": to_number, "context": context, "error": str(exc),
        })
        return False
