/**
 * Tutoria refund calculation — pure domain logic for server-authoritative
 * refund amounts based on cancellation policy bands.
 *
 * This module is stateless and dependency-free. It computes refund amounts
 * from authoritative inputs (booking snapshot, session schedule, cancellation
 * actor) and never persists or mutates state.
 *
 * Cancellation bands (EXACT policy from Business Launch Readiness V1 §5):
 *   - Host cancellation: always 100% refund, no host payout, no commission.
 *   - Learner cancellation >=24h before session start: 100% refund.
 *   - Learner cancellation 6-24h before session start: 50% refund.
 *   - Learner cancellation <6h before session start: 0% refund.
 *   - No-show (learner or host): 0% refund.
 *   - Free bookings (price <= 0): always 0 refund.
 *
 * Commission is always on the non-refunded value (10% V1 policy).
 * 0% learner service fee V1.
 *
 * IMPORTANT: This module only computes the refund amount. It does NOT
 * issue refunds, move money, or change booking/payment status. The
 * integration layer (RPC/service) applies the result.
 */

export type CancellationActor = "host" | "attendee";

export type RefundReason =
  | "host_cancellation"
  | "cancellation_band"
  | "free_booking"
  | "no_show";

export interface RefundCalculationInput {
  /** Price snapshot from booking_policy_snapshots (VND, non-negative). */
  priceSnapshotVnd: number;
  /** Session start time (ISO 8601). */
  sessionStartsAt: string;
  /** Current wall-clock time for band calculation. */
  now: Date;
  /** Who initiated the cancellation. */
  cancellationActor: CancellationActor;
  /** Whether this is a no-show (overrides time-based bands). */
  isNoShow?: boolean;
}

export interface RefundCalculationResult {
  /** Refund amount in VND (non-negative integer). */
  refundAmountVnd: number;
  /** Refund percentage (0, 50, or 100). */
  refundPercentage: number;
  /** Why this refund amount was calculated. */
  reason: RefundReason;
  /** Hours until session start at time of calculation (null for no-show). */
  hoursUntilStart: number | null;
  /** Original price for audit trail. */
  priceVnd: number;
}

/**
 * Compute the server-authoritative refund amount. This is the single source
 * of refund truth — the frontend renders this value but can never override it.
 */
export function calculateRefundAmount(
  input: RefundCalculationInput,
): RefundCalculationResult {
  const { priceSnapshotVnd, sessionStartsAt, now, cancellationActor, isNoShow } = input;

  // Free bookings: zero refund.
  if (priceSnapshotVnd <= 0) {
    return {
      refundAmountVnd: 0,
      refundPercentage: 0,
      reason: "free_booking",
      hoursUntilStart: null,
      priceVnd: priceSnapshotVnd,
    };
  }

  // No-show: always 0% refund regardless of actor.
  if (isNoShow) {
    return {
      refundAmountVnd: 0,
      refundPercentage: 0,
      reason: "no_show",
      hoursUntilStart: null,
      priceVnd: priceSnapshotVnd,
    };
  }

  // Host cancellation: always 100% refund.
  if (cancellationActor === "host") {
    return {
      refundAmountVnd: priceSnapshotVnd,
      refundPercentage: 100,
      reason: "host_cancellation",
      hoursUntilStart: computeHoursUntilStart(sessionStartsAt, now),
      priceVnd: priceSnapshotVnd,
    };
  }

  // Learner cancellation: time-based bands.
  const hoursUntilStart = computeHoursUntilStart(sessionStartsAt, now);
  let refundPercentage: number;

  if (hoursUntilStart >= 24) {
    refundPercentage = 100;
  } else if (hoursUntilStart >= 6) {
    refundPercentage = 50;
  } else {
    refundPercentage = 0;
  }

  const refundAmountVnd = Math.floor((priceSnapshotVnd * refundPercentage) / 100);

  return {
    refundAmountVnd,
    refundPercentage,
    reason: "cancellation_band",
    hoursUntilStart,
    priceVnd: priceSnapshotVnd,
  };
}

/**
 * Compute hours between now and session start. Negative values indicate
 * the session has already started.
 */
export function computeHoursUntilStart(
  sessionStartsAt: string,
  now: Date,
): number {
  const startMs = Date.parse(sessionStartsAt);
  if (Number.isNaN(startMs)) return -1;
  return (startMs - now.getTime()) / (1000 * 60 * 60);
}

/**
 * Commission on non-refunded value (10% V1 policy). 0% learner service fee.
 * Full refund produces zero commission; partial refund reduces commission base.
 */
export function calculateCommission(
  priceVnd: number,
  refundAmountVnd: number,
  commissionRateBps: number = 1000, // 10% = 1000 basis points
): number {
  if (priceVnd <= 0) return 0;
  const nonRefunded = priceVnd - refundAmountVnd;
  if (nonRefunded <= 0) return 0;
  return Math.floor((nonRefunded * commissionRateBps) / 10000);
}

export type RefundCalculationErrorCode = "INVALID_INPUT";

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: RefundCalculationErrorCode; message: string } };

/**
 * Safe wrapper with validation. Returns a Result type for integration layers
 * that prefer structured errors over thrown exceptions.
 */
export function calculateRefundAmountSafe(
  input: RefundCalculationInput,
): Result<RefundCalculationResult> {
  if (input.priceSnapshotVnd < 0) {
    return {
      ok: false,
      error: { code: "INVALID_INPUT", message: "priceSnapshotVnd must be non-negative" },
    };
  }
  if (!input.sessionStartsAt) {
    return {
      ok: false,
      error: { code: "INVALID_INPUT", message: "sessionStartsAt is required" },
    };
  }
  if (input.cancellationActor !== "host" && input.cancellationActor !== "attendee") {
    return {
      ok: false,
      error: { code: "INVALID_INPUT", message: "cancellationActor must be 'host' or 'attendee'" },
    };
  }
  return { ok: true, value: calculateRefundAmount(input) };
}
