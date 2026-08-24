# Use a PostgreSQL outbox before adding a message broker

Wishlist records required email delivery and URL-import work in PostgreSQL in the same transaction as the domain change, then processes it from separate worker processes with at-least-once delivery and idempotent handlers. This prevents an API crash from losing magic links or reservation lifecycle notifications while keeping the first operational topology to one consistency system.

A separate message broker is intentionally deferred, not rejected. Introduce one only when measured throughput, fan-out to independent consumers, isolation requirements, or outbox contention make PostgreSQL the wrong transport; adding Kafka or RabbitMQ before such a boundary would create a second durability and operations problem without improving the current product invariant.
