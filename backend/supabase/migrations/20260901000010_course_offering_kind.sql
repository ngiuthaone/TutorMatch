-- 20260901000010_course_offering_kind.sql
-- Adds 'course' to public.offerings.kind CHECK constraint.
-- The existing constraint is auto-named (e.g. offerings_kind_check).
-- Uses DO $$ block for idempotent constraint replacement.
set search_path = '';

do $$
declare
  constraint_name text;
begin
  -- Find the auto-generated constraint name for offerings.kind check
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.offerings'::regclass
    and contype = 'c'
    and conkey = array[
      (select attnum from pg_attribute where attrelid = 'public.offerings'::regclass and attname = 'kind')
    ]
  limit 1;

  -- If found, drop and replace with updated constraint
  if constraint_name is not null then
    execute format('alter table public.offerings drop constraint %I', constraint_name);
  end if;

  alter table public.offerings
    add constraint offerings_kind_check
    check (kind in ('tutor', 'workshop', 'class', 'event', 'course'));
end $$;
