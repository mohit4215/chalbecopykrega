import re
from typing import List, Tuple

class TextUtils:
    """
    NLP utilities for citation detection, quotation filtering,
    and bibliography identification.
    """

    @staticmethod
    def extract_quotation_spans(text: str) -> List[Tuple[int, int]]:
        """
        Detects quoted text inside standard or curly quotes.
        Matches can be optionally ignored or highlighted differently.
        """
        quote_patterns = [
            r'"([^"\n]{10,})"',       # Standard double quotes
            r'“([^”\n]{10,})”',       # Smart / curly double quotes
            r'«([^»\n]{10,})»'        # Guillemets
        ]
        spans = []
        for pattern in quote_patterns:
            for match in re.finditer(pattern, text):
                spans.append((match.start(), match.end()))
        return spans

    @staticmethod
    def find_bibliography_offset(text: str) -> int:
        """
        Detects where the 'References' or 'Bibliography' section starts
        to allow optional exclusion from plagiarism scans.
        """
        bib_pattern = r"(?im)^\s*(references|bibliography|works\s+cited)\s*$"
        match = re.search(bib_pattern, text)
        if match:
            return match.start()
        return len(text)

    @staticmethod
    def count_words(text: str) -> int:
        """Returns word count using whitespace and punctuation boundary detection."""
        return len(re.findall(r"\b\w+\b", text))
