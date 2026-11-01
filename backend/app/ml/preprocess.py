"""
preprocess.py — Convert the ~26 API fields into a 226-column DataFrame
ready for the model, following API_CONTRACT §14 exactly.

Steps (in order):
  1. Build one raw pandas row with Home Credit column names
  2. Compute AGE_YEARS, DAYS_BIRTH, YEARS_EMPLOYED, DAYS_EMPLOYED
  3. Set IS_EMPLOYED and HAS_APARTMENT_INFO flags
  4. One-hot encode categorical columns
  5. Add ratios (BEFORE imputing)
  6. Reindex to imputer columns, impute, keep DataFrame
  7. Select features_used (226 columns) in exact order
"""

import numpy as np
import pandas as pd

from app.ml.loader import store


def build_raw_row(inputs: dict) -> pd.DataFrame:
    """Step 1: Build a single-row DataFrame with Home Credit column names.
    Categorical columns have dtype object. Missing values are np.nan.
    Columns the API does not cover are np.nan.
    """
    row = {}

    # ─── Direct numeric mappings (request field → Home Credit column) ───
    row["CNT_CHILDREN"] = inputs["cnt_children"]
    row["AMT_INCOME_TOTAL"] = inputs["amt_income_total"]
    row["AMT_CREDIT"] = inputs["amt_credit"]
    row["AMT_ANNUITY"] = inputs["amt_annuity"]
    row["AMT_GOODS_PRICE"] = inputs.get("amt_goods_price")  # nullable
    row["CNT_FAM_MEMBERS"] = inputs["cnt_fam_members"]
    row["REGION_RATING_CLIENT"] = inputs.get("region_rating_client")
    row["EXT_SOURCE_1"] = inputs.get("ext_source_1")
    row["EXT_SOURCE_2"] = inputs.get("ext_source_2")
    row["EXT_SOURCE_3"] = inputs.get("ext_source_3")
    row["AMT_REQ_CREDIT_BUREAU_YEAR"] = inputs.get("amt_req_credit_bureau_year")
    row["HOUR_APPR_PROCESS_START"] = inputs.get("hour_appr_process_start")

    # ─── Categorical columns (dtype=object, None → np.nan) ───
    row["NAME_CONTRACT_TYPE"] = inputs["name_contract_type"]
    row["CODE_GENDER"] = inputs["gender"]

    # Boolean flags → "Y"/"N" strings for the encoder
    row["FLAG_OWN_CAR"] = "Y" if inputs["flag_own_car"] else "N"
    row["FLAG_OWN_REALTY"] = "Y" if inputs["flag_own_realty"] else "N"

    # Nullable categoricals — None becomes np.nan (encoder treats nan as a category)
    row["NAME_TYPE_SUITE"] = inputs.get("name_type_suite")
    row["NAME_INCOME_TYPE"] = inputs["name_income_type"]
    row["NAME_EDUCATION_TYPE"] = inputs["name_education_type"]
    row["NAME_FAMILY_STATUS"] = inputs["name_family_status"]
    row["NAME_HOUSING_TYPE"] = inputs["name_housing_type"]
    row["OCCUPATION_TYPE"] = inputs.get("occupation_type")
    row["WEEKDAY_APPR_PROCESS_START"] = inputs.get("weekday_appr_process_start")
    row["ORGANIZATION_TYPE"] = inputs["organization_type"]
    row["EMERGENCYSTATE_MODE"] = inputs.get("emergency_state_mode")

    # HOUSETYPE_MODE and WALLSMATERIAL_MODE are never sent → always NaN
    row["HOUSETYPE_MODE"] = np.nan
    row["WALLSMATERIAL_MODE"] = np.nan

    # Replace Python None with np.nan for all values
    for key in row:
        if row[key] is None:
            row[key] = np.nan

    # Build a single-row DataFrame
    df = pd.DataFrame([row])

    # Force categorical columns to object dtype so the encoder handles them
    cat_cols = [
        "NAME_CONTRACT_TYPE", "CODE_GENDER", "FLAG_OWN_CAR", "FLAG_OWN_REALTY",
        "NAME_TYPE_SUITE", "NAME_INCOME_TYPE", "NAME_EDUCATION_TYPE",
        "NAME_FAMILY_STATUS", "NAME_HOUSING_TYPE", "OCCUPATION_TYPE",
        "WEEKDAY_APPR_PROCESS_START", "ORGANIZATION_TYPE", "EMERGENCYSTATE_MODE",
        "HOUSETYPE_MODE", "WALLSMATERIAL_MODE",
    ]
    for col in cat_cols:
        if col in df.columns:
            df[col] = df[col].astype(object)

    return df


