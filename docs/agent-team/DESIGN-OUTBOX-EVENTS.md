# Design — Reliable Domain Events + Transactional Outbox

Run: `20260813-220000-outbox-reliable-domain-events`
Status: implemented; verification paused mid-run due to a parallel local-DB session (see §38).

## Part A — Objective and framing

### 1. Objective

Make Tutoria's committed domain facts durable and observable: when an authoritative
booking/session mutation commits in PostgreSQL, the corresponding domain event is
written **in the same transaction** (transactional outbox), so an event can never be
silently lost between the mutation and any downstream consumer (notifications,
payment orchestration, analytics, trust/safety). Delivery is explicitly
**at-least-once**; consumers must be idempotent.

### 2. Scope and non-goals

In scope:
- Additive migrations `0006_create_event_outbox.sql` (table, indexes, RLS, private
  emission helper, worker claim/complete/fail primitives) and
  `0007_emit_domain_events_from_booking_session_rpcs.sql` (`CREATE OR REPLACE` of the
  13 booking/session RPCs to emit transactionally).
- Integration test suite `backend/test-integration/event-outbox.test.ts`.

Out of scope (explicitly **not** built here):
- Notifications (email/push/in-app), payment-provider integration, webhooks.
- A worker/consumer **runtime** (dispatcher loop, retry scheduling, idempotency keys
  for side effects). The spec's option A is chosen: implement the outbox table and the
  minimal claim primitives to *prove safe concurrent claiming*; the processor is future.
- Inbox / dedup / consumer-offset tables, retention or archival jobs.
- Any non-local Supabase; demo SPA surfaces; payment persistence (none exists).

### 3. Existing state (verified in repo)

- No outbox/inbox/queue/worker/bus code exists anywhere (repo-wide inventory).
- `booking_history` and `session_history` (0004/0005) are **audit** tables, not queues;
  they are retained unchanged.
- `0002` `tutor_profile_events` is the SQL template precedent: `event_type` + `version`
  + `safe_metadata` (IDs only, no PII).
- `cancelSessionWithBookings` (domain) already fans out one session event + one booking
  event per affected booking — the fanout model is pre-established, not invented here.
- Skill `.agents/skills/tutoria-idempotency-outbox/SKILL.md` already prescribes
  same-transaction outbox + idempotent consumers.
- Verified migrations 0001–0005 are the frozen baseline; per task §79 they are **not**
  rewritten. 0007 only `CREATE OR REPLACE`s functions, preserving their logic and shapes.

### 4. Event vocabulary (repository authority, never invented)

| Event | Source of truth |
|---|---|
| BOOKING_REQUESTED, BOOKING_CONFIRMED, BOOKING_REJECTED, BOOKING_CANCELLED, BOOKING_COMPLETED, BOOKING_RESCHEDULED, RESCHEDULE_REQUESTED, RESCHEDULE_REJECTED, RESCHEDULE_CANCELLED, ATTENDANCE_REPORTED | `backend/src/domain/booking-lifecycle.ts:766` (`BookingEventType`) |
| SESSION_RESCHEDULED, SESSION_CANCELLED | `backend/src/domain/session-lifecycle.ts:105` (`SessionEventType`) |
| PAYMENT_ATTEMPTED, PAYMENT_SUCCEEDED, PAYMENT_FAILED, PAYMENT_RETRIED, REFUND_ISSUED | `backend/src/domain/payment-lifecycle.ts:437` (`PaymentEventType`) |

TS names and SQL names agree verbatim. There is no `BOOKING_ACCEPTED` (confirmation =
BOOKING_CONFIRMED) and no `RESCHEDULE_ACCEPTED` (acceptance = BOOKING_RESCHEDULED).

### 5. Design principles

- **Commit-and-event atomicity**: the event is inserted after all validity/CAS/capacity
  checks pass and *inside the same PL/pgSQL transaction*; any failure raises before the
  insert, so a rolled-back mutation cannot leave a false event and a stale CAS retry
  cannot double-emit.
