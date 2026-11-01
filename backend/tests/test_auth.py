import pytest
from httpx import AsyncClient
from app.services.auth import hash_password, verify_password, create_access_token
from app.models.db_models import User

class TestPasswordAndTokenSecurity:
    """Tests core cryptographic utilities for password hashing and JWT signing."""

    def test_password_hashing_and_verification(self):
        password = "SuperSecretPassword2026!"
        hashed = hash_password(password)

        assert hashed != password
        assert verify_password(password, hashed) is True
        assert verify_password("WrongPassword!", hashed) is False

    def test_jwt_token_creation(self):
        claims = {"sub": "student@mit.edu", "role": "researcher"}
        token = create_access_token(claims)

        assert isinstance(token, str)
        assert len(token.split(".")) == 3  # Header.Payload.Signature


class TestAuthEndpoints:
    """Integration tests for registration, authentication, and protected routes."""

    @pytest.mark.asyncio
    async def test_register_success(self, client: AsyncClient):
        payload = {
            "email": "newstudent@stanford.edu",
            "password": "StrongPassword99!"
        }
        response = await client.post("/api/register", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == "newstudent@stanford.edu"
        assert data["user"]["scan_credits"] == 3  # Initial complimentary scans

    @pytest.mark.asyncio
    async def test_register_duplicate_email_fails(self, client: AsyncClient, test_user: User):
        payload = {
            "email": test_user.email,
            "password": "AnotherPassword123!"
        }
        response = await client.post("/api/register", json=payload)
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_login_success(self, client: AsyncClient, test_user: User):
        payload = {
            "email": test_user.email,
            "password": "SecurePassword123!"
        }
        response = await client.post("/api/login", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == test_user.email

    @pytest.mark.asyncio
    async def test_login_invalid_password(self, client: AsyncClient, test_user: User):
        payload = {
            "email": test_user.email,
            "password": "IncorrectPassword!"
        }
        response = await client.post("/api/login", json=payload)
        assert response.status_code == 401
        assert "invalid" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_get_current_user_profile(self, client: AsyncClient, auth_headers: dict, test_user: User):
        response = await client.get("/api/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == test_user.email
        assert data["scan_credits"] == test_user.scan_credits

    @pytest.mark.asyncio
    async def test_protected_route_unauthorized_without_token(self, client: AsyncClient):
        response = await client.get("/api/me")
        assert response.status_code == 401
