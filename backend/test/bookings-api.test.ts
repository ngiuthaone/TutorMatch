import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type { BookingService } from "../src/services/booking-service.js";
import { testConfig } from "./helpers/config.js";
import { FakeAuthService } from "./helpers/fake-auth-service.js";

const apps: ReturnType<typeof createApp>[] = [];
afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

function setup(overrides: Partial<BookingService> = {}, authenticated = false) {
  const calls: Array<{ name: string; args: unknown[] }> = [];
  const ok = (data: unknown) => Promise.resolve({ data, error: null });
  const service: BookingService = {
    listSessions: async (...args) => { calls.push({ name: "listSessions", args }); return ok([{ id: "session-1" }]); },
    getSession: async (...args) => { calls.push({ name: "getSession", args }); return ok({ id: "session-1" }); },
    createBooking: async (...args) => { calls.push({ name: "createBooking", args }); return ok({ id: "booking-1" }); },
    listLearnerBookings: async (...args) => { calls.push({ name: "listLearnerBookings", args }); return ok([]); },
    listTutorBookings: async (...args) => { calls.push({ name: "listTutorBookings", args }); return ok([]); },
    getBooking: async (...args) => { calls.push({ name: "getBooking", args }); return ok({ id: "booking-1", paymentReady: true }); },
    tutorAccept: async (...args) => { calls.push({ name: "tutorAccept", args }); return ok({ bookingId: "booking-1" }); },
    tutorReject: async (...args) => { calls.push({ name: "tutorReject", args }); return ok({ id: "booking-1" }); },
    tutorCancel: async (...args) => { calls.push({ name: "tutorCancel", args }); return ok({ id: "booking-1" }); },
    learnerCancel: async (...args) => { calls.push({ name: "learnerCancel", args }); return ok({ id: "booking-1" }); },
    getCancellationPreview: async (...args) => { calls.push({ name: "getCancellationPreview", args }); return ok({ allowed: true, refundMode: "FULL", refundAmountVnd: 300000 }); },
    createRescheduleRequest: async (...args) => { calls.push({ name: "createRescheduleRequest", args }); return ok({ id: "request-1" }); },
    acceptReschedule: async (...args) => { calls.push({ name: "acceptReschedule", args }); return ok({ status: "accepted" }); },
    rejectReschedule: async (...args) => { calls.push({ name: "rejectReschedule", args }); return ok({ status: "rejected" }); },
    cancelReschedule: async (...args) => { calls.push({ name: "cancelReschedule", args }); return ok({ status: "cancelled" }); },
    cancelSession: async (...args) => { calls.push({ name: "cancelSession", args }); return ok({ id: "session-1" }); },
    rescheduleSession: async (...args) => { calls.push({ name: "rescheduleSession", args }); return ok({ id: "session-1" }); },
    getOffering: async (...args) => { calls.push({ name: "getOffering", args }); return ok(null); },
    listSessionsByOffering: async (...args) => { calls.push({ name: "listSessionsByOffering", args }); return ok([]); },
    createOffering: async (...args) => { calls.push({ name: "createOffering", args }); return ok({ id: "offering-1" }); },
    updateOfferingStatus: async (...args) => { calls.push({ name: "updateOfferingStatus", args }); return ok({ id: "offering-1" }); },
    listWorkshopBookings: async (...args) => { calls.push({ name: "listWorkshopBookings", args }); return ok([]); },
    cancelWorkshopBooking: async (...args) => { calls.push({ name: "cancelWorkshopBooking", args }); return ok({ id: "booking-1" }); },
    ...overrides
  };
  const authService = new FakeAuthService();
  if (authenticated) authService.authentication = { status: "authenticated", user: { id: "11111111-1111-4111-8111-111111111111", email: "learner@example.test" } };
  const app = createApp({ config: testConfig, authService, bookingService: service });
  apps.push(app);
  return { app, calls };
}

