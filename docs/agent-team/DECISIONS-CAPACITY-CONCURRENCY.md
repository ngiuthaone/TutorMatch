# Founder Decisions — Capacity + Concurrency

**Status: CAPACITY POLICY — FROZEN FOR PERSISTENCE**

Source: Capacity + Concurrency domain architecture test
(run `20260813-193139-capacity-concurrency-domain-architec`), result **PASS**
(DESIGN-ONLY). Founder accepted all decisions on **2026-08-13**. This record
supersedes the `PRODUCT_DECISION_REQUIRED` / `REVERSIBLE_DESIGN_CHOICE` /
"unresolved" labels previously carried for these items in the domain module
headers and in §76.32 of the test report.

Supabase persistence must satisfy every item in "Handoff requirements" plus
clarifications C1 and C2 before the Supabase Persistence + RLS test begins.
SQL locking syntax is intentionally not chosen here.

## Decisions (D1–D10)

| # | Decision | Founder ruling | Classification now |
|---|----------|---------------|--------------------|
| D1 | Requested Booking capacity | **ACCEPT Model A** — a `requested` Booking holds hard Session capacity. Schema-neutral but NOT transaction-neutral: request creation must serialize against the authoritative Session capacity boundary. | EXISTING_TUTORIA_POLICY |
| D2 | minimumMet counting basis | **ACCEPT confirmed participant quantity only**; never coupled to Payment. | EXISTING_TUTORIA_POLICY |
| D3 | Capacity unit | **ACCEPT participant quantity** — one Booking with participantCount 3 consumes 3 units. Conceptually `participant_count INT NOT NULL DEFAULT 1 CHECK (participant_count >= 1)`. | EXISTING_TUTORIA_POLICY |
| D4 | 1:1 tutoring representation | **ACCEPT explicit `maxParticipants = 1`** for 1:1 Sessions; same general capacity architecture, no separate tutor capacity system. | EXISTING_TUTORIA_POLICY |
| D5 | Payment vs capacity | **ACCEPT** — Payment events never directly acquire/release capacity. Capacity changes only through authoritative Booking lifecycle transitions. Payment orchestration may later cause a Booking transition, but Payment itself does not mutate capacity. | EXISTING_TUTORIA_POLICY |
| D6 | Post-booking participant quantity changes | **DEFER** — unsupported for MVP. Persistence must not make future atomic quantity changes impossible. | DEFERRED / future feature |
| D7 | Minimum-participant automatic cancellation | **DEFER** — no automatic cancellation initially; host controls Session cancellation; `minimumMet` stays derived. | DEFERRED / future feature |
| D8 | Booking cutoff after Session start/end | **DEFER** — separate booking-eligibility policy; timing eligibility must not be confused with capacity. | DEFERRED / future feature |
| D9 | Duplicate learner Booking | **ACCEPT one Booking per learner per Session**; additional participants via `participant_count`. Future persistence enforces unique `(learner_id, session_id)`. | EXISTING_TUTORIA_POLICY |
| D10 | Reducing max below active commitments | **ACCEPT blocking** — ordinary host changes may not reduce `maxParticipants` below currently hard-reserved capacity. No grandfathering/admin override yet. | EXISTING_TUTORIA_POLICY |

Additional ruling (D1 consequence): **Do not invent request expiration yet.**
Record stale `requested` bookings / request expiration as a **FUTURE PRODUCT
REQUIREMENT**, because hard requested-seat holding can otherwise block
capacity indefinitely.

## Clarifications (founder, 2026-08-13)

These are clarifications of the frozen policy above, NOT new product decisions.

- **C1 — requested → confirmed is capacity-neutral.** Capacity is acquired
  once, at Booking request creation, and must never be acquired again during
  confirmation. Because `requested` and `confirmed` both hard-reserve, moving
  a Booking from `requested` to `confirmed` changes no capacity arithmetic; it
  only changes which statuses count toward `minimumMet`. Persistence must
  guarantee confirmation never double-acquires capacity.
- **C2 — reschedule validates capacity AND uniqueness atomically.** Accepted
  rescheduling must atomically validate BOTH target Session capacity and the
  unique `(learner_id, session_id)` invariant on the target before moving
  `booking.session_id`. If the target Session already holds a Booking for that
  learner (uniqueness violation), the operation must fail and leave the
  original Booking and the original Session reservation completely unchanged —
  no partial move, no stranded capacity, no duplicate pair.

## Capacity semantics (authoritative)

For a capacity-limited Session:

