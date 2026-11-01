# Data Dynamo — API Contract v1.0 (FROZEN)

Single source of truth for backend and frontend. If code and this file disagree, this file wins: change the file first, then the code.

- Base URL (dev): `http://localhost:8000`
- Format: JSON in, JSON out, `Content-Type: application/json`
- Field names: `snake_case`. The backend maps them to the original Home Credit column names (§14).
- Auth: `Authorization: Bearer <jwt>` on every endpoint except `/health`, `/auth/register`, `/auth/login`.

---

## 1. Design decisions (read once)

1. **The client sends ~26 human-friendly fields, not 226 model columns.** Every model column not listed here is sent as `NaN` and filled by the imputer fitted on train.
2. **Engineered features are server-side only** (ratios, `IS_EMPLOYED`, `HAS_APARTMENT_INFO`, `DAYS_*`). The client never sends them.
3. **Probabilities are not true default rates.** The model was trained with SMOTE, so `probability_of_default` is inflated. Risk bands are defined relative to the decision threshold and validated on data (§6).
4. **Wording is "flagged for review", never "rejected".** Precision at the threshold is ~0.22: most flagged people would not default.
5. **Every response carries `model_version`** so results stay traceable after a retrain.
6. **Gender stays in the model** (decided). It is documented in `limitations` and monitored on the fairness page (§10.4).
7. **Consent comes before every application.** `/predict` needs a valid `consent_id`.
8. **The PDF report is built in the frontend** from a stored result. There is no PDF endpoint.

---

## 2. Endpoint summary

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | public | server + model status |
| POST | `/auth/register` | public | create a user account |
| POST | `/auth/login` | public | get a JWT |
| GET | `/auth/me` | user | current user |
| POST | `/consent` | user | record consent, get `consent_id` |
| POST | `/predict` | user | score an application, save it |
| POST | `/whatif` | user | re-score a saved application with changes (not saved) |
| GET | `/history` | user | list my predictions |
| GET | `/history/{request_id}` | user | one saved prediction in full |
| GET | `/model-metrics` | user | model scores, bands, importance |
| GET | `/admin/stats` | admin | dashboard numbers |
| GET | `/admin/predictions` | admin | all users' predictions |
| GET | `/admin/users` | admin | all users |
| GET | `/admin/fairness` | admin | fairness tables |

---

## 3. Shared schema: `PredictInputs`

Used inside `/predict` and returned as `inputs_used`.

| Field | Type | Required | Constraints | Notes |
|---|---|---|---|---|
| `age_years` | number | yes | 18 ≤ x ≤ 75 | |
| `gender` | enum | yes | `"M"`, `"F"` | encoder only knows these two |
| `amt_income_total` | number | yes | > 0 | annual income |
| `amt_credit` | number | yes | > 0 | loan amount requested |
| `amt_annuity` | number | yes | > 0 | yearly repayment |
| `amt_goods_price` | number \| null | no | > 0 | |
| `years_employed` | number \| null | no | ≥ 0 | `null` = not employed / pensioner |
| `name_contract_type` | enum | yes | see §3.1 | |
| `name_income_type` | enum | yes | see §3.1 | |
| `name_education_type` | enum | yes | see §3.1 | |
| `name_family_status` | enum | yes | see §3.1 | |
| `name_housing_type` | enum | yes | see §3.1 | |
| `organization_type` | enum | yes | see §3.1 | pensioners normally use `"XNA"` |
| `occupation_type` | enum \| null | no | see §3.1 | `null` → `OCCUPATION_TYPE_nan` |
| `name_type_suite` | enum \| null | no | see §3.1 | `null` → `NAME_TYPE_SUITE_nan` |
| `flag_own_car` | bool | yes | | mapped to `"Y"`/`"N"` |
| `flag_own_realty` | bool | yes | | mapped to `"Y"`/`"N"` |
| `cnt_children` | int | yes | 0–20 | |
| `cnt_fam_members` | int | yes | 1–21 | must be ≥ `cnt_children + 1` |
| `region_rating_client` | int \| null | no | 1, 2 or 3 | |
| `ext_source_1` | number \| null | no | 0.0–1.0 | external score |
| `ext_source_2` | number \| null | no | 0.0–1.0 | external score, **top SHAP feature** |
| `ext_source_3` | number \| null | no | 0.0–1.0 | external score, **top SHAP feature** |
| `amt_req_credit_bureau_year` | int \| null | no | ≥ 0 | |
| `emergency_state_mode` | enum \| null | no | `"Yes"`, `"No"` | `null` → `EMERGENCYSTATE_MODE_nan` |
| `weekday_appr_process_start` | enum \| null | no | 7 weekdays in §3.1 | `null` → server uses current UTC weekday |
| `hour_appr_process_start` | int \| null | no | 0–23 | `null` → server uses current UTC hour |

