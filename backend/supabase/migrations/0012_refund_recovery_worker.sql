-- Tutoria durable financial recovery worker primitives (Phase 3, part 2).
--
-- COMMIT 2 boundary (outbox/work claiming + refund execution sweep + refund
-- reconciliation sweep + succeeded-payment finalize retry):
--   * claim_pending_refund_reconciliations: DB-level claim (FOR UPDATE SKIP
--     LOCKED) of pending/ambiguous refunds that have a real executed provider
--     operation, so the worker can querydr them and reconcile settlement.
--     Reconciliation attempts are bounded by refund_provider_max_attempts();
--     exhaustion marks the refund durably ambiguous (needs human review).
--   * claim_pending_payment_finalizations: dedicated claim function for the
--     succeeded-payment finalize retry worker. It claims only PAYMENT_SUCCEEDED
--     outbox events so the worker never processes unrelated event types. The
--     historical claim_pending_events(text,int,int) function is left untouched
--     (additive-only; no signature change, so the existing migration-mutating
--     integration harness that re-applies 0006 keeps resolving unambiguously).
--
-- Additive only. 0001-0011 and the 2026* migrations are untouched.

-- 1) Claim pending/ambiguous refunds for querydr reconciliation. Requires a
--    real executed refund operation (operation_type='refund') so a refund can
--    only be reconciled after a provider refund request actually happened.
create or replace function public.claim_pending_refund_reconciliations(
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
    select r.id as refund_id, r.payment_id, r.amount_vnd, r.kind, r.reason,
           r.attempt_count, r.status as refund_status,
           o.provider_request_id, r.provider_transaction_no as refund_transaction_no,
           o.created_at as refund_created_at,
           p.booking_id
      from public.refunds r
      join public.payment_provider_operations o
        on o.refund_id = r.id and o.operation_type = 'refund'
      join public.payments p on p.id = r.payment_id
     where r.status in ('pending','ambiguous')
       and (r.lease_until is null or r.lease_until <= now())
       and (r.available_at is null or r.available_at <= now())
     order by r.created_at, r.id
     limit p_max_count
     for update of r skip locked
  loop
    if rr.attempt_count >= public.refund_provider_max_attempts() then
      update public.refunds
         set status = 'ambiguous', last_error = 'reconciliation_retries_exhausted', updated_at = now()
       where id = rr.refund_id;
      insert into public.payment_events(payment_id,event_type,amount_vnd,payload)
        values (rr.payment_id,'refund_ambiguous',rr.amount_vnd,
          jsonb_build_object('refundId',rr.refund_id,'error','reconciliation_retries_exhausted'));
      perform public.insert_outbox_event('REFUND_AMBIGUOUS','payment',rr.payment_id,1,
        jsonb_build_object('paymentId',rr.payment_id,'refundId',rr.refund_id,'amountVnd',rr.amount_vnd,
          'error','reconciliation_retries_exhausted'));
      continue;
    end if;
    select * into a from public.payment_attempts
      where payment_id = rr.payment_id order by created_at desc limit 1;
    update public.refunds
       set claimed_by = p_worker_id, claimed_at = now(),
           lease_until = now() + make_interval(secs => p_lease_seconds),
           attempt_count = attempt_count + 1, available_at = null, updated_at = now()
     where id = rr.refund_id;
    return next jsonb_build_object(
      'refundId', rr.refund_id, 'paymentId', rr.payment_id, 'bookingId', rr.booking_id,
      'amountVnd', rr.amount_vnd, 'kind', rr.kind, 'reason', rr.reason,
      'refundStatus', rr.refund_status,
      'providerRequestId', rr.provider_request_id,
      'refundTransactionNo', rr.refund_transaction_no,
      'refundTransactionDate', to_char(rr.refund_created_at at time zone 'Asia/Ho_Chi_Minh', 'YYYYMMDDHH24MISS'),
      'merchantReference', coalesce(a.merchant_reference, ''),
      'attemptCount', rr.attempt_count + 1);
  end loop;
end $$;
revoke all on function public.claim_pending_refund_reconciliations(text, int, int) from public, anon, authenticated;
grant execute on function public.claim_pending_refund_reconciliations(text, int, int) to service_role;

-- 2) Dedicated claim function for the succeeded-payment finalize retry worker.
--    Claims only PAYMENT_SUCCEEDED outbox events so the worker never touches
--    unrelated event types. The historical claim_pending_events(text,int,int)
--    (0006) is intentionally NOT modified or overridden: any additional
--    parameter (even defaulted) would create an ambiguous overload the moment
--    a migration-mutating harness re-applies 0006, breaking every 3-arg call.
create or replace function public.claim_pending_payment_finalizations(
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
    where event_type = 'PAYMENT_SUCCEEDED'
      and ((status = 'pending' and available_at <= now())
        or (status = 'processing' and lease_until is not null and lease_until <= now()))
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
revoke all on function public.claim_pending_payment_finalizations(text, int, int) from public, anon, authenticated;
grant execute on function public.claim_pending_payment_finalizations(text, int, int) to service_role;
