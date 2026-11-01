"""
explain_text.py - Convert top SHAP factors into plain-language sentences.

Generates user-facing, admin-facing, and safe LLM fact summaries
without making any external AI calls.
"""

import json
import os
import re
from typing import Any, Dict, List, Optional, Tuple

from app.ml.labels import get_source_field

# Load feature dictionary once at module import
_DICT_PATH = os.path.join(os.path.dirname(__file__), "feature_dictionary.json")
with open(_DICT_PATH, "r", encoding="utf-8") as _f:
    FEATURE_DICTIONARY: Dict[str, Dict[str, Any]] = json.load(_f)

DISCLAIMER_TEXT = (
    "Educational demo. This is not a real credit decision and not financial advice."
)
OTHER_INPUTS_NOTE_TEXT = (
    "This demo model also uses gender and age as inputs. "
    "See the fairness page for how this is checked."
)
ADMIN_SUBSET_NOTE_TEXT = (
    "Note: Factors were chosen from columns the website asks about, "
    "so this is NOT the model's absolute top 5."
)
OCCUPATION_BLANK_USER_NOTE = (
    "In the demo model's training data, a blank occupation was linked to a different "
    "risk level. This is a pattern in the data, not a judgement about you."
)
OCCUPATION_BLANK_ADMIN_NOTE = (
    "Blank optional fields can act as a signal in this model."
)


def _get_feature_info(feature_name: str) -> Dict[str, Any]:
    """Retrieve metadata entry for a feature from the dictionary."""
    if feature_name in FEATURE_DICTIONARY:
        return FEATURE_DICTIONARY[feature_name]
    clean_name = feature_name.replace("_", " ").strip().capitalize()
    return {
        "plain_name": clean_name,
        "subject": clean_name,
        "meaning": f"Model feature ({clean_name.lower()}).",
        "user_entered": "no",
        "group": "hidden",
    }


def _to_admin_subject(subject: str) -> str:
    """Convert 'your' or 'you' in subject phrase to 'the applicant's' or 'the applicant'."""
    # Case insensitive replacement for 'your' -> 'the applicant\'s'
    # and 'you' -> 'the applicant'
    res = re.sub(r"\bYour\b", "The applicant's", subject)
    res = re.sub(r"\byour\b", "the applicant's", res)
    res = re.sub(r"\bYou\b", "The applicant", res)
    res = re.sub(r"\byou\b", "the applicant", res)
    return res


def _format_user_factor(
    factor: Dict[str, Any],
    info: Dict[str, Any],
    inputs: Optional[Dict[str, Any]] = None,
) -> Tuple[str, Optional[str]]:
    """Build a plain-language sentence and optional note for a user factor."""
    shap_val = factor.get("shap_value", 0.0)
    verb_phrase = (
        "raised your risk estimate."
        if shap_val > 0
        else "lowered your risk estimate."
    )

    one_hot = info.get("one_hot")
    note = None

    if one_hot:
        val = factor.get("value")
        col = factor["feature"]
        src = factor.get("source_field") or get_source_field(col)
        cat = info.get("category", "")
        prefix = info.get("prefix", "")

        # Check special note for occupation blank
        if col == "OCCUPATION_TYPE_nan" and (val == 1 or val == 1.0 or val is True):
            note = OCCUPATION_BLANK_USER_NOTE

        if val == 1 or val == 1.0 or val is True:
            subject = one_hot["value_1"]
        else:
            actual_val = inputs.get(src) if inputs and src else None
            if (
                actual_val is not None
                and str(actual_val).strip() != ""
                and not prefix.startswith("FLAG_")
                and not prefix.startswith("EMERGENCYSTATE")
                and cat != "nan"
            ):
                field_label = info.get("plain_name", "category").lower()
                subject = f"Your {field_label}, {actual_val},"
            else:
                subject = one_hot.get("fallback_0", f"Not being in the '{cat}' group")

        return f"{subject} {verb_phrase}", note

    # Continuous / direct column
    subject = info.get("subject", info.get("plain_name", factor["feature"]))
    return f"{subject} {verb_phrase}", note


def _format_admin_factor(
    factor: Dict[str, Any],
    info: Dict[str, Any],
) -> Tuple[str, Optional[str]]:
    """Build a technical sentence and optional note for an admin factor."""
    shap_val = factor.get("shap_value", 0.0)
    verb_phrase = (
        "raised the risk estimate."
        if shap_val > 0
        else "lowered the risk estimate."
    )

    one_hot = info.get("one_hot")
    note = None
    col = factor["feature"]

    if col == "OCCUPATION_TYPE_nan" and (factor.get("value") == 1 or factor.get("value") == 1.0 or factor.get("value") is True):
        note = OCCUPATION_BLANK_ADMIN_NOTE

    if one_hot:
        val = factor.get("value")
        cat = info.get("category", "")
        if val == 1 or val == 1.0 or val is True:
            raw_subject = one_hot["value_1"]
        else:
            raw_subject = one_hot.get("fallback_0", f"Not being in the '{cat}' group")
        subject = _to_admin_subject(raw_subject)
        return f"{subject} {verb_phrase}", note

    raw_subject = info.get("subject", info.get("plain_name", factor["feature"]))
    subject = _to_admin_subject(raw_subject)
    return f"{subject} {verb_phrase}", note


