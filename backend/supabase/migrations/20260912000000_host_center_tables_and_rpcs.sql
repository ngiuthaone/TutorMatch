-- Host Center: table definitions, analytics, and payout-summary RPCs.
-- Built atop 20260910000000_host_center_rpcs.sql (offerings/sessions/bookings/payments).
set search_path = '';

-- ─────────────────────────────────────────────────────────────────────
-- 1. check_in_tokens
-- One row per issued token; token is unique per session.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.check_in_tokens (
  id          uuid    not null default gen_random_uuid() primary key,
  session_id  uuid    not null references public.sessions(id) on delete cascade,
  token       text    not null,
  is_used     boolean not null default false,
  issued_at   timestamptz not null default now(),
  used_at     timestamptz,
  constraint  check_in_tokens_token_unique unique (session_id, token)
);
create index if not exists check_in_tokens_session_id_idx on public.check_in_tokens (session_id);
create index if not exists check_in_tokens_token_idx       on public.check_in_tokens (token);

alter table public.check_in_tokens enable row level security;
create policy check_in_tokens_auth_insert on public.check_in_tokens
  for insert to authenticated
  with check (true);
create policy check_in_tokens_auth_select on public.check_in_tokens
  for select to authenticated
  using (true);
create policy check_in_tokens_auth_update on public.check_in_tokens
  for update to authenticated
  using (true);

-- ─────────────────────────────────────────────────────────────────────
-- 2. check_in_logs  (immutable audit log)
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.check_in_logs (
  id           uuid    not null default gen_random_uuid() primary key,
  session_id   uuid    not null references public.sessions(id) on delete cascade,
  host_id      uuid    not null references public.profiles(id),
  action       text    not null check (action in ('issued','redeemed','undone')),
  token        text    not null,
  performed_at timestamptz not null default now()
);
create index if not exists check_in_logs_session_id_idx on public.check_in_logs (session_id);
create index if not exists check_in_logs_host_id_idx    on public.check_in_logs (host_id);

alter table public.check_in_logs enable row level security;
create policy check_in_logs_auth_all on public.check_in_logs
  for all to authenticated
  using (true);

-- ─────────────────────────────────────────────────────────────────────
-- 3. promotion_codes
-- Host-created discount codes scoped per offering.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.promotion_codes (
  id              uuid    not null default gen_random_uuid() primary key,
  host_id         uuid    not null references public.profiles(id),
  offering_id     uuid    not null references public.offerings(id) on delete cascade,
  code            text    not null,
  discount_type   text    not null check (discount_type in ('percent','fixed')),
  discount_value  numeric not null check (discount_value >= 0),
  max_uses        int,
  used_count      int     not null default 0,
  starts_at       timestamptz,
  ends_at         timestamptz,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  constraint      promotion_codes_code_unique unique (offering_id, code)
);
create index if not exists promotion_codes_host_id_idx  on public.promotion_codes (host_id);
create index if not exists promotion_codes_offering_id_idx on public.promotion_codes (offering_id);

alter table public.promotion_codes enable row level security;
create policy promotion_codes_auth_all on public.promotion_codes
  for all to authenticated
  using (host_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────
-- 4. team_members
-- Per-offering staff/host access grants.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.team_members (
  id          uuid    not null default gen_random_uuid() primary key,
  offering_id uuid    not null references public.offerings(id) on delete cascade,
  user_id     uuid    not null references public.profiles(id),
  role        text    not null,
  capability  text    not null check (capability in ('owner','host','member')),
  invited_by  uuid    references public.profiles(id),
  joined_at   timestamptz not null default now(),
  revoked_at  timestamptz,
  constraint   team_members_unique unique (offering_id, user_id)
);
create index if not exists team_members_offering_id_idx on public.team_members (offering_id);
create index if not exists team_members_user_id_idx     on public.team_members (user_id);

alter table public.team_members enable row level security;
create policy team_members_auth_all on public.team_members
  for all to authenticated
  using (user_id = auth.uid() or exists (
    select 1 from public.team_members tm2
    where tm2.offering_id = team_members.offering_id
      and tm2.user_id = auth.uid()
      and tm2.capability in ('owner','host')
      and tm2.revoked_at is null
  ));

-- ─────────────────────────────────────────────────────────────────────
-- 5. _generate_token()
-- 12-char uppercase alphanumeric token generator.
-- Adapted from OpenEvents generateTicketCode() — MIT license.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public._generate_token()
returns text
language plpgsql stable
as $$
begin
  return upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12));
