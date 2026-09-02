-- Tutoria sessions + bookings: security definer RPC surface + grants.
-- Pattern: tables are RLS-enabled and fully revoked (0004); all access flows
-- through these functions. Errors are sanitized constant codes; version/CAS
-- conflicts raise STALE_VERSION with errcode 45000 (PostgREST-safe; 40001 triggers unwanted retry).
-- See docs/agent-team/DESIGN-SUPABASE-PERSISTENCE-RLS.md.

-- Internal helpers (revoked; never granted to anon/authenticated).

create or replace function public.session_hard_reserved(sid uuid) returns bigint
language sql stable security definer set search_path='' as $$
  select coalesce(sum(participant_count), 0)::bigint
  from public.bookings
  where session_id = sid and status in ('requested','confirmed')
$$;
revoke all on function public.session_hard_reserved(uuid) from public, anon, authenticated;

create or replace function public.assert_attendee_caller() returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise insufficient_privilege; end if;
  if not exists(select 1 from public.profiles where id = uid) then raise insufficient_privilege; end if;
  return uid;
end $$;
revoke all on function public.assert_attendee_caller() from public, anon, authenticated;

create or replace function public.assert_host_of_session(sid uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise insufficient_privilege; end if;
  if not exists(select 1 from public.sessions where id = sid and host_id = uid) then raise insufficient_privilege; end if;
  return uid;
end $$;
revoke all on function public.assert_host_of_session(uuid) from public, anon, authenticated;

create or replace function public.session_json(sid uuid) returns jsonb
language sql stable security definer set search_path='' as $$
select jsonb_build_object(
  'id', s.id, 'offeringId', s.offering_id, 'status', s.status,
  'startsAt', s.starts_at, 'endsAt', s.ends_at,
  'minParticipants', s.min_participants, 'maxParticipants', s.max_participants,
  'hardReservedCapacity', public.session_hard_reserved(s.id),
  'spotsLeft', case when s.max_participants is null then null else s.max_participants - public.session_hard_reserved(s.id) end,
  'version', s.version)
from public.sessions s where s.id = sid
$$;
revoke all on function public.session_json(uuid) from public, anon, authenticated;

create or replace function public.booking_json(bid uuid) returns jsonb
language sql stable security definer set search_path='' as $$
select jsonb_build_object(
  'id', b.id, 'sessionId', b.session_id, 'status', b.status,
  'participantCount', b.participant_count,
  'rescheduledFromSessionId', b.rescheduled_from_session_id,
  'cancelledReason', b.cancelled_reason, 'cancelledBy', b.cancelled_by,
  'cancelledBySessionId', b.cancelled_by_session_id, 'version', b.version,
  'session', public.session_json(b.session_id))
from public.bookings b where b.id = bid
$$;
revoke all on function public.booking_json(uuid) from public, anon, authenticated;

-- Session RPCs (actor: host).

create or replace function public.create_session(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  uid uuid := public.assert_attendee_caller();
  host_role public.user_role;
  sid uuid := gen_random_uuid();
  starts_at timestamptz; ends_at timestamptz; min_p int; max_p int;
begin
  select role into host_role from public.profiles where id = uid;
  if host_role is null or host_role not in ('tutor','admin') then raise insufficient_privilege; end if;
  if payload is null or jsonb_typeof(payload) <> 'object'
     or exists(select 1 from jsonb_object_keys(payload) k where k not in ('offeringId','startsAt','endsAt','minParticipants','maxParticipants'))
  then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  begin
    starts_at := (payload->>'startsAt')::timestamptz;
    ends_at := (payload->>'endsAt')::timestamptz;
    if payload ? 'minParticipants' then min_p := (payload->>'minParticipants')::int; if min_p < 0 then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if; else min_p := null; end if;
    if payload ? 'maxParticipants' then max_p := (payload->>'maxParticipants')::int; if max_p <= 0 then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if; else max_p := null; end if;
    if payload ? 'offeringId' and payload->>'offeringId' <> '' then perform (payload->>'offeringId')::uuid; end if;
  exception when others then raise exception 'INVALID_TRANSITION' using errcode='22023'; end;
  if ends_at <= starts_at then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  if min_p is not null and max_p is not null and min_p > max_p then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  insert into public.sessions(id, offering_id, host_id, starts_at, ends_at, min_participants, max_participants)
  values (sid, nullif(payload->>'offeringId','')::uuid, uid, starts_at, ends_at, min_p, max_p);
  insert into public.session_history(session_id, change_type, by, at) values (sid, 'created', 'host', now());
  return public.session_json(sid);
end $$;

create or replace function public.reschedule_session(sid uuid, starts_at timestamptz, ends_at timestamptz, expected_version bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid := public.assert_host_of_session(sid); cur public.sessions%rowtype;
begin
  select * into cur from public.sessions where id = sid for update;
  if cur.id is null then raise insufficient_privilege; end if;
  if cur.version <> expected_version then raise exception 'STALE_VERSION' using errcode='45000'; end if;
  if cur.status <> 'scheduled' then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  if ends_at <= starts_at then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  if starts_at = cur.starts_at and ends_at = cur.ends_at then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  update public.sessions set starts_at = reschedule_session.starts_at, ends_at = reschedule_session.ends_at, version = version + 1
  where id = sid;
  insert into public.session_history(session_id, change_type, by, at, from_start, from_end, to_start, to_end)
  values (sid, 'rescheduled', 'host', now(), cur.starts_at, cur.ends_at, reschedule_session.starts_at, reschedule_session.ends_at);
  return public.session_json(sid);
end $$;

create or replace function public.change_session_capacity(sid uuid, new_max int, expected_version bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid := public.assert_host_of_session(sid); cur public.sessions%rowtype; reserved bigint;
begin
  select * into cur from public.sessions where id = sid for update;
  if cur.id is null then raise insufficient_privilege; end if;
  if cur.version <> expected_version then raise exception 'STALE_VERSION' using errcode='45000'; end if;
  if cur.status <> 'scheduled' then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  if new_max <= 0 then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  reserved := public.session_hard_reserved(sid);
  if new_max < reserved then raise exception 'INSUFFICIENT_CAPACITY' using errcode='22023'; end if;
  if new_max = cur.max_participants then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  update public.sessions set max_participants = new_max, version = version + 1 where id = sid;
  insert into public.session_history(session_id, change_type, by, at, capacity_from, capacity_to)
  values (sid, 'capacity_changed', 'host', now(), cur.max_participants, new_max);
  return public.session_json(sid);
end $$;

create or replace function public.cancel_session(sid uuid, expected_version bigint, cause text default 'host', reason text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid := public.assert_host_of_session(sid); cur public.sessions%rowtype; b record;
begin
  select * into cur from public.sessions where id = sid for update;
  if cur.id is null then raise insufficient_privilege; end if;
  if cur.version <> expected_version then raise exception 'STALE_VERSION' using errcode='45000'; end if;
  if cur.status <> 'scheduled' then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  if cause is distinct from 'host' then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  update public.sessions set status = 'cancelled', version = version + 1 where id = sid;
  insert into public.session_history(session_id, change_type, by, at, cause, reason) values (sid, 'cancelled', 'host', now(), cause, reason);
  for b in select id, status, version from public.bookings where session_id = sid and status in ('requested','confirmed') for update loop
    update public.bookings set status = 'cancelled', cancelled_by = 'host', cancelled_by_session_id = sid, version = version + 1 where id = b.id;
    insert into public.booking_history(booking_id, from_status, to_status, actor, at, cancelled_by_session_id)
    values (b.id, b.status, 'cancelled', 'host', now(), sid);
  end loop;
  return public.session_json(sid);
end $$;

create or replace function public.complete_session(sid uuid, expected_version bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid := public.assert_host_of_session(sid); cur public.sessions%rowtype;
begin
  select * into cur from public.sessions where id = sid for update;
  if cur.id is null then raise insufficient_privilege; end if;
  if cur.version <> expected_version then raise exception 'STALE_VERSION' using errcode='45000'; end if;
  if cur.status <> 'scheduled' then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  if now() < cur.ends_at then raise exception 'SESSION_IN_FUTURE' using errcode='22023'; end if;
  update public.sessions set status = 'completed', version = version + 1 where id = sid;
  insert into public.session_history(session_id, change_type, by, at) values (sid, 'completed', 'host', now());
  return public.session_json(sid);
end $$;

-- Booking RPCs (actor: learner, unless noted).

create or replace function public.create_booking(session_id uuid, participant_count int default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  uid uuid := public.assert_attendee_caller();
  s public.sessions%rowtype; bid uuid := gen_random_uuid(); reserved bigint;
begin
  if participant_count is null or participant_count < 1 then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  select * into s from public.sessions where id = session_id for update;
  if s.id is null then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  if s.status <> 'scheduled' then raise exception 'SESSION_NOT_OPEN' using errcode='22023'; end if;
  if s.host_id = uid then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  reserved := public.session_hard_reserved(session_id);
  if s.max_participants is not null and reserved + participant_count > s.max_participants then
    raise exception 'INSUFFICIENT_CAPACITY' using errcode='22023';
  end if;
  begin
    insert into public.bookings(id, session_id, learner_id, participant_count, status)
    values (bid, session_id, uid, participant_count, 'requested');
  exception when unique_violation then
    raise exception 'BOOKING_CONFLICT' using errcode='23505';
  end;
  insert into public.booking_history(booking_id, from_status, to_status, actor, at)
  values (bid, null, 'requested', 'attendee', now());
  return public.booking_json(bid);
end $$;

create or replace function public.confirm_booking(booking_id uuid, expected_version bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid := public.assert_attendee_caller(); sid uuid; s public.sessions%rowtype; b public.bookings%rowtype;
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
  update public.bookings set status = 'confirmed', version = version + 1 where id = booking_id;
  insert into public.booking_history(booking_id, from_status, to_status, actor, at)
  values (booking_id, 'requested', 'confirmed', 'host', now());
  return public.booking_json(booking_id);
end $$;

create or replace function public.reject_booking(booking_id uuid, expected_version bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid := public.assert_attendee_caller(); sid uuid; s public.sessions%rowtype; b public.bookings%rowtype;
begin
  select session_id into sid from public.bookings where id = booking_id;
  if not found then raise insufficient_privilege; end if;
  select * into s from public.sessions where id = sid for update;
  if s.host_id <> uid then raise insufficient_privilege; end if;
  select * into b from public.bookings where id = booking_id for update;
  if b.id is null then raise insufficient_privilege; end if;
  if b.version <> expected_version then raise exception 'STALE_VERSION' using errcode='45000'; end if;
  if b.status <> 'requested' then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  update public.bookings set status = 'rejected', version = version + 1 where id = booking_id;
  insert into public.booking_history(booking_id, from_status, to_status, actor, at)
  values (booking_id, 'requested', 'rejected', 'host', now());
  return public.booking_json(booking_id);
end $$;

create or replace function public.cancel_booking(booking_id uuid, expected_version bigint, cause text default 'attendee', reason text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid := public.assert_attendee_caller(); sid uuid; s public.sessions%rowtype; b public.bookings%rowtype; who text;
begin
  select session_id into sid from public.bookings where id = booking_id;
  if not found then raise insufficient_privilege; end if;
  select * into s from public.sessions where id = sid for update;
  select * into b from public.bookings where id = booking_id for update;
  if b.id is null then raise insufficient_privilege; end if;
  if b.version <> expected_version then raise exception 'STALE_VERSION' using errcode='45000'; end if;
  if b.status not in ('requested','confirmed') then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  if b.learner_id = uid then
    who := 'attendee';
    if cause is distinct from 'attendee' then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  elsif s.host_id = uid then
    who := 'host';
    if b.status <> 'confirmed' then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
    if cause is distinct from 'host' then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  else
    raise insufficient_privilege;
  end if;
  update public.bookings set status = 'cancelled', cancelled_by = who, cancelled_reason = reason, version = version + 1
  where id = booking_id;
  insert into public.booking_history(booking_id, from_status, to_status, actor, at, reason)
  values (booking_id, b.status, 'cancelled', who, now(), reason);
  return public.booking_json(booking_id);
end $$;

create or replace function public.complete_booking(booking_id uuid, expected_version bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid := public.assert_attendee_caller(); sid uuid; s public.sessions%rowtype; b public.bookings%rowtype;
begin
  select session_id into sid from public.bookings where id = booking_id;
  if not found then raise insufficient_privilege; end if;
  select * into s from public.sessions where id = sid for update;
  select * into b from public.bookings where id = booking_id for update;
  if b.id is null then raise insufficient_privilege; end if;
  if b.learner_id <> uid then raise insufficient_privilege; end if;
  if b.version <> expected_version then raise exception 'STALE_VERSION' using errcode='45000'; end if;
  if b.status <> 'confirmed' then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  if s.status = 'cancelled' then raise exception 'SESSION_NOT_OPEN' using errcode='22023'; end if;
  if now() < s.ends_at then raise exception 'SESSION_IN_FUTURE' using errcode='22023'; end if;
  insert into public.attendance_facts(booking_id, session_id, outcome, reported_by, at, prior_status)
  values (b.id, b.session_id, 'attended', 'attendee', now(), b.status);
  update public.bookings set status = 'completed', version = version + 1 where id = booking_id;
  insert into public.booking_history(booking_id, from_status, to_status, actor, at)
  values (booking_id, 'confirmed', 'completed', 'attendee', now());
  return public.booking_json(booking_id);
end $$;

create or replace function public.record_attendance(booking_id uuid, outcome text, expected_version bigint, source text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid := public.assert_attendee_caller(); sid uuid; s public.sessions%rowtype; b public.bookings%rowtype; to_status text; cby text; creason text;
begin
  if outcome not in ('attended','learner_no_show') then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  select session_id into sid from public.bookings where id = booking_id;
  if not found then raise insufficient_privilege; end if;
  select * into s from public.sessions where id = sid for update;
  if s.host_id <> uid then raise insufficient_privilege; end if;
  select * into b from public.bookings where id = booking_id for update;
  if b.id is null then raise insufficient_privilege; end if;
  if b.version <> expected_version then raise exception 'STALE_VERSION' using errcode='45000'; end if;
  if b.status <> 'confirmed' then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  if now() < s.ends_at then raise exception 'SESSION_IN_FUTURE' using errcode='22023'; end if;
  insert into public.attendance_facts(booking_id, session_id, outcome, reported_by, at, prior_status, source)
  values (b.id, b.session_id, outcome, 'host', now(), b.status, source);
  if outcome = 'attended' then to_status := 'completed'; cby := null; creason := null;
  else to_status := 'cancelled'; cby := 'host'; creason := outcome; end if;
  update public.bookings set status = to_status, cancelled_by = cby, cancelled_reason = creason, version = version + 1
  where id = booking_id;
  insert into public.booking_history(booking_id, from_status, to_status, actor, at, reason)
  values (booking_id, 'confirmed', to_status, 'host', now(), creason);
  return public.booking_json(booking_id);
end $$;

-- Reschedule RPCs. Capacity + uniqueness of the target are validated at accept
-- time only (design §6 scenario 5); creating a request is cheap and provisional.

create or replace function public.create_reschedule_request(booking_id uuid, target_session_id uuid, expected_version bigint, reason text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  uid uuid := public.assert_attendee_caller();
  b public.bookings%rowtype; t public.sessions%rowtype; rid uuid := gen_random_uuid(); requester text;
begin
  select * into b from public.bookings where id = booking_id for update;
  if b.id is null then raise insufficient_privilege; end if;
  if b.learner_id = uid then requester := 'attendee';
  elsif exists(select 1 from public.sessions where id = b.session_id and host_id = uid) then requester := 'host';
  else raise insufficient_privilege; end if;
  if b.version <> expected_version then raise exception 'STALE_VERSION' using errcode='45000'; end if;
  if b.status not in ('requested','confirmed') then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  if target_session_id = b.session_id then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  select * into t from public.sessions where id = target_session_id;
  if t.id is null then raise insufficient_privilege; end if;
  if t.status <> 'scheduled' then raise exception 'SESSION_NOT_OPEN' using errcode='22023'; end if;
  if requester = 'attendee' and t.host_id = uid then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  begin
    insert into public.reschedule_requests(id, booking_id, from_session_id, to_session_id, requested_by, status, reason)
    values (rid, booking_id, b.session_id, target_session_id, requester, 'requested', reason);
  exception when unique_violation then
    raise exception 'BOOKING_CONFLICT' using errcode='23505';
  end;
  insert into public.booking_history(booking_id, from_status, to_status, actor, at, session_change_from, session_change_to)
  values (booking_id, b.status, b.status, requester, now(), b.session_id, target_session_id);
  return jsonb_build_object('id', rid, 'bookingId', booking_id,
    'fromSessionId', b.session_id, 'toSessionId', target_session_id, 'status', 'requested', 'version', 1);
end $$;

create or replace function public.accept_reschedule_request(request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  uid uuid := public.assert_attendee_caller();
  r public.reschedule_requests%rowtype; b public.bookings%rowtype;
  s_old public.sessions%rowtype; s_new public.sessions%rowtype;
  reserved bigint; s record; counterpart text;
begin
  select * into r from public.reschedule_requests where id = request_id for update;
  if r.id is null then raise insufficient_privilege; end if;
  if r.status <> 'requested' then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  -- Canonical ascending-id lock order over both session rows (two-session atomicity).
  -- Sessions are locked before the booking row to match the global session->booking lock order.
  for s in select * from public.sessions where id in (r.from_session_id, r.to_session_id) order by id for update loop
    if s.id = r.from_session_id then s_old := s; else s_new := s; end if;
  end loop;
  if s_old.id is null or s_new.id is null then raise insufficient_privilege; end if;
  select * into b from public.bookings where id = r.booking_id for update;
  if b.id is null then raise insufficient_privilege; end if;
  if b.session_id <> r.from_session_id or b.status not in ('requested','confirmed') then
    raise exception 'INVALID_TRANSITION' using errcode='22023';
  end if;
  if r.requested_by = 'attendee' then
    if s_new.host_id <> uid then raise insufficient_privilege; end if; counterpart := 'host';
  elsif r.requested_by = 'host' then
    if b.learner_id <> uid then raise insufficient_privilege; end if; counterpart := 'attendee';
  else raise insufficient_privilege; end if;
  if s_old.status <> 'scheduled' or s_new.status <> 'scheduled' then
    raise exception 'INVALID_TRANSITION' using errcode='22023';
  end if;
  reserved := public.session_hard_reserved(r.to_session_id);
  if s_new.max_participants is not null and reserved + b.participant_count > s_new.max_participants then
    raise exception 'INSUFFICIENT_CAPACITY' using errcode='22023';
  end if;
  if exists(select 1 from public.bookings
            where learner_id = b.learner_id and session_id = r.to_session_id and id <> b.id
              and status in ('requested','confirmed')) then
    raise exception 'BOOKING_CONFLICT' using errcode='23505';
  end if;
  update public.bookings set session_id = r.to_session_id, rescheduled_from_session_id = r.from_session_id, version = version + 1
  where id = b.id;
  update public.reschedule_requests set status = 'accepted', resolved_at = now() where id = request_id;
  insert into public.booking_history(booking_id, from_status, to_status, actor, at, session_change_from, session_change_to)
  values (b.id, b.status, b.status, counterpart, now(), r.from_session_id, r.to_session_id);
  return jsonb_build_object('id', b.id, 'sessionId', r.to_session_id,
    'rescheduledFromSessionId', r.from_session_id, 'version', b.version + 1);
end $$;

create or replace function public.reject_reschedule_request(request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid := public.assert_attendee_caller(); r public.reschedule_requests%rowtype; t public.sessions%rowtype; b public.bookings%rowtype;
begin
  select * into r from public.reschedule_requests where id = request_id for update;
  if r.id is null then raise insufficient_privilege; end if;
  if r.status <> 'requested' then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  if r.requested_by = 'attendee' then
    select * into t from public.sessions where id = r.to_session_id;
    if t.host_id <> uid then raise insufficient_privilege; end if;
  elsif r.requested_by = 'host' then
    select * into b from public.bookings where id = r.booking_id;
    if b.learner_id <> uid then raise insufficient_privilege; end if;
  else raise insufficient_privilege; end if;
  update public.reschedule_requests set status = 'rejected', resolved_at = now() where id = request_id;
  return jsonb_build_object('id', request_id, 'status', 'rejected');
end $$;

create or replace function public.cancel_reschedule_request(request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid := public.assert_attendee_caller(); r public.reschedule_requests%rowtype; b public.bookings%rowtype; t public.sessions%rowtype;
begin
  select * into r from public.reschedule_requests where id = request_id for update;
  if r.id is null then raise insufficient_privilege; end if;
  if r.status <> 'requested' then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  select * into b from public.bookings where id = r.booking_id;
  select * into t from public.sessions where id = r.from_session_id;
  if r.requested_by = 'attendee' and b.learner_id = uid then null;
  elsif r.requested_by = 'host' and t.host_id = uid then null;
  else raise insufficient_privilege; end if;
  update public.reschedule_requests set status = 'cancelled', resolved_at = now() where id = request_id;
  return jsonb_build_object('id', request_id, 'status', 'cancelled');
end $$;

-- Reads.

create or replace function public.list_sessions() returns jsonb
language sql stable security definer set search_path='' as $$
select jsonb_agg(public.session_json(s.id) order by s.starts_at)
from public.sessions s where s.status = 'scheduled'
$$;

create or replace function public.get_session(sid uuid) returns jsonb
language sql stable security definer set search_path='' as $$
select public.session_json(sid)
$$;

create or replace function public.get_my_sessions() returns jsonb
language sql stable security definer set search_path='' as $$
select jsonb_agg(public.session_json(s.id) order by s.starts_at)
from public.sessions s where s.host_id = auth.uid()
$$;

create or replace function public.get_my_bookings() returns jsonb
language sql stable security definer set search_path='' as $$
select jsonb_agg(public.booking_json(b.id) order by b.created_at desc)
from public.bookings b where b.learner_id = auth.uid()
$$;

create or replace function public.get_booking(bid uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise insufficient_privilege; end if;
  if not exists(select 1 from public.bookings where id = bid and learner_id = uid)
     and not exists(select 1 from public.bookings b join public.sessions s on s.id = b.session_id where b.id = bid and s.host_id = uid)
  then raise insufficient_privilege; end if;
  return public.booking_json(bid);
end $$;

-- Grants: write + self-scoped reads to authenticated; public session reads to anon + authenticated.
revoke all on function public.create_session(jsonb) from public, anon, authenticated;
revoke all on function public.reschedule_session(uuid, timestamptz, timestamptz, bigint) from public, anon, authenticated;
revoke all on function public.change_session_capacity(uuid, int, bigint) from public, anon, authenticated;
revoke all on function public.cancel_session(uuid, bigint, text, text) from public, anon, authenticated;
revoke all on function public.complete_session(uuid, bigint) from public, anon, authenticated;
revoke all on function public.create_booking(uuid, int) from public, anon, authenticated;
revoke all on function public.confirm_booking(uuid, bigint) from public, anon, authenticated;
revoke all on function public.reject_booking(uuid, bigint) from public, anon, authenticated;
revoke all on function public.cancel_booking(uuid, bigint, text, text) from public, anon, authenticated;
revoke all on function public.complete_booking(uuid, bigint) from public, anon, authenticated;
revoke all on function public.record_attendance(uuid, text, bigint, text) from public, anon, authenticated;
revoke all on function public.create_reschedule_request(uuid, uuid, bigint, text) from public, anon, authenticated;
revoke all on function public.accept_reschedule_request(uuid) from public, anon, authenticated;
revoke all on function public.reject_reschedule_request(uuid) from public, anon, authenticated;
revoke all on function public.cancel_reschedule_request(uuid) from public, anon, authenticated;
revoke all on function public.list_sessions() from public, anon, authenticated;
revoke all on function public.get_session(uuid) from public, anon, authenticated;
revoke all on function public.get_my_sessions() from public, anon, authenticated;
revoke all on function public.get_my_bookings() from public, anon, authenticated;
revoke all on function public.get_booking(uuid) from public, anon, authenticated;

grant execute on function public.create_session(jsonb) to authenticated;
grant execute on function public.reschedule_session(uuid, timestamptz, timestamptz, bigint) to authenticated;
grant execute on function public.change_session_capacity(uuid, int, bigint) to authenticated;
grant execute on function public.cancel_session(uuid, bigint, text, text) to authenticated;
grant execute on function public.complete_session(uuid, bigint) to authenticated;
grant execute on function public.create_booking(uuid, int) to authenticated;
grant execute on function public.confirm_booking(uuid, bigint) to authenticated;
grant execute on function public.reject_booking(uuid, bigint) to authenticated;
grant execute on function public.cancel_booking(uuid, bigint, text, text) to authenticated;
grant execute on function public.complete_booking(uuid, bigint) to authenticated;
grant execute on function public.record_attendance(uuid, text, bigint, text) to authenticated;
grant execute on function public.create_reschedule_request(uuid, uuid, bigint, text) to authenticated;
grant execute on function public.accept_reschedule_request(uuid) to authenticated;
grant execute on function public.reject_reschedule_request(uuid) to authenticated;
grant execute on function public.cancel_reschedule_request(uuid) to authenticated;
grant execute on function public.get_my_sessions() to authenticated;
grant execute on function public.get_my_bookings() to authenticated;
grant execute on function public.get_booking(uuid) to authenticated;
grant execute on function public.list_sessions() to anon, authenticated;
grant execute on function public.get_session(uuid) to anon, authenticated;