- **Database-generated facts only**: `occurred_at` is always `now()` in the DB; payloads
  are built from authoritative row state, never from arbitrary client input.
- **Immutable facts, mutable delivery metadata**: fact fields (`event_type`,
  `aggregate_*`, `payload`, `occurred_at`) are never updated after creation; only
  status/claim/retry fields change.
- **Backend authorization is authoritative**: RLS on, fully revoked; all access flows
  through SECURITY DEFINER RPCs; client metadata is never trusted.
- **At-least-once with idempotent consumers** is an explicit contract, not an
  implementation detail.

### 6. Rejected alternatives

- **Emit events from application code after the DB commit** (outbox-in-app): leaks the
  window between commit and publish; a crash loses events. Rejected.
- **Dual-write from the client**: clients are not trusted; authorization is server-side.
  Rejected.
- **General-purpose queue/bus (Redis/SQS/…)** at this stage: adds operational surface
  with no persistence source of truth; out-of-scope and violates "minimal" for this task.
- **Inbox/dedup table now**: no consumer exists yet; premature. Deferred to the worker
  phase.

## Part B — Domain decisions

### 7. Events outboxed NOW (exact TS names)

BOOKING_REQUESTED, BOOKING_CONFIRMED, BOOKING_REJECTED, BOOKING_CANCELLED,
BOOKING_COMPLETED, BOOKING_RESCHEDULED, RESCHEDULE_REQUESTED, RESCHEDULE_REJECTED,
RESCHEDULE_CANCELLED, ATTENDANCE_REPORTED, SESSION_RESCHEDULED, SESSION_CANCELLED.

### 8. Events reserved but not emitted

PAYMENT_ATTEMPTED, PAYMENT_SUCCEEDED, PAYMENT_FAILED, PAYMENT_RETRIED, REFUND_ISSUED are
present in the CHECK constraint only. No payment persistence exists, so there is no
authoritative financial mutation to back them; emitting them would fabricate facts.

### 9. Events explicitly not outboxed

- SESSION_CREATED, SESSION_COMPLETED: no such events exist in the TS domain; creating
  them would invent vocabulary.
- RESCHEDULE_ACCEPTED: does not exist; acceptance is BOOKING_RESCHEDULED.
- Capacity-changed: the TS domain defines no capacity event.

### 10. Session-cancellation fanout (Model B)

`cancel_session` emits `SESSION_CANCELLED` (aggregate `session`) plus exactly one
`BOOKING_CANCELLED` (aggregate `booking`) per affected requested/confirmed booking —
matching the domain's `cancelSessionWithBookings`. All rows commit together; every
fanout `BOOKING_CANCELLED` carries `cancelledBySessionId` so a consumer can correlate
and deduplicate against the session event.

### 11. Attendance semantics

- `record_attendance` → one `ATTENDANCE_REPORTED` (outcome, priorStatus, reportedBy=host,
  source when supplied). No fabricated BOOKING_CANCELLED or BOOKING_COMPLETED.
- `complete_booking` → one `BOOKING_COMPLETED`. The auto-written attendance fact from
  completion is **not** an ATTENDANCE_REPORTED event (it is not a host report).
- Attendance is evidence, not adjudicated truth.

### 12. Aggregate identity and versioning

- Aggregates: `booking` and `session` only.
- `aggregate_id`: the authoritative row id.
- `aggregate_version`: the row CAS version at event time — the booking/session version
  **after** the mutation; for provisional reschedule-request creation (no booking status
  change) it is the **unchanged** booking version. This makes per-aggregate event order
  exactly equal authoritative row evolution.
- `event_version = 1` on every emitted event (additive schema versioning; consumers must
  tolerate additive payload fields).

## Part C — Schema (migration 0006)

### 13. `event_outbox` table

