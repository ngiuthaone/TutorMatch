# 07/03 — SHARED BOOKING ENGINE CONTRACT (BOOK)

**Surface:** the single authoritative booking engine shared by Workshop and Tutor. This is the transactional heart of Private Alpha.
**Alpha status:** ALPHA CORE — the shared engine must be preserved, wired to the frontend, and proven money-correct.
**Primary evidence:** `backend/src/services/booking-service.ts`, `discover/src/lib/{booking,event-booking,workshop-booking,tutor-booking}-api.ts`, RPC `create_booking`.

> **ARCH-002 preserved:** there is exactly ONE booking engine. Do not create a parallel booking model for events/classes. All marketplace booking funnels call the same engine.

---

## 03.1 Booking lifecycle (single source of truth)

```text
[requested/held] ──pay──> [confirmed/held] ──session start──> [completed]
        │  (payment pending, capacity held)
        ├─ TTL expiry (worker) ──> [cancelled, capacity released]   (pending-payment expiry)
        ├─ attendee cancel ──> [cancelled, capacity released]        (refund if paid)
        └─ host reject (approval mode) ──> [rejected, capacity released]

paid state lives in payments.status; booking.must not carry payment terminality.
```

`BOOK-001` — Booking status enum (DB): `requested | confirmed | cancelled | rejected | completed`. Paid-state is represented via `payments.status`; **do not** add `paid/reviewed` to BookingStatus unless the DB/domain supports it (`DEC-*`).

## 03.2 Booking command — `create_booking` (authoritative RPC)

`RPC-*` in `14_rpc.md`; contract surface here.

- `BOOK-010` Inputs (verified canonical form per `20260820100001` + `20260820130000`): `create_booking(session_id uuid, participant_count int DEFAULT 1, p_idempotency_key text DEFAULT null)`. The **offering is derived from `sessions.offering_id`, not passed**.
  - Pricing is resolved **server-side** from the session/offering config (`flat_per_participant_v1`), never passed from client.
- `BOOK-011` Atomic capacity guard: insert booking (participant_count), then a post-insert recount asserts `confirmed+held <= session.max_capacity`; on violation roll back → `capacity_exceeded`.
- `BOOK-012` Returns a **booking id** (+ price snapshot) so the client can proceed to payment. This is the pre-payment held/reserved state.
- `BOOK-013` Approval mode (booking_mode='approval') returns `requested`; host then confirms/rejects. Instant mode returns `confirmed` on payment success only — confirmation is payment-linked.
- `BOOK-014` Idempotency: a booking create is expected once per cart line; duplicate create is rejected or deduped per idempotency_key (`ITST-*`).

## 03.3 Payment-linked confirmation

- `BOOK-020` For **instant** mode, the booking resolves to `confirmed` only after payment success (idempotent handling of the payment→booking confirmation). Pending payment holds capacity (`[held]`), with a TTL.
- `BOOK-021` For **approval** mode, capacity is held on `requested`; host confirms → payment; or host rejects → released.

## 03.4 Capacity / CAS / concurrency

- `BOOK-030` Executable invariant: `confirmed+held participants <= max_capacity`, enforced atomically in the RPC (recount + rollback). Never trusted to client.
- `BOOK-031` Optimistic/CAS: booking row has a `version`; update paths (confirm/cancel/complete) use version-guarded updates; conflicts surface `conflict` errors.
- `BOOK-032` The whole create is one DB transaction; partial capacity is impossible to observe from the client.

## 03.5 Cancellation / rejection / completion

- `BOOK-040` Cancel paths: attendee, host, system(worker). Each allowed by domain policy (`DEC-*` for refund rules).
- `BOOK-041` Host reject in approval mode → `cancel`ing with `cancelled_by='host'` (or separate `rejected` status) and capacity released.
- `BOOK-042` Completion: after session end (worker or scheduled job) → snapshot/history written (`session_history`, `booking_history`), booking → `completed`, payout eligibility recorded for `FINW-*`.
- `BOOK-043` Pending-payment TTL: expired pending bookings must have capacity released. The worker sweep exists in DB+service but is **not dispatched** (`REAL-007`) — `BLK-002`. Requirement: dispatch it. (See `17_worker_async.md`.)

## 03.6 Frontend integration (server-authoritative UI)

- `BOOK-050` Client reads booking state from server responses; never asserts eligibility/capacity locally.
- `BOOK-051` Multi-step booking dialog states: `INITIAL → SELECT (session) → RESUME/PAY → CONFIRMED → RECEIPT`; interrupted at `PAY` resumes from server state (idempotent).
- `BOOK-052` Error mapping: `capacity_exceeded` → "Seats sold out"; `conflict` (stale) → refresh; `auth_required` → sign-in; `payment_expired` → re-initiate.
- `BOOK-053` All money-affecting UI derives from `api response`, not localStorage.

## 03.7 Bookings list + detail (Learner & Host)

- `LEARN-*`/`06_learner.md`: user's bookings list + detail. `BLK-001` — `/bookings/[id]` missing → must be created. (Owned in `06_learner.md`.)
- `HOST-*`/`05_host_center.md`: host's incoming bookings list with confirm/reject.

## 03.8 ACCEPTANCE CRITERIA

- `AC-BOOK-001` — Booking a free slot in an instant-mode workshop with capacity returns a `confirmed` booking only after payment.
- `AC-BOOK-002` — Over-capacity booking is rejected atomically; no partial hold leaks.
- `AC-BOOK-003` — Two concurrent bookings cannot both succeed when they'd exceed capacity (concurrency test `ITST-*`).
- `AC-BOOK-004` — Expired pending-payment booking releases capacity via the worker sweep (`REAL-007` fix).
- `AC-BOOK-005` — Client capacity never authoritatively decided.

---

## 07/03 RTM

| Req ID | Req | Impl file(s) | API/RPC/DB | Test | Acceptance | Evidence |
|---|---|---|---|---|---|---|
| BOOK-001 | Status enum (no paid in BookingStatus) | domain | `bookings.status` CHECK | `TST-book-status` | `AC-BOOK-001` | DOM-010 |
| BOOK-010 | create_booking canonical 3-arg | `booking-service.ts` | `create_booking` | `TST-rpc-create` | `AC-BOOK-001` | RPC clean |
| BOOK-011/011 | Atomic capacity guard | RPC | CHECK + recount | `ITST-capacity` | `AC-BOOK-002` | DOM-013 |
| BOOK-020 | Payment-linked confirm | engine+pay | payment webhook | `ITST-pay-confirm` | `AC-BOOK-001` | §16 |
| BOOK-031 | Version/CAS | service | version col | `ITST-cas` | `AC-BOOK-003` | §13 |
| BOOK-043 | Dispatch TTL sweep | worker | worker | `ITST-sweep` | `AC-BOOK-004` | REAL-007/BLK-002 |
| BOOK-050 | Server-authoritative UI | booking libs | — | `E2E-book` | `AC-BOOK-005` | ARCH-004 |
