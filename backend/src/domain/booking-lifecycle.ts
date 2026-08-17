/**
 * Tutoria booking lifecycle — Tutoria-native domain model.
 *
 * Booking-level status flow: requested → confirmed (host) or rejected
 * (host), attendee withdrawal from requested, host/attendee cancellation
 * of confirmed, and completion by the learner (attendee). The learner-
 * facing completion lifecycle is EXISTING_TUTORIA_POLICY (approved spec
 * docs/items-5-6-content-marketplace-plan.md:160-161 — requested →
 * confirmed (tutor) → completed (learner) → review). Terminal statuses
 * accept no further transitions. The host/tutor must NOT unilaterally mark
 * a normal booking completed; no system auto-completion exists.
 *
 * The EXACT completion timing boundary — completion requires
 * now >= the associated session's scheduled END time and fails with
 * SESSION_IN_FUTURE below it — is a REVERSIBLE_DESIGN_CHOICE / current
 * domain safety rule, NOT settled product policy. No stronger Tutoria
 * authority requires exactly this boundary; a future explicit timing
 * policy could allow e.g. learner confirmation shortly before the
 * scheduled end (session finishes early) or a different boundary. This
 * module invents no grace period and no auto-completion.
 *
 * Rescheduling is proposal-based (Model C): a `RescheduleRequest` proposes
 * a session swap and only an ACCEPTED request changes the booking — and
 * acceptance mutates the booking IN PLACE, keeping the booking id stable.
 * That stability is required for single-payment-per-booking reconciliation
 * (docs/items-5-6-content-marketplace-plan.md: payments.booking_id is a
 * unique reference per booking); the session is swapped and
 * `rescheduledFromSession` records the move. A rejected or cancelled
 * request leaves the booking untouched. The request entity is the audit
 * record of the proposed change. At most one pending request per booking
 * is enforced by the caller/persistence layer: this module is stateless
 * (no persistence) and cannot track existing requests itself. Capacity is
 * not held while a request is pending; it is re-checked at acceptance.
 *
 * Initial booking request (Model A): a Booking exists from the moment the
 * learner submits the request — createBooking creates the booking in
 * `requested` (EXISTING_TUTORIA_POLICY per the approved spec
 * docs/items-5-6-content-marketplace-plan.md, which defines bookings with
 * a `requested` status and a unique (tutor_id, learner_id, session_at)
 * key), and booking identity never changes afterwards (payments, reviews,
 * and capacity attach to this id).
 * The tutor resolves the request to `confirmed` (accept) or a terminal
 * decline representation. The current implementation expresses decline as
 * `rejected` (prototype-derived; "declined" is UI copy), but the approved
 * spec does not establish the decline representation, so the exact form
 * (`rejected` vs `cancelled` with reason vs another terminal) remains
 * PRODUCT_DECISION_REQUIRED — `rejected` is an implementation assumption,
 * not settled policy. The learner may withdraw an unresolved request
 * (`requested -> cancelled` in the current implementation, recorded with
 * cancelledBy and the from-status in history). The system must preserve
 * the semantic distinction between a tutor declining an unconfirmed
 * request and cancelling a confirmed booking; the current implementation
 * expresses decline as `rejected` and cancellation as `cancelled`.
 * Requests are never hard-deleted.
 *
 * Deliberately NOT in BookingStatus: expiry (no Tutoria policy exists —
 * PRODUCT_DECISION_REQUIRED; a future system-actor transition or EXPIRED
 * status can be added without redesign), `no_show` and other attendance
 * outcomes, payment states, and capacity states.
 *
 * SPEC ALIGNMENT REQUIRED (PRODUCT-DOMAIN ALIGNMENT ISSUE): the approved
 * Tutoria spec currently includes `no_show` among booking statuses
 * (requested|confirmed|completed|cancelled|no_show —
 * docs/items-5-6-content-marketplace-plan.md:135), but the Tutoria-native
 * domain design represents no-show as actor-attributed AttendanceFact
 * evidence (`learner_no_show` | `host_no_show` via `recordAttendance`)
 * instead of a generic BookingStatus.no_show. The spec has NOT been
 * updated to match: do NOT cite this module as proof that the spec enum
 * was retired. Conversely, this module does NOT add `BookingStatus.no_show`
 * merely to match the old enum. Whether `no_show` should eventually be
 * removed from the spec, become a final adjudicated booking state, or
 * remain evidence-only is an open future alignment/product decision — it
 * is NOT resolved here. Instant-confirm
 * (prototype evidence only) converges onto the same confirmed Booking via a
 * future creation path. Capacity policy is FROZEN FOR PERSISTENCE (see
 * docs/agent-team/DECISIONS-CAPACITY-CONCURRENCY.md): `requested` and
 * `confirmed` bookings HARD-RESERVE Session capacity
 * (EXISTING_TUTORIA_POLICY); the capacity unit is participant quantity
 * (Booking.participantCount, persisted later as participant_count INT NOT
 * NULL DEFAULT 1 CHECK (participant_count >= 1)); cancelled/rejected
 * release the reservation terminally; completed/no-show are historical
 * facts that never recreate capacity. Because requested hard-reserves,
 * persistence must serialize BOOKING CREATION against the authoritative
 * Session capacity boundary (request-time acquisition) — the decision is
 * schema-neutral but NOT transaction-neutral. Payment never acquires or
 * releases capacity; capacity changes only through Booking lifecycle
 * transitions. Request expiration is a future product requirement (stale
 * requested bookings can block capacity indefinitely). The committed <=
 * max invariant must be enforced transactionally in persistence; only
 * stable booking identity is established executable behavior here.
 *
 * Cancellation is a direct transition (Model A): `requested -> cancelled`
 * is learner withdrawal of an unconfirmed request, and `confirmed ->
 * cancelled` is the cancellation of an agreed booking by either party.
 * Cancellation is immediate — no CancellationRequest or mutual-approval
 * flow exists (acknowledgment of tutor-initiated cancellation remains
 * PRODUCT_DECISION_REQUIRED; immediate cancellation with counterpart
 * notification is the current implementation). The single terminal
 * `cancelled` status carries all termination semantics; history
 * (from-status, actor, at, reason, cancelledBy) preserves the distinction
 * between withdrawal, learner cancellation, and host cancellation, and
 * each BOOKING_CANCELLED event carries fromStatus for the same reason.
 * Decline (`rejected`) is never cancellation.
 *
 * Cancellation is allowed regardless of how close the session is (no
 * cutoff exists — refund timing is a separate policy). History records
 * confirmedAt-equivalents (the confirm transition's at), sessionDate, and
 * cancelledAt for future refund calculation. Payment identity is never
 * touched by cancellation: a cancelled booking keeps its id, and future
 * refunds reference the same booking/payment relationship. No refund or
 * fee logic belongs in this module. Session-level cancellation (a host or
 * system cancelling a whole workshop session — see session-lifecycle.ts) is
 * a session-aggregate fact, never N independent cancelBooking commands: its
 * fan-out reaches this module through `cancelledBySessionId`, so a
 * session-derived cancellation (host actor + cancelled session id) is
 * distinguishable from an independent host cancellation (host actor, no
 * session id) even though both end in `cancelled`. A host may cancel a
 * pending `requested` booking ONLY as part of a session-derived
 * cancellation; independently, decline (`rejected`) is the mechanism and
 * `requested -> cancelled` stays attendee-only.
 * Cancelling a booking leaves any pending RescheduleRequest on it stale:
 * acceptance is rejected by the booking-status guard, so an accepted
 * reschedule can never resurrect a cancelled booking; callers may
 * cascade-cancel stale requests but the module does not.
 *
 * This module is pure and dependency-free. It performs no I/O, no
 * authorization against real users, and no persistence: callers own
 * storage, identity, and payment boundaries. It must never be bypassed
 * by client-supplied booking status.
 *
 * Event boundary: a successful operation derives domain events (see
 * `domainEventsFor` for booking transitions and `domainEventsForRequest`
 * for reschedule-request lifecycle events). Domain transition, domain
 * event, user notification, and delivery channel are deliberately separate
 * concepts — this module produces only the semantic fact after the
 * operation passes every guard; it never sends notifications and never
 * depends on delivery succeeding. Session-level changes (host cancels or
 * reschedules a whole workshop session, affecting many bookings) originate
 * in the session aggregate (session-lifecycle.ts) and land per booking here
 * with `cancelledBySessionId`; host session rescheduling never creates
 * per-booking RescheduleRequests.
 */

