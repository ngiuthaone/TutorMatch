-- Tutor dashboard aggregate (today's sessions, earnings, students).
-- Read-only view of the tutor's operational state.
set search_path = '';

create or replace function public.get_tutor_dashboard(p_user_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_tutor_id uuid;
  v_today_start timestamptz := date_trunc('day', now());
  v_today_end timestamptz := v_today_start + interval '1 day';
  v_month_start timestamptz := date_trunc('month', now());
  v_month_end timestamptz := v_month_start + interval '1 month';
  v_result jsonb;
begin
  select id into v_tutor_id from public.tutor_profiles where user_id = p_user_id;
  if v_tutor_id is null then return jsonb_build_object('error', 'not_a_tutor'); end if;

  -- Verify caller is the tutor or admin
  if auth.uid() <> p_user_id and not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'tutorProfile', jsonb_build_object(
      'id', v_tutor_id,
      'displayName', tp.display_name,
      'headline', tp.headline,
      'publicationStatus', tp.publication_status,
      'verificationStatus', tp.verification_status,
      'hourlyRateVnd', tp.hourly_rate_vnd,
      'avatarObjectPath', tp.avatar_object_path
    ),
    'todayCount', (
      select count(*)::int from public.sessions s
      join public.offerings o on o.id = s.offering_id
      where o.creator_id = p_user_id and s.starts_at >= v_today_start and s.starts_at < v_today_end
        and s.status = 'scheduled'
    ),
    'upcomingCount', (
      select count(*)::int from public.sessions s
      join public.offerings o on o.id = s.offering_id
      where o.creator_id = p_user_id and s.starts_at >= v_today_end
        and s.status = 'scheduled'
    ),
    'monthEarningsVnd', coalesce((
      select sum(p.amount_vnd - p.refunded_amount_vnd)::bigint
      from public.payments p
      join public.bookings b on b.id = p.booking_id
      join public.sessions s on s.id = b.session_id
      join public.offerings o on o.id = s.offering_id
      where o.creator_id = p_user_id
        and p.status in ('succeeded')
        and p.paid_at >= v_month_start and p.paid_at < v_month_end
    ), 0),
    'monthCompletedCount', (
      select count(*)::int from public.bookings b
      join public.sessions s on s.id = b.session_id
      join public.offerings o on o.id = s.offering_id
      where o.creator_id = p_user_id
        and b.status = 'completed'
        and b.updated_at >= v_month_start and b.updated_at < v_month_end
    ),
    'rating', public.get_tutor_rating_summary(v_tutor_id),
    'pendingBookingsCount', (
      select count(*)::int from public.bookings b
      join public.sessions s on s.id = b.session_id
      join public.offerings o on o.id = s.offering_id
      where o.creator_id = p_user_id and b.status = 'requested'
    )
  )
  into v_result
  from public.tutor_profiles tp where tp.id = v_tutor_id;

  return v_result;
end $$;
revoke all on function public.get_tutor_dashboard(uuid) from public, anon, authenticated;
grant execute on function public.get_tutor_dashboard(uuid) to authenticated;