def _deduplicate_by_source_field(factors: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Ensure each source field appears at most once, keeping largest |SHAP|."""
    best_by_source: Dict[str, Dict[str, Any]] = {}

    for f in factors:
        col = f["feature"]
        src = f.get("source_field") or get_source_field(col) or col
        info = _get_feature_info(col)
        group = info.get("group", "hidden")
        abs_shap = abs(f.get("shap_value", 0.0))

        if src not in best_by_source:
            best_by_source[src] = f
        else:
            prev_f = best_by_source[src]
            prev_col = prev_f["feature"]
            prev_group = _get_feature_info(prev_col).get("group", "hidden")
            prev_abs_shap = abs(prev_f.get("shap_value", 0.0))

            if prev_group == "hidden" and group != "hidden":
                best_by_source[src] = f
            elif prev_group != "hidden" and group == "hidden":
                pass
            elif abs_shap > prev_abs_shap:
                best_by_source[src] = f

    deduped = sorted(
        best_by_source.values(),
        key=lambda f: abs(f.get("shap_value", 0.0)),
        reverse=True,
    )
    return deduped


def build_user_explanation(
    top_factors: List[Dict[str, Any]],
    risk_band: str,
    probability: float,
    inputs: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Build a user-friendly plain-language explanation.

    Returns:
      headline: one sentence describing the estimated risk band and chance of not repaying
      main_factors: list of sentences for group 'application' only
      factor_notes: dict mapping factor index to extra explanation note if applicable
      other_inputs_note: neutral line about gender and age fairness check (always included)
      disclaimer: educational demo disclaimer
    """
    clean_band = str(risk_band).replace("_", " ").title()
    pct_str = f"{probability * 100:.1f}%"
    headline = (
        f"Your application is assessed as {clean_band} risk. "
        f"The risk score is about {pct_str}, a rough estimate from a demo model. "
        "These are the main factors from your application in this demo model."
    )

    deduped_factors = _deduplicate_by_source_field(top_factors)
    main_factors: List[str] = []
    factor_notes: List[Dict[str, str]] = []

    for factor in deduped_factors:
        col = factor["feature"]
        info = _get_feature_info(col)
        group = info.get("group", "hidden")

        if group == "application":
            sentence, note = _format_user_factor(factor, info, inputs=inputs)
            main_factors.append(sentence)
            if note:
                factor_notes.append({"factor": sentence, "note": note})

    res = {
        "headline": headline,
        "main_factors": main_factors,
        "other_inputs_note": OTHER_INPUTS_NOTE_TEXT,
        "disclaimer": DISCLAIMER_TEXT,
    }
    if factor_notes:
        res["factor_notes"] = factor_notes

    return res


def build_admin_explanation(
    top_factors: List[Dict[str, Any]],
    risk_band: str,
    probability: float,
) -> Dict[str, Any]:
    """Build an admin-level explanation including all factors and technical metadata."""
    clean_band = str(risk_band).replace("_", " ").title()
    pct_str = f"{probability * 100:.1f}%"
    headline = (
        f"Application assessed as {clean_band} risk "
        f"(estimated risk score: about {pct_str}). "
        "These are the main factors from the questions the website asks. "
        "They are not the model's absolute top 5."
    )

    factors_detail = []
    for factor in top_factors:
        col = factor["feature"]
        info = _get_feature_info(col)
        shap_val = factor.get("shap_value", 0.0)
        direction = "increases_risk" if shap_val > 0 else "decreases_risk"
        direction_phrase = (
            "raised the risk estimate"
            if shap_val > 0
            else "lowered the risk estimate"
        )
        plain_sentence, note = _format_admin_factor(factor, info)

        entry = {
            "feature": col,
            "plain_name": info.get("plain_name", col),
            "group": info.get("group", "hidden"),
            "user_entered": info.get("user_entered", "no"),
            "shap_value": shap_val,
            "direction": direction,
            "direction_phrase": direction_phrase,
            "sentence": plain_sentence,
            "raw_value": factor.get("value"),
        }
        if note:
            entry["note"] = note
        factors_detail.append(entry)

    return {
        "headline": headline,
        "factors": factors_detail,
        "note": ADMIN_SUBSET_NOTE_TEXT,
        "disclaimer": DISCLAIMER_TEXT,
    }


def build_safe_facts(
    top_factors: List[Dict[str, Any]],
    risk_band: str,
    probability: float,
) -> Dict[str, Any]:
    """Build sanitized summary for LLMs containing ONLY high-level facts.

    Includes ONLY factors whose group is 'application' (matching main_factors).
    Never contains raw values, names, emails, income, loan amounts, or shap numbers.
    """
    safe_factors = []
    deduped_factors = _deduplicate_by_source_field(top_factors)

    for factor in deduped_factors:
        col = factor["feature"]
        info = _get_feature_info(col)
        group = info.get("group", "hidden")
        if group != "application":
            continue

        shap_val = factor.get("shap_value", 0.0)
        direction = "increases_risk" if shap_val > 0 else "decreases_risk"

        safe_factors.append({
            "plain_name": info.get("summary_name", info.get("plain_name", factor.get("display_name", col))),
            "direction": direction,
        })

    return {
        "risk_band": str(risk_band),
        "probability": round(float(probability), 2),
        "probability_percent": round(float(probability) * 100, 1),
        "factors": safe_factors,
    }
