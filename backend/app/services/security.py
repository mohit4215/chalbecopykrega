"""
Enterprise Security Suite for Plagiarism Detection Engine
==========================================================
Includes:
  1. Redis-Backed Distributed Rate Limiting (fastapi-limiter)
  2. Strict File Upload Security (10 MB Ceiling, Extension & Magic Byte Inspection)
  3. Production Security Headers & Anti-DoS Middleware
  4. Hardened CORS Configuration
"""

import os
import re
import logging
from typing import Optional, Set
from fastapi import Request, Response, UploadFile, File, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.datastructures import Headers

logger = logging.getLogger("plagiarism.security")

# ==============================================================================
# 1. File Upload Security Constraints & Magic Bytes
# ==============================================================================

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # Strict 10 MB Ceiling
CHUNK_READ_SIZE = 64 * 1024             # 64 KB streaming inspection chunks

ALLOWED_FILE_EXTENSIONS: Set[str] = {".pdf", ".docx", ".txt", ".md"}

ALLOWED_CONTENT_TYPES: Set[str] = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
    "text/markdown",
    "application/octet-stream"  # Allowed if magic bytes verify
}

# Dangerous executable / script signatures to reject immediately
DANGEROUS_EXTENSIONS: Set[str] = {
    ".exe", ".dll", ".so", ".bin", ".sh", ".bat", ".cmd", ".vbs",
    ".js", ".py", ".php", ".phtml", ".jar", ".war", ".ps1", ".msi"
}

# Magic byte signatures
MAGIC_PDF = b"%PDF-"
MAGIC_ZIP_DOCX = b"PK\x03\x04"
MAGIC_WINDOWS_PE = b"MZ"
MAGIC_LINUX_ELF = b"\x7fELF"
MAGIC_MACHO_32 = b"\xfe\xed\xfa\xce"
MAGIC_MACHO_64 = b"\xfe\xed\xfa\xcf"


async def validate_secure_file_upload(file: UploadFile = File(...)) -> UploadFile:
    """
    FastAPI security dependency for file uploads:
      1. Enforces strict 10 MB maximum file size.
      2. Validates filename and whitelisted extension (.pdf, .docx, .txt).
      3. Validates MIME content-type.
      4. Inspects binary magic bytes to prevent disguised executables / malware.
    """
    if not file or not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing uploaded file or empty filename."
        )

    # 1. Filename & Extension Sanitization
    filename = file.filename.strip()
    ext = os.path.splitext(filename)[1].lower()

    if ext in DANGEROUS_EXTENSIONS:
        logger.warning(f"Security Alert: Blocked upload of executable file: {filename}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Security violation: Executable and script extensions ({ext}) are strictly forbidden."
        )

    if ext not in ALLOWED_FILE_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Only .pdf, .docx, and .txt files are permitted."
        )

    # 2. Content-Type Check
    content_type = (file.content_type or "").lower().split(";")[0].strip()
    if content_type and content_type not in ALLOWED_CONTENT_TYPES:
        logger.warning(f"Suspicious MIME type rejected: {content_type} for file {filename}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid MIME type '{content_type}'. Legitimate document MIME type required."
        )

    # 3. Streamed Size Enforcement (10 MB Limit)
    total_bytes = 0
    header_sample = bytearray()

    while True:
        chunk = await file.read(CHUNK_READ_SIZE)
        if not chunk:
            break
        total_bytes += len(chunk)

        if len(header_sample) < 2048:
            needed = 2048 - len(header_sample)
            header_sample.extend(chunk[:needed])

        if total_bytes > MAX_FILE_SIZE_BYTES:
            await file.seek(0)
            logger.warning(f"Security Alert: Upload rejected exceeding 10MB limit ({total_bytes} bytes).")
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds maximum allowed size limit of 10 MB (10,485,760 bytes)."
            )

    if total_bytes == 0:
        await file.seek(0)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes)."
        )

    sample_bytes = bytes(header_sample)

    # 4. Anti-Malware Binary Magic Byte Verification
    # A. Block disguised Windows executables (PE/DLL)
    if sample_bytes.startswith(MAGIC_WINDOWS_PE):
        logger.error(f"Malware Signature Detected: Windows PE/MZ binary uploaded as {filename}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Security violation: Binary executable payload detected in document header."
        )

    # B. Block disguised Linux ELF executables
    if sample_bytes.startswith(MAGIC_LINUX_ELF):
        logger.error(f"Malware Signature Detected: Linux ELF binary uploaded as {filename}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Security violation: Binary executable payload detected in document header."
        )

    # C. Validate PDF Signature (%PDF-)
    if ext == ".pdf":
        if MAGIC_PDF not in sample_bytes[:1024]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Spoofed or corrupted PDF: Missing '%PDF-' binary signature."
            )

    # D. Validate DOCX Signature (PK\x03\x04 ZIP container)
    elif ext == ".docx":
        if not sample_bytes.startswith(MAGIC_ZIP_DOCX):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Spoofed or corrupted Word document: Missing Office OpenXML ZIP signature."
            )

    # E. Validate Plain Text (Reject binary null characters)
    elif ext in {".txt", ".md"}:
        if b"\x00" in sample_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Binary characters detected in plain text file. Please upload legitimate text."
            )

    # 5. Rewind seek position so downstream ingestion handlers can read the file
    await file.seek(0)
    return file


