"""Operational Design & Pattern workflow linked to Production tech packs."""
from datetime import datetime
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
import cloudinary
import cloudinary.uploader
from ..config import settings

from ..db import (
    design_artworks_collection, design_change_requests_collection,
    design_patterns_collection, design_projects_collection,
    design_queries_collection, design_research_collection, design_samples_collection,
    job_work_orders_collection, sales_collection, style_bom_plans_collection, tech_packs_collection,
)
from .deps import get_hq_tenant

router = APIRouter(prefix="/api/design-pattern", tags=["Design & Pattern"])
cloudinary.config(cloud_name=settings.cloudinary_cloud_name, api_key=settings.cloudinary_api_key, api_secret=settings.cloudinary_api_secret, secure=True)

PROJECT_STATUSES = {"IDEA", "IN_DEVELOPMENT", "PATTERN_DEVELOPMENT", "SAMPLE_DEVELOPMENT", "REVISION_REQUIRED", "AWAITING_APPROVAL", "APPROVED_FOR_PRODUCTION", "RELEASED_TO_PRODUCTION", "ON_HOLD", "REJECTED", "ARCHIVED"}
SAMPLE_DECISIONS = {"PENDING", "APPROVED", "APPROVED_WITH_COMMENTS", "REVISION_REQUIRED", "REJECTED", "RESAMPLE_REQUIRED"}

def clean(value: Any, limit: int = 500) -> str:
    return str(value or "").strip()[:limit]

def number(value: Any, default: float = 0) -> float:
    try: return max(0, float(value or default))
    except (TypeError, ValueError): return default

def serialize(row: dict) -> dict:
    result = dict(row)
    result["id"] = str(result.pop("_id"))
    for key, value in list(result.items()):
        if isinstance(value, datetime): result[key] = value.isoformat()
    return result

async def require_design(ctx: dict = Depends(get_hq_tenant)) -> dict:
    depts = set(ctx.get("_managed_departments") or [])
    permissions = set(ctx.get("_permissions") or [])
    if "Design & Pattern" not in depts and "design_pattern" not in permissions:
        raise HTTPException(status_code=403, detail="Design & Pattern department access is required.")
    return ctx

async def require_design_or_production(ctx: dict = Depends(get_hq_tenant)) -> dict:
    depts = set(ctx.get("_managed_departments") or []); permissions = set(ctx.get("_permissions") or [])
    if not ({"Design & Pattern", "Production & Job Work"} & depts or {"design_pattern", "job_work"} & permissions):
        raise HTTPException(status_code=403, detail="Design or Production access is required.")
    return ctx

async def project_or_404(project_id: str, tenant_id: str) -> dict:
    if not ObjectId.is_valid(project_id): raise HTTPException(status_code=400, detail="Invalid design project.")
    row = await design_projects_collection.find_one({"_id": ObjectId(project_id), "tenant_id": tenant_id})
    if not row: raise HTTPException(status_code=404, detail="Design project not found.")
    return row

@router.post("/assets", status_code=201)
async def upload_assets(files: list[UploadFile] = File(...), ctx: dict = Depends(require_design)):
    if not files or len(files) > 12: raise HTTPException(status_code=400, detail="Upload between 1 and 12 files at a time.")
    rows = []
    for file in files:
        raw = await file.read()
        if not raw: continue
        if len(raw) > 25 * 1024 * 1024: raise HTTPException(status_code=413, detail=f"{file.filename} exceeds 25 MB.")
        try:
            result = cloudinary.uploader.upload(raw, folder=f"rms/design-pattern/{ctx['tenant_id']}", resource_type="auto", use_filename=True, unique_filename=True)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Could not upload {file.filename}: {exc}")
        rows.append({"name": clean(file.filename, 240), "url": result.get("secure_url") or result.get("url"), "resource_type": result.get("resource_type"), "format": result.get("format"), "bytes": len(raw)})
    return {"message": f"{len(rows)} asset(s) uploaded.", "data": rows}

@router.get("/workspace")
async def workspace(ctx: dict = Depends(require_design)):
    tenant = ctx["tenant_id"]
    async def rows(collection, limit=300):
        return [serialize(r) async for r in collection.find({"tenant_id": tenant}).sort("updated_at", -1).limit(limit)]
    projects = await rows(design_projects_collection)
    patterns = await rows(design_patterns_collection)
    samples = await rows(design_samples_collection)
    queries = await rows(design_queries_collection)
    research = await rows(design_research_collection)
    artworks = await rows(design_artworks_collection)
    changes = await rows(design_change_requests_collection)
    packs = [serialize(r) async for r in tech_packs_collection.find({"tenant_id": tenant}).sort("updated_at", -1).limit(300)]
    plans = [serialize(r) async for r in style_bom_plans_collection.find({"tenant_id": tenant}).sort("updated_at", -1).limit(300)]
    return {"projects": projects, "patterns": patterns, "samples": samples, "queries": queries, "research": research, "artworks": artworks, "change_requests": changes, "tech_packs": packs, "material_plans": plans}

