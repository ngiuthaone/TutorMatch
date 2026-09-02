-- 20260902000000_course_schema_v1.sql
-- Consolidated Course Subsystem v1 - combines all disabled course migrations
-- Prerequisite: 20260901000010_course_offering_kind.sql (adds 'course' to offerings.kind)

set search_path = public;

-- ============================================
-- SECTION 1: courses table
-- ============================================
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  cover_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'unpublished')),
  version integer not null default 1 check (version >= 1),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists courses_creator_idx on public.courses(creator_id);
create index if not exists courses_status_idx on public.courses(status) where status = 'published';

alter table public.courses enable row level security;

revoke all on table public.courses from public, anon, authenticated;

-- Public read: published courses
create policy courses_public_read on public.courses
  for select to anon, authenticated
  using (status = 'published' or creator_id = auth.uid());

-- Authenticated users can create courses
create policy courses_auth_insert on public.courses
  for insert to authenticated
  with check (creator_id = auth.uid());

-- Only creator can update
create policy courses_owner_update on public.courses
  for update to authenticated
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid());

-- Only creator can delete
create policy courses_owner_delete on public.courses
  for delete to authenticated
  using (creator_id = auth.uid());

-- updated_at trigger
create or replace function public.set_course_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

drop trigger if exists courses_set_updated_at on public.courses;
create trigger courses_set_updated_at before update on public.courses
  for each row execute function public.set_course_updated_at();

-- ============================================
-- SECTION 2: course_sections table
-- ============================================
create table if not exists public.course_sections (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, position)
);

create index if not exists course_sections_course_id_idx on public.course_sections(course_id, position);

alter table public.course_sections enable row level security;

revoke all on table public.course_sections from public, anon, authenticated;

create policy course_sections_public_read on public.course_sections
  for select to anon, authenticated
  using (exists (
    select 1 from public.courses c
    where c.id = course_sections.course_id
      and (c.status = 'published' or c.creator_id = auth.uid())
  ));

create policy course_sections_creator_write on public.course_sections
  for all to authenticated
  using (exists (
    select 1 from public.courses c
    where c.id = course_sections.course_id and c.creator_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.courses c
    where c.id = course_sections.course_id and c.creator_id = auth.uid()
  ));

create or replace function public.set_course_section_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

drop trigger if exists course_sections_set_updated_at on public.course_sections;
create trigger course_sections_set_updated_at before update on public.course_sections
  for each row execute function public.set_course_section_updated_at();

-- ============================================
-- SECTION 3: course_lessons table
-- ============================================
do $$ begin
  create type course_lesson_type as enum ('video', 'text', 'quiz', 'resource');
exception when duplicate_object then null;
end $$;

create table if not exists public.course_lessons (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.course_sections(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  lesson_type course_lesson_type not null default 'video',
  position integer not null default 0,
  video_url text,
  text_content text,
  is_preview boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (section_id, position)
);

create index if not exists course_lessons_section_id_idx on public.course_lessons(section_id, position);

alter table public.course_lessons enable row level security;

revoke all on table public.course_lessons from public, anon, authenticated;

create policy course_lessons_public_read on public.course_lessons
  for select to authenticated
  using (exists (
    select 1 from public.courses c
    join public.course_sections cs on cs.course_id = c.id
    where cs.id = course_lessons.section_id
      and (c.status = 'published' or c.creator_id = auth.uid())
  ));

create policy course_lessons_creator_all on public.course_lessons
  for all to authenticated
  using (exists (
    select 1 from public.courses c
    join public.course_sections cs on cs.course_id = c.id
    where cs.id = course_lessons.section_id and c.creator_id = auth.uid()
  ));

create or replace function public.set_course_lesson_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

drop trigger if exists course_lessons_set_updated_at on public.course_lessons;
create trigger course_lessons_set_updated_at before update on public.course_lessons
  for each row execute function public.set_course_lesson_updated_at();

-- ============================================
-- SECTION 4: course_resources table
-- ============================================
create table if not exists public.course_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.course_lessons(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  file_path text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 104857600),
  created_at timestamptz not null default now()
);

