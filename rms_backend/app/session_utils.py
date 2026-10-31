"""Active-session tracking — lets a logged-in admin (and Super Admin, on a
tenant's behalf) see every device currently signed into their account and
remote-log-out any one of them.

Additive on top of the existing stateless-JWT login: the token itself still
carries everything auth needs, this collection is a parallel record of
"which tokens currently exist" so they can be listed and individually
revoked. A JWT issued before this feature shipped has no "sid" claim and is
treated as always-valid (see deps.get_tenant) — nothing breaks for anyone
already logged in when this rolls out.
"""
from datetime import datetime, timedelta
from typing import Optional
from uuid import uuid4

from fastapi import Request

from .db import active_sessions_collection

_UA_OS_HINTS = [
    ("Windows", "Windows"), ("Mac OS X", "Mac"), ("Android", "Android"),
    ("iPhone", "iPhone"), ("iPad", "iPad"), ("Linux", "Linux"),
]
_UA_BROWSER_HINTS = [
    ("Edg/", "Edge"), ("OPR/", "Opera"), ("Chrome/", "Chrome"),
    ("Firefox/", "Firefox"), ("Safari/", "Safari"),
]


def describe_device(user_agent: str) -> str:
    """Turns a raw User-Agent string into something a non-technical admin
    can recognize at a glance, e.g. 'Chrome on Windows'."""
    ua = user_agent or ""
    browser = next((name for marker, name in _UA_BROWSER_HINTS if marker in ua), "Unknown browser")
    os_name = next((name for marker, name in _UA_OS_HINTS if marker in ua), "Unknown device")
    return f"{browser} on {os_name}"


async def start_session(
    request: Optional[Request],
    admin_id: str,
    tenant_id: Optional[str],
    expires_minutes: int,
) -> str:
    """Records a new login and returns the session_id to embed in the JWT
    ('sid' claim). Called once per successful login — never on every
    request, so this adds no latency to normal API calls."""
    session_id = uuid4().hex
    user_agent = request.headers.get("user-agent", "") if request else ""
    ip = (request.client.host if request and request.client else "") or ""
    now = datetime.utcnow()
    await active_sessions_collection.insert_one({
        "session_id": session_id,
        "admin_id": str(admin_id),
        "tenant_id": tenant_id,
        "device": describe_device(user_agent),
        "ip": ip,
        "login_at": now,
        "last_seen_at": now,
        "expires_at": now + timedelta(minutes=expires_minutes),
    })
    return session_id


async def touch_session(session_id: str) -> None:
    """Bumps last_seen_at so the sessions list shows real recent activity
    instead of only the original login time. Best-effort — a missed touch
    (e.g. session already revoked/expired) is not an error."""
    if not session_id:
        return
    await active_sessions_collection.update_one(
        {"session_id": session_id},
        {"$set": {"last_seen_at": datetime.utcnow()}},
    )


async def session_is_active(session_id: str) -> bool:
    if not session_id:
        return True  # pre-rollout tokens carry no sid — fail open, see module docstring
    doc = await active_sessions_collection.find_one({"session_id": session_id}, {"_id": 1})
    return doc is not None
