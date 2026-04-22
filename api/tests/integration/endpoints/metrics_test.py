import pytest

from tests.utils.utils_client import execute_get_request


@pytest.mark.asyncio
async def test_metrics_endpoint_returns_200():
    response = await execute_get_request("/metrics")
    assert response.status_code == 200
    assert "http_request_duration_seconds" in response.text
