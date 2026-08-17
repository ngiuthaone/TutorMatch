/**
 * Session aggregate (pure domain) — Tutoria Session lifecycle.
 *
 * A Session is ONE concrete scheduled occurrence of an offering (workshop,
 * event, class, or tutor appointment): Offering -> Session -> Bookings.
 * It is not the offering listing, and it is not a Booking.
 * Classification: concrete scheduled occurrences are supported by
 * EXISTING_TUTORIA_POLICY/product evidence (approved bookings spec,
 * PRD event requirements, prototypes). Representing them as a first-class
 * Session aggregate (Offering -> Session -> Booking) is a TUTORIA-NATIVE
 * REVERSIBLE_DESIGN_CHOICE, not pre-existing explicit backend policy.
 *
 * Authority (verified this test):
 * - `docs/tutoria-prd.md:626,628` — events have date/time, location or
 *   online format, capacity, price, and registration state; creation
 *   validates date/time and capacity. EXISTING_TUTORIA_POLICY (roadmap).
 * - `docs/items-5-6-content-marketplace-plan.md:134-137,60` — approved
 *   bookings spec anchors a booking to `session_at`/`duration_min` with
 *   unique (tutor_id, learner_id, session_at); content items carry
 *   `capacity`. There is NO approved session table: sessions are a domain
 *   concept the approved spec embeds in bookings (1:1 pattern) or item
 *   capacity (events). EXISTING_TUTORIA_POLICY.
 * - `discover/public/pizza-workshop.html:6394-6402,4565,5448,5606` —
 *   prototype schedules sessions as blocks {id, start, end, label,
 *   minParticipants, maxParticipants, bookedParticipants, capacity,
 *   locationId, days}; "10/15 booked · Minimum 8 participants to run";
 *   capacity/minimum edited per session. PROTOTYPE_EVIDENCE only — shapes
 *   the aggregate, never becomes policy by itself.
 * - `discover/src/components/events/event-detail-page.tsx:42-53,139-159`
 *   and `event-creator.tsx` — prototype event model of dates x time
 *   intervals, per-event spotsLeft, multi-guest bookings. PROTOTYPE_EVIDENCE.
 * - `QA contract EXAMPLE-booking-cancel-reschedule:24,37` — accepted
 *   architecture: one participant's cancellation never cancels the whole
 *   session (reverse direction). Accepted domain work.
 *
 * Decisions (classified):
 * - Identity: Model A — rescheduling mutates the Session IN PLACE; the id
 *   never changes. Consistent with stable Booking identity (payment/history
 *   anchors) and with booking.sessionId staying valid. Bookings attached to
 *   a host-rescheduled session KEEP their sessionId; there is no
 *   replacement session and no per-booking RescheduleRequest (that entity
 *   is for a learner moving to a DIFFERENT offering occurrence).
 * - Status: `scheduled | cancelled | completed`. No `rescheduled` status
 *   (a moved session is still scheduled; the move is history + event). No
 *   `minimum_met`/`waiting_for_minimum`/`payment_pending`/`sold_out`
 *   states — those are derived conditions, not states. REVERSIBLE_DESIGN_CHOICE.
 * - Host reschedule semantics (must participants approve?) is
 *   PRODUCT_DECISION_REQUIRED; this module models the host-move as an
 *   immediate fact (acknowledgment is notification/read state, never
 *   approval — a future approval workflow would be a proposal entity
 *   analogous to RescheduleRequest, not a Session state).
 * - Session cancellation is a first-class fact (SESSION_CANCELLED). Booking
 *   consequences are fan-out (see cancelSessionWithBookings): every
 *   requested/confirmed booking cancels with the host actor plus
 *   `cancelledBySessionId`, never as N independent cancellations and never
 *   touching payment identity. Capacity policy is FROZEN FOR PERSISTENCE
 *   (see docs/agent-team/DECISIONS-CAPACITY-CONCURRENCY.md): requested and
 *   confirmed bookings HARD-RESERVE capacity (EXISTING_TUTORIA_POLICY);
 *   cancelled/rejected release terminally; completed/no-show are historical
 *   and never recreate capacity.
 * - minParticipants semantics: `minimumMet` counts CONFIRMED participant
 *   quantity only, never paid (decided — EXISTING_TUTORIA_POLICY; minimums
 *   must not couple to Payment). Automatic minimum-not-met cancellation is
 *   DEFERRED — the system-actor path is future-compatible scaffolding, NOT
 *   established authority (no evaluation timing, no scheduler, no refunds),
 *   and nothing here implies Tutoria cancels sessions automatically.
 * - Capacity: the invariant "committed capacity never exceeds
 *   maxParticipants" is a DOMAIN_INVARIANT, enforced here on capacity
 *   change against a caller-provided occupancy count. Reducing capacity
 *   below hard-reserved occupancy is BLOCKED (decided — no grandfathering,
 *   no admin override yet; EXISTING_TUTORIA_POLICY).
 * - Completion: `completeSession` and the `completed` session status are a
 *   session-level fact (REVERSIBLE_DESIGN_CHOICE): the host marks the
 *   session completed once it ran. Attendance/no-show of individual
 *   bookings is handled separately via `recordAttendance` in
 *   booking-lifecycle.ts (evidence-based, immutable facts), and booking
 *   completion is learner-facing there. Session completion must NOT
 *   auto-complete or auto-cancel bookings — booking state changes only
 *   through `applyTransition`/`recordAttendance`. Whether session
 *   completion itself should be learner-confirmed remains unsettled;
 *   future agents must not cite this function as booking-level authority.
 * - Schedule authority: Session.startsAt/endsAt is the authoritative
 *   schedule for a booking's timing. Booking.sessionDate
 *   (booking-lifecycle.ts) is a LEGACY / DERIVED / COMPATIBILITY SNAPSHOT,
 *   not an independent source of scheduling truth (REVERSIBLE_DESIGN_CHOICE
 *   / compatibility behavior). Once Session persistence is introduced,
 *   Session must be the source of scheduled start/end timing and
 *   Booking.sessionDate must NOT independently override it — avoid two
 *   conflicting authoritative clocks (e.g. Session.startsAt = Aug 20 while
 *   Booking.sessionDate = Aug 19). No persistence redesign here.
 * - Identity/authorization remain server-derived: the module takes an
 *   actor; persistence must prove it matches session.hostId (system actor
 *   exists for minimum-not-met cancellation only).
 *
 * Bounds: no persistence, no refunds, no notification delivery, no queues,
 * no cron, no admin/support role (no evidence), no BookingRole extension.
 */

