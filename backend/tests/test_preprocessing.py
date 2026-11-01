"""
test_preprocessing.py — Verify the preprocessing pipeline matches contract §14.

Tests:
- Output has exactly 226 columns in features_used order
- age 34 → AGE_YEARS 34 and DAYS_BIRTH −12410
- name_income_type="Working" sets NAME_INCOME_TYPE_Working to 1, others to 0
- null occupation_type sets OCCUPATION_TYPE_nan to 1
- null years_employed gives IS_EMPLOYED 0 and no NaN after imputation
- HAS_APARTMENT_INFO is 0
- A null optional field never crashes
"""

import numpy as np
import pytest

from app.ml.loader import store
from app.ml.preprocess import preprocess


# Skip all tests in this file if model not loaded
pytestmark = pytest.mark.skipif(
    not store.loaded,
    reason="Model artifacts not loaded — cannot test preprocessing",
)


FULL_INPUTS = {
    "age_years": 34,
    "gender": "F",
    "amt_income_total": 180000,
    "amt_credit": 450000,
    "amt_annuity": 22500,
    "years_employed": 6.5,
    "name_contract_type": "Cash loans",
    "name_income_type": "Working",
    "name_education_type": "Higher education",
    "name_family_status": "Married",
    "name_housing_type": "House / apartment",
    "organization_type": "Services",
    "flag_own_car": False,
    "flag_own_realty": True,
    "cnt_children": 1,
    "cnt_fam_members": 3,
    "ext_source_2": 0.58,
    "ext_source_3": 0.42,
    "weekday_appr_process_start": "MONDAY",
    "hour_appr_process_start": 10,
}


def test_output_shape_and_columns():
    """Output has exactly 226 columns in features_used order."""
    df = preprocess(FULL_INPUTS)
    features = store.metadata["features_used"]
    assert list(df.columns) == features
    assert df.shape == (1, 226)


def test_age_conversion():
    """age 34 → AGE_YEARS 34, DAYS_BIRTH −12410."""
    df = preprocess(FULL_INPUTS)
    assert df["AGE_YEARS"].iloc[0] == 34
    assert df["DAYS_BIRTH"].iloc[0] == -12410


def test_income_type_one_hot():
    """name_income_type='Working' → NAME_INCOME_TYPE_Working=1, others=0."""
    df = preprocess(FULL_INPUTS)
    assert df["NAME_INCOME_TYPE_Working"].iloc[0] == 1.0
    assert df["NAME_INCOME_TYPE_Pensioner"].iloc[0] == 0.0
    assert df["NAME_INCOME_TYPE_Commercial associate"].iloc[0] == 0.0
    assert df["NAME_INCOME_TYPE_State servant"].iloc[0] == 0.0


def test_null_occupation_type():
    """null occupation_type → OCCUPATION_TYPE_nan = 1."""
    inputs = {**FULL_INPUTS, "occupation_type": None}
    df = preprocess(inputs)
    assert df["OCCUPATION_TYPE_nan"].iloc[0] == 1.0


def test_null_years_employed():
    """null years_employed → IS_EMPLOYED=0, no NaN after imputation."""
    inputs = {**FULL_INPUTS, "years_employed": None}
    df = preprocess(inputs)
    assert df["IS_EMPLOYED"].iloc[0] == 0
    # No NaN should remain after imputation
    assert not df.isnull().any().any(), "NaN found after imputation"


def test_has_apartment_info_is_zero():
    """HAS_APARTMENT_INFO is always 0."""
    df = preprocess(FULL_INPUTS)
    assert df["HAS_APARTMENT_INFO"].iloc[0] == 0


def test_null_optional_fields_no_crash():
    """Setting all optional fields to None should not crash."""
    minimal = {
        "age_years": 25,
        "gender": "M",
        "amt_income_total": 100000,
        "amt_credit": 200000,
        "amt_annuity": 10000,
        "years_employed": None,
        "name_contract_type": "Cash loans",
        "name_income_type": "Pensioner",
        "name_education_type": "Higher education",
        "name_family_status": "Single / not married",
        "name_housing_type": "With parents",
        "organization_type": "XNA",
        "occupation_type": None,
        "name_type_suite": None,
        "flag_own_car": False,
        "flag_own_realty": False,
        "cnt_children": 0,
        "cnt_fam_members": 1,
        "region_rating_client": None,
        "ext_source_1": None,
        "ext_source_2": None,
        "ext_source_3": None,
        "amt_goods_price": None,
        "amt_req_credit_bureau_year": None,
        "emergency_state_mode": None,
        "weekday_appr_process_start": "TUESDAY",
        "hour_appr_process_start": 12,
    }
    df = preprocess(minimal)
    assert df.shape == (1, 226)
    assert not df.isnull().any().any()


def test_employed_columns_with_value():
    """years_employed=6.5 → YEARS_EMPLOYED=6, DAYS_EMPLOYED=-2372."""
    df = preprocess(FULL_INPUTS)
    assert df["YEARS_EMPLOYED"].iloc[0] == 6  # round(6.5) = 6 in Python (banker's rounding)
    assert df["DAYS_EMPLOYED"].iloc[0] == -round(6.5 * 365)
    assert df["IS_EMPLOYED"].iloc[0] == 1