@router.get("/collaboration")
async def collaboration(ctx: dict = Depends(require_design_or_production)):
    tenant = ctx["tenant_id"]
    projects = [serialize(r) async for r in design_projects_collection.find({"tenant_id": tenant}, {"design_no": 1, "style_name": 1, "status": 1, "updated_at": 1}).sort("updated_at", -1).limit(300)]
    queries = [serialize(r) async for r in design_queries_collection.find({"tenant_id": tenant}).sort("updated_at", -1).limit(300)]
    changes = [serialize(r) async for r in design_change_requests_collection.find({"tenant_id": tenant}).sort("updated_at", -1).limit(300)]
    samples = [serialize(r) async for r in design_samples_collection.find({"tenant_id": tenant}).sort("updated_at", -1).limit(300)]
    today = datetime.utcnow().date().isoformat()
    notifications = ([{"kind":"QUERY", "title":q["query_no"], "message":q.get("description",""), "priority":q.get("priority","MEDIUM")} for q in queries if q.get("status") not in {"RESOLVED","CLOSED"}] +
        [{"kind":"CHANGE", "title":c["change_no"], "message":c.get("reason",""), "priority":"HIGH"} for c in changes if c.get("status")=="PENDING_PRODUCTION_REVIEW"] +
        [{"kind":"OVERDUE_SAMPLE", "title":s["sample_no"], "message":f"Sample for {s.get('design_no')} was due {s.get('required_date')}", "priority":"URGENT"} for s in samples if s.get("decision")=="PENDING" and s.get("required_date") and s["required_date"] < today])
    return {"projects": projects, "queries": queries, "change_requests": changes, "samples": samples, "notifications": notifications}

@router.get("/insights")
async def insights(ctx: dict = Depends(require_design)):
    tenant=ctx["tenant_id"]; projects=[r async for r in design_projects_collection.find({"tenant_id":tenant})]
    samples=[r async for r in design_samples_collection.find({"tenant_id":tenant})]; plans=[r async for r in style_bom_plans_collection.find({"tenant_id":tenant})]
    sales_by_design={}
    async for row in sales_collection.find({"tenant_id":tenant}, {"CAT1":1,"category1":1,"BILLQTY":1,"quantity":1}):
        key=clean(row.get("CAT1") or row.get("category1"),120); sales_by_design[key]=sales_by_design.get(key,0)+number(row.get("BILLQTY") or row.get("quantity"))
    plan_by_id={str(p["_id"]):p for p in plans}; rows=[]
    for p in projects:
        plan=plan_by_id.get(p.get("material_plan_id")); material_cost=sum(number(x.get("required_quantity"))*number(x.get("rate")) for x in (plan or {}).get("materials",[]))
        sample_cost=sum(number(s.get("actual_cost") or s.get("estimated_cost")) for s in samples if s.get("project_id")==str(p["_id"]))
        rows.append({"project_id":str(p["_id"]),"design_no":p.get("design_no"),"style_name":p.get("style_name"),"status":p.get("status"),"material_cost":round(material_cost,2),"sample_cost":round(sample_cost,2),"target_cost":number(p.get("target_cost")),"sales_units":round(sales_by_design.get(p.get("design_no"),0),2)})
    return {"data":rows}

@router.post("/projects", status_code=201)
async def create_project(payload: dict, ctx: dict = Depends(require_design)):
    style = clean(payload.get("style_name"), 160)
    if not style: raise HTTPException(status_code=400, detail="Style name is required.")
    now = datetime.utcnow(); tenant = ctx["tenant_id"]
    seq = await design_projects_collection.count_documents({"tenant_id": tenant}) + 1
    row = {
        "tenant_id": tenant, "design_no": clean(payload.get("design_no"), 120) or f"DES-{now.strftime('%y%m%d')}-{seq:04d}",
        "style_name": style, "department": clean(payload.get("department"), 80), "category": clean(payload.get("category"), 100),
        "theme": clean(payload.get("theme"), 120), "collection": clean(payload.get("collection"), 120), "season": clean(payload.get("season"), 80),
        "designer": clean(payload.get("designer"), 120), "target_customer": clean(payload.get("target_customer"), 160),
        "target_cost": number(payload.get("target_cost")), "planned_quantity": number(payload.get("planned_quantity")),
        "launch_date": clean(payload.get("launch_date"), 20), "priority": clean(payload.get("priority"), 30) or "MEDIUM",
        "description": clean(payload.get("description"), 2000), "moodboard_urls": [clean(x, 1000) for x in payload.get("moodboard_urls", []) if clean(x)],
        "document_urls": [clean(x, 1000) for x in payload.get("document_urls", []) if clean(x)], "status": "IDEA", "tech_pack_id": None, "material_plan_id": None,
        "created_by": ctx.get("admin_id"), "created_at": now, "updated_at": now,
    }
    if await design_projects_collection.find_one({"tenant_id": tenant, "design_no": row["design_no"]}):
        raise HTTPException(status_code=409, detail="This design number already exists.")
    result = await design_projects_collection.insert_one(row); row["_id"] = result.inserted_id
    return {"message": f"Design project {row['design_no']} created.", "data": serialize(row)}

