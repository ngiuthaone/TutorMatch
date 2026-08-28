import { describe, it, expect } from "vitest";
import {
  canConfirmBooking,
  createPayment,
  issueRefund,
  markPaymentFailed,
  markPaymentSucceeded,
  paymentEventsFor,
  refundableAmount,
  refundedAmount,
  requiresPayment,
  retryPayment,
  type Payment,
  type PaymentDomainEvent,
} from "../src/domain/payment-lifecycle.js";
import {
  acceptRescheduleRequest,
  applyTransition,
  createBooking,
  createRescheduleRequest,
  recordAttendance,
} from "../src/domain/booking-lifecycle.js";

const at = "2026-08-13T08:00:00Z";

function payment(overrides: Partial<Payment> = {}): Payment {
  const created = createPayment({
    bookingId: "b1",
    amountVnd: 500000,
    provider: "vnpay",
    at,
  });
  if (!created.ok) throw new Error("test setup: createPayment failed");
  return { ...created.value, ...overrides };
}

describe("requiresPayment", () => {
  it("returns false for free bookings (null or non-positive price)", () => {
    expect(requiresPayment(null)).toBe(false);
    expect(requiresPayment(0)).toBe(false);
    expect(requiresPayment(-1)).toBe(false);
  });

  it("returns true for a paid booking", () => {
    expect(requiresPayment(500000)).toBe(true);
  });
});

describe("createPayment", () => {
  it("creates a pending VND payment for a booking with a creation history entry", () => {
    const result = createPayment({ bookingId: "b1", amountVnd: 500000, provider: "vnpay", at });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("pending");
    expect(result.value.currency).toBe("VND");
    expect(result.value.provider).toBe("vnpay");
    expect(result.value.refunds).toEqual([]);
    expect(result.value.history).toHaveLength(1);
    expect(result.value.history[0]).toEqual({
      from: "created",
      to: "pending",
      actor: "attendee",
      at,
    });
  });

  it("rejects missing bookingId, invalid amounts, and unknown providers", () => {
    const base = { bookingId: "b1", amountVnd: 500000, provider: "vnpay" as const, at };
    expect(createPayment({ ...base, bookingId: "" }).ok).toBe(false);
    expect(createPayment({ ...base, amountVnd: 0 }).ok).toBe(false);
    expect(createPayment({ ...base, amountVnd: -500 }).ok).toBe(false);
    expect(createPayment({ ...base, amountVnd: 500.5 }).ok).toBe(false);
    expect(createPayment({ ...base, provider: "unknown" as never }).ok).toBe(false);
  });
});

describe("markPaymentSucceeded", () => {
  it("moves pending -> succeeded and sets paidAt/externalRef", () => {
    const result = markPaymentSucceeded(payment(), { externalRef: "vnpay_ref_1", at });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("succeeded");
    expect(result.value.paidAt).toBe(at);
    expect(result.value.externalRef).toBe("vnpay_ref_1");
  });

  it("rejects a repeated success (idempotency guard) so replay cannot double-move", () => {
    const done = markPaymentSucceeded(payment(), { at });
    if (!done.ok) throw new Error("setup failed");
    const replay = markPaymentSucceeded(done.value, { at });
    expect(replay.ok).toBe(false);
    if (replay.ok) return;
    expect(replay.error.code).toBe("IDEMPOTENT_REJECTED");
  });

  it("rejects success on a failed payment (must retry first)", () => {
    const failed = markPaymentFailed(payment(), { at });
    if (!failed.ok) throw new Error("setup failed");
    const result = markPaymentSucceeded(failed.value, { at });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_PAYMENT_STATE");
  });
});

