"""
test_explain_text.py - Tests for plain-language dictionary and explain_text functions (Phase 2, 2.1 & 2.2).
"""

import json
import os
import re
import pytest
import pandas as pd

from app.ml.loader import store, load_artifacts
from app.ml.predict import score_application
from app.ml.explain_text import (
    FEATURE_DICTIONARY,
    build_user_explanation,
    build_admin_explanation,
    build_safe_facts,
    DISCLAIMER_TEXT,
    OTHER_INPUTS_NOTE_TEXT,
    OCCUPATION_BLANK_USER_NOTE,
    OCCUPATION_BLANK_ADMIN_NOTE,
)


@pytest.fixture(scope="session", autouse=True)
def init_model():
    if not store.loaded:
        artifacts_dir = os.path.join(os.path.dirname(__file__), "..", "..", "artifacts")
        load_artifacts(artifacts_dir)


def test_1_features_covered_by_dictionary():
    """1. Every column in features_used is covered by the dictionary (none missing)."""
    assert store.loaded, "Model artifacts must be loaded"
    features = store.metadata["features_used"]
    assert len(features) == 226
    for col in features:
        assert col in FEATURE_DICTIONARY, f"Column {col} missing from feature_dictionary.json"
        entry = FEATURE_DICTIONARY[col]
        assert "plain_name" in entry
        assert "meaning" in entry
        assert "user_entered" in entry
        assert entry["user_entered"] in ["yes", "derived", "no"]
        assert "group" in entry
        assert entry["group"] in ["application", "other_inputs", "admin_only", "hidden"]
        if entry["group"] == "application":
            assert "subject" in entry


def test_2_one_hot_wording_values():
    """2. For each one-hot wording, value 1 and value 0 produce different, correct sentences."""
    factor_val_0 = {
        "feature": "NAME_EDUCATION_TYPE_Secondary / secondary special",
        "value": 0,
        "shap_value": -0.25,
        "source_field": "name_education_type",
    }
    user_exp_0 = build_user_explanation([factor_val_0], "LOW", 0.03)
    sentence_0 = user_exp_0["main_factors"][0]
    assert "lowered your risk estimate." in sentence_0
    assert "Secondary / secondary special" in sentence_0
    # Must NOT claim user has secondary education
    assert "Your education level (Secondary / secondary special)" not in sentence_0

    factor_val_1 = {
        "feature": "NAME_EDUCATION_TYPE_Secondary / secondary special",
        "value": 1,
        "shap_value": 0.35,
        "source_field": "name_education_type",
    }
    user_exp_1 = build_user_explanation([factor_val_1], "HIGH", 0.18)
    sentence_1 = user_exp_1["main_factors"][0]
    assert "Your education level (Secondary / secondary special)" in sentence_1
    assert "raised your risk estimate." in sentence_1
    assert sentence_0 != sentence_1


def test_3_direction_matches_sign():
    """3. Direction test: for factors with each sign, lowered/raised matches the sign."""
    factor_pos = {
        "feature": "AMT_CREDIT",
        "value": 500000.0,
        "shap_value": 0.45,
        "source_field": "amt_credit",
    }
    factor_neg = {
        "feature": "EXT_SOURCE_2",
        "value": 0.7,
        "shap_value": -0.55,
        "source_field": "ext_source_2",
    }
    exp = build_user_explanation([factor_pos, factor_neg], "MEDIUM", 0.08)
    sentences = exp["main_factors"]

    credit_sentence = next(s for s in sentences if "loan amount" in s)
    score_sentence = next(s for s in sentences if "external credit score 2" in s)

    assert "raised your risk estimate." in credit_sentence
    assert "lowered your risk estimate." in score_sentence


def test_4_code_gender_neutral_note_and_admin():
    """4. CODE_GENDER_F never appears in main_factors, other_inputs_note is present; admin does show it."""
    gender_factor = {
        "feature": "CODE_GENDER_F",
        "value": 1,
        "shap_value": -0.15,
        "source_field": "gender",
    }
    user_exp = build_user_explanation([gender_factor], "LOW", 0.04)
    assert len(user_exp["main_factors"]) == 0
    assert user_exp["other_inputs_note"] == OTHER_INPUTS_NOTE_TEXT

    admin_exp = build_admin_explanation([gender_factor], "LOW", 0.04)
    admin_features = [f["feature"] for f in admin_exp["factors"]]
    assert "CODE_GENDER_F" in admin_features


