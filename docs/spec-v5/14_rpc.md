# 14 — RPC CONTRACT (RPC)

**Surface:** all Supabase RPC/function contracts the frontend & backend rely on. Authoritative function names/signatures; the corrective `20260820130000` defines intended contract for several of these.
**Alpha status:** Alpha core.
**Primary evidence:** `backend/src/services/booking-service.ts`, migrations, `docs/TUTORIA_MASTER_TECHNICAL_INVENTORY.md` §14.

---

## 14.0 VERIFIED REALITY (28 Aug 2026)

The RPC names/signatures below are **verified against current migrations** (`backend/supabase/migrations`), not invented. Corrective `20260820130000_alpha_contract_cleanup.sql` (committed `ca0c5e2`) drops the 2-arg `create_booking` overload and grants the 3-arg to `authenticated`.

### 14.1 create_booking (canonical — resolves prior `REAL-004` ambiguity)

- `RPC-001` **Verified signature** (`20260820100001`, kept by `20260820130000`):
  `create_booking(session_id uuid, participant_count int DEFAULT 1, p_idempotency_key text DEFAULT null) RETURNS jsonb`
  - **The offering is NOT a parameter** — it is derived from `sessions.offering_id`. This corrects the earlier v5.0 text that claimed `(p_offering_id, p_session_id, p_participant_count)`.
  - `20260820130000` runs `drop function if exists public.create_booking(uuid, integer)` and `grant execute ... create_booking(uuid,int,text) to authenticated`.
- Behavior (verified in `20260820100001`, lines 9–60+):
  - `assert_verified_booking_caller()` enforces authn/authz server-side (not client).
  - Idempotency fast-path: rejects `BOOKING_CONFLICT` (23505) if the learner already has an active booking for that `session_id` with the same `idempotency_key`.
  - `consume_booking_create_attempt(uid)` = booking rate limiter (`SEC-020`).
  - `select ... for update` on session (**canonical lock order: session first**) → atomic capacity/liveness.
  - Rejects `SESSION_NOT_OPEN`, self-host booking (`INVALID_TRANSITION`), pricing not snapshotted (`BOOKING_PRICE_NOT_SNAPSHOTTED`).
  - Pricing server-side from offering (`flat_per_participant_v1` via `price_per_participant_vnd`).
- Errors (verified codes): `INVALID_TRANSITION` (22023), `INVALID_IDEMPOTENCY_KEY` (22023), `BOOKING_CONFLICT` (23505), `SESSION_NOT_OPEN` (22023), `BOOKING_PRICE_NOT_SNAPSHOTTED` (22023), plus capacity/consume errors.

## 14.2 Read / booking RPCs (verified names)

| RPC-0xx | Verified function | Purpose |
|---|---|---|
| RPC-013 | `booking_read_json(bid uuid)` | learner/host booking detail (v2, fixed by `20260820100002`) |
| RPC-014 | `get_booking(bid uuid)` | legacy booking detail read |
| RPC-015 | `get_booking_cancellation_preview(bid uuid)` | cancellation preview (version/reason) |
| RPC-016 | `list_bookable_sessions(uuid, uuid, text)` | bookable sessions per offering/kind |
| RPC-017 | `get_bookable_session(uuid)` | single bookable session |
| RPC-018 | `resolve_booking_pricing(uuid, int)` | server price resolution (honors `flat_per_participant_v1`; `fixed_v1` excluded) |

## 14.3 Mutating RPCs (host/tutor — verified names)

| RPC-0xx | Verified function | Purpose |
|---|---|---|
| RPC-020 | `create_offering(text, text, text, bigint, bigint, text, text)` | host create offering (pricing-model validated in `20260820130000`) |
| RPC-021 | `get_offering(uuid)` | offering detail |
| RPC-022 | `list_sessions_by_offering_id(uuid)` | sessions for an offering |
| RPC-030 | `expire_stale_workshop_bookings(text)` | worker expiry sweep — **granted to `service_role` only**, defined in service (`payment-service.ts:206`) but **NOT dispatched** by `runFinancialWorkerIteration` (only 3 sweeps) — confirms `REAL-007`/`BLK-002` |
| RPC-031 | `consume_booking_create_attempt(uid)` | internal rate-limiter (called by create_booking) |
| RPC-032 | `assert_verified_booking_caller()` | internal authn/authz guard (called by create_booking) |

> Note: tutor-CV availability RPCs and approval-mode confirm/reject/complete RPC names were **not individually verified** this pass — they are tracked as `UNKNOWN` until confirmed, not asserted. (`20260815124228` provides cancellation; approval-mode host confirm/reject path name pending verification.)

## 14.4 Worker / domain

- `RPC-030` — `expire_stale_workshop_bookings(text)` — **the verified** expiry sweep name (see §14.3; defined in service `payment-service.ts:206`, granted to `service_role`, NOT dispatched by the worker — `REAL-007`/`BLK-002`).
- `RPC-031/032` — outbox + reconciliation/payout domain RPCs: **names not yet verified** this pass — tracked as `UNKNOWN`, not asserted.

## 14.5 RPC authorization contract

- `RPC-040` — All mutating RPCs run `SECURITY DEFINER` with `SET search_path=''`; they check `auth.uid()` and ownership/role explicitly; never trust client-passed owner/host fields.
- `RPC-041` — Public RPCs are `SECURITY INVOKER`/RLS-guarded to expose public rows only.
- `RPC-042` — A helper/`sql_injection` check pattern is applied; function bodies avoid string-built SQL.

## 14.6 ACCEPTANCE CRITERIA

- `AC-RPC-001` — `create_booking` canonical signature works and rel-builds from clean schema.
- `AC-RPC-002` — Capacity guard atomic; over-capacity rejected.
- `AC-RPC-003` — `expire_stale_workshop_bookings` is dispatched in worker and expires pending lodgment.
- `AC-RPC-004` — All mutating RPCs enforce ownership/role + `auth.uid()`; public RPCs expose public rows only.

---

## 14 RTM

| Req ID | Req | Impl | Test | Acceptance | Evidence |
|---|---|---|---|---|---|
| RPC-001 | canonical create_booking 3-arg (`session_id,participant_count,idempotency_key`) | 20260820130000 (`ca0c5e2`) | `TST-rpc-create` | `AC-RPC-001` | verified |
| RPC-013/015 | booking detail + cancel preview read | 20260815124228/20100002 | `TST-rpc-public` | `AC-LEARN-001` | verified |
| RPC-016/017 | list/get bookable session | shared engine | `TST-rpc-public` | `AC-RPC-001` | verified |
| RPC-018 | resolve_booking_pricing (flat_per_participant_v1) | 20260820130000 | `TST-price` | `AC-SRV-002` | verified |
| RPC-030 | `expire_stale_workshop_bookings` dispatch fix | worker+rpc | `ITST-sweep` | `AC-RPC-003` | REAL-007 |
| verify | approval-mode confirm/reject RPC name (UNKNOWN) | — | `ITST-approval` | `AC-HOST-002` | UNKNOWN |
| RPC-040/041 | authorization contract (`SECURITY DEFINER`+`search_path=''`) | RPC | `TST-rpc-acl` | `AC-RPC-004` | §15 |