Rules:
- Unknown extra fields → **422** (`extra="forbid"`).
- `null` and omitted mean the same for optional fields.
- Enum values are checked against the lists below. The encoder never sees an unknown category.
- The two "process start" fields are normally omitted by the frontend. The resolved values appear in `inputs_used` and are stored, so history and what-if are reproducible.
- If `ext_source_2` or `ext_source_3` is `null`, the response adds a warning. The frontend should mark these two fields "strongly recommended".

### 3.1 Enum values (copied from `encoder.categories_`)

- `name_contract_type`: `"Cash loans"`, `"Revolving loans"`
- `gender`: `"F"`, `"M"`
- `name_type_suite`: `"Children"`, `"Family"`, `"Group of people"`, `"Other_A"`, `"Other_B"`, `"Spouse, partner"`, `"Unaccompanied"`
- `name_income_type`: `"Commercial associate"`, `"Pensioner"`, `"State servant"`, `"Working"`
- `name_education_type`: `"Higher education"`, `"Incomplete higher"`, `"Lower secondary"`, `"Secondary / secondary special"`
- `name_family_status`: `"Civil marriage"`, `"Married"`, `"Separated"`, `"Single / not married"`, `"Widow"`
- `name_housing_type`: `"Co-op apartment"`, `"House / apartment"`, `"Municipal apartment"`, `"Office apartment"`, `"Rented apartment"`, `"With parents"`
- `occupation_type` (18): `"Accountants"`, `"Cleaning staff"`, `"Cooking staff"`, `"Core staff"`, `"Drivers"`, `"HR staff"`, `"High skill tech staff"`, `"IT staff"`, `"Laborers"`, `"Low-skill Laborers"`, `"Managers"`, `"Medicine staff"`, `"Private service staff"`, `"Realty agents"`, `"Sales staff"`, `"Secretaries"`, `"Security staff"`, `"Waiters/barmen staff"`
- `weekday_appr_process_start`: `"MONDAY"`, `"TUESDAY"`, `"WEDNESDAY"`, `"THURSDAY"`, `"FRIDAY"`, `"SATURDAY"`, `"SUNDAY"`
- `emergency_state_mode`: `"No"`, `"Yes"`
- `organization_type` (55): `"Advertising"`, `"Agriculture"`, `"Bank"`, `"Business Entity Type 1"`, `"Business Entity Type 2"`, `"Business Entity Type 3"`, `"Cleaning"`, `"Construction"`, `"Culture"`, `"Electricity"`, `"Emergency"`, `"Government"`, `"Hotel"`, `"Housing"`, `"Industry: type 1"`, `"Industry: type 11"`, `"Industry: type 12"`, `"Industry: type 13"`, `"Industry: type 2"`, `"Industry: type 3"`, `"Industry: type 4"`, `"Industry: type 5"`, `"Industry: type 6"`, `"Industry: type 7"`, `"Industry: type 8"`, `"Industry: type 9"`, `"Insurance"`, `"Kindergarten"`, `"Legal Services"`, `"Medicine"`, `"Military"`, `"Mobile"`, `"Other"`, `"Police"`, `"Postal"`, `"Realtor"`, `"Restaurant"`, `"School"`, `"Security"`, `"Security Ministries"`, `"Self-employed"`, `"Services"`, `"Telecom"`, `"Trade: type 1"`, `"Trade: type 2"`, `"Trade: type 3"`, `"Trade: type 4"`, `"Trade: type 6"`, `"Trade: type 7"`, `"Transport: type 1"`, `"Transport: type 2"`, `"Transport: type 3"`, `"Transport: type 4"`, `"University"`, `"XNA"`

