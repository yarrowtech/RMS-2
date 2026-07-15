from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import cloudinary
import cloudinary.uploader
import os
from app.db import items_collection, vendors_collection

router = APIRouter(prefix="/items", tags=["Items"])

# -------------------- CLOUDINARY CONFIG --------------------
# Make sure to set these in your environment or .env file:
# CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

# -------------------- UTILS --------------------
def objid(v):
    return str(v) if isinstance(v, ObjectId) else v


# -------------------- MODELS --------------------
class CategoryModel(BaseModel):
    category: Optional[str] = ""
    description: Optional[str] = ""


class StoreWiseModel(BaseModel):
    name: Optional[str] = ""
    initial: Optional[str] = ""


class PriceInfoModel(BaseModel):
    effectiveDate: Optional[str] = ""
    rsp: Optional[float] = 0
    mrp: Optional[float] = 0


class ItemModel(BaseModel):
    # Core Fields
    barcode: Optional[str] = ""
    itemDescription: Optional[str] = ""
    rate: float = 0
    quantity: float = 0
    orderNo: Optional[str] = ""
    orderDate: Optional[str] = ""
    netAmount: float = 0
    effectiveValue: float = 0
    basicValue: float = 0

    # General Info
    vendorId: Optional[str] = ""
    vendorName: Optional[str] = ""
    itemName: Optional[str] = ""
    shortName: Optional[str] = ""
    division: Optional[str] = ""
    section: Optional[str] = ""
    department: Optional[str] = ""
    oemBarcode: Optional[str] = ""
    expiryDate: Optional[str] = ""

    # Pricing & Other Sections
    categories: List[CategoryModel] = []
    storeWise: List[StoreWiseModel] = []
    priceInfo: List[PriceInfoModel] = []

    # Image URL
    imageUrl: Optional[str] = None

    # Metadata
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {ObjectId: str}


# -------------------- ENDPOINTS --------------------

@router.post("/", response_model=ItemModel)
async def create_item(item: ItemModel):
    """Create a single item (used by AddItem.jsx)"""
    try:
        doc = item.dict()
        res = await items_collection.insert_one(doc)
        doc["_id"] = objid(res.inserted_id)
        return doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating item: {e}")


@router.post("/bulk", response_model=List[ItemModel])
async def bulk_create_items(items: List[ItemModel]):
    """Create multiple items at once (used by AddGRC Save)"""
    if not items:
        raise HTTPException(status_code=400, detail="No items provided")

    try:
        docs = [i.dict() for i in items]
        res = await items_collection.insert_many(docs)
        for i, _id in zip(docs, res.inserted_ids):
            i["_id"] = objid(_id)
        return docs
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Bulk insert failed: {e}")


@router.get("/", response_model=List[ItemModel])
async def get_all_items():
    """Fetch all items"""
    try:
        items = await items_collection.find().to_list(1000)
        for i in items:
            i["_id"] = objid(i["_id"])
        return items
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching items: {e}")


# -------------------- IMAGE UPLOAD (CLOUDINARY) --------------------
@router.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):
    """Upload image to Cloudinary and return public URL"""
    try:
        # Upload file directly from memory buffer
        upload_result = cloudinary.uploader.upload(
            file.file,
            folder="items_uploads",
            resource_type="image",
        )
        return {"url": upload_result.get("secure_url")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cloudinary upload failed: {e}")


# -------------------- VENDORS --------------------
@router.get("/vendors")
async def get_vendors():
    """Get vendor list for dropdown"""
    try:
        vendors = await vendors_collection.find().to_list(1000)
        return [
            {"vendorId": str(v.get("_id")), "name": v.get("name")}
            for v in vendors
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching vendors: {e}")