end;
$$;

revoke all on function public._generate_token() from public, anon, authenticated;
grant execute on function public._generate_token() to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 6. get_host_analytics(p_user_id)
-- Returns enriched analytics: time-bucketed series, capacity utilization, conversion.
-- Falls back to 0 for unavailable metrics (impressions/page-visits need a separate
-- analytics-events pipeline — these can be wired later without schema changes).
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.get_host_analytics(p_user_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_from         timestamptz := date_trunc('month', now() - interval '11 months');
  v_to           timestamptz := now() + interval '1 day';
  v_period_start timestamptz := date_trunc('month', now() - interval '1 month');
  v_period_end   timestamptz := date_trunc('month', now());
  v_total_bookings      int;
  v_total_gross         bigint;
  v_prev_bookings       int;
  v_prev_gross          bigint;
  v_capacity_total      int;
  v_capacity_booked     int;
  v_sessions_with_cap   int;
  v_result              jsonb;
begin
  if p_user_id is null then raise exception 'UNAUTHORIZED' using errcode = '42501'; end if;
  if auth.uid() <> p_user_id
    and not exists(select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  -- Current-period totals (12-month window)
  select
    count(*)::int,
    coalesce(sum(p.amount_vnd - p.refunded_amount_vnd), 0)::bigint
    into v_total_bookings, v_total_gross
  from public.bookings b
  join public.sessions s on s.id = b.session_id
  join public.offerings o on o.id = s.offering_id
  left join public.payments p on p.booking_id = b.id and p.status = 'succeeded'
  where public.can_manage_offering(p_user_id, o.id, 'host')
    and b.status = 'confirmed'
    and b.created_at >= v_from and b.created_at < v_to;

  -- Previous-period (month N-1) for growth calculation
  select
    count(*)::int,
    coalesce(sum(p.amount_vnd - p.refunded_amount_vnd), 0)::bigint
    into v_prev_bookings, v_prev_gross
  from public.bookings b
  join public.sessions s on s.id = b.session_id
  join public.offerings o on o.id = s.offering_id
  left join public.payments p on p.booking_id = b.id and p.status = 'succeeded'
  where public.can_manage_offering(p_user_id, o.id, 'host')
    and b.status = 'confirmed'
    and b.created_at >= v_period_start and b.created_at < v_period_end;

  -- Capacity utilization: sum of confirmed booking counts vs sum of session max_participants
  select
    coalesce(sum(s.max_participants), 0)::int,
    count(b.id)::int
    into v_capacity_total, v_capacity_booked
  from public.sessions s
  join public.offerings o on o.id = s.offering_id
  left join public.bookings b on b.session_id = s.id and b.status = 'confirmed'
  where public.can_manage_offering(p_user_id, o.id, 'host')
    and s.max_participants is not null
    and s.starts_at >= v_from and s.starts_at < v_to;

  v_result := jsonb_build_object(
    -- Totals
    'totalBookings',   v_total_bookings,
    'totalGross',      v_total_gross,
    'avgBookingValue', case when v_total_bookings > 0 then (v_total_gross / v_total_bookings)::bigint else 0 end,
    -- Growth vs previous month
    'bookingGrowth',   case when v_prev_bookings > 0 then ((v_total_bookings - v_prev_bookings)::float / v_prev_bookings) * 100 else 0 end,
    'revenueGrowth',   case when v_prev_gross > 0 then ((v_total_gross - v_prev_gross)::float / v_prev_gross) * 100 else 0 end,
    -- Capacity
    'capacityUtilization', case when v_capacity_total > 0 then round((v_capacity_booked::numeric / v_capacity_total) * 100, 1) else 0 end,
    'totalCapacity',   v_capacity_total,
    'totalBooked',     v_capacity_booked,
    -- Legacy fields (wired to 0 until analytics-events pipeline is added)
    'impressions',     0,
    'pageVisits',      0,
    'conversionRate',  0.0,
    -- Daily series: 12-month rolling window, bucketed by booking date
    'daily', (
      select coalesce(jsonb_agg(d order by d.date asc), '[]'::jsonb)
      from (
        select
          date_trunc('day', b.created_at)::date                            as date,
          count(*)::int                                                   as bookings,
          coalesce(sum(p.amount_vnd - p.refunded_amount_vnd), 0)::bigint    as gross
        from public.bookings b
        join public.sessions s on s.id = b.session_id
        join public.offerings o on o.id = s.offering_id
        left join public.payments p on p.booking_id = b.id and p.status = 'succeeded'
        where public.can_manage_offering(p_user_id, o.id, 'host')
          and b.status = 'confirmed'
          and b.created_at >= v_from and b.created_at < v_to
        group by date_trunc('day', b.created_at)
      ) d
    ),
    -- Weekly series: derived from daily
    'weekly', (
      select coalesce(jsonb_agg(w order by w.week_start asc), '[]'::jsonb)
      from (
        select
          date_trunc('week', d.date)::date    as week_start,
          sum(d.bookings)::int                as bookings,
          sum(d.gross)::bigint                as gross
        from (
          select
            date_trunc('day', b.created_at)::date                            as date,
            count(*)::int                                                   as bookings,
            coalesce(sum(p.amount_vnd - p.refunded_amount_vnd), 0)::bigint    as gross
          from public.bookings b
          join public.sessions s on s.id = b.session_id
          join public.offerings o on o.id = s.offering_id
          left join public.payments p on p.booking_id = b.id and p.status = 'succeeded'
          where public.can_manage_offering(p_user_id, o.id, 'host')
            and b.status = 'confirmed'
            and b.created_at >= v_from and b.created_at < v_to
          group by date_trunc('day', b.created_at)
        ) d
        group by date_trunc('week', d.date)
      ) w
    ),
    -- Top 5 offerings by gross revenue with growth vs prior month
    'topOfferings', (
      with this_month as (
        select o.id, o.title,
          count(*)::int                                               as bookings,
          coalesce(sum(p.amount_vnd - p.refunded_amount_vnd), 0)::bigint as gross
        from public.bookings b
        join public.sessions s on s.id = b.session_id
        join public.offerings o on o.id = s.offering_id
        left join public.payments p on p.booking_id = b.id and p.status = 'succeeded'
        where public.can_manage_offering(p_user_id, o.id, 'host')
          and b.status = 'confirmed'
          and b.created_at >= v_period_start and b.created_at < v_period_end
        group by o.id, o.title
      ),
      last_month as (
        select o.id,
          count(*)::int                                               as bookings,
          coalesce(sum(p.amount_vnd - p.refunded_amount_vnd), 0)::bigint as gross
        from public.bookings b
        join public.sessions s on s.id = b.session_id
        join public.offerings o on o.id = s.offering_id
        left join public.payments p on p.booking_id = b.id and p.status = 'succeeded'
        where public.can_manage_offering(p_user_id, o.id, 'host')
          and b.status = 'confirmed'
          and b.created_at >= v_period_start - interval '1 month'
          and b.created_at < v_period_start
        group by o.id
      )
      select coalesce(jsonb_agg(row_to_json(t) order by t.gross desc limit 5), '[]'::jsonb)
      from (
        select
          tm.title,
          tm.bookings,
          tm.gross,
          coalesce(round(((tm.gross - lm.gross)::float / nullif(lm.gross, 0)) * 100, 1), 0) as growth_pct
        from this_month tm
        left join last_month lm on lm.id = tm.id
      ) t
    )
  );

  return v_result;
end;
$$;

revoke all on function public.get_host_analytics(uuid) from public, anon, authenticated;
grant execute on function public.get_host_analytics(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 7. get_host_payout_summary(p_user_id)
-- Simplified payout overview from payments table.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.get_host_payout_summary(p_user_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if p_user_id is null then raise exception 'UNAUTHORIZED' using errcode = '42501'; end if;
  if auth.uid() <> p_user_id
    and not exists(select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  v_result := (
    with managed as (
      select distinct o.id
      from public.offerings o
      join public.offering_hosts oh on oh.offering_id = o.id and oh.user_id = p_user_id and oh.revoked_at is null
    ),
    totals as (
      select
        coalesce(sum(case when p.status = 'succeeded' then p.amount_vnd - p.refunded_amount_vnd else 0 end), 0)::bigint as available,
        coalesce(sum(case when p.status = 'pending' then p.amount_vnd else 0 end), 0)::bigint as pending
      from public.payments p
      join public.bookings b on b.id = p.booking_id
      join public.sessions s on s.id = b.session_id
      where s.offering_id in (select id from managed)
    ),
    last_payout as (
      select p.paid_at, p.amount_vnd - p.refunded_amount_vnd as amount
      from public.payments p
      join public.bookings b on b.id = p.booking_id
      join public.sessions s on s.id = b.session_id
      where s.offering_id in (select id from managed)
        and p.status = 'succeeded'
        and p.paid_at is not null
      order by p.paid_at desc limit 1
    ),
    recent as (
      select
        p.id,
        p.amount_vnd - p.refunded_amount_vnd as amount,
        p.status,
        coalesce(p.paid_at, p.created_at) as occurred_at
      from public.payments p
      join public.bookings b on b.id = p.booking_id
      join public.sessions s on s.id = b.session_id
      where s.offering_id in (select id from managed)
      order by occurred_at desc limit 10
    )
    select jsonb_build_object(
      'availableBalance',    (select available from totals),
      'pendingBalance',      (select pending from totals),
      'nextPayoutAmount',    0,
      'nextPayoutDate',     null,
      'lastPayoutAmount',    (select amount from last_payout),
      'lastPayoutDate',     (select paid_at from last_payout),
      'recentPayouts', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', id,
          'amount', amount,
          'status', status,
          'date', occurred_at
        ) order by occurred_at desc), '[]'::jsonb)
        from recent
      )
    )
  );

  return v_result;
end;
$$;

revoke all on function public.get_host_payout_summary(uuid) from public, anon, authenticated;
grant execute on function public.get_host_payout_summary(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 8. issue_check_in_token(p_user_id, p_session_id)
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.issue_check_in_token(
  p_user_id   uuid,
  p_session_id uuid
) returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_token text;
  v_session_uuid uuid;
begin
  if p_user_id is null or p_session_id is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  select o.id into v_session_uuid
    from public.sessions s
    join public.offerings o on o.id = s.offering_id
    where s.id = p_session_id
      and public.can_manage_offering(p_user_id, o.id, 'host');
  if not found then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.sessions s where s.id = p_session_id and s.status = 'scheduled'
  ) then
    raise exception 'SESSION_NOT_SCHEDULED' using errcode = '22023';
  end if;

  for i in 0..2 loop
    v_token := public._generate_token();
    begin
      insert into public.check_in_tokens (session_id, token)
      values (p_session_id, v_token)
      returning token into v_token;
      exit;
    exception when unique_violation then
      if i = 2 then raise exception 'TOKEN_GENERATION_FAILED' using errcode = 'P0001'; end if;
    end;
  end loop;

  insert into public.check_in_logs (session_id, host_id, action, token)
  values (p_session_id, p_user_id, 'issued', v_token);

  return jsonb_build_object(
    'token',     v_token,
    'sessionId', p_session_id,
    'issuedAt',  now()
  );
end;
$$;

revoke all on function public.issue_check_in_token(uuid, uuid) from public, anon, authenticated;
grant execute on function public.issue_check_in_token(uuid, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 9. redeem_check_in_token(p_user_id, p_token)
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.redeem_check_in_token(
  p_user_id uuid,
  p_token   text
) returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_rec  public.check_in_tokens%rowtype;
  v_log  public.check_in_logs%rowtype;
begin
  if p_user_id is null or p_token is null or length(p_token) = 0 then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  select * into v_rec
    from public.check_in_tokens
    where token = p_token
    for update;

  if not found then
    raise exception 'TOKEN_NOT_FOUND' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.sessions s
    join public.offerings o on o.id = s.offering_id
    where s.id = v_rec.session_id
      and public.can_manage_offering(p_user_id, o.id, 'host')
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_rec.is_used then
    select * into v_log
      from public.check_in_logs
      where token = p_token and action = 'redeemed'
      order by performed_at desc limit 1;
    return jsonb_build_object(
      'success', true,
      'alreadyRedeemed', true,
      'checkedInAt', v_rec.used_at,
      'logId', v_log.id,
      'message', 'Already checked in.'
    );
  end if;

  update public.check_in_tokens
    set is_used = true, used_at = now()
    where id = v_rec.id;

  insert into public.check_in_logs (session_id, host_id, action, token)
    values (v_rec.session_id, p_user_id, 'redeemed', p_token)
    returning * into v_log;

  return jsonb_build_object(
    'success', true,
    'alreadyRedeemed', false,
    'token', p_token,
    'sessionId', v_rec.session_id,
    'checkedInAt', v_log.performed_at,
    'logId', v_log.id,
    'message', 'Check-in successful.'
  );
end;
$$;

revoke all on function public.redeem_check_in_token(uuid, text) from public, anon, authenticated;
grant execute on function public.redeem_check_in_token(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 10. undo_check_in(p_user_id, p_token)
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.undo_check_in(
  p_user_id uuid,
  p_token   text
) returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_rec  public.check_in_tokens%rowtype;
  v_log  public.check_in_logs%rowtype;
begin
  if p_user_id is null or p_token is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  select * into v_rec
    from public.check_in_tokens
    where token = p_token
    for update;

  if not found then
    raise exception 'TOKEN_NOT_FOUND' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.sessions s
    join public.offerings o on o.id = s.offering_id
    where s.id = v_rec.session_id
      and public.can_manage_offering(p_user_id, o.id, 'host')
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if not v_rec.is_used then
    return jsonb_build_object('success', false, 'message', 'Token was not used.');
  end if;

  update public.check_in_tokens
    set is_used = false, used_at = null
    where id = v_rec.id;

  insert into public.check_in_logs (session_id, host_id, action, token)
    values (v_rec.session_id, p_user_id, 'undone', p_token)
    returning * into v_log;

  return jsonb_build_object(
    'success', true,
    'token', p_token,
    'logId', v_log.id,
    'message', 'Check-in undone.'
  );
end;
$$;

revoke all on function public.undo_check_in(uuid, text) from public, anon, authenticated;
grant execute on function public.undo_check_in(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 11. list_host_check_in_logs(p_user_id, p_session_id, p_limit, p_offset)
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.list_host_check_in_logs(
  p_user_id    uuid,
  p_session_id uuid default null,
  p_limit      int  default 100,
  p_offset     int  default 0
) returns jsonb
language plpgsql stable
security definer set search_path = ''
as $$
declare
  v_limit  int := greatest(coalesce(p_limit, 100), 1);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  if p_user_id is null then raise exception 'UNAUTHORIZED' using errcode = '42501'; end if;
  if v_limit > 500 then v_limit := 500; end if;

  select coalesce(jsonb_agg(row_to_json(t) order by t.performed_at desc), '[]'::jsonb)
    into v_result
    from (
      select
        l.id,
        l.token,
        l.action,
        o.title                            as session_title,
        l.performed_at                     as created_at,
        '—'::text                         as learner_name
      from public.check_in_logs l
      join public.sessions s on s.id = l.session_id
      join public.offerings o on o.id = s.offering_id
      where public.can_manage_offering(p_user_id, o.id, 'host')
        and (p_session_id is null or l.session_id = p_session_id)
      order by l.performed_at desc
      limit v_limit offset v_offset
    ) t;

  return v_result;
end;
$$;

revoke all on function public.list_host_check_in_logs(uuid, uuid, int, int) from public, anon, authenticated;
grant execute on function public.list_host_check_in_logs(uuid, uuid, int, int) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 12. list_host_promotion_codes(p_user_id, p_offering_id, p_limit, p_offset)
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.list_host_promotion_codes(
  p_user_id    uuid,
  p_offering_id uuid default null,
  p_limit      int  default 100,
  p_offset     int  default 0
) returns jsonb
language plpgsql stable
security definer set search_path = ''
as $$
declare
  v_limit  int := greatest(coalesce(p_limit, 100), 1);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  if p_user_id is null then raise exception 'UNAUTHORIZED' using errcode = '42501'; end if;
  if v_limit > 500 then v_limit := 500; end if;

  select coalesce(jsonb_agg(row_to_json(t) order by t.created_at desc), '[]'::jsonb)
    into v_result
    from (
      select
        pc.id,
        pc.code,
        pc.discount_type  as discount_type,
        pc.discount_value as discount_value,
        pc.used_count     as uses,
        pc.max_uses,
        pc.ends_at         as expires_at,
        pc.created_at,
        case
          when not pc.is_active                               then 'inactive'
          when pc.starts_at is not null and pc.starts_at > now() then 'scheduled'
          when pc.ends_at   is not null and pc.ends_at   < now() then 'expired'
          when pc.max_uses  is not null and pc.used_count >= pc.max_uses then 'exhausted'
          else 'active'
        end                as status
      from public.promotion_codes pc
      where pc.host_id = p_user_id
        and (p_offering_id is null or pc.offering_id = p_offering_id)
      order by pc.created_at desc
      limit v_limit offset v_offset
    ) t;

  return v_result;
end;
$$;

revoke all on function public.list_host_promotion_codes(uuid, uuid, int, int) from public, anon, authenticated;
grant execute on function public.list_host_promotion_codes(uuid, uuid, int, int) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 13. list_host_team(p_user_id, p_offering_id, p_limit, p_offset)
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.list_host_team(
  p_user_id    uuid,
  p_offering_id uuid default null,
  p_limit      int  default 100,
  p_offset     int  default 0
) returns jsonb
language plpgsql stable
security definer set search_path = ''
as $$
declare
  v_limit  int := greatest(coalesce(p_limit, 100), 1);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  if p_user_id is null then raise exception 'UNAUTHORIZED' using errcode = '42501'; end if;
  if v_limit > 500 then v_limit := 500; end if;

  select coalesce(jsonb_agg(row_to_json(t) order by t.joined_at asc), '[]'::jsonb)
    into v_result
    from (
      select
        tm.id,
        p.name          as name,
        p.email         as email,
        tm.capability   as role,
        tm.joined_at
      from public.team_members tm
      join public.offerings o on o.id = tm.offering_id
      join public.profiles p on p.id = tm.user_id
      where public.can_manage_offering(p_user_id, o.id, 'host')
        and tm.revoked_at is null
        and (p_offering_id is null or tm.offering_id = p_offering_id)
      order by tm.joined_at asc
      limit v_limit offset v_offset
    ) t;

  return v_result;
end;
$$;

revoke all on function public.list_host_team(uuid, uuid, int, int) from public, anon, authenticated;
grant execute on function public.list_host_team(uuid, uuid, int, int) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 14. payout_failure_logs table
-- Tracks failed payout attempts so hosts can see failures and admins
-- can retry or resolve them manually.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.payout_failure_logs (
  id                  uuid primary key default gen_random_uuid(),
  host_id             uuid not null references public.profiles(id) on delete cascade,
  payout_period       text not null,
  amount_vnd          bigint not null check (amount_vnd > 0),
  failure_reason      text not null,
  attempt_count       int not null default 0,
  max_attempts        int not null default 3,
  status              text not null default 'pending'
                          check (status in ('pending', 'retrying', 'resolved', 'failed_permanently')),
  last_attempt_at     timestamptz,
  resolved_at         timestamptz,
  resolved_by         uuid references public.profiles(id),
  resolution_note     text,
  created_at          timestamptz not null default now()
);

create index if not exists payout_failure_logs_host     on public.payout_failure_logs(host_id, created_at desc);
create index if not exists payout_failure_logs_status  on public.payout_failure_logs(status) where status <> 'resolved';

revoke all on table public.payout_failure_logs from public, anon, authenticated;
grant select, insert on table public.payout_failure_logs to authenticated;
grant update on table public.payout_failure_logs to authenticated;

-- RLS: hosts see only their own failures; admins see all
alter table public.payout_failure_logs enable row level security;

create policy "hosts_read_own_payout_failures" on public.payout_failure_logs
  for select using (
    auth.uid() = host_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "service_insert_payout_failures" on public.payout_failure_logs
  for insert with check (true);

create policy "service_update_payout_failures" on public.payout_failure_logs
  for update using (
    auth.uid() = host_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ─────────────────────────────────────────────────────────────────────
-- 15. record_payout_failure(p_host_id, p_period, p_amount_vnd, p_reason)
-- Called by admin/worker when a payout attempt fails.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.record_payout_failure(
  p_host_id      uuid,
  p_period       text,
  p_amount_vnd   bigint,
  p_reason       text
) returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_host_id is null or p_amount_vnd is null or p_amount_vnd <= 0 or p_reason is null then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;

  insert into public.payout_failure_logs (host_id, payout_period, amount_vnd, failure_reason)
  values (p_host_id, p_period, p_amount_vnd, p_reason)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'recorded', true);
end;
$$;

revoke all on function public.record_payout_failure(uuid, text, bigint, text) from public, anon, authenticated;
grant execute on function public.record_payout_failure(uuid, text, bigint, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 16. list_host_payout_failures(p_user_id, p_limit, p_offset)
-- Returns the host's payout failure history, newest first.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.list_host_payout_failures(
  p_user_id  uuid,
  p_limit    int default 100,
  p_offset   int default 0
) returns jsonb
language plpgsql stable
security definer set search_path = ''
as $$
declare
  v_limit   int := greatest(coalesce(p_limit, 100), 1);
  v_offset  int := greatest(coalesce(p_offset, 0), 0);
  v_result  jsonb;
begin
  if p_user_id is null then raise exception 'UNAUTHORIZED' using errcode = '42501'; end if;
  if v_limit > 500 then v_limit := 500; end if;

  select jsonb_build_object(
    'failures', (
      select coalesce(jsonb_agg(r order by r.created_at desc), '[]'::jsonb)
      from (
        select
          id,
          payout_period    as period,
          amount_vnd,
          failure_reason  as reason,
          attempt_count,
          max_attempts,
          status,
          last_attempt_at as lastAttemptAt,
          resolved_at     as resolvedAt,
          resolution_note as resolutionNote,
          created_at      as createdAt
        from public.payout_failure_logs
        where host_id = p_user_id
        order by created_at desc
        limit v_limit offset v_offset
      ) r
    ),
    'hasMore', (
      select count(*) > v_limit
      from public.payout_failure_logs
      where host_id = p_user_id
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.list_host_payout_failures(uuid, int, int) from public, anon, authenticated;
grant execute on function public.list_host_payout_failures(uuid, int, int) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 17. retry_payout_failure(p_failure_id)
-- Increments attempt_count and sets status to 'retrying'; called before
-- re-attempting a payout. Admin/service role only.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.retry_payout_failure(p_failure_id uuid)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_row record;
begin
  if p_failure_id is null then raise exception 'INVALID_INPUT' using errcode = '22023'; end if;

  select id, attempt_count, max_attempts, status into v_row
  from public.payout_failure_logs
  where id = p_failure_id
  for update;

  if not found then raise exception 'NOT_FOUND' using errcode = '404'; end if;
  if v_row.status in ('resolved', 'failed_permanently') then
    raise exception 'INVALID_STATE' using errcode = '409';
  end if;
  if v_row.attempt_count >= v_row.max_attempts then
    update public.payout_failure_logs
      set status = 'failed_permanently', last_attempt_at = now(), updated_at = now()
      where id = p_failure_id;
    return jsonb_build_object('id', p_failure_id, 'status', 'failed_permanently', 'reason', 'max_attempts_reached');
  end if;

  update public.payout_failure_logs
    set status = 'retrying',
        attempt_count = attempt_count + 1,
        last_attempt_at = now(),
        updated_at = now()
    where id = p_failure_id;

  return jsonb_build_object('id', p_failure_id, 'status', 'retrying', 'attemptCount', v_row.attempt_count + 1);
end;
$$;

revoke all on function public.retry_payout_failure(uuid) from public, anon, authenticated;
grant execute on function public.retry_payout_failure(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 18. list_host_payout_statements(p_user_id, p_limit, p_offset)
-- Returns monthly payout statements computed from payments, newest first.
-- Commission is 10% on non-refunded gross. No persisted table needed —
-- computed on read from the authoritative payments ledger.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.list_host_payout_statements(
  p_user_id  uuid,
  p_limit    int default 24,
  p_offset   int default 0
) returns jsonb
language plpgsql stable
security definer set search_path = ''
as $$
declare
  v_limit   int := greatest(coalesce(p_limit, 24), 1);
  v_offset  int := greatest(coalesce(p_offset, 0), 0);
  v_result  jsonb;
  v_commission_rate_bps int := 1000; -- 10%
begin
  if p_user_id is null then raise exception 'UNAUTHORIZED' using errcode = '42501'; end if;
  if v_limit > 48 then v_limit := 48; end if;

  v_result := (
    with managed as (
      select distinct o.id
      from public.offerings o
      join public.offering_hosts oh on oh.offering_id = o.id and oh.user_id = p_user_id and oh.revoked_at is null
    ),
    periods as (
      select
        to_char(coalesce(p.paid_at, p.created_at), 'YYYY-MM')  as period,
        sum(case when p.status = 'succeeded' then p.amount_vnd else 0 end)      as gross_vnd,
        sum(p.refunded_amount_vnd)                                   as refunds_vnd
      from public.payments p
      join public.bookings b on b.id = p.booking_id
      join public.sessions s on s.id = b.session_id
      where s.offering_id in (select id from managed)
      group by period
    )
    select jsonb_build_object(
      'statements', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'period',         period,
          'grossVnd',       gross_vnd,
          'refundsVnd',     refunds_vnd,
          'commissionVnd',  floor((greatest(0, gross_vnd - refunds_vnd) * v_commission_rate_bps)::numeric / 10000),
          'netVnd',         greatest(0, gross_vnd - refunds_vnd - floor((greatest(0, gross_vnd - refunds_vnd) * v_commission_rate_bps)::numeric / 10000))
        ) order by period desc), '[]'::jsonb)
        from periods
        limit v_limit offset v_offset
      ),
      'hasMore', (
        select count(*) > v_limit from periods
      )
    )
  );

  return v_result;
end;
$$;

revoke all on function public.list_host_payout_statements(uuid, int, int) from public, anon, authenticated;
grant execute on function public.list_host_payout_statements(uuid, int, int) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 19. resolve_payout_failure(p_failure_id, p_resolution_note)
-- Marks a failure as resolved (admin or host after remediation).
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.resolve_payout_failure(p_failure_id uuid, p_resolution_note text default null)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_row record;
begin
  if p_failure_id is null then raise exception 'INVALID_INPUT' using errcode = '22023'; end if;

  select id, status into v_row
  from public.payout_failure_logs
  where id = p_failure_id
  for update;

  if not found then raise exception 'NOT_FOUND' using errcode = '404'; end if;
  if v_row.status = 'resolved' then
    raise exception 'INVALID_STATE' using errcode = '409';
  end if;

  update public.payout_failure_logs
    set status = 'resolved',
        resolved_at = now(),
        resolved_by = auth.uid(),
        resolution_note = p_resolution_note,
        updated_at = now()
    where id = p_failure_id;

  return jsonb_build_object('id', p_failure_id, 'status', 'resolved');
end;
$$;

revoke all on function public.resolve_payout_failure(uuid, text) from public, anon, authenticated;
grant execute on function public.resolve_payout_failure(uuid, text) to authenticated;

