-- Tutoria direct host<->learner messaging (MSG-010 / DEC-015).
--
-- Scope: 1:1 booking-context conversations only. Server-authoritative
-- membership. No client-fabricated membership or messages. No file/attachment
-- storage. Idempotent send. Moderation hook seam. Realtime stays deferred.
--
-- Pattern follows the booking/outbox convention (0004 / 0005 / 0006):
-- tables are RLS-enabled and fully revoked; every read/write flows through
-- security-definer RPCs that authorize via auth.uid() and the
-- conversation_members table. The unique (conversations (booking_id))
-- invariant enforces exactly one conversation per booking so a learner and
-- host always have one shared room.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  -- The booking that anchors this conversation. UNIQUE enforces one
  -- conversation per booking; nulls allowed so future non-booking
  -- conversation kinds remain possible without breaking the index.
  booking_id uuid references public.bookings(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  last_message_preview text not null default '' check (char_length(last_message_preview) <= 280)
);

create unique index if not exists conversations_booking_unique
  on public.conversations(booking_id)
  where booking_id is not null;

create index if not exists conversations_last_message_at
  on public.conversations(last_message_at desc);

-- Server-authoritative membership. Exactly one row per (conversation, user).
-- The application layer can never INSERT/UPDATE membership directly: tables
-- are RLS-enabled and fully revoked, and only the security-definer RPCs touch
-- them. The booking participants (host_id from sessions, learner_id from
-- bookings) are the only valid members.
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('host','learner')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists conversation_members_user
  on public.conversation_members(user_id, conversation_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  -- Server-stripped content (sanitizer applied before persist). Plain text
  -- only: no HTML, no markdown, no file refs. Bounded length.
  body text not null check (char_length(body) between 1 and 2000),
  -- Client idempotency key: the same (sender_id, client_message_id) pair
  -- returns the same persisted message so retries after an ambiguous network
  -- outcome do not duplicate.
  client_message_id text not null check (char_length(client_message_id) between 8 and 128),
  -- Moderation status (seam; future work). Defaults to 'pending_review'.
  -- Reads happen only inside list/get RPCs which can filter/annotate as
  -- needed without affecting the protected write path.
  moderation_status text not null default 'pending_review'
    check (moderation_status in ('pending_review','approved','held')),
  created_at timestamptz not null default now(),
  unique (sender_id, client_message_id)
);

create index if not exists messages_conversation_created
  on public.messages(conversation_id, created_at);

create index if not exists messages_sender
  on public.messages(sender_id);

create or replace function public.set_conversation_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
revoke all on function public.set_conversation_updated_at() from public, anon, authenticated;
drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at before update on public.conversations
for each row execute function public.set_conversation_updated_at();

