-- 20260907000000_booking_expiry_sweep.sql
-- Replaces the broken original. Purpose: release Session capacity that stale
-- "requested" bookings hold (requested/confirmed hard-reserve capacity per the
-- booking domain). Expire ONLY unpaid, abandoned "requested" bookings that have
-- been pending > 24 hours with no tutor response.
--
-- Scope guard (Option A, see product-brain note / open decisions):
--   * Never auto-expires a booking with a 'succeeded' OR 'pending' payment.
--       - 'succeeded' would create a REFUND obligation (PRODUCT_DECISION_REQUIRED).
--       - 'pending' is owned by the workshop payment-TTL worker (expire_stale_workshop_bookings).
--   * Only payments that are absent or already 'failed' are therefore eligible.
--
-- Mirrors the proven expire_stale_workshop_bookings skeleton for worker safety:
--   for update skip locked (single-worker claim), version CAS re-check, direct
--   system transition to 'cancelled' (cancelled_by='system'), booking_history
--   append, and a BOOKING_CANCELLED outbox event. The public `cancel_booking`
--   RPC is NOT used because it is attendee/host-only authz and has no system
--   actor path; this is a persistence-layer system rule, consistent with the
--   workshop worker.
set search_path = '';

create or replace function public.claim_pending_booking_expirations(
  p_worker_id text default 'system',
  p_max_count int default 50
)
returns table(booking_id uuid, session_id uuid, version bigint, payload jsonb)
language plpgsql
security definer set search_path=''
as $$
begin
  return query
  select
    b.id as booking_id,
    b.session_id,
    b.version,
    jsonb_build_object(
      'bookingId', b.id,
      'sessionId', b.session_id,
      'createdAt', b.created_at,
      'status', b.status
    ) as payload
  from public.bookings b
  where b.status = 'requested'
    and b.created_at < now() - interval '24 hours'
    and not exists (
      select 1 from public.payments p
      where p.booking_id = b.id
        and p.status in ('succeeded', 'pending')
    )
  order by b.created_at asc
  limit p_max_count
  for update of b skip locked;
end;
$$;

create or replace function public.expire_stale_bookings(p_worker_id text default 'system')
returns jsonb
language plpgsql
security definer set search_path=''
as $$
declare
  v_expired int := 0;
  r record;
begin
  for r in
    select x.booking_id, x.session_id, x.version
    from public.claim_pending_booking_expirations(p_worker_id, 50) as x
  loop
    -- CAS: skip if the booking moved since it was claimed (avoids stale writes).
    if (select version from public.bookings where id = r.booking_id) <> r.version then
      continue;
    end if;

    update public.bookings set
      status = 'cancelled',
      cancelled_by = 'system',
      cancelled_reason = 'auto_expired',
      version = version + 1
    where id = r.booking_id
      and status = 'requested';

    if not found then
      continue;
    end if;

    insert into public.booking_history(booking_id, from_status, to_status, actor, at, reason)
    values (r.booking_id, 'requested', 'cancelled', 'system', now(), 'auto_expired');

    perform public.insert_outbox_event(
      'BOOKING_CANCELLED', 'booking', r.booking_id, r.version + 1,
      jsonb_build_object(
        'bookingId', r.booking_id,
        'sessionId', r.session_id,
        'cancelledBy', 'system',
        'fromStatus', 'requested',
        'reason', 'auto_expired'
      )
    );

    v_expired := v_expired + 1;
  end loop;

  return jsonb_build_object('expired', v_expired);
end;
$$;

revoke all on function public.claim_pending_booking_expirations(text, int) from public, anon, authenticated;
grant execute on function public.claim_pending_booking_expirations(text, int) to service_role;

revoke all on function public.expire_stale_bookings(text) from public, anon, authenticated;
grant execute on function public.expire_stale_bookings(text) to service_role;