The frontend builds every dropdown from these lists.

---

## 4. `POST /predict`

Query param: `top_n` (int, 1–10, default 5) — number of SHAP factors returned.

### 4.1 Request

```json
{
  "consent_id": "6c1f0a52-...",
  "inputs": {
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
    "flag_own_car": false,
    "flag_own_realty": true,
    "cnt_children": 1,
    "cnt_fam_members": 3,
    "ext_source_2": 0.58,
    "ext_source_3": 0.42
  }
}
```

`consent_id` must belong to the caller and be less than 24 hours old, otherwise **403 `CONSENT_REQUIRED`**. One `consent_id` can be used for several predictions in that window.

### 4.2 Response `200`

```json
{
  "request_id": "f3b1c2d4-...",
  "created_at": "2026-09-30T10:15:00Z",
  "model_version": "xgb-smote-tuned-v1",
  "probability_of_default": 0.1842,
  "decision_threshold": 0.1315,
  "flagged_high_risk": true,
  "risk_band": "HIGH",
  "explanation": {
    "base_value": -2.71,
    "output_log_odds": -1.49,
    "top_factors": [
      {
        "feature": "EXT_SOURCE_3",
        "source_field": "ext_source_3",
        "display_name": "External credit score 3",
        "value": 0.42,
        "shap_value": 0.31,
        "direction": "increases_risk"
      }
    ]
  },
  "warnings": ["ext_source_1 not provided; median value used"],
  "inputs_used": { "...": "full PredictInputs with server defaults filled in" }
}
```

| Field | Type | Meaning |
|---|---|---|
| `request_id` | UUID4 string | database id; used by `/history` and `/whatif` |
| `created_at` | ISO-8601 UTC | |
| `model_version` | string | from `model_metadata.json` |
| `probability_of_default` | number 0–1, 4 dp | raw model probability (uncalibrated) |
| `decision_threshold` | number | from metadata, never hardcoded |
| `flagged_high_risk` | bool | `probability_of_default >= decision_threshold` |
| `risk_band` | enum | `LOW`, `MEDIUM`, `HIGH`, `VERY_HIGH` (§6) |
| `explanation.base_value` | number | SHAP expected value (log-odds) |
| `explanation.output_log_odds` | number | `base_value + sum(all SHAP values)` |
| `explanation.top_factors` | array, length `top_n` | sorted by `abs(shap_value)` descending |
| `top_factors[].feature` | string | model column name (may be one-hot, e.g. `NAME_INCOME_TYPE_Working`) |
| `top_factors[].source_field` | string | request field it came from; one-hot columns map to their parent field; engineered columns → `"derived"` |
| `top_factors[].display_name` | string | human label. One-hot example: `"Income type: Working"` |
| `top_factors[].value` | number \| string \| null | value the model saw (after imputation). One-hot columns show `1` |
| `top_factors[].shap_value` | number, 4 dp | log-odds contribution |
| `top_factors[].direction` | enum | `increases_risk` if `shap_value > 0`, else `decreases_risk` |
| `warnings` | string[] | non-fatal notes; `[]` if none |
| `inputs_used` | object | resolved inputs; stored for history and what-if |

