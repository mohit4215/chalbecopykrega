import re
import numpy as np
from typing import List, Dict, Any, Tuple
from app.config import settings

class Chunk:
    def __init__(self, text: str, start_char: int, end_char: int, index: int):
        self.text = text
        self.start_char = start_char
        self.end_char = end_char
        self.index = index
        self.embedding: np.ndarray = None

class SemanticMatcher:
    """
    Semantic Paraphrase Detection Engine.
    Uses HuggingFace Sentence-Transformers (all-MiniLM-L6-v2) to map sentences/chunks
    into dense vector space and detects paraphrased matches via Cosine Similarity.
    """

    def __init__(self, model_name: str = settings.EMBEDDING_MODEL_NAME):
        self.model_name = model_name
        self._model = None

    @property
    def model(self):
        """Lazy load HuggingFace model or ONNX Engine upon first inference."""
        if self._model is None:
            try:
                from app.services.embedding_service import get_embedding_service
                svc = get_embedding_service()
                if svc.backend_type in ("onnx", "sentence-transformers"):
                    self._model = svc
                    return self._model
            except Exception:
                pass
            try:
                from sentence_transformers import SentenceTransformer
                self._model = SentenceTransformer(self.model_name)
            except Exception as e:
                print(f"[SemanticMatcher] Warning: SentenceTransformer could not be loaded ({e}). Using TF-IDF fallback.")
                self._model = "fallback"
        return self._model

    def segment_text(self, text: str, chunk_size_words: int = settings.CHUNK_SIZE_WORDS, overlap: int = settings.CHUNK_OVERLAP_WORDS) -> List[Chunk]:
        """
        Splits text into overlapping sliding word chunks while preserving
        exact start_char and end_char offsets in the original raw document.
        """
        # Find word boundaries and their character spans
        word_spans = []
        for match in re.finditer(r"\S+", text):
            word_spans.append((match.start(), match.end()))

        if not word_spans:
            return []

        chunks: List[Chunk] = []
        step = max(1, chunk_size_words - overlap)
        chunk_idx = 0

        for i in range(0, len(word_spans), step):
            window_spans = word_spans[i : i + chunk_size_words]
            if not window_spans:
                continue
            
            chunk_start = window_spans[0][0]
            chunk_end = window_spans[-1][1]
            chunk_text = text[chunk_start:chunk_end].strip()

            if len(chunk_text.split()) >= 8:  # Skip tiny fragments
                chunks.append(Chunk(
                    text=chunk_text,
                    start_char=chunk_start,
                    end_char=chunk_end,
                    index=chunk_idx
                ))
                chunk_idx += 1

            if i + chunk_size_words >= len(word_spans):
                break

        return chunks

    def compute_embeddings(self, texts: List[str]) -> np.ndarray:
        """Encodes a list of texts into normalized dense vectors (L2 normalized for fast dot product)."""
        if not texts:
            return np.empty((0, 384))

        if self.model != "fallback":
            try:
                from app.services.embedding_service import get_embedding_service
                return get_embedding_service().encode(texts)
            except Exception:
                embeddings = self.model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
                return embeddings
        else:
            # Fallback TF-IDF cosine representation if SentenceTransformers model is unavailable
            from sklearn.feature_extraction.text import TfidfVectorizer
            vec = TfidfVectorizer(max_features=384, stop_words="english")
            tfidf_matrix = vec.fit_transform(texts).toarray()
            # Normalize rows to unit length
            norms = np.linalg.norm(tfidf_matrix, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            return tfidf_matrix / norms

    @staticmethod
    def cosine_similarity(v1: np.ndarray, v2: np.ndarray) -> float:
        """Calculates cosine similarity between two unit-normalized vectors."""
        return float(np.dot(v1, v2))

    @staticmethod
    def batch_cosine_similarity(query_vec: np.ndarray, candidate_matrix: np.ndarray) -> np.ndarray:
        """Matrix-vector dot product for fast 1-to-many similarity calculation."""
        if candidate_matrix.shape[0] == 0:
            return np.array([])
        return np.dot(candidate_matrix, query_vec)
