-- Payment Provider V1: immutable 1:1 booking pricing, VNPay facts, refunds,
-- approval-for-payment, and service-authoritative finalization.
-- 0001-0007 remain historical and untouched.

alter table public.bookings
  add column if not exists pricing_amount_vnd bigint,
  add column if not exists pricing_currency text,
  add column if not exists pricing_hourly_rate_vnd bigint,
  add column if not exists pricing_duration_minutes integer,
  add column if not exists pricing_model text,
  add column if not exists pricing_snapshotted_at timestamptz;

alter table public.bookings drop constraint if exists bookings_pricing_snapshot_check;
alter table public.bookings add constraint bookings_pricing_snapshot_check check (
  (pricing_amount_vnd is null and pricing_currency is null and pricing_hourly_rate_vnd is null
   and pricing_duration_minutes is null and pricing_model is null and pricing_snapshotted_at is null)
  or (pricing_amount_vnd > 0 and pricing_currency = 'VND' and pricing_hourly_rate_vnd between 50000 and 10000000
   and pricing_duration_minutes > 0 and pricing_model = 'hourly_v1' and pricing_snapshotted_at is not null)
);

create table if not exists public.booking_approvals (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  approved_by uuid not null references public.profiles(id),
  approved_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at is null or expires_at > approved_at),
  check (revoked_at is null or revoked_at >= approved_at)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id),
  provider text not null default 'vnpay' check (provider = 'vnpay'),
  status text not null default 'pending' check (status in ('pending','succeeded','failed','refunded')),
  amount_vnd bigint not null check (amount_vnd > 0),
  currency text not null default 'VND' check (currency = 'VND'),
  refunded_amount_vnd bigint not null default 0 check (refunded_amount_vnd >= 0 and refunded_amount_vnd <= amount_vnd),
  version bigint not null default 1 check (version > 0),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  idempotency_key text not null,
  merchant_reference text not null unique,
  status text not null default 'created' check (status in ('created','redirected','pending','succeeded','failed','ambiguous')),
  provider_transaction_no text,
  amount_vnd bigint not null check (amount_vnd > 0),
  currency text not null check (currency = 'VND'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(payment_id, idempotency_key)
);
create index if not exists payment_attempts_payment on public.payment_attempts(payment_id, created_at desc);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  attempt_id uuid references public.payment_attempts(id),
  event_type text not null check (event_type in ('payment_created','attempt_created','provider_pending','provider_succeeded','provider_failed','finalization_failed','refund_obligation_created','refund_succeeded','refund_failed','refund_ambiguous')),
  from_status text,
  to_status text,
  amount_vnd bigint check (amount_vnd is null or amount_vnd > 0),
  provider_transaction_no text,
  provider_event_key text,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  occurred_at timestamptz not null default now()
);
create index if not exists payment_events_payment on public.payment_events(payment_id, occurred_at, id);

create table if not exists public.payment_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider = 'vnpay'),
  provider_event_key text not null,
  payment_id uuid references public.payments(id),
  attempt_id uuid references public.payment_attempts(id),
  outcome text not null check (outcome in ('pending','succeeded','failed','refund_pending','refund_succeeded','refund_failed')),
  provider_transaction_no text,
  amount_vnd bigint check (amount_vnd is null or amount_vnd > 0),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  observed_at timestamptz not null default now(),
  unique(provider, provider_event_key)
);
create index if not exists payment_provider_events_attempt on public.payment_provider_events(attempt_id, observed_at desc);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  kind text not null check (kind in ('system_compensation','support')),
  status text not null default 'obligation' check (status in ('obligation','pending','succeeded','failed','ambiguous')),
  amount_vnd bigint not null check (amount_vnd > 0),
  idempotency_key text not null,
  provider_request_id text,
  provider_transaction_no text,
  reason text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(payment_id, idempotency_key)
);
create index if not exists refunds_payment on public.refunds(payment_id, created_at);

