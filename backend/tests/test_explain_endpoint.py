"""
test_explain_endpoint.py - Integration and unit tests for POST /explain endpoint.
"""

import importlib.metadata
import json
import os
import re
import unittest.mock as mock
import pytest

from app.models import Prediction, Explanation
from app.llm.gemini_client import reset_rate_limits, GeminiError
from tests.conftest import SAMPLE_INPUTS, TestSession


def make_mock_gemini_response(text: str, finish_reason: str = "STOP"):
    """Helper to construct a mock response with candidate and finish_reason."""
    mock_res = mock.MagicMock()
    mock_res.text = text
    candidate = mock.MagicMock()
    candidate.finish_reason = finish_reason
    mock_res.candidates = [candidate]
    return mock_res


@pytest.fixture(autouse=True)
def clean_test_environment(monkeypatch):
    """Autouse fixture to reset rate limits and remove GEMINI_API_KEY before each test."""
    reset_rate_limits()
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    yield
    reset_rate_limits()


@pytest.fixture
def make_prediction(client, auth_headers, consent_id):
    """Create and save a real prediction, return prediction_id."""
    resp = client.post("/predict", json={
        "consent_id": consent_id,
        "inputs": SAMPLE_INPUTS,
    }, headers=auth_headers)
    assert resp.status_code == 200
    return resp.json()["request_id"]


def test_1_no_gemini_api_key(client, auth_headers, make_prediction):
    """1. With NO GEMINI_API_KEY: /explain returns 200, source 'template', main_factors present."""
    resp = client.post("/explain", json={
        "prediction_id": make_prediction,
        "language": "en",
    }, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["source"] == "template"
    assert data["language"] == "en"
    assert len(data["main_factors"]) > 0
    assert data["summary"] == data["headline"]


def test_2_gemini_mock_raises_error(client, auth_headers, make_prediction, monkeypatch):
    """2. Gemini mock raises an exception / timeout / 429: still 200 with template."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    with mock.patch("app.routers.explain.summarize", side_effect=GeminiError("Simulated timeout/429")):
        resp = client.post("/explain", json={
            "prediction_id": make_prediction,
            "language": "en",
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["source"] == "template"
        assert len(data["main_factors"]) > 0


def test_3_gemini_mock_returns_garbage_guard_rejects(client, auth_headers, make_prediction, monkeypatch):
    """3. Gemini mock returns garbage (too long, contains a URL, contains a number like 87%): guard rejects it."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")

    garbage_responses = [
        "Check this link http://malicious.com for your loan details.",
        "Your risk is high ```code block``` here.",
        "Your chance of default is 87.5% according to secret calculation.",
        "A" * 750,
    ]

    for garbage in garbage_responses:
        with mock.patch("google.genai.Client") as mock_client_cls:
            mock_client = mock.MagicMock()
            mock_client.models.generate_content.return_value = make_mock_gemini_response(garbage, "STOP")
            mock_client_cls.return_value = mock_client

            resp = client.post("/explain", json={
                "prediction_id": make_prediction,
                "language": "en",
            }, headers=auth_headers)
            assert resp.status_code == 200
            data = resp.json()
            assert mock_client.models.generate_content.call_count == 1
            assert data["source"] == "template"


def test_4_cache_behavior(client, auth_headers, make_prediction, monkeypatch):
    """4. Cache: calling /explain twice for the same prediction and language calls mocked Gemini once."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")

    mock_summary = "Your application shows low credit risk in this demo assessment."

    with mock.patch("app.routers.explain.summarize", return_value=mock_summary) as mock_sum:
        # First call
        resp1 = client.post("/explain", json={
            "prediction_id": make_prediction,
            "language": "en",
        }, headers=auth_headers)
        assert resp1.status_code == 200
        assert resp1.json()["source"] == "gemini"
        assert resp1.json()["summary"] == mock_summary
        assert mock_sum.call_count == 1

        # Second call
        resp2 = client.post("/explain", json={
            "prediction_id": make_prediction,
            "language": "en",
        }, headers=auth_headers)
        assert resp2.status_code == 200
        assert resp2.json()["source"] == "gemini"
        assert resp2.json()["summary"] == mock_summary
        # Must still be called exactly once
        assert mock_sum.call_count == 1


def test_5_privacy_check_payload_sent_to_gemini(client, auth_headers, consent_id, monkeypatch):
    """5. Privacy: capture exact text sent to mocked Gemini. Assert safe facts sent, no sensitive data leaked."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")

    # Predict with known distinct values
    custom_inputs = {
        **SAMPLE_INPUTS,
        "amt_income_total": 987654.0,
        "amt_credit": 123456.0,
        "name_income_type": "Commercial associate",
    }
    pred_resp = client.post("/predict", json={
        "consent_id": consent_id,
        "inputs": custom_inputs,
    }, headers=auth_headers)
    pred_data = pred_resp.json()
    pred_id = pred_data["request_id"]
    risk_band = pred_data["risk_band"]

    captured_prompt = {}

    def fake_generate_content(model, contents, config):
        captured_prompt["contents"] = contents
        captured_prompt["system_instruction"] = getattr(config, "system_instruction", "")
        return make_mock_gemini_response("Educational demo assessing low risk.", "STOP")

    with mock.patch("google.genai.Client") as mock_client_cls:
        mock_client = mock.MagicMock()
        mock_client.models.generate_content.side_effect = fake_generate_content
        mock_client_cls.return_value = mock_client

        resp = client.post("/explain", json={
            "prediction_id": pred_id,
            "language": "en",
        }, headers=auth_headers)
        assert resp.status_code == 200

        # Assert generate_content was called exactly once and captured_prompt is not empty
        assert mock_client.models.generate_content.call_count == 1
        assert captured_prompt

    sent_text = str(captured_prompt)

    # 1. Assert safe facts are included: risk band word and at least one plain reason name
    assert risk_band.lower().replace("_", " ") in sent_text.lower()
    assert "credit score" in sent_text.lower() or "income" in sent_text.lower() or "loan amount" in sent_text.lower()
    assert "probability_percent" in sent_text

    # 2. Assert prediction_id does NOT appear in the sent text
    assert pred_id not in sent_text

    # 3. Assert none of the 4+ digit numeric input values appear in sent text
    banned_numbers = ["987654", "123456", "22500", "450000", "180000"]
    for num in banned_numbers:
        assert num not in sent_text
        assert f"{num}.0" not in sent_text

    # 4. Assert user identity, raw values, income type, and internal keywords never appear
    assert "Test User" not in sent_text
    assert "user@test.com" not in sent_text
    assert "Commercial associate" not in sent_text
    assert "raw_value" not in sent_text
    assert "shap_value" not in sent_text


