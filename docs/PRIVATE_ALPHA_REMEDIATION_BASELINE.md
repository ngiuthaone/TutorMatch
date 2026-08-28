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

## 8. Migration Reconciliation Phase (NEW — resolved during read-only prod inspection)

Decisive findings (read-only `supabase migration list --project-ref sufjrstewzvzjzvzekry` + repo scan; **production untouched**):

| Migration | Applied on prod? | In repo? |
|---|---|---|
| 0001–0013, 20260814073312, 20260814153000, 20260815090000/01/02, 20260815124228, 20260815150540 | YES | YES |
| **20260817160000, 20260817160001** | **YES (remote-only)** | **NO — absent from repo entirely** |
| 20260819120000 (shared engine), 20260820000000, **20260820100000**, 20260820100001, 20260820100002, 20260820120000, 20260820130000 (corrective) | **NO** | YES (except 130000 = this run) |

Confirmed answers:
- **`20260820100000` is NOT applied in production.** → repair-branch applies.
- **Production has exactly ONE `create_booking` overload: `(uuid, integer)`** (2-arg; 0005:163→…→20260815090001:3). The 3-arg `(uuid,int,text)` exists ONLY in `20260820100001:9` (unapplied). **No PGRST203 on production today.**
- Production never applied any of the shared-engine/workshop-v1 chain; its `offerings` table is the pre-shared-engine schema (from `0004`) and has **no** workshop pricing constraints.
- `20260817160000`/`20260817160001` exist only in production history and are not in the repository.

Actions required in this phase (planning; execute later):
0. **Preserve production-only history**: record `20260817160000`/`20260817160001` (names + remote applied times) in `docs/MIGRATION_CONTRACT.md`; do NOT delete from prod.
- **Determine whether those two remote-only migrations need recovery/documentation before production promotion** — they applied to prod but their SQL is unknown; decide: recover (obtain remote DDL) or document as out-of-band prod fixes. This gates the production migration strategy (Phase 12).
- **Repair the historical `20260820100000` replay defect** (constraint-name collision) — SAFE because it has NOT reached production.
- **Rebuild local DB from scratch** (already attempted; failed at `20260820100000` — now repairable).
- **Verify all migrations**, run integration tests.
- **Only after local verification** prepare the production migration strategy (Phase 12, explicit prod gate).

## 9. Final Execution Plan (Private Alpha)

DO NOT TOUCH boundaries: production Supabase (ref `sufjrstewzvzjzvzekry`), production Render/Vercel deployments, VNPay creds, DNS, production config. All DB work is the disposable LOCAL stack (`backend/supabase`, not remote-linked). Every migration edit / local reset / test is local-only; production is touched only by the read-only inspection already done.

### Phases, dependencies, files, acceptance, tests

**Phase A — Migration Reconciliation & Contract (gate: planning done)**
- Files: `docs/MIGRATION_CONTRACT.md` (record remote-only `20260817160000/01`, migration map, repair decision), `docs/PRIVATE_ALPHA_REMEDIATION_BASELINE.md`.
- Repair `20260820100000_workshop_booking_v1_schema.sql` (this plan): add `DROP CONSTRAINT IF EXISTS offerings_pricing_model_check;` before line 24's `ADD CONSTRAINT`. Dependency: prod-inspection confirmed NOT-applied → safe to edit.
- Acceptance: historical migration replays from scratch; decision recorded for `20260817160000/01` (recover vs document).
- Test: `supabase db reset --local` replays 27/27.

**Phase 1 — Corrective migration continues**
- Files: `backend/supabase/migrations/20260820130000_alpha_contract_cleanup.sql` (already written, committed `ca0c5e2`).
- After Phase A fix, `supabase db reset --local` applies full chain → verify. Acceptance: `create_booking` overload = exactly 1 (3-arg); `resolve_booking_pricing` = flat_per_participant_v1/hourly_v1 only; `create_offering` accepts `p_offering_type`; ACL holes closed; `get_offering` strips creatorId. Test: regression (no PGRST203), workshop-capacity-idempotency.

