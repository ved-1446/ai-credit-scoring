"""
test_failure_modes.py - Failure-mode tests for /explain and /chat endpoints.

Covers:
1. No GEMINI_API_KEY set: /explain returns template fallback (200, reasons list, nothing in explanations table); /chat returns fixed answer (startup is safe).
2. Gemini raises error (timeout, 503, 400/404): fallback used for /explain and /chat.
3. Gemini returns bad answer (too long, contains link, unauthorized number, finish_reason not STOP): output guard rejects and fallback is used.
4. Rate limits (hourly, per-minute, per-day for explain; user hourly for chat): next call uses fallback without calling Gemini.
5. Chat messages never stored or logged: predictions/explanations tables unchanged, no question text in logs.
6. Gender, age, weekday, and hour never appear in text sent to Gemini.
"""

import json
import logging
from unittest import mock
import pytest

from app.models import Prediction, Explanation
from app.llm.gemini_client import reset_rate_limits
from tests.conftest import SAMPLE_INPUTS, TestSession


def make_mock_gemini_response(text: str, finish_reason: str = "STOP"):
    """Helper to construct a mock response with candidate and finish_reason."""
    mock_res = mock.MagicMock()
    mock_res.text = text
    candidate = mock.MagicMock()
    candidate.finish_reason = mock.MagicMock()
    candidate.finish_reason.value = finish_reason
    candidate.finish_reason.__str__.return_value = finish_reason
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


def test_1_no_gemini_api_key_failure_modes(client, auth_headers, make_prediction):
    """1. No GEMINI_API_KEY set: /explain returns template fallback (200, reasons list, nothing in explanations table); /chat returns fixed answer."""
    pred_id = make_prediction

    # Clear explanations table before test
    db = TestSession()
    try:
        db.query(Explanation).filter_by(prediction_id=pred_id).delete()
        db.commit()
    finally:
        db.close()

    # /explain
    resp_exp = client.post("/explain", json={
        "prediction_id": pred_id,
        "language": "en",
    }, headers=auth_headers)
    assert resp_exp.status_code == 200
    data_exp = resp_exp.json()
    assert data_exp["source"] == "template"
    assert len(data_exp["main_factors"]) > 0
    assert data_exp["summary"] == data_exp["headline"]

    # Assert nothing was saved to explanations table
    db = TestSession()
    try:
        saved_exp = db.query(Explanation).filter_by(prediction_id=pred_id).first()
        assert saved_exp is None
    finally:
        db.close()

    # /chat with off-topic question
    resp_chat = client.post("/chat", json={
        "message": "who won the cricket match",
        "language": "en",
    }, headers=auth_headers)
    assert resp_chat.status_code == 200
    data_chat = resp_chat.json()
    assert data_chat["source"] == "fixed"
    assert "I can only help with questions about this credit scoring demo" in data_chat["answer"]

    # /chat with relevant topic but no API key -> fallback to note
    resp_chat_note = client.post("/chat", json={
        "message": "What is credit score?",
        "topic": "technical_terms_explained",
        "language": "en",
    }, headers=auth_headers)
    assert resp_chat_note.status_code == 200
    assert resp_chat_note.json()["source"] == "notes"


