"""
Bulk Research Paper & Document Ingestion Script.

Usage:
    # 1. Ingest a directory of PDF/DOCX/TXT research papers:
    python backend/scripts/import_research_papers.py --dir ./papers

    # 2. Ingest a paper directly from a URL (e.g., Sioyek tutorial paper):
    python backend/scripts/import_research_papers.py --url https://raw.githubusercontent.com/ahrm/sioyek/main/tutorial.pdf --title "Sioyek Research Paper" --author "Ali H. R."

    # 3. Dry-run to preview chunk extraction without vectorizing:
    python backend/scripts/import_research_papers.py --dir ./papers --dry-run
"""

import os
import sys
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


def ingest_file(file_path: Path, title: str = None, author: str = None, dry_run: bool = False):
    pipeline = DocumentExtractionPipeline(chunk_size=50, chunk_overlap=20, enable_ocr=False)
    title = title or file_path.stem.replace("_", " ").title()
    author = author or "Academic Reference Library"
    doc_id = f"ref_{file_path.stem[:24]}_{abs(hash(file_path.name)) % 100000}"

    print(f"\nProcessing '{file_path.name}'...")
    try:
        extraction = pipeline.ingest_document(str(file_path))
        chunks = [c.text for c in extraction.chunks]
        
        print(f"  Pages: {extraction.metadata.page_count}")
        print(f"  Words: {extraction.metadata.total_words}")
        print(f"  Generated Chunks: {len(chunks)}")
        
        if dry_run:
            print("  [DRY RUN] Chunks generated successfully (skipping vector DB indexing).")
            if chunks:
                print(f"  Sample Chunk: {chunks[0][:120]}...")
            return len(chunks)

        if not chunks:
            print("  Warning: No extractable text found.")
            return 0

        count = vector_db.index_submission(
            document_id=doc_id,
            student_name=author,
            title=title,
            chunks=chunks
        )
        print(f"  Indexed {count} chunks into Vector DB ({vector_db.COLLECTION_NAME}).")
        return count

    except Exception as e:
        print(f"  Failed to process {file_path.name}: {e}")
        return 0


def ingest_url(url: str, title: str = None, author: str = None, dry_run: bool = False):
    print(f"\nDownloading research paper from: {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (ResearchCorpusIngest/1.0)"})
    with urllib.request.urlopen(req) as resp:
        data = resp.read()

    filename = url.split("/")[-1] or "downloaded_paper.pdf"
    if not any(filename.lower().endswith(ext) for ext in (".pdf", ".docx", ".txt")):
        filename += ".pdf"

    with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{filename}") as tmp:
        tmp.write(data)
        tmp_path = Path(tmp.name)

    try:
        return ingest_file(tmp_path, title=title or filename, author=author, dry_run=dry_run)
    finally:
        tmp_path.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description="Bulk Research Paper Ingestion Tool for Plagiarism Checker")
    parser.add_argument("--dir", type=str, help="Path to directory containing research papers (.pdf, .docx, .txt)")
    parser.add_argument("--url", type=str, help="URL of a research paper PDF to download and index")
    parser.add_argument("--title", type=str, help="Title of the paper (optional)")
    parser.add_argument("--author", type=str, help="Author/Organization of the paper (optional)")
    parser.add_argument("--dry-run", action="store_true", help="Extract and inspect chunks without indexing into vector DB")

    args = parser.parse_args()

    if not args.dir and not args.url:
        print("Please provide either --dir <directory_path> or --url <paper_url>.")
        print("Example: python backend/scripts/import_research_papers.py --url https://raw.githubusercontent.com/ahrm/sioyek/main/tutorial.pdf")
        sys.exit(1)

    total_chunks = 0
    if args.url:
        total_chunks += ingest_url(args.url, title=args.title, author=args.author, dry_run=args.dry_run)

    if args.dir:
        dir_path = Path(args.dir)
        if not dir_path.exists():
            print(f"Directory not found: {args.dir}")
            sys.exit(1)

        files = []
        for ext in ("*.pdf", "*.docx", "*.txt"):
            files.extend(dir_path.glob(f"**/{ext}"))

        print(f"Found {len(files)} research documents in {args.dir}.")
        for f in files:
            total_chunks += ingest_file(f, dry_run=args.dry_run)

    print("\n" + "=" * 60)
    print(f"Completed! Total chunks processed: {total_chunks}")
    print("=" * 60)


if __name__ == "__main__":
    main()
