# PRIVATE ALPHA REMEDIATION — BASELINE

**Date:** 2026-08-27
**Author:** OpenCode (implementation engineer)
**Branch:** `consolidation/2026-08-20-pre-manus`
**Base commit (HEAD at baseline):** `e901c300fdda05f0d8ef1661392391f59c9f2240`
**Scope:** Read-only reconnaissance. No production logic modified.

---

## 1. Current branch / commit / tree state

- Branch: `consolidation/2026-08-20-pre-manus`
- HEAD: `e901c30` (`audit: add final reconciled state report (29)`)
- Working tree: has untracked `audit/01..18`, `.codex/`, `supabase/`, `test-results/`, and `backend/supabase/migrations/20260820100001_workshop_booking_v1_rpcs.sql.bak`. No tracked source files are modified.

## 2. Test baseline (run and confirmed)

| Suite | Command | Result |
|---|---|---|
| Backend unit | `cd backend && pnpm test` | **337 passed / 337** |
| Discover unit | `cd discover && pnpm test` | **165 passed / 165** |
| Root auth | `pnpm test:auth` | **100 passed / 100** |
| Integration | `pnpm test:integration` | **BLOCKED** — local Supabase stale (see §6) |

## 3. Confirmed defects (runtime/static verified)

### D1 — `create_booking` overload → PGRST203 (P0, Phase 1)
Reproduced live against local Supabase PostgREST (`curl /rest/v1/rpc/create_booking` with 2 positional args):

```
PGRST203 Could not choose the best candidate function between:
  public.create_booking(session_id => uuid, participant_count => integer),
  public.create_booking(session_id => uuid, participant_count => integer, p_idempotency_key => text)
```
DB introspection confirms two overloads exist. **Authoritative signature** (per backend `booking-service.ts:56` + route schema `booking.ts:8` + latest migration `20260820100001`) is the 3-arg `(session_id uuid, participant_count int, p_idempotency_key text)`. The 2-arg `(uuid, integer)` is obsolete and must be dropped via a forward corrective migration (local-applied only; production-gated).

### D2 — Local DB is behind migration head (P0 verification, Phase 6)
Local `supabase_migrations.schema_migrations` applied set (24):
`0001..0013, 20260814073312, 20260814153000, 20260815090000, 20260815090001, 20260815090002, 20260815124228, 20260815150540, 20260820000000, 20260820100000, 20260820100001, 20260820100002`

Repo tracked migrations head (26): **also includes `20260819120000_shared_booking_engine.sql` and `20260820120000_host_authorization_consistency.sql`, which are NOT applied locally.** Both missing locally.

- `20260819120000` defines `resolve_booking_pricing` (with `fixed_v1` branch) and a 2-arg `create_booking` using it.
- Local DB does **not** have `resolve_booking_pricing` at all; local `create_booking` 3-arg is from `20260820100001`.

### D3 — `fixed_v1` is dead; authoritative pricing is `flat_per_participant_v1` (P1, Phase 2)
Local DB offerings pricing constraint: `CHECK (pricing_model = ANY ('hourly_v1','flat_per_participant_v1'))` — `fixed_v1` **not valid**. Bookings snapshot check: `hourly_v1`/`flat_per_participant_v1` only. Backend `booking.ts:13` enum: `["hourly_v1","flat_per_participant_v1"]`. `20260820100001` `create_offering` rejects `fixed_v1`. `fixed_v1` exists only in the not-applied `20260819120000` `resolve_booking_pricing` branch. **Conclusion:** workshop=`flat_per_participant_v1`, tutor=`hourly_v1`; cancel the `fixed_v1` branch in the corrective migration to prevent it becoming live.