describe("1:1 booking API boundary", () => {
  it("exposes public availability without allowing anonymous booking", async () => {
    const { app, calls } = setup();
    expect((await app.inject({ method: "GET", url: "/api/v1/sessions" })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/api/v1/bookings", payload: { sessionId: "11111111-1111-4111-8111-111111111111" } })).statusCode).toBe(401);
    expect(calls[0]?.name).toBe("listSessions");
  });

  it("returns server-authoritative booking state and routes learner reads", async () => {
    const { app, calls } = setup({}, true);
    const auth = { authorization: "Bearer test-token" };
    const created = await app.inject({ method: "POST", url: "/api/v1/bookings", headers: auth, payload: { sessionId: "11111111-1111-4111-8111-111111111111", participantCount: 2 } });
    expect(created.statusCode).toBe(200);
    expect(created.json().booking.paymentReady).toBe(true);
    expect(calls.find((call) => call.name === "createBooking")?.args.slice(1)).toEqual(["11111111-1111-4111-8111-111111111111", 2]);
    expect((await app.inject({ method: "GET", url: "/api/v1/bookings", headers: auth })).statusCode).toBe(200);
  });

  it("keeps verification-required and rate-limited outcomes distinct", async () => {
    const verification = setup({ createBooking: async () => ({ data: null, error: { code: "P0001", message: "EMAIL_VERIFICATION_REQUIRED" } }) }, true);
    const verifiedResponse = await verification.app.inject({ method: "POST", url: "/api/v1/bookings", headers: { authorization: "Bearer test-token" }, payload: { sessionId: "11111111-1111-4111-8111-111111111111" } });
    expect(verifiedResponse.statusCode).toBe(403);
    expect(verifiedResponse.json().error.code).toBe("EMAIL_VERIFICATION_REQUIRED");

    const limited = setup({ createBooking: async () => ({ data: null, error: { code: "P0001", message: "RATE_LIMITED" } }) }, true);
    const limitedResponse = await limited.app.inject({ method: "POST", url: "/api/v1/bookings", headers: { authorization: "Bearer test-token" }, payload: { sessionId: "11111111-1111-4111-8111-111111111111" } });
    expect(limitedResponse.statusCode).toBe(429);
    expect(limitedResponse.json().error.code).toBe("RATE_LIMITED");
  });

  it("maps stale lifecycle errors to stable API semantics", async () => {
    const { app } = setup({ tutorReject: async () => ({ data: null, error: { code: "40001", message: "STALE_VERSION" } }) }, true);
    const response = await app.inject({ method: "POST", url: "/api/v1/bookings/11111111-1111-4111-8111-111111111111/reject", headers: { authorization: "Bearer test-token" }, payload: { expectedVersion: 1 } });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("STALE_VERSION");
  });

  it("exposes authoritative cancellation preview and tutor cancellation without client financial authority", async () => {
    const { app, calls } = setup({}, true);
    const auth = { authorization: "Bearer test-token" };
    const preview = await app.inject({ method: "GET", url: "/api/v1/bookings/11111111-1111-4111-8111-111111111111/cancellation-preview", headers: auth });
    expect(preview.statusCode).toBe(200);
    expect(preview.json().preview.refundMode).toBe("FULL");
    const cancelled = await app.inject({ method: "POST", url: "/api/v1/tutor/bookings/11111111-1111-4111-8111-111111111111/cancel", headers: auth, payload: { expectedVersion: 2, reason: "Tutor unavailable", refundAmountVnd: 1 } });
    expect(cancelled.statusCode).toBe(200);
    expect(calls.find((call) => call.name === "tutorCancel")?.args).toEqual(["test-token", "11111111-1111-4111-8111-111111111111", 2, "Tutor unavailable"]);
    expect(calls.find((call) => call.name === "tutorCancel")?.args).not.toContain(1);
  });

  it("maps cancellation conflicts to stable errors", async () => {
    const { app } = setup({ tutorCancel: async () => ({ data: null, error: { code: "22023", message: "INVALID_TRANSITION" } }) }, true);
    const response = await app.inject({ method: "POST", url: "/api/v1/tutor/bookings/11111111-1111-4111-8111-111111111111/cancel", headers: { authorization: "Bearer test-token" }, payload: { expectedVersion: 1 } });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("INVALID_LIFECYCLE_TRANSITION");
  });
});
