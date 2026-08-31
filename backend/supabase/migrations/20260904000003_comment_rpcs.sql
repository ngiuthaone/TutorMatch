-- 20260904000003_comment_rpcs.sql
-- Security-definer RPCs for the shared comments table (used by both threads
-- and articles). Enforces depth cap, owner published/open, comments_enabled.
--
-- Contract: docs/REFERENCE_THREADS_PROMPT.md (Security-definer RPCs — Comments).
set search_path = '';

create or replace function public._comment_max_depth() returns integer language sql immutable as $$ select 3; $$;

-- ─────────────────────────────────────────────────────────────────────
-- create_comment
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.create_comment(
  p_owner_type text,
  p_owner_id uuid,
  p_body text,
  p_parent_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_owner_status text;
  v_comments_enabled boolean := true;
  v_depth int := 1;
  v_parent_depth int := 0;
  v_parent_owner_id uuid;
  v_parent_status text;
  v_id uuid;
begin
  if btrim(coalesce(p_body, '')) = '' or char_length(p_body) > 2000 then
    raise exception 'INVALID_BODY' using errcode = '22023';
  end if;
  if p_owner_type not in ('thread','article') then
    raise exception 'INVALID_OWNER' using errcode = '22023';
  end if;

  if p_owner_type = 'thread' then
    select rt.status into v_owner_status from public.reference_threads rt where rt.id = p_owner_id;
    if v_owner_status is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
    if v_owner_status != 'published' then raise exception 'OWNER_CLOSED' using errcode = 'P0001'; end if;
  else
    select a.status, a.comments_enabled into v_owner_status, v_comments_enabled from public.articles a where a.id = p_owner_id;
    if v_owner_status is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
    if v_owner_status != 'published' then raise exception 'OWNER_CLOSED' using errcode = 'P0001'; end if;
    if not coalesce(v_comments_enabled, true) then raise exception 'COMMENTS_DISABLED' using errcode = 'P0001'; end if;
  end if;

  if p_parent_id is not null then
    select c.owner_id, c.status into v_parent_owner_id, v_parent_status from public.comments c where c.id = p_parent_id;
    if v_parent_owner_id is null or v_parent_owner_id != p_owner_id then
      raise exception 'PARENT_NOT_FOUND' using errcode = 'P0001';
    end if;
    if v_parent_status != 'published' then raise exception 'PARENT_DELETED' using errcode = 'P0001'; end if;
    -- Compute parent depth by walking ancestors (published-only so a deleted
    -- ancestor can't inflate depth or orphan the new comment).
    with recursive ancestors as (
      select c.id, c.parent_id, 1 as depth from public.comments c where c.id = p_parent_id and c.status = 'published'
      union all
      select c2.id, c2.parent_id, a.depth + 1 from public.comments c2 join ancestors a on c2.id = a.parent_id where c2.status = 'published'
    )
    select max(depth) into v_parent_depth from ancestors;
    v_depth := v_parent_depth + 1;
    if v_depth > public._comment_max_depth() then raise exception 'DEPTH_EXCEEDED' using errcode = 'P0001'; end if;
  end if;

  insert into public.comments(parent_id, owner_type, owner_id, creator_id, body, status)
  values (p_parent_id, p_owner_type, p_owner_id, uid, btrim(p_body), 'published')
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'depth', v_depth, 'status', 'published');
end $$;

revoke all on function public.create_comment(text, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.create_comment(text, uuid, text, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- delete_comment — creator only, soft-delete preserving children
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.delete_comment(p_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := public.assert_verified_booking_caller(); v_creator uuid;
begin
  select creator_id into v_creator from public.comments where id = p_id;
  if v_creator is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if v_creator != uid then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  update public.comments set status = 'deleted', body = '' where id = p_id and status = 'published';
  return jsonb_build_object('id', p_id, 'status', 'deleted');
end $$;
revoke all on function public.delete_comment(uuid) from public, anon, authenticated;
grant execute on function public.delete_comment(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- appreciate_comment / unappreciate_comment
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.appreciate_comment(p_comment_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := public.assert_verified_booking_caller(); v_count int;
begin
  if not exists(select 1 from public.comments where id = p_comment_id and status = 'published') then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  insert into public.reference_thread_appreciations(user_id, target_type, target_id)
  values (uid, 'reply', p_comment_id)
  on conflict (target_type, target_id, user_id) do nothing;
  update public.comments set appreciated_count = (select count(*) from public.reference_thread_appreciations where target_type = 'reply' and target_id = p_comment_id) where id = p_comment_id
  returning appreciated_count into v_count;
  return jsonb_build_object('comment_id', p_comment_id, 'appreciated_count', coalesce(v_count, 0), 'appreciated_by_me', true);
end $$;
revoke all on function public.appreciate_comment(uuid) from public, anon, authenticated;
grant execute on function public.appreciate_comment(uuid) to authenticated;

create or replace function public.unappreciate_comment(p_comment_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := public.assert_verified_booking_caller(); v_count int;
begin
  delete from public.reference_thread_appreciations where user_id = uid and target_type = 'reply' and target_id = p_comment_id;
  update public.comments set appreciated_count = (select count(*) from public.reference_thread_appreciations where target_type = 'reply' and target_id = p_comment_id) where id = p_comment_id
  returning appreciated_count into v_count;
  return jsonb_build_object('comment_id', p_comment_id, 'appreciated_count', coalesce(v_count, 0), 'appreciated_by_me', false);
end $$;
revoke all on function public.unappreciate_comment(uuid) from public, anon, authenticated;
grant execute on function public.unappreciate_comment(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- list_comments — public, returns nested tree for an owner
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.list_comments(p_owner_type text, p_owner_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_comments jsonb;
begin
  select coalesce(jsonb_agg(t.obj order by t.created_at asc), '[]'::jsonb)
  into v_comments
  from (
    with recursive tree as (
      select c.id, c.parent_id, c.body, c.creator_id, c.appreciated_count, c.created_at, 1 as depth,
             p.name as author_name, p.avatar_url as author_avatar, p.role as author_role
      from public.comments c
      left join public.profiles p on p.id = c.creator_id
      where c.owner_type = p_owner_type and c.owner_id = p_owner_id and c.parent_id is null and c.status = 'published'
      union all
      select cc.id, cc.parent_id, cc.body, cc.creator_id, cc.appreciated_count, cc.created_at, t.depth + 1,
             p.name, p.avatar_url, p.role
      from public.comments cc
      join tree t on cc.parent_id = t.id
      left join public.profiles p on p.id = cc.creator_id
      where cc.status = 'published' and t.depth < public._comment_max_depth()
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
  ) t;

  return jsonb_build_object('comments', v_comments);
end $$;

revoke all on function public.list_comments(text, uuid) from public, anon, authenticated;
grant execute on function public.list_comments(text, uuid) to anon, authenticated;