@router.patch("/projects/{project_id}")
async def update_project(project_id: str, payload: dict, ctx: dict = Depends(require_design)):
    row = await project_or_404(project_id, ctx["tenant_id"])
    allowed = {"style_name", "department", "category", "theme", "collection", "season", "designer", "target_customer", "launch_date", "priority", "description"}
    update = {k: clean(payload[k], 2000 if k == "description" else 160) for k in allowed if k in payload}
    if "status" in payload:
        status = clean(payload["status"], 40).upper()
        if status not in PROJECT_STATUSES: raise HTTPException(status_code=400, detail="Invalid project status.")
        update["status"] = status
    update["updated_at"] = datetime.utcnow()
    for key in ("moodboard_urls", "document_urls"):
        if key in payload: update[key] = [clean(x, 1000) for x in payload[key] if clean(x)][:30]
    await design_projects_collection.update_one({"_id": row["_id"]}, {"$set": update})
    return {"message": "Design project updated."}

@router.post("/projects/{project_id}/approval")
async def record_approval(project_id: str, payload: dict, ctx: dict = Depends(require_design_or_production)):
    project = await project_or_404(project_id, ctx["tenant_id"])
    approval_type = clean(payload.get("approval_type"), 50).upper()
    if approval_type not in {"DESIGN_HEAD", "PRODUCTION_FEASIBILITY"}: raise HTTPException(status_code=400, detail="Invalid approval type.")
    depts = set(ctx.get("_managed_departments") or []); permissions = set(ctx.get("_permissions") or [])
    if approval_type == "DESIGN_HEAD" and not ("Design & Pattern" in depts or "design_pattern" in permissions): raise HTTPException(status_code=403, detail="Design approval requires Design & Pattern access.")
    if approval_type == "PRODUCTION_FEASIBILITY" and not ("Production & Job Work" in depts or "job_work" in permissions): raise HTTPException(status_code=403, detail="Feasibility approval requires Production access.")
    approval = {"type": approval_type, "decision": clean(payload.get("decision"), 30).upper() or "APPROVED", "note": clean(payload.get("note"), 1000), "by": ctx.get("admin_name"), "at": datetime.utcnow()}
    await design_projects_collection.update_one({"_id": project["_id"]}, {"$pull": {"approvals": {"type": approval_type}}})
    await design_projects_collection.update_one({"_id": project["_id"]}, {"$push": {"approvals": approval}, "$set": {"updated_at": datetime.utcnow()}})
    return {"message": f"{approval_type.replace('_', ' ').title()} decision recorded."}

@router.post("/patterns", status_code=201)
async def create_pattern(payload: dict, ctx: dict = Depends(require_design)):
    project = await project_or_404(clean(payload.get("project_id"), 40), ctx["tenant_id"])
    version = clean(payload.get("version"), 30) or "v1"; now = datetime.utcnow()
    seq = await design_patterns_collection.count_documents({"tenant_id": ctx["tenant_id"]}) + 1
    row = {"tenant_id": ctx["tenant_id"], "project_id": str(project["_id"]), "design_no": project["design_no"],
           "pattern_no": clean(payload.get("pattern_no"), 100) or f"PAT-{now.strftime('%y%m%d')}-{seq:04d}", "pattern_name": clean(payload.get("pattern_name"), 160),
           "version": version, "base_size": clean(payload.get("base_size"), 30), "sizes": [clean(x, 20) for x in payload.get("sizes", []) if clean(x, 20)],
           "measurement_rows": [{"point": clean(r.get("point"), 80), "base_value": clean(r.get("base_value"), 30), "grades": {clean(k,20): clean(v,30) for k,v in (r.get("grades") or {}).items()}} for r in payload.get("measurement_rows", []) if isinstance(r, dict) and clean(r.get("point"))][:100],
           "fabric_width": clean(payload.get("fabric_width"), 50), "consumption_per_unit": number(payload.get("consumption_per_unit")),
           "wastage_pct": number(payload.get("wastage_pct")), "marker_length": clean(payload.get("marker_length"), 50), "marker_efficiency": number(payload.get("marker_efficiency")),
           "seam_allowance": clean(payload.get("seam_allowance"), 100), "shrinkage_allowance": clean(payload.get("shrinkage_allowance"), 100),
           "file_urls": [clean(x, 1000) for x in payload.get("file_urls", []) if clean(x)][:30], "notes": clean(payload.get("notes"), 2000), "status": clean(payload.get("status"), 40) or "DRAFT",
           "created_by": ctx.get("admin_id"), "created_at": now, "updated_at": now}
    result = await design_patterns_collection.insert_one(row); row["_id"] = result.inserted_id
    await design_projects_collection.update_one({"_id": project["_id"]}, {"$set": {"status": "PATTERN_DEVELOPMENT", "updated_at": now}})
    return {"message": f"Pattern {row['pattern_no']} saved.", "data": serialize(row)}

