from typing import Annotated
from fastapi import Depends

from src.Messages.jwt_messages import INSUFFISANT_ROLE_EXCEPTION
from src.enums.Roles import Roles

from src.models import User
from src.services.JWTService import JWTService, oauth2_scheme
from src.services.UserService import UserService
from src.utils.db import SessionDep


class AuthService:
    @classmethod
    async def get_current_user_in_jwt(
        cls,
        session: SessionDep,
        token: Annotated[str, Depends(oauth2_scheme)],
    ) -> User:
        data = JWTService.decode_jwt(token)
        user_id = data.get("user_id")
        user = await UserService.get_user_by_id_with_validity_check(
            session, user_id
        )
        return user

    @classmethod
    async def is_logged_as_user(
        cls,
        token: Annotated[str, Depends(oauth2_scheme)],
    ) -> True:
        role = JWTService.decode_jwt(token)["role"]
        if role not in Roles.__members__.values():
            raise INSUFFISANT_ROLE_EXCEPTION
        return True

    @classmethod
    async def is_logged_as_admin(
        cls,
        token: Annotated[str, Depends(oauth2_scheme)],
    ) -> True:
        role = JWTService.decode_jwt(token)["role"]
        if role not in (Roles.ADMIN, Roles.SUPER_ADMIN):
            raise INSUFFISANT_ROLE_EXCEPTION
        return True

    @classmethod
    async def is_logged_as_super_admin(
        cls,
        token: Annotated[str, Depends(oauth2_scheme)],
    ) -> True:
        role = JWTService.decode_jwt(token)["role"]
        if role != Roles.SUPER_ADMIN:
            raise INSUFFISANT_ROLE_EXCEPTION
        return True
