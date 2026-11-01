"""
chat.py - POST /chat endpoint for Help Chatbot (RAG).

Uses TF-IDF note retrieval + Gemini grounded answer generation.
Enforces strict privacy: never logs user message text, prompt text, or raw user data.
"""

import json
import logging
import os
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User, Prediction
from app.schemas import ChatRequest, ChatResponse
from app.security import get_current_user
from app.errors import not_found, validation_error
from app.ml.explain_text import build_safe_facts
from app.rag.retriever import retriever
from app.llm.gemini_client import chat_with_gemini

logger = logging.getLogger("datadynamo")

router = APIRouter(tags=["chat"])

FIXED_TEXTS_PATH = os.path.join(os.path.dirname(__file__), "..", "rag", "fixed_texts.json")

try:
    with open(FIXED_TEXTS_PATH, "r", encoding="utf-8") as f:
        FIXED_TEXTS = json.load(f)
except Exception as e:
    logger.error("Failed to load fixed_texts.json: %s", e)
    FIXED_TEXTS = {
        "en": {
            "privacy_line": "Note: your chat question is sent to Google's Gemini service to write this answer. On Google's free service, text sent may be used to improve Google's products, so please do not type personal details.",
            "disclaimer": "Your question is sent to Google's Gemini to write the answer, so please do not type personal details.",
            "fixed_answer": "I can only help with questions about this credit scoring demo, how your results were calculated, and how the application works. Here are some topics you might find helpful.",
        }
    }

DEFAULT_SUGGESTIONS = ["scoring_mechanics", "risk_levels", "privacy_and_consent"]


@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(
    body: ChatRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Chat with the Data Dynamo educational help assistant."""
    # 1. Validate message length (1 to 300 characters after strip)
    raw_msg = (body.message or "").strip()
    if len(raw_msg) < 1 or len(raw_msg) > 300:
        raise validation_error(
            details=[{"field": "message", "issue": "Message must be between 1 and 300 characters."}]
        )

    # Validate language
    lang = (body.language or "en").lower().strip()
    language_fallback = False
    if lang not in ["en", "hi", "mr"]:
        lang = "en"
        language_fallback = True

    texts_for_lang = FIXED_TEXTS.get(lang, FIXED_TEXTS["en"])
    disclaimer_text = texts_for_lang.get("disclaimer", FIXED_TEXTS["en"]["disclaimer"])

    # 2. If prediction_id is given, load it with the same ownership rule as /explain
    safe_facts: Optional[Dict[str, Any]] = None
    if body.prediction_id:
        pred = db.query(Prediction).filter(Prediction.id == body.prediction_id).first()
        if not pred:
            raise not_found("Prediction not found")

        # Ownership check: user can only access their own unless admin
        if user.role != "admin" and pred.user_id != user.id:
            raise not_found("Prediction not found")

        resp_data = json.loads(pred.response_json) if pred.response_json else {}
        top_factors = resp_data.get("explanation", {}).get("top_factors", [])
        safe_facts = build_safe_facts(
            top_factors=top_factors,
            risk_band=pred.risk_band,
            probability=pred.probability,
        )

    # 3. Retrieve notes
    min_score = float(os.getenv("RAG_MIN_SCORE", "0.12"))
    selected_notes: List[Dict[str, Any]] = []

    if body.topic and retriever.get_note_by_id(body.topic):
        topic_note = retriever.get_note_by_id(body.topic)
        if topic_note:
            selected_notes.append(topic_note)
            # Add other top search notes up to 3 total
            for n, score in retriever.search(raw_msg, k=3):
                if n["id"] != topic_note["id"] and len(selected_notes) < 3:
                    selected_notes.append(n)
    else:
        search_results = retriever.search(raw_msg, k=3)
        if not search_results or search_results[0][1] < min_score:
            # Below threshold: return fixed response, do NOT call Gemini
            note_ids = [r[0]["id"] for r in search_results] if search_results else []
            suggested = DEFAULT_SUGGESTIONS
            logger.info("Chat: source=fixed, notes_used=%s, msg_len=%d, status=ok", note_ids, len(raw_msg))
            fixed_ans = texts_for_lang.get("fixed_answer", FIXED_TEXTS["en"]["fixed_answer"])
            return ChatResponse(
                answer=fixed_ans,
                source="fixed",
                language=lang,
                language_fallback=language_fallback,
                note_ids=note_ids,
                suggested_topics=suggested,
                disclaimer=disclaimer_text,
            )
        selected_notes = [r[0] for r in search_results]

    note_ids = [n["id"] for n in selected_notes]
    suggested_topics = [n["id"] for n in selected_notes[:3]]

    # Append privacy line ONLY when privacy_and_consent is the top-ranked note (or topic == "privacy_and_consent")
    top_note_id = selected_notes[0]["id"] if selected_notes else None
    needs_privacy_disclosure = (top_note_id == "privacy_and_consent") or (body.topic == "privacy_and_consent")
    privacy_line = texts_for_lang.get("privacy_line", FIXED_TEXTS["en"]["privacy_line"])

    # 4. Attempt Gemini call with fallback to best note body
    try:
        gemini_answer = chat_with_gemini(
            notes=selected_notes,
            question=raw_msg,
            safe_facts=safe_facts,
            language=lang,
            user_id=str(user.id),
        )
        # Check for NOT_SURE signal from model
        cleaned_signal = re.sub(r"[^\w]", "", gemini_answer).upper()
        if cleaned_signal == "NOT_SURE":
            fixed_ans = texts_for_lang.get("fixed_answer", FIXED_TEXTS["en"]["fixed_answer"])
            logger.info("Chat: source=fixed, notes_used=%s, msg_len=%d, status=ok", note_ids, len(raw_msg))
            return ChatResponse(
                answer=fixed_ans,
                source="fixed",
                language=lang,
                language_fallback=language_fallback,
                note_ids=note_ids,
                suggested_topics=suggested_topics,
                disclaimer=disclaimer_text,
            )

        if needs_privacy_disclosure:
            gemini_answer = f"{gemini_answer}\n\n{privacy_line}"

        logger.info("Chat: source=gemini, notes_used=%s, msg_len=%d, status=ok", note_ids, len(raw_msg))
        return ChatResponse(
            answer=gemini_answer,
            source="gemini",
            language=lang,
            language_fallback=language_fallback,
            note_ids=note_ids,
            suggested_topics=suggested_topics,
            disclaimer=disclaimer_text,
        )
    except Exception as e:
        logger.warning("Chat Gemini call failed, falling back to note: %s", type(e).__name__)
        fallback_answer = selected_notes[0].get("body", "") if selected_notes else texts_for_lang.get("fixed_answer", FIXED_TEXTS["en"]["fixed_answer"])
        if needs_privacy_disclosure:
            fallback_answer = f"{fallback_answer}\n\n{privacy_line}"

        # When source is notes and requested language is not en, notes are in English so language_fallback is True
        effective_fallback = True if lang != "en" else language_fallback

        logger.info("Chat: source=notes, notes_used=%s, msg_len=%d, status=ok", note_ids, len(raw_msg))
        return ChatResponse(
            answer=fallback_answer,
            source="notes",
            language=lang,
            language_fallback=effective_fallback,
            note_ids=note_ids,
            suggested_topics=suggested_topics,
            disclaimer=disclaimer_text,
        )
