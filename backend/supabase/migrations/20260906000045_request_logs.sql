-- Per-request log table for SLO measurement.
-- Captures the minimum needed: route, status, latency_ms, request_id, user_id.
-- Aggregations happen in cron queries; not indexed for OLTP.
set search_path = '';

create table if not exists public.request_logs (
  id bigserial primary key,
  request_id text not null,
  method text not null,
  route text not null,
  status int not null,
  latency_ms int not null,
  user_id uuid,
  created_at timestamptz not null default now()
);
create index request_logs_route_created_idx on public.request_logs(route, created_at desc);
create index request_logs_created_idx on public.request_logs(created_at desc);

alter table public.request_logs enable row level security;
-- No policies: read is admin-only via service_role; no public access.
