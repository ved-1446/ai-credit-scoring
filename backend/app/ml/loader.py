"""
loader.py — Load all model artifacts ONCE at startup (singleton pattern).

Loads:
  - credit_risk_pipeline.joblib  (SMOTE + XGBClassifier pipeline)
  - encoder.joblib               (fitted OneHotEncoder)
  - imputer.joblib               (fitted SimpleImputer)
  - model_metadata.json          (features, threshold, metrics, etc.)
  - shap.TreeExplainer           (built from the XGB step)

If loading fails, the app still starts but /health returns 503 "degraded"
and /predict, /whatif return 503 MODEL_NOT_LOADED.
"""

import json
import logging
from pathlib import Path

logger = logging.getLogger("datadynamo")


class ModelStore:
    """Holds all loaded artifacts. Created once, shared everywhere."""

    def __init__(self):
        self.pipeline = None
        self.encoder = None
        self.imputer = None
        self.metadata = None
        self.explainer = None
        self.loaded = False

        # Computed at startup from decision_threshold
        self.decision_threshold = None
        self.risk_band_cutoffs = None  # (0.5*t, t, 2*t)

    @property
    def model_version(self) -> str | None:
        if self.metadata:
            return self.metadata.get("model_version")
        return None


# Single global instance
store = ModelStore()


def load_artifacts(artifacts_dir: str) -> None:
    """Load all artifacts from disk. Called once during app startup."""
    import joblib
    import shap

    artifacts_path = Path(artifacts_dir).resolve()
    logger.info("Loading artifacts from %s", artifacts_path)

    try:
        # Load the three joblib files
        store.pipeline = joblib.load(artifacts_path / "credit_risk_pipeline.joblib")
        store.encoder = joblib.load(artifacts_path / "encoder.joblib")
        store.imputer = joblib.load(artifacts_path / "imputer.joblib")

        # Load metadata JSON
        with open(artifacts_path / "model_metadata.json", "r") as f:
            store.metadata = json.load(f)

        # Build SHAP TreeExplainer from the XGB step of the pipeline
        xgb_model = store.pipeline.named_steps["xgb"]
        store.explainer = shap.TreeExplainer(xgb_model)

        # Compute risk-band cut-offs from decision_threshold
        t = store.metadata["decision_threshold"]
        store.decision_threshold = t
        store.risk_band_cutoffs = (0.5 * t, t, 2 * t)

        store.loaded = True
        logger.info(
            "Artifacts loaded successfully. Model version: %s, Threshold: %.4f",
            store.model_version, t,
        )

    except Exception as e:
        logger.error("Failed to load artifacts: %s", e, exc_info=True)
        store.loaded = False


def get_risk_band(probability: float) -> str:
    """Return the risk band for a given probability.
    Boundary values land in the HIGHER band (lower bound inclusive)."""
    if store.risk_band_cutoffs is None:
        return "UNKNOWN"
    low, mid, high = store.risk_band_cutoffs
    if probability < low:
        return "LOW"
    elif probability < mid:
        return "MEDIUM"
    elif probability < high:
        return "HIGH"
    else:
        return "VERY_HIGH"
