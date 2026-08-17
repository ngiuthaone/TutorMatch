export type BookingSessionStatus = "initializing" | "anonymous" | "authenticated" | "unavailable";
export type BookingLoadStatus = "loading" | "ready" | "error";
export type BookingsPageState = "demo" | "loading" | "sign-in" | "error" | "ready";

export function getBookingsPageState(live: boolean, sessionStatus: BookingSessionStatus, bookingStatus: BookingLoadStatus): BookingsPageState {
  if (!live) return "demo";
  if (sessionStatus === "initializing") return "loading";
  if (sessionStatus !== "authenticated") return "sign-in";
  if (bookingStatus === "loading") return "loading";
  if (bookingStatus === "error") return "error";
  return "ready";
}