@router.post("/patterns/{pattern_id}/revision", status_code=201)
async def revise_pattern(pattern_id: str, payload: dict, ctx: dict = Depends(require_design)):
    if not ObjectId.is_valid(pattern_id): raise HTTPException(status_code=400, detail="Invalid pattern.")
    source = await design_patterns_collection.find_one({"_id": ObjectId(pattern_id), "tenant_id": ctx["tenant_id"]})
    if not source: raise HTTPException(status_code=404, detail="Pattern not found.")
    source.pop("_id"); now = datetime.utcnow(); source.update({"version": clean(payload.get("version"),30) or f"{source.get('version','v1')}-revision", "status":"DRAFT", "revision_reason":clean(payload.get("reason"),1000), "revised_from":pattern_id, "created_at":now, "updated_at":now, "created_by":ctx.get("admin_id")})
    result = await design_patterns_collection.insert_one(source); source["_id"] = result.inserted_id
    return {"message": f"Pattern revision {source['version']} created.", "data": serialize(source)}

@router.post("/tech-packs/{tech_pack_id}/revision", status_code=201)
async def revise_tech_pack(tech_pack_id: str, payload: dict, ctx: dict = Depends(require_design)):
    if not ObjectId.is_valid(tech_pack_id): raise HTTPException(status_code=400, detail="Invalid tech pack.")
    source = await tech_packs_collection.find_one({"_id": ObjectId(tech_pack_id), "tenant_id": ctx["tenant_id"]})
    if not source: raise HTTPException(status_code=404, detail="Tech pack not found.")
    source.pop("_id"); now=datetime.utcnow(); seq=await tech_packs_collection.count_documents({"tenant_id":ctx["tenant_id"]})+1
    source.update({"tech_pack_no":f"TP-{now.strftime('%y%m%d')}-{seq:04d}", "version":clean(payload.get("version"),30) or f"{source.get('version','v1')}-revision", "status":"Draft", "revision_reason":clean(payload.get("reason"),1000), "revised_from":tech_pack_id, "created_at":now, "updated_at":now, "created_by":ctx.get("admin_id")})
    result=await tech_packs_collection.insert_one(source); source["_id"]=result.inserted_id
    return {"message":f"Tech Pack revision {source['version']} created.", "data":serialize(source)}

@router.post("/samples", status_code=201)
async def create_sample(payload: dict, ctx: dict = Depends(require_design)):
    project = await project_or_404(clean(payload.get("project_id"), 40), ctx["tenant_id"]); now = datetime.utcnow()
    decision = clean(payload.get("decision"), 40).upper() or "PENDING"
    if decision not in SAMPLE_DECISIONS: raise HTTPException(status_code=400, detail="Invalid sample decision.")
    seq = await design_samples_collection.count_documents({"tenant_id": ctx["tenant_id"]}) + 1
    row = {"tenant_id": ctx["tenant_id"], "project_id": str(project["_id"]), "design_no": project["design_no"], "sample_no": f"SMP-{now.strftime('%y%m%d')}-{seq:04d}",
           "sample_type": clean(payload.get("sample_type"), 80) or "Development sample", "pattern_id": clean(payload.get("pattern_id"), 40) or None,
           "quantity": max(1, number(payload.get("quantity"), 1)), "required_date": clean(payload.get("required_date"), 20), "received_date": clean(payload.get("received_date"), 20),
           "assigned_to": clean(payload.get("assigned_to"), 160), "estimated_cost": number(payload.get("estimated_cost")), "actual_cost": number(payload.get("actual_cost")),
           "materials": clean(payload.get("materials"), 1500), "image_urls": [clean(x, 1000) for x in payload.get("image_urls", []) if clean(x)][:20],
           "decision": decision, "fit_result": clean(payload.get("fit_result"), 1000), "construction_result": clean(payload.get("construction_result"), 1000),
           "review_notes": clean(payload.get("review_notes"), 2000), "created_by": ctx.get("admin_id"), "created_at": now, "updated_at": now}
    result = await design_samples_collection.insert_one(row); row["_id"] = result.inserted_id
    status = "AWAITING_APPROVAL" if decision in {"APPROVED", "APPROVED_WITH_COMMENTS"} else "REVISION_REQUIRED" if decision != "PENDING" else "SAMPLE_DEVELOPMENT"
    await design_projects_collection.update_one({"_id": project["_id"]}, {"$set": {"status": status, "updated_at": now}})
    return {"message": f"Sample review {row['sample_no']} saved.", "data": serialize(row)}

