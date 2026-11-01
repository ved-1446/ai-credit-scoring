"""
test_endpoints.py — Integration tests for all API endpoints.

Tests the full flow: register → login → consent → predict → history → whatif
plus error cases (no consent, bad enum, no token, admin, etc.)
"""

import pytest
from tests.conftest import SAMPLE_INPUTS


class TestAuth:
    """Auth endpoint tests."""

    def test_register_success(self, client):
        resp = client.post("/auth/register", json={
            "email": "test@example.com",
            "password": "password123",
            "full_name": "Test User",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["email"] == "test@example.com"
        assert data["role"] == "user"

    def test_register_duplicate_email(self, client, register_user):
        resp = client.post("/auth/register", json={
            "email": "user@test.com",
            "password": "password123",
            "full_name": "Another User",
        })
        assert resp.status_code == 409
        assert resp.json()["error"]["code"] == "EMAIL_TAKEN"

    def test_login_success(self, client, register_user):
        resp = client.post("/auth/login", json={
            "email": "user@test.com",
            "password": "testpass123",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in"] == 3600

    def test_login_wrong_password(self, client, register_user):
        resp = client.post("/auth/login", json={
            "email": "user@test.com",
            "password": "wrongpassword",
        })
        assert resp.status_code == 401
        assert resp.json()["error"]["code"] == "INVALID_CREDENTIALS"

    def test_me_without_token(self, client):
        resp = client.get("/auth/me")
        assert resp.status_code == 401
        assert resp.json()["error"]["code"] == "UNAUTHENTICATED"

    def test_me_with_token(self, client, auth_headers):
        resp = client.get("/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["email"] == "user@test.com"


class TestConsent:
    """Consent endpoint tests."""

    def test_consent_success(self, client, auth_headers):
        resp = client.post("/consent", json={
            "policy_version": "v1",
            "accepted": True,
        }, headers=auth_headers)
        assert resp.status_code == 201
        assert "consent_id" in resp.json()

    def test_consent_not_accepted(self, client, auth_headers):
        resp = client.post("/consent", json={
            "policy_version": "v1",
            "accepted": False,
        }, headers=auth_headers)
        assert resp.status_code == 422


class TestPredict:
    """Predict endpoint tests."""

    def test_predict_success(self, client, auth_headers, consent_id):
        """Full predict flow returns 200 with §4.2 fields."""
        from app.ml.loader import store
        if not store.loaded:
            pytest.skip("Model not loaded")

        resp = client.post("/predict", json={
            "consent_id": consent_id,
            "inputs": SAMPLE_INPUTS,
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()

        # Check all §4.2 fields exist
        assert "request_id" in data
        assert "created_at" in data
        assert "model_version" in data
        assert "probability_of_default" in data
        assert "decision_threshold" in data
        assert "flagged_high_risk" in data
        assert "risk_band" in data
        assert data["risk_band"] in ["LOW", "MEDIUM", "HIGH", "VERY_HIGH"]
        assert "explanation" in data
        assert "base_value" in data["explanation"]
        assert "output_log_odds" in data["explanation"]
        assert "top_factors" in data["explanation"]
        assert len(data["explanation"]["top_factors"]) <= 5
        assert "warnings" in data
        assert "inputs_used" in data

        # Check top_factors structure
        for factor in data["explanation"]["top_factors"]:
            assert "feature" in factor
            assert "source_field" in factor
            assert "display_name" in factor
            assert "shap_value" in factor
            assert factor["direction"] in ["increases_risk", "decreases_risk"]

    def test_predict_without_consent(self, client, auth_headers):
        """predict without consent_id → 403 CONSENT_REQUIRED."""
        from app.ml.loader import store
        if not store.loaded:
            pytest.skip("Model not loaded")

        resp = client.post("/predict", json={
            "consent_id": "nonexistent-consent-id",
            "inputs": SAMPLE_INPUTS,
        }, headers=auth_headers)
        assert resp.status_code == 403
        assert resp.json()["error"]["code"] == "CONSENT_REQUIRED"

    def test_predict_extra_field(self, client, auth_headers, consent_id):
        """Unknown extra field → 422 VALIDATION_ERROR."""
        inputs_with_extra = {**SAMPLE_INPUTS, "unknown_field": 123}
        resp = client.post("/predict", json={
            "consent_id": consent_id,
            "inputs": inputs_with_extra,
        }, headers=auth_headers)
        assert resp.status_code == 422
        assert resp.json()["error"]["code"] == "VALIDATION_ERROR"

    def test_predict_bad_enum(self, client, auth_headers, consent_id):
        """Bad enum value → 422."""
        bad_inputs = {**SAMPLE_INPUTS, "gender": "X"}
        resp = client.post("/predict", json={
            "consent_id": consent_id,
            "inputs": bad_inputs,
        }, headers=auth_headers)
        assert resp.status_code == 422
        assert resp.json()["error"]["code"] == "VALIDATION_ERROR"

    def test_predict_no_token(self, client):
        """No token → 401 UNAUTHENTICATED."""
        resp = client.post("/predict", json={
            "consent_id": "any",
            "inputs": SAMPLE_INPUTS,
        })
        assert resp.status_code == 401
        assert resp.json()["error"]["code"] == "UNAUTHENTICATED"


class TestWhatIf:
    """What-if endpoint tests."""

    def test_whatif_success(self, client, auth_headers, consent_id):
        """What-if returns delta_probability and saves nothing."""
        from app.ml.loader import store
        if not store.loaded:
            pytest.skip("Model not loaded")

        # First create a prediction
        resp = client.post("/predict", json={
            "consent_id": consent_id,
            "inputs": SAMPLE_INPUTS,
        }, headers=auth_headers)
        assert resp.status_code == 200
        request_id = resp.json()["request_id"]
        original_prob = resp.json()["probability_of_default"]

        # Count predictions before whatif
        hist_before = client.get("/history", headers=auth_headers).json()
        count_before = hist_before["total"]

        # Run what-if with a change
        resp = client.post("/whatif", json={
            "request_id": request_id,
            "changes": {"amt_credit": 200000},
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()

        assert data["is_simulation"] is True
        assert data["base_request_id"] == request_id
        assert "delta_probability" in data
        assert "baseline" in data
        assert data["baseline"]["probability_of_default"] == original_prob

        # Verify nothing was saved
        hist_after = client.get("/history", headers=auth_headers).json()
        assert hist_after["total"] == count_before


class TestHistory:
    """History endpoint tests."""

    def test_history_shows_own_predictions(self, client, auth_headers, consent_id):
        """History only shows my own predictions."""
        from app.ml.loader import store
        if not store.loaded:
            pytest.skip("Model not loaded")

        # Make a prediction
        resp = client.post("/predict", json={
            "consent_id": consent_id,
            "inputs": SAMPLE_INPUTS,
        }, headers=auth_headers)
        assert resp.status_code == 200
        my_id = resp.json()["request_id"]

        # Check history
        resp = client.get("/history", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        ids = [item["request_id"] for item in data["items"]]
        assert my_id in ids

    def test_history_other_user_404(self, client, auth_headers, consent_id):
        """Another user's request_id gives 404."""
        from app.ml.loader import store
        if not store.loaded:
            pytest.skip("Model not loaded")

        # Make a prediction as user 1
        resp = client.post("/predict", json={
            "consent_id": consent_id,
            "inputs": SAMPLE_INPUTS,
        }, headers=auth_headers)
        request_id = resp.json()["request_id"]

        # Register and login as user 2
        client.post("/auth/register", json={
            "email": "user2@test.com",
            "password": "testpass123",
            "full_name": "User Two",
        })
        resp2 = client.post("/auth/login", json={
            "email": "user2@test.com",
            "password": "testpass123",
        })
        headers2 = {"Authorization": f"Bearer {resp2.json()['access_token']}"}

        # Try to access user 1's prediction
        resp = client.get(f"/history/{request_id}", headers=headers2)
        assert resp.status_code == 404
        assert resp.json()["error"]["code"] == "NOT_FOUND"


class TestAdmin:
    """Admin endpoint tests."""

    def test_user_cannot_access_admin(self, client, auth_headers):
        """Normal user calling /admin/stats → 403 FORBIDDEN."""
        resp = client.get("/admin/stats", headers=auth_headers)
        assert resp.status_code == 403
        assert resp.json()["error"]["code"] == "FORBIDDEN"

    def test_admin_stats(self, client, admin_headers):
        """Admin can call /admin/stats."""
        resp = client.get("/admin/stats", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "totals" in data
        assert "predictions_by_band" in data
        assert "predictions_per_day" in data

    def test_admin_users(self, client, admin_headers):
        """Admin can call /admin/users."""
        resp = client.get("/admin/users", headers=admin_headers)
        assert resp.status_code == 200
        assert "items" in resp.json()

    def test_admin_predictions(self, client, admin_headers):
        """Admin can call /admin/predictions."""
        resp = client.get("/admin/predictions", headers=admin_headers)
        assert resp.status_code == 200
        assert "items" in resp.json()

    def test_admin_fairness(self, client, admin_headers):
        """Admin can call /admin/fairness."""
        from app.ml.loader import store
        if not store.loaded:
            pytest.skip("Model not loaded")

        resp = client.get("/admin/fairness", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "offline" in data
        assert "live" in data
        assert "note" in data


class TestHealth:
    """Health endpoint test."""

    def test_health(self, client):
        """Health endpoint is public."""
        resp = client.get("/health")
        # Could be 200 (ok) or 503 (degraded)
        assert resp.status_code in [200, 503]
        data = resp.json()
        assert "status" in data
        assert "model_loaded" in data
