-- 20260915000050_payout_failure_logs_updated_at.sql
--
-- payout_failure_logs was created (20260912000000 reclaimer) without an
-- updated_at column, but retry_payout_failure() and resolve_payout_failure()
-- both execute `updated_at = now()`. CREATE OR REPLACE FUNCTION does not
-- validate column references at creation time, so the migration applied
-- cleanly while those two RPCs fail at runtime when a host retries or
-- resolves a payout failure from the Host Center.
--
-- Additive, idempotent: safe to run against fresh and production databases.
set search_path = '';

alter table public.payout_failure_logs
  add column if not exists updated_at timestamptz not null default now();
