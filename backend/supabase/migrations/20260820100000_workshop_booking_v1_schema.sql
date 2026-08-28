-- Workshop V1 schema reconciliation:
-- Adds workshop-specific columns to the existing offerings table
-- (created by 20260819120000_shared_booking_engine.sql with kind/slug/creator_id/config).
-- Also adds bookings pricing columns for flat_per_participant_v1,
-- idempotency key, and extends cancelled_by check constraints.

-- 1. Add workshop-specific columns to offerings (safe IF NOT EXISTS)
ALTER TABLE public.offerings
  ADD COLUMN IF NOT EXISTS pricing_model text
    CHECK (pricing_model IN ('hourly_v1','flat_per_participant_v1'));

ALTER TABLE public.offerings
  ADD COLUMN IF NOT EXISTS price_per_participant_vnd bigint;

ALTER TABLE public.offerings
  ADD COLUMN IF NOT EXISTS hourly_rate_vnd bigint;

ALTER TABLE public.offerings
  ADD COLUMN IF NOT EXISTS booking_mode text NOT NULL DEFAULT 'approval'
    CHECK (booking_mode IN ('approval','instant'));

-- Pricing model check: hourly requires hourly_rate_vnd, flat requires price_per_participant_vnd
-- (additive constraint, only enforced when pricing_model is set)
ALTER TABLE public.offerings
  ADD CONSTRAINT offerings_pricing_model_check CHECK (
    pricing_model IS NULL
    OR (pricing_model = 'hourly_v1' AND hourly_rate_vnd IS NOT NULL AND price_per_participant_vnd IS NULL)
    OR (pricing_model = 'flat_per_participant_v1' AND price_per_participant_vnd IS NOT NULL AND hourly_rate_vnd IS NULL)
  );

-- 2. Bookings pricing columns for flat_per_participant_v1
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS pricing_price_per_participant_vnd bigint;

COMMENT ON COLUMN public.bookings.pricing_price_per_participant_vnd
  IS 'Price per participant snapshot from offering at booking creation time (flat_per_participant_v1 only)';

-- 3. Extend bookings pricing CHECK constraint for flat_per_participant_v1
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_pricing_snapshot_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_pricing_snapshot_check CHECK (
    (pricing_amount_vnd IS NULL AND pricing_currency IS NULL
     AND pricing_hourly_rate_vnd IS NULL AND pricing_duration_minutes IS NULL
     AND pricing_price_per_participant_vnd IS NULL
     AND pricing_model IS NULL AND pricing_snapshotted_at IS NULL)
    OR
    (pricing_amount_vnd > 0 AND pricing_currency = 'VND'
     AND pricing_model IS NOT NULL AND pricing_snapshotted_at IS NOT NULL
     AND (
       (pricing_model = 'hourly_v1'
        AND pricing_hourly_rate_vnd BETWEEN 50000 AND 10000000
        AND pricing_duration_minutes > 0
        AND pricing_price_per_participant_vnd IS NULL)
       OR
       (pricing_model = 'flat_per_participant_v1'
        AND pricing_price_per_participant_vnd > 0
        AND pricing_hourly_rate_vnd IS NULL
        AND pricing_duration_minutes IS NULL)
     )
    )
  );

-- 4. Extend check constraints to include 'system' for automated TTL / minimum_not_met cancellations
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

-- 5. Idempotency key column + partial unique index for active bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_active_idempotency_key_unique
  ON public.bookings(learner_id, session_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND status IN ('requested', 'confirmed');

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_offerings_pricing_model
  ON public.offerings(pricing_model) WHERE pricing_model IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_status_starts
  ON public.sessions(status, starts_at)
  WHERE status = 'scheduled';
