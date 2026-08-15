import { describe, it, expect } from "vitest";
import {
  CANCELLATION_REFUND_CUTOFF_HOURS,
  evaluateCancellationRefund,
  isAtLeastHoursBefore,
  isWithinRefundWindow,
  type CancellationRefundInput,
} from "../src/domain/cancellation-refund-policy.js";
import { createBooking } from "../src/domain/booking-lifecycle.js";
import { createPayment } from "../src/domain/payment-lifecycle.js";

const SESSION_START = "2026-09-01T10:00:00.000Z";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function base(overrides: Partial<CancellationRefundInput> = {}): CancellationRefundInput {
  return {
    bookingStatus: "confirmed",
    actor: "attendee",
    cause: "attendee",
    paymentStatus: "succeeded",
    capturedAmountVnd: 500000,
    sessionStartsAt: SESSION_START,
    cancelledAt: new Date(Date.parse(SESSION_START) - ONE_DAY_MS).toISOString(),
    ...overrides,
  };
}

function evaluate(input: CancellationRefundInput) {
  const result = evaluateCancellationRefund(input);
  if (!result.ok) throw new Error(`evaluateCancellationRefund failed: ${result.error.message}`);
  return result.value;
}

function confirmedPaidBookingInput(overrides: Partial<CancellationRefundInput> = {}): CancellationRefundInput {
  return base({
    bookingStatus: "confirmed",
    paymentStatus: "succeeded",
    ...overrides,
  });
}

describe("CANCELLATION_REFUND_CUTOFF_HOURS", () => {
  it("is the single authoritative 24h cutoff and equals the exported window", () => {
    expect(CANCELLATION_REFUND_CUTOFF_HOURS).toBe(24);
    expect(isWithinRefundWindow(SESSION_START, new Date(Date.parse(SESSION_START) - ONE_DAY_MS).toISOString())).toBe(true);
    expect(isAtLeastHoursBefore(SESSION_START, new Date(Date.parse(SESSION_START) - ONE_DAY_MS).toISOString(), 24)).toBe(true);
  });
});

describe("isWithinRefundWindow (24h boundary)", () => {
  const t = (msFromStart: number) => new Date(Date.parse(SESSION_START) - msFromStart).toISOString();

  it("returns true exactly at 24 hours before start (boundary is refundable)", () => {
    expect(isWithinRefundWindow(SESSION_START, t(24 * 60 * 60 * 1000))).toBe(true);
  });

  it("returns true one second beyond 24 hours (still refundable)", () => {
    expect(isWithinRefundWindow(SESSION_START, t(24 * 60 * 60 * 1000 + 1000))).toBe(true);
  });

  it("returns false one second inside 24 hours (not refundable)", () => {
    expect(isWithinRefundWindow(SESSION_START, t(24 * 60 * 60 * 1000 - 1000))).toBe(false);
  });

  it("returns false for a session that already started", () => {
    expect(isWithinRefundWindow(SESSION_START, new Date(Date.parse(SESSION_START) + 60 * 60 * 1000).toISOString())).toBe(false);
  });

  it("rejects invalid instants instead of silently guessing", () => {
    expect(() => isWithinRefundWindow("not-a-date", SESSION_START)).toThrow();
    expect(() => isWithinRefundWindow(SESSION_START, "not-a-date")).toThrow();
  });
});

