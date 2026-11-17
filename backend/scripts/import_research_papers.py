"""
Bulk Research Paper & Document Ingestion Script (Enterprise Multi-Source Edition).

Enriches Poach's reference database with research papers from:
1. Local directories of PDF, DOCX, and TXT papers
2. Direct remote URLs to open-access PDFs
3. Live open-access academic APIs (OpenAlex, arXiv, Semantic Scholar, Crossref)

Usage:
    # 1. Harvest across all 8 curated academic disciplines:
    python backend/scripts/import_research_papers.py --harvest-all --limit 5

    # 2. Harvest specific topic from open-access APIs:
    python backend/scripts/import_research_papers.py --harvest "deep learning transformer" --limit 10 --source all

    # 3. Ingest a directory of local PDFs/DOCX/TXT:
    python backend/scripts/import_research_papers.py --dir ./papers

    # 4. Ingest a paper directly from a URL:
    python backend/scripts/import_research_papers.py --url https://arxiv.org/pdf/1706.03762.pdf --title "Attention Is All You Need" --author "Vaswani et al."
"""

import os
import sys
import uuid
import asyncio
import argparse
import urllib.request
import tempfile
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.services.ingestion_pipeline import DocumentExtractionPipeline
from app.services.knowledge_base import vector_db
from app.services.data_harvester import AcademicDataHarvester
from app.services.database import AsyncSessionLocal, init_db
from app.models.db_models import RepositoryDocument


def chunk_text_sliding_window(text: str, chunk_size: int = 50, overlap: int = 20):
    words = text.split()
    step = max(1, chunk_size - overlap)
    chunks = []
    for i in range(0, len(words), step):
        c = " ".join(words[i:i + chunk_size])
        if len(c.split()) >= 5:
            chunks.append(c)
    return chunks


async def persist_document_to_db(doc_id: str, title: str, author: str, category: str, institution: str, full_text: str, chunks_count: int, words_count: int):
    try:
        async with AsyncSessionLocal() as session:
            doc = RepositoryDocument(
                id=doc_id,
                title=title[:250],
                author=author[:250],
                category=category[:95],
                institution=institution[:250],
                full_text=full_text,
                word_count=words_count,
                chunk_count=chunks_count,
                is_active=True
            )
            session.add(doc)
            await session.commit()
            return True
    except Exception as e:
        print(f"    (Database persistence note: {e})")
        return False


def ingest_file_sync(file_path: Path, title: str = None, author: str = None, dry_run: bool = False):
    pipeline = DocumentExtractionPipeline(chunk_size=50, chunk_overlap=20, enable_ocr=False)
    title = title or file_path.stem.replace("_", " ").title()
    author = author or "Academic Reference Library"
    doc_id = f"doc_{uuid.uuid4().hex[:12]}"

    print(f"\nProcessing '{file_path.name}'...")
    try:
        extraction = pipeline.ingest_document(str(file_path))
        chunks = [c.text for c in extraction.chunks]
        full_text = "\n\n".join(chunks)
        word_count = extraction.metadata.total_words
        
        print(f"  Pages: {extraction.metadata.page_count}")
        print(f"  Words: {word_count}")
        print(f"  Generated Chunks: {len(chunks)}")
        
        if dry_run:
            print("  [DRY RUN] Chunks generated successfully (skipping DB indexing).")
            return len(chunks)

        if not chunks:
            print("  Warning: No extractable text found.")
            return 0

        # 1. Index into Vector DB
        count = vector_db.index_submission(
            document_id=doc_id,
            student_name=author,
            title=title,
            chunks=chunks,
            category="Local Research Paper"
        )

        # 2. Persist to SQL Database
        asyncio.run(persist_document_to_db(
            doc_id=doc_id,
            title=title,
            author=author,
            category="Local Research Paper",
            institution="Local Paper Archive",
            full_text=full_text,
            chunks_count=len(chunks),
            words_count=word_count
        ))

        print(f"  Indexed {count} chunks into Vector DB & Database.")
        return count

    except Exception as e:
        print(f"  Failed to process {file_path.name}: {e}")
        return 0


def ingest_url_sync(url: str, title: str = None, author: str = None, dry_run: bool = False):
    print(f"\nDownloading research paper from: {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (ResearchCorpusIngest/1.0)"})
    with urllib.request.urlopen(req) as resp:
        data = resp.read()

    filename = url.split("/")[-1].split("?")[0] or "downloaded_paper.pdf"
    if not any(filename.lower().endswith(ext) for ext in (".pdf", ".docx", ".txt")):
        filename += ".pdf"

    with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{filename}") as tmp:
        tmp.write(data)
        tmp_path = Path(tmp.name)

    try:
        return ingest_file_sync(tmp_path, title=title or filename, author=author, dry_run=dry_run)
    finally:
        tmp_path.unlink(missing_ok=True)


