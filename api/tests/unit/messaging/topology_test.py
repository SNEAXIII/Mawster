from unittest.mock import AsyncMock

import pytest
from aio_pika import ExchangeType

from src.messaging.topology import (
    DLX_NAME,
    EXCHANGE_NAME,
    QUEUE_DEAD,
    QUEUE_JOBS,
    QUEUE_RESULTS,
    ROUTING_KEY_DEAD,
    ROUTING_KEY_JOB,
    ROUTING_KEY_RESULT,
    declare_topology,
)


def _channel_with_named_declares() -> tuple[AsyncMock, dict, dict]:
    """Build a channel mock whose declare_exchange/declare_queue return a
    distinct AsyncMock per name, so bind() calls can be asserted against the
    exact object they were bound to (a permissive AsyncMock would accept any
    routing key silently)."""
    exchanges = {EXCHANGE_NAME: AsyncMock(), DLX_NAME: AsyncMock()}
    queues = {QUEUE_DEAD: AsyncMock(), QUEUE_JOBS: AsyncMock(), QUEUE_RESULTS: AsyncMock()}

    async def declare_exchange(name, exchange_type, durable):
        assert exchange_type == ExchangeType.DIRECT
        assert durable is True
        return exchanges[name]

    async def declare_queue(name, durable, arguments=None):
        assert durable is True
        return queues[name]

    channel = AsyncMock()
    channel.declare_exchange = AsyncMock(side_effect=declare_exchange)
    channel.declare_queue = AsyncMock(side_effect=declare_queue)
    return channel, exchanges, queues


@pytest.mark.asyncio
async def test_declare_topology_declares_exchange_and_dlx():
    channel, exchanges, _ = _channel_with_named_declares()

    result = await declare_topology(channel)

    assert result is exchanges[EXCHANGE_NAME]
    channel.declare_exchange.assert_any_await(EXCHANGE_NAME, ExchangeType.DIRECT, durable=True)
    channel.declare_exchange.assert_any_await(DLX_NAME, ExchangeType.DIRECT, durable=True)
    assert channel.declare_exchange.await_count == 2


@pytest.mark.asyncio
async def test_declare_topology_declares_queues_durable():
    channel, _, _ = _channel_with_named_declares()

    await declare_topology(channel)

    channel.declare_queue.assert_any_await(QUEUE_DEAD, durable=True)
    channel.declare_queue.assert_any_await(QUEUE_RESULTS, durable=True)
    assert channel.declare_queue.await_count == 3


@pytest.mark.asyncio
async def test_declare_topology_jobs_queue_dead_letter_arguments_are_exact():
    """The dead-letter argument names/values are a cross-repo contract with the
    vision worker: a rename here silently breaks dead-lettering without any
    error until PRECONDITION_FAILED is triggered by an unrelated change."""
    channel, _, _ = _channel_with_named_declares()

    await declare_topology(channel)

    channel.declare_queue.assert_any_await(
        QUEUE_JOBS,
        durable=True,
        arguments={
            "x-dead-letter-exchange": "mcoc.vision.dlx",
            "x-dead-letter-routing-key": "dead",
        },
    )


@pytest.mark.asyncio
async def test_declare_topology_binds_queues_with_expected_routing_keys():
    channel, exchanges, queues = _channel_with_named_declares()

    await declare_topology(channel)

    queues[QUEUE_DEAD].bind.assert_awaited_once_with(
        exchanges[DLX_NAME], routing_key=ROUTING_KEY_DEAD
    )
    queues[QUEUE_JOBS].bind.assert_awaited_once_with(
        exchanges[EXCHANGE_NAME], routing_key=ROUTING_KEY_JOB
    )
    queues[QUEUE_RESULTS].bind.assert_awaited_once_with(
        exchanges[EXCHANGE_NAME], routing_key=ROUTING_KEY_RESULT
    )
