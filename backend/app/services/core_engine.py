"""
Core Plagiarism Detection & NLP Matching Engine
================================================
Combines:
  1. Live Web Search Integration (SerpAPI / Bing Search)
  2. Internal Vector Database (Qdrant with SentenceTransformers all-MiniLM-L6-v2)
  3. Hybrid NLP Evaluation (N-gram Jaccard for exact copy + Dense Cosine for paraphrase)
  4. Non-Overlapping Plagiarism Scoring & Structured JSON Reporting
"""

import os
import re
import json
import logging
from importlib.util import find_spec
from typing import List, Dict, Any, Optional, Tuple, Set
import numpy as np
import httpx

# Configure logging
logging.basicConfig(level=logging.INFO, format="[%(asctime)s] [%(levelname)s] %(message)s")
logger = logging.getLogger("plagiarism.engine")


def _module_available(module_name: str) -> bool:
    """Cheap availability check that does not import (or download) the module."""
    try:
        return find_spec(module_name) is not None
    except (ImportError, ValueError):
        return False


def hashed_embeddings_enabled() -> bool:
    """Decide whether to use the lightweight hashed embedding backend.

    Order of precedence:
      1. ``USE_HASHED_EMBEDDINGS`` explicitly set (true/false) wins.
      2. On Render (``RENDER=true``) always use hashing: the free tier has
         ~512 MB RAM and loading torch + all-MiniLM-L6-v2 during startup will
         either OOM or stall the service.
      3. Otherwise use hashing only when sentence-transformers is not installed.
    """
    raw = os.getenv("USE_HASHED_EMBEDDINGS")
    if raw is not None and raw.strip() != "":
        return raw.strip().lower() in {"1", "true", "yes", "on"}
    if os.getenv("RENDER", "").strip().lower() in {"1", "true", "yes"}:
        return True
    return not _module_available("sentence_transformers")


# ==============================================================================
# 1. Live Web Search Client (SerpAPI / Bing Web Search)
# ==============================================================================

