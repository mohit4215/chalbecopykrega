import os
import pytest
import pytest_asyncio
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

# Set test environment flags
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-originalityguard-testing-only"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "60"
os.environ["STRIPE_SECRET_KEY"] = "sk_test_mock_key"
os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test_mock_secret"

from app.main import app
from app.models.db_models import Base, User
from app.services.database import get_db_session
from app.services.auth import hash_password, create_access_token

# Test In-Memory Database Engine
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False
)

TestAsyncSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

@pytest_asyncio.fixture(scope="session", autouse=True)
async def init_test_database():
    """Create all database tables before running the test suite."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()

@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provides an isolated database session per test with automatic rollback."""
    async with TestAsyncSessionLocal() as session:
        yield session
        await session.rollback()

@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Provides an HTTP test client with database dependency override."""
    async def override_get_db_session():
        yield db_session

    app.dependency_overrides[get_db_session] = override_get_db_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
    app.dependency_overrides.clear()

@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Creates a standard test user with 5 scan credits."""
    user = User(
        email="teststudent@university.edu",
        hashed_password=hash_password("SecurePassword123!"),
        scan_credits=5,
        subscription_tier="free",
        subscription_status="active"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user

@pytest_asyncio.fixture
def auth_headers(test_user: User) -> dict:
    """Generates Authorization Bearer headers for test_user."""
    token = create_access_token(data={"sub": test_user.email})
    return {"Authorization": f"Bearer {token}"}
