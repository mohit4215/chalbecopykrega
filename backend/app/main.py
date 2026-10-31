import os
import uuid
import tempfile
import shutil
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.db_models import User, ScanHistory
from app.services.database import get_db_session, init_db
from app.services.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    get_optional_current_user
)
from app.services.ingestion_pipeline import (
    DocumentExtractionPipeline,
    ExtractionResult,
    IngestionPipelineError,
    UnsupportedFormatError,
    CorruptedFileError,
    EmptyDocumentError
)
from app.services.core_engine import (
    InternalVectorDB,
    LiveWebSearchClient,
    CoreNLPMatcher,
    PlagiarismDetectionEngine
)

# Initialize FastAPI application
app = FastAPI(
    title="Turnitin-Style Academic Plagiarism Detection & Auth API",
    description="Full-Stack Plagiarism Detection with JWT Authentication & Scan History Auditing.",
    version="3.0.0"
)

# Configure Cross-Origin Resource Sharing (CORS) for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------------------
# Pydantic Schemas
# ------------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, description="Minimum 6 characters")

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str

class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class PlagiarismMatchDetail(BaseModel):
    id: str
    matched_text: str
    start_index: int
    end_index: int
    similarity_score: float
    match_type: str
    source_title: str
    source_url: Optional[str] = None
    source_id: Optional[str] = None
    source_author: Optional[str] = None
    source_snippet: Optional[str] = None
    source_category: str

class PlagiarismSummary(BaseModel):
    exact_matches_count: int
    paraphrase_matches_count: int
    internet_matches_count: int

class CheckPlagiarismResponse(BaseModel):
    scan_id: Optional[str] = None
    document_id: str
    document_title: str
    overall_score: float
    originality_score: float
    total_words: int
    total_characters: int
    full_text: str
    summary: PlagiarismSummary
    matches: List[PlagiarismMatchDetail]

class ScanHistoryItem(BaseModel):
    id: str
    filename: str
    overall_score: float
    created_at: str
    report: Optional[Dict[str, Any]] = None

# ------------------------------------------------------------------------------
# Startup Lifecycle & Singletons
# ------------------------------------------------------------------------------

ingestion_pipeline = DocumentExtractionPipeline(chunk_size=50, chunk_overlap=20, enable_ocr=True)
vector_db = InternalVectorDB(location=":memory:")
web_search_client = LiveWebSearchClient()
nlp_matcher = CoreNLPMatcher()
plagiarism_engine = PlagiarismDetectionEngine(
    vector_db=vector_db,
    web_client=web_search_client,
    matcher=nlp_matcher
)

@app.on_event("startup")
async def on_startup():
    """Initializes database schema and pre-seeds reference papers."""
    await init_db()
    
    # Pre-seed internal database with standard academic reference papers
    sample_text_chunks = [
        "Deep learning is a subset of machine learning, which is essentially a neural network with three or more layers. These neural networks attempt to simulate the behavior of the human brain.",
        "Attention Is All You Need introduced the Transformer architecture based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.",
        "Convolutional neural networks are commonly used for image classification, while transformers have revolutionized natural language processing."
    ]
    vector_db.index_submission(
        document_id="doc_ref_cs101_sample",
        student_name="Alice Johnson (Spring 2025)",
        title="Introduction to Neural Architectures and Attention Mechanisms",
        chunks=sample_text_chunks
    )

# ------------------------------------------------------------------------------
# Authentication Routes (/register & /login)
# ------------------------------------------------------------------------------

@app.post("/register", response_model=AuthTokenResponse, status_code=status.HTTP_201_CREATED)
@app.post("/api/register", response_model=AuthTokenResponse, status_code=status.HTTP_201_CREATED)
async def register_user(payload: RegisterRequest, db: AsyncSession = Depends(get_db_session)):
    """Registers a new user account with hashed password and returns an access token."""
    # Check if email is already registered
    existing_user_query = select(User).where(User.email == payload.email)
    existing_res = await db.execute(existing_user_query)
    if existing_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists."
        )

    # Hash password and create record
    hashed_pwd = hash_password(payload.password)
    new_user = User(
        id=str(uuid.uuid4()),
        email=payload.email,
        hashed_password=hashed_pwd
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Issue JWT token
    token = create_access_token(data={"sub": new_user.email, "uid": new_user.id})

    return AuthTokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(id=new_user.id, email=new_user.email)
    )

@app.post("/login", response_model=AuthTokenResponse)
@app.post("/api/login", response_model=AuthTokenResponse)
async def login_user(payload: LoginRequest, db: AsyncSession = Depends(get_db_session)):
    """Authenticates credentials and returns a signed JWT access token."""
    user_query = select(User).where(User.email == payload.email)
    res = await db.execute(user_query)
    user = res.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(data={"sub": user.email, "uid": user.id})

    return AuthTokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(id=user.id, email=user.email)
    )

@app.get("/api/me", response_model=UserResponse)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    """Returns the authenticated user's profile."""
    return UserResponse(id=current_user.id, email=current_user.email)

# ------------------------------------------------------------------------------
# Protected Plagiarism Check Endpoint & Scan History Persistence
# ------------------------------------------------------------------------------

