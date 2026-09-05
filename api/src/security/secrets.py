import logging
import os

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

api_file = "api.env"

IS_PROD = os.getenv("MODE") == "prod"
IS_TESTING = os.getenv("MODE") == "testing"
# Staging runs without RustFS or RabbitMQ: VISION_ENABLED=0 makes the vision
# settings optional there and turns the feature off, rather than refusing to boot.
VISION_ENABLED = os.getenv("VISION_ENABLED", "1").strip().lower() not in {"0", "false", "no"}
_VISION_REQUIRED = IS_PROD and VISION_ENABLED

_log = logging.getLogger(__name__)


def _default_database() -> int:
    """Return the default database port based on mode."""
    return 3305 if not IS_TESTING else 3307


class Settings(BaseSettings):
    MARIADB_DATABASE: str = Field(... if IS_PROD else "mawster")
    MARIADB_USER: str = Field(... if IS_PROD else "user")
    MARIADB_PASSWORD: str = Field(... if IS_PROD else "password")
    MARIADB_ROOT_PASSWORD: str | None = Field(None if IS_PROD else "rootpassword")
    MARIADB_PORT: int = Field(... if IS_PROD else _default_database())
    MARIADB_HOST: str = Field("mariadb" if IS_PROD else "localhost")
    SECRET_KEY: str = Field(... if IS_PROD else "dev-secret-key_dev-secret-key_dev-secret-key")
    ALGORITHM: str = Field("HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(... if IS_PROD else 60, le=60)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(... if IS_PROD else 7, le=30)
    # Comma-separated CORS origins (e.g. "https://mawster.example.com").
    # Permissive default in dev; in prod it MUST be set in api.env.
    ALLOWED_ORIGINS: str = Field(... if IS_PROD else "http://localhost:3000")
    API_PORT: int = Field(... if IS_PROD else 8000)
    EMAIL_PEPPER: str = Field(... if IS_PROD else "dev-email-pepper")
    EMAIL_PEPPER_VERSION: int = Field(default=1)
    # --- OAuth audience ------------------------------------------------------
    # The application an access token must have been issued to. Without this check,
    # a token issued for any other application still resolves to a valid profile, and
    # Mawster would sign a JWT for that user. Mandatory in prod: a deployment unable to
    # verify the audience must refuse to start rather than accept every token.
    DISCORD_CLIENT_ID: str = Field(... if IS_PROD else "dev-discord-client-id")
    GOOGLE_CLIENT_ID: str = Field(... if IS_PROD else "dev-google-client-id")
    # --- Vision (roster import) ---------------------------------------------
    RABBITMQ_URL: str = Field(... if _VISION_REQUIRED else "amqp://mawster:mawster@localhost:5672/")
    RUSTFS_ENDPOINT: str = Field(... if _VISION_REQUIRED else "http://localhost:9000")
    # The endpoint the BROWSER calls to upload directly (presigned URL). Distinct from
    # RUSTFS_ENDPOINT, which stays the internal server-to-RustFS address: SigV4 signs the
    # Host header, so a URL signed for `http://rustfs:9000` is rejected
    # (SignatureDoesNotMatch) as soon as a browser sends it to the public name. Mandatory
    # in prod - without it the feature can only produce dead URLs, and a failing boot
    # beats a broken upload. In dev the two coincide: RustFS publishes 9000 on the host.
    RUSTFS_PUBLIC_ENDPOINT: str = Field(... if _VISION_REQUIRED else "http://localhost:9000")
    RUSTFS_ACCESS_KEY: str = Field(... if _VISION_REQUIRED else "mawster")
    RUSTFS_SECRET_KEY: str = Field(... if _VISION_REQUIRED else "mawsterpassword")
    RUSTFS_BUCKET_VISION: str = Field("vision")
    RUSTFS_BUCKET_DATASET: str = Field("dataset")
    # The AMQP consumer runs in dev and in prod; disabled under MODE=testing so CI and
    # the test suite never depend on a broker, and on vision-less deployments, where
    # there is no broker to reach.
    VISION_CONSUMER_ENABLED: bool = Field(default=not IS_TESTING and VISION_ENABLED)
    # Retention window for import objects. MUST stay aligned with the lifecycle rule
    # rustfs-init sets on the vision bucket: past it the images no longer exist and an
    # import can no longer be validated honestly.
    VISION_RETENTION_DAYS: int = Field(default=7)
    model_config = SettingsConfigDict(env_file=api_file)


SECRET = Settings()


def _warn_if_weak_defaults() -> None:
    """Émet des avertissements si des valeurs par défaut faibles sont utilisées hors prod."""
    if IS_PROD:
        return  # pragma: no cover
    weak = {
        "MARIADB_PASSWORD": ("password", SECRET.MARIADB_PASSWORD),
        "MARIADB_ROOT_PASSWORD": ("rootpassword", SECRET.MARIADB_ROOT_PASSWORD or ""),
        "MARIADB_USER": ("user", SECRET.MARIADB_USER),
    }
    for name, (default, current) in weak.items():
        if current == default:
            _log.warning(
                "⚠️  %s utilise la valeur par défaut faible '%s' — ne jamais déployer en production",
                name,
                default,
            )


_warn_if_weak_defaults()

if not IS_PROD:
    print(f"Selected mode {IS_PROD = }, {IS_TESTING = }")
    print(
        f"Secret settings loaded: MARIADB_DATABASE={SECRET.MARIADB_DATABASE}, MARIADB_USER={SECRET.MARIADB_USER}, MARIADB_HOST={SECRET.MARIADB_HOST}, MARIADB_PORT={SECRET.MARIADB_PORT}"
    )
