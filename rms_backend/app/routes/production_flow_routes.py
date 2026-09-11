"""Hybrid internal/external garment production routing.

This layer tracks retailer-owned work-in-progress. It deliberately does not use
GRC/GRN, which remain purchase receiving documents. Only final QC-approved
finished goods are posted to inventory.
"""
from datetime import date, datetime
import re
import secrets
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException

from ..db import (
    daily_production_logs_collection,
    floor_workers_collection,
    production_batches_collection,
    production_routes_collection,
    tech_packs_collection,
    tenants_collection,
)
from .job_work_routes import (
    _increase_central_stock, _require_job_work, _require_vendor_job_work_access,
    _stock_scope, _vendor_session,
)

router = APIRouter(prefix="/api/production-flow", tags=["Hybrid Production"])

DEFAULT_STEPS = [
    {"name": "Pattern Making", "mode": "INTERNAL", "instructions": "Confirm the released pattern version, base size, grading and allowances before marking complete.", "sections": ["sketch", "measurements"]},
    {"name": "Layering", "mode": "INTERNAL", "instructions": "Confirm fabric shade, width, lay count, direction and shrinkage allowance before spreading.", "sections": ["fabric", "colourways"]},
    {"name": "Cutting", "mode": "INTERNAL", "instructions": "Use the approved marker and bundle cut panels by design, colour and size. Record rejects and waste.", "sections": ["sketch", "measurements", "details"]},
    {"name": "Stitching", "mode": "EXTERNAL", "instructions": "Issue counted cut-panel bundles and trims with the locked Tech Pack. Reconcile every returned piece.", "sections": ["measurements", "details", "trims", "artwork"]},
    {"name": "Finishing & Packing", "mode": "INTERNAL", "instructions": "Attach approved buttons, labels and tags; finish, press and pack only accepted pieces.", "sections": ["details", "trims", "colourways"]},
]
ALLOWED_MODES = {"INTERNAL", "EXTERNAL"}


def clean(value: Any, limit: int = 500) -> str:
    return str(value or "").strip()[:limit]


def number(value: Any, default: float = 0) -> float:
    try:
        return max(0.0, round(float(value), 3))
    except (TypeError, ValueError):
        return default


def serialize(value: Any) -> Any:
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, list):
        return [serialize(item) for item in value]
    if isinstance(value, dict):
        return {("id" if key == "_id" else key): serialize(item) for key, item in value.items()}
    return value


def clean_steps(raw: Any) -> list[dict]:
    if not isinstance(raw, list):
        return []
    steps = []
    for index, item in enumerate(raw[:30]):
        if not isinstance(item, dict):
            continue
        name = clean(item.get("name"), 100)
        mode = clean(item.get("mode"), 20).upper()
        if not name or mode not in ALLOWED_MODES:
            continue
        sections = [clean(section, 30).lower() for section in (item.get("sections") or []) if clean(section)][:10]
        steps.append({
            "index": len(steps), "name": name, "mode": mode,
            "instructions": clean(item.get("instructions"), 1500),
            "sections": sections,
        })
    return steps


async def get_batch(batch_id: str, tenant_id: str) -> dict:
    if not ObjectId.is_valid(batch_id):
        raise HTTPException(status_code=400, detail="Invalid production batch.")
    batch = await production_batches_collection.find_one({"_id": ObjectId(batch_id), "tenant_id": tenant_id})
    if not batch:
        raise HTTPException(status_code=404, detail="Production batch not found.")
    return batch


def operation_input(batch: dict, index: int) -> float:
    if index == 0:
        return number(batch.get("planned_quantity"))
    operations = batch.get("operations") or []
    return number(operations[index - 1].get("accepted_qty"))


def safe_barcode(value: str) -> str:
    return re.sub(r"[^A-Z0-9]+", "-", value.upper()).strip("-")[:64]


def parse_date(value: Any) -> date | None:
    try:
        return datetime.strptime(str(value or "").strip(), "%Y-%m-%d").date()
    except ValueError:
        return None