`id uuid PK default gen_random_uuid()`; `event_type text` (CHECK over the 12 outboxed +
5 reserved names); `event_version int NOT NULL DEFAULT 1`; `aggregate_type text` CHECK in
(booking, session); `aggregate_id uuid`; `aggregate_version bigint CHECK (> 0)`;
`occurred_at timestamptz NOT NULL DEFAULT now()`; `payload jsonb NOT NULL`;
`status text CHECK in (pending, processing, processed)`; delivery metadata in §16.

### 14. `event_version` semantics

`1` for every row today. It versions the **payload schema contract** (additive changes
only), independent of the aggregate version. Consumers switch on it.

### 15. `occurred_at` semantics

DB-generated `now()`; never client-supplied; no `occurredAt` key is accepted anywhere in
payloads. Ordering/observability uses it as tie-break after `aggregate_version`.

### 16. Delivery metadata columns

`available_at` (when claimable), `attempt_count`, `last_error` (≤ 500 chars),
`processed_at` (outbox processing boundary only — see §24), `claimed_by`,
`claimed_at`, `lease_until`, `created_at`.

### 17. Indexes

- `event_outbox_claim (status, available_at, occurred_at)` — claim scan (pending +
  expired-lease) in age order.
- `event_outbox_aggregate (aggregate_type, aggregate_id, aggregate_version)` —
  per-aggregate ordering / observability.
- `event_outbox_processed (processed_at) WHERE status = 'processed'` — terminal-population
  observability.

### 18. RLS and grants

`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`; `REVOKE ALL ... FROM public, anon,
authenticated`. No client role can touch the table directly. Worker functions are granted
EXECUTE to `service_role` only; `insert_outbox_event` is granted to the owner only.

### 19. Immutability guarantees

Fact fields are set at insert and never written again by any function (verified by test:
row equality of fact fields before/after processing). Retry metadata columns are the only
mutable ones.

### 20. Constraint safety net

The CHECK lists make unsupported event names, aggregate types, versions, statuses, and
negative versions impossible at the storage layer, so a future emitting RPC cannot
silently introduce an unapproved event type.

## Part D — Delivery lifecycle

### 21. `pending → processing → processed`

- `pending` (available): claimable.
- `processing` (claimed, lease held): a worker owns it for the lease window.
- `processed`: `complete_event` terminal state; `processed_at` set. No other terminal
  state exists (no `failed` state — failures return to `pending` for retry).

### 22. Claim primitive

`claim_pending_events(p_worker_id, p_max_count, p_lease_seconds) → setof jsonb`. Selects
`pending` rows with `available_at <= now()` plus `processing` rows whose lease has
expired, ordered by `(occurred_at, id)`, `LIMIT p_max_count FOR UPDATE SKIP LOCKED`.
For each, sets `processing`, `claimed_by`, `claimed_at`, `lease_until = now() + lease`,
increments `attempt_count`, and returns the fact fields + attempt count as JSON.

### 23. Lease and recovery

A claim holds the row exclusively for `lease_until`. A worker that crashes without
completing leaves a `processing` row; after the lease expires it becomes claimable again
(no permanently stuck rows). Verified by test (simulated expiry → second worker claims,
attempt_count = 2).

### 24. Complete primitive and `processed_at` semantics

`complete_event(p_worker_id, p_event_id)` marks the row `processed` and clears claim
fields **only if** it is `processing` and claimed by that worker (else `insufficient
_privilege`). `processed_at` means "the outbox processing boundary was crossed", never
"the external side effect was delivered" — an idempotent consumer must confirm actual
side-effect success elsewhere.

### 25. Fail primitive and backoff

`fail_event(p_worker_id, p_event_id, p_error, p_backoff_seconds)` returns the row to
`pending` with `available_at = now() + backoff`, records `last_error` truncated to 500
chars (sanitized; the error string may be truncated but is the raw worker error), and
clears the claim. Never deletes the event.

### 26. Concurrency and claim ordering

