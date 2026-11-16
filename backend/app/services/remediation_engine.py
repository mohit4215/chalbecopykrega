"""Interactive Student Remediation Engine & Pedagogical Rewriting Sandbox.

Transforms plagiarism detection from a punitive punishment into an educational
learning tool. Evaluates students' rewritten revisions in real-time, calculates
instant similarity score reduction, and provides academic synthesis guidance.
"""

import re
from typing import Dict, Any, List, Set


class RemediationEngine:
    """Evaluates student sentence revisions against matched reference sources."""

    @staticmethod
    def _tokenize_words(text: str) -> List[str]:
        return re.findall(r"\b[a-zA-Z0-9_']+\b", (text or "").lower())

    @classmethod
    def _extract_kgrams(cls, words: List[str], k: int = 4) -> Set[str]:
        if len(words) < k:
            return set([" ".join(words)]) if words else set()
        return set(" ".join(words[i:i + k]) for i in range(len(words) - k + 1))

    @classmethod
    def evaluate_revision(
        cls,
        original_text: str,
        revised_text: str,
        source_text: str,
        k: int = 4
    ) -> Dict[str, Any]:
        """
        Compares revised text against the original flagged text and the source text.
        Returns:
          - initial_similarity: float
          - revised_similarity: float
          - similarity_reduction: float
          - remediation_success: bool
          - verdict: str
          - verbatim_kgrams: List[str] (consecutive verbatim matches remaining)
          - pedagogical_feedback: str
        """
        source_words = cls._tokenize_words(source_text)
        orig_words = cls._tokenize_words(original_text)
        revised_words = cls._tokenize_words(revised_text)

        source_kgrams = cls._extract_kgrams(source_words, k=k)
        orig_kgrams = cls._extract_kgrams(orig_words, k=k)
        revised_kgrams = cls._extract_kgrams(revised_words, k=k)

        # Baseline similarity
        if orig_kgrams and source_kgrams:
            shared_orig = orig_kgrams.intersection(source_kgrams)
            initial_sim = round(len(shared_orig) / max(1, len(orig_kgrams)) * 100.0, 1)
        else:
            initial_sim = 85.0  # Default assumption for a flagged match

        # Revised similarity against source
        if revised_kgrams and source_kgrams:
            shared_revised = revised_kgrams.intersection(source_kgrams)
            revised_sim = round(len(shared_revised) / max(1, len(revised_kgrams)) * 100.0, 1)
            remaining_verbatim = list(shared_revised)
        else:
            revised_sim = 0.0
            remaining_verbatim = []

        reduction = round(max(0.0, initial_sim - revised_sim), 1)
        is_success = revised_sim <= 20.0
        is_partial = 20.0 < revised_sim <= 45.0

        if is_success:
            verdict = "Successfully Remediated"
            feedback = (
                f"Outstanding synthesis! You reduced source similarity from {initial_sim}% down to {revised_sim}%. "
                "Your revised text expresses the conceptual ideas in authentic, independent academic terminology."
            )
        elif is_partial:
            verdict = "Partial Remediation"
            feedback = (
                f"Good progress! Similarity dropped by {reduction}%, but some verbatim phrasing remains. "
                "Try restructuring the clauses and using active voice to further distinguish your analysis."
            )
        else:
            verdict = "Still Highly Similar"
            feedback = (
                f"Noticeable overlap remains ({revised_sim}%). Several multi-word phrases match the source directly. "
                "Consider either synthesizing the core takeaway or enclosing verbatim phrases in quotation marks."
            )

        return {
            "initial_similarity": initial_sim,
            "revised_similarity": revised_sim,
            "similarity_reduction": reduction,
            "remediation_success": is_success,
            "is_partial": is_partial,
            "verdict": verdict,
            "remaining_verbatim_phrases": remaining_verbatim[:5],
            "pedagogical_feedback": feedback,
            "word_count_revised": len(revised_words),
            "word_count_original": len(orig_words)
        }
