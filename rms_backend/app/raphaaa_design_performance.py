"""Pure helpers for Raphaaa's Design Performance view.

Per Design No.: how it sold across financial years (Apr-Mar), whether it counts
as a good seller, and what to do about it given stitched stock and unstitched
pieces on hand. The route owns data collection; the rules live here so they can
be tested without a database. Purchase arithmetic is NOT reimplemented — the
route feeds build_purchase_math (raphaaa_purchase_plan.py) so this view can
never disagree with the Purchase Plan tab.
"""
from __future__ import annotations

import math
from datetime import datetime
from typing import Dict, List, Optional, Tuple


TECH_PACK_RELEASED = "Released to Production"


def design_key(value) -> str:
    return " ".join(str(value or "").split()).lower()


def best_tech_packs(docs) -> Dict[str, dict]:
    """{design_key: {tech_pack_no, version, status, state}} from tech pack docs.

    A released tech pack always wins over an unreleased one; among equals the
    most recently updated wins. state is "released" or "not_released".
    """
    best: Dict[str, tuple] = {}
    for doc in docs:
        key = design_key(doc.get("design_no"))
        if not key:
            continue
        released = str(doc.get("status") or "").strip() == TECH_PACK_RELEASED
        stamp = doc.get("updated_at") or doc.get("created_at")
        rank = (1 if released else 0, stamp if isinstance(stamp, datetime) else datetime.min)
        if key not in best or rank > best[key][0]:
            best[key] = (rank, {
                "tech_pack_no": str(doc.get("tech_pack_no") or "").strip(),
                "version": str(doc.get("version") or "").strip(),
                "status": str(doc.get("status") or "").strip(),
                "state": "released" if released else "not_released",
            })
    return {key: value[1] for key, value in best.items()}


def tech_pack_label(state: Optional[str]) -> str:
    return {"released": "Released", "not_released": "Not released"}.get(state or "", "Missing")


def tech_pack_hint(action: str, pack: Optional[dict]) -> str:
    """One plain sentence about what the tech pack means for this action."""
    if action in ("stitch", "stitch_and_buy"):
        if not pack:
            return "No tech pack on file - create one in Design & Pattern before sending to stitch."
        if pack["state"] != "released":
            return f"Tech pack {pack['tech_pack_no']} is {pack['status'] or 'not released'} - release it to Production before sending to stitch."
        return f"Tech pack {pack['tech_pack_no']} is released - ready to send to stitch."
    if action == "buy":
        if pack:
            return f"Use tech pack {pack['tech_pack_no']} as the spec for the vendor or maker."
        return "No tech pack on file for this design."
    return ""


def financial_year_start(value: datetime) -> int:
    return value.year if value.month >= 4 else value.year - 1


def financial_year_label(start_year: int) -> str:
    return f"{start_year}-{str(start_year + 1)[-2:]}"


def trend_of(latest: float, previous: float) -> Tuple[str, Optional[float]]:
    """Latest vs previous completed year -> (label, growth %)."""
    if previous > 0:
        growth = (latest - previous) / previous * 100
        if growth >= 10:
            return "Growing", round(growth, 1)
        if growth <= -10:
            return "Declining", round(growth, 1)
        return "Steady", round(growth, 1)
    if latest > 0:
        return "New", None
    return "-", None


def mark_good_sellers(rows: List[dict], top_pct: float, max_decline_pct: float) -> None:
    """Sets row["is_good"] and row["good_reason"] in place.

    Designs are ranked by total quantity sold WITHIN their department (a kurti
    should not have to out-sell a sweater). The top `top_pct` per department
    (at least one, when anything sold) qualify, unless the latest completed
    year fell by more than `max_decline_pct` against the year before it.
    """
    by_department: Dict[str, List[dict]] = {}
    for row in rows:
        row["is_good"] = False
        row["good_reason"] = "No sales recorded" if row["total_qty"] <= 0 else "Outside the top sellers of its department"
        if row["total_qty"] > 0:
            by_department.setdefault(row.get("department") or "", []).append(row)
    pct = min(100.0, max(1.0, float(top_pct)))
    for group in by_department.values():
        group.sort(key=lambda r: r["total_qty"], reverse=True)
        keep = max(1, math.ceil(len(group) * pct / 100))
        for position, row in enumerate(group, start=1):
            row["dept_rank"] = position
            row["dept_designs_selling"] = len(group)
            if position > keep:
                continue
            previous, latest = row.get("previous_qty", 0.0), row.get("latest_qty", 0.0)
            if previous > 0 and (latest - previous) / previous * 100 < -abs(max_decline_pct):
                row["good_reason"] = f"Top seller, but the latest year fell more than {abs(max_decline_pct):g}%"
                continue
            row["is_good"] = True
            row["good_reason"] = "Top seller in its department"


def decide_action(
    *, is_good: bool, total_qty: float, stitched_fresh: float, stitched_aged: float,
    unstitched_pcs: float, need_qty: int,
) -> dict:
    """need_qty is build_purchase_math's final_purchase_qty (already net of the
    50% fresh-stock credit). Returns action code/label/reason + stitch/buy split."""
    stitched_total = stitched_fresh + stitched_aged
    unstitched_whole = max(0, math.floor(unstitched_pcs))
    aged_note = f" {stitched_aged:g} pcs of the stitched stock are old and not counted." if stitched_aged > 0 else ""

    if total_qty <= 0:
        if stitched_total > 0 or unstitched_pcs > 0:
            return {"action": "watch", "action_label": "Watch",
                    "reason": "No sales recorded for this design yet - hold and watch before stitching or buying more.",
                    "stitch_qty": 0, "buy_qty": 0}
        return {"action": "none", "action_label": "No action", "reason": "", "stitch_qty": 0, "buy_qty": 0}

    if not is_good:
        if stitched_total > 0:
            return {"action": "clear", "action_label": "Clear out",
                    "reason": f"Slow seller with {stitched_total:g} stitched pcs left - clear it out, do not reorder.",
                    "stitch_qty": 0, "buy_qty": 0}
        if unstitched_pcs > 0:
            return {"action": "hold", "action_label": "Do not stitch",
                    "reason": f"Slow seller - do not stitch the {unstitched_pcs:g} unstitched pcs.",
                    "stitch_qty": 0, "buy_qty": 0}
        return {"action": "none", "action_label": "No action", "reason": "", "stitch_qty": 0, "buy_qty": 0}

    if need_qty <= 0:
        return {"action": "hold", "action_label": "Hold",
                "reason": "Good seller - stitched stock already covers the expected demand." + aged_note,
                "stitch_qty": 0, "buy_qty": 0}

    stitch_qty = min(need_qty, unstitched_whole)
    buy_qty = need_qty - stitch_qty
    if stitch_qty > 0 and buy_qty > 0:
        return {"action": "stitch_and_buy", "action_label": "Stitch + Buy",
                "reason": f"Good seller - stitch all {stitch_qty} unstitched pcs, and {buy_qty} more are still needed." + aged_note,
                "stitch_qty": stitch_qty, "buy_qty": buy_qty}
    if stitch_qty > 0:
        return {"action": "stitch", "action_label": "Stitch",
                "reason": f"Good seller running short - stitch {stitch_qty} of the {unstitched_pcs:g} unstitched pcs." + aged_note,
                "stitch_qty": stitch_qty, "buy_qty": 0}
    return {"action": "buy", "action_label": "Buy / Make",
            "reason": f"Good seller running short and no unstitched pieces left - buy or make {buy_qty} pcs." + aged_note,
            "stitch_qty": 0, "buy_qty": buy_qty}
