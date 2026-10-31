-- Enable pgvector extension for dense semantic vector similarity
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents Table: Stores metadata and full original content of ingested documents
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) DEFAULT 'Anonymous',
    file_hash VARCHAR(64) UNIQUE NOT NULL, -- SHA-256 for instant exact-document deduplication
    raw_text TEXT NOT NULL,
    total_characters INT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Document Chunks: Paragraph/sentence-level segments with dense vector embeddings
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    start_char INT NOT NULL,
    end_char INT NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding vector(384) NOT NULL, -- Dimensions for sentence-transformers/all-MiniLM-L6-v2
    minhash_signature BYTEA,        -- Serialized 128-hash MinHash signature
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Fast Approximate Nearest Neighbor (ANN) Index using HNSW on cosine similarity
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw 
ON document_chunks 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_chunks_document_id 
ON document_chunks (document_id);

-- Document Fingerprints Table: Stores Winnowing algorithm hashes for sub-phrase exact matching
CREATE TABLE IF NOT EXISTS document_fingerprints (
    id BIGSERIAL PRIMARY KEY,
    hash_value BIGINT NOT NULL,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_id UUID REFERENCES document_chunks(id) ON DELETE CASCADE,
    start_char INT NOT NULL,
    end_char INT NOT NULL
);

-- B-Tree Index on hash_value for O(log N) lookup of shared fingerprints
CREATE INDEX IF NOT EXISTS idx_fingerprints_hash 
ON document_fingerprints (hash_value);

CREATE INDEX IF NOT EXISTS idx_fingerprints_doc 
ON document_fingerprints (document_id);
