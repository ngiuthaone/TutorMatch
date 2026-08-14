import { describe, expect, it } from "vitest";
import { bookingApprovalLabel, bookingPaymentLabel, bookingTitle, canStartPayment, paymentReturnState } from "@/lib/booking-payment-state";
import type { BookingRecord } from "@/lib/booking-api";

const base = { id: "b", sessionId: "s", status: "requested", participantCount: 1, version: 1, createdAt: "", updatedAt: "", pricing: { amountVnd: 300000, currency: "VND", hourlyRateVnd: 300000, durationMinutes: 60, model: "hourly_v1", snapshottedAt: "" }, session: { id: "s", status: "scheduled", startsAt: "2026-08-20T02:00:00Z", endsAt: "2026-08-20T03:00:00Z", minParticipants: null, maxParticipants: 1, hardReservedCapacity: 0, spotsLeft: 1, version: 1, tutorProfileId: "t" , hourlyRateVnd: 300000, currency: "VND" as const }, tutor: { id: "t", displayName: "Read Model Tutor" } } satisfies BookingRecord;

describe("booking payment state", () => {
  it("hides Pay until backend paymentReady is true", () => {
    expect(canStartPayment({ ...base, paymentReady: false })).toBe(false);
    expect(canStartPayment({ ...base, paymentReady: true })).toBe(true);
  });
  it("presents an unapproved request as waiting for tutor approval", () => {
    expect(bookingTitle({ ...base, paymentReady: false })).toBe("Lesson with Read Model Tutor");
    expect(bookingApprovalLabel({ ...base, paymentReady: false })).toBe("Waiting for tutor approval");
    expect(bookingPaymentLabel({ ...base, paymentReady: false })).toBe("Not available yet");
    expect(bookingApprovalLabel({ ...base, paymentReady: false })).not.toBe("Tutor accepted");
    expect(bookingPaymentLabel({ ...base, paymentReady: false })).not.toBe("Required");
  });
  it("keeps payment-required presentation after tutor acceptance", () => {
    expect(bookingTitle({ ...base, paymentReady: true })).toBe("Read Model Tutor accepted your request");
    expect(bookingApprovalLabel({ ...base, paymentReady: true })).toBe("Tutor accepted");
    expect(bookingPaymentLabel({ ...base, paymentReady: true })).toBe("Required");
  });
  it("keeps Tutor identity in confirmed presentation", () => {
    const payment = { id: "p", status: "succeeded" as const, amountVnd: 300000, currency: "VND" as const, refundedAmountVnd: 0, paidAt: "2026-08-20T02:00:00Z" };
    expect(bookingTitle({ ...base, status: "confirmed", payment })).toBe("Payment complete");
    expect({ tutor: { ...base.tutor } }).toMatchObject({ tutor: { displayName: "Read Model Tutor" } });
  });
  it("does not expose Pay for rejected or confirmed bookings", () => {
    expect(canStartPayment({ ...base, status: "rejected", paymentReady: true })).toBe(false);
    expect(canStartPayment({ ...base, status: "confirmed", paymentReady: false })).toBe(false);
  });
  it("keeps provider-pending separate from ordinary failure", () => {
    expect(paymentReturnState({ ...base, payment: { id: "p", status: "pending", amountVnd: 300000, currency: "VND", refundedAmountVnd: 0, paidAt: null } })).toBe("pending");
    expect(paymentReturnState({ ...base, payment: { id: "p", status: "failed", amountVnd: 300000, currency: "VND", refundedAmountVnd: 0, paidAt: null }, paymentReady: true, paymentRetryAllowed: true })).toBe("failed");
  });
  it("requires authoritative confirmed booking plus succeeded payment for success", () => {
    const payment = { id: "p", status: "succeeded" as const, amountVnd: 300000, currency: "VND" as const, refundedAmountVnd: 0, paidAt: "2026-08-20T02:00:00Z" };
    expect(paymentReturnState({ ...base, payment, status: "requested" })).toBe("compensation");
    expect(paymentReturnState({ ...base, payment, status: "confirmed" })).toBe("success");
  });
});