def test_2_gemini_raises_errors_fallback(client, auth_headers, make_prediction, monkeypatch):
    """2. Gemini raises an error (timeout, 503, 404/400): fallback behavior for /explain and /chat; generate_content called exactly once per request."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    pred_id = make_prediction

    for err in [TimeoutError("Request timed out"), Exception("503 Service Unavailable"), Exception("400 Bad Request")]:
        reset_rate_limits()
        with mock.patch("google.genai.Client") as mock_client_cls:
            mock_client = mock.MagicMock()
            mock_client.models.generate_content.side_effect = err
            mock_client_cls.return_value = mock_client

            # /explain falls back to template
            resp_exp = client.post("/explain", json={
                "prediction_id": pred_id,
                "language": "en",
            }, headers=auth_headers)
            assert resp_exp.status_code == 200
            assert resp_exp.json()["source"] == "template"
            assert mock_client.models.generate_content.call_count == 1

        reset_rate_limits()
        with mock.patch("google.genai.Client") as mock_client_cls:
            mock_client = mock.MagicMock()
            mock_client.models.generate_content.side_effect = err
            mock_client_cls.return_value = mock_client

            # /chat falls back to notes
            resp_chat = client.post("/chat", json={
                "message": "What is credit score?",
                "topic": "technical_terms_explained",
                "language": "en",
            }, headers=auth_headers)
            assert resp_chat.status_code == 200
            assert resp_chat.json()["source"] == "notes"
            assert mock_client.models.generate_content.call_count == 1


def test_3_gemini_bad_answer_rejected_by_output_guard(client, auth_headers, make_prediction, monkeypatch):
    """3. Gemini returns a bad answer (too long, contains link, unauthorized number, finish_reason not STOP): output guard rejects, fallback is used, generate_content called exactly once."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    pred_id = make_prediction

    bad_responses = [
        # Too long (> 700 chars for explain / > 900 for chat)
        make_mock_gemini_response("A" * 950, "STOP"),
        # Contains forbidden link
        make_mock_gemini_response("Visit http://example.com for more info.", "STOP"),
        # Contains unauthorized number
        make_mock_gemini_response("Your credit score was adjusted by 8888 points.", "STOP"),
        # finish_reason not STOP
        make_mock_gemini_response("Your risk level is medium", "MAX_TOKENS"),
    ]

    for bad_resp in bad_responses:
        reset_rate_limits()
        with mock.patch("google.genai.Client") as mock_client_cls:
            mock_client = mock.MagicMock()
            mock_client.models.generate_content.return_value = bad_resp
            mock_client_cls.return_value = mock_client

            # /explain rejects and falls back to template
            resp_exp = client.post("/explain", json={
                "prediction_id": pred_id,
                "language": "en",
            }, headers=auth_headers)
            assert resp_exp.status_code == 200
            assert resp_exp.json()["source"] == "template"
            assert mock_client.models.generate_content.call_count == 1

        reset_rate_limits()
        with mock.patch("google.genai.Client") as mock_client_cls:
            mock_client = mock.MagicMock()
            mock_client.models.generate_content.return_value = bad_resp
            mock_client_cls.return_value = mock_client

            # /chat rejects and falls back to notes
            resp_chat = client.post("/chat", json={
                "message": "What is credit score?",
                "topic": "technical_terms_explained",
                "language": "en",
            }, headers=auth_headers)
            assert resp_chat.status_code == 200
            assert resp_chat.json()["source"] == "notes"
            assert mock_client.models.generate_content.call_count == 1


def test_4_rate_limits_enforced_with_fallback(client, auth_headers, make_prediction, monkeypatch):
    """4. Rate limits: after hitting user hour limits, next call uses fallback without calling Gemini."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    monkeypatch.setenv("GEMINI_MAX_CALLS_PER_USER_HOUR", "1")
    monkeypatch.setenv("GEMINI_MAX_CHAT_PER_USER_HOUR", "1")

    pred_id = make_prediction

    with mock.patch("google.genai.Client") as mock_client_cls:
        mock_client = mock.MagicMock()
        mock_client.models.generate_content.return_value = make_mock_gemini_response(
            "Your external credit score lowered your risk estimate.", "STOP"
        )
        mock_client_cls.return_value = mock_client

        # 1. /explain call 1 succeeds with gemini
        resp1 = client.post("/explain", json={"prediction_id": pred_id, "language": "en"}, headers=auth_headers)
        assert resp1.status_code == 200
        assert resp1.json()["source"] == "gemini"
        assert mock_client.models.generate_content.call_count == 1

        # 2. /explain call 2 (new language so not cached) hits user hour limit -> falls back to template without calling gemini
        resp2 = client.post("/explain", json={"prediction_id": pred_id, "language": "hi"}, headers=auth_headers)
        assert resp2.status_code == 200
        assert resp2.json()["source"] == "template"
        assert mock_client.models.generate_content.call_count == 1

        # 3. /chat call 1 succeeds with gemini
        resp_c1 = client.post("/chat", json={"message": "What is credit score?", "topic": "technical_terms_explained"}, headers=auth_headers)
        assert resp_c1.status_code == 200
        assert resp_c1.json()["source"] == "gemini"
        assert mock_client.models.generate_content.call_count == 2

        # 4. /chat call 2 hits user chat hour limit -> falls back to notes without calling gemini
        resp_c2 = client.post("/chat", json={"message": "What is credit score?", "topic": "technical_terms_explained"}, headers=auth_headers)
        assert resp_c2.status_code == 200
        assert resp_c2.json()["source"] == "notes"
        assert mock_client.models.generate_content.call_count == 2


def test_4b_per_minute_limit_enforced_with_fallback(client, auth_headers, make_prediction, monkeypatch):
    """test_4b: per-minute limit. First call -> gemini; second call -> template with call_count still 1."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    monkeypatch.setenv("GEMINI_MAX_CALLS_PER_MINUTE", "1")
    monkeypatch.setenv("GEMINI_MAX_CALLS_PER_USER_HOUR", "100")
    monkeypatch.setenv("GEMINI_MAX_CALLS_PER_DAY", "100")

    pred_id = make_prediction

    with mock.patch("google.genai.Client") as mock_client_cls:
        mock_client = mock.MagicMock()
        mock_client.models.generate_content.return_value = make_mock_gemini_response(
            "Your external credit score lowered your risk estimate.", "STOP"
        )
        mock_client_cls.return_value = mock_client

        # 1. /explain call 1 succeeds
        resp1 = client.post("/explain", json={"prediction_id": pred_id, "language": "en"}, headers=auth_headers)
        assert resp1.status_code == 200
        assert resp1.json()["source"] == "gemini"
        assert mock_client.models.generate_content.call_count == 1

        # 2. /explain call 2 (new language -> not cached) hits per-minute limit -> fallback to template
        resp2 = client.post("/explain", json={"prediction_id": pred_id, "language": "hi"}, headers=auth_headers)
        assert resp2.status_code == 200
        assert resp2.json()["source"] == "template"
        assert mock_client.models.generate_content.call_count == 1


