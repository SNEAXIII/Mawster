import os

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

api_file = "api.env"

IS_PROD = os.getenv("MODE") == "prod"


class Settings(BaseSettings):
    MARIADB_DATABASE: str = Field(... if IS_PROD else "mawster")
    MARIADB_USER: str = Field(... if IS_PROD else "user")
    MARIADB_PASSWORD: str = Field(... if IS_PROD else "password")
    MARIADB_ROOT_PASSWORD: str = Field(... if IS_PROD else "rootpassword")
    MARIADB_PORT: int = Field(... if IS_PROD else 3306)
    MARIADB_HOST: str = Field("mariadb" if IS_PROD else "localhost")
    SECRET_KEY: str = Field(... if IS_PROD else "dev-secret-key")
    ALGORITHM: str = Field(... if IS_PROD else "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(... if IS_PROD else 60, le=60)
    model_config = SettingsConfigDict(env_file=api_file)


SECRET = Settings()
