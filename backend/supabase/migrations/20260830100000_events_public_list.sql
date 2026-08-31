-- 20260830100000_events_public_list.sql
-- Additive public listing slice for published events (kind='event').
--
-- Adds exactly one RPC:
--   list_public_events() -> jsonb array
--
-- Returns the published-only, kind='event' offerings ordered newest first, as
-- public card payloads (config-spread + slug/title) with identity keys scrubbed
-- (R5). Backs GET /api/v1/events (public browse listing). Publishing an event
-- still creates no sessions/bookings (OS1-OS3).
--
-- Contract additions:
--   L1  only publication_status='published' AND kind='event' rows are listed.
--   L2  each list item is a public card (slug, title, host, topic, type, price,
--       capacity, attending, date, time, location, level, image where present).
--   L3  no auth UUID/email/phone/private-contact keys leak through config.
--   L4  newest published first.
--   OS1-OS3 unchanged: no sessions/bookings/attendance/capacity/payment rows.
set search_path = '';

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
      'config', (coalesce(o.config, '{}'::jsonb)
        - 'creatorId' - 'creatorEmail' - 'hostEmail' - 'hostId' - 'authId' - 'creatorUserId'
        - 'creator_id' - 'creator_email' - 'host_email' - 'host_id' - 'auth_id' - 'creator'
        - 'phone' - 'phoneNumber' - 'contactPhone' - 'hostPhone'
        - 'hostName' - 'hostNameOverride')
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
