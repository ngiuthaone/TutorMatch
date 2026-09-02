-- Daily.co Video Integration for Workshops
-- Adds meeting_url, meeting_id, and daily_room_created_at to sessions.
-- Creates create_workshop_meeting_link and delete_workshop_meeting_link functions.
-- Modifies confirm_booking to auto-create meeting links for workshop bookings.

set search_path = public;

-- 1. Add meeting columns to sessions
alter table public.sessions add column if not exists meeting_url text;
alter table public.sessions add column if not exists meeting_id text;
alter table public.sessions add column if not exists daily_room_created_at timestamptz;

-- 2. Index for fast lookup of sessions with meeting links
create index if not exists idx_sessions_meeting_url on public.sessions(meeting_url) where meeting_url is not null;

-- 3. Create workshop meeting link via Daily.co
create or replace function public.create_workshop_meeting_link(sid uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s public.sessions%rowtype;
  result jsonb;
  api_key text;
  room_name text;
  start_ts timestamptz;
  end_ts timestamptz;
  room_resp jsonb;
begin
  api_key := current_setting('app.daily_api_key', true);
  if api_key is null or api_key = '' then
    raise exception 'DAILY_API_KEY not configured';
  end if;

  select * into s from public.sessions where id = sid for update;
  if s.id is null then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  if s.meeting_url is not null then
    return jsonb_build_object('url', s.meeting_url, 'id', s.meeting_id);
  end if;

  room_name := 'workshop-' || sid::text;
  start_ts := s.starts_at;
  end_ts := s.ends_at;

  room_resp := (
    select (resp.body::jsonb)
    from net.http_post(
      url := 'https://api.daily.co/v1/rooms',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || api_key
      ),
      body := jsonb_build_object(
        'name', room_name,
        'privacy', 'public',
        'properties', jsonb_build_object(
          'exp', floor(extract(epoch from end_ts + interval '1 hour')),
          'enable_recording', 'cloud',
          'enable_chat', true,
          'enable_screenshare', true
        )
      )
    ) as resp
  );

  if room_resp->>'url' is null then
    raise exception 'Failed to create Daily.co room: %', room_resp->>'info';
  end if;

  update public.sessions
  set meeting_url = room_resp->>'url',
      meeting_id = room_resp->>'id',
      daily_room_created_at = now()
  where id = sid;

  return jsonb_build_object('url', room_resp->>'url', 'id', room_resp->>'id');
end;
$$;

grant execute on function public.create_workshop_meeting_link(uuid) to authenticated;

-- 4. Delete workshop meeting link (clears DB columns; room expires on Daily.co)
create or replace function public.delete_workshop_meeting_link(sid uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  api_key text;
  meeting_id text;
  delete_url text;
begin
  select meeting_id into meeting_id from public.sessions where id = sid;
  if meeting_id is null then
    return;
  end if;

  api_key := current_setting('app.daily_api_key', true);
  if api_key is not null and api_key != '' then
    delete_url := 'https://api.daily.co/v1/rooms/' || meeting_id;
    perform net.http_post(
      url := delete_url,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || api_key
      ),
      body := '{}'::jsonb
    );
  end if;

  update public.sessions
  set meeting_url = null, meeting_id = null, daily_room_created_at = null
  where id = sid;
end;
$$;

grant execute on function public.delete_workshop_meeting_link(uuid) to authenticated;

-- 5. Modify confirm_booking to create meeting links for workshops
create or replace function public.confirm_booking(booking_id uuid, expected_version bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  uid uuid := public.assert_attendee_caller();
  sid uuid;
  s public.sessions%rowtype;
  b public.bookings%rowtype;
  offering_kind text;
  meeting_url text;
  meeting_result jsonb;
begin
  select session_id into sid from public.bookings where id = booking_id;
  if not found then raise insufficient_privilege; end if;
  select * into s from public.sessions where id = sid for update;
  if s.host_id <> uid then raise insufficient_privilege; end if;
  if s.status <> 'scheduled' then raise exception 'SESSION_NOT_OPEN' using errcode='22023'; end if;
  select * into b from public.bookings where id = booking_id for update;
  if b.id is null then raise insufficient_privilege; end if;
  if b.version <> expected_version then raise exception 'STALE_VERSION' using errcode='45000'; end if;
  if b.status <> 'requested' then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;

  select o.kind into offering_kind
  from public.offerings o
  where o.id = s.offering_id;

  update public.bookings set status = 'confirmed', version = version + 1 where id = booking_id;
  insert into public.booking_history(booking_id, from_status, to_status, actor, at)
  values (booking_id, 'requested', 'confirmed', 'host', now());

  if offering_kind = 'workshop' then
    begin
      meeting_result := public.create_workshop_meeting_link(s.id);
      meeting_url := meeting_result->>'url';
    exception when others then
      meeting_url := null;
    end;
  end if;

  perform public.insert_outbox_event('BOOKING_CONFIRMED', 'booking', booking_id, b.version + 1,
    jsonb_build_object('bookingId', booking_id, 'sessionId', sid, 'fromStatus', b.status)
    || case when meeting_url is not null then jsonb_build_object('meetingUrl', meeting_url) else '{}'::jsonb end);

  return public.booking_json(booking_id);
end;
$$;
