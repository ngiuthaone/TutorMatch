import { describe, it, expect } from "vitest";
import {
  acceptRescheduleRequest,
  applyTransition,
  createBooking,
  createRescheduleRequest,
  type Booking,
} from "../src/domain/booking-lifecycle.js";
import {
  cancelSession,
  cancelSessionWithBookings,
  changeCapacity,
  completeSession,
  createSession,
  isActive,
  minimumMet,
  occupancyWithin,
  rescheduleSession,
  type Session,
} from "../src/domain/session-lifecycle.js";

const at = "2026-08-12T10:00:00Z";
const START = "2026-08-20T09:00:00Z";
const END = "2026-08-20T11:30:00Z";

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: "s1",
    offeringId: "off-1",
    hostId: "host-1",
    startsAt: START,
    endsAt: END,
    status: "scheduled",
    history: [{ type: "created", at, by: "host" }],
    ...overrides,
  };
}

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "b1",
    sessionId: "s1",
    sessionDate: START,
    status: "requested",
    history: [],
    ...overrides,
  };
}

describe("createSession", () => {
  it("creates a scheduled session with a created history entry", () => {
    const result = createSession({
      id: "s1",
      offeringId: "off-1",
      hostId: "host-1",
      startsAt: START,
      endsAt: END,
      minParticipants: 5,
      maxParticipants: 15,
      at,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("scheduled");
    expect(result.value.minParticipants).toBe(5);
    expect(result.value.maxParticipants).toBe(15);
    expect(result.value.history).toHaveLength(1);
    expect(result.value.history[0]).toMatchObject({ type: "created", by: "host" });
  });

  it("rejects invalid input", () => {
    const overlong = createSession({
      id: "s1",
      offeringId: "off-1",
      hostId: "host-1",
      startsAt: END,
      endsAt: START,
    });
    expect(overlong.ok).toBe(false);
    const minOverMax = createSession({
      id: "s1",
      offeringId: "off-1",
      hostId: "host-1",
      startsAt: START,
      endsAt: END,
      minParticipants: 10,
      maxParticipants: 5,
    });
    expect(minOverMax.ok).toBe(false);
    const missing = createSession({
      id: "",
      offeringId: "off-1",
      hostId: "host-1",
      startsAt: START,
      endsAt: END,
    });
    expect(missing.ok).toBe(false);
  });
});

describe("rescheduleSession (Model A, in place)", () => {
  it("host moves the session in place: id stable, history preserves old/new, one SESSION_RESCHEDULED", () => {
    const result = rescheduleSession(session(), {
      startsAt: "2026-08-21T14:00:00Z",
      endsAt: "2026-08-21T16:30:00Z",
      by: "host",
      at,
      reason: "Studio availability",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.session.id).toBe("s1");
    expect(result.value.session.startsAt).toBe("2026-08-21T14:00:00Z");
    expect(result.value.session.endsAt).toBe("2026-08-21T16:30:00Z");
    const entry = result.value.session.history.at(-1);
    expect(entry).toMatchObject({
      type: "rescheduled",
      from: { startsAt: START, endsAt: END },
      to: { startsAt: "2026-08-21T14:00:00Z", endsAt: "2026-08-21T16:30:00Z" },
    });
    expect(result.value.event).toMatchObject({
      type: "SESSION_RESCHEDULED",
      sessionId: "s1",
      offeringId: "off-1",
      actor: "host",
      oldStart: START,
      oldEnd: END,
      newStart: "2026-08-21T14:00:00Z",
      newEnd: "2026-08-21T16:30:00Z",
      reason: "Studio availability",
    });
  });

  it("rejects an unchanged schedule with no event", () => {
    const result = rescheduleSession(session(), {
      startsAt: START,
      endsAt: END,
      by: "host",
      at,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NO_CHANGE");
  });

  it("denies non-host actors", () => {
    const bySystem = rescheduleSession(session(), {
      startsAt: "2026-08-21T14:00:00Z",
      endsAt: "2026-08-21T16:30:00Z",
      by: "system",
      at,
    });
    expect(bySystem.ok).toBe(false);
    if (!bySystem.ok) expect(bySystem.error.code).toBe("FORBIDDEN_ACTOR");
  });

  it("cannot reschedule a cancelled or completed session", () => {
    for (const status of ["cancelled", "completed"] as const) {
      const result = rescheduleSession(session({ status, history: [] }), {
        startsAt: "2026-08-21T14:00:00Z",
        endsAt: "2026-08-21T16:30:00Z",
        by: "host",
        at,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("INVALID_TRANSITION");
    }
  });
});

describe("cancelSession", () => {
  it("host cancels a scheduled session: one SESSION_CANCELLED with cause", () => {
    const result = cancelSession(session(), { by: "host", at, cause: "host", reason: "Chef ill" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.session.status).toBe("cancelled");
    expect(result.value.session.history.at(-1)).toMatchObject({
      type: "cancelled",
      cause: "host",
      reason: "Chef ill",
    });
    expect(result.value.event).toMatchObject({
      type: "SESSION_CANCELLED",
      sessionId: "s1",
      offeringId: "off-1",
      actor: "host",
      cause: "host",
      reason: "Chef ill",
    });
  });

  it("rejects unknown actors", () => {
    const result = cancelSession(session(), {
      by: "attendee" as never,
      at,
      cause: "host",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_TRANSITION");
  });

  it("duplicate cancellation is rejected with no second transition or event", () => {
    const first = cancelSession(session(), { by: "host", at, cause: "host" });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = cancelSession(first.value.session, { by: "host", at, cause: "host" });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe("INVALID_TRANSITION");
    expect(first.value.session.history).toHaveLength(2);
  });

  it("cancelled sessions are terminal: cannot reschedule, complete, or change capacity", () => {
    const cancelled = cancelSession(session(), { by: "host", at, cause: "host" });
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) return;
    expect(
      rescheduleSession(cancelled.value.session, {
        startsAt: "2026-08-21T14:00:00Z",
        endsAt: "2026-08-21T16:30:00Z",
        by: "host",
        at,
      }).ok,
    ).toBe(false);
    expect(completeSession(cancelled.value.session, { by: "host", at }).ok).toBe(false);
    expect(
      changeCapacity(cancelled.value.session, { max: 20, currentOccupancy: 10, by: "host", at })
        .ok,
    ).toBe(false);
  });

  it("the system actor may cancel only for minimum_not_met", () => {
    const allowed = cancelSession(session({ minParticipants: 5 }), {
      by: "system",
      at,
      cause: "minimum_not_met",
    });
    expect(allowed.ok).toBe(true);
    if (!allowed.ok) return;
    expect(allowed.value.session.status).toBe("cancelled");
    expect(allowed.value.event).toMatchObject({ actor: "system", cause: "minimum_not_met" });
    const denied = cancelSession(session(), { by: "system", at, cause: "host" });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe("FORBIDDEN_ACTOR");
  });

  it("cannot cancel a completed session", () => {
    const result = cancelSession(session({ status: "completed", history: [] }), {
      by: "host",
      at,
      cause: "host",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_TRANSITION");
  });
});

describe("completeSession", () => {
  it("completion requires the session to have ended, then is terminal", () => {
    const early = completeSession(session(), { by: "host", at: "2026-08-19T00:00:00Z" });
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.error.code).toBe("SESSION_IN_FUTURE");
    const done = completeSession(session(), { by: "host", at: "2026-08-20T12:00:00Z" });
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.value.status).toBe("completed");
    expect(
      cancelSession(done.value, { by: "host", at: "2026-08-20T12:00:00Z", cause: "host" }).ok,
    ).toBe(false);
  });
});

describe("changeCapacity", () => {
  it("increases capacity in place and records history", () => {
    const result = changeCapacity(session({ maxParticipants: 15 }), {
      max: 20,
      currentOccupancy: 10,
      by: "host",
      at,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.maxParticipants).toBe(20);
    expect(result.value.history.at(-1)).toMatchObject({
      type: "capacity_changed",
      from: 15,
      to: 20,
    });
  });

  it("rejects reduction below current occupancy", () => {
    const result = changeCapacity(session({ maxParticipants: 15 }), {
      max: 10,
      currentOccupancy: 14,
      by: "host",
      at,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("CAPACITY_EXCEEDED");
  });

  it("rejects on cancelled sessions and non-host actors", () => {
    const cancelled = cancelSession(session(), { by: "host", at, cause: "host" });
    expect(cancelled.ok).toBe(true);
    if (cancelled.ok) {
      expect(
        changeCapacity(cancelled.value.session, { max: 20, currentOccupancy: 5, by: "host", at })
          .ok,
      ).toBe(false);
    }
    const forbidden = changeCapacity(session(), {
      max: 20,
      currentOccupancy: 5,
      by: "system",
      at,
    });
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) expect(forbidden.error.code).toBe("FORBIDDEN_ACTOR");
  });
});

describe("derived conditions", () => {
  it("minimumMet is a derived condition, never a status", () => {
    const min = session({ minParticipants: 5 });
    expect(minimumMet(min, 3)).toBe(false);
    expect(minimumMet(min, 5)).toBe(true);
    expect(minimumMet(session(), 0)).toBe(true);
  });

  it("isActive and occupancyWithin reflect state", () => {
    const live = session({ maxParticipants: 15 });
    expect(isActive(live)).toBe(true);
    expect(occupancyWithin(live, 15)).toBe(true);
    expect(occupancyWithin(live, 16)).toBe(false);
    const cancelled = cancelSession(live, { by: "host", at, cause: "host" });
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) return;
    expect(isActive(cancelled.value.session)).toBe(false);
    const done = completeSession(session(), { by: "host", at: "2026-08-20T12:00:00Z" });
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(isActive(done.value)).toBe(false);
  });
});

describe("session cancellation fan-out (Strategy B)", () => {
  it("cancels every requested/confirmed booking with the session cause; terminal bookings stay", () => {
    const sessions = session({ id: "s1" });
    const bookings = [
      booking({ id: "a", status: "confirmed", history: [] }),
      booking({ id: "b", status: "confirmed", history: [] }),
      booking({ id: "c", status: "requested", history: [] }),
      booking({ id: "d", status: "cancelled", history: [] }),
      booking({ id: "e", status: "rejected", history: [] }),
    ];
    const result = cancelSessionWithBookings(sessions, bookings, {
      by: "host",
      at,
      cause: "host",
      reason: "Venue closed",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.session.status).toBe("cancelled");
    expect(result.value.sessionEvent).toMatchObject({ type: "SESSION_CANCELLED", cause: "host" });
    expect(result.value.bookingEvents).toHaveLength(3);
    expect(result.value.bookingEvents[0]?.type).toBe("BOOKING_CANCELLED");
    for (const ev of result.value.bookingEvents) {
      expect(ev.cancelledBySessionId).toBe("s1");
      expect(ev.actor).toBe("host");
    }
    for (const id of ["a", "b", "c"]) {
      const cancelled = result.value.bookings.find((b) => b.id === id);
      expect(cancelled?.status).toBe("cancelled");
      expect(cancelled?.cancelledBy).toBe("host");
      expect(cancelled?.cancelledBySessionId).toBe("s1");
      expect(cancelled?.cancelledReason).toBe("Venue closed");
      expect(cancelled?.history.at(-1)?.cancelledBySessionId).toBe("s1");
    }
    for (const id of ["d", "e"]) {
      const untouched = result.value.bookings.find((b) => b.id === id);
      expect(untouched?.status).toBe(id === "d" ? "cancelled" : "rejected");
    }
    expect(result.value.bookings).toHaveLength(5);
  });

  it("is all-or-nothing: a cancelled session fails the whole operation, bookings untouched", () => {
    const dead = cancelSession(session(), { by: "host", at, cause: "host" });
    expect(dead.ok).toBe(true);
    if (!dead.ok) return;
    const bookings = [booking({ id: "a", status: "confirmed", history: [] })];
    const result = cancelSessionWithBookings(dead.value.session, bookings, {
      by: "host",
      at,
      cause: "host",
    });
    expect(result.ok).toBe(false);
    const first = bookings[0];
    expect(first?.history).toHaveLength(0);
    expect(first?.status).toBe("confirmed");
  });
});

describe("cancelled-session guards composed with bookings", () => {
  it("an individual RescheduleRequest cannot be accepted onto a cancelled target session", () => {
    const target = session({ id: "s2" });
    const cancelledTarget = cancelSession(target, { by: "host", at, cause: "host" });
    expect(cancelledTarget.ok).toBe(true);
    if (!cancelledTarget.ok) return;
    const request = createRescheduleRequest(booking({ status: "confirmed" }), {
      id: "r1",
      toSessionId: "s2",
      requestedBy: "attendee",
      at,
    });
    expect(request.ok).toBe(true);
    if (!request.ok) return;
    const accept = acceptRescheduleRequest(request.value, booking({ status: "confirmed" }), {
      at,
      sessionOpen: (id) => id === "s2" && isActive(cancelledTarget.value.session),
    });
    expect(accept.ok).toBe(false);
    if (!accept.ok) expect(accept.error.code).toBe("UNAVAILABLE_SESSION");
  });

  it("a booking confirmed on a scheduled session stays valid; the session fact is authoritative", () => {
    const bookingConfirmed = applyTransition(booking(), "confirmed", { actor: "host", at });
    expect(bookingConfirmed.ok).toBe(true);
    if (bookingConfirmed.ok) {
      expect(bookingConfirmed.value.sessionId).toBe("s1");
      expect(createBooking("z", "s1", START, "attendee").ok).toBe(true);
    }
  });
});

describe("session completion stays separate from per-booking attendance outcomes", () => {
  it("completing a group session does NOT auto-complete any booking", () => {
    const done = completeSession(session(), { by: "host", at: "2026-08-20T12:00:00Z" });
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    const attended = applyTransition(booking({ status: "confirmed" }), "completed", {
      actor: "attendee",
      at,
      now: new Date("2026-08-20T12:00:00Z"),
      sessionEndAt: END,
    });
    expect(attended.ok).toBe(true);
    const stillConfirmed = applyTransition(booking({ status: "confirmed" }), "cancelled", {
      actor: "attendee",
      at,
    });
    expect(stillConfirmed.ok).toBe(true);
    // The session-level completion did not touch bookings; the learner's
    // completion and the second attendee's cancellation both remain possible.
    expect(attended.ok && stillConfirmed.ok).toBe(true);
  });
});