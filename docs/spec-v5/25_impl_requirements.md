# 25 — EXACT IMPLEMENTATION REQUIREMENTS (IMP)

**Purpose:** precise, executable requirements per gap/surface so an engineering agent can implement without rediscovering what to build. Each `IMP-*` is atomic, testable, and links to its `GAP`/`AC`.

> These are the concrete build items; they respect `ARCH` (preserve shared engine), `AUTH` (server-authoritative), `SEC` (RLS), and the migration/ownership gates in `27_migration_plan.md`.

---

## 25.1 Migration / DB (owner-gated — NOT self-authorizing)

- `IMP-001` — Repair `20260820100000` replay defect (`offerings_pricing_model_check` collision) so local head replays cleanly. Gate: owner approval, `database_engineer`. Link `GAP-001`/`AC-RPC-001`.
- `IMP-002` — Establish repo=prod migration parity; reconcile `20260817160000/01` (content unknown → resolve before replay). Link `GAP-002`/`UNK-003`.
- `IMP-003` — Apply canonical 3-arg `create_booking` (corrective `20260820130000`) on prod and drop the 2-arg where safe. Link `GAP-003`/`AC-RPC-001`.
- `IMP-004` — Ensure `expire_stale_workshop_bookings(text)` RPC is present and correctly defined (it is; service method `sweepExpiredWorkshopBookings` at `payment-service.ts:206` calls it). Link `GAP-011`.

## 25.2 Booking / payment invariants

- `IMP-010` — `create_booking` enforces capacity atomically (insert + recount + rollback) and returns booking id + price snapshot. Link `BOOK-011`/`AC-BOOK-002`.
- `IMP-011` — Booking confirm for instant mode is payment-linked; pending-payment holds capacity with TTL. Link `BOOK-020`/`AC-BOOK-001`.
- `IMP-012` — Version/CAS on booking updates (confirm/cancel/complete) with `conflict` on stale. Link `BOOK-031`/`AC-BOOK-003`.
- `IMP-013` — Payment/refund/payout idempotency keys (unique constraints) and order-safe webhook handling; no payment state in BookingStatus. Link `PAY-*`/`DOM-010`/`AC-PAYD-003`.
- `IMP-014` — Server-authoritative pricing; client never sets amount/eligibility. Link `SRV-002`/`AC-PAY-004`.

## 25.3 Worker / async

- `IMP-020` — Dispatch `sweepExpiredWorkshopBookings` in `runFinancialWorkerIteration`. Link `GAP-011`/`AC-WORKER-001`.
- `IMP-021` — Outbox consumer with claim/retry/backoff/park. Link `WORKER-003/005`.
- `IMP-022` — Reconciliation sweep flags `ambiguous`. Link `WORKER-011`/`AC-ANL-001`.

## 25.4 Frontend / routes

- `IMP-030` — Create `discover/src/app/bookings/[id]/page.tsx` (detail, owner/host, states incl. `PAYMENT EXPIRED`/`REFUND PENDING`). Link `GAP-010`/`AC-LEARN-001`.
- `IMP-031` — Fix `events-live/[slug]/page.tsx:30` discriminator; workshop detail from `get_offering_detail`. Link `GAP-012`/`AC-WORK-005`.
- `IMP-032` — Rewire workshop creator to `create_offering`/`create_session` (drop localStorage). Link `GAP-013`/`AC-WORK-004`.
- `IMP-033` — Enforce demo/live separation: live tx routes call real backend only; demo shows read-only placeholders with `DEMO` labels. Link `GAP-014`/`AC-SEC-005`.
- `IMP-034` — Payment return page reads server truth (never trusts URL query alone). Link `PAY-050/051`/`AC-PAY-001`.
- `IMP-035` — Host Center native server-backed tabs (workshops/bookings/attendees/earnings). Link `GAP-018`/`AC-HOST-001`.

## 25.5 Auth / security

- `IMP-040` — Role elevation service-role only; `handle_new_user_profile` ignores client role (already true — preserve). Link `ROLE-003`/`AC-ADM-003`.
- `IMP-041` — All mutating RPC/API enforce `auth.uid()` + ownership + role; non-leaky 403. Link `SEC-001/011`/`AC-SEC-002`.
- `IMP-042` — `booking_create_attempts` rate limiter (429 on burst). Link `SEC-020`/`AC-SEC-003`.
- `IMP-043` — Webhook signature verified before state change; storage validation if buckets provisioned. Link `SEC-052`/`AC-SEC-004`, `STG-013`.

## 25.6 Acceptance linkage

Every `IMP-*` ships with the owning `AC-*` and a test in `28/29` proving it. An `IMP` is not done until its acceptance is evidenced (`DOD-002`).
