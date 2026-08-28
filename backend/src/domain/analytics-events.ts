/**
 * Tutoria analytics event catalog — canonical funnel + operational events.
 *
 * Server-authoritative only: browser return must never emit payment_completed
 * or any financial truth event. All financial/domain truth events come from
 * the backend.
 *
 * Rules:
 * - Deduplicate by event_id / domain event ID (one event per aggregate mutation).
 * - Exclude direct PII from analytics (no raw email, phone, address, government ID,
 *   payment credentials, private messages).
 * - Include offering_type and schema_version.
 * - Staging/production separated by environment field.
 * - Internal/pseudonymous IDs only.
 *
 * Event naming: ANALYTICS_ prefix for analytics-specific events that don't
 * correspond to a domain event (listing_view, booking_started). Domain events
 * (PAYMENT_SUCCEEDED, BOOKING_COMPLETED) are ALSO analytics events when they
 * carry funnel meaning — the outbox event IS the analytics event.
 */

// ─── Canonical Funnel Events ─────────────────────────────────────────────────

export type AnalyticsFunnelEventType =
  | "ANALYTICS_LISTING_VIEW"
  | "ANALYTICS_BOOKING_STARTED"
  | "ANALYTICS_BOOKING_REQUESTED"
  | "ANALYTICS_HOST_ACCEPTED"
  | "ANALYTICS_PAYMENT_STARTED"
  | "ANALYTICS_PAYMENT_COMPLETED"
  | "ANALYTICS_SESSION_ATTENDED"
  | "ANALYTICS_BOOKING_COMPLETED"
  | "ANALYTICS_REVIEW_CREATED";

// ─── Operational Events ──────────────────────────────────────────────────────

export type AnalyticsOperationalEventType =
  | "ANALYTICS_BOOKING_DECLINED"
  | "ANALYTICS_BOOKING_CANCELLED"
  | "ANALYTICS_SESSION_CANCELLED"
  | "ANALYTICS_RESCHEDULE_REQUESTED"
  | "ANALYTICS_RESCHEDULE_ACCEPTED"
  | "ANALYTICS_PAYMENT_FAILED_TIMEOUT"
  | "ANALYTICS_PAYMENT_CALLBACK_DUPLICATE"
  | "ANALYTICS_PAYMENT_RETURN_MISMATCH"
  | "ANALYTICS_HOST_NO_SHOW"
  | "ANALYTICS_LEARNER_NO_SHOW"
  | "ANALYTICS_DISPUTE_OPENED"
  | "ANALYTICS_DISPUTE_RESOLVED"
  | "ANALYTICS_PAYOUT_BLOCKED"
  | "ANALYTICS_PAYOUT_SENT";

// ─── All Analytics Event Types ───────────────────────────────────────────────

export type AnalyticsEventType =
  | AnalyticsFunnelEventType
  | AnalyticsOperationalEventType;

// ─── Domain Event Types That Also Carry Analytics Meaning ────────────────────

/**
 * Domain events that serve double duty: they are both authoritative domain
 * facts (in the outbox) and analytics funnel events. The outbox event IS the
 * analytics event — no separate emission needed.
 */
export type DomainAnalyticsEventType =
  | "PAYMENT_SUCCEEDED"
  | "PAYMENT_FAILED"
  | "REFUND_ISSUED"
  | "BOOKING_REQUESTED"
  | "BOOKING_CONFIRMED"
  | "BOOKING_REJECTED"
  | "BOOKING_CANCELLED"
  | "BOOKING_COMPLETED"
  | "BOOKING_RESCHEDULED"
  | "ATTENDANCE_REPORTED"
  | "SESSION_CANCELLED"
  | "PAYOUT_SENT"
  | "PAYOUT_BLOCKED"
  | "DISPUTE_OPENED"
  | "DISPUTE_RESOLVED"
  | "HOST_CANCELLATION_RECORDED"
  | "HOST_NO_SHOW_RECORDED";

