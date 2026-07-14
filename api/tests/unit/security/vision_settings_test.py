from src.security.secrets import SECRET


def test_vision_settings_have_dev_defaults():
    assert SECRET.RABBITMQ_URL.startswith("amqp://")
    assert SECRET.RUSTFS_ENDPOINT.startswith("http://")
    assert SECRET.RUSTFS_BUCKET_VISION == "vision"
    assert SECRET.RUSTFS_BUCKET_DATASET == "dataset"
    assert SECRET.VISION_PRESIGN_EXPIRE_SECONDS > 0


def test_vision_consumer_is_disabled_by_default_outside_prod():
    assert SECRET.VISION_CONSUMER_ENABLED is False
