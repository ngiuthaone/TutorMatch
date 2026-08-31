-- 20260905000001_post_rpcs.sql
-- Security-definer RPCs for posts CRUD, reposts, and appreciation.
set search_path = '';

-- ─────────────────────────────────────────────────────────────────────
-- create_post
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.create_post(
  p_body text,
  p_tags text[] default '{}',
  p_level text default null,
  p_post_type text default null,
  p_reply_permission text default 'everyone',
  p_community_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_id uuid;
begin
  if btrim(coalesce(p_body, '')) = '' then raise exception 'INVALID_BODY' using errcode = '22023'; end if;
  if char_length(p_body) > 5000 then raise exception 'BODY_TOO_LARGE' using errcode = '22023'; end if;
  if p_post_type is not null and p_post_type not in ('insight','question','tip','tutorial','experience','project','discussion') then
    raise exception 'INVALID_TYPE' using errcode = '22023';
  end if;
  if p_reply_permission is not null and p_reply_permission not in ('everyone','community_members','disabled') then
    raise exception 'INVALID_PERMISSION' using errcode = '22023';
  end if;

  insert into public.posts(author_id, body, tags, level, post_type, reply_permission, community_id, status)
  values (uid, btrim(p_body), coalesce(p_tags, '{}'), p_level, p_post_type, coalesce(p_reply_permission, 'everyone'), p_community_id, 'published')
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'status', 'published');
end $$;

