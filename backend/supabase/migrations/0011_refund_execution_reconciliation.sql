-- Tutoria refund execution + authoritative reconciliation (Phase 3, part 1).
--
-- COMMIT 1 boundary (provider refund execution semantics + accepted->pending
-- mapping + authoritative reconciliation + provider-operation idempotency):
--   * refunds gain durable sweep/claim metadata (attempt_count, last_error,
--     available_at, claimed_by/claimed_at/lease_until) so a worker can claim
--     an accepted obligation and execute it exactly once per lease window.
--   * the refund execution claim maps an accepted 'obligation' to an
--     in-execution claim (lease). The refund row only moves to 'pending' when
--     the provider request is accepted (record_vnpay_refund_result), matching
--     obligation -> claimed -> provider request -> pending.
--   * payment_provider_operations gains reconciliation-query support: a
--     'query' operation may now carry a refund_id (querydr evidence for a
--     refund), in addition to the existing payment-attempt query.
--   * record_vnpay_refund_result is hardened:
--       - requires a real provider operation (UNKNOWN_OPERATION) -- no
--         fabricated settlement,
--       - 'succeeded' requires authoritative settlement proof
--         (vnp_ResponseCode=00 AND vnp_TransactionStatus=00 in the provider
--          response); otherwise INVALID_REFUND_RESULT,
--       - outcome may be pending/succeeded/failed/ambiguous,
--       - releases the worker lease on every outcome,
--       - emits minimal REFUND_PENDING/SUCCEEDED/FAILED/AMBIGUOUS outbox
--         events and payment_events audit rows.
--   * one logical Refund -> one logical provider operation
--     (operation_key = refund:<refundId>); retries/inspection reuse it.
--
-- Additive only. 0001-0010 and the 2026* migrations are untouched.

-- 1) Single SQL definition of the refund provider-attempt bound (mirrored in
--    the worker; the DB is the enforcement authority). 5 = bounded retries,
--    no infinite retries.
create or replace function public.refund_provider_max_attempts() returns int
language sql stable security definer set search_path = '' as $$
  select 5
$$;
revoke all on function public.refund_provider_max_attempts() from public, anon, authenticated;

-- 2) refunds: durable sweep/claim metadata (mirrors the event_outbox claim
--    pattern; lease-based, DB-level, FOR UPDATE SKIP LOCKED at claim time).
alter table public.refunds
  add column if not exists attempt_count int not null default 0 check (attempt_count >= 0),
  add column if not exists last_error text check (last_error is null or char_length(last_error) <= 500),
  add column if not exists available_at timestamptz not null default now(),
  add column if not exists claimed_by text,
  add column if not exists claimed_at timestamptz,
  add column if not exists lease_until timestamptz;

-- A claimed row intentionally clears available_at while the lease is active;
-- keep the column nullable so lease recovery can distinguish in-flight work
-- from work scheduled for a later retry.
alter table public.refunds alter column available_at drop not null;

-- The payment tables are intentionally inaccessible to browser roles. The
-- service-role worker still needs explicit table privileges for its narrow
-- reads and provider-operation writes; SECURITY DEFINER RPCs remain the
-- authority for financial state transitions.
grant select on public.refunds, public.payments, public.payment_attempts to service_role;
grant select, insert, update on public.payment_provider_operations to service_role;

create index if not exists refunds_claim on public.refunds (status, available_at, created_at);

-- 3) payment_provider_operations: allow reconciliation 'query' operations for
--    refunds (querydr evidence) alongside payment-attempt queries.
alter table public.payment_provider_operations drop constraint if exists payment_provider_operations_check;
alter table public.payment_provider_operations add constraint payment_provider_operations_check check (
  (operation_type = 'query' and (attempt_id is not null or refund_id is not null))
  or (operation_type = 'refund' and refund_id is not null)
);
create index if not exists payment_provider_operations_refund
  on public.payment_provider_operations (refund_id, created_at desc);

