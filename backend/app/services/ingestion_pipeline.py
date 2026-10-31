"""
Enterprise Document Ingestion & Text Preprocessing Pipeline
============================================================
Designed for Academic & Industrial Plagiarism Detection Systems.

Supported Formats:
  - Standard Digital PDFs (via PyMuPDF / fitz, with PyPDF fallback)
  - Scanned PDFs (automatic OCR fallback via pdf2image + pytesseract)
  - Microsoft Word (.docx via python-docx)
  - Plain Text (.txt, .md, .rtf with multi-encoding detection)

Features:
  - Header / Footer / Page number detection & removal
  - Unicode character normalization (NFKC)
  - Overlapping sliding-window chunking preserving character spans for NLP vectorization
  - Robust exception hierarchy & logging
"""

import os
import re
import time
import logging
import unicodedata
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Union

# Configure structured logging
logger = logging.getLogger("plagiarism.ingestion")
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter("[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)


# ==============================================================================
# Custom Exception Hierarchy
# ==============================================================================

class IngestionPipelineError(Exception):
    """Base exception for all document ingestion and extraction failures."""
    pass

class UnsupportedFormatError(IngestionPipelineError):
    """Raised when an uploaded document has an unsupported file extension."""
    pass

class CorruptedFileError(IngestionPipelineError):
    """Raised when a file cannot be parsed due to truncation or corruption."""
    pass

class OCRDependencyError(IngestionPipelineError):
    """Raised when OCR fallback is required but Tesseract or Poppler is missing."""
    pass

class EmptyDocumentError(IngestionPipelineError):
    """Raised when a document contains zero extractable text after all fallbacks."""
    pass


# ==============================================================================
# Data Models / Schemas
# ==============================================================================

@dataclass
class TextChunk:
    """Represents a sequential sliding-window token chunk ready for NLP embeddings."""
    chunk_index: int
    text: str
    start_char: int
    end_char: int
    word_count: int

@dataclass
class DocumentMetadata:
    """Metadata tracking file properties and ingestion diagnostics."""
    file_name: str
    file_path: str
    file_extension: str
    file_size_bytes: int
    page_count: int
    is_scanned: bool
    ocr_applied: bool
    total_characters_raw: int
    total_characters_cleaned: int
    total_words: int
    processing_time_ms: float
    extra_attributes: Dict[str, Union[str, int, float]] = field(default_factory=dict)

@dataclass
class ExtractionResult:
    """Complete output payload returned by the ingestion pipeline."""
    raw_text: str
    cleaned_text: str
    chunks: List[TextChunk]
    metadata: DocumentMetadata


# ==============================================================================
# Text Cleaning & Normalization Engine
# ==============================================================================

class TextNormalizer:
    """
    Production text sanitizer that strips noise, standardizes Unicode,
    removes running headers/footers, and produces clean lowercase NLP text.
    """

    # Common running headers/footers, pagination markers, and page rules
    PAGINATION_PATTERNS = [
        re.compile(r"(?im)^\s*page\s+\d+\s+(?:of|\/)\s+\d+\s*$"),        # "Page 1 of 15"
        re.compile(r"(?im)^\s*(?:[-—–_]{2,}\s*)?\d+\s*(?:[-—–_]{2,}\s*)?$"), # "- 12 -" or "12"
        re.compile(r"(?im)^\s*(?:confidential|draft|all rights reserved)\s*$", re.IGNORECASE),
    ]

    # Smart quotes, apostrophes, and unusual dashes mapping
    CHAR_REPLACEMENTS = {
        "\u2018": "'", "\u2019": "'", "\u201a": "'", "\u201b": "'",
        "\u201c": '"', "\u201d": '"', "\u201e": '"', "\u201f": '"',
        "\u2013": "-", "\u2014": "-", "\u2015": "-", "\u2212": "-",
        "\u00a0": " ", "\u200b": "", "\ufeff": "",   # non-breaking & zero-width spaces
    }

    @classmethod
    def clean(cls, text: str, lowercase: bool = True, remove_headers: bool = True) -> str:
        """
        Executes full normalization sequence:
          1. Unicode NFKC normalization
          2. Character substitution (smart quotes, dashes)
          3. Header / footer / pagination removal
          4. Control character removal (preserving \n and \t)
          5. Whitespace collapsing
          6. Optional lowercasing
        """
        if not text:
            return ""

        # Step 1: Normalize Unicode representation (NFKC canonical decomposition & composition)
        text = unicodedata.normalize("NFKC", text)

        # Step 2: Standardize special punctuation
        for orig, replacement in cls.CHAR_REPLACEMENTS.items():
            text = text.replace(orig, replacement)

        # Step 3: Strip non-printable / unusual ASCII control codes
        # Keeps newline (\x0a), tab (\x09), and standard printable chars
        text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)

        # Step 4: Line-by-line header/footer filtering
        if remove_headers:
            lines = text.split("\n")
            filtered_lines = []
            for line in lines:
                trimmed = line.strip()
                # Skip if line matches pagination or running disclaimer pattern
                if any(pat.match(trimmed) for pat in cls.PAGINATION_PATTERNS):
                    continue
                filtered_lines.append(line)
            text = "\n".join(filtered_lines)

        # Step 5: Normalize consecutive whitespaces and excessive linebreaks
        text = re.sub(r"[ \t]+", " ", text)            # Multiple horizontal spaces -> single space
        text = re.sub(r"\n\s*\n\s*\n+", "\n\n", text)  # 3+ empty lines -> double newline
        text = text.strip()

        # Step 6: Lowercase for uniform downstream N-gram hashing and vocabulary lookup
        if lowercase:
            text = text.lower()

        return text