def add_year_day_columns(df: pd.DataFrame, inputs: dict) -> pd.DataFrame:
    """Step 2: Compute AGE_YEARS, DAYS_BIRTH, YEARS_EMPLOYED, DAYS_EMPLOYED."""
    age = inputs["age_years"]
    df["AGE_YEARS"] = round(age)
    df["DAYS_BIRTH"] = -round(age * 365)

    ye = inputs.get("years_employed")
    if ye is not None:
        df["YEARS_EMPLOYED"] = round(ye)
        df["DAYS_EMPLOYED"] = -round(ye * 365)
    else:
        df["YEARS_EMPLOYED"] = np.nan
        df["DAYS_EMPLOYED"] = np.nan

    return df


def add_flags(df: pd.DataFrame, inputs: dict) -> pd.DataFrame:
    """Step 3: IS_EMPLOYED = 1 if years_employed is not null, else 0.
    HAS_APARTMENT_INFO = 0 (API never receives apartment fields)."""
    df["IS_EMPLOYED"] = 1 if inputs.get("years_employed") is not None else 0
    df["HAS_APARTMENT_INFO"] = 0
    return df


def one_hot_encode(df: pd.DataFrame) -> pd.DataFrame:
    """Step 4: One-hot encode the 15 categorical columns with the fitted encoder.
    Uses encoder.feature_names_in_ order. Drops originals, appends encoded."""
    encoder = store.encoder

    # Get the categorical column names in the order the encoder expects
    cat_columns = list(encoder.feature_names_in_)

    # Extract those columns (in order), filling missing ones with NaN
    cat_data = df.reindex(columns=cat_columns)

    # Encode — produces a dense numpy array
    encoded = encoder.transform(cat_data)
    encoded_df = pd.DataFrame(
        encoded,
        columns=encoder.get_feature_names_out(),
        index=df.index,
    )

    # Drop original categorical columns, append encoded ones
    df = df.drop(columns=[c for c in cat_columns if c in df.columns])
    df = pd.concat([df, encoded_df], axis=1)

    return df


def add_ratios(df: pd.DataFrame) -> pd.DataFrame:
    """Step 5: Add ratios BEFORE imputing.
    A NaN YEARS_EMPLOYED gives a NaN employed_age_ratio."""
    df["credit_income_ratio"] = df["AMT_CREDIT"] / df["AMT_INCOME_TOTAL"]
    df["annuity_income_ratio"] = df["AMT_ANNUITY"] / df["AMT_INCOME_TOTAL"]
    df["employed_age_ratio"] = df["YEARS_EMPLOYED"] / df["AGE_YEARS"]
    return df


def impute(df: pd.DataFrame) -> pd.DataFrame:
    """Step 6: Reindex to imputer columns (227), impute, keep column names."""
    imputer = store.imputer
    imputer_cols = list(imputer.feature_names_in_)

    # Reindex — missing columns become NaN, cast to float
    df = df.reindex(columns=imputer_cols).astype(float)

    # Impute
    imputed = imputer.transform(df)
    df = pd.DataFrame(imputed, columns=imputer_cols, index=df.index)

    return df


def select_features(df: pd.DataFrame) -> pd.DataFrame:
    """Step 7: Select the 226 features_used in exact order.
    The one extra imputer column is simply dropped."""
    features = store.metadata["features_used"]
    return df[features]


def preprocess(inputs: dict) -> pd.DataFrame:
    """Full preprocessing pipeline: API inputs → 226-column model-ready DataFrame.
    This is the main entry point."""
    df = build_raw_row(inputs)
    df = add_year_day_columns(df, inputs)
    df = add_flags(df, inputs)
    df = one_hot_encode(df)
    df = add_ratios(df)
    df = impute(df)
    df = select_features(df)
    return df