-- 4) payment_events audit vocabulary: add the refund_pending transition.
alter table public.payment_events drop constraint if exists payment_events_event_type_check;
alter table public.payment_events add constraint payment_events_event_type_check check (event_type in (
  'payment_created','attempt_created','provider_pending','provider_succeeded','provider_failed',
  'finalization_failed','refund_obligation_created','refund_pending','refund_succeeded',
  'refund_failed','refund_ambiguous'));

-- 5) outbox vocabulary: refund execution/reconciliation events (minimal,
--    emitted only by security-definer RPCs; source-of-truth stays in
--    refunds/payment_provider_operations).
alter table public.event_outbox drop constraint if exists event_outbox_event_type_check;
alter table public.event_outbox add constraint event_outbox_event_type_check check (event_type in (
  'BOOKING_REQUESTED','BOOKING_CONFIRMED','BOOKING_REJECTED','BOOKING_CANCELLED','BOOKING_COMPLETED',
  'BOOKING_RESCHEDULED','RESCHEDULE_REQUESTED','RESCHEDULE_REJECTED','RESCHEDULE_CANCELLED',
  'ATTENDANCE_REPORTED','SESSION_RESCHEDULED','SESSION_CANCELLED',
  'PAYMENT_ATTEMPTED','PAYMENT_SUCCEEDED','PAYMENT_FAILED','PAYMENT_RETRIED','REFUND_ISSUED',
  'BOOKING_APPROVED_FOR_PAYMENT','PAYMENT_CREATED','PAYMENT_PROVIDER_OBSERVED',
  'BOOKING_FINALIZATION_FAILED','REFUND_OBLIGATION_CREATED',
  'REFUND_PENDING','REFUND_SUCCEEDED','REFUND_FAILED','REFUND_AMBIGUOUS'));

-- 6) Claim an accepted refund obligation for execution. DB-level claim:
--    FOR UPDATE SKIP LOCKED so concurrent workers never execute the same
--    refund in the same lease window. The row stays 'obligation' until the
--    provider request is accepted (record_vnpay_refund_result moves it to
--    'pending'); the lease marks the in-execution window. attempt_count is
--    bounded by refund_provider_max_attempts(); exhausting it marks the
--    refund durably failed (observable, never silently dropped). Lease
--    recovery mirrors the reconciliation claim: a claimed-but-crashed
--    execution (available_at = null) becomes claimable again after its
--    lease expires, so a process restart never strands an obligation.
create or replace function public.claim_pending_refund_executions(
  p_worker_id text,
  p_max_count int default 50,
  p_lease_seconds int default 300
) returns setof jsonb
language plpgsql security definer set search_path = '' as $$
declare rr record; a public.payment_attempts%rowtype;
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
  for rr in
    select r.id, r.payment_id, r.amount_vnd, r.kind, r.reason, r.attempt_count,
           p.booking_id, p.amount_vnd as payment_amount, p.refunded_amount_vnd
      from public.refunds r
      join public.payments p on p.id = r.payment_id
     where r.status = 'obligation'
       and (r.available_at is null or r.available_at <= now())
       and (r.lease_until is null or r.lease_until <= now())
     order by r.created_at, r.id
     limit p_max_count
     for update of r skip locked
  loop
    if rr.attempt_count >= public.refund_provider_max_attempts() then
      update public.refunds
         set status = 'failed', last_error = 'execution_retries_exhausted', updated_at = now()
       where id = rr.id;
      insert into public.payment_events(payment_id,event_type,amount_vnd,payload)
        values (rr.payment_id,'refund_failed',rr.amount_vnd,
          jsonb_build_object('refundId',rr.id,'error','execution_retries_exhausted'));
      perform public.insert_outbox_event('REFUND_FAILED','payment',rr.payment_id,1,
        jsonb_build_object('paymentId',rr.payment_id,'refundId',rr.id,'amountVnd',rr.amount_vnd,
          'error','execution_retries_exhausted'));
      continue;
    end if;
    select * into a from public.payment_attempts
      where payment_id = rr.payment_id order by created_at desc limit 1;
    update public.refunds
       set claimed_by = p_worker_id, claimed_at = now(),
           lease_until = now() + make_interval(secs => p_lease_seconds),
           attempt_count = attempt_count + 1, available_at = null, updated_at = now()
     where id = rr.id;
    return next jsonb_build_object(
      'refundId', rr.id, 'paymentId', rr.payment_id, 'bookingId', rr.booking_id,
      'amountVnd', rr.amount_vnd, 'kind', rr.kind, 'reason', rr.reason,
      'paymentAmountVnd', rr.payment_amount, 'paymentRefundedVnd', rr.refunded_amount_vnd,
      'merchantReference', coalesce(a.merchant_reference, ''),
      'providerTransactionNo', a.provider_transaction_no,
      'attemptCount', rr.attempt_count + 1);
  end loop;
