# 11 — API CONTRACT (API)

**Surface:** HTTP API (Fastify routes) that the discover frontend calls for auth, booking, host, tutor, payment, and admin operations. Page routes are unprotected (page-route checks); these API/route handlers are where authorization must live (where applicable, backend uses `server-verify.ts`).
**Alpha status:** Alpha core — the money loop must route through authorized API handlers.
**Primary evidence:** `backend/src/routes/*.ts`, `discover/src/app/api/*` (route handlers using `server-verify.ts`), `discover/src/lib/*-api.ts`.

> **Reality note:** `discover/src/app/api/events` and `/api/tutors` DO use `server-verify.ts`; page routes are unprotected (`REAL`). Backend Fastify is the authoritative API.

---

## 11.1 Authorization posture

- `API-001` — Auth on API: every mutating endpoint resolves identity from `request.user` (Server-Side Auth / `server-verify.ts`) or Supabase-Auth header; never trusts client-supplied identity.
- `API-002` — Backend Fastify endpoints validate ownership/role server-side before touching DB.
- `API-003` — The discover `src/proxy.ts` no-op means any API relying on it is unguarded → mark posture `PRODUCT DECISION REQUIRED` and secure at backend boundary (`SEC-003`).

## 11.2 Endpoint registry (target; source of truth = existing routes)

### Public
- `GET /api/offering/public/:slug` → offering detail (pricing resolved, public fields only).
- `GET /api/offering/public/list` → listing (kind/sort/filter via `SCH-*`).
- `GET /api/tutor/public/:slug` → tutor profile public.

### Auth/user
- `GET /api/auth/session` → current session + profile (role/host/tutor flags).
- `POST /api/auth/logout`.
- `POST /api/auth/onboard/host` (role elevation path, service-role, `ROLE-003`).

### Booking (shared engine)
- `POST /api/bookings` (create; → `create_booking`; returns booking+payment intent).
- `GET /api/bookings` (list own).
- `GET /api/bookings/:id` (detail; owner/host).
- `POST /api/bookings/:id/cancel`.
- `POST /api/bookings/:id/confirm` / `/reject` (host, approval mode).
- `POST /api/bookings/:id/pay` (re-init checkout).

### Host / workshop
- `GET /api/host/workshops` .
- `POST /api/workshops` (create offering).
- `PUT /api/workshops/:id` .
- `POST /api/workshops/:id/publish` / `/unpublish`.
- `GET/PUT /api/workshops/:id/sessions`.
- `GET /api/host/bookings`, `GET /api/host/attendees`, `GET /api/host/earnings`.

### Tutor
- `GET/PUT /api/tutor/me` (CV CAS).
- `PUT /api/tutor/availability`.
- `GET /api/tutor/:slug`.

### Payment
- `POST /api/payments` (init checkout; returns client secret / VNPay params).
- `GET /api/payments/:id` (status; server-truth).
- `POST /api/webhooks/vnpay` (provider callback; verify signature; idempotent).

### Admin
- `GET/POST /api/admin/...` (support/ops; admin role).

## 11.3 Response/error contract

- `API-010` — Standard error envelope: `{ error: { code, message, details? } }`; codes: `auth_required`, `forbidden`, `not_found`, `capacity_exceeded`, `conflict`, `duplicate`, `payment_expired`, `validation`, `provider_error`, `ambiguous`.
- `API-011` — 2xx for success; 4xx for client; 5xx server (never leak internals).
- `API-012` — Non-leaky 403 (`SEC`).

## 11.4 Money/booking safety in API

- `API-020` — API never accepts client pricing/eligibility; price comes from server RPC.
- `API-021` — Mutation endpoints are authoritative; idempotency via client `idempotency_key` headers on payment/booking create.

## 11.5 ACCEPTANCE CRITERIA

- `AC-API-001` — Book/create/pay only succeeds with a valid authenticated actor + ownership.
- `AC-API-002` — Every mutating endpoint enforces server-side auth and role.
- `AC-API-003` — Standard error envelope; no leakage.
- `AC-API-004` — Proxy no-op does not leave an unguarded auth boundary unaddressed.

---

## 11 RTM (select)

| Req ID | Req | Impl | Test | Acceptance | Evidence |
|---|---|---|---|---|---|
| API-001/002 | server-side auth+role | routes | `TST-api-auth` | `AC-API-001/2` | §15 |
| API-010/011 | error envelope | handlers | `TST-api-err` | `AC-API-003` | — |
| API-020 | price never from client | booking route | `TST-pay-amount` | `AC-PAY-004` | — |
| API-021 | idempotency header | booking/pay | `ITST-idem` | `AC-PAY-002` | — |
| API-004 | proxy posture | proxy | `TST-proxy` | `AC-API-004` | SEC-003 |