create index if not exists course_resources_lesson_id_idx on public.course_resources(lesson_id);

alter table public.course_resources enable row level security;

revoke all on table public.course_resources from public, anon, authenticated;

create policy course_resources_public_read on public.course_resources
  for select to anon, authenticated
  using (exists (
    select 1 from public.courses c
    join public.course_sections cs on cs.course_id = c.id
    join public.course_lessons cl on cl.section_id = cs.id
    where cl.id = course_resources.lesson_id
      and (c.status = 'published' or c.creator_id = auth.uid())
  ));

create policy course_resources_creator_write on public.course_resources
  for all to authenticated
  using (exists (
    select 1 from public.courses c
    join public.course_sections cs on cs.course_id = c.id
    join public.course_lessons cl on cl.section_id = cs.id
    where cl.id = course_resources.lesson_id and c.creator_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.courses c
    join public.course_sections cs on cs.course_id = c.id
    join public.course_lessons cl on cl.section_id = cs.id
    where cl.id = course_resources.lesson_id and c.creator_id = auth.uid()
  ));

-- ============================================
-- SECTION 5: course_quizzes, questions, options
-- ============================================
create table if not exists public.course_quizzes (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null unique references public.course_lessons(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  passing_score integer not null default 70 check (passing_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.course_quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.course_quizzes(id) on delete cascade,
  question_text text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (quiz_id, position)
);

create table if not exists public.course_quiz_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.course_quiz_questions(id) on delete cascade,
  option_text text not null,
  is_correct boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists course_quizzes_lesson_id_idx on public.course_quizzes(lesson_id);
create index if not exists course_quiz_questions_quiz_id_idx on public.course_quiz_questions(quiz_id);
create index if not exists course_quiz_options_question_id_idx on public.course_quiz_options(question_id);

alter table public.course_quizzes enable row level security;
alter table public.course_quiz_questions enable row level security;
alter table public.course_quiz_options enable row level security;

revoke all on table public.course_quizzes from public, anon, authenticated;
revoke all on table public.course_quiz_questions from public, anon, authenticated;
revoke all on table public.course_quiz_options from public, anon, authenticated;

-- RLS for course_quizzes
create policy course_quizzes_public_read on public.course_quizzes
  for select to anon, authenticated
  using (exists (
    select 1 from public.course_lessons cl
    join public.course_sections cs on cs.id = cl.section_id
    join public.courses c on c.id = cs.course_id
    where cl.id = course_quizzes.lesson_id
      and (c.status = 'published' or c.creator_id = auth.uid())
  ));

create policy course_quizzes_creator_write on public.course_quizzes
  for all to authenticated
  using (exists (
    select 1 from public.course_lessons cl
    join public.course_sections cs on cs.id = cl.section_id
    join public.courses c on c.id = cs.course_id
    where cl.id = course_quizzes.lesson_id and c.creator_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.course_lessons cl
    join public.course_sections cs on cs.id = cl.section_id
    join public.courses c on c.id = cs.course_id
    where cl.id = course_quizzes.lesson_id and c.creator_id = auth.uid()
  ));

-- RLS for course_quiz_questions
create policy course_quiz_questions_public_read on public.course_quiz_questions
  for select to anon, authenticated
  using (exists (
    select 1 from public.course_quizzes cq
    join public.course_lessons cl on cl.id = cq.lesson_id
    join public.course_sections cs on cs.id = cl.section_id
    join public.courses c on c.id = cs.course_id
    where cq.id = course_quiz_questions.quiz_id
      and (c.status = 'published' or c.creator_id = auth.uid())
  ));

create policy course_quiz_questions_creator_write on public.course_quiz_questions
  for all to authenticated
  using (exists (
    select 1 from public.course_quizzes cq
    join public.course_lessons cl on cl.id = cq.lesson_id
    join public.course_sections cs on cs.id = cl.section_id
    join public.courses c on c.id = cs.course_id
    where cq.id = course_quiz_questions.quiz_id and c.creator_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.course_quizzes cq
    join public.course_lessons cl on cl.id = cq.lesson_id
    join public.course_sections cs on cs.id = cl.section_id
    join public.courses c on c.id = cs.course_id
    where cq.id = course_quiz_questions.quiz_id and c.creator_id = auth.uid()
  ));

-- RLS for course_quiz_options
create policy course_quiz_options_public_read on public.course_quiz_options
  for select to anon, authenticated
  using (exists (
    select 1 from public.course_quiz_questions cqq
    join public.course_quizzes cq on cq.id = cqq.quiz_id
    join public.course_lessons cl on cl.id = cq.lesson_id
    join public.course_sections cs on cs.id = cl.section_id
    join public.courses c on c.id = cs.course_id
    where cqq.id = course_quiz_options.question_id
      and (c.status = 'published' or c.creator_id = auth.uid())
  ));

create policy course_quiz_options_creator_write on public.course_quiz_options
  for all to authenticated
  using (exists (
    select 1 from public.course_quiz_questions cqq
    join public.course_quizzes cq on cq.id = cqq.quiz_id
    join public.course_lessons cl on cl.id = cq.lesson_id
    join public.course_sections cs on cs.id = cl.section_id
    join public.courses c on c.id = cs.course_id
    where cqq.id = course_quiz_options.question_id and c.creator_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.course_quiz_questions cqq
    join public.course_quizzes cq on cq.id = cqq.quiz_id
    join public.course_lessons cl on cl.id = cq.lesson_id
    join public.course_sections cs on cs.id = cl.section_id
    join public.courses c on c.id = cs.course_id
    where cqq.id = course_quiz_options.question_id and c.creator_id = auth.uid()
  ));

create or replace function public.set_course_quiz_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

drop trigger if exists course_quizzes_set_updated_at on public.course_quizzes;
create trigger course_quizzes_set_updated_at before update on public.course_quizzes
  for each row execute function public.set_course_quiz_updated_at();

-- ============================================
-- SECTION 6: course_enrollments (with booking_id!)
-- ============================================
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

-- SECURITY FIX: No public read - enrollment data is private
-- Only enrolled user can read their own enrollment
create policy course_enrollments_owner_read on public.course_enrollments
  for select to authenticated
  using (user_id = auth.uid());

-- Course creator can read enrollments for their course
create policy course_enrollments_creator_read on public.course_enrollments
  for select to authenticated
  using (exists (
    select 1 from public.courses c
    where c.id = course_enrollments.course_id and c.creator_id = auth.uid()
  ));

-- Server-side insert only (payment-verified via RPC)
create policy course_enrollments_auth_insert on public.course_enrollments
  for insert to authenticated
  with check (user_id = auth.uid());

-- Immutable - no updates or deletes
create policy course_enrollments_no_update on public.course_enrollments
  for update to authenticated using (false);

create policy course_enrollments_no_delete on public.course_enrollments
  for delete to authenticated using (false);

-- ============================================
-- SECTION 7: course_lesson_progress (with video_position!)
-- ============================================
create table if not exists public.course_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.course_enrollments(id) on delete cascade,
  lesson_id uuid not null references public.course_lessons(id) on delete cascade,
  video_position integer not null default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enrollment_id, lesson_id)
);

