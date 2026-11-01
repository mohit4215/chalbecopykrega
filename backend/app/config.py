import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # App Settings
    APP_NAME: str = "Turnitin-Style Plagiarism Detection Engine"
    DEBUG: bool = True
    PORT: int = 8000
    
    # Internal Vector Database (PostgreSQL + pgvector)
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite+aiosqlite:///./plagiarism_auth.db"
    )
    USE_IN_MEMORY_FALLBACK: bool = True  # Allows running standalone without Postgres instance
    
    # NLP & Embedding Model
    EMBEDDING_MODEL_NAME: str = "sentence-transformers/all-MiniLM-L6-v2"
    DEVICE: str = "cpu"  # "cuda" if GPU is available

    # MLOps & Production Inference Optimization (ONNX Runtime + Process-Wide Caching)
    ONNX_MODEL_PATH: str = os.getenv("ONNX_MODEL_PATH", "models/all-MiniLM-L6-v2.onnx")
    ONNX_QUANTIZED_PATH: str = os.getenv("ONNX_QUANTIZED_PATH", "models/all-MiniLM-L6-v2-quantized.onnx")
    ONNX_INTRA_THREADS: int = int(os.getenv("ONNX_INTRA_THREADS", "4"))
    ENABLE_ONNX_EMBEDDINGS: bool = os.getenv("ENABLE_ONNX_EMBEDDINGS", "true").lower() in ("true", "1", "yes")
    EMBEDDING_CACHE_SIZE: int = int(os.getenv("EMBEDDING_CACHE_SIZE", "50000"))
    ENABLE_REDIS_EMBEDDING_CACHE: bool = os.getenv("ENABLE_REDIS_EMBEDDING_CACHE", "true").lower() in ("true", "1", "yes")
    
    # Winnowing Parameters (Exact Match Substring Fingerprinting)
    WINNOWING_K: int = 35       # K-gram character length
    WINNOWING_W: int = 25       # Window size for minimum hash selection
    
    # MinHash & LSH Parameters (Jaccard Set Similarity)
    MINHASH_NUM_PERM: int = 128
    MINHASH_THRESHOLD: float = 0.40
    
    # Semantic Matching (Paraphrase Detection)
    SEMANTIC_SIMILARITY_THRESHOLD: float = 0.82
    CHUNK_SIZE_WORDS: int = 60
    CHUNK_OVERLAP_WORDS: int = 20
    
    # External Web Cross-Referencing
    SERPAPI_API_KEY: str = os.getenv("SERPAPI_API_KEY", "")
    BING_SEARCH_API_KEY: str = os.getenv("BING_SEARCH_API_KEY", "")
    MAX_WEB_QUERIES_PER_DOC: int = 6
    WEB_VERIFY_TOP_N_RESULTS: int = 3

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
