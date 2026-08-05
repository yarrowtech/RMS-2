"""
Shared audit-trail writer for the Super Admin "Activity Logs" tab.

audit_logs_collection already existed and was already being READ by
GET /superadmin/audit-logs — nothing in the app ever wrote to it, so the
tab only ever showed hardcoded frontend mock data. This is the other half:
one small helper, called from every place worth recording (logins, logouts,
approvals, status changes), writing exactly the shape that endpoint already
expects: {actor, action, type, ip, created_at}.
"""
from datetime import datetime
from typing import Optional

from .db import audit_logs_collection

ACTIVITY_TYPES = {"create", "update", "delete", "warning", "info"}


async def log_activity(
    actor: str,
    action: str,
    type: str = "info",
    ip: Optional[str] = None,
    *,
    tenant_id: Optional[str] = None,
    tenant_name: Optional[str] = None,
    actor_email: Optional[str] = None,
    actor_role: Optional[str] = None,
) -> None:
    """Best-effort — an audit-log write must never break the action it's
    recording, so failures are swallowed rather than raised."""
    try:
        await audit_logs_collection.insert_one({
            "actor": actor or "System",
            "action": action,
            "type": type if type in ACTIVITY_TYPES else "info",
            "ip": ip,
            "tenant_id": tenant_id,
            "tenant_name": tenant_name,
            "actor_email": actor_email,
            "actor_role": actor_role,
            "created_at": datetime.utcnow(),
        })
    except Exception:
        pass