class LiveWebSearchClient:
    """
    Queries live internet sources using SerpAPI or Bing Web Search API.
    Extracts high-salience phrases, constructs exact-match ("...") and
    semantic queries, and fetches top URLs and snippet passages.
    """

    def __init__(self, serpapi_key: Optional[str] = None, bing_key: Optional[str] = None):
        self.serpapi_key = serpapi_key or os.getenv("SERPAPI_API_KEY", "")
        self.bing_key = bing_key or os.getenv("BING_SEARCH_API_KEY", "")

    @staticmethod
    def clean_query_text(text: str) -> str:
        """Removes punctuation and extra whitespace for cleaner search engine parsing."""
        return re.sub(r"[^\w\s]", "", text).strip()

    def construct_queries(self, chunk_text: str) -> Dict[str, str]:
        """
        Creates both an exact-match quoted query and an open semantic query.
        - Exact query: Quoted first 12-16 distinctive words
        - Semantic query: Salient keywords without quotes
        """
        words = chunk_text.strip().split()
        # Take a distinct window of 10-14 words
        sub_phrase = " ".join(words[:12]) if len(words) >= 12 else " ".join(words)
        
        return {
            "exact_query": f'"{sub_phrase}"',
            "semantic_query": self.clean_query_text(sub_phrase)
        }

    async def search_serpapi(self, query: str, top_k: int = 3) -> List[Dict[str, str]]:
        """Queries Google via SerpAPI."""
        url = "https://serpapi.com/search.json"
        params = {
            "q": query,
            "api_key": self.serpapi_key,
            "engine": "google",
            "num": top_k
        }
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(url, params=params)
                if resp.status_code == 200:
                    data = resp.json()
                    results = []
                    for item in data.get("organic_results", [])[:top_k]:
                        results.append({
                            "title": item.get("title", "Web Source"),
                            "url": item.get("link", ""),
                            "snippet": item.get("snippet", "")
                        })
                    return results
        except Exception as e:
            logger.warning(f"SerpAPI query error for '{query}': {e}")
        return []

    async def search_bing(self, query: str, top_k: int = 3) -> List[Dict[str, str]]:
        """Queries Bing Web Search API."""
        url = "https://api.bing.microsoft.com/v7.0/search"
        headers = {"Ocp-Apim-Subscription-Key": self.bing_key}
        params = {"q": query, "count": top_k, "responseFilter": "Webpages"}
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(url, headers=headers, params=params)
                if resp.status_code == 200:
                    data = resp.json()
                    results = []
                    for item in data.get("webPages", {}).get("value", [])[:top_k]:
                        results.append({
                            "title": item.get("name", "Web Source"),
                            "url": item.get("url", ""),
                            "snippet": item.get("snippet", "")
                        })
                    return results
        except Exception as e:
            logger.warning(f"Bing Search API query error for '{query}': {e}")
        return []

    async def search_fallback_open(self, query: str, top_k: int = 3) -> List[Dict[str, str]]:
        """
        Zero-configuration public fallback (DuckDuckGo JSON API) used when no commercial
        API keys are configured. Ensures production pipeline never fails out-of-the-box.
        """
        clean_q = query.replace('"', '')
        url = f"https://api.duckduckgo.com/?q={clean_q}&format=json"
        try:
            async with httpx.AsyncClient(timeout=2.5) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    results = []
                    if data.get("AbstractText"):
                        results.append({
                            "title": data.get("Heading", "Wikipedia / Knowledge Base"),
                            "url": data.get("AbstractURL", "https://duckduckgo.com"),
                            "snippet": data.get("AbstractText", "")
                        })
                    for topic in data.get("RelatedTopics", [])[:top_k]:
                        if "Text" in topic and "FirstURL" in topic:
                            results.append({
                                "title": topic.get("Text")[:60] + "...",
                                "url": topic.get("FirstURL"),
                                "snippet": topic.get("Text")
                            })
                    return results
        except Exception:
            pass
        return []

    async def query_web_for_chunk(self, chunk_text: str, top_k: int = 3) -> List[Dict[str, str]]:
        """
        Orchestrates exact and semantic queries across configured search providers.
        """
        queries = self.construct_queries(chunk_text)
        exact_q = queries["exact_query"]
        semantic_q = queries["semantic_query"]

        results = []
        if self.serpapi_key:
            # 1. Try exact quoted match first
            results = await self.search_serpapi(exact_q, top_k=top_k)
            if not results:
                # 2. Fall back to open semantic query
                results = await self.search_serpapi(semantic_q, top_k=top_k)
        elif self.bing_key:
            results = await self.search_bing(exact_q, top_k=top_k)
            if not results:
                results = await self.search_bing(semantic_q, top_k=top_k)
        else:
            # Open fallback
            results = await self.search_fallback_open(semantic_q, top_k=top_k)

        return results


# ==============================================================================
# 2. Internal Vector Database Client (Qdrant + SentenceTransformers)
# ==============================================================================

