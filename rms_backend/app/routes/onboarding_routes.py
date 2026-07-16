"""Public retailer/store-owner onboarding leads and Super Admin review."""
from datetime import datetime
from typing import Literal

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from ..db import onboarding_requests_collection
from .auth_routes import CurrentAdmin, get_current_superadmin

router = APIRouter(prefix="/api/onboarding", tags=["Onboarding"])
RequestType = Literal["retailer", "single_store"]
ReviewStatus = Literal["PENDING", "CONTACTED", "APPROVED", "DECLINED"]


class OnboardingRequestCreate(BaseModel):
    account_type: RequestType
    business_name: str = Field(min_length=2, max_length=160)
    contact_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=6, max_length=40)
    city: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=100)
    store_count: int = Field(default=1, ge=1, le=999)
    requested_modules: list[str] = Field(default_factory=list, max_length=12)
    message: str = Field(default="", max_length=1000)


class OnboardingRequestReview(BaseModel):
    status: ReviewStatus
    review_note: str = Field(default="", max_length=1000)


def _clean(value: str) -> str:
    return " ".join(str(value or "").strip().split())


def _view(item: dict) -> dict:
    return {
        "id": str(item["_id"]), "account_type": item.get("account_type", "retailer"),
        "business_name": item.get("business_name", ""), "contact_name": item.get("contact_name", ""),
        "email": item.get("email", ""), "phone": item.get("phone", ""), "city": item.get("city", ""),
        "state": item.get("state", ""), "store_count": item.get("store_count", 1),
        "requested_modules": item.get("requested_modules", []), "message": item.get("message", ""),
        "status": item.get("status", "PENDING"), "review_note": item.get("review_note", ""),
        "reviewed_by": item.get("reviewed_by", ""),
        "created_at": item.get("created_at").isoformat() if item.get("created_at") else None,
        "updated_at": item.get("updated_at").isoformat() if item.get("updated_at") else None,
    }


@router.post("/requests", status_code=status.HTTP_201_CREATED)
async def create_onboarding_request(payload: OnboardingRequestCreate):
    """Submit a contact request only; this endpoint never creates a tenant."""
    now = datetime.utcnow()
    email = str(payload.email).strip().lower()
    existing = await onboarding_requests_collection.find_one({
        "email": email, "account_type": payload.account_type,
        "status": {"$in": ["PENDING", "CONTACTED"]},
    })
    if existing:
        raise HTTPException(status_code=409, detail="An active onboarding request already exists for this email. Our team will contact you shortly.")
    modules = list(dict.fromkeys(_clean(module)[:80] for module in payload.requested_modules if _clean(module)))
    document = {
        "account_type": payload.account_type, "business_name": _clean(payload.business_name),
        "contact_name": _clean(payload.contact_name), "email": email, "phone": _clean(payload.phone),
        "city": _clean(payload.city), "state": _clean(payload.state),
        "store_count": 1 if payload.account_type == "single_store" else payload.store_count,
        "requested_modules": modules, "message": _clean(payload.message), "status": "PENDING",
        "review_note": "", "created_at": now, "updated_at": now,
    }
    result = await onboarding_requests_collection.insert_one(document)
    return {"message": "Your onboarding request has been received. Our RMS team will contact you after review.", "request_id": str(result.inserted_id)}


@router.get("/requests")
async def list_onboarding_requests(current_admin: CurrentAdmin = Depends(get_current_superadmin)):
    requests = []
    async for item in onboarding_requests_collection.find({}).sort("created_at", -1):
        requests.append(_view(item))
    statuses = ("PENDING", "CONTACTED", "APPROVED", "DECLINED")
    return {"requests": requests, "summary": {item: sum(1 for request in requests if request["status"] == item) for item in statuses}}


@router.patch("/requests/{request_id}")
async def review_onboarding_request(request_id: str, payload: OnboardingRequestReview, current_admin: CurrentAdmin = Depends(get_current_superadmin)):
    if not ObjectId.is_valid(request_id):
        raise HTTPException(status_code=400, detail="Invalid onboarding request ID.")
    request = await onboarding_requests_collection.find_one({"_id": ObjectId(request_id)})
    if not request:
        raise HTTPException(status_code=404, detail="Onboarding request not found.")
    now = datetime.utcnow()
    update = {"status": payload.status, "review_note": _clean(payload.review_note), "reviewed_by": current_admin.get("email", "Super Admin"), "updated_at": now}
    await onboarding_requests_collection.update_one({"_id": request["_id"]}, {"$set": update})
    request.update(update)
    return {"message": "Onboarding request updated.", "request": _view(request)}
