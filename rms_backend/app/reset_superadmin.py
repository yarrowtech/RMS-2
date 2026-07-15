import asyncio
from app.db import admins_collection
from app.config import settings
from app.utils import hash_password
from datetime import datetime

async def reset_superadmin():
    email = settings.superadmin_email

    # Delete existing superadmin if exists
    result = await admins_collection.delete_many({"email": email})
    if result.deleted_count:
        print(f"✅ Deleted {result.deleted_count} old superadmin(s) with email {email}")
    else:
        print(f"ℹ️ No existing superadmin found with email {email}")

    # Create new superadmin
    hashed = hash_password(settings.superadmin_password)
    doc = {
        "name": settings.superadmin_name,
        "email": email,
        "department": "SUPERADMIN",
        "hashed_password": hashed,
        "status": "ACTIVE",
        "password_set": True,
        "created_at": datetime.utcnow()
    }
    await admins_collection.insert_one(doc)
    print(f"✅ Superadmin created with email: {email}")

if __name__ == "__main__":
    asyncio.run(reset_superadmin())