@router.get("/workspace")
async def workspace(ctx: dict = Depends(_require_job_work)):
    tenant_id = ctx["tenant_id"]
    routes = [serialize(row) async for row in production_routes_collection.find({"tenant_id": tenant_id}).sort("updated_at", -1).limit(100)]
    batches = [serialize(row) async for row in production_batches_collection.find({"tenant_id": tenant_id}).sort("updated_at", -1).limit(300)]
    workers = [serialize(row) async for row in floor_workers_collection.find({"tenant_id": tenant_id, "active": {"$ne": False}}).sort("name", 1).limit(500)]
    packs = [serialize(row) async for row in tech_packs_collection.find({"tenant_id": tenant_id, "status": "Released to Production"}).sort("updated_at", -1).limit(300)]
    return {
        "routes": routes, "batches": batches, "workers": workers, "tech_packs": packs,
        "default_steps": DEFAULT_STEPS,
        "guide": [
            "Create an operation route once for each production method.",
            "Create a batch from a released Tech Pack and choose the route.",
            "Each operation receives only the quantity accepted by the previous operation.",
            "Complete final QC to create a Finished-Goods Receipt and inventory stock.",
        ],
    }


@router.post("/routes", status_code=201)
async def create_route(payload: dict, ctx: dict = Depends(_require_job_work)):
    name = clean(payload.get("name"), 120)
    steps = clean_steps(payload.get("steps"))
    if not name or not steps:
        raise HTTPException(status_code=400, detail="Route name and at least one valid operation are required.")
    now = datetime.utcnow()
    row = {
        "tenant_id": ctx["tenant_id"], "name": name,
        "description": clean(payload.get("description"), 1000), "steps": steps,
        "active": True, "created_by": ctx.get("admin_id"), "created_at": now, "updated_at": now,
    }
    result = await production_routes_collection.insert_one(row)
    row["_id"] = result.inserted_id
    return {"message": f"Route {name} saved. Next, create a production batch with it.", "data": serialize(row)}


@router.delete("/routes/{route_id}")
async def delete_route(route_id: str, ctx: dict = Depends(_require_job_work)):
    if not ObjectId.is_valid(route_id):
        raise HTTPException(status_code=400, detail="Invalid route.")
    used = await production_batches_collection.find_one({"tenant_id": ctx["tenant_id"], "route_id": route_id}, {"_id": 1})
    if used:
        raise HTTPException(status_code=409, detail="This route is already used by a production batch and must remain for history.")
    result = await production_routes_collection.delete_one({"_id": ObjectId(route_id), "tenant_id": ctx["tenant_id"]})
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="Route not found.")
    return {"message": "Unused operation route deleted."}


@router.post("/batches", status_code=201)
async def create_batch(payload: dict, ctx: dict = Depends(_require_job_work)):
    tenant_id = ctx["tenant_id"]
    tech_pack_id = clean(payload.get("tech_pack_id"), 40)
    route_id = clean(payload.get("route_id"), 40)
    quantity = number(payload.get("planned_quantity"))
    if not ObjectId.is_valid(tech_pack_id) or not ObjectId.is_valid(route_id) or quantity <= 0:
        raise HTTPException(status_code=400, detail="Released Tech Pack, operation route and planned quantity are required.")
    pack = await tech_packs_collection.find_one({"_id": ObjectId(tech_pack_id), "tenant_id": tenant_id, "status": "Released to Production"})
    route = await production_routes_collection.find_one({"_id": ObjectId(route_id), "tenant_id": tenant_id, "active": {"$ne": False}})
    if not pack:
        raise HTTPException(status_code=400, detail="Choose a Tech Pack released to Production.")
    if not route:
        raise HTTPException(status_code=400, detail="Choose an active operation route.")
    now = datetime.utcnow()
    sequence = await production_batches_collection.count_documents({"tenant_id": tenant_id}) + 1
    operations = []
    for index, step in enumerate(route.get("steps") or []):
        operations.append({
            **step, "index": index, "status": "READY" if index == 0 else "PENDING",
            "worker_id": None, "worker_name": "", "workstation": "",
            "input_qty": quantity if index == 0 else 0, "accepted_qty": 0,
            "rejected_qty": 0, "rework_qty": 0, "started_at": None,
            "completed_at": None, "external_party": None, "history": [],
        })
    row = {
        "tenant_id": tenant_id, "batch_no": f"PB-{now.strftime('%y%m%d')}-{sequence:04d}",
        "display_token": secrets.token_urlsafe(24), "tech_pack_id": tech_pack_id,
        "tech_pack_no": pack.get("tech_pack_no"), "tech_pack_version": pack.get("version"),
        "design_no": pack.get("design_no"), "style_name": pack.get("style_name"),
        "tech_pack_snapshot": {key: serialize(value) for key, value in pack.items() if key not in {"_id", "tenant_id", "comments"}},
        "route_id": route_id, "route_name": route.get("name"), "planned_quantity": quantity,
        "unit": clean(payload.get("unit"), 20) or "pcs", "colour_size_breakdown": payload.get("colour_size_breakdown") if isinstance(payload.get("colour_size_breakdown"), list) else [],
        "due_date": clean(payload.get("due_date"), 10), "notes": clean(payload.get("notes"), 1500),
        "operations": operations, "current_operation_index": 0, "status": "PLANNED",
        "created_by": ctx.get("admin_id"), "created_at": now, "updated_at": now,
    }
    result = await production_batches_collection.insert_one(row)
    row["_id"] = result.inserted_id
    return {"message": f"Batch {row['batch_no']} created. Next, assign and start {operations[0]['name']}.", "data": serialize(row)}