### D4 — `create_offering` param-name mismatch + nonfunctional body (P0, corrective migration)
`booking-service.ts:76` and `workshop-capacity-idempotency.test.ts:47` call RPC `create_offering` with param `p_offering_type`, but `20260820100001:441` declares the first param `p_kind` → PostgREST-by-name fails (PGRST202). **Additionally** the function body's uniqueness check `where kind = p_kind and slug = slug` is an ambiguous PL/pgSQL reference (both `slug` resolve to the column) that errors on **every** invocation, so `create_offering` is dead even via positional SQL.
**Chosen fix (in corrective migration):** rename the RPC first param `p_kind`→`p_offering_type` (matches the service/tests; signature identity unchanged so positional callers are unaffected) and fix `slug = slug` → `slug = generated_slug` (rename local to `generated_slug`). This is the reverse of the earlier tentative wording ("change the service to `p_kind`"); the DB contract is the thing corrected to match the real service + test callers.

### D5 — `.bak` migration file present (housekeeping, Phase 2)
`backend/supabase/migrations/20260820100001_workshop_booking_v1_rpcs.sql.bak` exists and is untracked. It must not be treated as a migration (Supabase only applies `.sql`). Confirm it is excluded from the migration order; remove/deprecate per repo conventions.

### D6 — Financial worker omits workshop TTL sweep (P1, Phase 4)
`backend/src/workers/financial-worker-runtime.ts` sweeps only `refund_execution`, `refund_reconciliation`, `payment_finalization`. `payment-service.ts.sweepExpiredWorkshopBookings` and DB RPC `expire_stale_workshop_bookings` exist but are not in the loop. (Recorded from audit 29; verified in Phase 4.)

### D7 — `/bookings/[id]` route missing (P1, Phase 5)
`workshop-detail-page.tsx:214` redirects to `/bookings/${id}`; only `discover/src/app/bookings/page.tsx` exists (no `[id]` child). (Recorded from audit 29; Phase 5 builds the route.)

### D8 — Shared-engine prerequisite missing → local offerings schema misaligned (P0, Phase 6)
`20260820100000_workshop_booking_v1_schema.sql` is explicitly written as an **incremental ALTER on top of `20260819120000_shared_booking_engine.sql`** (`ADD COLUMN IF NOT EXISTS pricing_model/price_per_participant_vnd/hourly_rate_vnd/booking_mode` to the shared-engine `offerings` that has `kind/slug/creator_id/config/unit_price_vnd`). `20260819120000` is therefore a **hard prerequisite** of the workshop-v1 RPCs (`create_offering` inserts into `kind/slug/creator_id/publication_status`).

The local DB is **missing `20260819120000`**, so its `offerings` table has a different column set (`host_id`, `offering_type`, `status`, `pricing_model`, ...) that does NOT match the workshop-v1 RPCs. Functions created by `20260820100001` would fail at runtime (`column "kind" does not exist`, `column "publication_status" does not exist`) even though the functions exist. **Local DB is misaligned/corrupted, not representative of the intended repo schema.**

**Implication:** Phases 1 & 6 are coupled. The corrective migration must be written against the *intended* shared-engine-based schema, and the *local disposable* DB must be rebuilt by re-applying all 26 tracked migrations in order (local-only; documented; permitted). Production is UNKNOWN and must not be touched. This is registered as a stop-condition for production (conflicting/uncertain migrations) but is resolvable *locally*.

## 4. Authoritative RPC / contract inventory (used to design fixes)

| Contract | Signature (DB) | Caller |
|---|---|---|
| `create_booking` (canonical) | `(session_id uuid, participant_count int default 1, p_idempotency_key text default null)` | `booking-service.ts:56` (3-arg) |
| `create_booking` (obsolete) | `(session_id uuid, participant_count int default 1)` | none (dead) — DROP |
| `resolve_booking_pricing` | defined only in `20260819120000` (not local) | not referenced by app |
| `create_offering` | `(p_kind, p_title, p_pricing_model, p_price_per_participant_vnd=null, p_hourly_rate_vnd=null, p_booking_mode='approval', p_description=null)` | `booking-service.ts:75-83` (**sends `p_offering_type` → D4 mismatch**) |
| `update_offering_status` | `(p_offering_id uuid, p_expected_version bigint, p_status text)` | `booking-service.ts:84-88` |
| `expire_stale_workshop_bookings` | `(p_worker_id text default 'system')` | service_role; for worker |
| `get_my_workshop_bookings` | `()` | `booking-service.ts:90` |
| `cancel_workshop_booking` | `(p_booking_id uuid, p_expected_version bigint, p_reason text=null)` | `booking-service.ts:91-95` |
| `list_bookable_sessions` | `(p_tutor_profile_id, p_offering_id, p_kind)` | `booking-service.ts:50-54` |
| `get_bookable_session` | `(p_session_id uuid)` | `booking-service.ts:55` |

