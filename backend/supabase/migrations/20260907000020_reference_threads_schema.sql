-- 20260907000020_reference_threads_schema.sql
-- Reference threads: resource-centric conversations anchored to a shared reference.
-- MVP: courses, events, workshops, articles, tutor profiles, external URLs.
set search_path = '';

create table if not exists public.reference_threads (
  id              uuid primary key default gen_random_uuid(),
  creator_id      uuid not null references public.profiles(id) on delete cascade,
  title           text not null check (char_length(title) between 1 and 200),
  body            text check (body is null or char_length(body) <= 2000),
  anchor_type     text not null check (anchor_type in ('course','event','workshop','article','tutor_profile','external_url')),
  anchor_id       uuid null,
  anchor_url      text null check (anchor_url is null or char_length(anchor_url) <= 2048),
  anchor_title    text null check (anchor_title is null or char_length(anchor_title) <= 500),
  anchor_domain   text null check (anchor_domain is null or char_length(anchor_domain) <= 255),
  tags            text[] not null default '{}',
  level           text check (level in ('complete_beginner','beginner','intermediate','advanced','all_levels')),
  visibility      text not null default 'public' check (visibility in ('public','community')),
  community_id    uuid null,
  status          text not null default 'published' check (status in ('published','closed','deleted','removed')),
  reply_permission text not null default 'everyone' check (reply_permission in ('everyone','community_members','disabled')),
  appreciated_count integer not null default 0,
  reply_count     integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Anchor must be either an internal entity id or an external URL
  check (
    (anchor_id is not null and anchor_url is null and anchor_type <> 'external_url') or
    (anchor_url is not null and anchor_id is null and anchor_type = 'external_url')
  )
);

create index if not exists idx_threads_status_created on public.reference_threads (status, created_at desc);
create index if not exists idx_threads_creator on public.reference_threads (creator_id);
create index if not exists idx_threads_tags on public.reference_threads using gin (tags);
create index if not exists idx_threads_anchor on public.reference_threads (anchor_type, anchor_id);
create index if not exists idx_threads_community on public.reference_threads (community_id);

alter table public.reference_threads enable row level security;

-- Public read: published, non-deleted
create policy threads_public_read
  on public.reference_threads for select
  to anon, authenticated
  using (status = 'published' or status = 'closed');

-- Creator can read/write own threads (including drafts/closed)
create policy threads_creator_all
  on public.reference_threads for all
  to authenticated
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid());

-- Replies
create table if not exists public.reference_thread_replies (
  id              uuid primary key default gen_random_uuid(),
  thread_id       uuid not null references public.reference_threads(id) on delete cascade,
  parent_id       uuid null references public.reference_thread_replies(id) on delete cascade,
  creator_id      uuid not null references public.profiles(id) on delete cascade,
  body            text not null check (char_length(body) between 1 and 2000),
  status          text not null default 'published' check (status in ('published','deleted','removed')),
  appreciated_count integer not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists idx_thread_replies_thread on public.reference_thread_replies (thread_id, created_at);
create index if not exists idx_thread_replies_parent on public.reference_thread_replies (parent_id);

alter table public.reference_thread_replies enable row level security;

create policy thread_replies_public_read
  on public.reference_thread_replies for select
  to anon, authenticated
  using (status = 'published');

create policy thread_replies_creator_all
  on public.reference_thread_replies for all
  to authenticated
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid());

-- Appreciations (upvote-only)
create table if not exists public.reference_thread_appreciations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  target_type     text not null check (target_type in ('thread','reply')),
  target_id       uuid not null,
  created_at      timestamptz not null default now(),
  unique (target_type, target_id, user_id)
);

create index if not exists idx_thread_appreciations_target on public.reference_thread_appreciations (target_type, target_id);
create index if not exists idx_thread_appreciations_user on public.reference_thread_appreciations (user_id);

alter table public.reference_thread_appreciations enable row level security;

-- Only the recipient can see who appreciated (or authenticated users for aggregate counts via RPCs)
-- We allow authenticated read for "did I appreciate this" checks
create policy thread_appreciations_authenticated_read
  on public.reference_thread_appreciations for select
  to authenticated
  using (true);

create policy thread_appreciations_user_write
  on public.reference_thread_appreciations for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Reports
create table if not exists public.reference_thread_reports (
  id              uuid primary key default gen_random_uuid(),
  target_type     text not null check (target_type in ('thread','reply','comment')),
  target_id       uuid not null,
  reporter_id     uuid not null references public.profiles(id) on delete cascade,
  reason          text not null check (char_length(reason) between 1 and 500),
  status          text not null default 'pending' check (status in ('pending','reviewed','dismissed')),
  created_at      timestamptz not null default now(),
  unique (target_id, reporter_id)
);

create index if not exists idx_thread_reports_target on public.reference_thread_reports (target_type, target_id);

alter table public.reference_thread_reports enable row level security;

-- Only the reporter can see their own reports (privacy)
create policy thread_reports_reporter_read
  on public.reference_thread_reports for select
  to authenticated
  using (reporter_id = auth.uid());

create policy thread_reports_reporter_write
  on public.reference_thread_reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

-- updated_at trigger for threads
create or replace function public.set_threads_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists trg_reference_threads_updated_at on public.reference_threads;
create trigger trg_reference_threads_updated_at
  before update on public.reference_threads
  for each row execute function public.set_threads_updated_at();