@router.patch("/batches/{batch_id}/operations/{operation_index}/assign")
async def assign_operation(batch_id: str, operation_index: int, payload: dict, ctx: dict = Depends(_require_job_work)):
    batch = await get_batch(batch_id, ctx["tenant_id"])
    operations = list(batch.get("operations") or [])
    if operation_index < 0 or operation_index >= len(operations):
        raise HTTPException(status_code=404, detail="Operation not found.")
    operation = dict(operations[operation_index])
    if operation.get("status") in {"COMPLETED", "QC_COMPLETED"}:
        raise HTTPException(status_code=409, detail="Completed operations cannot be reassigned.")
    worker_id = clean(payload.get("worker_id"), 40)
    worker_name = clean(payload.get("worker_name"), 120)
    if worker_id:
        if not ObjectId.is_valid(worker_id):
            raise HTTPException(status_code=400, detail="Invalid internal worker.")
        worker = await floor_workers_collection.find_one({"_id": ObjectId(worker_id), "tenant_id": ctx["tenant_id"], "active": {"$ne": False}})
        if not worker:
            raise HTTPException(status_code=404, detail="Internal worker not found.")
        worker_name = worker.get("name", worker_name)
    if operation.get("mode") == "INTERNAL" and not worker_name:
        raise HTTPException(status_code=400, detail="Select an internal worker or enter the responsible supervisor.")
    if operation.get("mode") == "EXTERNAL" and not clean(payload.get("vendor_name"), 160):
        raise HTTPException(status_code=400, detail="Select a registered job worker or enter a walk-in vendor name.")
    operation.update({
        "worker_id": worker_id or None, "worker_name": worker_name,
        "workstation": clean(payload.get("workstation"), 100),
        "external_party": ({"vendor_id": clean(payload.get("vendor_id"), 40) or None, "vendor_name": clean(payload.get("vendor_name"), 160), "mobile": clean(payload.get("mobile"), 30), "due_date": clean(payload.get("due_date"), 10), "challan_no": clean(payload.get("challan_no"), 80), "instructions": clean(payload.get("handoff_notes"), 1000), "rate": number(payload.get("rate")) or None, "penalty_per_day": number(payload.get("penalty_per_day")) or None} if operation.get("mode") == "EXTERNAL" else None),
    })
    operations[operation_index] = operation
    await production_batches_collection.update_one({"_id": batch["_id"]}, {"$set": {"operations": operations, "updated_at": datetime.utcnow()}})
    next_text = "start this internal operation on the workstation display" if operation.get("mode") == "INTERNAL" else "issue the counted WIP bundles to the external job worker"
    return {"message": f"{operation['name']} assigned. Next, {next_text}."}