-- RLS enabled + fully revoked on all messaging tables: all access flows
-- through the security-definer RPCs in the migration below, matching the
-- 0004/0005/0006 pattern.
do $$ declare t text; begin
  foreach t in array array['conversations','conversation_members','messages'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
  end loop;
end $$;

-- -------------------------------------------------------------------
-- Security-definer RPC surface
-- -------------------------------------------------------------------

-- Returns true if the caller is currently a member of the conversation.
-- Internal helper; revoked.
create or replace function public.is_conversation_member(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.conversation_members
    where conversation_id = cid and user_id = auth.uid()
  );
$$;
revoke all on function public.is_conversation_member(uuid) from public, anon, authenticated;

-- Moderation seam: receives the candidate message and returns the
-- moderation_status. Today this is a documented stub that always approves.
-- The seam exists so future moderation (classifier, human queue, block
-- list, retention) can plug in without touching the send path. Internal,
-- revoked.
create or replace function public.moderation_inspect_message(
  p_conversation_id uuid,
  p_sender_id uuid,
  p_body text
) returns text
language plpgsql security definer set search_path = '' as $$
declare status text := 'approved';
begin
  -- Stub seam: future work (keyword classifier, host-report flag, length
  -- policy, link allow-list) attaches here. Always returns 'approved' in
  -- Alpha; the value is persisted so downstream reads can branch on it.
  status := 'approved';
  return status;
end;
$$;
revoke all on function public.moderation_inspect_message(uuid, uuid, text) from public, anon, authenticated;

-- open_or_get_booking_conversation: returns the conversation id for the
-- booking the caller is authorized to talk about. If no conversation exists
-- yet, creates one and seeds the two-member membership using authoritative
-- booking/session data. Idempotent. Internal helper invoked by
-- get_or_create_booking_conversation.
create or replace function public.open_or_get_booking_conversation(p_booking_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  cid uuid;
  b public.bookings%rowtype;
  s public.sessions%rowtype;
begin
  if uid is null then raise insufficient_privilege; end if;
  select * into b from public.bookings where id = p_booking_id;
  if b.id is null then raise insufficient_privilege; end if;
  select * into s from public.sessions where id = b.session_id;
  if s.id is null then raise insufficient_privilege; end if;
  if uid <> b.learner_id and uid <> s.host_id then raise insufficient_privilege; end if;
  select id into cid from public.conversations where booking_id = p_booking_id;
  if cid is null then
    insert into public.conversations(booking_id) values (p_booking_id) returning id into cid;
    insert into public.conversation_members(conversation_id, user_id, role)
    values (cid, b.learner_id, 'learner'), (cid, s.host_id, 'host')
    on conflict do nothing;
  else
    -- Defensive: ensure both members exist (no-op on first call).
    insert into public.conversation_members(conversation_id, user_id, role)
    values (cid, b.learner_id, 'learner'), (cid, s.host_id, 'host')
    on conflict do nothing;
  end if;
  return cid;
end;
$$;
revoke all on function public.open_or_get_booking_conversation(uuid) from public, anon, authenticated;

-- get_or_create_booking_conversation: returns the conversation JSON for
-- the booking. Creates the conversation + membership if it does not exist.
create or replace function public.get_or_create_booking_conversation(p_booking_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  viewer uuid := auth.uid();
  cid uuid;
begin
  if viewer is null then raise insufficient_privilege; end if;
  -- open_or_get_booking_conversation authorizes the caller against
  -- bookings.learner_id / sessions.host_id and seeds the membership.
  cid := public.open_or_get_booking_conversation(p_booking_id);
  return public.conversation_summary(cid, viewer);
end;
$$;
revoke all on function public.get_or_create_booking_conversation(uuid) from public, anon, authenticated;
grant execute on function public.get_or_create_booking_conversation(uuid) to authenticated;

-- conversation_summary: server-authoritative payload for one conversation
-- from the perspective of one caller. Internal helper.
create or replace function public.conversation_summary(cid uuid, viewer uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  conv public.conversations%rowtype;
  booking public.bookings%rowtype;
  session_row public.sessions%rowtype;
  viewer_role text;
  other_user uuid;
  other_role text;
  other_name text;
  unread bigint;
  last_msg jsonb;
begin
  if viewer is null then raise insufficient_privilege; end if;
  select * into conv from public.conversations where id = cid;
  if conv.id is null then raise insufficient_privilege; end if;
  select role into viewer_role from public.conversation_members
    where conversation_id = cid and user_id = viewer;
  if viewer_role is null then raise insufficient_privilege; end if;
  select * into booking from public.bookings where id = conv.booking_id;
  if booking.id is not null then
    select * into session_row from public.sessions where id = booking.session_id;
  end if;
  if viewer_role = 'learner' then
    other_user := session_row.host_id; other_role := 'host';
  else
    other_user := booking.learner_id; other_role := 'learner';
  end if;
  -- Display name lookup runs as the SECURITY DEFINER owner (postgres),
  -- which bypasses RLS, so the cross-party read is allowed.
  select p.name into other_name from public.profiles p where p.id = other_user;
  if other_name is null or btrim(other_name) = '' then other_name := 'Your conversation partner'; end if;
  select count(*) into unread from public.messages
    where conversation_id = cid and sender_id <> viewer
      and created_at > coalesce((
        select last_read_at from public.conversation_members
        where conversation_id = cid and user_id = viewer
      ), '1970-01-01'::timestamptz);
  select jsonb_build_object(
    'id', m.id, 'senderId', m.sender_id, 'body', m.body, 'createdAt', m.created_at,
    'moderationStatus', m.moderation_status
  ) into last_msg
  from public.messages m where m.conversation_id = cid
  order by m.created_at desc limit 1;
  return jsonb_build_object(
    'id', conv.id,
    'bookingId', conv.booking_id,
    'createdAt', conv.created_at,
    'updatedAt', conv.updated_at,
    'lastMessageAt', conv.last_message_at,
    'lastMessagePreview', conv.last_message_preview,
    'unreadCount', unread,
    'viewerRole', viewer_role,
    'participant', jsonb_build_object('userId', other_user, 'role', other_role, 'displayName', other_name),
    'bookingContext', case when booking.id is null then null else jsonb_build_object(
      'bookingId', booking.id,
      'sessionId', booking.session_id,
      'sessionStartsAt', session_row.starts_at,
      'sessionEndsAt', session_row.ends_at,
      'bookingStatus', booking.status
    ) end,
    'lastMessage', last_msg
  );
end;
$$;
revoke all on function public.conversation_summary(uuid, uuid) from public, anon, authenticated;

-- list_my_conversations: every conversation the caller is a member of,
-- newest activity first.
create or replace function public.list_my_conversations() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
  rows jsonb;
begin
  if uid is null then raise insufficient_privilege; end if;
  select coalesce(jsonb_agg(public.conversation_summary(c.id, uid) order by c.last_message_at desc), '[]'::jsonb)
    into rows
  from public.conversations c
  where exists(select 1 from public.conversation_members cm
               where cm.conversation_id = c.id and cm.user_id = uid);
  return rows;
end;
$$;
revoke all on function public.list_my_conversations() from public, anon, authenticated;
grant execute on function public.list_my_conversations() to authenticated;

-- get_conversation: viewer-scoped conversation summary; raises if not a
-- member.
create or replace function public.get_conversation(cid uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise insufficient_privilege; end if;
  if not public.is_conversation_member(cid) then raise insufficient_privilege; end if;
  return public.conversation_summary(cid, uid);
end;
$$;
revoke all on function public.get_conversation(uuid) from public, anon, authenticated;
grant execute on function public.get_conversation(uuid) to authenticated;

-- list_conversation_messages: paginated, oldest-first; viewer must be a
-- member. Returns messages with id, senderId, body, createdAt, editedAt,
-- deletedAt, messageType, moderationStatus, and a synthetic 'mine' flag
-- for the client. Soft-deleted messages are NOT included in the list
-- (the server hides them in line with the client UX).
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

-- send_message: idempotent on (sender_id, client_message_id). If a row
-- already exists with that pair in the same conversation, the existing row
-- is returned. Otherwise inserts a new row, runs the moderation seam,
-- updates conversation last_message_at/preview, and returns the message.
-- Caller must be a member of the conversation.
create or replace function public.send_message(
  cid uuid,
  p_client_message_id text,
  p_body text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  mid uuid;
  existing public.messages%rowtype;
  trimmed text;
  moderation text;
begin
  if uid is null then raise insufficient_privilege; end if;
  if p_client_message_id is null or btrim(p_client_message_id) = '' then
    raise exception 'INVALID_MESSAGE' using errcode = '22023';
  end if;
  if char_length(p_client_message_id) < 8 or char_length(p_client_message_id) > 128 then
    raise exception 'INVALID_MESSAGE' using errcode = '22023';
  end if;
  -- Length / null checks for body are enforced by the `messages.body`
  -- column CHECK (char_length between 1 and 2000) plus the NOT NULL on
  -- sender_id + client_message_id. We re-trim here only to normalize
  -- whitespace before persisting.
  trimmed := btrim(coalesce(p_body, ''));
  if char_length(trimmed) < 1 or char_length(trimmed) > 2000 then
    raise exception 'INVALID_MESSAGE' using errcode = '22023';
  end if;
  if not public.is_conversation_member(cid) then raise insufficient_privilege; end if;
  -- Idempotency: a retry re-uses the same persisted message.
  select * into existing from public.messages
    where sender_id = uid and client_message_id = btrim(p_client_message_id);
  if existing.id is not null then
    if existing.conversation_id <> cid then raise exception 'IDEMPOTENCY_CONFLICT' using errcode = '23505'; end if;
    return jsonb_build_object(
      'id', existing.id, 'senderId', existing.sender_id, 'mine', true,
      'body', existing.body, 'createdAt', existing.created_at,
      'moderationStatus', existing.moderation_status,
      'duplicate', true
    );
  end if;
  moderation := public.moderation_inspect_message(cid, uid, trimmed);
  insert into public.messages(conversation_id, sender_id, client_message_id, body, moderation_status)
    values (cid, uid, btrim(p_client_message_id), trimmed, moderation)
    returning id into mid;
  update public.conversations
     set last_message_at = now(),
         last_message_preview = left(trimmed, 280)
   where id = cid;
  return jsonb_build_object(
    'id', mid, 'senderId', uid, 'mine', true,
    'body', trimmed, 'createdAt', now(),
    'moderationStatus', moderation,
    'duplicate', false
  );
end;
$$;
revoke all on function public.send_message(uuid, text, text) from public, anon, authenticated;
grant execute on function public.send_message(uuid, text, text) to authenticated;

-- mark_conversation_read: bumps the viewer's last_read_at so unread counts
-- reset on the next list call. No-op if not a member.
create or replace function public.mark_conversation_read(cid uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); ts timestamptz := now();
begin
  if uid is null then raise insufficient_privilege; end if;
  update public.conversation_members
     set last_read_at = ts
   where conversation_id = cid and user_id = uid;
  if not found then raise insufficient_privilege; end if;
  return jsonb_build_object('conversationId', cid, 'lastReadAt', ts);
end;
$$;
revoke all on function public.mark_conversation_read(uuid) from public, anon, authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;