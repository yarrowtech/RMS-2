"""
Shared error-log writer for system-level failures — separate from
activity_log.py, which records deliberate user actions (logins, approvals,
status changes). This is for things going WRONG: unhandled exceptions,
failed webhook processing, failed third-party API calls. Before this,
almost every `except Exception` in this codebase just did `print(...)`,
visible only in a server console someone happened to be watching at that
exact moment — not searchable, not persisted, not alerting anyone.

main.py's global exception handler is the primary writer (catches anything
unhandled across every route with zero per-route changes needed); a few
specific already-caught spots (the forecast automation cron, visiting-card
scans) call this directly too, since those exceptions are deliberately
swallowed for the caller and would otherwise vanish entirely.
"""
import traceback
from datetime import datetime
from typing import Any, Dict, Optional

from .db import error_logs_collection

SEVERITIES = {"error", "warning"}


async def log_error(
    source: str, message: str, *,
    severity: str = "error", exc: Optional[BaseException] = None,
    context: Optional[Dict[str, Any]] = None,
) -> None:
    """Best-effort — a logging failure must never raise into the caller."""
    try:
        await error_logs_collection.insert_one({
            "source": source,
            "message": message,
            "severity": severity if severity in SEVERITIES else "error",
            "traceback": "".join(traceback.format_exception(type(exc), exc, exc.__traceback__)) if exc else None,
            "context": context or {},
            "resolved": False,
            "created_at": datetime.utcnow(),
        })
    except Exception:
        pass
