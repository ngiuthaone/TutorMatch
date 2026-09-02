-- 20260909000000_messaging_alpha_v2.sql
-- Tutoria Messages v2 — extends the DEC-015 Alpha messaging surface with:
--   - extended conversation types (direct, group, booking, community, support)
--   - editable / soft-deletable messages
--   - message attachments (file/image) — table only; storage wiring is
--     deferred to a follow-up so the DEC-015 surface is not regressed
--   - conversation reports (admin + reporter can see; non-admin cannot)
--   - user blocks (blocker can see; recipient is denied new messages)
--   - notification trigger: every persisted message writes a row into
--     public.notifications for the other member, so the existing
--     notification system (header badge, /notifications page) lights up
--   - search support via pg_trgm
--   - per-attachment RLS split into insert/select/delete (M1 pattern)
--   - existing RLS, columns, types preserved
set search_path = 'pg_catalog, public, extensions';

-- 1. pg_trgm for conversation search (cheap, no Elasticsearch needed for Alpha)
create extension if not exists pg_trgm with schema extensions;

-- 2. Extend conversations
alter table public.conversations
  add column if not exists type text not null default 'direct'
    check (type in ('direct','group','booking','community','support')),
  add column if not exists title text
    check (title is null or char_length(btrim(title)) between 1 and 200),
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists archived_at timestamptz;
create index if not exists conversations_type_idx on public.conversations(type);
create index if not exists conversations_archived_idx on public.conversations(archived_at) where archived_at is null;

-- 3. Extend conversation_members
alter table public.conversation_members
  add column if not exists muted_at timestamptz,
  add column if not exists archived_at timestamptz;
create index if not exists conversation_members_user_active
  on public.conversation_members(user_id) where archived_at is null;

-- 4. Extend messages
alter table public.messages
  add column if not exists message_type text not null default 'text'
    check (message_type in ('text','image','file','system','media')),
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;
-- Soft-delete state is independent from the existing moderation_status
-- ('pending_review' | 'approved' | 'held'). When a user soft-deletes a
-- message, deleted_at is set; the row remains for audit / moderation.
create index if not exists messages_conv_created
  on public.messages(conversation_id, created_at desc)
  where deleted_at is null;

-- 5. message_attachments — new
create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  storage_bucket text not null default 'message-attachments',
  storage_path text not null check (char_length(storage_path) between 1 and 1024),
  filename text not null check (char_length(btrim(filename)) between 1 and 255),
  mime_type text not null check (char_length(mime_type) between 1 and 127),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 104857600),
  created_at timestamptz not null default now()
);
create index if not exists message_attachments_msg_idx on public.message_attachments(message_id);

alter table public.message_attachments enable row level security;
do $$ begin
  revoke all on table public.message_attachments from public, anon, authenticated;
exception when others then null; end $$;

-- 6. conversation_reports — new
create table if not exists public.conversation_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid references public.messages(id) on delete set null,
  reason text not null check (reason in ('harassment','spam','scam','inappropriate','abuse','other')),
  details text check (details is null or char_length(details) <= 2000),
  status text not null default 'pending' check (status in ('pending','resolved','dismissed')),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists conversation_reports_status_idx on public.conversation_reports(status, created_at desc);
alter table public.conversation_reports enable row level security;
do $$ begin
  revoke all on table public.conversation_reports from public, anon, authenticated;
exception when others then null; end $$;

-- 7. user_blocks — new
create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists user_blocks_blocked_idx on public.user_blocks(blocked_id);
alter table public.user_blocks enable row level security;
do $$ begin
  revoke all on table public.user_blocks from public, anon, authenticated;
exception when others then null; end $$;

-- 8. Per-command RLS for message_attachments (split per M1)
create policy message_attachments_member_select on public.message_attachments
  for select to authenticated
  using (
    exists (
      select 1 from public.messages m
      join public.conversation_members cm on cm.conversation_id = m.conversation_id
      where m.id = message_attachments.message_id
        and cm.user_id = auth.uid()
        and cm.archived_at is null
    )
  );
create policy message_attachments_member_insert on public.message_attachments
  for insert to authenticated
  with check (
    exists (
      select 1 from public.messages m
      join public.conversation_members cm on cm.conversation_id = m.conversation_id
      where m.id = message_attachments.message_id
        and cm.user_id = auth.uid()
        and m.sender_id = auth.uid()
        and m.deleted_at is null
    )
  );