create index if not exists course_lesson_progress_enrollment_id_idx on public.course_lesson_progress(enrollment_id);
create index if not exists course_lesson_progress_lesson_id_idx on public.course_lesson_progress(lesson_id);

alter table public.course_lesson_progress enable row level security;

revoke all on table public.course_lesson_progress from public, anon, authenticated;

create policy course_lesson_progress_owner_read on public.course_lesson_progress
  for select to authenticated
  using (exists (
    select 1 from public.course_enrollments ce
    where ce.id = course_lesson_progress.enrollment_id and ce.user_id = auth.uid()
  ));

create policy course_lesson_progress_creator_read on public.course_lesson_progress
  for select to authenticated
  using (exists (
    select 1 from public.course_enrollments ce
    join public.courses c on c.id = ce.course_id
    where ce.id = course_lesson_progress.enrollment_id and c.creator_id = auth.uid()
  ));

create policy course_lesson_progress_enrolled_write on public.course_lesson_progress
  for all to authenticated
  using (exists (
    select 1 from public.course_enrollments ce
    where ce.id = course_lesson_progress.enrollment_id and ce.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.course_enrollments ce
    where ce.id = course_lesson_progress.enrollment_id and ce.user_id = auth.uid()
  ));

create or replace function public.set_course_lesson_progress_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

