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
    {
        "document_id": "doc_ref_sioyek_technical",
        "student_name": "Ali H. R. (ahrm/sioyek)",
        "title": "Sioyek: Research-Oriented Document Viewer Architecture",
        "chunks": [
            "Sioyek is a document viewer designed for reading research papers and technical books, featuring portal navigation for non-linear reading across document sections.",
            "Portals allow linking paragraphs to referenced figures, tables, or mathematical formulas elsewhere in the text, displaying them without losing reading context.",
            "Smart table of contents and outline extraction automatically parses document structures, enabling fast keyboard-centric movement across complex scientific literature.",
            "Visual marks and ruler lines allow researchers to maintain line-level focus when reading complex mathematical derivations and multi-column academic papers.",
        ],
    },
    {
        "document_id": "doc_ref_mandelbrot_chaos",
        "student_name": "Benoit B. Mandelbrot et al. (Springer)",
        "title": "Fractals and Chaos: The Mandelbrot Set and Beyond",
        "chunks": [
            "The Mandelbrot set is defined in the complex plane as the set of complex numbers c for which the function f_c(z) = z^2 + c does not diverge when iterated from z = 0.",
            "Fractal geometry characterizes irregular natural phenomena that exhibit self-similarity across varying scales of magnification.",
            "Iterative polynomial dynamics reveal connected bifurcation boundaries and chaotic boundary structures in complex mathematical spaces.",
            "Topological boundaries of the Mandelbrot set remain infinitely detailed under continuous zoom transformations while maintaining bounded measure.",
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