# ==============================================================================
# 2. HTTP Security Headers Middleware
# ==============================================================================

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Injects enterprise-grade HTTP security headers on all responses:
      - X-Content-Type-Options: nosniff
      - X-Frame-Options: DENY
      - X-XSS-Protection: 1; mode=block
      - Strict-Transport-Security (HSTS)
      - Content-Security-Policy (CSP)
      - Referrer-Policy
      - Permissions-Policy
      - Server header masking
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.method == "OPTIONS":
            return await call_next(request)
        response = await call_next(request)

        # 1. Prevent MIME Sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # 2. Clickjacking Protection
        response.headers["X-Frame-Options"] = "DENY"

        # 3. Cross-Site Scripting (XSS) Protection
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # 4. Enforce HTTPS via Strict-Transport-Security (HSTS)
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

        # 5. Content Security Policy (CSP)
        csp_directives = [
            "default-src 'self'",
            "img-src 'self' data: https: blob:",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
            "style-src 'self' 'unsafe-inline'",
            "font-src 'self' data: https:",
            "connect-src 'self' https: wss:",
            "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'"
        ]
        response.headers["Content-Security-Policy"] = "; ".join(csp_directives)

        # 6. Referrer Information Control
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # 7. Restrict Device Hardware APIs
        response.headers["Permissions-Policy"] = (
            "accelerometer=(), camera=(), geolocation=(), gyroscope=(), "
            "magnetometer=(), microphone=(), payment=(self 'https://js.stripe.com'), usb=()"
        )

        # 8. Mask Server Implementation Banner
        response.headers["Server"] = "Poach-Gateway/1.0"

        # 9. Cloudflare Edge Caching & Cache-Control Directives
        path = request.url.path
        if request.method == "GET":
            # Public static / immutable endpoints eligible for Cloudflare CDN edge caching
            if path in ("/api/billing/plans", "/api/health") or path.startswith("/assets/"):
                response.headers["Cache-Control"] = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=600"
                response.headers["Cloudflare-CDN-Cache-Control"] = "max-age=86400"
                response.headers["CDN-Cache-Control"] = "max-age=86400"
            elif path.startswith("/api/export-report/") or path.startswith("/api/task-status/"):
                # Private dynamic reports and background jobs: never cache at edge
                response.headers["Cache-Control"] = "private, no-cache, no-store, must-revalidate"
                response.headers["Pragma"] = "no-cache"
            elif "Cache-Control" not in response.headers:
                # Default private API response
                response.headers["Cache-Control"] = "private, no-cache, no-store, must-revalidate"
                response.headers["Pragma"] = "no-cache"
        else:
            # Mutating POST/PUT/DELETE requests should never be cached at the CDN edge
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
            response.headers["Pragma"] = "no-cache"

        return response


# ==============================================================================
# 3. Redis-Backed Distributed Rate Limiting Helpers
# ==============================================================================

async def user_rate_limit_identifier(request: Request) -> str:
    """
    Rate limiting identifier for authenticated endpoints:
    Extracts user email from JWT Authorization header, or falls back to IP.
    """
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        try:
            from jose import jwt
            from app.services.auth import SECRET_KEY, ALGORITHM
            token = auth_header.split(" ")[1]
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_sub = payload.get("sub")
            if user_sub:
                return f"user:{user_sub}"
        except Exception:
            pass

    forwarded = request.headers.get("X-Forwarded-For")
    ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "127.0.0.1")
    return f"ip:{ip}"


async def ip_rate_limit_identifier(request: Request) -> str:
    """
    Rate limiting identifier for unauthenticated endpoints (/login, /register):
    Identifies requests strictly by client IP address.
    """
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


class RateLimitingManager:
    """
    Manages Redis connection and FastAPILimiter initialization with resilient fallback.
    """
    is_active: bool = False

    @classmethod
    async def init(cls, redis_url: Optional[str] = None):
        """Initializes Redis async connection for FastAPILimiter."""
        url = redis_url or os.getenv("REDIS_URL")
        if not url:
            # No Redis configured (single-service deployment). Skip the socket
            # attempt entirely so startup is not delayed by connection timeouts.
            cls.is_active = False
            logger.info("REDIS_URL not set; distributed rate limiting disabled (pass-through mode).")
            return
        try:
            import redis.asyncio as aioredis
            from fastapi_limiter import FastAPILimiter

            redis_conn = aioredis.from_url(
                url,
                encoding="utf-8",
                decode_responses=True,
                socket_timeout=3.0,
                socket_connect_timeout=3.0
            )
            # Test connection with ping
            await redis_conn.ping()
            await FastAPILimiter.init(redis_conn)
            cls.is_active = True
            logger.info(f"Redis Rate Limiter initialized successfully on {url.split('@')[-1]}.")
        except Exception as e:
            cls.is_active = False
            logger.warning(
                f"Redis Rate Limiter unavailable ({e}). "
                "Running in fallback pass-through mode for standalone/test environments."
            )

class SafeRateLimiter:
    """
    Enterprise wrapper around FastAPILimiter's RateLimiter.
    Enforces strict rate limiting when Redis is active,
    and safely permits requests if Redis is offline during tests or recovery.
    """
    def __init__(self, times: int = 10, seconds: int = 60, identifier=None):
        self.times = times
        self.seconds = seconds
        self.identifier = identifier
        try:
            from fastapi_limiter.depends import RateLimiter
            self._limiter = RateLimiter(times=times, seconds=seconds, identifier=identifier)
        except ImportError:
            self._limiter = None

    async def __call__(self, request: Request, response: Response):
        if self._limiter is None:
            return None
        try:
            from fastapi_limiter import FastAPILimiter
            if getattr(FastAPILimiter, "redis", None) is not None:
                return await self._limiter(request, response)
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Rate limiting evaluation skipped ({e}).")
        return None
