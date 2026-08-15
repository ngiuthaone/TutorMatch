# Tutoria production API

This Node.js 22/Fastify API implements liveness, authenticated profile retrieval, secure tutor CV ownership/mutation, publication, unpublication, and public tutor discovery. Supabase Auth validates bearer tokens; user-scoped clients call narrow PostgreSQL RPCs under RLS. Matching, chat, booking, reviews, verification, payments, and moderation remain out of scope.

## Setup

Use Node.js 22 LTS and pnpm. From `backend/`:

```bash
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

Create a separate development project at Supabase. In **Project Settings → API**, copy the project URL and publishable key (the legacy anon key is also a low-privilege project key when publishable keys are unavailable) into `.env`. No service-role or secret key is used or required. Never place privileged keys in frontend code, commit `.env`, print keys, or reuse a development project for production.

Apply all migrations in [`supabase/migrations`](supabase/migrations) in order, including [`0003_create_marketplace_listings.sql`](supabase/migrations/0003_create_marketplace_listings.sql), or use a linked/local Supabase CLI project:

```bash
supabase db push
```

The migration creates the role enum, constrained profiles table, safe signup and `updated_at` triggers, owner-only SELECT policy, and grants authenticated users only SELECT. Public signup metadata is never authorization authority: every new profile starts as `student`. Local/test Tutors are enabled through the trusted service-role-only `enable_tutor(uuid)` operation; `admin`, missing, or unknown signup roles remain non-Tutor. Example metadata:

```json
{ "name": "Nguyen Van A", "role": "student" }
```

Create a test user in Supabase Auth (dashboard or client `signUp`) with that metadata. Obtain its development access token from the successful Auth session. The trigger normally creates its profile; `PROFILE_NOT_FOUND` indicates missing/inconsistent setup and the API does not fabricate one.

## Commands

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm start
pnpm check
```

The built financial recovery worker is a separate long-running process:

```sh
pnpm build && pnpm worker:start
```

See [`../docs/financial-worker-runbook.md`](../docs/financial-worker-runbook.md)
for configuration, supervision, shutdown, and alerting. The deployment
platform is not selected in this repository; production release therefore
requires an explicit `DEPLOYMENT_DECISION_REQUIRED` decision before hosting.

Compiled output runs with Node, not `tsx`. Source maps aid diagnostics but must not be served publicly.

Local RLS verification requires Supabase CLI (`supabase start`) and explicit local-only variables. The suite refuses non-local hosts:

```bash
SUPABASE_TEST_URL=http://127.0.0.1:54321 \
SUPABASE_TEST_PUBLISHABLE_KEY='<local-anon-key>' \
SUPABASE_TEST_DB_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres' \
SUPABASE_TEST_SERVICE_ROLE_KEY='<local-service-role-key>' \
pnpm test:integration
```

## API

```bash
curl -i http://127.0.0.1:4000/api/v1/health
curl -i -H "Authorization: Bearer $TEST_ACCESS_TOKEN" http://127.0.0.1:4000/api/v1/me
curl -i -H "Authorization: Bearer $TEST_ACCESS_TOKEN" http://127.0.0.1:4000/api/v1/me/tutor-cv
curl -i 'http://127.0.0.1:4000/api/v1/tutors?subject=mathematics&limit=12'
```

Success uses `{ "ok": true, ... }`. Expected failures use `{ "ok": false, "error": { "code": "...", "message": "..." }, "requestId": "..." }`: 401 authentication, 404 missing profile, 429 rate limit, 500 invalid/internal data, and 503 provider availability. `/me` is `no-store` and returns only the documented camelCase profile. CORS merely controls browsers; bearer validation and RLS enforce access for every client.

## Security and deployment

Origins are an exact allowlist; credentials are disabled. Helmet supplies API security headers, HSTS only runs in production, bodies/headers/timeouts are bounded, logs redact credentials, and IP rate limiting trusts forwarding headers only when `TRUST_PROXY=true`. Tune limits after measuring traffic. Use a distributed rate-limit store before running multiple instances. CSRF middleware is unnecessary for this bearer-only, non-cookie API and must be reconsidered if cookie auth is introduced. Tokens are never accepted in URLs.

Production requires HTTPS enforced at the hosting layer, a separate production Supabase project, email confirmations enabled with configured SMTP/provider delivery, an exact `/auth/callback` redirect allowlist, provider secret management, known proxy topology before enabling trust, redacted hosting/error-monitoring logs, database backups, dependency-audit review, and typecheck/unit/RLS-integration/build checks before release. Rotate exposed keys. Review privacy, consent, retention, and deletion before launch. Never use demo passwords or real personal data in demo seeds.

The root `server.js` and `/api/state` are **local demo compatibility only**. Never deploy or connect them to real accounts/data. Production deploys this API separately; this milestone alone does not make the full Tutoria product production-ready.

Tutor CV architecture, lifecycle, public/private fields, manual Supabase checks, security decisions, limitations, and avatar omission are documented in `../docs/tutor-cv-milestone.md`. Add each frontend origin exactly to `FRONTEND_ORIGINS`; do not broaden CORS to compensate for configuration mistakes. `/me` and the protected `profiles.role` remain the trusted role source regardless of frontend route guards.
