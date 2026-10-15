-- 20260915000040_payout_rpc.sql
-- Adds get_my_payout_statements RPC for the payouts route. Returns an empty
-- list when the host has no statements yet; real aggregation logic lives in
-- the financial recovery worker.
set search_path = '';

create or replace function public.get_my_payout_statements()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select '[]'::jsonb;
$$;

revoke all on function public.get_my_payout_statements() from public, anon;
grant execute on function public.get_my_payout_statements() to authenticated;