**Invariant (test it):** `sigmoid(output_log_odds)` equals `probability_of_default` within 1e-3. If not, the SHAP explainer is not attached to the model that made the probability.

---

## 5. `POST /whatif`

Re-scores a saved application with some fields changed. **Nothing is saved.** No consent needed, because it only uses data the user already submitted.

```json
{
  "request_id": "f3b1c2d4-...",
  "changes": { "amt_credit": 300000, "amt_annuity": 15000 }
}
```

Rules:
- `changes` has at least 1 field. Keys must be `PredictInputs` fields. Same validation rules as §3.
- `request_id` must belong to the caller (admins may use any). Otherwise **404 `NOT_FOUND`**.
- The backend loads the stored `inputs_used`, applies `changes`, and runs the same scoring path as `/predict`.

Response `200`: same shape as §4.2, except `request_id` and `created_at` are absent, and these are added:

```json
{
  "is_simulation": true,
  "base_request_id": "f3b1c2d4-...",
  "baseline": { "probability_of_default": 0.1842, "risk_band": "HIGH", "flagged_high_risk": true },
  "delta_probability": -0.0513
}
```

`delta_probability` = new probability − baseline probability (negative means lower risk).

---

## 6. Risk bands

Defined relative to the threshold `t` (computed at startup, never hardcoded):

| Band | Rule | Approx. cut-off (t = 0.1315) |
|---|---|---|
| `LOW` | `p < 0.5·t` | below 0.066 |
| `MEDIUM` | `0.5·t ≤ p < t` | 0.066 to 0.1315 |
| `HIGH` | `t ≤ p < 2·t` | 0.1315 to 0.263 |
| `VERY_HIGH` | `p ≥ 2·t` | 0.263 and above |

Measured on the validation set (1,350 rows):

| Band | Rows | Observed default rate |
|---|---|---|
| `LOW` | 739 | 2.8% |
| `MEDIUM` | 357 | 7.6% |
| `HIGH` | 186 | 18.3% |
| `VERY_HIGH` | 68 | 30.9% |

Checked: the default rate rises at every step, so the bands stay as defined. The table is saved in `model_metadata.json` under `risk_bands`. `VERY_HIGH` is small (68 rows, about 21 defaults), so treat its rate as approximate.

---

## 7. `GET /model-metrics` → `200`

Everything comes from `model_metadata.json`; the endpoint computes nothing.

```json
{
  "model_name": "XGBoost + SMOTE (tuned)",
  "model_version": "xgb-smote-tuned-v1",
  "trained_at": "2026-09-27T00:00:00Z",
  "dataset": {
    "name": "Home Credit Default Risk (9,000-row sample)",
    "n_train": 6300, "n_val": 1350, "n_test": 1350,
    "default_rate": 0.076
  },
  "n_features": 226,
  "decision_threshold": 0.1315,
  "validation_metrics": { "pr_auc": 0.2426, "roc_auc": 0.7632, "precision": 0.2165, "recall": 0.5340, "f1": 0.3081 },
  "test_metrics": { "pr_auc": 0.0, "roc_auc": 0.0, "precision": 0.0, "recall": 0.0, "f1": 0.0 },
  "baselines": [
    {"name": "Logistic Regression", "pr_auc": 0.1233, "roc_auc": 0.6578},
    {"name": "XGBoost + scale_pos_weight", "pr_auc": 0.1535, "roc_auc": 0.6758},
    {"name": "XGBoost + SMOTE (untuned)", "pr_auc": 0.1865, "roc_auc": 0.7189}
  ],
  "risk_bands": [
    {"band": "LOW", "min": 0.0, "max": 0.0658, "val_count": 0, "val_default_rate": 0.0}
  ],
  "global_feature_importance": [
    {"feature": "EXT_SOURCE_3", "display_name": "External credit score 3", "mean_abs_shap": 0.0}
  ],
  "hyperparameters": {},
  "limitations": [
    "Trained on a 9,000-row sample; metrics are noisy.",
    "Probabilities are uncalibrated (SMOTE).",
    "Test scores (ROC-AUC 0.70, PR-AUC 0.16) are lower than validation scores, because validation was used for tuning.",
    "Precision is ~22% at the chosen threshold; flagged does not mean will default.",
    "Gender is used as a model input (project decision); see the fairness page.",
    "Educational project, not for real lending decisions."
  ]
}
```

