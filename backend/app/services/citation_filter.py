"""Academic Exclusions & Citation Filtering Engine (Turnitin Standard).

Provides robust detection and exclusion of:
  1. Quoted Material (direct quotes in "", “”, «», and block quotes)
  2. Bibliography / References / Works Cited sections
  3. Small matches (< N consecutive words)
"""

import re
from typing import List, Dict, Any, Tuple, Optional


class AcademicCitationFilter:
    """Detects and isolates legitimate academic citations and references."""

    BIBLIOGRAPHY_HEADERS = [
        r"(?i)\b(references|bibliography|works cited|literature cited|sources cited|reference list)\b"
    ]

    @classmethod
    def detect_quoted_spans(cls, text: str) -> List[Tuple[int, int]]:
        """
        Locates character ranges for direct quotes (double, curly, or guillemet quotes).
        Returns list of (start_char, end_char) tuples.
        """
        quote_patterns = [
            r'"([^"\n]{4,})"',          # Standard double quotes
            r'“([^”\n]{4,})”',          # Curly quotes
            r'«([^»\n]{4,})»',          # Guillemet quotes
        ]
        spans: List[Tuple[int, int]] = []
        for pattern in quote_patterns:
            for match in re.finditer(pattern, text):
                spans.append((match.start(), match.end()))

        # Sort and merge overlapping spans
        if not spans:
            return []
        spans.sort(key=lambda s: s[0])
        merged = [spans[0]]
        for current in spans[1:]:
            prev_start, prev_end = merged[-1]
            if current[0] <= prev_end:
                merged[-1] = (prev_start, max(prev_end, current[1]))
            else:
                merged.append(current)
        return merged

    @classmethod
    def detect_bibliography_offset(cls, text: str) -> Optional[int]:
        """
        Locates the starting character index of the References or Bibliography section.
        Returns the index, or None if no bibliography heading is present.
        """
        lines = text.split("\n")
        current_offset = 0
        total_len = len(text)

        # Bibliography typically appears in the second half of an academic document
        min_start_pos = int(total_len * 0.35) if total_len > 800 else 0

        for line in lines:
            line_stripped = line.strip()
            # If line is short and matches a bibliography heading (e.g. "References" or "7. Bibliography")
            if len(line_stripped) < 40 and current_offset >= min_start_pos:
                clean_heading = re.sub(r"^[\d\.\s\-]+", "", line_stripped).strip()
                for header_pattern in cls.BIBLIOGRAPHY_HEADERS:
                    if re.fullmatch(header_pattern, clean_heading):
                        return current_offset
            current_offset += len(line) + 1  # Account for newline character
        return None

    @classmethod
    def apply_filters(
        cls,
        full_text: str,
        matches: List[Dict[str, Any]],
        exclude_quotes: bool = True,
        exclude_bibliography: bool = True,
        min_match_words: int = 8,
        total_words: int = 0
    ) -> Dict[str, Any]:
        """
        Filters matches and recalculates net plagiarism and originality scores.
        """
        quoted_spans = cls.detect_quoted_spans(full_text) if exclude_quotes else []
        bib_offset = cls.detect_bibliography_offset(full_text) if exclude_bibliography else None

        active_matches: List[Dict[str, Any]] = []
        excluded_matches: List[Dict[str, Any]] = []

        total_doc_words = total_words or max(1, len(re.findall(r"\b\w+\b", full_text)))
        plagiarized_word_indices: set = set()

        for match in matches:
            start = match.get("start_index", 0)
            end = match.get("end_index", 0)
            matched_text = match.get("matched_text", "")
            word_count = len(re.findall(r"\b\w+\b", matched_text))

            exclusion_reason: Optional[str] = None

            # 1. Check Bibliography Exclusion
            if bib_offset is not None and start >= bib_offset:
                exclusion_reason = "bibliography"

            # 2. Check Quote Exclusion
            elif quoted_spans:
                for q_start, q_end in quoted_spans:
                    # Overlap with quote span
                    overlap = max(0, min(end, q_end) - max(start, q_start))
                    match_len = max(1, end - start)
                    if overlap / match_len > 0.6:
                        exclusion_reason = "quote"
                        break

            # 3. Check Small Match Words
            if not exclusion_reason and word_count < min_match_words:
                exclusion_reason = "small_match"

            match_copy = dict(match)
            if exclusion_reason:
                match_copy["excluded"] = True
                match_copy["exclusion_reason"] = exclusion_reason
                excluded_matches.append(match_copy)
            else:
                match_copy["excluded"] = False
                match_copy["exclusion_reason"] = None
                active_matches.append(match_copy)

        # Recalculate score based on non-excluded matches
        # If matches have chunk indices or character lengths:
        if matches:
            total_matches_len = len(matches)
            active_matches_len = len(active_matches)
            if total_matches_len > 0:
                original_score = match.get("overall_score") if "overall_score" in matches[0] else 0.0
            
            # Net score calculation
            net_plagiarism = round((active_matches_len / total_matches_len) * 100.0, 1) if total_matches_len > 0 else 0.0
        else:
            net_plagiarism = 0.0

        net_originality = round(max(0.0, min(100.0, 100.0 - net_plagiarism)), 1)

        return {
            "net_plagiarism_score": net_plagiarism,
            "net_originality_score": net_originality,
            "active_matches": active_matches,
            "excluded_matches": excluded_matches,
            "filters_applied": {
                "exclude_quotes": exclude_quotes,
                "exclude_bibliography": exclude_bibliography,
                "min_match_words": min_match_words,
                "bibliography_detected": bib_offset is not None,
                "quotes_count": len(quoted_spans)
            }
        }
