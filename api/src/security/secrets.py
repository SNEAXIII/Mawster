import logging
import os

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

api_file = "api.env"

IS_PROD = os.getenv("MODE") == "prod"
IS_TESTING = os.getenv("MODE") == "testing"
# Le staging tourne sans RustFS ni RabbitMQ : VISION_ENABLED=0 y rend les
# réglages vision optionnels et coupe la feature, au lieu de refuser de booter.
VISION_ENABLED = os.getenv("VISION_ENABLED", "1").strip().lower() not in {"0", "false", "no"}
# Un déploiement qui prétend servir la vision doit fournir ses adresses ; celui
# qui l'a coupée n'a rien à fournir.
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
    # Origines CORS séparées par des virgules (ex: "https://mawster.example.com")
    # En dev, défaut permissif ; en prod, DOIT être défini dans api.env
    ALLOWED_ORIGINS: str = Field(... if IS_PROD else "http://localhost:3000")
    API_PORT: int = Field(... if IS_PROD else 8000)
    EMAIL_PEPPER: str = Field(... if IS_PROD else "dev-email-pepper")
    EMAIL_PEPPER_VERSION: int = Field(default=1)
    # --- Vision (roster import) ---------------------------------------------
    RABBITMQ_URL: str = Field(... if _VISION_REQUIRED else "amqp://mawster:mawster@localhost:5672/")
    RUSTFS_ENDPOINT: str = Field(... if _VISION_REQUIRED else "http://localhost:9000")
    # Endpoint que le NAVIGATEUR appelle pour uploader en direct (URL présignée).
    # Distinct de RUSTFS_ENDPOINT, qui reste l'adresse interne serveur→RustFS :
    # SigV4 signe l'en-tête Host, donc une URL signée pour `http://rustfs:9000`
    # est refusée (SignatureDoesNotMatch) dès qu'un navigateur l'envoie au nom
    # public. Obligatoire en prod — sans ça la feature ne peut que produire des
    # URLs mortes, et un boot qui échoue vaut mieux qu'un upload cassé.
    # En dev les deux coïncident : RustFS publie 9000 sur l'hôte.
    RUSTFS_PUBLIC_ENDPOINT: str = Field(... if _VISION_REQUIRED else "http://localhost:9000")
    RUSTFS_ACCESS_KEY: str = Field(... if _VISION_REQUIRED else "mawster")
    RUSTFS_SECRET_KEY: str = Field(... if _VISION_REQUIRED else "mawsterpassword")
    RUSTFS_BUCKET_VISION: str = Field("vision")
    RUSTFS_BUCKET_DATASET: str = Field("dataset")
    # Le consumer AMQP tourne en dev et en prod ; désactivé en MODE=testing pour
    # que la CI et la suite de tests ne dépendent jamais d'un broker, et sur les
    # déploiements sans vision, où il n'y a aucun broker à joindre.
    VISION_CONSUMER_ENABLED: bool = Field(default=not IS_TESTING and VISION_ENABLED)
    # Fenêtre de rétention des objets d'import. DOIT rester alignée sur la règle
    # de lifecycle posée sur le bucket vision par rustfs-init : au-delà, les
    # images n'existent plus et un import ne peut plus être validé honnêtement.
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