class InternalVectorDB:
    """
    Vector Database Manager using Qdrant (supports in-memory or remote server).
    Generates dense embeddings via SentenceTransformers ('all-MiniLM-L6-v2').
    Stores and queries past student submissions for student-to-student plagiarism checks.
    """

    COLLECTION_NAME = "student_submissions"
    VECTOR_DIM = 384

    def __init__(
        self,
        location: Optional[str] = ":memory:",
        qdrant_url: Optional[str] = None,
        model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
        **kwargs
    ):
        self.location = location
        self.qdrant_url = qdrant_url
        self.model_name = model_name
        self._model = None
        self._qdrant_client = None
        self._fallback_store = []

        # Pick the embedding backend once, at construction time. The hashed
        # backend is stateless and needs no model download, which keeps container
        # startup fast and memory-bounded on constrained hosts (e.g. Render free).
        self.embedding_backend = "hashed" if hashed_embeddings_enabled() else "sentence-transformers"
        if self.embedding_backend == "hashed":
            self._model = "fallback"
            logger.info("Using hashed bag-of-words embeddings (USE_HASHED_EMBEDDINGS).")

        self._init_qdrant()

    @property
    def model(self):
        """Lazy load HuggingFace SentenceTransformer."""
        if self._model is None:
            logger.info(f"Loading SentenceTransformer model: {self.model_name}...")
            try:
                from sentence_transformers import SentenceTransformer
                self._model = SentenceTransformer(self.model_name)
            except Exception as e:
                logger.warning(f"Could not load SentenceTransformer ({e}). Using normalized TF-IDF fallback.")
                self._model = "fallback"
        return self._model

    def _init_qdrant(self):
        """Initializes Qdrant client and provisions the vector collection."""
        try:
            from qdrant_client import QdrantClient
            from qdrant_client.models import Distance, VectorParams

            if self.qdrant_url:
                self._qdrant_client = QdrantClient(url=self.qdrant_url)
            else:
                self._qdrant_client = QdrantClient(location=self.location or ":memory:")
            
            # Create collection if it doesn't already exist
            collections = [c.name for c in self._qdrant_client.get_collections().collections]
            if self.COLLECTION_NAME not in collections:
                self._qdrant_client.create_collection(
                    collection_name=self.COLLECTION_NAME,
                    vectors_config=VectorParams(size=self.VECTOR_DIM, distance=Distance.COSINE)
                )
                logger.info(f"Initialized Qdrant collection '{self.COLLECTION_NAME}' (Cosine, dim={self.VECTOR_DIM}).")
        except Exception as e:
            logger.warning(f"Qdrant client initialization fallback: {e}. Running in-memory dictionary fallback mode.")
            self._qdrant_client = "in_memory_dict"
            self._fallback_store = []

    def generate_embeddings(self, texts: List[str]) -> np.ndarray:
        """Computes unit-normalized 384-dimensional dense vectors."""
        if not texts:
            return np.empty((0, self.VECTOR_DIM))

        if self.model != "fallback":
            return self.model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)

        return self._hashed_embeddings(texts)

    def _hashed_embeddings(self, texts: List[str]) -> np.ndarray:
        """Stateless hashing-vectorizer embeddings.

        A fitted TF-IDF vectorizer must not be used here: each call would learn a
        different vocabulary, so vectors stored during indexing would not be
        comparable with vectors produced for a later query. HashingVectorizer is
        deterministic across processes and calls, needs no fitting, and keeps the
        memory footprint flat.
        """
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
            # Guard against all-zero rows for empty / stop-word-only input.
            norms = np.linalg.norm(matrix, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            return matrix / norms
        except Exception as e:
            logger.warning(f"HashingVectorizer unavailable ({e}). Using stdlib token hashing.")
            return self._stdlib_hashed_embeddings(texts)

    def _stdlib_hashed_embeddings(self, texts: List[str]) -> np.ndarray:
        """Last-resort dependency-free embedding: stable token hashing into 384 dims."""
        import hashlib

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

    def index_submission(self, document_id: str, student_name: str, title: str, chunks: List[str]) -> int:
        """
        Embeds and indexes document chunks into the vector database.
        """
        if not chunks:
            return 0

        embeddings = self.generate_embeddings(chunks)

        if self._qdrant_client != "in_memory_dict":
            from qdrant_client.models import PointStruct
            import uuid

            points = []
            for idx, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
                point_id = str(uuid.uuid4())
                points.append(PointStruct(
                    id=point_id,
                    vector=embedding.tolist(),
                    payload={
                        "document_id": document_id,
                        "student_name": student_name,
                        "title": title,
                        "chunk_index": idx,
                        "chunk_text": chunk_text
                    }
                ))

            self._qdrant_client.upsert(
                collection_name=self.COLLECTION_NAME,
                points=points
            )
        else:
            for idx, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
                self._fallback_store.append({
                    "document_id": document_id,
                    "student_name": student_name,
                    "title": title,
                    "chunk_index": idx,
                    "chunk_text": chunk_text,
                    "vector": embedding
                })

        logger.info(f"Indexed {len(chunks)} chunks for document '{title}' by {student_name}.")
        return len(chunks)

    def query_similar_chunks(self, query_vector: np.ndarray, top_k: int = 3, threshold: float = 0.78, exclude_doc_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Searches the vector database for nearest neighbor chunks based on cosine similarity.
        """
        results = []

        if self._qdrant_client != "in_memory_dict":
            qdrant_hits = self._qdrant_client.search(
                collection_name=self.COLLECTION_NAME,
                query_vector=query_vector.tolist(),
                limit=top_k * 2,
                score_threshold=threshold
            )
            for hit in qdrant_hits:
                doc_id = hit.payload.get("document_id")
                if exclude_doc_id and doc_id == exclude_doc_id:
                    continue
                results.append({
                    "source_id": doc_id,
                    "source_title": hit.payload.get("title"),
                    "source_author": hit.payload.get("student_name"),
                    "source_snippet": hit.payload.get("chunk_text"),
                    "similarity_score": round(float(hit.score), 4),
                    "source_category": "Submitted Student Work"
                })
                if len(results) >= top_k:
                    break
        else:
            # In-memory dictionary vector search
            if not self._fallback_store:
                return []
            cand_matrix = np.array([item["vector"] for item in self._fallback_store])
            sims = np.dot(cand_matrix, query_vector)
            sorted_indices = np.argsort(sims)[::-1]

            for idx in sorted_indices[:top_k]:
                score = float(sims[idx])
                if score >= threshold:
                    item = self._fallback_store[idx]
                    if exclude_doc_id and item["document_id"] == exclude_doc_id:
                        continue
                    results.append({
                        "source_id": item["document_id"],
                        "source_title": item["title"],
                        "source_author": item["student_name"],
                        "source_snippet": item["chunk_text"],
                        "similarity_score": round(score, 4),
                        "source_category": "Submitted Student Work"
                    })

        return results


# ==============================================================================
# 3. Core NLP Matching Engine (Hybrid N-gram Jaccard & Cosine Similarity)
# ==============================================================================

class CoreNLPMatcher:
    """
    Evaluates text pairs using a two-tier comparison:
      1. N-Gram Jaccard Similarity: Detects verbatim copy-pasting (lexical overlap)
      2. Dense Embedding Cosine Similarity: Detects conceptual paraphrasing (semantic alignment)
    """

    @staticmethod
    def extract_word_ngrams(text: str, n: int = 3) -> Set[str]:
        """Extracts sequential word n-grams from cleaned text."""
        tokens = re.findall(r"\b\w+\b", text.lower())
        if len(tokens) < n:
            return {" ".join(tokens)} if tokens else set()
        return {" ".join(tokens[i : i + n]) for i in range(len(tokens) - n + 1)}

    @classmethod
    def compute_jaccard_similarity(cls, text_a: str, text_b: str, n: int = 3) -> float:
        """
        Jaccard Index over word n-grams:
        J(A, B) = |A ∩ B| / |A ∪ B|
        """
        ngrams_a = cls.extract_word_ngrams(text_a, n=n)
        ngrams_b = cls.extract_word_ngrams(text_b, n=n)

        if not ngrams_a or not ngrams_b:
            return 0.0

        intersection = len(ngrams_a & ngrams_b)
        union = len(ngrams_a | ngrams_b)
        return float(intersection / union) if union > 0 else 0.0

    @staticmethod
    def compute_cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
        """Calculates cosine similarity between two unit-normalized dense vectors."""
        return float(np.dot(vec_a, vec_b))

    @classmethod
    def evaluate_match(
        cls,
        chunk_text: str,
        chunk_vector: np.ndarray,
        candidate_text: str,
        candidate_vector: np.ndarray,
        source_metadata: Dict[str, Any],
        exact_jaccard_threshold: float = 0.55,
        paraphrase_cosine_threshold: float = 0.82
    ) -> Optional[Dict[str, Any]]:
        """
        Classifies match into 'exact_copy' or 'paraphrase' based on hybrid scoring.
        """
        jaccard_score = cls.compute_jaccard_similarity(chunk_text, candidate_text, n=3)
        cosine_score = cls.compute_cosine_similarity(chunk_vector, candidate_vector)

        # Classification rule:
        # - High Jaccard OR near-perfect Cosine => Exact Copy-Paste
        # - Low Jaccard BUT high Cosine => Semantic Paraphrase
        is_exact = (jaccard_score >= exact_jaccard_threshold) or (cosine_score >= 0.95)
        is_paraphrase = (cosine_score >= paraphrase_cosine_threshold) and not is_exact

        if not (is_exact or is_paraphrase):
            return None

        match_type = "exact_copy" if is_exact else "paraphrase"
        confidence_score = cosine_score if match_type == "paraphrase" else max(jaccard_score, cosine_score)

        return {
            "match_type": match_type,
            "confidence_score": round(confidence_score, 4),
            "jaccard_lexical_similarity": round(jaccard_score, 4),
            "cosine_semantic_similarity": round(cosine_score, 4),
            "matched_chunk_text": chunk_text,
            "source_snippet": candidate_text,
            "source_title": source_metadata.get("source_title", "Unknown Source"),
            "source_url": source_metadata.get("source_url"),
            "source_author": source_metadata.get("source_author"),
            "source_category": source_metadata.get("source_category", "Internet")
        }


# ==============================================================================
# 4. Scoring, Interval Aggregation & Orchestration Pipeline
# ==============================================================================

class PlagiarismDetectionEngine:
    """
    End-to-End Core Plagiarism Detection Pipeline.
    Orchestrates Vector DB search, Live Web Search, Hybrid NLP matching,
    and non-overlapping coverage score calculation.
    """

    def __init__(
        self,
        vector_db: InternalVectorDB,
        web_client: LiveWebSearchClient,
        matcher: CoreNLPMatcher = CoreNLPMatcher()
    ):
        self.vector_db = vector_db
        self.web_client = web_client
        self.matcher = matcher

    async def scan_document_chunks(
        self,
        document_id: str,
        document_title: str,
        chunks: List[str],
        enable_web_search: bool = True
    ) -> Dict[str, Any]:
        """
        Scans a sequence of document chunks against internal submissions and live web sources.
        """
        total_chunks = len(chunks)
        if total_chunks == 0:
            return {
                "document_id": document_id,
                "document_title": document_title,
                "total_chunks_scanned": 0,
                "plagiarized_chunks_count": 0,
                "overall_plagiarism_percentage": 0.0,
                "originality_percentage": 100.0,
                "summary": {
                    "exact_matches_count": 0,
                    "paraphrase_matches_count": 0,
                    "internet_matches_count": 0,
                },
                "matches": [],
            }

        # 1. Compute dense embeddings for all uploaded chunks
        chunk_embeddings = self.vector_db.generate_embeddings(chunks)

        matched_chunk_indices: Set[int] = set()
        detailed_matches: List[Dict[str, Any]] = []

        # 2. Iterate and evaluate each chunk
        max_web_queries = 5
        web_queries_done = 0

        for chunk_idx, (chunk_text, chunk_vec) in enumerate(zip(chunks, chunk_embeddings)):
            chunk_matched = False

            # --- Check Internal Vector Database (Student-to-Student) ---
            db_candidates = self.vector_db.query_similar_chunks(
                query_vector=chunk_vec,
                top_k=2,
                threshold=0.78,
                exclude_doc_id=document_id
            )

            for cand in db_candidates:
                cand_vec = self.vector_db.generate_embeddings([cand["source_snippet"]])[0]
                eval_result = self.matcher.evaluate_match(
                    chunk_text=chunk_text,
                    chunk_vector=chunk_vec,
                    candidate_text=cand["source_snippet"],
                    candidate_vector=cand_vec,
                    source_metadata=cand
                )
                if eval_result:
                    eval_result["chunk_index"] = chunk_idx
                    detailed_matches.append(eval_result)
                    matched_chunk_indices.add(chunk_idx)
                    chunk_matched = True
                    break  # Found high-confidence internal match for this chunk

            # --- Check Live Web Search (if enabled and not already an exact internal match) ---
            if enable_web_search and not chunk_matched and web_queries_done < max_web_queries:
                if len(chunk_text.strip().split()) >= 6:
                    web_queries_done += 1
                    try:
                        web_results = await self.web_client.query_web_for_chunk(chunk_text, top_k=2)
                        for web_res in web_results:
                            snippet = web_res.get("snippet", "")
                            if not snippet:
                                continue
                            snippet_vec = self.vector_db.generate_embeddings([snippet])[0]
                            eval_result = self.matcher.evaluate_match(
                                chunk_text=chunk_text,
                                chunk_vector=chunk_vec,
                                candidate_text=snippet,
                                candidate_vector=snippet_vec,
                                source_metadata={
                                    "source_title": web_res.get("title", "Internet Web Page"),
                                    "source_url": web_res.get("url"),
                                    "source_category": "Internet Source"
                                }
                            )
                            if eval_result:
                                eval_result["chunk_index"] = chunk_idx
                                detailed_matches.append(eval_result)
                                matched_chunk_indices.add(chunk_idx)
                                break
                    except Exception as web_err:
                        logger.warning(f"Web query for chunk {chunk_idx} failed ({web_err}); skipping.")

        # 3. Calculate Overall Scores (Non-overlapping chunk coverage)
        plagiarized_chunks_count = len(matched_chunk_indices)
        plagiarism_percentage = round((plagiarized_chunks_count / total_chunks) * 100.0, 2)
        originality_percentage = round(100.0 - plagiarism_percentage, 2)

        # Count match types
        exact_count = sum(1 for m in detailed_matches if m["match_type"] == "exact_copy")
        para_count = sum(1 for m in detailed_matches if m["match_type"] == "paraphrase")
        web_count = sum(1 for m in detailed_matches if m.get("source_category") == "Internet Source")

        # Compile structured final report
        return {
            "document_id": document_id,
            "document_title": document_title,
            "total_chunks_scanned": total_chunks,
            "plagiarized_chunks_count": plagiarized_chunks_count,
            "overall_plagiarism_percentage": plagiarism_percentage,
            "originality_percentage": originality_percentage,
            "summary": {
                "exact_matches_count": exact_count,
                "paraphrase_matches_count": para_count,
                "internet_matches_count": web_count
            },
            "matches": detailed_matches
        }


# ==============================================================================
# 5. Complete Runnable Execution Demo
# ==============================================================================

async def main():
    print("=" * 75)
    print(" Initializing Plagiarism Detection Engine (Qdrant + MiniLM + Web)")
    print("=" * 75)

    # 1. Initialize Vector DB and Web Search Client
    vdb = InternalVectorDB(location=":memory:")
    web_client = LiveWebSearchClient()
    engine = PlagiarismDetectionEngine(vector_db=vdb, web_client=web_client)

    # 2. Seed Internal Database with Previous Submissions
    print("\n[+] Seeding internal database with reference papers...")
    past_doc_1 = [
        "Convolutional neural networks are commonly used for image classification, while transformers have revolutionized natural language processing.",
        "Attention Is All You Need introduced the Transformer architecture based solely on attention mechanisms, dispensing with recurrence entirely.",
        "Stochastic gradient descent with momentum optimizes convex and non-convex loss landscapes in deep neural networks."
    ]
    vdb.index_submission(
        document_id="doc_ref_101",
        student_name="Alice Johnson (Spring 2025)",
        title="Survey of Deep Learning Architectures",
        chunks=past_doc_1
    )

    # 3. Create Sample Query Chunks from an Uploaded Document
    #   Chunk 0: Verbatim copy of Alice's paper (Exact Match)
    #   Chunk 1: Heavy paraphrase of Alice's paper with replaced synonyms (Paraphrase)
    #   Chunk 2: Verbatim quote from Wikipedia / Internet
    #   Chunk 3: 100% Original student work
    sample_uploaded_chunks = [
        # Chunk 0: Verbatim
        "Attention Is All You Need introduced the Transformer architecture based solely on attention mechanisms, dispensing with recurrence entirely.",
        
        # Chunk 1: Paraphrase (altered phrasing, preserved semantics)
        "The landmark Transformer paradigm discarded recurrent modules completely, depending exclusively on self-attention calculations to model contextual relationships.",
        
        # Chunk 2: Public knowledge / Web (matches DuckDuckGo/Wikipedia)
        "The Python programming language was conceived by Guido van Rossum in the late 1980s at Centrum Wiskunde and Informatica.",
        
        # Chunk 3: 100% Original empirical observation
        "In our benchmark experiments across 14 training epochs, quantizing model weights to 4-bit reduced GPU memory allocation by 68 percent without perceptible degradation in validation loss."
    ]

    print(f"\n[+] Running detection engine over {len(sample_uploaded_chunks)} candidate chunks...")
    report = await engine.scan_document_chunks(
        document_id="sub_candidate_999",
        document_title="Investigating Modern NLP Architectures and Quantization",
        chunks=sample_uploaded_chunks,
        enable_web_search=True
    )

    # 4. Print Structured JSON Report
    print("\n" + "=" * 75)
    print(" FINAL SCORING & ORIGINALITY AUDIT REPORT (JSON)")
    print("=" * 75)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
