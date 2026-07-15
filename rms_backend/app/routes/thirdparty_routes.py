from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from bson import ObjectId
from ..db import thirdparty_vendors_collection, bookings_collection

router = APIRouter(prefix="/thirdparty", tags=["Third Party Vendors"])


# -----------------------------
#  MODELS
# -----------------------------
class VendorBase(BaseModel):
    name: str
    category: str
    specialty: str
    email: EmailStr
    phone: Optional[str] = None
    location: Optional[str] = None
    hourlyRate: float
    experience: Optional[str] = None
    skills: Optional[List[str]] = []
    rating: Optional[float] = 0.0
    reviews: Optional[int] = 0
    status: Optional[str] = "available"
    completedJobs: Optional[int] = 0
    portfolio: Optional[int] = 0
    joinDate: Optional[str] = None


class Booking(BaseModel):
    vendorId: str
    vendorName: str
    category: str
    project: str
    date: str
    duration: str
    rate: float 
    status: str = "pending"
    notes: Optional[str] = ""


# -----------------------------
#  Vendors Routes (Async)
# -----------------------------
@router.get("/vendors", response_model=List[VendorBase])
async def get_vendors():
    vendors = []
    async for v in thirdparty_vendors_collection.find():
        v["_id"] = str(v["_id"])
        vendors.append(v)
    return vendors


@router.post("/vendors", response_model=VendorBase)
async def add_vendor(vendor: VendorBase):
    result = await thirdparty_vendors_collection.insert_one(vendor.dict())
    if not result.inserted_id:
        raise HTTPException(status_code=400, detail="Vendor not added")
    return vendor


@router.put("/vendors/{vendor_id}")
async def update_vendor(vendor_id: str, updated_data: VendorBase):
    result = await thirdparty_vendors_collection.update_one(
        {"_id": ObjectId(vendor_id)},
        {"$set": updated_data.dict()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return {"message": "Vendor updated successfully"}


@router.delete("/vendors/{vendor_id}")
async def delete_vendor(vendor_id: str):
    result = await thirdparty_vendors_collection.delete_one({"_id": ObjectId(vendor_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")

    # Also delete related bookings
    await bookings_collection.delete_many({"vendorId": vendor_id})
    return {"message": "Vendor and related bookings deleted successfully"}


# -----------------------------
#  Bookings Routes (Async)
# -----------------------------
@router.get("/bookings", response_model=List[Booking])
async def get_bookings():
    bookings = []
    async for b in bookings_collection.find():
        b["_id"] = str(b["_id"])
        bookings.append(b)
    return bookings


@router.post("/bookings", response_model=Booking)
async def create_booking(booking: Booking):
    result = await bookings_collection.insert_one(booking.dict())
    if not result.inserted_id:
        raise HTTPException(status_code=400, detail="Booking failed")
    return booking


@router.delete("/bookings/{booking_id}")
async def delete_booking(booking_id: str):
    result = await bookings_collection.delete_one({"_id": ObjectId(booking_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    return {"message": "Booking deleted successfully"}