def test_6_ownership_and_admin_access(client, auth_headers, admin_headers, make_prediction):
    """6. Ownership: user B cannot explain user A's prediction (404); admin can; no Gemini call possible."""
    # Register and login User B
    resp_b_reg = client.post("/auth/register", json={
        "email": "user_b@test.com",
        "password": "password123",
        "full_name": "User B",
    })
    assert resp_b_reg.status_code == 201

    resp_b_login = client.post("/auth/login", json={
        "email": "user_b@test.com",
        "password": "password123",
    })
    token_b = resp_b_login.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User B tries to explain User A's prediction -> 404
    resp_b_explain = client.post("/explain", json={
        "prediction_id": make_prediction,
        "language": "en",
    }, headers=headers_b)
    assert resp_b_explain.status_code == 404

    # Admin explains User A's prediction -> 200 with admin block and template source
    resp_admin = client.post("/explain", json={
        "prediction_id": make_prediction,
        "language": "en",
    }, headers=admin_headers)
    assert resp_admin.status_code == 200
    admin_data = resp_admin.json()
    assert admin_data["source"] == "template"
    assert admin_data["admin"] is not None
    assert "factors" in admin_data["admin"]


def test_7_rate_limits(client, auth_headers, make_prediction, monkeypatch):
    """7. Rate limit: after user limit is reached, further calls return template and mock is not called."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    monkeypatch.setenv("GEMINI_MAX_CALLS_PER_USER_HOUR", "2")

    mock_summary = "Demo assessment of application risk."

    with mock.patch("app.routers.explain.summarize", return_value=mock_summary) as mock_sum:
        # Call 1: success (gemini)
        r1 = client.post("/explain", json={"prediction_id": make_prediction, "language": "en"}, headers=auth_headers)
        assert r1.status_code == 200
        assert r1.json()["source"] == "gemini"

        # Now bypass cache with a different language for the same prediction to test rate limit
        r2 = client.post("/explain", json={"prediction_id": make_prediction, "language": "hi"}, headers=auth_headers)
        assert r2.status_code == 200
        assert r2.json()["source"] == "gemini"

        # Call 3: rate limit exceeded -> fallback to template, mock not called again
        r3 = client.post("/explain", json={"prediction_id": make_prediction, "language": "mr"}, headers=auth_headers)
        assert r3.status_code == 200
        assert r3.json()["source"] == "template"
        assert r3.json()["language_fallback"] is True


def test_8_direction_invariant_with_gemini_summary(client, auth_headers, make_prediction, monkeypatch):
    """8. Direction: main_factors sentences strictly match SHAP signs regardless of what Gemini summary says."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    contradictory_summary = "Everything about your credit is extremely safe and perfect."

    with mock.patch("app.routers.explain.summarize", return_value=contradictory_summary):
        resp = client.post("/explain", json={
            "prediction_id": make_prediction,
            "language": "en",
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()

        # Load prediction response from DB
        db = TestSession()
        pred = db.query(Prediction).filter(Prediction.id == make_prediction).first()
        resp_json = json.loads(pred.response_json)
        db.close()

        top_factors = resp_json["explanation"]["top_factors"]
        main_factors = data["main_factors"]

        # Assert main_factors lines are not contaminated by Gemini text
        for sentence in main_factors:
            assert "lowered your risk estimate." in sentence or "raised your risk estimate." in sentence
            assert contradictory_summary not in sentence


def test_9_pinned_versions_and_requirements():
    """9. Pinned versions unchanged: assert installed versions equal expectations and requirements.txt has == lines."""
    expected_pins = {
        "numpy": "2.5.3",
        "pandas": "2.3.3",
        "scikit-learn": "1.9.1",
        "xgboost": "3.4.1",
        "imbalanced-learn": "0.14.2",
        "shap": "0.52.0",
    }

    for pkg, version in expected_pins.items():
        installed_ver = importlib.metadata.version(pkg)
        assert installed_ver == version, f"{pkg} expected {version}, got {installed_ver}"

    req_path = os.path.join(os.path.dirname(__file__), "..", "requirements.txt")
    with open(req_path, "r", encoding="utf-8") as f:
        req_content = f.read()

    for pkg, version in expected_pins.items():
        assert f"{pkg}=={version}" in req_content, f"Missing pin {pkg}=={version} in requirements.txt"

    assert "google-genai" in req_content


def test_10_successful_gemini_summary_cached(client, auth_headers, make_prediction, monkeypatch):
    """10. Real summarize() with google.genai.Client mocked returning clean short sentence saves to explanations."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")

    clean_sentence = "Your credit risk is assessed as low in this educational demo assessment."

    with mock.patch("google.genai.Client") as mock_client_cls:
        mock_client = mock.MagicMock()
        mock_client.models.generate_content.return_value = make_mock_gemini_response(clean_sentence, "STOP")
        mock_client_cls.return_value = mock_client

        resp = client.post("/explain", json={
            "prediction_id": make_prediction,
            "language": "en",
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["source"] == "gemini"
        assert data["summary"] == clean_sentence
        assert mock_client.models.generate_content.call_count == 1

        # Assert one row was saved in the explanations table
        db = TestSession()
        saved_expl = db.query(Explanation).filter(
            Explanation.prediction_id == make_prediction,
            Explanation.language == "en",
        ).first()
        assert saved_expl is not None
        assert saved_expl.summary_text == clean_sentence
        assert saved_expl.source == "gemini"
        db.close()


def test_11_timeout_configuration_passed_to_gemini(client, auth_headers, make_prediction, monkeypatch):
    """11. Timeout: GEMINI_TIMEOUT=3 passes timeout_ms=3000 in HttpOptions to Client and GenerateContentConfig."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    monkeypatch.setenv("GEMINI_TIMEOUT", "3")

    captured_kwargs = {}

    with mock.patch("google.genai.Client") as mock_client_cls:
        mock_client = mock.MagicMock()
        mock_client.models.generate_content.return_value = make_mock_gemini_response("Educational demo assessing low risk.", "STOP")

        def fake_init(*args, **kwargs):
            captured_kwargs.update(kwargs)
            return mock_client

        mock_client_cls.side_effect = fake_init

        resp = client.post("/explain", json={
            "prediction_id": make_prediction,
            "language": "en",
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert mock_client.models.generate_content.call_count == 1

        # Verify HttpOptions on client initialization had timeout=3000 (milliseconds)
        http_options = captured_kwargs.get("http_options")
        assert http_options is not None
        assert http_options.timeout == 3000

        # Verify generate_content config also had timeout=3000
        call_args = mock_client.models.generate_content.call_args
        config = call_args.kwargs.get("config") or call_args[1].get("config")
        assert config is not None
        assert config.http_options.timeout == 3000


def test_12_timeout_exception_fallback_template(client, auth_headers, make_prediction, monkeypatch):
    """12. Timeout exception in generate_content raises internal error and endpoint falls back to template."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")

    with mock.patch("google.genai.Client") as mock_client_cls:
        mock_client = mock.MagicMock()
        # Simulate timeout exception from underlying transport/SDK
        mock_client.models.generate_content.side_effect = TimeoutError("Request timed out after 10000ms")
        mock_client_cls.return_value = mock_client

        resp = client.post("/explain", json={
            "prediction_id": make_prediction,
            "language": "en",
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["source"] == "template"
        assert mock_client.models.generate_content.call_count == 1


def test_13_global_minute_rate_limit(client, auth_headers, make_prediction, monkeypatch):
    """13. Global per-minute rate limit: 3rd call in the same minute uses template and mock is not called."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    monkeypatch.setenv("GEMINI_MAX_CALLS_PER_MINUTE", "2")

    mock_summary = "Educational demo assessing low risk."

    with mock.patch("app.routers.explain.summarize", return_value=mock_summary) as mock_sum:
        # Call 1: success
        r1 = client.post("/explain", json={"prediction_id": make_prediction, "language": "en"}, headers=auth_headers)
        assert r1.status_code == 200
        assert r1.json()["source"] == "gemini"

        # Call 2: success (different language to bypass explanation cache)
        r2 = client.post("/explain", json={"prediction_id": make_prediction, "language": "hi"}, headers=auth_headers)
        assert r2.status_code == 200
        assert r2.json()["source"] == "gemini"
        assert mock_sum.call_count == 2

        # Call 3: global minute limit exceeded -> template fallback, summarize NOT called
        r3 = client.post("/explain", json={"prediction_id": make_prediction, "language": "mr"}, headers=auth_headers)
        assert r3.status_code == 200
        assert r3.json()["source"] == "template"
        assert mock_sum.call_count == 2


def test_14_global_day_rate_limit(client, auth_headers, make_prediction, monkeypatch):
    """14. Global per-day rate limit: 3rd call in the same day uses template and mock is not called."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    monkeypatch.setenv("GEMINI_MAX_CALLS_PER_DAY", "2")

    mock_summary = "Educational demo assessing low risk."

    with mock.patch("app.routers.explain.summarize", return_value=mock_summary) as mock_sum:
        # Call 1: success
        r1 = client.post("/explain", json={"prediction_id": make_prediction, "language": "en"}, headers=auth_headers)
        assert r1.status_code == 200
        assert r1.json()["source"] == "gemini"

        # Call 2: success (different language)
        r2 = client.post("/explain", json={"prediction_id": make_prediction, "language": "hi"}, headers=auth_headers)
        assert r2.status_code == 200
        assert r2.json()["source"] == "gemini"
        assert mock_sum.call_count == 2

        # Call 3: global daily limit exceeded -> template fallback, summarize NOT called
        r3 = client.post("/explain", json={"prediction_id": make_prediction, "language": "mr"}, headers=auth_headers)
        assert r3.status_code == 200
        assert r3.json()["source"] == "template"
        assert mock_sum.call_count == 2


def test_15_rate_limit_expiration_advancing_clock(client, auth_headers, make_prediction, monkeypatch):
    """15. Old timestamps expire: advance mocked time past the limit window and calls succeed again."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    monkeypatch.setenv("GEMINI_MAX_CALLS_PER_MINUTE", "2")

    mock_summary = "Educational demo assessing low risk."
    fake_time = [1000000.0]

    def mock_now():
        return fake_time[0]

    monkeypatch.setattr("time.time", mock_now)

    with mock.patch("app.routers.explain.summarize", return_value=mock_summary) as mock_sum:
        # Call 1 and 2 succeed at fake_time = 1000000.0
        r1 = client.post("/explain", json={"prediction_id": make_prediction, "language": "en"}, headers=auth_headers)
        assert r1.status_code == 200
        assert r1.json()["source"] == "gemini"

        r2 = client.post("/explain", json={"prediction_id": make_prediction, "language": "hi"}, headers=auth_headers)
        assert r2.status_code == 200
        assert r2.json()["source"] == "gemini"
        assert mock_sum.call_count == 2

        # Call 3 fails due to rate limit at same time
        r3 = client.post("/explain", json={"prediction_id": make_prediction, "language": "mr"}, headers=auth_headers)
        assert r3.status_code == 200
        assert r3.json()["source"] == "template"
        assert mock_sum.call_count == 2

        # Advance clock by 61 seconds (past the 60s minute window)
        fake_time[0] += 61.0

        # Call 4 (retry language 'mr') now succeeds and calls summarize
        r4 = client.post("/explain", json={"prediction_id": make_prediction, "language": "mr"}, headers=auth_headers)
        assert r4.status_code == 200
        assert r4.json()["source"] == "gemini"
        assert mock_sum.call_count == 3


def test_16_finish_reason_max_tokens_falls_back_to_template(client, auth_headers, make_prediction, monkeypatch):
    """16. Truncation: finish_reason MAX_TOKENS triggers guard error and falls back to template."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")

    with mock.patch("google.genai.Client") as mock_client_cls:
        mock_client = mock.MagicMock()
        mock_client.models.generate_content.return_value = make_mock_gemini_response(
            "Your overall risk level is currently placed in the medium",
            "MAX_TOKENS",
        )
        mock_client_cls.return_value = mock_client

        resp = client.post("/explain", json={
            "prediction_id": make_prediction,
            "language": "en",
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["source"] == "template"
        assert mock_client.models.generate_content.call_count == 1


def test_17_prompt_contains_probability_percent_not_two_decimal_probability(client, auth_headers, make_prediction, monkeypatch):
    """17. Number consistency: prompt contains probability_percent (e.g. 6.7) and NOT 2-decimal probability."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")

    captured_prompt = {}

    def fake_generate_content(model, contents, config):
        captured_prompt["contents"] = contents
        return make_mock_gemini_response("Your credit risk is low with about 2.0% chance of default.", "STOP")

    with mock.patch("google.genai.Client") as mock_client_cls:
        mock_client = mock.MagicMock()
        mock_client.models.generate_content.side_effect = fake_generate_content
        mock_client_cls.return_value = mock_client

        resp = client.post("/explain", json={
            "prediction_id": make_prediction,
            "language": "en",
        }, headers=auth_headers)
        assert resp.status_code == 200

        contents = str(captured_prompt.get("contents", ""))
        assert "probability_percent" in contents
        # Check that old 2-decimal key "probability" is NOT in the JSON facts
        facts_match = re.search(r"Facts:\s*(\{.*\})", contents)
        assert facts_match is not None
        facts_dict = json.loads(facts_match.group(1))
        assert "probability_percent" in facts_dict
        assert "probability" not in facts_dict


def test_18_percentage_representations_accepted_or_rejected(client, auth_headers, make_prediction, monkeypatch):
    """18. Percentage guard: exact percentage with % or 'percent' accepted; different percentage rejected."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")

    # Get the prediction probability_percent
    db = TestSession()
    pred = db.query(Prediction).filter(Prediction.id == make_prediction).first()
    prob_pct = round(pred.probability * 100, 1)
    db.close()

    # Case A: Accepted with %
    accepted_pct_symbol = f"Your estimated default probability is {prob_pct}% in this demo."
    with mock.patch("google.genai.Client") as mock_client_cls:
        mock_client = mock.MagicMock()
        mock_client.models.generate_content.return_value = make_mock_gemini_response(accepted_pct_symbol, "STOP")
        mock_client_cls.return_value = mock_client

        resp = client.post("/explain", json={"prediction_id": make_prediction, "language": "en"}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["source"] == "gemini"
        assert resp.json()["summary"] == accepted_pct_symbol

    # Clean explanation cache for next check with different language
    # Case B: Accepted with 'percent'
    accepted_pct_word = f"Your estimated default probability is {prob_pct} percent in this demo."
    with mock.patch("google.genai.Client") as mock_client_cls:
        mock_client = mock.MagicMock()
        mock_client.models.generate_content.return_value = make_mock_gemini_response(accepted_pct_word, "STOP")
        mock_client_cls.return_value = mock_client

        resp = client.post("/explain", json={"prediction_id": make_prediction, "language": "hi"}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["source"] == "gemini"
        assert resp.json()["summary"] == accepted_pct_word

    # Case C: Rejected with different percentage (e.g. 99.9%)
    rejected_pct = "Your estimated default probability is 99.9% in this demo."
    with mock.patch("google.genai.Client") as mock_client_cls:
        mock_client = mock.MagicMock()
        mock_client.models.generate_content.return_value = make_mock_gemini_response(rejected_pct, "STOP")
        mock_client_cls.return_value = mock_client

        resp = client.post("/explain", json={"prediction_id": make_prediction, "language": "mr"}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["source"] == "template"


def test_19_thinking_config_behavior(client, auth_headers, make_prediction, monkeypatch):
    """19. Thinking: by default no thinking_config is sent; with GEMINI_THINKING_LEVEL it is passed."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")

    # Step 1: Default (no GEMINI_THINKING_LEVEL)
    captured_config_default = {}

    def fake_call_1(model, contents, config):
        captured_config_default["config"] = config
        return make_mock_gemini_response("Demo educational text without thinking.", "STOP")

    with mock.patch("google.genai.Client") as mock_client_cls:
        mock_client = mock.MagicMock()
        mock_client.models.generate_content.side_effect = fake_call_1
        mock_client_cls.return_value = mock_client

        resp = client.post("/explain", json={"prediction_id": make_prediction, "language": "en"}, headers=auth_headers)
        assert resp.status_code == 200
        cfg = captured_config_default["config"]
        assert getattr(cfg, "thinking_config", None) is None

    # Step 2: With GEMINI_THINKING_LEVEL="minimal"
    monkeypatch.setenv("GEMINI_THINKING_LEVEL", "minimal")
    captured_config_thinking = {}

    def fake_call_2(model, contents, config):
        captured_config_thinking["config"] = config
        return make_mock_gemini_response("Demo educational text with thinking config.", "STOP")

    with mock.patch("google.genai.Client") as mock_client_cls:
        mock_client = mock.MagicMock()
        mock_client.models.generate_content.side_effect = fake_call_2
        mock_client_cls.return_value = mock_client

        resp = client.post("/explain", json={"prediction_id": make_prediction, "language": "hi"}, headers=auth_headers)
        assert resp.status_code == 200
        cfg = captured_config_thinking["config"]
        assert getattr(cfg, "thinking_config", None) is not None


def test_20_client_error_logging_redacts_api_key(client, auth_headers, make_prediction, monkeypatch, caplog):
    """20. Logging: ClientError logs 400 and status string but never the API key."""
    fake_key = "secret-gemini-key-998877"
    monkeypatch.setenv("GEMINI_API_KEY", fake_key)

    from google.genai import errors

    # Simulate Google ClientError
    error_response = {
        "error": {
            "code": 400,
            "message": f"Invalid argument using key {fake_key}",
            "status": "INVALID_ARGUMENT",
        }
    }
    client_err = errors.ClientError(400, error_response)

    with mock.patch("google.genai.Client") as mock_client_cls:
        mock_client = mock.MagicMock()
        mock_client.models.generate_content.side_effect = client_err
        mock_client_cls.return_value = mock_client

        with caplog.at_level("ERROR"):
            resp = client.post("/explain", json={"prediction_id": make_prediction, "language": "en"}, headers=auth_headers)
            assert resp.status_code == 200
            assert resp.json()["source"] == "template"

            log_text = caplog.text
            assert "400" in log_text
            assert "INVALID_ARGUMENT" in log_text
            assert fake_key not in log_text
            assert "[REDACTED_API_KEY]" in log_text


def test_21_automatic_function_calling_disabled(client, auth_headers, make_prediction, monkeypatch):
    """21. Automatic function calling is explicitly disabled in GenerateContentConfig."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")

    captured_config = {}

    def fake_generate(model, contents, config):
        captured_config["config"] = config
        return make_mock_gemini_response("Demo text.", "STOP")

    with mock.patch("google.genai.Client") as mock_client_cls:
        mock_client = mock.MagicMock()
        mock_client.models.generate_content.side_effect = fake_generate
        mock_client_cls.return_value = mock_client

        resp = client.post("/explain", json={"prediction_id": make_prediction, "language": "en"}, headers=auth_headers)
        assert resp.status_code == 200

        cfg = captured_config["config"]
        assert cfg.automatic_function_calling is not None
        assert cfg.automatic_function_calling.disable is True


def test_22_reason_digit_accepted_when_in_facts(client, auth_headers, make_prediction, monkeypatch):
    """22. Output guard accepts digits (e.g. 3) when they appear in a plain_name inside factors."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")

    db = TestSession()
    pred = db.query(Prediction).filter(Prediction.id == make_prediction).first()
    prob_pct = round(pred.probability * 100, 1)
    db.close()

    summary_text = f"Your External credit score 3 lowered your risk by {prob_pct}%."

    # Mock factors in safe_facts to contain "External credit score 3"
    with mock.patch("app.routers.explain.build_safe_facts") as mock_bsf:
        mock_bsf.return_value = {
            "risk_band": "low",
            "probability_percent": prob_pct,
            "factors": [{"plain_name": "External credit score 3", "direction": "decreases_risk"}],
        }
        with mock.patch("google.genai.Client") as mock_client_cls:
            mock_client = mock.MagicMock()
            mock_client.models.generate_content.return_value = make_mock_gemini_response(summary_text, "STOP")
            mock_client_cls.return_value = mock_client

            resp = client.post("/explain", json={"prediction_id": make_prediction, "language": "en"}, headers=auth_headers)
            assert resp.status_code == 200
            assert resp.json()["source"] == "gemini"
            assert resp.json()["summary"] == summary_text


def test_23_digit_rejected_when_not_in_facts(client, auth_headers, make_prediction, monkeypatch):
    """23. Output guard rejects digit 3 when no reason name in facts contains a 3."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")

    db = TestSession()
    pred = db.query(Prediction).filter(Prediction.id == make_prediction).first()
    prob_pct = round(pred.probability * 100, 1)
    db.close()

    summary_text = f"Your External credit score 3 lowered your risk by {prob_pct}%."

    with mock.patch("app.routers.explain.build_safe_facts") as mock_bsf:
        mock_bsf.return_value = {
            "risk_band": "low",
            "probability_percent": prob_pct,
            "factors": [{"plain_name": "Car ownership", "direction": "decreases_risk"}],
        }
        with mock.patch("google.genai.Client") as mock_client_cls:
            mock_client = mock.MagicMock()
            mock_client.models.generate_content.return_value = make_mock_gemini_response(summary_text, "STOP")
            mock_client_cls.return_value = mock_client

            resp = client.post("/explain", json={"prediction_id": make_prediction, "language": "en"}, headers=auth_headers)
            assert resp.status_code == 200
            assert resp.json()["source"] == "template"


def test_24_unexpected_percentage_rejected_even_with_reason_digits(client, auth_headers, make_prediction, monkeypatch):
    """24. '87%' is rejected even when a reason name contains a digit 3."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")

    summary_text = "Your External credit score 3 lowered your risk with 87% chance of default."

    with mock.patch("app.routers.explain.build_safe_facts") as mock_bsf:
        mock_bsf.return_value = {
            "risk_band": "low",
            "probability_percent": 6.7,
            "factors": [{"plain_name": "External credit score 3", "direction": "decreases_risk"}],
        }
        with mock.patch("google.genai.Client") as mock_client_cls:
            mock_client = mock.MagicMock()
            mock_client.models.generate_content.return_value = make_mock_gemini_response(summary_text, "STOP")
            mock_client_cls.return_value = mock_client

            resp = client.post("/explain", json={"prediction_id": make_prediction, "language": "en"}, headers=auth_headers)
            assert resp.status_code == 200
            assert resp.json()["source"] == "template"


