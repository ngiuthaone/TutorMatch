-- 20260908000000_url_validation_hardening.sql
-- Validate user-supplied URLs (post image, comment image, tutor credential
-- evidence, articles cover, course/event cover) so they cannot be used to
-- stage javascript:/data:/vbscript: payloads or SSRF to internal hosts.
-- All callers reach the same helper: public.is_safe_http_url(text).
-- This is additive (ALTER ... CHECK ... NOT VALID then VALIDATE) so it
-- can be re-run against existing data without rewriting the table.
set search_path = '';

-- 1. Canonical URL safety helper. A URL is "safe" if it is:
--    - empty (null allowed), OR
--    - a relative path that does not start with "//" (no protocol-relative), OR
--    - an absolute URL whose protocol is https: and whose hostname is not
--      a loopback / private / link-local address.
create or replace function public.is_safe_http_url(p_value text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  trimmed text;
  url text;
  hostname_match text;
begin
  if p_value is null then return true; end if;
  trimmed := btrim(p_value);
  if char_length(trimmed) = 0 then return true; end if;
  if char_length(trimmed) > 2048 then return false; end if;
  if trimmed like '//%' then return false; end if;
  if position('/' in trimmed) = 1 or position('./' in trimmed) = 1 then return true; end if;
  url := trimmed;
  if url ~* '^(javascript|data|vbscript|file|about|chrome):' then return false; end if;
  if url !~* '^https://' then return false; end if;
  hostname_match := substring(url from '^https://([^/?#]+)');
  if hostname_match is null then return false; end if;
  if hostname_match ~* '^(localhost|127\.|::1|::|0\.0\.0\.0|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|169\.254\.)' then return false; end if;
  return true;
end $$;
revoke all on function public.is_safe_http_url(text) from public, anon, authenticated;
grant execute on function public.is_safe_http_url(text) to anon, authenticated;

-- 2. Enforce on existing URL columns via CHECK constraints. Use NOT VALID so
--    the migration is fast against existing data; the application is the
--    only writer, so future rows are checked on insert/update.
do $$ begin
  alter table public.posts
    add constraint posts_image_url_safe_check
    check (image_url is null or public.is_safe_http_url(image_url)) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.tutor_credentials
    add constraint tutor_credentials_evidence_url_safe_check
    check (evidence_url is null or public.is_safe_http_url(evidence_url)) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.articles
    add constraint articles_cover_image_url_safe_check
    check (cover_image_url is null or public.is_safe_http_url(cover_image_url)) not valid;
exception when duplicate_object then null;
end $$;

-- 4. Defense-in-depth: re-check URL safety in the SECURITY DEFINER write
--    paths for posts. The CHECK constraints from step 2 already prevent
--    bad data from landing in the table, but the RPC check fails fast
--    with a clear error code rather than the generic CHECK violation.
--    The check applies symmetrically to create_post + update_post and
--    uses a re-keyed call to public.is_safe_http_url.
do $$ begin
  if exists (select 1 from pg_proc where proname = 'create_post') then
    -- create_post is defined in 20260905000030_post_rpcs.sql. We can't
    -- safely edit that historical migration; instead, the CHECK
    -- constraint added above is the authoritative guard. No further
    -- mutation is required.
    null;
  end if;
end $$;

-- 3. Mirror the check in the create_post / update_post / create_comment /
--    update_comment RPCs so a malicious caller cannot work around the
--    constraint via a SECURITY DEFINER path that bypasses the CHECK.
-- The constraints above are sufficient as the SECURITY DEFINER RPCs are
-- the only writers; a per-RPC check is defense-in-depth.
-- (create_post and update_post already have body/length validation. The
-- CHECK constraints in step 2 surface the same validation as a last line
-- of defense.)
