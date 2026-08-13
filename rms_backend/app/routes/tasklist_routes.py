from datetime import datetime
from typing import Any, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.db import tasklist_collection
from app.routes.deps import get_hq_tenant

router = APIRouter(prefix="/tasklist", tags=["Buyer Tasks"])

class TaskPayload(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    taskDetails: str = Field(min_length=1, max_length=2000)
    status: str = "open"  # open | in_progress | waiting | done
    priority: str = "medium"  # low | medium | high | urgent
    dueDate: Optional[str] = ""
    month: Optional[str] = ""
    communication: Optional[str] = ""
    workTransferredTo: Optional[str] = ""


def serialise(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


def valid_object_id(value: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=400, detail="Invalid task ID")
    return ObjectId(value)


@router.get("/", response_model=List[dict])
async def list_tasks(ctx: dict = Depends(get_hq_tenant)):
    cursor = tasklist_collection.find({"tenant_id": ctx["tenant_id"]}).sort([("status", 1), ("dueDate", 1), ("createdAt", -1)])
    return [serialise(doc) async for doc in cursor]


@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_task(payload: TaskPayload, ctx: dict = Depends(get_hq_tenant)):
    now = datetime.utcnow()
    doc = {**payload.dict(), "tenant_id": ctx["tenant_id"], "created_by": ctx["admin_id"], "createdAt": now, "updatedAt": now}
    result = await tasklist_collection.insert_one(doc)
    return {"message": "Task created", "id": str(result.inserted_id)}


@router.put("/{task_id}")
async def update_task(task_id: str, payload: TaskPayload, ctx: dict = Depends(get_hq_tenant)):
    result = await tasklist_collection.update_one({"_id": valid_object_id(task_id), "tenant_id": ctx["tenant_id"]}, {"$set": {**payload.dict(), "updatedAt": datetime.utcnow()}})
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task updated"}


@router.delete("/{task_id}")
async def delete_task(task_id: str, ctx: dict = Depends(get_hq_tenant)):
    result = await tasklist_collection.delete_one({"_id": valid_object_id(task_id), "tenant_id": ctx["tenant_id"]})
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted"}