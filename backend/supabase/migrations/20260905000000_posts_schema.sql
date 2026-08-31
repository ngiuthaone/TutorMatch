-- 20260905000000_posts_schema.sql
-- Posts table and reposts table for short-form discussion content.
-- Simpler than articles: no slug, no cover, plain text body.
set search_path = '';

create table if not exists public.posts (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid not null references public.profiles(id) on delete cascade,
  body            text not null,
  tags            text[] not null default '{}',
  level           text,
  post_type       text,
  reply_permission text not null default 'everyone',
  community_id    uuid,
  status          text not null default 'draft' check (status in ('draft','published','deleted')),
  repost_count    integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_posts_status_created on public.posts (status, created_at desc);
create index idx_posts_author on public.posts (author_id);
create index idx_posts_tags on public.posts using gin (tags);
create index idx_posts_community on public.posts (community_id);

alter table public.posts enable row level security;

-- RLS: public can read published posts
create policy "posts_public_read"
  on public.posts for select
  to public
  using (status = 'published');

-- RLS: author can read/write own posts
create policy "posts_author_write"
  on public.posts for all
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

-- Reposts table
create table if not exists public.post_reposts (
  id              uuid primary key default gen_random_uuid(),
  post_id         uuid not null references public.posts(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (post_id, user_id)
);

create index idx_post_reposts_post on public.post_reposts (post_id);
create index idx_post_reposts_user on public.post_reposts (user_id);

alter table public.post_reposts enable row level security;

create policy "post_reposts_public_read"
  on public.post_reposts for select
  to public
  using (true);

create policy "post_reposts_user_write"
  on public.post_reposts for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Comment appreciations table (replaces reference_thread_appreciations for comments)
create table if not exists public.comment_appreciations (
  id              uuid primary key default gen_random_uuid(),
  comment_id      uuid not null references public.comments(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (comment_id, user_id)
);

create index idx_comment_appreciations_comment on public.comment_appreciations (comment_id);
create index idx_comment_appreciations_user on public.comment_appreciations (user_id);

alter table public.comment_appreciations enable row level security;

create policy "comment_appreciations_public_read"
  on public.comment_appreciations for select
  to public
  using (true);

create policy "comment_appreciations_user_write"
  on public.comment_appreciations for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- updated_at trigger
create or replace function public.set_posts_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_posts_updated_at on public.posts;
create trigger trg_posts_updated_at
  before update on public.posts
  for each row execute function public.set_posts_updated_at();
