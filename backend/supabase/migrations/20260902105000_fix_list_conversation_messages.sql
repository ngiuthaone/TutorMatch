-- 20260902105000_fix_list_conversation_messages.sql
-- Live DB repaired E2E: soft_delete_message now works (body='[deleted]'),
-- but list_conversation_messages on the live DB was a stale version created
-- by an out-of-band migration (product: no deleted_at filter, missing
-- deletedAt/editedAt/messageType fields), so soft-deleted messages stayed
-- visible to members after delete. Re-apply the authoritative definition
-- from 20260904120000_messaging_alpha_v1.sql so the live schema matches the
-- repo contract:
--   * soft-deleted rows (deleted_at is not null) are excluded from the list
--   * deletedAt / editedAt / messageType are returned for the client
set search_path = '';

create or replace function public.list_conversation_messages(cid uuid, p_limit int default 100, p_before timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); rows jsonb; lim int;
begin
  if uid is null then raise insufficient_privilege; end if;
  if not public.is_conversation_member(cid) then raise insufficient_privilege; end if;
  lim := greatest(1, least(coalesce(p_limit, 100), 200));
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'senderId', m.sender_id,
    'mine', m.sender_id = uid,
    'body', m.body,
    'createdAt', m.created_at,
    'editedAt', m.edited_at,
    'deletedAt', m.deleted_at,
    'messageType', m.message_type,
    'moderationStatus', m.moderation_status
  ) order by m.created_at asc), '[]'::jsonb)
    into rows
  from (
    select * from public.messages m
    where m.conversation_id = cid
      and m.deleted_at is null
      and (p_before is null or m.created_at < p_before)
    order by m.created_at desc
    limit lim
  ) m;
  return rows;
end;
$$;
revoke all on function public.list_conversation_messages(uuid, int, timestamptz) from public, anon, authenticated;
grant execute on function public.list_conversation_messages(uuid, int, timestamptz) to authenticated;