end $$;
revoke all on function public.claim_pending_refund_executions(text, int, int) from public, anon, authenticated;
grant execute on function public.claim_pending_refund_executions(text, int, int) to service_role;

-- 7) Release a worker claim (transient local failure before the provider
--    outcome was recorded). Soft/idempotent: returns released:false when the
--    claim is no longer held by this worker (e.g. record_vnpay_refund_result
--    already released it). Never changes refund status; backoff keeps the
--    refund from being hot-looped.
create or replace function public.release_refund_claim(
  p_worker_id text,
  p_refund_id uuid,
  p_error text default null,
  p_backoff_seconds int default 60
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
  update public.refunds
     set claimed_by = null, claimed_at = null, lease_until = null,
         available_at = now() + make_interval(secs => p_backoff_seconds),
         last_error = left(coalesce(p_error, ''), 500), updated_at = now()
   where id = p_refund_id and claimed_by = p_worker_id
   returning jsonb_build_object('released', true, 'refundId', id) into out;
  if out is null then
    return jsonb_build_object('released', false, 'refundId', p_refund_id);
  end if;
  return out;
end $$;
revoke all on function public.release_refund_claim(text, uuid, text, int) from public, anon, authenticated;
grant execute on function public.release_refund_claim(text, uuid, text, int) to service_role;

-- 8) Hardened authoritative refund-result recording (CREATE OR REPLACE of the
--    0008 function; new signature adds settlement evidence). Settlement rules:
--      - succeeded only with provider settlement proof in p_settlement_payload
--        (vnp_ResponseCode=00 AND vnp_TransactionStatus=00);
--      - p_provider_request_id must match a persisted provider operation for
--        this refund (UNKNOWN_OPERATION otherwise);
--      - refund amount never exceeds remaining refundable (REFUND_EXCEEDS_REMAINING);
--      - payment becomes 'refunded' only when cumulative refunds == amount_vnd;
--      - the claim lease is released on every outcome.
create or replace function public.record_vnpay_refund_result(
  p_refund_id uuid,
  p_outcome text,
  p_provider_request_id text,
  p_provider_transaction_no text default null,
  p_settlement_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r public.refunds%rowtype; p public.payments%rowtype; o public.payment_provider_operations%rowtype;
  new_total bigint;
begin
  if p_outcome not in ('pending','succeeded','failed','ambiguous')
     or p_provider_request_id is null or p_provider_request_id = '' then
    raise exception 'INVALID_REFUND_RESULT' using errcode='22023';
  end if;
  if p_outcome = 'succeeded' and (
      p_settlement_payload is null
      or (p_settlement_payload->>'vnp_ResponseCode') is distinct from '00'
      or (p_settlement_payload->>'vnp_TransactionStatus') is distinct from '00') then
    raise exception 'INVALID_REFUND_RESULT' using errcode='22023';
  end if;
  select * into o from public.payment_provider_operations
    where refund_id = p_refund_id and provider_request_id = p_provider_request_id
    limit 1;
  if o.id is null then raise exception 'UNKNOWN_OPERATION' using errcode='22023'; end if;
  select * into r from public.refunds where id = p_refund_id for update;
  if r.id is null then raise exception 'UNKNOWN_REFUND' using errcode='22023'; end if;
  if r.status = 'succeeded' then
    return jsonb_build_object('duplicate', true, 'refundId', r.id, 'status', r.status);
  end if;
  select * into p from public.payments where id = r.payment_id for update;
  if p.status not in ('succeeded','refunded') then
    raise exception 'PAYMENT_NOT_REFUNDABLE' using errcode='22023';
  end if;
  if p_outcome = 'succeeded' then
    if r.amount_vnd > p.amount_vnd - p.refunded_amount_vnd then
      raise exception 'REFUND_EXCEEDS_REMAINING' using errcode='22023';
    end if;
    new_total := p.refunded_amount_vnd + r.amount_vnd;
    update public.refunds
       set status = 'succeeded', provider_request_id = p_provider_request_id,
           provider_transaction_no = coalesce(p_provider_transaction_no, provider_transaction_no),
           last_error = null, updated_at = now()
     where id = r.id;
    update public.payments
       set refunded_amount_vnd = new_total,
           status = case when new_total = amount_vnd then 'refunded' else status end,
           version = version + 1, updated_at = now()
     where id = p.id;
    insert into public.payment_events(payment_id,event_type,amount_vnd,payload)
      values (p.id,'refund_succeeded',r.amount_vnd,
        jsonb_build_object('refundId',r.id,'providerRequestId',p_provider_request_id));
    perform public.insert_outbox_event('REFUND_SUCCEEDED','payment',p.id,p.version + 1,
      jsonb_build_object('paymentId',p.id,'refundId',r.id,'amountVnd',r.amount_vnd));
  elsif p_outcome = 'pending' then
    update public.refunds
       set status = 'pending', provider_request_id = p_provider_request_id,
           provider_transaction_no = coalesce(p_provider_transaction_no, provider_transaction_no),
           last_error = null, updated_at = now()
     where id = r.id;
    insert into public.payment_events(payment_id,event_type,amount_vnd,payload)
      values (p.id,'refund_pending',r.amount_vnd,
        jsonb_build_object('refundId',r.id,'providerRequestId',p_provider_request_id));
    perform public.insert_outbox_event('REFUND_PENDING','payment',p.id,p.version,
      jsonb_build_object('paymentId',p.id,'refundId',r.id,'amountVnd',r.amount_vnd));
  else
    update public.refunds
       set status = p_outcome, provider_request_id = p_provider_request_id,
           provider_transaction_no = coalesce(p_provider_transaction_no, provider_transaction_no),
           last_error = 'provider:' || p_outcome, updated_at = now()
     where id = r.id;
    insert into public.payment_events(payment_id,event_type,amount_vnd,payload)
      values (p.id,case when p_outcome = 'failed' then 'refund_failed' else 'refund_ambiguous' end,
        r.amount_vnd, jsonb_build_object('refundId',r.id,'providerRequestId',p_provider_request_id));
    perform public.insert_outbox_event(
      case when p_outcome = 'failed' then 'REFUND_FAILED' else 'REFUND_AMBIGUOUS' end,
      'payment', p.id, p.version,
      jsonb_build_object('paymentId',p.id,'refundId',r.id,'amountVnd',r.amount_vnd));
  end if;
  update public.refunds set claimed_by = null, claimed_at = null, lease_until = null where id = r.id;
  return jsonb_build_object('duplicate', false, 'refundId', r.id, 'status', p_outcome);
end $$;
revoke all on function public.record_vnpay_refund_result(uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_vnpay_refund_result(uuid, text, text, text, jsonb) to service_role;
-- retire the v1 four-argument signature superseded above so a fresh reset
-- ends with exactly one service-role-only overload.
drop function if exists public.record_vnpay_refund_result(uuid, text, text, text);
