# 15 — AUTH / RLS / SECURITY CONTRACT (SEC)

**Surface:** authentication boundaries, RLS policies, authorization, privacy, abuse controls, secrets, uploads, CORS/CSP.
**Alpha status:** Alpha core — Trust before transaction; Privacy by default.
**Primary evidence:** RLS policies in migrations, `backend/src/*`, `discover/src/proxy.ts` (no-op), `seed`/`auth` rules, `SECURITY DEFINER` + `search_path=''` pattern.

---

## 15.1 Identity & trust boundary

- `SEC-001` — Backend/DB is authoritative. Client metadata (incl. `role`, host/tutor claims, prices, capacity) is never trusted for authorization or financial truth.
- `SEC-002` — Auth via Supabase JWT (`auth.uid()`). Anonymous = public read only.
- `SEC-003` — `discover/src/proxy.ts` is a **no-op** (`REAL`): any route relying on it for auth middleware is unguarded. Any real server-authoritative protection must come from backend routes + RPC auth checks, not the proxy. Mark any page that assumed proxy protection as `PRODUCT DECISION REQUIRED` for its auth posture.

## 15.2 RLS policy model (per table)

Every table carries explicit `FOR SELECT/INSERT/UPDATE/DELETE` policies with `USING`/`WITH CHECK`:

- `profiles` — owner sees all own; public sees public subset; admin via admin role.
- `offerings` / `sessions` — public select on published rows; owner update; insert allowed to host creating + `offering_hosts` membership maintained.
- `bookings` — attendee (SELECT own), host (SELECT on own sessions), insert for eligible learner, update restricted (no author-less status writes), delete disallowed.
- `payments*` — payer + admin + relevant host? Host sees payout/earnings but not learner payment method; no cross-user exposure.
- `refunds`, `payment_provider_*` — service-role/admin only for provider internals; payer/admin view of own refunds.
- `event_outbox`, `booking_history` — worker/service-role write; restricted read.
- `tutor_*` — public select only published public columns; owner update.

`SEC-010` — Never expose `auth.users` ids, service-role credentials, private contact, exact address, private versions, or provider internals through public profiles/APIs (`REAL` privacy rule).
`SEC-011` — RLS is the enforcement layer even when RPCs are `SECURITY DEFINER`; a run ✗ under `authenticated` role means a policy is missing.

## 15.3 Authorization matrix (summary)

| Actor | Public select | Own select | Mutate own | Mutate other |
|---|---|---|---|---|
| anon | ✔ (public) | — | — | — |
| learner | ✔ | ✔ | booking/cancel own | ✘ |
| host/tutor | ✔ | ✔ | own offerings/sessions/CV | ✘ |
| admin | ✔ | ✔ | support/ops paths | ✔ (guarded) |

## 15.4 Abuse & rate controls

- `SEC-020` — `booking_create_attempts` rate limiter: cap bursts of create_booking per attendee+session; 429 w/ backoff.
- `SEC-021` — Payment attempts per card/idempotency key bounded; no unbounded retry.
- `SEC-022` — Search/browse rate shaping if abuse appears (`SCH-*`).

## 15.5 Seed / demo skew

- `SEC-030` — Demo-seeded users, `/api/state`, localStorage transactional truth, and simulated payment are **not** production paths. Nothing live routes real identity/money through them.
- `SEC-031` — `PRODUCT DECISION REQUIRED`: any live page currently relying on demo fixture identity for booking (see AUTH-003).

## 15.6 Secrets & config

- `SEC-040` — Supabase service-role key, VNPay private keys, provider secrets: server env only; never in client bundle, never committed.
- `SEC-041` — `.env*` never committed; DB config not client-authoritative.

## 15.7 CORS / CSP / headers (Next + Fastify)

- `SEC-050` — Backend CORS allows only known origins (discover shell + preview envs); no wildcard on credentialed paths.
- `SEC-051` — CSP on discover with safe connect-src (Supabase host, backend host); no `*` unless justified.
- `SEC-052` — Webhook endpoint requires provider signature verification before any state change (`PAY-011`).

## 15.8 Uploads / storage

- Storage bucket provisioning is a `STG-*` item (`19_storage.md`). Until provisioned, no public upload for avatars/thumbnails to prod (`REAL-010`, deferred).

## 15.9 ACCEPTANCE CRITERIA

- `AC-SEC-001` — No current source exposes auth id/service-role/private contact via public profile/API.
- `AC-SEC-002` — A run of the app under the `authenticated` role cannot mutate another user's booking/offering/payment (RLS + RPC checks).
- `AC-SEC-003` — `booking_create_attempts` limits abuse; 429 on burst.
- `AC-SEC-004` — Webhook mutates state only on verified signature.
- `AC-SEC-005` — No live path uses demo identity for a real transaction.

---

## 15 RTM

| Req ID | Req | Impl | Test | Acceptance | Evidence |
|---|---|---|---|---|---|
| SEC-001 | Server-authoritative | layers | security scan | `AC-SEC-001` | ARCH-004 |
| SEC-003 | proxy no-op → real posture | proxy/routes | `TST-proxy` | `DEC` | REAL |
| SEC-010 | no private leak | RLS/APIs | `TST-leak` | `AC-SEC-001` | privacy |
| SEC-020 | booking rate limit | migration | `ITST-ratelimit` | `AC-SEC-003` | — |
| SEC-052 | webhook signature | webhook | `TST-webhook-sig` | `AC-SEC-004` | PAY-011 |
| SEC-030/031 | no demo-on-live | auth gate | `TST-demo-gate` | `AC-SEC-005` | AUTH-003 |
