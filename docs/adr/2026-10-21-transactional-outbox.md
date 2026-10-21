# ADR: Reliable workflow audit and notification delivery

- Status: Accepted for implementation planning
- Date: 2026-10-21
- Scope: API workflow transitions, audit events, and in-app notifications

## Context

Performance and cycle workflow services use database transactions and conditional updates to protect state transitions. Controllers then write audit records and notifications after those transactions commit. A process crash or database error between these steps can leave a valid state transition without its audit event or user notification. Batching notification inserts reduces round trips, but does not make them atomic with the workflow transition.

The API currently has no queue, worker, or scheduled-job infrastructure. Introducing an external broker solely for these side effects would add operational cost and deployment complexity.

## Decision

Use a PostgreSQL-backed transactional outbox as the next reliability increment. Do not add an external message broker at this stage.

1. Add an outbox table with a stable event ID, event type, JSON payload, creation/availability timestamps, attempt count, processing/lease timestamps, and last error.
2. Write the business state change, required audit event, and outbox event in the same Prisma transaction. The outbox payload must contain the immutable actor, organisation, entity, and transition context needed later; do not depend on mutable current employee data to reconstruct historical context.
3. Deliver in-app notifications from outbox events using idempotent processing. Use a deterministic delivery key or unique constraint so a retry cannot create duplicate notifications.
4. Claim events with a short database transaction and a lease/claim timestamp so multiple API instances cannot concurrently process the same event. Do not hold a database transaction open while processing the event.
5. Retry transient failures with bounded exponential backoff, preserve a diagnostic error, and surface repeatedly failing events for administrative review. Never silently discard audit events.
6. Keep audit persistence distinct from notification delivery: notifications may be retried, while the audit record for a committed transition must be written atomically with that transition.
7. Preserve existing API response contracts while reliability work is introduced incrementally.

## Operational constraints

- The first implementation should use a database-backed poller only if it can be started and stopped cleanly with Nest lifecycle hooks, has bounded batches, and has a documented polling interval.
- If deployment later runs multiple replicas, use atomic claim/update semantics and idempotent writes; an in-memory lock is insufficient.
- Ensure graceful shutdown releases or lets leases expire.
- Add migration, unit tests for retry/lease/idempotency behaviour, and integration tests proving rollback leaves no state change, audit row, or outbox event.
- Do not claim exactly-once processing. The realistic guarantee is atomic enqueue plus at-least-once delivery with idempotent effects.

## Rollout sequence

1. Introduce schema and repository/service primitives without changing existing controller behaviour.
2. Add transactional audit/outbox support to one representative workflow transition and tests.
3. Migrate remaining cycle and performance transitions incrementally.
4. Add notification delivery, retries, operational visibility, and failure-path tests.
5. Remove duplicate direct post-commit side effects only after the corresponding outbox path is proven by tests.