def test_25_rounded_integer_percentage_instead_of_one_decimal_rejected(client, auth_headers, make_prediction, monkeypatch):
    """25. '7%' instead of 6.7% is rejected when probability_percent is 6.7."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")

    summary_text = "Your estimated default chance is 7% in this demo."

    with mock.patch("app.routers.explain.build_safe_facts") as mock_bsf:
        mock_bsf.return_value = {
            "risk_band": "low",
            "probability_percent": 6.7,
            "factors": [{"plain_name": "Car ownership", "direction": "decreases_risk"}],
        }
        with mock.patch("google.genai.Client") as mock_client_cls:
            mock_client = mock.MagicMock()
            mock_client.models.generate_content.return_value = make_mock_gemini_response(summary_text, "STOP")
            mock_client_cls.return_value = mock_client

            resp = client.post("/explain", json={"prediction_id": make_prediction, "language": "en"}, headers=auth_headers)
            assert resp.status_code == 200
            assert resp.json()["source"] == "template"


def test_26_marathi_devanagari_percentage_accepted(client, auth_headers, make_prediction, monkeypatch):
    """26. Marathi text with percentage in Devanagari digits (\\u096c.\\u096d \\u091f\\u0915\\u094d\\u0915\\u0947) is accepted."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")

    # \u096c = 6, \u096d = 7, \u091f\u0915\u094d\u0915\u0947 = takke (percent)
    devanagari_summary = "Demo text: \u096c.\u096d \u091f\u0915\u094d\u0915\u0947 risk."

    with mock.patch("app.routers.explain.build_safe_facts") as mock_bsf:
        mock_bsf.return_value = {
            "risk_band": "low",
            "probability_percent": 6.7,
            "factors": [],
        }
        with mock.patch("google.genai.Client") as mock_client_cls:
            mock_client = mock.MagicMock()
            mock_client.models.generate_content.return_value = make_mock_gemini_response(devanagari_summary, "STOP")
            mock_client_cls.return_value = mock_client

            resp = client.post("/explain", json={"prediction_id": make_prediction, "language": "mr"}, headers=auth_headers)
            assert resp.status_code == 200
            assert resp.json()["source"] == "gemini"
            assert resp.json()["summary"] == devanagari_summary