@router.post("/batches/{batch_id}/operations/{operation_index}/start")
async def start_operation(batch_id: str, operation_index: int, payload: dict, ctx: dict = Depends(_require_job_work)):
    batch = await get_batch(batch_id, ctx["tenant_id"])
    operations = list(batch.get("operations") or [])
    if operation_index < 0 or operation_index >= len(operations):
        raise HTTPException(status_code=404, detail="Operation not found.")
    operation = dict(operations[operation_index])
    if operation.get("status") not in {"READY", "REWORK_PENDING"}:
        raise HTTPException(status_code=409, detail="Complete the previous operation before starting this one.")
    if operation.get("mode") == "INTERNAL" and not operation.get("worker_name"):
        raise HTTPException(status_code=400, detail="Assign an internal worker or supervisor first.")
    if operation.get("mode") == "EXTERNAL" and not (operation.get("external_party") or {}).get("vendor_name"):
        raise HTTPException(status_code=400, detail="Assign a registered or walk-in external job worker first.")
    operation["input_qty"] = operation_input(batch, operation_index)
    operation["status"] = "IN_PROGRESS" if operation.get("mode") == "INTERNAL" else "EXTERNAL_ISSUED"
    operation["started_at"] = datetime.utcnow()
    operation["history"] = [*(operation.get("history") or []), {"event": operation["status"], "at": datetime.utcnow(), "by": ctx.get("admin_id"), "note": clean(payload.get("note"), 500)}]
    if operation.get("mode") == "EXTERNAL":
        # This is the real dispatch moment for retailer-owned WIP going to an
        # external job worker: the sent quantity is only known now (it comes
        # from the previous operation's accepted_qty), so the challan/ticket
        # is finalized here rather than at assign time.
        party = dict(operation.get("external_party") or {})
        sent_qty = operation["input_qty"]
        rate = number(party.get("rate")) or None
        party.update({
            "challan_no": party.get("challan_no") or f"{batch['batch_no']}-OP{operation_index + 1}",
            "sent_qty": sent_qty, "sent_at": operation["started_at"],
            "amount": round(sent_qty * rate, 2) if rate else None,
            "status": "SENT",
        })
        operation["external_party"] = party
    operations[operation_index] = operation
    await production_batches_collection.update_one({"_id": batch["_id"]}, {"$set": {"operations": operations, "status": "IN_PROGRESS", "current_operation_index": operation_index, "updated_at": datetime.utcnow()}})
    return {"message": f"{operation['name']} started with {operation['input_qty']} {batch.get('unit', 'pcs')}. Next, record accepted, rejected and rework quantities when it returns or finishes."}


@router.patch("/batches/{batch_id}/operations/{operation_index}/amend-due-date")
async def amend_due_date(batch_id: str, operation_index: int, payload: dict, ctx: dict = Depends(_require_job_work)):
    """A job that is out with an external worker can legitimately need a
    renegotiated return date. This is the only way to change the due date
    once a challan is issued — full reassignment is blocked by then — and
    every change is kept as history so a later-day-late/penalty calculation
    is judged against the date actually agreed at the time, not a stale one."""
    batch = await get_batch(batch_id, ctx["tenant_id"])
    operations = list(batch.get("operations") or [])
    if operation_index < 0 or operation_index >= len(operations):
        raise HTTPException(status_code=404, detail="Operation not found.")
    operation = dict(operations[operation_index])
    party = dict(operation.get("external_party") or {})
    if operation.get("mode") != "EXTERNAL" or not party or operation.get("status") not in {"EXTERNAL_ISSUED", "REWORK_PENDING"}:
        raise HTTPException(status_code=409, detail="Only an issued external operation's due date can be amended.")
    new_due_date = clean(payload.get("due_date"), 10)
    if not new_due_date or not parse_date(new_due_date):
        raise HTTPException(status_code=400, detail="A valid new due date (YYYY-MM-DD) is required.")
    now = datetime.utcnow()
    history = list(party.get("due_date_history") or [])
    history.append({"from": party.get("due_date") or "", "to": new_due_date, "note": clean(payload.get("note"), 500), "at": now, "by": ctx.get("admin_id")})
    party["due_date"] = new_due_date
    party["due_date_history"] = history
    operation["external_party"] = party
    operations[operation_index] = operation
    await production_batches_collection.update_one({"_id": batch["_id"]}, {"$set": {"operations": operations, "updated_at": now}})
    return {"message": f"Return date amended to {new_due_date}."}