// ─── Offering Type Vocabulary ────────────────────────────────────────────────

/**
 * The business launch readiness pack specifies these offering types.
 * The marketplace_listings.kind uses 'course' | 'event' (0003);
 * the mapping from listing.kind to offering_type is handled by the
 * RPC/integration layer.
 */
export type OfferingType = "tutor" | "workshop" | "class" | "event";

// ─── Schema Version ──────────────────────────────────────────────────────────

export const ANALYTICS_SCHEMA_VERSION = 1;

// ─── Prohibited PII Keys ────────────────────────────────────────────────────

/**
 * Keys that must NEVER appear in analytics event payloads. This list is
 * enforced by tests and by the analytics event validation layer.
 */
export const PROHIBITED_PII_KEYS: readonly string[] = [
  "email",
  "phone",
  "address",
  "governmentId",
  "paymentCredential",
  "cardNumber",
  "cvv",
  "ssn",
  "passportNumber",
  "nationalId",
  "rawMessage",
  "privateMessage",
  "password",
  "secretKey",
  "accessToken",
  "refreshToken",
  "supabaseKey",
] as const;

// ─── Event Payload Interfaces ────────────────────────────────────────────────

export interface BaseAnalyticsEvent {
  eventType: AnalyticsEventType;
  schemaVersion: number;
  aggregateType?: string;
  aggregateId?: string;
  offeringType?: OfferingType;
  environment: "staging" | "production";
  /** Pseudonymous user ID — never raw email/phone. */
  pseudoUserId?: string;
}

export interface ListingViewEvent extends BaseAnalyticsEvent {
  eventType: "ANALYTICS_LISTING_VIEW";
  aggregateType: "listing";
  aggregateId: string;
  offeringType: OfferingType;
}

export interface BookingFunnelEvent extends BaseAnalyticsEvent {
  eventType:
    | "ANALYTICS_BOOKING_STARTED"
    | "ANALYTICS_BOOKING_REQUESTED"
    | "ANALYTICS_HOST_ACCEPTED"
    | "ANALYTICS_PAYMENT_STARTED"
    | "ANALYTICS_PAYMENT_COMPLETED"
    | "ANALYTICS_SESSION_ATTENDED"
    | "ANALYTICS_BOOKING_COMPLETED"
    | "ANALYTICS_REVIEW_CREATED";
  aggregateType: "booking";
  aggregateId: string;
  offeringType: OfferingType;
  /** Pseudonymous participant IDs — never real user IDs in analytics. */
  participantHash?: string;
}

export interface OperationalEvent extends BaseAnalyticsEvent {
  eventType: AnalyticsOperationalEventType;
  aggregateType?: "booking" | "session" | "payment" | "payout" | "dispute";
  aggregateId?: string;
}

export type AnalyticsEvent =
  | ListingViewEvent
  | BookingFunnelEvent
  | OperationalEvent;

// ─── Per-Event Allowed Property Sets ─────────────────────────────────────────

/**
 * Strict allowlist of payload properties per analytics event type.
 * Any property not in the allowed set is rejected. This replaces the
 * weak PII-prohibition approach with a positive allowlist that cannot
 * be bypassed via alternate property names.
 *
 * The base properties (eventType, schemaVersion, aggregateType, aggregateId,
 * offeringType, environment, pseudoUserId) are always allowed and are NOT
 * repeated in each set.
 */