export type BookingRole = "attendee" | "host";

export type BookingStatus =
  | "requested"
  | "confirmed"
  | "cancelled"
  | "rejected"
  | "completed";

/**
 * Post-session attendance/outcome semantics — separate from BookingStatus.
 * Always names WHO allegedly failed to attend; unqualified `no_show` is
 * never used. `attended` is recorded automatically when the learner
 * completes the booking (approved policy: learner confirms completion),
 * and may also be reported standalone via `recordAttendance`.
 */
export type AttendanceOutcome = "attended" | "learner_no_show" | "host_no_show";

/**
 * Immutable, actor-attributed attendance ASSERTION/evidence — NOT final
 * adjudicated attendance truth. Each fact records WHO reported what
 * (outcome, reportedBy, at, sessionId, priorStatus); reporter identity
 * always matters. Conflicting reports may coexist (host reports
 * learner_no_show while the learner confirms attended), and facts are
 * appended, never overwritten or reconciled here. Adjudication/dispute
 * resolution is OUT OF SCOPE for this module — nothing here decides which
 * report is true. Future payment/refund/payout/dispute consumers must NOT
 * treat any single raw AttendanceFact as automatically authoritative
 * unless future Tutoria policy explicitly grants that authority.
 * Booking identity stays stable; no replacement bookings.
 */
