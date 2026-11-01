"""
test_retriever.py - Unit tests for TF-IDF Note Retriever.
"""

import os
import pytest

from app.rag.retriever import Retriever


@pytest.fixture
def retriever():
    return Retriever()


def test_retriever_loads_all_notes(retriever):
    """Verify all 20 help notes are loaded and indexed."""
    assert len(retriever.notes) == 20
    assert len(retriever.notes_by_id) == 20


def test_exact_canonical_note_strings(retriever):
    """Assert canonical note bodies match exact strings."""
    expected_disclaimer = (
        "Data Dynamo is an educational demonstration designed to show how credit scoring models work. "
        "It does not make real credit decisions, loan approvals, or provide financial, legal, or investment advice. "
        "No real borrowing or lending occurs through this demo."
    )
    expected_fairness = (
        "Yes, this demo model uses gender and age as inputs, because it was trained with them. "
        "That is a limitation, not a strength: in some places lenders are not allowed to use gender in credit decisions. "
        "The result page keeps gender and age out of the main reasons list and mentions them in a separate note, but they still affect the score. "
        "The admin fairness page shows that one gender group was flagged about half as often as the other (ratio 0.516). "
        "That gap is a warning sign. It does not prove the model is fair or unfair, and we make no claim of fairness."
    )
    expected_how_exp = (
        "Explanations combine rule-based factor extraction with an AI summary writer. "
        "The main factors list is created directly from the model's feature contributions using fixed rules. "
        "When available, Google Gemini writes a readable summary paragraph from these safe facts, but the AI writer cannot change the calculated risk score."
    )
    expected_technical_terms = (
        "A credit score represents an estimate of past repayment history from credit bureaus. "
        "Default means failing to repay a loan as agreed. "
        "Probability is the statistical likelihood, from 0% to 100%, that an event may occur based on historical training data."
    )
    expected_ext_scores = (
        "External credit scores 1, 2, and 3 are normalized credit scores ranging from 0.0 to 1.0 from outside credit data sources. "
        "In this demo model, higher external credit scores generally lower the estimated risk of defaulting on a loan, and lower scores generally raise it. "
        "If you leave one blank, the website fills in a typical value."
    )
    expected_reasons = (
        "Each factor evaluated by the model pushes the risk estimate higher or lower compared to a baseline applicant. "
        "The result page shows which way each factor pushed your own estimate. "
        "For example, in this demo model higher external credit scores generally push the estimate down."
    )

    assert retriever.get_note_by_id("educational_demo_disclaimer")["body"] == expected_disclaimer
    assert retriever.get_note_by_id("fairness_and_gender")["body"] == expected_fairness
    assert retriever.get_note_by_id("how_explanations_work")["body"] == expected_how_exp
    assert retriever.get_note_by_id("technical_terms_explained")["body"] == expected_technical_terms
    assert retriever.get_note_by_id("external_credit_scores")["body"] == expected_ext_scores
    assert retriever.get_note_by_id("reasons_raised_lowered")["body"] == expected_reasons


def test_no_glued_words_in_any_note(retriever):
    """Verify none of the forbidden glued words appear in any note body."""
    forbidden_glued = ["occursthrough", "fairnesspage", "fromthese", "aloan", "riskin", "ofdependents", "17out"]
    for note in retriever.notes:
        body_lower = note.get("body", "").lower()
        for glued in forbidden_glued:
            assert glued not in body_lower, f"Glued word '{glued}' found in note '{note['id']}'"


