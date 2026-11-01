"""
explain.py - POST /explain endpoint for plain-language and LLM summaries.
"""

import json
import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User, Prediction, Explanation as ExplanationModel
from app.schemas import ExplainRequest, ExplainResponse, FactorNote
from app.security import get_current_user
from app.errors import not_found
from app.ml.explain_text import (
    build_user_explanation,
    build_admin_explanation,
    build_safe_facts,
)
from app.llm.gemini_client import summarize

logger = logging.getLogger("datadynamo")

router = APIRouter(tags=["explain"])


@router.post("/explain", response_model=ExplainResponse)
def explain_prediction(
    body: ExplainRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate or retrieve a plain-language summary for a stored prediction.

    Loads the saved prediction by prediction_id.
    Standard users can only access their own predictions; admins can access any.
    Returns cached explanation if already saved; otherwise tries Gemini with fallback.
    """
    # 1. Load the prediction from DB
    prediction = db.query(Prediction).filter(Prediction.id == body.prediction_id).first()
    if not prediction:
        raise not_found("Prediction not found")

    if user.role != "admin" and prediction.user_id != user.id:
        raise not_found("Prediction not found")

    # 2. Normalize language
    raw_lang = (body.language or "en").lower().strip()
    target_lang = raw_lang if raw_lang in ["en", "hi", "mr"] else "en"

    # 3. Parse stored response and inputs
    resp_data = json.loads(prediction.response_json)
    inputs_data = json.loads(prediction.inputs_json) if prediction.inputs_json else {}

    top_factors = resp_data.get("explanation", {}).get("top_factors", [])
    risk_band = prediction.risk_band
    probability = prediction.probability

    # Build deterministic template explanation (always used for headline, factors, etc.)
    user_exp = build_user_explanation(
        top_factors,
        risk_band,
        probability,
        inputs=inputs_data,
    )

    factor_notes = None
    if "factor_notes" in user_exp and user_exp["factor_notes"]:
        factor_notes = [FactorNote(**fn) for fn in user_exp["factor_notes"]]

    admin_exp = None
    if user.role == "admin":
        admin_exp = build_admin_explanation(
            top_factors,
            risk_band,
            probability,
        )

    # 4. Check cache in explanations table
    cached = (
        db.query(ExplanationModel)
        .filter(
            ExplanationModel.prediction_id == prediction.id,
            ExplanationModel.language == target_lang,
        )
        .first()
    )

    if cached:
        return ExplainResponse(
            prediction_id=prediction.id,
            language=cached.language,
            summary=cached.summary_text,
            source=cached.source,  # "gemini" or "template"
            language_fallback=(target_lang != "en" and cached.source == "template"),
            headline=user_exp["headline"],
            main_factors=user_exp["main_factors"],
            factor_notes=factor_notes,
            other_inputs_note=user_exp.get("other_inputs_note"),
            disclaimer=user_exp["disclaimer"],
            admin=admin_exp,
        )

    # 5. Build safe facts and try Gemini
    safe_facts = build_safe_facts(top_factors, risk_band, probability)
    gemini_summary: Optional[str] = None
    source = "template"
    model_name = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

    from app.llm.gemini_client import check_and_record_rate_limits, GeminiRateLimitError

    try:
        check_and_record_rate_limits(user.id)
        gemini_summary = summarize(
            safe_facts=safe_facts,
            language=target_lang,
            user_id=None,  # already checked above
        )
        source = "gemini"
    except GeminiRateLimitError:
        logger.info("Gemini rate limit reached for user %s, falling back to template", user.id)
        gemini_summary = None
        source = "template"
    except Exception as e:
        logger.info("Gemini summarization unavailable (%s), using template fallback", type(e).__name__)
        gemini_summary = None
        source = "template"

    final_summary = gemini_summary if gemini_summary else user_exp["headline"]
    language_fallback = (target_lang != "en" and source == "template")

    # 6. Save to explanations table ONLY if Gemini succeeded (so failures can retry later)
    if source == "gemini":
        try:
            exp_row = ExplanationModel(
                prediction_id=prediction.id,
                language=target_lang,
                source="gemini",
                summary_text=final_summary,
                model_name=model_name,
            )
            db.add(exp_row)
            db.commit()
        except Exception as e:
            db.rollback()
            logger.warning("Could not cache explanation row: %s", type(e).__name__)

    return ExplainResponse(
        prediction_id=prediction.id,
        language=target_lang,
        summary=final_summary,
        source=source,
        language_fallback=language_fallback,
        headline=user_exp["headline"],
        main_factors=user_exp["main_factors"],
        factor_notes=factor_notes,
        other_inputs_note=user_exp.get("other_inputs_note"),
        disclaimer=user_exp["disclaimer"],
        admin=admin_exp,
    )
