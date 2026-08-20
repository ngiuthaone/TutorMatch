-- Extend check constraints to include 'system' for automated TTL expiration
-- and minimum_not_met cancellations. Original constraints only allowed
-- 'attendee' and 'host'.

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_cancelled_by_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_cancelled_by_check
  CHECK (cancelled_by IN ('attendee', 'host', 'system'));

ALTER TABLE public.booking_history
  DROP CONSTRAINT IF EXISTS booking_history_actor_check;

ALTER TABLE public.booking_history
  ADD CONSTRAINT booking_history_actor_check
  CHECK (actor IN ('attendee', 'host', 'system'));
