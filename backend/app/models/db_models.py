import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, ForeignKey, Text, JSON, func
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class User(Base):
    """
    User account entity with Stripe SaaS monetization & Superadmin RBAC:
    tracks subscription tiers, customer ID, scan credits, and admin privileges.
    """
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    
    # Role-Based Access Control (RBAC) & Account Status
    is_admin = Column(Boolean, default=False, nullable=False)
    is_banned = Column(Boolean, default=False, nullable=False)
    
    # Stripe Monetization Fields
    stripe_customer_id = Column(String(255), nullable=True, index=True)
    subscription_tier = Column(String(50), default="free", nullable=False) # 'free', 'pro', 'enterprise'
    subscription_status = Column(String(50), default="inactive", nullable=False) # 'active', 'inactive', 'canceled'
    scan_credits = Column(Integer, default=3, nullable=False) # New accounts start with 3 free credits
    
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)

    # Relationships
    scans = relationship("ScanHistory", back_populates="user", cascade="all, delete-orphan", order_by="desc(ScanHistory.created_at)")
    feedbacks = relationship("Feedback", back_populates="user", cascade="all, delete-orphan", order_by="desc(Feedback.created_at)")
    api_keys = relationship("ApiKey", back_populates="user", cascade="all, delete-orphan", order_by="desc(ApiKey.created_at)")

    @property
    def has_active_subscription(self) -> bool:
        """Checks if the user has an active Pro or Enterprise subscription."""
        return self.subscription_tier in ["pro", "enterprise"] and self.subscription_status == "active"

    @property
    def can_scan(self) -> bool:
        """Determines if the user has enough entitlement to initiate a plagiarism scan."""
        if self.is_banned:
            return False
        return self.has_active_subscription or self.scan_credits > 0

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "is_admin": self.is_admin,
            "is_banned": self.is_banned,
            "stripe_customer_id": self.stripe_customer_id,
            "subscription_tier": self.subscription_tier,
            "subscription_status": self.subscription_status,
            "scan_credits": self.scan_credits,
            "has_active_subscription": self.has_active_subscription,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class ScanHistory(Base):
    """Audit log of user document plagiarism scans and full originality reports."""
    __tablename__ = "scan_history"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    overall_score = Column(Float, nullable=False)
    report_json = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False, index=True)

    # Relationships
    user = relationship("User", back_populates="scans")

    def to_summary_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "filename": self.filename,
            "overall_score": round(self.overall_score, 2),
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class Feedback(Base):
    """
    Audit log of false-positive reports, citation anomalies, and engine tuning requests.
    Enables machine learning engineers and product managers to audit and calibrate
    similarity thresholds, winnowing parameters, and quotation filtering.
    """
    __tablename__ = "feedback"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    scan_id = Column(String(255), nullable=True, index=True)
    filename = Column(String(255), nullable=True)
    chunk_text = Column(Text, nullable=False)
    matched_source_url = Column(String(1024), nullable=True)
    source_title = Column(String(255), nullable=True)
    similarity_score = Column(Float, nullable=True)
    reason = Column(String(100), default="false_positive", nullable=False)  # e.g., 'false_positive', 'common_phrase', 'quotation_missed', 'public_domain', 'other'
    comment = Column(Text, nullable=True)
    status = Column(String(50), default="pending", nullable=False, index=True)  # 'pending', 'reviewed', 'resolved', 'dismissed'
    admin_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False, index=True)

    # Relationships
    user = relationship("User", back_populates="feedbacks")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "user_email": self.user.email if self.user else None,
            "scan_id": self.scan_id,
            "filename": self.filename,
            "chunk_text": self.chunk_text,
            "matched_source_url": self.matched_source_url,
            "source_title": self.source_title,
            "similarity_score": round(self.similarity_score, 4) if self.similarity_score is not None else None,
            "reason": self.reason,
            "comment": self.comment,
            "status": self.status,
            "admin_notes": self.admin_notes,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class ApiKey(Base):
    """
    Developer SaaS API Key for institutional integrations, LMS LMS (Canvas/Moodle/Blackboard),
    and external programmatic submission pipelines.
    """
    __tablename__ = "api_keys"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), default="Default API Key", nullable=False)
    key_prefix = Column(String(16), nullable=False, index=True)  # e.g., 'sk_live_a1b2c3'
    hashed_key = Column(String(64), nullable=False, unique=True, index=True)  # SHA-256 hash
    rate_limit_per_minute = Column(Integer, default=60, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="api_keys")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "key_prefix": self.key_prefix,
            "rate_limit_per_minute": self.rate_limit_per_minute,
            "is_active": self.is_active,
            "last_used_at": self.last_used_at.isoformat() if self.last_used_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

