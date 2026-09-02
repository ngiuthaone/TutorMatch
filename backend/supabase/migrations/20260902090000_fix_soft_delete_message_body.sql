-- 20260902090000_fix_soft_delete_message_body.sql
-- soft_delete_message set body = '' for soft-deleted rows, but the messages
-- table constrains body to char_length between 1 and 2000. Empty body raises
-- 23514 (check constraint messages_body_check), which the API surfaces as 503
-- MESSAGING_UNAVAILABLE, so in-app message Delete always failed.
--
-- Fix: soft-delete to a non-empty placeholder (length 9, satisfies the check)
-- while preserving the row for audit/moderation. Member reads already filter
-- deleted_at is null; admin reads still see the row with a placeholder.
set search_path = '';

create or replace function public.soft_delete_message(p_message_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  m public.messages%rowtype;
begin
  if uid is null then raise insufficient_privilege; end if;
  select * into m from public.messages where id = p_message_id for update;
  if m.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if m.sender_id <> uid then raise insufficient_privilege; end if;
  update public.messages
    set deleted_at = now(), body = '[deleted]'
    where id = p_message_id;
  return jsonb_build_object('id', p_message_id, 'deletedAt', now(), 'mine', true);
end $$;
revoke all on function public.soft_delete_message(uuid) from public, anon, authenticated;
grant execute on function public.soft_delete_message(uuid) to authenticated;