Two concurrent workers running `claim_pending_events` never receive the same row in the
same window: `FOR UPDATE SKIP LOCKED` makes the second worker skip rows the first has
locked. Verified by a real PostgreSQL two-connection test (worker A holds its
transaction; worker B's claim excludes A's row). Claim order is strictly by
`(occurred_at, id)` within the eligible set.

### 27. At-least-once and the consumer contract

Delivery is at-least-once: crash-after-side-effect-before-complete reproduces the event
after lease expiry, so consumers MUST be idempotent (key by aggregate_type +
aggregate_id + aggregate_version, or by event id / the request id). This is recorded as
an explicit contract, and `RESCHEDULE_REQUESTED` events carry the stable request id so
consumers can deduplicate.

### 28. Worker runtime deferred (spec option A)

The dispatch loop, retry/backoff scheduler, and side-effect idempotency keys are **not**
built. The primitives prove the storage contract; wiring a processor is a follow-on task.
Consequence: outbox rows accumulate as `pending` until a consumer exists.

## Part E — Emission integration (migration 0007)

### 29. Same-transaction emission pattern

Every emitting RPC: perform all validity/CAS/capacity/uniqueness checks → mutate
authoritative rows → write `booking_history`/`session_history` → `perform
public.insert_outbox_event(...)` → return. Any `raise exception` aborts the whole
transaction including the event.

### 30. Emission points and payloads (13 RPCs)

- `reschedule_session` → SESSION_RESCHEDULED (sessionId, oldStart, oldEnd, newStart,
  newEnd); capacity untouched.
- `cancel_session` → SESSION_CANCELLED (sessionId, cause, reason?) + fanout
  BOOKING_CANCELLED per affected booking (bookingId, sessionId, cancelledBy=host,
  fromStatus, cancelledBySessionId).
- `create_booking` → BOOKING_REQUESTED (bookingId, sessionId, participantCount);
  aggregate_version 1.
- `confirm_booking` → BOOKING_CONFIRMED (bookingId, sessionId, fromStatus=requested).
- `reject_booking` → BOOKING_REJECTED (bookingId, sessionId, fromStatus=requested).
- `cancel_booking` → BOOKING_CANCELLED (bookingId, sessionId, cancelledBy, fromStatus,
  reason?).
- `complete_booking` → BOOKING_COMPLETED (bookingId, sessionId, fromStatus=confirmed);
  attendance fact written first (attended, attendee), no ATTENDANCE_REPORTED.
- `record_attendance` → ATTENDANCE_REPORTED (bookingId, sessionId, outcome,
  priorStatus, reportedBy=host, source?).
- `create_reschedule_request` → RESCHEDULE_REQUESTED (requestId, bookingId,
  fromSessionId, toSessionId, requestedBy, reason?); aggregate_version unchanged.
- `accept_reschedule_request` → BOOKING_RESCHEDULED (bookingId, sessionId=to,
  requestId, fromSessionId, toSessionId, fromStatus, reason?); both sessions locked in
  ascending-id order; capacity+uniqueness checks before move+event.
- `reject_reschedule_request` → RESCHEDULE_REJECTED (requestId, bookingId,
  fromSessionId, toSessionId, actor).
- `cancel_reschedule_request` → RESCHEDULE_CANCELLED (same shape, actor).
- `change_session_capacity`, `complete_session`, `create_session`: no outbox event
  (no corresponding TS event).

### 31. Failure atomicity

All failure paths (`STALE_VERSION`, `INSUFFICIENT_CAPACITY`, `BOOKING_CONFLICT`,
`SESSION_NOT_OPEN`, `INVALID_TRANSITION`, `insufficient_privilege`, `SESSION_IN_FUTURE`)
raise **before** the `insert_outbox_event` call, so zero events are written on any
rejected mutation. Verified for capacity failure, stale CAS, duplicate transitions,
forbidden actor, target-full reschedule.

### 32. Migration strategy

