import io
import pytest
from unittest.mock import MagicMock, patch
from httpx import AsyncClient
from app.models.db_models import User
from app.tasks.celery_worker import process_plagiarism_document

class TestAsyncPlagiarismPipeline:
    """Tests asynchronous background task submission and status polling."""

    @pytest.mark.asyncio
    async def test_check_plagiarism_submits_async_task(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user: User
    ):
        file_bytes = b"Attention Is All You Need introduced the Transformer neural architecture."
        files = {
            "file": ("sample_paper.txt", io.BytesIO(file_bytes), "text/plain")
        }

        mock_celery_task = MagicMock()
        mock_celery_task.id = "mock_task_id_celery_12345"

        with patch("app.tasks.celery_worker.process_plagiarism_document.delay", return_value=mock_celery_task):
            response = await client.post(
                "/api/check-plagiarism",
                files=files,
                data={"enable_web_search": "false"},
                headers=auth_headers
            )
            assert response.status_code == 202
            data = response.json()
            assert data["task_id"] == "mock_task_id_celery_12345"
            assert data["status"] == "processing"
            assert "queued" in data["message"].lower()

    @pytest.mark.asyncio
    async def test_polling_task_status_pending(self, client: AsyncClient, auth_headers: dict):
        mock_async_result = MagicMock()
        mock_async_result.state = "PENDING"

        with patch("celery.result.AsyncResult", return_value=mock_async_result):
            res = await client.get("/api/task-status/task_123", headers=auth_headers)
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "pending"
            assert data["progress"] == 5

    @pytest.mark.asyncio
    async def test_polling_task_status_progress(self, client: AsyncClient, auth_headers: dict):
        mock_async_result = MagicMock()
        mock_async_result.state = "PROGRESS"
        mock_async_result.info = {
            "step": "vectorizing",
            "progress": 55,
            "message": "Generating embeddings and querying Qdrant..."
        }

        with patch("celery.result.AsyncResult", return_value=mock_async_result):
            res = await client.get("/api/task-status/task_123", headers=auth_headers)
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "processing"
            assert data["step"] == "vectorizing"
            assert data["progress"] == 55

    @pytest.mark.asyncio
    async def test_polling_task_status_success(self, client: AsyncClient, auth_headers: dict):
        mock_report = {
            "scan_id": "scan_done_123",
            "document_title": "sample_paper.txt",
            "overall_score": 15.0,
            "originality_score": 85.0,
            "matches": []
        }
        mock_async_result = MagicMock()
        mock_async_result.state = "SUCCESS"
        mock_async_result.result = mock_report

        with patch("celery.result.AsyncResult", return_value=mock_async_result):
            res = await client.get("/api/task-status/task_123", headers=auth_headers)
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "success"
            assert data["progress"] == 100
            assert data["report"]["overall_score"] == 15.0

    @pytest.mark.asyncio
    async def test_polling_task_status_failure(self, client: AsyncClient, auth_headers: dict):
        mock_async_result = MagicMock()
        mock_async_result.state = "FAILURE"
        mock_async_result.info = "Document corrupted: unreadable binary"

        with patch("celery.result.AsyncResult", return_value=mock_async_result):
            res = await client.get("/api/task-status/task_123", headers=auth_headers)
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "failure"
            assert "corrupted" in data["message"]