describe("evaluateCancellationRefund — scenario matrix", () => {
  it("S1: requested/unaccepted/unpaid learner withdrawal — allowed, no refund", () => {
    const d = evaluate(base({ bookingStatus: "requested", paymentStatus: null, capturedAmountVnd: 0 }));
    expect(d.allowed).toBe(true);
    expect(d.refund.mode).toBe("NONE");
    expect(d.code).toBe("ATTENDEE_CANCEL_UNPAID_NO_REFUND");
    expect(d.compensationOnLateSuccess).toBe(false);
  });

  it("S2: requested/accepted/unpaid learner withdrawal — allowed, no refund", () => {
    const d = evaluate(base({ bookingStatus: "confirmed", paymentStatus: null, capturedAmountVnd: 0 }));
    expect(d.allowed).toBe(true);
    expect(d.refund.mode).toBe("NONE");
    expect(d.code).toBe("ATTENDEE_CANCEL_UNPAID_NO_REFUND");
  });

  it("S3: payment in flight (pending) — cancellation allowed, no refund now, compensation due on late success", () => {
    const d = evaluate(base({ paymentStatus: "pending", capturedAmountVnd: 0 }));
    expect(d.allowed).toBe(true);
    expect(d.refund.mode).toBe("NONE");
    expect(d.code).toBe("PAYMENT_IN_FLIGHT_COMPENSATION_ON_LATE_SUCCESS");
    expect(d.compensationOnLateSuccess).toBe(true);
  });

  it("S4: confirmed+paid learner cancel at least 24h before — full refund", () => {
    const d = evaluate(confirmedPaidBookingInput());
    expect(d.allowed).toBe(true);
    expect(d.refund.mode).toBe("FULL");
    expect(d.refund.kind).toBe("standard");
    expect(d.refund.amountVnd).toBe(500000);
    expect(d.code).toBe("ATTENDEE_CANCEL_CONFIRMED_PAID_REFUNDABLE");
    expect(d.compensationOnLateSuccess).toBe(false);
  });

  it("S5: confirmed+paid learner cancel inside 24h — no refund", () => {
    const inside = new Date(Date.parse(SESSION_START) - 23 * 60 * 60 * 1000).toISOString();
    const d = evaluate(confirmedPaidBookingInput({ cancelledAt: inside }));
    expect(d.allowed).toBe(true);
    expect(d.refund.mode).toBe("NONE");
    expect(d.code).toBe("ATTENDEE_CANCEL_CONFIRMED_PAID_INSIDE_CUTOFF");
  });

  it("S6: host rejecting a pending request is NOT a cancellation — no refund, decline mechanism", () => {
    const d = evaluate(base({ bookingStatus: "requested", actor: "host", cause: "host", paymentStatus: null, capturedAmountVnd: 0 }));
    expect(d.allowed).toBe(false);
    expect(d.code).toBe("HOST_DECLINE_NOT_CANCELLATION");
    expect(d.refund.mode).toBe("NONE");
  });

  it("S7: confirmed+paid tutor cancel — full refund even inside the 24h window", () => {
    const inside = new Date(Date.parse(SESSION_START) - 60 * 60 * 1000).toISOString();
    const d = evaluate(base({ actor: "host", cause: "host", cancelledAt: inside }));
    expect(d.allowed).toBe(true);
    expect(d.refund.mode).toBe("FULL");
    expect(d.refund.amountVnd).toBe(500000);
    expect(d.code).toBe("HOST_CANCEL_CONFIRMED_PAID_FULL");
  });

  it("S8: session cancel before payment — unpaid affected booking, no refund", () => {
    const d = evaluate(base({ cause: "session_cancelled", actor: "host", paymentStatus: null, capturedAmountVnd: 0 }));
    expect(d.allowed).toBe(true);
    expect(d.refund.mode).toBe("NONE");
    expect(d.code).toBe("SESSION_CANCEL_UNPAID_NO_REFUND");
  });

  it("S9: session cancel after payment — paid affected booking refunded in full", () => {
    const d = evaluate(base({ cause: "session_cancelled", actor: "host" }));
    expect(d.allowed).toBe(true);
    expect(d.refund.mode).toBe("FULL");
    expect(d.refund.amountVnd).toBe(500000);
    expect(d.code).toBe("SESSION_CANCEL_PAID_FULL");
  });

  it("S10: late provider success after the booking became non-confirmable — system owes full compensation", () => {
    const d = evaluate(base({ bookingStatus: "cancelled", actor: "system", cause: "system_compensation" }));
    expect(d.allowed).toBe(true);
    expect(d.refund.mode).toBe("FULL");
    expect(d.refund.kind).toBe("system_compensation");
    expect(d.refund.amountVnd).toBe(500000);
    expect(d.code).toBe("SYSTEM_COMPENSATION_FULL");
  });

  it("S10 variant: late success on a rejected booking also yields system compensation", () => {
    const d = evaluate(base({ bookingStatus: "rejected", actor: "system", cause: "system_compensation" }));
    expect(d.allowed).toBe(true);
    expect(d.refund.mode).toBe("FULL");
    expect(d.refund.kind).toBe("system_compensation");
  });

  it("S11: the refund decision is a deterministic pure function of the accepted inputs", () => {
    const a = evaluate(confirmedPaidBookingInput());
    const b = evaluate(confirmedPaidBookingInput());
    const inside = new Date(Date.parse(SESSION_START) - 1 * 60 * 60 * 1000).toISOString();
    const c = evaluate(confirmedPaidBookingInput({ cancelledAt: inside }));
    expect(a).toEqual(b);
    expect(a.refund).toEqual(b.refund);
    expect(c.refund.mode).toBe("NONE");
    expect(a.refund.mode).toBe("FULL");
  });

  it("S12: the policy uses the booking's CURRENT (post-reschedule) session start", () => {
    const oldStart = SESSION_START;
    const rescheduledEarlier = "2026-08-31T23:00:00.000Z";
    const cancelledAt = new Date(Date.parse(oldStart) - 24 * 60 * 60 * 1000).toISOString();
    expect(isWithinRefundWindow(oldStart, cancelledAt)).toBe(true);
    const d = evaluate(
      base({
        sessionStartsAt: rescheduledEarlier,
        cancelledAt,
      }),
    );
    expect(isWithinRefundWindow(rescheduledEarlier, cancelledAt)).toBe(false);
    expect(d.refund.mode).toBe("NONE");
    expect(d.code).toBe("ATTENDEE_CANCEL_CONFIRMED_PAID_INSIDE_CUTOFF");
  });
});

