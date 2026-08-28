-- Durable outbound provider-operation evidence; not a second payment/refund state machine.
create table if not exists public.payment_provider_operations (
  id uuid primary key default gen_random_uuid(),
  operation_type text not null check (operation_type in ('query','refund')),
  operation_key text not null unique,
  payment_id uuid not null references public.payments(id),
  attempt_id uuid references public.payment_attempts(id),
  refund_id uuid references public.refunds(id),
  merchant_reference text not null,
  status text not null default 'pending' check (status in ('pending','succeeded','failed','ambiguous')),
  provider_request_id text not null,
  request_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(request_payload)='object'),
  response_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((operation_type='query' and attempt_id is not null and refund_id is null) or (operation_type='refund' and refund_id is not null)),
  unique(operation_type, provider_request_id)
);
create index if not exists payment_provider_operations_payment on public.payment_provider_operations(payment_id,created_at desc);
alter table public.payment_provider_operations enable row level security;
revoke all on table public.payment_provider_operations from public,anon,authenticated;
