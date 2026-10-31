import uuid
from typing import Optional, List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.models.schemas import (
    ScanReport, PlagiarismMatch, SourceBreakdown,
    IngestDocumentRequest, IngestDocumentResponse
)
from app.services.document_parser import DocumentParser
from app.services.winnowing import WinnowingEngine
from app.services.semantic_matcher import SemanticMatcher
from app.services.minhash_service import MinHashService
from app.services.web_search import WebSearchCrossReferencer
from app.services.vector_db import VectorDatabaseManager
from app.utils.interval_merger import IntervalMerger
from app.utils.text_utils import TextUtils

app = FastAPI(
    title=settings.APP_NAME,
    description="Turnitin-Style Multi-Stage Plagiarism Detection and Originality Engine",
    version="1.0.0"
)

# Enable CORS for React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Core Services (Singletons)
winnowing_engine = WinnowingEngine(k=settings.WINNOWING_K, w=settings.WINNOWING_W)
semantic_matcher = SemanticMatcher(model_name=settings.EMBEDDING_MODEL_NAME)
minhash_service = MinHashService()
web_search_service = WebSearchCrossReferencer()
vector_db = VectorDatabaseManager()

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "indexed_documents": len(vector_db.in_memory_docs),
        "indexed_chunks": len(vector_db.in_memory_chunks)
    }

@app.post("/api/scan", response_model=ScanReport)
async def scan_document(
    file: Optional[UploadFile] = File(None),
    raw_text_input: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    exclude_quotes: bool = Form(False),
    exclude_bibliography: bool = Form(True),
    enable_web_search: bool = Form(True)
):
    """
    Main Plagiarism Scanning Pipeline:
    1. Extracts and normalizes text from PDF, DOCX, or TXT
    2. Runs Winnowing Fingerprinting for exact/substring matches
    3. Runs MinHash & HuggingFace Dense Embedding Cosine Similarity for paraphrase detection
    4. Performs live external Web Search queries
    5. Merges character intervals using Interval Union for true originality %
    """
    # 1. Extraction
    if file:
        file_bytes = await file.read()
        filename = file.filename or "Uploaded_Document.txt"
        doc_title = title or filename
        raw_text, meta = DocumentParser.extract_text(file_bytes, filename)
    elif raw_text_input:
        raw_text = DocumentParser.clean_text(raw_text_input)
        doc_title = title or "Pasted Submission"
    else:
        raise HTTPException(status_code=400, detail="Please upload a file or paste document text.")

    if not raw_text or len(raw_text.strip()) < 20:
        raise HTTPException(status_code=400, detail="Document content is too short for meaningful analysis.")

    total_chars = len(raw_text)
    total_words = TextUtils.count_words(raw_text)

    # Effective scanning boundary (excluding bibliography if requested)
    scan_limit = total_chars
    if exclude_bibliography:
        bib_offset = TextUtils.find_bibliography_offset(raw_text)
        if bib_offset < total_chars:
            scan_limit = bib_offset

    active_text = raw_text[:scan_limit]

    # Quotes exclusion mask
    quote_spans = TextUtils.extract_quotation_spans(active_text) if exclude_quotes else []

    all_raw_matches: List[PlagiarismMatch] = []

    # 2. Stage 1: Exact Match Fingerprinting via Winnowing
    fingerprints = winnowing_engine.extract_fingerprints(active_text)
    exact_hits = vector_db.search_exact_fingerprints(fingerprints)

    if exact_hits:
        # Group hits by source doc
        grouped_hits = {}
        for hit in exact_hits:
            s_id = hit["source_id"]
            if s_id not in grouped_hits:
                grouped_hits[s_id] = []
            grouped_hits[s_id].append((hit["query_start"], hit["query_end"], hit))

        for s_id, hit_list in grouped_hits.items():
            clusters = winnowing_engine.cluster_matched_fingerprints(hit_list, max_gap=60)
            sample_hit = hit_list[0][2]
            for c_start, c_end in clusters:
                if c_end - c_start >= settings.WINNOWING_K:
                    matched_snippet = raw_text[c_start:c_end]
                    all_raw_matches.append(PlagiarismMatch(
                        id=f"exact_{uuid.uuid4().hex[:8]}",
                        start_char=c_start,
                        end_char=c_end,
                        matched_text=matched_snippet,
                        source_title=sample_hit["source_title"],
                        source_id=sample_hit["source_id"],
                        source_snippet=matched_snippet,
                        similarity_score=1.0,
                        match_type="exact",
                        source_category=sample_hit.get("source_category", "Submitted Works")
                    ))

    # 3. Stage 2: Paraphrase Detection via Dense Semantic Chunks
    chunks = semantic_matcher.segment_text(active_text)
    if chunks:
        chunk_texts = [c.text for c in chunks]
        embeddings = semantic_matcher.compute_embeddings(chunk_texts)
        semantic_hits = vector_db.search_semantic_chunks(chunks, embeddings)

        for hit in semantic_hits:
            # Avoid redundant exact duplicate reporting if already covered
            all_raw_matches.append(PlagiarismMatch(
                id=f"para_{uuid.uuid4().hex[:8]}",
                start_char=hit["start_char"],
                end_char=hit["end_char"],
                matched_text=hit["matched_text"],
                source_title=hit["source_title"],
                source_id=hit["source_id"],
                source_snippet=hit["source_snippet"],
                similarity_score=hit["similarity_score"],
                match_type=hit["match_type"],
                source_category=hit["source_category"]
            ))

    # 4. Stage 3: External Live Web Cross-Referencing
    if enable_web_search and chunks:
        web_hits = await web_search_service.cross_reference_chunks(chunks, semantic_matcher)
        for hit in web_hits:
            all_raw_matches.append(PlagiarismMatch(
                id=f"web_{uuid.uuid4().hex[:8]}",
                start_char=hit["start_char"],
                end_char=hit["end_char"],
                matched_text=hit["matched_text"],
                source_title=hit["source_title"],
                source_url=hit.get("source_url"),
                source_snippet=hit["source_snippet"],
                similarity_score=hit["similarity_score"],
                match_type="web",
                source_category="Internet"
            ))

    # Filter out matches inside quotes if exclude_quotes is enabled
    final_matches: List[PlagiarismMatch] = []
    for m in all_raw_matches:
        if exclude_quotes and any(qs <= m.start_char and m.end_char <= qe for qs, qe in quote_spans):
            continue
        final_matches.append(m)

    # 5. Non-overlapping Coverage & Originality Calculation
    all_intervals = [(m.start_char, m.end_char) for m in final_matches]
    overall_sim_pct = IntervalMerger.calculate_coverage(all_intervals, total_chars)
    originality_pct = round(100.0 - overall_sim_pct, 2)

    # Source breakdown
    cat_breakdown = IntervalMerger.calculate_category_breakdown(
        [m.dict() for m in final_matches], total_chars
    )
    breakdown = SourceBreakdown(
        internet_percentage=cat_breakdown.get("Internet", 0.0),
        internal_db_percentage=cat_breakdown.get("Submitted Works", 0.0),
        publications_percentage=cat_breakdown.get("Publications", 0.0)
    )

    return ScanReport(
        document_id=str(uuid.uuid4()),
        title=doc_title,
        total_characters=total_chars,
        total_words=total_words,
        overall_similarity_percentage=overall_sim_pct,
        originality_percentage=originality_pct,
        sources_breakdown=breakdown,
        matches=final_matches,
        raw_text=raw_text
    )

