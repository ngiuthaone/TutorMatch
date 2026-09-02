-- 20260909000007_list_message_attachments.sql
-- SEC-DEF-RPC: list attachments for a single message, scoped to the
-- caller's conversation membership. Returns id, storage_path, filename,
-- mime_type, size_bytes, created_at. Signed URLs are fetched client-side
-- via the storage SDK so this RPC stays small and the per-file signed-URL
-- TTL is independent of the messaging list endpoint.
set search_path = '';

create or replace function public.list_message_attachments(p_message_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  m public.messages%rowtype;
  rows jsonb;
begin
  if uid is null then raise insufficient_privilege; end if;
  select * into m from public.messages where id = p_message_id;
  if m.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if not public.is_conversation_member(m.conversation_id) then raise insufficient_privilege; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ma.id,
    'messageId', ma.message_id,
    'storageBucket', ma.storage_bucket,
    'storagePath', ma.storage_path,
    'filename', ma.filename,
    'mimeType', ma.mime_type,
    'sizeBytes', ma.size_bytes,
    'createdAt', ma.created_at
  ) order by ma.created_at), '[]'::jsonb)
    into rows
  from public.message_attachments ma
  where ma.message_id = p_message_id;
  return rows;
end $$;
revoke all on function public.list_message_attachments(uuid) from public, anon, authenticated;
grant execute on function public.list_message_attachments(uuid) to authenticated;
