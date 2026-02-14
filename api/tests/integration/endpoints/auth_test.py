import re

import pytest

from src.enums.Roles import Roles
from main import app
from src.security.secrets import SECRET
from src.services.JWTService import JWTService
from src.utils.db import get_session
from tests.integration.endpoints.setup.user_setup import push_one_user
from tests.utils.utils_constant import USER_LOGIN, USER_ID, USER_EMAIL
from tests.utils.utils_db import get_test_session
from tests.utils.utils_client import execute_post_request

app.dependency_overrides[get_session] = get_test_session

# --- Constants ---
REGEX_BEARER = re.compile(r"(eyJ[\da-zA-Z]+\.){2}[\w-]+")
TOKEN_TYPE = "bearer"


# --- Utility functions ---
def create_valid_token() -> str:
    """Create a valid JWT token for testing /auth/session"""
    user_data = {
        "sub": USER_LOGIN,
        "user_id": str(USER_ID),
        "email": USER_EMAIL,
        "role": Roles.USER,
    }
    return JWTService.create_token(user_data)


# --- Test cases ---


@pytest.mark.asyncio
async def test_session__valid_token__returns_user(session):
    # Arrange
    await push_one_user()
    token = create_valid_token()

    # Act
    response = await execute_post_request(
        "/auth/session",
        payload={"token": token},
    )

    # Assert
    assert response.status_code == 200
    body = response.json()
    assert body["login"] == USER_LOGIN
    assert body["email"] == USER_EMAIL


@pytest.mark.asyncio
async def test_session__invalid_token__returns_error():
    # Arrange
    await push_one_user()

    # Act
    response = await execute_post_request(
        "/auth/session",
        payload={"token": "invalid_token"},
    )

    # Assert
    assert response.status_code != 200


@pytest.mark.asyncio
async def test_login_endpoint_removed():
    """Verify that /auth/login no longer exists"""
    # Act
    response = await execute_post_request(
        "/auth/login",
        payload={"username": "test", "password": "test"},
    )

    # Assert
    assert response.status_code in (404, 405)


@pytest.mark.asyncio
async def test_register_endpoint_removed():
    """Verify that /auth/register no longer exists"""
    response = await execute_post_request(
        "/auth/register",
        payload={
            "login": "test",
            "email": "test@test.com",
            "password": "Test1!test",
            "confirm_password": "Test1!test",
        },
    )

    # Assert
    assert response.status_code in (404, 405)
