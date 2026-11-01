import os
import uuid
import asyncio
import logging
from typing import Dict, Any, Optional
from celery import Celery
from sqlalchemy import select

from app.models.db_models import User, ScanHistory
from app.services.database import AsyncSessionLocal
from app.services.ingestion_pipeline import DocumentExtractionPipeline
from app.services.knowledge_base import vector_db, seed_reference_corpus
from app.services.core_engine import (
    LiveWebSearchClient,
    CoreNLPMatcher,
    PlagiarismDetectionEngine
)

logger = logging.getLogger("plagiarism.celery")

# Broker & Result Backend Configuration
#
# Single-service hosts (Render free tier, a plain `uvicorn` process, Docker
# without a worker) have no Redis. In that case tasks must run in-process.
# Defaulting to eager whenever no broker URL is configured keeps those
# deployments working without requiring dashboard environment variables, while
# docker-compose / production setups that set REDIS_URL still use the worker.
REDIS_URL = (os.getenv("REDIS_URL") or "").strip()
CELERY_BROKER_URL = (os.getenv("CELERY_BROKER_URL") or "").strip() or REDIS_URL

_eager_flag = os.getenv("CELERY_ALWAYS_EAGER")
if _eager_flag is None or not _eager_flag.strip():
    CELERY_ALWAYS_EAGER = not CELERY_BROKER_URL
else:
    CELERY_ALWAYS_EAGER = _eager_flag.strip().lower() in {"1", "true", "yes", "on"}

# With no broker, use Celery's in-memory transport instead of silently
# defaulting to a localhost Redis that does not exist.
if not CELERY_BROKER_URL:
    CELERY_BROKER_URL = "memory://"

# In eager mode there is no worker and usually no Redis. Use the in-process
# memory backend so progress updates never attempt a network connection, and
# keep our own result store for deterministic success/failure reporting.
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "").strip()
if not CELERY_RESULT_BACKEND:
    CELERY_RESULT_BACKEND = "cache+memory://" if CELERY_ALWAYS_EAGER else REDIS_URL

# Bounded in-process registry of completed eager tasks: task_id -> result payload.
# Keeps polling (/api/task-status) working without a reachable result backend.
EAGER_TASK_STORE: Dict[str, Dict[str, Any]] = {}
EAGER_TASK_STORE_LIMIT = 100


def record_eager_result(
    task_id: Optional[str],
    state: str,
    result: Optional[Dict[str, Any]] = None,
    error: Optional[str] = None,
    step: Optional[str] = None,
    progress: Optional[int] = None,
    message: Optional[str] = None,
) -> None:
    """Record the terminal or intermediate state of an eagerly executed task."""
    if not task_id:
        return
    if len(EAGER_TASK_STORE) >= EAGER_TASK_STORE_LIMIT:
        EAGER_TASK_STORE.pop(next(iter(EAGER_TASK_STORE)), None)
    entry = {"state": state, "result": result, "error": error}
    if step is not None:
        entry["step"] = step
    if progress is not None:
        entry["progress"] = progress
    if message is not None:
        entry["message"] = message
    EAGER_TASK_STORE[task_id] = entry


def report_progress(task, step: str, progress: int, message: str) -> None:
    """Publish task progress without ever failing the scan.

    Progress reporting is best-effort: without a reachable result backend (and
    for tasks invoked directly or via ``apply()`` where ``request.id`` may be
    absent) ``update_state`` raises. That must not abort a plagiarism scan.
    """
    try:
        task.update_state(
            state="PROGRESS",
            meta={"step": step, "progress": progress, "message": message},
        )
    except Exception as exc:  # pragma: no cover - depends on backend availability
        logger.debug(f"Progress update skipped ({step}): {exc}")

    try:
        task_id = getattr(getattr(task, "request", None), "id", None)
        if task_id:
            record_eager_result(
                task_id=task_id,
                state="PROGRESS",
                step=step,
                progress=progress,
                message=message,
            )
            try:
                from app.services.task_stream import publish_task_event
                publish_task_event(
                    task_id=task_id,
                    event={
                        "task_id": task_id,
                        "status": "processing",
                        "step": step,
                        "progress": progress,
                        "message": message,
                    }
                )
            except Exception as stream_err:
                logger.debug(f"Progress streaming event dispatch failed: {stream_err}")
    except Exception as exc:
        logger.debug(f"Eager store progress update skipped ({step}): {exc}")