**Phase 2 — fixed_v1 removal + pricing tests** (covered by Phase 1 migration; add pricing regression tests).
**Phase 3 — workshop creator rewire** (`discover/src/.../event-creator.tsx` → real `create_offering`+`create_session`; remove `tutoria-published-events` dependency).
**Phase 4 — worker TTL sweep** (`backend/src/workers/financial-worker-runtime.ts:25-29` add `sweepExpiredWorkshopBookings`).
**Phase 5 — `/bookings/[id]` route** (`discover/src/lib/booking-api.ts`, new `discover/src/app/bookings/[id]/page.tsx`, redirect fix).
**Phase 6 — local DB at head + integration tests** (local `db reset`; run backend integration suite).
**Phase 7 — auth production-mode hardening** (fail-closed, explicit demo).
**Phase 8 — `/api/v1` deployment-readiness config + docs** (no live deploy).
**Phase 9 — `/center` auth gate**.
**Phase 10 — regression + full test runs** (backend 337, discover 165, auth 100, integration).
**Phase 11 — final remediation report + `docs/MIGRATION_CONTRACT.md`**.
**Phase 12 — PRODUCTION MIGRATION STRATEGY (explicit prod gate; after local verification only).** Requires resolving the `20260817160000/01` recovery question first. Not executed this cycle.

### Commit checkpoints (atomic)
1. `docs/: migration reconciliation findings + execution plan` (this response's planning).
2. `fix(db): repair 20260820100000 replay defect (DROP CONSTRAINT before ADD)` (Phase A).
3. `test(db): local rebuild verified — 27/27 migrations, overload/pricing/acl checks` (Phase A+1+6 evidence) — or report failures.
4. Per-phase commits for Phases 1–11 (already committed Phase 1 `ca0c5e2`).

### Production gates (hard stop; do not cross)
- No `supabase db push` / remote `db reset` / production SQL mutation.
- No `supabase link` that could re-point the local project away from local; inspect read-only only via `--project-ref`.
- No deploy to prod Render/Vercel; no VNPay/DNS/config changes.
- Phase 12 prepared but NOT run until local verification passes AND `20260817160000/01` recovery is resolved.

### Critical path
1. Repair `20260820100000` (Phase A) → 2. local reset 27/27 (Phase A+1+6) → 3. corrective migration verified (overload/pricing/ACL) → 4. integration suite green → 5. remaining phases (creator/worker/route/auth) → 6. Phase 12 planning (gated).

### Definition of Done — Private Alpha
- `supabase db reset --local` replays 27/27 migrations (incl. repaired `20260820100000` + corrective `20260820130000`).
- `create_booking(uuid,int,text)` is the sole overload; no PGRST203 anywhere.
- Workshop pricing = `flat_per_participant_v1`, tutor = `hourly_v1`; `fixed_v1` gone from every live RPC.
- `create_offering`/`create_session` work via real API client (creator flow), `p_offering_type` contract verified by integration test.
- Worker sweeps expired workshop bookings; `/bookings/[id]` route live and authed.
- Security: no PUBLIC-exec RPC; `creatorId`/auth UUIDs absent from public payloads; workshop co-hosts can read their bookings.
- Tests: backend unit 337, discover 165, auth 100, integration suite green, new regression tests.
- Production migration strategy documented and gated; production untouched (`PRODUCTION_DB_TOUCHED = NO`).
- `docs/MIGRATION_CONTRACT.md` + `docs/PRIVATE_ALPHA_REMEDIATION_BASELINE.md` record the full migration map incl. remote-only `20260817160000/01` and the repair decision.

## 9. Baseline verdict

- Backend unit: PASS (337). Discover: PASS (165). Auth: PASS (100).
- Integration: UNVERIFIED (stale local DB).
- Production infra: UNVERIFIED.
- Code defects confirmed at baseline: D1 (PGRST203), D4 (`p_offering_type`), D4-in-Phase-3, D6, D7. D2/D3/D5 are migration/pricing reconciliation.
- **Baseline state is consistent with audit 29: "Production core, gated data path, demo runtime; not production-verified."**
