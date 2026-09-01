-- 20260907000021_reference_thread_rpcs.sql
-- Security-definer RPCs for reference threads.
set search_path = '';

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
  p_anchor_domain text default null,
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
  v_anchor_id uuid := p_anchor_id;
  v_anchor_url text := p_anchor_url;
begin
  if btrim(coalesce(p_title, '')) = '' then raise exception 'INVALID_TITLE' using errcode = '22023'; end if;
  if char_length(p_title) > 200 then raise exception 'TITLE_TOO_LONG' using errcode = '22023'; end if;
  if p_body is not null and char_length(p_body) > 2000 then raise exception 'BODY_TOO_LONG' using errcode = '22023'; end if;
  if p_anchor_type not in ('course','event','workshop','article','tutor_profile','external_url') then
    raise exception 'INVALID_ANCHOR_TYPE' using errcode = '22023';
  end if;
  if p_visibility not in ('public','community') then raise exception 'INVALID_VISIBILITY' using errcode = '22023'; end if;
  if p_reply_permission not in ('everyone','community_members','disabled') then raise exception 'INVALID_REPLY_PERMISSION' using errcode = '22023'; end if;
  if p_level is not null and p_level not in ('complete_beginner','beginner','intermediate','advanced','all_levels') then
    raise exception 'INVALID_LEVEL' using errcode = '22023';
  end if;

  -- For external URLs, validate the URL format
  if p_anchor_type = 'external_url' then
    if p_anchor_url is null or p_anchor_url !~ '^https?://' then
      raise exception 'INVALID_ANCHOR_URL' using errcode = '22023';
    end if;
    v_anchor_id := null;
  else
    v_anchor_url := null;
    if v_anchor_id is null then raise exception 'ANCHOR_ID_REQUIRED' using errcode = '22023'; end if;
  end if;

  if p_visibility = 'community' and p_community_id is null then
    raise exception 'COMMUNITY_ID_REQUIRED' using errcode = '22023';
  end if;

  insert into public.reference_threads(
    creator_id, title, body, anchor_type, anchor_id, anchor_url,
    anchor_title, anchor_domain, tags, level, visibility, community_id,
    reply_permission, status
  )
  values (
    uid, btrim(p_title), p_body, p_anchor_type, v_anchor_id, v_anchor_url,
    p_anchor_title, p_anchor_domain, coalesce(p_tags, '{}'), p_level, p_visibility,
    p_community_id, p_reply_permission, 'published'
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'status', 'published');
end $$;

