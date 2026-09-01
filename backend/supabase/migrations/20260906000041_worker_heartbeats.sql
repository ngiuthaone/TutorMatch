-- 20260906000041_worker_heartbeats.sql
-- Heartbeat tracking for background workers (financial-recovery, etc.).
set search_path = '';

create table if not exists public.worker_heartbeats (
  worker_id text primary key,
  last_run_at timestamptz not null default now(),
  last_status text not null default 'ok',
  last_error text
);

alter table public.worker_heartbeats enable row level security;

create policy worker_heartbeats_admin_read on public.worker_heartbeats
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin'
    )
  );

-- Service role bypasses RLS by default and is the only writer; the worker
-- runtime uses the service-role client to upsert heartbeats.
