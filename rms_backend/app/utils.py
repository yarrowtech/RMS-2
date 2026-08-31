

from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import jwt
from app.config import settings  

# Password hashing setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Use env-configured JWT values
SECRET_KEY = settings.secret_key
ALGORITHM = settings.jwt_algorithm
ACCESS_TOKEN_EXPIRE_MINUTES = settings.access_token_expire_minutes


#  Password Utilities

def hash_password(password: str) -> str:
    """Hashes a plain password using bcrypt."""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against the stored hash."""
    return pwd_context.verify(plain_password, hashed_password)


# JWT Token Utilities

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Creates a JWT token that expires in the configured time."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# GSTIN checksum verification
#
# KYB submission (hq_store_routes.py, vendor_routes.py) previously only
# regex-matched the GSTIN's shape (2 digits + 5 letters + 4 digits + 1
# letter + 1 alnum + 'Z' + 1 alnum) — that accepts any string of the right
# shape, typo or not, since the 15th character is actually a computed check
# digit, not a free choice. This is the free, no-third-party half of real
# GSTIN validation; confirming the number is genuinely REGISTERED (and to
# whom) still needs a paid GSTN-approved KYC API (Surepass/Karza/Signzy —
# not implemented, would need an account + API key on the retailer's side).
_GSTIN_CODEPOINTS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def gstin_checksum_valid(gstin: str) -> bool:
    """True if the 15th character is the correct GSTIN check digit for the
    first 14 characters. Does NOT confirm the GSTIN is actually registered —
    only that it isn't a typo/fabricated string of the right shape."""
    gstin = (gstin or "").strip().upper()
    if len(gstin) != 15 or any(ch not in _GSTIN_CODEPOINTS for ch in gstin):
        return False
    factor = 1
    total = 0
    for char in gstin[:-1]:
        digit = _GSTIN_CODEPOINTS.index(char) * factor
        digit = (digit // 36) + (digit % 36)
        total += digit
        factor = 2 if factor == 1 else 1
    checksum_digit = (36 - (total % 36)) % 36
    return _GSTIN_CODEPOINTS[checksum_digit] == gstin[-1]
