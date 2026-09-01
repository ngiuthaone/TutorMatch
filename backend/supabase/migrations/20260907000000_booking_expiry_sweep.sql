-- Booking Expiry Sweep
-- Expires stale "requested" bookings that have been pending for > 24 hours
-- without being confirmed or cancelled. This frees up session capacity.

-- Claim pending expiry jobs (bookings in "requested" status for > 24 hours)
create or replace function claim_pending_booking_expirations(
  p_worker_id text,
  p_max_count int default 50,
  p_lease_seconds int default 300
)
returns table(id uuid, booking_id uuid, learner_id uuid, session_id uuid, payload jsonb)
language plpgsql
security definer set search_path=''
as $$
declare
  v_lease_until timestamptz;
begin
  v_lease_until := now() + (p_lease_seconds || ' seconds')::interval;
  
  return query
  with claimed as (
    update booking_history bh
    set 
      metadata = jsonb_set(coalesce(metadata, '{}'), '{expiry_worker}', to_jsonb(p_worker_id)),
      metadata = jsonb_set(metadata, '{expiry_claimed_at}', to_jsonb(now())),
      metadata = jsonb_set(metadata, '{expiry_lease_until}', to_jsonb(v_lease_until))
    from bookings b
    where bh.booking_id = b.id
      and b.status = 'requested'
      and b.created_at < now() - interval '24 hours'
      and bh.id = (
        select h.id from booking_history h 
        where h.booking_id = b.id 
        order by h.created_at asc 
        limit 1
      )
      and (b.metadata->>'expiry_worker' is null or b.metadata->>'expiry_lease_until' is null or (b.metadata->>'expiry_lease_until')::timestamptz < now())
    limit p_max_count
    returning bh.booking_id
  )
  select 
    bh.id,
    bh.booking_id,
    b.learner_id,
    b.session_id,
    jsonb_build_object(
      'bookingId', b.id,
      'learnerId', b.learner_id,
      'sessionId', b.session_id,
      'createdAt', b.created_at,
      'status', b.status
    ) as payload
  from booking_history bh
  join bookings b on bh.booking_id = b.id
  where bh.booking_id in (select * from claimed);
end;
$$;

grant execute on function claim_pending_booking_expirations(text, int, int) to service_role;

-- The actual expiry sweep RPC called by the worker
create or replace function expire_stale_bookings(p_worker_id text)
returns jsonb
language plpgsql
security definer set search_path=''
as $$
declare
  v_claimed int := 0;
  v_expired int := 0;
  v_skipped int := 0;
  r record;
begin
  for r in 
    select bh.booking_id, b.status, b.created_at, b.session_id
    from claim_pending_booking_expirations(p_worker_id, 50, 300) as x
    join bookings b on x.booking_id = b.id
    join booking_history bh on bh.booking_id = b.id
    where x.id = (select h.id from booking_history h where h.booking_id = b.id order by h.created_at asc limit 1)
  loop
    -- Re-check status under lock to avoid race conditions
    if r.status != 'requested' then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    
    -- Cancel the booking (expire it)
    perform cancel_booking_rpc(r.booking_id, r.learner_id, 'system', 'Booking expired: no response from tutor within 24 hours');
    
    v_expired := v_expired + 1;
  end loop;
  
  return jsonb_build_object(
    'claimed', coalesce(v_claimed, 0),
    'expired', v_expired,
    'skipped', v_skipped
  );
end;
$$;

grant execute on function expire_stale_bookings(text) to service_role;

-- Add metadata column to bookings if it doesn't exist (for tracking expiry claims)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'bookings' and column_name = 'metadata') then
    alter table bookings add column metadata jsonb default '{}'::jsonb;
  end if;
end
$$;
