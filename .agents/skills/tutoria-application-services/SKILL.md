---
name: tutoria-application-services
description: Build Tutoria application-service/API command orchestration around accepted domain logic and persistence transactions. Use when wiring authenticated actors, domain transitions, persistence, errors, and durable events.
compatibility: Codex project skill for the Tutoria repository
---

# Tutoria application services

For each command:
1. Resolve authenticated actor and request input.
2. Load canonical current state.
3. Apply authorization at the correct layer.
4. Invoke accepted domain guards/transitions.
5. Enter the smallest required database transaction/serialization boundary.
6. Persist canonical state and durable event/outbox fact.
7. Map domain/validation/stale/concurrency errors into stable API semantics.
8. Return server-authoritative state.

Do not duplicate lifecycle logic in route handlers. Do not trust client-provided remaining capacity, lifecycle status, payment success, or host authority. Payment providers and notifications remain external side effects, not fake local transaction participants.