def _run_coroutine(coro):
    """Run an async coroutine safely across both sync threads and threads with active loops."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            return pool.submit(asyncio.run, coro).result()
    else:
        return asyncio.run(coro)

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
    task_always_eager=CELERY_ALWAYS_EAGER,
    task_store_eager_result=CELERY_ALWAYS_EAGER,
    # Fail fast when a configured broker is unreachable: the endpoint then falls
    # back to in-process execution instead of hanging for a minute on retries.
    broker_connection_timeout=5,
    broker_connection_max_retries=1,
    broker_transport_options={
        "max_retries": 1,
        "interval_start": 0,
        "interval_step": 0.2,
        "interval_max": 0.5,
        "socket_connect_timeout": 5,
        "socket_timeout": 5,
    },
    task_publish_retry_policy={
        "max_retries": 1,
        "interval_start": 0,
        "interval_step": 0.2,
        "interval_max": 0.5,
    },
    # Same fail-fast behaviour for the Redis result backend, whose reconnect
    # loop otherwise retries for ~60s when Redis is missing.
    redis_socket_connect_timeout=5,
    redis_socket_timeout=5,
    result_backend_transport_options={
        "retry_policy": {
            "max_retries": 1,
            "interval_start": 0,
            "interval_step": 0.2,
            "interval_max": 0.5,
        },
        "socket_connect_timeout": 5,
        "socket_timeout": 5,
    },
)

# Shared worker singletons
try:
    _ingestion_pipeline = DocumentExtractionPipeline(chunk_size=50, chunk_overlap=20, enable_ocr=True)
    # Use the process-wide corpus so the task compares documents against the
    # reference papers seeded by the API instead of an empty private store.
    _vector_db = vector_db
    seed_reference_corpus()
    _web_client = LiveWebSearchClient()
    _nlp_matcher = CoreNLPMatcher()
    _plagiarism_engine = PlagiarismDetectionEngine(
        vector_db=_vector_db,
        web_client=_web_client,
        matcher=_nlp_matcher
    )
except Exception as e:
    logger.warning(f"Celery worker singleton setup deferred: {e}")
    _ingestion_pipeline = None
    _vector_db = None
    _web_client = None
    _nlp_matcher = None
    _plagiarism_engine = None


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
    task_id = self.request.id
    logger.info(f"Task {task_id}: Started asynchronous audit for {filename} (User: {user_id})")

    try:
        # Step 1: Text extraction & OCR fallback
        report_progress(
            self,
            "extracting",
            20,
            "Extracting text and applying OCR fallback if scanned...",
        )

        extraction_result = _ingestion_pipeline.ingest_document(temp_file_path)
        chunks = extraction_result.chunks
        chunk_strings = [c.text for c in chunks]

        # Step 2: Vector embeddings & similarity search
        report_progress(
            self,
            "vectorizing",
            55,
            "Generating embeddings and querying the vector database...",
        )

        # Step 3: Web search & scoring
        if enable_web_search:
            report_progress(
                self,
                "searching_web",
                75,
                "Cross-referencing live internet sources via search APIs...",
            )

        doc_id = f"doc_{uuid.uuid4().hex[:10]}"
        scan_report = _run_coroutine(
            _plagiarism_engine.scan_document_chunks(
                document_id=doc_id,
                document_title=filename,
                chunks=chunk_strings,
                enable_web_search=enable_web_search
            )
        )

        # Step 4: Formatting matches
        report_progress(
            self,
            "scoring",
            92,
            "Evaluating hybrid N-gram Jaccard & cosine similarity matrices...",
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

        _run_coroutine(persist_db())

        logger.info(f"Task {task_id}: Successfully processed {filename} (Score: {final_payload['overall_score']}%)")
        if CELERY_ALWAYS_EAGER:
            record_eager_result(
                task_id,
                "SUCCESS",
                result=final_payload,
                step="completed",
                progress=100,
                message="Plagiarism analysis completed successfully!"
            )
        try:
            from app.services.task_stream import publish_task_event
            publish_task_event(
                task_id=task_id,
                event={
                    "task_id": task_id,
                    "status": "success",
                    "step": "completed",
                    "progress": 100,
                    "message": "Plagiarism analysis completed successfully!",
                    "report": final_payload,
                }
            )
        except Exception as pub_err:
            logger.debug(f"Terminal success event publish failed: {pub_err}")

        return final_payload

    except Exception as e:
        logger.error(f"Task {task_id} failed: {e}", exc_info=True)
        if CELERY_ALWAYS_EAGER:
            record_eager_result(
                task_id,
                "FAILURE",
                error=str(e),
                step="failed",
                progress=0,
                message=str(e)
            )
        try:
            from app.services.task_stream import publish_task_event
            publish_task_event(
                task_id=task_id,
                event={
                    "task_id": task_id,
                    "status": "failure",
                    "step": "failed",
                    "progress": 0,
                    "message": str(e),
                    "error": str(e),
                }
            )
        except Exception as pub_err:
            logger.debug(f"Terminal failure event publish failed: {pub_err}")
        raise e
    finally:
        # Cleanup temporary uploaded file on disk
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception:
                pass
