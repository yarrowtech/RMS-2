from datetime import datetime
from typing import List, Optional

from fastapi import HTTPException


LOCATION_TYPES = ("floor", "department", "zone", "fixture", "segment", "shelf")
LOCATION_PARENT = {"floor": None, "department": "floor", "zone": "department", "fixture": "zone", "segment": "fixture", "shelf": "segment"}


def normalise_location_type(value: str) -> str:
    node_type = str(value or "").strip().lower()
    if node_type not in LOCATION_TYPES:
        raise HTTPException(status_code=400, detail=f"Location type must be one of: {', '.join(LOCATION_TYPES)}.")
    return node_type


def location_snapshot(nodes: List[dict]) -> dict:
    """Keep stable node IDs and readable legacy labels on each placement."""
    by_type = {n["type"]: n for n in nodes}
    fixture = by_type.get("fixture", {})
    return {
        "location_node_ids": {kind: str(node["_id"]) for kind, node in by_type.items()},
        "store_id": nodes[0].get("store_id", "") if nodes else "",
        "floor": by_type.get("floor", {}).get("name", ""),
        "department": by_type.get("department", {}).get("name", ""),
        "zone": by_type.get("zone", {}).get("name", ""),
        "rack": fixture.get("name", ""),
        "fixture": fixture.get("name", ""),
        "segment": by_type.get("segment", {}).get("name", ""),
        "shelf": by_type.get("shelf", {}).get("name", ""),
    }


def validate_placement_rules(display_quantity: int, used_capacity: int, capacity: Optional[int], purpose: str, start_date: str, end_date: str) -> str:
    if display_quantity < 1:
        raise HTTPException(status_code=400, detail="Display quantity must be at least 1.")
    if capacity is not None and used_capacity + display_quantity > capacity:
        raise HTTPException(status_code=409, detail=f"Display quantity exceeds capacity ({used_capacity} already planned, {capacity} maximum).")
    normalised_purpose = str(purpose or "regular").strip().lower()
    if normalised_purpose not in {"regular", "promotional", "clearance", "new-arrival"}:
        raise HTTPException(status_code=400, detail="Purpose must be regular, promotional, clearance or new-arrival.")
    try:
        start = datetime.fromisoformat(start_date).date() if str(start_date or "").strip() else None
        end = datetime.fromisoformat(end_date).date() if str(end_date or "").strip() else None
    except ValueError:
        raise HTTPException(status_code=400, detail="Placement dates must use YYYY-MM-DD format.")
    if start and end and end < start:
        raise HTTPException(status_code=400, detail="End date cannot be earlier than start date.")
    return normalised_purpose


LAYOUT_TRANSITIONS = {
    "DRAFT": {"submit_review": "IN_REVIEW", "archive": "ARCHIVED"},
    "IN_REVIEW": {"approve": "APPROVED", "return_draft": "DRAFT", "archive": "ARCHIVED"},
    "APPROVED": {"return_draft": "DRAFT", "schedule": "SCHEDULED", "archive": "ARCHIVED"},
    "SCHEDULED": {"return_draft": "DRAFT", "archive": "ARCHIVED"},
    "ACTIVE": {"complete": "COMPLETED", "archive": "ARCHIVED"},
    "PUBLISHED": {"complete": "COMPLETED", "archive": "ARCHIVED"},
    "COMPLETED": {"archive": "ARCHIVED"},
    "ARCHIVED": {},
}


def layout_transition(current_status: str, action: str) -> str:
    current = str(current_status or "DRAFT").strip().upper()
    requested = str(action or "").strip().lower()
    next_status = LAYOUT_TRANSITIONS.get(current, {}).get(requested)
    if not next_status:
        raise HTTPException(status_code=409, detail=f"Cannot {requested or 'change status'} while layout is {current}.")
    return next_status


def validate_campaign_dates(start_date: str, end_date: str, required: bool = False) -> None:
    start_text, end_text = str(start_date or "").strip(), str(end_date or "").strip()
    if required and not start_text:
        raise HTTPException(status_code=400, detail="A campaign start date is required.")
    try:
        start = datetime.fromisoformat(start_text).date() if start_text else None
        end = datetime.fromisoformat(end_text).date() if end_text else None
    except ValueError:
        raise HTTPException(status_code=400, detail="Campaign dates must use YYYY-MM-DD format.")
    if start and end and end < start:
        raise HTTPException(status_code=400, detail="Campaign end date cannot be earlier than its start date.")


def summarize_execution_tasks(tasks: List[dict], today: str) -> dict:
    summary = {"total": len(tasks), "pending": 0, "awaiting_review": 0, "approved": 0, "blocked": 0, "correction_required": 0, "overdue": 0, "urgent": 0}
    for task in tasks:
        task_status = task.get("status", "PENDING")
        if task_status in {"DONE", "SUBMITTED"}: summary["awaiting_review"] += 1
        elif task_status == "APPROVED": summary["approved"] += 1
        elif task_status == "BLOCKED": summary["blocked"] += 1
        elif task_status == "CORRECTION_REQUIRED": summary["correction_required"] += 1
        else: summary["pending"] += 1
        if task.get("priority") == "URGENT": summary["urgent"] += 1
        if task.get("due_date") and task["due_date"] < today and task_status != "APPROVED": summary["overdue"] += 1
    return summary


AUDIT_CRITERIA = ("correct_product", "correct_location", "facings_quantity", "orientation", "presentation")


def calculate_photo_audit(checks: dict) -> dict:
    """Return an inspectable compliance score; product/location are critical."""
    normalised = {key: bool(checks.get(key, False)) for key in AUDIT_CRITERIA}
    score = round(sum(normalised.values()) * 100 / len(AUDIT_CRITERIA))
    failed = [key for key, passed in normalised.items() if not passed]
    critical_failure = not normalised["correct_product"] or not normalised["correct_location"]
    return {"checks": normalised, "score": score, "failed_checks": failed, "passed": score >= 80 and not critical_failure}


AUDIT_CRITERIA = ("correct_product", "correct_location", "facings_quantity", "orientation", "presentation")


def calculate_photo_audit(checks: dict) -> dict:
    """Return an inspectable compliance score; product/location are critical."""
    normalised = {key: bool(checks.get(key, False)) for key in AUDIT_CRITERIA}
    score = round(sum(normalised.values()) * 100 / len(AUDIT_CRITERIA))
    failed = [key for key, passed in normalised.items() if not passed]
    critical_failure = not normalised["correct_product"] or not normalised["correct_location"]
    return {"checks": normalised, "score": score, "failed_checks": failed, "passed": score >= 80 and not critical_failure}
