"""
admin.py — Admin-only endpoints (contract §10).
GET /admin/stats, /admin/predictions, /admin/users, /admin/fairness
"""

import json
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db import get_db
from app.models import User, Prediction
from app.schemas import (
    AdminStatsResponse, AdminTotals, PredictionPerDay,
    AdminRecentPrediction,
    AdminPredictionsResponse, AdminPredictionItem,
    AdminUsersResponse, AdminUserItem,
    FairnessResponse, FairnessOffline, FairnessLive,
    FairnessGroupOffline, FairnessGroupLive,
)
from app.security import require_admin
from app.ml.loader import store

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats", response_model=AdminStatsResponse)
def admin_stats(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Dashboard numbers for the admin overview."""
    total_users = db.query(User).count()
    total_predictions = db.query(Prediction).count()
    total_flagged = db.query(Prediction).filter(Prediction.flagged == True).count()

    flagged_rate = round(total_flagged / total_predictions, 4) if total_predictions > 0 else 0.0
    avg_prob_result = db.query(func.avg(Prediction.probability)).scalar()
    avg_prob = round(float(avg_prob_result), 4) if avg_prob_result else 0.0

    # Predictions by band
    band_counts = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "VERY_HIGH": 0}
    for band, count in db.query(Prediction.risk_band, func.count()).group_by(Prediction.risk_band).all():
        band_counts[band] = count

    # Predictions per day (last 14 days, zero-count days included)
    today = datetime.now(timezone.utc).date()
    per_day = {}
    for i in range(14):
        d = today - timedelta(days=13 - i)
        per_day[d.isoformat()] = 0

    # Query actual counts
    fourteen_days_ago = datetime.now(timezone.utc) - timedelta(days=14)
    rows = (
        db.query(
            func.date(Prediction.created_at),
            func.count(),
        )
        .filter(Prediction.created_at >= fourteen_days_ago)
        .group_by(func.date(Prediction.created_at))
        .all()
    )
    for date_val, count in rows:
        date_str = str(date_val)
        if date_str in per_day:
            per_day[date_str] = count

    predictions_per_day = [
        PredictionPerDay(date=d, count=c) for d, c in per_day.items()
    ]

    # Recent predictions (up to 10)
    recent = (
        db.query(Prediction, User.email)
        .join(User, Prediction.user_id == User.id)
        .order_by(Prediction.created_at.desc())
        .limit(10)
        .all()
    )
    recent_items = []
    for pred, email in recent:
        inputs = json.loads(pred.inputs_json)
        recent_items.append(AdminRecentPrediction(
            request_id=pred.id,
            created_at=pred.created_at,
            probability_of_default=pred.probability,
            risk_band=pred.risk_band,
            flagged_high_risk=pred.flagged,
            amt_credit=inputs.get("amt_credit", 0),
            amt_income_total=inputs.get("amt_income_total", 0),
            name_contract_type=inputs.get("name_contract_type", ""),
            user_email=email,
        ))

    return AdminStatsResponse(
        totals=AdminTotals(
            users=total_users,
            predictions=total_predictions,
            flagged=total_flagged,
        ),
        flagged_rate=flagged_rate,
        avg_probability=avg_prob,
        predictions_by_band=band_counts,
        predictions_per_day=predictions_per_day,
        recent_predictions=recent_items,
    )


@router.get("/predictions", response_model=AdminPredictionsResponse)
def admin_predictions(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    risk_band: str | None = Query(None),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """All predictions, optionally filtered by risk_band."""
    query = db.query(Prediction, User.email).join(User, Prediction.user_id == User.id)

    if risk_band:
        query = query.filter(Prediction.risk_band == risk_band)

    total = query.count()
    rows = query.order_by(Prediction.created_at.desc()).offset(offset).limit(limit).all()

    items = []
    for pred, email in rows:
        inputs = json.loads(pred.inputs_json)
        items.append(AdminPredictionItem(
            request_id=pred.id,
            created_at=pred.created_at,
            probability_of_default=pred.probability,
            risk_band=pred.risk_band,
            flagged_high_risk=pred.flagged,
            amt_credit=inputs.get("amt_credit", 0),
            amt_income_total=inputs.get("amt_income_total", 0),
            name_contract_type=inputs.get("name_contract_type", ""),
            user_email=email,
        ))

    return AdminPredictionsResponse(total=total, items=items)


@router.get("/users", response_model=AdminUsersResponse)
def admin_users(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List all users with their prediction counts."""
    users = db.query(User).all()
    items = []
    for u in users:
        pred_count = db.query(Prediction).filter(Prediction.user_id == u.id).count()
        items.append(AdminUserItem(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            role=u.role,
            created_at=u.created_at,
            prediction_count=pred_count,
        ))

    return AdminUsersResponse(items=items)


@router.get("/fairness", response_model=FairnessResponse)
def admin_fairness(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Fairness data — offline from metadata, live from stored predictions."""
    # ─── Offline data from model_metadata.json ───
    fairness_meta = store.metadata.get("fairness", {}) if store.metadata else {}

    by_gender_offline = [
        FairnessGroupOffline(**g) for g in fairness_meta.get("by_gender", [])
    ]
    by_age_offline = [
        FairnessGroupOffline(**g) for g in fairness_meta.get("by_age_band", [])
    ]
    gender_ratio = fairness_meta.get("gender_flagged_rate_ratio", 0.0)

    offline = FairnessOffline(
        source=fairness_meta.get("source", "validation set"),
        by_gender=by_gender_offline,
        by_age_band=by_age_offline,
        gender_flagged_rate_ratio=gender_ratio,
    )

    # ─── Live data from stored predictions ───
    total_live = db.query(Prediction).count()
    live_groups = []

    # Simpler query approach
    for gender_val in ["F", "M"]:
        n = db.query(Prediction).filter(Prediction.gender == gender_val).count()
        if n > 0:
            flagged_n = db.query(Prediction).filter(
                Prediction.gender == gender_val, Prediction.flagged == True
            ).count()
            rate = round(flagged_n / n, 4)
        else:
            rate = 0.0
        live_groups.append(FairnessGroupLive(group=gender_val, n=n, flagged_rate=rate))

    live = FairnessLive(
        total_predictions=total_live,
        by_gender=live_groups,
    )

    return FairnessResponse(
        offline=offline,
        live=live,
        note="Gender is a model input in this project. Flagged-rate gaps are shown, not corrected.",
    )
