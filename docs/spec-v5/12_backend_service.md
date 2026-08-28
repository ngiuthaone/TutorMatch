# 12 — BACKEND SERVICE CONTRACT (SRV)

**Surface:** Fastify backend business logic above the DB (booking service, pricing, payment adapter, host/tutor services, worker runtime entry).
**Alpha status:** Alpha core — the authoritative business logic for money/booking/capacity lives here.
**Primary evidence:** `backend/src/services/booking-service.ts`, `backend/src/routes/*`, `backend/src/workers/financial-worker-runtime.ts`.

---

## 12.1 Service boundaries

- `SRV-001` — **BookingService**: orchestrates `create_booking` RPC, mapping domain errors; applies business policy (eligibility, price snapshot, capacity) that is DB-enforced; drives `BOOK-*` state transitions.
- `SRV-002` — **PricingService/Resolver**: resolves `flat_per_participant_v1`/`hourly_v1` from session/offering config server-side; authoritative pricing. (`fixed_v1` dead — `REAL-005`.)
- `SRV-003` — **PaymentAdapter/Provider**: provider-agnostic checkout, webhooks, refunds; idempotent (`PAY-*`).
- `SRV-004` — **FinancialWorkerRuntime**: `runFinancialWorkerIteration` sweeps; must also dispatch `sweepExpiredWorkshopBookings` (`REAL-007`/`BLK-002`), envelope processing, reconciliation.
- `SRV-005` — **HostService / TutorService / AuthService**: CRUD + authorization on offerings/sessions/CV/availability + role.
- `SRV-006` — **OutboxConsumer**: durable domain-event dispatch (`EVT2-*`).

## 12.2 Concurrency & idempotency contract

- `SRV-010` — Mutating services rely on DB CAS/version + atomic RPCs; a service never implements its own ad-hoc in-process lock as the primary guard (that is a DB serialization concern — `database_engineer`/`tutoria-postgres-concurrency` domain).
- `SRV-011` — Idempotent commands: same `idempotency_key` returns the original result, no duplicate side effect.
- `SRV-012` — Error mapping centralizes provider/DB errors → `API-010` codes.

## 12.3 State machine ownership

- `SRV-020` — Services enforce `BOOK/DOM/Payment` lifecycle transitions; the DB + worker are the enforcers at persistence boundary; service logic is the application-side expression.
- `SRV-021` — No payment state written into `BookingStatus` (`ARCH`/`DOM`).

## 12.4 Test surfaces

- `SRV-030` — Unit tests for pricing resolution, error mapping, state transitions, idempotency stubs (existing backend unit suite 337/337 PASS — `REAL-011`).
- `SRV-031` — Integration tests for booking/capacity/payment/webhook must run against a clean DB (currently blocked by local drift — `REAL-011`/`UNK-005`). See `28_test_contract.md`.

## 12.5 ACCEPTANCE CRITERIA

- `AC-SRV-001` — Booking command correct across instant/approval modes (unit+integration).
- `AC-SRV-002` — Pricing always resolved server-side; client cannot alter total.
- `AC-SRV-003` — Worker dispatches the expiry sweep (`REAL-007`).
- `AC-SRV-004` — Idempotent mutating commands; no double side effect.
- `AC-SRV-005` — No payment state in BookingStatus.

---

## 12 RTM

| Req ID | Req | Impl | Test | Acceptance | Evidence |
|---|---|---|---|---|---|
| SRV-001 | BookingService | `booking-service.ts` | `TST-book-svc` | `AC-SRV-001` | — |
| SRV-002 | pricing resolver | pricing | `TST-price` | `AC-SRV-002` | REAL-005 |
| SRV-004 | worker dispatch sweep | `financial-worker-runtime.ts` | `ITST-sweep` | `AC-SRV-003` | REAL-007 |
| SRV-011 | idempotency | services | `ITST-idem` | `AC-SRV-004` | — |
| SRV-021 | no pay in BookingStatus | state | `TST-state` | `AC-SRV-005` | DOM-010 |
