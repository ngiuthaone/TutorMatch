-- Corrective migration: the surviving 3-arg create_booking overload
-- (spelled create_booking(uuid,int,text)) inserted flat_per_participant_v1
-- pricing into a nonexistent bookings column pricing_price_per_participant_vnd.
--
-- Production bookings uses pricing_unit_price_vnd + pricing_participant_count
-- (authoritative production schema). 20260820100001 shipped with the wrong
-- column name; 20260831130000_drop_7arg_create_booking_overload kept this
-- 3-arg overload as the survivor, so the bad insert survived on hosted.
--
-- This re-defines the 3-arg create_booking so its flat branch writes
-- pricing_unit_price_vnd and pricing_participant_count, matching the schema
-- declared by 20260820100000 and enforced by bookings_pricing_snapshot_check.
-- Events soft launch is unaffected (events-only; bookings out of scope), but
-- this removes a latent DDL error that would surface when workshop bookings
-- are enabled.

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