def test_4c_per_day_limit_enforced_with_fallback(client, auth_headers, make_prediction, monkeypatch):
    """test_4c: per-day limit. First call -> gemini; second call -> template with call_count still 1."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    monkeypatch.setenv("GEMINI_MAX_CALLS_PER_DAY", "1")
    monkeypatch.setenv("GEMINI_MAX_CALLS_PER_MINUTE", "100")
    monkeypatch.setenv("GEMINI_MAX_CALLS_PER_USER_HOUR", "100")

    pred_id = make_prediction

    with mock.patch("google.genai.Client") as mock_client_cls:
        mock_client = mock.MagicMock()
        mock_client.models.generate_content.return_value = make_mock_gemini_response(
            "Your external credit score lowered your risk estimate.", "STOP"
        )
        mock_client_cls.return_value = mock_client

        # 1. /explain call 1 succeeds
        resp1 = client.post("/explain", json={"prediction_id": pred_id, "language": "en"}, headers=auth_headers)
        assert resp1.status_code == 200
        assert resp1.json()["source"] == "gemini"
        assert mock_client.models.generate_content.call_count == 1

        # 2. /explain call 2 (new language -> not cached) hits per-day limit -> fallback to template
        resp2 = client.post("/explain", json={"prediction_id": pred_id, "language": "hi"}, headers=auth_headers)
        assert resp2.status_code == 200
        assert resp2.json()["source"] == "template"
        assert mock_client.models.generate_content.call_count == 1


def test_4d_chat_and_explain_share_global_limits(client, auth_headers, make_prediction, monkeypatch):
    """test_4d: chat and explain share the global minute limit (1 call total)."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    monkeypatch.setenv("GEMINI_MAX_CALLS_PER_MINUTE", "1")
    monkeypatch.setenv("GEMINI_MAX_CALLS_PER_USER_HOUR", "100")
    monkeypatch.setenv("GEMINI_MAX_CHAT_PER_USER_HOUR", "100")
    monkeypatch.setenv("GEMINI_MAX_CALLS_PER_DAY", "100")

    pred_id = make_prediction

    with mock.patch("google.genai.Client") as mock_client_cls:
        mock_client = mock.MagicMock()
        mock_client.models.generate_content.return_value = make_mock_gemini_response(
            "Assessment for educational purposes.", "STOP"
        )
        mock_client_cls.return_value = mock_client

        # 1. /explain call 1 succeeds with Gemini
        resp1 = client.post("/explain", json={"prediction_id": pred_id, "language": "en"}, headers=auth_headers)
        assert resp1.status_code == 200
        assert resp1.json()["source"] == "gemini"
        assert mock_client.models.generate_content.call_count == 1

        # 2. /chat call hits global minute limit -> falls back to notes without calling Gemini
        resp_c = client.post("/chat", json={"message": "What is credit score?", "topic": "technical_terms_explained"}, headers=auth_headers)
        assert resp_c.status_code == 200
        assert resp_c.json()["source"] == "notes"
        assert mock_client.models.generate_content.call_count == 1


