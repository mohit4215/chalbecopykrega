"""Shared in-process reference corpus for plagiarism detection.

The API process and the task runner must query the *same* vector store. Each
``InternalVectorDB(location=":memory:")`` instance owns a separate corpus, so
indexing reference papers into one instance while the Celery task queries
another silently produces zero matches.
"""

import logging
import os
from typing import Any, Dict, List

from app.services.core_engine import InternalVectorDB

logger = logging.getLogger("plagiarism.knowledge_base")

# Reference material used for student-to-student comparison. Kept small and
# deterministic so a fresh deployment can demonstrate matches immediately.
REFERENCE_CORPUS: List[Dict[str, Any]] = [
    {
        "document_id": "doc_ref_cs101_sample",
        "student_name": "Alice Johnson (Spring 2025)",
        "title": "Introduction to Neural Architectures and Attention Mechanisms",
        "chunks": [
            "Deep learning is a subset of machine learning, which is essentially a "
            "neural network with three or more layers. These neural networks attempt "
            "to simulate the behavior of the human brain.",
            "Attention Is All You Need introduced the Transformer architecture based "
            "solely on attention mechanisms, dispensing with recurrence and "
            "convolutions entirely.",
            "Convolutional neural networks are commonly used for image classification, "
            "while transformers have revolutionized natural language processing.",
        ],
    },
    {
        "document_id": "doc_ref_ml_survey",
        "student_name": "Priya Nair (Fall 2024)",
        "title": "Machine Learning Foundations",
        "chunks": [
            "Supervised learning trains a model on labelled examples so it can predict "
            "targets for unseen data, while unsupervised learning discovers structure "
            "in unlabelled data.",
            "Gradient descent iteratively adjusts model parameters in the direction "
            "that reduces the loss function, with the learning rate controlling step "
            "size.",
            "Regularisation techniques such as dropout and weight decay reduce "
            "overfitting by penalising overly complex models.",
        ],
    },
]


def _build_vector_db() -> InternalVectorDB:
    qdrant_url = os.getenv("QDRANT_URL")
    if qdrant_url:
        return InternalVectorDB(qdrant_url=qdrant_url)
    return InternalVectorDB(location=":memory:")


vector_db = _build_vector_db()
_corpus_seeded = False


def seed_reference_corpus() -> None:
    """Index the bundled reference papers once per process (idempotent)."""
    global _corpus_seeded
    if _corpus_seeded:
        return
    _corpus_seeded = True
    for entry in REFERENCE_CORPUS:
        try:
            vector_db.index_submission(**entry)
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning(f"Could not index reference document {entry['document_id']}: {exc}")