import type { Booking, BookingDomainEvent } from "./booking-lifecycle.js";
import { applyTransition, domainEventsFor } from "./booking-lifecycle.js";

export type SessionStatus = "scheduled" | "cancelled" | "completed";
export type SessionActor = "host" | "system";
export type SessionCancellationCause = "host" | "minimum_not_met";
export type SessionEventType = "SESSION_RESCHEDULED" | "SESSION_CANCELLED";

export interface SessionSchedule {
  startsAt: string;
  endsAt: string;
}

export type SessionChangeEntry =
  | { type: "created"; at: string; by: SessionActor }
  | {
      type: "rescheduled";
      at: string;
      by: SessionActor;
      from: SessionSchedule;
      to: SessionSchedule;
      reason?: string;
    }
  | {
      type: "cancelled";
      at: string;
      by: SessionActor;
      cause: SessionCancellationCause;
      reason?: string;
    }
  | { type: "completed"; at: string; by: SessionActor }
  | {
      type: "capacity_changed";
      at: string;
      by: SessionActor;
      from?: number;
      to: number;
    };

export interface Session {
  id: string;
  offeringId: string;
  hostId: string;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
  /** Group formats may require a minimum to run; 1:1 appointments leave this unset. */
  minParticipants?: number;
  /** Maximum participant seats; 1:1 appointments use maxParticipants = 1 (decided — same general capacity architecture). */
  maxParticipants?: number;
  history: SessionChangeEntry[];
}

export interface SessionDomainEvent {
  type: SessionEventType;
  at: string;
  sessionId: string;
  offeringId: string;
  actor: SessionActor;
  oldStart?: string;
  oldEnd?: string;
  newStart?: string;
  newEnd?: string;
  cause?: SessionCancellationCause;
  reason?: string;
}

