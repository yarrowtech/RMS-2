


from fastapi import APIRouter, HTTPException, Query, Depends
from .deps import get_hq_tenant
from fastapi.responses import JSONResponse
from typing import Optional
from datetime import datetime, timedelta
from bson import ObjectId

from app.db import (
    purchaseorders_collection,
    grc_collection,
    grn_collection,
    vendors_collection,
    mbuyer_order_details_collection,
    sample_real_collection,

)

router = APIRouter(prefix="/mbuyer", tags=["Merchandiser Buyer"])

# ─── helpers ─────────────────────────────────────────────────────────────────

def _str(v) -> str:
    return str(v) if v else ""

def _float(v, d=0.0) -> float:
    try: return float(v or d)
    except: return d

def _int(v, d=0) -> int:
    try: return int(float(v or d))
    except: return d

def _days_ago(dt) -> int:
    """Return how many days ago a datetime was. Positive = past."""
    if not dt: return 0
    if isinstance(dt, str):
        try: dt = datetime.fromisoformat(dt.replace("Z",""))
        except: return 0
    return (datetime.utcnow() - dt).days

def _days_until(date_str: str) -> Optional[int]:
    """Return days until a date string (DD-MM-YYYY or YYYY-MM-DD). Negative = overdue."""
    if not date_str: return None
    for fmt in ("%d-%m-%Y", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            dt = datetime.strptime(date_str.strip(), fmt)
            return (dt - datetime.utcnow()).days
        except: continue
    return None

def _urgency(days: Optional[int]) -> str:
    if days is None:    return "no-date"
    if days < 0:        return "overdue"
    if days <= 2:       return "critical"
    if days <= 7:       return "due-soon"
    return "on-track"

# ═══════════════════════════════════════════════════════════════════════════════
# 1. OPEN PO TRACKER
#    Returns all active POs with due-date urgency computed server-side.
#    Active statuses: Pending, SentToVendor, WalkinAccepted, VendorSubmitted
# ═══════════════════════════════════════════════════════════════════════════════

ACTIVE_STATUSES = [
    "Pending", "SentToVendor", "WalkinAccepted",
    "VendorSubmitted", "Approved",
]

@router.get("/open-po-tracker")
async def get_open_po_tracker(
    ctx: dict = Depends(get_hq_tenant),
    urgency_filter: Optional[str] = Query(None),   
    status_filter:  Optional[str] = Query(None),
    vendor_filter:  Optional[str] = Query(None),
    search:         Optional[str] = Query(None),
):
    query: dict = {"status": {"$in": ACTIVE_STATUSES}}
    if status_filter:
        query["status"] = status_filter
    if vendor_filter:
        query["vendorName"] = {"$regex": vendor_filter, "$options": "i"}
    if search:
        s = search.strip()
        query["$or"] = [
            {"orderNo":    {"$regex": s, "$options": "i"}},
            {"vendorName": {"$regex": s, "$options": "i"}},
        ]

    pos = []
    async for po in purchaseorders_collection.find(query).sort("createdAt", -1):
        # Compute due date info
        due_date_str = po.get("dueDate") or po.get("due_date") or po.get("expectedDelivery") or ""
        days_until   = _days_until(due_date_str)
        urgency      = _urgency(days_until)

        # Skip if urgency filter applied and doesn't match
        if urgency_filter and urgency != urgency_filter:
            continue

        created_at   = po.get("createdAt")
        days_since   = _days_ago(created_at) if created_at else 0

        # Compute PO value
        items        = po.get("items", [])
        po_value     = sum(_float(it.get("rate", 0)) * _int(it.get("quantity", 0)) for it in items)
        vendor_value = sum(_float(it.get("vendorRate", it.get("rate", 0))) * _int(it.get("amendedQty", it.get("quantity", 0))) for it in items)

        # Days stuck in current status (for VendorSubmitted alert)
        updated_at   = po.get("updatedAt")
        days_in_status = _days_ago(updated_at) if updated_at else days_since

        pos.append({
            "id":            _str(po["_id"]),
            "orderNo":       po.get("orderNo", ""),
            "vendorName":    po.get("vendorName", ""),
            "status":        po.get("status", ""),
            "dueDate":       due_date_str,
            "daysUntilDue":  days_until,
            "urgency":       urgency,
            "daysSinceSent": days_since,
            "daysInStatus":  days_in_status,
            "itemCount":     len(items),
            "poValue":       round(po_value, 2),
            "vendorValue":   round(vendor_value, 2),
            "division":      po.get("division", ""),
            "department":    po.get("department", ""),
            "createdAt":     created_at.isoformat() if isinstance(created_at, datetime) else str(created_at or ""),
            "vendorType":    po.get("vendor_type", ""),
            "hasVariance":   any(
                abs(_float(it.get("variancePct", 0))) > 0
                for it in items
            ),
            "needsReview":   po.get("status") == "VendorSubmitted" and days_in_status >= 3,
        })

    # Summary counts
    summary = {
        "total":     len(pos),
        "overdue":   sum(1 for p in pos if p["urgency"] == "overdue"),
        "critical":  sum(1 for p in pos if p["urgency"] == "critical"),
        "due_soon":  sum(1 for p in pos if p["urgency"] == "due-soon"),
        "on_track":  sum(1 for p in pos if p["urgency"] == "on-track"),
        "no_date":   sum(1 for p in pos if p["urgency"] == "no-date"),
        "needs_review": sum(1 for p in pos if p["needsReview"]),
        "total_value":  round(sum(p["poValue"] for p in pos), 2),
    }

    # Sort: overdue first, then critical, then by days_until ascending
    urgency_order = {"overdue": 0, "critical": 1, "due-soon": 2, "on-track": 3, "no-date": 4}
    pos.sort(key=lambda p: (urgency_order.get(p["urgency"], 9), p["daysUntilDue"] or 9999))

    return JSONResponse({"status": "success", "summary": summary, "data": pos})


# ═══════════════════════════════════════════════════════════════════════════════
# 2. VENDOR PERFORMANCE DASHBOARD
#    Per-vendor scorecard computed from POs, GRCs and GRNs.
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/vendor-performance")
async def get_vendor_performance(
    ctx: dict = Depends(get_hq_tenant),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("total_value"),  # total_value|fulfillment|on_time|variance
):
    # ── Aggregate PO data per vendor ─────────────────────────────────────────
    vendor_map: dict = {}   # vendorName → stats

    async for po in purchaseorders_collection.find({"tenant_id": ctx["tenant_id"]}):
        name = (po.get("vendorName") or "").strip()
        if not name: continue

        if name not in vendor_map:
            vendor_map[name] = {
                "vendorName":       name,
                "vendorId":         _str(po.get("vendor_id", "")),
                "total_pos":        0,
                "completed_pos":    0,   # reached FullyReceived or StockUpdated
                "cancelled_pos":    0,
                "active_pos":       0,
                "total_ordered_qty": 0,
                "total_received_qty": 0,
                "total_po_value":   0.0,
                "total_variance_amt": 0.0,
                "variance_items":   0,
                "blocked_items":    0,
                "on_time_count":    0,   # GRN before due date
                "late_count":       0,
                "no_date_count":    0,
                "last_po_date":     "",
                "divisions":        set(),
            }

        v = vendor_map[name]
        v["total_pos"] += 1

        status = po.get("status", "")
        if status in ("FullyReceived", "StockUpdated"):
            v["completed_pos"] += 1
        elif status == "Cancelled":
            v["cancelled_pos"] += 1
        elif status in ACTIVE_STATUSES:
            v["active_pos"] += 1

        if po.get("division"): v["divisions"].add(po["division"])

        created = po.get("createdAt")
        if created:
            d = created.isoformat() if isinstance(created, datetime) else str(created)
            if d > v["last_po_date"]: v["last_po_date"] = d

        items = po.get("items", [])
        for it in items:
            qty      = _int(it.get("quantity", 0))
            amended  = _int(it.get("amendedQty", qty))
            rate     = _float(it.get("rate", 0))
            v_rate   = _float(it.get("vendorRate", rate))
            var_pct  = _float(it.get("variancePct", 0))
            var_st   = it.get("varianceStatus", "")

            v["total_ordered_qty"]  += qty
            v["total_po_value"]     += qty * rate
            v["total_variance_amt"] += abs((v_rate - rate) * amended)

            if abs(var_pct) > 0:
                v["variance_items"] += 1
            if var_st == "blocked":
                v["blocked_items"] += 1

    # ── Aggregate GRN data for on-time delivery ───────────────────────────────
    async for grn in grn_collection.find({"tenant_id": ctx["tenant_id"]}):
        name = (grn.get("vendorName") or "").strip()
        if name not in vendor_map: continue

        v         = vendor_map[name]
        received_qty = _int(grn.get("totalQty") or grn.get("total_qty") or 0)
        v["total_received_qty"] += received_qty

        # On-time check
        due_date_str = grn.get("dueDate") or grn.get("poExpectedDate") or ""
        grn_date_str = grn.get("grnDate") or grn.get("createdAt") or ""
        if due_date_str and grn_date_str:
            days_u = _days_until.__wrapped__(due_date_str) if hasattr(_days_until, "__wrapped__") else _days_until(due_date_str)
            # Compute from grn date perspective
            for fmt in ("%d-%m-%Y", "%Y-%m-%d"):
                try:
                    grn_dt = datetime.strptime(str(grn_date_str)[:10], fmt)
                    due_dt_parsed = None
                    for dfmt in ("%d-%m-%Y", "%Y-%m-%d"):
                        try: due_dt_parsed = datetime.strptime(due_date_str.strip(), dfmt); break
                        except: continue
                    if due_dt_parsed:
                        if grn_dt <= due_dt_parsed: v["on_time_count"] += 1
                        else: v["late_count"] += 1
                    break
                except: continue
        else:
            v["no_date_count"] += 1

    # ── Build result list ─────────────────────────────────────────────────────
    result = []
    for name, v in vendor_map.items():
        if search and search.lower() not in name.lower(): continue

        total_pos       = v["total_pos"]
        ordered_qty     = v["total_ordered_qty"]
        received_qty    = v["total_received_qty"]
        fulfillment_pct = round((received_qty / ordered_qty * 100), 1) if ordered_qty > 0 else 0

        deliveries      = v["on_time_count"] + v["late_count"]
        on_time_pct     = round((v["on_time_count"] / deliveries * 100), 1) if deliveries > 0 else None

        variance_rate   = round((v["variance_items"] / max(ordered_qty, 1)) * 100, 1)

        # Score 0–100: fulfilment 40% + on-time 40% + no-variance 20%
        score_fulfil  = min(fulfillment_pct, 100) * 0.40
        score_ontime  = min(on_time_pct or 0, 100) * 0.40
        score_variance= max(0, 100 - variance_rate) * 0.20
        overall_score = round(score_fulfil + score_ontime + score_variance, 1)

        if overall_score >= 80: rating = "Excellent"
        elif overall_score >= 60: rating = "Good"
        elif overall_score >= 40: rating = "Average"
        else: rating = "Poor"

        result.append({
            "vendorName":       name,
            "vendorId":         v["vendorId"],
            "total_pos":        total_pos,
            "completed_pos":    v["completed_pos"],
            "active_pos":       v["active_pos"],
            "cancelled_pos":    v["cancelled_pos"],
            "total_ordered_qty": ordered_qty,
            "total_received_qty": received_qty,
            "fulfillment_pct":  fulfillment_pct,
            "on_time_pct":      on_time_pct,
            "on_time_count":    v["on_time_count"],
            "late_count":       v["late_count"],
            "total_po_value":   round(v["total_po_value"], 2),
            "total_variance_amt": round(v["total_variance_amt"], 2),
            "variance_items":   v["variance_items"],
            "blocked_items":    v["blocked_items"],
            "variance_rate":    variance_rate,
            "overall_score":    overall_score,
            "rating":           rating,
            "last_po_date":     v["last_po_date"],
            "divisions":        sorted(v["divisions"]),
        })

    # Sort
    sort_map = {
        "total_value":  lambda x: -x["total_po_value"],
        "fulfillment":  lambda x: -x["fulfillment_pct"],
        "on_time":      lambda x: -(x["on_time_pct"] or 0),
        "variance":     lambda x: x["variance_items"],
        "score":        lambda x: -x["overall_score"],
    }
    result.sort(key=sort_map.get(sort_by, sort_map["total_value"]))

    summary = {
        "total_vendors":   len(result),
        "excellent":       sum(1 for r in result if r["rating"] == "Excellent"),
        "good":            sum(1 for r in result if r["rating"] == "Good"),
        "average":         sum(1 for r in result if r["rating"] == "Average"),
        "poor":            sum(1 for r in result if r["rating"] == "Poor"),
        "total_po_value":  round(sum(r["total_po_value"] for r in result), 2),
        "avg_fulfillment": round(sum(r["fulfillment_pct"] for r in result) / max(len(result), 1), 1),
    }

    return JSONResponse({"status": "success", "summary": summary, "data": result})


# ═══════════════════════════════════════════════════════════════════════════════
# 3. VARIANCE & PRICE OVERRIDE LOG
#    All PO items where vendor rate ≠ buyer rate, grouped by variance status.
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/variance-log")
async def get_variance_log(
    ctx: dict = Depends(get_hq_tenant),
    status_filter: Optional[str] = Query(None),  # blocked|flagged|auto_accepted|walkin_matched
    vendor_filter: Optional[str] = Query(None),
    search:        Optional[str] = Query(None),
):
    entries = []

    po_query: dict = {}
    if vendor_filter:
        po_query["vendorName"] = {"$regex": vendor_filter, "$options": "i"}

    async for po in purchaseorders_collection.find({**po_query, "tenant_id": ctx["tenant_id"]}):
        items = po.get("items", [])
        for it in items:
            var_st  = it.get("varianceStatus", "")
            var_pct = _float(it.get("variancePct", 0))
            var_amt = _float(it.get("varianceAmt", 0))

            # Only include items that had any variance processing
            if not var_st or var_st == "": continue
            if abs(var_pct) == 0 and abs(var_amt) == 0: continue

            if status_filter and var_st != status_filter: continue

            desc    = it.get("description") or it.get("product_name") or ""
            barcode = it.get("barcode", "")

            if search:
                s = search.lower()
                if s not in desc.lower() and s not in barcode.lower() and s not in (po.get("vendorName","")).lower() and s not in (po.get("orderNo","")).lower():
                    continue

            buyer_rate  = _float(it.get("buyerRate", it.get("rate", 0)))
            vendor_rate = _float(it.get("vendorRate", buyer_rate))
            amended_qty = _int(it.get("amendedQty", it.get("quantity", 0)))
            impact_amt  = abs((vendor_rate - buyer_rate) * amended_qty)

            entries.append({
                "poId":          _str(po["_id"]),
                "orderNo":       po.get("orderNo", ""),
                "vendorName":    po.get("vendorName", ""),
                "poStatus":      po.get("status", ""),
                "barcode":       barcode,
                "description":   desc,
                "buyerRate":     buyer_rate,
                "vendorRate":    vendor_rate,
                "variancePct":   round(var_pct, 2),
                "varianceAmt":   round(var_amt, 2),
                "impactAmt":     round(impact_amt, 2),
                "amendedQty":    amended_qty,
                "varianceStatus": var_st,
                "overrideApplied": bool(po.get("variance_override")),
                "createdAt":     po["createdAt"].isoformat() if isinstance(po.get("createdAt"), datetime) else str(po.get("createdAt", "")),
            })

    # Sort: blocked first, then flagged, then by impact descending
    status_order = {"blocked": 0, "flagged": 1, "auto_accepted": 2, "walkin_matched": 3}
    entries.sort(key=lambda e: (status_order.get(e["varianceStatus"], 9), -e["impactAmt"]))

    summary = {
        "total_entries":    len(entries),
        "blocked":          sum(1 for e in entries if e["varianceStatus"] == "blocked"),
        "flagged":          sum(1 for e in entries if e["varianceStatus"] == "flagged"),
        "auto_accepted":    sum(1 for e in entries if e["varianceStatus"] == "auto_accepted"),
        "walkin_matched":   sum(1 for e in entries if e["varianceStatus"] == "walkin_matched"),
        "total_impact_amt": round(sum(e["impactAmt"] for e in entries), 2),
        "overrides_applied":sum(1 for e in entries if e["overrideApplied"]),
    }

    return JSONResponse({"status": "success", "summary": summary, "data": entries})


# ═══════════════════════════════════════════════════════════════════════════════
# 4. BUDGET & OTB (OPEN TO BUY)
#    budgets_collection stores season budgets per division/department.
#    OTB = Budget - committed PO value (active PO statuses).
#
#    db.py — add:  budgets_collection = db["budgets"]
# ═══════════════════════════════════════════════════════════════════════════════

from app.db import budgets_collection

COMMITTED_STATUSES = [
    "Pending", "SentToVendor", "WalkinAccepted",
    "VendorSubmitted", "Approved",
]

@router.get("/budgets")
async def get_budgets(ctx: dict = Depends(get_hq_tenant)):
    """
    Returns all budgets with live OTB computed from active POs.
    Groups by division → department for the breakdown table.
    """
    budgets = []
    async for b in budgets_collection.find({"tenant_id": ctx["tenant_id"]}).sort("createdAt", -1):
        budgets.append({
            "id":          _str(b["_id"]),
            "season":      b.get("season", ""),
            "division":    b.get("division", ""),
            "department":  b.get("department", ""),
            "totalBudget": _float(b.get("totalBudget", 0)),
            "notes":       b.get("notes", ""),
            "createdAt":   b.get("createdAt","").isoformat() if isinstance(b.get("createdAt"), datetime) else str(b.get("createdAt","")),
        })

    # ── Compute committed spend from active POs ───────────────────────────────
    # Build a map: (division, department) → committed value
    committed_map: dict = {}
    async for po in purchaseorders_collection.find({"status": {"$in": COMMITTED_STATUSES}}):
        div  = (po.get("division") or "Uncategorized").strip()
        dept = (po.get("department") or "—").strip()
        key  = (div, dept)
        items = po.get("items", [])
        val   = sum(_float(it.get("rate",0)) * _int(it.get("quantity",0)) for it in items)
        committed_map[key] = committed_map.get(key, 0.0) + val

    # Attach committed + OTB to each budget row
    total_budget_all    = 0.0
    total_committed_all = 0.0

    for b in budgets:
        key       = (b["division"], b["department"])
        committed = committed_map.get(key, 0.0)
        otb       = b["totalBudget"] - committed
        utilisation = round((committed / b["totalBudget"] * 100), 1) if b["totalBudget"] > 0 else 0.0

        b["committed"]    = round(committed, 2)
        b["otb"]          = round(otb, 2)
        b["utilisation"]  = utilisation
        b["status"]       = "over-budget" if otb < 0 else "warning" if utilisation >= 80 else "healthy"

        total_budget_all    += b["totalBudget"]
        total_committed_all += committed

    total_otb = total_budget_all - total_committed_all

    # Also return divisions that have committed PO spend but no budget set yet
    all_div_dept_in_pos = set(committed_map.keys())
    budgeted_keys       = {(b["division"], b["department"]) for b in budgets}
    unbudgeted          = []
    for (div, dept), val in committed_map.items():
        if (div, dept) not in budgeted_keys and val > 0:
            unbudgeted.append({
                "division": div, "department": dept,
                "committed": round(val, 2), "totalBudget": 0,
                "otb": -round(val, 2), "utilisation": 100,
                "status": "no-budget", "season": "—", "id": None,
            })

    summary = {
        "total_budget":    round(total_budget_all, 2),
        "total_committed": round(total_committed_all, 2),
        "total_otb":       round(total_otb, 2),
        "utilisation":     round((total_committed_all / total_budget_all * 100), 1) if total_budget_all > 0 else 0,
        "over_budget_count": sum(1 for b in budgets if b["status"] == "over-budget"),
        "warning_count":     sum(1 for b in budgets if b["status"] == "warning"),
    }

    return JSONResponse({
        "status": "success",
        "summary": summary,
        "data": budgets + unbudgeted,
    })


@router.post("/budgets")
async def create_budget(payload: dict, ctx: dict = Depends(get_hq_tenant)):
    """Create a new budget entry for a division/department/season."""
    season     = (payload.get("season") or "").strip()
    division   = (payload.get("division") or "").strip()
    department = (payload.get("department") or "").strip()
    total      = _float(payload.get("totalBudget", 0))

    if not season or not division:
        raise HTTPException(status_code=400, detail="season and division are required.")
    if total <= 0:
        raise HTTPException(status_code=400, detail="totalBudget must be > 0.")

    # Prevent duplicate (season + division + department)
    existing = await budgets_collection.find_one({
        "season": season, "division": division, "department": department
    })
    if existing:
        raise HTTPException(status_code=400, detail="Budget already exists for this season/division/department. Use edit instead.")

    doc = {
        "season":      season,
        "division":    division,
        "department":  department,
        "totalBudget": total,
        "notes":       payload.get("notes", ""),
        "createdAt":   datetime.utcnow(),
        "updatedAt":   datetime.utcnow(),
    }
    doc["tenant_id"] = ctx["tenant_id"]
    result = await budgets_collection.insert_one(doc)
    return JSONResponse({"status": "success", "message": "Budget created.", "id": str(result.inserted_id)}, status_code=201)


@router.put("/budgets/{budget_id}")
async def update_budget(budget_id: str, payload: dict):
    """Update a budget entry."""
    try: oid = ObjectId(budget_id)
    except: raise HTTPException(status_code=400, detail="Invalid budget ID")

    patch: dict = {"updatedAt": datetime.utcnow()}
    if "totalBudget" in payload: patch["totalBudget"] = _float(payload["totalBudget"])
    if "notes"       in payload: patch["notes"]       = payload["notes"]
    if "season"      in payload: patch["season"]      = payload["season"]

    await budgets_collection.update_one({"_id": oid}, {"$set": patch})
    return JSONResponse({"status": "success", "message": "Budget updated."})


@router.delete("/budgets/{budget_id}")
async def delete_budget(budget_id: str):
    """Delete a budget entry."""
    try: oid = ObjectId(budget_id)
    except: raise HTTPException(status_code=400, detail="Invalid budget ID")
    await budgets_collection.delete_one({"_id": oid})
    return JSONResponse({"status": "success", "message": "Budget deleted."})


# ═══════════════════════════════════════════════════════════════════════════════
# 5. DELIVERY & LEAD TIME TRACKING
#    Reads POs + GRNs — no new collection.
#    Follow-up notes stored on the PO document itself.
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/delivery-tracking")
async def get_delivery_tracking(
    ctx: dict = Depends(get_hq_tenant),
    vendor_filter: Optional[str] = Query(None),
    search:        Optional[str] = Query(None),
    delay_only:    bool          = Query(False),
):
    """
    Per-vendor delivery performance:
    - Average lead time: PO createdAt → GRN date
    - On-time / delayed count
    - List of delayed POs with expected vs actual dates
    - Follow-up notes stored in po.followup_notes
    """
    # ── Build GRN lookup: poNo → grn info ────────────────────────────────────
    grn_map: dict = {}   # orderNo → {grnDate, receivedQty, grnId}
    async for grn in grn_collection.find({"tenant_id": ctx["tenant_id"]}):
        po_no   = grn.get("poNo") or grn.get("orderNo") or ""
        grn_date = grn.get("grnDate") or grn.get("createdAt") or ""
        if po_no:
            grn_map[po_no] = {
                "grnDate":     str(grn_date)[:10],
                "receivedQty": _int(grn.get("totalQty") or grn.get("total_qty") or 0),
                "grnId":       _str(grn["_id"]),
            }

    # ── Aggregate PO data ────────────────────────────────────────────────────
    vendor_stats: dict = {}
    delayed_pos         = []

    po_query: dict = {}
    if vendor_filter:
        po_query["vendorName"] = {"$regex": vendor_filter, "$options": "i"}

    async for po in purchaseorders_collection.find(po_query):
        name      = (po.get("vendorName") or "").strip()
        order_no  = po.get("orderNo", "")
        status    = po.get("status", "")
        created   = po.get("createdAt")
        due_str   = po.get("dueDate") or po.get("due_date") or po.get("expectedDelivery") or ""

        if search:
            s = search.lower()
            if s not in name.lower() and s not in order_no.lower(): continue

        if name not in vendor_stats:
            vendor_stats[name] = {
                "vendorName":   name,
                "total_pos":    0,
                "completed":    0,
                "lead_times":   [],   # days PO → GRN
                "on_time":      0,
                "delayed":      0,
                "no_date":      0,
                "follow_ups":   0,
            }

        vs = vendor_stats[name]
        vs["total_pos"] += 1

        # Lead time calculation (only for completed POs with GRN)
        grn_info = grn_map.get(order_no)
        if grn_info and created and isinstance(created, datetime):
            vs["completed"] += 1
            grn_date_str = grn_info["grnDate"]
            for fmt in ("%Y-%m-%d", "%d-%m-%Y"):
                try:
                    grn_dt  = datetime.strptime(grn_date_str, fmt)
                    lead_days = (grn_dt - created).days
                    if lead_days >= 0:
                        vs["lead_times"].append(lead_days)
                    break
                except: continue

            # On-time check
            if due_str:
                for fmt in ("%d-%m-%Y", "%Y-%m-%d"):
                    try:
                        due_dt  = datetime.strptime(due_str.strip(), fmt)
                        grn_dt2 = datetime.strptime(grn_date_str, "%Y-%m-%d")
                        if grn_dt2 <= due_dt: vs["on_time"] += 1
                        else:                  vs["delayed"] += 1
                        break
                    except: continue
            else:
                vs["no_date"] += 1

        # Delayed active POs (active with due date passed)
        if status in ACTIVE_STATUSES and due_str:
            days_u = _days_until(due_str)
            if days_u is not None and days_u < 0:
                vs["delayed"] += 1
                if not delay_only or True:
                    items  = po.get("items", [])
                    po_val = sum(_float(it.get("rate",0)) * _int(it.get("quantity",0)) for it in items)
                    delayed_pos.append({
                        "id":          _str(po["_id"]),
                        "orderNo":     order_no,
                        "vendorName":  name,
                        "status":      status,
                        "dueDate":     due_str,
                        "daysOverdue": abs(days_u),
                        "poValue":     round(po_val, 2),
                        "followupNotes": po.get("followup_notes", []),
                        "lastFollowup":  po.get("last_followup", ""),
                    })

        if po.get("followup_notes"):
            vs["follow_ups"] += 1

    # ── Build vendor summary ──────────────────────────────────────────────────
    vendor_list = []
    for name, vs in vendor_stats.items():
        lead_times   = vs["lead_times"]
        avg_lead     = round(sum(lead_times) / len(lead_times), 1) if lead_times else None
        min_lead     = min(lead_times) if lead_times else None
        max_lead     = max(lead_times) if lead_times else None
        deliveries   = vs["on_time"] + vs["delayed"]
        on_time_pct  = round(vs["on_time"] / deliveries * 100, 1) if deliveries > 0 else None

        vendor_list.append({
            "vendorName":  name,
            "total_pos":   vs["total_pos"],
            "completed":   vs["completed"],
            "avg_lead_days": avg_lead,
            "min_lead_days": min_lead,
            "max_lead_days": max_lead,
            "on_time_count": vs["on_time"],
            "delayed_count": vs["delayed"],
            "on_time_pct":   on_time_pct,
            "follow_ups":    vs["follow_ups"],
        })

    vendor_list.sort(key=lambda x: (-(x["delayed_count"]), x["avg_lead_days"] or 9999))
    delayed_pos.sort(key=lambda x: -x["daysOverdue"])

    if delay_only:
        delayed_pos_filtered = delayed_pos
    else:
        delayed_pos_filtered = delayed_pos

    summary = {
        "total_vendors":  len(vendor_list),
        "total_delayed":  len(delayed_pos),
        "avg_lead_time":  round(
            sum(v["avg_lead_days"] for v in vendor_list if v["avg_lead_days"] is not None) /
            max(sum(1 for v in vendor_list if v["avg_lead_days"] is not None), 1), 1
        ),
    }

    return JSONResponse({
        "status":      "success",
        "summary":     summary,
        "vendors":     vendor_list,
        "delayed_pos": delayed_pos_filtered,
    })


@router.put("/po-followup/{po_id}")
async def add_followup_note(po_id: str, payload: dict):
    """Add a follow-up note to a PO."""
    try: oid = ObjectId(po_id)
    except: raise HTTPException(status_code=400, detail="Invalid PO ID")

    note = (payload.get("note") or "").strip()
    if not note:
        raise HTTPException(status_code=400, detail="Note cannot be empty.")

    note_doc = {
        "note":      note,
        "addedAt":   datetime.utcnow().isoformat(),
        "addedBy":   payload.get("addedBy", "M-Buyer"),
    }

    await purchaseorders_collection.update_one(
        {"_id": oid},
        {
            "$push": {"followup_notes": note_doc},
            "$set":  {"last_followup": datetime.utcnow().isoformat(), "updatedAt": datetime.utcnow()},
        }
    )
    return JSONResponse({"status": "success", "message": "Follow-up note added."})


# ═══════════════════════════════════════════════════════════════════════════════
# 6. REORDER ALERTS WITH QUICK PO
#    Reads inventory_collection where stockQty < reorderLevel.
#    Sales velocity from sales_collection for suggested qty.
# ═══════════════════════════════════════════════════════════════════════════════

from app.db import inventory_collection, sales_collection

@router.get("/reorder-alerts")
async def get_reorder_alerts(
    ctx: dict = Depends(get_hq_tenant),
    division_filter: Optional[str] = Query(None),
    search:          Optional[str] = Query(None),
    critical_only:   bool          = Query(False),
):
    """
    Returns products below reorder level with:
    - Current stock, reorder level, shortfall qty
    - Avg daily sales velocity (last 30 days)
    - Suggested reorder qty (30-day cover)
    - Days of stock remaining at current velocity
    - Last vendor who supplied this product (for quick PO)
    """
    alerts = []

    # ── Sales velocity: barcode → avg_daily_sales (last 30 days) ─────────────
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    velocity_map: dict = {}   # barcode → avg_daily_qty

    try:
        async for sale in sales_collection.find({
            "date": {"$gte": thirty_days_ago.isoformat()[:10]}
        }):
            for item in (sale.get("items") or sale.get("cart") or []):
                bc  = (item.get("barcode") or "").strip()
                qty = _int(item.get("qty") or item.get("quantity") or 0)
                if bc:
                    velocity_map[bc] = velocity_map.get(bc, 0) + qty
    except Exception:
        pass   # sales_collection may not exist — degrade gracefully

    for bc in velocity_map:
        velocity_map[bc] = round(velocity_map[bc] / 30, 2)

    # ── Find last vendor per barcode (from GRNs) ──────────────────────────────
    vendor_map: dict = {}   # barcode → {vendorName, vendorId}
    async for grn in grn_collection.find({}).sort("createdAt", -1):
        for item in (grn.get("items") or []):
            bc = (item.get("barcode") or "").strip()
            if bc and bc not in vendor_map:
                vendor_map[bc] = {
                    "vendorName": grn.get("vendorName", ""),
                    "vendorId":   _str(grn.get("vendor_id", "")),
                    "lastGRNDate": str(grn.get("grnDate") or "")[:10],
                }

    # ── Scan inventory for items below reorder level ──────────────────────────
    inv_query: dict = {}
    if division_filter:
        inv_query["division"] = {"$regex": division_filter, "$options": "i"}

    async for inv in inventory_collection.find(inv_query):
        stock_qty    = _float(inv.get("stockQty") or inv.get("stock_qty") or inv.get("quantity") or 0)
        reorder_lvl  = _float(inv.get("reorderLevel") or inv.get("reorder_level") or inv.get("reorder_qty") or 0)

        if reorder_lvl <= 0: continue          # no reorder level set — skip
        if stock_qty >= reorder_lvl: continue  # stock is fine — skip

        barcode      = (inv.get("barcode") or "").strip()
        product_name = inv.get("productName") or inv.get("product_name") or inv.get("name") or ""
        division     = inv.get("division", "")
        department   = inv.get("department", "")
        sku          = inv.get("sku") or inv.get("base_sku") or ""

        if search:
            s = search.lower()
            if s not in product_name.lower() and s not in barcode.lower() and s not in sku.lower():
                continue

        shortfall    = reorder_lvl - stock_qty
        avg_daily    = velocity_map.get(barcode, 0)
        days_left    = round(stock_qty / avg_daily, 1) if avg_daily > 0 else None
        suggested_qty= max(int(avg_daily * 30), int(shortfall * 1.5), int(reorder_lvl))

        # Urgency
        if stock_qty <= 0:                         urgency = "out-of-stock"
        elif days_left is not None and days_left < 3: urgency = "critical"
        elif stock_qty < reorder_lvl * 0.5:        urgency = "critical"
        else:                                       urgency = "low"

        if critical_only and urgency not in ("out-of-stock", "critical"):
            continue

        vendor_info = vendor_map.get(barcode, {})

        alerts.append({
            "barcode":       barcode,
            "sku":           sku,
            "productName":   product_name,
            "division":      division,
            "department":    department,
            "stockQty":      stock_qty,
            "reorderLevel":  reorder_lvl,
            "shortfall":     round(shortfall, 0),
            "avgDailySales": avg_daily,
            "daysLeft":      days_left,
            "suggestedQty":  suggested_qty,
            "urgency":       urgency,
            "lastVendorName":vendor_info.get("vendorName", ""),
            "lastVendorId":  vendor_info.get("vendorId", ""),
            "lastGRNDate":   vendor_info.get("lastGRNDate", ""),
        })

    # Sort: out-of-stock → critical → low; within each by shortfall desc
    urgency_order = {"out-of-stock": 0, "critical": 1, "low": 2}
    alerts.sort(key=lambda a: (urgency_order.get(a["urgency"], 9), -a["shortfall"]))

    summary = {
        "total_alerts":   len(alerts),
        "out_of_stock":   sum(1 for a in alerts if a["urgency"] == "out-of-stock"),
        "critical":       sum(1 for a in alerts if a["urgency"] == "critical"),
        "low":            sum(1 for a in alerts if a["urgency"] == "low"),
        "total_shortfall":sum(a["shortfall"] for a in alerts),
    }

    return JSONResponse({"status": "success", "summary": summary, "data": alerts})


# ═══════════════════════════════════════════════════════════════════════════════
# DASHBOARD — single endpoint returns all KPIs, charts, activity feed
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/dashboard")
async def get_dashboard(ctx: dict = Depends(get_hq_tenant)):
    """
    M-Buyer dashboard — one call returns:
      kpis         : 6 headline numbers
      status_dist  : PO count by status (donut chart)
      monthly_value: PO value by month last 6 months (bar chart)
      division_spend: spend by division (bar chart)
      top_vendors  : top 5 vendors by fulfilment (table)
      needs_review : VendorSubmitted POs waiting for buyer action
      overdue_pos  : active POs past due date
      pending_vendors: vendors awaiting approval
      low_stock    : top 5 items below reorder level
    """
    now   = datetime.utcnow()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # ── 1. KPIs ───────────────────────────────────────────────────────────────
    # Active PO count
    active_count = await purchaseorders_collection.count_documents(
        {"status": {"$in": ACTIVE_STATUSES}}
    )

    # VendorSubmitted — needs buyer review
    needs_review_count = await purchaseorders_collection.count_documents(
        {"status": "VendorSubmitted"}
    )

    # Overdue active POs (dueDate field exists and is in the past)
    overdue_count = 0
    async for po in purchaseorders_collection.find(
        {"status": {"$in": ACTIVE_STATUSES},
         "$or": [{"dueDate": {"$exists": True, "$ne": ""}},
                 {"due_date": {"$exists": True, "$ne": ""}}]}
    ):
        due_str = po.get("dueDate") or po.get("due_date") or ""
        days    = _days_until(due_str)
        if days is not None and days < 0:
            overdue_count += 1

    # Vendors pending approval
    pending_vendors_count = await vendors_collection.count_documents(
        {"status": "Pending"}
    )

    # This month PO value
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_value = 0.0
    async for po in purchaseorders_collection.find({"createdAt": {"$gte": month_start}}):
        for it in po.get("items", []):
            month_value += _float(it.get("rate", 0)) * _int(it.get("quantity", 0))

    # OTB remaining
    total_budget    = 0.0
    total_committed = 0.0
    async for b in budgets_collection.find({}):
        total_budget += _float(b.get("totalBudget", 0))
    async for po in purchaseorders_collection.find({"status": {"$in": COMMITTED_STATUSES}}):
        for it in po.get("items", []):
            total_committed += _float(it.get("rate", 0)) * _int(it.get("quantity", 0))
    otb_remaining = total_budget - total_committed

    kpis = {
        "active_pos":          active_count,
        "needs_review":        needs_review_count,
        "overdue_pos":         overdue_count,
        "pending_vendors":     pending_vendors_count,
        "month_po_value":      round(month_value, 2),
        "otb_remaining":       round(otb_remaining, 2),
        "otb_set":             total_budget > 0,
    }

    # ── 2. PO Status Distribution (donut chart) ───────────────────────────────
    status_map: dict = {}
    async for po in purchaseorders_collection.find({"tenant_id": ctx["tenant_id"]}):
        s = po.get("status", "Unknown")
        status_map[s] = status_map.get(s, 0) + 1

    STATUS_COLORS = {
        "Pending":          "#94A3B8",
        "SentToVendor":     "#0EA5E9",
        "WalkinAccepted":   "#10B981",
        "VendorSubmitted":  "#7C3AED",
        "Approved":         "#059669",
        "PartiallyReceived":"#F59E0B",
        "FullyReceived":    "#22C55E",
        "StockUpdated":     "#6366F1",
        "Cancelled":        "#EF4444",
        "Rejected":         "#F43F5E",
    }
    status_dist = [
        {"status": s, "count": c, "color": STATUS_COLORS.get(s, "#CBD5E1")}
        for s, c in sorted(status_map.items(), key=lambda x: -x[1])
    ]

    # ── 3. Monthly PO Value — last 6 months ──────────────────────────────────
    monthly_value = []
    for m in range(5, -1, -1):
        # Start of month m months ago
        if now.month - m <= 0:
            y = now.year - 1
            mo = 12 + (now.month - m)
        else:
            y  = now.year
            mo = now.month - m
        m_start = datetime(y, mo, 1)
        if mo == 12:
            m_end = datetime(y + 1, 1, 1)
        else:
            m_end = datetime(y, mo + 1, 1)

        val = 0.0
        async for po in purchaseorders_collection.find(
            {"createdAt": {"$gte": m_start, "$lt": m_end}}
        ):
            for it in po.get("items", []):
                val += _float(it.get("rate", 0)) * _int(it.get("quantity", 0))

        monthly_value.append({
            "month": m_start.strftime("%b %Y"),
            "value": round(val, 2),
        })

    # ── 4. Division-wise spend ────────────────────────────────────────────────
    div_map: dict = {}
    async for po in purchaseorders_collection.find(
        {"status": {"$in": COMMITTED_STATUSES}}
    ):
        div = (po.get("division") or "Uncategorized").strip()
        for it in po.get("items", []):
            div_map[div] = div_map.get(div, 0.0) + _float(it.get("rate", 0)) * _int(it.get("quantity", 0))

    division_spend = [
        {"division": d, "value": round(v, 2)}
        for d, v in sorted(div_map.items(), key=lambda x: -x[1])
    ][:8]

    # ── 5. Top 5 vendors by PO value ─────────────────────────────────────────
    vendor_val: dict  = {}
    vendor_pos: dict  = {}
    async for po in purchaseorders_collection.find({"tenant_id": ctx["tenant_id"]}):
        name = (po.get("vendorName") or "").strip()
        if not name: continue
        val = sum(_float(it.get("rate", 0)) * _int(it.get("quantity", 0)) for it in po.get("items", []))
        vendor_val[name] = vendor_val.get(name, 0.0) + val
        vendor_pos[name] = vendor_pos.get(name, 0) + 1

    top_vendors = [
        {"vendorName": n, "total_value": round(v, 2), "po_count": vendor_pos.get(n, 0)}
        for n, v in sorted(vendor_val.items(), key=lambda x: -x[1])
    ][:5]

    # ── 6. Activity feed: VendorSubmitted POs needing review ─────────────────
    needs_review_list = []
    async for po in purchaseorders_collection.find(
        {"status": "VendorSubmitted"}
    ).sort("updatedAt", -1).limit(8):
        updated = po.get("updatedAt")
        items   = po.get("items", [])
        val     = sum(_float(it.get("rate", 0)) * _int(it.get("quantity", 0)) for it in items)
        days_waiting = _days_ago(updated) if updated else 0
        needs_review_list.append({
            "id":          _str(po["_id"]),
            "orderNo":     po.get("orderNo", ""),
            "vendorName":  po.get("vendorName", ""),
            "value":       round(val, 2),
            "daysWaiting": days_waiting,
            "updatedAt":   updated.isoformat() if isinstance(updated, datetime) else str(updated or ""),
        })

    # ── 7. Overdue POs ────────────────────────────────────────────────────────
    overdue_list = []
    async for po in purchaseorders_collection.find(
        {"status": {"$in": ACTIVE_STATUSES}}
    ).sort("createdAt", -1):
        due_str  = po.get("dueDate") or po.get("due_date") or ""
        days_u   = _days_until(due_str)
        if days_u is None or days_u >= 0: continue
        items    = po.get("items", [])
        val      = sum(_float(it.get("rate", 0)) * _int(it.get("quantity", 0)) for it in items)
        overdue_list.append({
            "id":          _str(po["_id"]),
            "orderNo":     po.get("orderNo", ""),
            "vendorName":  po.get("vendorName", ""),
            "status":      po.get("status", ""),
            "dueDate":     due_str,
            "daysOverdue": abs(days_u),
            "value":       round(val, 2),
        })
        if len(overdue_list) >= 6: break

    # ── 8. Pending vendor registrations ──────────────────────────────────────
    pending_vendor_list = []
    async for v in vendors_collection.find({"status": "Pending"}).sort("created_at", -1).limit(5):
        created = v.get("created_at") or v.get("createdAt")
        pending_vendor_list.append({
            "id":        _str(v["_id"]),
            "name":      v.get("name") or v.get("vendor_name") or "",
            "email":     v.get("email", ""),
            "mobile":    v.get("contactMobile") or v.get("mobile", ""),
            "createdAt": created.isoformat() if isinstance(created, datetime) else str(created or ""),
            "source":    v.get("source", "registration"),
        })

    # ── 9. Low stock alerts (top 5) ───────────────────────────────────────────
    low_stock_list = []
    async for inv in inventory_collection.find({}):
        stock   = _float(inv.get("stockQty") or inv.get("stock_qty") or inv.get("quantity") or 0)
        reorder = _float(inv.get("reorderLevel") or inv.get("reorder_level") or 0)
        if reorder <= 0 or stock >= reorder: continue
        low_stock_list.append({
            "barcode":     (inv.get("barcode") or "").strip(),
            "productName": inv.get("productName") or inv.get("product_name") or inv.get("name") or "",
            "stockQty":    stock,
            "reorderLevel":reorder,
            "shortfall":   round(reorder - stock, 0),
            "urgency":     "out-of-stock" if stock <= 0 else "critical" if stock < reorder * 0.5 else "low",
        })

    low_stock_list.sort(key=lambda x: ({"out-of-stock":0,"critical":1,"low":2}.get(x["urgency"],9), -x["shortfall"]))
    low_stock_list = low_stock_list[:5]

    return JSONResponse({
        "status":           "success",
        "kpis":             kpis,
        "status_dist":      status_dist,
        "monthly_value":    monthly_value,
        "division_spend":   division_spend,
        "top_vendors":      top_vendors,
        "needs_review":     needs_review_list,
        "overdue_pos":      overdue_list,
        "pending_vendors":  pending_vendor_list,
        "low_stock":        low_stock_list,
    })


# ═══════════════════════════════════════════════════════════════════════════════
# BUYER'S CALENDAR
#
# db.py — add:  calendar_events_collection = db["calendar_events"]
#
# Two sources of events:
#   1. Manual — stored in calendar_events_collection (CRUD)
#   2. Auto   — pulled live from POs/vendors (read-only, shown in calendar)
# ═══════════════════════════════════════════════════════════════════════════════

from app.db import calendar_events_collection

EVENT_TYPES = {
    "season_open":       {"label": "Season Open",         "color": "#22C55E"},
    "season_close":      {"label": "Season Close",        "color": "#EF4444"},
    "trade_fair":        {"label": "Trade Fair",          "color": "#6366F1"},
    "sample_deadline":   {"label": "Sample Deadline",     "color": "#F97316"},
    "negotiation":       {"label": "Negotiation",         "color": "#0EA5E9"},
    "otb_review":        {"label": "OTB Review",          "color": "#7C3AED"},
    "vendor_visit":      {"label": "Vendor Visit",        "color": "#10B981"},
    "ordering_deadline": {"label": "Ordering Deadline",   "color": "#EF4444"},
    "payment":           {"label": "Payment Milestone",   "color": "#F59E0B"},
    "custom":            {"label": "Custom",              "color": "#64748B"},
    # Auto-generated types (not user-creatable)
    "po_due":            {"label": "PO Due",              "color": "#0EA5E9"},
    "po_overdue":        {"label": "PO Overdue",          "color": "#EF4444"},
    "vendor_review":     {"label": "Vendor Submitted",    "color": "#7C3AED"},
    "vendor_pending":    {"label": "Pending Approval",    "color": "#F97316"},
}


def _parse_date_to_ymd(date_str: str) -> str:
    """Normalise any date string to YYYY-MM-DD."""
    if not date_str: return ""
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(date_str.strip(), fmt).strftime("%Y-%m-%d")
        except: continue
    # Try ISO with time
    try:
        return datetime.fromisoformat(str(date_str)[:10]).strftime("%Y-%m-%d")
    except: return ""


@router.get("/calendar")
async def get_calendar_events(
    month: Optional[str] = Query(None),  # YYYY-MM — if None returns current month
    view:  Optional[str] = Query("month"),  # month | list
):
    """
    Returns all events for a given month:
      - manual events from calendar_events_collection
      - auto events from purchaseorders (PO due dates, vendor submitted)
      - auto events from vendors_collection (pending approvals)
    """
    # Determine month range
    if month:
        try:
            m_start = datetime.strptime(month, "%Y-%m")
        except:
            m_start = datetime.utcnow().replace(day=1)
    else:
        m_start = datetime.utcnow().replace(day=1)

    m_start = m_start.replace(hour=0, minute=0, second=0, microsecond=0)
    if m_start.month == 12:
        m_end = datetime(m_start.year + 1, 1, 1)
    else:
        m_end = datetime(m_start.year, m_start.month + 1, 1)

    m_start_str = m_start.strftime("%Y-%m-%d")
    m_end_str   = m_end.strftime("%Y-%m-%d")

    events = []

    # ── 1. Manual events from DB ──────────────────────────────────────────────
    async for ev in calendar_events_collection.find({
        "date": {"$gte": m_start_str, "$lt": m_end_str}
    }):
        ev_type = ev.get("type", "custom")
        events.append({
            "id":        _str(ev["_id"]),
            "source":    "manual",
            "type":      ev_type,
            "label":     EVENT_TYPES.get(ev_type, EVENT_TYPES["custom"])["label"],
            "color":     ev.get("color") or EVENT_TYPES.get(ev_type, EVENT_TYPES["custom"])["color"],
            "title":     ev.get("title", ""),
            "date":      ev.get("date", ""),
            "endDate":   ev.get("endDate", ""),
            "notes":     ev.get("notes", ""),
            "vendorName":ev.get("vendorName", ""),
            "poNo":      ev.get("poNo", ""),
            "editable":  True,
        })

    # ── 2. Auto: PO due dates ─────────────────────────────────────────────────
    async for po in purchaseorders_collection.find({
        "status": {"$in": ACTIVE_STATUSES}
    }):
        due_raw = po.get("dueDate") or po.get("due_date") or po.get("expectedDelivery") or ""
        if not due_raw: continue
        due_ymd = _parse_date_to_ymd(due_raw)
        if not due_ymd: continue
        if not (m_start_str <= due_ymd < m_end_str): continue

        days_u  = _days_until(due_raw)
        ev_type = "po_overdue" if (days_u is not None and days_u < 0) else "po_due"
        events.append({
            "id":        f"po_{_str(po['_id'])}",
            "source":    "auto",
            "type":      ev_type,
            "label":     EVENT_TYPES[ev_type]["label"],
            "color":     EVENT_TYPES[ev_type]["color"],
            "title":     f"PO Due — {po.get('vendorName','')}: {po.get('orderNo','')}",
            "date":      due_ymd,
            "endDate":   "",
            "notes":     f"Status: {po.get('status','')} | Items: {len(po.get('items',[]))}",
            "vendorName":po.get("vendorName", ""),
            "poNo":      po.get("orderNo", ""),
            "editable":  False,
        })

    # ── 3. Auto: VendorSubmitted POs (needs review) ───────────────────────────
    async for po in purchaseorders_collection.find({"status": "VendorSubmitted"}):
        updated = po.get("updatedAt")
        if not updated: continue
        upd_ymd = updated.strftime("%Y-%m-%d") if isinstance(updated, datetime) else _parse_date_to_ymd(str(updated))
        if not upd_ymd or not (m_start_str <= upd_ymd < m_end_str): continue

        events.append({
            "id":        f"vs_{_str(po['_id'])}",
            "source":    "auto",
            "type":      "vendor_review",
            "label":     "Vendor Submitted",
            "color":     EVENT_TYPES["vendor_review"]["color"],
            "title":     f"Review Needed — {po.get('vendorName','')}: {po.get('orderNo','')}",
            "date":      upd_ymd,
            "endDate":   "",
            "notes":     "Vendor has submitted this PO — awaiting buyer review.",
            "vendorName":po.get("vendorName", ""),
            "poNo":      po.get("orderNo", ""),
            "editable":  False,
        })

    # ── 4. Auto: Pending vendor registrations ─────────────────────────────────
    async for v in vendors_collection.find({"status": "Pending"}):
        created = v.get("created_at") or v.get("createdAt")
        if not created: continue
        c_ymd = created.strftime("%Y-%m-%d") if isinstance(created, datetime) else _parse_date_to_ymd(str(created))
        if not c_ymd or not (m_start_str <= c_ymd < m_end_str): continue

        name = v.get("name") or v.get("vendor_name") or "Unknown"
        events.append({
            "id":        f"vp_{_str(v['_id'])}",
            "source":    "auto",
            "type":      "vendor_pending",
            "label":     "Pending Approval",
            "color":     EVENT_TYPES["vendor_pending"]["color"],
            "title":     f"Approve Vendor — {name}",
            "date":      c_ymd,
            "endDate":   "",
            "notes":     f"Email: {v.get('email','')} | Mobile: {v.get('contactMobile','')}",
            "vendorName":name,
            "poNo":      "",
            "editable":  False,
        })

    # Sort by date
    events.sort(key=lambda e: e["date"])

    # Build day map for calendar grid
    day_map: dict = {}
    for ev in events:
        d = ev["date"]
        if d not in day_map:
            day_map[d] = []
        day_map[d].append(ev)

    # Summary counts for the month
    summary = {
        "total":           len(events),
        "po_due":          sum(1 for e in events if e["type"] == "po_due"),
        "po_overdue":      sum(1 for e in events if e["type"] == "po_overdue"),
        "manual":          sum(1 for e in events if e["source"] == "manual"),
        "vendor_review":   sum(1 for e in events if e["type"] == "vendor_review"),
        "vendor_pending":  sum(1 for e in events if e["type"] == "vendor_pending"),
    }

    return JSONResponse({
        "status":     "success",
        "month":      m_start.strftime("%Y-%m"),
        "month_label":m_start.strftime("%B %Y"),
        "summary":    summary,
        "events":     events,
        "day_map":    day_map,
        "event_types":EVENT_TYPES,
    })


@router.post("/calendar")
async def create_calendar_event(payload: dict):
    """Create a manual calendar event."""
    title = (payload.get("title") or "").strip()
    date  = (payload.get("date") or "").strip()
    etype = (payload.get("type") or "custom").strip()

    if not title:
        raise HTTPException(status_code=400, detail="Title is required.")
    if not date:
        raise HTTPException(status_code=400, detail="Date is required.")

    # Normalise date to YYYY-MM-DD
    date_ymd = _parse_date_to_ymd(date)
    if not date_ymd:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD or DD-MM-YYYY.")

    end_date = _parse_date_to_ymd(payload.get("endDate", ""))
    color    = payload.get("color") or EVENT_TYPES.get(etype, EVENT_TYPES["custom"])["color"]

    doc = {
        "title":      title,
        "type":       etype,
        "date":       date_ymd,
        "endDate":    end_date,
        "color":      color,
        "notes":      (payload.get("notes") or "").strip(),
        "vendorName": (payload.get("vendorName") or "").strip(),
        "poNo":       (payload.get("poNo") or "").strip(),
        "createdAt":  datetime.utcnow(),
        "updatedAt":  datetime.utcnow(),
    }
    result = await calendar_events_collection.insert_one(doc)
    return JSONResponse({
        "status":  "success",
        "message": "Event created.",
        "id":      str(result.inserted_id),
    }, status_code=201)


@router.put("/calendar/{event_id}")
async def update_calendar_event(event_id: str, payload: dict):
    """Update a manual calendar event."""
    try: oid = ObjectId(event_id)
    except: raise HTTPException(status_code=400, detail="Invalid event ID")

    ev = await calendar_events_collection.find_one({"_id": oid})
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")

    patch: dict = {"updatedAt": datetime.utcnow()}
    if "title"      in payload: patch["title"]      = payload["title"]
    if "date"       in payload: patch["date"]        = _parse_date_to_ymd(payload["date"]) or patch.get("date", ev.get("date"))
    if "endDate"    in payload: patch["endDate"]     = _parse_date_to_ymd(payload["endDate"])
    if "type"       in payload: patch["type"]        = payload["type"]
    if "color"      in payload: patch["color"]       = payload["color"]
    if "notes"      in payload: patch["notes"]       = payload["notes"]
    if "vendorName" in payload: patch["vendorName"]  = payload["vendorName"]
    if "poNo"       in payload: patch["poNo"]        = payload["poNo"]

    await calendar_events_collection.update_one({"_id": oid}, {"$set": patch})
    return JSONResponse({"status": "success", "message": "Event updated."})


@router.delete("/calendar/{event_id}")
async def delete_calendar_event(event_id: str):
    """Delete a manual calendar event."""
    try: oid = ObjectId(event_id)
    except: raise HTTPException(status_code=400, detail="Invalid event ID")
    await calendar_events_collection.delete_one({"_id": oid})
    return JSONResponse({"status": "success", "message": "Event deleted."})

# ═══════════════════════════════════════════════════════════════════════════════
# ORDER DETAILS CRUD
# Collection: mbuyer_order_details_collection
# ═══════════════════════════════════════════════════════════════════════════════



@router.get("/order-details")
async def get_order_details(search: Optional[str] = Query(None), ctx: dict = Depends(get_hq_tenant)):
    docs = []
    async for d in mbuyer_order_details_collection.find({"tenant_id": ctx["tenant_id"]}).sort("createdAt", -1):
        docs.append({
            "id":       _str(d["_id"]),
            "item":     d.get("item", ""),
            "amount":   d.get("amount", ""),
            "size":     d.get("size", ""),
            "quantity": d.get("quantity", ""),
            "colour":   d.get("colour", ""),
            "fabric":   d.get("fabric", ""),
            "createdAt": d.get("createdAt", "").isoformat() if isinstance(d.get("createdAt"), datetime) else str(d.get("createdAt", "")),
        })
    if search:
        q = search.lower()
        docs = [d for d in docs if q in (d["item"]+d["colour"]+d["fabric"]).lower()]
    return JSONResponse({"status": "success", "data": docs})


@router.post("/order-details")
async def create_order_detail(payload: dict, ctx: dict = Depends(get_hq_tenant)):
    doc = {
        "item":     (payload.get("item") or "").strip(),
        "amount":   payload.get("amount", ""),
        "size":     (payload.get("size") or "").strip(),
        "quantity": payload.get("quantity", ""),
        "colour":   (payload.get("colour") or "").strip(),
        "fabric":   (payload.get("fabric") or "").strip(),
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
    }
    doc["tenant_id"] = ctx["tenant_id"]
    result = await mbuyer_order_details_collection.insert_one(doc)
    return JSONResponse({"status": "success", "message": "Order added.", "id": str(result.inserted_id)}, status_code=201)


@router.put("/order-details/{doc_id}")
async def update_order_detail(doc_id: str, payload: dict, ctx: dict = Depends(get_hq_tenant)):
    try: oid = ObjectId(doc_id)
    except: raise HTTPException(status_code=400, detail="Invalid ID")
    patch = {
        "item":     payload.get("item", ""),
        "amount":   payload.get("amount", ""),
        "size":     payload.get("size", ""),
        "quantity": payload.get("quantity", ""),
        "colour":   payload.get("colour", ""),
        "fabric":   payload.get("fabric", ""),
        "updatedAt": datetime.utcnow(),
    }
    await mbuyer_order_details_collection.update_one({"_id": oid}, {"$set": patch})
    return JSONResponse({"status": "success", "message": "Order updated."})


@router.delete("/order-details/{doc_id}")
async def delete_order_detail(doc_id: str, ctx: dict = Depends(get_hq_tenant)):
    try: oid = ObjectId(doc_id)
    except: raise HTTPException(status_code=400, detail="Invalid ID")
    await mbuyer_order_details_collection.delete_one({"_id": oid})
    return JSONResponse({"status": "success", "message": "Order deleted."})


# ═══════════════════════════════════════════════════════════════════════════════
# SAMPLE OR REAL CRUD
# Collection: sample_real_collection
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/sample-or-real")
async def get_sample_or_real(search: Optional[str] = Query(None), ctx: dict = Depends(get_hq_tenant)):
    docs = []
    async for d in sample_real_collection.find({"tenant_id": ctx["tenant_id"]}).sort("createdAt", -1):
        docs.append({
            "id":              _str(d["_id"]),
            "name":            d.get("name", ""),
            "partyCode":       d.get("partyCode", ""),
            "firstPayment":    d.get("firstPayment", ""),
            "secondPayment":   d.get("secondPayment", ""),
            "discount":        d.get("discount", ""),
            "total":           d.get("total", ""),
            "duePayment":      d.get("duePayment", ""),
            "shippingFreight": d.get("shippingFreight", ""),
            "details":         d.get("details", ""),
            "createdAt": d.get("createdAt", "").isoformat() if isinstance(d.get("createdAt"), datetime) else str(d.get("createdAt", "")),
        })
    if search:
        q = search.lower()
        docs = [d for d in docs if q in (d["name"]+d["partyCode"]).lower()]
    return JSONResponse({"status": "success", "data": docs})


@router.post("/sample-or-real")
async def create_sample_or_real(payload: dict, ctx: dict = Depends(get_hq_tenant)):
    doc = {
        "name":            (payload.get("name") or "").strip(),
        "partyCode":       (payload.get("partyCode") or "").strip(),
        "firstPayment":    payload.get("firstPayment", ""),
        "secondPayment":   payload.get("secondPayment", ""),
        "discount":        payload.get("discount", ""),
        "total":           payload.get("total", ""),
        "duePayment":      (payload.get("duePayment") or "").strip(),
        "shippingFreight": (payload.get("shippingFreight") or "").strip(),
        "details":         (payload.get("details") or "").strip(),
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
    }
    doc["tenant_id"] = ctx["tenant_id"]
    result = await sample_real_collection.insert_one(doc)
    return JSONResponse({"status": "success", "message": "Record added.", "id": str(result.inserted_id)}, status_code=201)


@router.put("/sample-or-real/{doc_id}")
async def update_sample_or_real(doc_id: str, payload: dict, ctx: dict = Depends(get_hq_tenant)):
    try: oid = ObjectId(doc_id)
    except: raise HTTPException(status_code=400, detail="Invalid ID")
    patch = {
        "name":            payload.get("name", ""),
        "partyCode":       payload.get("partyCode", ""),
        "firstPayment":    payload.get("firstPayment", ""),
        "secondPayment":   payload.get("secondPayment", ""),
        "discount":        payload.get("discount", ""),
        "total":           payload.get("total", ""),
        "duePayment":      payload.get("duePayment", ""),
        "shippingFreight": payload.get("shippingFreight", ""),
        "details":         payload.get("details", ""),
        "updatedAt": datetime.utcnow(),
    }
    await sample_real_collection.update_one({"_id": oid}, {"$set": patch})
    return JSONResponse({"status": "success", "message": "Record updated."})


@router.delete("/sample-or-real/{doc_id}")
async def delete_sample_or_real(doc_id: str, ctx: dict = Depends(get_hq_tenant)):
    try: oid = ObjectId(doc_id)
    except: raise HTTPException(status_code=400, detail="Invalid ID")
    await sample_real_collection.delete_one({"_id": oid})
    return JSONResponse({"status": "success", "message": "Record deleted."})


# ═══════════════════════════════════════════════════════════════════════════════
# BUYER GRC CRUD
# Collection: mbuyer_grc_collection  (add to db.py: mbuyer_grc_collection = db["mbuyer_grc"])
# ═══════════════════════════════════════════════════════════════════════════════

from app.db import mbuyer_grc_collection

async def _generate_grn_no() -> str:
    count = await mbuyer_grc_collection.count_documents({})
    return f"GRN-{str(count + 1).zfill(5)}"

@router.get("/grc")
async def get_buyer_grcs(search: Optional[str] = Query(None), ctx: dict = Depends(get_hq_tenant)):
    docs = []
    async for d in mbuyer_grc_collection.find({"tenant_id": ctx["tenant_id"]}).sort("createdAt", -1):
        docs.append({
            "id":                 _str(d["_id"]),
            "grnNo":              d.get("grnNo", ""),
            "ivNo":               d.get("ivNo", ""),
            "date":               d.get("date", ""),
            "challanBillApproval":d.get("challanBillApproval", ""),
            "fromAddress":        d.get("fromAddress", ""),
            "toAddress":          d.get("toAddress", ""),
            "gstPercent":         d.get("gstPercent", ""),
            "purchaseUnregd":     d.get("purchaseUnregd", ""),
            "nonTaxable":         d.get("nonTaxable", ""),
            "barCode":            d.get("barCode", ""),
            "lessDiscount":       d.get("lessDiscount", ""),
            "netAmount":          d.get("netAmount", ""),
            "preparedBy":         d.get("preparedBy", ""),
            "checkedBy":          d.get("checkedBy", ""),
            "passedBy":           d.get("passedBy", ""),
            "items":              d.get("items", []),
            "createdAt": d["createdAt"].isoformat() if isinstance(d.get("createdAt"), datetime) else str(d.get("createdAt", "")),
        })
    if search:
        q = search.lower()
        docs = [d for d in docs if q in (d["grnNo"] + d["fromAddress"]).lower()]
    return JSONResponse({"status": "success", "data": docs})


@router.post("/grc")
async def create_buyer_grc(payload: dict, ctx: dict = Depends(get_hq_tenant)):
    grn_no = (payload.get("grnNo") or "").strip()
    if not grn_no:
        grn_no = await _generate_grn_no()
    doc = {
        "grnNo":              grn_no,
        "ivNo":               (payload.get("ivNo") or "").strip(),
        "date":               (payload.get("date") or "").strip(),
        "challanBillApproval":payload.get("challanBillApproval", ""),
        "fromAddress":        payload.get("fromAddress", ""),
        "toAddress":          payload.get("toAddress", ""),
        "gstPercent":         payload.get("gstPercent", ""),
        "purchaseUnregd":     payload.get("purchaseUnregd", ""),
        "nonTaxable":         payload.get("nonTaxable", ""),
        "barCode":            payload.get("barCode", ""),
        "lessDiscount":       payload.get("lessDiscount", ""),
        "netAmount":          payload.get("netAmount", ""),
        "preparedBy":         payload.get("preparedBy", ""),
        "checkedBy":          payload.get("checkedBy", ""),
        "passedBy":           payload.get("passedBy", ""),
        "items":              payload.get("items", []),
        "createdAt":          datetime.utcnow(),
        "updatedAt":          datetime.utcnow(),
    }
    doc["tenant_id"] = ctx["tenant_id"]
    result = await mbuyer_grc_collection.insert_one(doc)
    return JSONResponse({
        "status": "success",
        "message": "GRC saved.",
        "id": str(result.inserted_id),
        "grnNo": grn_no,
    }, status_code=201)


@router.put("/grc/{doc_id}")
async def update_buyer_grc(doc_id: str, payload: dict, ctx: dict = Depends(get_hq_tenant)):
    try: oid = ObjectId(doc_id)
    except: raise HTTPException(status_code=400, detail="Invalid ID")
    patch = {
        "grnNo":              payload.get("grnNo", ""),
        "ivNo":               payload.get("ivNo", ""),
        "date":               payload.get("date", ""),
        "challanBillApproval":payload.get("challanBillApproval", ""),
        "fromAddress":        payload.get("fromAddress", ""),
        "toAddress":          payload.get("toAddress", ""),
        "gstPercent":         payload.get("gstPercent", ""),
        "purchaseUnregd":     payload.get("purchaseUnregd", ""),
        "nonTaxable":         payload.get("nonTaxable", ""),
        "barCode":            payload.get("barCode", ""),
        "lessDiscount":       payload.get("lessDiscount", ""),
        "netAmount":          payload.get("netAmount", ""),
        "preparedBy":         payload.get("preparedBy", ""),
        "checkedBy":          payload.get("checkedBy", ""),
        "passedBy":           payload.get("passedBy", ""),
        "items":              payload.get("items", []),
        "updatedAt":          datetime.utcnow(),
    }
    await mbuyer_grc_collection.update_one({"_id": oid}, {"$set": patch})
    return JSONResponse({"status": "success", "message": "GRC updated."})


@router.delete("/grc/{doc_id}")
async def delete_buyer_grc(doc_id: str, ctx: dict = Depends(get_hq_tenant)):
    try: oid = ObjectId(doc_id)
    except: raise HTTPException(status_code=400, detail="Invalid ID")
    await mbuyer_grc_collection.delete_one({"_id": oid})
    return JSONResponse({"status": "success", "message": "GRC deleted."})


# ═══════════════════════════════════════════════════════════════════════════════
# BUYER PRODUCT DESCRIPTION CRUD
# Collection: mbuyer_product_desc_collection
# Add to db.py:  mbuyer_product_desc_collection = db["mbuyer_product_descriptions"]
# ═══════════════════════════════════════════════════════════════════════════════

from app.db import mbuyer_product_desc_collection

@router.get("/product-descriptions")
async def get_product_descriptions(search: Optional[str] = Query(None), ctx: dict = Depends(get_hq_tenant)):
    docs = []
    async for d in mbuyer_product_desc_collection.find({"tenant_id": ctx["tenant_id"]}).sort("createdAt", -1):
        docs.append({
            "id":                      _str(d["_id"]),
            "image":                   d.get("image", None),   # base64 data URL stored as-is
            "productCode":             d.get("productCode", ""),
            "fabricComposition":       d.get("fabricComposition", ""),
            "productPrice":            d.get("productPrice", ""),
            "barcode":                 d.get("barcode", ""),
            "productShortDescription": d.get("productShortDescription", ""),
            "sizeAvailable":           d.get("sizeAvailable", ""),
            "colours":                 d.get("colours", ""),
            "createdAt": d["createdAt"].isoformat() if isinstance(d.get("createdAt"), datetime) else str(d.get("createdAt", "")),
        })
    if search:
        q = search.lower()
        docs = [d for d in docs if q in (
            d["productCode"] + d["fabricComposition"] +
            d["barcode"] + d["productShortDescription"]
        ).lower()]
    return JSONResponse({"status": "success", "data": docs})


@router.post("/product-descriptions")
async def create_product_description(payload: dict, ctx: dict = Depends(get_hq_tenant)):
    if not (payload.get("productCode") or "").strip():
        raise HTTPException(status_code=400, detail="Product Code is required.")
    doc = {
        "image":                   payload.get("image", None),
        "productCode":             (payload.get("productCode") or "").strip(),
        "fabricComposition":       (payload.get("fabricComposition") or "").strip(),
        "productPrice":            payload.get("productPrice", ""),
        "barcode":                 (payload.get("barcode") or "").strip(),
        "productShortDescription": (payload.get("productShortDescription") or "").strip(),
        "sizeAvailable":           (payload.get("sizeAvailable") or "").strip(),
        "colours":                 (payload.get("colours") or "").strip(),
        "createdAt":               datetime.utcnow(),
        "updatedAt":               datetime.utcnow(),
    }
    doc["tenant_id"] = ctx["tenant_id"]
    result = await mbuyer_product_desc_collection.insert_one(doc)
    return JSONResponse({
        "status": "success",
        "message": "Product added.",
        "id": str(result.inserted_id),
    }, status_code=201)


@router.put("/product-descriptions/{doc_id}")
async def update_product_description(doc_id: str, payload: dict, ctx: dict = Depends(get_hq_tenant)):
    try: oid = ObjectId(doc_id)
    except: raise HTTPException(status_code=400, detail="Invalid ID")
    patch = {
        "image":                   payload.get("image", None),
        "productCode":             (payload.get("productCode") or "").strip(),
        "fabricComposition":       (payload.get("fabricComposition") or "").strip(),
        "productPrice":            payload.get("productPrice", ""),
        "barcode":                 (payload.get("barcode") or "").strip(),
        "productShortDescription": (payload.get("productShortDescription") or "").strip(),
        "sizeAvailable":           (payload.get("sizeAvailable") or "").strip(),
        "colours":                 (payload.get("colours") or "").strip(),
        "updatedAt":               datetime.utcnow(),
    }
    await mbuyer_product_desc_collection.update_one({"_id": oid}, {"$set": patch})
    return JSONResponse({"status": "success", "message": "Product updated."})


@router.delete("/product-descriptions/{doc_id}")
async def delete_product_description(doc_id: str, ctx: dict = Depends(get_hq_tenant)):
    try: oid = ObjectId(doc_id)
    except: raise HTTPException(status_code=400, detail="Invalid ID")
    await mbuyer_product_desc_collection.delete_one({"_id": oid})
    return JSONResponse({"status": "success", "message": "Product deleted."})


# ═══════════════════════════════════════════════════════════════════════════════
# GR UPDATE & RETURN   →  mbuyer_gr_return_collection = db["mbuyer_gr_returns"]
# NEXT PLAN            →  mbuyer_next_plan_collection  = db["mbuyer_next_plans"]
# DEBIT NOTE           →  mbuyer_debit_note_collection = db["mbuyer_debit_notes"]
# ═══════════════════════════════════════════════════════════════════════════════

from app.db import mbuyer_gr_return_collection, mbuyer_next_plan_collection, mbuyer_debit_note_collection

# ── GR UPDATE & RETURN ────────────────────────────────────────────────────────

@router.get("/gr-returns")
async def get_gr_returns(search: Optional[str] = Query(None), ctx: dict = Depends(get_hq_tenant)):
    docs = []
    async for d in mbuyer_gr_return_collection.find({"tenant_id": ctx["tenant_id"]}).sort("createdAt", -1):
        docs.append({
            "id":              _str(d["_id"]),
            "itemDescription": d.get("itemDescription", ""),
            "colour":          d.get("colour", ""),
            "pcs":             d.get("pcs", ""),
            "size":            d.get("size", ""),
            "qc":              d.get("qc", ""),
            "photos":          d.get("photos", []),   # list of {id, src, name}
            "createdAt": d["createdAt"].isoformat() if isinstance(d.get("createdAt"), datetime) else "",
        })
    if search:
        q = search.lower()
        docs = [d for d in docs if q in (d["itemDescription"] + d["colour"] + d["qc"]).lower()]
    return JSONResponse({"status": "success", "data": docs})

@router.post("/gr-returns")
async def create_gr_return(payload: dict, ctx: dict = Depends(get_hq_tenant)):
    if not (payload.get("itemDescription") or "").strip():
        raise HTTPException(status_code=400, detail="Item description is required.")
    doc = {
        "itemDescription": payload.get("itemDescription", "").strip(),
        "colour":          payload.get("colour", ""),
        "pcs":             payload.get("pcs", ""),
        "size":            payload.get("size", ""),
        "qc":              payload.get("qc", ""),
        "photos":          payload.get("photos", []),
        "createdAt":       datetime.utcnow(),
        "updatedAt":       datetime.utcnow(),
    }
    doc["tenant_id"] = ctx["tenant_id"]
    result = await mbuyer_gr_return_collection.insert_one(doc)
    return JSONResponse({"status": "success", "message": "Record added.", "id": str(result.inserted_id)}, status_code=201)

@router.put("/gr-returns/{doc_id}")
async def update_gr_return(doc_id: str, payload: dict, ctx: dict = Depends(get_hq_tenant)):
    try: oid = ObjectId(doc_id)
    except: raise HTTPException(status_code=400, detail="Invalid ID")
    await mbuyer_gr_return_collection.update_one({"_id": oid}, {"$set": {
        "itemDescription": payload.get("itemDescription", ""),
        "colour":          payload.get("colour", ""),
        "pcs":             payload.get("pcs", ""),
        "size":            payload.get("size", ""),
        "qc":              payload.get("qc", ""),
        "photos":          payload.get("photos", []),
        "updatedAt":       datetime.utcnow(),
    }})
    return JSONResponse({"status": "success", "message": "Record updated."})

@router.delete("/gr-returns/{doc_id}")
async def delete_gr_return(doc_id: str, ctx: dict = Depends(get_hq_tenant)):
    try: oid = ObjectId(doc_id)
    except: raise HTTPException(status_code=400, detail="Invalid ID")
    await mbuyer_gr_return_collection.delete_one({"_id": oid})
    return JSONResponse({"status": "success", "message": "Record deleted."})


# ── NEXT PLAN ─────────────────────────────────────────────────────────────────

@router.get("/next-plans")
async def get_next_plans(search: Optional[str] = Query(None), ctx: dict = Depends(get_hq_tenant)):
    docs = []
    async for d in mbuyer_next_plan_collection.find({"tenant_id": ctx["tenant_id"]}).sort("createdAt", -1):
        docs.append({
            "id":       _str(d["_id"]),
            "vendor":   d.get("vendor", ""),
            "images":   d.get("images", []),   # list of base64 data URLs
            "fabric":   d.get("fabric", ""),
            "quantity": d.get("quantity", ""),
            "price":    d.get("price", ""),
            "size":     d.get("size", ""),
            "createdAt": d["createdAt"].isoformat() if isinstance(d.get("createdAt"), datetime) else "",
        })
    if search:
        q = search.lower()
        docs = [d for d in docs if q in (d["vendor"] + d["fabric"]).lower()]
    return JSONResponse({"status": "success", "data": docs})

@router.post("/next-plans")
async def create_next_plan(payload: dict, ctx: dict = Depends(get_hq_tenant)):
    if not (payload.get("vendor") or "").strip():
        raise HTTPException(status_code=400, detail="Vendor is required.")
    doc = {
        "vendor":   payload.get("vendor", "").strip(),
        "images":   payload.get("images", []),
        "fabric":   payload.get("fabric", ""),
        "quantity": payload.get("quantity", ""),
        "price":    payload.get("price", ""),
        "size":     payload.get("size", ""),
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
    }
    doc["tenant_id"] = ctx["tenant_id"]
    result = await mbuyer_next_plan_collection.insert_one(doc)
    return JSONResponse({"status": "success", "message": "Plan added.", "id": str(result.inserted_id)}, status_code=201)

@router.put("/next-plans/{doc_id}")
async def update_next_plan(doc_id: str, payload: dict, ctx: dict = Depends(get_hq_tenant)):
    try: oid = ObjectId(doc_id)
    except: raise HTTPException(status_code=400, detail="Invalid ID")
    await mbuyer_next_plan_collection.update_one({"_id": oid}, {"$set": {
        "vendor":    payload.get("vendor", ""),
        "images":    payload.get("images", []),
        "fabric":    payload.get("fabric", ""),
        "quantity":  payload.get("quantity", ""),
        "price":     payload.get("price", ""),
        "size":      payload.get("size", ""),
        "updatedAt": datetime.utcnow(),
    }})
    return JSONResponse({"status": "success", "message": "Plan updated."})

@router.delete("/next-plans/{doc_id}")
async def delete_next_plan(doc_id: str, ctx: dict = Depends(get_hq_tenant)):
    try: oid = ObjectId(doc_id)
    except: raise HTTPException(status_code=400, detail="Invalid ID")
    await mbuyer_next_plan_collection.delete_one({"_id": oid})
    return JSONResponse({"status": "success", "message": "Plan deleted."})


# ── DEBIT NOTE ────────────────────────────────────────────────────────────────

@router.get("/debit-notes")
async def get_debit_notes(search: Optional[str] = Query(None), ctx: dict = Depends(get_hq_tenant)):
    docs = []
    async for d in mbuyer_debit_note_collection.find({"tenant_id": ctx["tenant_id"]}).sort("createdAt", -1):
        docs.append({
            "id":                   _str(d["_id"]),
            "serialNo":             d.get("serialNo", ""),
            "date":                 d.get("date", ""),
            "originalInvoiceNo":    d.get("originalInvoiceNo", ""),
            "originalInvoiceDate":  d.get("originalInvoiceDate", ""),
            "placeOfSupply":        d.get("placeOfSupply", ""),
            "despatchThrough":      d.get("despatchThrough", ""),
            "receiverName":         d.get("receiverName", ""),
            "receiverAddress":      d.get("receiverAddress", ""),
            "receiverState":        d.get("receiverState", ""),
            "receiverCode":         d.get("receiverCode", ""),
            "receiverGSTIN":        d.get("receiverGSTIN", ""),
            "consigneeName":        d.get("consigneeName", ""),
            "consigneeAddress":     d.get("consigneeAddress", ""),
            "consigneeState":       d.get("consigneeState", ""),
            "consigneeCode":        d.get("consigneeCode", ""),
            "consigneeGSTIN":       d.get("consigneeGSTIN", ""),
            "items":                d.get("items", []),
            "cgstPercent":          d.get("cgstPercent", "0"),
            "sgstPercent":          d.get("sgstPercent", "0"),
            "igstPercent":          d.get("igstPercent", "5"),
            "totalAmountInWords":   d.get("totalAmountInWords", ""),
            "remarks":              d.get("remarks", ""),
            "companyPan":           d.get("companyPan", ""),
            "cinNo":                d.get("cinNo", ""),
            "vendorSeal":           d.get("vendorSeal", ""),
            "authorisedSignatory":  d.get("authorisedSignatory", ""),
            "createdAt": d["createdAt"].isoformat() if isinstance(d.get("createdAt"), datetime) else "",
        })
    if search:
        q = search.lower()
        docs = [d for d in docs if q in (d["originalInvoiceNo"] + d["receiverName"]).lower()]
    return JSONResponse({"status": "success", "data": docs})

@router.post("/debit-notes")
async def create_debit_note(payload: dict, ctx: dict = Depends(get_hq_tenant)):
    items = payload.get("items", [])
    # Strip local-only id from items before storing
    clean_items = [{k: v for k, v in it.items() if k != "id"} for it in items]
    doc = {
        "serialNo":             payload.get("serialNo", ""),
        "date":                 payload.get("date", ""),
        "originalInvoiceNo":    payload.get("originalInvoiceNo", ""),
        "originalInvoiceDate":  payload.get("originalInvoiceDate", ""),
        "placeOfSupply":        payload.get("placeOfSupply", ""),
        "despatchThrough":      payload.get("despatchThrough", ""),
        "receiverName":         payload.get("receiverName", ""),
        "receiverAddress":      payload.get("receiverAddress", ""),
        "receiverState":        payload.get("receiverState", ""),
        "receiverCode":         payload.get("receiverCode", ""),
        "receiverGSTIN":        payload.get("receiverGSTIN", ""),
        "consigneeName":        payload.get("consigneeName", ""),
        "consigneeAddress":     payload.get("consigneeAddress", ""),
        "consigneeState":       payload.get("consigneeState", ""),
        "consigneeCode":        payload.get("consigneeCode", ""),
        "consigneeGSTIN":       payload.get("consigneeGSTIN", ""),
        "items":                clean_items,
        "cgstPercent":          payload.get("cgstPercent", "0"),
        "sgstPercent":          payload.get("sgstPercent", "0"),
        "igstPercent":          payload.get("igstPercent", "5"),
        "totalAmountInWords":   payload.get("totalAmountInWords", ""),
        "remarks":              payload.get("remarks", ""),
        "companyPan":           payload.get("companyPan", ""),
        "cinNo":                payload.get("cinNo", ""),
        "vendorSeal":           payload.get("vendorSeal", ""),
        "authorisedSignatory":  payload.get("authorisedSignatory", ""),
        "createdAt":            datetime.utcnow(),
        "updatedAt":            datetime.utcnow(),
    }
    doc["tenant_id"] = ctx["tenant_id"]
    result = await mbuyer_debit_note_collection.insert_one(doc)
    return JSONResponse({"status": "success", "message": "Debit note saved.", "id": str(result.inserted_id)}, status_code=201)

@router.put("/debit-notes/{doc_id}")
async def update_debit_note(doc_id: str, payload: dict, ctx: dict = Depends(get_hq_tenant)):
    try: oid = ObjectId(doc_id)
    except: raise HTTPException(status_code=400, detail="Invalid ID")
    items = payload.get("items", [])
    clean_items = [{k: v for k, v in it.items() if k != "id"} for it in items]
    patch = {k: v for k, v in payload.items() if k not in ("id", "_id", "createdAt")}
    patch["items"] = clean_items
    patch["updatedAt"] = datetime.utcnow()
    await mbuyer_debit_note_collection.update_one({"_id": oid}, {"$set": patch})
    return JSONResponse({"status": "success", "message": "Debit note updated."})

@router.delete("/debit-notes/{doc_id}")
async def delete_debit_note(doc_id: str, ctx: dict = Depends(get_hq_tenant)):
    try: oid = ObjectId(doc_id)
    except: raise HTTPException(status_code=400, detail="Invalid ID")
    await mbuyer_debit_note_collection.delete_one({"_id": oid})
    return JSONResponse({"status": "success", "message": "Debit note deleted."})