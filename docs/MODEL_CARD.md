# Model Card — Data Dynamo Credit Scoring Model

## 1. Intended Use

- **Primary Use**: Educational demonstration and portfolio project exploring full-stack machine learning, fairness auditing, and local explainability.
- **Out of Scope**: Real-world commercial lending, automated credit decisions, credit limit setting, or legal loan approval determinations.
- **Target Audience**: Students, developers, and machine learning practitioners evaluating transparent credit scoring architectures.

---

## 2. Training Data

- **Dataset**: Kaggle Home Credit Default Risk competition dataset.
- **Sample Size**: A 9,000-row stratified random sample (`random_state=42`) with an overall default rate of approximately 7.6% (0.0763).
- **Split Strategy**: Stratified train / validation / test split partitioned 70% / 15% / 15%:
  - **Training Set**: 6,300 rows
  - **Validation Set**: 1,350 rows
  - **Test Set**: 1,350 rows

---

## 3. Model Architecture & Training

- **Model Type**: Extreme Gradient Boosting (`XGBoostClassifier`) embedded inside an `imbalanced-learn` pipeline.
- **Resampling Strategy**: Synthetic Minority Over-sampling Technique (SMOTE) applied to balance the default class within the training folds.
- **Hyperparameter Optimization**: Tuned via `RandomizedSearchCV` on the training set, optimizing for F1 score.
- **Final Hyperparameters**:
  - `n_estimators`: 400
  - `learning_rate`: 0.03
  - `max_depth`: 4
  - `min_child_weight`: 7
  - `subsample`: 0.9
  - `colsample_bytree`: 0.7
- **Inference Pipeline**: The imputer (`SimpleImputer(strategy='median')`) and categorical `OneHotEncoder` are stored as standalone artifacts. At inference time, the backend runs the imputer and encoder before invoking the trained pipeline across 226 feature columns.

---

## 4. How the Website Uses the Model

The web interface presents an applicant questionnaire comprising 27 fields covering basic personal information, income, loan request parameters, and credit history indicators.

The form's 27 fields fill only some of the model's 226 columns; the rest are left blank and filled with typical (median) values.

---

## 5. Performance Metrics

### Test Evaluation (Held-Out Benchmark)
Evaluated on the held-out test split of 1,350 rows (containing approximately 103 actual defaulters) at the chosen decision threshold of **0.1315**:

| Metric | Test Value | Real-World Interpretation |
|---|---|---|
| **ROC-AUC** | **0.6974** | Discriminative ability across all classification cut-offs. |
| **PR-AUC** | **0.1553** | Precision-recall tradeoff under severe class imbalance (~7.6% base default rate). |
| **Precision** | **0.1680** | About 17 of every 100 flagged applicants actually default. |
| **Recall** | **0.4175** | About 42 of every 100 actual defaulters are successfully flagged. |
| **F1 Score** | **0.2396** | Harmonic mean of precision and recall. |

*Note: With approximately 103 actual defaulters in the test set, small changes in threshold result in noticeable metric shifts.*

### Validation Evaluation (Optimistic Baseline)
The decision threshold (0.1315) and model hyperparameters were selected based on validation performance. Consequently, these metrics are optimistic compared to held-out test performance:

| Metric | Validation Value |
|---|---|
| **ROC-AUC** | 0.7632 |
| **PR-AUC** | 0.2426 |
| **Precision** | 0.2165 |
| **Recall** | 0.5340 |
| **F1 Score** | 0.3081 |

---

## 6. Risk Bands & Observed Default Rates

Rather than treating the raw output as an exact calibrated probability of default, the model output is divided into four operational risk bands anchored to the decision threshold ($t = 0.1315$):
- **LOW**: Below half the threshold ($< 0.5t$)
- **MEDIUM**: Between half the threshold and the threshold ($0.5t$ to $t$)
- **HIGH**: Between the threshold and double the threshold ($t$ to $2t$)
- **VERY HIGH**: Exceeding double the threshold ($> 2t$)

Validation default rates demonstrate clear monotonic risk ranking:

| Risk Band | Score Range | Validation Rows | Observed Default Rate |
|---|---|---|---|
| **LOW** | 0.00% – 6.58% | 739 | **2.84%** |
| **MEDIUM** | 6.58% – 13.15% | 357 | **7.56%** |
| **HIGH** | 13.15% – 26.31% | 186 | **18.28%** |
| **VERY HIGH** | 26.31% – 100.00% | 68 | **30.88%** |

---

## 7. Fairness & Demographic Inputs

- **Gender Input**: Gender is included as a direct model input (`CODE_GENDER_F`, `CODE_GENDER_M`) to allow educational inspection of demographic disparities.
- **Fairness Disparity**: The flagged-rate ratio between genders is **0.516** (male flagged rate: 27.69%, female flagged rate: 14.30% on validation data). This is below the traditional 0.8 four-fifths fairness threshold and is monitored openly on the Admin Fairness page.
- **Feature Importance**: Gender appears as the second most influential global feature in TreeExplainer attribution (`CODE_GENDER_F` mean absolute SHAP: 0.2687).
- **Potential Proxies**: Features such as `OCCUPATION_TYPE_nan` (rank 6, SHAP: 0.1644) and pensioner income types may function as latent demographic proxies for age and employment status.

---

## 8. Explainability Architecture

- **SHAP TreeExplainer**: Local explanations compute exact game-theoretic Shapley attributions in tree log-odds space, mapped to individual feature contributions.
- **Deterministic Rules**: User-facing explanation sentences and factor descriptions are generated using rule-based mappings.
- **Safe AI Summaries**: Google Gemini API is optionally used to rewrite safe facts into natural language. The LLM only receives the risk band, rounded score percentage, and factor names/directions. Applicant personal details, gender, age, and raw income are never sent to the LLM.

---

## 9. Limitations & Caveats

1. **Ranking Score, Not Probability**: Because SMOTE balances minority class representation during training, the model outputs an ordinal ranking score rather than a true calibrated Bayesian probability of default.
2. **SMOTE on One-Hot Columns**: Standard continuous SMOTE (rather than SMOTENC) was utilized during pipeline development, which can introduce synthetic fractional values across binary one-hot columns.
3. **Full Model vs. Website Form Gap**: These evaluation metrics were computed across all 226 columns. The web application captures 27 fields and fills the rest with median values; true performance on website inputs was never measured directly (the website form flags approximately 18% fewer applicants than the full feature model).
4. **Noisy Test Sample**: The test partition includes only about 103 defaulters, introducing variance into test metric estimates.
5. **Currency Display**: Amounts are displayed in Indian rupees without conversion; the source Home Credit dataset does not specify original currency denominations.
6. **Multilingual Limitations**: Hindi and Marathi narrative explanations retain English technical reason labels.
7. **In-Memory Rate Limits**: Gemini API throttling is maintained in server process memory and will reset upon restart or process scaling.

---

## 10. Security Notice

Trained model weights and preprocessors are saved as `.joblib` files in the `artifacts/` folder. Joblib files use standard Python `pickle` serialization. Pickled objects can execute arbitrary Python bytecode upon deserialization. Only load model artifacts from trusted sources, and never deserialize untrusted artifacts in production.

---

## 11. Reproduction

The complete data preprocessing, exploratory analysis, SMOTE training pipeline, and evaluation benchmarks are documented in:
- `notebooks/01_eda_recovered.ipynb` (run with dependencies listed in `requirements-notebook.txt`).

