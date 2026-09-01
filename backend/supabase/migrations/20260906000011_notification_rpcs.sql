-- 20260906000011_notification_rpcs.sql
-- Security-definer RPCs for notifications.
set search_path = '';

-- ─────────────────────────────────────────────────────────────────────
-- create_notification — system RPC called by triggers
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.create_notification(
  p_recipient_id uuid,
  p_actor_id uuid,
  p_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_message text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.notifications(recipient_id, actor_id, type, entity_type, entity_id, message)
  values (p_recipient_id, p_actor_id, p_type, p_entity_type, p_entity_id, p_message)
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.create_notification(uuid, uuid, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.create_notification(uuid, uuid, text, text, uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- list_notifications — authenticated user's notifications
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.list_notifications(p_cursor text default null, p_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_limit int := least(coalesce(p_limit, 20), 50);
  v_notifications jsonb;
  v_next_cursor text;
begin
  if uid is null then raise exception 'UNAUTHENTICATED' using errcode = '42501'; end if;

  select coalesce(jsonb_agg(t.obj order by t.created_at desc), '[]'::jsonb)
  into v_notifications
  from (
    select jsonb_build_object(
      'id', n.id,
      'type', n.type,
      'entity_type', n.entity_type,
      'entity_id', n.entity_id,
      'message', n.message,
      'read', n.read,
      'created_at', n.created_at,
      'actor', case when n.actor_id is not null then jsonb_build_object(
        'name', pr.name,
        'avatar_url', pr.avatar_url,
        'role', pr.role
      ) end
    ) obj, n.created_at
    from public.notifications n
    left join public.profiles pr on pr.id = n.actor_id
    where n.recipient_id = uid
      and (p_cursor is null or n.created_at < to_timestamp(p_cursor::double precision / 1000.0))
    order by n.created_at desc
    limit v_limit
  ) t;

  select t.created_at into v_next_cursor
  from (
    select n.created_at
    from public.notifications n
    where n.recipient_id = uid
      and (p_cursor is null or n.created_at < to_timestamp(p_cursor::double precision / 1000.0))
    order by n.created_at desc
    limit 1 offset v_limit
  ) t;

  return jsonb_build_object(
    'notifications', v_notifications,
    'next_cursor', case when v_next_cursor is not null then extract(epoch from v_next_cursor::timestamptz) * 1000.0 end
  );
end $$;

revoke all on function public.list_notifications(text, integer) from public, anon, authenticated;
grant execute on function public.list_notifications(text, integer) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- get_unread_notification_count
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.get_unread_notification_count()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'UNAUTHENTICATED' using errcode = '42501'; end if;
  return (
    select jsonb_build_object('count', count(*))
    from public.notifications
    where recipient_id = uid and read = false
  );
end $$;

revoke all on function public.get_unread_notification_count() from public, anon, authenticated;
grant execute on function public.get_unread_notification_count() to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- mark_notification_read
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.mark_notification_read(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'UNAUTHENTICATED' using errcode = '42501'; end if;
  update public.notifications set read = true where id = p_id and recipient_id = uid;
  return jsonb_build_object('id', p_id, 'read', true);
end $$;

revoke all on function public.mark_notification_read(uuid) from public, anon, authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- mark_all_notifications_read
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.mark_all_notifications_read()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'UNAUTHENTICATED' using errcode = '42501'; end if;
  update public.notifications set read = true where recipient_id = uid and read = false;
  return jsonb_build_object('success', true);
end $$;

revoke all on function public.mark_all_notifications_read() from public, anon, authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
