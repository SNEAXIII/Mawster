from contextlib import asynccontextmanager
from httpx import AsyncClient, ASGITransport, Response
from main import app


@asynccontextmanager
async def get_test_client() -> AsyncClient:
    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False),
        base_url="http://test",
    ) as client:
        yield client


async def execute_get_request(route: str) -> Response:
    async with get_test_client() as client:
        return await client.get(route)


async def execute_post_request(route: str, payload: dict) -> Response:
    async with get_test_client() as client:
        return await client.post(
            route,
            json=payload,
        )