export interface AttendanceFact {
  outcome: AttendanceOutcome;
  reportedBy: BookingRole;
  at: string;
  sessionId: string;
  /** Booking status when the fact was recorded (prior booking state). */
  priorStatus: BookingStatus;
  /** Optional provenance label supplied by the caller (e.g. "host_app"). */
  source?: string;
}

export interface BookingTransition {
  from: BookingStatus;
  to: BookingStatus;
  actor: BookingRole;
  at: string;
  reason?: string;
  /** Present only on the history entry appended by an accepted reschedule; from/to are the same status on that entry and the session change is carried here. */
  sessionChange?: { from: string; to: string };
  /** Set on session-derived cancellations (the cancelled session id). Distinguishes cancellation caused by a whole-Session cancellation from an independent cancellation, which carries no session id. */
  cancelledBySessionId?: string;
}

export interface Booking {
  id: string;
  sessionId: string;
  /**
   * LEGACY / DERIVED / COMPATIBILITY SNAPSHOT, not an independent source of
   * scheduling truth. The authoritative schedule is the Session referenced
   * by `sessionId` (Session.startsAt/endsAt — see session-lifecycle.ts).
   * Kept only for convenience in this pure-domain module; once Session
   * persistence exists, Session must be the authoritative source of
   * scheduled start/end timing and `sessionDate` must NOT independently
   * override Session timing (avoid two conflicting authoritative clocks,
   * e.g. Session.startsAt = Aug 20 while Booking.sessionDate = Aug 19).
   */
  sessionDate: string;
  status: BookingStatus;
  /** Session this booking moved away from; set on acceptance of a reschedule request (in-place swap, id stable). */
  rescheduledFromSession?: string;
  cancelledReason?: string;
  cancelledBy?: BookingRole;
  /** Session-derived cancellation source; see BookingTransition.cancelledBySessionId. */
  cancelledBySessionId?: string;
  /** Immutable attendance/outcome evidence, appended chronologically. */
  attendance?: AttendanceFact[];
  history: BookingTransition[];
}

export type TransitionErrorCode =
  | "INVALID_TRANSITION"
  | "FORBIDDEN_ACTOR"
  | "SAME_SESSION"
  | "UNAVAILABLE_SESSION"
  | "SESSION_IN_FUTURE"
  | "REQUEST_NOT_PENDING"
  | "STALE_REQUEST"
  | "DUPLICATE_ATTENDANCE";

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: TransitionErrorCode; message: string } };

const ALL_STATUSES: readonly BookingStatus[] = [
  "requested",
  "confirmed",
  "cancelled",
  "rejected",
  "completed",
];

const ALL_ROLES: readonly BookingRole[] = ["attendee", "host"];

/**
 * Guard table. A transition is valid only when the target status exists
 * in the map for the current status AND the actor is allowed for it.
 */
const TRANSITIONS: Record<BookingStatus, Partial<Record<BookingStatus, readonly BookingRole[]>>> = {
  requested: {
    confirmed: ["host"],
    rejected: ["host"],
    cancelled: ["attendee"],
  },
  confirmed: {
    cancelled: ["host", "attendee"],
    completed: ["attendee"],
  },
  cancelled: {},
  rejected: {},
  completed: {},
};

function isStatus(value: string): value is BookingStatus {
  return (ALL_STATUSES as readonly string[]).includes(value);
}

function isRole(value: string): value is BookingRole {
  return (ALL_ROLES as readonly string[]).includes(value);
}

function counterpartRole(actor: BookingRole): BookingRole {
  return actor === "attendee" ? "host" : "attendee";
}

function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

function fail(code: TransitionErrorCode, message: string): Result<never> {
  return { ok: false, error: { code, message } };
}

function appendHistory(booking: Booking, entry: BookingTransition): Booking {
  return { ...booking, history: [...booking.history, entry] };
}

/** A booking hard-reserves one capacity unit (participant quantity) while requested or confirmed; terminal states release it. */
export function holdsSeat(status: BookingStatus): boolean {
  return status === "requested" || status === "confirmed";
}

/** Seat-accounting effect of moving from one status to another. */
export function capacityImpact(
  from: BookingStatus,
  to: BookingStatus,
): { seatHeld: boolean; seatReleased: boolean } {
  const wasHeld = holdsSeat(from);
  const isHeld = holdsSeat(to);
  return { seatHeld: isHeld, seatReleased: wasHeld && !isHeld };
}

export function canTransition(
  from: BookingStatus,
  to: BookingStatus,
  actor: BookingRole,
): boolean {
  return (TRANSITIONS[from]?.[to] ?? []).includes(actor);
}