@router.post("/samples/{sample_id}/job-order", status_code=201)
async def create_sample_job_order(sample_id: str, payload: dict, ctx: dict = Depends(require_design_or_production)):
    depts=set(ctx.get("_managed_departments") or []); permissions=set(ctx.get("_permissions") or [])
    if "Production & Job Work" not in depts and "job_work" not in permissions: raise HTTPException(status_code=403, detail="Production approval is required to create a sample job order.")
    if not ObjectId.is_valid(sample_id): raise HTTPException(status_code=400, detail="Invalid sample.")
    sample=await design_samples_collection.find_one({"_id":ObjectId(sample_id),"tenant_id":ctx["tenant_id"]})
    if not sample: raise HTTPException(status_code=404, detail="Sample not found.")
    if sample.get("job_work_order_id"): raise HTTPException(status_code=400, detail="This sample already has a job work order.")
    project=await project_or_404(sample["project_id"],ctx["tenant_id"]); worker=clean(payload.get("job_worker_name") or sample.get("assigned_to"),160)
    if not worker: raise HTTPException(status_code=400, detail="Job worker name is required.")
    now=datetime.utcnow(); seq=await job_work_orders_collection.count_documents({"tenant_id":ctx["tenant_id"]})+1
    pack=await tech_packs_collection.find_one({"tenant_id":ctx["tenant_id"],"design_no":project["design_no"]},sort=[("updated_at",-1)])
    line={"design_no":project["design_no"],"department":project.get("department",""),"product_type":project.get("style_name",""),"quantity":number(sample.get("quantity"),1),"unit":"pcs","rate":0,"remarks":f"{sample.get('sample_type')} · {sample.get('review_notes','')}","tech_pack_id":str(pack["_id"]) if pack else "","image_urls":sample.get("image_urls",[])}
    if pack: line["tech_pack"]={k:pack.get(k) for k in ("tech_pack_no","version","design_no","style_name","department","description","fabric_notes","measurement_rows","construction_notes","artwork_notes","trims_items","colourways","sketch_images","details_images","artwork_images","trims_images","colourway_images")}
    order={"tenant_id":ctx["tenant_id"],"order_no":f"JWO-{now.strftime('%y%m%d')}-{seq:04d}","job_worker_name":worker,"assigned_vendor_id":clean(payload.get("vendor_id"),40) or None,"job_work_type":clean(payload.get("job_work_type"),40) or "Stitching","finished_product":f"Sample · {project['style_name']}","expected_quantity":number(sample.get("quantity"),1),"unit":"pcs","design_lines":[line],"due_date":sample.get("required_date",""),"remarks":f"Sample order {sample.get('sample_no')}. {sample.get('materials','')}","materials":[],"outputs":[],"status":"DRAFT","source":"DESIGN_SAMPLE","sample_id":sample_id,"created_by":ctx.get("admin_id"),"created_at":now,"updated_at":now}
    result=await job_work_orders_collection.insert_one(order)
    await design_samples_collection.update_one({"_id":sample["_id"]},{"$set":{"job_work_order_id":str(result.inserted_id),"job_work_order_no":order["order_no"],"assigned_to":worker,"updated_at":now}})
    return {"message":f"Sample job {order['order_no']} created. Issue its material from Job Work Orders.","order_id":str(result.inserted_id)}