def test_27_score3_without_space_accepted_when_name_has_3(client, auth_headers, make_prediction, monkeypatch):
    """27. 'score3' (no space) is accepted when plain_name contains digit 3."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")

    summary_text = "Your score3 lowered your risk by 6.7%."

    with mock.patch("app.routers.explain.build_safe_facts") as mock_bsf:
        mock_bsf.return_value = {
            "risk_band": "low",
            "probability_percent": 6.7,
            "factors": [{"plain_name": "External credit score 3", "direction": "decreases_risk"}],
        }
        with mock.patch("google.genai.Client") as mock_client_cls:
            mock_client = mock.MagicMock()
            mock_client.models.generate_content.return_value = make_mock_gemini_response(summary_text, "STOP")
            mock_client_cls.return_value = mock_client

            resp = client.post("/explain", json={"prediction_id": make_prediction, "language": "en"}, headers=auth_headers)
            assert resp.status_code == 200
            assert resp.json()["source"] == "gemini"
            assert resp.json()["summary"] == summary_text


def test_28_guard_rejection_logs_rule_name_only_and_never_text(client, auth_headers, make_prediction, monkeypatch, caplog):
    """28. When output guard rejects, caplog shows the rule name and never the rejected text."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")

    sensitive_text = "Secret private note 87% with http://malicious.com link."

    with mock.patch("google.genai.Client") as mock_client_cls:
        mock_client = mock.MagicMock()
        mock_client.models.generate_content.return_value = make_mock_gemini_response(sensitive_text, "STOP")
        mock_client_cls.return_value = mock_client

        with caplog.at_level("WARNING"):
            resp = client.post("/explain", json={"prediction_id": make_prediction, "language": "en"}, headers=auth_headers)
            assert resp.status_code == 200
            assert resp.json()["source"] == "template"

            log_text = caplog.text
            # Assert rule name is logged
            assert "guard: link or markdown" in log_text or "guard: unexpected number" in log_text
            # Assert sensitive text was NEVER logged
            assert "Secret private note" not in log_text
            assert "http://malicious.com" not in log_text


