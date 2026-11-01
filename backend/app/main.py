import os
import uuid
import tempfile
import shutil
import io
import logging
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Request, Header, Query, status
from fastapi.responses import StreamingResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool
import functools

from app.config import settings
from app.models.db_models import User, ScanHistory
from app.services.database import get_db_session, init_db
from app.services.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    get_optional_current_user,
    get_admin_user
)
from app.services.stripe_service import StripeService, PLANS
from app.services.pdf_generator import PDFReportGenerator
from app.services.ingestion_pipeline import (
    DocumentExtractionPipeline,
    ExtractionResult,
    IngestionPipelineError,
    UnsupportedFormatError,
    CorruptedFileError,
    EmptyDocumentError
)
from app.services.core_engine import (
    LiveWebSearchClient,
    CoreNLPMatcher,
    PlagiarismDetectionEngine
)
from app.services.knowledge_base import vector_db, seed_reference_corpus
from app.services.security import (
    validate_secure_file_upload,
    SecurityHeadersMiddleware,
    RateLimitingManager,
    SafeRateLimiter,
    user_rate_limit_identifier,
    ip_rate_limit_identifier
)
from app.tasks.celery_worker import (
    celery_app,
    process_plagiarism_document,
    EAGER_TASK_STORE,
    record_eager_result,
)
from celery.result import AsyncResult

logger = logging.getLogger("plagiarism.main")

# Initialize FastAPI application
app = FastAPI(
    title="Turnitin-Style Plagiarism Detection & SaaS Monetization API",
    description="Originality checking with Stripe Subscriptions, Credits, and Webhook fulfillment.",
    version="4.0.0"
)

# ------------------------------------------------------------------------------
# Security Architecture: Hardened CORS & Enterprise HTTP Security Headers
# ------------------------------------------------------------------------------

raw_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:5173,http://localhost:5174,http://127.0.0.1:3000,http://127.0.0.1:5173,https://chalbecopykrega-app.onrender.com"
)
allowed_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$|^https://.*\.onrender\.com$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Enforce HTTP security headers (CSP, HSTS, X-Content-Type-Options nosniff, X-Frame-Options DENY)
app.add_middleware(SecurityHeadersMiddleware)

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
    subscription_tier: str
    subscription_status: str
    scan_credits: int
    has_active_subscription: bool
    is_admin: bool = False
    is_banned: bool = False

# ------------------------------------------------------------------------------
# Superadmin Pydantic Schemas
# ------------------------------------------------------------------------------

class AdminStatsResponse(BaseModel):
    total_users: int
    active_pro_users: int
    total_scans_all_time: int
    total_scans_today: int
    total_scans_month: int
    mrr_usd: float
    stripe_synced: bool
    daily_scans: List[Dict[str, Any]]
    system_health: Dict[str, Any]

class AdminUserItem(BaseModel):
    id: str
    email: str
    is_admin: bool
    is_banned: bool
    subscription_tier: str
    subscription_status: str
    scan_credits: int
    created_at: str
    total_scans: int

class AdminUsersListResponse(BaseModel):
    users: List[AdminUserItem]
    total: int
    page: int
    pages: int

class AdminCreditUpdateRequest(BaseModel):
    action: str = Field(..., description="'grant', 'revoke', or 'set'")
    amount: int = Field(..., ge=0)

class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class CheckoutSessionRequest(BaseModel):
    plan_id: str = Field("pro_monthly", description="'pro_monthly', 'credits_25', or 'credits_100'")
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None

class CheckoutSessionResponse(BaseModel):
    checkout_url: str
    session_id: str

class CustomerPortalRequest(BaseModel):
    return_url: Optional[str] = None

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
    remaining_credits: int
    subscription_tier: str
    full_text: str
    summary: PlagiarismSummary
    matches: List[PlagiarismMatchDetail]

class ScanHistoryItem(BaseModel):
    id: str
    filename: str
    overall_score: float
    created_at: str
    report: Optional[Dict[str, Any]] = None

class TaskSubmissionResponse(BaseModel):
    task_id: str
    status: str
    message: str
    filename: str

class TaskStatusResponse(BaseModel):
    task_id: str
    status: str  # 'pending', 'processing', 'success', 'failure'
    step: Optional[str] = None
    progress: int = 0
    message: Optional[str] = None
    report: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

# ------------------------------------------------------------------------------
# Singletons & Startup Lifecycle
# ------------------------------------------------------------------------------