@router.post("/samples/{sample_id}/job-order", status_code=201)
async def create_sample_job_order(sample_id: str, payload: dict, ctx: dict = Depends(require_design_or_production)):
    depts=set(ctx.get("_managed_departments") or []); permissions=set(ctx.get("_permissions") or [])
    if "Production & Job Work" not in depts and "job_work" not in permissions: raise HTTPException(status_code=403, detail="Production approval is required to create a sample job order.")
    if not ObjectId.is_valid(sample_id): raise HTTPException(status_code=400, detail="Invalid sample.")
    sample=await design_samples_collection.find_one({"_id":ObjectId(sample_id),"tenant_id":ctx["tenant_id"]})
    if not sample: raise HTTPException(status_code=404, detail="Sample not found.")
    if sample.get("job_work_order_id"): raise HTTPException(status_code=400, detail="This sample already has a job work order.")
    project=await project_or_404(sample["project_id"],ctx["tenant_id"]); worker=clean(payload.get("job_worker_name") or sample.get("assigned_to"),160)
    if not worker: raise HTTPException(status_code=400, detail="Job worker name is required.")
    now=datetime.utcnow(); seq=await job_work_orders_collection.count_documents({"tenant_id":ctx["tenant_id"]})+1
    pack=await tech_packs_collection.find_one({"tenant_id":ctx["tenant_id"],"design_no":project["design_no"]},sort=[("updated_at",-1)])
    line={"design_no":project["design_no"],"department":project.get("department",""),"product_type":project.get("style_name",""),"quantity":number(sample.get("quantity"),1),"unit":"pcs","rate":0,"remarks":f"{sample.get('sample_type')} · {sample.get('review_notes','')}","tech_pack_id":str(pack["_id"]) if pack else "","image_urls":sample.get("image_urls",[])}
    if pack: line["tech_pack"]={k:pack.get(k) for k in ("tech_pack_no","version","design_no","style_name","department","description","fabric_notes","measurement_rows","construction_notes","artwork_notes","trims_items","colourways","sketch_images","details_images","artwork_images","trims_images","colourway_images")}
    order={"tenant_id":ctx["tenant_id"],"order_no":f"JWO-{now.strftime('%y%m%d')}-{seq:04d}","job_worker_name":worker,"assigned_vendor_id":clean(payload.get("vendor_id"),40) or None,"job_work_type":clean(payload.get("job_work_type"),40) or "Stitching","finished_product":f"Sample · {project['style_name']}","expected_quantity":number(sample.get("quantity"),1),"unit":"pcs","design_lines":[line],"due_date":sample.get("required_date",""),"remarks":f"Sample order {sample.get('sample_no')}. {sample.get('materials','')}","materials":[],"outputs":[],"status":"DRAFT","source":"DESIGN_SAMPLE","sample_id":sample_id,"created_by":ctx.get("admin_id"),"created_at":now,"updated_at":now}
    result=await job_work_orders_collection.insert_one(order)
    await design_samples_collection.update_one({"_id":sample["_id"]},{"$set":{"job_work_order_id":str(result.inserted_id),"job_work_order_no":order["order_no"],"assigned_to":worker,"updated_at":now}})
    return {"message":f"Sample job {order['order_no']} created. Issue its material from Job Work Orders.","order_id":str(result.inserted_id)}

@router.post("/queries", status_code=201)
async def create_query(payload: dict, ctx: dict = Depends(require_design_or_production)):
    project = await project_or_404(clean(payload.get("project_id"), 40), ctx["tenant_id"]); now = datetime.utcnow()
    seq = await design_queries_collection.count_documents({"tenant_id": ctx["tenant_id"]}) + 1
    row = {"tenant_id": ctx["tenant_id"], "project_id": str(project["_id"]), "design_no": project["design_no"], "query_no": f"DQ-{now.strftime('%y%m%d')}-{seq:04d}",
           "category": clean(payload.get("category"), 80), "description": clean(payload.get("description"), 2000), "priority": clean(payload.get("priority"), 30) or "MEDIUM",
           "response": "", "status": "OPEN", "source_department": ctx.get("department") or "", "raised_by": ctx.get("admin_name"), "created_at": now, "updated_at": now}
    result = await design_queries_collection.insert_one(row); row["_id"] = result.inserted_id
    return {"message": f"Query {row['query_no']} created.", "data": serialize(row)}

@router.patch("/queries/{query_id}")
async def resolve_query(query_id: str, payload: dict, ctx: dict = Depends(require_design_or_production)):
    if not ObjectId.is_valid(query_id): raise HTTPException(status_code=400, detail="Invalid query.")
    status = clean(payload.get("status"), 40).upper() or "RESOLVED"
    if status not in {"OPEN", "ASSIGNED", "CLARIFICATION_PROVIDED", "REVISION_REQUIRED", "RESOLVED", "CLOSED"}: raise HTTPException(status_code=400, detail="Invalid query status.")
    result = await design_queries_collection.update_one({"_id": ObjectId(query_id), "tenant_id": ctx["tenant_id"]}, {"$set": {"status": status, "response": clean(payload.get("response"), 2000), "updated_at": datetime.utcnow()}})
    if not result.matched_count: raise HTTPException(status_code=404, detail="Query not found.")
    return {"message": "Query updated."}

