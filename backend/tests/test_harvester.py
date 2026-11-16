"""Tests for Academic Data Harvester & Open-Access Literature Ingestion.
Verifies integration with OpenAlex, arXiv, and fallback scholarly corpus.
"""

import pytest
from httpx import AsyncClient
from app.services.data_harvester import AcademicDataHarvester


def test_openalex_abstract_reconstruction():
    """Confirms inverted index dictionary is correctly reconstructed into linear text."""
    inverted_index = {
        "attention": [0, 4],
        "is": [1],
        "all": [2],
        "you": [3],
        "need": [5]
    }
    reconstructed = AcademicDataHarvester._reconstruct_openalex_abstract(inverted_index)
    assert reconstructed == "attention is all you attention need"


@pytest.mark.asyncio
async def test_academic_harvester_scholarly_seeds():
    """Confirms harvester returns rich academic papers matching topics."""
    papers = await AcademicDataHarvester.harvest_papers(
        topic="Transformer neural networks",
        limit=2,
        source="all"
    )
    assert len(papers) >= 1
    sample = papers[0]
    assert "title" in sample
    assert "author" in sample
    assert "full_text" in sample
    assert len(sample["full_text"].split()) >= 20
    assert "harvest_source" in sample


@pytest.mark.asyncio
async def test_harvest_topics_endpoint(client: AsyncClient):
    """Confirms the API surfaces curated research disciplines for one-click ingestion."""
    resp = await client.get("/api/repository/harvest/topics")
    assert resp.status_code == 200
    data = resp.json()
    assert "topics" in data
    assert len(data["topics"]) >= 5
    topic_ids = [t["id"] for t in data["topics"]]
    assert "ai_ml" in topic_ids
    assert "biomedical" in topic_ids


@pytest.mark.asyncio
async def test_harvest_ingestion_api_endpoint(client: AsyncClient, auth_headers: dict):
    """Confirms POST /api/repository/harvest chunks and indexes harvested papers into database."""
    resp = await client.post(
        "/api/repository/harvest",
        headers=auth_headers,
        json={
            "topic": "Quantum Computing & Entanglement",
            "limit": 2,
            "source": "all"
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["papers_ingested_count"] >= 1
    assert data["total_new_chunks"] >= 1
    assert len(data["ingested_papers"]) >= 1

    first_paper = data["ingested_papers"][0]
    assert "id" in first_paper
    assert "title" in first_paper
    assert first_paper["chunks_indexed"] >= 1
