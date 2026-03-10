import logging
import os

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

api_file = "api.env"

IS_PROD = os.getenv("MODE") == "prod"
IS_TESTING = os.getenv("MODE") == "testing"

_log = logging.getLogger(__name__)

if not IS_PROD:
    print(f"Selected mode {IS_PROD = }, {IS_TESTING = }")


class Settings(BaseSettings):
    MARIADB_DATABASE: str = Field(... if IS_PROD else "mawster")
    MARIADB_USER: str = Field(... if IS_PROD else "user")
    MARIADB_PASSWORD: str = Field(... if IS_PROD else "password")
    MARIADB_ROOT_PASSWORD: str = Field(... if IS_PROD else "rootpassword")
    MARIADB_PORT: int = Field(... if IS_PROD else 3306)
    MARIADB_HOST: str = Field("mariadb" if IS_PROD else "localhost")
    SECRET_KEY: str = Field(... if IS_PROD else "dev-secret-key_dev-secret-key_dev-secret-key")
    ALGORITHM: str = Field(... if IS_PROD else "HS256")
    BCRYPT_HASH_ROUND: int = Field(... if IS_PROD else 12)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(... if IS_PROD else 60, le=60)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(... if IS_PROD else 7, le=30)
    # Origines CORS séparées par des virgules (ex: "https://mawster.example.com")
    # En dev, défaut permissif ; en prod, DOIT être défini dans api.env
    ALLOWED_ORIGINS: str = Field(... if IS_PROD else "http://localhost:3000,http://localhost:3001")
    model_config = SettingsConfigDict(env_file=api_file)


SECRET = Settings()


def _warn_if_weak_defaults() -> None:
    """Émet des avertissements si des valeurs par défaut faibles sont utilisées hors prod."""
    if IS_PROD:
        return
    weak = {
        "MARIADB_PASSWORD": ("password", SECRET.MARIADB_PASSWORD),
        "MARIADB_ROOT_PASSWORD": ("rootpassword", SECRET.MARIADB_ROOT_PASSWORD),
        "MARIADB_USER": ("user", SECRET.MARIADB_USER),
    }
    for name, (default, current) in weak.items():
        if current == default:
            _log.warning("⚠️  %s utilise la valeur par défaut faible '%s' — ne jamais déployer en production", name, default)


_warn_if_weak_defaults()