ingestion_pipeline = DocumentExtractionPipeline(chunk_size=50, chunk_overlap=20, enable_ocr=True)
web_search_client = LiveWebSearchClient()
nlp_matcher = CoreNLPMatcher()
plagiarism_engine = PlagiarismDetectionEngine(
    vector_db=vector_db,
    web_client=web_search_client,
    matcher=nlp_matcher
)

async def seed_default_users():
    """Pre-seeds standard test and administrative users on startup."""
    try:
        from app.services.database import AsyncSessionLocal
        async with AsyncSessionLocal() as session:
            # 1. Student demo account
            res = await session.execute(select(User).where(User.email == "student@university.edu"))
            if not res.scalar_one_or_none():
                student_user = User(
                    id=str(uuid.uuid4()),
                    email="student@university.edu",
                    hashed_password=hash_password("password123"),
                    is_admin=False,
                    is_banned=False,
                    scan_credits=25,
                    subscription_tier="pro",
                    subscription_status="active"
                )
                session.add(student_user)

            # 2. Superadmin account
            res = await session.execute(select(User).where(User.email == "admin@originalityguard.com"))
            if not res.scalar_one_or_none():
                admin_user = User(
                    id=str(uuid.uuid4()),
                    email="admin@originalityguard.com",
                    hashed_password=hash_password("admin123"),
                    is_admin=True,
                    is_banned=False,
                    scan_credits=100,
                    subscription_tier="pro",
                    subscription_status="active"
                )
                session.add(admin_user)

            # 3. Mohit admin account
            res = await session.execute(select(User).where(User.email == "mohit@originalityguard.com"))
            if not res.scalar_one_or_none():
                mohit_user = User(
                    id=str(uuid.uuid4()),
                    email="mohit@originalityguard.com",
                    hashed_password=hash_password("password123"),
                    is_admin=True,
                    is_banned=False,
                    scan_credits=100,
                    subscription_tier="pro",
                    subscription_status="active"
                )
                session.add(mohit_user)

            await session.commit()
    except Exception as e:
        pass

@app.on_event("startup")
async def on_startup():
    await init_db()
    # Initialize Redis-backed rate limiting (gracefully falls back if Redis is not running)
    await RateLimitingManager.init()

    # Pre-seed default user accounts
    await seed_default_users()

    # Pre-seed internal database with reference papers
    seed_reference_corpus()

# ------------------------------------------------------------------------------
# Authentication Routes (Protected by IP Rate Limiting: 10 req/min)
# ------------------------------------------------------------------------------

@app.post(
    "/api/register",
    response_model=AuthTokenResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(SafeRateLimiter(times=10, seconds=60, identifier=ip_rate_limit_identifier))]
)
async def register_user(payload: RegisterRequest, db: AsyncSession = Depends(get_db_session)):
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="An account with this email address is already registered.")

    admin_emails = [e.strip().lower() for e in os.getenv("ADMIN_EMAILS", "admin@originalityguard.com,mohit@originalityguard.com").split(",") if e.strip()]
    is_admin = payload.email.lower() in admin_emails or os.getenv("INIT_ALL_ADMIN", "false").lower() == "true"

    new_user = User(
        id=str(uuid.uuid4()),
        email=payload.email,
        hashed_password=hash_password(payload.password),
        is_admin=is_admin,
        is_banned=False,
        scan_credits=100 if is_admin else 3,  # Admins get 100 buffer credits
        subscription_tier="pro" if is_admin else "free",
        subscription_status="active" if is_admin else "inactive"
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    token = create_access_token(data={"sub": new_user.email, "uid": new_user.id})
    return AuthTokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(**new_user.to_dict())
    )

@app.post(
    "/api/login",
    response_model=AuthTokenResponse,
    dependencies=[Depends(SafeRateLimiter(times=10, seconds=60, identifier=ip_rate_limit_identifier))]
)
async def login_user(payload: LoginRequest, db: AsyncSession = Depends(get_db_session)):
    res = await db.execute(select(User).where(User.email == payload.email))
    user = res.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = create_access_token(data={"sub": user.email, "uid": user.id})
    return AuthTokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(**user.to_dict())
    )

@app.get("/api/me", response_model=UserResponse)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    return UserResponse(**current_user.to_dict())

# ------------------------------------------------------------------------------
# Stripe SaaS Monetization Endpoints
# ------------------------------------------------------------------------------

@app.get("/api/billing/plans")
async def get_available_plans():
    """Returns available pricing plans and credit top-up packages."""
    return PLANS

