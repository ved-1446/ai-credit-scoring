"""
auth.py — POST /auth/register, POST /auth/login, GET /auth/me
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.schemas import (
    RegisterRequest, LoginRequest, LoginResponse, UserResponse,
)
from app.security import (
    hash_password, verify_password, create_token, get_current_user,
)
from app.errors import email_taken, invalid_credentials

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    """Create a new user account. Email is lower-cased."""
    email = body.email.strip().lower()

    # Check for duplicate email
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise email_taken()

    user = User(
        email=email,
        full_name=body.full_name.strip(),
        password_hash=hash_password(body.password),
        role="user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return UserResponse(
        id=user.id, email=user.email,
        full_name=user.full_name, role=user.role,
    )


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate and return a JWT."""
    email = body.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()

    if not user or not verify_password(body.password, user.password_hash):
        raise invalid_credentials()

    token = create_token(user.id, user.role)

    return LoginResponse(
        access_token=token,
        user=UserResponse(
            id=user.id, email=user.email,
            full_name=user.full_name, role=user.role,
        ),
    )


@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)):
    """Return the current user's info."""
    return UserResponse(
        id=user.id, email=user.email,
        full_name=user.full_name, role=user.role,
    )
