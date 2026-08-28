# 01 — Tutoria System Inventory

Forensic reconstruction of the repository as it exists **today** on branch
`consolidation/2026-08-20-pre-manus`. All statements are evidence-based; claims
based only on documentation are explicitly labeled.

## 0. Investigation boundary

| Item | Value | Evidence |
|------|-------|----------|
| Repository root | `/Users/soshi/Documents/tutormatch` | verified |
| Git branch (checked out) | `consolidation/2026-08-20-pre-manus` | `git branch` |
| Current commit SHA | `9aa03a20f9046a6922da2df26cd28ec1c7f8c53e` | `git rev-parse HEAD` |
| Remotes | `origin -> https://github.com/ngiuthaone/TutorMatch.git` | `git remote -v` |
| Package manager | pnpm (root, backend) + npm (discover) | `package.json` per surface |
| Node | v26.4.0 (env) — backend declares 22.x (`engines`) | `node -v`; `backend/package.json` |
| Python | 3.9.6 | `python3 --version` |
| Local Supabase (Docker) | running, project `backend`, DB on :54322, API on :54321 | `docker ps`; REST `200` |

Working tree is clean except untracked: `.codex/`, `supabase/`, `test-results/`,
`discover/test-results/`, and
`backend/supabase/migrations/20260820100001_workshop_booking_v1_rpcs.sql.bak`.

## 1. Three surfaces (per AGENTS.md, confirmed by code)

1. **Root TutorMatch SPA** — legacy/local demo vanilla-JS single-file app.
2. **`backend/`** — production-oriented Fastify + Supabase API, domain model,
   migrations, financial worker.
3. **`discover/`** — Next.js frontend (preferred production web shell).

## 2. Repository map

```
Tutoria repository
├── Root SPA (legacy demo)
│   ├── app.js                ~1947-line IIFE vanilla-JS hash-routed SPA (Vietnamese)
│   ├── app.legacy-ui.js      v2 predecessor (never loaded by current index.html)
│   ├── server.js             GET/POST /api/state on data/state.json (file storage, no auth)
│   ├── vercel.json           static SPA hosting; 404s /api/*
│   ├── index.html, styles*.css, config.js
│   └── src/                  real auth (Supabase) + /api/v1 client layer (auth.bundle.js)
├── backend/                  Fastify 5 API + Supabase
│   ├── src/config/env.ts     zod env schema (VNPay, Supabase, rate limits)
│   ├── src/app.ts, server.ts Fastify app composition + bootstrap (optional in-process worker)
│   ├── src/plugins/          authenticate, admin-role, security (rate-limit, noStore)
│   ├── src/domain/           pure-TS: booking-lifecycle, session-lifecycle,
│   │                         payment-lifecycle, payout-statement, refund-calculation,
│   │                         cancellation-refund-policy, offering-type-mapping, analytics-events
│   ├── src/services/         thin Supabase RPC/CRUD clients + VNPay adapter + payment service
│   ├── src/routes/           admin, booking, compliance, dashboard, health, marketplace,
│   │                         me, payments, payouts, policies, public-tutors, tutor-cv
│   ├── src/workers/          financial-recovery-worker (entry), config, runtime (3 sweeps)
│   ├── supabase/migrations/  26 .sql files (see 05_DATABASE)
│   ├── test/                 19 unit test files
│   └── test-integration/     15 integration test files (need local Supabase)
├── discover/                 Next.js 16.2.10 frontend (app router)
│   ├── src/app/              57 route pages (see 03_FRONTEND)
│   ├── src/lib/              auth, booking-api, tutor-booking-api, workshop-booking-api,
│   │                         event-booking-api, payment-api, tutor-cv-api, marketplace-api,
│   │                         mock data files (*-data.ts), storage, notifications, sanitize
│   ├── src/components/       pages, iframe bridges, nav
│   └── public/               static iframe HTML shells (courses/events/messages/learning/center)
├── docs/                     agent-team governance, deployment topology, runbooks (DOC claims)
├── oss/ + scripts/oss_guard.py  OSS license gate (validates EXTERNAL_SOURCES, generates notices)
└── audit/                    this reconstruction
```

## 3. Applications / services identified

| Entry point | Surface | Purpose | Real or demo |
|-------------|---------|---------|--------------|
| `scripts/start-local.js` / `server.js` | Root | serve root SPA + `/api/state` | demo |
| `backend` `pnpm start` → `dist/server.js` | Backend | Fastify HTTP API | real (Supabase-backed) |
| `backend` `pnpm worker:start` → `dist/workers/financial-recovery-worker.js` | Backend | refund execution/reconciliation + payment finalization sweeps | real |
| `discover` `next dev/build/start` | Frontend | Next.js web shell | mixed real+mock |

## 4. Frameworks / runtime versions

| Surface | Framework | Version source |
|---------|-----------|----------------|
| Root | vanilla JS (React listed as dependency but not in shipped runtime) | `app.js` IIFE |
| Backend | Fastify 5, TypeScript, Supabase JS | `backend/package.json` |
| Frontend | Next.js 16.2.10, React 19.2.4, Tailwind 4, TipTap | `discover/package.json` |

## 5. Environment / deployment configuration

- No `.github/` workflows exist (none committed; history references a removed
  `oss-license-gate.yml`).
- No Dockerfile / docker-compose (local Supabase runs via that project's own CLI).
- `render.yaml` defines two staging services: API web + financial worker (DOC
  claims no Render deploy has happened).
- `vercel.json` is the legacy root-SPA static config.
- Vercel projects linked locally: `tutormatch` (prj_PpuT…) and `discover`
  (prj_VHqI…) under org `team_HcsnWWBa65d6UONQ0paME31Z` (.vercel/* is gitignored).

## 6. Secrets handling (names only, values redacted)

`backend/.env.example` expects: NODE_ENV, TUTORIA_ENVIRONMENT, HOST, PORT,
FRONTEND_ORIGINS, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY,
SUPABASE_SERVICE_ROLE_KEY (worker), VNPAY_ENVIRONMENT, VNPAY_TMN_CODE,
VNPAY_HASH_SECRET, VNPAY_RETURN_URL, VNPAY_IPN_URL, plus rate-limit/timeout
tunables. `discover/.env.local.example` expects `NEXT_PUBLIC_*` browser-safe
values. No secret values are reported in this audit.

## 7. Key architectural facts

- Authoritative booking/payment logic lives in **Postgres functions (SQL
  migrations)**; the Fastify TS layer is a thin `client.rpc()` wrapper.
- Every migration table has RLS enabled; most financial tables are fully
  revoked and reached only through `SECURITY DEFINER` RPCs.
- Legacy `backend/schema.sql` is a **different, superseded schema** (users,
  student_requests, cases, case_status) that does not match the migration tree.
