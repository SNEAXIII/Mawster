from slowapi import Limiter
from slowapi.util import get_remote_address

from src.security import IS_PROD

limiter = Limiter(key_func=get_remote_address, enabled=IS_PROD)
