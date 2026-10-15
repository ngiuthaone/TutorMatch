-- Restore missing `communities` counter/archive columns.
--
-- The original communities schema migration (20260908000010_communities_schema.sql)
-- was disabled/moved to _disabled/, leaving public.communities as a stub without
-- post_count / thread_count / member_count / archived_at. Active RPCs
-- (20260908000011_community_rpcs, 20260908000013_community_security_fixes,
-- 20260910000050_search_rpcs) and the sync_community_*_count triggers reference
-- these columns, so those code paths currently fail with 42703.
--
-- This migration restores the missing columns idempotently. The sync trigger
-- functions already exist (defined in 20260908000013); we additionally restore
-- the member-count and updated_at triggers that lived in the disabled schema.

set search_path = '';

alter table public.communities
  add column if not exists archived_at   timestamptz,
  add column if not exists member_count  integer not null default 0,
  add column if not exists post_count    integer not null default 0,
  add column if not exists thread_count  integer not null default 0;

-- indexes that the disabled schema created (idempotent)
create index if not exists idx_communities_visibility
  on public.communities (visibility) where archived_at is null;
create index if not exists idx_communities_created
  on public.communities (created_at desc) where archived_at is null;

-- updated_at maintenance (restored from disabled schema)
create or replace function public.set_communities_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

drop trigger if exists trg_communities_updated_at on public.communities;
create trigger trg_communities_updated_at
  before update on public.communities
  for each row execute function public.set_communities_updated_at();

-- member_count maintenance on membership changes (restored from disabled schema)
create or replace function public.sync_community_member_count()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if (TG_OP = 'INSERT' and new.status = 'active') then
    update public.communities set member_count = member_count + 1 where id = new.community_id;
  elsif (TG_OP = 'DELETE' and old.status = 'active') then
    update public.communities set member_count = greatest(member_count - 1, 0) where id = old.community_id;
  elsif (TG_OP = 'UPDATE' and old.status <> new.status) then
    if new.status = 'active' then
      update public.communities set member_count = member_count + 1 where id = new.community_id;
    elsif old.status = 'active' then
      update public.communities set member_count = greatest(member_count - 1, 0) where id = new.community_id;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_community_member_count on public.community_members;
create trigger trg_community_member_count
  after insert or update or delete on public.community_members
  for each row execute function public.sync_community_member_count();