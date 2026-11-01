# Turnitin-Style Academic Plagiarism Detection Engine

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/mohit4215/chalbecopykrega)

A comprehensive, production-grade plagiarism detection system modeled after Turnitin and MOSS. Combines multi-tier NLP algorithms: **N-gram Rabin-Karp Winnowing**, **MinHash & Locality Sensitive Hashing (LSH)**, **HuggingFace Dense Semantic Embeddings (`all-MiniLM-L6-v2`)**, and **Live Internet Cross-Referencing (Bing / SERP API)** with an interactive, character-accurate React highlighting interface.

---

## Architecture Overview

```
                                      [ Uploaded Document ]
                                      (PDF, DOCX, or TXT)
                                               │
                                               ▼
                              ┌──────────────────────────────────┐
                              │  Document Extraction & Cleaning  │
                              │  (pypdf / python-docx / Offset)  │
                              └────────────────┬─────────────────┘
                                               │
                  ┌────────────────────────────┼────────────────────────────┐
                  │                            │                            │
                  ▼                            ▼                            ▼
      ┌───────────────────────┐   ┌────────────────────────┐   ┌────────────────────────┐
      │  Winnowing Algorithm  │   │  MinHash & LSH Shingle │   │ HuggingFace Embeddings │
      │  (Exact Substrings)   │   │  (Jaccard Candidate O1)│   │ (Dense Paraphrasing)   │
      └───────────┬───────────┘   └───────────┬────────────┘   └───────────┬────────────┘
                  │                            │                            │
                  ▼                            │                            ▼
      ┌───────────────────────┐                │               ┌────────────────────────┐
      │  Fingerprint Inverted │                │               │ Vector DB (pgvector /  │
      │  Lookup Table (BTree) │                │               │ HNSW Cosine Search)    │
      └───────────┬───────────┘                │               └───────────┬────────────┘
                  │                            │                            │
                  └────────────────────────────┼────────────────────────────┘
                                               │
                                               ▼
                               ┌───────────────────────────────┐
                               │ External Web Cross-Reference  │
                               │ (Bing Search / SERP / DuckAPI)│
                               └───────────────┬───────────────┘
                                               │
                                               ▼
                               ┌───────────────────────────────┐
                               │    Interval Union Engine      │
                               │  (Double-Count Elimination)   │
                               └───────────────┬───────────────┘
                                               │
                                               ▼
                               ┌───────────────────────────────┐
                               │  JSON Originality Report +    │
                               │  Exact Character Coordinates  │
                               └───────────────┬───────────────┘
                                               │
                                               ▼
                               ┌───────────────────────────────┐
                               │  React Turnitin UI Viewer     │
                               │  (Color-coded marks & diffs)  │
                               └───────────────────────────────┘
```

---

## Core Algorithmic Breakdown

### 1. Schleimer-Wilkerson-Aiken Winnowing (Exact & Near-Exact Matches)
Turnitin uses local fingerprinting to detect verbatim copying, even if words are deleted or inserted elsewhere:
- The text is stripped of non-alphanumeric characters while preserving a **direct index mapping back to raw document offsets**.
- Text is split into $k$-grams ($k = 35$).
- Each $k$-gram is hashed using 64-bit Rabin-Karp/MD5.
- A sliding window of size $w = 25$ selects the minimum hash value (breaking ties by picking the rightmost one).
- **Mathematical Guarantee**: Any shared substring of length $\ge (w + k - 1) = 59$ characters is guaranteed to be detected, while keeping fingerprint storage bounded to $O(1/w)$.

### 2. MinHash & Locality Sensitive Hashing (LSH)
- Large academic repositories contain millions of documents. Running dense vector comparison against every chunk is $O(N)$ and computationally prohibitive.
- We decompose documents into word 3-shingles and compute a 128-permutation **MinHash signature**.
- **LSH banding** groups signatures into buckets; identical buckets yield instant candidate matches in $O(1)$ time with Jaccard similarity estimation:
  $$J(A, B) = \frac{|A \cap B|}{|A \cup B|}$$

