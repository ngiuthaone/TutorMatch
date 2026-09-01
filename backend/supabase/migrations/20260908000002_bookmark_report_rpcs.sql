-- 20260908000002_bookmark_report_rpcs.sql
-- RPCs for bookmarks and post/article reports.
set search_path = '';

-- ─────────────────────────────────────────────────────────────────────
-- bookmark_add
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.bookmark_add(
  p_target_type text,
  p_target_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_id uuid;
begin
  if p_target_type not in ('post','article','thread') then
    raise exception 'INVALID_TARGET_TYPE' using errcode = '22023';
  end if;
  insert into public.bookmarks(user_id, target_type, target_id)
  values (uid, p_target_type, p_target_id)
  on conflict (user_id, target_type, target_id) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.bookmarks
    where user_id = uid and target_type = p_target_type and target_id = p_target_id;
  end if;
  return jsonb_build_object('id', v_id, 'target_type', p_target_type, 'target_id', p_target_id);
end $$;

revoke all on function public.bookmark_add(text, uuid) from public, anon, authenticated;
grant execute on function public.bookmark_add(text, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- bookmark_remove
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.bookmark_remove(
  p_target_type text,
  p_target_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
begin
  delete from public.bookmarks
  where user_id = uid and target_type = p_target_type and target_id = p_target_id;
  return jsonb_build_object('removed', true);
end $$;

revoke all on function public.bookmark_remove(text, uuid) from public, anon, authenticated;
grant execute on function public.bookmark_remove(text, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- list_bookmarks
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.list_bookmarks(
  p_cursor text default null,
  p_limit integer default 30
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_limit int := least(coalesce(p_limit, 30), 100);
  v_items jsonb;
  v_next_cursor text;
begin
  if uid is null then raise exception 'UNAUTHENTICATED' using errcode = '42501'; end if;

  select coalesce(jsonb_agg(t.obj order by t.created_at desc), '[]'::jsonb)
  into v_items
  from (
    select jsonb_build_object(
      'id', b.id,
      'target_type', b.target_type,
      'target_id', b.target_id,
      'created_at', b.created_at
    ) obj, b.created_at
    from public.bookmarks b
    where b.user_id = uid
      and (p_cursor is null or b.created_at < to_timestamp(p_cursor::double precision / 1000.0))
    order by b.created_at desc
    limit v_limit
  ) t;

  select t.created_at into v_next_cursor
  from (
    select b.created_at from public.bookmarks b
    where b.user_id = uid
    order by b.created_at desc limit 1 offset v_limit
  ) t;

  return jsonb_build_object(
    'bookmarks', v_items,
    'next_cursor', case when v_next_cursor is not null then extract(epoch from v_next_cursor::timestamptz) * 1000.0 end
  );
end $$;

revoke all on function public.list_bookmarks(text, integer) from public, anon, authenticated;
grant execute on function public.list_bookmarks(text, integer) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- report_post / report_article
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.report_post(p_post_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_id uuid;
begin
  if btrim(coalesce(p_reason, '')) = '' or char_length(p_reason) > 500 then
    raise exception 'INVALID_REASON' using errcode = '22023';
  end if;
  if not exists(select 1 from public.posts where id = p_post_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  insert into public.post_reports(post_id, reporter_id, reason)
  values (p_post_id, uid, btrim(p_reason))
  on conflict (post_id, reporter_id) do update set reason = excluded.reason, status = 'pending'
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'status', 'pending');
end $$;

revoke all on function public.report_post(uuid, text) from public, anon, authenticated;
grant execute on function public.report_post(uuid, text) to authenticated;

create or replace function public.report_article(p_article_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_id uuid;
begin
  if btrim(coalesce(p_reason, '')) = '' or char_length(p_reason) > 500 then
    raise exception 'INVALID_REASON' using errcode = '22023';
  end if;
  if not exists(select 1 from public.articles where id = p_article_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  insert into public.article_reports(article_id, reporter_id, reason)
  values (p_article_id, uid, btrim(p_reason))
  on conflict (article_id, reporter_id) do update set reason = excluded.reason, status = 'pending'
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'status', 'pending');
end $$;

revoke all on function public.report_article(uuid, text) from public, anon, authenticated;
grant execute on function public.report_article(uuid, text) to authenticated;