export type SessionErrorCode =
  | "INVALID_TRANSITION"
  | "FORBIDDEN_ACTOR"
  | "NO_CHANGE"
  | "CAPACITY_EXCEEDED"
  | "SESSION_IN_FUTURE";

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: SessionErrorCode; message: string } };

const ALL_STATUSES: readonly SessionStatus[] = ["scheduled", "cancelled", "completed"];
const ALL_ACTORS: readonly SessionActor[] = ["host", "system"];

function isStatus(value: string): value is SessionStatus {
  return (ALL_STATUSES as readonly string[]).includes(value);
}

function isActor(value: string): value is SessionActor {
  return (ALL_ACTORS as readonly string[]).includes(value);
}

function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

function fail(code: SessionErrorCode, message: string): Result<never> {
  return { ok: false, error: { code, message } };
}

function parseTime(raw: string): number | null {
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

export interface CreateSessionInput {
  id: string;
  offeringId: string;
  hostId: string;
  startsAt: string;
  endsAt: string;
  minParticipants?: number;
  maxParticipants?: number;
  at?: string;
}

/** Create a scheduled session occurrence. Creation emits no dedicated event: no established downstream domain consumer or invariant currently requires one, and creation is already represented by session state/history. */
export function createSession(input: CreateSessionInput): Result<Session> {
  const { id, offeringId, hostId, startsAt, endsAt } = input;
  if (!id || !offeringId || !hostId || !startsAt || !endsAt) {
    return fail("INVALID_TRANSITION", "id, offeringId, hostId, startsAt and endsAt are required");
  }
  const start = parseTime(startsAt);
  const end = parseTime(endsAt);
  if (start === null || end === null) {
    return fail("INVALID_TRANSITION", "startsAt and endsAt must be ISO date strings");
  }
  if (end <= start) {
    return fail("INVALID_TRANSITION", "endsAt must be after startsAt");
  }
  const min = input.minParticipants;
  const max = input.maxParticipants;
  if (min !== undefined && min < 0) {
    return fail("INVALID_TRANSITION", "minParticipants cannot be negative");
  }
  if (max !== undefined && max <= 0) {
    return fail("INVALID_TRANSITION", "maxParticipants must be positive");
  }
  if (min !== undefined && max !== undefined && min > max) {
    return fail("INVALID_TRANSITION", "minParticipants cannot exceed maxParticipants");
  }
  return ok({
    id,
    offeringId,
    hostId,
    startsAt,
    endsAt,
    status: "scheduled",
    ...(min !== undefined ? { minParticipants: min } : {}),
    ...(max !== undefined ? { maxParticipants: max } : {}),
    history: [{ type: "created", at: input.at ?? new Date().toISOString(), by: "host" }],
  });
}

/**
 * Move a session's schedule IN PLACE (Model A): id unchanged, history
 * records old/new. Bookings keep their sessionId — this is not a booking
 * reschedule and never creates per-booking RescheduleRequests. Reserved to
 * the host (the learner cannot move a shared session). A pending participant
 * approval/acknowledgment workflow is PRODUCT_DECISION_REQUIRED and would be
 * a proposal entity, never a Session state.
 */
export function rescheduleSession(
  session: Session,
  options: { startsAt: string; endsAt: string; by: SessionActor; at?: string; reason?: string },
): Result<{ session: Session; event: SessionDomainEvent }> {
  const { startsAt, endsAt, by, at = new Date().toISOString(), reason } = options;
  if (by !== "host") {
    return fail("FORBIDDEN_ACTOR", "Only the host can reschedule a session");
  }
  if (session.status !== "scheduled") {
    return fail("INVALID_TRANSITION", `Cannot reschedule a ${session.status} session`);
  }
  const start = parseTime(startsAt);
  const end = parseTime(endsAt);
  if (start === null || end === null) {
    return fail("INVALID_TRANSITION", "startsAt and endsAt must be ISO date strings");
  }
  if (end <= start) {
    return fail("INVALID_TRANSITION", "endsAt must be after startsAt");
  }
  if (startsAt === session.startsAt && endsAt === session.endsAt) {
    return fail("NO_CHANGE", "The schedule is unchanged");
  }
  const from: SessionSchedule = { startsAt: session.startsAt, endsAt: session.endsAt };
  const to: SessionSchedule = { startsAt, endsAt };
  return ok({
    session: {
      ...session,
      startsAt,
      endsAt,
      history: [
        ...session.history,
        {
          type: "rescheduled",
          at,
          by,
          from,
          to,
          ...(reason !== undefined ? { reason } : {}),
        },
      ],
    },
    event: {
      type: "SESSION_RESCHEDULED",
      at,
      sessionId: session.id,
      offeringId: session.offeringId,
      actor: by,
      oldStart: from.startsAt,
      oldEnd: from.endsAt,
      newStart: to.startsAt,
      newEnd: to.endsAt,
      ...(reason !== undefined ? { reason } : {}),
    },
  });
}

/**
 * Cancel a scheduled session. The first-class fact is SESSION_CANCELLED,
 * emitted once; bookings are consequential (see cancelSessionWithBookings).
 * Acting rules: host may cancel for any cause; the system actor exists ONLY
 * for minimum-not-met cancellation. That system-actor path is
 * future-compatible scaffolding, not established authority: what counts
 * toward the minimum, when it is evaluated, and what happens when unmet
 * remain PRODUCT_DECISION_REQUIRED, and lifting this to an automatic
 * cancellation requires a product decision plus an evaluation mechanism
 * (no scheduler here). Cancelled sessions are terminal: they cannot
 * be rescheduled, completed, or given capacity, and cannot silently
 * resurrect.
 */
export function cancelSession(
  session: Session,
  options: { by: SessionActor; at?: string; cause: SessionCancellationCause; reason?: string },
): Result<{ session: Session; event: SessionDomainEvent }> {
  const { by, at = new Date().toISOString(), cause, reason } = options;
  if (!isActor(by)) {
    return fail("INVALID_TRANSITION", "Unknown session actor");
  }
  if (by === "system" && cause !== "minimum_not_met") {
    return fail(
      "FORBIDDEN_ACTOR",
      "The system actor may only cancel sessions for minimum-not-met",
    );
  }
  if (session.status !== "scheduled") {
    return fail("INVALID_TRANSITION", `Cannot cancel a ${session.status} session`);
  }
  return ok({
    session: {
      ...session,
      status: "cancelled",
      history: [
        ...session.history,
        { type: "cancelled", at, by, cause, ...(reason !== undefined ? { reason } : {}) },
      ],
    },
    event: {
      type: "SESSION_CANCELLED",
      at,
      sessionId: session.id,
      offeringId: session.offeringId,
      actor: by,
      cause,
      ...(reason !== undefined ? { reason } : {}),
    },
  });
}

/**
 * Session-level completion fact: the host marks a session completed once
 * its end time has passed. This does NOT complete, cancel, or otherwise
 * touch the attached bookings — booking completion is learner-facing in
 * booking-lifecycle.ts. Reversible design choice, not settled authority for
 * who confirms a session ran.
 */
export function completeSession(
  session: Session,
  options: { by: SessionActor; at?: string },
): Result<Session> {
  const { by, at = new Date().toISOString() } = options;
  if (by !== "host") {
    return fail("FORBIDDEN_ACTOR", "Only the host can complete a session");
  }
  if (session.status !== "scheduled") {
    return fail("INVALID_TRANSITION", `Cannot complete a ${session.status} session`);
  }
  if (parseTime(at) === null || (parseTime(at) as number) < (parseTime(session.endsAt) as number)) {
    return fail("SESSION_IN_FUTURE", "The session has not ended yet");
  }
  return ok({
    ...session,
    status: "completed",
    history: [...session.history, { type: "completed", at, by }],
  });
}

/**
 * Change maximum capacity in place. The invariant "occupancy never exceeds
 * capacity" is enforced against a caller-provided occupancy count (which
 * booking states count toward occupancy is the existing unsettled policy).
 * Reducing below current occupancy is rejected conservatively: grandfathering
 * is PRODUCT_DECISION_REQUIRED. No event: availability is derived from state.
 */
export function changeCapacity(
  session: Session,
  options: { max: number; currentOccupancy: number; by: SessionActor; at?: string },
): Result<Session> {
  const { max, currentOccupancy, by, at = new Date().toISOString() } = options;
  if (by !== "host") {
    return fail("FORBIDDEN_ACTOR", "Only the host can change capacity");
  }
  if (session.status !== "scheduled") {
    return fail("INVALID_TRANSITION", `Cannot change capacity of a ${session.status} session`);
  }
  if (max <= 0) {
    return fail("INVALID_TRANSITION", "maxParticipants must be positive");
  }
  if (max < currentOccupancy) {
    return fail(
      "CAPACITY_EXCEEDED",
      "Reducing capacity below current occupancy is not allowed; grandfathering policy is a product decision",
    );
  }
  if (max === session.maxParticipants) {
    return fail("NO_CHANGE", "Capacity is unchanged");
  }
  return ok({
    ...session,
    maxParticipants: max,
    history: [
      ...session.history,
      {
        type: "capacity_changed",
        at,
        by,
        ...(session.maxParticipants !== undefined ? { from: session.maxParticipants } : {}),
        to: max,
      },
    ],
  });
}

/** A session accepts new bookings and confirmations only while scheduled. */
export function isActive(session: Session): boolean {
  return session.status === "scheduled";
}

/** Derived minimum condition — never a Session status (PRODUCT_DECISION_REQUIRED: who counts, when evaluated). */
export function minimumMet(session: Session, qualifyingParticipants: number): boolean {
  return session.minParticipants === undefined || qualifyingParticipants >= session.minParticipants;
}

/** Capacity invariant predicate: valid occupancy never exceeds the maximum. */
export function occupancyWithin(session: Session, occupancy: number): boolean {
  return session.maxParticipants === undefined || occupancy <= session.maxParticipants;
}

/**
 * Session cancellation fan-out (Strategy B): the session event is the
 * authoritative first fact, then each affected booking transitions with the
 * host actor plus `cancelledBySessionId` so consumers can distinguish
 * session-derived cancellation from independent host cancellation. Terminal
 * bookings (cancelled/rejected/completed) attached to the session are left
 * untouched. Pure and all-or-nothing: if any booking cannot transition, the
 * whole operation fails and nothing is returned as changed — production
 * enforcement (single transaction or outbox) is a later concern.
 */
export function cancelSessionWithBookings(
  session: Session,
  bookings: Booking[],
  options: { by: SessionActor; at?: string; cause: SessionCancellationCause; reason?: string },
): Result<{
  session: Session;
  bookings: Booking[];
  sessionEvent: SessionDomainEvent;
  bookingEvents: BookingDomainEvent[];
}> {
  const sessionResult = cancelSession(session, options);
  if (!sessionResult.ok) return sessionResult;
  const at = options.at ?? new Date().toISOString();
  const nextBookings: Booking[] = [];
  const bookingEvents: BookingDomainEvent[] = [];
  for (const booking of bookings) {
    if (booking.status !== "requested" && booking.status !== "confirmed") {
      nextBookings.push(booking);
      continue;
    }
    const transition = applyTransition(booking, "cancelled", {
      actor: "host",
      at,
      ...(options.reason !== undefined ? { reason: options.reason } : {}),
      cancelledBySessionId: session.id,
    });
    if (!transition.ok) {
      return fail(
        "INVALID_TRANSITION",
        `Booking ${booking.id} cannot be cancelled by session cancellation: ${transition.error.message}`,
      );
    }
    const last = transition.value.history.at(-1);
    if (!last) {
      return fail("INVALID_TRANSITION", `Booking ${booking.id} has no history entry`);
    }
    nextBookings.push(transition.value);
    bookingEvents.push(...domainEventsFor({ booking: transition.value, transition: last }));
  }
  return ok({
    session: sessionResult.value.session,
    bookings: nextBookings,
    sessionEvent: sessionResult.value.event,
    bookingEvents,
  });
}
