"""Unit and Integration Tests for Commercial SaaS Features:
  1. AI Content & Synthetic Writing Detection
  2. Academic Citation & Bibliography Exclusions
  3. Developer API Keys Provisioning & Revocation
  4. Programmatic Ingestion API (/api/v1/scan)
  5. Readiness Probe (/api/health/ready)
  6. Dynamic Filter Recalculation (/api/scans/{id}/recalculate)
"""

import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession
from app.main import app
from app.services.ai_detector import AIDetectionEngine
from app.services.citation_filter import AcademicCitationFilter
from app.models.db_models import User, ScanHistory, ApiKey
from app.services.auth import hash_password, create_access_token


def test_ai_detector_short_text():
    result = AIDetectionEngine.analyze_text("Too short to evaluate accurately.")
    assert result["ai_probability"] == 0.0
    assert result["verdict"] == "Human-Authored"


def test_ai_detector_synthetic_patterns():
    ai_sample = (
        "In conclusion, it is crucial to note that machine learning delves into a myriad of multifaceted realms. "
        "Furthermore, this technology plays a pivotal role in shaping modern algorithms and serves as a reminder "
        "of human innovation. Moreover, by exploring these nuances, it underscores the importance of data ethics."
    )
    result = AIDetectionEngine.analyze_text(ai_sample)
    assert result["ai_probability"] > 40.0
    assert result["verdict"] in ["Mixed / AI-Assisted", "Likely AI-Generated", "Highly Likely AI-Generated"]
    assert len(result["sentence_analyses"]) >= 3


def test_academic_citation_filter_quotes():
    text = 'Albert Einstein famously stated: "God does not play dice with the universe" in an early letter.'
    spans = AcademicCitationFilter.detect_quoted_spans(text)
    assert len(spans) == 1
    quoted_snippet = text[spans[0][0]:spans[0][1]]
    assert "God does not play dice" in quoted_snippet


def test_academic_citation_filter_bibliography():
    doc = (
        "This is an academic study discussing modern natural language processing.\n\n"
        "References\n"
        "1. Vaswani et al. Attention is all you need. NeurIPS 2017.\n"
        "2. Devlin et al. BERT. NAACL 2019."
    )
    offset = AcademicCitationFilter.detect_bibliography_offset(doc)
    assert offset is not None
    assert offset > 0
    assert "References" in doc[offset:offset+20]


def test_academic_citation_filter_apply_filters():
    text = (
        'Here is original research text. In the words of Feynman: "Science is the belief in the ignorance of experts." '
        'References\n1. Feynman, R. 1969.'
    )
    matches = [
        {
            "id": "m1",
            "matched_text": "Science is the belief in the ignorance of experts.",
            "start_index": 57,
            "end_index": 108,
            "similarity_score": 0.98,
            "match_type": "exact_copy"
        },
        {
            "id": "m2",
            "matched_text": "small match",
            "start_index": 0,
            "end_index": 11,
            "similarity_score": 0.90,
            "match_type": "exact_copy"
        }
    ]
    res = AcademicCitationFilter.apply_filters(
        full_text=text,
        matches=matches,
        exclude_quotes=True,
        exclude_bibliography=True,
        min_match_words=5
    )
    # Both matches should be excluded (one inside quote, one small match)
    assert len(res["excluded_matches"]) == 2
    assert res["net_plagiarism_score"] == 0.0
    assert res["net_originality_score"] == 100.0


@pytest.mark.asyncio
async def test_readiness_probe_live(client: AsyncClient):
    resp = await client.get("/api/health/ready")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ready"
    assert data["checks"]["database"] == "connected"


@pytest.mark.asyncio
async def test_developer_api_keys_crud(client: AsyncClient, db_session: AsyncSession):
    # Create test user
    user = User(
        id=str(uuid.uuid4()),
        email="developer@enterprise.io",
        hashed_password=hash_password("DevPass123!"),
        scan_credits=10,
        subscription_tier="pro",
        subscription_status="active"
    )
    db_session.add(user)
    await db_session.commit()

    token = create_access_token({"sub": user.email, "uid": user.id})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create API Key
    create_resp = await client.post(
        "/api/v1/keys",
        json={"name": "Canvas LMS Key"},
        headers=headers
    )
    assert create_resp.status_code == 201
    key_data = create_resp.json()
    raw_key = key_data["api_key"]
    key_id = key_data["id"]
    assert raw_key.startswith("sk_live_")
    assert key_data["name"] == "Canvas LMS Key"

    # 2. List API Keys
    list_resp = await client.get("/api/v1/keys", headers=headers)
    assert list_resp.status_code == 200
    keys_list = list_resp.json()
    assert len(keys_list) >= 1
    assert any(k["id"] == key_id for k in keys_list)

    # 3. Use API Key to execute programmatic scan
    api_headers = {"X-API-Key": raw_key}
    scan_resp = await client.post(
        "/api/v1/scan",
        json={
            "text": "Deep learning models require extensive hyperparameter optimization and tokenization algorithms.",
            "title": "LMS_Submission.txt",
            "enable_web_search": False
        },
        headers=api_headers
    )
    assert scan_resp.status_code == 200
    scan_data = scan_resp.json()
    assert scan_data["status"] == "success"
    assert "ai_detection" in scan_data
    assert "originality_score" in scan_data

    # 4. Revoke API Key
    del_resp = await client.delete(f"/api/v1/keys/{key_id}", headers=headers)
    assert del_resp.status_code == 200

    # 5. Revoked key should now return 401
    revoked_scan = await client.post(
        "/api/v1/scan",
        json={"text": "Another document submitted with revoked key.", "enable_web_search": False},
        headers=api_headers
    )
    assert revoked_scan.status_code == 401


@pytest.mark.asyncio
async def test_recalculate_filters_endpoint(client: AsyncClient, db_session: AsyncSession):
    user = User(
        id=str(uuid.uuid4()),
        email="student_filters@test.edu",
        hashed_password=hash_password("Pass123!"),
        scan_credits=5
    )
    db_session.add(user)
    await db_session.commit()

    sample_report = {
        "overall_score": 50.0,
        "originality_score": 50.0,
        "total_words": 30,
        "full_text": 'Here is research. "This quote is fully referenced and cited." More research.',
        "matches": [
            {
                "id": "match_q1",
                "matched_text": "This quote is fully referenced and cited.",
                "start_index": 18,
                "end_index": 60,
                "similarity_score": 0.95,
                "match_type": "exact_copy"
            }
        ]
    }
    scan = ScanHistory(
        id=str(uuid.uuid4()),
        user_id=user.id,
        filename="Quote_Test.txt",
        overall_score=50.0,
        report_json=sample_report
    )
    db_session.add(scan)
    await db_session.commit()

    resp = await client.post(
        f"/api/scans/{scan.id}/recalculate",
        json={
            "exclude_quotes": True,
            "exclude_bibliography": True,
            "min_match_words": 5
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["net_plagiarism_score"] == 0.0
    assert data["net_originality_score"] == 100.0
    assert len(data["excluded_matches"]) == 1
    assert data["excluded_matches"][0]["exclusion_reason"] == "quote"
