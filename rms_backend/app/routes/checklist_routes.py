from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from bson import ObjectId


from app.db import checklist_collection  

router = APIRouter(prefix="/checklist", tags=["Checklist"])

# Helper to handle ObjectId serialization
def objid(v):
    return str(v) if isinstance(v, ObjectId) else v


# ------------------- MODELS -------------------
class ChecklistBase(BaseModel):
    id: str = Field(..., description="Custom ID like CHK-...")
    name: Optional[str] = ""
    month: Optional[str] = ""
    date: Optional[str] = ""
    fromDate: Optional[str] = ""
    toDate: Optional[str] = ""
    taskDetails: Optional[str] = ""
    status: Optional[str] = ""
    createdAt: Optional[int] = None
    updatedAt: Optional[int] = None


class ChecklistCreate(ChecklistBase):
    pass


class ChecklistUpdate(BaseModel):
    name: Optional[str] = None
    month: Optional[str] = None
    date: Optional[str] = None
    fromDate: Optional[str] = None
    toDate: Optional[str] = None
    taskDetails: Optional[str] = None
    status: Optional[str] = None
    updatedAt: Optional[int] = None


class ChecklistResponse(ChecklistBase):
    _id: Optional[str] = None


# ------------------- ROUTES -------------------

@router.get("/", response_model=List[ChecklistResponse])
async def get_all_checklists():
    """Return all checklist records."""
    docs = await checklist_collection.find().to_list(None)
    return [{**d, "_id": objid(d["_id"])} for d in docs]


@router.get("/{checklist_id}", response_model=ChecklistResponse)
async def get_checklist_by_id(checklist_id: str):
    """Get one checklist item."""
    doc = await checklist_collection.find_one({"id": checklist_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Checklist not found")
    doc["_id"] = objid(doc["_id"])
    return doc


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_checklist(item: ChecklistCreate):
    """Create a new checklist entry."""
    # If same ID exists → reject
    exists = await checklist_collection.find_one({"id": item.id})
    if exists:
        raise HTTPException(status_code=400, detail="Checklist with this ID already exists")

    data = item.dict()
    data["createdAt"] = data.get("createdAt") or int(datetime.utcnow().timestamp() * 1000)
    await checklist_collection.insert_one(data)
    return {"message": "Checklist created successfully", "id": item.id}


@router.put("/{checklist_id}")
async def update_checklist(checklist_id: str, item: ChecklistUpdate):
    """Update existing checklist."""
    item.updatedAt = int(datetime.utcnow().timestamp() * 1000)
    result = await checklist_collection.update_one({"id": checklist_id}, {"$set": item.dict(exclude_unset=True)})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Checklist not found")
    return {"message": "Checklist updated successfully"}


@router.delete("/{checklist_id}")
async def delete_checklist(checklist_id: str):
    """Delete a checklist entry."""
    result = await checklist_collection.delete_one({"id": checklist_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Checklist not found")
    return {"message": "Checklist deleted successfully"}
