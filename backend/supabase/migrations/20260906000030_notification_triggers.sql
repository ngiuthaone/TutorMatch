-- 20260906000030_notification_triggers.sql
-- Add notification creation to post/comment/follow mutations.
set search_path = '';

-- ─────────────────────────────────────────────────────────────────────
-- like_post — notify post author
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.like_post(p_post_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_count int;
  v_author uuid;
  v_author_name text;
  v_post_title text;
begin
  if not exists(select 1 from public.posts where id = p_post_id and status = 'published') then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  insert into public.post_likes(post_id, user_id) values (p_post_id, uid)
  on conflict (post_id, user_id) do nothing;

  update public.posts set like_count = (select count(*) from public.post_likes where post_id = p_post_id) where id = p_post_id
  returning like_count into v_count;

  -- Notify post author (skip if liking own post)
  select author_id into v_author from public.posts where id = p_post_id;
  if v_author is not null and v_author != uid then
    select name into v_author_name from public.profiles where id = uid;
    insert into public.notifications(recipient_id, actor_id, type, entity_type, entity_id, message)
    values (v_author, uid, 'like', 'post', p_post_id, coalesce(v_author_name, 'Someone') || ' liked your post');
  end if;

  return jsonb_build_object('post_id', p_post_id, 'like_count', coalesce(v_count, 0), 'liked_by_me', true);
end $$;

revoke all on function public.like_post(uuid) from public, anon, authenticated;
grant execute on function public.like_post(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- create_comment — notify post author
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
  v_post_author uuid;
  v_comment_creator_name text;
begin
  if btrim(coalesce(p_body, '')) = '' or char_length(p_body) > 2000 then
    raise exception 'INVALID_BODY' using errcode = '22023';
  end if;
  if p_owner_type not in ('article','post') then
    raise exception 'INVALID_OWNER' using errcode = '22023';
  end if;

  if p_owner_type = 'post' then
    select p.status into v_owner_status from public.posts p where p.id = p_owner_id;
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

  -- Notify post author (skip if commenting on own post)
  if p_owner_type = 'post' then
    select author_id into v_post_author from public.posts where id = p_owner_id;
    if v_post_author is not null and v_post_author != uid then
      select name into v_comment_creator_name from public.profiles where id = uid;
      insert into public.notifications(recipient_id, actor_id, type, entity_type, entity_id, message)
      values (v_post_author, uid, 'comment', 'post', p_owner_id, coalesce(v_comment_creator_name, 'Someone') || ' commented on your post');
    end if;
  end if;

  -- Notify parent comment creator (skip if replying to own comment or same as post author)
  if p_parent_id is not null then
    declare
      v_parent_creator uuid;
    begin
      select creator_id into v_parent_creator from public.comments where id = p_parent_id;
      if v_parent_creator is not null and v_parent_creator != uid and v_parent_creator != coalesce(v_post_author, '00000000-0000-0000-0000-000000000000'::uuid) then
        select name into v_comment_creator_name from public.profiles where id = uid;
        insert into public.notifications(recipient_id, actor_id, type, entity_type, entity_id, message)
        values (v_parent_creator, uid, 'reply', 'comment', p_parent_id, coalesce(v_comment_creator_name, 'Someone') || ' replied to your comment');
      end if;
    end;
  end if;

  return jsonb_build_object('id', v_id, 'depth', v_depth, 'status', 'published');
end $$;

revoke all on function public.create_comment(text, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.create_comment(text, uuid, text, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- repost_post — notify post author
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.repost_post(p_post_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_count int;
  v_author uuid;
  v_reposter_name text;
begin
  if not exists(select 1 from public.posts where id = p_post_id and status = 'published') then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  insert into public.post_reposts(post_id, user_id) values (p_post_id, uid)
  on conflict (post_id, user_id) do nothing;
  update public.posts set repost_count = (select count(*) from public.post_reposts where post_id = p_post_id) where id = p_post_id
  returning repost_count into v_count;

  -- Notify post author (skip if reposting own post)
  select author_id into v_author from public.posts where id = p_post_id;
  if v_author is not null and v_author != uid then
    select name into v_reposter_name from public.profiles where id = uid;
    insert into public.notifications(recipient_id, actor_id, type, entity_type, entity_id, message)
    values (v_author, uid, 'repost', 'post', p_post_id, coalesce(v_reposter_name, 'Someone') || ' reposted your post');
  end if;

  return jsonb_build_object('post_id', p_post_id, 'repost_count', coalesce(v_count, 0), 'reposted_by_me', true);
end $$;

revoke all on function public.repost_post(uuid) from public, anon, authenticated;
grant execute on function public.repost_post(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- follow_user — notify followee
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.follow_user(p_followee_name text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_followee uuid;
  v_follower_name text;
begin
  select id into v_followee from public.profiles where name = p_followee_name;
  if v_followee is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if v_followee = uid then raise exception 'CANNOT_FOLLOW_SELF' using errcode = '22023'; end if;
  insert into public.follows(follower_id, followee_id) values (uid, v_followee)
  on conflict (follower_id, followee_id) do nothing;

  -- Notify followee
  select name into v_follower_name from public.profiles where id = uid;
  insert into public.notifications(recipient_id, actor_id, type, entity_type, entity_id, message)
  values (v_followee, uid, 'follow', 'post', v_followee, coalesce(v_follower_name, 'Someone') || ' started following you');

  return jsonb_build_object('followee', v_followee, 'following', true);
end $$;

revoke all on function public.follow_user(text) from public, anon, authenticated;
grant execute on function public.follow_user(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- appreciate_comment — notify comment author
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.appreciate_comment(p_comment_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_count int;
  v_comment_creator uuid;
  v_appreciator_name text;
begin
  if not exists(select 1 from public.comments where id = p_comment_id and status = 'published') then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  insert into public.comment_appreciations(comment_id, user_id) values (p_comment_id, uid)
  on conflict (comment_id, user_id) do nothing;
  update public.comments set appreciated_count = (select count(*) from public.comment_appreciations where comment_id = p_comment_id) where id = p_comment_id
  returning appreciated_count into v_count;

  -- Notify comment author (skip if appreciating own comment)
  select creator_id into v_comment_creator from public.comments where id = p_comment_id;
  if v_comment_creator is not null and v_comment_creator != uid then
    select name into v_appreciator_name from public.profiles where id = uid;
    insert into public.notifications(recipient_id, actor_id, type, entity_type, entity_id, message)
    values (v_comment_creator, uid, 'like', 'comment', p_comment_id, coalesce(v_appreciator_name, 'Someone') || ' appreciated your comment');
  end if;

  return jsonb_build_object('comment_id', p_comment_id, 'appreciated_count', coalesce(v_count, 0), 'appreciated_by_me', true);
end $$;

revoke all on function public.appreciate_comment(uuid) from public, anon, authenticated;
grant execute on function public.appreciate_comment(uuid) to authenticated;