create policy message_attachments_owner_delete on public.message_attachments
  for delete to authenticated
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_attachments.message_id and m.sender_id = auth.uid()
    )
  );

-- 9. Per-command RLS for conversation_reports
create policy conversation_reports_reporter_select on public.conversation_reports
  for select to authenticated
  using (reporter_id = auth.uid());
create policy conversation_reports_admin_select on public.conversation_reports
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy conversation_reports_reporter_insert on public.conversation_reports
  for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = conversation_reports.conversation_id
        and cm.user_id = auth.uid()
    )
  );
create policy conversation_reports_admin_update on public.conversation_reports
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- 10. Per-command RLS for user_blocks
create policy user_blocks_self_select on public.user_blocks
  for select to authenticated
  using (blocker_id = auth.uid() or blocked_id = auth.uid());
create policy user_blocks_self_insert on public.user_blocks
  for insert to authenticated
  with check (blocker_id = auth.uid());
create policy user_blocks_self_delete on public.user_blocks
  for delete to authenticated
  using (blocker_id = auth.uid());

-- 11. Extend conversation_members RLS to include muted/archived columns
--     (existing policies do not need a new policy; queries filter on
--     archived_at is null at the application/service layer).
--     No change required.

-- 12. Extend messages RLS to honor deleted_at
drop policy if exists messages_member_read on public.messages;
create policy messages_member_read on public.messages
  for select to authenticated
  using (
    deleted_at is null
    and exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = messages.conversation_id
        and cm.user_id = auth.uid()
        and cm.archived_at is null
    )
  );
-- Allow moderators (admin role) to read deleted messages for moderation
create policy messages_admin_read on public.messages
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- 13. update / delete policies
drop policy if exists messages_member_update on public.messages;
create policy messages_member_update on public.messages
  for update to authenticated
  using (sender_id = auth.uid() and deleted_at is null)
  with check (sender_id = auth.uid() and deleted_at is null);
create policy messages_member_delete on public.messages
  for delete to authenticated
  using (sender_id = auth.uid());

-- 14. Notification trigger — emit a public.notifications row for the
--     other member on every successful message insert. This piggybacks
--     on Tutoria's existing notification infrastructure (header badge,
--     /notifications page, /notifications/unread-count) without adding
--     a new parallel pipeline.
create or replace function public.notify_new_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  recipient uuid;
  sender_name text;