drop trigger if exists course_lesson_progress_set_updated_at on public.course_lesson_progress;
create trigger course_lesson_progress_set_updated_at before update on public.course_lesson_progress
  for each row execute function public.set_course_lesson_progress_updated_at();

-- ============================================
-- SECTION 8: course_quiz_attempts
-- ============================================
create table if not exists public.course_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.course_enrollments(id) on delete cascade,
  quiz_id uuid not null references public.course_quizzes(id) on delete cascade,
  attempt_number integer not null default 1 check (attempt_number >= 1),
  score integer check (score is null or (score >= 0 and score <= 100)),
  passed boolean,
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (quiz_id, enrollment_id, attempt_number)
);

create index if not exists course_quiz_attempts_enrollment_id_idx on public.course_quiz_attempts(enrollment_id);
create index if not exists course_quiz_attempts_quiz_id_idx on public.course_quiz_attempts(quiz_id);

alter table public.course_quiz_attempts enable row level security;

revoke all on table public.course_quiz_attempts from public, anon, authenticated;

create policy course_quiz_attempts_owner_read on public.course_quiz_attempts
  for select to authenticated
  using (exists (
    select 1 from public.course_enrollments ce
    where ce.id = course_quiz_attempts.enrollment_id and ce.user_id = auth.uid()
  ));

create policy course_quiz_attempts_creator_read on public.course_quiz_attempts
  for select to authenticated
  using (exists (
    select 1 from public.course_enrollments ce
    join public.courses c on c.id = ce.course_id
    where ce.id = course_quiz_attempts.enrollment_id and c.creator_id = auth.uid()
  ));

create policy course_quiz_attempts_enrolled_write on public.course_quiz_attempts
  for all to authenticated
  using (exists (
    select 1 from public.course_enrollments ce
    where ce.id = course_quiz_attempts.enrollment_id and ce.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.course_enrollments ce
    where ce.id = course_quiz_attempts.enrollment_id and ce.user_id = auth.uid()
  ));

-- ============================================
-- SECTION 9: course_reviews
-- ============================================
create table if not exists public.course_reviews (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, user_id)
);

create index if not exists course_reviews_course_id_idx on public.course_reviews(course_id);
create index if not exists course_reviews_user_id_idx on public.course_reviews(user_id);

alter table public.course_reviews enable row level security;

revoke all on table public.course_reviews from public, anon, authenticated;

create policy course_reviews_public_read on public.course_reviews
  for select to anon, authenticated
  using (exists (
    select 1 from public.courses c
    where c.id = course_reviews.course_id and c.status = 'published'
  ));

create policy course_reviews_enrolled_insert on public.course_reviews
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.course_enrollments ce
      where ce.course_id = course_reviews.course_id and ce.user_id = auth.uid()
    )
  );

create policy course_reviews_owner_update on public.course_reviews
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy course_reviews_owner_delete on public.course_reviews
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.courses c
      where c.id = course_reviews.course_id and c.creator_id = auth.uid()
    )
  );

create or replace function public.set_course_review_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

drop trigger if exists course_reviews_set_updated_at on public.course_reviews;
create trigger course_reviews_set_updated_at before update on public.course_reviews
  for each row execute function public.set_course_review_updated_at();

-- ============================================
-- SECTION 10: Storage buckets
-- ============================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-videos', 'course-videos', false, 2147483648, array['video/mp4', 'video/webm'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-resources', 'course-resources', false, 104857600, array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip', 'image/jpeg', 'image/png', 'image/webp', 'text/plain'])
on conflict (id) do nothing;

-- RLS for course-videos
create policy course_videos_auth_read on storage.objects
  for select to authenticated
  using (bucket_id = 'course-videos');

