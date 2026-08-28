-- Fix booking_read_json for workshop bookings:
-- 1. LEFT JOIN tutor_profiles (hosts may not have tutor_profiles rows)
-- 2. Add pricePerParticipantVnd to pricing object
-- 3. Fix paymentReady for INSTANT bookings
-- 4. Add learner name, cancellation object, tutor/learner display fields

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
    'pricePerParticipantVnd', b.pricing_price_per_participant_vnd,
    'snapshottedAt', b.pricing_snapshotted_at
  ) end,
  'session', public.session_json(b.session_id),
  'tutor', case when tp.id is not null then jsonb_build_object('id', tp.id, 'displayName', tp.display_name) else null end,
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
    and (
      (o.booking_mode = 'approval' and exists(select 1 from public.booking_approvals a where a.booking_id = b.id and a.revoked_at is null and (a.expires_at is null or a.expires_at > now())))
      or
      (o.booking_mode = 'instant')
    )
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
left join public.tutor_profiles tp on tp.user_id = s.host_id
join public.profiles learner on learner.id = b.learner_id
left join public.payments p on p.booking_id = b.id
left join public.offerings o on o.id = s.offering_id
where b.id = bid
$$;

revoke all on function public.booking_read_json(uuid) from public, anon, authenticated;