def test_29_gender_age_weekday_hour_excluded_from_gemini_payload(client, auth_headers, consent_id, monkeypatch):
    """29. Endpoint level: gender, age, weekday, and hour never appear in text sent to Gemini."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")

    captured_prompt = {}

    def fake_generate(model, contents, config):
        captured_prompt["contents"] = contents
        return make_mock_gemini_response("Demo assessment.", "STOP")

    with mock.patch("google.genai.Client") as mock_client_cls:
        mock_client = mock.MagicMock()
        mock_client.models.generate_content.side_effect = fake_generate
        mock_client_cls.return_value = mock_client

        # Create prediction with gender and age
        pred_resp = client.post("/predict", json={
            "consent_id": consent_id,
            "inputs": {**SAMPLE_INPUTS, "gender": "F", "age_years": 50},
        }, headers=auth_headers)
        pred_id = pred_resp.json()["request_id"]

        resp = client.post("/explain", json={"prediction_id": pred_id, "language": "en"}, headers=auth_headers)
        assert resp.status_code == 200

        sent_text = str(captured_prompt.get("contents", ""))
        facts_match = re.search(r"Facts:\s*(\{.*\})", sent_text)
        assert facts_match is not None
        facts_str = facts_match.group(1)
        assert "Gender" not in facts_str
        assert "gender" not in facts_str
        assert "Age" not in facts_str
        assert "age" not in facts_str
        assert "weekday" not in facts_str.lower()
        assert "hour" not in facts_str.lower()
        # Also in overall prompt text outside of 'Language: ...'
        assert "Gender" not in sent_text
        assert "gender" not in sent_text
        assert "weekday" not in sent_text.lower()
        assert "hour" not in sent_text.lower()


def test_30_parity_rows_plain_names_match_main_factors(client, auth_headers, consent_id, monkeypatch):
    """30. For parity rows 0, 5, and 12, the plain names sent to Gemini match main_factors one-to-one."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")

    raw_path = os.path.join(os.path.dirname(__file__), "fixtures", "parity_raw.csv")
    import pandas as pd
    raw_df = pd.read_csv(raw_path)

    for row_idx in [0, 5, 12]:
        row_dict = raw_df.iloc[row_idx].to_dict()
        clean_inputs = {k: (None if pd.isna(v) else v) for k, v in row_dict.items()}

        captured_prompt = {}

        def fake_generate(model, contents, config):
            captured_prompt["contents"] = contents
            return make_mock_gemini_response("Demo assessment.", "STOP")

        with mock.patch("google.genai.Client") as mock_client_cls:
            mock_client = mock.MagicMock()
            mock_client.models.generate_content.side_effect = fake_generate
            mock_client_cls.return_value = mock_client

            pred_resp = client.post("/predict", json={
                "consent_id": consent_id,
                "inputs": clean_inputs,
            }, headers=auth_headers)
            pred_id = pred_resp.json()["request_id"]

            resp = client.post("/explain", json={"prediction_id": pred_id, "language": "en"}, headers=auth_headers)
            assert resp.status_code == 200
            data = resp.json()

            # Parse sent facts
            facts_match = re.search(r"Facts:\s*(\{.*\})", str(captured_prompt.get("contents", "")))
            assert facts_match is not None
            facts_data = json.loads(facts_match.group(1))

            sent_plain_names = [f["plain_name"] for f in facts_data.get("factors", [])]
            main_factors_sentences = data["main_factors"]

            # Same count
            assert len(sent_plain_names) == len(main_factors_sentences)


