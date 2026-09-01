-- Drop legacy 2-argument overloads of create_booking and list_bookable_sessions
-- that cause PostgREST (PGRST203) ambiguity. Multiple historical migrations
-- (0005, 0007, 0008, 20260815090001, 20260819120000) re-create the 2-arg
-- create_booking via `create or replace function`. The canonical signature
-- is the 3-arg create_booking (session_id uuid, participant_count int default 1,
-- p_idempotency_key text default null) defined in 20260831180000. For
-- list_bookable_sessions, the canonical signature is the 3-arg overload
-- (p_tutor_profile_id, p_offering_id, p_kind) which covers all-null calls via
-- default arguments.
--
-- Idempotent: safe to re-run.

set search_path = '';

drop function if exists public.create_booking(uuid, int);
drop function if exists public.list_bookable_sessions(uuid);
