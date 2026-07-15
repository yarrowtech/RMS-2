from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from ..auth import decode_token

router = APIRouter(prefix="/admin", tags=["admin"])

security = HTTPBearer()

def get_current_admin_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = decode_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if payload.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Not an admin")
    return payload

from ..db import admins_collection  
from bson import ObjectId

@router.get("/me")
async def me(payload = Depends(get_current_admin_token)):
    admin_id = payload.get("sub")

    # fetch admin details from database
    admin = await admins_collection.find_one({"_id": ObjectId(admin_id)})

    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")

    return {
        "admin_id": str(admin["_id"]),
        "name": admin.get("name"),
        "email": admin.get("email"),
        "role": payload.get("role"),
        "department": admin.get("department"),
    }


@router.get("/dashboard")
async def dashboard(payload = Depends(get_current_admin_token)):
    department = payload.get("department")
    return {"msg": f"Welcome to {department} dashboard", "department": department}