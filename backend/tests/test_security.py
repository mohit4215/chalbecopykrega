import io
import pytest
from httpx import AsyncClient
from fastapi import HTTPException, UploadFile
from app.services.security import (
    validate_secure_file_upload,
    user_rate_limit_identifier,
    ip_rate_limit_identifier,
    MAX_FILE_SIZE_BYTES
)

class TestSecurityHeadersAndCORS:
    """Verifies injection of security headers and CORS policy."""

    @pytest.mark.asyncio
    async def test_security_headers_injected(self, client: AsyncClient):
        response = await client.get("/api/health")
        assert response.status_code == 200

        # Verify enterprise security headers
        headers = response.headers
        assert headers.get("X-Content-Type-Options") == "nosniff"
        assert headers.get("X-Frame-Options") == "DENY"
        assert headers.get("X-XSS-Protection") == "1; mode=block"
        assert "max-age=31536000" in headers.get("Strict-Transport-Security", "")
        assert "default-src 'self'" in headers.get("Content-Security-Policy", "")
        assert headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"


class TestFileUploadSecurity:
    """Tests file size restrictions, extension checks, and magic byte validation."""

    @pytest.mark.asyncio
    async def test_valid_text_file_passes(self):
        content = b"This is legitimate academic research text without binary characters."
        upload = UploadFile(filename="essay.txt", file=io.BytesIO(content))
        
        validated = await validate_secure_file_upload(upload)
        assert validated.filename == "essay.txt"
        data = await validated.read()
        assert data == content

    @pytest.mark.asyncio
    async def test_file_exceeding_10mb_rejected_with_413(self):
        # Create a mock stream exceeding 10 MB limit
        oversized_content = b"A" * (MAX_FILE_SIZE_BYTES + 1024)
        upload = UploadFile(filename="oversized_paper.txt", file=io.BytesIO(oversized_content))

        with pytest.raises(HTTPException) as exc_info:
            await validate_secure_file_upload(upload)
        assert exc_info.value.status_code == 413
        assert "10 MB" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_forbidden_executable_extension_rejected(self):
        upload = UploadFile(filename="exploit.exe", file=io.BytesIO(b"MZ\x90\x00"))
        with pytest.raises(HTTPException) as exc_info:
            await validate_secure_file_upload(upload)
        assert exc_info.value.status_code == 400
        assert "strictly forbidden" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_disguised_executable_rejected_by_magic_bytes(self):
        # File renamed to .txt but actually a Windows PE executable starting with MZ
        fake_txt_content = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff"
        upload = UploadFile(filename="malware_disguised.txt", file=io.BytesIO(fake_txt_content))

        with pytest.raises(HTTPException) as exc_info:
            await validate_secure_file_upload(upload)
        assert exc_info.value.status_code == 400
        assert "executable" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_spoofed_pdf_missing_header_rejected(self):
        # File named .pdf but missing %PDF- magic bytes
        fake_pdf = b"Just plain text pretending to be a PDF"
        upload = UploadFile(filename="fake.pdf", file=io.BytesIO(fake_pdf))

        with pytest.raises(HTTPException) as exc_info:
            await validate_secure_file_upload(upload)
        assert exc_info.value.status_code == 400
        assert "%PDF-" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_spoofed_docx_missing_zip_header_rejected(self):
        # File named .docx but missing PK\x03\x04 signature
        fake_docx = b"Corrupted docx document without zip signature"
        upload = UploadFile(filename="corrupt.docx", file=io.BytesIO(fake_docx))

        with pytest.raises(HTTPException) as exc_info:
            await validate_secure_file_upload(upload)
        assert exc_info.value.status_code == 400
        assert "ZIP signature" in exc_info.value.detail


class TestRateLimiterIdentifiers:
    """Tests rate limiter key extraction and client tracking."""

    @pytest.mark.asyncio
    async def test_ip_identifier_extracts_client_or_forwarded(self):
        class MockRequest:
            headers = {"X-Forwarded-For": "203.0.113.195, 10.0.0.1"}
            client = None

        key = await ip_rate_limit_identifier(MockRequest())
        assert key == "203.0.113.195"

    @pytest.mark.asyncio
    async def test_user_identifier_extracts_jwt_subject(self):
        from app.services.auth import create_access_token
        token = create_access_token(data={"sub": "researcher@oxford.ac.uk"})

        class MockAuthRequest:
            headers = {"Authorization": f"Bearer {token}"}
            client = None

        key = await user_rate_limit_identifier(MockAuthRequest())
        assert key == "user:researcher@oxford.ac.uk"
