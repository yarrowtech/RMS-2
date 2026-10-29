from datetime import datetime, timedelta
from typing import List


def _as_datetime(value):
    if isinstance(value, datetime):
        return value
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return None


def _period_metrics(sales: List[dict], barcode: str, store_id: str, start: datetime, end: datetime, margin_pct: float) -> dict:
    units = revenue = 0.0
    bills = set()
    for sale in sales:
        sold_at = _as_datetime(sale.get("created_at") or sale.get("date"))
        if not sold_at or sold_at < start or sold_at > end or str(sale.get("store_id") or "") != store_id:
            continue
        sign = -1 if sale.get("type") == "return" else 1
        for item in sale.get("items") or []:
            if str(item.get("barcode") or "").strip() != barcode:
                continue
            qty = float(item.get("qty") or 0) * sign
            line_revenue = float(item.get("total") or (float(item.get("price") or 0) * abs(qty))) * sign
            units += qty
            revenue += line_revenue
            bills.add(str(sale.get("invoice_no") or sale.get("_id") or ""))
    return {"units": round(units, 2), "revenue": round(revenue, 2), "margin": round(revenue * margin_pct / 100, 2), "bills": len(bills)}


def calculate_placement_analytics(placements: List[dict], sales: List[dict], default_start: str, default_end: str, today: datetime) -> dict:
    grouped = {}
    rows = []
    for placement in placements:
        start_text = placement.get("start_date") or default_start
        end_text = placement.get("end_date") or default_end or today.date().isoformat()
        start = _as_datetime(start_text)
        end = _as_datetime(end_text)
        if not start or not end:
            continue
        end = end.replace(hour=23, minute=59, second=59)
        duration = max((end.date() - start.date()).days + 1, 1)
        before_end = start - timedelta(seconds=1)
        before_start = start - timedelta(days=duration)
        barcode, store_id = str(placement.get("barcode") or "").strip(), str(placement.get("store_id") or "")
        key = (barcode, store_id, start.date().isoformat(), end.date().isoformat())
        margin_pct = float(placement.get("margin_pct") or 0)
        if key not in grouped:
            before = _period_metrics(sales, barcode, store_id, before_start, before_end, margin_pct)
            during = _period_metrics(sales, barcode, store_id, start, end, margin_pct)
            revenue_uplift = None if before["revenue"] == 0 else round(((during["revenue"] - before["revenue"]) / abs(before["revenue"])) * 100, 1)
            units_uplift = None if before["units"] == 0 else round(((during["units"] - before["units"]) / abs(before["units"])) * 100, 1)
            grouped[key] = {"before": before, "during": during, "revenue_uplift_pct": revenue_uplift, "units_uplift_pct": units_uplift, "placement_count": 0}
        grouped[key]["placement_count"] += 1
        rows.append({"placement": placement, "key": key, "start_date": start.date().isoformat(), "end_date": end.date().isoformat()})

    output = []
    for row in rows:
        metrics = grouped[row["key"]]
        placement = row["placement"]
        ambiguous = metrics["placement_count"] > 1
        uplift = metrics["revenue_uplift_pct"]
        if ambiguous: recommendation = "Separate this SKU's rack attribution before comparing positions."
        elif placement.get("current_stock", 0) <= 0: recommendation = "Replenish: the store is currently out of stock."
        elif uplift is not None and uplift >= 10: recommendation = "Retain this placement; revenue improved materially."
        elif uplift is not None and uplift <= -10: recommendation = "Review or relocate this placement; revenue declined."
        else: recommendation = "Monitor longer or test a higher-visibility position."
        output.append({
            "placement_id": str(placement.get("id") or placement.get("_id") or ""), "product_name": placement.get("product_name", ""),
            "barcode": placement.get("barcode", ""), "sku": placement.get("sku", ""), "store_id": placement.get("store_id", ""),
            "floor": placement.get("floor", ""), "zone": placement.get("zone", ""), "rack": placement.get("rack", ""), "segment": placement.get("segment", ""), "shelf": placement.get("shelf", ""),
            "start_date": row["start_date"], "end_date": row["end_date"], "before": metrics["before"], "during": metrics["during"],
            "revenue_uplift_pct": metrics["revenue_uplift_pct"], "units_uplift_pct": metrics["units_uplift_pct"],
            "ambiguous_attribution": ambiguous, "current_stock": placement.get("current_stock", 0), "stockout_signal": placement.get("current_stock", 0) <= 0,
            "recommendation": recommendation,
        })
    unique = list(grouped.values())
    summary = {"placements": len(output), "attributable_skus": len(unique), "ambiguous_placements": sum(1 for row in output if row["ambiguous_attribution"]), "before_revenue": round(sum(item["before"]["revenue"] for item in unique), 2), "during_revenue": round(sum(item["during"]["revenue"] for item in unique), 2), "during_margin": round(sum(item["during"]["margin"] for item in unique), 2), "during_units": round(sum(item["during"]["units"] for item in unique), 2), "stockouts": sum(1 for row in output if row["stockout_signal"])}
    summary["revenue_uplift_pct"] = None if summary["before_revenue"] == 0 else round(((summary["during_revenue"] - summary["before_revenue"]) / abs(summary["before_revenue"])) * 100, 1)
    output.sort(key=lambda item: item["during"]["revenue"], reverse=True)
    return {"summary": summary, "rows": output}