Values shown as `0` / `0.0` are placeholders filled from metadata. `global_feature_importance` returns the top 10. The backend adds `display_name` from its own label map.

---

## 8. Auth and consent

### 8.1 `POST /auth/register` → `201`

```json
{ "email": "a@b.com", "password": "at-least-8-chars", "full_name": "Asha Rao" }
```
- Email is lower-cased. Password 8–72 characters (bcrypt limit).
- Response: `{ "id": "...", "email": "a@b.com", "full_name": "Asha Rao", "role": "user" }`
- Duplicate email → **409 `EMAIL_TAKEN`**.
- Everyone who registers is `role: "user"`. The admin account is created at startup from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (§13).

### 8.2 `POST /auth/login` → `200`

```json
{ "email": "a@b.com", "password": "..." }
```
Response:
```json
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": { "id": "...", "email": "a@b.com", "full_name": "Asha Rao", "role": "user" }
}
```
- JWT: HS256, claims `sub` (user id), `role`, `exp` (60 minutes).
- Wrong email or password → **401 `INVALID_CREDENTIALS`** (same message for both).
- Missing/expired token on a protected route → **401 `UNAUTHENTICATED`**.

### 8.3 `GET /auth/me` → `200`
Returns the `user` object from above.

### 8.4 `POST /consent` → `201`

```json
{ "policy_version": "v1", "accepted": true }
```
- `accepted` must be `true`, else **422**.
- Response: `{ "consent_id": "6c1f0a52-...", "policy_version": "v1", "given_at": "2026-09-30T10:14:00Z" }`

---

## 9. History

### 9.1 `GET /history?limit=20&offset=0` → `200`

```json
{
  "total": 1,
  "items": [
    {
      "request_id": "f3b1c2d4-...",
      "created_at": "2026-09-30T10:15:00Z",
      "probability_of_default": 0.1842,
      "risk_band": "HIGH",
      "flagged_high_risk": true,
      "amt_credit": 450000,
      "amt_income_total": 180000,
      "name_contract_type": "Cash loans"
    }
  ]
}
```
Newest first. `limit` 1–100.

### 9.2 `GET /history/{request_id}` → `200`
The full stored response (same shape as §4.2). Not found, or not yours → **404 `NOT_FOUND`** (admins can open any).

---

## 10. Admin (role `admin`, otherwise **403 `FORBIDDEN`**)

### 10.1 `GET /admin/stats` → `200`

```json
{
  "totals": { "users": 0, "predictions": 0, "flagged": 0 },
  "flagged_rate": 0.0,
  "avg_probability": 0.0,
  "predictions_by_band": { "LOW": 0, "MEDIUM": 0, "HIGH": 0, "VERY_HIGH": 0 },
  "predictions_per_day": [ { "date": "2026-09-30", "count": 0 } ],
  "recent_predictions": [ { "...": "history item + user_email, up to 10" } ]
}
```
`predictions_per_day` covers the last 14 days, with zero-count days included.

### 10.2 `GET /admin/predictions?limit=20&offset=0&risk_band=HIGH` → `200`
Same as §9.1, each item also has `user_email`. `risk_band` filter is optional.

### 10.3 `GET /admin/users` → `200`
```json
{ "items": [ { "id": "...", "email": "a@b.com", "full_name": "Asha Rao", "role": "user", "created_at": "...", "prediction_count": 3 } ] }
```

