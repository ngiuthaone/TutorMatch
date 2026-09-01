-- 20260901000040_course_lessons_table.sql
-- Creates public.course_lessons and course_lesson_type enum.
set search_path = '';

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

-- Public/creator read: course is published OR user is creator
drop policy if exists course_lessons_public_read on public.course_lessons;
create policy course_lessons_public_read on public.course_lessons
  for select to authenticated
  using (
    exists (
      select 1 from public.courses c
      join public.course_sections cs on cs.course_id = c.id
      where cs.id = course_lessons.section_id
      and (c.status = 'published' or c.creator_id = auth.uid())
    )
  );

-- Creator full access
drop policy if exists course_lessons_creator_all on public.course_lessons;
create policy course_lessons_creator_all on public.course_lessons
  for all to authenticated
  using (
    exists (
      select 1 from public.courses c
      join public.course_sections cs on cs.course_id = c.id
      where cs.id = course_lessons.section_id
      and c.creator_id = auth.uid()
    )
  );

-- updated_at trigger function
create or replace function public.set_course_lesson_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

revoke all on function public.set_course_lesson_updated_at() from public, anon, authenticated;

drop trigger if exists course_lessons_set_updated_at on public.course_lessons;
create trigger course_lessons_set_updated_at
  before update on public.course_lessons
  for each row execute function public.set_course_lesson_updated_at();
