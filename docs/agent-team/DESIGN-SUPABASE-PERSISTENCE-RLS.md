# Design — Supabase Persistence + RLS for Sessions & Bookings

**Status: IMPLEMENTED — migrations `0004` + `0005` written; integration tests
`test-integration/sessions-bookings-rls.test.ts` +
`test-integration/booking-concurrency.test.ts` written. Integration run not
yet possible on this machine (no local Supabase stack/docker); see
"Verification status" below.**

Scope: persist the `Session` and `Booking` aggregates and enforce the frozen
Capacity + Concurrency policy
(`docs/agent-team/DECISIONS-CAPACITY-CONCURRENCY.md`, decisions D1–D10,
clarifications C1–C2, handoff requirements 1–13) in Supabase/Postgres, using
the existing production backend patterns. Migrations are the architecture
test deliverable; RPC signatures and test mapping below reflect the
implemented code.

## 1. Existing state (inspected, verified in repo)

- Backend auth: bearer JWT only. `backend/src/plugins/authenticate.ts` validates
  via `authService.validateAccessToken` → `request.auth = { userId, email,
  accessToken }`. Client setup is per-call `createClient(url, publishableKey)`
  with the caller's JWT in the header (`backend/src/lib/supabase.ts:20-25`).
  No service-role key anywhere. `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY`
  only (`backend/src/config/env.ts:19-20`).
- Migrations (`backend/supabase/migrations/`):
  - `0001_create_profiles.sql` — `profiles` keyed to `auth.users(id)`, enum
    `user_role`, RLS `profiles_select_own`, revoke all + grant select to
    `authenticated`.
  - `0002_create_tutor_cvs.sql` — the **authoritative security-definer RPC
    pattern** for complex aggregates: tables RLS-enabled and fully revoked,
    all access through `security definer set search_path=''` functions
    (`assert_tutor_caller()`, `save_my_tutor_cv`, `publish_my_tutor_cv`,
    `list_published_tutors`), optimistic **version/CAS** with
    `expected_version` and `PROFILE_VERSION_CONFLICT` (`errcode='40001'`),
    `select ... for update` row locks, grants only on functions. `version`
    column on `tutor_profiles` (bigint not null default 1).
  - `0003_create_marketplace_listings.sql` — simpler direct-table RLS
    (select published-or-own; insert/update own) with payload jsonb.
- No `sessions`, `bookings`, `payments`, `reviews`, or content tables exist in
  production migrations. `backend/schema.sql` is a legacy prototype schema
  (no RLS, not applied anywhere, referenced only by a run-record note).
- `docs/items-5-6-content-marketplace-plan.md:132-137` sketches a `bookings`
  table with `unique (tutor_id, learner_id, session_at)` — **plan only, not
  implemented**. D9 normalizes this to `unique (learner_id, session_id)`.
- Domain modules (pure, tested): `backend/src/domain/booking-lifecycle.ts`
  (statuses `requested|confirmed|cancelled|rejected|completed`; `holdsSeat` =
  requested/confirmed; attendance as immutable facts; cancellation Model A;
  reschedule Model C proposal entity) and `backend/src/domain/session-lifecycle.ts`
  (`scheduled|cancelled|completed`; `changeCapacity` blocks reduction below
  occupancy; `cancelSessionWithBookings` fan-out).
- Tests: unit vitest in `backend/test/`; **local-only** integration harness in
  `backend/test-integration/` (`vitest.integration.config.ts`) requiring
  `SUPABASE_TEST_URL/SUPABASE_TEST_PUBLISHABLE_KEY/SUPABASE_TEST_DB_URL`,
  refusing non-local targets, applying migrations via `sql.unsafe(migration)`
  (`tutor-cv-rls.test.ts`). No `supabase/config.toml`; no CI migration step.

## 2. Architectural decisions

