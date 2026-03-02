"""E2E tests — Admin + Champions management.

Covers admin user management (disable, enable, delete, promote, demote) and
champion CRUD (list, load, alias, delete).
Only Discord OAuth is mocked.  Admin role is set directly via test DB helper.
"""
import pytest
from httpx import AsyncClient
from sqlmodel import select

from tests.e2e.conftest import discord_login, auth_headers
from tests.utils.utils_db import Session


# ── Helpers ─────────────────────────────────────────────────────────────

async def _login(client: AsyncClient, token: str = "discord_token_user1") -> tuple[dict, str]:
    """Login and return (headers, access_token)."""
    tokens = await discord_login(client, token)
    return auth_headers(tokens["access_token"]), tokens["access_token"]


def _user_id_from_token(access_token: str) -> str:
    """Extract user_id from a JWT access token (no signature verification)."""
    import jwt
    payload = jwt.decode(access_token, options={"verify_signature": False})
    return payload["user_id"]


async def _promote_to_admin(user_id: str):
    """Directly update user role to admin in the test DB."""
    from src.models import User
    import uuid

    async with Session() as session:
        user = await session.get(User, uuid.UUID(user_id))
        user.role = "admin"
        session.add(user)
        await session.commit()


async def _promote_to_super_admin(user_id: str):
    """Directly update user role to super_admin in the test DB."""
    from src.models import User
    import uuid

    async with Session() as session:
        user = await session.get(User, uuid.UUID(user_id))
        user.role = "super_admin"
        session.add(user)
        await session.commit()


async def _login_as_admin(client: AsyncClient, token: str = "discord_token_admin") -> dict:
    """Login, promote to admin, then re-login to get an admin JWT."""
    tokens = await discord_login(client, token)
    user_id = _user_id_from_token(tokens["access_token"])
    await _promote_to_admin(user_id)
    # Re-login to get a JWT with the admin role
    tokens2 = await discord_login(client, token)
    return auth_headers(tokens2["access_token"])


async def _login_as_super_admin(client: AsyncClient, token: str = "discord_token_admin") -> dict:
    """Login, promote to super_admin, then re-login to get a super_admin JWT."""
    tokens = await discord_login(client, token)
    user_id = _user_id_from_token(tokens["access_token"])
    await _promote_to_super_admin(user_id)
    tokens2 = await discord_login(client, token)
    return auth_headers(tokens2["access_token"])


# =========================================================================
# Admin User Management
# =========================================================================

class TestAdminUserManagement:
    @pytest.mark.asyncio
    async def test_list_users(self, client: AsyncClient):
        admin_hdrs = await _login_as_admin(client)
        # Create a regular user
        await discord_login(client, "discord_token_user1")

        resp = await client.get("/admin/users", headers=admin_hdrs)
        assert resp.status_code == 200
        body = resp.json()
        assert "users" in body
        assert "total_users" in body

    @pytest.mark.asyncio
    async def test_list_users_pagination(self, client: AsyncClient):
        admin_hdrs = await _login_as_admin(client)

        resp = await client.get("/admin/users?page=1&size=5", headers=admin_hdrs)
        assert resp.status_code == 200
        assert resp.json()["current_page"] == 1

    @pytest.mark.asyncio
    async def test_list_users_no_auth(self, client: AsyncClient):
        resp = await client.get("/admin/users")
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_list_users_non_admin(self, client: AsyncClient):
        user_hdrs, _ = await _login(client, "discord_token_user1")
        resp = await client.get("/admin/users", headers=user_hdrs)
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_disable_user(self, client: AsyncClient):
        admin_hdrs = await _login_as_admin(client)
        user_tokens = await discord_login(client, "discord_token_user1")
        user_id = _user_id_from_token(user_tokens["access_token"])

        resp = await client.patch(f"/admin/users/disable/{user_id}", headers=admin_hdrs)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_enable_user(self, client: AsyncClient):
        admin_hdrs = await _login_as_admin(client)
        user_tokens = await discord_login(client, "discord_token_user1")
        user_id = _user_id_from_token(user_tokens["access_token"])

        # Disable first
        await client.patch(f"/admin/users/disable/{user_id}", headers=admin_hdrs)
        # Enable
        resp = await client.patch(f"/admin/users/enable/{user_id}", headers=admin_hdrs)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_delete_user(self, client: AsyncClient):
        admin_hdrs = await _login_as_admin(client)
        user_tokens = await discord_login(client, "discord_token_user1")
        user_id = _user_id_from_token(user_tokens["access_token"])

        resp = await client.delete(f"/admin/users/delete/{user_id}", headers=admin_hdrs)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_disable_already_disabled(self, client: AsyncClient):
        admin_hdrs = await _login_as_admin(client)
        user_tokens = await discord_login(client, "discord_token_user1")
        user_id = _user_id_from_token(user_tokens["access_token"])

        await client.patch(f"/admin/users/disable/{user_id}", headers=admin_hdrs)
        resp = await client.patch(f"/admin/users/disable/{user_id}", headers=admin_hdrs)
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_promote_user_requires_super_admin(self, client: AsyncClient):
        """Only super_admin can promote users."""
        admin_hdrs = await _login_as_admin(client, "discord_token_admin")
        user_tokens = await discord_login(client, "discord_token_user1")
        user_id = _user_id_from_token(user_tokens["access_token"])

        # Admin (not super_admin) cannot promote
        resp = await client.patch(f"/admin/users/promote/{user_id}", headers=admin_hdrs)
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_promote_and_demote_user(self, client: AsyncClient):
        sa_hdrs = await _login_as_super_admin(client)
        user_tokens = await discord_login(client, "discord_token_user1")
        user_id = _user_id_from_token(user_tokens["access_token"])

        # Promote
        resp = await client.patch(f"/admin/users/promote/{user_id}", headers=sa_hdrs)
        assert resp.status_code == 200

        # Demote
        resp2 = await client.patch(f"/admin/users/demote/{user_id}", headers=sa_hdrs)
        assert resp2.status_code == 200