@router.post("/batches/{batch_id}/operations/{operation_index}/complete")
async def complete_operation(batch_id: str, operation_index: int, payload: dict, ctx: dict = Depends(_require_job_work)):
    batch = await get_batch(batch_id, ctx["tenant_id"])
    operations = list(batch.get("operations") or [])
    if operation_index < 0 or operation_index >= len(operations):
        raise HTTPException(status_code=404, detail="Operation not found.")
    operation = dict(operations[operation_index])
    if operation.get("status") not in {"IN_PROGRESS", "EXTERNAL_ISSUED", "REWORK_PENDING"}:
        raise HTTPException(status_code=409, detail="Start or issue this operation before completing it.")
    input_qty = number(operation.get("input_qty")) or operation_input(batch, operation_index)
    accepted = number(payload.get("accepted_qty"))
    rejected = number(payload.get("rejected_qty"))
    rework = number(payload.get("rework_qty"))
    if round(accepted + rejected + rework, 3) != round(input_qty, 3):
        raise HTTPException(status_code=400, detail=f"Accepted + rejected + rework must equal the operation input ({input_qty}).")
    now = datetime.utcnow()
    operation.update({"accepted_qty": accepted, "rejected_qty": rejected, "rework_qty": rework, "remarks": clean(payload.get("remarks"), 1000), "completed_at": now if not rework else None, "status": "COMPLETED" if not rework else "REWORK_PENDING"})
    if operation.get("mode") == "EXTERNAL" and operation.get("external_party"):
        # Closes the loop opened when the challan was issued in start_operation:
        # the same qty-in/qty-out reconciliation an internal step already gets.
        party = operation["external_party"]
        due = parse_date(party.get("due_date"))
        days_late = max(0, (now.date() - due).days) if due else 0
        penalty_per_day = number(party.get("penalty_per_day")) or 0
        penalty_amount = round(penalty_per_day * days_late, 2) if days_late and penalty_per_day else 0
        gross_amount = party.get("amount")
        operation["external_party"] = {
            **party,
            "received_qty": round(accepted + rejected + rework, 3), "accepted_qty": accepted,
            "rejected_qty": rejected, "rework_qty": rework, "received_at": now,
            "status": "PARTIALLY_RECEIVED" if rework else "RECEIVED",
            "days_late": days_late, "penalty_amount": penalty_amount,
            "net_payable": round(max(0, gross_amount - penalty_amount), 2) if gross_amount is not None else None,
        }
    operation["history"] = [*(operation.get("history") or []), {"event": operation["status"], "at": now, "by": ctx.get("admin_id"), "accepted_qty": accepted, "rejected_qty": rejected, "rework_qty": rework}]
    operations[operation_index] = operation
    batch_status = "REWORK_PENDING" if rework else ("AWAITING_FINAL_QC" if operation_index == len(operations) - 1 else "IN_PROGRESS")
    next_index = operation_index
    if not rework and operation_index < len(operations) - 1:
        next_index = operation_index + 1
        operations[next_index] = {**operations[next_index], "status": "READY", "input_qty": accepted}
    await production_batches_collection.update_one({"_id": batch["_id"]}, {"$set": {"operations": operations, "status": batch_status, "current_operation_index": next_index, "updated_at": now}})
    if operation.get("mode") == "INTERNAL":
        await daily_production_logs_collection.insert_one({
            "tenant_id": ctx["tenant_id"], "date": now.date().isoformat(), "time": now.strftime("%H:%M"),
            "department": operation.get("name"), "worker_id": operation.get("worker_id"), "worker_name": operation.get("worker_name") or "Supervisor",
            "design_no": batch.get("design_no"), "source": "INTERNAL", "production_batch_id": batch_id,
            "target_qty": input_qty, "completed_qty": accepted, "rework_qty": rework, "rejected_qty": rejected,
            "fabric_used_mtrs": number(payload.get("fabric_used_mtrs")), "wastage_mtrs": number(payload.get("wastage_mtrs")),
            "on_time": bool(payload.get("on_time", True)), "remarks": clean(payload.get("remarks"), 1000),
            "created_by": ctx.get("admin_id"), "created_by_name": ctx.get("admin_name", ""), "created_at": now, "updated_at": now,
        })
    if rework:
        message = f"{operation['name']} has {rework} pieces in rework. Correct them and complete this same operation again."
    elif operation_index < len(operations) - 1:
        message = f"{accepted} pieces accepted from {operation['name']}. Next, assign/start {operations[next_index]['name']}."
    else:
        message = f"All route operations are complete with {accepted} pieces. Next, perform Final QC and post accepted outputs to inventory."
    return {"message": message}


