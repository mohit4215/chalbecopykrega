# ==============================================================================
# Production Dockerfile for FastAPI Plagiarism Detection Backend
# Python 3.10-slim base with Tesseract-OCR & Poppler-utils for document parsing
# ==============================================================================

FROM python:3.10-slim AS base

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    HF_HOME=/app/cache/huggingface \
    PORT=8000

WORKDIR /app

# Install critical system libraries for OCR, PDF rasterization, and C-extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    tesseract-ocr \
    tesseract-ocr-eng \
    poppler-utils \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

# Optional neural embeddings / OCR extras (add requirements-ml.txt to the COPY
# above and install it here if you need the full semantic pipeline).

# Copy application source tree
COPY . .

# Expose FastAPI listening port
EXPOSE 8000

# Docker healthcheck pinging /api/health
HEALTHCHECK --interval=20s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# A single worker keeps the in-process eager task store used by the default
# CELERY_ALWAYS_EAGER=true deployment consistent. Scale horizontally with a
# real Redis broker/worker instead of adding uvicorn workers.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
