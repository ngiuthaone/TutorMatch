-- ============================================================================
-- 20260820120000_host_authorization_consistency.sql
--
-- Fix: Replace direct `s.host_id = uid` checks in booking mutation RPCs
-- with the generic `can_manage_offering()` / `assert_host_of_session()` pattern.
--
-- Problem: A co-host added via `offering_hosts` who is NOT the session's
-- `host_id` column value cannot approve, reject, cancel, or read bookings
-- even though `can_manage_offering()` grants them host capability.
--
-- Fix scope:
--   1. approve_booking_for_payment  — use assert_host_of_session()
--   2. reject_booking               — use assert_host_of_session()
--   3. cancel_booking               — use can_manage_offering() for host branch
--   4. get_booking                  — use can_manage_offering() for host read
--   5. booking_read_json            — use can_manage_offering() for action booleans
--
-- Additive only. No columns changed. No data deleted. No prior migrations modified.
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. approve_booking_for_payment
--    OLD: if s.host_id <> uid then raise insufficient_privilege
--    NEW: perform public.assert_host_of_session(s.id)
-- ──────────────────────────────────────────────────────────────────────────────
create or replace function public.approve_booking_for_payment(p_booking_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  uid uuid := public.assert_attendee_caller();
  b public.bookings%rowtype;
  s public.sessions%rowtype;
  a public.booking_approvals%rowtype;
begin
  select session_id into b.session_id from public.bookings where id = p_booking_id;
  if b.session_id is null then
    raise insufficient_privilege;
  end if;

  select * into s from public.sessions where id = b.session_id for update;

  -- Generic host authorization: direct host_id OR offering_hosts capability
  perform public.assert_host_of_session(s.id);

  select * into b from public.bookings where id = p_booking_id for update;
  if b.status <> 'requested' then
    raise exception 'INVALID_TRANSITION' using errcode='22023';
  end if;

  insert into public.booking_approvals(booking_id, approved_by)
    values (b.id, uid)
    on conflict (booking_id) do update
      set approved_by = excluded.approved_by,
          approved_at = now(),
          revoked_at = null
    returning * into a;

  perform public.insert_outbox_event(
    'BOOKING_APPROVED_FOR_PAYMENT', 'booking', b.id, b.version,
    jsonb_build_object('bookingId', b.id, 'sessionId', b.session_id)
  );

  return jsonb_build_object(
    'bookingId', b.id,
    'approvedAt', a.approved_at,
    'expiresAt', a.expires_at
  );
end $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. reject_booking
--    OLD: if s.host_id <> uid then raise insufficient_privilege
--    NEW: perform public.assert_host_of_session(s.id)
-- ──────────────────────────────────────────────────────────────────────────────
create or replace function public.reject_booking(booking_id uuid, expected_version bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare
  uid uuid := public.assert_attendee_caller();
  sid uuid;
  s public.sessions%rowtype;
  b public.bookings%rowtype;
  p public.payments%rowtype;
  bid uuid := booking_id;
  in_flight_at timestamptz;
begin
  select session_id into sid from public.bookings where id = bid;
  if not found then
    raise insufficient_privilege;
  end if;

  select * into s from public.sessions where id = sid for update;

  -- Generic host authorization: direct host_id OR offering_hosts capability
  perform public.assert_host_of_session(s.id);

  select * into b from public.bookings where id = bid for update;
  if b.id is null then
    raise insufficient_privilege;
  end if;
  if b.version <> expected_version then
    raise exception 'STALE_VERSION' using errcode='45000';
  end if;
  if b.status <> 'requested' then
    raise exception 'INVALID_TRANSITION' using errcode='22023';
  end if;

  select * into p from public.payments where public.payments.booking_id = bid for update;
  if p.id is not null and p.status = 'pending' then
    in_flight_at := now();
  end if;

  update public.bookings
    set status = 'rejected',
        cancel_payment_in_flight_at = coalesce(in_flight_at, cancel_payment_in_flight_at),
        version = version + 1
  where id = bid;

  insert into public.booking_history(booking_id, from_status, to_status, actor, at)
    values (bid, 'requested', 'rejected', 'host', now());

  perform public.insert_outbox_event(
    'BOOKING_REJECTED', 'booking', bid, b.version + 1,
    jsonb_build_object('bookingId', bid, 'sessionId', sid, 'fromStatus', b.status)
  );

  return public.booking_json(bid);
end $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. cancel_booking
--    OLD: elsif s.host_id = uid then  (direct column check)
--    NEW: elsif public.can_manage_offering(uid, (SELECT offering_id FROM sessions WHERE id = sid), 'host') then
-- ──────────────────────────────────────────────────────────────────────────────
create or replace function public.cancel_booking(
  booking_id uuid,
  expected_version bigint,
  cause text default 'attendee',
  reason text default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare
  uid uuid := public.assert_attendee_caller();
  sid uuid;
  s public.sessions%rowtype;
  b public.bookings%rowtype;
  who text;
  p public.payments%rowtype;
  r public.refunds%rowtype;
  rr record;
  bid uuid := booking_id;
  in_flight_at timestamptz;
  obligation_created boolean := false;
  session_offering_id uuid;
begin
  select session_id into sid from public.bookings where id = booking_id;
  if not found then
    raise insufficient_privilege;
  end if;

  select * into s from public.sessions where id = sid for update;
  select * into b from public.bookings where id = booking_id for update;
  if b.id is null then
    raise insufficient_privilege;
  end if;
  if b.version <> expected_version then
    raise exception 'STALE_VERSION' using errcode='45000';
  end if;
  if b.status not in ('requested', 'confirmed') then
    raise exception 'INVALID_TRANSITION' using errcode='22023';
  end if;

  -- Resolve the offering_id for generic host check
  select s.offering_id into session_offering_id;

  if b.learner_id = uid then
    who := 'attendee';
    if cause is distinct from 'attendee' then
      raise exception 'INVALID_TRANSITION' using errcode='22023';
    end if;
  elsif s.host_id = uid or public.can_manage_offering(uid, session_offering_id, 'host') then
    who := 'host';
    if b.status <> 'confirmed' then
      raise exception 'INVALID_TRANSITION' using errcode='22023';
    end if;
    if cause is distinct from 'host' then
      raise exception 'INVALID_TRANSITION' using errcode='22023';
    end if;
  else
    raise insufficient_privilege;
  end if;

  -- Lock order: session -> booking -> payment (matching finalize_paid_booking)
  select * into p from public.payments where public.payments.booking_id = bid for update;
  if p.id is not null then
    if p.status = 'pending' then
      in_flight_at := now();
    elsif p.status = 'succeeded' then
      if (who = 'host' and b.status = 'confirmed')
         or (who = 'attendee' and b.status = 'confirmed'
             and s.starts_at - now() >= public.cancellation_refund_cutoff())
      then
        insert into public.refunds(payment_id, kind, status, amount_vnd, idempotency_key, reason)
          values (
            p.id, 'standard', 'obligation', p.amount_vnd,
            'cancel:' || who || ':' || b.id::text,
            case who
              when 'host' then 'tutor cancellation of confirmed paid booking (P5)'
              else 'learner cancellation at least 24h before session start (P1)'
            end
          )
          on conflict (payment_id, idempotency_key) do nothing
          returning * into r;
        if r.id is not null then
          obligation_created := true;
          insert into public.payment_events(payment_id, event_type, from_status, to_status, amount_vnd, payload)
            values (p.id, 'refund_obligation_created', p.status, p.status, r.amount_vnd,
              jsonb_build_object('refundId', r.id, 'bookingId', b.id));
        end if;
      end if;
    end if;
  end if;

  update public.bookings
    set status = 'cancelled',
        cancelled_by = who,
        cancelled_reason = reason,
        cancel_payment_in_flight_at = coalesce(in_flight_at, cancel_payment_in_flight_at),
        version = version + 1
  where id = booking_id;

  insert into public.booking_history(booking_id, from_status, to_status, actor, at, reason)
    values (booking_id, b.status, 'cancelled', who, now(), reason);

  perform public.insert_outbox_event(
    'BOOKING_CANCELLED', 'booking', booking_id, b.version + 1,
    jsonb_build_object(
      'bookingId', booking_id,
      'sessionId', sid,
      'cancelledBy', who,
      'fromStatus', b.status
    )
    || case when reason is not null then jsonb_build_object('reason', reason) else '{}'::jsonb end
  );

  -- Terminate the booking's pending reschedule request (at most one per booking)
  update public.reschedule_requests
    set status = 'cancelled', resolved_at = now()
  where public.reschedule_requests.booking_id = bid and status = 'requested'
  returning id, from_session_id, to_session_id into rr;
  if rr.id is not null then
    perform public.insert_outbox_event(
      'RESCHEDULE_CANCELLED', 'booking', booking_id, b.version + 1,
      jsonb_build_object(
        'requestId', rr.id,
        'bookingId', booking_id,
        'fromSessionId', rr.from_session_id,
        'toSessionId', rr.to_session_id,
        'actor', who
      )
    );
  end if;

  if obligation_created then
    perform public.insert_outbox_event(
      'REFUND_OBLIGATION_CREATED', 'payment', p.id, p.version,
      jsonb_build_object('paymentId', p.id, 'refundId', r.id, 'amountVnd', r.amount_vnd)
    );
  end if;

  return public.booking_json(booking_id);
end $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. get_booking
--    OLD: NOT EXISTS (... s.host_id = uid)
--    NEW: NOT EXISTS (... s.host_id = uid) AND NOT EXISTS (... can_manage_offering)
-- ──────────────────────────────────────────────────────────────────────────────
create or replace function public.get_booking(bid uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise insufficient_privilege;
  end if;

  if not exists(
    select 1 from public.bookings where id = bid and learner_id = uid
  ) and not exists(
    select 1 from public.bookings b
    join public.sessions s on s.id = b.session_id
    join public.offerings o on o.id = s.offering_id
    where b.id = bid
      and (s.host_id = uid or public.can_manage_offering(uid, o.id, 'host'))
  ) then
    raise insufficient_privilege;
  end if;

  return public.booking_read_json(bid);
end $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. booking_read_json — action boolean consistency
--    OLD: canHostAccept/canHostReject use s.host_id = auth.uid()
--    NEW: use can_manage_offering(auth.uid(), o.id, 'host')
-- ──────────────────────────────────────────────────────────────────────────────
create or replace function public.booking_read_json(bid uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
select jsonb_build_object(
  'id', b.id,
  'sessionId', b.session_id,
  'status', b.status,
  'participantCount', b.participant_count,
  'rescheduledFromSessionId', b.rescheduled_from_session_id,
  'cancelledReason', b.cancelled_reason,
  'cancelledBy', b.cancelled_by,
  'cancelledBySessionId', b.cancelled_by_session_id,
  'version', b.version,
  'createdAt', b.created_at,
  'updatedAt', b.updated_at,
  'pricing', case when b.pricing_amount_vnd is null then null else jsonb_build_object(
    'amountVnd', b.pricing_amount_vnd,
    'currency', b.pricing_currency,
    'hourlyRateVnd', b.pricing_hourly_rate_vnd,
    'durationMinutes', b.pricing_duration_minutes,
    'unitPriceVnd', b.pricing_unit_price_vnd,
    'participantCountPricing', b.pricing_participant_count,
    'model', b.pricing_model,
    'snapshottedAt', b.pricing_snapshotted_at
  ) end,
  'session', public.session_json(b.session_id),
  'offering', jsonb_build_object(
    'id', o.id,
    'kind', o.kind,
    'title', o.title
  ),
  'host', jsonb_build_object(
    'id', s.host_id,
    'displayName', case
      when o.kind = 'tutor' then tp.display_name
      else p_host.name
    end
  ),
  'tutor', case when o.kind = 'tutor' then jsonb_build_object(
    'id', tp.id,
    'displayName', tp.display_name
  ) else null end,
  'payment', case when p.id is null then null else jsonb_build_object(
    'id', p.id,
    'status', p.status,
    'amountVnd', p.amount_vnd,
    'currency', p.currency,
    'refundedAmountVnd', p.refunded_amount_vnd,
    'paidAt', p.paid_at
  ) end,
  'paymentRequired', b.pricing_amount_vnd is not null,
  'paymentReady', b.status = 'requested' and s.status = 'scheduled'
    and exists(
      select 1 from public.booking_approvals a
      where a.booking_id = b.id
        and a.revoked_at is null
        and (a.expires_at is null or a.expires_at > now())
    )
    and coalesce(p.status, 'pending') not in ('succeeded', 'refunded'),
  'paymentRetryAllowed', coalesce(p.status, 'pending') in ('pending', 'failed'),
  'canHostAccept', public.can_manage_offering(auth.uid(), o.id, 'host')
    and b.status = 'requested' and s.status = 'scheduled',
  'canHostReject', public.can_manage_offering(auth.uid(), o.id, 'host')
    and b.status = 'requested' and s.status = 'scheduled',
  'canLearnerCancel', b.learner_id = auth.uid()
    and b.status in ('requested', 'confirmed'),
  'canLearnerRequestReschedule', b.learner_id = auth.uid()
    and b.status in ('requested', 'confirmed') and s.status = 'scheduled',
  'refund', case when p.id is null then null else jsonb_build_object(
    'status', case
      when exists(
        select 1 from public.refunds r
        where r.payment_id = p.id and r.status in ('obligation', 'pending', 'ambiguous')
      ) then 'processing'
      when exists(
        select 1 from public.refunds r
        where r.payment_id = p.id and r.status = 'succeeded'
      ) then 'succeeded'
      else null
    end,
    'refundedAmountVnd', p.refunded_amount_vnd,
    'obligationCount', (select count(*) from public.refunds r where r.payment_id = p.id)
  ) end
)
from public.bookings b
join public.sessions s on s.id = b.session_id
join public.offerings o on o.id = s.offering_id
left join public.tutor_profiles tp on tp.user_id = s.host_id and o.kind = 'tutor'
left join public.profiles p_host on p_host.id = s.host_id and o.kind != 'tutor'
left join public.payments p on p.booking_id = b.id
where b.id = bid
$$;
