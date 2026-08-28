import { describe, it, expect } from "vitest";
import {
  acceptRescheduleRequest,
  applyTransition,
  attendanceEventFor,
  canTransition,
  cancelRescheduleRequest,
  capacityImpact,
  createBooking,
  createRescheduleRequest,
  domainEventsFor,
  domainEventsForRequest,
  holdsSeat,
  listAllowedTransitions,
  recordAttendance,
  rejectRescheduleRequest,
  reviewEligible,
  type AttendanceFact,
  type Booking,
  type BookingDomainEvent,
  type RescheduleRequest,
} from "../src/domain/booking-lifecycle.js";

const at = "2026-08-12T10:00:00Z";
const PAST = new Date("2026-08-01T00:00:00Z");
const FUTURE = new Date("2026-12-01T00:00:00Z");

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "b1",
    sessionId: "s1",
    sessionDate: "2026-08-20T09:00:00Z",
    status: "requested",
    history: [],
    ...overrides,
  };
}

function request(overrides: Partial<RescheduleRequest> = {}): RescheduleRequest {
  return {
    id: "r1",
    bookingId: "b1",
    fromSessionId: "s1",
    toSessionId: "s2",
    requestedBy: "attendee",
    status: "requested",
    createdAt: at,
    ...overrides,
  };
}

describe("createBooking", () => {
  it("creates a requested booking with a creation history entry", () => {
    const result = createBooking("b1", "s1", "2026-08-20T09:00:00Z", "attendee");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("requested");
    expect(result.value.history).toHaveLength(1);
  });

  it("rejects missing identity/session input", () => {
    const result = createBooking("", "s1", "2026-08-20", "attendee");
    expect(result.ok).toBe(false);
  });
});

describe("allowed transitions", () => {
  it("allows requested -> confirmed only for the host", () => {
    expect(canTransition("requested", "confirmed", "host")).toBe(true);
    expect(canTransition("requested", "confirmed", "attendee")).toBe(false);
  });

  it("allows requested -> rejected only for the host", () => {
    expect(canTransition("requested", "rejected", "host")).toBe(true);
    expect(canTransition("requested", "rejected", "attendee")).toBe(false);
  });

  it("allows requested -> cancelled (withdraw) only for the attendee", () => {
    expect(canTransition("requested", "cancelled", "attendee")).toBe(true);
    expect(canTransition("requested", "cancelled", "host")).toBe(false);
  });

  it("allows confirmed -> cancelled for both actors", () => {
    expect(canTransition("confirmed", "cancelled", "attendee")).toBe(true);
    expect(canTransition("confirmed", "cancelled", "host")).toBe(true);
  });

  it("allows confirmed -> completed only for the attendee (learner confirms completion)", () => {
    expect(canTransition("confirmed", "completed", "attendee")).toBe(true);
    expect(canTransition("confirmed", "completed", "host")).toBe(false);
  });
});

