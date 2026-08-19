import type { BookingRecord } from "./booking-api";

export type PaymentReturnState = "pending" | "success" | "compensation" | "failed";

export function bookingAmount(booking: BookingRecord): number | null {
  return booking.pricing?.amountVnd ?? booking.payment?.amountVnd ?? null;
}

export function canStartPayment(booking: BookingRecord): boolean {
  return booking.status === "requested" && booking.paymentReady === true && booking.paymentRetryAllowed !== false && bookingAmount(booking) !== null;
}

export function canCancelBooking(booking: BookingRecord): boolean {
  return booking.canLearnerCancel === true;
}

export function refundStatusLabel(booking: BookingRecord): string | null {
  switch (booking.refund?.status) {
    case "processing": return "Refund processing";
    case "refunded": case "succeeded": return "Refunded";
    case "needs_attention": return "Refund needs attention";
    default: return null;
  }
}

export function refundAmount(booking: BookingRecord): number | null {
  const value = booking.refund?.status === "processing" || booking.refund?.status === "needs_attention"
    ? booking.refund?.amountVnd ?? booking.refund?.refundedAmountVnd
    : booking.refund?.refundedAmountVnd ?? booking.refund?.amountVnd;
  return typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : null;
}

export function bookingApprovalLabel(booking: BookingRecord): string {
  if (booking.status === "rejected") return "Tutor declined";
  return booking.paymentReady || booking.status === "confirmed" ? "Tutor accepted" : "Waiting for tutor approval";
}

export function bookingSubtitle(booking: BookingRecord): string {
  if (booking.status === "cancelled") return refundStatusLabel(booking) ?? "This booking was cancelled.";
  if (booking.status === "rejected") return "The tutor declined your booking request.";
  if (booking.status === "confirmed") return "Your session is confirmed.";
  if (booking.paymentReady) return "Complete payment to confirm your lesson.";
  return "Your booking request is waiting for tutor approval.";
}

export function bookingPaymentLabel(booking: BookingRecord): string {
  if (booking.status === "cancelled") return refundStatusLabel(booking) ?? "Not available";
  if (booking.status === "confirmed" && booking.payment?.status === "succeeded") return "Paid";
  return booking.paymentReady ? "Required" : "Not available yet";
}

export function bookingTitle(booking: BookingRecord): string {
  const accepted = booking.paymentReady || booking.status === "confirmed";
  const confirmed = booking.status === "confirmed" && booking.payment?.status === "succeeded";
  const hostName = booking.host?.displayName ?? booking.tutor?.displayName ?? "Tutor";
  return confirmed ? "Payment complete" : accepted ? `${hostName} accepted your request` : `Lesson with ${hostName}`;
}

export function paymentReturnState(booking: BookingRecord): PaymentReturnState {
  if (booking.status === "confirmed" && booking.payment?.status === "succeeded") return "success";
  if (booking.payment?.status === "succeeded" && booking.status !== "confirmed") return "compensation";
  if (booking.payment?.status === "failed" && booking.paymentRetryAllowed && booking.paymentReady) return "failed";
  return "pending";
}
