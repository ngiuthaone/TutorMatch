-- 20260902000000_restore_dropped_booking_constraints.sql
-- Re-asserts three CHECK constraints that were accidentally dropped in
-- 20260820100000_workshop_booking_v1_schema.sql. The DROP CONSTRAINT IF EXISTS
-- lines at the top of that migration removed these constraints from existing
-- databases; the subsequent ADD CONSTRAINT either ran with a different
-- definition (workshop pricing model) or was intended to be paired with a
-- constraint that was never re-added.
--
-- This migration is additive and idempotent: each block drops the named
-- constraint if it exists, then adds it back with the original definition.
-- It is safe on databases where:
--   - the original constraint is still present (DROP IF EXISTS is a no-op,
--     ADD replaces the constraint with the same definition);
--   - the constraint was already replaced by the buggy migration (DROP IF
--     EXISTS removes the replacement, ADD restores the original);
--   - the constraint was lost entirely (DROP IF EXISTS is a no-op, ADD
--     restores it).
--
-- The original definitions are taken from:
--   bookings_pricing_snapshot_check  : 20260819120000_shared_booking_engine.sql
--   bookings_cancelled_by_check     : 20260820000000_extend_cancelled_by_check.sql
--   booking_history_actor_check     : 20260820000000_extend_cancelled_by_check.sql
set search_path = '';

-- ─────────────────────────────────────────────────────────────────────
-- 1. bookings.pricing snapshot CHECK (original from shared booking engine)
-- ─────────────────────────────────────────────────────────────────────
alter table public.bookings
  drop constraint if exists bookings_pricing_snapshot_check;

alter table public.bookings
  add constraint bookings_pricing_snapshot_check check (
    (pricing_amount_vnd is null and pricing_currency is null and pricing_hourly_rate_vnd is null
     and pricing_duration_minutes is null and pricing_model is null and pricing_snapshotted_at is null
     and pricing_unit_price_vnd is null and pricing_participant_count is null)
    or (pricing_model = 'hourly_v1' and pricing_amount_vnd > 0 and pricing_currency = 'VND'
        and pricing_hourly_rate_vnd between 50000 and 10000000 and pricing_duration_minutes > 0
        and pricing_unit_price_vnd is null and pricing_participant_count is not null
        and pricing_snapshotted_at is not null)
    or (pricing_model = 'fixed_v1' and pricing_amount_vnd >= 0 and pricing_currency = 'VND'
        and pricing_unit_price_vnd >= 0 and pricing_participant_count >= 1
        and pricing_hourly_rate_vnd is null and pricing_duration_minutes is null
        and pricing_snapshotted_at is not null)
  );

-- ─────────────────────────────────────────────────────────────────────
-- 2. bookings.cancelled_by CHECK (original with attendee | host | system)
-- ─────────────────────────────────────────────────────────────────────
alter table public.bookings
  drop constraint if exists bookings_cancelled_by_check;

alter table public.bookings
  add constraint bookings_cancelled_by_check
  check (cancelled_by in ('attendee', 'host', 'system'));

-- ─────────────────────────────────────────────────────────────────────
-- 3. booking_history.actor CHECK (original with attendee | host | system)
-- ─────────────────────────────────────────────────────────────────────
alter table public.booking_history
  drop constraint if exists booking_history_actor_check;

alter table public.booking_history
  add constraint booking_history_actor_check
  check (actor in ('attendee', 'host', 'system'));
