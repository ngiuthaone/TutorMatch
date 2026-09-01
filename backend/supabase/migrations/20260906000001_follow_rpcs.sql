-- 20260906000001_follow_rpcs.sql
-- Security-definer RPCs for follow/unfollow system.
set search_path = '';

-- ─────────────────────────────────────────────────────────────────────
-- follow_user
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.follow_user(p_followee_name text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_followee uuid;
begin
  select id into v_followee from public.profiles where name = p_followee_name;
  if v_followee is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if v_followee = uid then raise exception 'CANNOT_FOLLOW_SELF' using errcode = '22023'; end if;
  insert into public.follows(follower_id, followee_id) values (uid, v_followee)
  on conflict (follower_id, followee_id) do nothing;
  return jsonb_build_object('followee', v_followee, 'following', true);
end $$;

revoke all on function public.follow_user(text) from public, anon, authenticated;
grant execute on function public.follow_user(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- unfollow_user
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.unfollow_user(p_followee_name text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_followee uuid;
begin
  select id into v_followee from public.profiles where name = p_followee_name;
  if v_followee is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  delete from public.follows where follower_id = uid and followee_id = v_followee;
  return jsonb_build_object('followee', v_followee, 'following', false);
end $$;

revoke all on function public.unfollow_user(text) from public, anon, authenticated;
grant execute on function public.unfollow_user(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- is_following
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.is_following(p_followee_name text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_followee uuid;
  v_following boolean;
begin
  select id into v_followee from public.profiles where name = p_followee_name;
  if v_followee is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  select exists(select 1 from public.follows where follower_id = v_auth_uid and followee_id = v_followee) into v_following;
  return jsonb_build_object('following', v_following);
end $$;

revoke all on function public.is_following(text) from public, anon, authenticated;
grant execute on function public.is_following(text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- list_followers
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.list_followers(p_user_name text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_user uuid;
  v_auth_uid uuid := auth.uid();
begin
  select id into v_user from public.profiles where name = p_user_name;
  if v_user is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  return (
    select jsonb_build_object('followers', coalesce(jsonb_agg(
      jsonb_build_object(
        'name', pr.name,
        'avatar_url', pr.avatar_url,
        'role', pr.role,
        'is_following', exists(select 1 from public.follows f where f.follower_id = v_auth_uid and f.followee_id = pr.id)
      ) order by f.created_at desc
    ), '[]'::jsonb))
    from public.follows f
    join public.profiles pr on pr.id = f.follower_id
    where f.followee_id = v_user
  );
end $$;

revoke all on function public.list_followers(text) from public, anon, authenticated;
grant execute on function public.list_followers(text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- list_following
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.list_following(p_user_name text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_user uuid;
  v_auth_uid uuid := auth.uid();
begin
  select id into v_user from public.profiles where name = p_user_name;
  if v_user is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  return (
    select jsonb_build_object('following', coalesce(jsonb_agg(
      jsonb_build_object(
        'name', pr.name,
        'avatar_url', pr.avatar_url,
        'role', pr.role,
        'is_following', true
      ) order by f.created_at desc
    ), '[]'::jsonb))
    from public.follows f
    join public.profiles pr on pr.id = f.followee_id
    where f.follower_id = v_user
  );
end $$;

revoke all on function public.list_following(text) from public, anon, authenticated;
grant execute on function public.list_following(text) to anon, authenticated;
