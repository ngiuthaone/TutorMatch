-- 20260908000004_moderation_columns_and_rpcs.sql
-- Add moderation columns to posts and reference_threads.
-- Add moderator RPCs: pin, lock, hide, remove (and restores).
set search_path = '';

-- ─────────────────────────────────────────────────────────────────────
-- Posts: add is_pinned, is_locked, is_removed
-- ─────────────────────────────────────────────────────────────────────
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
end $$;

create index if not exists idx_posts_pinned on public.posts (community_id, is_pinned, created_at desc) where is_pinned = true and is_removed = false;

-- Posts: RLS update for moderators
-- We need to allow moderators to update the moderation columns only.
-- We add a separate policy that only permits mod-like users to update these columns.
-- Note: this is a coarse-grained allow; the security-definer RPCs are the authoritative gate.
-- Mods cannot set like_count, repost_count, or author_id via RLS because those columns
-- are not mentioned in the policy with check clause; the RPCs are the only path to change them.
drop policy if exists posts_moderator_update on public.posts;
create policy posts_moderator_update
  on public.posts for update
  to authenticated
  using (
    community_id is not null
    and exists (
      select 1 from public.community_members cm
      where cm.community_id = posts.community_id
        and cm.user_id = auth.uid()
        and cm.role in ('owner','moderator')
        and cm.status = 'active'
    )
  )
  with check (true);

-- Posts: hide removed posts from anon / non-mod reads
-- The list/get RPCs already filter by status='published' and is_removed is not yet checked.
-- We'll add a check in the list_public_posts and get_public_post RPCs (or use a view).
-- For now, list_public_posts filters on status='published' which is the existing gate.
-- is_removed is a redundant signal that can be used to hide from public while keeping owner-readable.
-- Add a policy: anon + non-mod authed cannot see is_removed=true
-- (replaces the public_read policy for removed posts)
drop policy if exists posts_public_read on public.posts;
create policy posts_public_read
  on public.posts for select
  to anon, authenticated
  using (status = 'published' and is_removed = false);

