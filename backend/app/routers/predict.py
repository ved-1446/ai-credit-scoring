"""
predict.py — POST /predict and POST /whatif endpoints.
"""

import json
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User, Consent, Prediction
from app.schemas import (
    PredictRequest, PredictResponse, PredictInputs,
    WhatIfRequest, WhatIfResponse, WhatIfBaseline,
    Explanation, TopFactor,
)
from app.security import get_current_user
from app.errors import consent_required, model_not_loaded, not_found, prediction_error
from app.ml.loader import store
from app.ml.predict import score_application

logger = logging.getLogger("datadynamo")

router = APIRouter(tags=["predict"])


def _resolve_defaults(inputs_dict: dict) -> dict:
    """Fill in server defaults for weekday and hour if not provided."""
    now = datetime.now(timezone.utc)

    if inputs_dict.get("weekday_appr_process_start") is None:
        # Current UTC weekday, uppercase English name
        inputs_dict["weekday_appr_process_start"] = now.strftime("%A").upper()

    if inputs_dict.get("hour_appr_process_start") is None:
        inputs_dict["hour_appr_process_start"] = now.hour

    return inputs_dict


def _validate_consent(consent_id: str, user_id: str, db: Session) -> None:
    """Check that consent_id belongs to the caller and is under 24 hours old."""
    consent = db.query(Consent).filter(Consent.id == consent_id).first()
    if not consent:
        raise consent_required()
    if consent.user_id != user_id:
        raise consent_required()
    # Check age — must be under 24 hours
    now = datetime.now(timezone.utc)
    # Handle naive datetimes from SQLite
    given_at = consent.given_at
    if given_at.tzinfo is None:
        given_at = given_at.replace(tzinfo=timezone.utc)
    if now - given_at > timedelta(hours=24):
        raise consent_required()


@router.post("/predict", response_model=PredictResponse)
def predict(
    body: PredictRequest,
    top_n: int = Query(5, ge=1, le=10),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Score a credit application. Requires valid consent."""
    # Check model is loaded
    if not store.loaded:
        raise model_not_loaded()

    # Validate consent
    _validate_consent(body.consent_id, user.id, db)

    # Resolve defaults (weekday/hour) and get a plain dict
    inputs_dict = body.inputs.model_dump()
    inputs_dict = _resolve_defaults(inputs_dict)

    try:
        # Run the scoring pipeline
        result = score_application(inputs_dict, top_n=top_n)
    except Exception as e:
        logger.exception("Prediction failed: %s", e)
        raise prediction_error()

    # Build the full response
    now = datetime.now(timezone.utc)

    response_data = {
        "request_id": None,  # will be set after DB save
        "created_at": now.isoformat(),
        "model_version": result["model_version"],
        "probability_of_default": result["probability_of_default"],
        "decision_threshold": result["decision_threshold"],
        "flagged_high_risk": result["flagged_high_risk"],
        "risk_band": result["risk_band"],
        "explanation": result["explanation"],
        "warnings": result["warnings"],
        "inputs_used": inputs_dict,
    }

    # Save to database
    prediction = Prediction(
        user_id=user.id,
        consent_id=body.consent_id,
        inputs_json=json.dumps(inputs_dict),
        response_json="",  # will update after we have the id
        probability=result["probability_of_default"],
        risk_band=result["risk_band"],
        flagged=result["flagged_high_risk"],
        gender=inputs_dict["gender"],
        model_version=result["model_version"],
        created_at=now,
    )
    db.add(prediction)
    db.commit()
    db.refresh(prediction)

    # Now update response with the request_id and save the full response JSON
    response_data["request_id"] = prediction.id
    prediction.response_json = json.dumps(response_data, default=str)
    db.commit()

    return PredictResponse(
        request_id=prediction.id,
        created_at=now,
        model_version=result["model_version"],
        probability_of_default=result["probability_of_default"],
        decision_threshold=result["decision_threshold"],
        flagged_high_risk=result["flagged_high_risk"],
        risk_band=result["risk_band"],
        explanation=Explanation(
            base_value=result["explanation"]["base_value"],
            output_log_odds=result["explanation"]["output_log_odds"],
            top_factors=[TopFactor(**f) for f in result["explanation"]["top_factors"]],
        ),
        warnings=result["warnings"],
        inputs_used=inputs_dict,
    )


@router.post("/whatif", response_model=WhatIfResponse)
def whatif(
    body: WhatIfRequest,
    top_n: int = Query(5, ge=1, le=10),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Re-score a saved application with changes. Nothing is saved."""
    if not store.loaded:
        raise model_not_loaded()

    # Validate at least 1 change
    if not body.changes:
        from app.errors import AppError
        raise AppError(
            422, "VALIDATION_ERROR",
            "Request validation failed",
            [{"field": "changes", "issue": "must have at least 1 field"}],
        )

    # Load the original prediction
    prediction = db.query(Prediction).filter(Prediction.id == body.request_id).first()
    if not prediction:
        raise not_found("Prediction not found")

    # Check ownership (admins can use any)
    if user.role != "admin" and prediction.user_id != user.id:
        raise not_found("Prediction not found")

    # Load stored inputs and apply changes
    stored_inputs = json.loads(prediction.inputs_json)
    merged = {**stored_inputs, **body.changes}

    # Re-validate merged inputs with PredictInputs model
    try:
        validated = PredictInputs.model_validate(merged)
    except Exception as e:
        from app.errors import AppError
        # Extract validation details from pydantic error
        details = []
        if hasattr(e, 'errors'):
            for err in e.errors():
                loc_parts = [str(p) for p in err.get("loc", [])]
                field = ".".join(loc_parts)
                details.append({"field": f"changes.{field}" if field else "changes", "issue": err.get("msg", str(err))})
        else:
            details.append({"field": "changes", "issue": str(e)})
        raise AppError(422, "VALIDATION_ERROR", "Request validation failed", details)

    merged_dict = validated.model_dump()
    merged_dict = _resolve_defaults(merged_dict)

    try:
        result = score_application(merged_dict, top_n=top_n)
    except Exception as e:
        logger.exception("What-if prediction failed: %s", e)
        raise prediction_error()

    # Baseline from the original prediction
    baseline_prob = prediction.probability
    baseline_band = prediction.risk_band
    baseline_flagged = prediction.flagged

    delta = round(result["probability_of_default"] - baseline_prob, 4)

    return WhatIfResponse(
        is_simulation=True,
        base_request_id=body.request_id,
        model_version=result["model_version"],
        probability_of_default=result["probability_of_default"],
        decision_threshold=result["decision_threshold"],
        flagged_high_risk=result["flagged_high_risk"],
        risk_band=result["risk_band"],
        explanation=Explanation(
            base_value=result["explanation"]["base_value"],
            output_log_odds=result["explanation"]["output_log_odds"],
            top_factors=[TopFactor(**f) for f in result["explanation"]["top_factors"]],
        ),
        warnings=result["warnings"],
        inputs_used=merged_dict,
        baseline=WhatIfBaseline(
            probability_of_default=baseline_prob,
            risk_band=baseline_band,
            flagged_high_risk=baseline_flagged,
        ),
        delta_probability=delta,
    )