create policy course_videos_auth_write on storage.objects
  for all to authenticated
  using (bucket_id = 'course-videos')
  with check (bucket_id = 'course-videos');

-- RLS for course-resources
create policy course_resources_auth_read on storage.objects
  for select to authenticated
  using (bucket_id = 'course-resources');

create policy course_resources_auth_write on storage.objects
  for all to authenticated
  using (bucket_id = 'course-resources')
  with check (bucket_id = 'course-resources');

-- ============================================
-- SECTION 11: Commerce RPCs
-- ============================================

-- Get or create course offering
create or replace function public.get_or_create_course_offering(p_course_id uuid)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare
  offering_id uuid;
  course_price bigint;
  existing offerings%rowtype;
begin
  select (config->>'price')::bigint into course_price
  from public.courses where id = p_course_id;
  if course_price is null then course_price := 0; end if;

  select * into existing from public.offerings o
  where o.kind = 'course' and o.config->>'courseId' = p_course_id::text;
  
  if existing.id is not null then
    return jsonb_build_object('offeringId', existing.id, 'sessionId', null, 'created', false);
  end if;

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

  return jsonb_build_object('offeringId', offering_id, 'sessionId', null, 'created', true);
end;
$$;

revoke all on function public.get_or_create_course_offering(uuid) from public, anon, authenticated;
grant execute on function public.get_or_create_course_offering(uuid) to authenticated;

-- Enroll learner after payment
create or replace function public.enroll_learner_in_course(p_booking_id uuid)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare
  v_session_id uuid;
  v_course_id uuid;
  v_learner_id uuid;
  v_offering_id uuid;
  v_offering_kind text;
  existing_enrollment course_enrollments%rowtype;
begin
  select b.session_id, s.offering_id, b.learner_id
  into v_session_id, v_offering_id, v_learner_id
  from public.bookings b
  join public.sessions s on s.id = b.session_id
  where b.id = p_booking_id;

  if v_session_id is null or v_offering_id is null then
    raise exception 'BOOKING_SESSION_NOT_FOUND' using errcode = '22023';
  end if;

  select kind into v_offering_kind from public.offerings where id = v_offering_id;

  if v_offering_kind <> 'course' then
    return jsonb_build_object('enrollmentId', null, 'courseId', null, 'userId', v_learner_id, 'enrolled', false, 'skipped', true, 'reason', 'not_a_course_offering');
  end if;

  select (config->>'courseId')::uuid into v_course_id from public.offerings where id = v_offering_id;

  if v_course_id is null then
    raise exception 'NOT_A_COURSE_OFFERING' using errcode = '22023';
  end if;

  select * into existing_enrollment
  from public.course_enrollments
  where course_id = v_course_id and user_id = v_learner_id;

  if existing_enrollment.id is not null then
    return jsonb_build_object('enrollmentId', existing_enrollment.id, 'courseId', v_course_id, 'userId', v_learner_id, 'enrolled', false, 'alreadyEnrolled', true);
  end if;

  insert into public.course_enrollments(course_id, user_id, booking_id)
  values (v_course_id, v_learner_id, p_booking_id)
  returning id into existing_enrollment.id;

  return jsonb_build_object('enrollmentId', existing_enrollment.id, 'courseId', v_course_id, 'userId', v_learner_id, 'enrolled', true, 'alreadyEnrolled', false);
end;
$$;

revoke all on function public.enroll_learner_in_course(uuid) from public, anon, authenticated;
grant execute on function public.enroll_learner_in_course(uuid) to service_role;

-- Get course enrollment
create or replace function public.get_course_enrollment(p_course_id uuid)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare
  uid uuid := auth.uid();
  enrollment course_enrollments%rowtype;
begin
  if uid is null then raise insufficient_privilege; end if;

  select * into enrollment from public.course_enrollments
  where course_id = p_course_id and user_id = uid;

  if enrollment.id is null then return null; end if;

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

-- List my enrollments
create or replace function public.list_my_course_enrollments()
returns jsonb language plpgsql security definer set search_path=public
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
