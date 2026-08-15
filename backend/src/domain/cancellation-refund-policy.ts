/**
 * Tutoria Tutor V1 cancellation + refund policy — pure domain decision module.
 *
 * ACCEPTED_REVERSIBLE_V1_POLICY (accepted in the Tutor V1 cancellation/refund
 * architecture gate; the gate's orchestrator report is the authoritative
 * record and is NOT yet in-repo — this module is the executable record of the
 * accepted decisions. NOTE: docs/tutoria-prd.md and
 * docs/items-5-6-content-marketplace-plan.md, which sibling modules cite, are
 * ABSENT from this worktree (verifier-flagged), and
 * docs/agent-team/DECISIONS-CAPACITY-CONCURRENCY.md holds only capacity/
 * concurrency decisions D1-D10 — nothing is invented here):
 *
 * - P1: a learner cancelling a confirmed, paid booking at least 24 hours
 *   before the scheduled Session start is owed a FULL refund; cancelling
 *   inside the 24-hour window is owed NONE. Exactly one cutoff exists.
 *   The boundary is `startsAt - cancelledAt >= 24h -> FULL`, otherwise
 *   NONE, computed in UTC instant arithmetic (never browser-local date
 *   math). The exact boundary (cancelledAt exactly 24h before startsAt)
 *   IS refundable.
 * - P2: no partial-refund policy exists in Tutor V1. The Payment domain
 *   keeps the technical capability (issueRefund accepts partial amounts),
 *   but no cancellation path here ever produces a partial amount.
 * - P3: cancelling an unpaid booking (requested/unaccepted, or
 *   accepted-but-unpaid) is always allowed, releases capacity, and never
 *   creates a Refund.
 * - P4: a payment still in flight when a booking is cancelled is
 *   superseded by the cancellation: no refund decision exists yet. If the
 *   provider later proves the payment succeeded, the Payment stays
 *   `succeeded` (never rewritten) and the system owes a FULL
 *   `system_compensation` obligation. This module reports that duty as
 *   `compensationOnLateSuccess`; it does not manufacture money.
 * - P5: a tutor cancelling a confirmed, paid booking is owed a FULL refund
 *   to the learner regardless of timing. No penalty/reputation system.
 * - P6: cancelling a whole Session refunds every paid affected booking in
 *   FULL and every unpaid affected booking in NONE; the Session aggregate
 *   is the authority that fans out to bookings.
 * - P7: every FULL refund equals the full captured gross
 *   (Payment.amountVnd); the platform absorbs provider fees. Commission
 *   and fee accounting are separate future decisions.
 * - P9: the cancellation reason is optional and is never a policy input;
 *   actor + timestamp remain the authoritative audit facts.
 *
 * Deliberately NOT decided / OUT OF SCOPE here (tracked for later phases):
 * - Transactional SQL, refund execution, provider (VNPay) integration,
 *   querydr reconciliation, the durable outbox consumer, and HTTP wiring:
 *   all Phase 2/3 work.
 * - No-show financial consequences: a Session that already started is
 *   classified (SESSION_ALREADY_STARTED — refund stays governed by P1's
 *   window on the authoritative `startsAt`), it is NOT converted into an
 *   invented no-show policy.
 * - Payouts: no payout design exists; a pending refund obligation blocks
 *   any future payout (Phase 4+).
 *
 * Cancellation legality stays authoritative in booking-lifecycle.ts
 * (applyTransition / canTransition); this module mirrors only the
 * minimal legality needed to decide refund eligibility and never claims
 * to be the transition authority. In particular a HOST cancelling a
 * pending `requested` booking is NOT a valid cancellation (decline is the
 * mechanism, per booking-lifecycle) — this module reports it as such.
 *
 * `system_compensation` is evaluated on a booking that is already terminal
 * (cancelled or rejected): it is the P4 late-success duty, not a new
 * cancellation. It is therefore checked BEFORE the terminal-state guard.
 *
 * This module is pure and dependency-free. It performs no I/O, no
 * persistence, and no authorization against real users. Callers own
 * storage, identity, and payment boundaries.
 */

import type { BookingStatus } from "./booking-lifecycle.js";
import type { PaymentStatus } from "./payment-lifecycle.js";

/** Actor initiating a cancellation. "system" is reserved for automatic compensation. */
export type CancellationActor = "attendee" | "host" | "system";

