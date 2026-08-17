-- Tutoria reliable domain events: transactional outbox.
--
-- Purpose: a committed domain mutation must not silently lose its event
-- before downstream systems (notifications, payment orchestration, analytics)
-- have a chance to process it. Outbox records are written in the SAME
-- PostgreSQL transaction as the authoritative mutation, so commit and event
-- are atomic.
--
-- Design summary (see docs/agent-team/DESIGN-OUTBOX-EVENTS.md):
--   * Event types are the established domain names verbatim
--     (backend/src/domain/booking-lifecycle.ts, session-lifecycle.ts,
--     payment-lifecycle.ts). Payment/refund types are RESERVED for when
--     payment persistence exists; no current code path emits them.
--   * Delivery lifecycle: pending -> processing -> processed, with a claim
--     lease so a crashed worker's claim can be recovered (at-least-once
--     delivery; consumers must be idempotent). processed_at describes the
--     outbox processing boundary only, never external side-effect success.
--   * Retry metadata is on the same row; fact fields are immutable after
--     creation (event_type, aggregate_*, payload, occurred_at).
--   * Access: RLS on, fully revoked. Emission happens only inside the 0005
--     security-definer RPCs (via private helper); worker primitives are
--     callable only by service_role.

create table if not exists public.event_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in (
    'BOOKING_REQUESTED','BOOKING_CONFIRMED','BOOKING_REJECTED','BOOKING_CANCELLED',
    'BOOKING_COMPLETED','BOOKING_RESCHEDULED','RESCHEDULE_REQUESTED',
    'RESCHEDULE_REJECTED','RESCHEDULE_CANCELLED','ATTENDANCE_REPORTED',
    'SESSION_RESCHEDULED','SESSION_CANCELLED',
    -- Reserved: payment persistence does not exist yet (no authoritative
    -- financial mutation backs them). Not emitted by any current code path.
    'PAYMENT_ATTEMPTED','PAYMENT_SUCCEEDED','PAYMENT_FAILED','PAYMENT_RETRIED','REFUND_ISSUED')),
  event_version int not null default 1 check (event_version >= 1),
  aggregate_type text not null check (aggregate_type in ('booking','session')),
  aggregate_id uuid not null,
  aggregate_version bigint not null check (aggregate_version > 0),
  occurred_at timestamptz not null default now(),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','processing','processed')),
  available_at timestamptz not null default now(),
  attempt_count int not null default 0 check (attempt_count >= 0),
  last_error text check (last_error is null or char_length(last_error) <= 500),
  processed_at timestamptz,
  claimed_by text,
  claimed_at timestamptz,
  lease_until timestamptz,
  created_at timestamptz not null default now()
);

-- Claim scan (pending + expired-lease processing rows) in age order.
create index if not exists event_outbox_claim
  on public.event_outbox (status, available_at, occurred_at);
-- Per-aggregate ordering / observability (authoritative: aggregate_version).
create index if not exists event_outbox_aggregate
  on public.event_outbox (aggregate_type, aggregate_id, aggregate_version);
-- Observability on the terminal population.
create index if not exists event_outbox_processed
  on public.event_outbox (processed_at) where status = 'processed';

-- RLS enabled; fully revoked: no direct table access for any client role.
-- All access flows through security-definer functions (emission RPCs and the
-- worker primitives below), matching the 0004/0005 pattern.
alter table public.event_outbox enable row level security;
revoke all on table public.event_outbox from public, anon, authenticated;