revoke all on function public.create_reference_thread(text, text, text, uuid, text, text, text, text[], text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.create_reference_thread(text, text, text, uuid, text, text, text, text[], text, text, uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- list_reference_threads — public, paginated
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
  v_auth_uid uuid := auth.uid();
  v_threads jsonb;
  v_next_cursor text;
begin
  select coalesce(jsonb_agg(t.obj order by t.created_at desc), '[]'::jsonb)
  into v_threads
  from (
    select jsonb_build_object(
      'id', t.id,
      'title', t.title,
      'body', t.body,
      'anchor_type', t.anchor_type,
      'anchor_id', t.anchor_id,
      'anchor_url', t.anchor_url,
      'anchor_title', t.anchor_title,
      'anchor_domain', t.anchor_domain,
      'tags', t.tags,
      'level', t.level,
      'visibility', t.visibility,
      'reply_permission', t.reply_permission,
      'appreciated_count', t.appreciated_count,
      'reply_count', t.reply_count,
      'status', t.status,
      'is_creator', (t.creator_id = v_auth_uid),
      'appreciated_by_me', exists(
        select 1 from public.reference_thread_appreciations a
        where a.target_type = 'thread' and a.target_id = t.id and a.user_id = v_auth_uid
      ),
      'creator', jsonb_build_object('name', pr.name, 'avatar_url', pr.avatar_url, 'role', pr.role),
      'created_at', t.created_at,
      'updated_at', t.updated_at
    ) obj, t.created_at
    from public.reference_threads t
    left join public.profiles pr on pr.id = t.creator_id
    where t.status in ('published', 'closed')
      and (p_cursor is null or t.created_at < to_timestamp(p_cursor::double precision / 1000.0))
      and (p_tag is null or p_tag = any(t.tags))
      and (p_level is null or t.level = p_level)
      and (p_anchor_type is null or t.anchor_type = p_anchor_type)
    order by t.created_at desc
    limit v_limit
  ) t;

  select t.created_at into v_next_cursor
  from (
    select t.created_at
    from public.reference_threads t
    where t.status in ('published', 'closed')
      and (p_cursor is null or t.created_at < to_timestamp(p_cursor::double precision / 1000.0))
      and (p_tag is null or p_tag = any(t.tags))
      and (p_level is null or t.level = p_level)
      and (p_anchor_type is null or t.anchor_type = p_anchor_type)
    order by t.created_at desc
    limit 1 offset v_limit
  ) t;

  return jsonb_build_object(
    'threads', v_threads,
    'next_cursor', case when v_next_cursor is not null then extract(epoch from v_next_cursor::timestamptz) * 1000.0 end
  );
end $$;

revoke all on function public.list_reference_threads(text, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.list_reference_threads(text, integer, text, text, text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- get_reference_thread — public detail
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
begin
  select jsonb_build_object(
    'id', t.id,
    'title', t.title,
    'body', t.body,
    'anchor_type', t.anchor_type,
    'anchor_id', t.anchor_id,
    'anchor_url', t.anchor_url,
    'anchor_title', t.anchor_title,
    'anchor_domain', t.anchor_domain,
    'tags', t.tags,
    'level', t.level,
    'visibility', t.visibility,
    'reply_permission', t.reply_permission,
    'appreciated_count', t.appreciated_count,
    'reply_count', t.reply_count,
    'status', t.status,
    'is_creator', (t.creator_id = v_auth_uid),
    'appreciated_by_me', exists(
      select 1 from public.reference_thread_appreciations a
      where a.target_type = 'thread' and a.target_id = t.id and a.user_id = v_auth_uid
    ),
    'creator', jsonb_build_object('name', pr.name, 'avatar_url', pr.avatar_url, 'role', pr.role),
    'created_at', t.created_at,
    'updated_at', t.updated_at
  ) into v_thread
  from public.reference_threads t
  left join public.profiles pr on pr.id = t.creator_id
  where t.id = p_id and t.status in ('published', 'closed');

  return v_thread;
end $$;

revoke all on function public.get_reference_thread(uuid) from public, anon, authenticated;
grant execute on function public.get_reference_thread(uuid) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- list_thread_replies — public, returns nested tree (max 3 levels)
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.list_thread_replies(p_thread_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_replies jsonb;
begin
  with recursive tree as (
    select r.id, r.thread_id, r.parent_id, r.creator_id, r.body, r.appreciated_count,
           r.created_at, 1 as depth,
           pr.name as author_name, pr.avatar_url as author_avatar, pr.role as author_role
    from public.reference_thread_replies r
    left join public.profiles pr on pr.id = r.creator_id
    where r.thread_id = p_thread_id and r.parent_id is null and r.status = 'published'
    union all
    select rr.id, rr.thread_id, rr.parent_id, rr.creator_id, rr.body, rr.appreciated_count,
           rr.created_at, t.depth + 1,
           pr.name, pr.avatar_url, pr.role
    from public.reference_thread_replies rr
    join tree t on rr.parent_id = t.id
    left join public.profiles pr on pr.id = rr.creator_id
    where rr.status = 'published' and t.depth < 3
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'parent_id', t.parent_id,
      'body', t.body,
      'appreciated_count', t.appreciated_count,
      'created_at', t.created_at,
      'depth', t.depth,
      'is_creator', (t.creator_id = v_auth_uid),
      'appreciated_by_me', exists(
        select 1 from public.reference_thread_appreciations a
        where a.target_type = 'reply' and a.target_id = t.id and a.user_id = v_auth_uid
      ),
      'author', jsonb_build_object('name', t.author_name, 'avatar_url', t.author_avatar, 'role', t.author_role)
    ) order by t.created_at asc
  ), '[]'::jsonb)
  into v_replies
  from tree t;

  return jsonb_build_object('replies', v_replies);
end $$;

revoke all on function public.list_thread_replies(uuid) from public, anon, authenticated;
grant execute on function public.list_thread_replies(uuid) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- reply_to_thread — enforce depth ≤ 3, status, reply_permission
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
  v_reply_permission text;
  v_depth int := 1;
  v_parent_depth int := 0;
  v_id uuid;
begin
  if btrim(coalesce(p_body, '')) = '' or char_length(p_body) > 2000 then
    raise exception 'INVALID_BODY' using errcode = '22023';
  end if;

  select status, reply_permission into v_thread_status, v_reply_permission
  from public.reference_threads where id = p_thread_id;
  if v_thread_status is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if v_thread_status != 'published' then raise exception 'THREAD_CLOSED' using errcode = 'P0001'; end if;
  if v_reply_permission = 'disabled' then raise exception 'REPLIES_DISABLED' using errcode = 'P0001'; end if;

  if p_parent_id is not null then
    with recursive ancestors as (
      select id, parent_id, 1 as depth from public.reference_thread_replies
      where id = p_parent_id and status = 'published'
      union all
      select r2.id, r2.parent_id, a.depth + 1 from public.reference_thread_replies r2
      join ancestors a on r2.id = a.parent_id where r2.status = 'published'
    )
    select max(depth) into v_parent_depth from ancestors;
    v_depth := v_parent_depth + 1;
    if v_depth > 3 then raise exception 'DEPTH_EXCEEDED' using errcode = 'P0001'; end if;
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
-- close_reference_thread / reopen_reference_thread
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.close_reference_thread(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_creator uuid;
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
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_creator uuid;
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
-- delete_reference_thread / delete_thread_reply — soft delete
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.delete_reference_thread(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_creator uuid;
begin
  select creator_id into v_creator from public.reference_threads where id = p_id;
  if v_creator is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if v_creator != uid then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  update public.reference_threads set status = 'deleted' where id = p_id;
  return jsonb_build_object('id', p_id, 'status', 'deleted');
end $$;

revoke all on function public.delete_reference_thread(uuid) from public, anon, authenticated;
grant execute on function public.delete_reference_thread(uuid) to authenticated;

create or replace function public.delete_thread_reply(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_creator uuid;
  v_thread_id uuid;
begin
  select creator_id, thread_id into v_creator, v_thread_id from public.reference_thread_replies where id = p_id;
  if v_creator is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if v_creator != uid then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  update public.reference_thread_replies set status = 'deleted', body = '' where id = p_id and status = 'published';
  update public.reference_threads set reply_count = greatest(reply_count - 1, 0) where id = v_thread_id;
  return jsonb_build_object('id', p_id, 'status', 'deleted');
end $$;

revoke all on function public.delete_thread_reply(uuid) from public, anon, authenticated;
grant execute on function public.delete_thread_reply(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- appreciate_reference / unappreciate_reference — upvote-only toggle
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.appreciate_reference(p_target_type text, p_target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_count int;
begin
  if p_target_type not in ('thread','reply') then raise exception 'INVALID_TARGET_TYPE' using errcode = '22023'; end if;

  -- Verify target exists
  if p_target_type = 'thread' then
    if not exists(select 1 from public.reference_threads where id = p_target_id and status in ('published','closed')) then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
  else
    if not exists(select 1 from public.reference_thread_replies where id = p_target_id and status = 'published') then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
  end if;

  insert into public.reference_thread_appreciations(user_id, target_type, target_id)
  values (uid, p_target_type, p_target_id)
  on conflict (target_type, target_id, user_id) do nothing;

  if p_target_type = 'thread' then
    update public.reference_threads set appreciated_count = (
      select count(*) from public.reference_thread_appreciations
      where target_type = 'thread' and target_id = p_target_id
    ) where id = p_target_id returning appreciated_count into v_count;
  else
    update public.reference_thread_replies set appreciated_count = (
      select count(*) from public.reference_thread_appreciations
      where target_type = 'reply' and target_id = p_target_id
    ) where id = p_target_id returning appreciated_count into v_count;
  end if;

  return jsonb_build_object(
    'target_type', p_target_type,
    'target_id', p_target_id,
    'appreciated_count', coalesce(v_count, 0),
    'appreciated_by_me', true
  );
end $$;

revoke all on function public.appreciate_reference(text, uuid) from public, anon, authenticated;
grant execute on function public.appreciate_reference(text, uuid) to authenticated;

create or replace function public.unappreciate_reference(p_target_type text, p_target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_count int;
begin
  if p_target_type not in ('thread','reply') then raise exception 'INVALID_TARGET_TYPE' using errcode = '22023'; end if;

  delete from public.reference_thread_appreciations
  where user_id = uid and target_type = p_target_type and target_id = p_target_id;

  if p_target_type = 'thread' then
    update public.reference_threads set appreciated_count = (
      select count(*) from public.reference_thread_appreciations
      where target_type = 'thread' and target_id = p_target_id
    ) where id = p_target_id returning appreciated_count into v_count;
  else
    update public.reference_thread_replies set appreciated_count = (
      select count(*) from public.reference_thread_appreciations
      where target_type = 'reply' and target_id = p_target_id
    ) where id = p_target_id returning appreciated_count into v_count;
  end if;

  return jsonb_build_object(
    'target_type', p_target_type,
    'target_id', p_target_id,
    'appreciated_count', coalesce(v_count, 0),
    'appreciated_by_me', false
  );
end $$;

revoke all on function public.unappreciate_reference(text, uuid) from public, anon, authenticated;
grant execute on function public.unappreciate_reference(text, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- report_reference_content — report a thread/reply/comment
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.report_reference_content(
  p_target_type text,
  p_target_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_id uuid;
begin
  if p_target_type not in ('thread','reply','comment') then raise exception 'INVALID_TARGET_TYPE' using errcode = '22023'; end if;
  if btrim(coalesce(p_reason, '')) = '' or char_length(p_reason) > 500 then
    raise exception 'INVALID_REASON' using errcode = '22023';
  end if;

  insert into public.reference_thread_reports(target_type, target_id, reporter_id, reason)
  values (p_target_type, p_target_id, uid, btrim(p_reason))
  on conflict (target_id, reporter_id) do update set reason = excluded.reason, status = 'pending'
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'status', 'pending');
end $$;

revoke all on function public.report_reference_content(text, uuid, text) from public, anon, authenticated;
grant execute on function public.report_reference_content(text, uuid, text) to authenticated;
