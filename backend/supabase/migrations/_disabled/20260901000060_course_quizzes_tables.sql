-- 20260901000060_course_quizzes_tables.sql
-- Creates public.course_quizzes, course_quiz_questions, and course_quiz_options.
set search_path = '';

-- course_quizzes: one quiz per lesson (lesson_type = 'quiz')
create table if not exists public.course_quizzes (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null unique references public.course_lessons(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  passing_score integer not null default 70 check (passing_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists course_quizzes_lesson_id_idx on public.course_quizzes(lesson_id);

-- course_quiz_questions: questions within a quiz
create table if not exists public.course_quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.course_quizzes(id) on delete cascade,
  question_text text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (quiz_id, position)
);

create index if not exists course_quiz_questions_quiz_id_idx on public.course_quiz_questions(quiz_id);

-- course_quiz_options: answer options for each question
create table if not exists public.course_quiz_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.course_quiz_questions(id) on delete cascade,
  option_text text not null,
  is_correct boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists course_quiz_options_question_id_idx on public.course_quiz_options(question_id);

-- RLS for course_quizzes
alter table public.course_quizzes enable row level security;
revoke all on table public.course_quizzes from public, anon, authenticated;

drop policy if exists course_quizzes_public_read on public.course_quizzes;
create policy course_quizzes_public_read on public.course_quizzes
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.course_lessons cl
      join public.course_sections cs on cs.id = cl.section_id
      join public.courses c on c.id = cs.course_id
      where cl.id = course_quizzes.lesson_id
        and (c.status = 'published' or c.creator_id = auth.uid())
    )
  );

drop policy if exists course_quizzes_creator_write on public.course_quizzes;
create policy course_quizzes_creator_write on public.course_quizzes
  for all to authenticated
  using (
    exists (
      select 1 from public.course_lessons cl
      join public.course_sections cs on cs.id = cl.section_id
      join public.courses c on c.id = cs.course_id
      where cl.id = course_quizzes.lesson_id
        and c.creator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.course_lessons cl
      join public.course_sections cs on cs.id = cl.section_id
      join public.courses c on c.id = cs.course_id
      where cl.id = course_quizzes.lesson_id
        and c.creator_id = auth.uid()
    )
  );

-- RLS for course_quiz_questions
alter table public.course_quiz_questions enable row level security;
revoke all on table public.course_quiz_questions from public, anon, authenticated;

drop policy if exists course_quiz_questions_public_read on public.course_quiz_questions;
create policy course_quiz_questions_public_read on public.course_quiz_questions
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.course_quizzes cq
      join public.course_lessons cl on cl.id = cq.lesson_id
      join public.course_sections cs on cs.id = cl.section_id
      join public.courses c on c.id = cs.course_id
      where cq.id = course_quiz_questions.quiz_id
        and (c.status = 'published' or c.creator_id = auth.uid())
    )
  );

drop policy if exists course_quiz_questions_creator_write on public.course_quiz_questions;
create policy course_quiz_questions_creator_write on public.course_quiz_questions
  for all to authenticated
  using (
    exists (
      select 1 from public.course_quizzes cq
      join public.course_lessons cl on cl.id = cq.lesson_id
      join public.course_sections cs on cs.id = cl.section_id
      join public.courses c on c.id = cs.course_id
      where cq.id = course_quiz_questions.quiz_id
        and c.creator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.course_quizzes cq
      join public.course_lessons cl on cl.id = cq.lesson_id
      join public.course_sections cs on cs.id = cl.section_id
      join public.courses c on c.id = cs.course_id
      where cq.id = course_quiz_questions.quiz_id
        and c.creator_id = auth.uid()
    )
  );

-- RLS for course_quiz_options
alter table public.course_quiz_options enable row level security;
revoke all on table public.course_quiz_options from public, anon, authenticated;

drop policy if exists course_quiz_options_public_read on public.course_quiz_options;
create policy course_quiz_options_public_read on public.course_quiz_options
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.course_quiz_questions cqq
      join public.course_quizzes cq on cq.id = cqq.quiz_id
      join public.course_lessons cl on cl.id = cq.lesson_id
      join public.course_sections cs on cs.id = cl.section_id
      join public.courses c on c.id = cs.course_id
      where cqq.id = course_quiz_options.question_id
        and (c.status = 'published' or c.creator_id = auth.uid())
    )
  );

drop policy if exists course_quiz_options_creator_write on public.course_quiz_options;
create policy course_quiz_options_creator_write on public.course_quiz_options
  for all to authenticated
  using (
    exists (
      select 1 from public.course_quiz_questions cqq
      join public.course_quizzes cq on cq.id = cqq.quiz_id
      join public.course_lessons cl on cl.id = cq.lesson_id
      join public.course_sections cs on cs.id = cl.section_id
      join public.courses c on c.id = cs.course_id
      where cqq.id = course_quiz_options.question_id
        and c.creator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.course_quiz_questions cqq
      join public.course_quizzes cq on cq.id = cqq.quiz_id
      join public.course_lessons cl on cl.id = cq.lesson_id
      join public.course_sections cs on cs.id = cl.section_id
      join public.courses c on c.id = cs.course_id
      where cqq.id = course_quiz_options.question_id
        and c.creator_id = auth.uid()
    )
  );

-- updated_at trigger for quizzes
create or replace function public.set_course_quiz_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

revoke all on function public.set_course_quiz_updated_at() from public, anon, authenticated;

drop trigger if exists course_quizzes_set_updated_at on public.course_quizzes;
create trigger course_quizzes_set_updated_at
  before update on public.course_quizzes
  for each row execute function public.set_course_quiz_updated_at();
