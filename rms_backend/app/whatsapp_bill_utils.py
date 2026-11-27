"""WhatsApp bill-link message via AiSensy -- sent to the customer right
after a Cashier POS bill is saved, same "unconfigured means skipped, not
broken" pattern sms_utils.py and email_utils.py already use. Nothing needs
to change in code once real credentials are added to the environment; it
just starts working.

WhatsApp Business API does not allow a business to send free-text to a
customer who hasn't messaged first -- only a pre-approved template message
is allowed. aisensy_campaign_name must be the exact name of an
already-approved template in the AiSensy dashboard, and its parameter
ORDER must match BILL_TEMPLATE_PARAM_ORDER below -- change one, change the
other. The template itself needs exactly two variables: the sending
store's name, and the link to view the bill, in that order, e.g.:

    "Hi! Your bill from {{1}} is ready. View it here: {{2}}"
"""
import asyncio
from typing import Optional

import requests

from .config import settings
from .db import whatsapp_bill_failures_collection

AISENSY_API_URL = "https://backend.aisensy.com/campaign/t1/api/v2"

# {{1}} = store/tenant name, {{2}} = bill link -- must match the approved
# AiSensy template's own variable order exactly.
BILL_TEMPLATE_PARAM_ORDER = ("store_name", "bill_link")


def whatsapp_bill_configured() -> bool:
    return bool(settings.aisensy_api_key and settings.aisensy_campaign_name)


def _destination_number(mobile: str) -> Optional[str]:
    """AiSensy expects the full number with country code, no "+"/spaces/
    dashes. Customer mobiles are stored as plain 10-digit Indian numbers
    (same assumption sms_utils.py already makes) -- strip anything else
    off, then prefix the configured country code once."""
    digits = "".join(ch for ch in (mobile or "") if ch.isdigit())
    code = settings.whatsapp_default_country_code
    if digits.startswith(code) and len(digits) > 10:
        return digits
    if len(digits) == 10:
        return f"{code}{digits}"
    return None


def _send_sync(destination: str, store_name: str, bill_link: str) -> bool:
    response = requests.post(
        AISENSY_API_URL,
        json={
            "apiKey": settings.aisensy_api_key,
            "campaignName": settings.aisensy_campaign_name,
            "destination": destination,
            "userName": store_name,
            "templateParams": [store_name, bill_link],
        },
        timeout=15,
    )
    return response.ok


async def send_bill_whatsapp(mobile: str, store_name: str, bill_link: str, context: str = "") -> bool:
    """One bill-link message to one customer. Never raises -- a send
    failure is logged to whatsapp_bill_failures_collection and reported
    back as False, never allowed to affect the bill save it's called
    after."""
    if not whatsapp_bill_configured():
        return False
    destination = _destination_number(mobile)
    if not destination or not bill_link:
        return False
    try:
        return await asyncio.to_thread(_send_sync, destination, store_name, bill_link)
    except Exception as exc:
        await whatsapp_bill_failures_collection.insert_one({
            "to": mobile, "context": context, "error": str(exc),
        })
        return False