0001–0005 are untouched (task §79). 0006 adds the outbox; 0007 `CREATE OR REPLACE`s the
RPCs. The chain applies cleanly from a clean DB (`supabase db reset` 0001→0007). The
integration harness applies 0001+0004+0005+0006+0007 in `beforeAll` in the three
booking/session suites so the RPCs are always the emitting versions regardless of file
order.

### 33. No generic emit endpoint

There is no client-callable `emit_event(event_type, payload)` RPC. Emission is only the
private `insert_outbox_event` helper invoked inside the SECURITY DEFINER RPCs, revoked
from all client roles. A future feature must add a reviewed, constraint-validated RPC.

## Part F — Verification

### 34. QA contract linkage

`docs/agent-team/qa-contracts/20260813-220000-outbox-qa-contract.md` defines criteria
A1–A13 (emission correctness), B1–B6 (delivery), C1–C6 (access/privacy), D1–D4
(ordering/versioning), E1–E4 (migration/harness), F1–F3 (evidence). Every outbox
integration test names its criteria.

### 35. Integration tests and concurrency proof

`event-outbox.test.ts` (29 tests): exact event rows per transition, zero events on every
failure path, fanout atomicity, payload field checks, outbox immutability,
claim/complete/fail/lease-recovery, wrong-worker denial, two-worker SKIP LOCKED
exclusivity, claim ordering by occurred_at, access denials (table + RPCs), PII scan, and
global invariants (single event_version, no fabricated types, indexes present). Task §74
test #16 (concurrent claim exclusivity) is implemented as a real two-connection test.

### 36. Migration from-zero verification

`supabase db reset` in `backend/` applied 0001→0007 cleanly on the disposable local
stack. Post-apply checks confirmed: table + RLS on, grants correct (service_role-only
worker functions), 12 of 13 booking/session RPCs emit.

### 37. Static checks and security manual review

- `pnpm typecheck` PASS, `pnpm test` (182 unit) PASS, `pnpm build` PASS.
- pglast SQL parse: **SKIPPED** (not installed; superseded by the authoritative
  PostgreSQL apply which parsed and executed 0006/0007 successfully).
- Security manual review of 0006/0007 recorded (see §39 risk notes): privileges, SECURITY
  DEFINER + `set search_path=''`, full schema qualification, RLS, payload PII check,
  no generic emit. Automated scanners (Strix/Trivy/etc.) are not installed → reported
  SKIPPED, never PASS.

### 38. Result status and verification caveat

- **Interim**: migrations apply from zero; 25/29 outbox tests pass deterministically in
  isolation; 4 tests exhibit mid-run flakiness attributable to a **parallel Codex
  session** (`20260813-220757-prove-the-supabase-rls-concurrency-i.json`) running the
  same local Supabase and test files (transient PGRST202, concurrent row churn in the
  same `bookings`/`event_outbox` tables).
- **Final full-suite re-run is blocked pending that session's completion** (coordinated
  pause, per orchestrator decision). Until a clean, interference-free full-suite run, the
  formal status is UNVERIFIED-for-full-suite, not PASS.

## Part G — Handoff

### 39. Handoff matrix, remaining risks, and future work

- **Consumers**: processor runtime (claim loop, backoff, idempotency keys), notifications,
  payment orchestration once payment persistence exists.
- **Operations**: outbox observability (pending backlog, dead-queue detection), retention/
  archival policy, dead-letter alerting.
- **Future events**: PAYMENT_* emission behind real payment persistence; SESSION_* events
  only when the TS domain defines them.
- **Reserved/deferred**: inbox/dedup tables when consumers exist; `event_version` bumps on
  additive payload changes.
- **Risks to carry**: at-least-once requires all future consumers to be idempotent;
  `last_error` carries raw worker error text (truncated, no PII expectation — keep logs
  sanitized); processed_at is an outbox boundary marker, not a side-effect receipt.
- **Ownership**: outbox design/emission owned here; worker/consumer phase is a distinct
  follow-on with its own QA contract.