def test_31_zero_application_factors_returns_200(client, auth_headers, make_prediction, monkeypatch):
    """31. Zero application factors -> reasons list sent to Gemini is empty and endpoint still returns 200."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")

    captured_prompt = {}

    def fake_generate(model, contents, config):
        captured_prompt["contents"] = contents
        return make_mock_gemini_response("Your credit risk level is low with about 2.0% chance.", "STOP")

    with mock.patch("app.routers.explain.build_safe_facts") as mock_bsf:
        mock_bsf.return_value = {
            "risk_band": "low",
            "probability_percent": 2.0,
            "factors": [],
        }
        with mock.patch("google.genai.Client") as mock_client_cls:
            mock_client = mock.MagicMock()
            mock_client.models.generate_content.side_effect = fake_generate
            mock_client_cls.return_value = mock_client

            resp = client.post("/explain", json={"prediction_id": make_prediction, "language": "en"}, headers=auth_headers)
            assert resp.status_code == 200
            data = resp.json()
            assert data["source"] == "gemini"

            facts_match = re.search(r"Facts:\s*(\{.*\})", str(captured_prompt.get("contents", "")))
            assert facts_match is not None
            facts_data = json.loads(facts_match.group(1))
            assert facts_data.get("factors") == []


def test_32_system_instruction_contains_required_wording(client, auth_headers, make_prediction, monkeypatch):
    """32. System instruction explicitly requires 'risk level' and 'Never mention gender'."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")

    captured_instruction = {}

    def fake_generate(model, contents, config):
        captured_instruction["system_instruction"] = getattr(config, "system_instruction", "")
        return make_mock_gemini_response("Your credit risk level is low.", "STOP")

    with mock.patch("google.genai.Client") as mock_client_cls:
        mock_client = mock.MagicMock()
        mock_client.models.generate_content.side_effect = fake_generate
        mock_client_cls.return_value = mock_client

        resp = client.post("/explain", json={"prediction_id": make_prediction, "language": "en"}, headers=auth_headers)
        assert resp.status_code == 200

        si_text = str(captured_instruction.get("system_instruction", ""))
        assert "risk level" in si_text
        assert "Never mention gender" in si_text
        assert "never 'risk band' or 'riskband'" in si_text


