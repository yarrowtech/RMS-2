"""
internal_escalation_routes.py
==============================
RMS Communication Centre — escalation for overdue tasks/approvals. This is
the "someone should have acted by now and nobody did" gap: a leave request
sitting Pending for days, or a staff task past its due date, currently just
sits there silently until someone happens to look.

Meant to run periodically from an external scheduler (same
X-Cron-Secret-or-Super-Admin-token pattern as forecast_analytics_routes.py's
`/auto-run` — this process has no in-process cron of its own). Each item is
escalated exactly ONCE (an `escalated` flag is set on the record itself), so
running this often does not spam the same overdue item every time.

Additive only: reads staff_tasks_collection and hr_leave_requests_collection
(both pre-existing, untouched otherwise) and writes one `escalated`/
`escalated_at` field on top of them, plus a notification via the same
notify() helper every other Communication Centre trigger already uses.
"""
from fastapi import APIRouter, Header, HTTPException
from datetime import datetime, timedelta
from typing import Optional

from .internal_notification_routes import notify
from ..config import settings
from ..db import admins_collection, staff_tasks_collection, hr_leave_requests_collection

router = APIRouter(prefix="/api/internal-notifications", tags=["Internal Notifications"])

LEAVE_STALE_AFTER_DAYS = 3  # a leave request Pending this long without a decision gets escalated


async def _authorize_cron_or_superadmin(authorization: Optional[str], x_cron_secret: Optional[str]) -> None:
    """Same either/or auth as forecast_analytics_routes.py's `/auto-run` and
    subscription_routes.py's expiry-reminder cron — duplicated here (not
    imported) to avoid a circular import, since forecast_analytics_routes.py
    already imports from internal_notification_routes.py."""
    if settings.cron_secret and x_cron_secret == settings.cron_secret:
        return
    if authorization and authorization.startswith("Bearer "):
        from .auth_routes import get_current_superadmin
        try:
            await get_current_superadmin(token=authorization.split(" ", 1)[1])
            return
        except HTTPException:
            pass
    raise HTTPException(status_code=401, detail="Provide a valid X-Cron-Secret header, or a Super Admin bearer token.")


async def _escalate_overdue_tasks(tenant_id: str, today_str: str) -> int:
    count = 0
    async for task in staff_tasks_collection.find({
        "tenant_id": tenant_id, "status": {"$in": ["open", "in_progress"]},
        "due_date": {"$ne": "", "$lt": today_str}, "escalated": {"$ne": True},
    }):
        await notify(
            tenant_id, type="task_overdue",
            title=f"Task overdue: {task.get('title', '')}",
            message=f"Assigned to {task.get('assigned_to_name', 'someone')}, was due {task.get('due_date', '')} and is still {task.get('status', 'open')}.",
            target_admin_id=task.get("assigned_by"), ref_type="staff_task", ref_id=str(task["_id"]), priority="urgent",
        )
        await staff_tasks_collection.update_one({"_id": task["_id"]}, {"$set": {"escalated": True, "escalated_at": datetime.utcnow()}})
        count += 1
    return count


async def _escalate_stale_leaves(tenant_id: str, cutoff: datetime) -> int:
    count = 0
    async for leave in hr_leave_requests_collection.find({
        "tenant_id": tenant_id, "status": "Pending", "created_at": {"$lte": cutoff}, "escalated": {"$ne": True},
    }):
        await notify(
            tenant_id, type="leave_overdue",
            title=f"Leave request awaiting review for {LEAVE_STALE_AFTER_DAYS}+ days",
            message=f"{leave.get('employee_name', 'An employee')}'s {leave.get('leave_type', 'leave')} request ({leave.get('start_date', '')} to {leave.get('end_date', '')}) is still Pending.",
            department="HR", ref_type="leave", ref_id=str(leave["_id"]), priority="high",
        )
        await hr_leave_requests_collection.update_one({"_id": leave["_id"]}, {"$set": {"escalated": True, "escalated_at": datetime.utcnow()}})
        count += 1
    return count


@router.post("/escalate-overdue")
async def escalate_overdue(
    authorization: Optional[str] = Header(None),
    x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret"),
):
    await _authorize_cron_or_superadmin(authorization, x_cron_secret)

    now = datetime.utcnow()
    today_str = now.strftime("%Y-%m-%d")
    cutoff = now - timedelta(days=LEAVE_STALE_AFTER_DAYS)

    tenant_ids = await admins_collection.distinct("tenant_id", {"tenant_id": {"$ne": None}})
    results = []
    for tenant_id in tenant_ids:
        try:
            tasks_escalated = await _escalate_overdue_tasks(tenant_id, today_str)
            leaves_escalated = await _escalate_stale_leaves(tenant_id, cutoff)
            if tasks_escalated or leaves_escalated:
                results.append({"tenant_id": tenant_id, "tasks_escalated": tasks_escalated, "leaves_escalated": leaves_escalated})
        except Exception as exc:
            # One tenant's bad data must not abort escalation for every other tenant.
            results.append({"tenant_id": tenant_id, "error": str(exc)})

    return {
        "tenants_checked": len(tenant_ids), "tenants_with_escalations": len(results), "results": results,
    }
