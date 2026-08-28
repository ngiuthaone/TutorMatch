# 09 — Auth & Security Reconstruction

Derived from backend plugins/services, migrations, RLS, frontend auth code, and
the OSS/security scripts. No secrets are printed.

## 1. Authentication

- **Backend**: Supabase Auth JWT bearer verified in `lib/supabase.ts`,
  consumed by `plugins/authenticate.ts` (populates `request.auth.accessToken`).
  Routes call RPCs with the caller JWT; RLS enforces identity.
- **Frontend (discover)**: Supabase PKCE, `signInWithPassword`/provider,
  PKCE callback in `auth/callback`, `verify-email`, `update-password`.
  `isLiveMode()` enables live auth only when `NEXT_PUBLIC_TUTORIA_DEMO_MODE!==true`
  AND Supabase URL/key present. **All client-side; no server middleware.**
- **Root SPA `src/`**: separate real Supabase client + `/api/v1/me`.

## 2. Authorization

- Backend role checks: `admin-role.ts` (requireAdmin), `requireTutor` for
  tutor-CV writes, `can_manage_offering`/`assert_host_of_session` for session/
  offering/booking host actions, `assert_verified_booking_caller` for bookings.
- Role elevation: `enable_tutor` (service_role only); `handle_new_user_profile`
  hardened in `20260815150540` to ignore client `raw_user_meta_data.role`.
- DB is authoritative; client metadata is not trusted.

## 3. RLS

- Every migration table has RLS; financial tables closed-by-default via
  `SECURITY DEFINER` RPCs; only `profiles` + `marketplace_listings` use row
  policies. Strong pattern. (See 05.)

## 4. Security observations (verified)

- `timingSafeEqual` used for VNPay hash compare.
- Fastify logger redacts auth headers/cookies/tokens/passwords/secretKey.
- Rate limiting (`@fastify/rate-limit`) across routes; booking-create rate
  limit at DB layer; CORS restricted to `FRONTEND_ORIGINS`.
- Open webhook `GET /api/v1/payments/vnpay/ipn` is unauthenticated by design
  (provider webhook) but must be signature-verified + TLS (live HTTPS origin
  UNKNOWN).

## 5. Security concerns / gaps

1. **No server-side route protection** in discover (auth client-only) — pages
   reachable though data access is RLS/Bearer-protected. (P2)
2. **Local dev DB drift** leaves security-relevant functions inconsistent
   (two `create_booking`, missing `20260820120000` hardening) in the local
   env. (P1 for verification, not prod)
3. **Root SPA demo** `server.js` `/api/state` is unauthenticated with CORS `*`
   and full-read/overwrite of demo state — acceptable only because it is the
   explicit non-production demo surface (AGENTS.md).
4. **Reviews/moderation/messaging absent** — UGC moderation surface does not
   exist. (P2)
5. **Storage bucket not provisioned** — avatar path exists but no bucket/RLS.
6. `data/state.json` holds **plaintext demo passwords** (demo only).
7. Frontend notes `window.location.assign` pattern throughout (lint warning),
   not a security issue but a stability smell.
8. `.vercel/output/**` build artifacts are inside the lint scope (config, not
   security).

## 6. Secret handling

- `backend/.env` holds production SUPABASE + VNPay values (redacted here).
- `discover/.env.local.example` documents only `NEXT_PUBLIC_*`.
- No secrets found committed to tracked source (untracked `.env*`/`.vercel/*`
  contain credentials/tokens; redacted).
- Worker fail-closed guard prevents prod/sandbox VNPay mixing.

## 7. Bottom line

Auth/authorization model is strong (RLS + security-definer + service-role
worker boundaries). Gaps are: no server-side page gating in discover,
no UGC moderation/reviews, no storage bucket RLS, and unverified production
TLS/VNPay webhook origin.
