-- Apply Booking request security to databases that already ran 0008.

create or replace function public.create_booking(session_id uuid, participant_count int default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  uid uuid;
  s public.sessions%rowtype;
  bid uuid := gen_random_uuid();
  reserved bigint;
  rate bigint;
  duration_minutes integer;
  amount bigint;
begin
  if participant_count is null or participant_count < 1 then
    raise exception 'INVALID_TRANSITION' using errcode='22023';
  end if;
  uid := public.assert_verified_booking_caller();
  perform public.consume_booking_create_attempt(uid);
  select * into s from public.sessions where id = session_id for update;
  if s.id is null then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  if s.status <> 'scheduled' then raise exception 'SESSION_NOT_OPEN' using errcode='22023'; end if;
  if s.host_id = uid then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  select tp.hourly_rate_vnd into rate from public.tutor_profiles tp where tp.user_id = s.host_id for share;
  if rate is null then raise exception 'BOOKING_PRICE_NOT_SNAPSHOTTED' using errcode='22023'; end if;
  duration_minutes := floor(extract(epoch from (s.ends_at - s.starts_at)) / 60)::integer;
  if duration_minutes < 1 then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  amount := round((rate::numeric * duration_minutes::numeric) / 60)::bigint;
  if amount <= 0 then raise exception 'BOOKING_PRICE_NOT_SNAPSHOTTED' using errcode='22023'; end if;
  reserved := public.session_hard_reserved(session_id);
  if s.max_participants is not null and reserved + participant_count > s.max_participants then
    raise exception 'INSUFFICIENT_CAPACITY' using errcode='22023';
  end if;
  begin
    insert into public.bookings(id, session_id, learner_id, participant_count, status, pricing_amount_vnd, pricing_currency, pricing_hourly_rate_vnd, pricing_duration_minutes, pricing_model, pricing_snapshotted_at)
    values (bid, session_id, uid, participant_count, 'requested', amount, 'VND', rate, duration_minutes, 'hourly_v1', now());
  exception when unique_violation then
    raise exception 'BOOKING_CONFLICT' using errcode='23505';
  end;
  insert into public.booking_history(booking_id, from_status, to_status, actor, at)
  values (bid, null, 'requested', 'attendee', now());
  perform public.insert_outbox_event('BOOKING_REQUESTED', 'booking', bid, 1, jsonb_build_object('bookingId', bid, 'sessionId', session_id, 'participantCount', participant_count, 'amountVnd', amount, 'currency', 'VND'));
  return public.booking_json(bid);
end $$;

revoke all on function public.create_booking(uuid, int) from public, anon, authenticated;
grant execute on function public.create_booking(uuid, int) to authenticated;
