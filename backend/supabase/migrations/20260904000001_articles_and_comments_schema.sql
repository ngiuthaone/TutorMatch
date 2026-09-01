-- 20260904000001_articles_and_comments_schema.sql
-- Adds the base tables for the article + comments surfaces.
-- The RPCs in 20260904000002_article_rpcs.sql and 20260904000003_comment_rpcs.sql
-- assume these tables exist with the columns/types/constraints below.
--
-- Contract: docs/REFERENCE_THREADS_PROMPT.md (Security-definer RPCs — Articles, Comments).
set search_path = '';

-- ─────────────────────────────────────────────────────────────────────
-- public.articles
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  slug text not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  subtitle text,
  excerpt text check (excerpt is null or char_length(excerpt) <= 500),
  cover_image_url text check (cover_image_url is null or cover_image_url ~ '^https://[^\s]+$'),
  cover_image_alt text,
  content_html text not null default '',
  content_json jsonb not null default '{}'::jsonb check (jsonb_typeof(content_json) = 'object'),
  tags text[] not null default '{}',
  level text,
  estimated_reading_minutes integer not null default 1 check (estimated_reading_minutes > 0),
  comments_enabled boolean not null default true,
  status text not null default 'draft' check (status in ('draft','published','deleted')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create index if not exists articles_author_id_idx on public.articles(author_id);
create index if not exists articles_published_at_idx on public.articles(published_at) where status = 'published';
create unique index if not exists articles_published_slug_unique
  on public.articles(slug) where status = 'published';

alter table public.articles enable row level security;

drop policy if exists articles_author_all on public.articles;
create policy articles_author_all on public.articles
  for all to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists articles_public_read on public.articles;
create policy articles_public_read on public.articles
  for select to anon, authenticated
  using (status = 'published');

-- updated_at auto-update trigger
create or replace function public.set_articles_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;

revoke all on function public.set_articles_updated_at() from public, anon, authenticated;

drop trigger if exists set_articles_updated_at on public.articles;
create trigger set_articles_updated_at before update on public.articles
for each row execute function public.set_articles_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- public.comments
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.comments(id) on delete cascade,
  owner_type text not null check (owner_type in ('article','post')),
  owner_id uuid not null,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  status text not null default 'published' check (status in ('published','deleted')),
  appreciated_count integer not null default 0 check (appreciated_count >= 0),
  created_at timestamptz not null default now()
);

create index if not exists comments_owner_idx on public.comments(owner_type, owner_id);
create index if not exists comments_parent_idx on public.comments(parent_id);
create index if not exists comments_creator_idx on public.comments(creator_id);

alter table public.comments enable row level security;

drop policy if exists comments_public_read on public.comments;
create policy comments_public_read on public.comments
  for select to anon, authenticated
  using (status = 'published');

drop policy if exists comments_creator_write on public.comments;
create policy comments_creator_write on public.comments
  for all to authenticated
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid());
