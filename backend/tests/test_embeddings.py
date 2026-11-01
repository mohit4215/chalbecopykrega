"""Tests for the deterministic, dependency-light hashed embedding backend."""

import numpy as np
import pytest

from app.services.core_engine import InternalVectorDB


@pytest.fixture
def hashed_db(monkeypatch):
    monkeypatch.setenv("USE_HASHED_EMBEDDINGS", "true")
    return InternalVectorDB(location=":memory:")


def test_hashed_backend_is_selected(hashed_db):
    assert hashed_db.embedding_backend == "hashed"
    assert hashed_db.model == "fallback"


def test_hashed_embeddings_are_deterministic_across_instances(monkeypatch):
    monkeypatch.setenv("USE_HASHED_EMBEDDINGS", "true")
    text = "Attention mechanisms allow transformers to model long range dependencies."

    first = InternalVectorDB(location=":memory:").generate_embeddings([text])[0]
    second = InternalVectorDB(location=":memory:").generate_embeddings([text])[0]

    assert first.shape == (InternalVectorDB.VECTOR_DIM,)
    np.testing.assert_allclose(first, second, atol=1e-6)
    assert np.isclose(float(np.linalg.norm(first)), 1.0, atol=1e-5)


def test_hashed_embeddings_rank_related_text_higher(hashed_db):
    source = "Deep neural networks learn hierarchical feature representations from data."
    paraphrase = "Neural networks learn hierarchical representations of features from data."
    unrelated = "The legal team filed a trademark dispute in a regional court."

    source_vec, paraphrase_vec, unrelated_vec = hashed_db.generate_embeddings(
        [source, paraphrase, unrelated]
    )

    related_score = float(np.dot(source_vec, paraphrase_vec))
    unrelated_score = float(np.dot(source_vec, unrelated_vec))

    assert related_score > unrelated_score
    assert related_score > 0.3
    assert -1.0 <= unrelated_score < related_score


def test_index_and_query_round_trip(hashed_db):
    hashed_db.index_submission(
        document_id="doc_ref",
        student_name="Alice",
        title="Reference paper",
        chunks=["Reinforcement learning agents maximise cumulative reward."],
    )

    query = hashed_db.generate_embeddings(
        ["Reinforcement learning agents maximise cumulative reward."]
    )[0]
    hits = hashed_db.query_similar_chunks(query, top_k=1, threshold=0.5)

    assert len(hits) == 1
    assert hits[0]["source_id"] == "doc_ref"


def test_task_runner_shares_the_api_corpus():
    """The Celery task must query the same store the API seeds on startup."""
    from app.services import knowledge_base
    from app.tasks import celery_worker

    assert celery_worker._vector_db is knowledge_base.vector_db


def test_seeded_corpus_matches_known_reference_text():
    from app.services.knowledge_base import seed_reference_corpus, vector_db

    seed_reference_corpus()
    text = (
        "Attention Is All You Need introduced the Transformer architecture based "
        "solely on attention mechanisms, dispensing with recurrence and "
        "convolutions entirely."
    )
    query = vector_db.generate_embeddings([text])[0]
    hits = vector_db.query_similar_chunks(query, top_k=3, threshold=0.5)

    assert hits, "the seeded reference corpus should be searchable"
    assert any(hit["source_id"] == "doc_ref_cs101_sample" for hit in hits)
