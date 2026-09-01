from src.storage.base import Storage, result_key, screen_key, sprite_key  # noqa: F401
from src.storage.s3 import S3Storage

_storage: Storage = S3Storage()


def get_storage() -> Storage:
    """FastAPI dependency. Tests override this to inject a fake."""
    return _storage
