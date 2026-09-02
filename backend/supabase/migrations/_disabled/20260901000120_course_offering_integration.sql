-- 20260901000120_course_offering_integration.sql
-- Phase 7: Commerce integration - connects course purchase to enrollment.
-- Flow: Course creates offerings.kind='course' → virtual 1-second session → 
--       create_booking → start_payment_attempt → VNPay IPN → 
--       finalize_paid_booking → course_enrollments row

set search_path = '';

-- Enable course_enrollments table (moved from _disabled/)
create table if not exists public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (course_id, user_id)
);

create index if not exists course_enrollments_user_id_idx on public.course_enrollments(user_id);
create index if not exists course_enrollments_course_id_idx on public.course_enrollments(course_id);
create index if not exists course_enrollments_booking_id_idx on public.course_enrollments(booking_id);

alter table public.course_enrollments enable row level security;

revoke all on table public.course_enrollments from public, anon, authenticated;

-- Public can read enrollments (for course stats/visibility)
drop policy if exists course_enrollments_public_read on public.course_enrollments;
create policy course_enrollments_public_read on public.course_enrollments
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.courses c
      where c.id = course_enrollments.course_id
        and c.status = 'published'
    )
  );

-- Enrolled user can read their own enrollment
drop policy if exists course_enrollments_owner_read on public.course_enrollments;
create policy course_enrollments_owner_read on public.course_enrollments
  for select to authenticated
  using (user_id = auth.uid());

-- Server-side RPC only for insert (payment-verified enrollment)
drop policy if exists course_enrollments_auth_insert on public.course_enrollments;
create policy course_enrollments_auth_insert on public.course_enrollments
  for insert to authenticated
  with check (user_id = auth.uid());

-- No updates allowed after creation (immutable enrollment record)
drop policy if exists course_enrollments_no_update on public.course_enrollments;
create policy course_enrollments_no_update on public.course_enrollments
  for update to authenticated
  using (false);

-- No deletion allowed (permanent record)
drop policy if exists course_enrollments_no_delete on public.course_enrollments;
create policy course_enrollments_no_delete on public.course_enrollments
  for delete to authenticated
  using (false);

-- Helper function: get or create course offering for a published course.
-- Creates offerings.kind='course' with flat_per_participant_v1 pricing.
create or replace function public.get_or_create_course_offering(p_course_id uuid)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  offering_id uuid;
  course_price bigint;
  existing offerings%rowtype;
begin
  -- Get course price (default 0 if not set, meaning free course)
  select (config->>'price')::bigint into course_price
  from public.courses where id = p_course_id;
  if course_price is null then course_price := 0; end if;

  -- Check if offering already exists for this course
  select * into existing from public.offerings o
  where o.kind = 'course' and o.config->>'courseId' = p_course_id::text;
  
  if existing.id is not null then
    return jsonb_build_object(
      'offeringId', existing.id,
      'sessionId', null,
      'created', false
    );
  end if;

  -- Create new offering for this course
  insert into public.offerings(kind, slug, creator_id, config, pricing_model, price_per_participant_vnd, booking_mode)
  values (
    'course',
    'course-' || p_course_id::text,
    (select creator_id from public.courses where id = p_course_id),
    jsonb_build_object('courseId', p_course_id::text),
    case when course_price > 0 then 'flat_per_participant_v1' else 'hourly_v1' end,
    case when course_price > 0 then course_price else null end,
    'instant'
  )
  returning id into offering_id;

  return jsonb_build_object(
    'offeringId', offering_id,
    'sessionId', null,
    'created', true
  );
end;
$$;

revoke all on function public.get_or_create_course_offering(uuid) from public, anon, authenticated;
grant execute on function public.get_or_create_course_offering(uuid) to authenticated;

-- Create virtual session for a course offering (1-second session for instant access).
-- This session is used only for the booking/payment flow.
create or replace function public.create_course_virtual_session(p_offering_id uuid)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  sid uuid;
  course_id uuid;
  host_id uuid;
  course_price bigint;
begin
  -- Get course info from offering config
  select (config->>'courseId')::uuid into course_id from public.offerings where id = p_offering_id;
  if course_id is null then
    raise exception 'OFFERING_NOT_FOUND' using errcode = '22023';
  end if;

  -- Get course creator as host
  select creator_id into host_id from public.courses where id = course_id;
  if host_id is null then
    raise exception 'COURSE_NOT_FOUND' using errcode = '22023';
  end if;

  -- Check if virtual session already exists for this offering
  select id into sid from public.sessions
  where offering_id = p_offering_id
    and host_id = host_id
    and status = 'scheduled'
    and starts_at = ends_at - interval '1 second'
  limit 1;

  if sid is not null then
    return jsonb_build_object('sessionId', sid, 'created', false);
  end if;

  -- Create virtual session: starts now, ends 1 second later
  sid := gen_random_uuid();
  insert into public.sessions(id, offering_id, host_id, starts_at, ends_at, min_participants, max_participants)
  values (
    sid,
    p_offering_id,
    host_id,
    now(),
    now() + interval '1 second',
    1,
    999999
  );

  -- Auto-approve for instant booking
  insert into public.session_history(session_id, change_type, by, at)
  values (sid, 'created', 'host', now());

  return jsonb_build_object('sessionId', sid, 'created', true);
end;
$$;

