-- 20260906000000_follows_schema.sql
-- Follow/follower system for users.
set search_path = '';

create table if not exists public.follows (
  id              uuid primary key default gen_random_uuid(),
  follower_id     uuid not null references public.profiles(id) on delete cascade,
  followee_id     uuid not null references public.profiles(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (follower_id, followee_id)
);

create index idx_follows_follower on public.follows (follower_id);
create index idx_follows_followee on public.follows (followee_id);

alter table public.follows enable row level security;

create policy "follows_public_read"
  on public.follows for select
  to public
  using (true);

create policy "follows_user_write"
  on public.follows for all
  to authenticated
  using (follower_id = auth.uid())
  with check (follower_id = auth.uid());