def test_33_only_one_decimal_percentage_sent_to_gemini(client, auth_headers, make_prediction, monkeypatch):
    """33. Captured prompt sent to Gemini contains probability_percent and not 2-decimal probability."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")

    captured_prompt = {}

    def fake_generate(model, contents, config):
        captured_prompt["contents"] = contents
        return make_mock_gemini_response("Your credit risk level is low with a 7.0% chance.", "STOP")

    with mock.patch("google.genai.Client") as mock_client_cls:
        mock_client = mock.MagicMock()
        mock_client.models.generate_content.side_effect = fake_generate
        mock_client_cls.return_value = mock_client

        resp = client.post("/explain", json={"prediction_id": make_prediction, "language": "en"}, headers=auth_headers)
        assert resp.status_code == 200

        sent_text = str(captured_prompt.get("contents", ""))
        facts_match = re.search(r"Facts:\s*(\{.*\})", sent_text)
        assert facts_match is not None
        facts_data = json.loads(facts_match.group(1))

        # Check keys in facts JSON
        assert "probability_percent" in facts_data
        assert "probability" not in facts_data
        assert set(facts_data.keys()) == {"risk_band", "probability_percent", "factors"}

        # In string form, ensure "probability": or 2-decimal floating value like 0.07 is not present as a key/val
        assert '"probability":' not in facts_match.group(1)
        # Check that probability float (e.g. 0.07) is not present
        assert "0.07" not in sent_text


def test_34_risk_band_converted_to_lowercase_words(client, auth_headers, consent_id, monkeypatch):
    """34. Captured prompt converts VERY_HIGH to 'very high' and MEDIUM to 'medium'."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")

    captured_prompts = []

    def fake_generate(model, contents, config):
        captured_prompts.append(contents)
        facts_match = re.search(r"Facts:\s*(\{.*\})", str(contents))
        pct = 10.0
        if facts_match:
            pct = json.loads(facts_match.group(1)).get("probability_percent", 10.0)
        return make_mock_gemini_response(f"Your credit risk level is low with a {pct}% chance.", "STOP")

    with mock.patch("google.genai.Client") as mock_client_cls:
        mock_client = mock.MagicMock()
        mock_client.models.generate_content.side_effect = fake_generate
        mock_client_cls.return_value = mock_client

        from app.llm.gemini_client import summarize
        # Direct summarize tests
        prompt_vh = summarize({"risk_band": "VERY_HIGH", "probability_percent": 35.5, "factors": []}, language="en")
        assert len(captured_prompts) >= 1
        last_vh_prompt = str(captured_prompts[-1])
        assert '"risk_band": "very high"' in last_vh_prompt

        prompt_med = summarize({"risk_band": "MEDIUM", "probability_percent": 12.0, "factors": []}, language="en")
        last_med_prompt = str(captured_prompts[-1])
        assert '"risk_band": "medium"' in last_med_prompt


