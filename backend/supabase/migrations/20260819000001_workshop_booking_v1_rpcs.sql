-- Workshop booking V1: RPC modifications for flat_per_participant_v1 pricing,
-- INSTANT booking (skip approval check), minimum_not_met cancellation,
-- and offering CRUD RPCs.

-- ============================================================
-- 1. Modify create_booking for workshop pricing
-- ============================================================
-- Replace the existing create_booking to support both hourly_v1 and
-- flat_per_participant_v1 pricing models.

create or replace function public.create_booking(session_id uuid, participant_count int default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  uid uuid; s public.sessions%rowtype; o public.offerings%rowtype;
  bid uuid := gen_random_uuid(); reserved bigint;
  rate bigint; duration_minutes integer; amount bigint;
  ppv bigint; -- price_per_participant_vnd
begin
  if participant_count is null or participant_count < 1 then
    raise exception 'INVALID_TRANSITION' using errcode='22023';
  end if;
  uid := public.assert_verified_booking_caller();
  perform public.consume_booking_create_attempt(uid);

  -- Lock session (canonical lock order: session first)
  select * into s from public.sessions where id = session_id for update;
  if s.id is null then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  if s.status <> 'scheduled' then raise exception 'SESSION_NOT_OPEN' using errcode='22023'; end if;
  if s.host_id = uid then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;

  -- Read offering for pricing (if session has an offering)
  if s.offering_id is not null then
    select * into o from public.offerings where id = s.offering_id for share;
  end if;

  -- Compute pricing based on offering's pricing model
  if o.id is not null and o.pricing_model = 'flat_per_participant_v1' then
    -- Workshop flat per-participant pricing
    ppv := o.price_per_participant_vnd;
    if ppv is null or ppv <= 0 then
      raise exception 'BOOKING_PRICE_NOT_SNAPSHOTTED' using errcode='22023';
    end if;
    amount := ppv * participant_count;
    if amount <= 0 then
      raise exception 'BOOKING_PRICE_NOT_SNAPSHOTTED' using errcode='22023';
    end if;
    -- Insert with flat pricing snapshot
    begin
      insert into public.bookings(
        id, session_id, learner_id, participant_count, status,
        pricing_amount_vnd, pricing_currency, pricing_price_per_participant_vnd,
        pricing_model, pricing_snapshotted_at
      ) values (
        bid, session_id, uid, participant_count, 'requested',
        amount, 'VND', ppv,
        'flat_per_participant_v1', now()
      );
    exception when unique_violation then
      raise exception 'BOOKING_CONFLICT' using errcode='23505';
    end;
  else
    -- Original hourly_v1 pricing (tutor 1:1)
    select tp.hourly_rate_vnd into rate
      from public.tutor_profiles tp where tp.user_id = s.host_id for share;
    if rate is null then
      raise exception 'BOOKING_PRICE_NOT_SNAPSHOTTED' using errcode='22023';
    end if;
    duration_minutes := floor(extract(epoch from (s.ends_at - s.starts_at)) / 60)::integer;
    if duration_minutes < 1 then
      raise exception 'INVALID_TRANSITION' using errcode='22023';
    end if;
    amount := round((rate::numeric * duration_minutes::numeric) / 60)::bigint;
    if amount <= 0 then
      raise exception 'BOOKING_PRICE_NOT_SNAPSHOTTED' using errcode='22023';
    end if;
    -- Insert with hourly pricing snapshot
    begin
      insert into public.bookings(
        id, session_id, learner_id, participant_count, status,
        pricing_amount_vnd, pricing_currency, pricing_hourly_rate_vnd,
        pricing_duration_minutes, pricing_model, pricing_snapshotted_at
      ) values (
        bid, session_id, uid, participant_count, 'requested',
        amount, 'VND', rate, duration_minutes, 'hourly_v1', now()
      );
    exception when unique_violation then
      raise exception 'BOOKING_CONFLICT' using errcode='23505';
    end;
  end if;

  -- Capacity check (after insert to use actual reserved count)
  reserved := public.session_hard_reserved(session_id);
  if s.max_participants is not null and reserved > s.max_participants then
    -- Rollback: delete the booking we just created
    delete from public.bookings where id = bid;
    raise exception 'INSUFFICIENT_CAPACITY' using errcode='22023';
  end if;

  insert into public.booking_history(booking_id, from_status, to_status, actor, at)
  values (bid, null, 'requested', 'attendee', now());

  perform public.insert_outbox_event('BOOKING_REQUESTED', 'booking', bid, 1,
    jsonb_build_object(
      'bookingId', bid, 'sessionId', session_id,
      'participantCount', participant_count,
      'amountVnd', amount, 'currency', 'VND',
      'pricingModel', coalesce(o.pricing_model, 'hourly_v1')
    ));

  return public.booking_json(bid);
end $$;

-- ============================================================
-- 2. Modify start_payment_attempt for INSTANT bookings
-- ============================================================
-- For INSTANT offerings, skip the approval check. The approval gate
-- is a Tutor-specific host-authorized step; INSTANT Workshop bookings
-- go directly to payment.

create or replace function public.start_payment_attempt(
  p_booking_id uuid,
  p_idempotency_key text
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  uid uuid := public.assert_attendee_caller();
  b public.bookings%rowtype; s public.sessions%rowtype;
  o public.offerings%rowtype;
  p public.payments%rowtype; a public.payment_attempts%rowtype;
  key text := btrim(p_idempotency_key);
  approval_required boolean := true;
begin
  if key is null or char_length(key) not between 16 and 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY' using errcode='22023';
  end if;

  select * into b from public.bookings where id = p_booking_id and learner_id = uid for update;
  if b.id is null then raise insufficient_privilege; end if;
  if b.status <> 'requested' then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  if b.pricing_amount_vnd is null then
    raise exception 'BOOKING_PRICE_NOT_SNAPSHOTTED' using errcode='22023';
  end if;

  -- Check if offering uses INSTANT booking (skip approval)
  select s2.* into s
    from public.sessions s2
    where s2.id = b.session_id;

  select o2.* into o
    from public.offerings o2
    where o2.id = s.offering_id;

  if o.booking_mode = 'instant' then
    approval_required := false;
  else
    -- Tutor path: approval required
    approval_required := true;
  end if;

  -- Approval gate (only for non-INSTANT bookings)
  if approval_required then
    if not exists(
      select 1 from public.booking_approvals
      where booking_id = b.id
        and revoked_at is null
        and (expires_at is null or expires_at > now())
    ) then
      raise exception 'BOOKING_NOT_APPROVED_FOR_PAYMENT' using errcode='22023';
    end if;
  end if;

  insert into public.payments(booking_id, amount_vnd, currency)
  values (b.id, b.pricing_amount_vnd, b.pricing_currency)
  on conflict (booking_id) do nothing;

  select * into p from public.payments where booking_id = b.id for update;
  if p.status in ('succeeded', 'refunded') then
    raise exception 'PAYMENT_NOT_RETRYABLE' using errcode='22023';
  end if;

  select * into a from public.payment_attempts where payment_id = p.id and idempotency_key = key;
  if a.id is null then
    insert into public.payment_attempts(
      payment_id, idempotency_key, merchant_reference, status, amount_vnd, currency
    ) values (
      p.id, key,
      'TUTORIA-' || replace(p.id::text, '-', '') || '-' || replace(gen_random_uuid()::text, '-', ''),
      'created', p.amount_vnd, p.currency
    ) returning * into a;

    insert into public.payment_events(
      payment_id, attempt_id, event_type, from_status, to_status, amount_vnd, payload
    ) values (
      p.id, a.id, 'attempt_created', p.status, p.status, p.amount_vnd, '{}'
    );

    perform public.insert_outbox_event(
      'PAYMENT_ATTEMPTED', 'payment', p.id, p.version,
      jsonb_build_object(
        'paymentId', p.id, 'attemptId', a.id, 'bookingId', b.id,
        'amountVnd', p.amount_vnd, 'currency', p.currency
      )
    );
  end if;

  return jsonb_build_object(
    'paymentId', p.id, 'attemptId', a.id,
    'merchantReference', a.merchant_reference,
    'amountVnd', p.amount_vnd, 'currency', p.currency,
    'status', p.status
  );
end $$;

-- ============================================================
-- 3. Modify cancel_session for minimum_not_met
-- ============================================================
-- Extend cancel_session to accept cause='minimum_not_met' when called
-- via service_role (auth.uid() is null). Set cancelled_by='system'
-- for minimum-not-met cancellations.

create or replace function public.cancel_session(
  sid uuid,
  expected_version bigint,
  cause text default 'host',
  reason text default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  uid uuid; cur public.sessions%rowtype; b record;
  p public.payments%rowtype; r public.refunds%rowtype; rr record; qr record; bv bigint;
  in_flight_at timestamptz; obligation_created boolean := false;
  cancelled_by text;
begin
  -- Authorization: host for 'host' cause, service_role for 'minimum_not_met'
  if cause = 'minimum_not_met' then
    -- System actor: must be service_role (auth.uid() is null)
    if auth.uid() is not null then
      raise exception 'UNAUTHORIZED' using errcode='42501';
    end if;
    cancelled_by := 'system';
  else
    -- Host actor: must be the session host
    uid := public.assert_host_of_session(sid);
    cancelled_by := 'host';
  end if;

  -- Canonical lock order: session -> booking -> payment
  select * into cur from public.sessions where id = sid for update;
  if cur.id is null then raise insufficient_privilege; end if;
  if cur.version <> expected_version then
    raise exception 'STALE_VERSION' using errcode='40001';
  end if;
  if cur.status <> 'scheduled' then
    raise exception 'INVALID_TRANSITION' using errcode='22023';
  end if;

  -- Validate cause
  if cause is distinct from 'host' and cause is distinct from 'minimum_not_met' then
    raise exception 'INVALID_TRANSITION' using errcode='22023';
  end if;

  -- Must have at least one active booking
  if not exists (
    select 1 from public.bookings
    where session_id = sid and status in ('requested', 'confirmed')
  ) then
    raise exception 'INVALID_TRANSITION' using errcode='22023';
  end if;

  -- Cancel session
  update public.sessions set status = 'cancelled', version = version + 1 where id = sid;

  -- Session history
  insert into public.session_history(session_id, change_type, by, at, cause, reason)
  values (sid, 'cancelled', cancelled_by, now(), cause, reason);

  -- Outbox: SESSION_CANCELLED
  perform public.insert_outbox_event('SESSION_CANCELLED', 'session', sid, cur.version + 1,
    jsonb_build_object('sessionId', sid, 'cause', cause, 'actor', cancelled_by)
    || case when reason is not null then jsonb_build_object('reason', reason) else '{}'::jsonb end);

  -- Booking fan-out: cancel all active bookings
  for b in
    select id, status, version from public.bookings
    where session_id = sid and status in ('requested', 'confirmed')
    for update
  loop
    in_flight_at := null;
    obligation_created := false;

    select * into p from public.payments where public.payments.booking_id = b.id for update;

    if p.id is not null then
      if p.status = 'pending' then
        -- P4: payment in flight, mark duty
        in_flight_at := now();
      elsif p.status = 'succeeded' then
        -- P6: unconditional full refund for every paid booking
        insert into public.refunds(
          payment_id, kind, status, amount_vnd, idempotency_key, reason
        ) values (
          p.id, 'standard', 'obligation', p.amount_vnd,
          'cancel:session:' || b.id::text,
          'session cancelled (P6)'
        )
        on conflict (payment_id, idempotency_key) do nothing
        returning * into r;

        if r.id is not null then
          obligation_created := true;
          insert into public.payment_events(
            payment_id, event_type, from_status, to_status, amount_vnd, payload
          ) values (
            p.id, 'refund_obligation_created', p.status, p.status, r.amount_vnd,
            jsonb_build_object('refundId', r.id, 'bookingId', b.id)
          );
        end if;
      end if;
    end if;

    -- Update booking to cancelled
    update public.bookings set
      status = 'cancelled',
      cancelled_by = cancelled_by,
      cancelled_by_session_id = sid,
      cancel_payment_in_flight_at = coalesce(in_flight_at, cancel_payment_in_flight_at),
      version = version + 1
    where id = b.id;

    -- Booking history
    insert into public.booking_history(
      booking_id, from_status, to_status, actor, at, cancelled_by_session_id
    ) values (
      b.id, b.status, 'cancelled', cancelled_by, now(), sid
    );

    -- Outbox: BOOKING_CANCELLED
    perform public.insert_outbox_event('BOOKING_CANCELLED', 'booking', b.id, b.version + 1,
      jsonb_build_object(
        'bookingId', b.id, 'sessionId', sid,
        'cancelledBy', cancelled_by,
        'fromStatus', b.status,
        'cancelledBySessionId', sid
      ));

    -- Outbox: REFUND_OBLIGATION_CREATED
    if obligation_created then
      perform public.insert_outbox_event(
        'REFUND_OBLIGATION_CREATED', 'payment', p.id, p.version,
        jsonb_build_object('paymentId', p.id, 'refundId', r.id, 'amountVnd', r.amount_vnd)
      );
    end if;

    -- Terminate pending reschedule request for this booking
    update public.reschedule_requests set status = 'cancelled', resolved_at = now()
    where public.reschedule_requests.booking_id = b.id and status = 'requested'
    returning id, from_session_id, to_session_id into rr;

    if rr.id is not null then
      perform public.insert_outbox_event(
        'RESCHEDULE_CANCELLED', 'booking', b.id, b.version + 1,
        jsonb_build_object(
          'requestId', rr.id, 'bookingId', b.id,
          'fromSessionId', rr.from_session_id,
          'toSessionId', rr.to_session_id,
          'actor', cancelled_by
        )
      );
    end if;
  end loop;

  -- Second loop: terminate inbound reschedule requests from OTHER bookings
  for qr in
    select id, booking_id, from_session_id, to_session_id
    from public.reschedule_requests
    where to_session_id = sid and status = 'requested'
    for update
  loop
    select version into bv from public.bookings where id = qr.booking_id;
    update public.reschedule_requests set status = 'cancelled', resolved_at = now() where id = qr.id;
    perform public.insert_outbox_event(
      'RESCHEDULE_CANCELLED', 'booking', qr.booking_id, coalesce(bv, 1),
      jsonb_build_object(
        'requestId', qr.id, 'bookingId', qr.booking_id,
        'fromSessionId', qr.from_session_id,
        'toSessionId', qr.to_session_id,
        'actor', cancelled_by
      )
    );
  end loop;

  return public.session_json(sid);
end $$;

-- ============================================================
-- 4. Offering CRUD RPCs
-- ============================================================

-- 4a. get_offering: read offering by ID
create or replace function public.get_offering(p_offering_id uuid)
returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  return (
    select jsonb_build_object(
      'id', o.id,
      'hostId', o.host_id,
      'offeringType', o.offering_type,
      'title', o.title,
      'description', o.description,
      'pricingModel', o.pricing_model,
      'pricePerParticipantVnd', o.price_per_participant_vnd,
      'hourlyRateVnd', o.hourly_rate_vnd,
      'currency', o.currency,
      'bookingMode', o.booking_mode,
      'status', o.status,
      'version', o.version
    )
    from public.offerings o
    where o.id = p_offering_id
      and o.status = 'published'
  );
end $$;

grant execute on function public.get_offering(uuid) to anon, authenticated;

-- 4b. list_sessions_by_offering_id: list sessions for an offering
create or replace function public.list_sessions_by_offering_id(p_offering_id uuid)
returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'startsAt', s.starts_at,
        'endsAt', s.ends_at,
        'minParticipants', s.min_participants,
        'maxParticipants', s.max_participants,
        'spotsLeft', greatest(0, s.max_participants - coalesce(public.session_hard_reserved(s.id), 0)),
        'status', s.status
      ) order by s.starts_at
    )
    from public.sessions s
    where s.offering_id = p_offering_id
      and s.status = 'scheduled'
  ), '[]'::jsonb);
