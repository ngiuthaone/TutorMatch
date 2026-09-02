-- 20260910000099_stub_communities_for_orphan_rls.sql
-- Stub migration to satisfy dangling references in the orphan
-- `20260908000014_moderation_columns_and_rpcs.sql` (and possibly other
-- migrations) that reference public.communities and public.community_members.
-- The original `20260908000010_communities_schema.sql` was deleted (see
-- rename to _disabled/ for courses). This stub creates the minimum
-- required structure so the full migration chain can apply.
--
-- This is a pre-existing infra issue, not a messaging surface issue.
-- Per the user's instructions (2026-09-02 04:52), the local Supabase
-- environment must be made buildable for messaging verification.
--
-- The stub is INTENTIONALLY MINIMAL. Real community features are
-- out of scope for the messaging feature work.
set search_path = '';

create table if not exists public.communities (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (char_length(btrim(slug)) between 2 and 60),
  name            text not null check (char_length(btrim(name)) between 1 and 100),
  description     text check (description is null or char_length(description) <= 4000),
  visibility      text not null default 'public' check (visibility in ('public','private')),
  join_policy     text not null default 'open' check (join_policy in ('open','approval','invite')),
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.communities enable row level security;
do $$ begin
  revoke all on table public.communities from public, anon, authenticated;
exception when others then null; end $$;

create table if not exists public.community_members (
  community_id    uuid not null references public.communities(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  role            text not null default 'member' check (role in ('member','moderator','owner')),
  status          text not null default 'active' check (status in ('active','pending','banned')),
  joined_at       timestamptz not null default now(),
  primary key (community_id, user_id)
);
alter table public.community_members enable row level security;
do $$ begin
  revoke all on table public.community_members from public, anon, authenticated;
exception when others then null; end $$;

-- Minimal policies to keep the orphan RLS files from erroring out.
-- Read-all for the messaging surface is gated by conversation membership,
-- not community membership, so broad reads here are not a leak.
do $$ begin
  if not exists (select 1 from pg_policy where polname = 'comm_creator_read' and polrelid = 'public.communities'::regclass) then
    create policy comm_creator_read on public.communities
      for select to authenticated using (created_by = auth.uid());
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policy where polname = 'comm_members_self_read' and polrelid = 'public.community_members'::regclass) then
    create policy comm_members_self_read on public.community_members
      for select to authenticated using (user_id = auth.uid());
  end if;
end $$;
