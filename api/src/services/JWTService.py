from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jwt.exceptions import (
    DecodeError,
    ExpiredSignatureError,
    InvalidAlgorithmError,
    InvalidSignatureError,
)

from src.Messages.jwt_messages import (
    EXPIRED_EXCEPTION,
    CREDENTIALS_EXCEPTION,
    CANT_FIND_USER_TOKEN_EXCEPTION,
    INVALID_ROLE_EXCEPTION,
    INVALID_TOKEN_EXCEPTION,
)
from src.enums.Roles import Roles
from src.models import User
from src.security.secrets import SECRET

_http_bearer = HTTPBearer()


async def oauth2_scheme(credentials: HTTPAuthorizationCredentials = Depends(_http_bearer)) -> str:
    return credentials.credentials


class JWTService:
    @classmethod
    def create_token(cls, data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """Create a JWT token. If expires_delta is None, use default from settings."""
        to_encode = data.copy()
        if expires_delta is None:
            expires_delta = timedelta(minutes=SECRET.ACCESS_TOKEN_EXPIRE_MINUTES)
        expire = datetime.now(tz=timezone.utc) + expires_delta
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(
            to_encode, SECRET.SECRET_KEY, algorithm=SECRET.ALGORITHM
        )
        return encoded_jwt

    @classmethod
    def create_access_token(cls, user: Optional[User]) -> str:
        if not user:
            raise CREDENTIALS_EXCEPTION
        access_token_expires = timedelta(minutes=SECRET.ACCESS_TOKEN_EXPIRE_MINUTES)
        return JWTService.create_token(
            data={
                "user_id": str(user.id),
                "role": user.role,
                "type": "access",
            },
            expires_delta=access_token_expires,
        )

    @classmethod
    def create_refresh_token(cls, user: Optional[User]) -> str:
        """Create a long-lived refresh token containing only user_id."""
        if not user:
            raise CREDENTIALS_EXCEPTION
        refresh_token_expires = timedelta(days=SECRET.REFRESH_TOKEN_EXPIRE_DAYS)
        return JWTService.create_token(
            data={
                "user_id": str(user.id),
                "type": "refresh",
            },
            expires_delta=refresh_token_expires,
        )

    @classmethod
    def decode_jwt(cls, token: str) -> dict:
        try:
            data = jwt.decode(
                token,
                SECRET.SECRET_KEY,
                algorithms=[SECRET.ALGORITHM],
            )
        except ExpiredSignatureError:
            raise EXPIRED_EXCEPTION
        except (InvalidSignatureError, InvalidAlgorithmError, DecodeError):
            raise INVALID_TOKEN_EXCEPTION
        if data.get("user_id") is None:
            raise CANT_FIND_USER_TOKEN_EXCEPTION
        # Only validate role for access tokens (refresh tokens don't carry role)
        token_type = data.get("type", "access")
        if token_type == "access":
            if data.get("role") not in Roles.__members__.values():
                raise INVALID_ROLE_EXCEPTION
        return data

    @classmethod
    def decode_refresh_token(cls, token: str) -> dict:
        """Decode and validate a refresh token. Raises if not a refresh token."""
        data = cls.decode_jwt(token)
        if data.get("type") != "refresh":
            raise INVALID_TOKEN_EXCEPTION
        return data
