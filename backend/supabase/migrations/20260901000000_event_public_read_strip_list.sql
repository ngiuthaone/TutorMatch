-- 20260901000000_event_public_read_strip_list.sql
-- Closes the F1 finding that the by-slug DB strip list leaked keys the service
-- strips. Establishes a single SQL helper (public._event_public_strip_keys)
-- and a JSON-strip helper (public._event_public_strip_config) so the public
-- event read functions cannot drift from the service's STRIPPED_KEYS
-- (event-publication-service.ts: STRIPPED_KEYS).
--
-- Replaces both public.get_public_event_by_slug(text) and public.list_public_events()
-- to apply the canonical strip list (defense-in-depth: identity keys + private
-- contact/host display keys are scrubbed on the public read path even though
-- the service is the primary sanitizer).
--
-- The canonical strip list is the strict superset of:
--   - service STRIPPED_KEYS on write (event-publication-service.ts)
--   - client-trusted identity/owner keys (creatorId, creatorEmail, hostEmail,
--     hostId, authId, creatorUserId, and snake_case equivalents)
--   - private contact keys (phone, phoneNumber, contactPhone, hostPhone)
--   - client-supplied host display overrides (hostName, hostNameOverride)
--
-- Public, server-derived display fields (host, hostRole, hostBio, hostImage,
-- hostExperience, hostRecommendation, creatorName) are intentionally NOT
-- stripped here: they are populated server-side by buildStoredConfig and are
-- the public card's host presentation.
--
-- Contract: docs/agent-team/qa-contracts/pub-events-qa-contract.md
--   R5  public output excludes auth UUIDs/emails/phones; config identity keys scrubbed.
--   L3  no auth UUID/email/phone/private-contact keys leak through config.
set search_path = '';

-- ─────────────────────────────────────────────────────────────────────
-- 1. Canonical strip list (single source of truth for the DB read path).
-- ─────────────────────────────────────────────────────────────────────
create or replace function public._event_public_strip_keys()
returns text[]
language sql
immutable
as $$
  select array[
    -- identity / owner keys (snake/camel + snake_case variants)
    'creatorId', 'creatorEmail', 'hostEmail', 'hostId', 'authId', 'creatorUserId',
    'creator_id', 'creator_email', 'host_email', 'host_id', 'auth_id', 'creator',
    -- private contact keys
    'phone', 'phoneNumber', 'contactPhone', 'hostPhone',
    -- client-supplied host display overrides
    'hostName', 'hostNameOverride'
  ];
$$;

-- JSONB strip helper used by both public read functions so the strip list
-- stays consistent (F1 fix). Returns jsonb with all keys in
-- public._event_public_strip_keys() removed.
create or replace function public._event_public_strip_config(p_config jsonb)
returns jsonb
language sql
immutable
as $$
  with keys as (select public._event_public_strip_keys() as k)
  select coalesce(p_config, '{}'::jsonb)
         - (select k from keys)
         - (select k from keys)  -- double-apply is idempotent for jsonb `-`
         - 'creatorId' - 'creatorEmail' - 'hostEmail' - 'hostId' - 'authId' - 'creatorUserId'
         - 'creator_id' - 'creator_email' - 'host_email' - 'host_id' - 'auth_id' - 'creator'
         - 'phone' - 'phoneNumber' - 'contactPhone' - 'hostPhone'
         - 'hostName' - 'hostNameOverride';
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 2. get_public_event_by_slug
-- ─────────────────────────────────────────────────────────────────────
-- Published-only, kind='event' read by slug (R1/R2/R4). Uses the canonical
-- strip helper so the by-slug read cannot drift from the public listing or
-- the service STRIPPED_KEYS. Returns null (zero rows) when the offering is
-- not published or unknown; the service maps null to 404.
create or replace function public.get_public_event_by_slug(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'id', o.id,
    'slug', o.slug,
    'kind', o.kind,
    'title', o.title,
    'description', o.description,
    'publication_status', o.publication_status,
    'version', o.version,
    'published_at', o.published_at,
    'updated_at', o.updated_at,
    'config', public._event_public_strip_config(o.config)
  )
  into v_result
  from public.offerings o
  where o.kind = 'event'
    and o.slug = p_slug
    and o.publication_status = 'published';

  return v_result;
end $$;

revoke all on function public.get_public_event_by_slug(text) from public, anon, authenticated;
grant execute on function public.get_public_event_by_slug(text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 3. list_public_events
-- ─────────────────────────────────────────────────────────────────────
-- Published-only, kind='event' browse listing (L1-L4). Uses the canonical
-- strip helper so both reads share a single source of truth (F1 fix).
create or replace function public.list_public_events()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_items jsonb := '[]'::jsonb;
begin
  select coalesce(jsonb_agg(t), '[]'::jsonb)
  into v_items
  from (
    select jsonb_build_object(
      'id', o.id,
      'slug', o.slug,
      'kind', o.kind,
      'title', o.title,
      'description', o.description,
      'publication_status', o.publication_status,
      'published_at', o.published_at,
      'config', public._event_public_strip_config(o.config)
    ) as t
    from public.offerings o
    where o.kind = 'event'
      and o.publication_status = 'published'
    order by o.published_at desc nulls last, o.id desc
  ) sub;

  return coalesce(v_items, '[]'::jsonb);
end $$;

revoke all on function public.list_public_events() from public, anon, authenticated;
grant execute on function public.list_public_events() to anon, authenticated;
