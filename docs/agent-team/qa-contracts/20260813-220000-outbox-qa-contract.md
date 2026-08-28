# QA Contract — Tutoria Reliable Domain Events + Transactional Outbox

Run: `20260813-220000-outbox-reliable-domain-events`

## Authority (in order)

1. Explicit user instruction (outbox test spec, sections 1–86): durable transactional outbox; at-least-once delivery + idempotent consumers; no notifications, no payment provider; local disposable Supabase only; do not rewrite verified migrations 0004/0005; reuse established event vocabulary.
2. Tutoria product policy / product brain: trust-before-transaction; backend authorization authoritative; no PII leakage; Payment never mutates capacity; attendance is evidence not adjudicated truth.
3. Verified repository evidence: `backend/src/domain/booking-lifecycle.ts` (BookingEventType, BookingDomainEvent, domainEventsFor/domainEventsForRequest/attendanceEventFor), `backend/src/domain/session-lifecycle.ts` (SessionEventType, SessionDomainEvent, cancelSession/cancelSessionWithBookings), `backend/src/domain/payment-lifecycle.ts` (PaymentEventType — domain-only, no persistence), `backend/supabase/migrations/0004` + `0005` (verified), `0002` `tutor_profile_events` (event_type + version + safe_metadata SQL template), integration harness (`test-integration/*`, hostname guard, `--no-file-parallelism`).
4. Approved decisions made in this run (orchestrator): event names verbatim from TS; Model B fanout for session cancellation; aggregate `booking`/`session`; aggregate_version = row CAS version; event_version = 1; DB-generated occurred_at; Model B-lite delivery lifecycle with lease recovery; claim primitives implemented to prove safe concurrent claiming; payment events reserved-but-not-emitted.

## Scope

- Additive migrations only: `0006_create_event_outbox.sql` (table, indexes, RLS, private insert helper, worker claim/complete/fail primitives) and `0007_emit_domain_events_from_booking_session_rpcs.sql` (`CREATE OR REPLACE` of existing RPCs to emit transactionally).
- New integration test file `backend/test-integration/event-outbox.test.ts`.
- NOT in scope: notifications, email/push, payment provider, webhooks, workers/consumers runtime, retention/archival jobs, inbox/dedup table, non-local Supabase.
- Do not modify 0001–0005 content.

## Events to be outboxed NOW (exact TS names)

BOOKING_REQUESTED, BOOKING_CONFIRMED, BOOKING_REJECTED, BOOKING_CANCELLED, BOOKING_COMPLETED, BOOKING_RESCHEDULED, RESCHEDULE_REQUESTED, RESCHEDULE_REJECTED, RESCHEDULE_CANCELLED, ATTENDANCE_REPORTED, SESSION_RESCHEDULED, SESSION_CANCELLED.

## Events explicitly NOT outboxed now

SESSION_CREATED, SESSION_COMPLETED, capacity-changed (no event in domain); RESCHEDULE_ACCEPTED (does not exist; acceptance = BOOKING_RESCHEDULED); PAYMENT_ATTEMPTED/SUCCEEDED/FAILED/RETRIED, REFUND_ISSUED (payment persistence absent — reserved in CHECK only, never emitted).

## Acceptance criteria

