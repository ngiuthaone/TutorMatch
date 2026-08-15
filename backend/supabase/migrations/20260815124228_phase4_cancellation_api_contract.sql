-- Phase 4 application contract: expose cancellation/refund truth without
-- moving policy or authority out of the existing lifecycle RPCs.

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
  'pricing', case when b.pricing_amount_vnd is null then null else jsonb_build_object(
    'amountVnd', b.pricing_amount_vnd,
    'currency', b.pricing_currency,
    'hourlyRateVnd', b.pricing_hourly_rate_vnd,
    'durationMinutes', b.pricing_duration_minutes,
    'model', b.pricing_model,
    'snapshottedAt', b.pricing_snapshotted_at
  ) end,
  'session', public.session_json(b.session_id),
  'tutor', jsonb_build_object('id', tp.id, 'displayName', tp.display_name),
  'learner', jsonb_build_object('displayName', learner.name),
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
  'paymentInFlight', p.status = 'pending' and exists(
    select 1 from public.payment_attempts pa
    where pa.payment_id = p.id and pa.status in ('created','redirected','pending','ambiguous')
  ),
  'canTutorAccept', s.host_id = auth.uid() and b.status = 'requested' and s.status = 'scheduled',
  'canTutorReject', s.host_id = auth.uid() and b.status = 'requested' and s.status = 'scheduled',
  'canTutorCancel', s.host_id = auth.uid() and b.status = 'confirmed' and s.status = 'scheduled',
  'canLearnerCancel', b.learner_id = auth.uid() and b.status in ('requested', 'confirmed'),
  'canLearnerRequestReschedule', b.learner_id = auth.uid() and b.status in ('requested', 'confirmed') and s.status = 'scheduled',
  'cancellation', case when b.status = 'cancelled' then jsonb_build_object(
    'status', 'cancelled',
    'cancelledAt', (select max(h.at) from public.booking_history h where h.booking_id = b.id and h.to_status = 'cancelled'),
    'actor', b.cancelled_by,
    'reason', b.cancelled_reason
  ) else null end,
  'refund', case when p.id is null then null else jsonb_build_object(
    'status', case
      when exists(select 1 from public.refunds r where r.payment_id = p.id and r.status in ('failed','ambiguous')) then 'needs_attention'
      when exists(select 1 from public.refunds r where r.payment_id = p.id and r.status in ('obligation','pending')) then 'processing'
      when exists(select 1 from public.refunds r where r.payment_id = p.id and r.status = 'succeeded') then 'refunded'
      else 'none' end,
    'amountVnd', (select coalesce(sum(r.amount_vnd), 0) from public.refunds r where r.payment_id = p.id),
    'refundedAmountVnd', p.refunded_amount_vnd,
    'obligationCount', (select count(*) from public.refunds r where r.payment_id = p.id)
  ) end
)
from public.bookings b
join public.sessions s on s.id = b.session_id
join public.tutor_profiles tp on tp.user_id = s.host_id
join public.profiles learner on learner.id = b.learner_id
left join public.payments p on p.booking_id = b.id
where b.id = bid
$$;

revoke all on function public.booking_read_json(uuid) from public, anon, authenticated;

-- Advisory preview only. cancel_booking re-evaluates the same policy inside
-- its authoritative transaction and its result remains the financial truth.
create or replace function public.get_booking_cancellation_preview(bid uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare uid uuid := auth.uid(); b public.bookings%rowtype; s public.sessions%rowtype; p public.payments%rowtype; in_flight boolean := false;
begin
  if uid is null then raise insufficient_privilege; end if;
  select * into b from public.bookings where id = bid;
  if b.id is null then raise exception 'BOOKING_NOT_FOUND' using errcode='22023'; end if;
  select * into s from public.sessions where id = b.session_id;
  if not (b.learner_id = uid or s.host_id = uid) then raise insufficient_privilege; end if;
  select * into p from public.payments where booking_id = b.id;
  select exists(select 1 from public.payment_attempts pa where pa.payment_id = p.id and pa.status in ('created','redirected','pending','ambiguous')) into in_flight;
  if b.status not in ('requested','confirmed') then
    return jsonb_build_object('allowed', false, 'refundMode', 'NONE', 'refundAmountVnd', 0, 'policyCode', 'TERMINAL_NO_CANCELLATION', 'expectedVersion', b.version, 'paymentInFlight', in_flight);
  end if;
  if s.host_id = uid and b.status <> 'confirmed' then
    return jsonb_build_object('allowed', false, 'refundMode', 'NONE', 'refundAmountVnd', 0, 'policyCode', 'HOST_DECLINE_NOT_CANCELLATION', 'expectedVersion', b.version, 'paymentInFlight', in_flight);
  end if;
  if p.id is null or p.status <> 'succeeded' then
    return jsonb_build_object('allowed', true, 'refundMode', 'NONE', 'refundAmountVnd', 0,
      'policyCode', case when in_flight then 'PAYMENT_IN_FLIGHT_COMPENSATION_ON_LATE_SUCCESS' else 'ATTENDEE_CANCEL_UNPAID_NO_REFUND' end,
      'expectedVersion', b.version, 'paymentInFlight', in_flight);
  end if;
  if s.host_id = uid or s.starts_at - now() >= public.cancellation_refund_cutoff() then
    return jsonb_build_object('allowed', true, 'refundMode', 'FULL', 'refundAmountVnd', p.amount_vnd, 'policyCode', case when s.host_id = uid then 'HOST_CANCEL_CONFIRMED_PAID_FULL' else 'ATTENDEE_CANCEL_CONFIRMED_PAID_REFUNDABLE' end, 'expectedVersion', b.version, 'paymentInFlight', false);
  end if;
  return jsonb_build_object('allowed', true, 'refundMode', 'NONE', 'refundAmountVnd', 0, 'policyCode', 'ATTENDEE_CANCEL_CONFIRMED_PAID_INSIDE_CUTOFF', 'expectedVersion', b.version, 'paymentInFlight', false);
end $$;

revoke all on function public.get_booking_cancellation_preview(uuid) from public, anon, authenticated;
grant execute on function public.get_booking_cancellation_preview(uuid) to authenticated;