describe("evaluateCancellationRefund — required edge cases", () => {
  it("exactly 24h before start is refundable", () => {
    const cancelledAt = new Date(Date.parse(SESSION_START) - ONE_DAY_MS).toISOString();
    const d = evaluate(confirmedPaidBookingInput({ cancelledAt }));
    expect(d.refund.mode).toBe("FULL");
    expect(d.code).toBe("ATTENDEE_CANCEL_CONFIRMED_PAID_REFUNDABLE");
  });

  it("24h+1s before start is refundable", () => {
    const cancelledAt = new Date(Date.parse(SESSION_START) - (ONE_DAY_MS + 1000)).toISOString();
    const d = evaluate(confirmedPaidBookingInput({ cancelledAt }));
    expect(d.refund.mode).toBe("FULL");
  });

  it("24h-1s before start is not refundable", () => {
    const cancelledAt = new Date(Date.parse(SESSION_START) - (ONE_DAY_MS - 1000)).toISOString();
    const d = evaluate(confirmedPaidBookingInput({ cancelledAt }));
    expect(d.refund.mode).toBe("NONE");
    expect(d.code).toBe("ATTENDEE_CANCEL_CONFIRMED_PAID_INSIDE_CUTOFF");
  });

  it("a session that already started is classified, not converted into a no-show refund policy", () => {
    const cancelledAt = new Date(Date.parse(SESSION_START) + 60 * 60 * 1000).toISOString();
    const d = evaluate(confirmedPaidBookingInput({ cancelledAt }));
    expect(d.refund.mode).toBe("NONE");
    expect(d.code).toBe("ATTENDEE_CANCEL_CONFIRMED_PAID_INSIDE_CUTOFF");
    expect(d.allowed).toBe(true);
  });

  it("no successful payment anywhere in the flow means no refund", () => {
    for (const paymentStatus of [null, "failed"] as const) {
      const d = evaluate(base({ paymentStatus, capturedAmountVnd: 0 }));
      expect(d.refund.mode).toBe("NONE");
      expect(d.code).toBe("ATTENDEE_CANCEL_UNPAID_NO_REFUND");
    }
  });

  it("an already-refunded payment cannot be refunded again (nothing refundable remains)", () => {
    const d = evaluate(base({ paymentStatus: "refunded" }));
    expect(d.refund.mode).toBe("NONE");
  });

  it("a full refund equals the full captured gross (P7), platform absorbs provider fees", () => {
    const d = evaluate(confirmedPaidBookingInput({ capturedAmountVnd: 750000 }));
    expect(d.refund.mode).toBe("FULL");
    expect(d.refund.amountVnd).toBe(750000);
  });

  it("tutor cancel inside the 24h window is still full (P5)", () => {
    const inside = new Date(Date.parse(SESSION_START) - 60 * 60 * 1000).toISOString();
    const d = evaluate(base({ actor: "host", cause: "host", cancelledAt: inside }));
    expect(d.refund.mode).toBe("FULL");
  });

  it("session cancel inside the 24h window is still full (P6)", () => {
    const inside = new Date(Date.parse(SESSION_START) - 60 * 60 * 1000).toISOString();
    const d = evaluate(base({ cause: "session_cancelled", actor: "host", cancelledAt: inside }));
    expect(d.refund.mode).toBe("FULL");
  });

  it("terminal booking states reject cancellation with no refund", () => {
    for (const bookingStatus of ["cancelled", "rejected", "completed"] as const) {
      const d = evaluate(base({ bookingStatus, cause: "attendee" }));
      expect(d.allowed).toBe(false);
      expect(d.code).toBe("TERMINAL_NO_CANCELLATION");
      expect(d.refund.mode).toBe("NONE");
    }
  });

  it("system compensation requires a proven succeeded payment and the system actor", () => {
    const pending = evaluateCancellationRefund(
      base({ bookingStatus: "cancelled", actor: "system", cause: "system_compensation", paymentStatus: "pending", capturedAmountVnd: 0 }),
    );
    expect(pending.ok).toBe(false);
    const unpaid = evaluateCancellationRefund(
      base({ bookingStatus: "cancelled", actor: "system", cause: "system_compensation", paymentStatus: null, capturedAmountVnd: 0 }),
    );
    expect(unpaid.ok).toBe(false);
    const wrongActor = evaluateCancellationRefund(
      base({ bookingStatus: "cancelled", actor: "attendee", cause: "system_compensation" }),
    );
    expect(wrongActor.ok).toBe(false);
  });

  it("a paid requested booking is flagged as an inconsistent state, never auto-refunded", () => {
    const d = evaluate(base({ bookingStatus: "requested", cause: "attendee" }));
    expect(d.allowed).toBe(false);
    expect(d.code).toBe("INCONSISTENT_PAID_REQUESTED_STATE");
    expect(d.refund.mode).toBe("NONE");
  });

  it("pending payment on a terminal booking still requires compensation on late success", () => {
    const d = evaluate(base({ bookingStatus: "cancelled", actor: "host", cause: "session_cancelled", paymentStatus: "pending", capturedAmountVnd: 0 }));
    expect(d.allowed).toBe(false);
    expect(d.code).toBe("TERMINAL_NO_CANCELLATION");
    expect(d.compensationOnLateSuccess).toBe(true);
  });

  it("rejects invalid instants via a Result at the policy entry point (no throw)", () => {
    const badStart = evaluateCancellationRefund(confirmedPaidBookingInput({ sessionStartsAt: "nope" }));
    expect(badStart.ok).toBe(false);
    expect(badStart.ok === false && badStart.error.code).toBe("INVALID_TIMESTAMP");
    const badCancelled = evaluateCancellationRefund(confirmedPaidBookingInput({ cancelledAt: "nope" }));
    expect(badCancelled.ok).toBe(false);
  });

  it("rejects a succeeded payment with a non-positive captured gross (P7 must never emit a 0/negative FULL refund)", () => {
    const zero = evaluateCancellationRefund(confirmedPaidBookingInput({ capturedAmountVnd: 0 }));
    expect(zero.ok).toBe(false);
    expect(zero.ok === false && zero.error.code).toBe("INVALID_CAPTURED_AMOUNT");
    const negative = evaluateCancellationRefund(confirmedPaidBookingInput({ capturedAmountVnd: -500 }));
    expect(negative.ok).toBe(false);
  });

  it("a pending payment on a requested booking still flags compensation on late success", () => {
    const d = evaluate(base({ bookingStatus: "requested", cause: "attendee", paymentStatus: "pending", capturedAmountVnd: 0 }));
    expect(d.allowed).toBe(true);
    expect(d.refund.mode).toBe("NONE");
    expect(d.code).toBe("PAYMENT_IN_FLIGHT_COMPENSATION_ON_LATE_SUCCESS");
    expect(d.compensationOnLateSuccess).toBe(true);
  });

  it("allows a system actor to cancel via the session-cause fan-out (minimum-not-met compatible)", () => {
    const d = evaluate(base({ actor: "system", cause: "session_cancelled" }));
    expect(d.allowed).toBe(true);
    expect(d.refund.mode).toBe("FULL");
    expect(d.code).toBe("SESSION_CANCEL_PAID_FULL");
  });

  it("tutor cancel of an unpaid booking creates no refund", () => {
    const d = evaluate(base({ actor: "host", cause: "host", paymentStatus: null, capturedAmountVnd: 0 }));
    expect(d.allowed).toBe(true);
    expect(d.refund.mode).toBe("NONE");
    expect(d.code).toBe("HOST_CANCEL_UNPAID_NO_REFUND");
  });

  it("an in-flight payment at cancellation always flags compensation on late success (P4)", () => {
    const attendee = evaluate(base({ paymentStatus: "pending", capturedAmountVnd: 0 }));
    expect(attendee.compensationOnLateSuccess).toBe(true);
    const host = evaluate(base({ actor: "host", cause: "host", paymentStatus: "pending", capturedAmountVnd: 0 }));
    expect(host.compensationOnLateSuccess).toBe(true);
    expect(host.refund.mode).toBe("NONE");
    expect(host.code).toBe("PAYMENT_IN_FLIGHT_COMPENSATION_ON_LATE_SUCCESS");
    const session = evaluate(base({ actor: "host", cause: "session_cancelled", paymentStatus: "pending", capturedAmountVnd: 0 }));
    expect(session.compensationOnLateSuccess).toBe(true);
  });

  it("an already-refunded payment yields no further refund for any cause", () => {
    const attendee = evaluate(base({ paymentStatus: "refunded" }));
    expect(attendee.refund.mode).toBe("NONE");
    expect(attendee.code).toBe("NO_REMAINING_REFUND");
    const host = evaluate(base({ actor: "host", cause: "host", paymentStatus: "refunded" }));
    expect(host.refund.mode).toBe("NONE");
    const session = evaluate(base({ actor: "host", cause: "session_cancelled", paymentStatus: "refunded" }));
    expect(session.refund.mode).toBe("NONE");
  });

  it("rejects mismatched actor/cause pairings instead of guessing a policy", () => {
    const attendeeCausedByHost = evaluateCancellationRefund(base({ actor: "host", cause: "attendee" }));
    expect(attendeeCausedByHost.ok).toBe(false);
    const sessionCausedByAttendee = evaluateCancellationRefund(base({ cause: "session_cancelled" }));
    expect(sessionCausedByAttendee.ok).toBe(false);
    expect(sessionCausedByAttendee.ok === false && sessionCausedByAttendee.error.code).toBe("INVALID_ACTOR_OR_CAUSE");
  });
});

