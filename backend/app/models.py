"""
models.py — SQLAlchemy ORM models matching API_CONTRACT §12.
Uses string UUIDs so both SQLite and PostgreSQL behave the same.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Float, Boolean, UniqueConstraint

from app.db import Base


def new_uuid() -> str:
    """Generate a new UUID4 string."""
    return str(uuid.uuid4())


class User(Base):
    """A registered user account."""
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=new_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    full_name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default="user")  # "user" or "admin"
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Consent(Base):
    """Records that a user agreed to data processing before a prediction."""
    __tablename__ = "consents"

    id = Column(String, primary_key=True, default=new_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    policy_version = Column(String, nullable=False)
    given_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Prediction(Base):
    """One saved prediction (credit risk assessment)."""
    __tablename__ = "predictions"

    id = Column(String, primary_key=True, default=new_uuid)  # = request_id
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    consent_id = Column(String, ForeignKey("consents.id"), nullable=False)
    inputs_json = Column(Text, nullable=False)       # full PredictInputs as JSON
    response_json = Column(Text, nullable=False)      # full §4.2 response as JSON
    probability = Column(Float, nullable=False)       # for quick queries
    risk_band = Column(String, nullable=False)        # LOW / MEDIUM / HIGH / VERY_HIGH
    flagged = Column(Boolean, nullable=False)         # flagged_high_risk
    gender = Column(String, nullable=False)           # "M" or "F" — for fairness page
    model_version = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Explanation(Base):
    """Cached plain-language/LLM explanation for a prediction in a specific language."""
    __tablename__ = "explanations"

    id = Column(String, primary_key=True, default=new_uuid)
    prediction_id = Column(String, ForeignKey("predictions.id"), nullable=False, index=True)
    language = Column(String, nullable=False)
    source = Column(String, nullable=False)  # "gemini" or "template"
    summary_text = Column(Text, nullable=False)
    model_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("prediction_id", "language", name="uq_explanations_prediction_language"),
    )