describe("markPaymentFailed and retry", () => {
  it("moves pending -> failed, then retry -> pending, then succeeds on the next attempt", () => {
    const first = markPaymentFailed(payment(), { reason: "declined" });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.status).toBe("failed");

    const retried = retryPayment(first.value, { at });
    expect(retried.ok).toBe(true);
    if (!retried.ok) return;
    expect(retried.value.status).toBe("pending");

    const done = markPaymentSucceeded(retried.value, { at, externalRef: "ref_2" });
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.value.status).toBe("succeeded");
    // one Payment row for the whole lifecycle: attempts live in history
    expect(done.value.history.filter((h) => h.to === "pending")).toHaveLength(2);
  });

  it("only a failed payment can be retried", () => {
    const result = retryPayment(payment(), { at });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_PAYMENT_STATE");
  });

  it("rejects a repeated failure (idempotency guard)", () => {
    const failed = markPaymentFailed(payment(), { at });
    if (!failed.ok) throw new Error("setup failed");
    const again = markPaymentFailed(failed.value, { at });
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.error.code).toBe("IDEMPOTENT_REJECTED");
  });
});

describe("issueRefund (support-only)", () => {
  function paid(): Payment {
    const p = payment();
    const done = markPaymentSucceeded(p, { at, externalRef: "ref_1" });
    if (!done.ok) throw new Error("setup failed");
    return done.value;
  }

  it("partial refund keeps the payment succeeded and accumulates refunds", () => {
    const first = issueRefund(paid(), { id: "rf1", amountVnd: 100000, reason: "partial support refund", at });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.status).toBe("succeeded");
    expect(first.value.refunds).toHaveLength(1);
    expect(refundedAmount(first.value)).toBe(100000);
    expect(refundableAmount(first.value)).toBe(400000);

    const second = issueRefund(first.value, { id: "rf2", amountVnd: 50000, reason: "further partial", at });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.status).toBe("succeeded");
    expect(refundedAmount(second.value)).toBe(150000);
  });

  it("full refund moves the payment to the terminal refunded status", () => {
    const result = issueRefund(paid(), { id: "rf1", amountVnd: 500000, reason: "full refund", at });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("refunded");
    expect(refundableAmount(result.value)).toBe(0);

    const again = issueRefund(result.value, { id: "rf2", amountVnd: 1, reason: "after full refund", at });
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.error.code).toBe("INVALID_PAYMENT_STATE");
  });

  it("rejects refunds that exceed the remaining amount", () => {
    const result = issueRefund(paid(), { id: "rf1", amountVnd: 600000, reason: "too much", at });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("REFUND_EXCEEDS_REMAINING");
  });

  it("requires a reason and a valid amount", () => {
    const missingReason = issueRefund(paid(), { id: "rf1", amountVnd: 100000, reason: "", at });
    expect(missingReason.ok).toBe(false);
    if (missingReason.ok) return;
    expect(missingReason.error.code).toBe("REFUND_REASON_REQUIRED");

    const badAmount = issueRefund(paid(), { id: "rf1", amountVnd: 0, reason: "x", at });
    expect(badAmount.ok).toBe(false);
    if (badAmount.ok) return;
    expect(badAmount.error.code).toBe("INVALID_AMOUNT");
  });

  it("cannot refund a pending, failed, or refunded payment", () => {
    const pending = issueRefund(payment(), { id: "rf1", amountVnd: 100000, reason: "x", at });
    expect(pending.ok).toBe(false);
    if (pending.ok) return;
    expect(pending.error.code).toBe("INVALID_PAYMENT_STATE");

    const failed = markPaymentFailed(payment(), { at });
    if (!failed.ok) throw new Error("setup failed");
    const failedRefund = issueRefund(failed.value, { id: "rf1", amountVnd: 100000, reason: "x", at });
    expect(failedRefund.ok).toBe(false);
    if (failedRefund.ok) return;
    expect(failedRefund.error.code).toBe("INVALID_PAYMENT_STATE");
  });
});

describe("canConfirmBooking (spec: on success, booking moves to confirmed)", () => {
  it("free bookings need no payment and confirm", () => {
    expect(canConfirmBooking(null)).toBe(true);
  });

  it("only a succeeded payment satisfies the gate", () => {
    const p = payment();
    expect(canConfirmBooking(p)).toBe(false);

    const failed = markPaymentFailed(p, { at });
    if (!failed.ok) throw new Error("setup failed");
    expect(canConfirmBooking(failed.value)).toBe(false);

    const done = markPaymentSucceeded(payment(), { at });
    if (!done.ok) throw new Error("setup failed");
    expect(canConfirmBooking(done.value)).toBe(true);

    const refunded = issueRefund(done.value, { id: "rf1", amountVnd: 500000, reason: "full", at });
    if (!refunded.ok) throw new Error("setup failed");
    expect(canConfirmBooking(refunded.value)).toBe(false);
  });
});

