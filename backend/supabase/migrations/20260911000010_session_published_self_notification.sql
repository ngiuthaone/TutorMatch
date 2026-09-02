-- 20260911000010_session_published_self_notification.sql
-- When a tutor publishes a bookable session (sessions.status transitions to 'scheduled'),
-- emit a self-notification to the tutor via the existing public.notifications table.
--
-- The notifications type CHECK was previously extended to ('like','comment','reply','repost',
-- 'follow','new_message') and entity_type CHECK to ('post','article','comment','message').
-- We expand those CHECKs again to include 'session_published' (type) and 'session'
-- (entity_type). Because we are adding values to a CHECK, we use NOT VALID so we don't
-- have to scan existing rows. The trigger wraps in an exception handler so a
-- notification failure never aborts the session write.
set search_path = '';

-- 1. Expand the notifications CHECK constraints to allow session-publish self-notifications.
alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('like','comment','reply','repost','follow','new_message','session_published')) not valid;

alter table public.notifications
  drop constraint if exists notifications_entity_type_check;
alter table public.notifications
  add constraint notifications_entity_type_check
  check (entity_type in ('post','article','comment','message','session')) not valid;

-- 2. Trigger function.
create or replace function public.emit_session_published_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_tutor_user_id uuid;
  v_session_label text;
begin
  -- Fire on INSERT when new session is already 'scheduled', or on UPDATE when status
  -- transitions into 'scheduled' from any other value (or from null).
  if (tg_op = 'INSERT' and new.status = 'scheduled')
     or (tg_op = 'UPDATE' and old.status is distinct from 'scheduled' and new.status = 'scheduled') then
    v_tutor_user_id := new.host_id;
    if v_tutor_user_id is null then
      return new;
    end if;
    v_session_label := to_char(new.starts_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI "UTC"');
    insert into public.notifications(recipient_id, actor_id, type, entity_type, entity_id, message)
      values (
        v_tutor_user_id,
        v_tutor_user_id,
        'session_published',
        'session',
        new.id,
        'Your session on ' || v_session_label || ' is now bookable.'
      );
  end if;
  return new;
exception when others then
  raise warning 'emit_session_published_notification failed: %', SQLERRM;
  return new;
end $$;

revoke all on function public.emit_session_published_notification() from public, anon, authenticated;

-- 3. Trigger.
drop trigger if exists sessions_emit_session_published on public.sessions;
create trigger sessions_emit_session_published
  after insert or update of status on public.sessions
  for each row execute function public.emit_session_published_notification();