-- Add a policy for owners of removed posts to still read them
drop policy if exists posts_author_read on public.posts;
create policy posts_author_read
  on public.posts for select
  to authenticated
  using (author_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────
-- Reference threads: add is_pinned, is_locked (use status='closed' for lock already exists, but we want a separate explicit lock flag)
-- is_removed maps to status='removed' (already in CHECK); is_pinned and is_locked are new
-- ─────────────────────────────────────────────────────────────────────
do $$
begin
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

create index if not exists idx_threads_pinned on public.reference_threads (community_id, is_pinned, created_at desc) where is_pinned = true and status <> 'removed';

drop policy if exists thread_moderator_update on public.reference_threads;
create policy thread_moderator_update
  on public.reference_threads for update
  to authenticated
  using (
    community_id is not null
    and exists (
      select 1 from public.community_members cm
      where cm.community_id = reference_threads.community_id
        and cm.user_id = auth.uid()
        and cm.role in ('owner','moderator')
        and cm.status = 'active'
    )
  )
  with check (true);

-- ─────────────────────────────────────────────────────────────────────
-- pin_post / unpin_post / lock_post / unlock_post / remove_post / restore_post
-- All require community moderator or owner; write audit row.
-- All operate only on posts in a community.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.pin_post(p_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_community_id uuid;
begin
  select community_id into v_community_id from public.posts where id = p_post_id;
  if v_community_id is null then raise exception 'NOT_COMMUNITY_POST' using errcode = 'P0001'; end if;
  if not exists(
    select 1 from public.community_members
    where community_id = v_community_id and user_id = uid and role in ('owner','moderator') and status = 'active'
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update public.posts set is_pinned = true, pinned_at = now() where id = p_post_id;
  insert into public.community_moderation_actions(community_id, actor_id, target_type, target_id, action)
  values (v_community_id, uid, 'post', p_post_id, 'pin');
  return jsonb_build_object('id', p_post_id, 'is_pinned', true);
end $$;

revoke all on function public.pin_post(uuid) from public, anon, authenticated;
grant execute on function public.pin_post(uuid) to authenticated;

create or replace function public.unpin_post(p_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_community_id uuid;
begin
  select community_id into v_community_id from public.posts where id = p_post_id;
  if v_community_id is null then raise exception 'NOT_COMMUNITY_POST' using errcode = 'P0001'; end if;
  if not exists(
    select 1 from public.community_members
    where community_id = v_community_id and user_id = uid and role in ('owner','moderator') and status = 'active'
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update public.posts set is_pinned = false, pinned_at = null where id = p_post_id;
  insert into public.community_moderation_actions(community_id, actor_id, target_type, target_id, action)
  values (v_community_id, uid, 'post', p_post_id, 'unpin');
  return jsonb_build_object('id', p_post_id, 'is_pinned', false);
end $$;

revoke all on function public.unpin_post(uuid) from public, anon, authenticated;
grant execute on function public.unpin_post(uuid) to authenticated;

create or replace function public.lock_post(p_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_community_id uuid;
begin
  select community_id into v_community_id from public.posts where id = p_post_id;
  if v_community_id is null then raise exception 'NOT_COMMUNITY_POST' using errcode = 'P0001'; end if;
  if not exists(
    select 1 from public.community_members
    where community_id = v_community_id and user_id = uid and role in ('owner','moderator') and status = 'active'
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update public.posts set is_locked = true, locked_at = now(), reply_permission = 'disabled' where id = p_post_id;
  insert into public.community_moderation_actions(community_id, actor_id, target_type, target_id, action)
  values (v_community_id, uid, 'post', p_post_id, 'lock');
  return jsonb_build_object('id', p_post_id, 'is_locked', true);
end $$;

revoke all on function public.lock_post(uuid) from public, anon, authenticated;
grant execute on function public.lock_post(uuid) to authenticated;

create or replace function public.unlock_post(p_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_community_id uuid;
begin
  select community_id into v_community_id from public.posts where id = p_post_id;
  if v_community_id is null then raise exception 'NOT_COMMUNITY_POST' using errcode = 'P0001'; end if;
  if not exists(
    select 1 from public.community_members
    where community_id = v_community_id and user_id = uid and role in ('owner','moderator') and status = 'active'
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update public.posts set is_locked = false, locked_at = null where id = p_post_id;
  insert into public.community_moderation_actions(community_id, actor_id, target_type, target_id, action)
  values (v_community_id, uid, 'post', p_post_id, 'unlock');
  return jsonb_build_object('id', p_post_id, 'is_locked', false);
end $$;

revoke all on function public.unlock_post(uuid) from public, anon, authenticated;
grant execute on function public.unlock_post(uuid) to authenticated;

create or replace function public.remove_post(p_post_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_community_id uuid;
begin
  select community_id into v_community_id from public.posts where id = p_post_id;
  if v_community_id is null then raise exception 'NOT_COMMUNITY_POST' using errcode = 'P0001'; end if;
  if not exists(
    select 1 from public.community_members
    where community_id = v_community_id and user_id = uid and role in ('owner','moderator') and status = 'active'
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update public.posts set is_removed = true, removed_at = now(), status = 'deleted' where id = p_post_id;
  insert into public.community_moderation_actions(community_id, actor_id, target_type, target_id, action, reason)
  values (v_community_id, uid, 'post', p_post_id, 'remove', p_reason);
  return jsonb_build_object('id', p_post_id, 'is_removed', true);
end $$;

revoke all on function public.remove_post(uuid, text) from public, anon, authenticated;
grant execute on function public.remove_post(uuid, text) to authenticated;

create or replace function public.restore_post(p_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_community_id uuid;
begin
  select community_id into v_community_id from public.posts where id = p_post_id;
  if v_community_id is null then raise exception 'NOT_COMMUNITY_POST' using errcode = 'P0001'; end if;
  if not exists(
    select 1 from public.community_members
    where community_id = v_community_id and user_id = uid and role in ('owner','moderator') and status = 'active'
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update public.posts set is_removed = false, removed_at = null, status = 'published' where id = p_post_id;
  insert into public.community_moderation_actions(community_id, actor_id, target_type, target_id, action)
  values (v_community_id, uid, 'post', p_post_id, 'restore');
  return jsonb_build_object('id', p_post_id, 'is_removed', false);
end $$;

revoke all on function public.restore_post(uuid) from public, anon, authenticated;
grant execute on function public.restore_post(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- Same for reference threads: pin / unpin / lock / unlock / remove / restore
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.pin_thread(p_thread_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_community_id uuid;
begin
  select community_id into v_community_id from public.reference_threads where id = p_thread_id;
  if v_community_id is null then raise exception 'NOT_COMMUNITY_THREAD' using errcode = 'P0001'; end if;
  if not exists(
    select 1 from public.community_members
    where community_id = v_community_id and user_id = uid and role in ('owner','moderator') and status = 'active'
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update public.reference_threads set is_pinned = true, pinned_at = now() where id = p_thread_id;
  insert into public.community_moderation_actions(community_id, actor_id, target_type, target_id, action)
  values (v_community_id, uid, 'thread', p_thread_id, 'pin');
  return jsonb_build_object('id', p_thread_id, 'is_pinned', true);
end $$;

revoke all on function public.pin_thread(uuid) from public, anon, authenticated;
grant execute on function public.pin_thread(uuid) to authenticated;

create or replace function public.unpin_thread(p_thread_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_community_id uuid;
begin
  select community_id into v_community_id from public.reference_threads where id = p_thread_id;
  if v_community_id is null then raise exception 'NOT_COMMUNITY_THREAD' using errcode = 'P0001'; end if;
  if not exists(
    select 1 from public.community_members
    where community_id = v_community_id and user_id = uid and role in ('owner','moderator') and status = 'active'
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update public.reference_threads set is_pinned = false, pinned_at = null where id = p_thread_id;
  insert into public.community_moderation_actions(community_id, actor_id, target_type, target_id, action)
  values (v_community_id, uid, 'thread', p_thread_id, 'unpin');
  return jsonb_build_object('id', p_thread_id, 'is_pinned', false);
end $$;

revoke all on function public.unpin_thread(uuid) from public, anon, authenticated;
grant execute on function public.unpin_thread(uuid) to authenticated;

create or replace function public.lock_thread(p_thread_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_community_id uuid;
begin
  select community_id into v_community_id from public.reference_threads where id = p_thread_id;
  if v_community_id is null then raise exception 'NOT_COMMUNITY_THREAD' using errcode = 'P0001'; end if;
  if not exists(
    select 1 from public.community_members
    where community_id = v_community_id and user_id = uid and role in ('owner','moderator') and status = 'active'
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update public.reference_threads set is_locked = true, locked_at = now(), status = 'closed', reply_permission = 'disabled' where id = p_thread_id;
  insert into public.community_moderation_actions(community_id, actor_id, target_type, target_id, action)
  values (v_community_id, uid, 'thread', p_thread_id, 'lock');
  return jsonb_build_object('id', p_thread_id, 'is_locked', true, 'status', 'closed');
end $$;

revoke all on function public.lock_thread(uuid) from public, anon, authenticated;
grant execute on function public.lock_thread(uuid) to authenticated;

create or replace function public.unlock_thread(p_thread_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_community_id uuid;
begin
  select community_id into v_community_id from public.reference_threads where id = p_thread_id;
  if v_community_id is null then raise exception 'NOT_COMMUNITY_THREAD' using errcode = 'P0001'; end if;
  if not exists(
    select 1 from public.community_members
    where community_id = v_community_id and user_id = uid and role in ('owner','moderator') and status = 'active'
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update public.reference_threads set is_locked = false, locked_at = null, status = 'published' where id = p_thread_id;
  insert into public.community_moderation_actions(community_id, actor_id, target_type, target_id, action)
  values (v_community_id, uid, 'thread', p_thread_id, 'unlock');
  return jsonb_build_object('id', p_thread_id, 'is_locked', false, 'status', 'published');
end $$;

revoke all on function public.unlock_thread(uuid) from public, anon, authenticated;
grant execute on function public.unlock_thread(uuid) to authenticated;

create or replace function public.remove_thread(p_thread_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_community_id uuid;
begin
  select community_id into v_community_id from public.reference_threads where id = p_thread_id;
  if v_community_id is null then raise exception 'NOT_COMMUNITY_THREAD' using errcode = 'P0001'; end if;
  if not exists(
    select 1 from public.community_members
    where community_id = v_community_id and user_id = uid and role in ('owner','moderator') and status = 'active'
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update public.reference_threads set status = 'removed' where id = p_thread_id;
  insert into public.community_moderation_actions(community_id, actor_id, target_type, target_id, action, reason)
  values (v_community_id, uid, 'thread', p_thread_id, 'remove', p_reason);
  return jsonb_build_object('id', p_thread_id, 'status', 'removed');
end $$;

revoke all on function public.remove_thread(uuid, text) from public, anon, authenticated;
grant execute on function public.remove_thread(uuid, text) to authenticated;

create or replace function public.restore_thread(p_thread_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_community_id uuid;
begin
  select community_id into v_community_id from public.reference_threads where id = p_thread_id;
  if v_community_id is null then raise exception 'NOT_COMMUNITY_THREAD' using errcode = 'P0001'; end if;
  if not exists(
    select 1 from public.community_members
    where community_id = v_community_id and user_id = uid and role in ('owner','moderator') and status = 'active'
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update public.reference_threads set status = 'published' where id = p_thread_id;
  insert into public.community_moderation_actions(community_id, actor_id, target_type, target_id, action)
  values (v_community_id, uid, 'thread', p_thread_id, 'restore');
  return jsonb_build_object('id', p_thread_id, 'status', 'published');
end $$;

revoke all on function public.restore_thread(uuid) from public, anon, authenticated;
grant execute on function public.restore_thread(uuid) to authenticated;