-- Private emission helper: constructs the row from trusted database state.
-- event_type/aggregate_type/aggregate_version are validated by the CHECK
-- constraints and chosen by the calling RPC from authoritative state, never
-- from arbitrary client input. occurred_at is always DB-generated.
-- event_version is 1 (additive schema versioning; consumers must tolerate
-- additive payload fields).
create or replace function public.insert_outbox_event(
  p_event_type text,
  p_aggregate_type text,
  p_aggregate_id uuid,
  p_aggregate_version bigint,
  p_payload jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare eid uuid := gen_random_uuid();
begin
  insert into public.event_outbox(
    id, event_type, event_version, aggregate_type, aggregate_id,
    aggregate_version, occurred_at, payload)
  values (
    eid, p_event_type, 1, p_aggregate_type, p_aggregate_id,
    p_aggregate_version, now(), p_payload)
  returning id into eid;
  return eid;
end $$;
revoke all on function public.insert_outbox_event(text, text, uuid, bigint, jsonb)
  from public, anon, authenticated;

-- Worker primitives (future reliable processor). At-least-once: a worker may
-- perform a side effect and crash before complete_event; the event becomes
-- claimable again after lease expiry, so consumers must be idempotent.
-- Claimed rows are exclusively held within a lease via FOR UPDATE SKIP LOCKED:
-- concurrent workers never intentionally claim the same row in the same window.

create or replace function public.claim_pending_events(
  p_worker_id text,
  p_max_count int default 50,
  p_lease_seconds int default 300
) returns setof jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.event_outbox%rowtype;
begin
  if p_worker_id is null or p_worker_id = '' then
    raise exception 'INVALID_TRANSITION' using errcode='22023';
  end if;
  if p_max_count < 1 or p_max_count > 1000 then
    raise exception 'INVALID_TRANSITION' using errcode='22023';
  end if;
  if p_lease_seconds < 1 or p_lease_seconds > 86400 then
    raise exception 'INVALID_TRANSITION' using errcode='22023';
  end if;
  for r in
    select * from public.event_outbox
    where (status = 'pending' and available_at <= now())
       or (status = 'processing' and lease_until is not null and lease_until <= now())
    order by occurred_at, id
    limit p_max_count
    for update skip locked
  loop
    update public.event_outbox
       set status = 'processing', claimed_by = p_worker_id, claimed_at = now(),
           lease_until = now() + make_interval(secs => p_lease_seconds),
           attempt_count = attempt_count + 1
     where id = r.id;
    return next jsonb_build_object(
      'id', r.id, 'eventType', r.event_type, 'eventVersion', r.event_version,
      'aggregateType', r.aggregate_type, 'aggregateId', r.aggregate_id,
      'aggregateVersion', r.aggregate_version, 'occurredAt', r.occurred_at,
      'payload', r.payload, 'attemptCount', r.attempt_count + 1);
  end loop;
end $$;
revoke all on function public.claim_pending_events(text, int, int) from public, anon, authenticated;
grant execute on function public.claim_pending_events(text, int, int) to service_role;

create or replace function public.complete_event(p_worker_id text, p_event_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare out jsonb;
begin
  if p_worker_id is null or p_worker_id = '' then
    raise exception 'INVALID_TRANSITION' using errcode='22023';
  end if;
  update public.event_outbox
     set status = 'processed', processed_at = now(),
         claimed_by = null, claimed_at = null, lease_until = null
   where id = p_event_id and status = 'processing' and claimed_by = p_worker_id
   returning jsonb_build_object('id', id, 'status', status, 'processedAt', processed_at) into out;
  if out is null then raise insufficient_privilege; end if;
  return out;
end $$;
revoke all on function public.complete_event(text, uuid) from public, anon, authenticated;
grant execute on function public.complete_event(text, uuid) to service_role;

create or replace function public.fail_event(
  p_worker_id text,
  p_event_id uuid,
  p_error text default null,
  p_backoff_seconds int default 0
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare out jsonb;
begin
  if p_worker_id is null or p_worker_id = '' then
    raise exception 'INVALID_TRANSITION' using errcode='22023';
  end if;
  if p_backoff_seconds < 0 or p_backoff_seconds > 86400 then
    raise exception 'INVALID_TRANSITION' using errcode='22023';
  end if;
  update public.event_outbox
     set status = 'pending', available_at = now() + make_interval(secs => p_backoff_seconds),
         last_error = left(coalesce(p_error, ''), 500),
         claimed_by = null, claimed_at = null, lease_until = null
   where id = p_event_id and status = 'processing' and claimed_by = p_worker_id
   returning jsonb_build_object('id', id, 'status', status,
     'availableAt', available_at, 'attemptCount', attempt_count) into out;
  if out is null then raise insufficient_privilege; end if;
  return out;
end $$;
revoke all on function public.fail_event(text, uuid, text, int) from public, anon, authenticated;
grant execute on function public.fail_event(text, uuid, text, int) to service_role;
