import os
import uuid
import asyncio
import logging
from typing import Dict, Any
from celery import Celery
from sqlalchemy import select

from app.models.db_models import User, ScanHistory
from app.services.database import AsyncSessionLocal
from app.services.ingestion_pipeline import DocumentExtractionPipeline
from app.services.core_engine import (
    InternalVectorDB,
    LiveWebSearchClient,
    CoreNLPMatcher,
    PlagiarismDetectionEngine
)

logger = logging.getLogger("plagiarism.celery")

# Broker & Result Backend Configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", REDIS_URL)
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", REDIS_URL)
CELERY_ALWAYS_EAGER = os.getenv("CELERY_ALWAYS_EAGER", "false").lower() == "true"

celery_app = Celery(
    "plagiarism_tasks",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    result_expires=3600,  # Cache results in Redis for 1 hour
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_always_eager=CELERY_ALWAYS_EAGER
)

# Shared worker singletons
_ingestion_pipeline = DocumentExtractionPipeline(chunk_size=50, chunk_overlap=20, enable_ocr=True)
_vector_db = InternalVectorDB(
    qdrant_url=os.getenv("QDRANT_URL") if os.getenv("QDRANT_URL") else None,
    location=":memory:" if not os.getenv("QDRANT_URL") else None
)
_web_client = LiveWebSearchClient()
_nlp_matcher = CoreNLPMatcher()
_plagiarism_engine = PlagiarismDetectionEngine(
    vector_db=_vector_db,
    web_client=_web_client,
    matcher=_nlp_matcher
)


@celery_app.task(bind=True, name="process_plagiarism_document")
def process_plagiarism_document(
    self,
    temp_file_path: str,
    filename: str,
    user_id: str,
    enable_web_search: bool = True
) -> Dict[str, Any]:
    """
    Asynchronous Celery background task:
      1. Slices & extracts text (with OCR fallback for scanned PDFs)
      2. Generates sliding-window chunks & vector embeddings
      3. Queries Qdrant vector DB (student-to-student comparison)
      4. Queries live internet sources via SerpAPI / Bing
      5. Evaluates hybrid N-gram Jaccard and dense cosine similarity
      6. Persists originality report to PostgreSQL and deducts user credit
    """
    logger.info(f"Task {self.request.id}: Started asynchronous audit for {filename} (User: {user_id})")

    try:
        # Step 1: Text extraction & OCR fallback
        self.update_state(
            state="PROGRESS",
            meta={
                "step": "extracting",
                "progress": 20,
                "message": "Extracting text and applying OCR fallback if scanned..."
            }
        )

        extraction_result = _ingestion_pipeline.extract(temp_file_path)
        chunks = extraction_result.chunks
        chunk_strings = [c.text for c in chunks]

        # Step 2: Vector embeddings & similarity search
        self.update_state(
            state="PROGRESS",
            meta={
                "step": "vectorizing",
                "progress": 55,
                "message": "Generating embeddings and querying Qdrant vector database..."
            }
        )

        # Step 3: Web search & scoring
        if enable_web_search:
            self.update_state(
                state="PROGRESS",
                meta={
                    "step": "searching_web",
                    "progress": 75,
                    "message": "Cross-referencing live internet sources via search APIs..."
                }
            )

        doc_id = f"doc_{uuid.uuid4().hex[:10]}"
        scan_report = asyncio.run(
            _plagiarism_engine.scan_document_chunks(
                document_id=doc_id,
                document_title=filename,
                chunks=chunk_strings,
                enable_web_search=enable_web_search
            )
        )

        # Step 4: Formatting matches
        self.update_state(
            state="PROGRESS",
            meta={
                "step": "scoring",
                "progress": 92,
                "message": "Evaluating hybrid N-gram Jaccard & cosine similarity matrices..."
            }
        )

        formatted_matches = []
        for idx, match_item in enumerate(scan_report.get("matches", [])):
            chunk_idx = match_item["chunk_index"]
            corresponding_chunk = chunks[chunk_idx]
            formatted_matches.append({
                "id": f"match_{idx}_{uuid.uuid4().hex[:6]}",
                "matched_text": corresponding_chunk.text,
                "start_index": corresponding_chunk.start_char,
                "end_index": corresponding_chunk.end_char,
                "similarity_score": match_item["confidence_score"],
                "match_type": match_item["match_type"],
                "source_title": match_item["source_title"],
                "source_url": match_item.get("source_url"),
                "source_id": match_item.get("source_id"),
                "source_author": match_item.get("source_author"),
                "source_snippet": match_item.get("source_snippet"),
                "source_category": match_item.get("source_category", "Internet Source")
            })

        new_scan_id = str(uuid.uuid4())
        final_payload = {
            "scan_id": new_scan_id,
            "document_id": doc_id,
            "document_title": filename,
            "overall_score": scan_report["overall_plagiarism_percentage"],
            "originality_score": scan_report["originality_percentage"],
            "total_words": extraction_result.metadata.total_words,
            "total_characters": extraction_result.metadata.total_characters_cleaned,
            "remaining_credits": 0,
            "subscription_tier": "free",
            "full_text": extraction_result.cleaned_text,
            "summary": {
                "exact_matches_count": scan_report["summary"]["exact_matches_count"],
                "paraphrase_matches_count": scan_report["summary"]["paraphrase_matches_count"],
                "internet_matches_count": scan_report["summary"]["internet_matches_count"]
            },
            "matches": formatted_matches
        }

        # Step 5: Persist to database & deduct credit
        async def persist_db():
            async with AsyncSessionLocal() as db:
                res = await db.execute(select(User).where(User.id == user_id))
                u = res.scalar_one_or_none()
                if u:
                    if not u.has_active_subscription:
                        u.scan_credits = max(0, u.scan_credits - 1)
                        db.add(u)
                    final_payload["remaining_credits"] = u.scan_credits
                    final_payload["subscription_tier"] = u.subscription_tier

                scan_record = ScanHistory(
                    id=new_scan_id,
                    user_id=user_id,
                    filename=filename,
                    overall_score=scan_report["overall_plagiarism_percentage"],
                    report_json=final_payload
                )
                db.add(scan_record)
                await db.commit()

        asyncio.run(persist_db())

        logger.info(f"Task {self.request.id}: Successfully processed {filename} (Score: {final_payload['overall_score']}%)")
        return final_payload

    except Exception as e:
        logger.error(f"Task {self.request.id} failed: {e}", exc_info=True)
        raise e
    finally:
        # Cleanup temporary uploaded file on disk
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception:
                pass