describe("applyTransition guards", () => {
  it("host confirms a requested booking", () => {
    const result = applyTransition(booking(), "confirmed", { actor: "host", at });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("confirmed");
    expect(result.value.history[0]).toEqual({
      from: "requested",
      to: "confirmed",
      actor: "host",
      at,
      reason: undefined,
    });
  });

  it("forbids the attendee from confirming", () => {
    const result = applyTransition(booking(), "confirmed", { actor: "attendee", at });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("FORBIDDEN_ACTOR");
  });

  it("host rejects with a reason, and rejection is terminal", () => {
    const result = applyTransition(booking(), "rejected", { actor: "host", at, reason: "No longer hosting" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const rejected = result.value;
    expect(rejected.cancelledBy).toBeUndefined();
    expect(rejected.history[0]?.reason).toBe("No longer hosting");
    const again = applyTransition(rejected, "confirmed", { actor: "host", at });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.code).toBe("INVALID_TRANSITION");
  });

  it("blocks forbidden transitions: confirmed -> requested, requested -> completed, host -> completed", () => {
    const confirmed = booking({ status: "confirmed" });
    const back = applyTransition(confirmed, "requested", { actor: "attendee", at });
    expect(back.ok).toBe(false);
    if (!back.ok) expect(back.error.code).toBe("INVALID_TRANSITION");

    const straight = applyTransition(booking(), "completed", { actor: "host", at, now: PAST });
    expect(straight.ok).toBe(false);
    if (!straight.ok) expect(straight.error.code).toBe("INVALID_TRANSITION");

    const hostComplete = applyTransition(booking({ status: "confirmed" }), "completed", {
      actor: "host",
      at,
      now: FUTURE,
      sessionEndAt: "2026-08-20T10:00:00Z",
    });
    expect(hostComplete.ok).toBe(false);
    if (!hostComplete.ok) expect(hostComplete.error.code).toBe("FORBIDDEN_ACTOR");
  });

  it("terminal statuses accept no transitions", () => {
    for (const status of ["cancelled", "rejected", "completed"] as const) {
      const done = booking({ status });
      for (const target of ["requested", "confirmed", "cancelled", "completed"] as const) {
        const result = applyTransition(done, target, { actor: "host", at });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe("INVALID_TRANSITION");
      }
    }
  });

  it("records actor and reason on cancellation", () => {
    const result = applyTransition(booking({ status: "confirmed" }), "cancelled", {
      actor: "attendee",
      at,
      reason: "Schedule conflict",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cancelledBy).toBe("attendee");
    expect(result.value.cancelledReason).toBe("Schedule conflict");
  });

  it("completing requires the session to have ended (sessionEndAt) and only the learner may do it", () => {
    const confirmed = booking({ status: "confirmed" });

    const missingEnd = applyTransition(confirmed, "completed", { actor: "attendee", at, now: FUTURE });
    expect(missingEnd.ok).toBe(false);
    if (!missingEnd.ok) expect(missingEnd.error.code).toBe("INVALID_TRANSITION");

    const beforeEnd = applyTransition(confirmed, "completed", {
      actor: "attendee",
      at,
      now: PAST,
      sessionEndAt: "2026-08-20T10:00:00Z",
    });
    expect(beforeEnd.ok).toBe(false);
    if (!beforeEnd.ok) expect(beforeEnd.error.code).toBe("SESSION_IN_FUTURE");

    const atEnd = applyTransition(confirmed, "completed", {
      actor: "attendee",
      at,
      now: new Date("2026-08-20T10:00:00Z"),
      sessionEndAt: "2026-08-20T10:00:00Z",
    });
    expect(atEnd.ok).toBe(true);

    const afterEnd = applyTransition(confirmed, "completed", {
      actor: "attendee",
      at,
      now: FUTURE,
      sessionEndAt: "2026-08-20T10:00:00Z",
    });
    expect(afterEnd.ok).toBe(true);
    if (!afterEnd.ok) return;
    expect(afterEnd.value.status).toBe("completed");
    expect(afterEnd.value.attendance).toEqual([
      {
        outcome: "attended",
        reportedBy: "attendee",
        at,
        sessionId: "s1",
        priorStatus: "confirmed",
      },
    ]);
  });

  it("records the learner's attended attendance fact on completion and marks review-eligible", () => {
    const result = applyTransition(booking({ status: "confirmed" }), "completed", {
      actor: "attendee",
      at,
      now: FUTURE,
      sessionEndAt: "2026-08-20T10:00:00Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(reviewEligible(result.value)).toBe(true);
  });

  it("is immutable: the input booking is never mutated", () => {
    const input = booking({ status: "confirmed" });
    const snapshot = JSON.stringify(input);
    void applyTransition(input, "cancelled", { actor: "host", at, reason: "x" });
    const proposal = createRescheduleRequest(input, {
      id: "r1",
      toSessionId: "s2",
      requestedBy: "attendee",
      at,
    });
    expect(proposal.ok).toBe(true);
    if (proposal.ok) {
      void acceptRescheduleRequest({ ...proposal.value }, input, {
        at,
        sessionOpen: () => true,
      });
    }
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe("capacity accounting", () => {
  it("holds a seat while requested or confirmed", () => {
    expect(holdsSeat("requested")).toBe(true);
    expect(holdsSeat("confirmed")).toBe(true);
    expect(holdsSeat("cancelled")).toBe(false);
    expect(holdsSeat("rejected")).toBe(false);
    expect(holdsSeat("completed")).toBe(false);
  });

  it("releases the seat on cancellation/rejection, not on confirmation", () => {
    expect(capacityImpact("requested", "confirmed")).toEqual({ seatHeld: true, seatReleased: false });
    expect(capacityImpact("requested", "cancelled")).toEqual({ seatHeld: false, seatReleased: true });
    expect(capacityImpact("confirmed", "cancelled")).toEqual({ seatHeld: false, seatReleased: true });
    expect(capacityImpact("confirmed", "completed")).toEqual({ seatHeld: false, seatReleased: true });
    expect(capacityImpact("confirmed", "confirmed")).toEqual({ seatHeld: true, seatReleased: false });
  });
});

describe("initial booking request lifecycle (Model A)", () => {
  it("a booking exists from the moment the learner requests, with stable identity through confirmation", () => {
    const created = createBooking("b1", "s1", "2026-08-20T09:00:00Z", "attendee");
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.status).toBe("requested");
    expect(created.value.id).toBe("b1");
    const confirmed = applyTransition(created.value, "confirmed", { actor: "host", at });
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect(confirmed.value.status).toBe("confirmed");
    expect(confirmed.value.id).toBe("b1");
  });

  it("requested holds capacity; rejected and cancelled release it", () => {
    expect(holdsSeat("requested")).toBe(true);
    expect(capacityImpact("requested", "rejected")).toEqual({ seatHeld: false, seatReleased: true });
    expect(capacityImpact("requested", "cancelled")).toEqual({ seatHeld: false, seatReleased: true });
  });

  it("decline (rejected) is terminal and distinct from cancellation", () => {
    const declined = applyTransition(booking(), "rejected", { actor: "host", at, reason: "No longer hosting" });
    expect(declined.ok).toBe(true);
    if (!declined.ok) return;
    expect(declined.value.cancelledBy).toBeUndefined();
    const toCancelled = applyTransition(declined.value, "cancelled", { actor: "host", at });
    expect(toCancelled.ok).toBe(false);
    if (!toCancelled.ok) expect(toCancelled.error.code).toBe("INVALID_TRANSITION");
    const toConfirmed = applyTransition(declined.value, "confirmed", { actor: "host", at });
    expect(toConfirmed.ok).toBe(false);
    if (!toConfirmed.ok) expect(toConfirmed.error.code).toBe("INVALID_TRANSITION");
  });

  it("learner withdrawal is recorded distinctly from cancellation of a confirmed booking", () => {
    const withdrawn = applyTransition(booking(), "cancelled", { actor: "attendee", at });
    expect(withdrawn.ok).toBe(true);
    if (!withdrawn.ok) return;
    expect(withdrawn.value.cancelledBy).toBe("attendee");
    expect(withdrawn.value.history.at(-1)?.from).toBe("requested");

    const cancelled = applyTransition(booking({ status: "confirmed" }), "cancelled", { actor: "attendee", at });
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) return;
    expect(cancelled.value.cancelledBy).toBe("attendee");
    expect(cancelled.value.history.at(-1)?.from).toBe("confirmed");
    expect(withdrawn.value.history.at(-1)?.from).not.toBe(cancelled.value.history.at(-1)?.from);

    const resurrect = applyTransition(withdrawn.value, "confirmed", { actor: "host", at });
    expect(resurrect.ok).toBe(false);
    if (!resurrect.ok) expect(resurrect.error.code).toBe("INVALID_TRANSITION");
    const retry = applyTransition(cancelled.value, "requested", { actor: "attendee", at });
    expect(retry.ok).toBe(false);
    if (!retry.ok) expect(retry.error.code).toBe("INVALID_TRANSITION");
  });

  it("duplicate resolution commands are rejected and never resurrect a terminal booking", () => {
    const firstConfirm = applyTransition(booking(), "confirmed", { actor: "host", at });
    expect(firstConfirm.ok).toBe(true);
    if (!firstConfirm.ok) return;
    const secondConfirm = applyTransition(firstConfirm.value, "confirmed", { actor: "host", at });
    expect(secondConfirm.ok).toBe(false);
    if (!secondConfirm.ok) expect(secondConfirm.error.code).toBe("INVALID_TRANSITION");

    const firstDecline = applyTransition(booking(), "rejected", { actor: "host", at });
    expect(firstDecline.ok).toBe(true);
    if (!firstDecline.ok) return;
    const secondDecline = applyTransition(firstDecline.value, "rejected", { actor: "host", at });
    expect(secondDecline.ok).toBe(false);
    if (!secondDecline.ok) expect(secondDecline.error.code).toBe("INVALID_TRANSITION");

    const confirmAfterDecline = applyTransition(firstDecline.value, "confirmed", { actor: "host", at });
    expect(confirmAfterDecline.ok).toBe(false);
    if (!confirmAfterDecline.ok) expect(confirmAfterDecline.error.code).toBe("INVALID_TRANSITION");

    const withdrawn = applyTransition(booking(), "cancelled", { actor: "attendee", at });
    expect(withdrawn.ok).toBe(true);
    if (!withdrawn.ok) return;
    const confirmAfterWithdraw = applyTransition(withdrawn.value, "confirmed", { actor: "host", at });
    expect(confirmAfterWithdraw.ok).toBe(false);
    if (!confirmAfterWithdraw.ok) expect(confirmAfterWithdraw.error.code).toBe("INVALID_TRANSITION");

    const declineAfterConfirm = applyTransition(firstConfirm.value, "rejected", { actor: "host", at });
    expect(declineAfterConfirm.ok).toBe(false);
    if (!declineAfterConfirm.ok) expect(declineAfterConfirm.error.code).toBe("INVALID_TRANSITION");
  });

  it("a terminal request outcome does not block a NEW booking from the same actors", () => {
    const old = applyTransition(booking(), "rejected", { actor: "host", at });
    expect(old.ok).toBe(true);
    if (!old.ok) return;
    const fresh = createBooking("b2", "s1", "2026-08-20T09:00:00Z", "attendee");
    expect(fresh.ok).toBe(true);
    if (!fresh.ok) return;
    expect(fresh.value.id).toBe("b2");
    expect(fresh.value.status).toBe("requested");
  });
});

describe("cancellation lifecycle (Model A)", () => {
  function eventsOf(result: ReturnType<typeof applyTransition>) {
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    const last = result.value.history.at(-1);
    if (!last) throw new Error("no transition entry");
    return domainEventsFor({ booking: result.value, transition: last });
  }

  it("learner cancellation of a confirmed booking is immediate and recorded", () => {
    const result = applyTransition(booking({ status: "confirmed" }), "cancelled", {
      actor: "attendee",
      at,
      reason: "Schedule conflict",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("cancelled");
    expect(result.value.cancelledBy).toBe("attendee");
    expect(result.value.cancelledReason).toBe("Schedule conflict");
    const resurrect = applyTransition(result.value, "confirmed", { actor: "host", at });
    expect(resurrect.ok).toBe(false);
    if (!resurrect.ok) expect(resurrect.error.code).toBe("INVALID_TRANSITION");
    expect(capacityImpact("confirmed", "cancelled")).toEqual({ seatHeld: false, seatReleased: true });
  });

  it("host cancellation of a confirmed booking records the host as actor", () => {
    const result = applyTransition(booking({ status: "confirmed" }), "cancelled", {
      actor: "host",
      at,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cancelledBy).toBe("host");
    const events = eventsOf(result);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "BOOKING_CANCELLED",
      actor: "host",
      fromStatus: "confirmed",
      recipients: { attendee: true, host: false },
    });
  });

  it("the BOOKING_CANCELLED event distinguishes withdrawal from confirmed cancellation via fromStatus", () => {
    const withdraw = eventsOf(applyTransition(booking(), "cancelled", { actor: "attendee", at }));
    const cancel = eventsOf(
      applyTransition(booking({ status: "confirmed" }), "cancelled", { actor: "attendee", at }),
    );
    expect(withdraw).toHaveLength(1);
    expect(cancel).toHaveLength(1);
    expect(withdraw[0]).toMatchObject({
      type: "BOOKING_CANCELLED",
      actor: "attendee",
      recipients: { attendee: false, host: true },
    });
    expect(cancel[0]).toMatchObject({
      type: "BOOKING_CANCELLED",
      actor: "attendee",
      recipients: { attendee: false, host: true },
    });
    expect(withdraw[0]?.fromStatus).toBe("requested");
    expect(cancel[0]?.fromStatus).toBe("confirmed");
  });

  it("duplicate cancellation is rejected with no event", () => {
    const first = applyTransition(booking({ status: "confirmed" }), "cancelled", {
      actor: "attendee",
      at,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(eventsOf(first)).toHaveLength(1);
    const second = applyTransition(first.value, "cancelled", { actor: "attendee", at });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe("INVALID_TRANSITION");
  });

  it("cancellation of completed, rejected, and already-cancelled bookings is invalid", () => {
    for (const status of ["completed", "rejected", "cancelled"] as const) {
      const result = applyTransition(booking({ status }), "cancelled", { actor: "host", at });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("INVALID_TRANSITION");
    }
  });

  it("cancellation is permitted regardless of session timing (no cutoff); timestamps are preserved for future refund policy", () => {
    // No cutoff policy exists: a session in the past can still be cancelled.
    // Refund timing is a separate policy and not modeled here.
    const result = applyTransition(
      booking({ status: "confirmed", sessionDate: "2026-08-01T09:00:00Z" }),
      "cancelled",
      { actor: "attendee", at },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.history.at(-1)?.at).toBe(at);
    expect(result.value.sessionDate).toBe("2026-08-01T09:00:00Z");
  });

  it("cancelled bookings cannot create or accept reschedule requests", () => {
    const cancelled = booking({ status: "cancelled" });
    const proposal = createRescheduleRequest(cancelled, {
      id: "r1",
      toSessionId: "s2",
      requestedBy: "attendee",
      at,
    });
    expect(proposal.ok).toBe(false);
    if (!proposal.ok) expect(proposal.error.code).toBe("INVALID_TRANSITION");

    const pending = request();
    const accept = acceptRescheduleRequest(pending, cancelled, {
      at,
      sessionOpen: () => true,
    });
    expect(accept.ok).toBe(false);
    if (!accept.ok) expect(accept.error.code).toBe("INVALID_TRANSITION");
    expect(pending.status).toBe("requested");
  });

  it("rejecting a reschedule request never cancels the booking", () => {
    const input = booking({ status: "confirmed" });
    const proposal = createRescheduleRequest(input, {
      id: "r1",
      toSessionId: "s2",
      requestedBy: "attendee",
      at,
    });
    expect(proposal.ok).toBe(true);
    if (!proposal.ok) return;
    const result = rejectRescheduleRequest(proposal.value, { by: "host", at });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("rejected");
    expect(input.status).toBe("confirmed");
    expect(input.sessionId).toBe("s1");
    expect(input.history).toHaveLength(0);
  });
});

describe("session-derived cancellation (causal attribution)", () => {
  it("a host cannot cancel a pending request independently; session-derived cancellation is required", () => {
    const alone = applyTransition(booking({ status: "requested" }), "cancelled", {
      actor: "host",
      at,
    });
    expect(alone.ok).toBe(false);
    if (!alone.ok) expect(alone.error.code).toBe("FORBIDDEN_ACTOR");
    const sessionSourced = applyTransition(booking({ status: "requested" }), "cancelled", {
      actor: "host",
      at,
      cancelledBySessionId: "s9",
    });
    expect(sessionSourced.ok).toBe(true);
    if (!sessionSourced.ok) return;
    expect(sessionSourced.value.cancelledBy).toBe("host");
    expect(sessionSourced.value.cancelledBySessionId).toBe("s9");
    expect(sessionSourced.value.history.at(-1)?.cancelledBySessionId).toBe("s9");
  });

  it("BOOKING_CANCELLED carries cancelledBySessionId only for session-derived cancellations", () => {
    const lastOf = (
      result: ReturnType<typeof applyTransition>,
    ): BookingDomainEvent => {
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.error.message);
      const last = result.value.history.at(-1);
      if (!last) throw new Error("no transition entry");
      const [event] = domainEventsFor({ booking: result.value, transition: last });
      if (!event) throw new Error("no event");
      return event;
    };
    const sessionSourced = lastOf(
      applyTransition(booking({ status: "confirmed" }), "cancelled", {
        actor: "host",
        at,
        cancelledBySessionId: "s9",
      }),
    );
    expect(sessionSourced.type).toBe("BOOKING_CANCELLED");
    expect(sessionSourced.cancelledBySessionId).toBe("s9");
    const individual = lastOf(
      applyTransition(booking({ status: "confirmed" }), "cancelled", { actor: "host", at }),
    );
    expect(individual.type).toBe("BOOKING_CANCELLED");
    expect(individual.cancelledBySessionId).toBeUndefined();
    const withdrawal = lastOf(
      applyTransition(booking(), "cancelled", { actor: "attendee", at }),
    );
    expect(withdrawal.type).toBe("BOOKING_CANCELLED");
    expect(withdrawal.cancelledBySessionId).toBeUndefined();
  });
});

describe("reschedule request (Model C)", () => {
  it("creates a pending request from a requested or confirmed booking", () => {
    for (const status of ["requested", "confirmed"] as const) {
      const result = createRescheduleRequest(booking({ status }), {
        id: "r1",
        toSessionId: "s2",
        requestedBy: "attendee",
        at,
        reason: "Work conflict",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.error.message);
      expect(result.value).toEqual({
        id: "r1",
        bookingId: "b1",
        fromSessionId: "s1",
        toSessionId: "s2",
        requestedBy: "attendee",
        status: "requested",
        createdAt: at,
        reason: "Work conflict",
      });
    }
  });

  it("rejects proposals from terminal bookings", () => {
    for (const status of ["cancelled", "rejected", "completed"] as const) {
      const result = createRescheduleRequest(booking({ status }), {
        id: "r1",
        toSessionId: "s2",
        requestedBy: "attendee",
        at,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("INVALID_TRANSITION");
    }
  });

  it("rejects a proposal targeting the current session", () => {
    const result = createRescheduleRequest(booking({ status: "confirmed" }), {
      id: "r1",
      toSessionId: "s1",
      requestedBy: "attendee",
      at,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("SAME_SESSION");
  });

  it("creation performs no capacity check and never touches the booking", () => {
    const input = booking({ status: "confirmed" });
    const snapshot = JSON.stringify(input);
    const result = createRescheduleRequest(input, {
      id: "r1",
      toSessionId: "s2",
      requestedBy: "attendee",
      at,
    });
    expect(result.ok).toBe(true);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("one-pending-request-per-booking is enforced by the caller, not the module", () => {
    // The module is stateless (no persistence), so it cannot track existing
    // requests; the caller/persistence layer guards uniqueness before
    // persisting a second pending request for the same booking.
    const result = createRescheduleRequest(booking({ status: "confirmed" }), {
      id: "r1",
      toSessionId: "s2",
      requestedBy: "attendee",
      at,
    });
    expect(result.ok).toBe(true);
  });
});

describe("reject and cancel preserve the original booking", () => {
  it("host rejection keeps the booking confirmed and resolves the request", () => {
    const input = booking({ status: "confirmed" });
    const proposal = createRescheduleRequest(input, {
      id: "r1",
      toSessionId: "s2",
      requestedBy: "attendee",
      at,
    });
    expect(proposal.ok).toBe(true);
    if (!proposal.ok) return;
    const result = rejectRescheduleRequest(proposal.value, {
      by: "host",
      at,
      reason: "No capacity",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      ...proposal.value,
      status: "rejected",
      resolvedAt: at,
      reason: "No capacity",
    });
    expect(input.status).toBe("confirmed");
    expect(input.sessionId).toBe("s1");
    expect(input.history).toHaveLength(0);
  });

  it("the requester cannot reject their own proposal", () => {
    const input = booking({ status: "confirmed" });
    const proposal = createRescheduleRequest(input, {
      id: "r1",
      toSessionId: "s2",
      requestedBy: "attendee",
      at,
    });
    expect(proposal.ok).toBe(true);
    if (!proposal.ok) return;
    const result = rejectRescheduleRequest(proposal.value, { by: "attendee", at });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN_ACTOR");
    expect(input.status).toBe("confirmed");
    expect(input.history).toHaveLength(0);
  });

  it("the requester can withdraw their own proposal", () => {
    const input = booking({ status: "confirmed" });
    const proposal = createRescheduleRequest(input, {
      id: "r1",
      toSessionId: "s2",
      requestedBy: "attendee",
      at,
    });
    expect(proposal.ok).toBe(true);
    if (!proposal.ok) return;
    const result = cancelRescheduleRequest(proposal.value, { by: "attendee", at });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("cancelled");
    expect(result.value.resolvedAt).toBe(at);
    expect(input.status).toBe("confirmed");
    expect(input.sessionId).toBe("s1");
    expect(input.history).toHaveLength(0);
  });

  it("the counterpart cannot cancel the request", () => {
    const input = booking({ status: "confirmed" });
    const proposal = createRescheduleRequest(input, {
      id: "r1",
      toSessionId: "s2",
      requestedBy: "attendee",
      at,
    });
    expect(proposal.ok).toBe(true);
    if (!proposal.ok) return;
    const result = cancelRescheduleRequest(proposal.value, { by: "host", at });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN_ACTOR");
    expect(input.status).toBe("confirmed");
    expect(input.history).toHaveLength(0);
  });

  it("a resolved request cannot be rejected again (idempotency/terminality)", () => {
    const resolved = request({ status: "accepted", resolvedAt: at });
    const result = rejectRescheduleRequest(resolved, { by: "host", at });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("REQUEST_NOT_PENDING");
  });
});

describe("acceptance mutates the booking in place", () => {
  it("host acceptance of an attendee proposal swaps the session on the same booking", () => {
    const input = booking({ status: "confirmed" });
    const proposal = createRescheduleRequest(input, {
      id: "r1",
      toSessionId: "s2",
      requestedBy: "attendee",
      at,
      reason: "Work conflict",
    });
    expect(proposal.ok).toBe(true);
    if (!proposal.ok) return;
    const result = acceptRescheduleRequest(proposal.value, input, {
      at,
      sessionOpen: () => true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBe("b1");
    expect(result.value.sessionId).toBe("s2");
    expect(result.value.status).toBe("confirmed");
    expect(result.value.rescheduledFromSession).toBe("s1");
    expect(result.value.history).toHaveLength(1);
    expect(result.value.history[0]).toEqual({
      from: "confirmed",
      to: "confirmed",
      actor: "host",
      at,
      reason: "Work conflict",
      sessionChange: { from: "s1", to: "s2" },
    });
  });

  it("attendee acceptance of a host proposal records the attendee as actor", () => {
    const input = booking({ status: "confirmed" });
    const proposal = createRescheduleRequest(input, {
      id: "r1",
      toSessionId: "s2",
      requestedBy: "host",
      at,
    });
    expect(proposal.ok).toBe(true);
    if (!proposal.ok) return;
    const result = acceptRescheduleRequest(proposal.value, input, {
      at,
      sessionOpen: () => true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.history[0]?.actor).toBe("attendee");
    expect(result.value.sessionId).toBe("s2");
  });

  it("acceptance keeps a requested-status booking requested", () => {
    const input = booking();
    const proposal = createRescheduleRequest(input, {
      id: "r1",
      toSessionId: "s2",
      requestedBy: "attendee",
      at,
    });
    expect(proposal.ok).toBe(true);
    if (!proposal.ok) return;
    const result = acceptRescheduleRequest(proposal.value, input, {
      at,
      sessionOpen: () => true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("requested");
    expect(result.value.history[0]?.from).toBe("requested");
    expect(result.value.history[0]?.to).toBe("requested");
  });

  it("fails with UNAVAILABLE_SESSION when capacity is not re-available at acceptance", () => {
    const input = booking({ status: "confirmed" });
    const proposal = createRescheduleRequest(input, {
      id: "r1",
      toSessionId: "s2",
      requestedBy: "attendee",
      at,
    });
    expect(proposal.ok).toBe(true);
    if (!proposal.ok) return;
    const snapshot = JSON.stringify(input);
    const result = acceptRescheduleRequest(proposal.value, input, {
      at,
      sessionOpen: () => false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UNAVAILABLE_SESSION");
    expect(JSON.stringify(input)).toBe(snapshot);
    expect(proposal.value.status).toBe("requested");
  });

  it("fails with STALE_REQUEST when the booking has moved since creation", () => {
    const proposal = createRescheduleRequest(booking({ status: "confirmed", sessionId: "s3" }), {
      id: "r1",
      toSessionId: "s2",
      requestedBy: "attendee",
      at,
    });
    expect(proposal.ok).toBe(true);
    if (!proposal.ok) return;
    const other = booking({ status: "confirmed" });
    const result = acceptRescheduleRequest(proposal.value, other, {
      at,
      sessionOpen: () => true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("STALE_REQUEST");
  });

  it("rejects resolved requests and requests for a different booking", () => {
    const input = booking({ status: "confirmed" });
    const resolved = request({ status: "rejected", resolvedAt: at });
    const resolvedResult = acceptRescheduleRequest(resolved, input, {
      at,
      sessionOpen: () => true,
    });
    expect(resolvedResult.ok).toBe(false);
    if (!resolvedResult.ok) expect(resolvedResult.error.code).toBe("REQUEST_NOT_PENDING");

    const foreign = request({ bookingId: "b9" });
    const foreignResult = acceptRescheduleRequest(foreign, input, {
      at,
      sessionOpen: () => true,
    });
    expect(foreignResult.ok).toBe(false);
    if (!foreignResult.ok) expect(foreignResult.error.code).toBe("INVALID_TRANSITION");
  });
});

describe("reschedule request events", () => {
  it("creation emits RESCHEDULE_REQUESTED to the counterpart with the session change", () => {
    const events = domainEventsForRequest(request({ reason: "Work conflict" }));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "RESCHEDULE_REQUESTED",
      actor: "attendee",
      bookingId: "b1",
      sessionId: "s2",
      fromSessionId: "s1",
      toSessionId: "s2",
      requestId: "r1",
      recipients: { attendee: false, host: true },
      reason: "Work conflict",
    });
  });

  it("rejection emits RESCHEDULE_REJECTED to the requester with the rejector as actor", () => {
    const events = domainEventsForRequest(
      request({ status: "rejected", resolvedAt: at, reason: "No capacity" }),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "RESCHEDULE_REJECTED",
      actor: "host",
      bookingId: "b1",
      sessionId: "s2",
      fromSessionId: "s1",
      toSessionId: "s2",
      requestId: "r1",
      recipients: { attendee: true, host: false },
      reason: "No capacity",
    });
  });

  it("cancellation emits RESCHEDULE_CANCELLED to the counterpart", () => {
    const events = domainEventsForRequest(request({ status: "cancelled", resolvedAt: at }));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "RESCHEDULE_CANCELLED",
      actor: "attendee",
      bookingId: "b1",
      sessionId: "s2",
      fromSessionId: "s1",
      toSessionId: "s2",
      requestId: "r1",
      recipients: { attendee: false, host: true },
    });
  });

  it("acceptance emits a single BOOKING_RESCHEDULED to both parties with the session change", () => {
    const input = booking({ status: "confirmed" });
    const proposal = createRescheduleRequest(input, {
      id: "r1",
      toSessionId: "s2",
      requestedBy: "attendee",
      at,
      reason: "Work conflict",
    });
    expect(proposal.ok).toBe(true);
    if (!proposal.ok) return;
    const accepted = acceptRescheduleRequest(proposal.value, input, {
      at,
      sessionOpen: () => true,
    });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    const entry = accepted.value.history.at(-1);
    if (!entry) throw new Error("no transition entry");
    const events = domainEventsFor({
      booking: accepted.value,
      transition: entry,
      requestId: "r1",
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "BOOKING_RESCHEDULED",
      actor: "host",
      bookingId: "b1",
      sessionId: "s2",
      fromSessionId: "s1",
      toSessionId: "s2",
      requestId: "r1",
      recipients: { attendee: true, host: true },
      reason: "Work conflict",
    });
  });

  it("failed operations emit nothing", () => {
    const input = booking({ status: "confirmed" });
    const proposal = createRescheduleRequest(input, {
      id: "r1",
      toSessionId: "s2",
      requestedBy: "attendee",
      at,
    });
    expect(proposal.ok).toBe(true);
    if (!proposal.ok) return;
    const wrongActor = rejectRescheduleRequest(proposal.value, { by: "attendee", at });
    expect(wrongActor.ok).toBe(false);
    const stale = acceptRescheduleRequest(
      proposal.value,
      booking({ status: "confirmed", sessionId: "s3" }),
      { at, sessionOpen: () => true },
    );
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.error.code).toBe("STALE_REQUEST");
    expect(domainEventsForRequest(proposal.value)[0]?.type).toBe("RESCHEDULE_REQUESTED");
  });
});

describe("listAllowedTransitions", () => {
  it("exposes the guard table for UI/logic reuse", () => {
    expect(listAllowedTransitions(booking())).toEqual([
      { to: "confirmed", actors: ["host"] },
      { to: "rejected", actors: ["host"] },
      { to: "cancelled", actors: ["attendee"] },
    ]);
    expect(listAllowedTransitions(booking({ status: "cancelled" }))).toEqual([]);
  });
});

describe("domain events (event boundary)", () => {
  function eventsOf(result: ReturnType<typeof applyTransition>) {
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    const last = result.value.history.at(-1);
    if (!last) throw new Error("no transition entry");
    return domainEventsFor({ booking: result.value, transition: last });
  }

  it("creation emits BOOKING_REQUESTED to the host", () => {
    const created = createBooking("b1", "s1", "2026-08-20T09:00:00Z", "attendee");
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const entry = created.value.history[0];
    if (!entry) throw new Error("no creation entry");
    const events = domainEventsFor({ booking: created.value, transition: entry });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "BOOKING_REQUESTED",
      actor: "attendee",
      bookingId: "b1",
      sessionId: "s1",
      recipients: { attendee: false, host: true },
    });
  });

  it("confirmation notifies the attendee", () => {
    const events = eventsOf(applyTransition(booking(), "confirmed", { actor: "host", at }));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "BOOKING_CONFIRMED",
      actor: "host",
      recipients: { attendee: true, host: false },
    });
  });

  it("rejection notifies the attendee", () => {
    const events = eventsOf(
      applyTransition(booking(), "rejected", { actor: "host", at, reason: "No longer hosting" }),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "BOOKING_REJECTED",
      reason: "No longer hosting",
      recipients: { attendee: true, host: false },
    });
  });

  it("attendee withdrawal notifies the host", () => {
    const events = eventsOf(applyTransition(booking(), "cancelled", { actor: "attendee", at }));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "BOOKING_CANCELLED",
      actor: "attendee",
      recipients: { attendee: false, host: true },
    });
  });

  it("host cancellation of a confirmed booking notifies the attendee", () => {
    const events = eventsOf(
      applyTransition(booking({ status: "confirmed" }), "cancelled", { actor: "host", at }),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "BOOKING_CANCELLED",
      actor: "host",
      recipients: { attendee: true, host: false },
    });
  });

  it("completion (learner-confirmed) notifies the host", () => {
    const events = eventsOf(
      applyTransition(booking({ status: "confirmed" }), "completed", {
        actor: "attendee",
        at,
        now: FUTURE,
        sessionEndAt: "2026-08-20T10:00:00Z",
      }),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "BOOKING_COMPLETED",
      actor: "attendee",
      recipients: { attendee: false, host: true },
    });
  });

  it("failed or repeated transitions cannot produce events", () => {
    const already = booking({ status: "confirmed" });
    const repeat = applyTransition(already, "confirmed", { actor: "host", at });
    expect(repeat.ok).toBe(false);
    if (!repeat.ok) expect(repeat.error.code).toBe("INVALID_TRANSITION");

    const forbidden = applyTransition(booking(), "confirmed", { actor: "attendee", at });
    expect(forbidden.ok).toBe(false);
  });
});

describe("recordAttendance (attendance / no-show evidence)", () => {
  const CONFIRMED_END = "2026-08-20T10:00:00Z";

  it("the host reports learner_no_show after the session end; booking stays confirmed", () => {
    const result = recordAttendance(booking({ status: "confirmed" }), {
      outcome: "learner_no_show",
      reportedBy: "host",
      sessionEndAt: CONFIRMED_END,
      now: FUTURE,
      at,
      source: "host_app",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("confirmed");
    expect(result.value.attendance).toEqual([
      {
        outcome: "learner_no_show",
        reportedBy: "host",
        at,
        sessionId: "s1",
        priorStatus: "confirmed",
        source: "host_app",
      },
    ]);
  });

  it("the attendee reports host_no_show after the session end", () => {
    const result = recordAttendance(booking({ status: "confirmed" }), {
      outcome: "host_no_show",
      reportedBy: "attendee",
      sessionEndAt: CONFIRMED_END,
      now: FUTURE,
      at,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.attendance?.[0]).toMatchObject({
      outcome: "host_no_show",
      reportedBy: "attendee",
    });
  });

  it("no party can report their own no-show", () => {
    const attendeeOwn = recordAttendance(booking({ status: "confirmed" }), {
      outcome: "learner_no_show",
      reportedBy: "attendee",
      sessionEndAt: CONFIRMED_END,
      now: FUTURE,
    });
    expect(attendeeOwn.ok).toBe(false);
    if (!attendeeOwn.ok) expect(attendeeOwn.error.code).toBe("FORBIDDEN_ACTOR");

    const hostOwn = recordAttendance(booking({ status: "confirmed" }), {
      outcome: "host_no_show",
      reportedBy: "host",
      sessionEndAt: CONFIRMED_END,
      now: FUTURE,
    });
    expect(hostOwn.ok).toBe(false);
    if (!hostOwn.ok) expect(hostOwn.error.code).toBe("FORBIDDEN_ACTOR");
  });

  it("cannot record attendance on requested, cancelled, or rejected bookings", () => {
    for (const status of ["requested", "cancelled", "rejected"] as const) {
      const result = recordAttendance(booking({ status }), {
        outcome: "learner_no_show",
        reportedBy: "host",
        sessionEndAt: CONFIRMED_END,
        now: FUTURE,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("INVALID_TRANSITION");
    }
  });

  it("requires the session to have ended (sessionEndAt + now)", () => {
    const confirmed = booking({ status: "confirmed" });
    const beforeEnd = recordAttendance(confirmed, {
      outcome: "learner_no_show",
      reportedBy: "host",
      sessionEndAt: CONFIRMED_END,
      now: PAST,
    });
    expect(beforeEnd.ok).toBe(false);
    if (!beforeEnd.ok) expect(beforeEnd.error.code).toBe("SESSION_IN_FUTURE");

    const noEnd = recordAttendance(confirmed, {
      outcome: "learner_no_show",
      reportedBy: "host",
      sessionEndAt: CONFIRMED_END,
    });
    expect(noEnd.ok).toBe(false);
    if (!noEnd.ok) expect(noEnd.error.code).toBe("INVALID_TRANSITION");

    const noNow = recordAttendance(confirmed, {
      outcome: "learner_no_show",
      reportedBy: "host",
      sessionEndAt: CONFIRMED_END,
    });
    expect(noNow.ok).toBe(false);
  });

  it("rejects a duplicate report of the same outcome by the same reporter", () => {
    const first = recordAttendance(booking({ status: "confirmed" }), {
      outcome: "learner_no_show",
      reportedBy: "host",
      sessionEndAt: CONFIRMED_END,
      now: FUTURE,
      at,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = recordAttendance(first.value, {
      outcome: "learner_no_show",
      reportedBy: "host",
      sessionEndAt: CONFIRMED_END,
      now: FUTURE,
      at,
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe("DUPLICATE_ATTENDANCE");
    expect(first.value.attendance).toHaveLength(1);
  });

  it("conflicting claims coexist as immutable facts for future dispute resolution", () => {
    const completed = applyTransition(booking({ status: "confirmed" }), "completed", {
      actor: "attendee",
      at,
      now: FUTURE,
      sessionEndAt: CONFIRMED_END,
    });
    expect(completed.ok).toBe(true);
    if (!completed.ok) return;
    expect(completed.value.attendance?.[0]?.outcome).toBe("attended");

    const dispute = recordAttendance(completed.value, {
      outcome: "learner_no_show",
      reportedBy: "host",
      sessionEndAt: CONFIRMED_END,
      now: FUTURE,
      at,
    });
    expect(dispute.ok).toBe(true);
    if (!dispute.ok) return;
    expect(dispute.value.attendance).toHaveLength(2);
    expect(dispute.value.attendance?.map((fact) => fact.outcome)).toEqual([
      "attended",
      "learner_no_show",
    ]);
  });

  it("attendance alone does not unlock reviews; only a completed booking does", () => {
    const noShow = recordAttendance(booking({ status: "confirmed" }), {
      outcome: "learner_no_show",
      reportedBy: "host",
      sessionEndAt: CONFIRMED_END,
      now: FUTURE,
    });
    expect(noShow.ok).toBe(true);
    if (!noShow.ok) return;
    expect(reviewEligible(noShow.value)).toBe(false);

    for (const status of ["requested", "confirmed", "cancelled", "rejected"] as const) {
      expect(reviewEligible(booking({ status }))).toBe(false);
    }
  });
});

describe("attendanceEventFor (ATTENDANCE_REPORTED)", () => {
  it("emits ATTENDANCE_REPORTED to the counterpart with outcome and prior status", () => {
    const input = booking({ status: "confirmed" });
    const result = recordAttendance(input, {
      outcome: "learner_no_show",
      reportedBy: "host",
      sessionEndAt: "2026-08-20T10:00:00Z",
      now: FUTURE,
      at,
      source: "host_app",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const fact = result.value.attendance?.at(-1) as AttendanceFact;
    const event = attendanceEventFor(result.value, fact);
    expect(event).toMatchObject({
      type: "ATTENDANCE_REPORTED",
      actor: "host",
      bookingId: "b1",
      sessionId: "s1",
      recipients: { attendee: true, host: false },
      outcome: "learner_no_show",
      priorStatus: "confirmed",
      source: "host_app",
    });
    expect(event.at).toBe(at);
  });

  it("an attendee-reported host_no_show notifies the host", () => {
    const input = booking({ status: "confirmed" });
    const result = recordAttendance(input, {
      outcome: "host_no_show",
      reportedBy: "attendee",
      sessionEndAt: "2026-08-20T10:00:00Z",
      now: FUTURE,
      at,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const fact = result.value.attendance?.at(-1) as AttendanceFact;
    expect(attendanceEventFor(result.value, fact).recipients).toEqual({
      attendee: false,
      host: true,
    });
  });
});

describe("reviewEligible", () => {
  it("is true only for a learner-completed booking", () => {
    const done = applyTransition(booking({ status: "confirmed" }), "completed", {
      actor: "attendee",
      at,
      now: FUTURE,
      sessionEndAt: "2026-08-20T10:00:00Z",
    });
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(reviewEligible(done.value)).toBe(true);
  });
});

describe("reschedule acceptance refreshes sessionDate", () => {
  it("updates sessionDate when the accepted session's start time is provided", () => {
    const input = booking({ status: "confirmed" });
    const proposal = createRescheduleRequest(input, {
      id: "r1",
      toSessionId: "s2",
      requestedBy: "attendee",
      at,
    });
    expect(proposal.ok).toBe(true);
    if (!proposal.ok) return;
    const result = acceptRescheduleRequest(proposal.value, input, {
      at,
      sessionOpen: () => true,
      sessionDate: "2026-09-05T09:00:00Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.sessionId).toBe("s2");
    expect(result.value.sessionDate).toBe("2026-09-05T09:00:00Z");
  });

  it("keeps the original sessionDate when no new schedule is provided", () => {
    const input = booking({ status: "confirmed" });
    const proposal = createRescheduleRequest(input, {
      id: "r1",
      toSessionId: "s2",
      requestedBy: "attendee",
      at,
    });
    expect(proposal.ok).toBe(true);
    if (!proposal.ok) return;
    const result = acceptRescheduleRequest(proposal.value, input, {
      at,
      sessionOpen: () => true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.sessionDate).toBe("2026-08-20T09:00:00Z");
  });
});