# ==============================================================================
# Sliding-Window NLP Chunker
# ==============================================================================

class SlidingWindowChunker:
    """
    Partitions normalized text into sequential overlapping windows.
    Tracks exact character offsets (start_char, end_char) to allow highlighters
    to trace matches back to original positions.
    """

    def __init__(self, window_size: int = 50, overlap: int = 20):
        if overlap >= window_size:
            raise ValueError(f"Overlap ({overlap}) must be strictly less than window_size ({window_size})")
        self.window_size = window_size
        self.overlap = overlap
        self.step_size = window_size - overlap

    def chunk(self, text: str) -> List[TextChunk]:
        """
        Generates overlapping word-level chunks from text.
        """
        if not text:
            return []

        # Find word boundaries and their absolute start/end offsets in the text
        word_spans = [(m.start(), m.end()) for m in re.finditer(r"\S+", text)]
        total_words = len(word_spans)

        if total_words == 0:
            return []

        chunks: List[TextChunk] = []
        chunk_idx = 0

        for i in range(0, total_words, self.step_size):
            window_spans = word_spans[i : i + self.window_size]
            if not window_spans:
                continue

            start_char = window_spans[0][0]
            end_char = window_spans[-1][1]
            chunk_slice = text[start_char:end_char]

            chunks.append(TextChunk(
                chunk_index=chunk_idx,
                text=chunk_slice,
                start_char=start_char,
                end_char=end_char,
                word_count=len(window_spans)
            ))
            chunk_idx += 1

            # Stop when the window reaches the end of the text
            if i + self.window_size >= total_words:
                break

        return chunks


# ==============================================================================
# Main Ingestion & Extraction Engine
# ==============================================================================