def test_5_chat_messages_never_stored_or_logged(client, auth_headers, caplog, monkeypatch):
    """5. Chat messages are never stored or logged across (1) no API key, (2) normal Gemini success, (3) Gemini exception."""
    secret_question_base = "SECRET_SUPER_CONFIDENTIAL_QUESTION_998877"

    # Case A: No GEMINI_API_KEY
    db = TestSession()
    try:
        pred_count_before = db.query(Prediction).count()
        exp_count_before = db.query(Explanation).count()
    finally:
        db.close()

    with caplog.at_level(logging.DEBUG):
        caplog.clear()
        resp_a = client.post("/chat", json={
            "message": secret_question_base + "_CASE_A",
            "topic": "technical_terms_explained",
            "language": "en",
        }, headers=auth_headers)
        assert resp_a.status_code == 200
        assert secret_question_base + "_CASE_A" not in caplog.text

    db = TestSession()
    try:
        assert db.query(Prediction).count() == pred_count_before
        assert db.query(Explanation).count() == exp_count_before
    finally:
        db.close()

    # Case B: GEMINI_API_KEY set + normal Gemini short answer
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    with mock.patch("google.genai.Client") as mock_client_cls:
        mock_client = mock.MagicMock()
        mock_client.models.generate_content.return_value = make_mock_gemini_response(
            "Credit score indicates repayment history.", "STOP"
        )
        mock_client_cls.return_value = mock_client

        with caplog.at_level(logging.DEBUG):
            caplog.clear()
            resp_b = client.post("/chat", json={
                "message": secret_question_base + "_CASE_B",
                "topic": "technical_terms_explained",
                "language": "en",
            }, headers=auth_headers)
            assert resp_b.status_code == 200
            assert resp_b.json()["source"] == "gemini"
            assert mock_client.models.generate_content.call_count == 1
            assert secret_question_base + "_CASE_B" not in caplog.text

    db = TestSession()
    try:
        assert db.query(Prediction).count() == pred_count_before
        assert db.query(Explanation).count() == exp_count_before
    finally:
        db.close()

    # Case C: GEMINI_API_KEY set + Gemini raises Exception
    with mock.patch("google.genai.Client") as mock_client_cls:
        mock_client = mock.MagicMock()
        mock_client.models.generate_content.side_effect = Exception("500 Internal Gemini Error")
        mock_client_cls.return_value = mock_client

        with caplog.at_level(logging.DEBUG):
            caplog.clear()
            resp_c = client.post("/chat", json={
                "message": secret_question_base + "_CASE_C",
                "topic": "technical_terms_explained",
                "language": "en",
            }, headers=auth_headers)
            assert resp_c.status_code == 200
            assert resp_c.json()["source"] == "notes"
            assert mock_client.models.generate_content.call_count == 1
            assert secret_question_base + "_CASE_C" not in caplog.text

    db = TestSession()
    try:
        assert db.query(Prediction).count() == pred_count_before
        assert db.query(Explanation).count() == exp_count_before
    finally:
        db.close()