@app.post("/api/create-checkout-session", response_model=CheckoutSessionResponse)
async def create_checkout_session(
    payload: CheckoutSessionRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Creates a Stripe Checkout Session for Pro monthly subscription or one-time scan credit packs.
    """
    origin = request.headers.get("origin") or "http://localhost:3000"
    success_url = payload.success_url or f"{origin}/billing"
    cancel_url = payload.cancel_url or f"{origin}/pricing"

    try:
        session_data = await StripeService.create_checkout_session(
            user=current_user,
            plan_id=payload.plan_id,
            success_url=success_url,
            cancel_url=cancel_url,
            db=db
        )
        return CheckoutSessionResponse(**session_data)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@app.post("/api/create-portal-session")
async def create_customer_portal_session(
    payload: CustomerPortalRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Generates a secure Stripe Billing Customer Portal URL for subscription management."""
    origin = request.headers.get("origin") or "http://localhost:3000"
    return_url = payload.return_url or f"{origin}/billing"

    portal_url = await StripeService.create_portal_session(
        user=current_user,
        return_url=return_url,
        db=db
    )
    return {"portal_url": portal_url}

@app.post("/api/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="stripe-signature"),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Secure Webhook endpoint listening for Stripe events:
      - checkout.session.completed (Activates subscription or adds credits)
      - invoice.payment_succeeded (Subscription renewal)
      - customer.subscription.deleted (Cancellation)
    """
    payload_bytes = await request.body()
    try:
        result = await StripeService.handle_webhook_event(
            payload_bytes=payload_bytes,
            sig_header=stripe_signature or "",
            db=db
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

# ------------------------------------------------------------------------------
# Asynchronous Background Task Plagiarism Scanning & Polling Endpoints
# ------------------------------------------------------------------------------

@app.post(
    "/api/check-plagiarism",
    response_model=TaskSubmissionResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(SafeRateLimiter(times=5, seconds=60, identifier=user_rate_limit_identifier))]
)
async def check_plagiarism_async(
    file: UploadFile = Depends(validate_secure_file_upload),
    enable_web_search: bool = Form(True, description="Enable live internet cross-referencing"),
    current_user: User = Depends(get_current_user)
):
    """
    Asynchronous Plagiarism Scanning Endpoint:
      1. Verifies that user has an active Pro subscription OR > 0 scan credits
      2. Uploads file to secure temporary storage directory
      3. Dispatches job to Celery distributed worker pool
      4. Immediately returns task_id (HTTP 202 Accepted) for client progress polling
    """
    # 1. Usage & Entitlement Enforcement
    if not current_user.can_scan:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Insufficient scan credits. Please upgrade to Pro for unlimited scans or purchase additional credit packs."
        )

    filename = file.filename or "Uploaded_Document.txt"
    file_ext = os.path.splitext(filename)[1].lower() or ".txt"

    # 2. Stage uploaded file to disk for worker process ingestion
    upload_dir = os.path.join(tempfile.gettempdir(), "plagiarism_async_uploads")
    os.makedirs(upload_dir, exist_ok=True)
    temp_file_name = f"{uuid.uuid4().hex}_{filename}"
    temp_storage_path = os.path.join(upload_dir, temp_file_name)

    try:
        with open(temp_storage_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to stage file for worker processing: {str(e)}"
        )

    # 3. Dispatch Job to Celery Distributed Task Worker
    # Celery dispatch is blocking (and eager mode executes the whole task inline),
    # so it must run in a worker thread rather than on the event loop.
    try:
        task = await run_in_threadpool(
            functools.partial(
                process_plagiarism_document.delay,
                temp_file_path=temp_storage_path,
                filename=filename,
                user_id=current_user.id,
                enable_web_search=enable_web_search,
            )
        )
        task_id = task.id
    except Exception as e:
        logger.warning(f"Celery dispatch failed ({e}). Running task synchronously in-process.")
        try:
            # Execute the Celery task locally with a generated task id. Calling
            # the task function directly would leave ``self.request.id`` unset,
            # which breaks progress reporting on backends that key by task id.
            sync_id = f"sync_{uuid.uuid4().hex[:12]}"
            eager_result = await run_in_threadpool(
                functools.partial(
                    process_plagiarism_document.apply,
                    kwargs={
                        "temp_file_path": temp_storage_path,
                        "filename": filename,
                        "user_id": current_user.id,
                        "enable_web_search": enable_web_search,
                    },
                    task_id=sync_id,
                )
            )
            task_result = eager_result.get()
            # Keep the result available for the polling endpoint.
            record_eager_result(sync_id, "SUCCESS", result=task_result)
            return TaskSubmissionResponse(
                task_id=sync_id,
                status="processing",
                message="Document accepted and processed.",
                filename=filename
            )
        except Exception as sync_err:
            logger.error(f"Synchronous processing failed: {sync_err}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Document processing failed: {str(sync_err)}"
            )

    return TaskSubmissionResponse(
        task_id=task_id,
        status="processing",
        message="Document queued for asynchronous plagiarism analysis.",
        filename=filename
    )

@app.get("/api/task-status/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(
    task_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Progress Polling Endpoint:
    Checks Celery result backend for job state (pending, processing, success, failure),
    reports incremental progress percentage and messages, and returns final originality report.
    """
    # Eager / single-process deployments keep completed results in memory. This is
    # also the path taken by the synchronous fallback, which has no Celery backend.
    stored = EAGER_TASK_STORE.get(task_id)
    if stored is not None:
        if stored["state"] == "SUCCESS":
            return TaskStatusResponse(
                task_id=task_id,
                status="success",
                step="completed",
                progress=100,
                message="Plagiarism analysis completed successfully!",
                report=stored.get("result")
            )
        err_msg = stored.get("error") or "Document processing failed."
        return TaskStatusResponse(
            task_id=task_id,
            status="failure",
            step="failed",
            progress=0,
            message=err_msg,
            error=err_msg
        )

    try:
        task_result = AsyncResult(task_id, app=celery_app)
        state = task_result.state
    except Exception as e:
        logger.warning(f"Failed to check async task {task_id}: {e}")
        return TaskStatusResponse(
            task_id=task_id,
            status="processing",
            step="processing",
            progress=50,
            message="Processing document in pipeline..."
        )

    if state == "PENDING":
        return TaskStatusResponse(
            task_id=task_id,
            status="pending",
            step="queued",
            progress=5,
            message="Job queued in worker pool..."
        )

    elif state == "PROGRESS":
        meta = task_result.info if isinstance(task_result.info, dict) else {}
        return TaskStatusResponse(
            task_id=task_id,
            status="processing",
            step=meta.get("step", "processing"),
            progress=int(meta.get("progress", 50)),
            message=meta.get("message", "Processing document...")
        )

    elif state == "SUCCESS":
        report_payload = task_result.result
        return TaskStatusResponse(
            task_id=task_id,
            status="success",
            step="completed",
            progress=100,
            message="Plagiarism analysis completed successfully!",
            report=report_payload
        )

    elif state == "FAILURE":
        err_msg = str(task_result.info or "Document processing failed.")
        return TaskStatusResponse(
            task_id=task_id,
            status="failure",
            step="failed",
            progress=0,
            message=err_msg,
            error=err_msg
        )

    else:
        return TaskStatusResponse(
            task_id=task_id,
            status=state.lower(),
            step="processing",
            progress=50,
            message="Processing document..."
        )

# ------------------------------------------------------------------------------
# History & PDF Export Endpoints
# ------------------------------------------------------------------------------

@app.get("/api/history", response_model=List[ScanHistoryItem])
async def get_user_scan_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    query = select(ScanHistory).where(ScanHistory.user_id == current_user.id).order_by(ScanHistory.created_at.desc())
    res = await db.execute(query)
    scans = res.scalars().all()
    
    history_items = []
    for s in scans:
        report_data = dict(s.report_json) if s.report_json else {}
        if not report_data.get("scan_id"):
            report_data["scan_id"] = s.id
        history_items.append(
            ScanHistoryItem(
                id=s.id,
                filename=s.filename,
                overall_score=round(s.overall_score, 2),
                created_at=s.created_at.isoformat(),
                report=report_data
            )
        )
    return history_items

@app.get("/api/export-report/{scan_id}")
async def export_pdf_report(
    scan_id: str,
    token: Optional[str] = Query(None, description="Optional JWT token query parameter for browser direct downloads"),
    current_user_from_header: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Dynamically generates and streams a formal PDF Originality Report.
    Authenticates via Authorization: Bearer header OR ?token= query parameter.
    """
    user = current_user_from_header

    # Fallback to query parameter token (allows browser window.open / <a> download triggers)
    if not user and token:
        try:
            from jose import jwt
            from app.services.auth import SECRET_KEY, ALGORITHM
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_email: str = payload.get("sub")
            if user_email:
                q = select(User).where(User.email == user_email)
                res = await db.execute(q)
                user = res.scalar_one_or_none()
        except Exception:
            pass

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to export reports.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Retrieve scan report from database
    query = select(ScanHistory).where(ScanHistory.id == scan_id)
    result = await db.execute(query)
    scan_record = result.scalar_one_or_none()

    if not scan_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report with ID '{scan_id}' was not found."
        )

    # Security check: User must own the scan report
    if scan_record.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to download this report."
        )

    # Generate PDF bytes via PDFReportGenerator (xhtml2pdf / ReportLab)
    try:
        report_dict = scan_record.report_json or {}
        pdf_bytes = PDFReportGenerator.generate_pdf_bytes(
            report_data=report_dict,
            user_email=user.email,
            filename=scan_record.filename,
            scan_id=scan_record.id
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate PDF report: {str(e)}"
        )

    # Format attachment filename
    safe_filename = "".join(c for c in scan_record.filename if c.isalnum() or c in ("-", "_", ".")).strip()
    if not safe_filename.lower().endswith(".pdf"):
        safe_filename = f"{safe_filename}.pdf"
    content_disp = f'attachment; filename="Originality_Report_{safe_filename}"'

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": content_disp,
            "Content-Type": "application/pdf"
        }
    )

# ------------------------------------------------------------------------------
# Superadmin Management & Global Analytics Endpoints (RBAC Protected)
# ------------------------------------------------------------------------------

@app.get("/api/admin/stats", response_model=AdminStatsResponse)
async def get_admin_global_stats(
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Superadmin KPI aggregation endpoint:
      - Total Registered Accounts & Active Pro Subscribers
      - Scans Processed (All-time, Today, and Current Month)
      - Current Monthly Recurring Revenue (MRR) synced from Stripe
      - 30-Day Daily Scan Trend Volume
      - System Component Health Diagnostics
    """
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # 1. Total Registered Accounts
    res_users = await db.execute(select(func.count(User.id)))
    total_users = res_users.scalar() or 0

    # 2. Active Pro Subscribers
    res_pro = await db.execute(
        select(func.count(User.id)).where(User.subscription_tier == "pro", User.subscription_status == "active")
    )
    active_pro_users = res_pro.scalar() or 0

    # 3. Scan Totals
    res_scans = await db.execute(select(func.count(ScanHistory.id)))
    total_scans_all = res_scans.scalar() or 0

    res_today = await db.execute(select(func.count(ScanHistory.id)).where(ScanHistory.created_at >= today_start))
    total_scans_today = res_today.scalar() or 0

    res_month = await db.execute(select(func.count(ScanHistory.id)).where(ScanHistory.created_at >= month_start))
    total_scans_month = res_month.scalar() or 0

    # 4. MRR Calculation (Base $19/mo per Pro subscriber + Stripe sync)
    mrr_usd = float(active_pro_users * 19.00)
    stripe_synced = False
    if os.getenv("STRIPE_SECRET_KEY"):
        try:
            import stripe
            stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
            active_subs = stripe.Subscription.list(status="active", limit=100)
            if active_subs and hasattr(active_subs, "data"):
                stripe_mrr = sum((sub.get("plan", {}).get("amount", 0) / 100.0) for sub in active_subs.data)
                if stripe_mrr > 0:
                    mrr_usd = stripe_mrr
            stripe_synced = True
        except Exception:
            pass

    # 5. 30-Day Daily Scan Volume Trend
    thirty_days_ago = now - timedelta(days=29)
    res_recent = await db.execute(
        select(ScanHistory.created_at).where(ScanHistory.created_at >= thirty_days_ago)
    )
    scan_timestamps = res_recent.scalars().all()

    counts_by_day = {}
    for i in range(30):
        d_str = (thirty_days_ago + timedelta(days=i)).strftime("%Y-%m-%d")
        counts_by_day[d_str] = 0

    for dt in scan_timestamps:
        if dt:
            d_key = dt.strftime("%Y-%m-%d")
            if d_key in counts_by_day:
                counts_by_day[d_key] += 1

    daily_scans = [{"date": k, "scans": v} for k, v in counts_by_day.items()]

    return AdminStatsResponse(
        total_users=total_users,
        active_pro_users=active_pro_users,
        total_scans_all_time=total_scans_all,
        total_scans_today=total_scans_today,
        total_scans_month=total_scans_month,
        mrr_usd=round(mrr_usd, 2),
        stripe_synced=stripe_synced,
        daily_scans=daily_scans,
        system_health={
            "database": "connected",
            "vector_engine": "online",
            "ocr_status": "ready",
            "server_time_utc": now.isoformat()
        }
    )

@app.get("/api/admin/users", response_model=AdminUsersListResponse)
async def get_admin_users_list(
    page: int = Query(1, ge=1),
    limit: int = Query(15, ge=1, le=100),
    search: Optional[str] = Query(None),
    tier: Optional[str] = Query(None),
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Paginated user directory with search and subscription filtering.
    """
    query = select(User)
    if search:
        query = query.where(User.email.ilike(f"%{search.strip()}%"))
    if tier and tier.lower() != "all":
        query = query.where(User.subscription_tier == tier.lower())

    # Count total matching users
    count_query = select(func.count()).select_from(query.subquery())
    total_res = await db.execute(count_query)
    total_count = total_res.scalar() or 0

    # Paginate
    offset = (page - 1) * limit
    paginated_query = query.order_by(desc(User.created_at)).offset(offset).limit(limit)
    res = await db.execute(paginated_query)
    users = res.scalars().all()

    user_items = []
    for u in users:
        scans_count_res = await db.execute(select(func.count(ScanHistory.id)).where(ScanHistory.user_id == u.id))
        user_scans = scans_count_res.scalar() or 0
        user_items.append(
            AdminUserItem(
                id=u.id,
                email=u.email,
                is_admin=u.is_admin,
                is_banned=u.is_banned,
                subscription_tier=u.subscription_tier,
                subscription_status=u.subscription_status,
                scan_credits=u.scan_credits,
                created_at=u.created_at.isoformat() if u.created_at else "",
                total_scans=user_scans
            )
        )

    pages = max(1, (total_count + limit - 1) // limit)
    return AdminUsersListResponse(
        users=user_items,
        total=total_count,
        page=page,
        pages=pages
    )

@app.post("/api/admin/users/{user_id}/credits")
async def admin_adjust_user_credits(
    user_id: str,
    payload: AdminCreditUpdateRequest,
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Manually grants, revokes, or sets scan credits for a user account.
    """
    res = await db.execute(select(User).where(User.id == user_id))
    target_user = res.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail=f"User '{user_id}' not found.")

    old_credits = target_user.scan_credits
    if payload.action == "grant":
        target_user.scan_credits += payload.amount
    elif payload.action == "revoke":
        target_user.scan_credits = max(0, target_user.scan_credits - payload.amount)
    elif payload.action == "set":
        target_user.scan_credits = payload.amount
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Allowed: 'grant', 'revoke', 'set'.")

    db.add(target_user)
    await db.commit()
    await db.refresh(target_user)

    return {
        "status": "success",
        "user_id": target_user.id,
        "email": target_user.email,
        "previous_credits": old_credits,
        "new_credits": target_user.scan_credits,
        "action": payload.action,
        "amount": payload.amount
    }

@app.post("/api/admin/users/{user_id}/toggle-status")
async def admin_toggle_user_status(
    user_id: str,
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Toggles user ban/suspension status. Prevents self-locking.
    """
    if user_id == admin_user.id:
        raise HTTPException(status_code=400, detail="Administrators cannot suspend their own account.")

    res = await db.execute(select(User).where(User.id == user_id))
    target_user = res.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail=f"User '{user_id}' not found.")

    target_user.is_banned = not target_user.is_banned
    db.add(target_user)
    await db.commit()
    await db.refresh(target_user)

    return {
        "status": "success",
        "user_id": target_user.id,
        "email": target_user.email,
        "is_banned": target_user.is_banned,
        "message": "Account suspended." if target_user.is_banned else "Account re-activated."
    }

@app.delete("/api/admin/users/{user_id}")
async def admin_delete_user(
    user_id: str,
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Permanently deletes a user account and associated audit scans.
    """
    if user_id == admin_user.id:
        raise HTTPException(status_code=400, detail="Administrators cannot delete their own account.")

    res = await db.execute(select(User).where(User.id == user_id))
    target_user = res.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail=f"User '{user_id}' not found.")

    await db.delete(target_user)
    await db.commit()
    return {"status": "deleted", "user_id": user_id, "email": target_user.email}

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "Turnitin Plagiarism & Stripe Monetization API",
        "stripe_configured": bool(os.getenv("STRIPE_SECRET_KEY"))
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)

# Static files mount
static_dist_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend/dist"))
if os.path.isdir(static_dist_path):
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=static_dist_path, html=True), name="static")
