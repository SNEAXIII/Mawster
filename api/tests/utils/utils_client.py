from contextlib import asynccontextmanager
from typing import Optional

from httpx import AsyncClient, ASGITransport, Response
from main import app

from src.enums.Roles import Roles
from src.services.JWTService import JWTService
from tests.utils.utils_constant import USER_LOGIN, USER_ID, USER_EMAIL


@asynccontextmanager
async def get_test_client() -> AsyncClient:
    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False),
        base_url="http://test",
    ) as client:
        yield client


def create_auth_headers(
    login: str = USER_LOGIN,
    user_id: str = str(USER_ID),
    email: str = USER_EMAIL,
    role: str = Roles.USER,
) -> dict[str, str]:
    """Create Authorization headers with a valid JWT for the given user."""
    token = JWTService.create_token(
        {"sub": login, "user_id": user_id, "email": email, "role": role}
    )
    return {"Authorization": f"Bearer {token}"}


async def execute_get_request(
    route: str, headers: Optional[dict[str, str]] = None
) -> Response:
    async with get_test_client() as client:
        return await client.get(route, headers=headers)


async def execute_post_request(
    route: str, payload: dict, headers: Optional[dict[str, str]] = None
) -> Response:
    async with get_test_client() as client:
        return await client.post(route, json=payload, headers=headers)


async def execute_put_request(
    route: str, payload: dict, headers: Optional[dict[str, str]] = None
) -> Response:
    async with get_test_client() as client:
        return await client.put(route, json=payload, headers=headers)


async def execute_patch_request(
    route: str, payload: dict, headers: Optional[dict[str, str]] = None
) -> Response:
    async with get_test_client() as client:
        return await client.patch(route, json=payload, headers=headers)


async def execute_delete_request(
    route: str,
    headers: Optional[dict[str, str]] = None,
    payload: Optional[dict] = None,
) -> Response:
    async with get_test_client() as client:
        if payload is not None:
            # httpx delete() doesn't support body; use request() instead
            final_headers = {**(headers or {}), "Content-Type": "application/json"}
            return await client.request(
                "DELETE",
                route,
                headers=final_headers,
                content=__import__("json").dumps(payload),
            )
        return await client.delete(route, headers=headers)
