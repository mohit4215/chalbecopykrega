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

        with patch("app.main.AsyncResult", return_value=mock_async_result):
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

        with patch("app.main.AsyncResult", return_value=mock_async_result):
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

        with patch("app.main.AsyncResult", return_value=mock_async_result):
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

        with patch("app.main.AsyncResult", return_value=mock_async_result):
            res = await client.get("/api/task-status/task_123", headers=auth_headers)
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "failure"
            assert "corrupted" in data["message"]

    @pytest.mark.asyncio
    async def test_polling_eager_task_store_progress_and_success(
        self,
        client: AsyncClient,
        auth_headers: dict
    ):
        from app.tasks.celery_worker import record_eager_result, EAGER_TASK_STORE

        eager_id = "test_eager_progress_task_456"
        record_eager_result(
            task_id=eager_id,
            state="PROGRESS",
            step="vectorizing",
            progress=55,
            message="Generating embeddings and querying the vector database..."
        )

        res = await client.get(f"/api/task-status/{eager_id}", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "processing"
        assert data["step"] == "vectorizing"
        assert data["progress"] == 55
        assert "embeddings" in data["message"].lower()

        # Update to SUCCESS
        mock_report = {
            "scan_id": "eager_scan_789",
            "document_title": "test_eager.txt",
            "overall_score": 0.0,
            "originality_score": 100.0,
            "matches": []
        }
        record_eager_result(
            task_id=eager_id,
            state="SUCCESS",
            result=mock_report,
            step="completed",
            progress=100,
            message="Plagiarism analysis completed successfully!"
        )

        res_success = await client.get(f"/api/task-status/{eager_id}", headers=auth_headers)
        assert res_success.status_code == 200
        succ_data = res_success.json()
        assert succ_data["status"] == "success"
        assert succ_data["step"] == "completed"
        assert succ_data["progress"] == 100
        assert succ_data["report"]["scan_id"] == "eager_scan_789"

        # Cleanup
        EAGER_TASK_STORE.pop(eager_id, None)

    @pytest.mark.asyncio
    async def test_eager_background_task_submission(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user: User
    ):
        from app.tasks.celery_worker import EAGER_TASK_STORE
        file_bytes = b"This is a genuine research document about transformers and attention."
        files = {
            "file": ("eager_sample.txt", io.BytesIO(file_bytes), "text/plain")
        }

        # Submitting without mocking delay tests eager BackgroundTask dispatch
        response = await client.post(
            "/api/check-plagiarism",
            files=files,
            data={"enable_web_search": "false"},
            headers=auth_headers
        )
        assert response.status_code == 202
        data = response.json()
        task_id = data["task_id"]
        assert task_id.startswith("task_")
        assert data["status"] == "processing"
        assert task_id in EAGER_TASK_STORE

        # Cleanup
        EAGER_TASK_STORE.pop(task_id, None)

    def test_websocket_task_status_streaming(self):
        from starlette.testclient import TestClient
        from app.main import app
        from app.services.task_stream import publish_task_event, EAGER_TASK_STORE

        test_task_id = "ws_test_task_001"
        publish_task_event(
            task_id=test_task_id,
            event={
                "task_id": test_task_id,
                "status": "processing",
                "step": "extracting",
                "progress": 20,
                "message": "Extracting text and applying OCR...",
            }
        )

        with TestClient(app) as test_client:
            with test_client.websocket_connect(f"/ws/task-status/{test_task_id}") as websocket:
                data = websocket.receive_json()
                assert data["task_id"] == test_task_id
                assert data["status"] == "processing"
                assert data["step"] == "extracting"

        EAGER_TASK_STORE.pop(test_task_id, None)
