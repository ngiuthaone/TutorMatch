-- 20260908000004_follow_by_user_id.sql
-- Add follow RPC variants that take a followee user_id (uuid) directly
-- instead of a username (text). The text variants remain in place for
-- backward compatibility but should be deprecated in the discover UI in
-- favor of these user-id-based calls, which prevent username enumeration
-- and align with the rest of the auth model.
--
-- The user-id variants are subject to the same
-- assert_verified_booking_caller() gate as the text variants.
set search_path = '';

create or replace function public.follow_user_by_id(p_followee_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.assert_verified_booking_caller();
begin
  if p_followee_id is null then raise exception 'INVALID_REQUEST' using errcode = '22023'; end if;
  if p_followee_id = uid then raise exception 'CANNOT_FOLLOW_SELF' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where id = p_followee_id) then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  insert into public.follows(follower_id, followee_id) values (uid, p_followee_id)
    on conflict (follower_id, followee_id) do nothing;
  return jsonb_build_object('followee', p_followee_id, 'following', true);
end $$;

revoke all on function public.follow_user_by_id(uuid) from public, anon, authenticated;
grant execute on function public.follow_user_by_id(uuid) to authenticated;

create or replace function public.unfollow_user_by_id(p_followee_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.assert_verified_booking_caller();
begin
  if p_followee_id is null then raise exception 'INVALID_REQUEST' using errcode = '22023'; end if;
  delete from public.follows where follower_id = uid and followee_id = p_followee_id;
  return jsonb_build_object('followee', p_followee_id, 'following', false);
end $$;

revoke all on function public.unfollow_user_by_id(uuid) from public, anon, authenticated;
grant execute on function public.unfollow_user_by_id(uuid) to authenticated;

create or replace function public.is_following_by_id(p_followee_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  v_following boolean;
begin
  if uid is null or p_followee_id is null then return jsonb_build_object('following', false); end if;
  select exists(select 1 from public.follows where follower_id = uid and followee_id = p_followee_id) into v_following;
  return jsonb_build_object('following', v_following);
end $$;

revoke all on function public.is_following_by_id(uuid) from public, anon, authenticated;
grant execute on function public.is_following_by_id(uuid) to authenticated;
