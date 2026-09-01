-- Final pass: drop legacy 2-arg create_booking overload.
-- This must run AFTER all other migrations because several migrations
-- (e.g. 20260819120000_shared_booking_engine.sql) `create or replace`
-- the 2-arg form. The canonical 3-arg signature (with p_idempotency_key
-- default null) is the surviving one.
--
-- Idempotent: safe to re-run.
set search_path = '';

drop function if exists public.create_booking(uuid, integer);