1. **RPC-only access model (0002 pattern), not direct-table RLS.**
   The capacity invariant `committed <= max` cannot be expressed as a CHECK or
   a row policy — it requires a transaction that locks the Session row and
   derives capacity from sibling Booking rows. Direct table grants would let a
   client insert/confirm bookings without the boundary. Therefore `sessions`,
   `bookings`, `booking_history`, `reschedule_requests`, `attendance_facts`,
   and `session_history` are RLS-enabled with all privileges revoked; all
   mutations and all reads go through `security definer set search_path=''`
   RPCs. This matches `0002_create_tutor_cvs.sql` and the "backend
   authorization is authoritative" rule.
2. **Capacity is derived, never stored.** No `used`/`remaining`/`spotsLeft`
   columns, no reservation entity. `hardReservedCapacity` is computed on
   demand inside every RPC that needs it (handoff 1). Storing a counter would
   create a second source of truth that must be locked and can drift.
3. **Session row is the serialization boundary.** Every capacity-acquiring or
   Session-status-mutating operation locks the Session row `for update`
   inside one transaction (handoff 11). All booking transitions first lock the
   Session row, then the Booking row. **Deterministic lock ordering:** when an
   operation touches more than one Session row (accepted reschedule:
   `oldSession` + `targetSession`), both rows are locked in a single canonical
   order — ascending `id` — inside the same transaction BEFORE any Booking or
   Request row is locked. Two concurrent opposite-direction reschedules
   (A→B and B→A) therefore both acquire the same session locks in the same
   order (the shared lower-id session first) and cannot deadlock or interleave
   on inconsistent ordering. Exact SQL mechanism (single `for update` on both,
   or per-row) is an implementation choice, but the invariant is fixed: all
   Session-row locks for one operation are taken in canonical ascending-id
   order within that transaction, and Session locks always precede
   Booking/Request locks.
4. **Version/CAS on mutable rows** (handoff 12): `sessions.version`,
   `bookings.version`, `reschedule_requests.version`. Callers pass
   `expected_version`; mismatch raises `errcode='40001'` (existing
   `PROFILE_VERSION_CONFLICT` convention). This makes confirm/reject/cancel/
   reschedule-accept idempotency failures deterministic and prevents stale
   writes and double-release.
5. **Errors as sanitized, stable RPC codes** (founder-approved, conditional).
   RPCs raise constant, message-prefixed exceptions drawn ONLY from a fixed
   sanitized vocabulary — `INSUFFICIENT_CAPACITY`, `BOOKING_CONFLICT`,
   `STALE_VERSION`, `UNAVAILABLE_SESSION`, `SESSION_IN_FUTURE`,
   `INVALID_TRANSITION`, `FORBIDDEN_ACTOR`, `REQUEST_NOT_PENDING`,
   `STALE_REQUEST`, `DUPLICATE_ATTENDANCE`. Error messages never embed
   dynamic PII, internal SQL, table details, tokens, IDs, or other sensitive
   values. Version/CAS mismatches keep the existing repository convention:
   `raise exception 'STALE_VERSION' using errcode='40001'`. The backend maps
   the sanitized code → domain code (`CAPACITY_EXCEEDED` →
   `INSUFFICIENT_CAPACITY`, `DUPLICATE_BOOKING` → `BOOKING_CONFLICT`, etc.).
6. **Privacy:** public read RPCs never return `host_id`/`learner_id` (these
   equal `profiles.id` = auth uid). Host identity is exposed via published
   `tutor_profiles` data (tutor_profile_id / display name) only. Owner RPCs
   return ids to the owning user.
