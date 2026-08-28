# 06 — Booking Engine Reconstruction

Reverse-engineered from `backend/src/domain/*`, `backend/src/services/
booking-service.ts`, `backend/src/routes/booking.ts`, and the SQL RPCs in
`backend/supabase/migrations/*`. Verified against running local Supabase.

## 1. Offerings — what can be booked

`offerings` table (20260819120000 + 20260820100000): `kind` ∈
{tutor, workshop, class, event}, `pricing_model` ∈ {hourly_v1,
flat_per_participant_v1}, `booking_mode` ∈ {approval, instant},
`unit_price_vnd`/`price_per_participant_vnd`/`hourly_rate_vnd`,
`publication_status`. All offering kinds flow through **one** booking engine.

## 2. Session — what creates a bookable session

`create_session` RPC requires an `offering_id` (NOT NULL after
20260819120000) and `can_manage_offering(uid, offering_id, 'host')`. Session
states (CHECK): `scheduled`, `cancelled`, `completed`. `min_participants`,
`max_participants`, `starts_at`/`ends_at`.

## 3. Booking — creation

`create_booking(session_id, participant_count[, p_idempotency_key])` (auth,
`assert_verified_booking_caller`):
1. rate-limit consume (`consume_booking_create_attempt`; burst 10/10min, 30/24h)
2. lock session row (canonical order)
3. reject host booking own session (`can_manage_offering`)
4. pricing dispatch by offering kind (`resolve_booking_pricing`)
5. insert booking (status `requested`)
6. capacity re-count via `session_hard_reserved` → overflow returns
   `INSUFFICIENT_CAPACITY` (transaction rollback)
7. write `booking_history` + emit `BOOKING_REQUESTED` outbox event in same txn
Idempotency: `idempotency_key` partial-unique + fast-path; unique violation →
`BOOKING_CONFLICT`. Abuse protection + email-verified gate at DB layer.

## 4. Capacity

`session_hard_reserved(sid)` counts non-cancelled bookings; enforced
**after** insert by recount and rollback (verified behavior of `create_booking`).
`max_participants` on session; workshop uses `flat_per_participant` so capacity
is summed participant quantity. Row locks + advisory locks serialize races.

## 5. Statuses (text + CHECK, not enum)

- Booking: `requested`, `confirmed`, `cancelled`, `rejected`, `completed`
  (`cancelled_by` ∈ attendee/host/system; version for CAS).
- Session: `scheduled`, `cancelled`, `completed`.
- Payment: `pending`, `succeeded`, `failed`, `refunded`.
- Refund: `obligation`, `pending`, `succeeded`, `failed`, `ambiguous`.

## 6. State machine (derived from code/tests)

```
requested ──host approve/instant──► awaiting payment (payment pending)
   │  (reject) ──► rejected
   │  (cancel / TTL) ──► cancelled (refund obligation if paid)
awaiting payment ──paid + finalize──► confirmed
confirmed ──complete/attendance──► completed (attendance_facts)
cancelled ──► (refund obligation)
```
Reschedule: `reschedule_requests` (requested→accepted/rejected/cancelled),
moving booking between `from_session`/`to_session`. Cancellation uses
optimistic CAS on `version` (0013) and writes refund obligations (0010).

## 7. Investigated lifecycle concerns

| Concern | Finding |
|---|---|
| Duplicate booking protection | partial-unique active-learner-session + idempotency key (VERIFIED) |
| Concurrency / races | row locks, CAS version, advisory locks, `FOR UPDATE SKIP LOCKED` (VERIFIED) |
| Capacity enforcement | post-insert recount + rollback (VERIFIED) |
| Cancellation | `cancel_booking` + obligations; workshop `cancel_workshop_booking` (VERIFIED) |
| Rescheduling | `reschedule_requests` RPCs + CAS (VERIFIED) |
| No-show / completion | `record_attendance`, `complete_booking`, `complete_booking`→`completed` (VERIFIED) |
| Review eligibility | **NOT FOUND** (no review model in engine) |
| Payment dependency | `finalize_paid_booking` + worker; approval skippable for instant (VERIFIED) |
| Refund dependency | obligations→execution→reconciliation (VERIFIED) |
| **Payment TTL (workshop)** | `expire_stale_workshop_bookings` RPC exists but is **NOT invoked by the financial worker** (BROKEN/GAP) |

## 8. Offering-type consistency

- **All offering kinds share one engine** (`offerings` + `sessions` +
  `bookings` + payments). Pricing differs by `pricing_model`.
- Inconsistency found: `create_booking` **function overload drift** in the live
  DB (2-arg vs 3-arg) due to stale migrations → PGRST203 ambiguity.

## 9. Bottom line

**IMPLEMENTED_TESTED (core); PARTIAL (workshop payment-TTL never dispatched;
local DB drift blocks integration re-verification).** The engine is real,
concurrency-aware, idempotent, and Supabase-backed — not a demo.
