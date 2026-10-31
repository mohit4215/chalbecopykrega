import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Text, JSON, func
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class User(Base):
    """User account entity for authentication and ownership of scan records."""
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)

    # Relationships
    scans = relationship("ScanHistory", back_populates="user", cascade="all, delete-orphan", order_by="desc(ScanHistory.created_at)")

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
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