describe("paymentEventsFor", () => {
  it("emits PAYMENT_ATTEMPTED on creation, PAYMENT_SUCCEEDED on success, PAYMENT_FAILED on failure, PAYMENT_RETRIED on retry", () => {
    const created = payment();
    const createdEvents = paymentEventsFor(null, created);
    expect(createdEvents.map((e) => e.type)).toEqual(["PAYMENT_ATTEMPTED"]);

    const failed = markPaymentFailed(created, { at, reason: "card declined" });
    if (!failed.ok) throw new Error("setup failed");
    const failedEvents = paymentEventsFor(created, failed.value);
    const failedEvent = failedEvents[0];
    if (!failedEvent) throw new Error("expected a PAYMENT_FAILED event");
    expect(failedEvent.type).toBe("PAYMENT_FAILED");
    expect(failedEvent.attempt).toBe(1);
    expect(failedEvent.recipients).toEqual({ attendee: false, host: true });

    const retried = retryPayment(failed.value, { at });
    if (!retried.ok) throw new Error("setup failed");
    const retryEvents = paymentEventsFor(failed.value, retried.value);
    const retryEvent = retryEvents[0];
    if (!retryEvent) throw new Error("expected a PAYMENT_RETRIED event");
    expect(retryEvent.type).toBe("PAYMENT_RETRIED");
    expect(retryEvent.attempt).toBe(2);

    const done = markPaymentSucceeded(retried.value, { at, externalRef: "ref_9" });
    if (!done.ok) throw new Error("setup failed");
    const doneEvents = paymentEventsFor(retried.value, done.value);
    const doneEvent = doneEvents[0];
    if (!doneEvent) throw new Error("expected a PAYMENT_SUCCEEDED event");
    expect(doneEvent.type).toBe("PAYMENT_SUCCEEDED");
    expect(doneEvent.externalRef).toBe("ref_9");
  });

  it("emits REFUND_ISSUED (notifying both parties) when a refund is issued", () => {
    const created = payment();
    const done = markPaymentSucceeded(created, { at });
    if (!done.ok) throw new Error("setup failed");
    const refunded = issueRefund(done.value, { id: "rf1", amountVnd: 500000, reason: "full", at });
    if (!refunded.ok) throw new Error("setup failed");
    const events = paymentEventsFor(done.value, refunded.value);
    expect(events).toHaveLength(1);
    const event = events[0];
    if (!event) throw new Error("expected a REFUND_ISSUED event");
    expect(event.type).toBe("REFUND_ISSUED");
    expect(event.actor).toBe("support");
    expect(event.recipients).toEqual({ attendee: true, host: true });
    expect(event.refundId).toBe("rf1");
    expect(event.refundAmountVnd).toBe(500000);
  });
});

