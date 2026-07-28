from src.messaging.consumer import VisionResultConsumer
from src.messaging.publisher import VisionPublisher
from src.messaging.topology import (  # noqa: F401
    EXCHANGE_NAME,
    MAX_ATTEMPTS,
    QUEUE_JOBS,
    QUEUE_RESULTS,
    ROUTING_KEY_JOB,
    ROUTING_KEY_RESULT,
    declare_topology,
)

_publisher = VisionPublisher()
_consumer = VisionResultConsumer()


def get_publisher() -> VisionPublisher:
    """FastAPI dependency. Tests override this to inject a fake."""
    return _publisher


def get_consumer() -> VisionResultConsumer:
    return _consumer
