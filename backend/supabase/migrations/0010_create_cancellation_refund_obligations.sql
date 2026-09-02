-- Tutoria cancellation + refund obligation persistence (Phase 2).
--
-- Phase 1 (backend/src/domain/cancellation-refund-policy.ts) is the accepted
-- policy spec (P1-P9). This migration makes the cancellation paths create a
-- DURABLE refund obligation atomically inside the same transaction as the
-- cancellation, matching the accepted Phase 2 boundary (durable `refunds`
-- rows in the pre-execution `obligation` state only; no provider refund
-- execution, no reconciliation, no outbox consumer -- all Phase 3).
--
-- Enforcement-authority reconciliation: cancellation RPCs are callable by
-- authenticated clients (0005 grants persist), so the 24h cutoff decision
-- CANNOT be passed in as a caller-controlled parameter (a client could
-- fabricate a refund it is not owed). The runtime decision therefore lives at
-- the enforcement point (the database). The 24h value is defined exactly once
-- in SQL (public.cancellation_refund_cutoff()); the pure TS module remains the
-- policy spec and test oracle, and the integration suite cross-checks the two
-- values so they can never silently diverge.
--
-- Decision map (kind): P1 attendee >= 24h before the authoritative
-- (post-reschedule) Session.starts_at -> FULL 'standard'; P5 host cancel of a
-- confirmed paid booking -> FULL 'standard' regardless of timing; P6 whole
-- Session cancel -> FULL 'standard' per paid affected booking; P3 unpaid ->
-- NONE; P4 payment still in flight at cancellation -> no obligation yet, but
-- the durable marker bookings.cancel_payment_in_flight_at records the duty so
-- finalize_paid_booking creates the FULL 'system_compensation' obligation when
-- (and only when) the provider later proves the payment succeeded. P2 (NONE or
-- FULL only) and P7 (FULL == full captured gross) are enforced by construction.
-- No-show (record_attendance learner_no_show) stays financial-neutral (P9:
-- no-show consequences are out of scope) and never sets the in-flight marker.
--
-- Cancellation legality is unchanged (booking-lifecycle authority); only the
-- refund consequence is added. Grants on the CREATE OR REPLACEd functions
-- persist unchanged. 0001-0009 and the read-model/security migrations are
-- untouched.

-- 1) Refund kind vocabulary: RefundKind = 'standard' | 'system_compensation'
--    (policy RefundKind), plus the existing support kind. 'system_compensation'
--    is reserved for the P4 late-success duty only.
alter table public.refunds drop constraint if exists refunds_kind_check;
alter table public.refunds add constraint refunds_kind_check check (kind in ('standard','system_compensation','support'));

-- 2) P4 durable duty marker: set when a booking is cancelled (or a pending
--    request rejected) while its payment is still in flight. finalize_paid_booking
--    reads it to decide the system_compensation obligation on late success.
alter table public.bookings
  add column if not exists cancel_payment_in_flight_at timestamptz;

-- 3) Single SQL definition of the 24h cancellation refund cutoff, mirroring
--    CANCELLATION_REFUND_CUTOFF_HOURS in cancellation-refund-policy.ts (the
--    spec authority). Never redefine 24 elsewhere in SQL.
create or replace function public.cancellation_refund_cutoff() returns interval
language sql stable security definer set search_path='' as $$
  select interval '24 hours'
$$;
revoke all on function public.cancellation_refund_cutoff() from public, anon, authenticated;