/**
 * Cancellation cause. `session_cancelled` is the Session-aggregate fan-out;
 * `system_compensation` is the late-success compensation duty from P4.
 * A host rejecting a pending request is NOT a cancellation (decline path).
 */
export type CancellationCause =
  | "attendee"
  | "host"
  | "session_cancelled"
  | "system_compensation";

/** Refund magnitude decided by this module. P2: NONE or FULL only. */
export type RefundMode = "NONE" | "FULL";

/**
 * How a FULL refund is initiated. `standard` is the normal flow; `system_compensation`
 * is the automatic obligation the system owes when a payment proves successful after
 * the booking became non-confirmable (P4) — persisted later as Refund.kind.
 */
export type RefundKind = "standard" | "system_compensation";

export type PolicyCode =
  | "ATTENDEE_CANCEL_CONFIRMED_PAID_REFUNDABLE"
  | "ATTENDEE_CANCEL_CONFIRMED_PAID_INSIDE_CUTOFF"
  | "ATTENDEE_CANCEL_UNPAID_NO_REFUND"
  | "HOST_CANCEL_CONFIRMED_PAID_FULL"
  | "HOST_CANCEL_UNPAID_NO_REFUND"
  | "SESSION_CANCEL_PAID_FULL"
  | "SESSION_CANCEL_UNPAID_NO_REFUND"
  | "PAYMENT_IN_FLIGHT_COMPENSATION_ON_LATE_SUCCESS"
  | "SYSTEM_COMPENSATION_FULL"
  | "NO_REMAINING_REFUND"
  | "INCONSISTENT_PAID_REQUESTED_STATE"
  | "INVALID_ACTOR_OR_CAUSE"
  | "INVALID_TIMESTAMP"
  | "INVALID_CAPTURED_AMOUNT"
  | "HOST_DECLINE_NOT_CANCELLATION"
  | "TERMINAL_NO_CANCELLATION";

/** Single authoritative refund cutoff: 24 hours. Never duplicated in SQL/TS/React. */
export const CANCELLATION_REFUND_CUTOFF_HOURS = 24;

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: PolicyCode; message: string } };

function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

function fail(code: PolicyCode, message: string): Result<never> {
  return { ok: false, error: { code, message } };
}

export interface CancellationRefundInput {
  /** Current BookingStatus from the booking aggregate (requested|confirmed|cancelled|rejected|completed). */
  bookingStatus: BookingStatus;
  /** Who is initiating the cancellation. */
  actor: CancellationActor;
  /** The cancellation cause. */
  cause: CancellationCause;
  /** Payment.status when a Payment exists; null when the booking is unpaid. */
  paymentStatus: PaymentStatus | null;
  /**
   * Gross captured amount in VND (Payment.amountVnd). Meaningful only when
   * paymentStatus === "succeeded"; callers must pass 0 otherwise. Never a
   * client-controlled refund amount.
   */
  capturedAmountVnd: number;
  /**
   * Authoritative scheduled start of the booking's CURRENT session (the
   * post-reschedule session when applicable), ISO 8601 instant.
   */
  sessionStartsAt: string;
  /** Cancellation effective time, ISO 8601 instant. */
  cancelledAt: string;
}

export interface RefundDecision {
  mode: RefundMode;
  /** Present when mode === "FULL". */
  kind?: RefundKind;
  /** Full gross amount to refund (P7), equals capturedAmountVnd. Present when mode === "FULL". */
  amountVnd?: number;
  /** Stable policy code for audit/tracing. */
  code: PolicyCode;
}

export interface CancellationRefundResult {
  /** Whether the cancellation is permitted per booking-lifecycle + this policy. */
  allowed: boolean;
  /** Stable policy code. */
  code: PolicyCode;
  /** Human-readable reason for the decision. */
  message: string;
  refund: RefundDecision;
  /**
   * P4: true when the payment was still in flight at cancellation time and the
   * system MUST issue a FULL system_compensation refund if the payment later
   * proves successful. Not itself a refund decision.
   */
  compensationOnLateSuccess: boolean;
}

