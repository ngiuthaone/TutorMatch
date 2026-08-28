# 17 — Tutoria Master Current State (Executive Summary)

Forensic reconstruction. Branch `consolidation/2026-08-20-pre-manus`, SHA
`9aa03a2`. Read-only investigation; nothing in the project was modified.

---

## What is Tutoria (today, per evidence)

Tutoria is a Vietnam-first learning-marketplace codebase built as **three
coexisting surfaces**: a legacy/local demo SPA (root), a Supabase-backed
Fastify API (backend), and a Next.js frontend shell (discover). The
marketplace moves are real but the state of "what ships" is fragmented:

- The **backend + database + payments** are the most complete and are real
  (Supabase, RLS, VNPay, outbox, refunds, payouts model, financial worker).
- The **discover frontend** is a mix: real calls into the backend for
  booking/workshop/class/event/tutor surfaces, but many sections are
  hard-coded mock data, static iframe shells, or localStorage demos.
- The **root SPA** is a legacy/demo surface explicitly not a production source
  of truth (AGENTS.md), with simulated (non-provider) payment and file/JSON
  persistence.

## Applications/services that exist

1. Root TutorMatch legacy SPA (demo) — `app.js` + `server.js` + `data/state.json`.
2. `backend/` Fastify API (`/api/v1/*`) — real, Supabase-backed.
3. `backend/` financial-recovery worker — real, 3 Sweeps.
4. `discover/` Next.js frontend — real shell, mixed data sources.

## Features that exist (implementation matrix summary)

**Real (Supabase-backed backend + some frontend wiring):** auth (Supabase,
email/password), tutor-CV CRUD/publish, public tutor list, marketplace
listings, sessions+bookings (1:1, workshop, class, event shared engine),
capacity+concurrency, VNPay payments, refunds (obligation/execution/
reconciliation), payout + commission model, admin/dashboard, compliance,
cancellation/refund policy, outbox domain events, financial worker.

**Frontend real routes:** workshops, classes, events-live, bookings list,
payments/return, center (host booking mgmt), tutor profile.

**Frontend mock/static/iframe or localStorage:** discover home (partial),
for-you, people, courses, events, messages, learning, discussions, articles,
communities, search, skills, year-review, u/user/v3–v15 profile iteration
artifacts, notifications.

## What is actually functional (evidence-backed)

- **Backend unit suite: 337/337 PASS** (`backend pnpm test`).
- **Backend typecheck PASS, build PASS** (`pnpm typecheck`, `pnpm build`).
- **Discover unit suite: 165/165 PASS**.
- **Root state-machine + auth suite: 100/100 PASS**.
- **OSS license gate: PASS** (`python3 scripts/oss_guard.py ci`).
- **Backend APIs + booking/payment DB engine:** real code, RLS-scoped,
  concurrency-aware (idempotency keys, CAS versioning, row locks, outbox).
- **Financial worker runs 3 of 4 intended sweeps**; a 4th (workshop TTL
  expiry) is implemented but **NOT dispatched** (see risks).

## What is partially implemented

- Workshop/class/event **frontends** are real for read + booking but the
  **post-booking detail page is missing** (`/bookings/[id]` → 404 after booking).
- `/events`, `/courses`, `/people`, `/messages`, `/learning` are **static
  iframe/mock shells**, not real workflows.
- Auth is **client-side only** (no server route-protection middleware).
- The local dev database is **out of sync** with repository migrations.

## What is broken / gaps (evidence-backed)

- **Discover lint fails: 68 errors (42 in src/) + 4383 warnings.**
- **`expire_stale_workshop_bookings` (workshop payment-TTL cancellation) is
  never invoked by the financial worker** (`sweepExpiredWorkshopBookings` not in
  the 3-sweep runtime list) — pending-payment workshop bookings may never
  auto-expire.
- **`/bookings/${id}` redirect target does not exist** → 404 after booking.
- **Local Supabase dev DB is stale**: migration `20260819120000` partially
  applied (offerings exist, `offering_hosts` missing), `20260820120000` not
  applied, and `create_booking` has two overloads. Integration tests cannot
  pass against it (26 failed / 24 passed / 99 skipped; failures due to stale
  schema, not necessarily broken code).
- Root SPA `demoMode:false` leaves chat/booking/payment/messaging as stubs
  (`alert(...)`).

## What is missing

- No messaging implementation anywhere (frontend is a static iframe; no
  `conversations` lib; no DB table).
- No email, no CMS/published-course/community persistence to DB (articles,
  discussions, communities are localStorage/mock).
- No storage buckets provisioned (avatars reference a bucket URL pattern but no
  bucket SQL).
- No reviews table in the production DB (only demo).
- No notifications backend (frontend reads localStorage even in live mode).
- No CI workflow committed.
- The migration `20260819130000_discovery_integrity_fix.sql` referenced by a
  signed-off report is **absent from the repo**.

## What is unknown / unverified

