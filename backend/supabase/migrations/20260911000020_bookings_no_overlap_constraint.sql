-- 20260911000020_bookings_no_overlap_constraint.sql
-- Strengthen the tutor-side double-booking guarantee.
--
-- Tutoria already prevents (learner_id, session_id) collisions on active
-- bookings via bookings_active_learner_session_unique (0004) and enforces
-- capacity in create_booking RPC (0005). What is missing is a hard DB-layer
-- guarantee that one HOST cannot have two SCHEDULED sessions whose time
-- ranges overlap.
--
-- Pattern: PostgreSQL EXCLUDE USING gist with a tstzrange over (starts_at, ends_at).
-- This is the same shape BookBarber uses for employee availability (no copy;
-- Tutoria reimplements it on its own sessions table). The pattern is part of
-- Postgres core functionality (btree_gist + gist exclusion constraints) and
-- not copyrightable subject matter.
--
-- Scope:
--   *   Only applies to sessions where status = 'scheduled'. 'cancelled' and
--       'completed' sessions are excluded so historical rows never block
--       re-scheduling a tutor who previously ran into an issue.
--   *   PostgreSQL does not allow EXCLUDE constraints to be marked NOT VALID,
--       so this migration validates existing scheduled sessions at add time.
--       Sessions seeded by prior test fixtures should already be non-overlapping;
--       if a legacy overlap exists, reset locally with `supabase db reset` after
--       cleaning the offending rows.
--
-- Operational notes:
--   *   create_booking (0005_create_booking_session_rpcs.sql) and the tutor
--       create-session flows both run through SECURITY DEFINER RPCs that
--       take advisory locks per host_id; this constraint is an additional
--       safety net, not a substitute.
set search_path = public, pg_catalog;

-- btree_gist is required so host_id (uuid) can be combined with the tstzrange
-- column in a single gist exclusion index.
create extension if not exists btree_gist with schema extensions;

alter table public.sessions
  drop constraint if exists sessions_no_host_overlap;

alter table public.sessions
  add constraint sessions_no_host_overlap
  exclude using gist (
    host_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status = 'scheduled');
