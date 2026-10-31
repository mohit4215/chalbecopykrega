import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.db_models import User
from app.services.auth import hash_password, create_access_token

@pytest.fixture
async def admin_user(db_session: AsyncSession) -> User:
    """Provisions a test administrator user."""
    user = User(
        email="superadmin@originalityguard.com",
        hashed_password=hash_password("AdminSecureKey2026!"),
        is_admin=True,
        is_banned=False,
        scan_credits=100,
        subscription_tier="pro",
        subscription_status="active"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user

@pytest.fixture
def admin_headers(admin_user: User) -> dict:
    token = create_access_token(data={"sub": admin_user.email})
    return {"Authorization": f"Bearer {token}"}

class TestSuperadminRBAC:
    """Verifies Role-Based Access Control and Superadmin protection."""

    @pytest.mark.asyncio
    async def test_non_admin_forbidden_from_admin_stats(self, client: AsyncClient, auth_headers: dict):
        response = await client.get("/api/admin/stats", headers=auth_headers)
        assert response.status_code == 403
        assert "superadmin" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_admin_access_granted_to_stats(self, client: AsyncClient, admin_headers: dict):
        response = await client.get("/api/admin/stats", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_users" in data
        assert "mrr_usd" in data
        assert "daily_scans" in data
        assert len(data["daily_scans"]) == 30

    @pytest.mark.asyncio
    async def test_admin_get_users_list(self, client: AsyncClient, admin_headers: dict, test_user: User):
        response = await client.get("/api/admin/users?page=1&limit=10", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        assert data["total"] >= 2
        emails = [u["email"] for u in data["users"]]
        assert test_user.email in emails

    @pytest.mark.asyncio
    async def test_admin_adjust_user_credits(self, client: AsyncClient, admin_headers: dict, test_user: User):
        initial = test_user.scan_credits

        # Grant 50 credits
        res = await client.post(
            f"/api/admin/users/{test_user.id}/credits",
            json={"action": "grant", "amount": 50},
            headers=admin_headers
        )
        assert res.status_code == 200
        data = res.json()
        assert data["new_credits"] == initial + 50

        # Revoke 20 credits
        res_revoke = await client.post(
            f"/api/admin/users/{test_user.id}/credits",
            json={"action": "revoke", "amount": 20},
            headers=admin_headers
        )
        assert res_revoke.status_code == 200
        assert res_revoke.json()["new_credits"] == initial + 30

    @pytest.mark.asyncio
    async def test_admin_toggle_user_ban_status(
        self,
        client: AsyncClient,
        admin_headers: dict,
        admin_user: User,
        test_user: User
    ):
        # 1. Ban user
        res_ban = await client.post(
            f"/api/admin/users/{test_user.id}/toggle-status",
            headers=admin_headers
        )
        assert res_ban.status_code == 200
        assert res_ban.json()["is_banned"] is True

        # 2. Verify banned user cannot access protected /api/me
        user_token = create_access_token(data={"sub": test_user.email})
        res_me = await client.get("/api/me", headers={"Authorization": f"Bearer {user_token}"})
        assert res_me.status_code == 403
        assert "suspended" in res_me.json()["detail"].lower()

        # 3. Unban user
        res_unban = await client.post(
            f"/api/admin/users/{test_user.id}/toggle-status",
            headers=admin_headers
        )
        assert res_unban.status_code == 200
        assert res_unban.json()["is_banned"] is False

        # 4. Verify admin cannot ban themselves
        res_self = await client.post(
            f"/api/admin/users/{admin_user.id}/toggle-status",
            headers=admin_headers
        )
        assert res_self.status_code == 400