7. **SECURITY DEFINER hardening (mandatory for every function):** every
   function in this design is `security definer` and must, without exception:
   (a) declare `set search_path=''` and reference all objects schema-qualified
   (`public.sessions`, `public.bookings`, ...) so no search-path hijack is
   possible; (b) derive actor identity ONLY from trusted auth context
   (`auth.uid()` inside the function / the caller JWT validated by the
   backend), never from a caller-supplied `learner_id`/`host_id` argument;
   (c) perform explicit authorization checks (`assert_host_of_session`,
   attendee-vs-host checks) before any mutation; (d) never expose direct
   table mutation grants — tables are RLS-enabled AND fully revoked, so the
   only write paths are the functions; (e) grant function EXECUTE only to the
   intended roles (`anon`/`authenticated` as specified in §5), with the
   internal helper functions (`assert_*`, capacity computation) revoke-all and
   not granted to any role. RLS stays enabled on every table as defense in
   depth (even though all direct access is revoked).

## 3. Schema design

All tables `public` schema, RLS enabled, `revoke all` from
`public, anon, authenticated`, updated_at maintained by a
`set_*_updated_at` trigger (0001 pattern).

### sessions
```sql
id                  uuid pk default gen_random_uuid()
offering_id         uuid            -- nullable: a Session may belong to no offering yet (1:1 materialization path open; FK to future offerings table, none exists)
host_id             uuid not null references public.profiles(id)
status              text not null default 'scheduled'
                      check (status in ('scheduled','cancelled','completed'))
starts_at           timestamptz not null
ends_at             timestamptz not null
min_participants    int check (min_participants >= 0)
max_participants    int check (max_participants > 0)
version             bigint not null default 1 check (version > 0)
created_at          timestamptz not null default now()
updated_at          timestamptz not null default now()
  check (ends_at > starts_at)
  check (min_participants is null or max_participants is null or min_participants <= max_participants)
```
- 1:1 appointments use `max_participants = 1` (D4), same general architecture.
- No capacity columns (decision 2). D10 enforced in RPCs, not a CHECK.

**Session-creation authority (PRODUCT_DECISION_REQUIRED — see §7 finding):**
the schema enforces the invariant *Booking → Session* (every `bookings.session_id`
NOT NULL references an existing `sessions` row), but it does NOT enforce the
stronger rule *every Session must have been manually created by the host in
advance*. `offering_id` is nullable and nothing here requires a host to
pre-create occurrences; a future product decision that 1:1 requests
materialize a Session from tutor availability (or an instant-booking flow)
remains implementable within the same schema and RPC pattern. The design does
not close that path; only the current RPC surface (host-facing `create_session`)
and the absence of an availability→Session materializer reflect that the
materialization decision is not yet made.

### bookings
```sql
id                        uuid pk default gen_random_uuid()
session_id                uuid not null references public.sessions(id)
learner_id                uuid not null references public.profiles(id)
participant_count         int not null default 1 check (participant_count >= 1)   -- D3
status                    text not null default 'requested'
                            check (status in ('requested','confirmed','cancelled','rejected','completed'))
rescheduled_from_session_id uuid references public.sessions(id)                   -- rescheduledFromSession
cancelled_reason          text
cancelled_by              text check (cancelled_by in ('attendee','host'))
cancelled_by_session_id   uuid references public.sessions(id)                     -- session-derived cancellation
version                   bigint not null default 1 check (version > 0)
created_at                timestamptz not null default now()
updated_at                timestamptz not null default now()
-- D9: one Booking per learner per Session.
-- PENDING FOUNDER RULING (A vs B, §7): historical uniqueness (unconditional
-- unique) vs active uniqueness (at most one requested/confirmed at a time;
-- terminal rows coexist with a later Booking). RECOMMENDED enforcement (B):
create unique index bookings_active_learner_session_unique on public.bookings(learner_id, session_id) where status in ('requested','confirmed');
-- NOT FINAL until the §7 ruling; an unconditional alternative:
-- alter table public.bookings add constraint bookings_learner_session_unique unique (learner_id, session_id);
```
- `tutor_id` is NOT stored: derived via `sessions.host_id`. `sessionDate` is
  NOT stored: authoritative schedule is `sessions.starts_at` (domain
  compatibility rule). Report both normalizations at migration time.