/**
 * True when the cancellation happened at least the full cutoff before the session start (UTC arithmetic).
 *
 * THROWS on non-parseable instants: this is a programmer-error guard for
 * callers passing raw timestamps. The `evaluateCancellationRefund` entry point
 * returns a Result (INVALID_TIMESTAMP) instead, so production callers never
 * hit this throw.
 */
export function isAtLeastHoursBefore(
  sessionStartsAt: string,
  cancelledAt: string,
  hours: number,
): boolean {
  const start = Date.parse(sessionStartsAt);
  const cancelled = Date.parse(cancelledAt);
  if (Number.isNaN(start) || Number.isNaN(cancelled)) {
    throw new Error("sessionStartsAt and cancelledAt must be valid ISO instants");
  }
  const windowMs = hours * 60 * 60 * 1000;
  return start - cancelled >= windowMs;
}

/** Refund-window predicate using the single authoritative 24h cutoff (P1). */
export function isWithinRefundWindow(sessionStartsAt: string, cancelledAt: string): boolean {
  return isAtLeastHoursBefore(sessionStartsAt, cancelledAt, CANCELLATION_REFUND_CUTOFF_HOURS);
}

function refund(mode: RefundMode, code: PolicyCode, amountVnd?: number, kind?: RefundKind): RefundDecision {
  const decision: RefundDecision = { mode, code };
  if (kind !== undefined) decision.kind = kind;
  if (amountVnd !== undefined) decision.amountVnd = amountVnd;
  return decision;
}

function cancellationResult(
  allowed: boolean,
  code: PolicyCode,
  message: string,
  refundDecision: RefundDecision,
  compensationOnLateSuccess: boolean,
): CancellationRefundResult {
  return { allowed, code, message, refund: refundDecision, compensationOnLateSuccess };
}

const isRefundableCause = (cause: CancellationCause) =>
  cause === "host" || cause === "session_cancelled";

/**
 * Evaluate the cancellation-and-refund decision for one booking. Cancellation
 * legality is mirrored from booking-lifecycle.ts (authority lives there);
 * this module decides only what the cancellation implies for refunds.
 */
