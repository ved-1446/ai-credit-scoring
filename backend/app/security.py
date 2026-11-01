"""
security.py — Password hashing (bcrypt), JWT creation/verification,
and FastAPI dependencies for auth (get_current_user, require_admin).
"""

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, Request

from app.config import settings
from app.errors import unauthenticated, forbidden
from app.db import get_db
from app.models import User
from sqlalchemy.orm import Session


# ─── Password hashing with bcrypt ───

def hash_password(plain: str) -> str:
    """Hash a plain-text password using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(plain.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Check a plain-text password against a bcrypt hash."""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# ─── JWT ───

ALGORITHM = "HS256"
TOKEN_EXPIRY_MINUTES = 60


def create_token(user_id: str, role: str) -> str:
    """Create a JWT with sub, role, and exp claims."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "role": role,
        "exp": now + timedelta(minutes=TOKEN_EXPIRY_MINUTES),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and verify a JWT. Raises AppError on failure."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise unauthenticated("Token has expired")
    except jwt.InvalidTokenError:
        raise unauthenticated("Invalid token")


# ─── FastAPI dependencies ───

def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Extract the JWT from the Authorization header and return the User object."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise unauthenticated()

    token = auth_header.split(" ", 1)[1]
    claims = decode_token(token)

    user = db.query(User).filter(User.id == claims["sub"]).first()
    if not user:
        raise unauthenticated("User not found")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    """Only allow admin users through."""
    if user.role != "admin":
        raise forbidden()
    return user