describe("composition with the existing domain aggregates", () => {
  it("an accepted reschedule keeps booking identity and payment identity stable", () => {
    const booking = createBooking("b1", "s1", "2026-09-01T10:00:00Z", "attendee");
    if (!booking.ok) throw new Error("setup failed");
    const payment = createPayment({ bookingId: booking.value.id, amountVnd: 500000, provider: "vnpay" });
    if (!payment.ok) throw new Error("setup failed");
    expect(payment.value.bookingId).toBe(booking.value.id);
    expect(payment.value.amountVnd).toBe(500000);
  });

  it("the pure Payment domain still supports partial refunds technically while Tutor V1 policy is NONE|FULL only", async () => {
    const { issueRefund } = await import("../src/domain/payment-lifecycle.js");
    const payment = createPayment({ bookingId: "b1", amountVnd: 500000, provider: "vnpay" });
    if (!payment.ok) throw new Error("setup failed");
    const succeeded = { ...payment.value, status: "succeeded" as const };
    const partial = issueRefund(succeeded, { id: "r1", amountVnd: 200000, reason: "support adjustment" });
    expect(partial.ok).toBe(true);
    if (!partial.ok) return;
    expect(partial.value.status).toBe("succeeded");
    expect(partial.value.refunds[0]?.amountVnd).toBe(200000);
  });
});
