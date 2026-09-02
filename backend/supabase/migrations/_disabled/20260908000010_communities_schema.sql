-- 20260908000000_communities_schema.sql
-- Communities + membership + moderation + bookmarks + reports.
set search_path = '';

-- ─────────────────────────────────────────────────────────────────────
-- communities
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.communities (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (char_length(slug) between 2 and 60),
  name            text not null check (char_length(name) between 1 and 100),
  description     text check (description is null or char_length(description) <= 2000),
  visibility      text not null default 'public' check (visibility in ('public','private')),
  join_policy     text not null default 'open' check (join_policy in ('open','request','invite')),
  created_by      uuid not null references public.profiles(id) on delete cascade,
  archived_at     timestamptz,
  member_count    integer not null default 0,
  post_count      integer not null default 0,
  thread_count    integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_communities_visibility on public.communities (visibility) where archived_at is null;
create index if not exists idx_communities_created on public.communities (created_at desc) where archived_at is null;
create index if not exists idx_communities_created_by on public.communities (created_by);

alter table public.communities enable row level security;

-- Anon + authenticated can read public, non-archived communities
create policy communities_public_read
  on public.communities for select
  to anon, authenticated
  using (visibility = 'public' and archived_at is null);

-- Members can read their own private community
create policy communities_member_read
  on public.communities for select
  to authenticated
  using (
    visibility = 'private' and exists (
      select 1 from public.community_members cm
      where cm.community_id = communities.id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
    )
  );

-- Creator can always read their own community
create policy communities_creator_read
  on public.communities for select
  to authenticated
  using (created_by = auth.uid());

-- ─────────────────────────────────────────────────────────────────────
-- community_members
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.community_members (
  community_id    uuid not null references public.communities(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  role            text not null default 'member' check (role in ('member','moderator','owner')),
  status          text not null default 'active' check (status in ('active','pending','banned')),
  joined_at       timestamptz not null default now(),
  primary key (community_id, user_id)
);

create index if not exists idx_community_members_user on public.community_members (user_id, status);
create index if not exists idx_community_members_role on public.community_members (community_id, role);

alter table public.community_members enable row level security;

-- Users can see their own membership rows
create policy community_members_self_read
  on public.community_members for select
  to authenticated
  using (user_id = auth.uid());

-- Active members can see other active members of the same community
create policy community_members_visible_to_members
  on public.community_members for select
  to authenticated
  using (
    status = 'active' and exists (
      select 1 from public.community_members me
      where me.community_id = community_members.community_id
        and me.user_id = auth.uid()
        and me.status = 'active'
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- community_moderation_actions (audit log)
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.community_moderation_actions (
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

-- Mods/owners can read their own community's audit log
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

-- ─────────────────────────────────────────────────────────────────────
-- bookmarks
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.bookmarks (
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

-- ─────────────────────────────────────────────────────────────────────
-- reports (post + article — threads already have reference_thread_reports)
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.post_reports (
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

create table if not exists public.article_reports (
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

-- ─────────────────────────────────────────────────────────────────────
-- Add community_id FK to posts and reference_threads (was dangling)
-- Use ON DELETE SET NULL so community deletion doesn't cascade-remove content.
-- ─────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from information_schema.table_constraints where constraint_name = 'posts_community_fk' and table_name = 'posts') then
    if exists (select 1 from information_schema.columns where table_name = 'posts' and column_name = 'community_id') then
      alter table public.posts add constraint posts_community_fk foreign key (community_id) references public.communities(id) on delete set null;
    end if;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from information_schema.table_constraints where constraint_name = 'reference_threads_community_fk' and table_name = 'reference_threads') then
    if exists (select 1 from information_schema.columns where table_name = 'reference_threads' and column_name = 'community_id') then
      alter table public.reference_threads add constraint reference_threads_community_fk foreign key (community_id) references public.communities(id) on delete set null;
    end if;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────
-- updated_at triggers
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.set_communities_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

drop trigger if exists trg_communities_updated_at on public.communities;
create trigger trg_communities_updated_at
  before update on public.communities
  for each row execute function public.set_communities_updated_at();

-- Counter maintenance: increment/decrement member_count on membership changes
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
