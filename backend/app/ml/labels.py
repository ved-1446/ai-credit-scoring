"""
labels.py — Friendly display names for model features.

Maps raw column names → human-readable labels.
One-hot columns read "<field label>: <value>".
A _nan column reads "<field label>: not provided".
"""

# ─── Request-field → friendly label ───
FIELD_LABELS = {
    "age_years": "Age (years)",
    "gender": "Gender",
    "amt_income_total": "Annual income",
    "amt_credit": "Loan amount",
    "amt_annuity": "Annual repayment",
    "amt_goods_price": "Goods price",
    "years_employed": "Years employed",
    "name_contract_type": "Contract type",
    "name_income_type": "Income type",
    "name_education_type": "Education level",
    "name_family_status": "Family status",
    "name_housing_type": "Housing type",
    "organization_type": "Organization type",
    "occupation_type": "Occupation",
    "name_type_suite": "Accompanied by",
    "flag_own_car": "Owns a car",
    "flag_own_realty": "Owns property",
    "cnt_children": "Number of children",
    "cnt_fam_members": "Family members",
    "region_rating_client": "Region rating",
    "ext_source_1": "External credit score 1",
    "ext_source_2": "External credit score 2",
    "ext_source_3": "External credit score 3",
    "amt_req_credit_bureau_year": "Credit bureau inquiries (year)",
    "emergency_state_mode": "Housing survey emergency state",
    "weekday_appr_process_start": "Application weekday",
    "hour_appr_process_start": "Application hour",
}

# ─── Raw model column → the API request field it came from ───
# One-hot columns map to their parent request field.
# Engineered columns map to "derived".
# This is built dynamically in get_source_field().

# Mapping from Home Credit column name prefix to API request field
_COLUMN_PREFIX_TO_FIELD = {
    "NAME_CONTRACT_TYPE": "name_contract_type",
    "CODE_GENDER": "gender",
    "FLAG_OWN_CAR": "flag_own_car",
    "FLAG_OWN_REALTY": "flag_own_realty",
    "NAME_TYPE_SUITE": "name_type_suite",
    "NAME_INCOME_TYPE": "name_income_type",
    "NAME_EDUCATION_TYPE": "name_education_type",
    "NAME_FAMILY_STATUS": "name_family_status",
    "NAME_HOUSING_TYPE": "name_housing_type",
    "OCCUPATION_TYPE": "occupation_type",
    "WEEKDAY_APPR_PROCESS_START": "weekday_appr_process_start",
    "ORGANIZATION_TYPE": "organization_type",
    "EMERGENCYSTATE_MODE": "emergency_state_mode",
    # These two are never sent by the API, always NaN:
    "HOUSETYPE_MODE": None,
    "WALLSMATERIAL_MODE": None,
}

# Direct column → request field mappings for non-one-hot columns
_DIRECT_COLUMN_MAP = {
    "CNT_CHILDREN": "cnt_children",
    "AMT_INCOME_TOTAL": "amt_income_total",
    "AMT_CREDIT": "amt_credit",
    "AMT_ANNUITY": "amt_annuity",
    "AMT_GOODS_PRICE": "amt_goods_price",
    "CNT_FAM_MEMBERS": "cnt_fam_members",
    "REGION_RATING_CLIENT": "region_rating_client",
    "EXT_SOURCE_1": "ext_source_1",
    "EXT_SOURCE_2": "ext_source_2",
    "EXT_SOURCE_3": "ext_source_3",
    "AMT_REQ_CREDIT_BUREAU_YEAR": "amt_req_credit_bureau_year",
    "HOUR_APPR_PROCESS_START": "hour_appr_process_start",
    "AGE_YEARS": "age_years",
    "DAYS_BIRTH": "age_years",
    "YEARS_EMPLOYED": "years_employed",
    "DAYS_EMPLOYED": "years_employed",
    "IS_EMPLOYED": "years_employed",
}

# Derived columns that come from calculations, not directly from a field
_DERIVED_COLUMNS = {
    "credit_income_ratio", "annuity_income_ratio", "employed_age_ratio",
    "HAS_APARTMENT_INFO",
}

# Columns the API never sends — their values are always imputed medians.
# These should be SKIPPED in top_factors.
_NEVER_SENT_COLUMNS = set()
# We'll build this from the features list minus mappable columns.
# Includes FLAG_*, REG_*, apartment columns, etc.


def _is_user_influenceable(column: str) -> bool:
    """Return True if this column corresponds to something the user could change.
    Skip columns the API never sends (imputed medians only)."""
    # Check direct map
    if column in _DIRECT_COLUMN_MAP:
        return True
    # Check derived
    if column in _DERIVED_COLUMNS:
        return True
    # Check one-hot prefixes
    for prefix, field in _COLUMN_PREFIX_TO_FIELD.items():
        if column.startswith(prefix + "_") or column == prefix:
            # If field is None, this prefix is never sent (HOUSETYPE_MODE, WALLSMATERIAL_MODE)
            return field is not None
    return False


def get_source_field(column: str) -> str | None:
    """Return the API request field that this model column came from.
    Returns None for columns the API never sends.
    Returns 'derived' for engineered columns."""
    if column in _DERIVED_COLUMNS:
        return "derived"
    if column in _DIRECT_COLUMN_MAP:
        return _DIRECT_COLUMN_MAP[column]
    # Check one-hot prefixes (e.g. NAME_INCOME_TYPE_Working → name_income_type)
    for prefix, field in _COLUMN_PREFIX_TO_FIELD.items():
        if column.startswith(prefix + "_") or column == prefix:
            return field  # None for HOUSETYPE_MODE, WALLSMATERIAL_MODE
    return None


def get_display_name(column: str) -> str:
    """Return a human-readable label for a model column.
    One-hot columns: "<field label>: <value>".
    _nan columns: "<field label>: not provided".
    Unknown columns: cleaned-up version of the column name.
    """
    # Check direct columns first
    if column in _DIRECT_COLUMN_MAP:
        field = _DIRECT_COLUMN_MAP[column]
        return FIELD_LABELS.get(field, column)

    if column in _DERIVED_COLUMNS:
        names = {
            "credit_income_ratio": "Credit-to-income ratio",
            "annuity_income_ratio": "Repayment-to-income ratio",
            "employed_age_ratio": "Employment-to-age ratio",
            "HAS_APARTMENT_INFO": "Has apartment information",
        }
        return names.get(column, column)

    # Check one-hot prefixes
    for prefix, field in _COLUMN_PREFIX_TO_FIELD.items():
        if column.startswith(prefix + "_"):
            value = column[len(prefix) + 1:]  # everything after PREFIX_
            # Get the parent field's label
            if field is not None:
                parent_label = FIELD_LABELS.get(field, field)
            else:
                # HOUSETYPE_MODE or WALLSMATERIAL_MODE — use a reasonable label
                nice_prefix = prefix.replace("_", " ").title()
                parent_label = nice_prefix

            if value == "nan":
                return f"{parent_label}: not provided"
            else:
                return f"{parent_label}: {value}"

    # Fallback: clean up the column name
    return column.replace("_", " ").strip().capitalize()
