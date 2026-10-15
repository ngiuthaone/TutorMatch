-- 20260907000005_course_captions.sql
-- Captions/VTT files for course lessons (multi-language)
set search_path = '';

create table if not exists public.course_captions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.course_lessons(id) on delete cascade,
  language text not null check (char_length(btrim(language)) between 2 and 10),
  file_path text not null,
  file_format text not null default 'vtt' check (file_format in ('vtt', 'srt')),
  file_size bigint not null check (file_size > 0 and file_size <= 5242880),
  status text not null default 'ready' check (status in ('processing', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, language)
);

create index if not exists course_captions_lesson_id_idx on public.course_captions(lesson_id);

alter table public.course_captions enable row level security;

revoke all on table public.course_captions from public, anon, authenticated;

-- Creator can read/write captions for their own course lessons
create policy course_captions_creator_all on public.course_captions
  for all to authenticated
  using (exists (
    select 1 from public.course_lessons cl
    join public.course_sections cs on cs.id = cl.section_id
    join public.courses c on c.id = cs.course_id
    where cl.id = course_captions.lesson_id and c.creator_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.course_lessons cl
    join public.course_sections cs on cs.id = cl.section_id
    join public.courses c on c.id = cs.course_id
    where cl.id = course_captions.lesson_id and c.creator_id = auth.uid()
  ));

-- Enrolled learners can read captions for their course lessons
create policy course_captions_enrolled_read on public.course_captions
  for select to authenticated
  using (exists (
    select 1 from public.course_lessons cl
    join public.course_sections cs on cs.id = cl.section_id
    join public.courses c on c.id = cs.course_id
    join public.course_enrollments ce on ce.course_id = c.id
    where cl.id = course_captions.lesson_id and ce.user_id = auth.uid()
  ));

-- Add VTT/SRT mime types to course-videos bucket
update storage.buckets
set allowed_mime_types = array['video/mp4', 'video/webm', 'text/vtt', 'application/x-subrip', 'text/srt']
where id = 'course-videos';

create or replace function public.set_course_caption_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

drop trigger if exists course_captions_set_updated_at on public.course_captions;
create trigger course_captions_set_updated_at before update on public.course_captions
  for each row execute function public.set_course_caption_updated_at();
