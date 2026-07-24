import jwt

from src.services.auth.JWTService import JWTService


def decode_module_mock(mocker, return_value: dict[str, str] | None):
    return mocker.patch.object(
        jwt,
        "decode",
        return_value=return_value,
    )


def decode_service_mock(mocker, return_value: dict[str, str] | None):
    return mocker.patch.object(
        JWTService,
        "decode_jwt",
        return_value=return_value,
    )


def encode_mock(mocker):
    return mocker.patch.object(
        jwt,
        "encode",
    )


def create_token_mock(mocker):
    return mocker.patch.object(
        JWTService,
        "create_token",
    )
