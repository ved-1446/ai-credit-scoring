"""
predict.py — Run the model: probability, risk band, SHAP top factors.

Uses the preprocessed 226-column DataFrame from preprocess.py.
Returns everything needed for the §4.2 response.
"""

import numpy as np
import logging

from app.ml.loader import store, get_risk_band
from app.ml.preprocess import preprocess
from app.ml.labels import get_source_field, get_display_name, _is_user_influenceable

logger = logging.getLogger("datadynamo")


def sigmoid(x: float) -> float:
    """Convert log-odds to probability."""
    return 1.0 / (1.0 + np.exp(-x))


def score_application(inputs: dict, top_n: int = 5) -> dict:
    """Run the full scoring pipeline on a set of validated inputs.

    Returns a dict with:
      probability_of_default, risk_band, flagged_high_risk,
      explanation (base_value, output_log_odds, top_factors),
      warnings, decision_threshold
    """
    # 1. Preprocess inputs → 226-column DataFrame
    X = preprocess(inputs)

    # 2. Get probability from the pipeline
    proba = store.pipeline.predict_proba(X)[:, 1][0]
    probability = round(float(proba), 4)

    # 3. Risk band and flag
    risk_band = get_risk_band(probability)
    flagged = probability >= store.decision_threshold

    # 4. SHAP explanation
    #    Compute SHAP values for all 226 columns
    shap_values = store.explainer.shap_values(X)
    shap_row = shap_values[0]  # first (only) row
    base_value = float(store.explainer.expected_value)

    # output_log_odds = base_value + sum(all SHAP values)
    output_log_odds = base_value + float(np.sum(shap_row))

    # 5. Build top_factors — only columns the user could have influenced
    feature_names = list(X.columns)
    values_row = X.iloc[0]

    # Pair up (column_name, shap_value, value) for user-influenceable columns
    factors = []
    for i, col in enumerate(feature_names):
        if not _is_user_influenceable(col):
            continue
        source = get_source_field(col)
        if source is None:
            continue
        sv = round(float(shap_row[i]), 4)
        val = values_row[col]
        # For one-hot columns, show 1 (or 0)
        if isinstance(val, (np.floating, float)):
            val = round(float(val), 4) if not np.isnan(val) else None
        elif isinstance(val, (np.integer, int)):
            val = int(val)

        factors.append({
            "feature": col,
            "source_field": source,
            "display_name": get_display_name(col),
            "value": val,
            "shap_value": sv,
            "direction": "increases_risk" if sv > 0 else "decreases_risk",
        })

    # Sort by absolute SHAP value, take top_n
    factors.sort(key=lambda f: abs(f["shap_value"]), reverse=True)
    top_factors = factors[:top_n]

    # 6. Build warnings
    warnings = _build_warnings(inputs)

    return {
        "probability_of_default": probability,
        "decision_threshold": store.decision_threshold,
        "flagged_high_risk": flagged,
        "risk_band": risk_band,
        "explanation": {
            "base_value": round(base_value, 4),
            "output_log_odds": round(output_log_odds, 4),
            "top_factors": top_factors,
        },
        "warnings": warnings,
        "model_version": store.model_version,
    }


def _build_warnings(inputs: dict) -> list[str]:
    """Generate warning messages for missing optional fields."""
    warnings = []

    # Nullable numeric fields that get median-imputed
    nullable_numeric = {
        "amt_goods_price": "amt_goods_price",
        "years_employed": "years_employed",
        "region_rating_client": "region_rating_client",
        "ext_source_1": "ext_source_1",
        "ext_source_2": "ext_source_2",
        "ext_source_3": "ext_source_3",
        "amt_req_credit_bureau_year": "amt_req_credit_bureau_year",
        "hour_appr_process_start": "hour_appr_process_start",
    }

    # Nullable categorical fields
    nullable_categorical = {
        "occupation_type": "occupation_type",
        "name_type_suite": "name_type_suite",
        "emergency_state_mode": "emergency_state_mode",
        "weekday_appr_process_start": "weekday_appr_process_start",
    }

    for field, label in nullable_numeric.items():
        if inputs.get(field) is None:
            warnings.append(f"{label} not provided; median value used")

    for field, label in nullable_categorical.items():
        if inputs.get(field) is None:
            warnings.append(f"{label} not provided")

    # Special warning for ext_source_2 or ext_source_3
    if inputs.get("ext_source_2") is None or inputs.get("ext_source_3") is None:
        warnings.append(
            "External credit scores are the strongest signals; "
            "leaving them blank makes the result less reliable"
        )

    return warnings
