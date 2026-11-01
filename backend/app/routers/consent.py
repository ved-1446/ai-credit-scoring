"""
consent.py — POST /consent
Records user's consent before a prediction.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User, Consent
from app.schemas import ConsentRequest, ConsentResponse
from app.security import get_current_user
from app.errors import AppError

router = APIRouter(tags=["consent"])


@router.post("/consent", response_model=ConsentResponse, status_code=201)
def create_consent(
    body: ConsentRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record that the user accepted the data-processing policy.
    accepted must be true, otherwise 422."""
    if not body.accepted:
        raise AppError(
            422, "VALIDATION_ERROR",
            "Request validation failed",
            [{"field": "accepted", "issue": "must be true"}],
        )

    consent = Consent(
        user_id=user.id,
        policy_version=body.policy_version,
    )
    db.add(consent)
    db.commit()
    db.refresh(consent)

    return ConsentResponse(
        consent_id=consent.id,
        policy_version=consent.policy_version,
        given_at=consent.given_at,
    )
