-- 20260829100000_events_publication.sql
-- Additive event publication slice (kind='event') building on the shared
-- offerings envelope (20260819120000) + workshop V1 RPC conventions
-- (20260820100001 / 20260820130000).
--
-- Adds exactly two RPCs:
--   1. create_tutoria_event(text, text, jsonb, boolean)  -- author publish/create
--   2. get_public_event_by_slug(text)                    -- published-only public read
--
-- Contract: docs/agent-team/qa-contracts/pub-events-qa-contract.md
--   A3/A4  creator_id = auth.uid() derived at store time via the verified gate.
--   P1/P2  committed offerings row (kind='event'); full discover payload in config.
--   P4/P5  unique(kind, slug) holds; CAS publish transition.
--   R1/R2/R4 reached only when publication_status='published' (else null -> 404).
--   R5/R6  public output excludes auth UUIDs/emails/phones; config identity keys scrubbed.
--   R7     owner offering_hosts row (role 'host') created in the SAME transaction.
--   S1-S3  deterministic slug suffix on collision; returned slug satisfies DB CHECK.
--   V1-V4  Public -> published else draft; status surfaced.
--   H1/H4  creator_id from auth, never from a client field; config identity keys scrubbed.
--   OS1-OS3 no sessions/bookings/attendance/capacity/payment objects are created.
set search_path = '';

-- ─────────────────────────────────────────────────────────────────────
-- 1. create_tutoria_event
-- ─────────────────────────────────────────────────────────────────────
-- Author gate (D1): any verified, email-confirmed caller may publish.
-- Ownership (D5/D3): creator_id = auth.uid(); owner capability is an
-- offering_hosts row (role 'host') created in the SAME transaction so
-- can_manage_offering(uid, id, 'host') succeeds for a fresh event (R7).
-- Slug (D4/S1-S3): client slug is a request, normalized to satisfy the DB
-- CHECK, deterministic `-2`,`-3`,... suffix on (kind,slug) collision, made
-- race-safe by retrying on unique_violation with the unique index as authority.
-- Config is sanitized (defense-in-depth; the route is the primary sanitizer).
create or replace function public.create_tutoria_event(
  p_requested_slug text,
  p_title text,
  p_config jsonb default null,
  p_publish boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_base text;
  v_candidate text;
  v_suffix int := 1;
  v_max_suffix constant int := 999;      -- guarantees -999 <= 4 chars fits <=120
  v_base_max_len constant int := 116;    -- reserve room for a 4-char suffix
  v_offering_id uuid;
  v_config jsonb;
  v_status text := 'draft';
  v_version bigint := 1;
  v_publish boolean := coalesce(p_publish, false);
  v_publish_affected int;
begin
  -- 1) Title guard (offerings.title CHECK requires 1..300 non-blank chars).
  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'INVALID_TRANSITION' using errcode = '22023';
  end if;

  -- 2) Normalize the requested slug (D4/S3). Lowercase, non-alnum -> '-',
  --    collapse/trim '-', cap length. If empty, derive from title the same way.
  v_base := lower(regexp_replace(btrim(coalesce(p_requested_slug, '')), '[^a-z0-9]+', '-', 'g'));
  v_base := regexp_replace(v_base, '^-+|-+$', '', 'g');
  if v_base = '' then
    v_base := lower(regexp_replace(btrim(p_title), '[^a-z0-9]+', '-', 'g'));
    v_base := regexp_replace(v_base, '^-+|-+$', '', 'g');
  end if;
  if char_length(v_base) > v_base_max_len then
    v_base := left(v_base, v_base_max_len);
  end if;
  -- Guard against a title that normalizes to empty.
  if v_base = '' then
    raise exception 'INVALID_SLUG' using errcode = '22023';
  end if;

  -- 3) Sanitize config (defense-in-depth; identity must never be caller-supplied).
  --    Strip owner/identity keys before storing (H1/H4). The route is the
  --    primary sanitizer; this is the DB's last line.
  v_config := coalesce(p_config, '{}'::jsonb);
  if jsonb_typeof(v_config) <> 'object' then
    v_config := '{}'::jsonb;
  end if;
  v_config := v_config
    - 'creatorId' - 'creatorEmail' - 'hostEmail' - 'hostId' - 'authId' - 'creatorUserId'
    - 'creator_id' - 'creator_email' - 'host_email' - 'host_id' - 'auth_id' - 'creator';

  -- 4) Deterministic, race-safe slug resolution. unique(kind,slug) is the
  --    authority: on unique_violation we bump a deterministic suffix and retry.
  v_candidate := v_base;
  loop
    begin
      insert into public.offerings(
        kind, slug, title, creator_id, config, publication_status, version
      ) values (
        'event', v_candidate, btrim(p_title), uid, v_config, 'draft', 1
      )
      returning id into v_offering_id;
      exit;  -- success; subtransaction committed with the new offering
    exception when unique_violation then
      v_suffix := v_suffix + 1;
      if v_suffix > v_max_suffix then
        raise exception 'SLUG_EXHAUSTED' using errcode = '22023';
      end if;
      v_candidate := v_base || '-' || v_suffix::text;
    end;
  end loop;

  -- 5) Owner capability row, SAME transaction (R7). Without this,
  --    can_manage_offering(creator, id, 'host') fails and publish CAS cannot run.
  insert into public.offering_hosts(offering_id, user_id, capability, granted_by)
  values (v_offering_id, uid, 'host', uid);

  -- 6) Publish transition WITHIN the same transaction using a CAS check that
  --    mirrors update_offering_status semantics: compare version, re-check host
  --    capability, set published_at=now(), bump version.
  if v_publish then
    update public.offerings
      set publication_status = 'published',
          published_at = now(),
          version = version + 1
      where id = v_offering_id
        and version = 1
        and public.can_manage_offering(uid, v_offering_id, 'host');
    get diagnostics v_publish_affected = row_count;
    if v_publish_affected = 1 then
      v_status := 'published';
      v_version := 2;
    else
      v_status := 'draft';
      v_version := 1;
    end if;
  end if;

  return jsonb_build_object(
    'id', v_offering_id,
    'slug', v_candidate,
    'publication_status', v_status,
    'version', v_version
  );
end $$;

revoke all on function public.create_tutoria_event(text, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.create_tutoria_event(text, text, jsonb, boolean) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 2. get_public_event_by_slug
-- ─────────────────────────────────────────────────────────────────────
-- Published-only, kind='event' read by slug (R1/R2/R4). Returns non-sensitive
-- columns plus the sanitized public config (R5): identity keys are scrubbed at
-- write time AND re-scrubbed here as defense-in-depth so no auth UUID/email/phone
-- can leak through config. Never returns creator_id, offering_hosts.user_id, or
-- any raw auth id. Returns null (zero rows) when the offering is not published
-- or unknown; the service maps null to 404.
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
    'config', (coalesce(o.config, '{}'::jsonb)
      - 'creatorId' - 'creatorEmail' - 'hostEmail' - 'hostId' - 'authId' - 'creatorUserId'
      - 'creator_id' - 'creator_email' - 'host_email' - 'host_id' - 'auth_id' - 'creator')
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
