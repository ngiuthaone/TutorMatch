# 13 — Contradiction Register

Active conflicts between implementations, config, docs, DB, tests, and runtime.

| # | Type | Contradiction | Evidence | Severity |
|---|---|---|---|---|
| C1 | Migration vs applied DB | Repo has `20260819120000` + `20260820120000` migrations; local applied DB **missing both** (but `offerings` table exists → partial manual apply); `offering_hosts` absent. | `supabase_migrations.schema_migrations` vs `ls migrations`; `\dt` | P1 |
| C2 | Code vs repo | `CREATE_OR_REPLACE`/`drop` for `create_booking` produced **two live overloads** (2-arg & 3-arg) → PGRST203. | `pg_get_function_identity_arguments`; test errors | P1 |
| C3 | Docs vs code (migration) | `DISCOVERY_INTEGRITY_FIX_REPORT.md` (signed PASS) claims `20260819130000_discovery_integrity_fix.sql` created + hosted-applied. **Migration absent from repo.** | `find *19130000*` → none | P1 (unverifiable hosted fix) |
| C4 | Worker vs fixture | `expire_stale_workshop_bookings` RPC + service method exist, but `runFinancialWorkerIteration` does not invoke it → TTL never runs. | `financial-worker-runtime.ts` sweeps list vs `payment-service.ts` | P1 |
| C5 | Frontend contract vs routes | Booking success redirects to `/bookings/${id}` but **no such route** → 404. | `workshop-detail-page.tsx:214`; `find src/app/bookings` | P1 |
| C6 | Docs vs code (framework) | `TUTORIA_PRODUCT_BRAIN` claims root SPA uses React 19; shipped runtime is vanilla-JS IIFE (React only a dependency). | `app.js` (IIFE) | P2 |
| C7 | Docs vs code (state) | Product brain claims `data/state.json` deleted; it exists (20.8 KB). | `data/state.json` | P2 |
| C8 | Schema surfaces | Legacy `backend/schema.sql` (users/cases/case_status) is incompatible with migration schema (profiles/sessions/bookings). Both exist though schema.sql is not load-referenced. | file contents & DR | P2 |
| C9 | Test counts (historical) | Prior reports cite "261/261", "157/157"; current runs are 337 (backend), 165 (discover) — different points/branches. | report vs current runs | P2 (informational) |
| C10 | Lint scope | Build artifacts `.vercel/output/**` are linted (not ignored), inflating error count and coupling build output into quality gates. | `eslint.config.mjs` globalIgnores | P3 |
| C11 | Env reality | `tutormatch.vercel.app` serves a generic create-react-app default, not Tutoria — documentation/topology implies a Tutoria deployment but live domain is unrelated. | `curl` page content | P2 |
| C12 | Payment status | Backend code is payments-ready (docs/claims), but production VNPay runtime unverified; `SECURITY-REVIEW`/`QA-VERIFICATION` reports exist claiming verification on other branches. Current branch cannot reproduce. | branch `consolidation/` vs branch reports | P2 |
| C13 | Auth surface | `NEXT_PUBLIC_TUTORIA_DEMO_MODE=false` in `.env.local.example` (enables live), but default absent→demo; notifications read localStorage in both modes. | `notifications.ts` | P2 |

## Severity mapping
- P1: booking/payment correctness gaps (TTL, DB drift, booking 404, missing fix migration).
- P2: doc-vs-code drift, mixed schema, env/URL reality, localStorage leakage.
- P3: lint config hygiene.
