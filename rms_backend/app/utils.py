

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