def _get_unused_rag_numbers():
    """Read all notes, fixed_texts, and app Python files to find the first unused hour (0..23) and age (18..75)."""
    import glob
    import os
    import re

    backend_dir = os.path.join(os.path.dirname(__file__), "..")
    files = []
    files.extend(glob.glob(os.path.join(backend_dir, "app", "rag", "notes", "*.json")))
    files.append(os.path.join(backend_dir, "app", "rag", "fixed_texts.json"))
    files.append(os.path.join(backend_dir, "app", "llm", "gemini_client.py"))
    files.append(os.path.join(backend_dir, "app", "routers", "chat.py"))
    files.append(os.path.join(backend_dir, "app", "routers", "explain.py"))
    files.append(os.path.join(backend_dir, "app", "ml", "explain_text.py"))
    files.append(os.path.join(backend_dir, "app", "ml", "feature_dictionary.json"))

    all_texts = []
    for fpath in files:
        if os.path.exists(fpath):
            with open(fpath, "r", encoding="utf-8") as f:
                all_texts.append(f.read())
    combined_text = "\n".join(all_texts)

    def contains_standalone(n: int, text: str) -> bool:
        # Pattern ignores digits that are part of decimals or percentages
        pattern = rf"(?<![\d.]){n}(?!\d|\.\d)"
        return bool(re.search(pattern, text))

    found_numbers = [n for n in range(0, 100) if contains_standalone(n, combined_text)]

    chosen_hour = None
    for h in range(24):
        if not contains_standalone(h, combined_text):
            chosen_hour = h
            break

    chosen_age = None
    for a in range(18, 76):
        if not contains_standalone(a, combined_text):
            chosen_age = a
            break

    return chosen_hour, chosen_age, found_numbers


