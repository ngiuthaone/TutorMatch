-- 20260901000100_course_reviews_table.sql
-- Creates public.course_reviews for course ratings and feedback.
set search_path = '';

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

-- Public can read reviews for published courses
drop policy if exists course_reviews_public_read on public.course_reviews;
create policy course_reviews_public_read on public.course_reviews
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.courses c
      where c.id = course_reviews.course_id
        and c.status = 'published'
    )
  );

-- Enrolled learner can create one review per course (server-side enrollment check in RPC)
drop policy if exists course_reviews_enrolled_insert on public.course_reviews;
create policy course_reviews_enrolled_insert on public.course_reviews
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.course_enrollments ce
      where ce.course_id = course_reviews.course_id
        and ce.user_id = auth.uid()
    )
  );

-- Only review owner can update
drop policy if exists course_reviews_owner_update on public.course_reviews;
create policy course_reviews_owner_update on public.course_reviews
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Course creator OR review owner can delete
drop policy if exists course_reviews_owner_delete on public.course_reviews;
create policy course_reviews_owner_delete on public.course_reviews
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.courses c
      where c.id = course_reviews.course_id
        and c.creator_id = auth.uid()
    )
  );

-- updated_at trigger function
create or replace function public.set_course_review_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

revoke all on function public.set_course_review_updated_at() from public, anon, authenticated;

drop trigger if exists course_reviews_set_updated_at on public.course_reviews;
create trigger course_reviews_set_updated_at
  before update on public.course_reviews
  for each row execute function public.set_course_review_updated_at();