-- 4) cancel_booking: unchanged legality/events, plus:
--    - payment-aware refund obligation (P1/P3/P4/P5),
--    - pending-reschedule termination (RESCHEDULE_CANCELLED),
--    - REFUND_OBLIGATION_CREATED + payment_events audit when an obligation is created.
create or replace function public.cancel_booking(booking_id uuid, expected_version bigint, cause text default 'attendee', reason text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare
  uid uuid := public.assert_attendee_caller(); sid uuid; s public.sessions%rowtype; b public.bookings%rowtype; who text;
  p public.payments%rowtype; r public.refunds%rowtype; rr record;
  bid uuid := booking_id; in_flight_at timestamptz; obligation_created boolean := false;
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

  -- Lock order session -> booking -> payment, matching finalize_paid_booking.
  -- NOTE: qualify payments.booking_id explicitly; under #variable_conflict use_variable,
  -- the bare name resolves to the booking_id parameter, which would make the filter
  -- compare the parameter against itself and pick an arbitrary payment row.
  select * into p from public.payments where public.payments.booking_id = bid for update;
  if p.id is not null then
    if p.status = 'pending' then
      -- P4: no decision yet; record the durable duty for finalize on late success.
      in_flight_at := now();
    elsif p.status = 'succeeded' then
      if (who = 'host' and b.status = 'confirmed')
         or (who = 'attendee' and b.status = 'confirmed'
             and s.starts_at - now() >= public.cancellation_refund_cutoff())
      then
        -- P5 (host, always FULL) or P1 (attendee at least 24h before start, FULL).
        insert into public.refunds(payment_id,kind,status,amount_vnd,idempotency_key,reason)
        values (p.id,'standard','obligation',p.amount_vnd,'cancel:'||who||':'||b.id::text,
          case who when 'host' then 'tutor cancellation of confirmed paid booking (P5)'
                   else 'learner cancellation at least 24h before session start (P1)' end)
        on conflict (payment_id, idempotency_key) do nothing returning * into r;
        if r.id is not null then
          obligation_created := true;
          insert into public.payment_events(payment_id,event_type,from_status,to_status,amount_vnd,payload)
          values (p.id,'refund_obligation_created',p.status,p.status,r.amount_vnd,jsonb_build_object('refundId',r.id,'bookingId',b.id));
        end if;
      end if;
    end if;
  end if;

  update public.bookings set status = 'cancelled', cancelled_by = who, cancelled_reason = reason,
         cancel_payment_in_flight_at = coalesce(in_flight_at, cancel_payment_in_flight_at),
         version = version + 1
  where id = booking_id;
  insert into public.booking_history(booking_id, from_status, to_status, actor, at, reason)
  values (booking_id, b.status, 'cancelled', who, now(), reason);
  perform public.insert_outbox_event('BOOKING_CANCELLED', 'booking', booking_id, b.version + 1,
    jsonb_build_object('bookingId', booking_id, 'sessionId', sid, 'cancelledBy', who, 'fromStatus', b.status)
    || case when reason is not null then jsonb_build_object('reason', reason) else '{}'::jsonb end);

  -- Auto-promote from waitlist if spots open up
  perform public.promote_from_waitlist(sid);

  -- Terminate the booking's pending reschedule request (at most one per booking).
  update public.reschedule_requests
     set status = 'cancelled', resolved_at = now()
   where public.reschedule_requests.booking_id = bid and status = 'requested'
   returning id, from_session_id, to_session_id into rr;
  if rr.id is not null then
    perform public.insert_outbox_event('RESCHEDULE_CANCELLED', 'booking', booking_id, b.version + 1,
      jsonb_build_object('requestId', rr.id, 'bookingId', booking_id,
        'fromSessionId', rr.from_session_id, 'toSessionId', rr.to_session_id, 'actor', who));
  end if;

  if obligation_created then
    perform public.insert_outbox_event('REFUND_OBLIGATION_CREATED', 'payment', p.id, p.version,
      jsonb_build_object('paymentId', p.id, 'refundId', r.id, 'amountVnd', r.amount_vnd));
  end if;
  return public.booking_json(booking_id);
end $$;

-- 5) cancel_session: P6 refunds every paid affected booking FULL ('standard'),
--    marks P4 in-flight duty, terminates this booking's pending reschedule and
--    any pending reschedule targeting this cancelled session from other bookings.
create or replace function public.cancel_session(sid uuid, expected_version bigint, cause text default 'host', reason text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  uid uuid := public.assert_host_of_session(sid); cur public.sessions%rowtype; b record;
  p public.payments%rowtype; r public.refunds%rowtype; rr record; qr record; bv bigint;
  in_flight_at timestamptz; obligation_created boolean := false;
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
    in_flight_at := null; obligation_created := false;
    select * into p from public.payments where booking_id = b.id for update;
    if p.id is not null then
      if p.status = 'pending' then
        in_flight_at := now();
      elsif p.status = 'succeeded' then
        insert into public.refunds(payment_id,kind,status,amount_vnd,idempotency_key,reason)
        values (p.id,'standard','obligation',p.amount_vnd,'cancel:session:'||b.id::text,'session cancelled (P6)')
        on conflict (payment_id, idempotency_key) do nothing returning * into r;
        if r.id is not null then
          obligation_created := true;
          insert into public.payment_events(payment_id,event_type,from_status,to_status,amount_vnd,payload)
          values (p.id,'refund_obligation_created',p.status,p.status,r.amount_vnd,jsonb_build_object('refundId',r.id,'bookingId',b.id));
        end if;
      end if;
    end if;
    update public.bookings set status = 'cancelled', cancelled_by = 'host', cancelled_by_session_id = sid,
           cancel_payment_in_flight_at = coalesce(in_flight_at, cancel_payment_in_flight_at),
           version = version + 1 where id = b.id;
    insert into public.booking_history(booking_id, from_status, to_status, actor, at, cancelled_by_session_id)
    values (b.id, b.status, 'cancelled', 'host', now(), sid);
    perform public.insert_outbox_event('BOOKING_CANCELLED', 'booking', b.id, b.version + 1,
      jsonb_build_object('bookingId', b.id, 'sessionId', sid, 'cancelledBy', 'host',
        'fromStatus', b.status, 'cancelledBySessionId', sid));

    -- Auto-promote from waitlist if spots open up
    perform public.promote_from_waitlist(sid);
    if obligation_created then
      perform public.insert_outbox_event('REFUND_OBLIGATION_CREATED', 'payment', p.id, p.version,
        jsonb_build_object('paymentId', p.id, 'refundId', r.id, 'amountVnd', r.amount_vnd));
    end if;
    update public.reschedule_requests set status = 'cancelled', resolved_at = now()
      where public.reschedule_requests.booking_id = b.id and status = 'requested'
      returning id, from_session_id, to_session_id into rr;
    if rr.id is not null then
      perform public.insert_outbox_event('RESCHEDULE_CANCELLED', 'booking', b.id, b.version + 1,
        jsonb_build_object('requestId', rr.id, 'bookingId', b.id,
          'fromSessionId', rr.from_session_id, 'toSessionId', rr.to_session_id, 'actor', 'host'));
    end if;
  end loop;
  -- Terminate pending reschedule requests that target this cancelled session
  -- from bookings on other sessions (their bookings are NOT cancelled).
  for qr in select id, booking_id, from_session_id, to_session_id
             from public.reschedule_requests
             where to_session_id = sid and status = 'requested' for update loop
    select version into bv from public.bookings where id = qr.booking_id;
    update public.reschedule_requests set status = 'cancelled', resolved_at = now() where id = qr.id;
    perform public.insert_outbox_event('RESCHEDULE_CANCELLED', 'booking', qr.booking_id, coalesce(bv, 1),
      jsonb_build_object('requestId', qr.id, 'bookingId', qr.booking_id,
        'fromSessionId', qr.from_session_id, 'toSessionId', qr.to_session_id, 'actor', 'host'));
  end loop;
  return public.session_json(sid);
end $$;

-- 6) reject_booking: record the P4 in-flight duty so finalize_paid_booking can
--    compensate a rejected booking whose payment proves successful later.
--    Legality and events are unchanged.
create or replace function public.reject_booking(booking_id uuid, expected_version bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare uid uuid := public.assert_attendee_caller(); sid uuid; s public.sessions%rowtype; b public.bookings%rowtype; p public.payments%rowtype; bid uuid := booking_id; in_flight_at timestamptz;
begin
  select session_id into sid from public.bookings where id = bid;
  if not found then raise insufficient_privilege; end if;
  select * into s from public.sessions where id = sid for update;
  if s.host_id <> uid then raise insufficient_privilege; end if;
  select * into b from public.bookings where id = bid for update;
  if b.id is null then raise insufficient_privilege; end if;
  if b.version <> expected_version then raise exception 'STALE_VERSION' using errcode='45000'; end if;
  if b.status <> 'requested' then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  select * into p from public.payments where public.payments.booking_id = bid for update;
  if p.id is not null and p.status = 'pending' then in_flight_at := now(); end if;
  update public.bookings set status = 'rejected', cancel_payment_in_flight_at = coalesce(in_flight_at, cancel_payment_in_flight_at), version = version + 1
  where id = bid;
  insert into public.booking_history(booking_id, from_status, to_status, actor, at)
  values (bid, 'requested', 'rejected', 'host', now());
  perform public.insert_outbox_event('BOOKING_REJECTED', 'booking', bid, b.version + 1,
    jsonb_build_object('bookingId', bid, 'sessionId', sid, 'fromStatus', b.status));
  return public.booking_json(bid);
end $$;

-- 7) finalize_paid_booking: confirm only the legitimately finalizable state;
--    create the P4 system_compensation obligation only when the booking was
--    cancelled/rejected while its payment was still in flight (durable marker)
--    and the payment later proved successful. This closes the spurious
--    compensation bug (compensation no longer created for already-confirmed,
--    already-completed, or already-decided-at-cancel bookings). Idempotency key
--    is preserved so pre-existing compensation rows stay idempotent.
create or replace function public.finalize_paid_booking(p_booking_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype; s public.sessions%rowtype; p public.payments%rowtype; r public.refunds%rowtype;
begin
  select session_id into b.session_id from public.bookings where id=p_booking_id;
  if b.session_id is null then raise exception 'BOOKING_FINALIZATION_FAILED' using errcode='22023'; end if;
  select * into s from public.sessions where id=b.session_id for update;
  select * into b from public.bookings where id=p_booking_id for update;
  select * into p from public.payments where booking_id=b.id for update;
  if p.status = 'succeeded' and b.status = 'requested' and s.status = 'scheduled' then
    update public.bookings set status='confirmed',version=version+1 where id=b.id;
    insert into public.booking_history(booking_id,from_status,to_status,actor,at) values(b.id,'requested','confirmed','host',now());
    perform public.insert_outbox_event('BOOKING_CONFIRMED','booking',b.id,b.version+1,jsonb_build_object('bookingId',b.id,'sessionId',b.session_id,'fromStatus','requested','paymentId',p.id));
    return jsonb_build_object('finalized',true,'bookingId',b.id,'paymentId',p.id);
  end if;
  if p.status = 'succeeded' and b.status in ('cancelled','rejected') and b.cancel_payment_in_flight_at is not null
     and not exists(select 1 from public.refunds where payment_id=p.id and kind='system_compensation') then
    insert into public.refunds(payment_id,kind,status,amount_vnd,idempotency_key,reason)
    values(p.id,'system_compensation','obligation',p.amount_vnd,'compensation:'||p.id::text,'payment succeeded after the booking was cancelled while payment was in flight (P4)')
    on conflict (payment_id, idempotency_key) do nothing returning * into r;
    if r.id is not null then
      insert into public.payment_events(payment_id,event_type,from_status,to_status,amount_vnd,payload) values(p.id,'finalization_failed',p.status,p.status,p.amount_vnd,jsonb_build_object('bookingId',b.id));
      perform public.insert_outbox_event('BOOKING_FINALIZATION_FAILED','booking',b.id,b.version,jsonb_build_object('bookingId',b.id,'paymentId',p.id));
      perform public.insert_outbox_event('REFUND_OBLIGATION_CREATED','payment',p.id,p.version,jsonb_build_object('paymentId',p.id,'refundId',r.id,'amountVnd',r.amount_vnd));
    end if;
  end if;
  return jsonb_build_object('finalized',false,'bookingId',b.id,'paymentId',p.id);
end $$;
