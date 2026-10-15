-- Close direct-table SELECT on posts & reference_threads.
--
-- Community reads are RPC-by-design: anon/authenticated reach content only
-- through SECURITY DEFINER RPCs (list_public_posts, list_reference_threads,
-- get_*), not through direct PostgREST table access. communities and
-- community_members already had their table grants revoked
-- (20260808000000_stub_communities_for_orphan_rls), but posts and
-- reference_threads were created (20260905000020 / 20260907000020) without a
-- corresponding revoke, so they inherited full arwdDxtm from the working-schema
-- default ACL. That let anon/authenticated read rows directly via
-- /rest/v1/posts and /rest/v1/reference_threads (including rows inside private
-- communities that the public RPCs correctly filter).
--
-- Verified no surface reads these tables directly: backend/src and discover/
-- call only the RPCs (SECURITY DEFINER, unaffected by this revoke). This closes
-- the stale direct-read path and makes the RPC encapsulation airtight.

set search_path = '';

do $$ begin
  revoke all on table public.posts from public, anon, authenticated;
exception when others then null; end $$;

do $$ begin
  revoke all on table public.reference_threads from public, anon, authenticated;
exception when others then null; end $$;