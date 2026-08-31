-- 20260904000000_threads_articles_comments_schema.sql
-- Production schema for reference threads, article publishing, and the shared
-- comment table. All tables are RLS-enabled and closed by default (no direct
-- client access); every mutation and public read goes through security-definer
-- RPCs defined in the companion RPC migration.
--
-- Surfaces: reference threads, article publishing, shared comments.
-- Contract: docs/REFERENCE_THREADS_PROMPT.md (database schema section).
set search_path = '';

-- ─────────────────────────────────────────────────────────────────────
-- 1. reference_threads
-- ─────────────────────────────────────────────────────────────────────
create table public.reference_threads (
  id              uuid primary key default gen_random_uuid(),
  creator_id      uuid not null references public.profiles(id),
  title           text not null check (char_length(title) between 1 and 200),
  body            text check (body is null or char_length(body) <= 2000),
  anchor_type     text not null check (anchor_type in ('course','event','workshop','article','tutor_profile','external_url')),
  anchor_id       uuid null,
  anchor_url      text null,
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
  updated_at      timestamptz not null default now()
);

alter table public.reference_threads enable row level security;
revoke all on table public.reference_threads from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 2. reference_thread_replies (max depth 3, enforced in RPC)
-- ─────────────────────────────────────────────────────────────────────
create table public.reference_thread_replies (
  id              uuid primary key default gen_random_uuid(),
  thread_id       uuid not null references public.reference_threads(id) on delete cascade,
  parent_id       uuid null references public.reference_thread_replies(id) on delete cascade,
  creator_id      uuid not null references public.profiles(id),
  body            text not null check (char_length(body) between 1 and 2000),
  status          text not null default 'published' check (status in ('published','deleted','removed')),
  appreciated_count integer not null default 0,
  created_at      timestamptz not null default now()
);

alter table public.reference_thread_replies enable row level security;
revoke all on table public.reference_thread_replies from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 3. reference_thread_appreciations (upvote-only, no downvote)
-- ─────────────────────────────────────────────────────────────────────
create table public.reference_thread_appreciations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id),
  target_type     text not null check (target_type in ('thread','reply')),
  target_id       uuid not null,
  created_at      timestamptz not null default now(),
  unique (target_type, target_id, user_id)
);

alter table public.reference_thread_appreciations enable row level security;
revoke all on table public.reference_thread_appreciations from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 4. reference_thread_reports (reporter identity hidden)
-- ─────────────────────────────────────────────────────────────────────
create table public.reference_thread_reports (
  id              uuid primary key default gen_random_uuid(),
  target_type     text not null check (target_type in ('thread','reply')),
  target_id       uuid not null,
  reporter_id     uuid not null references public.profiles(id),
  reason          text not null check (char_length(reason) between 1 and 500),
  status          text not null default 'pending' check (status in ('pending','reviewed','dismissed')),
  created_at      timestamptz not null default now(),
  unique (target_id, reporter_id)
);

alter table public.reference_thread_reports enable row level security;
revoke all on table public.reference_thread_reports from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 5. articles (production article publishing)
-- ─────────────────────────────────────────────────────────────────────
create table public.articles (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid not null references public.profiles(id),
  slug            text not null unique,
  title           text not null check (char_length(title) between 1 and 200),
  subtitle        text,
  excerpt         text check (excerpt is null or char_length(excerpt) <= 500),
  cover_image_url text,
  cover_image_alt text,
  content_html    text not null,
  content_json    jsonb not null,
  tags            text[] not null default '{}',
  level           text check (level in ('complete_beginner','beginner','intermediate','advanced','all_levels')),
  estimated_reading_minutes integer not null default 1,
  comments_enabled boolean not null default true,
  status          text not null default 'draft' check (status in ('draft','published','deleted','removed')),
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.articles enable row level security;
revoke all on table public.articles from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 6. comments (shared between threads and articles)
-- ─────────────────────────────────────────────────────────────────────
create table public.comments (
  id              uuid primary key default gen_random_uuid(),
  parent_id       uuid null references public.comments(id) on delete cascade,
  owner_type      text not null check (owner_type in ('thread','article')),
  owner_id        uuid not null,
  creator_id      uuid not null references public.profiles(id),
  body            text not null check (char_length(body) between 1 and 2000),
  status          text not null default 'published' check (status in ('published','deleted','removed')),
  appreciated_count integer not null default 0,
  created_at      timestamptz not null default now()
);

alter table public.comments enable row level security;
revoke all on table public.comments from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────
create index idx_threads_status_created on public.reference_threads (status, created_at desc);
create index idx_threads_creator on public.reference_threads (creator_id);
create index idx_threads_tags on public.reference_threads using gin (tags);
create index idx_threads_anchor on public.reference_threads (anchor_type, anchor_id);
create index idx_thread_replies_thread on public.reference_thread_replies (thread_id, created_at);
create index idx_thread_replies_parent on public.reference_thread_replies (parent_id);
create index idx_thread_reports_target on public.reference_thread_reports (target_type, target_id);
create index idx_articles_slug on public.articles (slug);
create index idx_articles_author on public.articles (author_id);
create index idx_articles_status_published on public.articles (status, published_at desc);
create index idx_comments_owner on public.comments (owner_type, owner_id, created_at);
create index idx_comments_parent on public.comments (parent_id);

-- ─────────────────────────────────────────────────────────────────────
-- Updated_at triggers
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.set_threads_updated_at()
returns trigger as $$ begin new.updated_at = now(); return new; end; $$ language plpgsql;

create trigger trg_reference_threads_updated_at
  before update on public.reference_threads
  for each row execute function public.set_threads_updated_at();

create or replace function public.set_articles_updated_at()
returns trigger as $$ begin new.updated_at = now(); return new; end; $$ language plpgsql;

create trigger trg_articles_updated_at
  before update on public.articles
  for each row execute function public.set_articles_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- Identity strip helper (defense-in-depth for public read RPCs)
-- ─────────────────────────────────────────────────────────────────────
create or replace function public._community_content_strip_keys()
returns text[] language sql immutable as $$
  select array[
    'creatorId', 'creatorEmail', 'hostEmail', 'hostId', 'authId', 'creatorUserId',
    'authorId', 'authorEmail',
    'creator_id', 'creator_email', 'host_email', 'host_id', 'auth_id', 'creator',
    'author_id', 'author_email',
    'phone', 'phoneNumber', 'contactPhone', 'hostPhone',
    'hostName', 'hostNameOverride'
  ];
$$;
