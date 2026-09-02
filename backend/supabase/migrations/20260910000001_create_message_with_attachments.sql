-- 20260910000001_create_message_with_attachments.sql
-- SEC-DEF-RPC: create a message with optional attachments in a single
-- transaction. Adapted from chatly's create-msg-attachment edge function
-- (MIT, 20260513045749). Tutoria runs this as an RPC for simpler
-- authorization (no edge-function deploy required) and to keep the
-- caller in a single transaction.
--
-- Idempotency: pass client_message_id. The same (sender_id, client_message_id)
-- pair in the same conversation re-uses the persisted message and links
-- any new attachments to the existing message. Different conversation
-- with the same client_message_id raises IDEMPOTENCY_CONFLICT.
set search_path = '';

create or replace function public.create_message_with_attachments(
  p_conversation_id uuid,
  p_client_message_id text,
  p_body text,
  p_message_type text default 'text',
  p_attachments jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  m public.messages%rowtype;
  trimmed text;
  attachment jsonb;
  attachment_id uuid;
  attachment_count int := jsonb_array_length(p_attachments);
  i int;
  result jsonb;
begin
  if uid is null then raise insufficient_privilege; end if;
  if p_client_message_id is null or btrim(p_client_message_id) = '' or
     char_length(p_client_message_id) < 8 or char_length(p_client_message_id) > 128 then
    raise exception 'INVALID_MESSAGE' using errcode = '22023';
  end if;
  trimmed := btrim(coalesce(p_body, ''));
  if p_message_type not in ('text','image','file','media','system') then
    raise exception 'INVALID_MESSAGE' using errcode = '22023';
  end if;
  -- Text messages: body is required. Non-text messages: body may be empty
  -- (the attachment list is the message).
  if p_message_type = 'text' and (char_length(trimmed) < 1 or char_length(trimmed) > 2000) then
    raise exception 'INVALID_MESSAGE' using errcode = '22023';
  end if;
  if p_message_type <> 'text' and (char_length(trimmed) < 0 or char_length(trimmed) > 2000) then
    raise exception 'INVALID_MESSAGE' using errcode = '22023';
  end if;
  if not public.is_conversation_member(p_conversation_id) then
    raise insufficient_privilege;
  end if;
  -- Block enforcement (mirror send_message)
  if exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = p_conversation_id and cm.user_id <> uid
      and (public.is_blocked(uid, cm.user_id) or public.is_blocked(cm.user_id, uid))
  ) then
    raise exception 'BLOCKED' using errcode = '42501';
  end if;
  -- Idempotency
  select * into m from public.messages
    where sender_id = uid and client_message_id = btrim(p_client_message_id);
  if m.id is not null then
    if m.conversation_id <> p_conversation_id then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode = '23505';
    end if;
    -- Link any new attachments to the existing message
    if attachment_count > 0 then
      for i in 0..attachment_count - 1 loop
        attachment := p_attachments -> i;
        insert into public.message_attachments(
          message_id, storage_bucket, storage_path, filename, mime_type, size_bytes
        )
        values (
          m.id,
          coalesce(attachment->>'storage_bucket', 'message-attachments'),
          attachment->>'storage_path',
          attachment->>'filename',
          attachment->>'mime_type',
          (attachment->>'size_bytes')::bigint
        )
        returning id into attachment_id;
      end loop;
    end if;
    return jsonb_build_object(
      'id', m.id, 'senderId', m.sender_id, 'mine', true,
      'body', m.body, 'createdAt', m.created_at,
      'moderationStatus', m.moderation_status,
      'messageType', m.message_type,
      'duplicate', true
    );
  end if;
  -- Insert the message
  insert into public.messages(
    conversation_id, sender_id, client_message_id, body, message_type, moderation_status
  )
  values (
    p_conversation_id, uid, btrim(p_client_message_id), trimmed, p_message_type,
    public.moderation_inspect_message(p_conversation_id, uid, trimmed)
  )
  returning * into m;
  -- Insert attachments (the storage objects must already be uploaded
  -- via the storage API before this RPC is called; we only record
  -- metadata here).
  if attachment_count > 0 then
    for i in 0..attachment_count - 1 loop
      attachment := p_attachments -> i;
      insert into public.message_attachments(
        message_id, storage_bucket, storage_path, filename, mime_type, size_bytes
      )
      values (
        m.id,
        coalesce(attachment->>'storage_bucket', 'message-attachments'),
        attachment->>'storage_path',
        attachment->>'filename',
        attachment->>'mime_type',
        (attachment->>'size_bytes')::bigint
      );
    end loop;
  end if;
  -- Update conversation preview
  if p_message_type = 'text' then
    update public.conversations
      set last_message_at = now(),
          last_message_preview = left(trimmed, 280)
      where id = p_conversation_id;
  else
    update public.conversations
      set last_message_at = now()
      where id = p_conversation_id;
  end if;
  return jsonb_build_object(
    'id', m.id, 'senderId', m.sender_id, 'mine', true,
    'body', m.body, 'createdAt', m.created_at,
    'moderationStatus', m.moderation_status,
    'messageType', m.message_type,
    'duplicate', false
  );
end $$;

revoke all on function public.create_message_with_attachments(uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_message_with_attachments(uuid, text, text, text, jsonb) to authenticated;