### 10.4 `GET /admin/fairness` → `200`

```json
{
  "offline": {
    "source": "validation set",
    "by_gender": [ { "group": "F", "n": 0, "flagged_rate": 0.0, "observed_default_rate": 0.0 } ],
    "by_age_band": [ { "group": "<30", "n": 0, "flagged_rate": 0.0, "observed_default_rate": 0.0 } ],
    "gender_flagged_rate_ratio": 0.0
  },
  "live": {
    "total_predictions": 0,
    "by_gender": [ { "group": "F", "n": 0, "flagged_rate": 0.0 } ]
  },
  "note": "Gender is a model input in this project. Flagged-rate gaps are shown, not corrected."
}
```
- `offline` comes from `model_metadata.json` (`fairness` block). Age bands: `<30`, `30-45`, `45+`.
- `gender_flagged_rate_ratio` = lowest group flagged rate ÷ highest (1.0 = equal).
- `live` is computed from stored predictions.

---

## 11. Errors and `GET /health`

All non-2xx responses share one shape (override FastAPI's default 422 handler):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [ { "field": "inputs.ext_source_2", "issue": "must be between 0 and 1" } ]
  }
}
```

| Status | `code` | When |
|---|---|---|
| 401 | `UNAUTHENTICATED` | missing, bad or expired token |
| 401 | `INVALID_CREDENTIALS` | wrong email or password |
| 403 | `FORBIDDEN` | user token on an admin route |
| 403 | `CONSENT_REQUIRED` | `consent_id` missing, not yours, or older than 24 h |
| 404 | `NOT_FOUND` | prediction missing or not yours |
| 409 | `EMAIL_TAKEN` | registering an existing email |
| 422 | `VALIDATION_ERROR` | bad type/range/enum, missing field, unknown field |
| 503 | `MODEL_NOT_LOADED` | joblib or metadata failed to load at startup |
| 500 | `PREDICTION_ERROR` | anything unexpected; generic message, details only in server logs |

`GET /health` → `200 {"status": "ok", "model_loaded": true, "model_version": "xgb-smote-tuned-v1"}`, or `503 {"status": "degraded", "model_loaded": false}`.

---

## 12. Database (SQLAlchemy; SQLite in dev, PostgreSQL in Docker)

| Table | Columns |
|---|---|
| `users` | `id` (uuid, pk), `email` (unique), `full_name`, `password_hash`, `role` (`user`/`admin`), `created_at` |
| `consents` | `id` (uuid, pk), `user_id` (fk), `policy_version`, `given_at` |
| `predictions` | `id` (uuid, pk = `request_id`), `user_id` (fk), `consent_id` (fk), `inputs_json`, `response_json`, `probability`, `risk_band`, `flagged` (bool), `gender`, `model_version`, `created_at` |

`gender` is copied out of the inputs so the fairness page can group without parsing JSON.

---

## 13. Config and containers

Environment variables (backend): `SECRET_KEY`, `DATABASE_URL`, `CORS_ORIGINS` (comma-separated), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `MODEL_PATH`, `METADATA_PATH`.

CORS: explicit origins only, no wildcard. Dev: `http://localhost:5173` (Vite). Docker: `http://localhost:3000`.

Docker Compose services: `db` (PostgreSQL), `backend` (FastAPI on port 8000), `frontend` (React build served by nginx on port 3000). `docker compose up` must start everything. The model files are copied into the backend image.

---

## 14. Server-side feature rules (confirmed against the notebook)

The backend repeats the training steps in exactly this order:

