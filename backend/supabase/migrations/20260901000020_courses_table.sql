-- 20260901000020_courses_table.sql
-- Creates the public.courses table as the authoritative source for course data.
-- marketplace_listings is a synced read projection (Phase 2 architecture).
set search_path = '';

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  cover_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'unpublished')),
  version integer not null default 1 check (version >= 1),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists courses_creator_idx on public.courses(creator_id);
create index if not exists courses_status_idx on public.courses(status) where status = 'published';

alter table public.courses enable row level security;

revoke all on table public.courses from public, anon, authenticated;

-- Public read: published courses
drop policy if exists courses_public_read on public.courses;
create policy courses_public_read on public.courses
  for select to anon, authenticated
  using (status = 'published' or creator_id = auth.uid());

-- Authenticated users can create courses (creator_id must match auth.uid())
drop policy if exists courses_auth_insert on public.courses;
create policy courses_auth_insert on public.courses
  for insert to authenticated
  with check (creator_id = auth.uid());

-- Only creator can update
drop policy if exists courses_owner_update on public.courses;
create policy courses_owner_update on public.courses
  for update to authenticated
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid());

-- Only creator can delete
drop policy if exists courses_owner_delete on public.courses;
create policy courses_owner_delete on public.courses
  for delete to authenticated
  using (creator_id = auth.uid());

-- updated_at trigger function
create or replace function public.set_course_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

revoke all on function public.set_course_updated_at() from public, anon, authenticated;

drop trigger if exists courses_set_updated_at on public.courses;
create trigger courses_set_updated_at
  before update on public.courses
  for each row execute function public.set_course_updated_at();