def test_5_admin_only_columns():
    """5. WEEKDAY_APPR_PROCESS_START_* and HOUR_APPR_PROCESS_START never appear in user output, but appear in admin."""
    factors = [
        {
            "feature": "WEEKDAY_APPR_PROCESS_START_THURSDAY",
            "value": 1,
            "shap_value": 0.05,
            "source_field": "weekday_appr_process_start",
        },
        {
            "feature": "HOUR_APPR_PROCESS_START",
            "value": 14,
            "shap_value": -0.02,
            "source_field": "hour_appr_process_start",
        },
    ]
    user_exp = build_user_explanation(factors, "LOW", 0.04)
    assert len(user_exp["main_factors"]) == 0
    assert user_exp["other_inputs_note"] == OTHER_INPUTS_NOTE_TEXT

    admin_exp = build_admin_explanation(factors, "LOW", 0.04)
    assert len(admin_exp["factors"]) == 2
    admin_feats = [f["feature"] for f in admin_exp["factors"]]
    assert "WEEKDAY_APPR_PROCESS_START_THURSDAY" in admin_feats
    assert "HOUR_APPR_PROCESS_START" in admin_feats


def test_6_hidden_columns_never_in_user_output():
    """6. HAS_APARTMENT_INFO and all user_entered 'no' columns never appear in user output."""
    hidden_factors = [
        {
            "feature": "HAS_APARTMENT_INFO",
            "value": 0,
            "shap_value": 0.1,
            "source_field": "derived",
        },
        {
            "feature": "APARTMENTS_AVG",
            "value": 0.08,
            "shap_value": -0.1,
            "source_field": None,
        },
        {
            "feature": "FLAG_DOCUMENT_3",
            "value": 1,
            "shap_value": 0.05,
            "source_field": None,
        },
    ]
    user_exp = build_user_explanation(hidden_factors, "LOW", 0.04)
    assert len(user_exp["main_factors"]) == 0
    assert user_exp["other_inputs_note"] == OTHER_INPUTS_NOTE_TEXT


def test_7_safe_facts_no_raw_values():
    """7. build_safe_facts output contains no raw values, emails, or numeric dollar amounts."""
    sensitive_factor = {
        "feature": "AMT_INCOME_TOTAL",
        "value": 123456.0,
        "shap_value": -0.34,
        "source_field": "amt_income_total",
        "email": "secret_user@example.com",
    }
    safe = build_safe_facts([sensitive_factor], "LOW", 0.04123)
    safe_str = json.dumps(safe)

    assert "123456" not in safe_str
    assert "secret_user@example.com" not in safe_str
    assert "-0.34" not in safe_str
    assert safe["risk_band"] == "LOW"
    assert safe["probability"] == 0.04
    assert safe["factors"][0]["plain_name"] == "annual income"
    assert safe["factors"][0]["direction"] == "decreases_risk"


def test_8_duplicate_source_fields_deduplicated():
    """8. Duplicate source fields (AGE_YEARS + DAYS_BIRTH) yield one line."""
    factors = [
        {
            "feature": "DAYS_BIRTH",
            "value": -12775.0,
            "shap_value": -0.25,
            "source_field": "age_years",
        },
        {
            "feature": "AGE_YEARS",
            "value": 35.0,
            "shap_value": -0.15,
            "source_field": "age_years",
        },
    ]
    user_exp = build_user_explanation(factors, "LOW", 0.03)
    assert len(user_exp["main_factors"]) == 0
    assert user_exp["other_inputs_note"] == OTHER_INPUTS_NOTE_TEXT

    emp_factors = [
        {
            "feature": "YEARS_EMPLOYED",
            "value": 5.0,
            "shap_value": -0.30,
            "source_field": "years_employed",
        },
        {
            "feature": "DAYS_EMPLOYED",
            "value": -1825.0,
            "shap_value": -0.10,
            "source_field": "years_employed",
        },
    ]
    user_exp_emp = build_user_explanation(emp_factors, "LOW", 0.03)
    assert len(user_exp_emp["main_factors"]) == 1
    assert "Your years of employment lowered your risk estimate." == user_exp_emp["main_factors"][0]


