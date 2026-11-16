"""Interactive Student Remediation Engine (Enterprise Pedagogical Edition).

Transforms plagiarism detection from a punitive punishment into an educational
learning tool. Evaluates students' rewritten revisions in real-time, calculates
instant similarity score reduction, detects academic patchwriting (thesaurus swapping),
and provides Socratic synthesis guidance.
"""

import re
from typing import Dict, Any, List, Set, Tuple


class RemediationEngine:
    """Evaluates student sentence revisions against matched reference sources."""

    FUNCTION_WORDS: Set[str] = {
        "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of",
        "with", "by", "from", "up", "about", "into", "over", "after", "is", "are",
        "was", "were", "be", "been", "being", "have", "has", "had", "do", "does",
        "did", "that", "which", "who", "whom", "this", "these", "those", "it",
        "its", "as", "if", "when", "than", "because", "while", "where", "although"
    }

    @staticmethod
    def _tokenize_words(text: str) -> List[str]:
        return re.findall(r"\b[a-zA-Z0-9_']+\b", (text or "").lower())

    @classmethod
    def _extract_kgrams(cls, words: List[str], k: int = 4) -> Set[str]:
        if len(words) < k:
            return set([" ".join(words)]) if words else set()
        return set(" ".join(words[i:i + k]) for i in range(len(words) - k + 1))

    @classmethod
    def _detect_patchwriting(
        cls,
        source_words: List[str],
        revised_words: List[str],
        kgram_similarity: float
    ) -> Tuple[bool, str]:
        """
        Detects 'Patchwriting' (Thesaurus Substitution):
        When a student retains the exact syntactic frame (sentence length, clause flow,
        functional prepositions/conjunctions) while swapping content nouns/verbs.
        """
        if not source_words or not revised_words or len(revised_words) < 6:
            return False, ""

        # Length ratio
        length_ratio = len(revised_words) / max(1, len(source_words))
        if not (0.75 <= length_ratio <= 1.35):
            return False, ""

        # Syntactic backbone similarity based on function word sequence
        source_func = [w for w in source_words if w in cls.FUNCTION_WORDS]
        revised_func = [w for w in revised_words if w in cls.FUNCTION_WORDS]

        if len(source_func) >= 4 and len(revised_func) >= 4:
            src_func_set = cls._extract_kgrams(source_func, k=3)
            rev_func_set = cls._extract_kgrams(revised_func, k=3)
            if src_func_set and rev_func_set:
                func_overlap = len(src_func_set.intersection(rev_func_set)) / max(1, len(rev_func_set))
                # High syntactic skeleton match (> 50%) but low word k-gram similarity (< 35%)
                if func_overlap >= 0.50 and kgram_similarity < 35.0:
                    return (
                        True,
                        "Patchwriting Detected: Although vocabulary words were replaced, the underlying "
                        "grammatical sentence structure and clause sequence replicate the reference source. "
                        "Try synthesizing the main conclusion from memory rather than sentence-by-sentence."
                    )

        return False, ""

    @classmethod
    def _generate_token_diff(
        cls,
        revised_text: str,
        source_text: str
    ) -> List[Dict[str, Any]]:
        """
        Produces granular word tokens tagged as 'verbatim' (matching source),
        'quoted' (legitimate academic quote in quotation marks), or 'independent'.
        """
        tokens: List[Dict[str, Any]] = []
        source_lower = source_text.lower()

        # Check for quoted spans
        quoted_spans = [m.span() for m in re.finditer(r'("[^"]+"|[“][^”]+[”])', revised_text)]

        for m in re.finditer(r'\S+', revised_text):
            word = m.group(0)
            clean_word = re.sub(r'^[^\w]+|[^\w]+$', '', word).lower()
            start, end = m.span()

            is_inside_quote = any(qs <= start and end <= qe for qs, qe in quoted_spans)

            if is_inside_quote:
                tag = "quoted"
            elif len(clean_word) >= 3 and clean_word in source_lower:
                tag = "verbatim"
            else:
                tag = "independent"

            tokens.append({
                "word": word,
                "tag": tag
            })

        return tokens

    @classmethod
    def evaluate_revision(
        cls,
        original_text: str,
        revised_text: str,
        source_text: str,
        k: int = 4
    ) -> Dict[str, Any]:
        """
        Compares revised text against the original flagged text and source text.
        Returns:
          - initial_similarity: float
          - revised_similarity: float
          - similarity_reduction: float
          - remediation_success: bool
          - is_partial: bool
          - is_patchwriting: bool
          - patchwriting_warning: str
          - verdict: str
          - remaining_verbatim_phrases: List[str]
          - pedagogical_feedback: str
          - token_diff: List[Dict[str, Any]]
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
            initial_sim = 85.0

        # Revised similarity against source
        if revised_kgrams and source_kgrams:
            shared_revised = revised_kgrams.intersection(source_kgrams)
            revised_sim = round(len(shared_revised) / max(1, len(revised_kgrams)) * 100.0, 1)
            remaining_verbatim = list(shared_revised)
        else:
            revised_sim = 0.0
            remaining_verbatim = []

        reduction = round(max(0.0, initial_sim - revised_sim), 1)

        # Check patchwriting
        is_patchwriting, patchwriting_warning = cls._detect_patchwriting(
            source_words=source_words,
            revised_words=revised_words,
            kgram_similarity=revised_sim
        )

        is_success = revised_sim <= 20.0 and not is_patchwriting
        is_partial = (20.0 < revised_sim <= 45.0) or (revised_sim <= 20.0 and is_patchwriting)

        if is_success:
            verdict = "Successfully Remediated"
            feedback = (
                f"Outstanding synthesis! You reduced source similarity from {initial_sim}% down to {revised_sim}%. "
                "Your revised text expresses the conceptual ideas in authentic, independent academic terminology."
            )
        elif is_patchwriting:
            verdict = "Patchwriting Detected"
            feedback = patchwriting_warning
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

        token_diff = cls._generate_token_diff(revised_text, source_text)

        return {
            "initial_similarity": initial_sim,
            "revised_similarity": revised_sim,
            "similarity_reduction": reduction,
            "remediation_success": is_success,
            "is_partial": is_partial,
            "is_patchwriting": is_patchwriting,
            "patchwriting_warning": patchwriting_warning,
            "verdict": verdict,
            "remaining_verbatim_phrases": remaining_verbatim[:5],
            "pedagogical_feedback": feedback,
            "word_count_revised": len(revised_words),
            "token_diff": token_diff
        }
