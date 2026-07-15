from fastapi import APIRouter, HTTPException, UploadFile, File, Form, status
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime
from bson import ObjectId
from app.db import tasklist_collection  
import cloudinary
import cloudinary.uploader
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/tasklist", tags=["Task List"])

# -------------------------- CLOUDINARY SETUP --------------------------
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True,
)

# -------------------------- MODELS --------------------------

class FileMeta(BaseModel):
    id: str
    name: str
    type: str
    size: int
    url: str

class TaskModel(BaseModel):
    id: Optional[str] = Field(default_factory=lambda: f"TSK-{int(datetime.utcnow().timestamp())}")
    name: str
    month: str
    date: str
    taskRecdOn: Optional[str] = ""
    taskDetails: Optional[str] = ""
    communication: Optional[str] = ""
    communicationFiles: List[FileMeta] = []
    imagesFiles: List[FileMeta] = []
    filesSavedIn: Optional[str] = ""
    workTransferredTo: Optional[str] = ""
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: Optional[datetime] = None

# -------------------------- HELPERS --------------------------

def objid(v):
    return str(v) if isinstance(v, ObjectId) else v

# -------------------------- CRUD ROUTES --------------------------

@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_task(task: TaskModel):
    """Create a new task"""
    data = task.dict()
    data["_id"] = ObjectId()
    await tasklist_collection.insert_one(data)
    return {"message": "Task created", "id": objid(data["_id"])}

@router.get("/", response_model=List[TaskModel])
async def get_all_tasks():
    """Get all tasks"""
    tasks = await tasklist_collection.find().to_list(None)
    for t in tasks:
        t["id"] = objid(t["_id"])
    return tasks

@router.get("/{task_id}", response_model=TaskModel)
async def get_task(task_id: str):
    """Get a single task by ID"""
    task = await tasklist_collection.find_one({"_id": ObjectId(task_id)})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task["id"] = objid(task["_id"])
    return task

@router.put("/{task_id}", response_model=dict)
async def update_task(task_id: str, updated: TaskModel):
    """Update a task"""
    data = updated.dict(exclude_unset=True)
    data["updatedAt"] = datetime.utcnow()
    res = await tasklist_collection.update_one({"_id": ObjectId(task_id)}, {"$set": data})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task updated"}

@router.delete("/{task_id}", response_model=dict)
async def delete_task(task_id: str):
    """Delete a task"""
    res = await tasklist_collection.delete_one({"_id": ObjectId(task_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted"}

# -------------------------- FILE UPLOADS --------------------------

@router.post("/{task_id}/upload-files", response_model=dict)
async def upload_task_files(
    task_id: str,
    communication_files: Optional[List[UploadFile]] = File(None),
    image_files: Optional[List[UploadFile]] = File(None),
):
    """Upload communication or image files for a task to Cloudinary"""

    task = await tasklist_collection.find_one({"_id": ObjectId(task_id)})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    new_comm_files = []
    new_img_files = []

    # Upload communication files
    if communication_files:
        for file in communication_files:
            upload_result = cloudinary.uploader.upload(
                file.file,
                folder=f"tasklist/{task_id}/communication",
                resource_type="auto"
            )
            new_comm_files.append({
                "id": f"file-{datetime.utcnow().timestamp()}",
                "name": file.filename,
                "type": file.content_type,
                "size": upload_result.get("bytes", 0),
                "url": upload_result.get("secure_url"),
            })

    # Upload image files
    if image_files:
        for file in image_files:
            upload_result = cloudinary.uploader.upload(
                file.file,
                folder=f"tasklist/{task_id}/images",
                resource_type="image"
            )
            new_img_files.append({
                "id": f"img-{datetime.utcnow().timestamp()}",
                "name": file.filename,
                "type": file.content_type,
                "size": upload_result.get("bytes", 0),
                "url": upload_result.get("secure_url"),
            })

    # Push new file metadata to DB
    await tasklist_collection.update_one(
        {"_id": ObjectId(task_id)},
        {
            "$push": {
                "communicationFiles": {"$each": new_comm_files},
                "imagesFiles": {"$each": new_img_files},
            }
        },
    )

    return {
        "message": "Files uploaded successfully",
        "communicationFiles": len(new_comm_files),
        "imagesFiles": len(new_img_files),
    }