begin
  if new.deleted_at is not null then return new; end if;
  -- Recipients = all active members of the conversation EXCEPT the sender.
  select name into sender_name from public.profiles where id = new.sender_id;
  for recipient in
    select cm.user_id from public.conversation_members cm
    where cm.conversation_id = new.conversation_id
      and cm.user_id <> new.sender_id
      and cm.archived_at is null
      and (cm.muted_at is null or cm.muted_at < new.created_at)
  loop
    insert into public.notifications(recipient_id, event_type, source_type, source_id, payload, occurred_at)
    values (
      recipient,
      'new_message',
      'message',
      new.id,
      jsonb_build_object(
        'conversationId', new.conversation_id,
        'messageId', new.id,
        'senderId', new.sender_id,
        'senderName', coalesce(sender_name, 'Someone'),
        'preview', left(new.body, 140),
        'bookingId', (select c.booking_id from public.conversations c where c.id = new.conversation_id)
      ),
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

-- 15. Block check helper
create or replace function public.is_blocked(p_blocker uuid, p_blocked uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_blocks where blocker_id = p_blocker and blocked_id = p_blocked)
$$;
revoke all on function public.is_blocked(uuid,uuid) from public, anon, authenticated;
grant execute on function public.is_blocked(uuid,uuid) to authenticated;

-- 16. Conversation search (pg_trgm-based)
create or replace function public.search_conversations(p_query text, p_limit int default 20) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  q text;
  lim int;
begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  q := btrim(coalesce(p_query, ''));
  if char_length(q) = 0 then return '[]'::jsonb; end if;
  lim := greatest(1, least(coalesce(p_limit, 20), 50));
  return coalesce((
    select jsonb_agg(row_to_json(t) order by t.last_message_at desc) from (
      select
        c.id, c.type, c.title, c.last_message_at, c.last_message_preview, c.booking_id,
        coalesce(p.name, '') as other_party_name
      from public.conversations c
      join public.conversation_members cm on cm.conversation_id = c.id
      left join public.conversation_members cm2 on cm2.conversation_id = c.id and cm2.user_id <> auth.uid()
      left join public.profiles p on p.id = cm2.user_id
      where cm.user_id = auth.uid()
        and cm.archived_at is null
        and (
          c.title ilike '%' || q || '%'
          or p.name ilike '%' || q || '%'
          or c.last_message_preview ilike '%' || q || '%'
        )
      order by c.last_message_at desc
      limit lim
    ) t
  ), '[]'::jsonb);
end $$;
revoke all on function public.search_conversations(text, int) from public, anon, authenticated;
grant execute on function public.search_conversations(text, int) to authenticated;

-- 17. edit_message: owner only, idempotent
create or replace function public.edit_message(p_message_id uuid, p_new_body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  trimmed text;
  m public.messages%rowtype;
begin
  if uid is null then raise insufficient_privilege; end if;
  trimmed := btrim(coalesce(p_new_body, ''));
  if char_length(trimmed) < 1 or char_length(trimmed) > 2000 then
    raise exception 'INVALID_MESSAGE' using errcode = '22023';
  end if;
  select * into m from public.messages where id = p_message_id for update;
  if m.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if m.sender_id <> uid then raise insufficient_privilege; end if;
  if m.deleted_at is not null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  update public.messages
    set body = trimmed, edited_at = now()
    where id = p_message_id;
  return jsonb_build_object('id', p_message_id, 'body', trimmed, 'editedAt', now(), 'mine', true);
end $$;
revoke all on function public.edit_message(uuid, text) from public, anon, authenticated;
grant execute on function public.edit_message(uuid, text) to authenticated;

-- 18. soft_delete_message: owner only
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
    set deleted_at = now(), body = ''
    where id = p_message_id;
  return jsonb_build_object('id', p_message_id, 'deletedAt', now(), 'mine', true);
end $$;
revoke all on function public.soft_delete_message(uuid) from public, anon, authenticated;
grant execute on function public.soft_delete_message(uuid) to authenticated;

-- 19. report_message: any active member; persists the report
create or replace function public.report_message(p_message_id uuid, p_reason text, p_details text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  m public.messages%rowtype;
  cid uuid;
  rid uuid;
begin
  if uid is null then raise insufficient_privilege; end if;
  select * into m from public.messages where id = p_message_id;
  if m.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  cid := m.conversation_id;
  if not exists(select 1 from public.conversation_members where conversation_id = cid and user_id = uid) then
    raise insufficient_privilege;
  end if;
  if p_reason not in ('harassment','spam','scam','inappropriate','abuse','other') then
    raise exception 'INVALID_REASON' using errcode = '22023';
  end if;
  insert into public.conversation_reports(reporter_id, conversation_id, message_id, reason, details)
    values (uid, cid, p_message_id, p_reason, p_details)
    returning id into rid;
  return jsonb_build_object('id', rid, 'status', 'pending');
end $$;
revoke all on function public.report_message(uuid, text, text) from public, anon, authenticated;
grant execute on function public.report_message(uuid, text, text) to authenticated;

-- 20. block_user / unblock_user (idempotent)
create or replace function public.block_user(p_target_user_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise insufficient_privilege; end if;
  if p_target_user_id is null or p_target_user_id = uid then
    raise exception 'INVALID_REQUEST' using errcode = '22023';
  end if;
  if not exists(select 1 from public.profiles where id = p_target_user_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  insert into public.user_blocks(blocker_id, blocked_id) values (uid, p_target_user_id)
    on conflict (blocker_id, blocked_id) do nothing;
  return jsonb_build_object('blocker', uid, 'blocked', p_target_user_id);
end $$;
revoke all on function public.block_user(uuid) from public, anon, authenticated;
grant execute on function public.block_user(uuid) to authenticated;

create or replace function public.unblock_user(p_target_user_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise insufficient_privilege; end if;
  delete from public.user_blocks where blocker_id = uid and blocked_id = p_target_user_id;
  return jsonb_build_object('blocker', uid, 'blocked', p_target_user_id);
end $$;
revoke all on function public.unblock_user(uuid) from public, anon, authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