- Indexes: `(session_id, status)` for capacity sums; `(learner_id)` for "my
  bookings".

### booking_history
```sql
id              bigint generated always as identity pk
booking_id      uuid not null references public.bookings(id) on delete cascade
from_status     text not null
to_status       text not null
actor           text not null check (actor in ('attendee','host'))
at              timestamptz not null
reason          text
session_change_from uuid  -- accepted reschedule
session_change_to   uuid  -- accepted reschedule
cancelled_by_session_id uuid
created_at      timestamptz not null default now()
index (booking_id, at)
```

### reschedule_requests (Model C)
```sql
id              uuid pk default gen_random_uuid()
booking_id      uuid not null references public.bookings(id) on delete cascade
from_session_id uuid not null references public.sessions(id)
to_session_id   uuid not null references public.sessions(id)
requested_by    text not null check (requested_by in ('attendee','host'))
status          text not null default 'requested'
                  check (status in ('requested','accepted','rejected','cancelled'))
reason          text
created_at      timestamptz not null default now()
resolved_at     timestamptz
version         bigint not null default 1 check (version > 0)
check (from_session_id <> to_session_id)
-- at most one pending request per booking (domain: caller/persistence enforces):
create unique index reschedule_pending_unique on public.reschedule_requests(booking_id) where status = 'requested';
```

### attendance_facts (immutable, append-only)
```sql
id              bigint generated always as identity pk
booking_id      uuid not null references public.bookings(id)
outcome         text not null check (outcome in ('attended','learner_no_show','host_no_show'))
reported_by     text not null check (reported_by in ('attendee','host'))
at              timestamptz not null
session_id      uuid not null
prior_status    text not null
source          text
created_at      timestamptz not null default now()
unique (booking_id, outcome, reported_by)   -- matches domain DUPLICATE_ATTENDANCE guard
```

### session_history
```sql
id              bigint generated always as identity pk
session_id      uuid not null references public.sessions(id) on delete cascade
change_type     text not null check (change_type in ('created','rescheduled','cancelled','completed','capacity_changed'))
by              text not null check (by in ('host','system'))
at              timestamptz not null
from_start      timestamptz  -- rescheduled
from_end        timestamptz  -- rescheduled
to_start        timestamptz  -- rescheduled
to_end          timestamptz  -- rescheduled
cause           text check (cause in ('host','minimum_not_met'))  -- cancelled
capacity_from   int          -- capacity_changed
capacity_to     int          -- capacity_changed
reason          text
created_at      timestamptz not null default now()
index (session_id, at)
```

## 4. RPC design

Helpers (security definer, `set search_path=''`, revoke from all):
- `assert_attendee_caller() returns uuid` — `auth.uid()` not null and profile
  exists; returns uid. Any authenticated user may be an attendee.
- `assert_host_of_session(session_id uuid) returns uuid` — returns uid after
  verifying `sessions.host_id = uid` (and status checks as needed).

All functions below are `security definer set search_path=''`, `revoke all`,
and only granted as listed. Every mutation function is a single transaction
(function = implicit transaction in PL/pgSQL).

### Session RPCs (actor: host unless noted)
| Function | Locks | Checks | Effect | Handoffs |
|---|---|---|---|---|
| `create_session(payload jsonb)` | — (insert) | caller host role; ends_at > starts_at; min/max valid | insert session v1 + `session_history('created')` | D4 |
| `reschedule_session(session_id, starts_at, ends_at, expected_version)` | session row | host; version; status scheduled; new schedule valid & changed | in-place schedule move + history + SESSION_RESCHEDULED semantics | 12 |
| `change_session_capacity(session_id, max, expected_version)` | session row | host; version; scheduled; `max > 0` | compute `hardReservedCapacity`; **block max < reserved (D10)**; update + history | 10, 12 |
| `cancel_session(session_id, expected_version, cause, reason)` | session row then each affected booking row | host (system/minimum_not_met path DEFERRED); version; scheduled | session → cancelled; fan-out: every requested/confirmed booking → cancelled with `cancelled_by_session_id` + history, version bump, all-or-nothing (handoff 9) | 9, 12 |
| `complete_session(session_id, expected_version)` | session row | host; version; scheduled; now >= ends_at | status → completed; bookings untouched (domain rule) | — |
| `list_sessions()` / `get_session(session_id)` | — | public (anon+authenticated) | scheduled sessions + derived `hardReservedCapacity`/`spotsLeft`; no auth-id leakage; host via published tutor_profiles only | 1, privacy |
| `get_my_sessions()` | — | host | own sessions incl. derived capacity | 1 |

