-- 20260901000050_course_resources_table.sql
-- Creates public.course_resources for downloadable files attached to lessons.
set search_path = '';

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

-- Public read: resources for published courses or course creator
drop policy if exists course_resources_public_read on public.course_resources;
create policy course_resources_public_read on public.course_resources
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.course_lessons cl
      join public.course_sections cs on cs.id = cl.section_id
      join public.courses c on c.id = cs.course_id
      where cl.id = course_resources.lesson_id
        and (c.status = 'published' or c.creator_id = auth.uid())
    )
  );

-- Only course creator can insert/update/delete
drop policy if exists course_resources_creator_write on public.course_resources;
create policy course_resources_creator_write on public.course_resources
  for all to authenticated
  using (
    exists (
      select 1 from public.course_lessons cl
      join public.course_sections cs on cs.id = cl.section_id
      join public.courses c on c.id = cs.course_id
      where cl.id = course_resources.lesson_id
        and c.creator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.course_lessons cl
      join public.course_sections cs on cs.id = cl.section_id
      join public.courses c on c.id = cs.course_id
      where cl.id = course_resources.lesson_id
        and c.creator_id = auth.uid()
    )
  );
