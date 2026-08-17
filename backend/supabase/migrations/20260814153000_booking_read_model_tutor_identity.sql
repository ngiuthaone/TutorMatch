-- Add the persisted public Tutor identity to learner-owned Booking reads.
-- Booking/session/payment lifecycle and authorization remain unchanged.

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

create or replace function public.get_my_bookings() returns jsonb
language sql stable security definer set search_path='' as $$
select coalesce(jsonb_agg(public.booking_read_json(b.id) order by b.created_at desc), '[]'::jsonb)
from public.bookings b where b.learner_id = auth.uid()
$$;

create or replace function public.get_booking(bid uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise insufficient_privilege; end if;
  if not exists(select 1 from public.bookings where id = bid and learner_id = uid)
     and not exists(select 1 from public.bookings b join public.sessions s on s.id = b.session_id where b.id = bid and s.host_id = uid)
  then raise insufficient_privilege; end if;
  return public.booking_read_json(bid);
end $$;

create or replace function public.get_my_tutor_bookings() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare uid uuid := public.assert_tutor_caller(); rows jsonb;
begin
  select coalesce(jsonb_agg(public.booking_read_json(b.id) order by b.created_at desc), '[]'::jsonb)
    into rows
    from public.bookings b join public.sessions s on s.id = b.session_id where s.host_id = uid;
  return rows;
end $$;

revoke all on function public.get_my_bookings() from public, anon, authenticated;
revoke all on function public.get_booking(uuid) from public, anon, authenticated;
revoke all on function public.get_my_tutor_bookings() from public, anon, authenticated;
grant execute on function public.get_my_bookings() to authenticated;
grant execute on function public.get_booking(uuid) to authenticated;
grant execute on function public.get_my_tutor_bookings() to authenticated;
