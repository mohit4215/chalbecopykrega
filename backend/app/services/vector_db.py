import uuid
import hashlib
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from app.config import settings

class VectorDatabaseManager:
    """
    Manages vector storage and similarity querying.
    Supports PostgreSQL + pgvector as primary, with a resilient in-memory
    vector and fingerprint index for standalone/local development.
    """

    def __init__(self, db_url: str = settings.DATABASE_URL):
        self.db_url = db_url
        self.use_memory = settings.USE_IN_MEMORY_FALLBACK
        
        # In-Memory Fallback Structures
        # documents: id -> {title, author, raw_text, total_characters}
        self.in_memory_docs: Dict[str, Dict[str, Any]] = {}
        # chunks: id -> {doc_id, chunk_index, start_char, end_char, text, embedding}
        self.in_memory_chunks: List[Dict[str, Any]] = []
        # fingerprints: hash_val -> list of {doc_id, start_char, end_char}
        self.in_memory_fingerprints: Dict[int, List[Dict[str, Any]]] = {}

        # Pre-seed with classic academic reference papers for instant out-of-the-box plagiarism testing
        self._seed_reference_corpus()

    def _seed_reference_corpus(self):
        """Seeds common academic and public domain papers to test detection out of the box."""
        sample_doc = (
            "Deep learning is a subset of machine learning, which is essentially a neural network with three or more layers. "
            "These neural networks attempt to simulate the behavior of the human brain, allowing it to learn from large amounts of data. "
            "While a single-layer neural network can still make approximate predictions, additional hidden layers can help optimize accuracy. "
            "Convolutional neural networks are commonly used for image classification, while transformers have revolutionized natural language processing. "
            "Attention Is All You Need introduced the Transformer architecture based solely on attention mechanisms, dispensing with recurrence and convolutions entirely."
        )
        self.insert_document_sync(
            title="Introduction to Neural Architectures and Attention Mechanisms",
            author="Academic Repository (Sample)",
            text=sample_doc,
            category="Publications"
        )

    def insert_document_sync(self, title: str, author: str, text: str, category: str = "Submitted Works") -> str:
        """Indexes a document synchronously into the vector and fingerprint store."""
        from app.services.winnowing import WinnowingEngine
        from app.services.semantic_matcher import SemanticMatcher

        doc_id = str(uuid.uuid4())
        file_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()

        self.in_memory_docs[doc_id] = {
            "id": doc_id,
            "title": title,
            "author": author,
            "raw_text": text,
            "total_characters": len(text),
            "file_hash": file_hash,
            "category": category
        }

        # Segment into chunks and compute embeddings
        matcher = SemanticMatcher()
        chunks = matcher.segment_text(text)
        if chunks:
            chunk_texts = [c.text for c in chunks]
            embeddings = matcher.compute_embeddings(chunk_texts)

            for i, chunk in enumerate(chunks):
                self.in_memory_chunks.append({
                    "chunk_id": str(uuid.uuid4()),
                    "doc_id": doc_id,
                    "doc_title": title,
                    "chunk_index": chunk.index,
                    "start_char": chunk.start_char,
                    "end_char": chunk.end_char,
                    "text": chunk.text,
                    "embedding": embeddings[i],
                    "category": category
                })

        # Winnowing fingerprints
        winnowing = WinnowingEngine(k=settings.WINNOWING_K, w=settings.WINNOWING_W)
        fingerprints = winnowing.extract_fingerprints(text)

        for fp in fingerprints:
            if fp.hash_value not in self.in_memory_fingerprints:
                self.in_memory_fingerprints[fp.hash_value] = []
            self.in_memory_fingerprints[fp.hash_value].append({
                "doc_id": doc_id,
                "doc_title": title,
                "start_char": fp.raw_start,
                "end_char": fp.raw_end,
                "category": category
            })

        return doc_id

    def search_exact_fingerprints(self, fingerprints: List[Any], exclude_doc_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Looks up matching winnowing hashes to find verbatim or near-verbatim copied passages.
        """
        matches = []
        for fp in fingerprints:
            h = fp.hash_value
            if h in self.in_memory_fingerprints:
                for hit in self.in_memory_fingerprints[h]:
                    if exclude_doc_id and hit["doc_id"] == exclude_doc_id:
                        continue
                    matches.append({
                        "query_start": fp.raw_start,
                        "query_end": fp.raw_end,
                        "source_id": hit["doc_id"],
                        "source_title": hit["doc_title"],
                        "source_start": hit["start_char"],
                        "source_end": hit["end_char"],
                        "source_category": hit.get("category", "Submitted Works")
                    })
        return matches

    def search_semantic_chunks(self, query_chunks: List[Any], query_embeddings: np.ndarray, threshold: float = settings.SEMANTIC_SIMILARITY_THRESHOLD, exclude_doc_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Performs vector cosine similarity search of query chunks against all stored document chunks.
        Detects paraphrasing where phrasing is rewritten but concepts/meanings match.
        """
        if not self.in_memory_chunks or len(query_embeddings) == 0:
            return []

        # Build candidate embedding matrix
        candidates = [c for c in self.in_memory_chunks if (not exclude_doc_id or c["doc_id"] != exclude_doc_id)]
        if not candidates:
            return []

        cand_matrix = np.array([c["embedding"] for c in candidates])

        matches = []
        for q_idx, q_chunk in enumerate(query_chunks):
            q_vec = query_embeddings[q_idx]
            sims = np.dot(cand_matrix, q_vec)

            best_idx = int(np.argmax(sims))
            best_sim = float(sims[best_idx])

            if best_sim >= threshold:
                matched_cand = candidates[best_idx]
                matches.append({
                    "start_char": q_chunk.start_char,
                    "end_char": q_chunk.end_char,
                    "matched_text": q_chunk.text,
                    "source_id": matched_cand["doc_id"],
                    "source_title": matched_cand["doc_title"],
                    "source_snippet": matched_cand["text"],
                    "similarity_score": round(best_sim, 4),
                    "match_type": "paraphrase" if best_sim < 0.94 else "exact",
                    "source_category": matched_cand.get("category", "Submitted Works")
                })

        return matches