```text
hardReservedCapacity = SUM(participant_count for requested + confirmed active Bookings)
```

- Pre-session reservation purposes use `hardReservedCapacity`; it must never exceed `maxParticipants`.
- Rejection/cancellation releases that active reservation.
- Completed/no-show remain historical facts and do not retrospectively create bookable capacity.
- `minimumMet` = `SUM(participant_count WHERE status = 'confirmed') >= minParticipants` (confirmed only; never paid).

## Handoff requirements — Supabase Persistence + RLS test

1. **Authoritative capacity source.** Capacity is derived from Booking facts:
   `Session.maxParticipants` minus `hardReservedCapacity` (sum over active
   hard-reserving bookings). No stored `used`/`remaining` counters as competing
   truth; no CapacityReservation entity.
2. **Statuses that hard-reserve capacity.** `requested` and `confirmed`
   (active). Terminal `cancelled`/`rejected` release. `completed` and
   attendance/no-show evidence are historical — never counted in future
   reservable capacity, never freed retrospectively.
3. **Participant quantity semantics.** `participant_count` per Booking
   (default 1, `>= 1`). Quantity N consumes N capacity units and counts N
   toward `minimumMet` when confirmed. Capacity math must be integer-safe and
   must never clamp an invalid negative remainder to hide corruption.
4. **Uniqueness requirement.** Enforce `unique (learner_id, session_id)`
   (approved spec's `(tutor_id, learner_id, session_at)` normalized to Session
   identity). One Booking per learner per Session; groups express attendance
   via `participant_count`. Report the normalization in the persistence step.
5. **Request-time capacity acquisition.** Because `requested` hard-reserves,
   booking creation must acquire capacity against the authoritative Session
   boundary. Do NOT build a confirmed-only hard capacity invariant while
   describing requested capacity as a real hold.
6. **Confirmation idempotency.** Confirming must not double-acquire capacity;
   a repeat confirm is a no-op/error with no capacity change (state-machine
   guard + Booking version/CAS). Per clarification **C1**: capacity is acquired
   exactly once at request creation, so requested → confirmed is
   capacity-neutral.
7. **Cancellation/rejection release.** Terminal transitions release the
   hard-reserved quantity; derived capacity recomputes; no double-release under
   concurrent retries (CAS).
8. **Atomic reschedule old→target movement.** Reschedule acceptance atomically
   moves the booking's quantity from source Session to target Session within
   one authoritative boundary: verify request pending, booking still
   reschedulable, target Session bookable, target capacity sufficient; update
   `session_id`; record history; leave the request valid. Never strand the
   Booking or double-count capacity. Per clarification **C2**: the target
   Session's unique `(learner_id, session_id)` invariant is validated in the
   same atomic boundary as target capacity; a uniqueness failure aborts with no
   change to the original Booking or the original Session reservation.
9. **Session cancellation races.** Session cancellation vs confirmation /
   reschedule must serialize so no active Booking survives on a cancelled
   Session. Fan-out to affected requested/confirmed bookings happens in the
   same authoritative boundary (all-or-nothing).
10. **Max-capacity edit races.** `changeCapacity` may not reduce
    `maxParticipants` below `hardReservedCapacity`; concurrent capacity
    acquisition and max reduction serialize on the Session boundary (blocked
    reduction = losing race).
11. **Session-level serialization boundary.** All capacity-acquiring operations
    for the same Session serialize against the same authoritative Session
    boundary. Correctness property: committed capacity never exceeds
    `maxParticipants`; a losing acquisition/acceptance gets a deterministic
    capacity failure (`CAPACITY_EXCEEDED` / `UNAVAILABLE_SESSION`). SQL locking
    syntax is a later choice, not fixed here.
12. **Booking CAS/version requirements.** Booking-level version/CAS (or
    equivalent) protecting: confirm vs cancel, cancel vs reschedule-accept,
    duplicate commands, session cancellation vs confirm. Stale writes are
    rejected. Same applies to Session for max-capacity edits.
13. **Future requirements (not built now).** Request expiration / stale
    `requested` handling; post-booking participant quantity changes (atomic,
    Session-serialized, audit in booking history, financial adjustment
    separate); booking eligibility cutoff (separate predicate).

## Scope boundaries

- No code, no migrations, no Supabase/RLS were created for this acceptance.
- The two schema-shaping decisions (D3 `participant_count`, D9 unique
  `(learner_id, session_id)`) are now decided and must be reflected when the
  bookings/sessions tables are designed.
- Domain module headers updated to promote classifications; executable
  behavior unchanged.
