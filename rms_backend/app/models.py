
from pydantic import BaseModel, EmailStr, Field
from typing import Any, Dict, List, Optional
from datetime import datetime
from bson import ObjectId


class PyObjectId(str):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return str(v)


class AdminCreate(BaseModel):
    name:       str
    email:      EmailStr
    department: str
    tenant_id:  str   
    store_id: Optional[str] = None
    store_name: Optional[str] = None   
    store_type: Optional[str] = None 

    # ── These 3 fields were missing ───────────────────────────────────────────
    # Without them, Pydantic silently discards managedDepartments and
    # permissions from the request body, so the route's getattr() fallback
    # always returned [] and only "department" (first dept) was ever saved.
    managedDepartments: List[str]     = []    # ALL departments selected in the frontend form
    permissions:        List[str]     = []    # ALL permissions selected in the frontend form
    phone:              Optional[str] = None


class AdminInDB(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id")
    name: str
    email: EmailStr
    department: str
    hashed_password: Optional[str] = None
    status: str = "PENDING"
    password_set: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        allow_population_by_field_name = True
        json_encoders = {ObjectId: str}
        arbitrary_types_allowed = True


# ── TokenResponse ─────────────────────────────────────────────────────────────
# extra = "allow" is critical — without it, FastAPI strips redirect_type,
# redirect_url, departments, and routes before they reach the frontend,
# so the login redirect never works.

class TokenResponse(BaseModel):
    access_token:  str
    token_type:    str            = "bearer"
    role:          str
    department:    Optional[str] = None

    # Redirect fields returned by /auth/login and /auth/set-password
    redirect_type: Optional[str]       = None   # "direct" | "selector"
    redirect_url:  Optional[str]       = None   # e.g. "/hr", "/cashier", "/dashboard/select"
    departments:   List[str]           = []     # all departments this admin manages
    routes:        Dict[str, Any]      = {}     # { "HR": "/hr", "Cashier": "/cashier", ... }

    class Config:
        extra = "allow"   # pass any additional fields through instead of stripping them        
