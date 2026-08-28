# 26 — DEPENDENCY GRAPH (ARCH / DEP)

**Purpose:** ordering constraints so implementation never depends on unbuilt/unapplied prerequisites. Respects the migration gate in `27` and the architecture boundary (`ARCH-*`).

---

## 26.1 Migration-first dependency

```text
PH-0 migration reconciliation (GAP-001..004) ──► everything below
   (local head replayable + repo≈prod + canonical create_booking)
```

- `DEP-001` — No booking/payment work is verified against a clean DB until migrations reconcile; current integration suite is `UNVERIFIED` (`REAL-011`).

## 26.2 Surface dependency ordering

```text
AUTH + RLS (00/15) ──► BOOKING engine (03/14) ──► PAYMENT (04/16) ──► LEARN detail (06)
                                                       │
                          WORKSHOP detail/create (01) ──┘ (uses engine)
                          HOST center (05) ──► uses bookings + earnings(pay)
                          TUTOR (07) ──► uses engine (hourly)
                          DISCOVER (02) ──► pulls listings RPCs
                          WORKER expiry (17) ──► booking TTL
```

- `DEP-010` — `LEARN-002` (booking detail) depends on engine + payment returning a booking id.
- `DEP-011` — Host earnings (`HOST-005`) depends on payment/payout domain.
- `DEP-012` — Reviews (`REV`) depend on session completion (Post-Alpha).
- `DEP-013` — Events/classes/courses reuse the engine once promoted — no parallel booking.

## 26.3 Data flow

- `DEP-020` — Discovery reads public RPCs (no auth). Book/pay writes via auth'd backend→RPC. Worker reconciles/idempotently transforms. Client displays server truth.

## 26.4 ACCEPTANCE

- `AC-DEP-001` — No Alpha item is built before its migration prerequisite.
- `AC-DEP-002` — No parallel booking model introduced for events/classes.

---

## 26 RTM

| Req ID | Req | Link | Test | Acceptance |
|---|---|---|---|---|
| DEP-001 | migration-first | GAP-001..004 | `ITST-mig` | `AC-DEP-001` |
| DEP-013 | no parallel engine | ARCH-002 | code review | `AC-DEP-002` |