## 5. Migration state summary

- Repo tracked migrations: 26 (head at `20260820120000`).
- Local applied: 24 (missing `20260819120000`, `20260820120000`).
- Production: **UNKNOWN** (not inspectable this run). Do not execute corrective migrations against production.
- `20260819130000_discovery_integrity_fix.sql` is referenced in `DISCOVERY_INTEGRITY_FIX_REPORT.md` but is **not committed** and not in the migrations dir. Out of scope (integrity fix only).

## 6. Integration test blocker

`pnpm test:integration` requires Supabase; local DB is stale (D2). Phase 6 reconciles the local DB to the intended migration head (local only). Full integration verification is only meaningful after Phase 6.

## 7. Deployment assumptions (this run)

- Vercel host `discover-gules-xi.vercel.app` runs demo mode (no env). Backend Render deployment **UNVERIFIED**. Production Supabase state **UNKNOWN**.
- This run: repository code, forward corrective migrations (local-applied), tests, config templates, deployment-readiness docs. **No production mutation.**

## 8. Implementation plan (ordered)

> **Phase 1/2/6 coupling:** the corrective migration (`20260820130000_alpha_contract_cleanup.sql`) can only be fully verified on a local DB rebuilt to migration head, so Phases 1+2+6 are executed together against the disposable local stack (see D8). Phases 3–11 proceed on top.

1. **Phase 1** — forward corrective migration `20260820130000_alpha_contract_cleanup.sql`: drop obsolete `create_booking(uuid,integer)` (guarded + assert 3-arg only stays); reconcile `resolve_booking_pricing` off `fixed_v1`; fix `create_offering` (param `p_kind`→`p_offering_type` + `slug = slug` ambiguity); overlay `list_bookable_sessions`/`get_bookable_session` off `fixed_v1`; merge `booking_read_json` head+workshop; close PUBLIC-exec ACL holes (esp. `expire_stale_workshop_bookings`→service_role); strip `creatorId` from `get_offering`; add published-filter to `list_sessions_by_offering_id`; fix `get_my_workshop_bookings` co-host read. Regression test proving no PGRST203.
2. **Phase 2** — reconcile `fixed_v1` out of the live contract (covered by the corrective migration); remove ``.bak` from being a migration (delete the stray `20260820100001_workshop_booking_v1_rpcs.sql.bak`, ignored by CLI anyway); pricing regression tests.
3. **Phase 3** — rewire workshop creator (`event-creator.tsx`) to call `create_offering` + `create_session` via the real API client; remove production dependency on `tutoria-published-events`. (The `p_offering_type` param fix is now in the corrective migration.)
4. **Phase 4** — add `sweepExpiredWorkshopBookings` to worker loop + worker test.
5. **Phase 5** — add `/bookings/[id]` dynamic route + redirect + auth + tests.
6. **Phase 6** — bring local Supabase to migration head (rebuild disposable local DB applying all 27 tracked migrations in order); rerun integration tests.
7. **Phase 7** — auth production-mode hardening (fail-closed, explicit demo).
8. **Phase 8** — `/api/v1` deployment-readiness config + docs (no live deploy).
9. **Phase 9** — `/center` auth gate.
10. **Phase 10** — regression + full test runs.
11. **Phase 11** — final remediation report + `docs/MIGRATION_CONTRACT.md`.

## 9. Baseline verdict

- Backend unit: PASS (337). Discover: PASS (165). Auth: PASS (100).
- Integration: UNVERIFIED (stale local DB).
- Production infra: UNVERIFIED.
- Code defects confirmed at baseline: D1 (PGRST203), D4 (`p_offering_type`), D4-in-Phase-3, D6, D7. D2/D3/D5 are migration/pricing reconciliation.
- **Baseline state is consistent with audit 29: "Production core, gated data path, demo runtime; not production-verified."**
