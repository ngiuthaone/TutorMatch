-- Workshop V1 schema reconciliation:
-- Adds workshop-specific columns to the existing offerings table
-- (created by 20260819120000_shared_booking_engine.sql with kind/slug/creator_id/config).
-- Also extends bookings pricing CHECK constraint for flat_per_participant_v1,
-- idempotency key, and extends cancelled_by check constraints.
--
-- NOTE: Production already has pricing_unit_price_vnd and pricing_participant_count
-- on bookings (added by a prior migration). This migration uses those columns
-- instead of pricing_price_per_participant_vnd.

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
-- (additive constraint, only enforced when pricing_model is set).
-- The column-level CHECK above auto-named its constraint offerings_pricing_model_check,
-- so drop that name first to avoid collision with the table-level cross-column CHECK.
ALTER TABLE public.offerings
  DROP CONSTRAINT IF EXISTS offerings_pricing_model_check;

ALTER TABLE public.offerings
  ADD CONSTRAINT offerings_pricing_pair_check CHECK (
    pricing_model IS NULL
    OR (pricing_model = 'hourly_v1' AND hourly_rate_vnd IS NOT NULL AND price_per_participant_vnd IS NULL)
    OR (pricing_model = 'flat_per_participant_v1' AND price_per_participant_vnd IS NOT NULL AND hourly_rate_vnd IS NULL)
  );

-- 2. Extend bookings pricing CHECK constraint for flat_per_participant_v1
-- Uses production column names: pricing_unit_price_vnd + pricing_participant_count.
-- Keeps fixed_v1 support for existing production data.
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_pricing_snapshot_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_pricing_snapshot_check CHECK (
    (pricing_amount_vnd IS NULL AND pricing_currency IS NULL
     AND pricing_hourly_rate_vnd IS NULL AND pricing_duration_minutes IS NULL
     AND pricing_unit_price_vnd IS NULL AND pricing_participant_count IS NULL
     AND pricing_model IS NULL AND pricing_snapshotted_at IS NULL)
    OR
    (pricing_currency = 'VND'
     AND pricing_model IS NOT NULL AND pricing_snapshotted_at IS NOT NULL
     AND (
       (pricing_model = 'hourly_v1'
        AND pricing_amount_vnd > 0
        AND pricing_hourly_rate_vnd >= 50000 AND pricing_hourly_rate_vnd <= 10000000
        AND pricing_duration_minutes > 0
        AND pricing_unit_price_vnd IS NULL)
       OR
       (pricing_model = 'fixed_v1'
        AND pricing_amount_vnd >= 0
        AND pricing_unit_price_vnd >= 0
        AND pricing_participant_count >= 1
        AND pricing_hourly_rate_vnd IS NULL
        AND pricing_duration_minutes IS NULL)
       OR
       (pricing_model = 'flat_per_participant_v1'
        AND pricing_amount_vnd > 0
        AND pricing_unit_price_vnd > 0
        AND pricing_participant_count >= 1
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
