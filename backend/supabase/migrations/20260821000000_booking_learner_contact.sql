-- Learner contact capture (P0 booking): persist the learner's booking-time
-- contact (full name, email, VN phone, note) as a snapshot on the booking.
--
-- PRD-001 Booking Contact Capture (FR-2, FR-4, FR-9 / AC-1..AC-6).
--
-- Authorization model (unchanged, matches the established read gating):
--   - create_booking writes the contact columns.
--   - booking_read_json is the owner/host read view; it is reached only via
--     get_booking (learner_id OR session host) and get_my_bookings (learner_id).
--     Public listing functions (list_bookable_sessions, session_json,
--     get_bookable_session) build session JSON and never read these columns.
--   - No table-level RLS policy change is required: access is enforced inside
--     the security-definer RPC read functions, per the existing pattern.

-- ============================================================
-- 1. Columns + VN phone constraint
-- ============================================================

alter table public.bookings
  add column learner_name text,
  add column learner_email text,
  add column learner_phone text,
  add column learner_note text;

comment on column public.bookings.learner_name  is 'Learner-provided full name captured at booking time (PRD-001 FR-2).';
comment on column public.bookings.learner_email is 'Learner-provided contact email captured at booking time (PRD-001 FR-4).';
comment on column public.bookings.learner_phone is 'Learner-provided VN phone captured at booking time, normalized to the +84 prefix (PRD-001 FR-2).';
comment on column public.bookings.learner_note  is 'Optional learner note, max 500 chars (PRD-001 FR-5).';

-- VN mobile/landline: national 0xxxxxxxxx or international +84xxxxxxxxx (9 digits).
alter table public.bookings
  add constraint bookings_learner_phone_vn_check
  check (learner_phone is null or learner_phone ~ '^(\+84|0)[0-9]{9}$');

alter table public.bookings
  add constraint bookings_learner_note_length_check
  check (learner_note is null or char_length(learner_note) <= 500);

-- ============================================================
-- 2. Create 7-arg create_booking overload with learner contact
-- ============================================================
-- Deliberately a new overload (session_id, participant_count, p_idempotency_key,
-- p_learner_name, p_learner_email, p_learner_phone, p_learner_note). Existing
-- 2-arg and 3-arg overloads are untouched, so legacy/other callers keep working.
-- The Supabase RPC named-argument call with p_learner_* resolves here exactly.
-- Contact fields are REQUIRED on this new path (p_learner_name/email/phone),
-- matching PRD-001 FR-2/FR-4.

