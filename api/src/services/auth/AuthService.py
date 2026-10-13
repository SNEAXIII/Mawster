from typing import Annotated

from fastapi import Depends

from src.enums.Roles import Roles
from src.Messages.jwt_messages import INSUFFISANT_ROLE_EXCEPTION
from src.models import User
from src.services.account.UserService import UserService
from src.services.auth.JWTService import JWTService, oauth2_scheme
from src.utils.db import SessionDep


class AuthService:
    @classmethod
    async def get_current_user_in_jwt(
        cls,
        session: SessionDep,
        token: Annotated[str, Depends(oauth2_scheme)],
    ) -> User:
        data = JWTService.decode_jwt(token)
        if data.get("role") not in Roles.__members__.values():
            raise INSUFFISANT_ROLE_EXCEPTION
        user_id = data.get("user_id")
        return await UserService.get_user_by_id_with_validity_check(session, user_id)

    # The role comes from the DB, not the claim: a demoted or disabled admin loses access at once.
    @classmethod
    async def require_admin(
        cls,
        session: SessionDep,
        token: Annotated[str, Depends(oauth2_scheme)],
    ) -> bool:
        user = await cls.get_current_user_in_jwt(session, token)
        if user.role not in (Roles.ADMIN, Roles.SUPER_ADMIN):
            raise INSUFFISANT_ROLE_EXCEPTION
        return True

    @classmethod
    async def require_super_admin(
        cls,
        session: SessionDep,
        token: Annotated[str, Depends(oauth2_scheme)],
    ) -> bool:
        user = await cls.get_current_user_in_jwt(session, token)
        if user.role != Roles.SUPER_ADMIN:
            raise INSUFFISANT_ROLE_EXCEPTION
        return True
