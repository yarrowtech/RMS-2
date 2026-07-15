from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from typing import List, Optional
from datetime import date
from bson import ObjectId
from app.db import orders_collection
from ..routes.admin_routes import get_current_admin_token  

router = APIRouter(prefix="/orders", tags=["Orders"])


# ---------- MODELS ----------
class OrderItem(BaseModel):
    product: str
    quantity: float
    unit: str
    rate: float
    amount: float


class Order(BaseModel):
    vendor: str
    type: str  
    expectedDelivery: date
    items: List[OrderItem]
    notes: Optional[str] = None


# ---------- ACCESS CONTROL ----------
def check_order_access(payload: dict):
    """
    Allow Superadmin and Admins from Merchandiser Buyer department.
    """
    role = str(payload.get("role", "")).upper()
    dept = str(payload.get("department", "")).lower()

    if role == "SUPERADMIN":
        return True
    if role == "ADMIN" and "merchandiser" in dept:
        return True

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied: You are not authorized to manage orders."
    )


# ---------- ROUTES ----------

#  Get all orders
@router.get("/")
async def get_orders(payload=Depends(get_current_admin_token)):
    check_order_access(payload)
    orders = await orders_collection.find().to_list(1000)
    for o in orders:
        o["_id"] = str(o["_id"])
    return orders


#  Create new order
@router.post("/")
async def create_order(order: Order, payload=Depends(get_current_admin_token)):
    check_order_access(payload)

    total_amount = sum(item.amount for item in order.items)

    new_order = {
        "vendor": order.vendor,
        "type": order.type,
        "expectedDelivery": order.expectedDelivery.isoformat(),
        "orderDate": date.today().isoformat(),
        "status": "pending",
        "items": [item.dict() for item in order.items],
        "totalAmount": total_amount,
        "notes": order.notes,
        "createdBy": payload.get("email"),
        "createdRole": payload.get("role"),
        "department": payload.get("department"),
    }

    result = await orders_collection.insert_one(new_order)
    new_order["_id"] = str(result.inserted_id)
    return {"message": "Order created successfully", "order": new_order}


#  Update order status
@router.patch("/{order_id}/status")
async def update_order_status(order_id: str, status: str, payload=Depends(get_current_admin_token)):
    check_order_access(payload)

    result = await orders_collection.update_one(
        {"_id": ObjectId(order_id)}, {"$set": {"status": status}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Order not found or unchanged")

    return {"message": f"Order status updated to {status}"}


#  Delete order
@router.delete("/{order_id}")
async def delete_order(order_id: str, payload=Depends(get_current_admin_token)):
    check_order_access(payload)

    result = await orders_collection.delete_one({"_id": ObjectId(order_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")

    return {"message": "Order deleted successfully"}