def test_9_income_type_working_value_0_with_and_without_inputs():
    """Phase 2.1: NAME_INCOME_TYPE_Working with value 0 names actual income type when inputs given, fallback when not."""
    factor_working_0 = {
        "feature": "NAME_INCOME_TYPE_Working",
        "value": 0,
        "shap_value": -0.28,
        "source_field": "name_income_type",
    }
    # With inputs
    exp_with_inputs = build_user_explanation(
        [factor_working_0], "LOW", 0.03, inputs={"name_income_type": "Pensioner"}
    )
    sent_with_inputs = exp_with_inputs["main_factors"][0]
    assert sent_with_inputs == "Your income type, Pensioner, lowered your risk estimate."

    # Without inputs (fallback)
    exp_no_inputs = build_user_explanation([factor_working_0], "LOW", 0.03, inputs=None)
    sent_no_inputs = exp_no_inputs["main_factors"][0]
    assert sent_no_inputs == "Not being in the 'Working' group lowered your risk estimate."

    # Safe facts check for that case
    safe = build_safe_facts([factor_working_0], "LOW", 0.03)
    safe_factors = safe["factors"]
    assert len(safe_factors) == 1
    assert safe_factors[0] == {"plain_name": "income type", "direction": "decreases_risk"}
    assert "Pensioner" not in json.dumps(safe)


def test_10_occupation_blank_and_emergency_state_and_headline_checks():
    """Phase 2.2: Specific checks for occupation blank, emergency state, admin headline, and probability decimals."""
    # Occupation blank factor
    factor_occ_nan = {
        "feature": "OCCUPATION_TYPE_nan",
        "value": 1,
        "shap_value": -0.4251,
        "source_field": "occupation_type",
    }
    user_occ = build_user_explanation([factor_occ_nan], "LOW", 0.025)
    assert "Leaving occupation blank lowered your risk estimate." in user_occ["main_factors"][0]
    assert "factor_notes" in user_occ
    assert user_occ["factor_notes"][0]["note"] == OCCUPATION_BLANK_USER_NOTE

    admin_occ = build_admin_explanation([factor_occ_nan], "LOW", 0.025)
    assert admin_occ["factors"][0]["sentence"] == "Leaving occupation blank lowered the risk estimate."
    assert admin_occ["factors"][0]["note"] == OCCUPATION_BLANK_ADMIN_NOTE

    # Emergency state factor
    factor_emg_no = {
        "feature": "EMERGENCYSTATE_MODE_No",
        "value": 1,
        "shap_value": -0.3089,
        "source_field": "emergency_state_mode",
    }
    user_emg = build_user_explanation([factor_emg_no], "LOW", 0.025)
    assert user_emg["main_factors"][0] == "Answering 'No' to the optional housing-condition question lowered your risk estimate."
    assert "repairs" not in user_emg["main_factors"][0]

    # Admin headline check
    assert "top factors evaluated by the model" not in admin_occ["headline"]
    assert "These are the main factors from the questions the website asks. They are not the model's absolute top 5." in admin_occ["headline"]

    # Decimal check
    assert "about 2.5%" in user_occ["headline"]
    assert "about 2.5%" in admin_occ["headline"]