### 3. Dense Semantic Embeddings (Paraphrase Detection)
- Many students paraphrase by substituting synonyms or altering active/passive voice.
- Text is segmented into 60-word sliding windows with 20-word overlap.
- We encode chunks with **HuggingFace Sentence-Transformers (`sentence-transformers/all-MiniLM-L6-v2`)**.
- Embeddings are unit-normalized ($L_2 = 1.0$), allowing rapid vector cosine similarity:
  $$\text{Cosine}(u, v) = u \cdot v = \sum_{i=1}^{384} u_i v_i$$
- Any chunk with cosine similarity $\ge 0.82$ against reference documents or web snippets is flagged as a paraphrase match.

### 4. Non-Overlapping Interval Union (Coverage & Originality %)
If a passage matches both an internal student paper and a live website, naive summing would double-count characters and could report $>100\%$ plagiarism.
- We sort all match intervals $[s_i, e_i]$.
- Contiguous and overlapping intervals are merged:
  $$[100, 250] \cup [180, 320] \implies [100, 320]$$
- Net Plagiarized Percentage:
  $$\text{Similarity Index} = \frac{\sum_{\text{merged}} (e_j - s_j)}{\text{Total Document Length}} \times 100\%$$
- Originality Percentage $= 100\% - \text{Similarity Index}$.

---

## Directory Structure

```
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI routing & orchestration pipeline
│   │   ├── config.py                # System settings & thresholds
│   │   ├── models/
│   │   │   └── schemas.py           # Pydantic models for matches, scans, & reports
│   │   ├── services/
│   │   │   ├── document_parser.py   # PDF, DOCX, TXT extraction with offset tracking
│   │   │   ├── winnowing.py         # SWA Winnowing algorithm & clusterer
│   │   │   ├── minhash_service.py   # MinHash & LSH Jaccard index
│   │   │   ├── semantic_matcher.py  # HuggingFace MiniLM dense paraphrase engine
│   │   │   ├── web_search.py        # Bing / SerpAPI / DuckDuckGo live cross-referencer
│   │   │   └── vector_db.py         # pgvector + in-memory resilient vector manager
│   │   └── utils/
│   │       ├── text_utils.py        # Quotes, citations, & bibliography detector
│   │       └── interval_merger.py   # True disjoint interval union engine
│   ├── requirements.txt
│   ├── schema.sql                   # PostgreSQL + pgvector DDL with HNSW indexes
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx                  # Main workspace & layout state
│   │   ├── components/
│   │   │   ├── FileUpload.jsx       # File dropzone, paste tab, and filter toggles
│   │   │   ├── DocumentViewer.jsx   # Character-index highlight renderer
│   │   │   ├── SimilarityGauge.jsx  # Turnitin circular dial & source breakdown
│   │   │   ├── MatchList.jsx        # Ranked source list with jump-to-highlight
│   │   │   └── ComparisonDrawer.jsx # Side-by-side snippet diff inspector
│   ├── package.json
│   ├── vite.config.js
│   └── index.html
└── docker-compose.yml
```

---

## Quickstart & Local Setup

### 1. Prerequisites
- Python 3.10+
- Node.js 18+
- (Optional) Docker & Docker Compose for PostgreSQL + pgvector