### Booking RPCs
| Function | Locks | Checks | Effect | Handoffs |
|---|---|---|---|---|
| `create_booking(session_id, participant_count, ...)` | session row | caller = attendee; session scheduled; no existing `(learner_id, session_id)` (DUPLICATE_BOOKING; unique index backs it); `hardReserved + count <= max` else CAPACITY_EXCEEDED | insert booking v1 requested + history; **capacity acquired exactly once here (C1, handoff 5)** | 3, 4, 5, 11 |
| `confirm_booking(booking_id, expected_version)` | session row, then booking row | host of session; version; session still scheduled; status requested | requested → confirmed; **capacity-neutral (C1)**; no capacity re-acquire | 6, 9, 12 |
| `reject_booking(booking_id, expected_version)` | session row, then booking row | host; version; status requested | requested → rejected (releases capacity) | 7, 12 |
| `cancel_booking(booking_id, expected_version, cause='attendee', reason)` | session row, then booking row | caller = learner (withdraw requested / cancel confirmed) or host (cancel confirmed); version | release capacity; `cancelled_by` set. Host cancelling a `requested` booking directly is rejected (decline = reject; session-derived = cancel_session) | 7, 12 |
| `complete_booking(booking_id, expected_version)` | session row, then booking row | caller = learner; version; session scheduled/completed; now >= session.ends_at | confirmed → completed; appends `attended` attendance fact; release capacity | 7, 12 |
| `record_attendance(booking_id, outcome, expected_version, source)` | session row, then booking row | caller rules per domain (no self no-show); not on requested/cancelled/rejected; now >= ends_at; unique fact | append immutable attendance fact; version bump | — |
| `get_my_bookings()` / `get_booking(booking_id)` | — | caller is learner or host | own bookings + derived capacity + session info; no other users' data | 1, privacy |

### Reschedule RPCs (Model C)
| Function | Locks | Checks | Effect | Handoffs |
|---|---|---|---|---|
| `create_reschedule_request(booking_id, target_session_id, expected_version, reason)` | booking row | caller = attendee or host; booking requested/confirmed; to <> from; target scheduled; at most one pending (partial unique index) | insert request v1 requested; **no capacity/uniqueness check here** (validated at accept, §6 scenario 5) | — |
| `accept_reschedule_request(request_id)` | **target session row + source session row in canonical ascending-id order, then booking row, then request row** | caller = counterpart of requester; request pending; source booking requested/confirmed and matches from_session; **target capacity sufficient (handoff 8) AND target unique `(learner_id, session_id)` free (C2)** | in-place move: booking.session_id = target, rescheduled_from_session_id = source, history `session_change`; request → accepted. **Any check failure aborts the whole transaction → original Booking + source reservation unchanged (C2)**; old reservation release + target acquisition + session_id mutation are one atomic transaction | 8, 11, 12, C2 |
| `reject_reschedule_request(request_id)` | request row | counterpart; pending | request → rejected | — |
| `cancel_reschedule_request(request_id)` | request row | requester; pending | request → cancelled | — |

