"""SMS sending via Twilio's REST API — the fallback channel for customers
who have no email on file (Lucky Draw countdown reminders, etc).

Unconfigured means skipped, not broken: every function here returns False
and logs nothing destructive when TWILIO_ACCOUNT_SID/AUTH_TOKEN and a sender
(TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID) aren't all set — the
same "not configured yet" pattern email_utils.py and whatsapp_routes.py
already use. Nothing needs to change in code once real credentials are
added to the environment; it just starts working.

India-specific note: any promotional/transactional SMS sent to an Indian
number must come from a DLT-registered template — Twilio's Messaging
Service (TWILIO_MESSAGING_SERVICE_SID) is the simplest way to route through
that registration; a bare TWILIO_FROM_NUMBER works outside India or once
you've separately registered that number's templates with your carrier.
"""
import asyncio
from typing import Optional

import requests

from .config import settings
from .db import sms_failures_collection

TWILIO_API_BASE = "https://api.twilio.com/2010-04-01"


def sms_configured() -> bool:
    return bool(
        settings.twilio_account_sid
        and settings.twilio_auth_token
        and (settings.twilio_from_number or settings.twilio_messaging_service_sid)
    )


def _send_sync(to_number: str, body: str) -> bool:
    url = f"{TWILIO_API_BASE}/Accounts/{settings.twilio_account_sid}/Messages.json"
    data = {"To": to_number, "Body": body}
    if settings.twilio_messaging_service_sid:
        data["MessagingServiceSid"] = settings.twilio_messaging_service_sid
    else:
        data["From"] = settings.twilio_from_number
    response = requests.post(
        url, data=data,
        auth=(settings.twilio_account_sid, settings.twilio_auth_token),
        timeout=15,
    )
    return response.ok


async def send_sms(to_number: str, body: str, context: str = "") -> bool:
    """One SMS to one recipient. Never raises — a send failure is logged to
    sms_failures_collection and reported back as False, the same way a bulk
    reminder send already tolerates individual email failures without
    aborting the whole batch."""
    if not sms_configured():
        return False
    to_number = (to_number or "").strip()
    if not to_number:
        return False
    try:
        return await asyncio.to_thread(_send_sync, to_number, body)
    except Exception as exc:
        await sms_failures_collection.insert_one({
            "to": to_number, "context": context, "error": str(exc),
        })
        return False