async def harvest_and_ingest(topic: str, limit: int = 10, source: str = "all", dry_run: bool = False):
    print(f"\nHarvesting open-access papers on topic: '{topic}' [Source: {source}, Limit: {limit}]...")
    papers = await AcademicDataHarvester.harvest_papers(topic=topic, limit=limit, source=source)

    if not papers:
        print(f"  No papers found for topic '{topic}'.")
        return 0

    print(f"  Retrieved {len(papers)} candidate papers from APIs. Processing & vectorizing...")
    total_chunks = 0

    for idx, paper in enumerate(papers, 1):
        content = paper["full_text"].strip()
        words = content.split()
        chunks = chunk_text_sliding_window(content, chunk_size=50, overlap=20)
        doc_id = f"doc_{uuid.uuid4().hex[:12]}"

        print(f"  [{idx}/{len(papers)}] '{paper['title'][:55]}...' ({len(words)} words, {len(chunks)} chunks)")

        if dry_run:
            total_chunks += len(chunks)
            continue

        # 1. Index into Vector DB
        vector_db.index_submission(
            document_id=doc_id,
            student_name=paper["author"],
            title=paper["title"],
            chunks=chunks,
            category=paper.get("category", "Academic Research")
        )

        # 2. Persist to SQL Database
        await persist_document_to_db(
            doc_id=doc_id,
            title=paper["title"],
            author=paper["author"],
            category=paper.get("category", "Academic Research"),
            institution=paper.get("institution", "Open Access Repository"),
            full_text=content,
            chunks_count=len(chunks),
            words_count=len(words)
        )

        total_chunks += len(chunks)

    print(f"  Harvest complete for '{topic}'. Indexed {len(papers)} papers ({total_chunks} chunks).")
    return total_chunks


async def harvest_all_curated(per_topic_limit: int = 5, dry_run: bool = False):
    topics = AcademicDataHarvester.CURATED_TOPICS
    print("=" * 65)
    print(f"Automated Multi-Discipline Scholarly Harvest: {len(topics)} Academic Domains")
    print("=" * 65)

    grand_total_chunks = 0
    for t in topics:
        topic_name = t["label"]
        query = t["query"]
        print(f"\n--- Discipline: {topic_name} ---")
        chunks = await harvest_and_ingest(topic=query, limit=per_topic_limit, source="all", dry_run=dry_run)
        grand_total_chunks += chunks

    return grand_total_chunks


def main():
    parser = argparse.ArgumentParser(description="Bulk Research Paper Ingestion Tool for Plagiarism Checker")
    parser.add_argument("--dir", type=str, help="Path to directory containing research papers (.pdf, .docx, .txt)")
    parser.add_argument("--url", type=str, help="URL of a research paper PDF to download and index")
    parser.add_argument("--harvest", type=str, help="Topic or query to harvest from academic APIs (OpenAlex, arXiv, S2ORC, Crossref)")
    parser.add_argument("--harvest-all", action="store_true", help="Harvest across all 8 curated academic disciplines automatically")
    parser.add_argument("--limit", type=int, default=5, help="Number of papers to harvest per query (default: 5)")
    parser.add_argument("--source", type=str, default="all", choices=["all", "openalex", "arxiv", "semanticscholar", "crossref"], help="Specific repository source to query")
    parser.add_argument("--title", type=str, help="Title of the paper (optional for --url)")
    parser.add_argument("--author", type=str, help="Author/Organization of the paper (optional for --url)")
    parser.add_argument("--dry-run", action="store_true", help="Extract and inspect chunks without indexing into vector DB")

    args = parser.parse_args()

    if not args.dir and not args.url and not args.harvest and not args.harvest_all:
        print("Poach Bulk Research Paper & Academic Corpus Ingestion Tool")
        print("\nOptions:")
        print("  1. Harvest all 8 academic domains:   python backend/scripts/import_research_papers.py --harvest-all --limit 5")
        print("  2. Harvest a specific topic:         python backend/scripts/import_research_papers.py --harvest 'transformers' --limit 10")
        print("  3. Ingest a directory of files:      python backend/scripts/import_research_papers.py --dir ./my_papers")
        print("  4. Ingest a direct PDF URL:          python backend/scripts/import_research_papers.py --url https://arxiv.org/pdf/1706.03762.pdf")
        sys.exit(0)

    # Initialize DB tables if needed
    asyncio.run(init_db())

    total_chunks = 0

    if args.harvest_all:
        total_chunks = asyncio.run(harvest_all_curated(per_topic_limit=args.limit, dry_run=args.dry_run))

    elif args.harvest:
        total_chunks = asyncio.run(harvest_and_ingest(topic=args.harvest, limit=args.limit, source=args.source, dry_run=args.dry_run))

    elif args.url:
        total_chunks = ingest_url_sync(args.url, title=args.title, author=args.author, dry_run=args.dry_run)

    elif args.dir:
        dir_path = Path(args.dir)
        if not dir_path.exists():
            print(f"Directory not found: {args.dir}")
            sys.exit(1)

        files = []
        for ext in ("*.pdf", "*.docx", "*.txt"):
            files.extend(dir_path.glob(f"**/{ext}"))

        print(f"Found {len(files)} research documents in {args.dir}.")
        for f in files:
            total_chunks += ingest_file_sync(f, dry_run=args.dry_run)

    print("\n" + "=" * 65)
    print(f"Completed! Total new chunks processed and indexed: {total_chunks}")
    print("=" * 65)


if __name__ == "__main__":
    main()