Deterministic lock order (all functions, implemented): Session rows in
ascending `id` order first (canonical order for multi-Session operations such
as accepted reschedule), then Booking rows, then Request rows.
`accept_reschedule_request` reads the Request row up front (each transaction
touches a unique Request row, so there is no cross-transaction contention on
it) and then locks both Session rows in ascending order before the Booking
row. This makes opposite-direction concurrent reschedules (A→B and B→A)
acquire the same session locks in the same order, so they never interleave on
inconsistent ordering. `cancel_session` holds the session lock while fanning
out, so a concurrent `confirm_booking` that first locks the same session row
cannot interleave a confirmation that outlives the cancellation (handoff 9).
Every other booking mutation also locks the Session row before its Booking
row, giving the whole surface one consistent ordering.

## 5. Grants

```sql
-- after revoke-all on every table and function:
grant execute on function public.list_sessions(jsonb), public.get_session(uuid) to anon, authenticated;
grant execute on function public.assert_attendee_caller(), public.assert_host_of_session(uuid),
  public.create_session(jsonb), public.reschedule_session(uuid,timestamptz,timestamptz,bigint),
  public.change_session_capacity(uuid,int,bigint), public.cancel_session(uuid,bigint,text,text),
  public.complete_session(uuid,bigint), public.get_my_sessions(),
  public.create_booking(uuid,int,...), public.confirm_booking(uuid,bigint), public.reject_booking(uuid,bigint),
  public.cancel_booking(uuid,bigint,text), public.complete_booking(uuid,bigint),
  public.record_attendance(uuid,text,bigint,text), public.get_my_bookings(), public.get_booking(uuid),
  public.create_reschedule_request(uuid,uuid,text), public.accept_reschedule_request(uuid,bigint),
  public.reject_reschedule_request(uuid,bigint), public.cancel_reschedule_request(uuid,bigint)
  to authenticated;
-- no table grants to anon/authenticated anywhere in this design.
```

## 6. Architecture-test concurrency scenarios (to implement as integration tests)

Harness: `backend/test-integration/` style, local Supabase only, migrations
applied via `sql.unsafe`, real signups for host + learner, parallel `Promise.all`
RPC calls (the repo already depends on `postgres` for direct SQL).

1. **Last-seat race:** session max=1; two learners create concurrently →
   exactly one succeeds, other fails CAPACITY_EXCEEDED (or UNAVAILABLE_SESSION).
2. **Capacity-neutral confirm:** create (1 seat taken) → confirm → hardReserved
   stays 1; a second create still fails.
3. **Confirm vs session-cancel race:** host confirms while host cancels session
   concurrently → no confirmed booking survives on the cancelled session.
4. **Create vs capacity-reduction race:** booking and `change_session_capacity`
   to a smaller max run concurrently → committed state never exceeds max (one
   of the two deterministically loses).
5. **Reschedule atomicity + uniqueness:** target full → accept fails, booking
   unchanged on source; target has the learner already → accept fails, booking
   + source reservation unchanged (C2); otherwise move succeeds and source
   seat is free while target is consumed.
6. **Release reuse:** reject then create → freed seat is bookable; cancel
   confirmed then create → freed seat is bookable.
7. **CAS:** all mutating RPCs reject a stale `expected_version` with errcode
   40001 and no side effect.
8. **RLS:** anon/authenticated direct `select/insert/update` on `bookings`,
   `sessions`, `reschedule_requests`, `attendance_facts`, `booking_history`,
   `session_history` all denied; a second user cannot read another user's
   booking via `get_my_bookings`/`get_booking`.
9. **Uniqueness:** second `create_booking` for same learner+session fails
   DUPLICATE_BOOKING.
10. **Privacy:** `list_sessions`/`get_session` payload contains no
    `host_id`/`learner_id`/email/phone and no auth uid.

## 7. Handoff compliance matrix

