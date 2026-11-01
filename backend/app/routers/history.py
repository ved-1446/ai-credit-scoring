"""
history.py — GET /history and GET /history/{request_id}
Shows the current user's predictions (newest first).
"""

import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User, Prediction
from app.schemas import HistoryItem, HistoryListResponse
from app.security import get_current_user
from app.errors import not_found

router = APIRouter(tags=["history"])


@router.get("/history", response_model=HistoryListResponse)
def list_history(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List the current user's predictions, newest first."""
    query = db.query(Prediction).filter(Prediction.user_id == user.id)
    total = query.count()
    predictions = (
        query.order_by(Prediction.created_at.desc())
        .offset(offset).limit(limit).all()
    )

    items = []
    for p in predictions:
        inputs = json.loads(p.inputs_json)
        items.append(HistoryItem(
            request_id=p.id,
            created_at=p.created_at,
            probability_of_default=p.probability,
            risk_band=p.risk_band,
            flagged_high_risk=p.flagged,
            amt_credit=inputs.get("amt_credit", 0),
            amt_income_total=inputs.get("amt_income_total", 0),
            name_contract_type=inputs.get("name_contract_type", ""),
        ))

    return HistoryListResponse(total=total, items=items)


@router.get("/history/{request_id}")
def get_prediction(
    request_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the full stored prediction response.
    Not found or not yours → 404 (admins can open any)."""
    prediction = db.query(Prediction).filter(Prediction.id == request_id).first()
    if not prediction:
        raise not_found("Prediction not found")

    # Check ownership (admins can see any)
    if user.role != "admin" and prediction.user_id != user.id:
        raise not_found("Prediction not found")

    # Return the full stored response JSON
    return json.loads(prediction.response_json)
