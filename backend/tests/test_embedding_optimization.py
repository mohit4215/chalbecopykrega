"""Tests for MLOps embedding optimizations: ONNX Runtime, Model Singleton, and Caching."""

import os
import threading
import numpy as np
import pytest

from app.services.embedding_service import (
    EmbeddingModelSingleton,
    EmbeddingCache,
    get_embedding_service,
)
from app.services.onnx_engine import OnnxEmbeddingEngine
from app.mlops.export_onnx import build_synthetic_onnx_model


@pytest.fixture(autouse=True)
def reset_singleton():
    """Ensure clean singleton and cache state across tests."""
    EmbeddingModelSingleton.reset_instance()
    yield
    EmbeddingModelSingleton.reset_instance()


def test_embedding_model_singleton_identity():
    """Double-checked locking singleton must return identical instance across calls and threads."""
    svc1 = get_embedding_service()
    svc2 = get_embedding_service()
    assert svc1 is svc2
    assert id(svc1) == id(svc2)

    instances = []

    def fetch_instance():
        instances.append(get_embedding_service())

    threads = [threading.Thread(target=fetch_instance) for _ in range(10)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert all(inst is svc1 for inst in instances)


def test_embedding_cache_l1_hit_and_telemetry():
    """Cache must store and return identical unit vectors in O(1) time."""
    svc = get_embedding_service()
    sample_text = "Transformers utilize self-attention mechanisms to process tokens simultaneously."

    # First encode: cache miss
    vec_miss = svc.encode([sample_text])[0]
    initial_misses = svc.cache.misses

    # Second encode: cache hit
    vec_hit = svc.encode([sample_text])[0]
    assert svc.cache.hits_l1 >= 1

    # Vectors must be strictly identical
    np.testing.assert_allclose(vec_miss, vec_hit, atol=1e-6)

    stats = svc.cache.get_stats()
    assert stats["hits_l1"] >= 1
    assert stats["hit_rate_pct"] > 0.0


def test_intra_document_batch_deduplication():
    """Duplicate chunks in a single document must only be computed once and reassembled."""
    svc = get_embedding_service()
    chunk_a = "Attention Is All You Need introduced Transformer models."
    chunk_b = "Gradient descent updates weights iteratively in deep networks."

    # Document batch with intentional duplicates
    batch = [chunk_a, chunk_b, chunk_a, chunk_b, chunk_a]
    embeddings = svc.encode(batch)

    assert embeddings.shape == (5, 384)
    # Check that identical chunks yield identical vectors in the reassembled output
    np.testing.assert_allclose(embeddings[0], embeddings[2], atol=1e-6)
    np.testing.assert_allclose(embeddings[0], embeddings[4], atol=1e-6)
    np.testing.assert_allclose(embeddings[1], embeddings[3], atol=1e-6)


def test_onnx_synthetic_model_inference_and_normalization(tmp_path):
    """Synthetic ONNX sentence embedding graph must execute in ONNX Runtime and output unit vectors."""
    pytest.importorskip("onnx")
    onnx_file = str(tmp_path / "synthetic_minilm.onnx")
    build_synthetic_onnx_model(onnx_file, dim=384)

    engine = OnnxEmbeddingEngine(model_path=onnx_file, num_threads=2)
    assert engine.is_ready

    texts = [
        "First scientific passage regarding deep generative models.",
        "Second passage regarding convolutional neural networks."
    ]
    vecs = engine.encode(texts)

    assert vecs.shape == (2, 384)
    # Verify strict unit normalization (L2 norm == 1.0)
    for i in range(2):
        norm = float(np.linalg.norm(vecs[i]))
        assert np.isclose(norm, 1.0, atol=1e-4)


def test_onnx_int8_dynamic_quantization_pipeline(tmp_path):
    """Dynamic INT8 quantization must produce a functional, smaller model."""
    pytest.importorskip("onnx")
    from onnxruntime.quantization import quantize_dynamic, QuantType

    fp32_file = str(tmp_path / "model_fp32.onnx")
    int8_file = str(tmp_path / "model_int8.onnx")
    build_synthetic_onnx_model(fp32_file, dim=384)

    quantize_dynamic(
        model_input=fp32_file,
        model_output=int8_file,
        weight_type=QuantType.QInt8
    )

    assert os.path.exists(int8_file)
    engine_quant = OnnxEmbeddingEngine(model_path=int8_file, num_threads=1)
    assert engine_quant.is_ready

    vecs = engine_quant.encode(["Quantized ONNX inference test chunk."])
    assert vecs.shape == (1, 384)
    assert np.isclose(float(np.linalg.norm(vecs[0])), 1.0, atol=1e-4)


def test_concurrent_worker_threads_safety():
    """Worker threads concurrently encoding text must not encounter race conditions."""
    svc = get_embedding_service()
    errors = []

    def worker_job(worker_id):
        try:
            chunks = [f"Worker {worker_id} passage number {i} analyzing machine learning." for i in range(5)]
            # Also include shared chunk across workers to stress concurrent cache access
            chunks.append("Universal shared literature citation for concurrent stress testing.")
            vecs = svc.encode(chunks)
            assert vecs.shape == (6, 384)
            for v in vecs:
                assert np.isclose(float(np.linalg.norm(v)), 1.0, atol=1e-4)
        except Exception as e:
            errors.append(e)

    threads = [threading.Thread(target=worker_job, args=(w,)) for w in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(errors) == 0, f"Thread errors encountered: {errors}"


def test_model_warmup_execution():
    """Warmup routine executes cleanly to prime CPU thread pools and caches."""
    svc = get_embedding_service()
    svc.warmup()
    # Confirm it remains functional after warmup
    out = svc.encode(["Post warmup test sentence."])
    assert out.shape == (1, 384)
