-- Tutoria Host Center: dashboard, offerings, sessions, attendees, earnings RPCs.
-- All read paths are scoped via can_manage_offering() so workshop/event organizers
-- (who may not have a tutor_profiles row) can still see Center data.
-- Every function is SECURITY DEFINER, stable, and grants only to `authenticated`.
-- Built atop 20260819120000_shared_booking_engine.sql (offerings/offering_hosts)
-- and 0008_payment_provider_v1.sql (payments/refunds).
set search_path = '';

-- ─────────────────────────────────────────────────────────────────────
-- 1. get_host_dashboard(p_user_id)
-- Returns a single jsonb document with KPIs the Center Overview tile shows.
-- If the caller manages zero offerings, returns { isHost: false } so the
-- frontend can render the "create your first offering" empty state without
-- inventing fake numbers.
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.get_host_dashboard(p_user_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_is_admin boolean;
  v_tutor_id uuid;
  v_today_start timestamptz := date_trunc('day', now());
  v_today_end timestamptz := v_today_start + interval '1 day';
  v_month_start timestamptz := date_trunc('month', now());
  v_month_end timestamptz := v_month_start + interval '1 month';
  v_managed_offering_count int;
  v_result jsonb;
begin
  if p_user_id is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin')
    into v_is_admin;
  if auth.uid() <> p_user_id and not v_is_admin then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select count(*)::int into v_managed_offering_count
    from public.offering_hosts
    where user_id = p_user_id and revoked_at is null;
  if v_managed_offering_count = 0 and not v_is_admin then
    return jsonb_build_object('isHost', false, 'managedOfferingCount', 0);
  end if;

  select id into v_tutor_id from public.tutor_profiles where user_id = p_user_id;

  select jsonb_build_object(
    'isHost', true,
    'managedOfferingCount', v_managed_offering_count,
    'tutorProfile', case when v_tutor_id is not null then (
        select jsonb_build_object(
          'id', tp.id,
          'displayName', tp.display_name,
          'headline', tp.headline,
          'publicationStatus', tp.publication_status,
          'verificationStatus', tp.verification_status,
          'hourlyRateVnd', tp.hourly_rate_vnd,
          'avatarObjectPath', tp.avatar_object_path
        )
        from public.tutor_profiles tp where tp.id = v_tutor_id
      ) else null end,
    'todayCount', (
      select count(*)::int from public.sessions s
        join public.offerings o on o.id = s.offering_id
        where public.can_manage_offering(p_user_id, o.id, 'host')
          and s.starts_at >= v_today_start and s.starts_at < v_today_end
          and s.status = 'scheduled'
    ),
    'upcomingCount', (
      select count(*)::int from public.sessions s
        join public.offerings o on o.id = s.offering_id
        where public.can_manage_offering(p_user_id, o.id, 'host')
          and s.starts_at >= v_today_end
          and s.status = 'scheduled'
    ),
    'pendingBookingsCount', (
      select count(*)::int from public.bookings b
        join public.sessions s on s.id = b.session_id
        join public.offerings o on o.id = s.offering_id
        where public.can_manage_offering(p_user_id, o.id, 'host')
          and b.status = 'requested'
    ),
    'monthCompletedCount', (
      select count(*)::int from public.bookings b
        join public.sessions s on s.id = b.session_id
        join public.offerings o on o.id = s.offering_id
        where public.can_manage_offering(p_user_id, o.id, 'host')
          and b.status = 'completed'
          and b.updated_at >= v_month_start and b.updated_at < v_month_end
    ),
    'monthEarningsVnd', coalesce((
      select sum((p.amount_vnd - p.refunded_amount_vnd))::bigint
        from public.payments p
        join public.bookings b on b.id = p.booking_id
        join public.sessions s on s.id = b.session_id
        join public.offerings o on o.id = s.offering_id
        where public.can_manage_offering(p_user_id, o.id, 'host')
          and p.status = 'succeeded'
          and p.paid_at >= v_month_start and p.paid_at < v_month_end
    ), 0),
    'rating', case when v_tutor_id is not null
      then public.get_tutor_rating_summary(v_tutor_id)
      else jsonb_build_object('count', 0, 'average', null) end
  ) into v_result;

  return v_result;
end $$;

revoke all on function public.get_host_dashboard(uuid) from public, anon, authenticated;
grant execute on function public.get_host_dashboard(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 2. list_host_offerings(p_user_id, p_status, p_kind, p_limit, p_offset)
-- Returns the host's offerings with aggregate counts. p_status/p_kind are
-- optional text filters; pass NULL to disable.
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.list_host_offerings(
  p_user_id uuid,
  p_status text default null,
  p_kind text default null,
  p_limit int default 100,
  p_offset int default 0
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_is_admin boolean;
  v_limit int := greatest(coalesce(p_limit, 100), 1);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  if p_user_id is null then raise exception 'UNAUTHORIZED' using errcode = '42501'; end if;
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin')
    into v_is_admin;
  if auth.uid() <> p_user_id and not v_is_admin then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_limit > 200 then v_limit := 200; end if;
  if p_status is not null and p_status not in ('draft','published','unpublished') then
    raise exception 'INVALID_STATUS' using errcode = '22023';
  end if;
  if p_kind is not null and p_kind not in ('tutor','workshop','class','event') then
    raise exception 'INVALID_KIND' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(row_to_json(t) order by t.updated_at desc), '[]'::jsonb)
    into v_result
    from (
      select
        o.id,
        o.kind,
        o.slug,
        o.title,
        o.publication_status as "publicationStatus",
        o.unit_price_vnd as "unitPriceVnd",
        o.currency,
        o.created_at as "createdAt",
        o.updated_at as "updatedAt",
        coalesce(sc.session_count, 0) as "sessionCount",
        coalesce(bc.booking_count, 0) as "bookingCount",
        ls.last_session_at as "lastSessionAt"
      from public.offerings o
      join public.offering_hosts oh
        on oh.offering_id = o.id and oh.user_id = p_user_id and oh.revoked_at is null
      left join lateral (
        select count(*) as session_count
          from public.sessions s where s.offering_id = o.id
      ) sc on true
      left join lateral (
        select count(*) as booking_count
          from public.bookings b
          join public.sessions s on s.id = b.session_id
          where s.offering_id = o.id and b.status in ('requested','confirmed','completed')
      ) bc on true
      left join lateral (
        select max(s.starts_at) as last_session_at
          from public.sessions s where s.offering_id = o.id
      ) ls on true
      where (p_status is null or o.publication_status = p_status)
        and (p_kind is null or o.kind = p_kind)
      order by o.updated_at desc
      limit v_limit offset v_offset
    ) t;

  return v_result;
end $$;

revoke all on function public.list_host_offerings(uuid,text,text,int,int) from public, anon, authenticated;
grant execute on function public.list_host_offerings(uuid,text,text,int,int) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 3. get_host_offering(p_user_id, p_offering_id)
-- Single offering detail (used by the Listing drawer).
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.get_host_offering(
  p_user_id uuid,
  p_offering_id uuid
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_row jsonb;
begin
  if p_user_id is null or p_offering_id is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;
  if not public.can_manage_offering(p_user_id, p_offering_id, 'host') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'id', o.id,
    'kind', o.kind,
    'slug', o.slug,
    'title', o.title,
    'description', o.description,
    'publicationStatus', o.publication_status,
    'unitPriceVnd', o.unit_price_vnd,
    'currency', o.currency,
    'config', o.config,
    'createdAt', o.created_at,
    'updatedAt', o.updated_at,
    'sessionCount', (select count(*)::int from public.sessions s where s.offering_id = o.id),
    'bookingCount', (
      select count(*)::int from public.bookings b
        join public.sessions s on s.id = b.session_id
        where s.offering_id = o.id and b.status in ('requested','confirmed','completed')
    ),
    'capability', (
      select oh.capability from public.offering_hosts oh
        where oh.offering_id = o.id and oh.user_id = p_user_id and oh.revoked_at is null
        limit 1
    )
  ) into v_row from public.offerings o where o.id = p_offering_id;
  if v_row is null then raise exception 'NOT_FOUND' using errcode = '22023'; end if;
  return v_row;
end $$;

revoke all on function public.get_host_offering(uuid,uuid) from public, anon, authenticated;
grant execute on function public.get_host_offering(uuid,uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 4. list_host_sessions(p_user_id, p_from, p_to, p_offering_id, p_status)
-- Calendar source. p_from/p_to default to +/- 30 days from now.
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.list_host_sessions(
  p_user_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_offering_id uuid default null,
  p_status text default null,
  p_limit int default 200,
  p_offset int default 0
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_from timestamptz := coalesce(p_from, now() - interval '30 days');
  v_to timestamptz := coalesce(p_to, now() + interval '60 days');
  v_limit int := greatest(coalesce(p_limit, 200), 1);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  if p_user_id is null then raise exception 'UNAUTHORIZED' using errcode = '42501'; end if;
  if auth.uid() <> p_user_id
    and not exists(select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_limit > 500 then v_limit := 500; end if;
  if p_status is not null and p_status not in ('scheduled','cancelled','completed') then
    raise exception 'INVALID_STATUS' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(row_to_json(t) order by t.starts_at asc), '[]'::jsonb)
    into v_result
    from (
      select
        s.id,
        s.offering_id as "offeringId",
        o.title as "offeringTitle",
        o.kind as "offeringKind",
        s.starts_at as "startsAt",
        s.ends_at as "endsAt",
        s.status,
        s.min_participants as "minParticipants",
        s.max_participants as "maxParticipants",
        coalesce(bc.booked_count, 0) as "bookedCount",
        greatest(coalesce(s.max_participants, 0) - coalesce(bc.booked_count, 0), 0) as "remainingCapacity",
        s.version
      from public.sessions s
      join public.offerings o on o.id = s.offering_id
      left join lateral (
        select count(*) as booked_count
          from public.bookings b
          where b.session_id = s.id and b.status in ('requested','confirmed','completed')
      ) bc on true
      where public.can_manage_offering(p_user_id, o.id, 'host')
        and s.starts_at >= v_from and s.starts_at < v_to
        and (p_offering_id is null or s.offering_id = p_offering_id)
        and (p_status is null or s.status = p_status)
      order by s.starts_at asc
      limit v_limit offset v_offset
    ) t;

  return v_result;
end $$;

revoke all on function public.list_host_sessions(uuid,timestamptz,timestamptz,uuid,text,int,int) from public, anon, authenticated;
grant execute on function public.list_host_sessions(uuid,timestamptz,timestamptz,uuid,text,int,int) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 5. list_host_attendees(p_user_id, p_query, p_offering_id, p_limit, p_offset)
-- Distinct learners from confirmed/completed bookings. Search matches display_name
-- or full_name case-insensitively (ILIKE) and is bounded.
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.list_host_attendees(
  p_user_id uuid,
  p_query text default null,
  p_offering_id uuid default null,
  p_limit int default 100,
  p_offset int default 0
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_limit int := greatest(coalesce(p_limit, 100), 1);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_q text;
  v_result jsonb;
begin
  if p_user_id is null then raise exception 'UNAUTHORIZED' using errcode = '42501'; end if;
  if auth.uid() <> p_user_id
    and not exists(select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_limit > 200 then v_limit := 200; end if;
  v_q := case when p_query is null or length(trim(p_query)) = 0 then null
              else '%' || trim(p_query) || '%' end;

  with managed as (
    select distinct b.learner_id
      from public.bookings b
      join public.sessions s on s.id = b.session_id
      join public.offerings o on o.id = s.offering_id
      where public.can_manage_offering(p_user_id, o.id, 'host')
        and (p_offering_id is null or o.id = p_offering_id)
        and b.status in ('requested','confirmed','completed')
  )
  select coalesce(jsonb_agg(row_to_json(t) order by t.last_booking_at desc), '[]'::jsonb)
    into v_result
    from (
      select
        p.id as "learnerId",
        p.name as "displayName",
        p.avatar_url as "avatarObjectPath",
        coalesce(c.bookings_count, 0) as "bookingsCount",
        coalesce(c.completed_count, 0) as "completedCount",
        coalesce(c.upcoming_count, 0) as "upcomingCount",
        coalesce(c.ltv_vnd, 0) as "ltvVnd",
        c.last_booking_at as "lastBookingAt"
      from managed m
      join public.profiles p on p.id = m.learner_id
      left join lateral (
        select
          count(*) as bookings_count,
          count(*) filter (where b.status = 'completed') as completed_count,
          count(*) filter (where b.status in ('requested','confirmed') and s.starts_at > now()) as upcoming_count,
          max(b.created_at) as last_booking_at,
          sum(coalesce(pay.amount_vnd - pay.refunded_amount_vnd, 0)) as ltv_vnd
        from public.bookings b
        join public.sessions s on s.id = b.session_id
        left join public.payments pay on pay.booking_id = b.id and pay.status = 'succeeded'
        where b.learner_id = m.learner_id
          and public.can_manage_offering(p_user_id, s.offering_id, 'host')
      ) c on true
      where v_q is null
         or p.name ilike v_q
      order by c.last_booking_at desc nulls last
      limit v_limit offset v_offset
    ) t;

  return v_result;
end $$;

revoke all on function public.list_host_attendees(uuid,text,uuid,int,int) from public, anon, authenticated;
grant execute on function public.list_host_attendees(uuid,text,uuid,int,int) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 6. get_host_earnings(p_user_id, p_from, p_to)
-- Server-computed earnings breakdown from payments + refunds.
-- hostFeeVnd is reserved for the future commission engine (currently 0,
-- but the field is present so the UI does not need to assume it).
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.get_host_earnings(
  p_user_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_from timestamptz := coalesce(p_from, date_trunc('month', now()) - interval '11 months');
  v_to timestamptz := coalesce(p_to, now() + interval '1 day');
  v_totals jsonb;
  v_tx jsonb;
begin
  if p_user_id is null then raise exception 'UNAUTHORIZED' using errcode = '42501'; end if;
  if auth.uid() <> p_user_id
    and not exists(select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'grossVnd', coalesce(sum(p.amount_vnd), 0)::bigint,
    'refundedVnd', coalesce(sum(p.refunded_amount_vnd), 0)::bigint,
    'netVnd', coalesce(sum(p.amount_vnd - p.refunded_amount_vnd), 0)::bigint,
    'hostFeeVnd', 0::bigint,
    'hostNetVnd', coalesce(sum(p.amount_vnd - p.refunded_amount_vnd), 0)::bigint,
    'paidVnd', coalesce(sum(case when p.status = 'succeeded' and p.paid_at < now() then (p.amount_vnd - p.refunded_amount_vnd) else 0 end), 0)::bigint,
    'pendingVnd', coalesce(sum(case when p.status = 'pending' then p.amount_vnd else 0 end), 0)::bigint
  ) into v_totals
    from public.payments p
    join public.bookings b on b.id = p.booking_id
    join public.sessions s on s.id = b.session_id
    join public.offerings o on o.id = s.offering_id
    where public.can_manage_offering(p_user_id, o.id, 'host')
      and p.created_at >= v_from and p.created_at < v_to;

  select coalesce(jsonb_agg(row_to_json(t) order by t.occurred_at desc), '[]'::jsonb)
    into v_tx
    from (
      select
        p.id as "paymentId",
        b.id as "bookingId",
        p.status,
        p.amount_vnd as "amountVnd",
        p.refunded_amount_vnd as "refundedAmountVnd",
        p.currency,
        coalesce(p.paid_at, p.created_at) as "occurredAt",
        o.title as "offeringTitle"
      from public.payments p
      join public.bookings b on b.id = p.booking_id
      join public.sessions s on s.id = b.session_id
      join public.offerings o on o.id = s.offering_id
      where public.can_manage_offering(p_user_id, o.id, 'host')
        and p.created_at >= v_from and p.created_at < v_to
      order by p.created_at desc
      limit 200
    ) t;

  return jsonb_build_object(
    'currency', 'VND',
    'from', v_from,
    'to', v_to,
    'totals', v_totals,
    'transactions', v_tx
  );
end $$;

revoke all on function public.get_host_earnings(uuid,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.get_host_earnings(uuid,timestamptz,timestamptz) to authenticated;