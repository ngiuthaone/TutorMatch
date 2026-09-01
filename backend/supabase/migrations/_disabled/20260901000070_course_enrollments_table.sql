-- 20260901000070_course_enrollments_table.sql
-- Creates public.course_enrollments for tracking learner enrollment in courses.
-- Commerce uses existing payment infrastructure; enrollment created after finalize_paid_booking.
set search_path = '';

create table if not exists public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (course_id, user_id)
);

create index if not exists course_enrollments_user_id_idx on public.course_enrollments(user_id);
create index if not exists course_enrollments_course_id_idx on public.course_enrollments(course_id);

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

-- Authenticated users can insert enrollment (server-side check via RPC for payment verification)
drop policy if exists course_enrollments_auth_insert on public.course_enrollments;
create policy course_enrollments_auth_insert on public.course_enrollments
  for insert to authenticated
  with check (user_id = auth.uid());

-- No updates allowed after creation (immutable enrollment record)
-- Deletion not allowed (permanent record)
drop policy if exists course_enrollments_no_update on public.course_enrollments;
create policy course_enrollments_no_update on public.course_enrollments
  for update to authenticated
  using (false);

drop policy if exists course_enrollments_no_delete on public.course_enrollments;
create policy course_enrollments_no_delete on public.course_enrollments
  for delete to authenticated
  using (false);
