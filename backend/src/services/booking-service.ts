import { createClient } from "@supabase/supabase-js";

const auth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

export type BookingServiceResult = { data: unknown; error: { code?: string; message?: string } | null };

export type BookingService = {
  listSessions(tutorProfileId?: string): Promise<BookingServiceResult>;
  getSession(sessionId: string): Promise<BookingServiceResult>;
  createBooking(token: string, sessionId: string, participantCount: number): Promise<BookingServiceResult>;
  listLearnerBookings(token: string): Promise<BookingServiceResult>;
  listTutorBookings(token: string): Promise<BookingServiceResult>;
  getBooking(token: string, bookingId: string): Promise<BookingServiceResult>;
  tutorAccept(token: string, bookingId: string): Promise<BookingServiceResult>;
  tutorReject(token: string, bookingId: string, expectedVersion: number): Promise<BookingServiceResult>;
  tutorCancel(token: string, bookingId: string, expectedVersion: number, reason?: string): Promise<BookingServiceResult>;
  learnerCancel(token: string, bookingId: string, expectedVersion: number, reason?: string): Promise<BookingServiceResult>;
  getCancellationPreview(token: string, bookingId: string): Promise<BookingServiceResult>;
  createRescheduleRequest(token: string, bookingId: string, targetSessionId: string, expectedVersion: number, reason?: string): Promise<BookingServiceResult>;
  acceptReschedule(token: string, requestId: string): Promise<BookingServiceResult>;
  rejectReschedule(token: string, requestId: string): Promise<BookingServiceResult>;
  cancelReschedule(token: string, requestId: string): Promise<BookingServiceResult>;
  cancelSession(token: string, sessionId: string, expectedVersion: number, reason?: string): Promise<BookingServiceResult>;
  rescheduleSession(token: string, sessionId: string, startsAt: string, endsAt: string, expectedVersion: number): Promise<BookingServiceResult>;
  // Offering RPCs
  getOffering(offeringId: string): Promise<BookingServiceResult>;
  listSessionsByOffering(offeringId: string): Promise<BookingServiceResult>;
  createOffering(token: string, params: { offeringType: string; title: string; pricingModel: string; pricePerParticipantVnd?: number; hourlyRateVnd?: number; bookingMode?: string; description?: string }): Promise<BookingServiceResult>;
  updateOfferingStatus(token: string, offeringId: string, expectedVersion: number, status: string): Promise<BookingServiceResult>;
  // Workshop Booking RPCs
  listWorkshopBookings(token: string): Promise<BookingServiceResult>;
  cancelWorkshopBooking(token: string, bookingId: string, expectedVersion: number, reason?: string): Promise<BookingServiceResult>;
};

export function createSupabaseBookingService(url: string, publishableKey: string): BookingService {
  const client = (token?: string) => createClient(url, publishableKey, {
    auth,
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {})
  });
  async function rpc(name: string, params: Record<string, unknown>, token?: string): Promise<BookingServiceResult> {
    try {
      const result = await client(token).rpc(name, params);
      return { data: result.data, error: result.error ? { code: result.error.code, message: result.error.message } : null };
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : "service unavailable" } };
    }
  }
  return {
    listSessions: (tutorProfileId) => rpc("list_bookable_sessions", { p_tutor_profile_id: tutorProfileId ?? null }),
    getSession: (sessionId) => rpc("get_bookable_session", { p_session_id: sessionId }),
    createBooking: (token, sessionId, participantCount) => rpc("create_booking", { session_id: sessionId, participant_count: participantCount }, token),
    listLearnerBookings: (token) => rpc("get_my_bookings", {}, token),
    listTutorBookings: (token) => rpc("get_my_tutor_bookings", {}, token),
    getBooking: (token, bookingId) => rpc("get_booking", { bid: bookingId }, token),
    tutorAccept: (token, bookingId) => rpc("approve_booking_for_payment", { p_booking_id: bookingId }, token),
    tutorReject: (token, bookingId, expectedVersion) => rpc("reject_booking", { booking_id: bookingId, expected_version: expectedVersion }, token),
    tutorCancel: (token, bookingId, expectedVersion, reason) => rpc("cancel_booking", { booking_id: bookingId, expected_version: expectedVersion, cause: "host", reason: reason ?? null }, token),
    learnerCancel: (token, bookingId, expectedVersion, reason) => rpc("cancel_booking", { booking_id: bookingId, expected_version: expectedVersion, cause: "attendee", reason: reason ?? null }, token),
    getCancellationPreview: (token, bookingId) => rpc("get_booking_cancellation_preview", { bid: bookingId }, token),
    createRescheduleRequest: (token, bookingId, targetSessionId, expectedVersion, reason) => rpc("create_reschedule_request", { booking_id: bookingId, target_session_id: targetSessionId, expected_version: expectedVersion, reason: reason ?? null }, token),
    acceptReschedule: (token, requestId) => rpc("accept_reschedule_request", { request_id: requestId }, token),
    rejectReschedule: (token, requestId) => rpc("reject_reschedule_request", { request_id: requestId }, token),
    cancelReschedule: (token, requestId) => rpc("cancel_reschedule_request", { request_id: requestId }, token),
    cancelSession: (token, sessionId, expectedVersion, reason) => rpc("cancel_session", { sid: sessionId, expected_version: expectedVersion, cause: "host", reason: reason ?? null }, token),
    rescheduleSession: (token, sessionId, startsAt, endsAt, expectedVersion) => rpc("reschedule_session", { sid: sessionId, starts_at: startsAt, ends_at: endsAt, expected_version: expectedVersion }, token),
    // Offering RPCs
    getOffering: (offeringId) => rpc("get_offering", { p_offering_id: offeringId }),
    listSessionsByOffering: (offeringId) => rpc("list_sessions_by_offering_id", { p_offering_id: offeringId }),
    createOffering: (token, params) => rpc("create_offering", {
      p_offering_type: params.offeringType,
      p_title: params.title,
      p_pricing_model: params.pricingModel,
      p_price_per_participant_vnd: params.pricePerParticipantVnd ?? null,
      p_hourly_rate_vnd: params.hourlyRateVnd ?? null,
      p_booking_mode: params.bookingMode ?? "approval",
      p_description: params.description ?? null
    }, token),
    updateOfferingStatus: (token, offeringId, expectedVersion, status) => rpc("update_offering_status", {
      p_offering_id: offeringId,
      p_expected_version: expectedVersion,
      p_status: status
    }, token),
    // Workshop Booking RPCs
    listWorkshopBookings: (token) => rpc("get_my_workshop_bookings", {}, token),
    cancelWorkshopBooking: (token, bookingId, expectedVersion, reason) => rpc("cancel_workshop_booking", {
      p_booking_id: bookingId,
      p_expected_version: expectedVersion,
      p_reason: reason ?? null
    }, token)
  };
}
