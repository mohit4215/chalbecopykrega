"""MLOps Production Embedding Service: Singleton, Multi-Tier Caching & Batch Deduplication.

Architecture:
1. Thread-Safe Model Singleton:
   Guarantees the heavy embedding model is loaded once per worker process using
   double-checked locking, completely eliminating per-task reload overhead.
2. Two-Tier Caching Strategy:
   - L1: Process-local thread-safe LRU Cache (cachetools.LRUCache).
   - L2: Distributed Redis cache storing raw binary float32 buffers for cross-worker sharing.
3. Intra-Document Batch Deduplication:
   Extracts unique uncached chunks, executes vectorized inference once, and reassembles
   the full matrix in O(1), dramatically increasing processing throughput.
4. Adaptive Fallback Hierarchy:
   ONNX Runtime (Fastest CPU) -> PyTorch SentenceTransformer -> Deterministic HashingVectorizer.
"""

import os
import re
import hashlib
import logging
import threading
from typing import List, Dict, Optional, Tuple, Any
import numpy as np
from cachetools import LRUCache

from app.config import settings

logger = logging.getLogger("mlops.embedding_service")


class EmbeddingCache:
    """
    Two-Tier Caching System:
    - Tier 1: In-memory LRU Cache (nanosecond access, memory bounded)
    - Tier 2: Redis binary vector cache (sub-millisecond, distributed across worker replicas)
    """

    def __init__(
        self,
        max_l1_size: int = settings.EMBEDDING_CACHE_SIZE,
        enable_redis: bool = settings.ENABLE_REDIS_EMBEDDING_CACHE,
        redis_ttl_seconds: int = 604800,  # 7 days
    ):
        self._l1_cache: LRUCache = LRUCache(maxsize=max_l1_size)
        self._lock = threading.Lock()
        self.enable_redis = enable_redis
        self.redis_ttl = redis_ttl_seconds
        self._redis_client = None

        # Telemetry
        self.hits_l1 = 0
        self.hits_l2 = 0
        self.misses = 0

        if self.enable_redis:
            self._init_redis()

    def _init_redis(self):
        redis_url = os.getenv("REDIS_URL")
        if not redis_url:
            return
        try:
            import redis
            self._redis_client = redis.Redis.from_url(redis_url, socket_connect_timeout=1.5)
            self._redis_client.ping()
            logger.info("EmbeddingCache: Connected to L2 Redis distributed vector cache.")
        except Exception as exc:
            logger.debug(f"EmbeddingCache: Redis L2 unavailable ({exc}). Using L1 only.")
            self._redis_client = None

    @staticmethod
    def hash_text(text: str) -> str:
        """Computes deterministic 64-char hex digest of normalized string."""
        normalized = " ".join(text.strip().lower().split())
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    def get(self, text_hash: str) -> Optional[np.ndarray]:
        """Lookup embedding in L1 then L2."""
        with self._lock:
            # Check L1 (In-Memory)
            if text_hash in self._l1_cache:
                self.hits_l1 += 1
                return self._l1_cache[text_hash]

        # Check L2 (Redis)
        if self._redis_client is not None:
            try:
                raw_bytes = self._redis_client.get(f"emb_vec:{text_hash}")
                if raw_bytes:
                    vec = np.frombuffer(raw_bytes, dtype=np.float32).copy()
                    with self._lock:
                        self._l1_cache[text_hash] = vec
                    self.hits_l2 += 1
                    return vec
            except Exception:
                pass

        with self._lock:
            self.misses += 1
        return None

    def put(self, text_hash: str, embedding: np.ndarray):
        """Stores embedding in L1 and asynchronously in L2."""
        clean_vec = embedding.astype(np.float32)
        with self._lock:
            self._l1_cache[text_hash] = clean_vec

        if self._redis_client is not None:
            try:
                self._redis_client.setex(
                    f"emb_vec:{text_hash}",
                    self.redis_ttl,
                    clean_vec.tobytes()
                )
            except Exception:
                pass

    def get_stats(self) -> Dict[str, Any]:
        with self._lock:
            total = self.hits_l1 + self.hits_l2 + self.misses
            hit_rate = ((self.hits_l1 + self.hits_l2) / total * 100) if total > 0 else 0.0
            return {
                "l1_size": len(self._l1_cache),
                "l1_max": self._l1_cache.maxsize,
                "hits_l1": self.hits_l1,
                "hits_l2": self.hits_l2,
                "misses": self.misses,
                "hit_rate_pct": round(hit_rate, 2),
            }