create or replace function public.create_booking(
  session_id uuid,
  participant_count int default 1,
  p_idempotency_key text default null,
  p_learner_name text default null,
  p_learner_email text default null,
  p_learner_phone text default null,
  p_learner_note text default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  uid uuid; s public.sessions%rowtype; o public.offerings%rowtype;
  bid uuid := gen_random_uuid(); reserved bigint;
  rate bigint; duration_minutes integer; amount bigint;
  ppv bigint;
  sid uuid := session_id;
  norm_name text; norm_email text; norm_phone text; norm_note text;
begin
  if participant_count is null or participant_count < 1 then
    raise exception 'INVALID_TRANSITION' using errcode='22023';
  end if;
  if p_idempotency_key is not null and char_length(btrim(p_idempotency_key)) not between 8 and 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY' using errcode='22023';
  end if;

  -- Learner contact validation (PRD-001 FR-2/FR-4/FR-5).
  norm_name := btrim(coalesce(p_learner_name, ''));
  norm_email := lower(btrim(coalesce(p_learner_email, '')));
  norm_note := btrim(coalesce(p_learner_note, ''));
  norm_phone := case
    when p_learner_phone is null then null
    else btrim(regexp_replace(p_learner_phone, '[^0-9+]', '', 'g'))
  end;
  if norm_name = '' then
    raise exception 'LEARNER_NAME_REQUIRED' using errcode='22023';
  end if;
  if norm_email = '' or norm_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'LEARNER_EMAIL_INVALID' using errcode='22023';
  end if;
  if norm_phone is null then
    raise exception 'LEARNER_PHONE_REQUIRED' using errcode='22023';
  end if;
  -- Normalize to +84xxxxxxxxx (9 digits after country code).
  if norm_phone ~ '^0[0-9]{9}$' then
    norm_phone := '+84' || substring(norm_phone from 2);
  end if;
  if norm_phone !~ '^\+84[0-9]{9}$' then
    raise exception 'LEARNER_PHONE_INVALID' using errcode='22023';
  end if;
  if char_length(norm_note) > 500 then
    raise exception 'LEARNER_NOTE_TOO_LONG' using errcode='22023';
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
        pricing_participant_count, pricing_model, pricing_snapshotted_at,
        learner_name, learner_email, learner_phone, learner_note
      ) values (
        bid, session_id, uid, participant_count, 'requested', btrim(p_idempotency_key),
        amount, 'VND', ppv, participant_count,
        'flat_per_participant_v1', now(),
        norm_name, norm_email, norm_phone, nullif(norm_note, '')
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
        pricing_duration_minutes, pricing_model, pricing_snapshotted_at,
        learner_name, learner_email, learner_phone, learner_note
      ) values (
        bid, session_id, uid, participant_count, 'requested', btrim(p_idempotency_key),
        amount, 'VND', rate, duration_minutes, 'hourly_v1', now(),
        norm_name, norm_email, norm_phone, nullif(norm_note, '')
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

revoke all on function public.create_booking(uuid, int, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_booking(uuid, int, text, text, text, text, text) to authenticated;

-- ============================================================
-- 3. Expose contact in the owner/host read view
-- ============================================================
-- booking_read_json is reached only via the caller-gated getters
-- (get_booking learner_id/host_id, get_my_bookings learner_id), so contact
-- never leaks into public listing functions.

create or replace function public.booking_read_json(bid uuid) returns jsonb
language sql stable security definer set search_path='' as $$
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
  'learnerContact', case when b.learner_name is null then null else jsonb_build_object(
    'name', b.learner_name,
    'email', b.learner_email,
    'phone', b.learner_phone,
    'note', b.learner_note
  ) end,
  'pricing', case when b.pricing_amount_vnd is null then null else jsonb_build_object(
    'amountVnd', b.pricing_amount_vnd,
    'currency', b.pricing_currency,
    'hourlyRateVnd', b.pricing_hourly_rate_vnd,
    'durationMinutes', b.pricing_duration_minutes,
    'model', b.pricing_model,
    'snapshottedAt', b.pricing_snapshotted_at
  ) end,
  'session', public.session_json(b.session_id),
  'tutor', jsonb_build_object(
    'id', tp.id,
    'displayName', tp.display_name
  ),
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
    and exists(select 1 from public.booking_approvals a where a.booking_id = b.id and a.revoked_at is null and (a.expires_at is null or a.expires_at > now()))
    and coalesce(p.status, 'pending') not in ('succeeded', 'refunded'),
  'paymentRetryAllowed', coalesce(p.status, 'pending') in ('pending', 'failed'),
  'canTutorAccept', s.host_id = auth.uid() and b.status = 'requested' and s.status = 'scheduled',
  'canTutorReject', s.host_id = auth.uid() and b.status = 'requested' and s.status = 'scheduled',
  'canLearnerCancel', b.learner_id = auth.uid() and b.status in ('requested', 'confirmed'),
  'canLearnerRequestReschedule', b.learner_id = auth.uid() and b.status in ('requested', 'confirmed') and s.status = 'scheduled',
  'refund', case when p.id is null then null else jsonb_build_object(
    'status', case when exists(select 1 from public.refunds r where r.payment_id = p.id and r.status in ('obligation','pending','ambiguous')) then 'processing'
                   when exists(select 1 from public.refunds r where r.payment_id = p.id and r.status = 'succeeded') then 'succeeded'
                   else null end,
    'refundedAmountVnd', p.refunded_amount_vnd,
    'obligationCount', (select count(*) from public.refunds r where r.payment_id = p.id)
  ) end
)
from public.bookings b
join public.sessions s on s.id = b.session_id
join public.tutor_profiles tp on tp.user_id = s.host_id
left join public.payments p on p.booking_id = b.id
where b.id = bid
$$;

revoke all on function public.booking_read_json(uuid) from public, anon, authenticated;
