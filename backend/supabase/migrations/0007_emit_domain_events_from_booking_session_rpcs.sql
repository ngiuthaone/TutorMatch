-- Tutoria reliable domain events: emit committed domain facts transactionally.
--
-- This migration CREATE OR REPLACEs the 0005 booking/session mutation RPCs so
-- that every committed authoritative mutation also writes its outbox record in
-- the SAME transaction (see docs/agent-team/DESIGN-OUTBOX-EVENTS.md).
-- A failed mutation raises before any insert_outbox_event call, so a rolled
-- back mutation can never leave a false event. aggregate_version is the row
-- CAS version after the mutation (unchanged for provisional reschedule-request
-- creation). No event is emitted for create_session / change_session_capacity /
-- complete_session (no corresponding domain event exists). 0001-0005 are
-- otherwise untouched; grants from 0005 persist on CREATE OR REPLACE.

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
  perform public.insert_outbox_event('SESSION_RESCHEDULED', 'session', sid, cur.version + 1,
    jsonb_build_object('sessionId', sid, 'oldStart', cur.starts_at, 'oldEnd', cur.ends_at,
      'newStart', reschedule_session.starts_at, 'newEnd', reschedule_session.ends_at));
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
  perform public.insert_outbox_event('SESSION_CANCELLED', 'session', sid, cur.version + 1,
    jsonb_build_object('sessionId', sid, 'cause', cause)
    || case when reason is not null then jsonb_build_object('reason', reason) else '{}'::jsonb end);
  for b in select id, status, version from public.bookings where session_id = sid and status in ('requested','confirmed') for update loop
    update public.bookings set status = 'cancelled', cancelled_by = 'host', cancelled_by_session_id = sid, version = version + 1 where id = b.id;
    insert into public.booking_history(booking_id, from_status, to_status, actor, at, cancelled_by_session_id)
    values (b.id, b.status, 'cancelled', 'host', now(), sid);
    perform public.insert_outbox_event('BOOKING_CANCELLED', 'booking', b.id, b.version + 1,
      jsonb_build_object('bookingId', b.id, 'sessionId', sid, 'cancelledBy', 'host',
        'fromStatus', b.status, 'cancelledBySessionId', sid));
  end loop;
  return public.session_json(sid);
end $$;

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
  perform public.insert_outbox_event('BOOKING_REQUESTED', 'booking', bid, 1,
    jsonb_build_object('bookingId', bid, 'sessionId', session_id, 'participantCount', participant_count));
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
  perform public.insert_outbox_event('BOOKING_CONFIRMED', 'booking', booking_id, b.version + 1,
    jsonb_build_object('bookingId', booking_id, 'sessionId', sid, 'fromStatus', b.status));
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
  perform public.insert_outbox_event('BOOKING_REJECTED', 'booking', booking_id, b.version + 1,
    jsonb_build_object('bookingId', booking_id, 'sessionId', sid, 'fromStatus', b.status));
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
  perform public.insert_outbox_event('BOOKING_CANCELLED', 'booking', booking_id, b.version + 1,
    jsonb_build_object('bookingId', booking_id, 'sessionId', sid, 'cancelledBy', who, 'fromStatus', b.status)
    || case when reason is not null then jsonb_build_object('reason', reason) else '{}'::jsonb end);
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
  perform public.insert_outbox_event('BOOKING_COMPLETED', 'booking', booking_id, b.version + 1,
    jsonb_build_object('bookingId', booking_id, 'sessionId', sid, 'fromStatus', b.status));
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
  perform public.insert_outbox_event('ATTENDANCE_REPORTED', 'booking', booking_id, b.version + 1,
    jsonb_build_object('bookingId', booking_id, 'sessionId', sid, 'outcome', outcome,
      'priorStatus', b.status, 'reportedBy', 'host')
    || case when source is not null then jsonb_build_object('source', source) else '{}'::jsonb end);
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
  perform public.insert_outbox_event('RESCHEDULE_REQUESTED', 'booking', booking_id, b.version,
    jsonb_build_object('requestId', rid, 'bookingId', booking_id, 'fromSessionId', b.session_id,
      'toSessionId', target_session_id, 'requestedBy', requester)
    || case when reason is not null then jsonb_build_object('reason', reason) else '{}'::jsonb end);
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
  perform public.insert_outbox_event('BOOKING_RESCHEDULED', 'booking', b.id, b.version + 1,
    jsonb_build_object('bookingId', b.id, 'sessionId', r.to_session_id, 'requestId', r.id,
      'fromSessionId', r.from_session_id, 'toSessionId', r.to_session_id, 'fromStatus', b.status)
    || case when r.reason is not null then jsonb_build_object('reason', r.reason) else '{}'::jsonb end);
  return jsonb_build_object('id', b.id, 'sessionId', r.to_session_id,
    'rescheduledFromSessionId', r.from_session_id, 'version', b.version + 1);
end $$;

create or replace function public.reject_reschedule_request(request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid := public.assert_attendee_caller(); r public.reschedule_requests%rowtype; t public.sessions%rowtype; b public.bookings%rowtype; actor text;
begin
  select * into r from public.reschedule_requests where id = request_id for update;
  if r.id is null then raise insufficient_privilege; end if;
  if r.status <> 'requested' then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  select * into b from public.bookings where id = r.booking_id;
  if r.requested_by = 'attendee' then
    select * into t from public.sessions where id = r.to_session_id;
    if t.host_id <> uid then raise insufficient_privilege; end if;
    actor := 'host';
  elsif r.requested_by = 'host' then
    select * into b from public.bookings where id = r.booking_id;
    if b.learner_id <> uid then raise insufficient_privilege; end if;
    actor := 'attendee';
  else raise insufficient_privilege; end if;
  update public.reschedule_requests set status = 'rejected', resolved_at = now() where id = request_id;
  perform public.insert_outbox_event('RESCHEDULE_REJECTED', 'booking', b.id, b.version,
    jsonb_build_object('requestId', request_id, 'bookingId', b.id,
      'fromSessionId', r.from_session_id, 'toSessionId', r.to_session_id, 'actor', actor));
  return jsonb_build_object('id', request_id, 'status', 'rejected');
end $$;

create or replace function public.cancel_reschedule_request(request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid := public.assert_attendee_caller(); r public.reschedule_requests%rowtype; b public.bookings%rowtype; t public.sessions%rowtype; actor text;
begin
  select * into r from public.reschedule_requests where id = request_id for update;
  if r.id is null then raise insufficient_privilege; end if;
  if r.status <> 'requested' then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  select * into b from public.bookings where id = r.booking_id;
  select * into t from public.sessions where id = r.from_session_id;
  if r.requested_by = 'attendee' and b.learner_id = uid then actor := 'attendee';
  elsif r.requested_by = 'host' and t.host_id = uid then actor := 'host';
  else raise insufficient_privilege; end if;
  update public.reschedule_requests set status = 'cancelled', resolved_at = now() where id = request_id;
  perform public.insert_outbox_event('RESCHEDULE_CANCELLED', 'booking', b.id, b.version,
    jsonb_build_object('requestId', request_id, 'bookingId', b.id,
      'fromSessionId', r.from_session_id, 'toSessionId', r.to_session_id, 'actor', actor));
  return jsonb_build_object('id', request_id, 'status', 'cancelled');
end $$;
