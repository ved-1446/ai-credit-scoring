"""
test_shap_invariant.py — Verify that sigmoid(output_log_odds) ≈ probability_of_default.

This is the critical invariant from contract §4.2:
"sigmoid(output_log_odds) equals probability_of_default within 1e-3"
"""

import numpy as np
import pytest

from app.ml.loader import store
from app.ml.predict import score_application

pytestmark = pytest.mark.skipif(
    not store.loaded,
    reason="Model artifacts not loaded — cannot test SHAP invariant",
)


def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-x))


# Several different input profiles to test with
TEST_PROFILES = [
    {
        "name": "typical_employed_female",
        "inputs": {
            "age_years": 34, "gender": "F", "amt_income_total": 180000,
            "amt_credit": 450000, "amt_annuity": 22500, "years_employed": 6.5,
            "name_contract_type": "Cash loans", "name_income_type": "Working",
            "name_education_type": "Higher education", "name_family_status": "Married",
            "name_housing_type": "House / apartment", "organization_type": "Services",
            "flag_own_car": False, "flag_own_realty": True,
            "cnt_children": 1, "cnt_fam_members": 3,
            "ext_source_2": 0.58, "ext_source_3": 0.42,
            "weekday_appr_process_start": "MONDAY", "hour_appr_process_start": 10,
        },
    },
    {
        "name": "young_male_unemployed",
        "inputs": {
            "age_years": 22, "gender": "M", "amt_income_total": 50000,
            "amt_credit": 100000, "amt_annuity": 8000, "years_employed": None,
            "name_contract_type": "Cash loans", "name_income_type": "Pensioner",
            "name_education_type": "Secondary / secondary special",
            "name_family_status": "Single / not married",
            "name_housing_type": "With parents", "organization_type": "XNA",
            "flag_own_car": False, "flag_own_realty": False,
            "cnt_children": 0, "cnt_fam_members": 1,
            "weekday_appr_process_start": "FRIDAY", "hour_appr_process_start": 14,
        },
    },
    {
        "name": "older_high_income",
        "inputs": {
            "age_years": 55, "gender": "F", "amt_income_total": 500000,
            "amt_credit": 1000000, "amt_annuity": 60000, "years_employed": 25,
            "name_contract_type": "Revolving loans", "name_income_type": "Commercial associate",
            "name_education_type": "Higher education", "name_family_status": "Widow",
            "name_housing_type": "House / apartment", "organization_type": "Bank",
            "flag_own_car": True, "flag_own_realty": True,
            "cnt_children": 2, "cnt_fam_members": 3,
            "ext_source_1": 0.7, "ext_source_2": 0.8, "ext_source_3": 0.9,
            "weekday_appr_process_start": "WEDNESDAY", "hour_appr_process_start": 9,
        },
    },
]


@pytest.mark.parametrize("profile", TEST_PROFILES, ids=[p["name"] for p in TEST_PROFILES])
def test_shap_invariant(profile):
    """sigmoid(output_log_odds) must be within 1e-3 of probability_of_default."""
    result = score_application(profile["inputs"], top_n=5)

    prob = result["probability_of_default"]
    log_odds = result["explanation"]["output_log_odds"]
    computed_prob = sigmoid(log_odds)

    assert abs(computed_prob - prob) < 1e-3, (
        f"SHAP invariant failed for {profile['name']}: "
        f"sigmoid({log_odds})={computed_prob:.6f} vs prob={prob:.6f}, "
        f"diff={abs(computed_prob - prob):.6f}"
    )
