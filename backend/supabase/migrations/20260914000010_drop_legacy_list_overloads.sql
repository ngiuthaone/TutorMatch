-- Drop legacy list RPC overloads that bypass community-visibility filtering.
--
-- public.list_public_posts and public.list_reference_threads each exist in two
-- overloads: the original 5-arg form (no p_community_id) and the 6-arg form
-- (with p_community_id) that enforces private-community visibility. The 5-arg
-- legacy overloads lack the visibility filter, so any caller resolving them
-- bypasses private-community isolation (stale-security path).
--
-- Verified callers: backend/src/services/post-service.ts (listPublic always
-- passes p_community_id) and thread-service.ts (listPublic always passes
-- p_community_id). The frontend discover/ app does not call these RPCs directly.
-- Safe to drop the legacy overloads.

set search_path = '';

drop function if exists public.list_public_posts(
  p_cursor text,
  p_limit integer,
  p_tag text,
  p_post_type text,
  p_author_name text
);

drop function if exists public.list_reference_threads(
  p_cursor text,
  p_limit integer,
  p_tag text,
  p_level text,
  p_anchor_type text
);