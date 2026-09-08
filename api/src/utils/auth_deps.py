from typing import Annotated

from fastapi import Depends

from src.models import User
from src.services.auth.AuthService import AuthService

# Every authenticated route needs the caller's User, and every one of them was
# spelling out the same Annotated/Depends pair. One alias means the JWT lookup
# only has one place to change.
CurrentUser = Annotated[User, Depends(AuthService.get_current_user_in_jwt)]