1. **Build one raw row** with the original Home Credit column names. Map request fields to columns (`gender → CODE_GENDER`, `flag_own_car → FLAG_OWN_CAR` as `"Y"`/`"N"`, `amt_income_total → AMT_INCOME_TOTAL`, and so on: same name upper-cased unless noted). Every column the API does not cover is `NaN`. A categorical `null` is also `NaN`.
2. **Year and day columns** (training used whole years and a factor of 365):
   - `AGE_YEARS = round(age_years)`, `DAYS_BIRTH = -round(age_years × 365)`
   - `YEARS_EMPLOYED = round(years_employed)`, `DAYS_EMPLOYED = -round(years_employed × 365)`
   - If `years_employed` is `null`, both employed columns are `NaN`.
3. **Flags:** `IS_EMPLOYED = 1` if `years_employed` is not null, else `0`. `HAS_APARTMENT_INFO = 0` (in training it meant "`COMMONAREA_AVG` is not missing"; the API never receives apartment fields).
4. **One-hot encode** the 15 categorical columns with `encoder.joblib` (`handle_unknown="ignore"`, dense output). Take the columns in `encoder.feature_names_in_` order, drop the originals, append the encoded columns. `NaN` becomes `<COLUMN>_nan = 1` for the five columns whose encoder includes NaN (`NAME_TYPE_SUITE`, `OCCUPATION_TYPE`, `HOUSETYPE_MODE`, `WALLSMATERIAL_MODE`, `EMERGENCYSTATE_MODE`). `HOUSETYPE_MODE` and `WALLSMATERIAL_MODE` are never sent, so they are always `_nan`.
5. **Ratios**, computed on the encoded frame **before imputing**: `credit_income_ratio = AMT_CREDIT / AMT_INCOME_TOTAL`, `annuity_income_ratio = AMT_ANNUITY / AMT_INCOME_TOTAL`, `employed_age_ratio = YEARS_EMPLOYED / AGE_YEARS`. If `YEARS_EMPLOYED` is `NaN`, the ratio is `NaN` and the imputer fills it (same as in training).
6. **Impute:** reindex the row to `imputer.feature_names_in_` (227 columns; columns we never set are `NaN`), then `imputer.transform`. This also fills the constant columns (`FLAG_MOBIL`, `FLAG_DOCUMENT_4/10/12`), because the median of a constant is that constant.
7. **Select** the 226 columns named in `features_used`, in that order (the one extra imputer column is simply dropped), then call the pipeline.

**Parity test (most important backend test):** take ~20 raw validation rows, push them through this code path, and assert the result equals the matching rows of `X_val`.

---

## 15. Before you freeze: checklist

- [x] Replace placeholder enum lists with real `encoder.categories_` values (§3.1)
- [x] Confirm what `credit_risk_pipeline.joblib` contains (SMOTE + XGBoost only; `encoder.joblib` and `imputer.joblib` are saved). If it is only SMOTE + XGBoost, save the fitted **encoder** and **imputer** as joblib files too
- [x] Confirm the last two unknowns in §14: `AGE_YEARS` is `(-DAYS_BIRTH / 365).round()`; ratios are computed before imputation
- [x] Run `freeze_metadata.py` in the notebook: adds `risk_bands`, `test_metrics`, `global_feature_importance`, `fairness`, `model_version`, `trained_at` to `model_metadata.json`
- [x] Check the SHAP invariant gap printed by that script (must be < 1e-3)
- [x] Check `risk_bands` default rates rise from LOW to VERY_HIGH; adjust §6 if not
- [x] Decide `handle_unknown` of the encoder: it is `"ignore"` (irrelevant while enums are enforced)
- [x] Decide keep/drop `gender` → keep (§1.6)

All boxes are ticked: **this contract is FROZEN.** Breaking change → `v2` path (`/v2/predict`); additive changes stay in v1.

---

## v1.1 - /explain

### POST /explain

Generates or retrieves a plain-language explanation of a saved prediction.

- **Auth:** Required (Bearer JWT).
- **Ownership:** Standard users can only request explanations for their own predictions (404 if not found or unauthorized). Admins can request explanations for any prediction.
- **Request Body:**
  ```json
  {
    "prediction_id": "uuid-string",
    "language": "en"
  }
  ```
  `language` options: `"en"`, `"hi"`, `"mr"` (defaults to `"en"`).
