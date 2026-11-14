"""Developer API Key Authentication Service.

Supports commercial SaaS developer keys (e.g., 'sk_live_...') with SHA-256
hashing, prefix indexing, and seamless interoperability with JWT bearer tokens.
"""

import hashlib
import secrets
from datetime import datetime, timezone
from typing import Optional, Tuple
from fastapi import Header, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import User, ApiKey
from app.services.database import get_db_session
from app.services.auth import get_optional_current_user


def hash_api_key(raw_key: str) -> str:
    """Computes SHA-256 hex digest of the raw secret API key."""
    return hashlib.sha256(raw_key.strip().encode("utf-8")).hexdigest()


def generate_new_api_key(name: str = "Production API Key") -> Tuple[str, str, str]:
    """
    Generates a cryptographically secure API key.
    Returns:
      (raw_key, key_prefix, hashed_key)
    """
    random_entropy = secrets.token_urlsafe(32)
    raw_key = f"sk_live_{random_entropy}"
    key_prefix = raw_key[:14]
    hashed_key = hash_api_key(raw_key)
    return raw_key, key_prefix, hashed_key


async def get_user_from_api_key_or_jwt(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
    current_jwt_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> Optional[User]:
    """
    Unified authentication dependency:
      1. If valid JWT user present in Authorization header, returns JWT user.
      2. If 'sk_live_...' provided in Authorization or X-API-Key header, authenticates API key.
      3. Otherwise returns None (allowing optional auth handling).
    """
    # Case 1: JWT token already verified
    if current_jwt_user:
        return current_jwt_user

    # Case 2: Extract raw API key from header
    raw_key: Optional[str] = None
    if x_api_key and x_api_key.startswith("sk_live_"):
        raw_key = x_api_key.strip()
    elif authorization and authorization.lower().startswith("bearer sk_live_"):
        raw_key = authorization[7:].strip()

    if not raw_key:
        return None

    # Verify API key in database
    hashed = hash_api_key(raw_key)
    query = (
        select(ApiKey, User)
        .join(User, ApiKey.user_id == User.id)
        .where(ApiKey.hashed_key == hashed, ApiKey.is_active == True)
    )
    result = await db.execute(query)
    row = result.first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked API key.",
            headers={"WWW-Authenticate": "ApiKey"}
        )

    api_key_record, user_record = row
    if user_record.is_banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is suspended."
        )

    # Update last_used_at timestamp
    api_key_record.last_used_at = datetime.now(timezone.utc)
    db.add(api_key_record)
    await db.commit()

    return user_record


async def require_authenticated_principal(
    user: Optional[User] = Depends(get_user_from_api_key_or_jwt)
) -> User:
    """Enforces strict authentication via either JWT or API Key."""
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Provide a valid Bearer JWT or X-API-Key.",
            headers={"WWW-Authenticate": "Bearer, ApiKey"}
        )
    return user