revoke all on function public.create_post(text, text[], text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_post(text, text[], text, text, text, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- update_post — author only, published posts can update body/tags/metadata
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.update_post(
  p_id uuid,
  p_body text default null,
  p_tags text[] default null,
  p_level text default null,
  p_post_type text default null,
  p_reply_permission text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_author uuid;
begin
  select author_id into v_author from public.posts where id = p_id;
  if v_author is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if v_author != uid then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  if p_body is not null and char_length(p_body) > 5000 then
    raise exception 'BODY_TOO_LARGE' using errcode = '22023';
  end if;

  update public.posts set
    body = coalesce(btrim(p_body), body),
    tags = coalesce(p_tags, tags),
    level = coalesce(p_level, level),
    post_type = coalesce(p_post_type, post_type),
    reply_permission = coalesce(p_reply_permission, reply_permission)
  where id = p_id;

  return jsonb_build_object('id', p_id, 'status', 'published');
end $$;

revoke all on function public.update_post(uuid, text, text[], text, text, text) from public, anon, authenticated;
grant execute on function public.update_post(uuid, text, text[], text, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- delete_post — author only, soft-delete
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.delete_post(p_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := public.assert_verified_booking_caller(); v_author uuid;
begin
  select author_id into v_author from public.posts where id = p_id;
  if v_author is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if v_author != uid then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  update public.posts set status = 'deleted' where id = p_id and status = 'published';
  return jsonb_build_object('id', p_id, 'status', 'deleted');
end $$;
revoke all on function public.delete_post(uuid) from public, anon, authenticated;
grant execute on function public.delete_post(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- get_public_post — public, published only, strips author_id
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.get_public_post(p_id uuid)
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
    'id', p.id,
    'body', p.body,
    'tags', p.tags,
    'level', p.level,
    'post_type', p.post_type,
    'reply_permission', p.reply_permission,
    'repost_count', p.repost_count,
    'created_at', p.created_at,
    'updated_at', p.updated_at,
    'is_author', (p.author_id = v_auth_uid),
    'reposted_by_me', exists(select 1 from public.post_reposts r where r.post_id = p.id and r.user_id = v_auth_uid),
    'author', jsonb_build_object('name', pr.name, 'avatar_url', pr.avatar_url, 'role', pr.role)
  )
  into v_row
  from public.posts p
  left join public.profiles pr on pr.id = p.author_id
  where p.id = p_id and p.status = 'published';

  return v_row;
end $$;

revoke all on function public.get_public_post(uuid) from public, anon, authenticated;
grant execute on function public.get_public_post(uuid) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- list_public_posts — public, paginated by created_at desc
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.list_public_posts(
  p_cursor text default null,
  p_limit integer default 20,
  p_tag text default null,
  p_post_type text default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit int := least(coalesce(p_limit, 20), 50);
  v_posts jsonb;
  v_next_cursor text;
begin
  select coalesce(jsonb_agg(t.obj order by t.created_at desc), '[]'::jsonb)
  into v_posts
  from (
    select jsonb_build_object(
      'id', p.id,
      'body', p.body,
      'tags', p.tags,
      'level', p.level,
      'post_type', p.post_type,
      'reply_permission', p.reply_permission,
      'repost_count', p.repost_count,
      'created_at', p.created_at,
      'author', jsonb_build_object('name', pr.name, 'avatar_url', pr.avatar_url, 'role', pr.role)
    ) obj, p.created_at
    from public.posts p
    left join public.profiles pr on pr.id = p.author_id
    where p.status = 'published'
      and (p_cursor is null or p.created_at < to_timestamp(p_cursor::double precision / 1000.0))
      and (p_tag is null or p_tag = any(p.tags))
      and (p_post_type is null or p.post_type = p_post_type)
    order by p.created_at desc
    limit v_limit
  ) t;

  select t.created_at into v_next_cursor
  from (
    select p.created_at
    from public.posts p
    where p.status = 'published'
      and (p_cursor is null or p.created_at < to_timestamp(p_cursor::double precision / 1000.0))
      and (p_tag is null or p_tag = any(p.tags))
      and (p_post_type is null or p.post_type = p_post_type)
    order by p.created_at desc
    limit 1 offset v_limit
  ) t;

  return jsonb_build_object(
    'posts', v_posts,
    'next_cursor', case when v_next_cursor is not null then extract(epoch from v_next_cursor) * 1000.0 end
  );
end $$;

revoke all on function public.list_public_posts(text, integer, text, text) from public, anon, authenticated;
grant execute on function public.list_public_posts(text, integer, text, text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- list_my_posts — author's own posts
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.list_my_posts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'UNAUTHENTICATED' using errcode = '42501'; end if;
  return (
    select jsonb_build_object('posts', coalesce(jsonb_agg(
      jsonb_build_object(
        'id', p.id, 'body', p.body, 'tags', p.tags, 'status', p.status,
        'repost_count', p.repost_count, 'created_at', p.created_at, 'updated_at', p.updated_at
      ) order by p.created_at desc
    ), '[]'::jsonb))
    from public.posts p
    where p.author_id = uid and p.status in ('draft','published')
  );
end $$;

revoke all on function public.list_my_posts() from public, anon, authenticated;
grant execute on function public.list_my_posts() to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- repost_post / unrepost_post
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.repost_post(p_post_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := public.assert_verified_booking_caller(); v_count int;
begin
  if not exists(select 1 from public.posts where id = p_post_id and status = 'published') then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  insert into public.post_reposts(post_id, user_id) values (p_post_id, uid)
  on conflict (post_id, user_id) do nothing;
  update public.posts set repost_count = (select count(*) from public.post_reposts where post_id = p_post_id) where id = p_post_id
  returning repost_count into v_count;
  return jsonb_build_object('post_id', p_post_id, 'repost_count', coalesce(v_count, 0), 'reposted_by_me', true);
end $$;
revoke all on function public.repost_post(uuid) from public, anon, authenticated;
grant execute on function public.repost_post(uuid) to authenticated;

create or replace function public.unrepost_post(p_post_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := public.assert_verified_booking_caller(); v_count int;
begin
  delete from public.post_reposts where user_id = uid and post_id = p_post_id;
  update public.posts set repost_count = (select count(*) from public.post_reposts where post_id = p_post_id) where id = p_post_id
  returning repost_count into v_count;
  return jsonb_build_object('post_id', p_post_id, 'repost_count', coalesce(v_count, 0), 'reposted_by_me', false);
end $$;
revoke all on function public.unrepost_post(uuid) from public, anon, authenticated;
grant execute on function public.unrepost_post(uuid) to authenticated;