@router.post("/research", status_code=201)
async def create_research(payload: dict, ctx: dict = Depends(require_design)):
    title = clean(payload.get("title"), 200)
    if not title: raise HTTPException(status_code=400, detail="Research title is required.")
    now = datetime.utcnow(); row = {"tenant_id": ctx["tenant_id"], "title": title, "category": clean(payload.get("category"), 80),
        "season": clean(payload.get("season"), 80), "department": clean(payload.get("department"), 80), "market_segment": clean(payload.get("market_segment"), 120),
        "notes": clean(payload.get("notes"), 3000), "tags": [clean(x, 50) for x in payload.get("tags", []) if clean(x)][:30],
        "reference_urls": [clean(x, 1000) for x in payload.get("reference_urls", []) if clean(x)][:30], "created_by": ctx.get("admin_name"), "created_at": now, "updated_at": now}
    result = await design_research_collection.insert_one(row); row["_id"] = result.inserted_id
    return {"message": "Research reference saved.", "data": serialize(row)}

@router.post("/artworks", status_code=201)
async def create_artwork(payload: dict, ctx: dict = Depends(require_design)):
    project = await project_or_404(clean(payload.get("project_id"), 40), ctx["tenant_id"]); now = datetime.utcnow()
    seq = await design_artworks_collection.count_documents({"tenant_id": ctx["tenant_id"]}) + 1
    row = {"tenant_id": ctx["tenant_id"], "project_id": str(project["_id"]), "design_no": project["design_no"], "artwork_no": f"ART-{now.strftime('%y%m%d')}-{seq:04d}",
        "name": clean(payload.get("name"), 160), "kind": clean(payload.get("kind"), 80), "version": clean(payload.get("version"), 30) or "v1",
        "width": clean(payload.get("width"), 40), "height": clean(payload.get("height"), 40), "placement": clean(payload.get("placement"), 300),
        "technique": clean(payload.get("technique"), 120), "colours": clean(payload.get("colours"), 500), "file_urls": [clean(x, 1000) for x in payload.get("file_urls", []) if clean(x)][:30],
        "notes": clean(payload.get("notes"), 2000), "status": clean(payload.get("status"), 40) or "DRAFT", "created_at": now, "updated_at": now}
    result = await design_artworks_collection.insert_one(row); row["_id"] = result.inserted_id
    return {"message": f"Artwork {row['artwork_no']} saved.", "data": serialize(row)}

@router.post("/change-requests", status_code=201)
async def create_change_request(payload: dict, ctx: dict = Depends(require_design_or_production)):
    project = await project_or_404(clean(payload.get("project_id"), 40), ctx["tenant_id"]); now = datetime.utcnow()
    seq = await design_change_requests_collection.count_documents({"tenant_id": ctx["tenant_id"]}) + 1
    affected=[]
    async for order in job_work_orders_collection.find({"tenant_id":ctx["tenant_id"],"status":{"$ne":"COMPLETED"},"design_lines.design_no":project["design_no"]},{"order_no":1}): affected.append({"id":str(order["_id"]),"order_no":order.get("order_no")})
    row = {"tenant_id": ctx["tenant_id"], "project_id": str(project["_id"]), "design_no": project["design_no"], "change_no": f"DCR-{now.strftime('%y%m%d')}-{seq:04d}",
        "reason": clean(payload.get("reason"), 1000), "previous_spec": clean(payload.get("previous_spec"), 1500), "new_spec": clean(payload.get("new_spec"), 1500),
        "material_impact": clean(payload.get("material_impact"), 1000), "cost_impact": clean(payload.get("cost_impact"), 500), "delivery_impact": clean(payload.get("delivery_impact"), 500),
        "affected_orders":affected, "status": "PENDING_PRODUCTION_REVIEW", "raised_by": ctx.get("admin_name"), "decision_note": "", "created_at": now, "updated_at": now}
    result = await design_change_requests_collection.insert_one(row); row["_id"] = result.inserted_id
    return {"message": f"Change request {row['change_no']} submitted.", "data": serialize(row)}

@router.patch("/change-requests/{change_id}")
async def decide_change_request(change_id: str, payload: dict, ctx: dict = Depends(require_design_or_production)):
    if not ObjectId.is_valid(change_id): raise HTTPException(status_code=400, detail="Invalid change request.")
    status = clean(payload.get("status"), 40).upper()
    if status not in {"PENDING_PRODUCTION_REVIEW", "ACCEPTED", "REJECTED", "IMPLEMENTED"}: raise HTTPException(status_code=400, detail="Invalid change status.")
    result = await design_change_requests_collection.update_one({"_id": ObjectId(change_id), "tenant_id": ctx["tenant_id"]}, {"$set": {"status": status, "decision_note": clean(payload.get("decision_note"), 1000), "decided_by": ctx.get("admin_name"), "acknowledged_at":datetime.utcnow() if status in {"ACCEPTED","REJECTED"} else None, "updated_at": datetime.utcnow()}})
    if not result.matched_count: raise HTTPException(status_code=404, detail="Change request not found.")
    return {"message": "Change request updated."}

