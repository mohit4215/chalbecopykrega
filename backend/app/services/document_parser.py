import io
import re
from typing import Tuple, Dict, Any
from pypdf import PdfReader
from docx import Document

class DocumentParser:
    """
    Handles file ingestion and text extraction for PDF, DOCX, and TXT files.
    Preserves text integrity, handles multi-page extraction, and cleans non-printable characters.
    """

    @staticmethod
    def clean_text(raw_text: str) -> str:
        """
        Standardize line endings, normalize non-standard whitespace,
        and remove non-printable control characters while preserving paragraph breaks.
        """
        # Replace Windows / Mac line endings with standard UNIX \n
        text = raw_text.replace("\r\n", "\n").replace("\r", "\n")
        # Replace non-breaking spaces and zero-width spaces
        text = text.replace("\xa0", " ").replace("\u200b", "")
        # Remove null characters and unusual control codes (keep \n, \t)
        text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
        # Collapse excessive 3+ consecutive line breaks into standard double break
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    @classmethod
    def parse_pdf(cls, file_bytes: bytes) -> Tuple[str, Dict[str, Any]]:
        """Extract text from PDF byte streams with page-by-page tracking."""
        stream = io.BytesIO(file_bytes)
        reader = PdfReader(stream)
        pages_text = []
        metadata = {}

        if reader.metadata:
            metadata = {
                "title": reader.metadata.get("/Title", ""),
                "author": reader.metadata.get("/Author", ""),
                "creator": reader.metadata.get("/Creator", ""),
            }

        for idx, page in enumerate(reader.pages):
            page_text = page.extract_text() or ""
            pages_text.append(page_text)

        full_text = "\n\n".join(pages_text)
        cleaned = cls.clean_text(full_text)
        metadata["page_count"] = len(reader.pages)
        return cleaned, metadata

    @classmethod
    def parse_docx(cls, file_bytes: bytes) -> Tuple[str, Dict[str, Any]]:
        """Extract text from DOCX documents preserving paragraph and table content."""
        stream = io.BytesIO(file_bytes)
        doc = Document(stream)
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        
        # Also extract table text if present
        for table in doc.tables:
            for row in table.rows:
                row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                if row_text:
                    paragraphs.append(row_text)

        full_text = "\n\n".join(paragraphs)
        metadata = {
            "paragraph_count": len(doc.paragraphs),
            "table_count": len(doc.tables)
        }
        return cls.clean_text(full_text), metadata

    @classmethod
    def parse_txt(cls, file_bytes: bytes) -> Tuple[str, Dict[str, Any]]:
        """Extract plain text from UTF-8 / Latin-1 byte streams."""
        try:
            raw_text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            raw_text = file_bytes.decode("latin-1", errors="replace")
        
        return cls.clean_text(raw_text), {"encoding": "utf-8/latin-1"}

    @classmethod
    def extract_text(cls, file_bytes: bytes, filename: str) -> Tuple[str, Dict[str, Any]]:
        """
        Routes extraction based on file extension.
        Returns: (extracted_text, metadata_dict)
        """
        filename_lower = filename.lower()
        if filename_lower.endswith(".pdf"):
            return cls.parse_pdf(file_bytes)
        elif filename_lower.endswith(".docx"):
            return cls.parse_docx(file_bytes)
        elif filename_lower.endswith((".txt", ".md", ".rtf", ".csv")):
            return cls.parse_txt(file_bytes)
        else:
            # Fallback to UTF-8 text decode
            return cls.parse_txt(file_bytes)
