-- Drop legacy 2-arg create_booking overload (PGRST203 ambiguity guard).
--
-- The canonical create_booking signature is the 3-arg form:
--   (session_id uuid, participant_count integer default 1, p_idempotency_key text default null)
-- defined in 20260831180000_fix_create_booking_flat_pricing_columns.sql and finalized
-- by 20260906000000_drop_legacy_overloads.sql + 20260906000031_drop_legacy_overloads_final.sql.
--
-- However, several earlier migrations (0005, 0007, 0008, 20260815090001,
-- 20260819120000) still `create or replace function public.create_booking(uuid, integer)`
-- without ever dropping it. When any later migration re-introduces or re-applies
-- that 2-arg body — or when a partial `supabase db reset` is replayed after a
-- later migration error short-circuits the chain — the 2-arg overload lingers
-- alongside the 3-arg canonical one. PostgREST then refuses to disambiguate
-- the 2-arg client calls (PGRST203) and returns null, which crashes downstream
-- code with `Cannot read properties of null (reading 'id')`.
--
-- This is the final, idempotent guard: drop the legacy 2-arg overload
-- unconditionally at the tail of the migration chain so the 3-arg canonical
-- form is the only one PostgREST can resolve.
--
-- Verified callers (3-arg path only):
--   * backend/src/services/booking-service.ts:62 — passes p_idempotency_key,
--     plus p_learner_* contact columns (handled by a different RPC).
--   * All test-integration/*.test.ts files that call create_booking with
--     session_id + participant_count (the 2-arg form is satisfied by the
--     3-arg canonical signature via default arguments).
--
-- Verify before:
--   \df public.create_booking
--     -> 2 rows (legacy 2-arg + canonical 3-arg)
-- Verify after:
--   \df public.create_booking
--     -> 1 row (canonical 3-arg only)
--
-- Idempotent: safe to re-run.

set search_path = '';

drop function if exists public.create_booking(uuid, integer);

-- Sanity check: ensure exactly one create_booking remains, and it carries the
-- p_idempotency_key parameter. If a future migration re-introduces a 2-arg
-- body, this guard will fail loudly instead of silently regressing.
do $$
declare
  overload_count int;
  has_idempotency int;
begin
  select count(*) into overload_count
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'create_booking';

  if overload_count <> 1 then
    raise exception 'UNEXPECTED_OVERLOADS: expected exactly 1 create_booking, found %', overload_count;
  end if;

  select count(*) into has_idempotency
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'create_booking'
     and pg_get_function_arguments(p.oid) like '%p_idempotency_key%';

  if has_idempotency <> 1 then
    raise exception 'MISSING_CANONICAL: public.create_booking must accept p_idempotency_key';
  end if;
end $$;