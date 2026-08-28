# Tutoria Production Phase Gates

These gates prevent the agent team from endlessly redesigning architecture or declaring production capability too early.

## Gate 1 — Domain V1 freeze

Required before persistence implementation:
- Booking lifecycle accepted.
- Rescheduling accepted.
- Cancellation accepted.
- Session aggregate accepted.
- Attendance/completion/no-show model accepted enough for persistence.
- Payment/refund/payout domain separation accepted.
- Capacity/concurrency policy and production requirements documented.
- Genuine unresolved product decisions explicitly listed rather than guessed.

Primary agents: existing backend team + independent verifier.

## Gate 2 — Persistence foundation

Required before production APIs:
- Supabase/Postgres schema represents canonical facts.
- FK/check/unique constraints defined.
- RLS policy implemented and independently reviewed.
- Version/CAS or equivalent stale-state strategy where required.
- Capacity acquisition serialization implemented for hard capacity.
- Migration/constraint tests pass.

Primary: database_engineer + security_reviewer + qa_engineer + verifier.

## Gate 3 — Transaction/application services

Required before frontend relies on real booking state:
- booking commands use production transaction boundaries;
- duplicate commands are safe;
- reschedule old→new movement is atomic;
- session cancellation conflicts serialize safely;
- error semantics are stable;
- durable event/outbox record exists where side effects follow.

Primary: integration_engineer + backend_engineer + database_engineer + qa_engineer + verifier.

## Gate 4 — Real money

Required before charging real users:
- provider integration configured securely;
- webhook authenticity verified;
- provider-event deduplication/idempotency works;
- ambiguous network outcomes are recoverable;
- refund/payout operations are auditable;
- reconciliation exists;
- payment success cannot bypass booking/session/capacity rules.

Primary: payments_engineer + integration_engineer + security_reviewer + qa_engineer + verifier.

## Gate 5 — Real vertical slice

Required before alpha:
- one chosen transactional vertical works discovery → session → booking → payment → host action → cancellation/reschedule → attendance/completion → review/payout as applicable;
- frontend uses server-authoritative data;
- browser QA passes;
- authorization and backend adversarial QA pass.

## Gate 6 — Private alpha

Required:
- observability and audit history sufficient to diagnose a failed booking/payment;
- operational recovery documented;
- critical alerts/errors visible;
- real-user happy path requires no developer DB edits;
- known critical/high security blockers resolved.

Primary: reliability_engineer + security_reviewer + qa_browser + qa_engineer + verifier.