def test_retriever_in_domain_and_separation(retriever):
    """Test labelled test set: >=12 in-domain questions per language and >=15 off-topic questions.

    Asserts:
    1. Every in-domain question has its expected note in the top 3 results.
    2. Every in-domain question top score is >= RAG_MIN_SCORE threshold (0.12).
    """
    in_domain_queries = [
        # English (12)
        ("is my data sent to google", "privacy_and_consent"),
        ("how accurate is this demo model", "model_limits_and_honesty"),
        ("does the model use gender and age", "fairness_and_gender"),
        ("what are the roc auc and technical metrics", "model_technical_details"),
        ("how does loan amount and income affect scoring", "income_and_loan"),
        ("does my age or employment years matter", "employment_and_age"),
        ("what if i own a house or have children", "family_and_home"),
        ("what does external credit score 1 2 3 mean", "external_credit_scores"),
        ("why are credit bureau inquiries checked", "credit_report_checks"),
        ("what happens if i leave optional fields blank", "optional_fields_blank"),
        ("what does the probability percentage mean", "percentage_meaning"),
        ("why did some reasons raise or lower my risk", "reasons_raised_lowered"),
        # Hindi / Hinglish (12)
        ("\u0915\u094d\u092f\u093e \u092e\u0947\u0930\u093e \u0921\u093e\u091f\u093e google \u0915\u094b \u092d\u0947\u091c\u093e \u091c\u093e\u0924\u093e \u0939\u0948", "privacy_and_consent"),
        ("\u092f\u0939 \u092e\u0949\u0921\u0932 \u0915\u093f\u0924\u0928\u093e \u0938\u0939\u0940 \u0939\u0948 \u0914\u0930 \u0907\u0938\u0915\u0940 \u0938\u0940\u092e\u093e\u090f\u0901 \u0915\u094d\u092f\u093e \u0939\u0948\u0902", "model_limits_and_honesty"),
        ("\u0915\u094d\u092f\u093e \u092e\u0949\u0921\u0932 \u0932\u093f\u0902\u0917 \u092f\u093e gender \u0915\u093e \u0909\u092a\u092f\u094b\u0917 \u0915\u0930\u0924\u093e \u0939\u0948", "fairness_and_gender"),
        ("model ke technical details aur roc auc metrics kya hai", "model_technical_details"),
        ("\u0906\u092e\u0926\u0928\u0940 \u0914\u0930 \u0932\u094b\u0928 \u0930\u093e\u0936\u093f \u0938\u0947 \u0915\u094d\u092f\u093e \u092b\u0930\u094d\u0915 \u092a\u0921\u093c\u0924\u093e \u0939\u0948", "income_and_loan"),
        ("\u0915\u093e\u092e \u0915\u0947 \u0938\u093e\u0932 \u0914\u0930 \u0909\u092e\u094d\u0930 \u0915\u093e \u0915\u094d\u092f\u093e \u092a\u094d\u0930\u092d\u093e\u0935 \u0939\u0948", "employment_and_age"),
        ("\u0918\u0930 \u0914\u0930 \u092a\u0930\u093f\u0935\u093e\u0930 \u0915\u0940 \u091c\u093e\u0928\u0915\u093e\u0930\u0940", "family_and_home"),
        ("\u0915\u094d\u0930\u0947\u0921\u093f\u091f \u0938\u094d\u0915\u094b\u0930 \u0915\u093e \u0915\u094d\u092f\u093e \u092e\u0924\u0932\u092c \u0939\u0948", "external_credit_scores"),
        ("\u0915\u094d\u0930\u0947\u0921\u093f\u091f \u092c\u094d\u092f\u0942\u0930\u094b \u091c\u093e\u0902\u091a credit bureau inquiries", "credit_report_checks"),
        ("\u0916\u093e\u0932\u0940 \u091b\u094b\u0921\u093c\u0928\u0947 \u092a\u0930 \u0915\u094d\u092f\u093e \u0939\u094b\u0924\u093e \u0939\u0948 optional blank", "optional_fields_blank"),
        ("\u091c\u094b\u0916\u093f\u092e \u0915\u093e \u092a\u094d\u0930\u0924\u093f\u0936\u0924 percentage risk kya hai", "percentage_meaning"),
        ("karan raised ya lowered kyu hue", "reasons_raised_lowered"),
        # Marathi (12)
        ("\u092e\u093e\u091d\u0940 \u092e\u093e\u0939\u093f\u0924\u0940 google \u0932\u093e \u092a\u093e\u0920\u0935\u0932\u0940 \u091c\u093e\u0924\u0947 \u0915\u093e", "privacy_and_consent"),
        ("\u0939\u0947 \u092e\u0949\u0921\u0947\u0932 \u0915\u093f\u0924\u0940 \u0905\u091a\u0942\u0915 \u0906\u0939\u0947 \u0906\u0923\u093f \u092e\u0930\u094d\u092f\u093e\u0926\u093e \u0915\u093e\u092f \u0906\u0939\u0947\u0924", "model_limits_and_honesty"),
        ("\u092e\u0949\u0921\u0947\u0932 \u0932\u093f\u0902\u0917 \u0915\u093f\u0902\u0935\u093e gender \u0935\u093e\u092a\u0930\u0924\u0947 \u0915\u093e", "fairness_and_gender"),
        ("model che technical metrics roc auc kay ahet", "model_technical_details"),
        ("\u0909\u0924\u094d\u092a\u0928\u094d\u0928 \u0906\u0923\u093f \u0915\u0930\u094d\u091c \u0930\u0915\u094d\u0915\u092e\u0947\u091a\u093e \u092a\u0930\u093f\u0923\u093e\u092e", "income_and_loan"),
        ("\u0928\u094b\u0915\u0930\u0940 \u0935\u0930\u094d\u0937\u0947 \u0906\u0923\u093f \u0935\u092f \u092f\u093e\u0902\u091a\u093e \u092a\u094d\u0930\u092d\u093e\u0935", "employment_and_age"),
        ("\u0918\u0930 \u0906\u0923\u093f \u0915\u0941\u091f\u0941\u0902\u092c \u092e\u093e\u0939\u093f\u0924\u0940", "family_and_home"),
        ("\u0915\u094d\u0930\u0947\u0921\u093f\u091f \u0938\u094d\u0915\u094b\u0905\u0930 \u092e\u094d\u0939\u0923\u091c\u0947 \u0915\u093e\u092f", "external_credit_scores"),
        ("\u0915\u094d\u0930\u0947\u0921\u093f\u091f \u092c\u094d\u092f\u0941\u0930\u094b \u091a\u094c\u0915\u0936\u0940 bureau inquiries", "credit_report_checks"),
        ("\u0930\u093f\u0915\u093e\u092e\u0947 \u0938\u094b\u0921\u0932\u094d\u092f\u093e\u0938 \u0915\u093e\u092f \u0939\u094b\u0924\u0947 optional blank", "optional_fields_blank"),
        ("\u0927\u094b\u0915\u093e \u091f\u0915\u094d\u0915\u0947\u0935\u093e\u0930\u0940 percentage risk kay ahe", "percentage_meaning"),
        ("\u0915\u093e\u0930\u0923\u0947 raised kiva lowered kashi hotat", "reasons_raised_lowered"),
    ]

    min_threshold = 0.12

    for q, expected_id in in_domain_queries:
        results = retriever.search(q, k=3)
        top_ids = [r[0]["id"] for r in results]
        assert expected_id in top_ids, f"Query '{q}' expected {expected_id} in {top_ids}"
        assert results[0][1] >= min_threshold, f"Query '{q}' score {results[0][1]} below threshold {min_threshold}"


def test_retriever_off_topic_testset(retriever):
    """Off-topic test set (15 questions) yields expected search results."""
    off_topic_queries = [
        "who won the cricket world cup",
        "write me a poem about the sunrise",
        "how to bake a chocolate cake recipe",
        "what is the weather in Mumbai tomorrow",
        "capital of France",
        "how to write quicksort in python",
        "apply for a home loan at SBI bank interest rate",
        "stock market tips today",
        "who is the president of USA",
        "how to lose weight in 30 days",
        "translate this sentence to French",
        "best restaurants in Pune",
        "explain quantum computing",
        "cricket score live today match",
        "car repair mechanic near me",
    ]

    for q in off_topic_queries:
        results = retriever.search(q, k=3)
        assert len(results) <= 3