revoke all on function public.create_course_virtual_session(uuid) from public, anon, authenticated;
grant execute on function public.create_course_virtual_session(uuid) to authenticated;

-- RPC: Enroll user in course after successful payment.
-- Called by the payment finalization flow after finalize_paid_booking.
create or replace function public.enroll_learner_in_course(p_booking_id uuid)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_session_id uuid;
  v_course_id uuid;
  v_learner_id uuid;
  v_offering_id uuid;
  existing_enrollment course_enrollments%rowtype;
begin
  -- Get session and offering info from booking
  select b.session_id, s.offering_id, b.learner_id
  into v_session_id, v_offering_id, v_learner_id
  from public.bookings b
  join public.sessions s on s.id = b.session_id
  where b.id = p_booking_id;

  if v_session_id is null or v_offering_id is null then
    raise exception 'BOOKING_SESSION_NOT_FOUND' using errcode = '22023';
  end if;

  -- Get course ID from offering config
  select (config->>'courseId')::uuid into v_course_id
  from public.offerings where id = v_offering_id and kind = 'course';

  if v_course_id is null then
    raise exception 'NOT_A_COURSE_OFFERING' using errcode = '22023';
  end if;

  -- Check if already enrolled
  select * into existing_enrollment
  from public.course_enrollments
  where course_id = v_course_id and user_id = v_learner_id;

  if existing_enrollment.id is not null then
    return jsonb_build_object(
      'enrollmentId', existing_enrollment.id,
      'courseId', v_course_id,
      'userId', v_learner_id,
      'alreadyEnrolled', true
    );
  end if;

  -- Create enrollment
  insert into public.course_enrollments(course_id, user_id, booking_id)
  values (v_course_id, v_learner_id, p_booking_id)
  returning id into existing_enrollment.id;

  return jsonb_build_object(
    'enrollmentId', existing_enrollment.id,
    'courseId', v_course_id,
    'userId', v_learner_id,
    'alreadyEnrolled', false
  );
end;
$$;

revoke all on function public.enroll_learner_in_course(uuid) from public, anon, authenticated;
grant execute on function public.enroll_learner_in_course(uuid) to service_role;

-- Function to get course offering by course slug (for purchase flow)
create or replace function public.get_course_offering_by_slug(p_course_slug text)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_course_id uuid;
  v_offering_id uuid;
  v_session_id uuid;
  offering_record offerings%rowtype;
  session_record sessions%rowtype;
begin
  -- Find course by slug
  select id into v_course_id from public.courses where slug = p_course_slug and status = 'published';
  if v_course_id is null then
    return null;
  end if;

  -- Get or create offering
  select * into offering_record from public.get_or_create_course_offering(v_course_id) as result;
  v_offering_id := (offering_record->>'offeringId')::uuid;

  -- Get or create virtual session
  select * into session_record from public.create_course_virtual_session(v_offering_id) as result;
  v_session_id := (session_record->>'sessionId')::uuid;

  -- Get offering details
  select * into offering_record from public.offerings where id = v_offering_id;

  -- Get session details
  select * into session_record from public.sessions where id = v_session_id;

  return jsonb_build_object(
    'offering', jsonb_build_object(
      'id', offering_record.id,
      'kind', offering_record.kind,
      'title', (select title from public.courses where id = v_course_id),
      'pricingModel', offering_record.pricing_model,
      'pricePerParticipantVnd', offering_record.price_per_participant_vnd,
      'bookingMode', offering_record.booking_mode
    ),
    'session', jsonb_build_object(
      'id', session_record.id,
      'startsAt', session_record.starts_at,
      'endsAt', session_record.ends_at,
      'status', session_record.status
    ),
    'courseId', v_course_id
  );
end;
$$;

revoke all on function public.get_course_offering_by_slug(text) from public, anon, authenticated;
grant execute on function public.get_course_offering_by_slug(text) to authenticated;

-- Check if user is enrolled in a course
create or replace function public.get_course_enrollment(p_course_id uuid)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  uid uuid := auth.uid();
  enrollment course_enrollments%rowtype;
begin
  if uid is null then raise insufficient_privilege; end if;

  select * into enrollment from public.course_enrollments
  where course_id = p_course_id and user_id = uid;

  if enrollment.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'id', enrollment.id,
    'courseId', enrollment.course_id,
    'userId', enrollment.user_id,
    'enrolledAt', enrollment.enrolled_at,
    'completedAt', enrollment.completed_at
  );
end;
$$;

revoke all on function public.get_course_enrollment(uuid) from public, anon, authenticated;
grant execute on function public.get_course_enrollment(uuid) to authenticated;

-- List user's course enrollments
create or replace function public.list_my_course_enrollments()
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise insufficient_privilege; end if;

  return (
    select jsonb_agg(jsonb_build_object(
      'id', ce.id,
      'courseId', ce.course_id,
      'courseTitle', c.title,
      'courseSlug', c.slug,
      'enrolledAt', ce.enrolled_at,
      'completedAt', ce.completed_at
    ))
    from public.course_enrollments ce
    join public.courses c on c.id = ce.course_id
    where ce.user_id = uid
    order by ce.enrolled_at desc
  );
end;
$$;

revoke all on function public.list_my_course_enrollments() from public, anon, authenticated;
grant execute on function public.list_my_course_enrollments() to authenticated;
