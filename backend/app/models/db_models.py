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
