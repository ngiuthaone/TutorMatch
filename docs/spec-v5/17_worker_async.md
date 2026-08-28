# 17 — WORKER / ASYNC CONTRACT (WORKER)

**Surface:** durable background processing: financial worker sweeps, outbox consumers, expiry, notifications, reconciliation.
**Alpha status:** Alpha core (worker-backed expiry for money correctness; reconciliation runbook).
**Primary evidence:** `backend/src/workers/financial-worker-runtime.ts` (`runFinancialWorkerIteration` → only 3 sweeps, expiry NOT dispatched), `event_outbox`.

---

## 17.1 Worker model

- `WORKER-001` — Financial worker iterates discrete sweeps idempotently; each sweep is independent and re-entrant. Multiple worker instances safe via DB-guarded claims.
- `WORKER-002` — **Must dispatch `sweepExpiredWorkshopBookings`** (currently missing — `REAL-007`/`BLK-002`) so pending-payment lodgement TTL releases capacity and never leaks.
- `WORKER-003` — Outbox consumer reads `event_outbox`, dispatches durable domain events (booking created, payment succeeded, booking cancelled, session completed, payout eligible, refund obligation) with retries/backoff + dead-letter.
- `WORKER-004` — Retry/backoff: fixed/exp backoff, `attempts`/`next_attempt_at`, exponential cap; park after N with alert.
- `WORKER-005` — Exactly-once-ish: consumer claims rows atomically (`FOR UPDATE SKIP LOCKED` or status claim) to avoid duplicate side effects; side-effect-producing handlers are idempotent.

## 17.2 Financial worker sweeps (Alpha)

| WORKER-0xx | Sweep | Purpose |
|---|---|---|
| WORKER-010 | `expire_stale_workshop_bookings` (RPC) via `sweepExpiredWorkshopBookings` (service method, `payment-service.ts:206`) | expire pending-payment, release capacity (`REAL-007` — defined but NOT dispatched) |
| WORKER-011 | payment reconcile | provider ops vs payments; flag `ambiguous` (`PAY-041`) |
| WORKER-012 | session completion clock | transition ended scheduled sessions → completed + history/payout eligibility |
| WORKER-013 | payout eligibility | compute host payout candidates (domain, not `BookingStatus`) |

## 17.3 Failure handling

- `WORKER-020` — A sweep failure does not abort the whole iteration; per-sweep isolation.
- `WORKER-021` — Non-actionable provider events parked and surfaced as `ambiguous`, never silently dropped (`PAY-022`).
- `WORKER-022` — Observability: log each sweep start/end/count + `ambiguous` events (`reliability_engineer` domain).

## 17.4 ACCEPTANCE CRITERIA

- `AC-WORKER-001` — Expired pending-payment bookings release capacity via the worker (`REAL-007` fixed).
- `AC-WORKER-002` — Outbox events delivered with retries; parked events visible to ops.
- `AC-WORKER-003` — Concurrent worker runs safe (no double side effects).
- `AC-WORKER-004` — Reconciliation flags `ambiguous` money states.

---

## 17 RTM

| Req ID | Req | Impl | Test | Acceptance | Evidence |
|---|---|---|---|---|---|
| WORKER-002 | dispatch expiry sweep | `financial-worker-runtime.ts` | `ITST-sweep` | `AC-WORKER-001` | REAL-007/BLK-002 |
| WORKER-003 | outbox consumer | worker | `ITST-outbox` | `AC-WORKER-002` | — |
| WORKER-005 | claim/atomic | consumer | `ITST-claim` | `AC-WORKER-003` | — |
| WORKER-013 | payout eligibility | worker | `ITST-payout` | `AC-WORKER-004` | — |
