import os
import uuid
import tempfile
import shutil
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.config import settings
from app.services.ingestion_pipeline import (
    DocumentExtractionPipeline,
    ExtractionResult,
    IngestionPipelineError,
    UnsupportedFormatError,
    CorruptedFileError,
    EmptyDocumentError
)
from app.services.core_engine import (
    InternalVectorDB,
    LiveWebSearchClient,
    CoreNLPMatcher,
    PlagiarismDetectionEngine
)

# Initialize FastAPI application
app = FastAPI(
    title="Turnitin-Style Academic Plagiarism Detection API",
    description="High-performance document ingestion and hybrid NLP originality verification engine.",
    version="2.0.0"
)

# Configure Cross-Origin Resource Sharing (CORS) for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------------------
# Pydantic Schemas for Strict API Contracts
# ------------------------------------------------------------------------------

class PlagiarismMatchDetail(BaseModel):
    id: str = Field(..., description="Unique identifier for this match occurrence")
    matched_text: str = Field(..., description="Text chunk from uploaded document that matched a source")
    start_index: int = Field(..., description="Character start index in the document text")
    end_index: int = Field(..., description="Character end index in the document text")
    similarity_score: float = Field(..., description="Confidence or similarity coefficient (0.0 - 1.0)")
    match_type: str = Field(..., description="'exact_copy' or 'paraphrase'")
    source_title: str = Field(..., description="Title of the matched paper, article, or web page")
    source_url: Optional[str] = Field(None, description="External web link if matched via internet search")
    source_id: Optional[str] = Field(None, description="Internal document identifier if matched via database")
    source_author: Optional[str] = Field(None, description="Author or student attribution if available")
    source_snippet: Optional[str] = Field(None, description="Exact snippet from the source for comparison")
    source_category: str = Field(..., description="'Internet Source', 'Submitted Student Work', or 'Publications'")

class PlagiarismSummary(BaseModel):
    exact_matches_count: int
    paraphrase_matches_count: int
    internet_matches_count: int

class CheckPlagiarismResponse(BaseModel):
    document_id: str
    document_title: str
    overall_score: float = Field(..., description="Total plagiarism percentage (0.0 to 100.0)")
    originality_score: float = Field(..., description="Total originality percentage (100.0 - overall_score)")
    total_words: int
    total_characters: int
    full_text: str = Field(..., description="Full text for character-level highlight rendering on the frontend")
    summary: PlagiarismSummary
    matches: List[PlagiarismMatchDetail]

class IngestCorpusRequest(BaseModel):
    title: str
    student_name: Optional[str] = "Anonymous Student"
    text: str

# ------------------------------------------------------------------------------
# Singletons & Service Initialization
# ------------------------------------------------------------------------------

ingestion_pipeline = DocumentExtractionPipeline(chunk_size=50, chunk_overlap=20, enable_ocr=True)
vector_db = InternalVectorDB(location=":memory:")
web_search_client = LiveWebSearchClient()
nlp_matcher = CoreNLPMatcher()
plagiarism_engine = PlagiarismDetectionEngine(
    vector_db=vector_db,
    web_client=web_search_client,
    matcher=nlp_matcher
)

# Pre-seed internal database with standard academic reference papers
def _seed_sample_database():
    sample_text_chunks = [
        "Deep learning is a subset of machine learning, which is essentially a neural network with three or more layers. These neural networks attempt to simulate the behavior of the human brain.",
        "Attention Is All You Need introduced the Transformer architecture based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.",
        "Convolutional neural networks are commonly used for image classification, while transformers have revolutionized natural language processing.",
        "Stochastic gradient descent with momentum optimizes convex and non-convex loss landscapes in deep neural networks."
    ]
    vector_db.index_submission(
        document_id="doc_ref_cs101_sample",
        student_name="Alice Johnson (Spring 2025)",
        title="Introduction to Neural Architectures and Attention Mechanisms",
        chunks=sample_text_chunks
    )

_seed_sample_database()

# ------------------------------------------------------------------------------
# API Endpoints
# ------------------------------------------------------------------------------