@router.post("/batches/{batch_id}/final-qc")
async def final_qc(batch_id: str, payload: dict, ctx: dict = Depends(_require_job_work)):
    batch = await get_batch(batch_id, ctx["tenant_id"])
    operations = batch.get("operations") or []
    if not operations or operations[-1].get("status") != "COMPLETED" or batch.get("status") not in {"AWAITING_FINAL_QC", "FINAL_QC_REWORK"}:
        raise HTTPException(status_code=409, detail="Complete every route operation before Final QC.")
    available = number(operations[-1].get("accepted_qty"))
    outputs = payload.get("outputs") if isinstance(payload.get("outputs"), list) else []
    cleaned_outputs = []
    for index, item in enumerate(outputs[:100]):
        qty = number((item or {}).get("quantity"))
        if qty <= 0:
            continue
        colour = clean((item or {}).get("colour"), 60)
        size = clean((item or {}).get("size"), 30)
        generated = safe_barcode(f"FG-{batch.get('design_no')}-{colour or 'DEFAULT'}-{size or 'STD'}")
        cleaned_outputs.append({"colour": colour, "size": size, "quantity": qty, "barcode": clean((item or {}).get("barcode"), 80) or generated, "rate": number((item or {}).get("rate"))})
    accepted = round(sum(item["quantity"] for item in cleaned_outputs), 3)
    rejected = number(payload.get("rejected_qty"))
    rework = number(payload.get("rework_qty"))
    if round(accepted + rejected + rework, 3) != round(available, 3):
        raise HTTPException(status_code=400, detail=f"Output quantities + rejected + rework must equal {available} pieces available for Final QC.")
    if rework:
        await production_batches_collection.update_one({"_id": batch["_id"]}, {"$set": {"status": "FINAL_QC_REWORK", "final_qc": {"outputs": cleaned_outputs, "rejected_qty": rejected, "rework_qty": rework, "notes": clean(payload.get("notes"), 1000), "at": datetime.utcnow()}, "updated_at": datetime.utcnow()}})
        return {"message": f"Final QC recorded. {rework} pieces require rework; inventory has not been updated."}
    if accepted <= 0:
        raise HTTPException(status_code=400, detail="Add at least one accepted colour/size output.")
    store = await _stock_scope(ctx["tenant_id"])
    for output in cleaned_outputs:
        description = " / ".join(filter(None, [batch.get("style_name"), output.get("colour"), output.get("size")]))
        await _increase_central_stock(ctx["tenant_id"], output["barcode"], output["quantity"], description, output["rate"], f"Production Final QC {batch.get('batch_no')}", store=store, source="production_final_qc")
    now = datetime.utcnow()
    receipt = {"receipt_no": f"FGR-{now.strftime('%y%m%d')}-{str(batch['_id'])[-5:].upper()}", "outputs": cleaned_outputs, "accepted_qty": accepted, "rejected_qty": rejected, "rework_qty": 0, "notes": clean(payload.get("notes"), 1000), "qc_by": ctx.get("admin_id"), "qc_at": now}
    await production_batches_collection.update_one({"_id": batch["_id"]}, {"$set": {"status": "COMPLETED", "final_qc": receipt, "completed_at": now, "updated_at": now}})
    return {"message": f"Final QC complete. {accepted} pieces posted to inventory under Finished-Goods Receipt {receipt['receipt_no']}.", "data": serialize(receipt)}


@router.get("/vendor/challans")
async def vendor_challans(authorization: str = Header(None)):
    """Vendor portal: read-only list of this vendor's Hybrid Production
    challans across every retailer tenant they work with — mirrors
    job_work_routes.vendor_job_work_orders for the full-order flow. A
    walk-in vendor (no vendor_id, no login) never reaches this endpoint;
    their side of the handoff stays a phone call / physical handoff, same
    as it is for internal floor workers who also have no login."""
    vendor_id = _vendor_session(authorization)
    await _require_vendor_job_work_access(vendor_id)
    tenant_names: dict[str, str] = {}
    rows = []
    async for batch in production_batches_collection.find({"operations.external_party.vendor_id": vendor_id}).sort("updated_at", -1).limit(300):
        tenant_id = batch.get("tenant_id", "")
        if tenant_id not in tenant_names:
            tenant = await tenants_collection.find_one({"tenant_id": tenant_id}, {"company_name": 1, "name": 1})
            tenant_names[tenant_id] = (tenant or {}).get("company_name") or (tenant or {}).get("name") or tenant_id
        for index, op in enumerate(batch.get("operations") or []):
            party = op.get("external_party") or {}
            if party.get("vendor_id") != vendor_id:
                continue
            rows.append(serialize({
                "retailer_name": tenant_names[tenant_id], "batch_id": batch["_id"], "batch_no": batch.get("batch_no"),
                "design_no": batch.get("design_no"), "style_name": batch.get("style_name"), "unit": batch.get("unit"),
                "operation_index": index, "operation_name": op.get("name"), "operation_status": op.get("status"),
                "challan_no": party.get("challan_no"), "sent_qty": party.get("sent_qty"), "sent_at": party.get("sent_at"),
                "due_date": party.get("due_date"), "rate": party.get("rate"), "amount": party.get("amount"),
                "status": party.get("status"), "vendor_marked_ready_at": party.get("vendor_marked_ready_at"),
                "vendor_ready_note": party.get("vendor_ready_note"),
                "received_qty": party.get("received_qty"), "accepted_qty": party.get("accepted_qty"),
                "rejected_qty": party.get("rejected_qty"), "days_late": party.get("days_late"),
            }))
    return {"data": rows}


