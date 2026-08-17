-- Close the Phase 2 race between an individual learner cancellation and the
-- host's whole-session cancellation. Both commands already lock the session
-- first; after that lock is acquired, a session cancellation must still have
-- an active booking to cancel. If the learner won the race, the host command
-- now observes the committed terminal booking and rejects deterministically.

create or replace function public.cancel_session(sid uuid, expected_version bigint, cause text default 'host', reason text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  uid uuid := public.assert_host_of_session(sid); cur public.sessions%rowtype; b record;
  p public.payments%rowtype; r public.refunds%rowtype; rr record; qr record; bv bigint;
  in_flight_at timestamptz; obligation_created boolean := false;
begin
  -- Canonical lock order remains session -> booking -> payment. The guard is
  -- evaluated only after the session lock, so it cannot observe a stale active
  -- booking while a competing cancel_booking is committing.
  select * into cur from public.sessions where id = sid for update;
  if cur.id is null then raise insufficient_privilege; end if;
  if cur.version <> expected_version then raise exception 'STALE_VERSION' using errcode='40001'; end if;
  if cur.status <> 'scheduled' then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  if cause is distinct from 'host' then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  if not exists (
    select 1 from public.bookings
    where session_id = sid and status in ('requested','confirmed')
  ) then
    raise exception 'INVALID_TRANSITION' using errcode='22023';
  end if;

  update public.sessions set status = 'cancelled', version = version + 1 where id = sid;
  insert into public.session_history(session_id, change_type, by, at, cause, reason) values (sid, 'cancelled', 'host', now(), cause, reason);
  perform public.insert_outbox_event('SESSION_CANCELLED', 'session', sid, cur.version + 1,
    jsonb_build_object('sessionId', sid, 'cause', cause)
    || case when reason is not null then jsonb_build_object('reason', reason) else '{}'::jsonb end);
  for b in select id, status, version from public.bookings where session_id = sid and status in ('requested','confirmed') for update loop
    in_flight_at := null; obligation_created := false;
    select * into p from public.payments where public.payments.booking_id = b.id for update;
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