@app.post("/api/check-plagiarism", response_model=CheckPlagiarismResponse)
async def check_plagiarism_protected(
    file: UploadFile = File(..., description="Uploaded document (PDF, DOCX, or TXT)"),
    enable_web_search: bool = Form(True, description="Enable live internet cross-referencing"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Authenticated Document Scanning Endpoint:
      1. Verifies caller JWT token
      2. Ingests and normalizes document
      3. Compares against internal vector DB & live web search
      4. Saves scan report into ScanHistory table linked to current_user.id
      5. Returns overall_score, originality_score, and character index spans
    """
    filename = file.filename or "Uploaded_Document.txt"
    file_ext = os.path.splitext(filename)[1].lower()

    if file_ext not in [".pdf", ".docx", ".txt", ".md", ".rtf"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported format '{file_ext}'. Supported formats: PDF, DOCX, and TXT."
        )

    # 1. Save uploaded file to temporary path
    with tempfile.NamedTemporaryFile(suffix=file_ext, delete=False) as temp_file:
        temp_path = temp_file.name
        shutil.copyfileobj(file.file, temp_file)

    try:
        # 2. Extract and chunk text
        extraction_result: ExtractionResult = ingestion_pipeline.ingest_document(temp_path)
    except UnsupportedFormatError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except (CorruptedFileError, EmptyDocumentError) as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except IngestionPipelineError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    chunks = extraction_result.chunks
    chunk_strings = [c.text for c in chunks]

    if not chunk_strings:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Document text is too brief to generate meaningful NLP chunks for scanning."
        )

    # 3. Execute Core Detection Engine
    doc_id = str(uuid.uuid4())
    scan_report = await plagiarism_engine.scan_document_chunks(
        document_id=doc_id,
        document_title=filename,
        chunks=chunk_strings,
        enable_web_search=enable_web_search
    )

    # 4. Format matches with exact character start_index and end_index
    formatted_matches: List[PlagiarismMatchDetail] = []
    for idx, match_item in enumerate(scan_report.get("matches", [])):
        chunk_idx = match_item["chunk_index"]
        corresponding_chunk = chunks[chunk_idx]

        formatted_matches.append(PlagiarismMatchDetail(
            id=f"match_{idx}_{uuid.uuid4().hex[:6]}",
            matched_text=corresponding_chunk.text,
            start_index=corresponding_chunk.start_char,
            end_index=corresponding_chunk.end_char,
            similarity_score=match_item["confidence_score"],
            match_type=match_item["match_type"],
            source_title=match_item["source_title"],
            source_url=match_item.get("source_url"),
            source_id=match_item.get("source_id"),
            source_author=match_item.get("source_author"),
            source_snippet=match_item.get("source_snippet"),
            source_category=match_item.get("source_category", "Internet Source")
        ))

    response_payload = CheckPlagiarismResponse(
        scan_id=None,
        document_id=doc_id,
        document_title=filename,
        overall_score=scan_report["overall_plagiarism_percentage"],
        originality_score=scan_report["originality_percentage"],
        total_words=extraction_result.metadata.total_words,
        total_characters=extraction_result.metadata.total_characters_cleaned,
        full_text=extraction_result.cleaned_text,
        summary=PlagiarismSummary(
            exact_matches_count=scan_report["summary"]["exact_matches_count"],
            paraphrase_matches_count=scan_report["summary"]["paraphrase_matches_count"],
            internet_matches_count=scan_report["summary"]["internet_matches_count"]
        ),
        matches=formatted_matches
    )

    # 5. Save report to ScanHistory table linked to current_user
    scan_record = ScanHistory(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        filename=filename,
        overall_score=scan_report["overall_plagiarism_percentage"],
        report_json=response_payload.dict()
    )
    db.add(scan_record)
    await db.commit()
    await db.refresh(scan_record)

    response_payload.scan_id = scan_record.id
    return response_payload

# ------------------------------------------------------------------------------
# Scan History Endpoints (GET /api/history)
# ------------------------------------------------------------------------------

@app.get("/api/history", response_model=List[ScanHistoryItem])
async def get_user_scan_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Retrieves all past plagiarism scan audits for the authenticated user."""
    query = (
        select(ScanHistory)
        .where(ScanHistory.user_id == current_user.id)
        .order_by(ScanHistory.created_at.desc())
    )
    res = await db.execute(query)
    scans = res.scalars().all()

    items = []
    for s in scans:
        items.append(ScanHistoryItem(
            id=s.id,
            filename=s.filename,
            overall_score=round(s.overall_score, 2),
            created_at=s.created_at.isoformat() if s.created_at else "",
            report=s.report_json
        ))
    return items

@app.get("/api/history/{scan_id}", response_model=CheckPlagiarismResponse)
async def get_single_scan_report(
    scan_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Fetches the full originality report for a past scan by ID."""
    query = select(ScanHistory).where(
        ScanHistory.id == scan_id,
        ScanHistory.user_id == current_user.id
    )
    res = await db.execute(query)
    scan = res.scalar_one_or_none()

    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan report not found or does not belong to your account."
        )

    return CheckPlagiarismResponse(**scan.report_json)

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "Turnitin-Style Plagiarism Detection & Auth Engine",
        "vector_dim": vector_db.VECTOR_DIM
    }

# Static files mount for production frontend bundle
static_dist_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend/dist"))
if os.path.isdir(static_dist_path):
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=static_dist_path, html=True), name="static")