@router.post("/projects/{project_id}/release")
async def release_project(project_id: str, payload: dict, ctx: dict = Depends(require_design)):
    project = await project_or_404(project_id, ctx["tenant_id"])
    tech_pack_id = clean(payload.get("tech_pack_id"), 40)
    if not ObjectId.is_valid(tech_pack_id): raise HTTPException(status_code=400, detail="Select an approved tech pack.")
    pack = await tech_packs_collection.find_one({"_id": ObjectId(tech_pack_id), "tenant_id": ctx["tenant_id"], "design_no": project["design_no"]})
    if not pack: raise HTTPException(status_code=400, detail="The selected tech pack must belong to this design number.")
    approved_sample = await design_samples_collection.find_one({"tenant_id": ctx["tenant_id"], "project_id": project_id, "decision": {"$in": ["APPROVED", "APPROVED_WITH_COMMENTS"]}})
    if not approved_sample: raise HTTPException(status_code=400, detail="Approve at least one sample before releasing to Production.")
    approvals = {a.get("type"): a.get("decision") for a in project.get("approvals", [])}
    if approvals.get("DESIGN_HEAD") != "APPROVED" or approvals.get("PRODUCTION_FEASIBILITY") != "APPROVED":
        raise HTTPException(status_code=400, detail="Design Head and Production feasibility approvals are required before release.")
    now = datetime.utcnow(); plan_id = clean(payload.get("material_plan_id"), 40) or None
    if not plan_id and payload.get("auto_create_bom"):
        pattern = await design_patterns_collection.find_one({"tenant_id": ctx["tenant_id"], "project_id": project_id, "consumption_per_unit": {"$gt": 0}}, sort=[("created_at", -1)])
        if not pattern or not project.get("planned_quantity"): raise HTTPException(status_code=400, detail="Automatic BOM needs planned quantity and a pattern with consumption.")
        material_name = clean(payload.get("material_name"), 160) or "Main fabric"
        required = round(number(project.get("planned_quantity")) * number(pattern.get("consumption_per_unit")) * (1 + number(pattern.get("wastage_pct")) / 100), 3)
        plan = {"tenant_id": ctx["tenant_id"], "plan_no": f"BOM-{now.strftime('%y%m%d')}-{(await style_bom_plans_collection.count_documents({'tenant_id': ctx['tenant_id']}))+1:04d}",
            "style_name": project["style_name"], "style_code": project["design_no"], "planned_quantity": number(project.get("planned_quantity")), "finished_unit": "pcs", "wastage_pct": number(pattern.get("wastage_pct")),
            "materials": [{"material_name": material_name, "specification": f"Pattern {pattern.get('pattern_no')} {pattern.get('version')}; width {pattern.get('fabric_width','')}", "consumption_per_unit": number(pattern.get("consumption_per_unit")), "unit": "m", "wastage_pct": number(pattern.get("wastage_pct")), "required_quantity": required, "rate": 0}],
            "purchase_order_id": None, "purchase_order_no": None, "source": "DESIGN_HANDOFF", "created_by": ctx.get("admin_id"), "created_at": now, "updated_at": now}
        result = await style_bom_plans_collection.insert_one(plan); plan_id = str(result.inserted_id)
    if plan_id and (not ObjectId.is_valid(plan_id) or not await style_bom_plans_collection.find_one({"_id": ObjectId(plan_id), "tenant_id": ctx["tenant_id"]})): raise HTTPException(status_code=400, detail="Invalid material plan.")
    await tech_packs_collection.update_one({"_id": pack["_id"]}, {"$set": {"status": "Released to Production", "approved_by": ctx.get("admin_name"), "approved_at": now, "design_project_id": project_id, "material_plan_id": plan_id or pack.get("material_plan_id"), "updated_at": now}})
    await design_projects_collection.update_one({"_id": project["_id"]}, {"$set": {"status": "RELEASED_TO_PRODUCTION", "tech_pack_id": tech_pack_id, "material_plan_id": plan_id, "released_by": ctx.get("admin_name"), "released_at": now, "updated_at": now}})
    return {"message": f"{project['design_no']} released to Production with tech pack {pack.get('tech_pack_no', '')}."}
