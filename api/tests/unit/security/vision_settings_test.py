from src.security.secrets import IS_TESTING, SECRET


def test_vision_settings_have_dev_defaults():
    assert SECRET.RABBITMQ_URL.startswith("amqp://")
    assert SECRET.RUSTFS_ENDPOINT.startswith("http://")
    assert SECRET.RUSTFS_BUCKET_VISION == "vision"
    assert SECRET.RUSTFS_BUCKET_DATASET == "dataset"


def test_vision_consumer_follows_the_testing_mode():
    """The consumer runs everywhere except under MODE=testing. Note this only
    disables it when MODE is actually "testing" — CI runs MODE=dev, so the
    consumer is enabled there and the suite stays broker-free only because the
    tests never start the lifespan."""
    assert SECRET.VISION_CONSUMER_ENABLED is not IS_TESTING
