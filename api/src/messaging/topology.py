from aio_pika import ExchangeType
from aio_pika.abc import AbstractChannel, AbstractExchange

EXCHANGE_NAME = "mcoc.vision"
DLX_NAME = "mcoc.vision.dlx"

QUEUE_JOBS = "vision.jobs"
QUEUE_RESULTS = "vision.results"
QUEUE_DEAD = "vision.jobs.dead"

ROUTING_KEY_JOB = "job"
ROUTING_KEY_RESULT = "result"
ROUTING_KEY_DEAD = "dead"

# A job that failed this many times is dead-lettered instead of being retried forever.
MAX_ATTEMPTS = 3


async def declare_topology(channel: AbstractChannel) -> AbstractExchange:
    """Declare exchanges and queues. Idempotent: every process that connects calls
    this, so a fresh broker is usable whichever service starts first."""
    exchange = await channel.declare_exchange(EXCHANGE_NAME, ExchangeType.DIRECT, durable=True)
    dlx = await channel.declare_exchange(DLX_NAME, ExchangeType.DIRECT, durable=True)

    dead_queue = await channel.declare_queue(QUEUE_DEAD, durable=True)
    await dead_queue.bind(dlx, routing_key=ROUTING_KEY_DEAD)

    jobs_queue = await channel.declare_queue(
        QUEUE_JOBS,
        durable=True,
        arguments={
            "x-dead-letter-exchange": DLX_NAME,
            "x-dead-letter-routing-key": ROUTING_KEY_DEAD,
        },
    )
    await jobs_queue.bind(exchange, routing_key=ROUTING_KEY_JOB)

    results_queue = await channel.declare_queue(QUEUE_RESULTS, durable=True)
    await results_queue.bind(exchange, routing_key=ROUTING_KEY_RESULT)

    return exchange