export const EVENT_ALLOWED_PROPERTIES: Readonly<Record<string, readonly string[]>> = {
  ANALYTICS_LISTING_VIEW: ["listingId", "listingKind"],
  ANALYTICS_BOOKING_STARTED: ["sessionId", "offeringType"],
  ANALYTICS_BOOKING_REQUESTED: ["bookingId", "sessionId", "participantCount", "priceVnd", "offeringType", "bookingMode"],
  ANALYTICS_HOST_ACCEPTED: ["bookingId", "sessionId", "fromStatus"],
  ANALYTICS_PAYMENT_STARTED: ["bookingId", "sessionId", "amountVnd"],
  ANALYTICS_PAYMENT_COMPLETED: ["bookingId", "sessionId", "amountVnd", "providerRef"],
  ANALYTICS_SESSION_ATTENDED: ["bookingId", "sessionId", "participantCount"],
  ANALYTICS_BOOKING_COMPLETED: ["bookingId", "sessionId", "fromStatus"],
  ANALYTICS_REVIEW_CREATED: ["bookingId", "sessionId", "rating"],
  ANALYTICS_BOOKING_DECLINED: ["bookingId", "sessionId", "fromStatus"],
  ANALYTICS_BOOKING_CANCELLED: ["bookingId", "sessionId", "cancelledBy", "fromStatus"],
  ANALYTICS_SESSION_CANCELLED: ["sessionId"],
  ANALYTICS_RESCHEDULE_REQUESTED: ["bookingId", "fromSessionId", "toSessionId"],
  ANALYTICS_RESCHEDULE_ACCEPTED: ["bookingId", "fromSessionId", "toSessionId"],
  ANALYTICS_PAYMENT_FAILED_TIMEOUT: ["bookingId", "sessionId"],
  ANALYTICS_PAYMENT_CALLBACK_DUPLICATE: ["bookingId", "providerRef"],
  ANALYTICS_PAYMENT_RETURN_MISMATCH: ["bookingId", "providerRef"],
  ANALYTICS_HOST_NO_SHOW: ["bookingId", "sessionId"],
  ANALYTICS_LEARNER_NO_SHOW: ["bookingId", "sessionId"],
  ANALYTICS_DISPUTE_OPENED: ["bookingId", "disputeId"],
  ANALYTICS_DISPUTE_RESOLVED: ["bookingId", "disputeId", "resolution"],
  ANALYTICS_PAYOUT_BLOCKED: ["hostId", "periodStart", "periodEnd", "blockedReason"],
  ANALYTICS_PAYOUT_SENT: ["hostId", "periodStart", "periodEnd", "netPayoutVnd"],
} as const;

// Base properties always allowed on every event.
const BASE_ALLOWED_PROPERTIES = [
  "eventType", "schemaVersion", "aggregateType", "aggregateId",
  "offeringType", "environment", "pseudoUserId",
] as const;

/**
 * Check whether a payload contains only allowed properties for the given event type.
 * Returns the list of disallowed keys (empty = clean).
 */
export function findDisallowedProperties(
  eventType: string,
  payload: Record<string, unknown>,
): string[] {
  const allowedSet = new Set<string>([
    ...BASE_ALLOWED_PROPERTIES,
    ...(EVENT_ALLOWED_PROPERTIES[eventType] ?? []),
  ]);
  return Object.keys(payload).filter((key) => !allowedSet.has(key));
}

/**
 * Validate an analytics event payload before insertion.
 * Enforces both base field requirements AND per-event allowed property sets.
 * Returns Ok with the validated event or Err with violations.
 */
export function validateAnalyticsEvent(
  event: Partial<BaseAnalyticsEvent> & Record<string, unknown>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!event.eventType) errors.push("eventType is required");
  if (!event.environment) errors.push("environment is required");
  if (event.schemaVersion === undefined) errors.push("schemaVersion is required");
  if (event.schemaVersion !== ANALYTICS_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${ANALYTICS_SCHEMA_VERSION}, got ${event.schemaVersion}`);
  }
  // Enforce per-event allowed property set on the full payload.
  if (event.eventType && typeof event === "object") {
    const disallowed = findDisallowedProperties(event.eventType, event as Record<string, unknown>);
    if (disallowed.length > 0) {
      errors.push(`Disallowed properties: ${disallowed.join(", ")}`);
    }
  }
  return { valid: errors.length === 0, errors };
}