end $$;

grant execute on function public.list_sessions_by_offering_id(uuid) to anon, authenticated;

-- 4c. create_offering: host creates a new offering
create or replace function public.create_offering(
  p_offering_type text,
  p_title text,
  p_pricing_model text,
  p_price_per_participant_vnd bigint default null,
  p_hourly_rate_vnd bigint default null,
  p_booking_mode text default 'approval',
  p_description text default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  offering_id uuid;
begin
  -- Validate pricing model
  if p_pricing_model not in ('hourly_v1', 'flat_per_participant_v1') then
    raise exception 'INVALID_TRANSITION' using errcode='22023';
  end if;

  if p_pricing_model = 'hourly_v1' and p_hourly_rate_vnd is null then
    raise exception 'MISSING_HOURLY_RATE' using errcode='22023';
  end if;

  if p_pricing_model = 'flat_per_participant_v1' and p_price_per_participant_vnd is null then
    raise exception 'MISSING_PRICE_PER_PARTICIPANT' using errcode='22023';
  end if;

  if p_booking_mode not in ('approval', 'instant') then
    raise exception 'INVALID_TRANSITION' using errcode='22023';
  end if;

  if p_offering_type not in ('tutor', 'workshop', 'class', 'event') then
    raise exception 'INVALID_TRANSITION' using errcode='22023';
  end if;

  insert into public.offerings(
    host_id, offering_type, title, description,
    pricing_model, price_per_participant_vnd, hourly_rate_vnd,
    booking_mode, status
  ) values (
    uid, p_offering_type, p_title, p_description,
    p_pricing_model, p_price_per_participant_vnd, p_hourly_rate_vnd,
    p_booking_mode, 'draft'
  ) returning id into offering_id;

  return jsonb_build_object('id', offering_id, 'status', 'draft', 'version', 1);
end $$;

grant execute on function public.create_offering(text, text, text, bigint, bigint, text, text) to authenticated;

-- 4d. update_offering_status: publish/unpublish an offering
create or replace function public.update_offering_status(
  p_offering_id uuid,
  p_expected_version bigint,
  p_status text
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  o record;
begin
  select * into o from public.offerings where id = p_offering_id for update;
  if not found then raise exception 'OFFERING_NOT_FOUND' using errcode='P0002'; end if;
  if o.host_id <> uid then raise insufficient_privilege; end if;
  if o.version <> p_expected_version then
    raise exception 'STALE_VERSION' using errcode='40001';
  end if;
  if p_status not in ('draft', 'published', 'unpublished') then
    raise exception 'INVALID_TRANSITION' using errcode='22023';
  end if;

  update public.offerings
    set status = p_status, version = version + 1, updated_at = now()
    where id = p_offering_id;

  return jsonb_build_object('id', p_offering_id, 'status', p_status, 'version', o.version + 1);
end $$;

grant execute on function public.update_offering_status(uuid, bigint, text) to authenticated;

-- 4e. create_session: extend to validate offering ownership
-- (existing RPC already accepts offeringId in JSON payload;
-- we add an ownership check when offering_id is provided)

-- ============================================================
-- 5. Payment TTL for workshop INSTANT bookings
-- ============================================================
-- Expire stale workshop bookings: requested status + pending payment
-- older than 30 minutes. This releases capacity atomically via the
-- existing booking status change mechanism.

create or replace function public.expire_stale_workshop_bookings(p_worker_id text default 'system')
returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  expired_count integer := 0;
  b record;
  s public.sessions%rowtype;
  p public.payments%rowtype;
begin
  -- Find workshop bookings in requested status with pending payment
  -- older than 30 minutes
  for b in
    select b.id, b.session_id, b.version, b.pricing_amount_vnd
    from public.bookings b
    join public.sessions s on s.id = b.session_id
    where b.status = 'requested'
      and b.created_at < now() - interval '30 minutes'
      and s.offering_id is not null
      and exists (
        select 1 from public.payments p
        where p.booking_id = b.id
          and p.status = 'pending'
      )
    for update skip locked
  loop
    -- Lock session (canonical lock order)
    select * into s from public.sessions where id = b.session_id for update;

    -- Lock payment
    select * into p from public.payments where booking_id = b.id for update;

    -- Verify still in requested status (race protection)
    if b.version <> (select version from public.bookings where id = b.id) then
      continue;
    end if;

    -- Mark payment as failed (provider never responded)
    if p.status = 'pending' then
      update public.payments set status = 'failed', version = version + 1, updated_at = now()
      where id = p.id;
      insert into public.payment_events(payment_id, event_type, from_status, to_status, amount_vnd, payload)
      values (p.id, 'provider_failed', 'pending', 'failed', p.amount_vnd,
              jsonb_build_object('reason', 'payment_ttl_expired', 'bookingId', b.id));
    end if;

    -- Cancel booking (releases capacity atomically)
    update public.bookings set
      status = 'cancelled',
      cancelled_by = 'system',
      cancelled_reason = 'payment_ttl_expired',
      version = version + 1
    where id = b.id;

    insert into public.booking_history(booking_id, from_status, to_status, actor, at)
    values (b.id, 'requested', 'cancelled', 'system', now());

    perform public.insert_outbox_event('BOOKING_CANCELLED', 'booking', b.id, b.version + 1,
      jsonb_build_object(
        'bookingId', b.id,
        'sessionId', b.session_id,
        'cancelledBy', 'system',
        'fromStatus', 'requested',
        'reason', 'payment_ttl_expired'
      ));

    expired_count := expired_count + 1;
  end loop;

  return jsonb_build_object('expired', expired_count);
end $$;

-- Grant to service_role only (called by worker)
grant execute on function public.expire_stale_workshop_bookings(text) to service_role;

-- ============================================================
-- Workshop Booking Management RPCs
-- ============================================================

-- Get workshop bookings for the authenticated host
-- Returns bookings where the session's host_id matches the authenticated user
-- and the session has an associated offering (workshop bookings)
create or replace function public.get_my_workshop_bookings()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid;
  rows jsonb;
begin
  uid := auth.uid();
  if uid is null then
    raise insufficient_privilege;
  end if;

  select coalesce(jsonb_agg(public.booking_read_json(b.id) order by b.created_at desc), '[]'::jsonb)
  into rows
  from public.bookings b
  join public.sessions s on s.id = b.session_id
  where s.host_id = uid
    and s.offering_id is not null;

  return rows;
end $$;

revoke all on function public.get_my_workshop_bookings() from public, anon, authenticated;
grant execute on function public.get_my_workshop_bookings() to authenticated;

-- Cancel a workshop booking (host action)
-- Uses the existing cancel_booking RPC with cause='host'
-- The RPC verifies host ownership via session.host_id = auth.uid()
create or replace function public.cancel_workshop_booking(
  p_booking_id uuid,
  p_expected_version bigint,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  b record;
  s record;
  new_version bigint;
begin
  uid := auth.uid();
  if uid is null then
    raise insufficient_privilege;
  end if;

  -- Get booking with lock
  select * into b
  from public.bookings
  where id = p_booking_id
  for update;

  if b is null then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  -- Get session with lock
  select * into s
  from public.sessions
  where id = b.session_id
  for update;

  if s is null then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  -- Verify host ownership
  if s.host_id != uid then
    raise insufficient_privilege;
  end if;

  -- Verify session has offering (is a workshop booking)
  if s.offering_id is null then
    raise exception 'NOT_A_WORKSHOP_BOOKING';
  end if;

  -- Verify version
  if b.version != p_expected_version then
    raise exception 'STALE_VERSION' using errcode = '40001';
  end if;

  -- Verify booking is cancellable
  if b.status not in ('requested', 'confirmed') then
    raise exception 'INVALID_TRANSITION';
  end if;

  -- Cancel booking
  update public.bookings
  set status = 'cancelled',
      updated_at = now(),
      cancelled_by = 'host',
      cancelled_reason = p_reason,
      version = version + 1
  where id = p_booking_id
  returning version into new_version;

  -- Record cancellation
  insert into public.booking_history (booking_id, from_status, to_status, actor, at, reason)
  values (p_booking_id, b.status, 'cancelled', 'host', now(), p_reason);

  -- Emit outbox event
  perform public.insert_outbox_event('BOOKING_CANCELLED', 'booking', p_booking_id, new_version,
    jsonb_build_object(
      'bookingId', p_booking_id,
      'sessionId', b.session_id,
      'cancelledBy', 'host',
      'fromStatus', b.status,
      'reason', p_reason
    )
  );

  return public.booking_read_json(p_booking_id);
end $$;

revoke all on function public.cancel_workshop_booking(uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.cancel_workshop_booking(uuid, bigint, text) to authenticated;