def test_6_gender_age_weekday_hour_never_sent_to_gemini(client, auth_headers, consent_id, monkeypatch):
    """6. Gender, age, weekday and hour never appear in text sent to Gemini (clock-independent)."""
    import re

    chosen_hour, chosen_age, found_numbers = _get_unused_rag_numbers()
    chosen_weekday = "WEDNESDAY"

    assert chosen_hour is not None, "Failed to find an unused hour in 0..23 across text universe"
    assert chosen_age is not None, "Failed to find an unused age in 18..75 across text universe"

    print(f"\n[test_6] Chosen hour: {chosen_hour}, Chosen age: {chosen_age}, Chosen weekday: {chosen_weekday}")
    print(f"[test_6] Numbers found in text universe (0..99): {found_numbers}")

    # Explicit inputs with chosen values
    test_inputs = dict(SAMPLE_INPUTS)
    test_inputs["age_years"] = chosen_age
    test_inputs["gender"] = "F"
    test_inputs["weekday_appr_process_start"] = chosen_weekday
    test_inputs["hour_appr_process_start"] = chosen_hour

    # Call /predict with explicit inputs
    resp_pred = client.post("/predict", json={
        "consent_id": consent_id,
        "inputs": test_inputs,
    }, headers=auth_headers)
    assert resp_pred.status_code == 200
    pred_id = resp_pred.json()["request_id"]

    # Verify saved inputs in database strictly equal what was sent
    db = TestSession()
    try:
        pred_row = db.query(Prediction).filter_by(id=pred_id).first()
        assert pred_row is not None
        saved_inputs = pred_row.inputs if hasattr(pred_row, "inputs") and isinstance(pred_row.inputs, dict) else json.loads(pred_row.inputs_json)
        assert "weekday_appr_process_start" in saved_inputs, "Saved inputs missing weekday_appr_process_start"
        assert "hour_appr_process_start" in saved_inputs, "Saved inputs missing hour_appr_process_start"
        assert saved_inputs["weekday_appr_process_start"] == chosen_weekday
        assert saved_inputs["hour_appr_process_start"] == chosen_hour
        assert saved_inputs["age_years"] == chosen_age
        assert saved_inputs["gender"] == "F"
    finally:
        db.close()

    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    captured_calls = []

    def fake_generate(model, contents, config):
        captured_calls.append({
            "contents": str(contents),
            "config": config,
            "system_instruction": str(getattr(config, "system_instruction", "") or ""),
        })
        return make_mock_gemini_response("Your external credit score lowered your risk estimate.", "STOP")

    with mock.patch("google.genai.Client") as mock_client_cls:
        mock_client = mock.MagicMock()
        mock_client.models.generate_content.side_effect = fake_generate
        mock_client_cls.return_value = mock_client

        # 1. Test /explain (call index 0)
        resp_exp = client.post("/explain", json={
            "prediction_id": pred_id,
            "language": "en",
        }, headers=auth_headers)
        assert resp_exp.status_code == 200
        assert resp_exp.json()["source"] == "gemini"

        # 2. Test /chat with prediction_id attached (call index 1)
        resp_chat = client.post("/chat", json={
            "message": "Why did my result come out this way?",
            "prediction_id": pred_id,
            "language": "en",
        }, headers=auth_headers)
        assert resp_chat.status_code == 200
        assert resp_chat.json()["source"] == "gemini"

        assert len(captured_calls) == 2, f"Expected exactly 2 Gemini calls, got {len(captured_calls)}"

        call_sources = ["/explain (call index 0)", "/chat (call index 1)"]

        for idx, call_data in enumerate(captured_calls):
            call_label = call_sources[idx] if idx < len(call_sources) else f"call index {idx}"
            contents_text = call_data["contents"]
            si_text = call_data["system_instruction"]

            # Sanity check: prompt text must be longer than 200 characters
            assert len(contents_text) > 200, f"{call_label} prompt contents too short ({len(contents_text)} chars)"

            # Check values in prompt contents (user-facing prompt)
            assert "CODE_GENDER" not in contents_text, f"{call_label} leaked 'CODE_GENDER' in prompt"
            assert "gender" not in contents_text.lower(), f"{call_label} leaked 'gender' in prompt"
            assert not re.search(r"\bfemale\b", contents_text, re.IGNORECASE), f"{call_label} leaked 'female' in prompt"
            assert not re.search(r"\bmale\b", contents_text, re.IGNORECASE), f"{call_label} leaked 'male' in prompt"

            assert "DAYS_BIRTH" not in contents_text, f"{call_label} leaked 'DAYS_BIRTH' in prompt"
            assert "age_years" not in contents_text, f"{call_label} leaked 'age_years' in prompt"
            assert not re.search(rf"\b{chosen_age}\b", contents_text), f"{call_label} leaked age {chosen_age} in prompt"

            assert "WEEKDAY_APPR_PROCESS_START" not in contents_text, f"{call_label} leaked 'WEEKDAY_APPR_PROCESS_START' in prompt"
            assert "weekday_appr_process_start" not in contents_text, f"{call_label} leaked 'weekday_appr_process_start' in prompt"
            assert not re.search(rf"\b{chosen_weekday}\b", contents_text, re.IGNORECASE), f"{call_label} leaked weekday {chosen_weekday} in prompt"

            assert "HOUR_APPR_PROCESS_START" not in contents_text, f"{call_label} leaked 'HOUR_APPR_PROCESS_START' in prompt"
            assert "hour_appr_process_start" not in contents_text, f"{call_label} leaked 'hour_appr_process_start' in prompt"
            assert not re.search(rf"\b{chosen_hour}\b", contents_text), f"{call_label} leaked hour {chosen_hour} in prompt"

            # Check values in system instruction / config text
            assert "CODE_GENDER" not in si_text, f"{call_label} leaked 'CODE_GENDER' in system_instruction"
            assert not re.search(r"\bfemale\b", si_text, re.IGNORECASE), f"{call_label} leaked 'female' in system_instruction"
            assert not re.search(r"\bmale\b", si_text, re.IGNORECASE), f"{call_label} leaked 'male' in system_instruction"

            assert "DAYS_BIRTH" not in si_text, f"{call_label} leaked 'DAYS_BIRTH' in system_instruction"
            assert "age_years" not in si_text, f"{call_label} leaked 'age_years' in system_instruction"
            assert not re.search(rf"\b{chosen_age}\b", si_text), f"{call_label} leaked age {chosen_age} in system_instruction"

            assert "WEEKDAY_APPR_PROCESS_START" not in si_text, f"{call_label} leaked 'WEEKDAY_APPR_PROCESS_START' in system_instruction"
            assert "weekday_appr_process_start" not in si_text, f"{call_label} leaked 'weekday_appr_process_start' in system_instruction"
            assert not re.search(rf"\b{chosen_weekday}\b", si_text, re.IGNORECASE), f"{call_label} leaked weekday {chosen_weekday} in system_instruction"

            assert "HOUR_APPR_PROCESS_START" not in si_text, f"{call_label} leaked 'HOUR_APPR_PROCESS_START' in system_instruction"
            assert "hour_appr_process_start" not in si_text, f"{call_label} leaked 'hour_appr_process_start' in system_instruction"
            assert not re.search(rf"\b{chosen_hour}\b", si_text), f"{call_label} leaked hour {chosen_hour} in system_instruction"