@app.post("/api/ingest", response_model=IngestDocumentResponse)
async def ingest_reference_document(payload: IngestDocumentRequest):
    """
    Ingest a reference document (past student paper, journal article, etc.)
    into the internal vector and fingerprint database.
    """
    if not payload.text or len(payload.text.strip()) < 20:
        raise HTTPException(status_code=400, detail="Document text is too short to ingest.")

    doc_id = vector_db.insert_document_sync(
        title=payload.title,
        author=payload.author or "Anonymous",
        text=payload.text,
        category="Submitted Works"
    )

    return IngestDocumentResponse(
        document_id=doc_id,
        title=payload.title,
        chunks_indexed=len([c for c in vector_db.in_memory_chunks if c["doc_id"] == doc_id]),
        fingerprints_indexed=sum(1 for fp_list in vector_db.in_memory_fingerprints.values() for hit in fp_list if hit["doc_id"] == doc_id),
        status="Successfully indexed into corpus"
    )

@app.get("/api/documents")
async def list_indexed_documents():
    """Lists summary of reference documents in the database."""
    docs = []
    for d in vector_db.in_memory_docs.values():
        docs.append({
            "id": d["id"],
            "title": d["title"],
            "author": d["author"],
            "total_characters": d["total_characters"],
            "category": d.get("category", "Submitted Works")
        })
    return docs

# Optional Static Files Mount (serves frontend if built in production)
import os
from fastapi.staticfiles import StaticFiles

static_dist_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend/dist"))
if os.path.isdir(static_dist_path):
    app.mount("/", StaticFiles(directory=static_dist_path, html=True), name="static")