def test_11_all_parity_rows_and_clean_sentences():
    """Phase 2.2: Verify all 20 parity rows pass sentence structure, no illegal phrases."""
    raw_path = os.path.join(os.path.dirname(__file__), "fixtures", "parity_raw.csv")
    assert os.path.exists(raw_path), f"{raw_path} must exist"
    raw_df = pd.read_csv(raw_path)

    for i in range(len(raw_df)):
        row = raw_df.iloc[i].to_dict()
        for k, v in row.items():
            if pd.isna(v):
                row[k] = None

        result = score_application(row, top_n=5)
        top_factors = result["explanation"]["top_factors"]
        risk_band = result["risk_band"]
        prob = result["probability_of_default"]

        user_exp = build_user_explanation(top_factors, risk_band, prob, inputs=row)
        admin_exp = build_admin_explanation(top_factors, risk_band, prob)

        # Headline checks
        assert "risk score is about" in user_exp["headline"]
        assert "rough estimate from a demo model" in user_exp["headline"]
        assert user_exp["other_inputs_note"] == OTHER_INPUTS_NOTE_TEXT

        # Check probability has exactly one decimal point in percentage
        prob_match = re.search(r"about (\d+\.\d+)%", user_exp["headline"])
        assert prob_match is not None, f"Headline missing decimal percentage: {user_exp['headline']}"

        for sentence in user_exp["main_factors"]:
            assert sentence.endswith(".")
            assert not sentence.startswith("Your family members")
            assert "repairs" not in sentence
            assert "the the" not in sentence.lower()
            assert "your the" not in sentence.lower()
            assert "the your" not in sentence.lower()
            has_lowered = "lowered your risk estimate." in sentence
            has_raised = "raised your risk estimate." in sentence
            assert has_lowered != has_raised


def test_13_build_safe_facts_filters_other_inputs_and_admin_groups():
    """Phase 3.5: build_safe_facts excludes other_inputs, admin_only, and hidden groups."""
    mixed_factors = [
        {"feature": "CODE_GENDER_F", "value": 1.0, "shap_value": -0.20, "source_field": "code_gender"},
        {"feature": "AGE_YEARS", "value": 45.0, "shap_value": -0.15, "source_field": "age_years"},
        {"feature": "WEEKDAY_APPR_PROCESS_START_THURSDAY", "value": 1.0, "shap_value": 0.05, "source_field": "weekday_appr_process_start"},
        {"feature": "HOUR_APPR_PROCESS_START", "value": 10.0, "shap_value": 0.02, "source_field": "hour_appr_process_start"},
        {"feature": "AMT_INCOME_TOTAL", "value": 200000.0, "shap_value": -0.30, "source_field": "amt_income_total"},
        {"feature": "EXT_SOURCE_2", "value": 0.6, "shap_value": -0.25, "source_field": "ext_source_2"},
    ]
    safe = build_safe_facts(mixed_factors, "LOW", 0.025)
    factor_names = [f["plain_name"] for f in safe["factors"]]

    # Must contain only application factors
    assert "annual income" in factor_names
    assert "external credit score 2" in factor_names

    # Must NOT contain gender, age, weekday, or hour
    assert "Gender" not in factor_names
    assert "Age" not in factor_names
    assert not any("gender" in n.lower() for n in factor_names)
    assert not any("age" in n.lower() for n in factor_names)
    assert not any("weekday" in n.lower() for n in factor_names)
    assert not any("hour" in n.lower() for n in factor_names)


def test_14_all_application_entries_have_non_empty_summary_name():
    """Phase 3.7 (a): Every 'application' entry in feature_dictionary.json has a non-empty summary_name."""
    dict_path = os.path.join(os.path.dirname(__file__), "..", "app", "ml", "feature_dictionary.json")
    with open(dict_path, "r", encoding="utf-8") as f:
        d = json.load(f)

    for k, v in d.items():
        if v.get("group") == "application":
            summary_name = v.get("summary_name")
            assert summary_name is not None and len(summary_name.strip()) > 0, f"{k} missing summary_name"
            assert summary_name == summary_name.lower(), f"{k} summary_name must be lowercase: {summary_name}"


def test_15_parity_rows_build_safe_facts_returns_summary_names():
    """Phase 3.7 (b): build_safe_facts for parity rows 0, 5, 12 returns summary_name values."""
    raw_path = os.path.join(os.path.dirname(__file__), "fixtures", "parity_raw.csv")
    raw_df = pd.read_csv(raw_path)

    for row_idx in [0, 5, 12]:
        row_dict = raw_df.iloc[row_idx].to_dict()
        clean_inputs = {k: (None if pd.isna(v) else v) for k, v in row_dict.items()}

        result = score_application(clean_inputs, top_n=5)
        top_factors = result["explanation"]["top_factors"]
        risk_band = result["risk_band"]
        prob = result["probability_of_default"]

        safe = build_safe_facts(top_factors, risk_band, prob)
        for f in safe["factors"]:
            name = f["plain_name"]
            assert name == name.lower(), f"Factor name '{name}' should be lowercase summary_name"