export function createBooking(
  id: string,
  sessionId: string,
  sessionDate: string,
  actor: BookingRole,
): Result<Booking> {
  if (!id || !sessionId || !sessionDate) {
    return fail("INVALID_TRANSITION", "id, sessionId and sessionDate are required");
  }
  return ok({
    id,
    sessionId,
    sessionDate,
    status: "requested",
    history: [
      { from: "requested", to: "requested", actor, at: new Date().toISOString() },
    ],
  });
}

export interface TransitionOptions {
  actor: BookingRole;
  at?: string;
  reason?: string;
  /** Required for confirming completion: the current time, used with sessionEndAt. */
  now?: Date;
  /** Required for confirming completion: the associated session's scheduled END time, resolved from the booking's CURRENT sessionId (including after accepted reschedules). Completion is only valid after this time. */
  sessionEndAt?: string;
  /** Present only for session-derived cancellations: the cancelled session this booking belongs to. A host may cancel a pending request only with this set. */
  cancelledBySessionId?: string;
}

export function applyTransition(
  booking: Booking,
  to: BookingStatus,
  options: TransitionOptions,
): Result<Booking> {
  const { actor, at = new Date().toISOString(), reason, now, sessionEndAt, cancelledBySessionId } = options;
  if (!isStatus(booking.status) || !isRole(actor)) {
    return fail("INVALID_TRANSITION", "Unknown booking status or actor");
  }
  if (to === booking.status) {
    return fail("INVALID_TRANSITION", `Booking is already ${booking.status}`);
  }
  // A host cancelling a pending request is a session-derived cancellation
  // only: independently it would be a decline (rejected), which stays the
  // separate mechanism (requested -> cancelled remains attendee-only).
  const sessionSourcedHostCancellation =
    booking.status === "requested" && to === "cancelled" && actor === "host";
  if (sessionSourcedHostCancellation && !cancelledBySessionId) {
    return fail(
      "FORBIDDEN_ACTOR",
      "Host cannot cancel a pending request independently; decline is the mechanism, or provide cancelledBySessionId for a session-derived cancellation",
    );
  }
  if (!canTransition(booking.status, to, actor) && !sessionSourcedHostCancellation) {
    if (TRANSITIONS[booking.status]?.[to] === undefined) {
      return fail(
        "INVALID_TRANSITION",
        `No transition from ${booking.status} to ${to}`,
      );
    }
    return fail(
      "FORBIDDEN_ACTOR",
      `${actor} is not allowed to ${booking.status} -> ${to}`,
    );
  }
  if (to === "completed") {
    if (!now) return fail("INVALID_TRANSITION", "now is required to complete a booking");
    if (!sessionEndAt) {
      return fail(
        "INVALID_TRANSITION",
        "sessionEndAt is required to complete a booking; resolve it from the booking's current sessionId",
      );
    }
    const end = Date.parse(sessionEndAt);
    if (Number.isNaN(end)) return fail("INVALID_TRANSITION", "sessionEndAt must be a valid ISO date");
    if (now.getTime() < end) {
      return fail("SESSION_IN_FUTURE", "Session has not ended yet");
    }
  }

  const entry: BookingTransition = {
    from: booking.status,
    to,
    actor,
    at,
    ...(reason !== undefined ? { reason } : {}),
    ...(cancelledBySessionId !== undefined ? { cancelledBySessionId } : {}),
  };
  let next: Booking = { ...appendHistory(booking, entry), status: to };

  if (to === "completed") {
    // Approved policy: the learner confirms completion, which also records
    // their `attended` attendance evidence. Conflicting claims survive as
    // separate immutable facts (see recordAttendance).
    const attendedFact: AttendanceFact = {
      outcome: "attended",
      reportedBy: "attendee",
      at,
      sessionId: booking.sessionId,
      priorStatus: booking.status,
    };
    next = {
      ...next,
      attendance: [...(booking.attendance ?? []), attendedFact],
    };
  }

  if (to === "cancelled") {
    next = {
      ...next,
      cancelledBy: actor,
      ...(reason !== undefined ? { cancelledReason: reason } : {}),
      ...(cancelledBySessionId !== undefined ? { cancelledBySessionId } : {}),
    };
  }

  return ok(next);
}

// ---------------------------------------------------------------------------
// Attendance / outcome evidence
//
// Attendance and no-show are NOT booking statuses (approved spec enum
// includes no_show — see SPEC ALIGNMENT REQUIRED note in the header — but
// this Tutoria-native design expresses no-show via attendance outcomes,
// keeping BookingStatus coarse). Evidence is appended as immutable
// AttendanceFact records; facts never overwrite one another, so a host
// reporting `learner_no_show` while the learner already recorded
// `attended` (via completion or standalone report) yields two coexisting
// facts. These facts are ASSERTIONS, not adjudicated truth: nothing here
// decides which report is true, and payment/refund/payout/dispute
// consumers must not treat a raw fact as automatically authoritative
// without explicit future policy.
//
// Reporter attribution: the host reports `learner_no_show`, the learner
// reports `host_no_show`. A party can never report their OWN no-show
// (FORBIDDEN_ACTOR). Attendance may only be recorded after the session's
// scheduled END time, on a booking that is not requested/cancelled/rejected.
// ---------------------------------------------------------------------------