@app.get("/api/health")
async def health_check():
    """Healthcheck endpoint for container orchestration and uptime monitoring."""
    return {
        "status": "healthy",
        "service": "Turnitin-Style Plagiarism Detection Engine",
        "vector_dim": vector_db.VECTOR_DIM
    }

@app.post("/api/check-plagiarism", response_model=CheckPlagiarismResponse)
async def check_plagiarism(
    file: UploadFile = File(..., description="Uploaded document (PDF, DOCX, or TXT)"),
    enable_web_search: bool = Form(True, description="Enable live internet cross-referencing via search APIs")
):
    """
    Main Plagiarism Verification Pipeline:
      1. Receives uploaded PDF, DOCX, or TXT file
      2. Extracts digital text or triggers OCR fallback on scanned documents
      3. Normalizes Unicode and removes noisy headers/footers
      4. Segments text into sequential overlapping chunks with start/end character offsets
      5. Runs Qdrant vector similarity search against past student papers
      6. Runs live internet search queries (SerpAPI / Bing Web Search)
      7. Evaluates matches using N-gram Jaccard (exact) and Cosine Similarity (paraphrase)
      8. Returns overall score and character index spans for frontend highlighter rendering
    """
    filename = file.filename or "Uploaded_Document.txt"
    file_ext = os.path.splitext(filename)[1].lower()

    if file_ext not in [".pdf", ".docx", ".txt", ".md", ".rtf"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported format '{file_ext}'. Supported formats: PDF, DOCX, and TXT."
        )

    # 1. Save uploaded file to temporary path for parser processing
    with tempfile.NamedTemporaryFile(suffix=file_ext, delete=False) as temp_file:
        temp_path = temp_file.name
        shutil.copyfileobj(file.file, temp_file)

    try:
        # 2. Extract, clean, and chunk document using the Ingestion Pipeline
        extraction_result: ExtractionResult = ingestion_pipeline.ingest_document(temp_path)
    except UnsupportedFormatError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except (CorruptedFileError, EmptyDocumentError) as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except IngestionPipelineError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        # Cleanup temporary file
        if os.path.exists(temp_path):
            os.remove(temp_path)

    # 3. Extract text chunk strings for NLP Vectorization
    chunks = extraction_result.chunks
    chunk_strings = [c.text for c in chunks]

    if not chunk_strings:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Document text is too brief to generate meaningful NLP chunks for scanning."
        )

    # 4. Execute Core Detection Engine (Vector DB + Web Search + NLP Matching)
    doc_id = str(uuid.uuid4())
    scan_report = await plagiarism_engine.scan_document_chunks(
        document_id=doc_id,
        document_title=filename,
        chunks=chunk_strings,
        enable_web_search=enable_web_search
    )

    # 5. Format Matches with exact start_index and end_index offsets
    formatted_matches: List[PlagiarismMatchDetail] = []
    for idx, match_item in enumerate(scan_report.get("matches", [])):
        chunk_idx = match_item["chunk_index"]
        corresponding_chunk = chunks[chunk_idx]

        formatted_matches.append(PlagiarismMatchDetail(
            id=f"match_{idx}_{uuid.uuid4().hex[:6]}",
            matched_text=corresponding_chunk.text,
            start_index=corresponding_chunk.start_char,
            end_index=corresponding_chunk.end_char,
            similarity_score=match_item["confidence_score"],
            match_type=match_item["match_type"],
            source_title=match_item["source_title"],
            source_url=match_item.get("source_url"),
            source_id=match_item.get("source_id"),
            source_author=match_item.get("source_author"),
            source_snippet=match_item.get("source_snippet"),
            source_category=match_item.get("source_category", "Internet Source")
        ))

    # 6. Build and return structured response
    return CheckPlagiarismResponse(
        document_id=doc_id,
        document_title=filename,
        overall_score=scan_report["overall_plagiarism_percentage"],
        originality_score=scan_report["originality_percentage"],
        total_words=extraction_result.metadata.total_words,
        total_characters=extraction_result.metadata.total_characters_cleaned,
        full_text=extraction_result.cleaned_text,
        summary=PlagiarismSummary(
            exact_matches_count=scan_report["summary"]["exact_matches_count"],
            paraphrase_matches_count=scan_report["summary"]["paraphrase_matches_count"],
            internet_matches_count=scan_report["summary"]["internet_matches_count"]
        ),
        matches=formatted_matches
    )

