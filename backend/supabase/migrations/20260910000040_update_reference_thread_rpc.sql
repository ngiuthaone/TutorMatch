-- 20260910000040_update_reference_thread_rpc.sql
-- update_reference_thread — author only, mirrors update_post semantics
-- Cloned from 20260905000030_post_rpcs.sql update_post
set search_path = '';

-- ─────────────────────────────────────────────────────────────────────
-- update_reference_thread
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.update_reference_thread(
  p_id uuid,
  p_title text default null,
  p_body text default null,
  p_tags text[] default null,
  p_level text default null,
  p_visibility text default null,
  p_reply_permission text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_creator uuid;
  v_status text;
  v_community_id uuid;
begin
  select creator_id, status, community_id into v_creator, v_status, v_community_id
  from public.reference_threads where id = p_id;
  if v_creator is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if v_creator != uid then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if v_status = 'removed' then raise exception 'THREAD_REMOVED' using errcode = 'P0001'; end if;
  if v_status = 'closed' or v_status = 'deleted' then raise exception 'THREAD_LOCKED' using errcode = 'P0001'; end if;

  -- Community membership check if thread is in a community
  if v_community_id is not null then
    if not exists(
      select 1 from public.community_members
      where community_id = v_community_id and user_id = uid and status = 'active'
    ) then
      raise exception 'COMMUNITY_ACCESS_DENIED' using errcode = '42501';
    end if;
  end if;

  if p_title is not null and (btrim(p_title) = '' or char_length(p_title) > 200) then
    raise exception 'INVALID_TITLE' using errcode = '22023';
  end if;
  if p_body is not null and char_length(p_body) > 2000 then
    raise exception 'BODY_TOO_LONG' using errcode = '22023';
  end if;
  if p_visibility is not null and p_visibility not in ('public','community') then
    raise exception 'INVALID_VISIBILITY' using errcode = '22023';
  end if;
  if p_reply_permission is not null and p_reply_permission not in ('everyone','community_members','disabled') then
    raise exception 'INVALID_REPLY_PERMISSION' using errcode = '22023';
  end if;
  if p_level is not null and p_level not in ('complete_beginner','beginner','intermediate','advanced','all_levels') then
    raise exception 'INVALID_LEVEL' using errcode = '22023';
  end if;

  update public.reference_threads set
    title = coalesce(btrim(p_title), title),
    body = case when p_body is null then body else p_body end,
    tags = coalesce(p_tags, tags),
    level = coalesce(p_level, level),
    visibility = coalesce(p_visibility, visibility),
    reply_permission = coalesce(p_reply_permission, reply_permission)
  where id = p_id;

  return jsonb_build_object('id', p_id, 'status', 'published');
end $$;

revoke all on function public.update_reference_thread(uuid, text, text, text[], text, text, text) from public, anon, authenticated;
grant execute on function public.update_reference_thread(uuid, text, text, text[], text, text, text) to authenticated;
