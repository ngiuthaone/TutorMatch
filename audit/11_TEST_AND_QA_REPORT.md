# 11 — Test & QA Report

## 1. Inventory

| Suite | Location | Command | Count |
|---|---|---|---|
| Backend unit | `backend/test/**/*.test.ts` | `pnpm test` | 19 files |
| Backend integration | `backend/test-integration/**/*.test.ts` | `pnpm test:integration` | 15 files |
| Discover frontend | `discover/src/**/*.test.ts` | `pnpm test` | 25 files |
| Root auth | `test/auth/*` + `test/tutor-cv/*` | `pnpm test:auth` | 11 files |
| Root state machine | `tests/state-machine.test.js` | `pnpm test` | 1 file (js) |
| Python (policy/oss/qa/reference) | `tests/*.py` | (standalone) | 6 files |

## 2. Results — EXECUTED

| Suite | Tests discovered | Executed | Passing | Failing | Skipped | Blocked |
|---|---|---|---|---|---|---|
| Backend unit | 337 | 337 | **337** | 0 | 0 | 0 |
| Discover frontend | 165 | 165 | **165** | 0 | 0 | 0 |
| Root auth | 100 | 100 | **100** | 0 | 0 | 0 |
| Root state-machine | 1 | 1 | **1** | 0 | 0 | 0 |
| Backend integration | 149 | 149 (attempted) | **24** | **26** | **99** | blocked by stale local DB |

### Integration failures — root cause
Attempted against the running local Supabase (Docker project `backend`, DB
:54322). Failed because the local DB is **out of sync with repo migrations**:
- `20260819120000` (shared booking engine) partially applied (offerings exist,
  `offering_hosts` missing) but not tracked as applied;
- `20260820120000` (host authorization consistency) **not applied**;
- `create_booking` has **two overloads** → PGRST203 ambiguity → many tests fail
  at fixture setup or booking creation.

Because the mission forbids modifying the database/schema, I did **not** reset
or re-migrate. So integration results are **BLOCKED by DB drift**, not proven
application breakage. Representative failures:
- `workshop-capacity-idempotency.test.ts` — "Local fixture confirmation failed:
  invalid JWT" (service-role key not accepted → auth fixture fails).
- `z-core-1to1-read-model.test.ts` — PGRST203 `create_booking` overload.
- `sessions-bookings-rls.test.ts` — "Cannot read properties of null" at fixture
  creation; expected-1-got-0 on RLS scope.

## 3. Other checks run

| Check | Command | Result |
|---|---|---|
| Backend typecheck | `pnpm typecheck` | PASS |
| Backend build | `pnpm build` | PASS |
| Discover typecheck | `tsc --noEmit` | PASS |
| Discover build | `npm run build` | PASS |
| Discover lint | `pnpm lint` | **FAIL — 68 errors / 4383 warnings** (42 errors in `src/`) |
| OSS license gate | `python3 scripts/oss_guard.py ci` | PASS |
| VNPay sandbox e2e | `backend/e2e-vnpay-sandbox.mjs` | NOT executed (needs VNPay sandbox creds) |

## 4. Severity of failures

| Failure | Feature | Severity |
|---|---|---|
| Discover lint (react-hooks set-state-in-effect, any, unescaped) | frontend code quality | P3 (not runtime-blocking) |
| Discover lint including `.vercel/output` artifacts | build-config hygiene | P3 |
| Integration tests blocked | booking/payment confidence | P1 (verification gap; real cause = DB drift) |
| Workshop TTL sweep unimplemented in worker | workshop payments | P1 (runtime behavior) |

## 5. Functionality with no meaningful tests

- Messaging (doesn't exist).
- Reviews (doesn't exist).
- Notifications backend (none).
- Payout provider disbursement (model only).
- Production VNPay webhook/refund/payout live paths.
- Storage/avatar upload.
- Discover `src/app/api/events` + `tutors` are tested, but most iframe/mock
  routes have no behavioral tests.

## 6. Bottom line

Unit coverage of the core domain (booking, payment, refund, session lifecycle,
frontend libs) is **strong and green**. Integration/Db-level coverage exists
but **cannot currently run** against the stale local DB; this is a verification
blocker, not proof the application is broken.
