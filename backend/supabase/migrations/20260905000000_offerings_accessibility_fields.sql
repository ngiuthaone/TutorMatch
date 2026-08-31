-- 20260905000000_offerings_accessibility_fields.sql
-- Adds three optional accessibility-related columns to public.offerings:
--   map_url            — URL pointing to a map / location view
--   minimum_age        — minimum age requirement for the event
--   accessibility_note — free-text field for accessibility info (wheelchair access, etc.)
--
-- All three columns are nullable and intentionally unconstrained: organizers
-- may not know these values at creation time and can update later.
set search_path = '';

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'offerings'
      and column_name  = 'map_url'
  ) then
    alter table public.offerings add column map_url text;
    comment on column public.offerings.map_url is
      'Optional URL to a map or location page (Google Maps, Notion, etc.)';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'offerings'
      and column_name  = 'minimum_age'
  ) then
    alter table public.offerings add column minimum_age integer
      constraint offerings_minimum_age_check check (minimum_age is null or minimum_age >= 0);
    comment on column public.offerings.minimum_age is
      'Minimum age to attend. NULL means no restriction.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'offerings'
      and column_name  = 'accessibility_note'
  ) then
    alter table public.offerings add column accessibility_note text;
    comment on column public.offerings.accessibility_note is
      'Free-text note about accessibility features (wheelchair access, quiet room, etc.)';
  end if;
end
$$;

-- These columns are intentionally writeable by any authenticated user who
-- can manage the offering (via the existing RPC authorization layer).
-- No new grants are needed; the RPC security definer pattern already covers them.
