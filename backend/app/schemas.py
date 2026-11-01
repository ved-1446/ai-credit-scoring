"""
schemas.py — Pydantic v2 models matching API_CONTRACT exactly.
Every request model uses extra="forbid" so unknown fields → 422.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


# ─── Enum types from contract §3.1 ───

NameContractType = Literal["Cash loans", "Revolving loans"]
Gender = Literal["F", "M"]
NameTypeSuite = Literal[
    "Children", "Family", "Group of people",
    "Other_A", "Other_B", "Spouse, partner", "Unaccompanied",
]
NameIncomeType = Literal[
    "Commercial associate", "Pensioner", "State servant", "Working",
]
NameEducationType = Literal[
    "Higher education", "Incomplete higher",
    "Lower secondary", "Secondary / secondary special",
]
NameFamilyStatus = Literal[
    "Civil marriage", "Married", "Separated",
    "Single / not married", "Widow",
]
NameHousingType = Literal[
    "Co-op apartment", "House / apartment", "Municipal apartment",
    "Office apartment", "Rented apartment", "With parents",
]
OccupationType = Literal[
    "Accountants", "Cleaning staff", "Cooking staff", "Core staff",
    "Drivers", "HR staff", "High skill tech staff", "IT staff",
    "Laborers", "Low-skill Laborers", "Managers", "Medicine staff",
    "Private service staff", "Realty agents", "Sales staff",
    "Secretaries", "Security staff", "Waiters/barmen staff",
]
WeekdayType = Literal[
    "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY",
    "FRIDAY", "SATURDAY", "SUNDAY",
]
EmergencyStateMode = Literal["No", "Yes"]
OrganizationType = Literal[
    "Advertising", "Agriculture", "Bank",
    "Business Entity Type 1", "Business Entity Type 2", "Business Entity Type 3",
    "Cleaning", "Construction", "Culture", "Electricity", "Emergency",
    "Government", "Hotel", "Housing",
    "Industry: type 1", "Industry: type 11", "Industry: type 12",
    "Industry: type 13", "Industry: type 2", "Industry: type 3",
    "Industry: type 4", "Industry: type 5", "Industry: type 6",
    "Industry: type 7", "Industry: type 8", "Industry: type 9",
    "Insurance", "Kindergarten", "Legal Services", "Medicine",
    "Military", "Mobile", "Other", "Police", "Postal", "Realtor",
    "Restaurant", "School", "Security", "Security Ministries",
    "Self-employed", "Services", "Telecom",
    "Trade: type 1", "Trade: type 2", "Trade: type 3",
    "Trade: type 4", "Trade: type 6", "Trade: type 7",
    "Transport: type 1", "Transport: type 2", "Transport: type 3",
    "Transport: type 4", "University", "XNA",
]
RiskBand = Literal["LOW", "MEDIUM", "HIGH", "VERY_HIGH"]


# ─── Predict Inputs (contract §3) ───

class PredictInputs(BaseModel):
    """The ~26 fields the client sends for a credit risk prediction."""
    model_config = ConfigDict(extra="forbid")

    age_years: float = Field(..., ge=18, le=75)
    gender: Gender
    amt_income_total: float = Field(..., gt=0)
    amt_credit: float = Field(..., gt=0)
    amt_annuity: float = Field(..., gt=0)
    amt_goods_price: Optional[float] = Field(None, gt=0)
    years_employed: Optional[float] = Field(None, ge=0)
    name_contract_type: NameContractType
    name_income_type: NameIncomeType
    name_education_type: NameEducationType
    name_family_status: NameFamilyStatus
    name_housing_type: NameHousingType
    organization_type: OrganizationType
    occupation_type: Optional[OccupationType] = None
    name_type_suite: Optional[NameTypeSuite] = None
    flag_own_car: bool
    flag_own_realty: bool
    cnt_children: int = Field(..., ge=0, le=20)
    cnt_fam_members: int = Field(..., ge=1, le=21)
    region_rating_client: Optional[int] = Field(None, ge=1, le=3)
    ext_source_1: Optional[float] = Field(None, ge=0.0, le=1.0)
    ext_source_2: Optional[float] = Field(None, ge=0.0, le=1.0)
    ext_source_3: Optional[float] = Field(None, ge=0.0, le=1.0)
    amt_req_credit_bureau_year: Optional[int] = Field(None, ge=0)
    emergency_state_mode: Optional[EmergencyStateMode] = None
    weekday_appr_process_start: Optional[WeekdayType] = None
    hour_appr_process_start: Optional[int] = Field(None, ge=0, le=23)

    @model_validator(mode="after")
    def family_members_gte_children_plus_one(self):
        """cnt_fam_members must be >= cnt_children + 1 (at least the applicant)."""
        if self.cnt_fam_members < self.cnt_children + 1:
            raise ValueError("cnt_fam_members must be >= cnt_children + 1")
        return self


# ─── Auth schemas ───

class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(..., min_length=1)
    password: str = Field(..., min_length=8, max_length=72)
    full_name: str = Field(..., min_length=1)


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 3600
    user: UserResponse


# ─── Consent schemas ───

class ConsentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    policy_version: str
    accepted: bool


class ConsentResponse(BaseModel):
    consent_id: str
    policy_version: str
    given_at: datetime


# ─── Predict request / response ───

class PredictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    consent_id: str
    inputs: PredictInputs


class TopFactor(BaseModel):
    feature: str
    source_field: str
    display_name: str
    value: float | str | None
    shap_value: float
    direction: Literal["increases_risk", "decreases_risk"]


class Explanation(BaseModel):
    base_value: float
    output_log_odds: float
    top_factors: list[TopFactor]


class PredictResponse(BaseModel):
    request_id: str
    created_at: datetime
    model_version: str
    probability_of_default: float
    decision_threshold: float
    flagged_high_risk: bool
    risk_band: RiskBand
    explanation: Explanation
    warnings: list[str]
    inputs_used: dict


# ─── What-if schemas ───

class WhatIfRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    request_id: str
    changes: dict  # validated manually against PredictInputs fields


class WhatIfBaseline(BaseModel):
    probability_of_default: float
    risk_band: RiskBand
    flagged_high_risk: bool


class WhatIfResponse(BaseModel):
    is_simulation: bool = True
    base_request_id: str
    model_version: str
    probability_of_default: float
    decision_threshold: float
    flagged_high_risk: bool
    risk_band: RiskBand
    explanation: Explanation
    warnings: list[str]
    inputs_used: dict
    baseline: WhatIfBaseline
    delta_probability: float


# ─── Explain endpoint schemas (v1.1) ───

class FactorNote(BaseModel):
    factor: str
    note: str


class ExplainRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    prediction_id: str
    language: Optional[str] = "en"


class ExplainResponse(BaseModel):
    prediction_id: str
    language: str
    summary: str
    source: Literal["gemini", "template"]
    language_fallback: bool
    headline: str
    main_factors: list[str]
    factor_notes: Optional[list[FactorNote]] = None
    other_inputs_note: Optional[str] = None
    disclaimer: str
    admin: Optional[dict] = None


# ─── Chat endpoint schemas (v1.2) ───

class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    message: str
    language: Optional[str] = "en"
    prediction_id: Optional[str] = None
    topic: Optional[str] = None


class ChatResponse(BaseModel):
    answer: str
    source: Literal["gemini", "notes", "fixed"]
    language: str
    language_fallback: bool
    note_ids: list[str]
    suggested_topics: list[str]
    disclaimer: str


# ─── History schemas ───


class HistoryItem(BaseModel):
    request_id: str
    created_at: datetime
    probability_of_default: float
    risk_band: str
    flagged_high_risk: bool
    amt_credit: float
    amt_income_total: float
    name_contract_type: str


class HistoryListResponse(BaseModel):
    total: int
    items: list[HistoryItem]


# ─── Health ───

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_version: Optional[str] = None


# ─── Model metrics ───

class DatasetInfo(BaseModel):
    name: str
    n_train: int
    n_val: int
    n_test: int
    default_rate: float


class MetricsSet(BaseModel):
    pr_auc: Optional[float] = None
    roc_auc: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1: Optional[float] = None


class BaselineModel(BaseModel):
    name: str
    pr_auc: Optional[float] = None
    roc_auc: Optional[float] = None


class RiskBandInfo(BaseModel):
    band: str
    min: float
    max: float
    val_count: int
    val_default_rate: float


class FeatureImportance(BaseModel):
    feature: str
    display_name: str
    mean_abs_shap: float


class ModelMetricsResponse(BaseModel):
    model_name: str
    model_version: str
    trained_at: Optional[str] = None
    dataset: DatasetInfo
    n_features: int
    decision_threshold: float
    validation_metrics: MetricsSet
    test_metrics: MetricsSet
    baselines: Optional[list[BaselineModel]] = None
    risk_bands: list[RiskBandInfo]
    global_feature_importance: list[FeatureImportance]
    hyperparameters: Optional[dict] = None
    limitations: list[str]


# ─── Admin schemas ───

class AdminTotals(BaseModel):
    users: int
    predictions: int
    flagged: int


class PredictionPerDay(BaseModel):
    date: str
    count: int


class AdminRecentPrediction(BaseModel):
    request_id: str
    created_at: datetime
    probability_of_default: float
    risk_band: str
    flagged_high_risk: bool
    amt_credit: float
    amt_income_total: float
    name_contract_type: str
    user_email: str


class AdminStatsResponse(BaseModel):
    totals: AdminTotals
    flagged_rate: float
    avg_probability: float
    predictions_by_band: dict[str, int]
    predictions_per_day: list[PredictionPerDay]
    recent_predictions: list[AdminRecentPrediction]


class AdminPredictionItem(BaseModel):
    request_id: str
    created_at: datetime
    probability_of_default: float
    risk_band: str
    flagged_high_risk: bool
    amt_credit: float
    amt_income_total: float
    name_contract_type: str
    user_email: str


class AdminPredictionsResponse(BaseModel):
    total: int
    items: list[AdminPredictionItem]


class AdminUserItem(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    created_at: datetime
    prediction_count: int


class AdminUsersResponse(BaseModel):
    items: list[AdminUserItem]


class FairnessGroupOffline(BaseModel):
    group: str
    n: int
    flagged_rate: float
    observed_default_rate: float


class FairnessGroupLive(BaseModel):
    group: str
    n: int
    flagged_rate: float


class FairnessOffline(BaseModel):
    source: str
    by_gender: list[FairnessGroupOffline]
    by_age_band: list[FairnessGroupOffline]
    gender_flagged_rate_ratio: float


class FairnessLive(BaseModel):
    total_predictions: int
    by_gender: list[FairnessGroupLive]


class FairnessResponse(BaseModel):
    offline: FairnessOffline
    live: FairnessLive
    note: str


# ─── Error shape (contract §11) ───

class ErrorDetail(BaseModel):
    field: Optional[str] = None
    issue: str


class ErrorBody(BaseModel):
    code: str
    message: str
    details: Optional[list[ErrorDetail]] = None


class ErrorResponse(BaseModel):
    error: ErrorBody
