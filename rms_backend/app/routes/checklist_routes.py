from datetime import datetime
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.db import checklist_collection
from app.routes.deps import get_hq_tenant

router = APIRouter(prefix="/checklist", tags=["Buyer Checklist"])

class ChecklistPayload(BaseModel):
    taskDetails: str = Field(min_length=1, max_length=1000)
    status: str = "pending"  # pending | completed
    dueDate: Optional[str] = ""


def oid(value: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=400, detail="Invalid checklist ID")
    return ObjectId(value)


def serialise(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("/", response_model=List[dict])
async def list_checklist(ctx: dict = Depends(get_hq_tenant)):
    cursor = checklist_collection.find({"tenant_id": ctx["tenant_id"]}).sort([("status", 1), ("dueDate", 1), ("createdAt", -1)])
    return [serialise(doc) async for doc in cursor]


@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_checklist(payload: ChecklistPayload, ctx: dict = Depends(get_hq_tenant)):
    now = datetime.utcnow()
    result = await checklist_collection.insert_one({**payload.dict(), "tenant_id": ctx["tenant_id"], "created_by": ctx["admin_id"], "createdAt": now, "updatedAt": now})
    return {"message": "Checklist item created", "id": str(result.inserted_id)}


@router.put("/{item_id}")
async def update_checklist(item_id: str, payload: ChecklistPayload, ctx: dict = Depends(get_hq_tenant)):
    result = await checklist_collection.update_one({"_id": oid(item_id), "tenant_id": ctx["tenant_id"]}, {"$set": {**payload.dict(), "updatedAt": datetime.utcnow()}})
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    return {"message": "Checklist item updated"}


@router.delete("/{item_id}")
async def delete_checklist(item_id: str, ctx: dict = Depends(get_hq_tenant)):
    result = await checklist_collection.delete_one({"_id": oid(item_id), "tenant_id": ctx["tenant_id"]})
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    return {"message": "Checklist item deleted"}