export interface RecordAttendanceOptions {
  outcome: AttendanceOutcome;
  reportedBy: BookingRole;
  /** Resolved from the booking's CURRENT sessionId (including accepted reschedules); required. */
  sessionEndAt: string;
  /** The current wall-clock time; required. */
  now?: Date;
  at?: string;
  /** Optional provenance label (e.g. "host_app", "checkin_kiosk"). */
  source?: string;
}

export function recordAttendance(
  booking: Booking,
  options: RecordAttendanceOptions,
): Result<Booking> {
  const { outcome, reportedBy, sessionEndAt, source } = options;
  const at = options.at ?? new Date().toISOString();
  if (booking.status === "requested" || booking.status === "cancelled" || booking.status === "rejected") {
    return fail(
      "INVALID_TRANSITION",
      `Attendance cannot be recorded on a ${booking.status} booking`,
    );
  }
  if (outcome === "learner_no_show" && reportedBy === "attendee") {
    return fail("FORBIDDEN_ACTOR", "The attendee cannot report their own no-show");
  }
  if (outcome === "host_no_show" && reportedBy === "host") {
    return fail("FORBIDDEN_ACTOR", "The host cannot report their own no-show");
  }
  const existing = (booking.attendance ?? []).some(
    (fact) => fact.outcome === outcome && fact.reportedBy === reportedBy,
  );
  if (existing) {
    return fail("DUPLICATE_ATTENDANCE", `Attendance outcome ${outcome} already reported by ${reportedBy}`);
  }
  if (!options.now) return fail("INVALID_TRANSITION", "now is required to record attendance");
  const end = Date.parse(sessionEndAt);
  if (Number.isNaN(end)) return fail("INVALID_TRANSITION", "sessionEndAt must be a valid ISO date");
  if (options.now.getTime() < end) {
    return fail("SESSION_IN_FUTURE", "Session has not ended yet");
  }

  const fact: AttendanceFact = {
    outcome,
    reportedBy,
    at,
    sessionId: booking.sessionId,
    priorStatus: booking.status,
    ...(source !== undefined ? { source } : {}),
  };
  return ok({
    ...booking,
    attendance: [...(booking.attendance ?? []), fact],
  });
}

/**
 * Derive the ATTENDANCE_REPORTED domain event for a fact recorded via
 * `recordAttendance`. The counterpart is notified (never the reporter only);
 * completion's auto-attended fact is NOT re-emitted here — the learner's
 * BOOKING_COMPLETED event carries that. Callers derive events only from
 * guard-passing results, so failed calls never produce events.
 */
export function attendanceEventFor(booking: Booking, fact: AttendanceFact): BookingDomainEvent {
  return {
    type: "ATTENDANCE_REPORTED",
    at: fact.at,
    actor: fact.reportedBy,
    bookingId: booking.id,
    sessionId: fact.sessionId,
    recipients: counterpartRecipients(fact.reportedBy),
    outcome: fact.outcome,
    priorStatus: fact.priorStatus,
    ...(fact.source !== undefined ? { source: fact.source } : {}),
  };
}

/**
 * Reviews are gated on a learner-confirmed COMPLETED booking only
 * (EXISTING_TUTORIA_POLICY: "reviews only possible for completed
 * bookings" — docs/items-5-6-content-marketplace-plan.md:164-165;
 * docs/tutoria-prd.md:659-666). Attendance facts alone never unlock
 * reviews.
 *
 * PRODUCT_DECISION_REQUIRED (unresolved): when a learner attends but the
 * host does not appear — learner reports host_no_show, booking is NOT
 * completed — what may that learner do: leave a normal review? leave a
 * special no-show/reliability review? report an incident only? leave no
 * public review? The current completed-only eligibility does NOT settle
 * this question, and no review behavior for that case is implemented.
 */
export function reviewEligible(booking: Booking): boolean {
  return booking.status === "completed";
}

// ---------------------------------------------------------------------------
// Reschedule requests (Model C)
//
// Proposal-based rescheduling: a request proposes a session swap; only
// acceptance mutates the booking, and it mutates IN PLACE (id stable,
// session swapped, rescheduledFromSession set). Rejecting or cancelling
// never touches the booking. The module is stateless, so one-pending-
// request-per-booking is enforced by the caller/persistence layer, and the
// open target-session capacity is re-checked at acceptance (no capacity
// hold while pending).
// ---------------------------------------------------------------------------

export type RescheduleRequestStatus = "requested" | "accepted" | "rejected" | "cancelled";

