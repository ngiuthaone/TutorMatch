-- Workshop booking V1: RPC modifications for flat_per_participant_v1 pricing,
-- INSTANT booking (skip approval check), minimum_not_met cancellation,
-- offering CRUD RPCs, payment TTL, and workshop booking management.

-- ============================================================
-- 1. create_booking: add workshop pricing + idempotency
-- ============================================================

create or replace function public.create_booking(
  session_id uuid,
  participant_count int default 1,
  p_idempotency_key text default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  uid uuid; s public.sessions%rowtype; o public.offerings%rowtype;
  bid uuid := gen_random_uuid(); reserved bigint;
  rate bigint; duration_minutes integer; amount bigint;
  ppv bigint;
  sid uuid := session_id;
begin
  if participant_count is null or participant_count < 1 then
    raise exception 'INVALID_TRANSITION' using errcode='22023';
  end if;
  if p_idempotency_key is not null and char_length(btrim(p_idempotency_key)) not between 8 and 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY' using errcode='22023';
  end if;
  uid := public.assert_verified_booking_caller();

  -- Idempotency fast path: if key provided, check for existing active booking
  if p_idempotency_key is not null then
    if exists (
      select 1 from public.bookings b
      where b.learner_id = uid
        and b.session_id = sid
        and b.idempotency_key = btrim(p_idempotency_key)
        and b.status in ('requested', 'confirmed')
    ) then
      raise exception 'BOOKING_CONFLICT' using errcode='23505';
    end if;
  end if;

  perform public.consume_booking_create_attempt(uid);

  -- Lock session (canonical lock order: session first)
  select * into s from public.sessions where id = sid for update;
  if s.id is null then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  if s.status <> 'scheduled' then raise exception 'SESSION_NOT_OPEN' using errcode='22023'; end if;
  if s.host_id = uid then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;

  -- Read offering for pricing
  if s.offering_id is not null then
    select * into o from public.offerings where id = s.offering_id for share;
  end if;

  -- Compute pricing based on offering's pricing model
  if o.id is not null and o.pricing_model = 'flat_per_participant_v1' then
    ppv := o.price_per_participant_vnd;
    if ppv is null or ppv <= 0 then
      raise exception 'BOOKING_PRICE_NOT_SNAPSHOTTED' using errcode='22023';
    end if;
    amount := ppv * participant_count;
    if amount <= 0 then
      raise exception 'BOOKING_PRICE_NOT_SNAPSHOTTED' using errcode='22023';
    end if;
    begin
      insert into public.bookings(
        id, session_id, learner_id, participant_count, status, idempotency_key,
        pricing_amount_vnd, pricing_currency, pricing_unit_price_vnd,
        pricing_participant_count, pricing_model, pricing_snapshotted_at
      ) values (
        bid, session_id, uid, participant_count, 'requested', btrim(p_idempotency_key),
        amount, 'VND', ppv, participant_count,
        'flat_per_participant_v1', now()
      );
    exception when unique_violation then
      raise exception 'BOOKING_CONFLICT' using errcode='23505';
    end;
  else
    -- Hourly_v1 pricing (tutor 1:1)
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
    begin
      insert into public.bookings(
        id, session_id, learner_id, participant_count, status, idempotency_key,
        pricing_amount_vnd, pricing_currency, pricing_hourly_rate_vnd,
        pricing_duration_minutes, pricing_model, pricing_snapshotted_at
      ) values (
        bid, session_id, uid, participant_count, 'requested', btrim(p_idempotency_key),
        amount, 'VND', rate, duration_minutes, 'hourly_v1', now()
      );
    exception when unique_violation then
      raise exception 'BOOKING_CONFLICT' using errcode='23505';
    end;
  end if;

  -- Capacity check (after insert to use actual reserved count)
  reserved := public.session_hard_reserved(sid);
  if s.max_participants is not null and reserved > s.max_participants then
    delete from public.bookings where id = bid;
    raise exception 'INSUFFICIENT_CAPACITY' using errcode='22023';
  end if;

  insert into public.booking_history(booking_id, from_status, to_status, actor, at)
  values (bid, null, 'requested', 'attendee', now());

  perform public.insert_outbox_event('BOOKING_REQUESTED', 'booking', bid, 1,
    jsonb_build_object(
      'bookingId', bid, 'sessionId', sid,
      'participantCount', participant_count,
      'amountVnd', amount, 'currency', 'VND',
      'pricingModel', coalesce(o.pricing_model, 'hourly_v1')
    ));

  return public.booking_json(bid);
end $$;

revoke all on function public.create_booking(uuid, int, text) from public, anon, authenticated;
grant execute on function public.create_booking(uuid, int, text) to authenticated;

-- ============================================================
-- 2. start_payment_attempt: skip approval for INSTANT bookings
-- ============================================================

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
-- 3. cancel_session: add minimum_not_met cause
-- ============================================================

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
  if cause = 'minimum_not_met' then
    if auth.uid() is not null then
      raise exception 'UNAUTHORIZED' using errcode='42501';
    end if;
    cancelled_by := 'system';
  else
    uid := public.assert_host_of_session(sid);
    cancelled_by := 'host';
  end if;

  select * into cur from public.sessions where id = sid for update;
  if cur.id is null then raise insufficient_privilege; end if;
  if cur.version <> expected_version then
    raise exception 'STALE_VERSION' using errcode='45000';
  end if;
  if cur.status <> 'scheduled' then
    raise exception 'INVALID_TRANSITION' using errcode='22023';
  end if;
  if cause is distinct from 'host' and cause is distinct from 'minimum_not_met' then
    raise exception 'INVALID_TRANSITION' using errcode='22023';
  end if;
  if not exists (
    select 1 from public.bookings
    where session_id = sid and status in ('requested', 'confirmed')
  ) then
    raise exception 'INVALID_TRANSITION' using errcode='22023';
  end if;

  update public.sessions set status = 'cancelled', version = version + 1 where id = sid;
  insert into public.session_history(session_id, change_type, by, at, cause, reason)
  values (sid, 'cancelled', cancelled_by, now(), cause, reason);

  perform public.insert_outbox_event('SESSION_CANCELLED', 'session', sid, cur.version + 1,
    jsonb_build_object('sessionId', sid, 'cause', cause, 'actor', cancelled_by)
    || case when reason is not null then jsonb_build_object('reason', reason) else '{}'::jsonb end);

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
        in_flight_at := now();
      elsif p.status = 'succeeded' then
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

    update public.bookings set
      status = 'cancelled',
      cancelled_by = cancelled_by,
      cancelled_by_session_id = sid,
      cancel_payment_in_flight_at = coalesce(in_flight_at, cancel_payment_in_flight_at),
      version = version + 1
    where id = b.id;

    insert into public.booking_history(
      booking_id, from_status, to_status, actor, at, cancelled_by_session_id
    ) values (
      b.id, b.status, 'cancelled', cancelled_by, now(), sid
    );

    perform public.insert_outbox_event('BOOKING_CANCELLED', 'booking', b.id, b.version + 1,
      jsonb_build_object(
        'bookingId', b.id, 'sessionId', sid,
        'cancelledBy', cancelled_by,
        'fromStatus', b.status,
        'cancelledBySessionId', sid
      ));

    -- Auto-promote from waitlist if spots open up
    perform public.promote_from_waitlist(sid);

    if obligation_created then
      perform public.insert_outbox_event(
        'REFUND_OBLIGATION_CREATED', 'payment', p.id, p.version,
        jsonb_build_object('paymentId', p.id, 'refundId', r.id, 'amountVnd', r.amount_vnd)
      );
    end if;

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
-- 4. Offering CRUD RPCs (adapted for shared_booking_engine schema)
-- ============================================================

create or replace function public.get_offering(p_offering_id uuid)
returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  return (
    select jsonb_build_object(
      'id', o.id,
      'kind', o.kind,
      'creatorId', o.creator_id,
      'title', o.title,
      'description', o.description,
      'unitPriceVnd', o.unit_price_vnd,
      'pricingModel', o.pricing_model,
      'pricePerParticipantVnd', o.price_per_participant_vnd,
      'hourlyRateVnd', o.hourly_rate_vnd,
      'bookingMode', o.booking_mode,
      'publicationStatus', o.publication_status,
      'version', o.version
    )
    from public.offerings o
    where o.id = p_offering_id
      and o.publication_status = 'published'
  );
end $$;

grant execute on function public.get_offering(uuid) to anon, authenticated;

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

create or replace function public.create_offering(
  p_kind text,
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
  slug text;
begin
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
  if p_kind not in ('tutor', 'workshop', 'class', 'event') then
    raise exception 'INVALID_TRANSITION' using errcode='22023';
  end if;

  -- Generate slug from title (lowercase, hyphens, max 120 chars)
  slug := lower(regexp_replace(btrim(p_title), '[^a-z0-9]+', '-', 'g'));
  slug := regexp_replace(slug, '^-+|-+$', '', 'g');
  if char_length(slug) > 120 then
    slug := left(slug, 120);
  end if;
  if slug = '' then slug := 'offering-' || replace(gen_random_uuid()::text, '-', ''); end if;

  -- Ensure slug uniqueness within kind
  if exists (select 1 from public.offerings where kind = p_kind and slug = slug) then
    slug := slug || '-' || left(replace(gen_random_uuid()::text, '-', ''), 8);
  end if;

  insert into public.offerings(
    kind, slug, title, description, creator_id,
    pricing_model, price_per_participant_vnd, hourly_rate_vnd,
    booking_mode, publication_status
  ) values (
    p_kind, slug, p_title, p_description, uid,
    p_pricing_model, p_price_per_participant_vnd, p_hourly_rate_vnd,
    p_booking_mode, 'draft'
  ) returning id into offering_id;

  return jsonb_build_object('id', offering_id, 'slug', slug, 'publicationStatus', 'draft', 'version', 1);
end $$;

grant execute on function public.create_offering(text, text, text, bigint, bigint, text, text) to authenticated;

create or replace function public.update_offering_status(
  p_offering_id uuid,
  p_expected_version bigint,
  p_status text
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  o record;
  pub_status text;
begin
  -- Map API status to publication_status
  if p_status = 'published' then pub_status := 'published';
  elsif p_status = 'draft' then pub_status := 'draft';
  elsif p_status = 'unpublished' then pub_status := 'unpublished';
  else raise exception 'INVALID_TRANSITION' using errcode='22023';
  end if;

  select * into o from public.offerings where id = p_offering_id for update;
  if not found then raise exception 'OFFERING_NOT_FOUND' using errcode='P0002'; end if;
  if not public.can_manage_offering(uid, p_offering_id, 'host') then
    raise insufficient_privilege;
  end if;
  if o.version <> p_expected_version then
    raise exception 'STALE_VERSION' using errcode='45000';
  end if;

  update public.offerings
    set publication_status = pub_status, version = version + 1, updated_at = now(),
        published_at = case when pub_status = 'published' then now() else published_at end,
        unpublished_at = case when pub_status = 'unpublished' then now() else unpublished_at end
    where id = p_offering_id;

  return jsonb_build_object('id', p_offering_id, 'publicationStatus', pub_status, 'version', o.version + 1);
end $$;

grant execute on function public.update_offering_status(uuid, bigint, text) to authenticated;

-- ============================================================
-- 5. Payment TTL for workshop INSTANT bookings
-- ============================================================

create or replace function public.expire_stale_workshop_bookings(p_worker_id text default 'system')
returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  expired_count integer := 0;
  bk record;
  sess public.sessions%rowtype;
  pay public.payments%rowtype;
begin
  for bk in
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
    select * into sess from public.sessions where id = bk.session_id for update;
    select * into pay from public.payments where booking_id = bk.id for update;

    if bk.version <> (select version from public.bookings where id = bk.id) then
      continue;
    end if;

    if pay.status = 'pending' then
      update public.payments set status = 'failed', version = version + 1, updated_at = now()
      where id = pay.id;
      insert into public.payment_events(payment_id, event_type, from_status, to_status, amount_vnd, payload)
      values (pay.id, 'provider_failed', 'pending', 'failed', pay.amount_vnd,
              jsonb_build_object('reason', 'payment_ttl_expired', 'bookingId', bk.id));
    end if;

    update public.bookings set
      status = 'cancelled',
      cancelled_by = 'system',
      cancelled_reason = 'payment_ttl_expired',
      version = version + 1
    where id = bk.id;

    insert into public.booking_history(booking_id, from_status, to_status, actor, at)
    values (bk.id, 'requested', 'cancelled', 'system', now());

    perform public.insert_outbox_event('BOOKING_CANCELLED', 'booking', bk.id, bk.version + 1,
      jsonb_build_object(
        'bookingId', bk.id,
        'sessionId', bk.session_id,
        'cancelledBy', 'system',
        'fromStatus', 'requested',
        'reason', 'payment_ttl_expired'
      ));

    expired_count := expired_count + 1;
  end loop;

  return jsonb_build_object('expired', expired_count);
end $$;

grant execute on function public.expire_stale_workshop_bookings(text) to service_role;

-- ============================================================
-- 6. Workshop Booking Management RPCs
-- ============================================================

create or replace function public.get_my_workshop_bookings()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid;
  rows jsonb;
begin
  uid := auth.uid();
  if uid is null then raise insufficient_privilege; end if;

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

create or replace function public.cancel_workshop_booking(
  p_booking_id uuid,
  p_expected_version bigint,
  p_reason text default null
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid;
  b record;
  s record;
  o record;
  new_version bigint;
begin
  uid := auth.uid();
  if uid is null then raise insufficient_privilege; end if;

  select * into b
  from public.bookings
  where id = p_booking_id
  for update;

  if b is null then raise exception 'BOOKING_NOT_FOUND'; end if;

  select * into s
  from public.sessions
  where id = b.session_id
  for update;

  if s is null then raise exception 'SESSION_NOT_FOUND'; end if;
  if not public.can_manage_offering(uid, s.offering_id, 'host') then
    raise insufficient_privilege;
  end if;
  if s.offering_id is null then raise exception 'NOT_A_WORKSHOP_BOOKING'; end if;
  if b.version != p_expected_version then
    raise exception 'STALE_VERSION' using errcode = '45000';
  end if;
  if b.status not in ('requested', 'confirmed') then
    raise exception 'INVALID_TRANSITION';
  end if;

  update public.bookings
  set status = 'cancelled',
      updated_at = now(),
      cancelled_by = 'host',
      cancelled_reason = p_reason,
      version = version + 1
  where id = p_booking_id
  returning version into new_version;

  insert into public.booking_history (booking_id, from_status, to_status, actor, at, reason)
  values (p_booking_id, b.status, 'cancelled', 'host', now(), p_reason);

  perform public.insert_outbox_event('BOOKING_CANCELLED', 'booking', p_booking_id, new_version,
    jsonb_build_object(
      'bookingId', p_booking_id,
      'sessionId', b.session_id,
      'cancelledBy', 'host',
      'fromStatus', b.status,
      'reason', p_reason
    )
  );

  -- Auto-promote from waitlist if spots open up
  perform public.promote_from_waitlist(b.session_id);

  return public.booking_read_json(p_booking_id);
end $$;

revoke all on function public.cancel_workshop_booking(uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.cancel_workshop_booking(uuid, bigint, text) to authenticated;
