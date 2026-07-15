
from jose import jwt, JWTError
from datetime import datetime, timedelta
from typing import Dict, Any
from .config import settings


# ================================
# GENERIC TOKEN CREATOR
# ================================
def create_token(data: Dict[str, Any], expires_delta: timedelta):
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})

    return jwt.encode(
        to_encode,
        settings.secret_key,
        algorithm=settings.jwt_algorithm
    )


# ================================
# ACCESS TOKEN
# ================================

def create_access_token(admin_id: str, department: str, role: str = "ADMIN", extra: dict = None):
    expire = timedelta(minutes=int(settings.access_token_expire_minutes))
    payload = {
        "sub": str(admin_id),
        "role": role,
        "department": department
    }
    if extra:
        payload.update(extra)
    return create_token(payload, expires_delta=expire)    


# ================================
# PASSWORD SETUP TOKEN
# ================================
def create_password_setup_token(email: str, department: str):
    expire = timedelta(minutes=int(settings.password_setup_token_expire_minutes))
    payload = {
        "email": email,
        "department": department,
        "type": "password_setup"
    }
    return create_token(payload, expires_delta=expire)


# ================================
# RESET TOKEN (NEW)
# ================================
def create_reset_token(user_id: str):
    expire = timedelta(minutes=20)

    payload = {
        "sub": user_id,
        "type": "password_reset"
    }

    return create_token(payload, expires_delta=expire)


# ================================
# DECODE TOKEN (COMMON)
# ================================
def decode_token(token: str):
    try:
        return jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm]
        )
    except JWTError:
        raise


# ================================
# DECODE RESET TOKEN
# ================================
def decode_reset_token(token: str):
    payload = decode_token(token)

    if payload.get("type") != "password_reset":
        raise JWTError("Invalid reset token")

    return payload
