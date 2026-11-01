"""
Unit and integration tests for customer support feedback & false-positive reporting.
Validates POST /api/feedback, admin triage endpoints, and NLP calibration metadata.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.db_models import User, Feedback
from app.services.auth import create_access_token


@pytest.mark.asyncio
async def test_submit_feedback_authenticated(client: AsyncClient, db_session: AsyncSession):
    """Authenticated user flags an incorrect plagiarism match with reason and comment."""
    user = User(
        id="usr-fb-test-01",
        email="student_tester@poach.edu",
        hashed_password="fakehashpassword",
        is_admin=False,
        subscription_tier="free"
    )
    db_session.add(user)
    await db_session.commit()

    token = create_access_token({"sub": user.email, "uid": user.id})

    payload = {
        "chunk_text": "The mitochondria is the powerhouse of the cell and produces ATP through oxidative phosphorylation.",
        "matched_source_url": "https://en.wikipedia.org/wiki/Mitochondrion",
        "source_title": "Wikipedia: Mitochondrion",
        "similarity_score": 0.88,
        "reason": "common_phrase",
        "comment": "This is a standard biological textbook definition taught in high school, not plagiarized content.",
        "scan_id": "scan-12345",
        "filename": "biology_paper_draft.docx"
    }

    response = await client.post(
        "/api/feedback",
        json=payload,
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 201
    data = response.json()
    assert data["id"] is not None
    assert data["user_id"] == "usr-fb-test-01"
    assert data["user_email"] == "student_tester@poach.edu"
    assert data["chunk_text"] == payload["chunk_text"]
    assert data["matched_source_url"] == payload["matched_source_url"]
    assert data["source_title"] == payload["source_title"]
    assert data["similarity_score"] == 0.88
    assert data["reason"] == "common_phrase"
    assert data["comment"] == payload["comment"]
    assert data["status"] == "pending"
    assert data["scan_id"] == "scan-12345"


@pytest.mark.asyncio
async def test_submit_feedback_guest(client: AsyncClient):
    """Guest / unauthenticated user can flag an incorrect match without an auth token."""
    payload = {
        "chunk_text": "Machine learning algorithms learn representations from data without explicit programming.",
        "matched_source_url": "https://arxiv.org/abs/2103.00020",
        "source_title": "Foundational AI Papers",
        "similarity_score": 0.91,
        "reason": "false_positive",
        "comment": "Quotation marks were in the original text, but parser stripped them."
    }

    response = await client.post("/api/feedback", json=payload)

    assert response.status_code == 201
    data = response.json()
    assert data["user_id"] is None
    assert data["user_email"] is None
    assert data["status"] == "pending"
    assert data["reason"] == "false_positive"


@pytest.mark.asyncio
async def test_submit_feedback_validation_error(client: AsyncClient):
    """Empty or missing chunk_text should trigger 422 Unprocessable Entity."""
    payload = {
        "chunk_text": "",  # Min length is 1
        "similarity_score": 0.85
    }

    response = await client.post("/api/feedback", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_admin_feedback_endpoints_rbac(client: AsyncClient, db_session: AsyncSession):
    """Only superadmins can list and triage feedback; standard users are blocked with 403."""
    regular_user = User(
        id="usr-regular-fb",
        email="regular@poach.edu",
        hashed_password="fakehashpassword",
        is_admin=False
    )
    admin_user = User(
        id="usr-admin-fb",
        email="admin@poach.edu",
        hashed_password="fakehashpassword",
        is_admin=True
    )
    db_session.add_all([regular_user, admin_user])
    await db_session.commit()

    reg_token = create_access_token({"sub": regular_user.email, "uid": regular_user.id})
    admin_token = create_access_token({"sub": admin_user.email, "uid": admin_user.id})

    # 1. Non-admin forbidden
    res = await client.get(
        "/api/admin/feedback",
        headers={"Authorization": f"Bearer {reg_token}"}
    )
    assert res.status_code == 403

    # 2. Admin retrieves list
    res = await client.get(
        "/api/admin/feedback",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "feedbacks" in data
    assert "total" in data
    assert "page" in data


@pytest.mark.asyncio
async def test_admin_update_feedback_status_and_notes(client: AsyncClient, db_session: AsyncSession):
    """Admin updates status to 'reviewed' and records NLP calibration notes."""
    admin_user = User(
        id="usr-admin-triage",
        email="ml_lead@poach.edu",
        hashed_password="fakehashpassword",
        is_admin=True
    )
    feedback_entry = Feedback(
        id="fb-triage-101",
        chunk_text="In this paper we demonstrate state of the art results.",
        matched_source_url="https://example.com/paper",
        similarity_score=0.86,
        reason="common_phrase",
        status="pending"
    )
    db_session.add_all([admin_user, feedback_entry])
    await db_session.commit()

    admin_token = create_access_token({"sub": admin_user.email, "uid": admin_user.id})

    update_payload = {
        "status": "reviewed",
        "admin_notes": "Identified as academic boilerplate phrase. Added to stop-phrase dictionary; raised threshold from 0.85 to 0.89."
    }

    res = await client.patch(
        f"/api/admin/feedback/{feedback_entry.id}",
        json=update_payload,
        headers={"Authorization": f"Bearer {admin_token}"}
    )

    assert res.status_code == 200
    updated_data = res.json()
    assert updated_data["status"] == "reviewed"
    assert "stop-phrase dictionary" in updated_data["admin_notes"]