alter table public.event_outbox drop constraint if exists event_outbox_event_type_check;
alter table public.event_outbox add constraint event_outbox_event_type_check check (event_type in (
  'BOOKING_REQUESTED','BOOKING_CONFIRMED','BOOKING_REJECTED','BOOKING_CANCELLED','BOOKING_COMPLETED','BOOKING_RESCHEDULED',
  'RESCHEDULE_REQUESTED','RESCHEDULE_REJECTED','RESCHEDULE_CANCELLED','ATTENDANCE_REPORTED','SESSION_RESCHEDULED','SESSION_CANCELLED',
  'PAYMENT_ATTEMPTED','PAYMENT_SUCCEEDED','PAYMENT_FAILED','PAYMENT_RETRIED','REFUND_ISSUED',
  'BOOKING_APPROVED_FOR_PAYMENT','PAYMENT_CREATED','PAYMENT_PROVIDER_OBSERVED','BOOKING_FINALIZATION_FAILED','REFUND_OBLIGATION_CREATED'));
alter table public.event_outbox drop constraint if exists event_outbox_aggregate_type_check;
alter table public.event_outbox add constraint event_outbox_aggregate_type_check check (aggregate_type in ('booking','session','payment'));

-- Replace creation only to add the pricing snapshot. The lock order and all
-- existing capacity/uniqueness rules remain unchanged.
create or replace function public.create_booking(session_id uuid, participant_count int default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid := public.assert_attendee_caller(); s public.sessions%rowtype; bid uuid := gen_random_uuid(); reserved bigint;
  rate bigint; duration_minutes integer; amount bigint;
begin
  if participant_count is null or participant_count < 1 then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
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
  if s.max_participants is not null and reserved + participant_count > s.max_participants then raise exception 'INSUFFICIENT_CAPACITY' using errcode='22023'; end if;
  begin
    insert into public.bookings(id, session_id, learner_id, participant_count, status, pricing_amount_vnd, pricing_currency, pricing_hourly_rate_vnd, pricing_duration_minutes, pricing_model, pricing_snapshotted_at)
    values (bid, session_id, uid, participant_count, 'requested', amount, 'VND', rate, duration_minutes, 'hourly_v1', now());
  exception when unique_violation then raise exception 'BOOKING_CONFLICT' using errcode='23505'; end;
  insert into public.booking_history(booking_id, from_status, to_status, actor, at) values (bid, null, 'requested', 'attendee', now());
  perform public.insert_outbox_event('BOOKING_REQUESTED', 'booking', bid, 1, jsonb_build_object('bookingId', bid, 'sessionId', session_id, 'participantCount', participant_count, 'amountVnd', amount, 'currency', 'VND'));
  return public.booking_json(bid);
end $$;

create or replace function public.approve_booking_for_payment(p_booking_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid := public.assert_attendee_caller(); b public.bookings%rowtype; s public.sessions%rowtype; a public.booking_approvals%rowtype;
begin
  select session_id into b.session_id from public.bookings where id=p_booking_id;
  if b.session_id is null then raise insufficient_privilege; end if;
  select * into s from public.sessions where id=b.session_id for update;
  if s.host_id <> uid then raise insufficient_privilege; end if;
  select * into b from public.bookings where id=p_booking_id for update;
  if b.status <> 'requested' then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  insert into public.booking_approvals(booking_id, approved_by) values (b.id, uid)
    on conflict (booking_id) do update set approved_by=excluded.approved_by, approved_at=now(), revoked_at=null
    returning * into a;
  perform public.insert_outbox_event('BOOKING_APPROVED_FOR_PAYMENT','booking',b.id,b.version,jsonb_build_object('bookingId',b.id,'sessionId',b.session_id));
  return jsonb_build_object('bookingId',b.id,'approvedAt',a.approved_at,'expiresAt',a.expires_at);
end $$;

create or replace function public.start_payment_attempt(p_booking_id uuid, p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid := public.assert_attendee_caller(); b public.bookings%rowtype; s public.sessions%rowtype; p public.payments%rowtype; a public.payment_attempts%rowtype; key text:=btrim(p_idempotency_key);
begin
  if key is null or char_length(key) not between 16 and 128 then raise exception 'INVALID_IDEMPOTENCY_KEY' using errcode='22023'; end if;
  select * into b from public.bookings where id=p_booking_id and learner_id=uid for update;
  if b.id is null then raise insufficient_privilege; end if;
  if b.status <> 'requested' then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  if b.pricing_amount_vnd is null then raise exception 'BOOKING_PRICE_NOT_SNAPSHOTTED' using errcode='22023'; end if;
  if not exists(select 1 from public.booking_approvals where booking_id=b.id and revoked_at is null and (expires_at is null or expires_at>now())) then raise exception 'BOOKING_NOT_APPROVED_FOR_PAYMENT' using errcode='22023'; end if;
  insert into public.payments(booking_id,amount_vnd,currency) values (b.id,b.pricing_amount_vnd,b.pricing_currency) on conflict (booking_id) do nothing;
  select * into p from public.payments where booking_id=b.id for update;
  if p.status in ('succeeded','refunded') then raise exception 'PAYMENT_NOT_RETRYABLE' using errcode='22023'; end if;
  select * into a from public.payment_attempts where payment_id=p.id and idempotency_key=key;
  if a.id is null then
    insert into public.payment_attempts(payment_id,idempotency_key,merchant_reference,status,amount_vnd,currency)
    values(p.id,key,'TUTORIA-'||replace(p.id::text,'-','')||'-'||replace(gen_random_uuid()::text,'-',''),'created',p.amount_vnd,p.currency) returning * into a;
    insert into public.payment_events(payment_id,attempt_id,event_type,from_status,to_status,amount_vnd,payload) values(p.id,a.id,'attempt_created',p.status,p.status,p.amount_vnd,'{}');
    perform public.insert_outbox_event('PAYMENT_ATTEMPTED','payment',p.id,p.version,jsonb_build_object('paymentId',p.id,'attemptId',a.id,'bookingId',b.id,'amountVnd',p.amount_vnd,'currency',p.currency));
  end if;
  return jsonb_build_object('paymentId',p.id,'attemptId',a.id,'merchantReference',a.merchant_reference,'amountVnd',p.amount_vnd,'currency',p.currency,'status',p.status);
end $$;

create or replace function public.get_booking_payment(p_booking_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
select jsonb_build_object('id',p.id,'bookingId',p.booking_id,'provider',p.provider,'status',p.status,'amountVnd',p.amount_vnd,'currency',p.currency,'refundedAmountVnd',p.refunded_amount_vnd,'version',p.version,'paidAt',p.paid_at)
from public.payments p join public.bookings b on b.id=p.booking_id join public.sessions s on s.id=b.session_id
where p.booking_id=p_booking_id and (b.learner_id=auth.uid() or s.host_id=auth.uid()) $$;

create or replace function public.record_vnpay_observation(p_provider_event_key text, p_merchant_reference text, p_outcome text, p_provider_transaction_no text default null, p_amount_vnd bigint default null, p_payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.payment_provider_events%rowtype; a public.payment_attempts%rowtype; p public.payments%rowtype; next_status text; from_status text;
begin
  if p_provider_event_key is null or char_length(p_provider_event_key) < 8 or p_outcome not in ('pending','succeeded','failed') then raise exception 'INVALID_PROVIDER_EVENT' using errcode='22023'; end if;
  select * into a from public.payment_attempts where merchant_reference=p_merchant_reference;
  if a.id is null then raise exception 'UNKNOWN_PROVIDER_REFERENCE' using errcode='22023'; end if;
  insert into public.payment_provider_events(provider,provider_event_key,attempt_id,outcome,provider_transaction_no,amount_vnd,payload) values('vnpay',p_provider_event_key,a.id,p_outcome,p_provider_transaction_no,p_amount_vnd,coalesce(p_payload,'{}')) on conflict(provider,provider_event_key) do nothing returning * into e;
  if e.id is null then return jsonb_build_object('duplicate',true); end if;
  select * into a from public.payment_attempts where id=a.id for update;
  select * into p from public.payments where id=a.payment_id for update; from_status:=p.status;
  next_status:=case when p_outcome='succeeded' then 'succeeded' when p_outcome='failed' and p.status='pending' then 'failed' else p.status end;
  if p_outcome='succeeded' and (p_amount_vnd is null or p_amount_vnd<>p.amount_vnd) then raise exception 'PROVIDER_AMOUNT_MISMATCH' using errcode='22023'; end if;
  update public.payment_attempts set status=case when p_outcome='succeeded' then 'succeeded' when p_outcome='failed' then 'failed' else 'pending' end,provider_transaction_no=coalesce(p_provider_transaction_no,provider_transaction_no),updated_at=now() where id=a.id;
  if next_status<>p.status then update public.payments set status=next_status,paid_at=case when next_status='succeeded' then now() else paid_at end,version=version+1,updated_at=now() where id=p.id; end if;
  insert into public.payment_events(payment_id,attempt_id,event_type,from_status,to_status,amount_vnd,provider_transaction_no,provider_event_key,payload) values(p.id,a.id,case when p_outcome='succeeded' then 'provider_succeeded' when p_outcome='failed' then 'provider_failed' else 'provider_pending' end,from_status,next_status,p.amount_vnd,p_provider_transaction_no,p_provider_event_key,coalesce(p_payload,'{}'));
  if p_outcome='succeeded' then perform public.insert_outbox_event('PAYMENT_SUCCEEDED','payment',p.id,p.version,jsonb_build_object('paymentId',p.id,'attemptId',a.id,'bookingId',p.booking_id)); end if;
  return jsonb_build_object('duplicate',false,'paymentId',p.id,'status',next_status,'bookingId',p.booking_id);
end $$;

create or replace function public.finalize_paid_booking(p_booking_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype; s public.sessions%rowtype; p public.payments%rowtype; r public.refunds%rowtype;
begin
  select session_id into b.session_id from public.bookings where id=p_booking_id;
  if b.session_id is null then raise exception 'BOOKING_FINALIZATION_FAILED' using errcode='22023'; end if;
  select * into s from public.sessions where id=b.session_id for update;
  select * into b from public.bookings where id=p_booking_id for update;
  select * into p from public.payments where booking_id=b.id for update;
  if p.status <> 'succeeded' or b.status <> 'requested' or s.status <> 'scheduled' then
    if p.status='succeeded' and not exists(select 1 from public.refunds where payment_id=p.id and kind='system_compensation') then
      insert into public.refunds(payment_id,kind,amount_vnd,idempotency_key,reason) values(p.id,'system_compensation',p.amount_vnd,'compensation:'||p.id::text,'paid booking could not be finalized') returning * into r;
      insert into public.payment_events(payment_id,event_type,from_status,to_status,amount_vnd,payload) values(p.id,'finalization_failed',p.status,p.status,p.amount_vnd,jsonb_build_object('bookingId',b.id));
      perform public.insert_outbox_event('BOOKING_FINALIZATION_FAILED','booking',b.id,b.version,jsonb_build_object('bookingId',b.id,'paymentId',p.id));
      perform public.insert_outbox_event('REFUND_OBLIGATION_CREATED','payment',p.id,p.version,jsonb_build_object('paymentId',p.id,'refundId',r.id,'amountVnd',r.amount_vnd));
    end if;
    return jsonb_build_object('finalized',false,'bookingId',b.id,'paymentId',p.id);
  end if;
  update public.bookings set status='confirmed',version=version+1 where id=b.id;
  insert into public.booking_history(booking_id,from_status,to_status,actor,at) values(b.id,'requested','confirmed','host',now());
  perform public.insert_outbox_event('BOOKING_CONFIRMED','booking',b.id,b.version+1,jsonb_build_object('bookingId',b.id,'sessionId',b.session_id,'fromStatus','requested','paymentId',p.id));
  return jsonb_build_object('finalized',true,'bookingId',b.id,'paymentId',p.id);
end $$;

create or replace function public.record_vnpay_refund_result(p_refund_id uuid, p_outcome text, p_provider_request_id text, p_provider_transaction_no text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.refunds%rowtype; p public.payments%rowtype; new_total bigint;
begin
  if p_outcome not in ('succeeded','failed','ambiguous') or p_provider_request_id is null then raise exception 'INVALID_REFUND_RESULT' using errcode='22023'; end if;
  select * into r from public.refunds where id=p_refund_id for update; if r.id is null then raise exception 'UNKNOWN_REFUND' using errcode='22023'; end if;
  select * into p from public.payments where id=r.payment_id for update; if p.status not in ('succeeded','refunded') then raise exception 'PAYMENT_NOT_REFUNDABLE' using errcode='22023'; end if;
  if r.status='succeeded' then return jsonb_build_object('duplicate',true,'refundId',r.id,'status',r.status); end if;
  if p_outcome='succeeded' then
    if r.amount_vnd > p.amount_vnd-p.refunded_amount_vnd then raise exception 'REFUND_EXCEEDS_REMAINING' using errcode='22023'; end if;
    new_total:=p.refunded_amount_vnd+r.amount_vnd;
    update public.refunds set status='succeeded',provider_request_id=p_provider_request_id,provider_transaction_no=p_provider_transaction_no,updated_at=now() where id=r.id;
    update public.payments set refunded_amount_vnd=new_total,status=case when new_total=amount_vnd then 'refunded' else status end,version=version+1,updated_at=now() where id=p.id;
    insert into public.payment_events(payment_id,event_type,amount_vnd,payload) values(p.id,'refund_succeeded',r.amount_vnd,jsonb_build_object('refundId',r.id,'providerRequestId',p_provider_request_id));
    perform public.insert_outbox_event('REFUND_ISSUED','payment',p.id,p.version+1,jsonb_build_object('paymentId',p.id,'refundId',r.id,'amountVnd',r.amount_vnd));
  else
    update public.refunds set status=p_outcome,provider_request_id=p_provider_request_id,provider_transaction_no=p_provider_transaction_no,updated_at=now() where id=r.id;
    insert into public.payment_events(payment_id,event_type,amount_vnd,payload) values(p.id,case when p_outcome='failed' then 'refund_failed' else 'refund_ambiguous' end,r.amount_vnd,jsonb_build_object('refundId',r.id,'providerRequestId',p_provider_request_id));
  end if;
  return jsonb_build_object('duplicate',false,'refundId',r.id,'status',p_outcome);
end $$;

do $$ declare t text; begin foreach t in array array['booking_approvals','payments','payment_attempts','payment_events','payment_provider_events','refunds'] loop execute format('alter table public.%I enable row level security',t); execute format('revoke all on table public.%I from public,anon,authenticated',t); end loop; end $$;
revoke all on function public.approve_booking_for_payment(uuid),public.start_payment_attempt(uuid,text),public.get_booking_payment(uuid),public.record_vnpay_observation(text,text,text,text,bigint,jsonb),public.finalize_paid_booking(uuid),public.record_vnpay_refund_result(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.approve_booking_for_payment(uuid),public.start_payment_attempt(uuid,text),public.get_booking_payment(uuid) to authenticated;
grant execute on function public.record_vnpay_observation(text,text,text,text,bigint,jsonb),public.finalize_paid_booking(uuid),public.record_vnpay_refund_result(uuid,text,text,text) to service_role;
