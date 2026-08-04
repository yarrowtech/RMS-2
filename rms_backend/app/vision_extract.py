"""
Visiting-card field extraction via a vision-capable LLM — one API call reads
the card image and returns structured fields directly, instead of chaining
a separate OCR step plus a custom-trained NER model. No training data
needed; this is inference-only, consistent with how forecast_analytics_
routes.py prefers a transparent, low-engineering-effort method over a
trained model where one isn't yet justified.

Requires ANTHROPIC_API_KEY in the environment. Without it, extraction
silently returns an all-empty result — the "Add Vendor" flow always falls
back cleanly to manual typing, a scan failure must never block adding a
vendor.
"""
import base64
import json
from typing import Any, Dict, List, Tuple
from urllib import error as urlerror, request as urlrequest

from .config import settings

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_MODEL = "claude-haiku-4-5-20251001"  # cheap + fast — reading a business card doesn't need a larger model
MAX_CARD_IMAGES = 2  # front + back of the same card — no legitimate case needs more

FIELDS = ["company_name", "brand_names", "contact_name", "mobile", "email", "address", "product_category"]

EXTRACTION_PROMPT_SINGLE = (
    "You are reading a photographed business/visiting card for a retail vendor-onboarding form. "
    "Extract these fields as a single JSON object with EXACTLY these keys: "
    "company_name (string), brand_names (array of strings — if the card lists multiple brand/product lines, "
    "split them into separate items; if only one is distinguishable from company_name, a single-item array; "
    "otherwise an empty array), contact_name (string — the person's name), "
    "mobile (string — digits only, no punctuation, keep any printed country code), "
    "email (string), address (string — full postal address if present), "
    "product_category (string — a short guess at what the business sells, e.g. 'Apparel', 'Electronics', "
    "based on any tagline, logo text, or product names on the card). "
    "If a field isn't present or legible on the card, use an empty string (or empty array for brand_names) — "
    "never guess or invent a value that isn't actually on the card. "
    "Return ONLY the JSON object, no markdown fence, no other text."
)

EXTRACTION_PROMPT_MULTI = (
    "You are shown two photographs of the SAME physical business/visiting card — its front and back "
    "(order not guaranteed). Combine information from BOTH images into one set of fields — for example, if "
    "the company name is on the front and a second phone number or address is only printed on the back, use "
    "details from both sides rather than just the first image. "
    "Extract these fields as a single JSON object with EXACTLY these keys: "
    "company_name (string), brand_names (array of strings — if the card lists multiple brand/product lines "
    "across either side, split them into separate items; if only one is distinguishable from company_name, "
    "a single-item array; otherwise an empty array), contact_name (string — the person's name), "
    "mobile (string — digits only, no punctuation, keep any printed country code; if more than one number is "
    "printed across both sides, use the one that looks like the primary/mobile contact), "
    "email (string), address (string — full postal address if present, from either side), "
    "product_category (string — a short guess at what the business sells, e.g. 'Apparel', 'Electronics', "
    "based on any tagline, logo text, or product names visible on either side). "
    "If a field isn't present or legible on either image, use an empty string (or empty array for brand_names) — "
    "never guess or invent a value that isn't actually on the card. "
    "Return ONLY the JSON object, no markdown fence, no other text."
)

_EMPTY_RESULT: Dict[str, Any] = {
    "company_name": "", "brand_names": [], "contact_name": "",
    "mobile": "", "email": "", "address": "", "product_category": "",
}


async def extract_visiting_card(images: List[Tuple[bytes, str]]) -> Dict[str, Any]:
    """images: 1-2 (image_bytes, media_type) pairs — a single card photo, or
    its front and back. Best-effort — returns an all-empty result on any
    failure (missing key, network error, malformed response) rather than
    raising."""
    if not settings.anthropic_api_key or not images:
        return dict(_EMPTY_RESULT)

    images = images[:MAX_CARD_IMAGES]
    image_blocks = [
        {"type": "image", "source": {
            "type": "base64", "media_type": media_type,
            "data": base64.b64encode(image_bytes).decode("ascii"),
        }}
        for image_bytes, media_type in images
    ]
    prompt = EXTRACTION_PROMPT_MULTI if len(images) > 1 else EXTRACTION_PROMPT_SINGLE

    payload = {
        "model": ANTHROPIC_MODEL,
        "max_tokens": 1024,
        "messages": [{
            "role": "user",
            "content": [*image_blocks, {"type": "text", "text": prompt}],
        }],
    }
    req = urlrequest.Request(
        ANTHROPIC_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "content-type": "application/json",
            "x-api-key": settings.anthropic_api_key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )

    try:
        with urlrequest.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        text = body["content"][0]["text"].strip()
        if text.startswith("```"):
            text = text.strip("`")
            if text.lower().startswith("json"):
                text = text[4:]
        extracted = json.loads(text)
    except (urlerror.URLError, KeyError, ValueError, TypeError, json.JSONDecodeError):
        return dict(_EMPTY_RESULT)

    result = dict(_EMPTY_RESULT)
    for key in FIELDS:
        if key in extracted:
            result[key] = extracted[key]
    return result