export interface RescheduleRequest {
  id: string;
  bookingId: string;
  fromSessionId: string;
  toSessionId: string;
  requestedBy: BookingRole;
  status: RescheduleRequestStatus;
  createdAt: string;
  resolvedAt?: string;
  reason?: string;
}

export interface CreateRescheduleRequestOptions {
  id: string;
  toSessionId: string;
  requestedBy: BookingRole;
  at?: string;
  reason?: string;
}

/**
 * Propose a reschedule. Requires a requested or confirmed booking (terminal
 * bookings cannot propose) and a target session different from the current
 * one. No capacity check and no capacity hold while pending: the target
 * session is validated at acceptance. The booking itself is never touched.
 * Uniqueness of the pending request (one per booking) belongs to the
 * caller/persistence layer because this module is stateless.
 */
export function createRescheduleRequest(
  booking: Booking,
  options: CreateRescheduleRequestOptions,
): Result<RescheduleRequest> {
  const { id, toSessionId, requestedBy, at, reason } = options;
  if (booking.status !== "requested" && booking.status !== "confirmed") {
    return fail(
      "INVALID_TRANSITION",
      `Bookings in ${booking.status} status cannot propose a reschedule`,
    );
  }
  if (toSessionId === booking.sessionId) {
    return fail("SAME_SESSION", "Target session must differ from the current session");
  }
  return ok({
    id,
    bookingId: booking.id,
    fromSessionId: booking.sessionId,
    toSessionId,
    requestedBy,
    status: "requested",
    createdAt: at ?? new Date().toISOString(),
    ...(reason !== undefined ? { reason } : {}),
  });
}

export interface AcceptRescheduleRequestOptions {
  at?: string;
  reason?: string;
  /** Availability/capacity provider: returns false when the target session cannot take another booking. */
  sessionOpen: (sessionId: string) => boolean;
  /** The target session's scheduled start time. When provided, the booking's `sessionDate` follows the CURRENT session, so post-session timing (completion/attendance) uses the accepted reschedule, never a stale original time. This refresh is COMPATIBILITY BEHAVIOR only (Booking.sessionDate is a derived/legacy snapshot) — it is not evidence that Booking should permanently own the schedule. */
  sessionDate?: string;
}

/**
 * Accept a pending request: mutates the booking in place (session swapped,
 * `rescheduledFromSession` set, history entry appended with the same
 * status on both sides and the session change recorded). When a
 * `sessionDate` is provided the booking's `sessionDate` snapshot is
 * refreshed to the new session's schedule so timing guards reference the
 * current session (compatibility behavior — Session remains the
 * authoritative schedule). Idempotent from
 * the caller's perspective: after acceptance the caller/persistence layer
 * flips the request to `accepted` with `resolvedAt`, so a second accept
 * fails with REQUEST_NOT_PENDING. The request object itself is never
 * mutated here.
 */
export function acceptRescheduleRequest(
  request: RescheduleRequest,
  booking: Booking,
  options: AcceptRescheduleRequestOptions,
): Result<Booking> {
  const { at = new Date().toISOString(), sessionOpen, sessionDate } = options;
  const reason = options.reason ?? request.reason;
  if (request.status !== "requested") {
    return fail(
      "REQUEST_NOT_PENDING",
      `Request in ${request.status} status cannot be accepted`,
    );
  }
  if (request.bookingId !== booking.id) {
    return fail("INVALID_TRANSITION", "Request does not belong to this booking");
  }
  if (booking.status !== "requested" && booking.status !== "confirmed") {
    return fail(
      "INVALID_TRANSITION",
      `Bookings in ${booking.status} status cannot be rescheduled`,
    );
  }
  if (booking.sessionId !== request.fromSessionId) {
    return fail("STALE_REQUEST", "Booking has moved since the request was created");
  }
  if (!sessionOpen(request.toSessionId)) {
    return fail("UNAVAILABLE_SESSION", "The target session cannot take another booking");
  }

  return ok({
    ...appendHistory(booking, {
      from: booking.status,
      to: booking.status,
      actor: counterpartRole(request.requestedBy),
      at,
      ...(reason !== undefined ? { reason } : {}),
      sessionChange: { from: request.fromSessionId, to: request.toSessionId },
    }),
    sessionId: request.toSessionId,
    rescheduledFromSession: request.fromSessionId,
    ...(sessionDate !== undefined ? { sessionDate } : {}),
  });
}

export interface ResolveRescheduleRequestOptions {
  by: BookingRole;
  at?: string;
  reason?: string;
}

/**
 * Reject a pending request. Only the counterpart of the requester may
 * reject (the requester withdraws via `cancelRescheduleRequest`). The
 * booking is never touched.
 */
