# 04 — Backend Reconstruction

Apis, services, business logic, integrations. Verified by reading
`backend/src/**`, `backend/package.json`, and running checks.

## 1. Stack

Fastify 5 + TypeScript + `@supabase/supabase-js`. Node `engines: 22.x`.
Two client modes: caller-scoped (Bearer JWT, RLS) and trusted (service_role
for admin/policy/worker). Business logic is authoritative in **Postgres
RPCs**; TS is a thin wrapper.

## 2. Route inventory (all real, Supabase-backed)

| File | Routes (prefix /api/v1) | Auth |
|------|--------------------------|------|
| `routes/health.ts` | GET /health | public |
| `routes/me.ts` | GET /me | bearer |
| `routes/tutor-cv.ts` | GET/PUT /me/tutor-cv, publish, unpublish | bearer + requireTutor |
| `routes/public-tutors.ts` | GET /tutors, GET /tutors/:id | public (rate-limited, noStore) |
| `routes/marketplace.ts` | GET /marketplace/:kind | public |
| `routes/booking.ts` | ~26 routes: sessions, bookings CRUD/accept/reject/cancel, reschedule, offerings CRUD, workshop cancel | mixed public reads / bearer writes |
| `routes/payments.ts` | POST /payments/start, GET /payments/:bookingId, GET /payments/vnpay/ipn (open), internal reconcile/refunds-execute (token-gated) | bearer + open IPN |
| `routes/payouts.ts` | GET /payouts | bearer |
| `routes/compliance.ts` | GET /host-compliance, /payout-eligible | bearer |
| `routes/policies.ts` | GET /policies/* | bearer |
| `routes/admin.ts` | admin endpoints | requireAdmin |
| `routes/dashboard.ts` | GET /dashboard/overview | requireAdmin |
| `routes/approval.ts` | (see booking) | — |

No localStorage/JSON simulation in the backend. All routes call Supabase RPCs.

## 3. Services

- `booking-service.ts` — booking/offerings CRUD via RPC.
- `payment-service.ts` — VNPay operations, idempotent provider ops, 3 sweeps +
  workshop TTL method (unwired).
- `vnpay-adapter.ts` — secure signature (timingSafeEqual), request/refund/query.
- `payout-service.ts`, `compliance-service.ts`, `policy-service.ts` (need
  service_role), `admin-service.ts`, `tutor-cv-service.ts`, `marketplace-service.ts`,
  `auth-service.ts` (interface) + `lib/supabase.ts` (JWT verify impl).

## 4. Domain (pure TS)

`booking-lifecycle.ts`, `session-lifecycle.ts`, `payment-lifecycle.ts`,
`payout-statement.ts` (commission), `refund-calculation.ts`,
`cancellation-refund-policy.ts` (cites `docs/items-5-6...` and `docs/tutoria-prd.md`
**which are absent from the worktree**), `offering-type-mapping.ts`,
`analytics-events.ts`.

## 5. Worker

`financial-recovery-worker.ts` (entry) → `financial-worker-runtime.ts` runs
**3 sweeps**: refund_execution, refund_reconciliation, payment_finalization.
`financial-worker-config.ts` enforces fail-closed: requires
SUPABASE_SERVICE_ROLE_KEY + all VNPay config; rejects mismatched
production/sandbox environments. In-process embed via `START_WORKER=true` in
`server.ts`; separate process via `pnpm worker:start` (render.yaml).

### Critical gap (VERIFIED)
`PaymentService.sweepExpiredWorkshopBookings(workerId)` exists (services/
payment-service.ts, calls `expire_stale_workshop_bookings`) but is **NOT
registered in the worker's sweep list** (`runFinancialWorkerIteration` only
runs the 3 sweeps above). Therefore **workshop payment-TTL expiry is never
dispatched** by any running process — pending-payment workshop bookings can
hold capacity indefinitely until a manual/admin action.

## 6. Auth & authz

- JWT verification via Supabase (`authenticate.ts` populates accessToken).
- `admin-role.ts` admin enforcement.
- `security.ts` rate-limit + noStore decorators.
- DB-layer enforcement: email-verified gate, booking request rate limit,
  host authorization (`can_manage_offering`, hacked as `can_manage_offering`),
  `assert_host_of_session`. Webhook IPN is intentionally unauthenticated
  (signature-verified server-side).

## 7. Errors / logging / rate limiting

- `api-error.ts` typed errors.
- Fastify logger with redaction list (auth, cookies, tokens, passwords, secretKey).
- `@fastify/rate-limit` per-route windows in env config.
- CORS restricted to `FRONTEND_ORIGINS`.

## 8. Tests / checks (executed)

- `pnpm test` (unit): **337/337 PASS**.
- `pnpm typecheck`: PASS. `pnpm build`: PASS.
- `pnpm test:integration`: **BLOCKED by stale local DB** (26 failed / 24 passed /
  99 skipped; failures from schema drift: PGRST203 `create_booking` overloads,
  missing `offering_hosts`, missing `20260820120000` migration).

## 9. Bottom line

Backend is real, well-structured, and largely IMPLEMENTED_TESTED at the unit
level; integration verification is blocked by local-DB drift; the workshop TTL
sweep gap stands out; payout/commission are modeled but only `GET /payouts`
+ compliance reads exist (no provider disbursement integration verified).