export function evaluateCancellationRefund(input: CancellationRefundInput): Result<CancellationRefundResult> {
  const { bookingStatus, actor, cause, paymentStatus, capturedAmountVnd, sessionStartsAt, cancelledAt } = input;

  if (Number.isNaN(Date.parse(sessionStartsAt)) || Number.isNaN(Date.parse(cancelledAt))) {
    return fail(
      "INVALID_TIMESTAMP",
      "sessionStartsAt and cancelledAt must be valid ISO instants",
    );
  }
  if (paymentStatus === "succeeded" && capturedAmountVnd <= 0) {
    return fail(
      "INVALID_CAPTURED_AMOUNT",
      "A succeeded payment must carry a positive captured gross in VND",
    );
  }

  if (cause === "system_compensation") {
    if (actor !== "system") {
      return fail("SYSTEM_COMPENSATION_FULL", "system_compensation requires the system actor");
    }
    if (bookingStatus !== "cancelled" && bookingStatus !== "rejected") {
      return fail(
        "SYSTEM_COMPENSATION_FULL",
        "system_compensation applies only to a booking that can no longer be honored (cancelled or rejected)",
      );
    }
    if (paymentStatus !== "succeeded") {
      return fail(
        "SYSTEM_COMPENSATION_FULL",
        "system_compensation requires a proven succeeded payment",
      );
    }
    return ok(
      cancellationResult(
        true,
        "SYSTEM_COMPENSATION_FULL",
        "Payment succeeded after the booking became non-confirmable; system owes a full refund",
        refund("FULL", "SYSTEM_COMPENSATION_FULL", capturedAmountVnd, "system_compensation"),
        false,
      ),
    );
  }

  const validPairing =
    (cause === "attendee" && actor === "attendee") ||
    (cause === "host" && actor === "host") ||
    (cause === "session_cancelled" && (actor === "host" || actor === "system"));
  if (!validPairing) {
    return fail("INVALID_ACTOR_OR_CAUSE", "Invalid actor/cause pairing");
  }

  const terminal: readonly BookingStatus[] = ["cancelled", "rejected", "completed"];
  if (terminal.includes(bookingStatus)) {
    return ok(
      cancellationResult(
        false,
        "TERMINAL_NO_CANCELLATION",
        `Booking ${bookingStatus} is terminal and cannot be cancelled`,
        refund("NONE", "TERMINAL_NO_CANCELLATION"),
        paymentStatus === "pending",
      ),
    );
  }

  if (bookingStatus === "requested") {
    if (cause === "host") {
      return ok(
        cancellationResult(
          false,
          "HOST_DECLINE_NOT_CANCELLATION",
          "Host cannot cancel a pending request; decline (rejected) is the mechanism",
          refund("NONE", "HOST_DECLINE_NOT_CANCELLATION"),
          paymentStatus === "pending",
        ),
      );
    }
    if (paymentStatus === "succeeded") {
      return ok(
        cancellationResult(
          false,
          "INCONSISTENT_PAID_REQUESTED_STATE",
          "Requested bookings cannot be paid in the confirmed-only baseline; raise as an anomaly, do not auto-refund",
          refund("NONE", "INCONSISTENT_PAID_REQUESTED_STATE"),
          false,
        ),
      );
    }
  }

  if (paymentStatus === "pending") {
    return ok(
      cancellationResult(
        true,
        "PAYMENT_IN_FLIGHT_COMPENSATION_ON_LATE_SUCCESS",
        "Cancellation is authoritative; compensate in full if the payment later succeeds (P4)",
        refund("NONE", "PAYMENT_IN_FLIGHT_COMPENSATION_ON_LATE_SUCCESS"),
        true,
      ),
    );
  }

  if (paymentStatus === "refunded") {
    return ok(
      cancellationResult(
        true,
        "NO_REMAINING_REFUND",
        "Nothing refundable remains; no further refund is created",
        refund("NONE", "NO_REMAINING_REFUND"),
        false,
      ),
    );
  }

  if (isRefundableCause(cause)) {
    if (paymentStatus === "succeeded") {
      const code = cause === "host" ? "HOST_CANCEL_CONFIRMED_PAID_FULL" : "SESSION_CANCEL_PAID_FULL";
      return ok(
        cancellationResult(
          true,
          code,
          cause === "host"
            ? "Tutor cancellation of a confirmed, paid booking is always fully refunded (P5)"
            : "Session cancellation refunds every paid affected booking in full (P6)",
          refund("FULL", code, capturedAmountVnd, "standard"),
          false,
        ),
      );
    }
    const code = cause === "host" ? "HOST_CANCEL_UNPAID_NO_REFUND" : "SESSION_CANCEL_UNPAID_NO_REFUND";
    return ok(
      cancellationResult(
        true,
        code,
        cause === "host"
          ? "Tutor cancellation of an unpaid booking creates no refund"
          : "Session cancellation of an unpaid booking creates no refund",
        refund("NONE", code),
        false,
      ),
    );
  }

  if (paymentStatus === null || paymentStatus === "failed") {
    return ok(
      cancellationResult(
        true,
        "ATTENDEE_CANCEL_UNPAID_NO_REFUND",
        "Unpaid cancellation; capacity releases, no refund is created (P3)",
        refund("NONE", "ATTENDEE_CANCEL_UNPAID_NO_REFUND"),
        false,
      ),
    );
  }

  if (paymentStatus === "succeeded") {
    if (isWithinRefundWindow(sessionStartsAt, cancelledAt)) {
      return ok(
        cancellationResult(
          true,
          "ATTENDEE_CANCEL_CONFIRMED_PAID_REFUNDABLE",
          "Learner cancellation at least 24h before the session is fully refunded (P1)",
          refund("FULL", "ATTENDEE_CANCEL_CONFIRMED_PAID_REFUNDABLE", capturedAmountVnd, "standard"),
          false,
        ),
      );
    }
    return ok(
      cancellationResult(
        true,
        "ATTENDEE_CANCEL_CONFIRMED_PAID_INSIDE_CUTOFF",
        "Learner cancellation inside the 24h window is not refunded (P1)",
        refund("NONE", "ATTENDEE_CANCEL_CONFIRMED_PAID_INSIDE_CUTOFF"),
        false,
      ),
    );
  }

  return ok(
    cancellationResult(
      true,
      "ATTENDEE_CANCEL_UNPAID_NO_REFUND",
      "Cancellation allowed; no refund decision applies",
      refund("NONE", "ATTENDEE_CANCEL_UNPAID_NO_REFUND"),
      false,
    ),
  );
}
