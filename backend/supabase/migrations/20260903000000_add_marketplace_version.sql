-- 20260902000000_add_marketplace_version.sql
-- Adds an optimistic-concurrency version column to marketplace_listings so the
-- PATCH route can enforce compare-and-swap (CAS) updates and unpublish can
-- transition atomically. The 0003 migration stays untouched (already applied).
set search_path = '';

alter table public.marketplace_listings
  add column if not exists version bigint not null default 1;

-- Ensure the default descriptor reflects version so new rows start at 1 even
-- if the column is om-named; this is a safety no-op when the default already
-- exists.
create or replace function public._marketplace_set_version_1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.version is null then new.version := 1; end if;
  return new;
end $$;

drop trigger if exists trg_marketplace_listings_default_version on public.marketplace_listings;

create trigger trg_marketplace_listings_default_version
before insert on public.marketplace_listings
for each row execute function public._marketplace_set_version_1();