| Handoff | Mechanism |
|---|---|
| 1 authoritative derived capacity | decision 2; computed in every RPC; no stored counters |
| 2 requested/confirmed hard-reserve; terminal release; completed/no-show historical | status set + capacity derivation only counts requested/confirmed; attendance_facts separate |
| 3 participant quantity, integer-safe | bookings.participant_count (default 1, >= 1); never clamps negative remainder — rejects |
| 4 unique (learner_id, session_id) | unique index + DUPLICATE_BOOKING pre-check; normalization documented |
| 5 request-time acquisition | create_booking under session lock |
| 6 confirmation idempotency | confirm under CAS; capacity-neutral (C1) |
| 7 cancellation/rejection release | terminal transitions under CAS; no double-release |
| 8 atomic reschedule old→target | accept_reschedule_request single transaction (C2) |
| 9 session cancellation races | cancel_session fan-out under session lock, all-or-nothing |
| 10 max-capacity edit races | change_session_capacity under session lock, blocks below reserved |
| 11 session serialization boundary | session-row `for update`, consistent lock order, deterministic failure codes |
| 12 Booking CAS/version | version columns + expected_version (errcode 40001) |
| 13 future requirements | deferred; schema has no counter/reservation entity to migrate; status checks are text-CHECK, extendable |
| C1 confirm capacity-neutral | confirm_booking performs no capacity arithmetic |
| C2 reschedule uniqueness atomic | accept_reschedule_request validates capacity + uniqueness in one tx; rollback leaves originals unchanged |

## 8. Out of scope / future

- Payments, reviews, notifications, offerings/content tables, booking
  eligibility cutoff (D8), post-booking quantity changes (D6), auto
  minimum-not-met cancellation (D7), request expiration (D1 consequence).
- No `supabase/config.toml`, CI migration step, or seed data — out of scope
  for this architecture test.

## 9. Persistence-detail resolutions (founder review, 2026-08-13)

1. **RPC domain errors — APPROVED WITH CONDITION.** RPCs surface only the
   sanitized, constant codes above (`INSUFFICIENT_CAPACITY`,
   `BOOKING_CONFLICT`, `STALE_VERSION`, ...); never dynamic PII, SQL internals,
   table details, tokens, IDs, or sensitive values. 40001/CAS preserved.
2. **Session-creation authority — PRODUCT_DECISION_REQUIRED (not settled by
   evidence).** Verified: the approved spec (`items-5-6:132-137`) has NO
   session table — bookings embed `session_at`/`duration_min`; the Session
   aggregate is a Tutoria-native REVERSIBLE_DESIGN_CHOICE
   (`session-lifecycle.ts:4-11,17-22`); no production path materializes
   Sessions from `tutor_availability_slots` (availability is CV-publish data
   only, `0002:24`); instant/same-day booking is prototype-only
   (`tutor-onboarding.tsx:553`); no `/bookings` route exists. The invariant
   *Booking → Session* is the designed boundary, but *Session must always have
   been manually pre-created by the host* is NOT established. **Design keeps
   both paths open**: `sessions.offering_id` nullable, booking transaction
   runs under the Session boundary, and nothing requires host pre-creation.
   A future request-time materialization of a Session from tutor availability
   remains implementable without schema change.