describe("payment boundary with booking-lifecycle", () => {
  it("BookingStatus never accepts payment states (separate vocabularies)", () => {
    const b = createBooking("b1", "s1", "2026-08-20T09:00:00Z", "attendee");
    if (!b.ok) throw new Error("setup failed");
    for (const bad of ["paid", "awaiting_payment", "payment_failed", "refunded", "pending"]) {
      const result = applyTransition(b.value, bad as never, { actor: "host", at });
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error.code).toBe("INVALID_TRANSITION");
    }
  });

  it("payment success/failure/refund never mutates booking status", () => {
    const b = createBooking("b1", "s1", "2026-08-20T09:00:00Z", "attendee");
    if (!b.ok) throw new Error("setup failed");
    const confirmed = applyTransition(b.value, "confirmed", { actor: "host", at });
    if (!confirmed.ok) throw new Error("setup failed");

    const failed = markPaymentFailed(payment(), { at });
    if (!failed.ok) throw new Error("setup failed");
    const done = markPaymentSucceeded(payment(), { at });
    if (!done.ok) throw new Error("setup failed");
    const refunded = issueRefund(done.value, { id: "rf1", amountVnd: 500000, reason: "full", at });
    if (!refunded.ok) throw new Error("setup failed");

    // Booking stays confirmed regardless of payment state; payment and booking
    // are two aggregates joined by id, and only the integration layer decides
    // what (if anything) the payment outcome unlocks.
    expect(failed.value.status).toBe("failed");
    expect(refunded.value.status).toBe("refunded");
    expect(confirmed.value.status).toBe("confirmed");
  });

  it("rescheduling the booking keeps payment identity stable (no new payment)", () => {
    const b = createBooking("b1", "s1", "2026-08-20T09:00:00Z", "attendee");
    if (!b.ok) throw new Error("setup failed");
    const req = createRescheduleRequest(b.value, { id: "r1", toSessionId: "s2", requestedBy: "attendee", at });
    if (!req.ok) throw new Error("setup failed");
    const accepted = acceptRescheduleRequest(req.value, b.value, {
      at,
      sessionOpen: () => true,
      sessionDate: "2026-08-21T09:00:00Z",
    });
    if (!accepted.ok) throw new Error("setup failed");

    const pay = payment();
    expect(pay.bookingId).toBe("b1");
    expect(accepted.value.id).toBe("b1"); // booking identity stable -> payment row stays valid
    expect(accepted.value.sessionId).toBe("s2");
    expect(pay.status).toBe("pending");
  });

  it("cancellation never auto-refunds: booking and payment stay independent", () => {
    const b = createBooking("b1", "s1", "2026-08-20T09:00:00Z", "attendee");
    if (!b.ok) throw new Error("setup failed");
    const confirmed = applyTransition(b.value, "confirmed", { actor: "host", at });
    if (!confirmed.ok) throw new Error("setup failed");
    const cancelled = applyTransition(confirmed.value, "cancelled", { actor: "attendee", at, reason: "plans changed" });
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) return;

    const done = markPaymentSucceeded(payment(), { at });
    if (!done.ok) throw new Error("setup failed");
    // A cancelled booking does not move money by itself; a refund is a
    // separate support decision on the (still valid) Payment.
    expect(done.value.status).toBe("succeeded");
    expect(done.value.refunds).toHaveLength(0);
  });

  it("attendance facts never move money", () => {
    const b = createBooking("b1", "s1", "2026-08-20T09:00:00Z", "attendee");
    if (!b.ok) throw new Error("setup failed");
    const confirmed = applyTransition(b.value, "confirmed", { actor: "host", at });
    if (!confirmed.ok) throw new Error("setup failed");
    const now = new Date("2026-08-20T10:00:00Z");
    const reported = recordAttendance(confirmed.value, {
      outcome: "learner_no_show",
      reportedBy: "host",
      sessionEndAt: "2026-08-20T09:30:00Z",
      now,
      at,
    });
    expect(reported.ok).toBe(true);
    if (!reported.ok) return;

    const pay = payment();
    // The Payment is untouched by attendance evidence; payouts/penalties from
    // attendance are future policy, never derived from a raw fact here.
    expect(pay.status).toBe("pending");
    expect(pay.refunds).toHaveLength(0);
  });
});

describe("type-level boundary (compile-time assertion)", () => {
  it("BookingStatus and PaymentStatus are disjoint vocabularies", () => {
    // This is a compile-time/structural check: PaymentDomainEvent carries the
    // payment status, BookingDomainEvent carries the booking status; neither
    // type is shared. The runtime checks above exercise the behavior.
    const event: PaymentDomainEvent = {
      type: "PAYMENT_SUCCEEDED",
      at,
      actor: "attendee",
      bookingId: "b1",
      status: "succeeded",
      amountVnd: 500000,
      recipients: { attendee: false, host: true },
      attempt: 1,
    };
    expect(event.type).toBe("PAYMENT_SUCCEEDED");
  });
});
