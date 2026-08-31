-- 20260904000001_reference_thread_rpcs.sql
-- Security-definer RPCs for reference threads, replies, appreciations, reports.
-- All writes gate on auth.uid() via assert_verified_booking_caller(); public
-- reads never expose creator_id/author_id/auth IDs/emails/phones.
--
-- Contract: docs/REFERENCE_THREADS_PROMPT.md (Security-definer RPCs — Threads).
set search_path = '';

-- Max reply nesting depth (thread → reply → reply-to-reply = levels 1,2,3).
create or replace function public._thread_max_depth() returns integer language sql immutable as $$ select 3; $$;

-- ─────────────────────────────────────────────────────────────────────
-- create_reference_thread
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.create_reference_thread(
  p_title text,
  p_body text default null,
  p_anchor_type text default 'external_url',
  p_anchor_id uuid default null,
  p_anchor_url text default null,
  p_anchor_title text default null,
  p_tags text[] default '{}',
  p_level text default null,
  p_visibility text default 'public',
  p_community_id uuid default null,
  p_reply_permission text default 'everyone'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_id uuid;
  v_anchor_domain text;
  v_anchor_title text;
begin
  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'INVALID_TITLE' using errcode = '22023';
  end if;
  if p_body is not null and char_length(p_body) > 2000 then
    raise exception 'INVALID_BODY' using errcode = '22023';
  end if;
  if p_anchor_type not in ('course','event','workshop','article','tutor_profile','external_url') then
    raise exception 'INVALID_ANCHOR' using errcode = '22023';
  end if;

  -- External URL anchor: require a valid https URL, no internal id.
  if p_anchor_type = 'external_url' then
    if p_anchor_url is null or p_anchor_url !~ '^https://[^\s]+$' then
      raise exception 'INVALID_ANCHOR_URL' using errcode = '22023';
    end if;
    v_anchor_domain := split_part(split_part(p_anchor_url, '://', 2), '/', 1);
    v_anchor_title := coalesce(p_anchor_title, v_anchor_domain);
  else
    -- Internal anchor: id required, URL must be null.
    if p_anchor_id is null then
      raise exception 'INVALID_ANCHOR' using errcode = '22023';
    end if;
    if p_anchor_url is not null then
      raise exception 'INVALID_ANCHOR' using errcode = '22023';
    end if;
  end if;

  if p_visibility = 'community' and p_community_id is null then
    raise exception 'INVALID_VISIBILITY' using errcode = '22023';
  end if;
  if p_visibility != 'community' then
    p_community_id := null;
  end if;

  insert into public.reference_threads(
    creator_id, title, body, anchor_type, anchor_id, anchor_url, anchor_title,
    anchor_domain, tags, level, visibility, community_id, reply_permission, status
  ) values (
    uid, btrim(p_title), nullif(btrim(p_body), ''), p_anchor_type, p_anchor_id,
    p_anchor_url, btrim(v_anchor_title), v_anchor_domain,
    coalesce(p_tags, '{}'), p_level, p_visibility, p_community_id, p_reply_permission, 'published'
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'status', 'published');
end $$;

revoke all on function public.create_reference_thread(text, text, text, uuid, text, text, text[], text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.create_reference_thread(text, text, text, uuid, text, text, text[], text, text, uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- list_reference_threads — public, cursor-paginated, strips creator_id
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.list_reference_threads(
  p_cursor text default null,
  p_limit integer default 20,
  p_tag text default null,
  p_level text default null,
  p_anchor_type text default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit int := least(coalesce(p_limit, 20), 50);
  v_threads jsonb;
  v_next_cursor text;
  v_auth_uid uuid := auth.uid();
begin
  select coalesce(jsonb_agg(t.obj order by t.created_at desc), '[]'::jsonb)
  into v_threads
  from (
    select jsonb_build_object(
      'id', rt.id,
      'title', rt.title,
      'body', rt.body,
      'anchor_type', rt.anchor_type,
      'anchor_id', rt.anchor_id,
      'anchor_url', rt.anchor_url,
      'anchor_title', rt.anchor_title,
      'anchor_domain', rt.anchor_domain,
      'tags', rt.tags,
      'level', rt.level,
      'visibility', rt.visibility,
      'reply_permission', rt.reply_permission,
      'appreciated_count', rt.appreciated_count,
      'reply_count', rt.reply_count,
      'created_at', rt.created_at,
      'is_creator', (rt.creator_id = v_auth_uid),
      'appreciated_by_me', exists(select 1 from public.reference_thread_appreciations a where a.target_type = 'thread' and a.target_id = rt.id and a.user_id = v_auth_uid)
    ) obj, rt.created_at
    from public.reference_threads rt
    where rt.status = 'published'
      and rt.visibility = 'public'
      and (p_cursor is null or rt.created_at < to_timestamp(p_cursor::double precision / 1000.0))
      and (p_tag is null or p_tag = any(rt.tags))
      and (p_level is null or rt.level = p_level)
      and (p_anchor_type is null or rt.anchor_type = p_anchor_type)
    order by rt.created_at desc
    limit v_limit
  ) t;

  select t.created_at into v_next_cursor
  from (
    select rt.created_at
    from public.reference_threads rt
    where rt.status = 'published' and rt.visibility = 'public'
      and (p_cursor is null or rt.created_at < to_timestamp(p_cursor::double precision / 1000.0))
      and (p_tag is null or p_tag = any(rt.tags))
      and (p_level is null or rt.level = p_level)
      and (p_anchor_type is null or rt.anchor_type = p_anchor_type)
    order by rt.created_at desc
    limit 1 offset v_limit
  ) t;

  return jsonb_build_object(
    'threads', v_threads,
    'next_cursor', case when v_next_cursor is not null then extract(epoch from v_next_cursor) * 1000.0 end
  );
end $$;

revoke all on function public.list_reference_threads(text, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.list_reference_threads(text, integer, text, text, text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- get_reference_thread — public; returns thread + anchor + replies
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.get_reference_thread(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_thread jsonb;
  v_replies jsonb;
begin
  select jsonb_build_object(
    'id', rt.id,
    'title', rt.title,
    'body', rt.body,
    'anchor_type', rt.anchor_type,
    'anchor_id', rt.anchor_id,
    'anchor_url', rt.anchor_url,
    'anchor_title', rt.anchor_title,
    'anchor_domain', rt.anchor_domain,
    'tags', rt.tags,
    'level', rt.level,
    'visibility', rt.visibility,
    'reply_permission', rt.reply_permission,
    'status', rt.status,
    'appreciated_count', rt.appreciated_count,
    'reply_count', rt.reply_count,
    'created_at', rt.created_at,
    'is_creator', (rt.creator_id = v_auth_uid),
    'appreciated_by_me', exists(select 1 from public.reference_thread_appreciations a where a.target_type = 'thread' and a.target_id = rt.id and a.user_id = v_auth_uid),
    'author', jsonb_build_object(
      'name', p.name,
      'avatar_url', p.avatar_url,
      'role', p.role
    )
  )
  into v_thread
  from public.reference_threads rt
  left join public.profiles p on p.id = rt.creator_id
  where rt.id = p_id and rt.status in ('published','closed') and rt.visibility = 'public';

  if v_thread is null then return null; end if;

  select coalesce(jsonb_agg(r.obj order by r.created_at asc), '[]'::jsonb)
  into v_replies
  from (
    with recursive tree as (
      select rtr.id, rtr.parent_id, rtr.body, rtr.creator_id, rtr.appreciated_count, rtr.created_at, 1 as depth,
             p.name as author_name, p.avatar_url as author_avatar, p.role as author_role
      from public.reference_thread_replies rtr
      left join public.profiles p on p.id = rtr.creator_id
      where rtr.thread_id = p_id and rtr.parent_id is null and rtr.status = 'published'
      union all
      select c.id, c.parent_id, c.body, c.creator_id, c.appreciated_count, c.created_at, t.depth + 1,
             p.name, p.avatar_url, p.role
      from public.reference_thread_replies c
      join tree t on c.parent_id = t.id
      left join public.profiles p on p.id = c.creator_id
      where c.status = 'published' and t.depth < public._thread_max_depth()
    )
    select jsonb_build_object(
      'id', t.id,
      'parent_id', t.parent_id,
      'body', t.body,
      'appreciated_count', t.appreciated_count,
      'created_at', t.created_at,
      'depth', t.depth,
      'is_creator', (t.creator_id = v_auth_uid),
      'appreciated_by_me', exists(select 1 from public.reference_thread_appreciations a where a.target_type = 'reply' and a.target_id = t.id and a.user_id = v_auth_uid),
      'author', jsonb_build_object('name', t.author_name, 'avatar_url', t.author_avatar, 'role', t.author_role)
    ) obj, t.created_at
    from tree t
  ) r;

  return jsonb_build_object('thread', v_thread, 'replies', v_replies);
end $$;

revoke all on function public.get_reference_thread(uuid) from public, anon, authenticated;
grant execute on function public.get_reference_thread(uuid) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- reply_to_thread — enforces depth, reply_permission, status
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.reply_to_thread(
  p_thread_id uuid,
  p_body text,
  p_parent_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_thread_status text;
  v_thread_creator uuid;
  v_reply_perm text;
  v_depth int := 1;
  v_parent_depth int := 0;
  v_parent_status text;
  v_id uuid;
begin
  if btrim(coalesce(p_body, '')) = '' or char_length(p_body) > 2000 then
    raise exception 'INVALID_BODY' using errcode = '22023';
  end if;

  select rt.status, rt.creator_id, rt.reply_permission
  into v_thread_status, v_thread_creator, v_reply_perm
  from public.reference_threads rt
  where rt.id = p_thread_id;

  if v_thread_status is null then
    raise exception 'THREAD_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_thread_status != 'published' then
    raise exception 'THREAD_CLOSED' using errcode = 'P0001';
  end if;
  if v_reply_perm = 'disabled' then
    raise exception 'REPLIES_DISABLED' using errcode = 'P0001';
  end if;
  -- NOTE: reply_permission = 'community_members' requires a community_members
  -- table to verify membership. No such table exists yet (community_id is an
  -- unconstrained UUID), so this falls back to any authenticated caller —
  -- the same as 'everyone'. Add a community_members table and a membership
  -- check here before enforcing community-scoped replies in production.

  if p_parent_id is not null then
    select rtr.status into v_parent_status
    from public.reference_thread_replies rtr
    where rtr.id = p_parent_id and rtr.thread_id = p_thread_id;
    if v_parent_status is null then
      raise exception 'PARENT_NOT_FOUND' using errcode = 'P0001';
    end if;
    if v_parent_status != 'published' then
      raise exception 'PARENT_DELETED' using errcode = 'P0001';
    end if;
    -- Compute parent depth by walking ancestors (published-only so a deleted
    -- ancestor can't inflate depth or orphan the new reply).
    with recursive ancestors as (
      select rtr.id, rtr.parent_id, 1 as depth
      from public.reference_thread_replies rtr
      where rtr.id = p_parent_id and rtr.status = 'published'
      union all
      select rtr2.id, rtr2.parent_id, a.depth + 1
      from public.reference_thread_replies rtr2
      join ancestors a on rtr2.id = a.parent_id
      where rtr2.status = 'published'
    )
    select max(depth) into v_parent_depth from ancestors;
    v_depth := v_parent_depth + 1;
    if v_depth > public._thread_max_depth() then
      raise exception 'DEPTH_EXCEEDED' using errcode = 'P0001';
    end if;
  end if;

  insert into public.reference_thread_replies(thread_id, parent_id, creator_id, body, status)
  values (p_thread_id, p_parent_id, uid, btrim(p_body), 'published')
  returning id into v_id;

  update public.reference_threads set reply_count = reply_count + 1 where id = p_thread_id;

  return jsonb_build_object('id', v_id, 'depth', v_depth, 'status', 'published');
end $$;

revoke all on function public.reply_to_thread(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.reply_to_thread(uuid, text, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- close_reference_thread / reopen_reference_thread — owner only
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.close_reference_thread(p_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := public.assert_verified_booking_caller(); v_creator uuid;
begin
  select creator_id into v_creator from public.reference_threads where id = p_id;
  if v_creator is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if v_creator != uid then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  update public.reference_threads set status = 'closed' where id = p_id and status = 'published';
  return jsonb_build_object('id', p_id, 'status', 'closed');
end $$;
revoke all on function public.close_reference_thread(uuid) from public, anon, authenticated;
grant execute on function public.close_reference_thread(uuid) to authenticated;

create or replace function public.reopen_reference_thread(p_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := public.assert_verified_booking_caller(); v_creator uuid;
begin
  select creator_id into v_creator from public.reference_threads where id = p_id;
  if v_creator is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if v_creator != uid then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  update public.reference_threads set status = 'published' where id = p_id and status = 'closed';
  return jsonb_build_object('id', p_id, 'status', 'published');
end $$;
revoke all on function public.reopen_reference_thread(uuid) from public, anon, authenticated;
grant execute on function public.reopen_reference_thread(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- delete_reference_thread / delete_reply — owner only, soft-delete
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.delete_reference_thread(p_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := public.assert_verified_booking_caller(); v_creator uuid;
begin
  select creator_id into v_creator from public.reference_threads where id = p_id;
  if v_creator is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if v_creator != uid then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  update public.reference_threads set status = 'deleted' where id = p_id and status in ('published','closed');
  return jsonb_build_object('id', p_id, 'status', 'deleted');
end $$;
revoke all on function public.delete_reference_thread(uuid) from public, anon, authenticated;
grant execute on function public.delete_reference_thread(uuid) to authenticated;

create or replace function public.delete_reply(p_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := public.assert_verified_booking_caller(); v_creator uuid; v_thread_id uuid;
begin
  select creator_id, thread_id into v_creator, v_thread_id from public.reference_thread_replies where id = p_id;
  if v_creator is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if v_creator != uid then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  update public.reference_thread_replies set status = 'deleted', body = '' where id = p_id and status = 'published';
  if v_thread_id is not null then
    update public.reference_threads set reply_count = greatest(reply_count - 1, 0) where id = v_thread_id;
  end if;
  return jsonb_build_object('id', p_id, 'status', 'deleted');
end $$;
revoke all on function public.delete_reply(uuid) from public, anon, authenticated;
grant execute on function public.delete_reply(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- appreciate_reference / unappreciate_reference — upvote toggle
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.appreciate_reference(p_target_type text, p_target_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_count int;
begin
  if p_target_type not in ('thread','reply') then raise exception 'INVALID_TARGET' using errcode = '22023'; end if;
  -- Validate the target exists so we never insert an orphan appreciation row.
  if p_target_type = 'thread' then
    if not exists(select 1 from public.reference_threads where id = p_target_id and status in ('published','closed')) then
      raise exception 'TARGET_NOT_FOUND' using errcode = 'P0001';
    end if;
  else
    if not exists(select 1 from public.reference_thread_replies where id = p_target_id and status = 'published') then
      raise exception 'TARGET_NOT_FOUND' using errcode = 'P0001';
    end if;
  end if;
  insert into public.reference_thread_appreciations(user_id, target_type, target_id)
  values (uid, p_target_type, p_target_id)
  on conflict (target_type, target_id, user_id) do nothing;

  if p_target_type = 'thread' then
    update public.reference_threads set appreciated_count = (select count(*) from public.reference_thread_appreciations where target_type = 'thread' and target_id = p_target_id) where id = p_target_id
    returning appreciated_count into v_count;
  else
    update public.reference_thread_replies set appreciated_count = (select count(*) from public.reference_thread_appreciations where target_type = 'reply' and target_id = p_target_id) where id = p_target_id
    returning appreciated_count into v_count;
  end if;

  return jsonb_build_object('target_type', p_target_type, 'target_id', p_target_id, 'appreciated_count', coalesce(v_count, 0), 'appreciated_by_me', true);
end $$;
revoke all on function public.appreciate_reference(text, uuid) from public, anon, authenticated;
grant execute on function public.appreciate_reference(text, uuid) to authenticated;

create or replace function public.unappreciate_reference(p_target_type text, p_target_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_count int;
begin
  if p_target_type not in ('thread','reply') then raise exception 'INVALID_TARGET' using errcode = '22023'; end if;
  delete from public.reference_thread_appreciations where user_id = uid and target_type = p_target_type and target_id = p_target_id;

  if p_target_type = 'thread' then
    update public.reference_threads set appreciated_count = (select count(*) from public.reference_thread_appreciations where target_type = 'thread' and target_id = p_target_id) where id = p_target_id
    returning appreciated_count into v_count;
  else
    update public.reference_thread_replies set appreciated_count = (select count(*) from public.reference_thread_appreciations where target_type = 'reply' and target_id = p_target_id) where id = p_target_id
    returning appreciated_count into v_count;
  end if;

  return jsonb_build_object('target_type', p_target_type, 'target_id', p_target_id, 'appreciated_count', coalesce(v_count, 0), 'appreciated_by_me', false);
end $$;
revoke all on function public.unappreciate_reference(text, uuid) from public, anon, authenticated;
grant execute on function public.unappreciate_reference(text, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- report_reference_content — reporter identity hidden, dedupe
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.report_reference_content(
  p_target_type text,
  p_target_id uuid,
  p_reason text
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_id uuid;
begin
  if p_target_type not in ('thread','reply') then raise exception 'INVALID_TARGET' using errcode = '22023'; end if;
  if btrim(coalesce(p_reason, '')) = '' or char_length(p_reason) > 500 then raise exception 'INVALID_REASON' using errcode = '22023'; end if;
  insert into public.reference_thread_reports(target_type, target_id, reporter_id, reason, status)
  values (p_target_type, p_target_id, uid, btrim(p_reason), 'pending')
  on conflict (target_id, reporter_id) do update set reason = excluded.reason, created_at = now()
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'status', 'pending');
end $$;
revoke all on function public.report_reference_content(text, uuid, text) from public, anon, authenticated;
grant execute on function public.report_reference_content(text, uuid, text) to authenticated;