3. **Uniqueness — historical (A) vs active (B) — PRODUCT_DECISION_REQUIRED.**
   All existing designs use an unconditional `unique(learner_id, session_id)`
   (plan `items-5-6:137`, D9, handoff #4), but no authoritative text states
   whether terminal rows block a later Booking. The stateless domain layer is
   permissive (`booking-lifecycle.test.ts:352-361` allows a new same-session
   booking after rejection). **Recommendation: active uniqueness (B)** via a
   partial unique index `where status in ('requested','confirmed')` —
   terminal history (cancelled/rejected/completed) coexists with a later
   Booking and a reschedule into a target already holding a terminal Booking
   for that learner is allowed. No silent choice: awaiting founder ruling.
4. **Two-Session reschedule locking — REQUIRED.** Lock both Session rows in
   canonical ascending-id order before any Booking/Request row; opposite-
   direction concurrent reschedules use the same order and cannot deadlock.
   Transaction guarantees (atomic): target bookable, target capacity
   sufficient, uniqueness valid, original Booking untouched on failure,
   old-release + target-acquire + session_id mutation atomic.
5. **SECURITY DEFINER hardening — CONFIRMED.** Every function: `set
   search_path=''` + schema-qualified refs; actor from `auth.uid()` only;
   explicit authorization; no caller-supplied identity as authority; no direct
   table mutation grants; EXECUTE granted to intended roles only; RLS enabled
   as defense in depth (decision 7).
6. **Migration split — APPROVED.** `0004` schema/constraints; `0005` RPCs +
   grants.

## 10. Open items (awaiting founder rulings)

1. ~~Uniqueness A vs B~~ — **RESOLVED: founder ruled B (active uniqueness)**;
   partial unique index `bookings_active_learner_session_unique` implemented
   in 0004 (`where status in ('requested','confirmed')`).
2. Session-creation authority/timing (§9.2) — **PRODUCT_DECISION_REQUIRED**;
   affects future flows, not the 0004/0005 schema (both paths stay open).
3. Migration naming/placement: `0004_create_sessions_and_bookings.sql` (schema)
   + `0005_create_booking_session_rpcs.sql` (functions + grants) — approved.

## 11. Verification status (architecture test)

Implemented: `backend/supabase/migrations/0004_*.sql`, `0005_*.sql`;
`backend/test-integration/sessions-bookings-rls.test.ts` (RLS, authorization,
CAS, uniqueness, privacy, seat reuse, completion, attendance);
`backend/test-integration/booking-concurrency.test.ts` (design §6 scenarios
1–5 plus duplicate-pending-reschedule). Both test files use the established
local-only harness (hostname guard, real signups, `sql.unsafe` migrations).

- `pglast` (libpg_query grammar) parse of all five migrations: **PASS**.
- `pnpm typecheck`: **PASS**. `pnpm test` (182 unit tests): **PASS**.
- `pnpm build`: **PASS**.
- Local integration run: **PASS** — verified 2026-08-13 on a disposable
  local stack (Homebrew `colima` + `docker` + `supabase` CLI 2.114.0,
  `supabase start` in `backend/`, branch `codex/restore-tutoria-experience`).
  Migrations 0001–0005 applied cleanly from zero twice (`supabase start`,
  then true `supabase db reset`). `SUPABASE_TEST_URL` / publishable key /
  `SUPABASE_TEST_DB_URL` pointed at 127.0.0.1 loopback only; the hostname
  guard rejected any non-local target; no service-role key used.
  `pnpm test:integration` → **4 files / 33 tests PASS** (RLS + authorization,
  CAS, uniqueness, privacy, seat reuse, completion, attendance; and all
  concurrency scenarios including reschedule atomicity and
  duplicate-pending-reschedule). Cross-checked the authoritative rows after
  a clean `supabase db reset` + full suite: 0 over-capacity, 0 duplicate
  active bookings, 0 active booking on a non-scheduled session, 0 accepted
  reschedule not moved, 0 pending reschedule on a moved booking, and
  `bookings.version` equals status-transition history + accepted reschedules
  for every booking (reschedule *request creation* is provisional per §6 and
  intentionally does not bump the booking CAS version). Two harness/test bugs
  were found and fixed during this verification: (1) vitest ran the four
  integration files in parallel so their `beforeAll` migration re-application
  collided (`tuple concurrently updated`) — `test:integration` now runs with
  `--no-file-parallelism`; (2) `profiles-rls.test.ts` "blocks anonymous
  reads" expected `[]` but the committed 0001 fully revokes anon on
  `profiles`, so PostgREST returns `data: null` + error (blocked) — assertion
  corrected, and `sessions-bookings-rls.test.ts` now confirms a booking
  before completing it (design: `confirmed → completed`).
