-- 20260901000090_course_quiz_attempts_table.sql
-- Creates public.course_quiz_attempts for tracking quiz attempt history.
set search_path = '';

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

-- Enrolled learner can read their own attempts
drop policy if exists course_quiz_attempts_owner_read on public.course_quiz_attempts;
create policy course_quiz_attempts_owner_read on public.course_quiz_attempts
  for select to authenticated
  using (
    exists (
      select 1 from public.course_enrollments ce
      where ce.id = course_quiz_attempts.enrollment_id
        and ce.user_id = auth.uid()
    )
  );

-- Course creator can read all attempts for their course
drop policy if exists course_quiz_attempts_creator_read on public.course_quiz_attempts;
create policy course_quiz_attempts_creator_read on public.course_quiz_attempts
  for select to authenticated
  using (
    exists (
      select 1 from public.course_enrollments ce
      join public.courses c on c.id = ce.course_id
      where ce.id = course_quiz_attempts.enrollment_id
        and c.creator_id = auth.uid()
    )
  );

-- Only enrolled learner can insert/update their own attempts
drop policy if exists course_quiz_attempts_enrolled_write on public.course_quiz_attempts;
create policy course_quiz_attempts_enrolled_write on public.course_quiz_attempts
  for all to authenticated
  using (
    exists (
      select 1 from public.course_enrollments ce
      where ce.id = course_quiz_attempts.enrollment_id
        and ce.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.course_enrollments ce
      where ce.id = course_quiz_attempts.enrollment_id
        and ce.user_id = auth.uid()
    )
  );