- **Response (`200 OK`):**
  ```json
  {
    "prediction_id": "uuid-string",
    "language": "en",
    "summary": "Plain language summary sentence(s)",
    "source": "gemini",
    "language_fallback": false,
    "headline": "Your application is assessed as ...",
    "main_factors": [
      "Your external credit score 2 lowered your risk estimate."
    ],
    "factor_notes": [
      {
        "factor": "Leaving occupation blank lowered your risk estimate.",
        "note": "In the demo model's training data, a blank occupation was linked to a different risk level. This is a pattern in the data, not a judgement about you."
      }
    ],
    "other_inputs_note": "This demo model also uses gender and age as inputs. See the fairness page for how this is checked.",
    "disclaimer": "Educational demo. This is not a real credit decision and not financial advice.",
    "admin": null
  }
  ```
- **Admin Extension:** When called by an admin user, the response includes an `admin` object containing detailed technical breakdown with raw SHAP signs, values, and subset notes. Admin outputs never go to external LLMs.
- **Fallback Rules:**
  - If `GEMINI_API_KEY` is not set, rate limit is exceeded, or Gemini fails/times out, the endpoint falls back gracefully to deterministic template text (`source: "template"`, `200 OK`).
  - Output guard enforces character limit ($\le 700$ chars), bans markdown/links, and rejects unauthorized numbers.
  - Successful Gemini results are cached in the `explanations` database table.


---

## 18. v1.2 - /chat

### POST /chat

Interactive help and educational chatbot powered by TF-IDF Retrieval-Augmented Generation (RAG) and Google Gemini.

- **Auth:** Required (Bearer JWT).
- **Request Body:**
  ```json
  {
    "message": "What does external credit score mean?",
    "language": "en",
    "prediction_id": "optional-uuid-string",
    "topic": "optional-note-id"
  }
  ```
  - `message`: Required string (1 to 300 characters after whitespace trimming).
  - `language`: Optional string (`"en"`, `"hi"`, `"mr"`, defaults to `"en"`).
  - `prediction_id`: Optional UUID string of a saved prediction. Standard users can only attach their own predictions (404 otherwise); admins can attach any.
  - `topic`: Optional note ID to anchor the retrieved context (e.g. from suggested topic chips).
- **Response (`200 OK`):**
  ```json
  {
    "answer": "External credit scores 1, 2, and 3 are normalized credit bureau scores...",
    "source": "gemini",
    "language": "en",
    "language_fallback": false,
    "note_ids": ["external_credit_scores", "technical_terms_explained", "percentage_meaning"],
    "suggested_topics": ["external_credit_scores", "technical_terms_explained", "percentage_meaning"],
    "disclaimer": "Educational demo, not a real credit decision, not financial advice."
  }
  ```
  - `source`: One of `"gemini"`, `"notes"`, or `"fixed"`.
  - `language_fallback`: `true` if requested language was unsupported and fell back to English.
  - `note_ids`: List of note IDs used in context.
  - `suggested_topics`: 3 suggested topic IDs for follow-up questions.
- **Privacy & Safety Rules:**
  - The message text is never persisted to database tables and never logged.
  - If `prediction_id` is supplied, ONLY safe facts (risk level word, one-decimal percentage, and application group reason names with direction) are included in the prompt context. User name, email, raw income, loan amounts, and input parameters are NEVER sent to Google.
  - Output guard enforces $\le 900$ characters, forbids markdown/links, and rejects unauthorized numbers not present in the reference notes/facts context.
  - If Gemini fails, rate limit is hit, or guard rejects, returns the best retrieved note body with `source: "notes"` (HTTP 200).
  - Off-topic queries below the retrieval threshold return a polite fixed message with `source: "fixed"` without invoking Gemini.


