-- Consolidate create_booking overloads (Layer A exit criterion).
--
-- 20260821000000_booking_learner_contact introduced a 7-arg create_booking
-- overload that captured learner contact info. With that overload present,
-- the legacy 2-arg and 3-arg calls become ambiguous (PostgREST PGRST203:
-- could not choose best candidate).
--
-- Until the learner-contact capture flow is wired into the Fastify route
-- handlers and the matching integration tests are updated, collapse to a
-- single create_booking overload that accepts session_id, participant_count,
-- and an optional p_idempotency_key. The 7-arg and 2-arg overloads are
-- dropped; the 3-arg signature from 20260820100001 is the surviving one.
--
-- The learner_* columns on public.bookings stay so they are reusable when
-- the front-end-driven contact capture is added in Layer B.

revoke all on function public.create_booking(uuid, int, text, text, text, text, text) from public, anon, authenticated;
drop function if exists public.create_booking(uuid, int, text, text, text, text, text);

drop function if exists public.create_booking(uuid, int);