class DocumentExtractionPipeline:
    """
    Robust Multi-Format Document Ingestion Engine.
    Handles digital extraction, automatic OCR fallback, normalization, and chunking.
    """

    # Minimum average characters per page to consider a PDF digitally text-accessible
    MIN_DIGITAL_TEXT_THRESHOLD_PER_PAGE = 25

    def __init__(
        self,
        chunk_size: int = 50,
        chunk_overlap: int = 20,
        ocr_languages: str = "eng",
        enable_ocr: bool = True
    ):
        self.chunker = SlidingWindowChunker(window_size=chunk_size, overlap=chunk_overlap)
        self.ocr_languages = ocr_languages
        self.enable_ocr = enable_ocr

    # --------------------------------------------------------------------------
    # Format Extractors
    # --------------------------------------------------------------------------

    def _extract_txt(self, file_path: Path) -> Tuple[str, int]:
        """Reads plain text files using multi-encoding fallback."""
        encodings = ["utf-8", "utf-8-sig", "latin-1", "cp1252", "iso-8859-1"]
        for enc in encodings:
            try:
                with open(file_path, "r", encoding=enc) as f:
                    content = f.read()
                logger.debug(f"Successfully decoded {file_path.name} with encoding: {enc}")
                return content, 1
            except UnicodeDecodeError:
                continue
            except Exception as e:
                raise CorruptedFileError(f"Error reading text file '{file_path}': {e}") from e

        raise CorruptedFileError(f"Failed to decode text file '{file_path}' across standard encodings.")

    def _extract_docx(self, file_path: Path) -> Tuple[str, int]:
        """Extracts text, paragraphs, and tables from Word (.docx) files."""
        try:
            from docx import Document
        except ImportError:
            raise IngestionPipelineError(
                "Missing library 'python-docx'. Please install via: pip install python-docx"
            )

        try:
            doc = Document(str(file_path))
            elements: List[str] = []

            # 1. Extract regular body paragraphs
            for p in doc.paragraphs:
                p_text = p.text.strip()
                if p_text:
                    elements.append(p_text)

            # 2. Extract tabular content (vital for reports and research papers)
            for table in doc.tables:
                for row in table.rows:
                    row_cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                    if row_cells:
                        elements.append(" | ".join(row_cells))

            # Approximation of page count based on typical word density (250 words/page)
            full_text = "\n\n".join(elements)
            word_count = len(full_text.split())
            estimated_pages = max(1, (word_count + 249) // 250)

            return full_text, estimated_pages

        except Exception as e:
            raise CorruptedFileError(f"Corrupted or invalid Word (.docx) file '{file_path}': {e}") from e

    def _extract_pdf_digital(self, file_path: Path) -> Tuple[str, int]:
        """
        Extracts digital text from PDF.
        Attempts PyMuPDF (fitz) first for speed and layout fidelity; falls back to pypdf.
        """
        # Try PyMuPDF (fitz)
        try:
            import fitz
            doc = fitz.open(str(file_path))
            pages_text = []
            page_count = len(doc)

            for page_num in range(page_count):
                page = doc.load_page(page_num)
                # "text" extraction preserves paragraph blocks
                page_text = page.get_text("text") or ""
                pages_text.append(page_text.strip())

            doc.close()
            return "\n\n".join(pages_text), page_count
        except ImportError:
            logger.debug("PyMuPDF (fitz) not found; falling back to pypdf.")
        except Exception as e:
            logger.warning(f"PyMuPDF failed on {file_path.name}: {e}. Retrying with pypdf fallback.")

        # Fallback to pypdf
        try:
            from pypdf import PdfReader
            reader = PdfReader(str(file_path))
            page_count = len(reader.pages)
            pages_text = []

            for page in reader.pages:
                extracted = page.extract_text() or ""
                pages_text.append(extracted.strip())

            return "\n\n".join(pages_text), page_count
        except Exception as e:
            raise CorruptedFileError(f"Corrupted or unreadable PDF file '{file_path}': {e}") from e

    def _extract_pdf_ocr(self, file_path: Path) -> Tuple[str, int]:
        """
        OCR Fallback Engine:
        Converts PDF pages to images using pdf2image and performs OCR using pytesseract.
        """
        logger.info(f"Triggering OCR Fallback for scanned PDF: {file_path.name}")

        try:
            from pdf2image import convert_from_path
        except ImportError:
            raise OCRDependencyError(
                "pdf2image is required for OCR on scanned PDFs. Install via: pip install pdf2image"
            )

        try:
            import pytesseract
        except ImportError:
            raise OCRDependencyError(
                "pytesseract is required for OCR. Install via: pip install pytesseract"
            )

        try:
            # Convert PDF pages into PIL Images (300 DPI for high OCR accuracy)
            images = convert_from_path(str(file_path), dpi=300)
            page_count = len(images)
            ocr_text_pages = []

            for page_idx, img in enumerate(images, start=1):
                logger.debug(f"Executing OCR on page {page_idx}/{page_count} of {file_path.name}...")
                page_text = pytesseract.image_to_string(img, lang=self.ocr_languages)
                ocr_text_pages.append(page_text.strip())

            return "\n\n".join(ocr_text_pages), page_count

        except Exception as e:
            err_msg = str(e).lower()
            if "poppler" in err_msg:
                raise OCRDependencyError(
                    "Poppler utility is missing. Please install poppler-utils on Linux or install poppler on Windows."
                ) from e
            elif "tesseract" in err_msg:
                raise OCRDependencyError(
                    "Tesseract-OCR engine binary is not installed or not in system PATH."
                ) from e
            raise IngestionPipelineError(f"OCR processing failed for '{file_path}': {e}") from e

    def _extract_pdf(self, file_path: Path) -> Tuple[str, int, bool, bool]:
        """
        Coordinates standard PDF digital extraction with automatic OCR fallback.
        Returns: (extracted_text, page_count, is_scanned, ocr_applied)
        """
        raw_text, page_count = self._extract_pdf_digital(file_path)

        # Check if extracted text is negligible (indicating a scanned document)
        total_chars = len(re.sub(r"\s+", "", raw_text))
        avg_chars_per_page = total_chars / max(1, page_count)

        is_scanned = avg_chars_per_page < self.MIN_DIGITAL_TEXT_THRESHOLD_PER_PAGE

        if is_scanned:
            if not self.enable_ocr:
                logger.warning(f"PDF '{file_path.name}' appears scanned, but OCR is disabled.")
                return raw_text, page_count, True, False

            try:
                ocr_text, ocr_pages = self._extract_pdf_ocr(file_path)
                return ocr_text, ocr_pages, True, True
            except OCRDependencyError as ocr_err:
                logger.error(f"OCR Fallback unavailable: {ocr_err}")
                # Return whatever partial digital text was extracted with warning
                return raw_text, page_count, True, False

        return raw_text, page_count, False, False

    # --------------------------------------------------------------------------
    # Public Pipeline Ingestion Interface
    # --------------------------------------------------------------------------

    def ingest_document(self, file_path: Union[str, Path]) -> ExtractionResult:
        """
        Main pipeline execution entrypoint:
          1. Validates file existence and extension
          2. Dispatches to appropriate format extractor
          3. Executes OCR fallback if scanned
          4. Normalizes and sanitizes text
          5. Generates overlapping sliding-window chunks for NLP
          6. Returns ExtractionResult with comprehensive audit metadata
        """
        start_time = time.perf_counter()
        path = Path(file_path).resolve()

        if not path.exists():
            raise FileNotFoundError(f"Target document does not exist at path: '{path}'")

        if not path.is_file():
            raise IngestionPipelineError(f"Specified path is a directory, not a file: '{path}'")

        file_ext = path.suffix.lower()
        file_size = path.stat().st_size

        if file_size == 0:
            raise EmptyDocumentError(f"Document file is empty (0 bytes): '{path.name}'")

        raw_text = ""
        page_count = 1
        is_scanned = False
        ocr_applied = False

        # Route by extension
        if file_ext == ".pdf":
            raw_text, page_count, is_scanned, ocr_applied = self._extract_pdf(path)
        elif file_ext in [".docx", ".doc"]:
            if file_ext == ".doc":
                raise UnsupportedFormatError(
                    "Legacy Word (.doc) format is not supported. Please convert to modern .docx format."
                )
            raw_text, page_count = self._extract_docx(path)
        elif file_ext in [".txt", ".md", ".rtf", ".csv", ".tsv"]:
            raw_text, page_count = self._extract_txt(path)
        else:
            raise UnsupportedFormatError(
                f"Unsupported file extension '{file_ext}'. Supported formats: .pdf, .docx, .txt, .md"
            )

        # Ensure text is not completely blank
        if not raw_text or not raw_text.strip():
            raise EmptyDocumentError(
                f"No extractable text found in '{path.name}'. File may be password protected or blank."
            )

        # Normalize and clean text
        cleaned_text = TextNormalizer.clean(raw_text, lowercase=True, remove_headers=True)

        # Generate overlapping sliding-window chunks for NLP vectorization
        chunks = self.chunker.chunk(cleaned_text)

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0

        metadata = DocumentMetadata(
            file_name=path.name,
            file_path=str(path),
            file_extension=file_ext,
            file_size_bytes=file_size,
            page_count=page_count,
            is_scanned=is_scanned,
            ocr_applied=ocr_applied,
            total_characters_raw=len(raw_text),
            total_characters_cleaned=len(cleaned_text),
            total_words=len(cleaned_text.split()),
            processing_time_ms=round(elapsed_ms, 2),
            extra_attributes={
                "chunk_count": len(chunks),
                "window_size": self.chunker.window_size,
                "step_size": self.chunker.step_size,
            }
        )

        logger.info(
            f"Ingested '{path.name}' in {elapsed_ms:.1f}ms: "
            f"{metadata.page_count} pages, {metadata.total_words} words, "
            f"{len(chunks)} chunks (OCR: {ocr_applied})"
        )

        return ExtractionResult(
            raw_text=raw_text,
            cleaned_text=cleaned_text,
            chunks=chunks,
            metadata=metadata
        )


# ==============================================================================
# Pipeline Verification / Self-Test Demo
# ==============================================================================

if __name__ == "__main__":
    import tempfile

    print("\n--- Running Document Extraction Pipeline Verification ---")
    pipeline = DocumentExtractionPipeline(chunk_size=30, chunk_overlap=10)

    # 1. Test Plain Text & Normalization
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as f:
        f.write(
            "PAGE 1 OF 12\n"
            "Academic Research on Artificial Intelligence.\n"
            "“Deep Learning” algorithms have—without doubt—revolutionized modern NLP paradigms!\n"
            "In this paper, we explore sliding window tokenization.\n"
            "CONFIDENTIAL\n"
            "12\n"
        )
        sample_path = f.name

    try:
        result = pipeline.ingest_document(sample_path)
        print(f"File Ingested: {result.metadata.file_name}")
        print(f"Total Words: {result.metadata.total_words}")
        print(f"Total Chunks: {len(result.chunks)}")
        print("\nCleaned Text Sample:")
        print(repr(result.cleaned_text))
        print("\nFirst Chunk Preview:")
        if result.chunks:
            c = result.chunks[0]
            print(f"  Chunk 0 (Chars {c.start_char}-{c.end_char}, {c.word_count} words):")
            print(f"  '{c.text}'")
    finally:
        os.remove(sample_path)

    print("\n--- Pipeline Verification Complete ---")
