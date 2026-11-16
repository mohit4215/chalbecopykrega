"""Tests for Academic Data Harvester & Open-Access Literature Ingestion.
Verifies integration with OpenAlex, arXiv, Semantic Scholar, Crossref, and fallback scholarly corpus.
"""

from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from httpx import AsyncClient, Response
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


def test_strip_markup_removes_jats_and_html():
    """Confirms JATS XML and HTML markup is cleanly stripped from abstracts."""
    raw = "<jats:title>Abstract</jats:title><jats:p>Deep learning advances <bold>neural</bold> representations across multiple modalities.</jats:p>"
    clean = AcademicDataHarvester._strip_markup(raw)
    assert "<" not in clean
    assert ">" not in clean
    assert clean == "Abstract Deep learning advances neural representations across multiple modalities."


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
async def test_semantic_scholar_harvest_mocked():
    """Confirms Semantic Scholar API response is parsed into canonical repository documents."""
    mock_payload = {
        "data": [
            {
                "paperId": "abc12345",
                "title": "Foundation Models for Generalist Visual Reasoning",
                "authors": [{"name": "Alex Vaswani"}, {"name": "Sara Hooker"}],
                "abstract": "We evaluate multimodal foundation models on diverse visual benchmarks and quantify transfer efficiency across disparate zero-shot vision and language evaluation environments.",
                "venue": "NeurIPS",
                "year": 2024,
                "openAccessPdf": {"url": "https://arxiv.org/pdf/2401.12345.pdf"}
            }
        ]
    }

    mock_resp = MagicMock(spec=Response)
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_payload

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        results = await AcademicDataHarvester.harvest_semantic_scholar(topic="foundation models", limit=2)

        assert len(results) == 1
        p = results[0]
        assert p["title"] == "Foundation Models for Generalist Visual Reasoning"
        assert "Alex Vaswani" in p["author"]
        assert "Sara Hooker" in p["author"]
        assert "NeurIPS (2024)" in p["institution"]
        assert p["harvest_source"] == "Semantic Scholar (S2ORC)"
        assert p["source_url"] == "https://arxiv.org/pdf/2401.12345.pdf"


@pytest.mark.asyncio
async def test_crossref_harvest_mocked():
    """Confirms Crossref API response with JATS XML is parsed into canonical repository documents."""
    mock_payload = {
        "message": {
            "items": [
                {
                    "title": ["Algorithmic Transparency in Autonomous Governance"],
                    "author": [{"given": "Elena", "family": "Rostova"}],
                    "abstract": "<jats:p>Autonomous decision systems require formal verification protocols to prevent discriminatory divergence in civic resource allocation.</jats:p>",
                    "container-title": ["Journal of AI Ethics & Policy"],
                    "DOI": "10.1000/182",
                    "URL": "https://doi.org/10.1000/182"
                }
            ]
        }
    }

    mock_resp = MagicMock(spec=Response)
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_payload

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        results = await AcademicDataHarvester.harvest_crossref(topic="autonomous governance", limit=2)

        assert len(results) == 1
        p = results[0]
        assert p["title"] == "Algorithmic Transparency in Autonomous Governance"
        assert p["author"] == "Elena Rostova"
        assert "<jats:p>" not in p["full_text"]
        assert "Autonomous decision systems" in p["full_text"]
        assert "DOI: 10.1000/182" in p["institution"]
        assert p["harvest_source"] == "Crossref Global DOI Registry"


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


@pytest.mark.asyncio
async def test_harvest_ingestion_api_crossref_source(client: AsyncClient, auth_headers: dict):
    """Confirms POST /api/repository/harvest functions when specific source is requested."""
    resp = await client.post(
        "/api/repository/harvest",
        headers=auth_headers,
        json={
            "topic": "CRISPR-Cas9 Gene Editing",
            "limit": 1,
            "source": "crossref"
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["source_used"] == "crossref"
    assert data["papers_ingested_count"] >= 1
