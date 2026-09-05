# Queue arguments are immutable once declared, so changing them is a deploy procedure

Every process that talks to RabbitMQ — the API and the vision worker — calls
`declare_topology` on connect, so a fresh broker is usable whichever service starts
first. That idempotence holds only while the declaration arguments stay byte-identical to
what the broker already holds. The moment the dead-letter arguments on `vision.jobs`
differ, RabbitMQ answers `PRECONDITION_FAILED` (406) and closes the channel for *every*
connecting process, not just the one that changed.

The failure is therefore not a partial degradation: both services lose the broker at
once, and redeploying does not fix it, because the new code declares the same rejected
arguments again.

## Consequences

Changing the dead-letter exchange, its routing key, or any other argument on an existing
queue is a manual operation, not a code change that ships on its own. The existing queue
must be deleted on the broker first — after checking it for unprocessed messages, which
the deletion discards — and only then may the new code deploy.

This is the price of declaring topology from the application rather than provisioning it
separately. It buys a broker that needs no setup step in dev, in CI, or on a fresh
production host, and it costs a documented procedure on the rare occasion the topology
itself changes.
