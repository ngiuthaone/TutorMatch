-- 20260907000010_fix_follow_rpc_grants.sql
-- Follow RPCs are read/mutation helpers that must never be callable by anon.
-- The running DB still grants EXECUTE to anon on the read helpers
-- (is_following, list_followers, list_following); tighten them to authenticated only.
set search_path = '';

revoke all on function public.is_following(text) from public, anon;
grant execute on function public.is_following(text) to authenticated;

revoke all on function public.list_followers(text) from public, anon;
grant execute on function public.list_followers(text) to authenticated;

revoke all on function public.list_following(text) from public, anon;
grant execute on function public.list_following(text) to authenticated;
