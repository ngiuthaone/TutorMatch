# 07/00 — AUTHENTICATION & ACCOUNT CONTRACT (AUTH)

**Surface:** authentication, sessions, account/profile (Auth layer)
**Alpha status:** Alpha core — everything behind the "book" action requires a real authenticated identity; demo mode is a shell that must not authorize live transactions.
**Primary evidence:** `discover/src/lib/auth/config.ts:45` (demo gate), `profiles` table, RLS `auth.uid()` pattern.

---

## AUTH-001 — Identity model
- Identity is Supabase Auth (`auth.users`). There is no separate Tutoria user table to write on signup beyond `profiles`.
- Generation/trigger: `handle_new_user_profile` creates a `profiles` row; it ignores client metadata `role` (role elevation is service_role-only).
- `AUTH-002` — A real (non-demo) user must exist in `auth.users` with a valid JWT before any book/pay/host mutation. Backend and DB accept only `auth.uid()`-authenticated actors for these paths. Client identity is never trusted for authorization.

## AUTH-003 — Demo mode gate
- Current: `discover/src/lib/auth/config.ts:45` sets `demoMode=true` when no `NEXT_PUBLIC_SUPABASE_*`/env present.
- Requirement: when `demoMode=true`, the app:
  - Renders read-only discovery/profile/booking UI with data-placeholder labels clearly marked "Demo".
  - **Never** calls a live `create_booking`, `create_payment`, or any real transaction against production.
  - Shows `DEMO` badges instead of real money/booking controls.
- `DEC-auth-01` — how to turn demo vs live: ambient-env (recommended) with `NEXT_PUBLIC_DEMO_MODE` override. Live shell must never silently fall back to demo for a transactional action.

## AUTH-004 — Auth flows
1. **Sign-up (email/password + magic link used by marketplace)**
   - Fresh → create `profiles` via trigger; default role `student`; `is_host=false`.
   - On-board to become tutor/host is a separate opt-in (see `TUT-*`, `HOST-*`).
2. **Sign-in** — email/password or magic link; existing token reuse; mobile/deep-link keep session (`PKCE`).
3. **Sign-out** — clears session, no local transactional state to wipe.
4. **Password reset** — Supabase `recover` flow.

## AUTH-005 — Session handling
- Store session per Supabase Auth recommended pattern (browser storage `${prefix}-token`). Server reads JWT once on `request.user` at the backend boundary.
- Every Supabase RLS path already uses `auth.uid()`; no client-side role field is trusted.
- `AUTH-006` — Session expiry: on 401, route to sign-in preserving intended next page. Do not silently inject demo identity into live flows (`REAL-006`).

## AUTH-007 — Account & profile surface
Rather than a free-form `Account`, the canonical account surface combines:
- Profile edit (name, avatar) — `PROF-*`
- Learner bookings — `LEARN-*` / `06_learner.md`
- Host Center — `HOST-*` / `05_host_center.md`
- Tutor profile — `TUT-*` / `07_tutor.md`
- Billing/invoices — `LEARN-*`/`PAY-*`

No separate `/account` route is a blocker; a simple `/settings` (read identity + sign-out + payment/config pointers) may exist but is **not Alpha-blocking**.

## AUTH-008 — Auth edge cases
- Duplicate sign-up for an email already in `auth.users` → error mapped to friendly message.
- Magic-link on mobile → deep link to intended booking page; booking ID must be carried safely.
- Anonymous browsing is supported for discovery; only the guarded actions require auth.
- `AUTH-009` — Authorization failures return `403` and are surfaced non-leakily (don't reveal existence of other users' data).

## AUTH-010 — Admin authn
- Admin actions require admin role; role checks are enforced in backend (service-role path) + RLS admin policy, not the client. See `15_security.md`.

---

## 07/00 RTM

| Req ID | Req | Impl file(s) | API/RPC/DB | Test | Acceptance | Evidence |
|---|---|---|---|---|---|---|
| AUTH-001 | Identity = Supabase Auth + profiles | `auth/*`, `lib/auth/*` | `auth.*`, `profiles` | `TST-auth-*` | `AC-AUTH-001` | §22/§38 |
| AUTH-003 | Demo gate never authorizes live transaction | `discover/src/lib/auth/config.ts:45` | gate | `TST-demo-gate` | `AC-AUTH-003` | `REAL-006` |
| AUTH-004 | Signup/signin/signout/reset flows | auth UI | `auth` | `TST-auth-*` | `AC-AUTH-004` | §38 |
| AUTH-006 | Session expiry → route to sign-in | auth ui, guards | — | `TST-auth-session` | `AC-AUTH-006` | — |
| AUTH-009 | Non-leaky 403 | ui, api | RLS policy | `TST-auth-403` | `AC-AUTH-009` | §15 |