@app.post("/api/scan")
async def scan_alias(
    file: Optional[UploadFile] = File(None),
    raw_text_input: Optional[str] = Form(None),
    enable_web_search: bool = Form(True)
):
    """Backwards-compatibility alias for the scan endpoint."""
    if file:
        return await check_plagiarism(file=file, enable_web_search=enable_web_search)
    elif raw_text_input:
        # Wrap raw text into a temporary file
        with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as f:
            f.write(raw_text_input)
            tpath = f.name
        try:
            extraction_result = ingestion_pipeline.ingest_document(tpath)
            chunk_strings = [c.text for c in extraction_result.chunks]
            doc_id = str(uuid.uuid4())
            scan_report = await plagiarism_engine.scan_document_chunks(
                document_id=doc_id,
                document_title="Pasted Text Submission",
                chunks=chunk_strings,
                enable_web_search=enable_web_search
            )
            formatted_matches = []
            for idx, m in enumerate(scan_report.get("matches", [])):
                c = extraction_result.chunks[m["chunk_index"]]
                formatted_matches.append(PlagiarismMatchDetail(
                    id=f"match_{idx}_{uuid.uuid4().hex[:6]}",
                    matched_text=c.text,
                    start_index=c.start_char,
                    end_index=c.end_char,
                    similarity_score=m["confidence_score"],
                    match_type=m["match_type"],
                    source_title=m["source_title"],
                    source_url=m.get("source_url"),
                    source_id=m.get("source_id"),
                    source_author=m.get("source_author"),
                    source_snippet=m.get("source_snippet"),
                    source_category=m.get("source_category", "Internet Source")
                ))
            return CheckPlagiarismResponse(
                document_id=doc_id,
                document_title="Pasted Text Submission",
                overall_score=scan_report["overall_plagiarism_percentage"],
                originality_score=scan_report["originality_percentage"],
                total_words=extraction_result.metadata.total_words,
                total_characters=extraction_result.metadata.total_characters_cleaned,
                full_text=extraction_result.cleaned_text,
                summary=PlagiarismSummary(
                    exact_matches_count=scan_report["summary"]["exact_matches_count"],
                    paraphrase_matches_count=scan_report["summary"]["paraphrase_matches_count"],
                    internet_matches_count=scan_report["summary"]["internet_matches_count"]
                ),
                matches=formatted_matches
            )
        finally:
            if os.path.exists(tpath):
                os.remove(tpath)
    else:
        raise HTTPException(status_code=400, detail="Please upload a file or provide text.")

@app.post("/api/ingest-corpus")
async def ingest_corpus_document(payload: IngestCorpusRequest):
    """Seeds reference papers or past student submissions into the internal vector database."""
    if not payload.text or len(payload.text.strip()) < 30:
        raise HTTPException(status_code=400, detail="Text too short to index into corpus.")

    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as f:
        f.write(payload.text)
        tpath = f.name
    try:
        extraction_result = ingestion_pipeline.ingest_document(tpath)
        chunks = [c.text for c in extraction_result.chunks]
        doc_id = str(uuid.uuid4())
        indexed_count = vector_db.index_submission(
            document_id=doc_id,
            student_name=payload.student_name or "Anonymous Student",
            title=payload.title,
            chunks=chunks
        )
        return {
            "document_id": doc_id,
            "title": payload.title,
            "chunks_indexed": indexed_count,
            "status": "Successfully indexed in Qdrant Vector DB"
        }
    finally:
        if os.path.exists(tpath):
            os.remove(tpath)

# Static files mount for production frontend bundle
static_dist_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend/dist"))
if os.path.isdir(static_dist_path):
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=static_dist_path, html=True), name="static")
