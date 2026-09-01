import importlib

from src.security import secrets as secrets_module
from src.security.secrets import IS_TESTING, SECRET, VISION_ENABLED


def test_vision_settings_have_dev_defaults():
    assert SECRET.RABBITMQ_URL.startswith("amqp://")
    assert SECRET.RUSTFS_ENDPOINT.startswith("http://")
    assert SECRET.RUSTFS_BUCKET_VISION == "vision"
    assert SECRET.RUSTFS_BUCKET_DATASET == "dataset"
    assert SECRET.VISION_RETENTION_DAYS == 7


def test_vision_consumer_follows_the_testing_mode():
    """The consumer runs everywhere except under MODE=testing. Note this only
    disables it when MODE is actually "testing" — CI runs MODE=dev, so the
    consumer is enabled there and the suite stays broker-free only because the
    tests never start the lifespan."""
    assert SECRET.VISION_CONSUMER_ENABLED is not IS_TESTING


def test_vision_is_enabled_by_default():
    assert VISION_ENABLED is True


def test_vision_disabled_makes_the_settings_optional(monkeypatch):
    """VISION_ENABLED=0 is what lets staging boot without RustFS nor RabbitMQ:
    the endpoints stop being required and the consumer stays down."""
    monkeypatch.setenv("VISION_ENABLED", "0")
    try:
        reloaded = importlib.reload(secrets_module)
        assert reloaded.VISION_ENABLED is False
        assert reloaded._VISION_REQUIRED is False
        assert reloaded.SECRET.VISION_CONSUMER_ENABLED is False
    finally:
        monkeypatch.undo()
        importlib.reload(secrets_module)
