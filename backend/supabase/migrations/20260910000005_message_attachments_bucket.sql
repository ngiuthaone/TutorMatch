-- 20260910000000_message_attachments_bucket.sql
-- Add private `message-attachments` storage bucket for Phase 10
-- (per Tutoria's DEC-015 spec, attachments are deferred, but the
-- schema and RLS are in place so the UI can wire up without migration churn
-- once the feature is flipped on).
--
-- The RLS policy pattern is adapted from chatly's
-- 20260513045749_setup_rls_for_message_attachments_bucket.sql (MIT).
-- Tutoria's storage path layout is `<conversation_id>/<message_id>/<file>`
-- (one folder per conversation, one folder per message, files inside). The
-- chatly RLS used split_part(name, '/', 1) which assumed the message UUID
-- is the first path segment; Tutoria instead constrains the first segment
-- to the conversation_id of an active conversation the caller is a
-- member of, and the second segment to a real message the caller sent
-- within that conversation.
set search_path = '';

-- 1. The private bucket (one-time). Idempotent: only inserts if absent.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-attachments',
  'message-attachments',
  false,
  104857600, -- 100 MB cap
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
)
on conflict (id) do nothing;

-- 2. RLS for storage.objects scoped to bucket = 'message-attachments'.
-- Pattern adapted from chatly (MIT, 20260513045749). Tutoria's stricter
-- path layout is enforced through the conversation_id/membership check.

-- INSERT: a caller can upload to a path whose first segment is a
-- conversation they're a member of, second segment is a message they
-- sent within that conversation, and the message_type is one of the
-- attachment-eligible types.
drop policy if exists message_attachments_bucket_insert on storage.objects;
create policy message_attachments_bucket_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'message-attachments'
    and exists (
      select 1
      from public.conversation_members cm
      where cm.conversation_id::text = split_part(name, '/', 1)
        and cm.user_id = auth.uid()
        and cm.archived_at is null
    )
    and exists (
      select 1
      from public.messages m
      where m.id::text = split_part(name, '/', 2)
        and m.sender_id = auth.uid()
        and m.deleted_at is null
        and m.message_type in ('image', 'file', 'media')
    )
    and exists (
      select 1
      from public.message_attachments ma
      where ma.message_id::text = split_part(name, '/', 2)
        and ma.storage_bucket = 'message-attachments'
        and ma.storage_path = name
    )
  );

-- SELECT: a caller can read an attachment if they're a member of the
-- conversation that owns it.
drop policy if exists message_attachments_bucket_select on storage.objects;
create policy message_attachments_bucket_select
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'message-attachments'
    and exists (
      select 1
      from public.conversation_members cm
      where cm.conversation_id::text = split_part(name, '/', 1)
        and cm.user_id = auth.uid()
        and cm.archived_at is null
    )
  );

-- DELETE: the message owner can delete their own attachment.
drop policy if exists message_attachments_bucket_delete on storage.objects;
create policy message_attachments_bucket_delete
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'message-attachments'
    and exists (
      select 1
      from public.messages m
      where m.id::text = split_part(name, '/', 2)
        and m.sender_id = auth.uid()
    )
  );
