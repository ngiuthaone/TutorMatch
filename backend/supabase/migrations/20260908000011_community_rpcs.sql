-- 20260908000001_community_rpcs.sql
-- Security-definer RPCs for communities.
set search_path = '';

-- ─────────────────────────────────────────────────────────────────────
-- create_community — creator becomes owner
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.create_community(
  p_slug text,
  p_name text,
  p_description text default null,
  p_visibility text default 'public',
  p_join_policy text default 'open'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_id uuid;
begin
  if btrim(coalesce(p_slug, '')) = '' or char_length(p_slug) > 60 or char_length(p_slug) < 2 then
    raise exception 'INVALID_SLUG' using errcode = '22023';
  end if;
  if p_slug !~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' and char_length(p_slug) > 1 then
    raise exception 'INVALID_SLUG_FORMAT' using errcode = '22023';
  end if;
  if btrim(coalesce(p_name, '')) = '' or char_length(p_name) > 100 then
    raise exception 'INVALID_NAME' using errcode = '22023';
  end if;
  if p_visibility not in ('public','private') then raise exception 'INVALID_VISIBILITY' using errcode = '22023'; end if;
  if p_join_policy not in ('open','request','invite') then raise exception 'INVALID_JOIN_POLICY' using errcode = '22023'; end if;
  if p_description is not null and char_length(p_description) > 2000 then
    raise exception 'DESCRIPTION_TOO_LONG' using errcode = '22023';
  end if;

  if exists(select 1 from public.communities where slug = p_slug) then
    raise exception 'SLUG_TAKEN' using errcode = '22023';
  end if;

  insert into public.communities(slug, name, description, visibility, join_policy, created_by)
  values (lower(btrim(p_slug)), btrim(p_name), p_description, p_visibility, p_join_policy, uid)
  returning id into v_id;

  insert into public.community_members(community_id, user_id, role, status)
  values (v_id, uid, 'owner', 'active');

  return jsonb_build_object('id', v_id, 'slug', lower(btrim(p_slug)));
end $$;

revoke all on function public.create_community(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_community(text, text, text, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- update_community — owner or moderator
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.update_community(
  p_id uuid,
  p_name text default null,
  p_description text default null,
  p_visibility text default null,
  p_join_policy text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
begin
  if not exists(
    select 1 from public.community_members
    where community_id = p_id and user_id = uid and role in ('owner','moderator') and status = 'active'
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_name is not null and (btrim(p_name) = '' or char_length(p_name) > 100) then
    raise exception 'INVALID_NAME' using errcode = '22023';
  end if;
  if p_description is not null and char_length(p_description) > 2000 then
    raise exception 'DESCRIPTION_TOO_LONG' using errcode = '22023';
  end if;
  if p_visibility is not null and p_visibility not in ('public','private') then
    raise exception 'INVALID_VISIBILITY' using errcode = '22023';
  end if;
  if p_join_policy is not null and p_join_policy not in ('open','request','invite') then
    raise exception 'INVALID_JOIN_POLICY' using errcode = '22023';
  end if;

  update public.communities set
    name = coalesce(btrim(p_name), name),
    description = case when p_description is null then description else p_description end,
    visibility = coalesce(p_visibility, visibility),
    join_policy = coalesce(p_join_policy, join_policy)
  where id = p_id and archived_at is null;

  return jsonb_build_object('id', p_id, 'updated', true);
end $$;

revoke all on function public.update_community(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.update_community(uuid, text, text, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- archive_community — owner only, soft-archive
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.archive_community(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
begin
  if not exists(
    select 1 from public.community_members
    where community_id = p_id and user_id = uid and role = 'owner' and status = 'active'
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update public.communities set archived_at = now() where id = p_id and archived_at is null;
  return jsonb_build_object('id', p_id, 'archived', true);
end $$;

revoke all on function public.archive_community(uuid) from public, anon, authenticated;
grant execute on function public.archive_community(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- join_community — open policy only
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.join_community(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_policy text;
begin
  select join_policy into v_policy from public.communities where id = p_id and archived_at is null;
  if v_policy is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if v_policy <> 'open' then raise exception 'JOIN_NOT_OPEN' using errcode = 'P0001'; end if;

  insert into public.community_members(community_id, user_id, role, status)
  values (p_id, uid, 'member', 'active')
  on conflict (community_id, user_id) do update set status = 'active', role = 'member';

  return jsonb_build_object('community_id', p_id, 'status', 'active');
end $$;

revoke all on function public.join_community(uuid) from public, anon, authenticated;
grant execute on function public.join_community(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- request_join_community — request policy
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.request_join_community(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_policy text;
begin
  select join_policy into v_policy from public.communities where id = p_id and archived_at is null;
  if v_policy is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if v_policy <> 'request' then raise exception 'JOIN_NOT_REQUEST' using errcode = 'P0001'; end if;

  insert into public.community_members(community_id, user_id, role, status)
  values (p_id, uid, 'member', 'pending')
  on conflict (community_id, user_id) do update set status = 'pending';

  return jsonb_build_object('community_id', p_id, 'status', 'pending');
end $$;

revoke all on function public.request_join_community(uuid) from public, anon, authenticated;
grant execute on function public.request_join_community(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- leave_community
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.leave_community(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_role text;
begin
  select role into v_role from public.community_members
  where community_id = p_id and user_id = uid and status = 'active';
  if v_role is null then raise exception 'NOT_MEMBER' using errcode = 'P0001'; end if;
  if v_role = 'owner' then raise exception 'OWNER_CANNOT_LEAVE' using errcode = '42501'; end if;
  delete from public.community_members where community_id = p_id and user_id = uid;
  return jsonb_build_object('community_id', p_id, 'left', true);
end $$;

revoke all on function public.leave_community(uuid) from public, anon, authenticated;
grant execute on function public.leave_community(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- approve_member — owner or moderator
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.approve_member(p_community_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
begin
  if not exists(
    select 1 from public.community_members
    where community_id = p_community_id and user_id = uid and role in ('owner','moderator') and status = 'active'
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update public.community_members
  set status = 'active', role = 'member'
  where community_id = p_community_id and user_id = p_user_id and status = 'pending';
  if not found then raise exception 'NO_PENDING_REQUEST' using errcode = 'P0001'; end if;
  return jsonb_build_object('community_id', p_community_id, 'user_id', p_user_id, 'status', 'active');
end $$;

revoke all on function public.approve_member(uuid, uuid) from public, anon, authenticated;
grant execute on function public.approve_member(uuid, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- ban_member — owner or moderator (cannot ban owner)
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.ban_member(p_community_id uuid, p_user_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_target_role text;
begin
  if not exists(
    select 1 from public.community_members
    where community_id = p_community_id and user_id = uid and role in ('owner','moderator') and status = 'active'
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select role into v_target_role from public.community_members
  where community_id = p_community_id and user_id = p_user_id;
  if v_target_role is null then raise exception 'NOT_MEMBER' using errcode = 'P0001'; end if;
  if v_target_role = 'owner' then raise exception 'CANNOT_BAN_OWNER' using errcode = '42501'; end if;
  if p_user_id = uid then raise exception 'CANNOT_BAN_SELF' using errcode = '22023'; end if;

  update public.community_members
  set status = 'banned'
  where community_id = p_community_id and user_id = p_user_id;

  insert into public.community_moderation_actions(community_id, actor_id, target_type, target_id, action, reason)
  values (p_community_id, uid, 'member', p_user_id, 'ban', p_reason);

  return jsonb_build_object('community_id', p_community_id, 'user_id', p_user_id, 'status', 'banned');
end $$;

revoke all on function public.ban_member(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.ban_member(uuid, uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- promote_member / demote_member — owner only
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.promote_member(p_community_id uuid, p_user_id uuid, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
begin
  if not exists(
    select 1 from public.community_members
    where community_id = p_community_id and user_id = uid and role = 'owner' and status = 'active'
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_role not in ('member','moderator') then
    raise exception 'INVALID_ROLE' using errcode = '22023';
  end if;
  update public.community_members
  set role = p_role
  where community_id = p_community_id and user_id = p_user_id and status = 'active';
  if not found then raise exception 'NOT_MEMBER' using errcode = 'P0001'; end if;

  insert into public.community_moderation_actions(community_id, actor_id, target_type, target_id, action)
  values (p_community_id, uid, 'member', p_user_id, case when p_role = 'moderator' then 'promote' else 'demote' end);

  return jsonb_build_object('community_id', p_community_id, 'user_id', p_user_id, 'role', p_role);
end $$;

revoke all on function public.promote_member(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.promote_member(uuid, uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- is_community_member — helper
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.is_community_member(p_community_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_status text;
begin
  select role, status into v_role, v_status
  from public.community_members
  where community_id = p_community_id and user_id = auth.uid();
  return jsonb_build_object(
    'is_member', v_role is not null and v_status = 'active',
    'is_moderator', v_role in ('moderator','owner') and v_status = 'active',
    'is_owner', v_role = 'owner' and v_status = 'active',
    'is_pending', v_status = 'pending',
    'is_banned', v_status = 'banned'
  );
end $$;

revoke all on function public.is_community_member(uuid) from public, anon, authenticated;
grant execute on function public.is_community_member(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- list_communities — public discovery
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.list_communities(
  p_cursor text default null,
  p_limit integer default 20,
  p_query text default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit int := least(coalesce(p_limit, 20), 50);
  v_auth_uid uuid := auth.uid();
  v_communities jsonb;
  v_next_cursor text;
begin
  select coalesce(jsonb_agg(t.obj order by t.created_at desc), '[]'::jsonb)
  into v_communities
  from (
    select jsonb_build_object(
      'id', c.id,
      'slug', c.slug,
      'name', c.name,
      'description', c.description,
      'visibility', c.visibility,
      'join_policy', c.join_policy,
      'member_count', c.member_count,
      'post_count', c.post_count,
      'thread_count', c.thread_count,
      'is_member', exists(
        select 1 from public.community_members cm
        where cm.community_id = c.id and cm.user_id = v_auth_uid and cm.status = 'active'
      ),
      'created_at', c.created_at
    ) obj, c.created_at
    from public.communities c
    where c.archived_at is null
      and c.visibility = 'public'
      and (p_cursor is null or c.created_at < to_timestamp(p_cursor::double precision / 1000.0))
      and (p_query is null or lower(c.name) like '%' || lower(p_query) || '%' or lower(c.description) like '%' || lower(p_query) || '%')
    order by c.created_at desc
    limit v_limit
  ) t;

  select t.created_at into v_next_cursor
  from (
    select c.created_at from public.communities c
    where c.archived_at is null and c.visibility = 'public'
      and (p_cursor is null or c.created_at < to_timestamp(p_cursor::double precision / 1000.0))
    order by c.created_at desc limit 1 offset v_limit
  ) t;

  return jsonb_build_object(
    'communities', v_communities,
    'next_cursor', case when v_next_cursor is not null then extract(epoch from v_next_cursor::timestamptz) * 1000.0 end
  );
end $$;

revoke all on function public.list_communities(text, integer, text) from public, anon, authenticated;
grant execute on function public.list_communities(text, integer, text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- get_community — by slug or id
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.get_community(p_slug_or_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_row jsonb;
begin
  select jsonb_build_object(
    'id', c.id,
    'slug', c.slug,
    'name', c.name,
    'description', c.description,
    'visibility', c.visibility,
    'join_policy', c.join_policy,
    'member_count', c.member_count,
    'post_count', c.post_count,
    'thread_count', c.thread_count,
    'created_by', c.created_by,
    'created_at', c.created_at,
    'archived_at', c.archived_at,
    'membership', jsonb_build_object(
      'is_member', exists(
        select 1 from public.community_members cm
        where cm.community_id = c.id and cm.user_id = v_auth_uid and cm.status = 'active'
      ),
      'is_moderator', exists(
        select 1 from public.community_members cm
        where cm.community_id = c.id and cm.user_id = v_auth_uid and cm.role in ('owner','moderator') and cm.status = 'active'
      ),
      'is_pending', exists(
        select 1 from public.community_members cm
        where cm.community_id = c.id and cm.user_id = v_auth_uid and cm.status = 'pending'
      )
    )
  ) into v_row
  from public.communities c
  where c.archived_at is null
    and (c.id::text = p_slug_or_id or c.slug = p_slug_or_id);

  return v_row;
end $$;

revoke all on function public.get_community(text) from public, anon, authenticated;
grant execute on function public.get_community(text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- list_community_members — active members visible to other active members
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.list_community_members(
  p_community_id uuid,
  p_cursor text default null,
  p_limit integer default 30
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit int := least(coalesce(p_limit, 30), 100);
  v_members jsonb;
  v_next_cursor text;
begin
  select coalesce(jsonb_agg(t.obj order by t.joined_at asc), '[]'::jsonb)
  into v_members
  from (
    select jsonb_build_object(
      'user_id', cm.user_id,
      'role', cm.role,
      'status', cm.status,
      'joined_at', cm.joined_at,
      'name', p.name,
      'avatar_url', p.avatar_url,
      'user_role', p.role
    ) obj, cm.joined_at
    from public.community_members cm
    join public.profiles p on p.id = cm.user_id
    where cm.community_id = p_community_id
      and cm.status = 'active'
      and (p_cursor is null or cm.joined_at > to_timestamp(p_cursor::double precision / 1000.0))
    order by cm.joined_at asc
    limit v_limit
  ) t;

  select t.joined_at into v_next_cursor
  from (
    select cm.joined_at from public.community_members cm
    where cm.community_id = p_community_id and cm.status = 'active'
    order by cm.joined_at asc limit 1 offset v_limit
  ) t;

  return jsonb_build_object(
    'members', v_members,
    'next_cursor', case when v_next_cursor is not null then extract(epoch from v_next_cursor::timestamptz) * 1000.0 end
  );
end $$;

revoke all on function public.list_community_members(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.list_community_members(uuid, text, integer) to authenticated;
