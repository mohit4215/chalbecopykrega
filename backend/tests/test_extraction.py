import tempfile
from pathlib import Path
import pytest
from app.services.ingestion_pipeline import (
    TextNormalizer,
    SlidingWindowChunker,
    DocumentExtractionPipeline,
    EmptyDocumentError,
    UnsupportedFormatError
)

class TestTextNormalizer:
    """Unit tests for the TextNormalizer sanitization rules."""

    def test_unicode_normalization_and_smart_quotes(self):
        # Input containing smart quotes, em-dashes, and non-breaking space
        raw_text = "“Deep learning” is a subset of machine learning—essentially neural networks.\u00a0"
        cleaned = TextNormalizer.clean(raw_text, lowercase=True, remove_headers=True)
        
        assert '"deep learning"' in cleaned
        assert "-" in cleaned
        assert "\u00a0" not in cleaned

    def test_header_and_footer_removal(self):
        raw_text = (
            "Page 1 of 12\n"
            "This is the first sentence of the research paper.\n"
            "- 1 -\n"
            "Here is the second sentence regarding transformers.\n"
            "CONFIDENTIAL\n"
        )
        cleaned = TextNormalizer.clean(raw_text, lowercase=False, remove_headers=True)
        
        assert "Page 1 of 12" not in cleaned
        assert "CONFIDENTIAL" not in cleaned
        assert "This is the first sentence of the research paper." in cleaned
        assert "Here is the second sentence regarding transformers." in cleaned

    def test_whitespace_and_control_characters(self):
        raw_text = "Sentence with \x00\x05 weird control characters   and   multiple   spaces."
        cleaned = TextNormalizer.clean(raw_text, lowercase=True, remove_headers=True)
        assert "\x00" not in cleaned
        assert "\x05" not in cleaned
        assert "   " not in cleaned


class TestSlidingWindowChunker:
    """Unit tests for the SlidingWindowChunker sliding window and character offset logic."""

    def test_sliding_window_spans_and_offsets(self):
        text = "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10"
        chunker = SlidingWindowChunker(window_size=5, overlap=2)
        chunks = chunker.chunk(text)

        assert len(chunks) > 0
        for chunk in chunks:
            # Crucial invariant: character offsets MUST match the exact text slice
            assert text[chunk.start_char:chunk.end_char] == chunk.text
            assert chunk.word_count <= 5

    def test_empty_text_chunking(self):
        chunker = SlidingWindowChunker(window_size=10, overlap=3)
        chunks = chunker.chunk("")
        assert chunks == []


class TestDocumentExtractionPipeline:
    """Integration unit tests for the multi-format DocumentExtractionPipeline."""

    def test_plain_text_extraction(self):
        sample_content = (
            "Attention Is All You Need introduced the Transformer architecture.\n"
            "It completely replaces recurrence and convolutions with multi-head self-attention mechanisms."
        )
        with tempfile.NamedTemporaryFile("w+", suffix=".txt", delete=False, encoding="utf-8") as tmp:
            tmp.write(sample_content)
            tmp_path = tmp.name

        try:
            pipeline = DocumentExtractionPipeline(chunk_size=10, chunk_overlap=3, enable_ocr=False)
            result = pipeline.ingest_document(tmp_path)

            assert result.raw_text.strip() == sample_content.strip()
            assert len(result.cleaned_text) > 0
            assert len(result.chunks) > 0
            assert result.metadata.file_extension == ".txt"
            assert result.metadata.total_words > 0
            assert result.metadata.is_scanned is False
        finally:
            Path(tmp_path).unlink(missing_ok=True)

    def test_empty_document_raises_error(self):
        with tempfile.NamedTemporaryFile("w+", suffix=".txt", delete=False, encoding="utf-8") as tmp:
            tmp.write("   \n\n  \t  ")
            tmp_path = tmp.name

        try:
            pipeline = DocumentExtractionPipeline(enable_ocr=False)
            with pytest.raises(EmptyDocumentError):
                pipeline.ingest_document(tmp_path)
        finally:
            Path(tmp_path).unlink(missing_ok=True)

    def test_unsupported_format_raises_error(self):
        with tempfile.NamedTemporaryFile("wb", suffix=".exe", delete=False) as tmp:
            tmp.write(b"binary executable payload")
            tmp_path = tmp.name

        try:
            pipeline = DocumentExtractionPipeline(enable_ocr=False)
            with pytest.raises(UnsupportedFormatError):
                pipeline.ingest_document(tmp_path)
        finally:
            Path(tmp_path).unlink(missing_ok=True)
