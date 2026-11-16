"""Automated Smart Citation Assistant (APA 7th, MLA 9th, Chicago 17th).

Converts detected similarity matches into legally compliant academic quotations
and bibliography references with 1 click. Empowers students to remediate
unintentional plagiarism before final submission.
"""

import re
from datetime import datetime
from typing import Dict, Any, Optional


class SmartCitationGenerator:
    """Generates standardized academic citations from detected source metadata."""

    @classmethod
    def parse_author_name(cls, raw_author: Optional[str]) -> Dict[str, str]:
        """Extracts family name and given initials from varied author formats."""
        if not raw_author or raw_author.strip() in ("Unknown", "Unknown Source", "Internet Source"):
            return {"last": "Anonymous", "first": "", "initials": "", "full": "Anonymous"}

        clean = re.sub(r'^(Dr\.|Prof\.|Professor|Mr\.|Ms\.|Mrs\.)\s+', '', raw_author.strip())
        clean = re.sub(r'\s*\(.*?\)', '', clean).strip()

        parts = clean.split()
        if len(parts) == 1:
            return {"last": parts[0], "first": "", "initials": "", "full": parts[0]}

        last = parts[-1]
        first = " ".join(parts[:-1])
        initials = "".join(f"{p[0]}." for p in parts[:-1] if p)
        return {"last": last, "first": first, "initials": initials, "full": f"{last}, {first}"}

    @classmethod
    def extract_year(cls, text: str) -> str:
        """Finds publication or submission year (4-digit) or falls back to current year."""
        match = re.search(r'\b(19\d{2}|20\d{2})\b', text)
        return match.group(1) if match else str(datetime.now().year)

    @classmethod
    def generate_all_citations(
        cls,
        matched_text: str,
        source_title: str = "Academic Reference Literature",
        source_author: Optional[str] = None,
        source_url: Optional[str] = None,
        institution: Optional[str] = "Institutional Repository"
    ) -> Dict[str, Any]:
        """
        Builds APA, MLA, and Chicago formatted citations plus ready-to-paste
        properly quoted remediation blocks.
        """
        author_info = cls.parse_author_name(source_author)
        year = cls.extract_year(f"{source_title} {source_author or ''} {institution or ''}")
        last_name = author_info["last"]
        clean_text = matched_text.strip().strip('"“”«»')

        # 1. APA 7th Edition
        # In-text: (Last, Year)
        # Reference: Last, F. M. (Year). Title. Publisher. URL
        apa_in_text = f"({last_name}, {year})"
        apa_quoted_span = f'"{clean_text}" {apa_in_text}'
        apa_bib = f"{last_name}, {author_info['initials']} ({year}). {source_title}."
        if institution:
            apa_bib += f" {institution}."
        if source_url and source_url.startswith("http"):
            apa_bib += f" {source_url}"

        # 2. MLA 9th Edition
        # In-text: (Last)
        # Works Cited: Last, First. "Title." Publisher, Year. URL.
        mla_in_text = f"({last_name})"
        mla_quoted_span = f'"{clean_text}" {mla_in_text}'
        mla_author_prefix = f"{last_name}, {author_info['first']}." if author_info['first'] else f"{last_name}."
        mla_bib = f'{mla_author_prefix} "{source_title}."'
        if institution:
            mla_bib += f" {institution},"
        mla_bib += f" {year}."
        if source_url and source_url.startswith("http"):
            mla_bib += f" {source_url}."

        # 3. Chicago 17th Edition (Notes & Bibliography)
        chicago_footnote = f'1. {author_info["first"]} {last_name}, "{source_title}" ({institution or "Publisher"}, {year}).'
        chicago_bib = f'{last_name}, {author_info["first"]}. "{source_title}." {institution or "Publisher"}, {year}.'

        return {
            "source_title": source_title,
            "source_author": source_author or "Anonymous",
            "year": year,
            "remediation_quote_apa": apa_quoted_span,
            "remediation_quote_mla": mla_quoted_span,
            "apa": {
                "in_text": apa_in_text,
                "quoted_text": apa_quoted_span,
                "bibliography": apa_bib
            },
            "mla": {
                "in_text": mla_in_text,
                "quoted_text": mla_quoted_span,
                "bibliography": mla_bib
            },
            "chicago": {
                "footnote": chicago_footnote,
                "bibliography": chicago_bib
            }
        }
