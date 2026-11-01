"""Compliance & Privacy Tests: GDPR & CCPA Retention Purge, Account Erasure, and Data Portability."""

import pytest
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import User, ScanHistory
from app.services.storage_service import StorageService
from app.services.stripe_service import StripeService
from app.tasks.celery_worker import purge_expired_data_retention_records, execute_data_retention_purge


@pytest.mark.asyncio
class TestComplianceAndPrivacy:

    async def test_gdpr_data_export_endpoint(
        self, client: AsyncClient, test_user: User, auth_headers: dict, db_session: AsyncSession
    ):
        """GDPR Art. 20: GET /api/users/me/export returns complete JSON profile and scan records."""
        # Add a sample scan history record
        scan = ScanHistory(
            user_id=test_user.id,
            filename="Thesis_Draft_v1.pdf",
            overall_score=12.5,
            report_json={"document_title": "Thesis_Draft_v1.pdf", "total_words": 500}
        )
        db_session.add(scan)
        await db_session.commit()

        response = await client.get("/api/users/me/export", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        assert "compliance_metadata" in data
        assert "GDPR Article 20" in data["compliance_metadata"]["legal_basis"]
        assert data["account_profile"]["email"] == test_user.email
        assert data["scan_records_count"] >= 1
        assert data["scan_history"][0]["filename"] == "Thesis_Draft_v1.pdf"

    async def test_account_deletion_flow(
        self, client: AsyncClient, test_user: User, auth_headers: dict, db_session: AsyncSession, monkeypatch
    ):
        """GDPR Art. 17 & CCPA: DELETE /api/users/me hard-deletes user, scans, and cancels Stripe."""
        # 1. Seed scan record with S3 key
        scan = ScanHistory(
            user_id=test_user.id,
            filename="ResearchPaper.docx",
            overall_score=4.0,
            report_json={
                "s3_key": f"scans/{test_user.id}/scan_test.pdf",
                "file_path": f"documents/{test_user.id}/ResearchPaper.docx"
            }
        )
        db_session.add(scan)
        test_user.stripe_customer_id = "cus_mock_test123"
        db_session.add(test_user)
        await db_session.commit()

        # Mock external calls
        s3_purged = []
        monkeypatch.setattr(
            StorageService,
            "delete_files",
            lambda keys: s3_purged.extend(keys) or len(keys)
        )
        monkeypatch.setattr(
            StorageService,
            "delete_user_prefix",
            lambda uid: 2
        )
        stripe_canceled = []
        async def mock_cancel_subs(cust_id):
            stripe_canceled.append(cust_id)
            return 1
        monkeypatch.setattr(StripeService, "cancel_customer_subscriptions", mock_cancel_subs)

        # 2. Execute DELETE /api/users/me
        response = await client.delete("/api/users/me", headers=auth_headers)
        assert response.status_code == 200
        result = response.json()

        assert result["status"] == "success"
        assert result["deleted_user_id"] == test_user.id
        assert result["purged_scans_count"] >= 1

        # 3. Verify Stripe cancellation and S3 cleanup were invoked
        assert "cus_mock_test123" in stripe_canceled
        assert any("scan_test.pdf" in k for k in s3_purged)

        # 4. Verify user record is completely removed from database
        user_in_db = await db_session.scalar(select(User).where(User.id == test_user.id))
        assert user_in_db is None

        # 5. Subsequent calls with previous token must be rejected (401)
        subsequent = await client.get("/api/users/me", headers=auth_headers)
        assert subsequent.status_code == 401

    async def test_storage_service_delete_logic(self, tmp_path):
        """StorageService properly removes local files and formats S3 URIs."""
        # Test local file cleanup
        test_file = tmp_path / "temp_ocr.txt"
        test_file.write_text("sample OCR text")
        assert test_file.exists()

        success = StorageService.delete_file(str(test_file))
        assert success is True
        assert not test_file.exists()

        # Test batch delete mock
        deleted_count = StorageService.delete_files(["s3://bucket/test.pdf", "s3://bucket/doc2.pdf"])
        assert deleted_count == 2

    async def test_celery_automated_retention_purge(self, db_session: AsyncSession, test_user: User):
        """Celery Beat daily purge task deletes records older than 30 days and preserves recent ones."""
        now = datetime.now(timezone.utc)

        # Create expired record (35 days old)
        expired_scan = ScanHistory(
            id="scan_expired_1",
            user_id=test_user.id,
            filename="OldPaper.pdf",
            overall_score=8.0,
            report_json={"s3_key": "scans/old.pdf"},
            created_at=now - timedelta(days=35)
        )
        # Create recent record (5 days old)
        recent_scan = ScanHistory(
            id="scan_recent_1",
            user_id=test_user.id,
            filename="RecentPaper.pdf",
            overall_score=2.0,
            report_json={"s3_key": "scans/recent.pdf"},
            created_at=now - timedelta(days=5)
        )
        db_session.add_all([expired_scan, recent_scan])
        await db_session.commit()

        # Run purge logic with 30-day window
        result = await execute_data_retention_purge(retention_days=30, db_session=db_session)
        assert result["status"] == "completed"
        assert result["scans_purged"] >= 1

        # Expired scan must be deleted
        expired_in_db = await db_session.scalar(select(ScanHistory).where(ScanHistory.id == "scan_expired_1"))
        assert expired_in_db is None

        # Recent scan must be preserved
        recent_in_db = await db_session.scalar(select(ScanHistory).where(ScanHistory.id == "scan_recent_1"))
        assert recent_in_db is not None