class EmbeddingModelSingleton:
    """
    Process-Wide Model Singleton with Double-Checked Locking.
    Ensures that background Celery workers and FastAPI threads share a single
    in-memory neural engine without redundant reloads or memory fragmentation.
    """

    _instance = None
    _init_lock = threading.Lock()

    VECTOR_DIM = 384

    def __init__(self):
        self.backend_type: str = "none"
        self._onnx_engine = None
        self._torch_model = None
        self._hashed_engine = None
        self.cache = EmbeddingCache()

        self._load_best_available_backend()

    @classmethod
    def get_instance(cls) -> "EmbeddingModelSingleton":
        """Thread-safe double-checked singleton accessor."""
        if cls._instance is None:
            with cls._init_lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    @classmethod
    def reset_instance(cls):
        """For testing and benchmarking lifecycle isolation."""
        with cls._init_lock:
            cls._instance = None

    def _load_best_available_backend(self):
        """
        Resolution Hierarchy:
        1. ONNX Runtime Engine (if enabled and model file exists)
        2. SentenceTransformers PyTorch Model (if installed and not disabled)
        3. Stateless HashingVectorizer (stateless, zero-dependency fallback)
        """
        # Tier 1: Try ONNX Runtime Engine
        if settings.ENABLE_ONNX_EMBEDDINGS:
            try:
                from app.services.onnx_engine import OnnxEmbeddingEngine
                engine = OnnxEmbeddingEngine()
                if engine.is_ready:
                    self._onnx_engine = engine
                    self.backend_type = "onnx"
                    logger.info(f"Loaded ONNX Embedding Engine (Model: {engine.model_path})")
                    return
            except Exception as onnx_err:
                logger.debug(f"ONNX Engine init skipped: {onnx_err}")

        # Tier 2: Try PyTorch SentenceTransformer
        if os.getenv("USE_HASHED_EMBEDDINGS", "").lower() not in ("true", "1", "yes"):
            try:
                from sentence_transformers import SentenceTransformer
                logger.info(f"Loading PyTorch SentenceTransformer: {settings.EMBEDDING_MODEL_NAME}...")
                self._torch_model = SentenceTransformer(settings.EMBEDDING_MODEL_NAME)
                self.backend_type = "sentence-transformers"
                return
            except Exception as torch_err:
                logger.debug(f"PyTorch SentenceTransformer unavailable: {torch_err}")

        # Tier 3: Deterministic HashingVectorizer Fallback
        self.backend_type = "hashed"
        logger.info("Loaded HashingVectorizer fallback for stateless zero-overhead embeddings.")

    def _generate_hashed_embeddings(self, texts: List[str]) -> np.ndarray:
        """Deterministic unit-normalized bag-of-words hashing fallback."""
        if not texts:
            return np.empty((0, self.VECTOR_DIM), dtype=np.float32)

        try:
            from sklearn.feature_extraction.text import HashingVectorizer
            vectorizer = HashingVectorizer(
                n_features=self.VECTOR_DIM,
                alternate_sign=False,
                norm="l2",
                ngram_range=(1, 2),
                stop_words="english",
            )
            matrix = vectorizer.transform(texts).toarray().astype(np.float32)
            norms = np.linalg.norm(matrix, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            return matrix / norms
        except Exception:
            # Absolute zero-dependency token hashing fallback
            matrix = np.zeros((len(texts), self.VECTOR_DIM), dtype=np.float32)
            for row, text in enumerate(texts):
                for token in re.findall(r"\b\w+\b", (text or "").lower()):
                    digest = hashlib.md5(token.encode("utf-8")).digest()
                    bucket = int.from_bytes(digest[:4], "little") % self.VECTOR_DIM
                    matrix[row, bucket] += 1.0
                norm = float(np.linalg.norm(matrix[row]))
                if norm > 0:
                    matrix[row] /= norm
            return matrix

    def _raw_inference(self, texts: List[str]) -> np.ndarray:
        """Dispatches un-cached texts directly to the active inference engine."""
        if not texts:
            return np.empty((0, self.VECTOR_DIM), dtype=np.float32)

        if self.backend_type == "onnx" and self._onnx_engine is not None:
            return self._onnx_engine.encode(texts)

        if self.backend_type == "sentence-transformers" and self._torch_model is not None:
            return self._torch_model.encode(
                texts,
                convert_to_numpy=True,
                normalize_embeddings=True
            ).astype(np.float32)

        return self._generate_hashed_embeddings(texts)

    def encode(self, texts: List[str], use_cache: bool = True) -> np.ndarray:
        """
        High-Throughput Embedding Entrypoint:
        1. Query Two-Tier Cache for all chunks
        2. Deduplicate uncached chunks within the current batch
        3. Run batch neural inference on strictly missing chunks
        4. Populate L1 & L2 caches
        5. Reassemble complete matrix in exact input order
        """
        if not texts:
            return np.empty((0, self.VECTOR_DIM), dtype=np.float32)

        num_texts = len(texts)
        result_matrix = np.zeros((num_texts, self.VECTOR_DIM), dtype=np.float32)

        if not use_cache:
            return self._raw_inference(texts)

        # 1. Check cache and identify misses
        hashes = [self.cache.hash_text(t) for t in texts]
        miss_indices: List[int] = []
        unique_uncached_texts: Dict[str, str] = {}  # hash -> text

        for idx, (text, h) in enumerate(zip(texts, hashes)):
            cached_vec = self.cache.get(h)
            if cached_vec is not None:
                result_matrix[idx] = cached_vec
            else:
                miss_indices.append(idx)
                if h not in unique_uncached_texts:
                    unique_uncached_texts[h] = text

        # 2. If all chunks hit the cache, return immediately
        if not miss_indices:
            return result_matrix

        # 3. Perform batched inference on unique uncached items only
        uncached_hashes = list(unique_uncached_texts.keys())
        uncached_texts = list(unique_uncached_texts.values())

        computed_vecs = self._raw_inference(uncached_texts)

        # 4. Store newly computed vectors in cache and populate result matrix
        computed_map = {}
        for h, vec in zip(uncached_hashes, computed_vecs):
            self.cache.put(h, vec)
            computed_map[h] = vec

        for idx in miss_indices:
            h = hashes[idx]
            result_matrix[idx] = computed_map[h]

        return result_matrix

    def warmup(self):
        """Warm-up routine to initialize thread pools, JIT caches, and weights in memory."""
        logger.info(f"Warming up embedding model singleton ({self.backend_type})...")
        dummy_passages = [
            "Warmup passage for production model pre-heating.",
            "Benchmarking unit normalization and thread execution."
        ]
        _ = self.encode(dummy_passages, use_cache=False)
        logger.info("Embedding model singleton is warm and ready for high-throughput scanning.")


def get_embedding_service() -> EmbeddingModelSingleton:
    """Convenience accessor for the process-wide embedding singleton."""
    return EmbeddingModelSingleton.get_instance()