- **Production launch status**: no confirmed live production URL of the real
  product. `tutormatch.vercel.app` serves an unrelated default React app. The
  docs explicitly state "No Render service has been deployed."
- **VNPay production credentials & runtime**: UNKNOWN (only names present;
  local `e2e-vnpay-sandbox.mjs` exists; a live production webhook/refund/payout
  was not verified).
- The configured production Supabase project (`sufjrstewzvzjzvzekry`) is
  reachable (401 unauthenticated) but its migration state / data / usage is
  UNKNOWN.
- Whether `app.legacy-ui.js` / `dist/test-hero-animation.gif` are still used
  anywhere: no loader found (INFERRED superseded/stray).

## What is deployed

- Only a **Vercel project for the legacy root SPA domain** is confirmed live,
  and it serves **an unrelated default create-react-app page** (not the Tutoria
  product). No production deployment of the real Tutoria stack is confirmed.

## What production systems are connected

- **Supabase**: a hosted project is configured + reachable; local stack runs
  via Docker. Not confirmed that the hosted project has the repo migrations.
- **VNPay**: adapter + config + sandbox e2e script exist; not confirmed live.
- Render / other hosting: **not deployed** (per docs and no evidence otherwise).

## Current booking architecture

One physical `sessions`/`bookings`/`offerings` model, evolved over 4+
"generations" in the same tables: core 1:1 booking → payment/refunds →
shared offering engine (`offerings`, `offering_hosts`) → workshop
flat-per-participant + instant mode. Booking creation is authoritative in
Postgres `create_booking` RPC with row locks, idempotency keys, capacity
recount, rate limiting, and outbox emission. Booking statuses are text columns
with CHECK constraints (`requested`, `confirmed`, `paid`-adjacent via
payments, `cancelled`, `rejected`, `completed`). See 06.

## Current payment architecture

VNPay via `vnpay-adapter.ts`; `payments`/`payment_attempts`/`payment_events`/
`payment_provider_events`/`refunds`/`payment_provider_operations` tables;
idempotent provider operations; webhook = open `POST /api/v1/payments/vnpay/ipn`
(signature-verified); refund obligations + execution/reconciliation worker;
payout + commission are **modeled** but no provider disbursement is confirmed.
See 08.

## Current workshop architecture

Workshops are an `offering` (kind=`workshop`) with `offering_hosts`, sessions,
flat-per-participant pricing, `instant` or `approval` booking mode, and
workshop-specific cancellation + payment TTL. Host-authorization was hardened.
**Gap: the payment-TTL expiry sweep is not dispatched.** See 07.

## Top technical risks (P0/P1)

1. **[P1] Financial worker does not dispatch workshop payment-TTL expiry** —
   pending-payment workshop bookings may hold capacity indefinitely.
2. **[P1] Local dev DB stale / non-reproducible** — integration tests can't
   run; migration drift between repo and applied DB.
3. **[P1] `/bookings/[id]` 404 after booking** — broken learner post-payment
   flow.
4. **[P1] Discover lint fails (68 errors)** — not a blocker to run but signals
   code-quality debt and the `.vercel/output` artifacts are linted (config bug).
5. **[P2] Production deployment unverified** — no live URL/backend/worker
   confirmed; cannot claim production-ready.
6. **[P2] Messaging absent entirely.**
7. **[P2] Multiple product surfaces (reviews, notifications, email, storage,
   CMS) missing from DB.**
8. **[P2] Notifications/discussions/articles read localStorage even in live
   mode.**
9. **[P2] Auth client-side only (no server middleware gating).**
10. **[P3] Legacy/dead code & iteration artifacts** (v3–v15, app.legacy-ui.js,
    `.bak` migration file, `.vercel/output` committed-lintable artifacts).

## What prevents production launch (concrete blockers)

- No confirmed production deployment/hostname for frontend, API, or worker.
- VNPay production configuration and webhook/refund/payout runtime unverified.
- Workshop TTL sweep not dispatched (capacity leak).
- Missing `/bookings/[id]` route breaks the booking completion flow.
- Local dev DB not reproducible from migrations (integration tests blocked).
- Several core marketplace surfaces are still demo/localStorage, not DB-backed.

## What can safely be considered complete (evidence)

- Backend domain + booking/payment/refund SQL engine (unit + many logic tests).
- Backend API surface (all routes real RPC wrappers).
- Frontend booking/workshop/class/event/tutor read + booking wiring (unit-tested).
- Financial worker core 3-sweep runtime (unit-tested).
- OSS compliance gate.
- Supabase RLS architecture (closed-by-default + security-definer RPCs).

## What should NOT be rebuilt

- The booking/payment/refund/outbox PostgreSQL engine (well-structured, tested).
- The VNPay adapter + idempotent payment service.
- The Supabase RLS security-definer pattern.
- The OSS guard.
- The discover frontend shell + navigation + real booking components
  (workshop detail, bookings list, payments return, center).
