-- 20260910000030_reconcile_community_tables.sql
-- Reconciliation: 20260908000010_communities_schema was never applied.
-- Migrations 20260908000011 through 20260908000014 created communities and
-- community_members via the RPCs that were marked applied, but the remaining
-- tables (bookmarks, post_reports, article_reports, community_moderation_actions)
-- from that schema file were never created. This migration creates ONLY the
-- missing tables idempotently (DO blocks guard each).
set search_path = '';

do $$
begin
  if not exists (select 1 from information_schema.tables where table_name = 'community_moderation_actions') then
    create table public.community_moderation_actions (
      id              uuid primary key default gen_random_uuid(),
      community_id    uuid not null references public.communities(id) on delete cascade,
      actor_id        uuid not null references public.profiles(id) on delete cascade,
      target_type     text not null check (target_type in ('post','thread','article','comment','member')),
      target_id       uuid not null,
      action          text not null check (action in ('pin','unpin','lock','unlock','remove','restore','hide','unhide','ban','unban','promote','demote')),
      reason          text check (reason is null or char_length(reason) <= 500),
      created_at      timestamptz not null default now()
    );
    create index if not exists idx_mod_actions_community on public.community_moderation_actions (community_id, created_at desc);
    create index if not exists idx_mod_actions_target on public.community_moderation_actions (target_type, target_id);
    alter table public.community_moderation_actions enable row level security;
    create policy mod_actions_mod_read
      on public.community_moderation_actions for select
      to authenticated
      using (
        exists (
          select 1 from public.community_members cm
          where cm.community_id = community_moderation_actions.community_id
            and cm.user_id = auth.uid()
            and cm.role in ('owner','moderator')
            and cm.status = 'active'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from information_schema.tables where table_name = 'bookmarks') then
    create table public.bookmarks (
      id              uuid primary key default gen_random_uuid(),
      user_id         uuid not null references public.profiles(id) on delete cascade,
      target_type     text not null check (target_type in ('post','article','thread')),
      target_id       uuid not null,
      created_at      timestamptz not null default now(),
      unique (user_id, target_type, target_id)
    );
    create index if not exists idx_bookmarks_user on public.bookmarks (user_id, created_at desc);
    create index if not exists idx_bookmarks_target on public.bookmarks (target_type, target_id);
    alter table public.bookmarks enable row level security;
    create policy bookmarks_owner_all
      on public.bookmarks for all
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (select 1 from information_schema.tables where table_name = 'post_reports') then
    create table public.post_reports (
      id              uuid primary key default gen_random_uuid(),
      post_id         uuid not null references public.posts(id) on delete cascade,
      reporter_id     uuid not null references public.profiles(id) on delete cascade,
      reason          text not null check (char_length(reason) between 1 and 500),
      status          text not null default 'pending' check (status in ('pending','reviewed','dismissed')),
      created_at      timestamptz not null default now(),
      unique (post_id, reporter_id)
    );
    create index if not exists idx_post_reports_status on public.post_reports (status, created_at desc);
    alter table public.post_reports enable row level security;
    create policy post_reports_owner_read on public.post_reports for select to authenticated using (reporter_id = auth.uid());
    create policy post_reports_owner_write on public.post_reports for insert to authenticated with check (reporter_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (select 1 from information_schema.tables where table_name = 'article_reports') then
    create table public.article_reports (
      id              uuid primary key default gen_random_uuid(),
      article_id      uuid not null references public.articles(id) on delete cascade,
      reporter_id     uuid not null references public.profiles(id) on delete cascade,
      reason          text not null check (char_length(reason) between 1 and 500),
      status          text not null default 'pending' check (status in ('pending','reviewed','dismissed')),
      created_at      timestamptz not null default now(),
      unique (article_id, reporter_id)
    );
    create index if not exists idx_article_reports_status on public.article_reports (status, created_at desc);
    alter table public.article_reports enable row level security;
    create policy article_reports_owner_read on public.article_reports for select to authenticated using (reporter_id = auth.uid());
    create policy article_reports_owner_write on public.article_reports for insert to authenticated with check (reporter_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'posts' and column_name = 'is_pinned') then
    alter table public.posts add column is_pinned boolean not null default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'posts' and column_name = 'pinned_at') then
    alter table public.posts add column pinned_at timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'posts' and column_name = 'is_locked') then
    alter table public.posts add column is_locked boolean not null default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'posts' and column_name = 'locked_at') then
    alter table public.posts add column locked_at timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'posts' and column_name = 'is_removed') then
    alter table public.posts add column is_removed boolean not null default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'posts' and column_name = 'removed_at') then
    alter table public.posts add column removed_at timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'reference_threads' and column_name = 'is_pinned') then
    alter table public.reference_threads add column is_pinned boolean not null default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'reference_threads' and column_name = 'pinned_at') then
    alter table public.reference_threads add column pinned_at timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'reference_threads' and column_name = 'is_locked') then
    alter table public.reference_threads add column is_locked boolean not null default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'reference_threads' and column_name = 'locked_at') then
    alter table public.reference_threads add column locked_at timestamptz;
  end if;
end $$;
