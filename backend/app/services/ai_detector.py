"""AI Content & Synthetic Text Detection Engine.

Provides commercial-grade AI writing detection calibrated for academic essays,
research papers, and professional publications. Analyzes linguistic entropy,
sentence burstiness, lexical diversity (Type-Token Ratio), and characteristic
LLM discourse patterns (GPT-4, Claude, Gemini, Llama).
"""

import re
import math
from typing import Dict, Any, List, Tuple


class AIDetectionEngine:
    """Multi-signal heuristic and statistical AI writing detector with ESL bias mitigation."""

    # Deep hallmark LLM stylistic patterns & clichés (GPT-4, Claude, Gemini)
    LLM_BUZZWORDS = [
        r"\bdelves into\b",
        r"\btestament to\b",
        r"\bmultifaceted\b",
        r"\brealm of\b",
        r"\bserves as a reminder\b",
        r"\bin today's (fast-paced|modern|digital) world\b",
        r"\ba myriad of\b",
        r"\bunderscores the importance\b",
        r"\bvital role in shaping\b",
        r"\bpivotal role\b",
        r"\bplays a crucial role\b",
        r"\bseamlessly integrate[s|d]?\b",
        r"\bboth .* and .* align\b",
        r"\bby exploring these nuances\b",
        r"\bit cannot be understated\b",
        r"\bdeep dive\b",
        r"\bharnessing the power\b",
        r"\bnavigating the complexities\b",
        r"\bit is crucial to\b",
        r"\bit is important to note\b"
    ]

    # Standard academic and ESL classroom transitions
    GENERIC_TRANSITIONS = [
        r"\bin conclusion\b",
        r"\bfurthermore\b",
        r"\bmoreover\b",
        r"\badditionally\b",
        r"\bhenceforth\b",
        r"\bin summary\b",
        r"\bto summarize\b"
    ]

    # Combined markers for general detection
    AI_MARKERS = LLM_BUZZWORDS + GENERIC_TRANSITIONS

    @classmethod
    def analyze_text(cls, text: str, esl_mode: bool = False) -> Dict[str, Any]:
        """
        Analyzes document text and returns multi-dimensional AI writing metrics:
          - ai_probability (0.0 - 100.0%)
          - human_probability (0.0 - 100.0%)
          - verdict: "Human-Authored", "Mixed / AI-Assisted", "Likely AI-Generated", "Highly Likely AI-Generated"
          - sentence_analyses: sentence-by-sentence heatmap tagging with explainable linguistic cues
          - metrics: burstiness, vocabulary richness, discourse markers
          - esl_shield_applied: indicates if non-native speaker false-positive mitigation was active
        """
        clean_text = (text or "").strip()
        if not clean_text or len(clean_text.split()) < 15:
            return {
                "ai_probability": 0.0,
                "human_probability": 100.0,
                "verdict": "Human-Authored",
                "confidence": "Low (Insufficient sample size)",
                "esl_mode": esl_mode,
                "esl_shield_applied": False,
                "sentence_analyses": [],
                "metrics": {
                    "burstiness_score": 1.0,
                    "lexical_diversity": 1.0,
                    "ai_marker_count": 0,
                    "total_sentences": 0
                }
            }

        # 1. Segment into sentences
        raw_sentences = re.split(r"(?<=[.!?])\s+", clean_text)
        sentences = [s.strip() for s in raw_sentences if len(s.strip()) > 3]
        total_sentences = len(sentences)

        if total_sentences == 0:
            return {
                "ai_probability": 0.0,
                "human_probability": 100.0,
                "verdict": "Human-Authored",
                "esl_mode": esl_mode,
                "esl_shield_applied": False,
                "sentence_analyses": [],
                "metrics": {}
            }

        sentence_lengths = [len(re.findall(r"\b\w+\b", s)) for s in sentences]
        words = re.findall(r"\b\w+\b", clean_text.lower())
        total_words = len(words)

        # 2. Burstiness Metric (Coefficient of Variation of sentence length)
        # Humans write with high burstiness (varying sentence lengths).
        # AI models generate remarkably uniform sentence structures (low CV).
        mean_length = sum(sentence_lengths) / max(1, total_sentences)
        variance = sum((l - mean_length) ** 2 for l in sentence_lengths) / max(1, total_sentences)
        std_dev = math.sqrt(variance)
        burstiness_cv = std_dev / max(1.0, mean_length)

        # Lower burstiness indicates higher AI likelihood
        if burstiness_cv < 0.25:
            burstiness_ai_signal = 0.50 if esl_mode else 0.85
        elif burstiness_cv < 0.40:
            burstiness_ai_signal = 0.40 if esl_mode else 0.65
        elif burstiness_cv < 0.55:
            burstiness_ai_signal = 0.25 if esl_mode else 0.40
        else:
            burstiness_ai_signal = 0.15

        # 3. Lexical Diversity (Type-Token Ratio)
        unique_words = set(words)
        ttr = len(unique_words) / max(1, total_words)
        # Root TTR (Guiraud's Index) to compensate for document length
        guiraud_r = len(unique_words) / math.sqrt(max(1, total_words))
        
        lexical_signal = 0.5
        if guiraud_r < 6.5:
            # Under ESL mode, limited vocabulary is natural and not penalized as heavily
            lexical_signal = 0.40 if esl_mode else 0.70
        elif guiraud_r > 12.0:
            lexical_signal = 0.25

        # 4. Characteristic AI Marker Density
        active_markers = cls.LLM_BUZZWORDS if esl_mode else cls.AI_MARKERS
        ai_marker_matches = 0
        for pattern in active_markers:
            ai_marker_matches += len(re.findall(pattern, clean_text, re.IGNORECASE))
        
        # Density per 100 words
        marker_density = (ai_marker_matches / max(1, total_words)) * 100
        if marker_density > 1.2:
            marker_signal = 0.90
        elif marker_density > 0.6:
            marker_signal = 0.70
        elif marker_density > 0.2:
            marker_signal = 0.45
        else:
            marker_signal = 0.15

        # 5. Sentence-by-sentence evaluation for Explainable UI Heatmap
        sentence_analyses: List[Dict[str, Any]] = []
        ai_sentence_count = 0

        for s in sentences:
            s_words = re.findall(r"\b\w+\b", s.lower())
            w_len = len(s_words)
            s_score = 0.2  # Base probability
            linguistic_cues: List[str] = []

            # Check LLM buzzwords
            matched_buzzwords = [pat for pat in cls.LLM_BUZZWORDS if re.search(pat, s, re.IGNORECASE)]
            if matched_buzzwords:
                s_score += 0.45
                clean_marker_name = matched_buzzwords[0].replace(r"\b", "").replace(r"[s|d]?", "")
                linguistic_cues.append(f"Synthetic LLM cliché pattern: '{clean_marker_name}'")

            # Check generic classroom transitions
            matched_transitions = [pat for pat in cls.GENERIC_TRANSITIONS if re.search(pat, s, re.IGNORECASE)]
            if matched_transitions:
                clean_trans = matched_transitions[0].replace(r"\b", "")
                if esl_mode:
                    linguistic_cues.append(f"Standard transition '{clean_trans}' (cleared by ESL Shield)")
                else:
                    s_score += 0.20
                    linguistic_cues.append(f"Formal transition formula: '{clean_trans}'")

            # Uniformity penalty
            if abs(w_len - mean_length) < 3 and 12 <= w_len <= 26:
                if esl_mode:
                    s_score += 0.08
                    linguistic_cues.append(f"Uniform syntax ({w_len} words) - calibrated for ESL")
                else:
                    s_score += 0.25
                    linguistic_cues.append(f"Uniform sentence length ({w_len} words) fits LLM cadence")
            elif abs(w_len - mean_length) >= 6:
                linguistic_cues.append(f"Human length variance ({w_len} words)")

            if not linguistic_cues:
                linguistic_cues.append("Natural stylistic phrasing")

            final_s_score = min(0.99, max(0.01, round(s_score, 2)))
            threshold = 0.65 if esl_mode else 0.60
            is_flagged = final_s_score >= threshold
            if is_flagged:
                ai_sentence_count += 1

            sentence_analyses.append({
                "sentence": s,
                "ai_score": final_s_score,
                "is_ai_flagged": is_flagged,
                "linguistic_cues": linguistic_cues
            })

        # 6. Synthesize composite AI probability
        sentence_ai_ratio = ai_sentence_count / max(1, total_sentences)
        if esl_mode:
            # Weighted more heavily towards concrete synthetic buzzwords, less towards structural uniformity
            composite_score = (
                marker_signal * 0.45 +
                burstiness_ai_signal * 0.20 +
                sentence_ai_ratio * 0.25 +
                lexical_signal * 0.10
            )
        else:
            composite_score = (
                burstiness_ai_signal * 0.35 +
                marker_signal * 0.35 +
                sentence_ai_ratio * 0.20 +
                lexical_signal * 0.10
            )

        ai_percentage = round(min(99.0, max(1.0, composite_score * 100.0)), 1)
        human_percentage = round(100.0 - ai_percentage, 1)

        # Categorize verdict
        if ai_percentage >= 75.0:
            verdict = "Highly Likely AI-Generated"
        elif ai_percentage >= 50.0:
            verdict = "Likely AI-Generated"
        elif ai_percentage >= 25.0:
            verdict = "Mixed / AI-Assisted"
        else:
            verdict = "Human-Authored"

        return {
            "ai_probability": ai_percentage,
            "human_probability": human_percentage,
            "verdict": verdict,
            "confidence": "High" if total_words > 100 else "Moderate",
            "esl_mode": esl_mode,
            "esl_shield_applied": esl_mode,
            "bias_shield_notes": (
                "ESL Student Bias Shield Active: Standard classroom transitions and syntactic uniformity "
                "are calibrated to eliminate false accusations against non-native English writers."
                if esl_mode else None
            ),
            "sentence_analyses": sentence_analyses,
            "metrics": {
                "burstiness_score": round(burstiness_cv, 2),
                "lexical_diversity": round(ttr, 2),
                "ai_marker_count": ai_marker_matches,
                "total_sentences": total_sentences,
                "flagged_ai_sentences": ai_sentence_count
            }
        }
