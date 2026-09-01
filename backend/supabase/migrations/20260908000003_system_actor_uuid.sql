-- 20260908000003_system_actor_uuid.sql
-- Define a reserved UUID for "system actor" — used in audit trails when
-- a moderation, scheduling, or reconciliation action is performed by a
-- server-side process (background worker, service-role function call)
-- rather than a real human user. The all-zeros UUID has historically
-- been used; we keep that for backward compatibility (already in many
-- audit rows) and ALSO add a 'system' named constant to make intent
-- explicit in new code.
--
-- 00000000-0000-0000-0000-000000000000 is treated as a sentinel meaning
-- "system / no human actor". Future code can use the named system UUID
-- 00000000-0000-0000-0000-000000000001 for "internal service" actions
-- to distinguish from the legacy zero-UUID rows.
--
-- This migration does not change existing data; it just documents the
-- convention. The '00000000-0000-0000-0000-000000000001' UUID is reserved
-- and MUST NOT be assigned to any auth.users or profiles row.
set search_path = '';

comment on schema public is
  'Reserved system UUIDs: 00000000-0000-0000-0000-000000000000 = system/legacy sentinel; 00000000-0000-0000-0000-000000000001 = internal service actor. Both are NEVER assigned to auth.users or profiles; they appear only in audit-trail columns like decided_by, last_error_owner, actor_id.';

-- A view that documents the reserved UUIDs so callers can reference them
-- symbolically rather than hard-coding the all-zeros literal.
create or replace view public.system_actor_uuids as
select
  '00000000-0000-0000-0000-000000000000'::uuid as legacy_system_actor,
  '00000000-0000-0000-0000-000000000001'::uuid as internal_service_actor;

grant select on public.system_actor_uuids to authenticated, anon;

-- Add a soft CHECK constraint preventing either reserved UUID from
-- being assigned to a real user. The constraint is NOT VALID so it
-- doesn't run against historical data (which may already use the
-- legacy zero UUID in non-user contexts).
do $$ begin
  alter table public.profiles
    add constraint profiles_id_not_reserved_check
    check (id <> '00000000-0000-0000-0000-000000000000'::uuid and id <> '00000000-0000-0000-0000-000000000001'::uuid) not valid;
exception when duplicate_object then null;
end $$;