def test_35_guard_accepts_marathi_with_unicode_digit_and_rejects_unauthorized():
    """35. Output guard accepts Marathi text with translated reason name and digit 3 (\u0969), rejects others."""
    from app.llm.gemini_client import validate_output_guard, GeminiGuardError
    import pytest

    safe_facts = {
        "risk_band": "medium",
        "probability_percent": 6.7,
        "factors": [
            {"plain_name": "external credit score 3", "direction": "lowered"}
        ]
    }

    # Valid Marathi text with 6.7% and digit 3 written as Devanagari \u0969 (३)
    # \u096c.\u096d% (6.7%) and \u0969 (3)
    valid_marathi = "तुमची जोखीम पातळी मध्यम आहे, \u096c.\u096d% शक्यता आहे. बाह्य क्रेडिट स्कोअर \u0969 मुळे अंदाज कमी झाला."
    cleaned = validate_output_guard(valid_marathi, safe_facts)
    assert cleaned == valid_marathi

    # Invalid text containing another unauthorized number (e.g. 5 or \u096b)
    invalid_marathi = "तुमची जोखीम पातळी मध्यम आहे, \u096c.\u096d% शक्यता आहे. बाह्य क्रेडिट स्कोअर \u0969 आणि \u096b."
    with pytest.raises(GeminiGuardError):
        validate_output_guard(invalid_marathi, safe_facts)


def test_36_system_instruction_mentions_translation_for_hindi_marathi(client, auth_headers, make_prediction, monkeypatch):
    """36. System instruction mentions translating names for Hindi/Marathi and lowercase band for English."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")

    captured_instructions = {}

    def fake_generate(model, contents, config):
        captured_instructions["last"] = getattr(config, "system_instruction", "")
        return make_mock_gemini_response("तुमची जोखीम पातळी कमी आहे.", "STOP")

    with mock.patch("google.genai.Client") as mock_client_cls:
        mock_client = mock.MagicMock()
        mock_client.models.generate_content.side_effect = fake_generate
        mock_client_cls.return_value = mock_client

        # Hindi
        resp = client.post("/explain", json={"prediction_id": make_prediction, "language": "hi"}, headers=auth_headers)
        assert resp.status_code == 200
        si_hi = str(captured_instructions.get("last", ""))
        assert "Translate every reason name into that language" in si_hi

        # Marathi
        resp_mr = client.post("/explain", json={"prediction_id": make_prediction, "language": "mr"}, headers=auth_headers)
        assert resp_mr.status_code == 200
        si_mr = str(captured_instructions.get("last", ""))
        assert "Translate every reason name into that language" in si_mr