# =========================================================================
# Champion Admin — CRUD
# =========================================================================

class TestChampionAdmin:
    @pytest.mark.asyncio
    async def test_load_champions(self, client: AsyncClient):
        admin_hdrs = await _login_as_admin(client)

        champions = [
            {"name": "Spider-Man", "champion_class": "Science", "is_7_star": False},
            {"name": "Iron Man", "champion_class": "Tech", "is_7_star": True},
            {"name": "Captain America", "champion_class": "Science", "is_7_star": False},
        ]
        resp = await client.post(
            "/admin/champions/load", json=champions, headers=admin_hdrs
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["created"] == 3

    @pytest.mark.asyncio
    async def test_load_champions_idempotent(self, client: AsyncClient):
        admin_hdrs = await _login_as_admin(client)

        champions = [
            {"name": "Spider-Man", "champion_class": "Science", "is_7_star": False},
        ]
        await client.post("/admin/champions/load", json=champions, headers=admin_hdrs)
        resp = await client.post("/admin/champions/load", json=champions, headers=admin_hdrs)
        assert resp.status_code == 200
        assert resp.json()["created"] == 0

    @pytest.mark.asyncio
    async def test_list_champions(self, client: AsyncClient):
        admin_hdrs = await _login_as_admin(client)

        await client.post(
            "/admin/champions/load",
            json=[{"name": "Hulk", "champion_class": "Science", "is_7_star": False}],
            headers=admin_hdrs,
        )

        resp = await client.get("/admin/champions", headers=admin_hdrs)
        assert resp.status_code == 200
        body = resp.json()
        assert "champions" in body
        assert body["total_champions"] >= 1

    @pytest.mark.asyncio
    async def test_get_champion_by_id(self, client: AsyncClient):
        admin_hdrs = await _login_as_admin(client)

        await client.post(
            "/admin/champions/load",
            json=[{"name": "Thor", "champion_class": "Cosmic", "is_7_star": False}],
            headers=admin_hdrs,
        )
        listing = await client.get("/admin/champions?search=Thor", headers=admin_hdrs)
        champ_id = listing.json()["champions"][0]["id"]

        resp = await client.get(f"/admin/champions/{champ_id}", headers=admin_hdrs)
        assert resp.status_code == 200
        assert resp.json()["name"] == "Thor"

    @pytest.mark.asyncio
    async def test_update_champion_alias(self, client: AsyncClient):
        admin_hdrs = await _login_as_admin(client)

        await client.post(
            "/admin/champions/load",
            json=[{"name": "Wolverine", "champion_class": "Mutant", "is_7_star": False}],
            headers=admin_hdrs,
        )
        listing = await client.get("/admin/champions?search=Wolverine", headers=admin_hdrs)
        champ_id = listing.json()["champions"][0]["id"]

        resp = await client.patch(
            f"/admin/champions/{champ_id}/alias",
            json={"alias": "Logan"},
            headers=admin_hdrs,
        )
        assert resp.status_code == 200

        # Verify alias was set
        resp2 = await client.get(f"/admin/champions/{champ_id}", headers=admin_hdrs)
        assert resp2.json()["alias"] == "Logan"

    @pytest.mark.asyncio
    async def test_delete_champion(self, client: AsyncClient):
        admin_hdrs = await _login_as_admin(client)

        await client.post(
            "/admin/champions/load",
            json=[{"name": "Deadpool", "champion_class": "Mutant", "is_7_star": False}],
            headers=admin_hdrs,
        )
        listing = await client.get("/admin/champions?search=Deadpool", headers=admin_hdrs)
        champ_id = listing.json()["champions"][0]["id"]

        resp = await client.delete(f"/admin/champions/{champ_id}", headers=admin_hdrs)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_champion_search(self, client: AsyncClient):
        admin_hdrs = await _login_as_admin(client)

        await client.post(
            "/admin/champions/load",
            json=[
                {"name": "Spider-Man", "champion_class": "Science", "is_7_star": False},
                {"name": "Spider-Gwen", "champion_class": "Science", "is_7_star": False},
                {"name": "Iron Man", "champion_class": "Tech", "is_7_star": False},
            ],
            headers=admin_hdrs,
        )

        resp = await client.get("/admin/champions?search=Spider", headers=admin_hdrs)
        assert resp.status_code == 200
        names = [c["name"] for c in resp.json()["champions"]]
        assert all("Spider" in n for n in names)
        assert "Iron Man" not in names

    @pytest.mark.asyncio
    async def test_champion_pagination(self, client: AsyncClient):
        admin_hdrs = await _login_as_admin(client)

        champs = [{"name": f"Champ{i}", "champion_class": "Science", "is_7_star": False} for i in range(25)]
        await client.post("/admin/champions/load", json=champs, headers=admin_hdrs)

        resp_p1 = await client.get("/admin/champions?page=1&size=10", headers=admin_hdrs)
        assert resp_p1.status_code == 200
        assert len(resp_p1.json()["champions"]) == 10

        resp_p2 = await client.get("/admin/champions?page=2&size=10", headers=admin_hdrs)
        assert resp_p2.status_code == 200
        assert len(resp_p2.json()["champions"]) == 10

    @pytest.mark.asyncio
    async def test_non_admin_cannot_access(self, client: AsyncClient):
        user_hdrs, _ = await _login(client, "discord_token_user1")
        resp = await client.get("/admin/champions", headers=user_hdrs)
        assert resp.status_code == 403