export function rejectRescheduleRequest(
  request: RescheduleRequest,
  options: ResolveRescheduleRequestOptions,
): Result<RescheduleRequest> {
  const { by, at = new Date().toISOString(), reason } = options;
  if (request.status !== "requested") {
    return fail(
      "REQUEST_NOT_PENDING",
      `Request in ${request.status} status cannot be rejected`,
    );
  }
  if (by !== counterpartRole(request.requestedBy)) {
    return fail("FORBIDDEN_ACTOR", "The requester cannot reject their own proposal");
  }
  return ok({
    ...request,
    status: "rejected",
    resolvedAt: at,
    ...(reason !== undefined ? { reason } : {}),
  });
}

export interface CancelRescheduleRequestOptions {
  by: BookingRole;
  at?: string;
}

/**
 * Withdraw a pending request. Only the requester may cancel (the
 * counterpart rejects instead). The booking is never touched.
 */
export function cancelRescheduleRequest(
  request: RescheduleRequest,
  options: CancelRescheduleRequestOptions,
): Result<RescheduleRequest> {
  const { by, at = new Date().toISOString() } = options;
  if (request.status !== "requested") {
    return fail(
      "REQUEST_NOT_PENDING",
      `Request in ${request.status} status cannot be cancelled`,
    );
  }
  if (by !== request.requestedBy) {
    return fail("FORBIDDEN_ACTOR", "Only the requester can withdraw their proposal");
  }
  return ok({ ...request, status: "cancelled", resolvedAt: at });
}

export function listAllowedTransitions(booking: Booking): { to: BookingStatus; actors: BookingRole[] }[] {
  const from = TRANSITIONS[booking.status];
  return (Object.keys(from) as BookingStatus[]).map((to) => ({
    to,
    actors: [...(from[to] ?? [])],
  }));
}

// ---------------------------------------------------------------------------
// Domain events
//
// A successful, guard-passing operation MAY be turned into a semantic domain
// event (`domainEventsFor` for booking transitions, `domainEventsForRequest`
// for reschedule-request lifecycle events). Events are derived facts — a
// notification is a later, separate concern owned by callers (see module
// header). Recipients are derived from the role model server-side and never
// accepted from clients. Failed or forbidden operations produce no events,
// and a repeated transition is rejected by `applyTransition`, so idempotent
// callers cannot double-emit.
// ---------------------------------------------------------------------------

export type BookingEventType =
  | "BOOKING_REQUESTED"
  | "BOOKING_CONFIRMED"
  | "BOOKING_REJECTED"
  | "BOOKING_CANCELLED"
  | "BOOKING_COMPLETED"
  | "BOOKING_RESCHEDULED"
  | "ATTENDANCE_REPORTED"
  | "RESCHEDULE_REQUESTED"
  | "RESCHEDULE_REJECTED"
  | "RESCHEDULE_CANCELLED";

export interface BookingDomainEvent {
  type: BookingEventType;
  /** When the transition happened (caller may backdate delivery). */
  at: string;
  /** The actor whose action caused the event. */
  actor: BookingRole;
  /** The booking the event refers to. */
  bookingId: string;
  /** Session the recipients must look at (the target session for reschedule events). */
  sessionId: string;
  /** Server-derived recipients. The actor is never the only recipient: the
      counterpart must learn the fact. Callers map this to channels. */
  recipients: { attendee: boolean; host: boolean };
  /** Status the booking had before this event's transition (for example: distinguishes requested-withdrawal from confirmed-cancellation when the actor is the attendee in both cases). */
  fromStatus?: BookingStatus;
  /** Present only on BOOKING_CANCELLED when the cancellation is session-derived (a whole Session was cancelled); the individual host cancellation carries no session id. */
  cancelledBySessionId?: string;
  reason?: string;
  /** The reschedule request that produced the event. */
  requestId?: string;
  /** The session the request proposes to leave / the booking left. */
  fromSessionId?: string;
  /** The session the request targets / the booking moved to. */
  toSessionId?: string;
  /** Present on ATTENDANCE_REPORTED: the outcome that was recorded. */
  outcome?: AttendanceOutcome;
  /** Present on ATTENDANCE_REPORTED: booking status when the fact was recorded. */
  priorStatus?: BookingStatus;
  /** Present on ATTENDANCE_REPORTED: provenance label supplied by the caller. */
  source?: string;
}

export interface DomainEventSource {
  /** The booking AFTER the operation. */
  booking: Booking;
  /** The triggering transition entry (creation entries are included). */
  transition: BookingTransition;
  /** Present when the transition was the acceptance of a reschedule request. */
  requestId?: string;
}

function counterpartRecipients(actor: BookingRole): { attendee: boolean; host: boolean } {
  return actor === "attendee"
    ? { attendee: false, host: true }
    : { attendee: true, host: false };
}