def calculate_optimization_recommendations(analytics_rows: List[dict], placement_details: dict, audit_scores: dict) -> dict:
    recommendations = []
    for row in analytics_rows:
        placement_id = row.get("placement_id", "")
        placement = placement_details.get(placement_id, {})
        uplift = row.get("revenue_uplift_pct")
        margin = float((row.get("during") or {}).get("margin") or 0)
        stock = float(row.get("current_stock") or 0)
        display_qty = max(int(placement.get("display_quantity") or 1), 1)
        audit = audit_scores.get(placement_id)
        evidence, blockers = [], []
        if uplift is not None: evidence.append(f"Revenue uplift {uplift}%")
        else: blockers.append("No comparable sales baseline")
        evidence.append(f"Period margin {round(margin, 2)}")
        evidence.append(f"Current stock {round(stock, 2)}")
        if audit is not None: evidence.append(f"Compliance {round(audit, 1)}%")
        if row.get("ambiguous_attribution"): blockers.append("SKU is placed in multiple positions")
        if stock < display_qty: blockers.append("Stock is below planned display quantity")
        if audit is not None and audit < 80: blockers.append("Execution compliance is below 80%")

        if row.get("ambiguous_attribution"):
            action, priority, suggested = "VERIFY_ATTRIBUTION", "HIGH", "Use a unique SKU/position test before changing space."
        elif stock < display_qty:
            action, priority, suggested = "REPLENISH_HOLD", "URGENT", "Replenish stock before testing or expanding this placement."
        elif audit is not None and audit < 80:
            action, priority, suggested = "FIX_EXECUTION_FIRST", "HIGH", "Correct planogram execution, then measure performance again."
        elif uplift is not None and uplift >= 20 and margin > 0 and stock >= display_qty * 2:
            action, priority, suggested = "EXPAND_FACINGS", "HIGH", f"Test {max(int(placement.get('facings') or 1) + 1, 2)} facings at the current or eye-level shelf."
        elif uplift is not None and uplift >= 10:
            action, priority, suggested = "RETAIN", "MEDIUM", "Retain this position and continue monitoring margin and stock."
        elif uplift is not None and uplift <= -15:
            action, priority, suggested = "RELOCATE_OR_REDUCE", "HIGH", "Reduce one facing or test a lower-cost/value-zone position."
        else:
            action, priority, suggested = "TEST_AND_MONITOR", "LOW", "Keep space stable until a stronger sales signal is available."

        confidence = 25 if row.get("ambiguous_attribution") else 50
        if uplift is not None: confidence += 20
        if audit is not None: confidence += 15
        if stock >= display_qty: confidence += 10
        recommendations.append({
            "placement_id": placement_id, "product_name": row.get("product_name", ""), "barcode": row.get("barcode", ""),
            "store_id": row.get("store_id", ""), "floor": row.get("floor", ""), "zone": row.get("zone", ""), "rack": row.get("rack", ""), "shelf": row.get("shelf", ""),
            "current_facings": int(placement.get("facings") or 1), "display_quantity": display_qty, "action": action, "priority": priority,
            "suggestion": suggested, "confidence": min(confidence, 95), "evidence": evidence, "blockers": blockers,
            "decision": placement.get("optimization_decision", "PENDING"), "decision_notes": placement.get("optimization_decision_notes", ""),
        })
    order = {"URGENT": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    recommendations.sort(key=lambda item: (order.get(item["priority"], 9), -item["confidence"]))
    return {
        "summary": {"total": len(recommendations), "expand": sum(r["action"] == "EXPAND_FACINGS" for r in recommendations), "retain": sum(r["action"] == "RETAIN" for r in recommendations), "attention": sum(r["priority"] in {"URGENT", "HIGH"} for r in recommendations), "blocked": sum(bool(r["blockers"]) for r in recommendations)},
        "rows": recommendations,
    }


def classify_experiment_result(revenue_uplift_pct, margin_uplift_pct=None) -> str:
    if revenue_uplift_pct is None:
        return "INSUFFICIENT_DATA"
    margin_signal = revenue_uplift_pct if margin_uplift_pct is None else margin_uplift_pct
    if revenue_uplift_pct >= 10 and margin_signal >= 0:
        return "WINNER"
    if revenue_uplift_pct <= -10 or margin_signal < -10:
        return "LOSER"
    return "NEUTRAL"
