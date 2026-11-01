"""
retriever.py - Note loading and TF-IDF search for Help Chatbot RAG.

Uses character n-gram TF-IDF vectorization from scikit-learn.
Matches word pieces across English, Hindi, and Marathi keywords and bodies.
Note: TF-IDF matches word pieces and character n-grams, not semantic embeddings.
"""

import json
import logging
import os
from typing import Any, Dict, List, Optional, Tuple

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger("datadynamo")


class Retriever:
    """TF-IDF based note retriever for help chatbot context."""

    def __init__(self, notes_dir: Optional[str] = None):
        if notes_dir is None:
            notes_dir = os.path.join(os.path.dirname(__file__), "notes")
        self.notes_dir = notes_dir
        self.notes: List[Dict[str, Any]] = []
        self.notes_by_id: Dict[str, Dict[str, Any]] = {}
        self.vectorizer: Optional[TfidfVectorizer] = None
        self.tfidf_matrix = None
        self._load_and_fit()

    def _load_and_fit(self) -> None:
        """Load all JSON notes from notes_dir and fit TfidfVectorizer."""
        self.notes.clear()
        self.notes_by_id.clear()

        if not os.path.exists(self.notes_dir):
            logger.warning("Notes directory not found: %s", self.notes_dir)
            return

        corpus_texts: List[str] = []

        for fname in sorted(os.listdir(self.notes_dir)):
            if fname.endswith(".json"):
                fpath = os.path.join(self.notes_dir, fname)
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        note = json.load(f)
                        self.notes.append(note)
                        self.notes_by_id[note["id"]] = note

                        # Combine title, keywords in all languages, and body
                        kw_en = " ".join(note.get("keywords_en", []))
                        kw_hi = " ".join(note.get("keywords_hi", []))
                        kw_mr = " ".join(note.get("keywords_mr", []))
                        combined = (
                            f"{note.get('title', '')} "
                            f"{kw_en} {kw_hi} {kw_mr} "
                            f"{note.get('body', '')}"
                        )
                        corpus_texts.append(combined)
                except Exception as e:
                    logger.error("Error loading note %s: %s", fname, e)

        if corpus_texts:
            # Fit TF-IDF on char_wb n-grams (matches word pieces across scripts and languages)
            self.vectorizer = TfidfVectorizer(
                analyzer="char_wb",
                ngram_range=(2, 4),
                max_df=0.85,
                lowercase=True,
                sublinear_tf=True,
            )
            self.tfidf_matrix = self.vectorizer.fit_transform(corpus_texts)
            logger.info("Retriever loaded %d notes and fitted TF-IDF matrix.", len(self.notes))

    def search(self, query: str, k: int = 3) -> List[Tuple[Dict[str, Any], float]]:
        """Search notes by query string.

        Returns list of (note, score) tuples, best first.
        Score is cosine similarity in range [0.0, 1.0].
        """
        if not self.vectorizer or not self.notes or not query or not query.strip():
            return []

        query_vec = self.vectorizer.transform([query.strip()])
        sims = cosine_similarity(query_vec, self.tfidf_matrix)[0]

        ranked_indices = sims.argsort()[::-1]
        results: List[Tuple[Dict[str, Any], float]] = []

        for idx in ranked_indices[:k]:
            score = float(sims[idx])
            results.append((self.notes[idx], score))

        return results

    def get_note_by_id(self, note_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a specific note by ID."""
        return self.notes_by_id.get(note_id)


# Global singleton instance loaded at import/startup
retriever = Retriever()
