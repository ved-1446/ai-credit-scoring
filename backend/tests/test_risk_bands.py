"""
test_risk_bands.py — Verify risk band logic.
Boundary values at exactly 0.5t, t, 2t land in the higher band.
"""

import pytest
from app.ml.loader import store, get_risk_band

pytestmark = pytest.mark.skipif(
    not store.loaded,
    reason="Model artifacts not loaded — cannot test risk bands",
)


def test_low_band():
    """Probability below 0.5*t → LOW."""
    t = store.decision_threshold
    assert get_risk_band(0.0) == "LOW"
    assert get_risk_band(0.5 * t - 0.0001) == "LOW"


def test_boundary_low_medium():
    """Exactly 0.5*t → MEDIUM (lower bound inclusive for MEDIUM)."""
    t = store.decision_threshold
    assert get_risk_band(0.5 * t) == "MEDIUM"


def test_medium_band():
    """Between 0.5*t and t → MEDIUM."""
    t = store.decision_threshold
    assert get_risk_band(0.5 * t + 0.001) == "MEDIUM"
    assert get_risk_band(t - 0.0001) == "MEDIUM"


def test_boundary_medium_high():
    """Exactly t → HIGH (lower bound inclusive for HIGH)."""
    t = store.decision_threshold
    assert get_risk_band(t) == "HIGH"


def test_high_band():
    """Between t and 2*t → HIGH."""
    t = store.decision_threshold
    assert get_risk_band(t + 0.001) == "HIGH"
    assert get_risk_band(2 * t - 0.0001) == "HIGH"


def test_boundary_high_very_high():
    """Exactly 2*t → VERY_HIGH."""
    t = store.decision_threshold
    assert get_risk_band(2 * t) == "VERY_HIGH"


def test_very_high_band():
    """Above 2*t → VERY_HIGH."""
    t = store.decision_threshold
    assert get_risk_band(2 * t + 0.01) == "VERY_HIGH"
    assert get_risk_band(1.0) == "VERY_HIGH"
