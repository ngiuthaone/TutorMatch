# 12 — Runtime Verification Report

What was actually executed against running systems (safe, read-only). No
production mutation; no schema change; no data change.

## Backend runtime checks

| Flow | Environment | Steps | Expected | Observed | Result | Evidence |
|---|---|---|---|---|---|---|
| Fastify API build/typecheck | local | `pnpm typecheck; pnpm build` | exit 0 | exit 0 | PASS | backend/dist built |
| Backend unit tests | local | `pnpm test` | all pass | 337/337 | PASS | vitest output |
| Local Supabase REST | local Docker | `curl /rest/v1/` (unauth) | 200 | 200 | PASS | host up |
| Local Supabase anon ACL | local Docker | `curl /profiles` anon | denied | 42501 permission denied | PASS (RLS working) | error JSON |
| `create_booking` overload | local DB | docker psql pg_get_function | one signature | **two signatures** | FAIL (drift) | PGRST203 seen in tests |
| Migration applied set | local DB | `supabase_migrations.schema_migrations` | matches repo | **missing 20260819120000, 20260820120000** | FAIL (drift) | query output |
| Integration suite | local Supabase | `pnpm test:integration` | pass | 24 pass/26 fail/99 skip | BLOCKED | vitest output |

## Frontend / deployment runtime checks

| Flow | Environment | Steps | Observed | Result |
|---|---|---|---|---|
| Discover build | local | `npm run build` | 57 routes emitted | PASS |
| Discover typecheck | local | `tsc --noEmit` | clean | PASS |
| Discover lint | local | `pnpm lint` | 68 err / 4383 warn | FAIL |
| Discover unit tests | local | `pnpm test` | 165/165 | PASS |
| Root SPA live URL | Internet | `curl https://tutormatch.vercel.app` | 200 default CRA scaffold, **not Tutoria** | UNEXPECTED content |
| Discover live URL | Internet | `curl https://discover.vercel.app` | 402 | no project |
| Configured Supabase prod | Internet | `curl $REF.supabase.co/rest/v1/` | 401 (unauth) | host reachable; state UNKNOWN |

## VNPay sandbox e2e

`backend/e2e-vnpay-sandbox.mjs` exists but was **not executed** — it requires valid
VNPay sandbox credentials that are not available in this session. Status: UNVERIFIED.

## Browser / UI verification

No headless browser was available for discover interaction testing; UI-level
verification relies on build success + unit tests + code reading. Runtime UI
interaction (click-through booking, responsive, console errors) = **UNVERIFIED**.

## Important runtime-verified gaps

1. **Workshop payment-TTL sweep not dispatched** — verified by reading
   `runFinancialWorkerIteration` (only 3 sweeps) vs `sweepExpiredWorkshopBookings`
   (exists, unused by runtime).
2. **`/bookings/[id]` 404** — verified by code (redirect target) + absence of
   route (glob).
3. **Local DB drift** — verified live via SQL queries.
4. **Production deployment not the real product** — verified via live URL curl.
