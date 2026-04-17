# auth.py
# Authentication tools.
# Handles password hashing and generation of JSON Web Tokens (JWT)
ALGORITHM = "HS256"
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from passlib.context import CryptContext
import jwt
from jwt.exceptions import InvalidTokenError
from app.config import settings  
from app.database import get_db

# Initialize password hashing configuration (bcrypt)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 Scheme to extract the token from headers
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Checks if a plain text password (from React) matches the
    hashed password stored in the database.
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Converts a plain text password into a secure hash (bcrypt).
    Used when creating new users.
    """
    return pwd_context.hash(password)


def create_access_token(data: dict) -> str:
    """
    Creates a JWT token that will be passed down to React.
    `data` typically contains the user ID and their role.
    React must attach this token to every future request header.
    """
    to_encode = data.copy()
    
    # Calculate exactly when this token should stop working
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    
    # Encrypt using the SECRET_KEY and algorithm
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


# ============================================================
# DEPENDENCIES FOR PROTECTING ENDPOINTS
# ============================================================

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    """
    Decodes the JWT token attached to the request, verifies who the user is,
    and ensures they still exist in the database. Add this as a Depencency to any endpoint.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        username: str | None = payload.get("username")
        if username is None:
            raise credentials_exception
    except InvalidTokenError:
        raise credentials_exception
        
    from app import crud
    user = await crud.get_user_by_username(db, username=username)
    if user is None or not user.is_active:
        raise credentials_exception
    return user


async def check_admin_or_supervisor(current_user = Depends(get_current_user)):
    """
    Blocks the request if the current user is not an admin or supervisor.
    """
    if current_user.role not in "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Operation restricted to Admins and Supervisors."
        )
    return current_user
