import type { BookingRecord } from "./booking-api";

export type PaymentReturnState = "pending" | "success" | "compensation" | "failed";

export function bookingAmount(booking: BookingRecord): number | null {
  return booking.pricing?.amountVnd ?? booking.payment?.amountVnd ?? null;
}

export function canStartPayment(booking: BookingRecord): boolean {
  return booking.status === "requested" && booking.paymentReady === true && booking.paymentRetryAllowed !== false && bookingAmount(booking) !== null;
}

export function paymentReturnState(booking: BookingRecord): PaymentReturnState {
  if (booking.status === "confirmed" && booking.payment?.status === "succeeded") return "success";
  if (booking.payment?.status === "succeeded" && booking.status !== "confirmed") return "compensation";
  if (booking.payment?.status === "failed" && booking.paymentRetryAllowed && booking.paymentReady) return "failed";
  return "pending";
}
