---
name: tutoria-backend-qa
description: Adversarially test Tutoria backend, database, API, lifecycle, concurrency, idempotency, payment, and failure paths. Use after non-trivial backend/persistence/integration changes; distinct from browser/visual QA.
compatibility: Codex project skill for the Tutoria repository
---

# Tutoria backend QA

Attack behavior rather than restating implementation.

Relevant scenarios include:
- last-seat and multi-seat races;
- competing reschedules to one final seat;
- confirm vs cancel; cancel vs reschedule; session cancel vs acquire;
- participant increase vs another booking;
- stale aggregate version/CAS;
- duplicate command/retry after timeout;
- duplicate/reordered payment webhook;
- unauthorized and cross-account requests;
- outbox/consumer retry;
- migration/constraint violations and rollback integrity.

Testing honesty: pure unit tests specify expected serialized outcomes but do not prove production DB concurrency. Unavailable/skipped checks are `UNVERIFIED`. Report reproducible failures with expected vs actual, severity, evidence, and responsible owner.
