-- 20260901000080_course_lesson_progress_table.sql
-- Creates public.course_lesson_progress for tracking learner progress through lessons.
set search_path = '';

create table if not exists public.course_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.course_enrollments(id) on delete cascade,
  lesson_id uuid not null references public.course_lessons(id) on delete cascade,
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

-- Enrolled learner can read their own progress
drop policy if exists course_lesson_progress_owner_read on public.course_lesson_progress;
create policy course_lesson_progress_owner_read on public.course_lesson_progress
  for select to authenticated
  using (
    exists (
      select 1 from public.course_enrollments ce
      where ce.id = course_lesson_progress.enrollment_id
        and ce.user_id = auth.uid()
    )
  );

-- Course creator can read all progress for their course
drop policy if exists course_lesson_progress_creator_read on public.course_lesson_progress;
create policy course_lesson_progress_creator_read on public.course_lesson_progress
  for select to authenticated
  using (
    exists (
      select 1 from public.course_enrollments ce
      join public.courses c on c.id = ce.course_id
      where ce.id = course_lesson_progress.enrollment_id
        and c.creator_id = auth.uid()
    )
  );

-- Only enrolled learner can insert/update their own progress
drop policy if exists course_lesson_progress_enrolled_write on public.course_lesson_progress;
create policy course_lesson_progress_enrolled_write on public.course_lesson_progress
  for all to authenticated
  using (
    exists (
      select 1 from public.course_enrollments ce
      where ce.id = course_lesson_progress.enrollment_id
        and ce.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.course_enrollments ce
      where ce.id = course_lesson_progress.enrollment_id
        and ce.user_id = auth.uid()
    )
  );

-- updated_at trigger function
create or replace function public.set_course_lesson_progress_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

revoke all on function public.set_course_lesson_progress_updated_at() from public, anon, authenticated;

drop trigger if exists course_lesson_progress_set_updated_at on public.course_lesson_progress;
create trigger course_lesson_progress_set_updated_at
  before update on public.course_lesson_progress
  for each row execute function public.set_course_lesson_progress_updated_at();
