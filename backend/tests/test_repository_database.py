"""Unit and Integration Tests for the Institutional Reference Plagiarism Database."""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import User, RepositoryDocument
from app.services.knowledge_base import sync_repository_from_db, vector_db


@pytest.mark.asyncio
async def test_repository_database_sync_and_stats(client: AsyncClient, db_session: AsyncSession):
    # Synchronize database
    seeded_count = await sync_repository_from_db(db_session)
    assert seeded_count >= 10

    # Test /api/repository/stats
    res = await client.get("/api/repository/stats")
    assert res.status_code == 200
    data = res.json()
    assert data["total_documents"] >= 10
    assert data["total_chunks"] > 20
    assert "Computer Science & AI" in data["categories"] or "Biotechnology & Medicine" in data["categories"]


@pytest.mark.asyncio
async def test_repository_documents_pagination_and_search(client: AsyncClient, db_session: AsyncSession):
    await sync_repository_from_db(db_session)

    # List documents
    res = await client.get("/api/repository/documents?page=1&limit=5")
    assert res.status_code == 200
    data = res.json()
    assert len(data["documents"]) <= 5
    assert data["total"] >= 10

    # Search for CRISPR
    search_res = await client.get("/api/repository/documents?search=CRISPR")
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert len(search_data["documents"]) >= 1
    assert "CRISPR" in search_data["documents"][0]["title"]


@pytest.mark.asyncio
async def test_add_custom_repository_document_and_detect_plagiarism(
    client: AsyncClient, 
    auth_headers: dict, 
    db_session: AsyncSession
):
    await sync_repository_from_db(db_session)

    # 1. Ingest a new unique paper into the repository database
    unique_text = (
        "The asynchronous bio-synthetic cellular membrane utilizes engineered lipid bilayers "
        "to conduct micro-molecular filtration in non-aqueous solvent solutions. "
        "Our empirical trials demonstrate continuous selective transport across varying osmotic pressure gradients."
    )
    new_doc_payload = {
        "title": "Bio-Synthetic Lipid Bilayers in Non-Aqueous Solvents",
        "author": "Dr. Sarah Lin (Harvard NanoLab)",
        "category": "Biotechnology & Medicine",
        "institution": "Harvard Nanotechnology Institute",
        "content": unique_text
    }
    create_res = await client.post("/api/repository/documents", json=new_doc_payload, headers=auth_headers)
    assert create_res.status_code == 201
    created_doc = create_res.json()
    doc_id = created_doc["id"]
    assert created_doc["title"] == new_doc_payload["title"]

    # 2. Run a plagiarism check on a student paper copying from this newly added document
    student_submission = (
        "In this semester project, we investigate how the asynchronous bio-synthetic cellular membrane utilizes "
        "engineered lipid bilayers to conduct micro-molecular filtration in non-aqueous solvent solutions. "
        "Furthermore, empirical trials demonstrate continuous selective transport across varying osmotic pressure gradients."
    )
    scan_res = await client.post(
        "/api/v1/scan",
        json={"text": student_submission, "title": "Student_Lab_Report_Copy.txt", "enable_web_search": False},
        headers=auth_headers
    )
    assert scan_res.status_code == 200
    scan_data = scan_res.json()

    # Must detect plagiarism against the newly added repository document
    assert scan_data["overall_score"] >= 50.0
    matches = scan_data["matches"]
    assert len(matches) > 0
    matched_source_titles = [m.get("source_title") for m in matches]
    assert "Bio-Synthetic Lipid Bilayers in Non-Aqueous Solvents" in matched_source_titles
