-- 20260915000030_course_table_grants.sql
-- Grants for course tables to authenticated (RLS governs access; base grants
-- were revoked in 20260902000000_course_schema_v1.sql but no grants were
-- re-issued, so all course_* operations returned 42501).
set search_path = '';

grant select, insert, update, delete on table public.courses to authenticated;
grant select, insert, update, delete on table public.course_sections to authenticated;
grant select, insert, update, delete on table public.course_lessons to authenticated;
grant select, insert, update, delete on table public.course_resources to authenticated;
grant select, insert, update, delete on table public.course_quizzes to authenticated;
grant select, insert, update, delete on table public.course_quiz_questions to authenticated;
grant select, insert, update, delete on table public.course_quiz_options to authenticated;
grant select, insert, update, delete on table public.course_captions to authenticated;
grant select, insert, update, delete on table public.course_coupons to authenticated;
grant select, insert, update, delete on table public.course_faqs to authenticated;
grant select, insert, update, delete on table public.course_enrollments to authenticated;
grant select, insert, update, delete on table public.course_lesson_progress to authenticated;
grant select, insert, update, delete on table public.course_quiz_attempts to authenticated;
grant select, insert, update, delete on table public.course_reviews to authenticated;

grant select on table public.courses to anon;
grant select on table public.course_sections to anon;
grant select on table public.course_lessons to anon;
grant select on table public.course_resources to anon;
grant select on table public.course_quizzes to anon;
grant select on table public.course_quiz_questions to anon;
grant select on table public.course_quiz_options to anon;
grant select on table public.course_captions to anon;
grant select on table public.course_coupons to anon;
grant select on table public.course_faqs to anon;
grant select on table public.course_reviews to anon;