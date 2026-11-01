"""
metrics.py — GET /model-metrics
Returns model performance data from model_metadata.json.
"""

from fastapi import APIRouter, Depends

from app.ml.loader import store
from app.ml.labels import get_display_name
from app.schemas import (
    ModelMetricsResponse, DatasetInfo, MetricsSet, BaselineModel,
    RiskBandInfo, FeatureImportance,
)
from app.security import get_current_user
from app.errors import model_not_loaded

router = APIRouter(tags=["metrics"])


@router.get("/model-metrics", response_model=ModelMetricsResponse)
def model_metrics(user=Depends(get_current_user)):
    """Build the full model-metrics response from model_metadata.json.
    Maps whatever keys really exist to the §7 shape."""
    if not store.loaded:
        raise model_not_loaded()

    meta = store.metadata

    # ─── Dataset info ───
    dataset_raw = meta.get("dataset", {})
    dataset = DatasetInfo(
        name=dataset_raw.get("name", "Home Credit Default Risk (9,000-row sample)"),
        n_train=dataset_raw.get("n_train", 6300),
        n_val=dataset_raw.get("n_val", 1350),
        n_test=dataset_raw.get("n_test", 1350),
        default_rate=dataset_raw.get("default_rate", 0.076),
    )

    # ─── Validation metrics ───
    # The metadata uses "metrics" with "val_" prefix keys
    raw_metrics = meta.get("metrics", {})
    validation_metrics = MetricsSet(
        pr_auc=raw_metrics.get("val_pr_auc"),
        roc_auc=raw_metrics.get("val_roc_auc"),
        precision=raw_metrics.get("val_precision_at_threshold"),
        recall=raw_metrics.get("val_recall_at_threshold"),
        f1=raw_metrics.get("val_f1_at_threshold"),
    )

    # ─── Test metrics ───
    raw_test = meta.get("test_metrics", {})
    test_metrics = MetricsSet(
        pr_auc=raw_test.get("pr_auc"),
        roc_auc=raw_test.get("roc_auc"),
        precision=raw_test.get("precision"),
        recall=raw_test.get("recall"),
        f1=raw_test.get("f1"),
    )

    # ─── Baselines (static, from §7 example since not in metadata) ───
    baselines = [
        BaselineModel(name="Logistic Regression", pr_auc=0.1233, roc_auc=0.6578),
        BaselineModel(name="XGBoost + scale_pos_weight", pr_auc=0.1535, roc_auc=0.6758),
        BaselineModel(name="XGBoost + SMOTE (untuned)", pr_auc=0.1865, roc_auc=0.7189),
    ]

    # ─── Risk bands ───
    risk_bands = [
        RiskBandInfo(**rb) for rb in meta.get("risk_bands", [])
    ]

    # ─── Global feature importance (top 10, add display_name) ───
    raw_importance = meta.get("global_feature_importance", [])
    importance = [
        FeatureImportance(
            feature=fi["feature"],
            display_name=get_display_name(fi["feature"]),
            mean_abs_shap=fi["mean_abs_shap"],
        )
        for fi in raw_importance[:10]
    ]

    # ─── Limitations (static from §7 example since not in metadata) ───
    limitations = meta.get("limitations", [
        "Trained on a 9,000-row sample; metrics are noisy.",
        "Probabilities are uncalibrated (SMOTE).",
        "Test scores (ROC-AUC 0.70, PR-AUC 0.16) are lower than validation scores, because validation was used for tuning.",
        "Precision is ~22% at the chosen threshold; flagged does not mean will default.",
        "Gender is used as a model input (project decision); see the fairness page.",
        "Educational project, not for real lending decisions.",
    ])

    return ModelMetricsResponse(
        model_name=meta.get("model_type", "XGBoost + SMOTE (tuned)"),
        model_version=meta.get("model_version", "xgb-smote-tuned-v1"),
        trained_at=meta.get("trained_at"),
        dataset=dataset,
        n_features=meta.get("n_features", 226),
        decision_threshold=meta.get("decision_threshold", 0.1315),
        validation_metrics=validation_metrics,
        test_metrics=test_metrics,
        baselines=baselines,
        risk_bands=risk_bands,
        global_feature_importance=importance,
        hyperparameters=meta.get("best_hyperparameters"),
        limitations=limitations,
    )