function baseEvent(
  type: BookingEventType,
  source: DomainEventSource,
  recipients: { attendee: boolean; host: boolean },
): BookingDomainEvent {
  const { booking, transition } = source;
  return {
    type,
    at: transition.at,
    actor: transition.actor,
    bookingId: booking.id,
    sessionId: booking.sessionId,
    recipients,
    fromStatus: transition.from,
    ...(transition.reason !== undefined ? { reason: transition.reason } : {}),
  };
}

/**
 * Derive the domain events produced by a successful operation. Returns an
 * empty array for entries that carry no meaning (e.g. nothing observable).
 *
 * Mapping (per transition):
 * - creation                     -> BOOKING_REQUESTED  (counterpart notified)
 * - requested -> confirmed       -> BOOKING_CONFIRMED  (counterpart notified)
 * - requested -> rejected        -> BOOKING_REJECTED   (counterpart notified)
 * - requested/confirmed -> cancelled -> BOOKING_CANCELLED (counterpart notified)
 * - confirmed -> completed       -> BOOKING_COMPLETED  (counterpart notified)
 * - accepted reschedule (an entry with `sessionChange`; from/to statuses
 *   are the same)                -> BOOKING_RESCHEDULED (single event, BOTH
 *   parties notified; the booking moved to the new session in place, ids
 *   unchanged; carries the session change and the request id if provided)
 */
export function domainEventsFor(source: DomainEventSource): BookingDomainEvent[] {
  const { booking, transition, requestId } = source;

  if (transition.sessionChange) {
    return [
      {
        type: "BOOKING_RESCHEDULED",
        at: transition.at,
        actor: transition.actor,
        bookingId: booking.id,
        sessionId: booking.sessionId,
        fromSessionId: transition.sessionChange.from,
        toSessionId: transition.sessionChange.to,
        recipients: { attendee: true, host: true },
        fromStatus: transition.from,
        ...(transition.reason !== undefined ? { reason: transition.reason } : {}),
        ...(requestId !== undefined ? { requestId } : {}),
      },
    ];
  }

  const recipients = counterpartRecipients(transition.actor);
  switch (transition.to) {
    case "requested":
      if (transition.from === "requested") {
        return [baseEvent("BOOKING_REQUESTED", source, recipients)];
      }
      return [];
    case "confirmed":
      return [baseEvent("BOOKING_CONFIRMED", source, recipients)];
    case "rejected":
      return [baseEvent("BOOKING_REJECTED", source, recipients)];
    case "cancelled": {
      const event = baseEvent("BOOKING_CANCELLED", source, recipients);
      return transition.cancelledBySessionId !== undefined
        ? [{ ...event, cancelledBySessionId: transition.cancelledBySessionId }]
        : [event];
    }
    case "completed":
      return [baseEvent("BOOKING_COMPLETED", source, recipients)];
    default:
      return [];
  }
}

/**
 * Derive the domain event for a reschedule-request lifecycle change. An
 * accepted request emits nothing here — acceptance is covered by the
 * single BOOKING_RESCHEDULED event from `domainEventsFor`. Callers derive
 * events only from guard-passing results, so failed or forbidden
 * operations never produce events.
 *
 * Mapping (per status):
 * - requested   -> RESCHEDULE_REQUESTED  (counterpart notified; actor is the requester)
 * - rejected    -> RESCHEDULE_REJECTED   (requester notified; actor is the rejector,
 *   the counterpart of the requester, unless overridden via `extra.actor`)
 * - cancelled   -> RESCHEDULE_CANCELLED  (counterpart notified; actor is the requester)
 * - accepted    -> []                    (BOOKING_RESCHEDULED covers acceptance)
 */
export function domainEventsForRequest(
  request: RescheduleRequest,
  extra?: { at?: string; actor?: BookingRole },
): BookingDomainEvent[] {
  const at = extra?.at ?? request.resolvedAt ?? request.createdAt;
  const shared = {
    bookingId: request.bookingId,
    sessionId: request.toSessionId,
    fromSessionId: request.fromSessionId,
    toSessionId: request.toSessionId,
    requestId: request.id,
    ...(request.reason !== undefined ? { reason: request.reason } : {}),
  };
  switch (request.status) {
    case "requested":
      return [
        {
          type: "RESCHEDULE_REQUESTED",
          at: extra?.at ?? request.createdAt,
          actor: request.requestedBy,
          recipients: counterpartRecipients(request.requestedBy),
          ...shared,
        },
      ];
    case "rejected":
      return [
        {
          type: "RESCHEDULE_REJECTED",
          at,
          actor: extra?.actor ?? counterpartRole(request.requestedBy),
          recipients:
            request.requestedBy === "attendee"
              ? { attendee: true, host: false }
              : { attendee: false, host: true },
          ...shared,
        },
      ];
    case "cancelled":
      return [
        {
          type: "RESCHEDULE_CANCELLED",
          at,
          actor: request.requestedBy,
          recipients: counterpartRecipients(request.requestedBy),
          ...shared,
        },
      ];
    case "accepted":
      return [];
  }
}