### A. Transactional atomicity (event correctness)
- A1. Successful `create_booking` writes exactly one `BOOKING_REQUESTED` (agg booking, aggregate_version 1) in the same transaction.
- A2. Capacity-failed `create_booking` writes zero events; row rollback leaves no booking and no event.
- A3. Successful `confirm_booking` writes one `BOOKING_CONFIRMED`; capacity arithmetic unchanged (capacity-neutral, hard-reserved seat count identical before/after confirm).
- A4. Stale-CAS confirmation (wrong expected_version) fails and writes no event.
- A5. Successful `cancel_booking` releases capacity and writes one `BOOKING_CANCELLED` with cancelledBy + fromStatus.
- A6. Unauthorized/forbidden cancellation (learner cancelling a requested booking with cause='host', non-participant, etc.) writes zero events and no state change.
- A7. Accepted reschedule: booking moves in place + `BOOKING_RESCHEDULED` written in ONE transaction (single event; no RESCHEDULE_ACCEPTED).
- A8. Target-full reschedule accept fails atomically: original booking/session untouched AND zero events (including zero RESCHEDULE_* and zero BOOKING_RESCHEDULED).
- A9. `cancel_session` fanout: `SESSION_CANCELLED` + exactly one `BOOKING_CANCELLED` per affected requested/confirmed booking, all committed together; every `BOOKING_CANCELLED` carries `cancelledBySessionId`.
- A10. `record_attendance` writes one `ATTENDANCE_REPORTED` preserving outcome + reportedBy + priorStatus (+source when supplied); no fabricated BOOKING_CANCELLED/BOOKING_COMPLETED emitted from attendance path.
- A11. Successful `complete_booking` writes one `BOOKING_COMPLETED`; no ATTENDANCE_REPORTED emitted for the auto-attended fact.
- A12. `create/reject/cancel_reschedule_request` write exactly RESCHEDULE_REQUESTED / RESCHEDULE_REJECTED / RESCHEDULE_CANCELLED respectively; rejected/forbidden request operations write none.
- A13. `reschedule_session` writes one `SESSION_RESCHEDULED` with old/new startsAt/endsAt.

### B. Delivery semantics
- B1. Outbox rows are immutable in their fact fields (event_type, aggregate_id, aggregate_version, payload, occurred_at) after creation; claim processing mutates only status/claim/retry metadata.
- B2. `claim_pending_events`: two concurrent workers never claim the same row in the same lease window (real PostgreSQL concurrency test with `FOR UPDATE SKIP LOCKED`).
- B3. Claimed-but-never-completed events become claimable again after lease expiry (recovery), so no permanent stuck `processing` rows.
- B4. `fail_event` returns the event to `pending` (never deletes), increments attempt_count, sets available_at for backoff, records truncated sanitized error.
- B5. `complete_event` marks processed with processed_at; processed_at means "outbox processing boundary", never "external side effect delivered".
- B6. Duplicate domain commands (already-applied transition) produce no new events.

### C. Access control / privacy
- C1. `event_outbox`: RLS enabled; anon and authenticated have NO direct table privileges (select/insert/update/delete all denied).
- C2. Direct outbox writes by authenticated/anon clients fail with an error.
- C3. No generic client-callable `emit_event(event_type, payload)` RPC exists.
- C4. `insert_outbox_event` helper is revoked from public/anon/authenticated; only SECURITY DEFINER RPCs emit.
- C5. `claim/complete/fail` are not callable by anon/authenticated (revoked); callable by service_role.
- C6. All outbox payloads contain only IDs and domain facts — no email, phone, name, hostId, learnerId, or raw JWT data.

### D. Ordering / versioning
- D1. Per-aggregate ordering is by aggregate_version (authoritative), tie-broken by occurred_at, then id.
- D2. aggregate_version equals the authoritative row CAS version at the event time (booking/session version after the mutation; unchanged for provisional reschedule-request creation).
- D3. event_version = 1 on every emitted event.
- D4. occurred_at is DB-generated (`now()`), never client-supplied.

### E. Migration / harness integrity
- E1. From a clean local DB: `supabase db reset` applies 0001→0007 cleanly.
- E2. Full integration suite (all existing files + new outbox file) passes; the existing 33 tests and all concurrency invariants remain PASS.
- E3. Harness refuses non-local targets (hostname guard).
- E4. Static checks: SQL parse (pglast) of all migrations; `pnpm typecheck`, `pnpm test`, `pnpm build` PASS.

### F. Evidence required for PASS
- F1. New outbox integration tests naming criteria A1–D4, run against local Supabase.
- F2. Authoritative-row cross-check query after full suite: for every successful mutation in the selected transitions exactly the expected outbox row(s) exist; zero rows for the failed-mutation cases.
- F3. Security manual review of the new surface (privileges, SECURITY DEFINER, search_path, schema qualification, RLS, payload privacy, no generic emit) recorded; automated scanners SKIPPED (not installed) — never reported as PASS.

## Contract changes

Recorded via `scripts/team-observability.py contract-change`, approved by orchestrator only. Criteria may not be silently weakened by implementation.
