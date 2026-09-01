-- 20260909000010_fix_message_notification_trigger.sql
-- Fix the messaging v2 notify_new_message trigger to use the actual
-- public.notifications schema (type / entity_type / message) instead
-- of event_type / source_type / payload, and add 'new_message' to the
-- allowed type enum. The original v2 trigger (20260909000000) used
-- non-existent columns and the type CHECK rejected 'new_message' as
-- not in ('like','comment','reply','repost','follow').
--
-- Without this fix, every send_message() that fires notify_new_message
-- raises column-does-not-exist (42703) inside the trigger, which
-- Supabase wraps in a 500 with no obvious cause. The original INSERT
-- into public.messages may still succeed depending on error handling, but
-- the recipient never gets a notification.
set search_path = '';

-- Extend the type enum to include 'new_message' so the trigger can
-- insert without violating the existing CHECK constraint.
do $$ begin
  alter table public.notifications
    drop constraint if exists notifications_type_check;
exception when others then null; end $$;

alter table public.notifications
  add constraint notifications_type_check
  check (type in ('like','comment','reply','repost','follow','new_message')) not valid;

-- Extend entity_type to include 'message' so a message notification has
-- a valid entity_type. The existing CHECK allows only post/article/comment.
do $$ begin
  alter table public.notifications
    drop constraint if exists notifications_entity_type_check;
exception when others then null; end $$;

alter table public.notifications
  add constraint notifications_entity_type_check
  check (entity_type in ('post','article','comment','message')) not valid;

-- Replace the broken trigger function with one that matches the real
-- schema. The mapping:
--   event_type    -> type = 'new_message'
--   source_type   -> entity_type = 'message'
--   source_id     -> entity_id = new.id (entity_id is unconstrained;
--                     notifications has FKs only on recipient_id and actor_id)
--   payload       -> flattened into message (preview) — there is no
--                     payload column on public.notifications
--   occurred_at   -> created_at
--   recipient_id  -> recipient_id
--   + actor_id     -> new.sender_id (the actor FK is set)
create or replace function public.notify_new_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  recipient uuid;
  sender_name text;
begin
  if new.deleted_at is not null then return new; end if;
  select name into sender_name from public.profiles where id = new.sender_id;
  for recipient in
    select cm.user_id from public.conversation_members cm
    where cm.conversation_id = new.conversation_id
      and cm.user_id <> new.sender_id
      and cm.archived_at is null
      and (cm.muted_at is null or cm.muted_at < new.created_at)
  loop
    insert into public.notifications(
      recipient_id, actor_id, type, entity_type, entity_id, message, read, created_at
    )
    values (
      recipient,
      new.sender_id,
      'new_message',
      'message',
      new.id,
      left(new.body, 200),
      false,
      new.created_at
    )
    on conflict do nothing;
  end loop;
  return new;
end $$;
revoke all on function public.notify_new_message() from public, anon, authenticated;

drop trigger if exists messages_notify_other_member on public.messages;
create trigger messages_notify_other_member
  after insert on public.messages
  for each row execute function public.notify_new_message();