### 2. Backend Setup
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
```

Run FastAPI server:
```bash
uvicorn app.main:app --reload --port 8000
```
*Note: If no PostgreSQL instance is detected, the engine automatically uses its built-in in-memory vector index with pre-seeded sample papers.*

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Running with Docker Compose (PostgreSQL + pgvector + FastAPI)
```bash
docker-compose up --build
```
This automatically boots:
- PostgreSQL 16 with `pgvector` extension and HNSW cosine indexes on port `5432`.
- FastAPI backend on port `8000`.

---

## API Reference

### `POST /api/scan`
Uploads a document or text and runs the full Turnitin pipeline.

**Parameters (multipart/form-data):**
- `file`: (Optional) PDF, DOCX, or TXT file.
- `raw_text_input`: (Optional) Plain text.
- `title`: Document title.
- `exclude_quotes`: Exclude text inside `""` (boolean, default: `false`).
- `exclude_bibliography`: Exclude references section (boolean, default: `true`).
- `enable_web_search`: Query external internet sources (boolean, default: `true`).

**Sample Output Payload:**
```json
{
  "document_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "title": "Modern Natural Language Processing",
  "total_characters": 1280,
  "total_words": 194,
  "overall_similarity_percentage": 34.2,
  "originality_percentage": 65.8,
  "sources_breakdown": {
    "internet_percentage": 14.5,
    "internal_db_percentage": 19.7,
    "publications_percentage": 0.0
  },
  "matches": [
    {
      "id": "exact_fa82910c",
      "start_char": 45,
      "end_char": 210,
      "matched_text": "Deep learning is a subset of machine learning, which is essentially a neural network with three or more layers...",
      "source_title": "Introduction to Neural Architectures",
      "source_id": "c3182...",
      "source_snippet": "Deep learning is a subset of machine learning...",
      "similarity_score": 1.0,
      "match_type": "exact",
      "source_category": "Submitted Works"
    }
  ],
  "raw_text": "..."
}
```

### `POST /api/ingest`
Ingests reference papers into the database to expand the plagiarism corpus.

---

## Deploying the Backend on Render

`render.yaml` describes a self-contained free-tier deployment: one Python web
service (API) and one static site (frontend). The API runs without Postgres,
Redis, or a separate worker.

| Setting | Value |
| --- | --- |
| Build command | `pip install -r backend/requirements.txt` |
| Start command | `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Health check path | `/api/health` |

Required environment variables:

```bash
DATABASE_URL=sqlite+aiosqlite:///./plagiarism_auth.db
USE_HASHED_EMBEDDINGS=true      # no torch model download on a 512 MB instance
CELERY_ALWAYS_EAGER=true        # scan inline; no Redis broker/worker needed
JWT_SECRET_KEY=<32+ random chars>
CORS_ORIGINS=https://chalbecopykrega-app.onrender.com
```

Stripe payments additionally need `STRIPE_SECRET_KEY` and
`STRIPE_WEBHOOK_SECRET`. Webhooks with an invalid signature are rejected; set
`ALLOW_UNSIGNED_WEBHOOKS=true` only for local development.

Notes for the free tier:

- SQLite lives on the instance's local disk. Attach a Render disk or set a
  managed `DATABASE_URL` (`postgresql://...` is adapted to `asyncpg`) if scan
  history must survive redeploys.
- `USE_HASHED_EMBEDDINGS` defaults to on whenever `RENDER=true` or
  `sentence-transformers` is not installed. The hashed backend detects exact
  copying and lexical overlap; install `backend/requirements-ml.txt` and set
  `USE_HASHED_EMBEDDINGS=false` for neural paraphrase detection.
- To move to the full async architecture, provision Redis, set
  `CELERY_ALWAYS_EAGER=false` plus `REDIS_URL`, and run a worker with
  `celery -A app.tasks.celery_worker.celery_app worker --loglevel=info`.

---

## Production Scaling Architecture

1. **Celery / Redis Asynchronous Task Queue**:
   Long 100-page dissertations should not block the HTTP request. Offload extraction and embedding to background Celery workers and use WebSockets to stream progress back to the user.
2. **Distributed Vector Indexing (pgvector / Milvus / Pinecone)**:
   Use HNSW (`m=16, ef_construction=64`) indexes partitioned by academic institution ID for multi-tenant isolation.
3. **Web Search Rate Limiting & Cache**:
   Hash extracted queries into Redis with a 30-day TTL to avoid duplicate search engine billings for common phrases.