@router.post("/vendor/challans/{batch_id}/{operation_index}/ready")
async def vendor_mark_challan_ready(batch_id: str, operation_index: int, payload: dict | None = None, authorization: str = Header(None)):
    """Vendor's own "I'm done, sending it back" signal. Purely advisory —
    like vendor_update_job_work_progress in job_work_routes.py, it never
    changes quantities, stock or operation status. The retailer's own
    physical inspection at Record Completion remains the only real QC step."""
    vendor_id = _vendor_session(authorization)
    await _require_vendor_job_work_access(vendor_id)
    if not ObjectId.is_valid(batch_id):
        raise HTTPException(status_code=400, detail="Invalid production batch.")
    batch = await production_batches_collection.find_one({"_id": ObjectId(batch_id)})
    if not batch:
        raise HTTPException(status_code=404, detail="Production batch not found.")
    operations = list(batch.get("operations") or [])
    if operation_index < 0 or operation_index >= len(operations):
        raise HTTPException(status_code=404, detail="Operation not found.")
    operation = dict(operations[operation_index])
    party = dict(operation.get("external_party") or {})
    if party.get("vendor_id") != vendor_id:
        raise HTTPException(status_code=404, detail="This challan is not assigned to you.")
    if operation.get("status") != "EXTERNAL_ISSUED":
        raise HTTPException(status_code=409, detail="This job is not currently awaiting your work.")
    payload = payload or {}
    now = datetime.utcnow()
    party["vendor_marked_ready_at"] = now
    party["vendor_ready_note"] = clean(payload.get("note"), 500)
    party["vendor_ready_qty"] = number(payload.get("qty")) or None
    operation["external_party"] = party
    operations[operation_index] = operation
    await production_batches_collection.update_one({"_id": batch["_id"]}, {"$set": {"operations": operations, "updated_at": now}})
    return {"message": "Marked ready. The retailer will confirm after physically inspecting the returned pieces."}


@router.get("/display/{display_token}")
async def workstation_display(display_token: str):
    batch = await production_batches_collection.find_one({"display_token": clean(display_token, 100)})
    if not batch:
        raise HTTPException(status_code=404, detail="Workstation display link is invalid.")
    index = int(batch.get("current_operation_index") or 0)
    operations = batch.get("operations") or []
    operation = operations[index] if index < len(operations) else None
    public_operation = None
    if operation:
        public_operation = {
            key: operation.get(key)
            for key in ("index", "name", "mode", "instructions", "sections", "status", "input_qty", "accepted_qty", "rejected_qty", "rework_qty", "workstation")
        }
        public_operation["worker_name"] = operation.get("worker_name") or (operation.get("external_party") or {}).get("vendor_name")
    public_sequence = [
        {key: row.get(key) for key in ("index", "name", "mode", "status")}
        for row in operations
    ]
    return {"batch": serialize({"batch_no": batch.get("batch_no"), "design_no": batch.get("design_no"), "style_name": batch.get("style_name"), "planned_quantity": batch.get("planned_quantity"), "unit": batch.get("unit"), "due_date": batch.get("due_date"), "status": batch.get("status"), "tech_pack_no": batch.get("tech_pack_no"), "tech_pack_version": batch.get("tech_pack_version"), "tech_pack_snapshot": batch.get("tech_pack_snapshot"), "operation": public_operation, "operations": public_sequence})}