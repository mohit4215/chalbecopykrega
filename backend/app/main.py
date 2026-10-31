import os
import uuid
import tempfile
import shutil
import io
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Request, Header, Query, status
from fastapi.responses import StreamingResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

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
    InternalVectorDB,
    LiveWebSearchClient,
    CoreNLPMatcher,
    PlagiarismDetectionEngine
)
from app.services.security import (
    validate_secure_file_upload,
    SecurityHeadersMiddleware,
    RateLimitingManager,
    SafeRateLimiter,
    user_rate_limit_identifier,
    ip_rate_limit_identifier
)

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
    "http://localhost:3000,http://localhost:5173,https://chalbecopykrega-app.onrender.com"
)
allowed_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With", "stripe-signature"],
    expose_headers=["Content-Disposition", "Content-Length", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"]
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

# ------------------------------------------------------------------------------
# Singletons & Startup Lifecycle
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
    await init_db()
    # Initialize Redis-backed rate limiting (gracefully falls back if Redis is not running)
    await RateLimitingManager.init()

    # Pre-seed internal database with reference papers
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
        raise HTTPException(status_code=400, detail="An account with this email address already exists.")

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
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

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
# Protected Plagiarism Check Endpoint with Usage & Credit Enforcement
# ------------------------------------------------------------------------------

@app.post(
    "/api/check-plagiarism",
    response_model=CheckPlagiarismResponse,
    dependencies=[Depends(SafeRateLimiter(times=5, seconds=60, identifier=user_rate_limit_identifier))]
)
async def check_plagiarism_monetized(
    file: UploadFile = Depends(validate_secure_file_upload),
    enable_web_search: bool = Form(True, description="Enable live internet cross-referencing"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Monetized Plagiarism Scanning Endpoint:
      1. Verifies that user has an active Pro subscription OR > 0 scan credits
      2. Ingests and processes the document
      3. Deducts 1 scan credit upon success (or allows unlimited for Pro subscribers)
      4. Persists the report to ScanHistory
      5. Returns full results with remaining credit balance
    """
    # Usage Enforcement Check
    if not current_user.can_scan:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Insufficient scan credits. Please upgrade to Pro for unlimited scans or purchase additional credit packs."
        )

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

    # 2. Run Core Detection Engine
    doc_id = str(uuid.uuid4())
    scan_report = await plagiarism_engine.scan_document_chunks(
        document_id=doc_id,
        document_title=filename,
        chunks=chunk_strings,
        enable_web_search=enable_web_search
    )

    # 3. Usage Deduction (Deduct 1 credit for non-Pro users)
    if not current_user.has_active_subscription:
        current_user.scan_credits = max(0, current_user.scan_credits - 1)
        db.add(current_user)
        await db.commit()
        await db.refresh(current_user)

    # 4. Format Matches
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

    new_scan_id = str(uuid.uuid4())
    response_payload = CheckPlagiarismResponse(
        scan_id=new_scan_id,
        document_id=doc_id,
        document_title=filename,
        overall_score=scan_report["overall_plagiarism_percentage"],
        originality_score=scan_report["originality_percentage"],
        total_words=extraction_result.metadata.total_words,
        total_characters=extraction_result.metadata.total_characters_cleaned,
        remaining_credits=current_user.scan_credits,
        subscription_tier=current_user.subscription_tier,
        full_text=extraction_result.cleaned_text,
        summary=PlagiarismSummary(
            exact_matches_count=scan_report["summary"]["exact_matches_count"],
            paraphrase_matches_count=scan_report["summary"]["paraphrase_matches_count"],
            internet_matches_count=scan_report["summary"]["internet_matches_count"]
        ),
        matches=formatted_matches
    )

    # 5. Persist to ScanHistory with scan_id embedded
    scan_record = ScanHistory(
        id=new_scan_id,
        user_id=current_user.id,
        filename=filename,
        overall_score=scan_report["overall_plagiarism_percentage"],
        report_json=response_payload.dict()
    )
    db.add(scan_record)
    await db.commit()

    return response_payload

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

# Static files mount
static_dist_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend/dist"))
if os.path.isdir(static_dist_path):
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=static_dist_path, html=True), name="static")
