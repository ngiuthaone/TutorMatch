/**
 * Tutoria payment lifecycle — Tutoria-native domain model (pure, dependency-free).
 *
 * DOMAIN-ONLY implementation boundary: executable pure-domain logic and tests
 * only. There is NO persistence, RLS, provider integration, webhook handling,
 * API surface, or ledger here (those are future P1 production work per
 * docs/tutoria-prd.md:206-216), so nothing in this module may be cited as
 * production payment infrastructure.
 *
 * EXISTING_TUTORIA_POLICY (approved spec docs/items-5-6-content-marketplace-plan.md):
 * - One Payment aggregate per Booking: `payments.booking_id references bookings
 *   unique` (:139-142), a Tutoria-native interpretation of the approved schema.
 *   IMPORTANT: one Payment aggregate per Booking does NOT mean one gateway
 *   request, one card attempt, one authorization, or one provider transaction.
 *   The aggregate is the stable financial obligation attached to the Booking;
 *   provider/payment ATTEMPTS are a separate concern that should be represented
 *   separately or preserved as immutable provider-transaction history when
 *   persistence/provider integration is introduced. The current `failed →
 *   pending` retry path is the SAME aggregate re-entering `pending` (audited in
 *   `history`); it must never be read as permission to erase the previous
 *   provider failure. Do not introduce a `PaymentAttempt` entity now unless a
 *   real need appears.
 *   Payment identity is 1:1 with booking identity, and booking identity never
 *   changes afterwards (booking-lifecycle.ts:25-26), so a reschedule NEVER
 *   creates a new Payment and refunds always reference the original
 *   booking/payment relationship.
 * - Payment statuses: `pending | succeeded | failed | refunded` (:141).
 * - Provider: `stripe | vnpay | wallet | manual`; `external_ref`, `paid_at`,
 *   `amount_vnd int`, `currency default 'VND'` (:141-142).
 * - Sequencing: "single entry point per booking; on success, booking moves to
 *   `confirmed`; user gets receipt + calendar entry; refunds only via support"
 *   (:162-163). This module exposes `canConfirmBooking` for that integration
 *   gate; the Booking aggregate itself (booking-lifecycle.ts) stays the single
 *   owner of BookingStatus and is never told about payment states.
 *
 * `Payment.status = refunded` means EXACTLY: the cumulative successfully
 * refunded amount has exhausted the amount that was successfully paid/captured
 * and is refundable (invariant `successfulRefundTotal <= refundablePaidAmount`,
 * enforced by the REFUND_EXCEEDS_REMAINING guard). It does NOT merely mean "a
 * refund was requested", "a Refund record exists", or "one partial refund
 * succeeded". A partial refund keeps the Payment in its financially
 * successful/paid state (`succeeded`) with immutable Refund records attached;
 * only a FULL refund (refunds sum == amountVnd) moves it to the terminal
 * `refunded`.
 *
 * Refund-initiation authority is CURRENT POLICY, not a permanent
 * DOMAIN_INVARIANT. The approved spec makes refund initiation support-controlled
 * (:163), so there is NO learner/host refund action here. Future policy may
 * legitimately let a TRUSTED SYSTEM initiate refunds (e.g. host-cancelled
 * Session, or minimum participants not met). The durable invariant is narrower:
 * untrusted clients must never be able to authoritatively mark a refund
 * successful or manufacture financial outcomes. Nothing here computes refund
 * amounts from cancellation/attendance policy — callers supply amounts after
 * applying (future) Tutoria policy. No automatic refunds are implemented.
 *
 * Free bookings have no Payment: `requiresPayment` returns false for a
 * null/non-positive price and `canConfirmBooking(null)` is true, so a free
 * booking confirms without any payment-provider mechanics. ABSENCE of a Payment
 * is therefore a legitimate state — NOT automatically "payment missing",
 * "payment failed", or "financial corruption". Future analytics/persistence
 * must distinguish a free Booking from a paid Booking whose Payment is
 * unexpectedly missing, using authoritative pricing/financial snapshot
 * information; never by creating zero-value Payment records for analytics.
 *
 * Deliberately NOT here (and NOT in PaymentStatus) — all PRODUCT_DECISION_REQUIRED
 * unless stronger Tutoria authority establishes them:
 * - Payouts / earnings / commission: the only fee/commission evidence is
 *   conflicting PROTOTYPE_EVIDENCE (tutor-onboarding tutorFee 10% + processingFee
 *   3% at tutor-onboarding.tsx:571-575 vs a flat 6% platform fee at
 *   event-creator.tsx:510-511), and docs/tutoria-prd.md:912 (commission model) is
 *   an OPEN product question. Also open: who pays commission, payout eligibility
 *   timing, the HostEarning model, payout batching, and dispute hold. Payout/fee
 *   math must be a future parameter, never hardcoded here.
 * - Refund policy: refund cutoff, refund percentages, host-cancellation refund,
 *   Session-cancellation refund, deposit support, and any learner/host no-show
 *   financial consequence. No Tutoria authority establishes any of these; the
 *   module invents none.
 * - Payment timing/authorization: payment timing relative to tutor acceptance
 *   (booking-lifecycle.ts:81-82), authorization vs capture, payment-failure →
 *   Booking semantics, minimum-participant payment timing, and contact-unlock
 *   timing (docs/tutoria-prd.md:913) are all PRODUCT_DECISION_REQUIRED; this
 *   module only guarantees that BookingStatus and PaymentStatus are separate
 *   vocabularies.
 * - Disputes/adjudication, chargebacks, and attendance-truth: a raw
 *   AttendanceFact is assertion, NOT adjudicated financial truth
 *   (booking-lifecycle.ts AttendanceFact JSDoc), so no attendance fact ever
 *   moves money here. Future code must not reason "host reports learner_no_show
 *   → automatically pay host" or "learner reports host_no_show → automatically
 *   refund learner" without an explicit financial/adjudication policy.
 * - Provider integrations, webhooks, idempotent replay handling against a real
 *   provider, and reconciliation (future P1 production constraints per
 *   docs/tutoria-prd.md:206-216). The module rejects duplicate transitions so
 *   replay-safe callers cannot double-move or double-emit a single Payment.
 *
 * This module is stateless: the one-payment-per-booking uniqueness is enforced
 * by the caller/persistence layer (the unique `booking_id` index per spec). A
 * Payment keeps an audit `history` of every status move (from/to/actor/at/reason)
 * so reconciliation has a chain. The aggregate deliberately carries no own `id`
 * field: identity is 1:1 with `bookingId` in this pure model, and the
 * persistence layer owns the actual row `id` (spec `payments.id uuid pk`).
 */
export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded";

export type PaymentProvider = "stripe" | "vnpay" | "wallet" | "manual";

export type PaymentCurrency = "VND";

/** Who acted on the payment: the attendee (payer) or Tutoria support. */
export type PaymentActor = "attendee" | "support";

export interface PaymentTransition {
  from: PaymentStatus | "created";
  to: PaymentStatus;
  actor: PaymentActor;
  at: string;
  reason?: string;
}

/** Immutable refund record. Refunds are support-only (spec:163). */
export interface PaymentRefund {
  id: string;
  amountVnd: number;
  reason: string;
  issuedBy: "support";
  at: string;
}

export interface Payment {
  bookingId: string;
  /** Gross amount the attendee pays, in VND (positive integer). */
  amountVnd: number;
  currency: PaymentCurrency;
  status: PaymentStatus;
  provider: PaymentProvider;
  /** Payment method text (spec: `method text`), e.g. "card" — optional. */
  method?: string;
  /** Provider-side reference, set on success. */
  externalRef?: string;
  /** When the payment was settled. */
  paidAt?: string;
  refunds: PaymentRefund[];
  history: PaymentTransition[];
  createdAt: string;
}

export type PaymentErrorCode =
  | "INVALID_PAYMENT_STATE"
  | "INVALID_AMOUNT"
  | "INVALID_PROVIDER"
  | "REFUND_EXCEEDS_REMAINING"
  | "REFUND_REASON_REQUIRED"
  | "IDEMPOTENT_REJECTED";

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: PaymentErrorCode; message: string } };

const ALL_STATUSES: readonly PaymentStatus[] = [
  "pending",
  "succeeded",
  "failed",
  "refunded",
];

const ALL_PROVIDERS: readonly PaymentProvider[] = [
  "stripe",
  "vnpay",
  "wallet",
  "manual",
];

function isStatus(value: unknown): value is PaymentStatus {
  return (ALL_STATUSES as readonly unknown[]).includes(value);
}

function isProvider(value: unknown): value is PaymentProvider {
  return (ALL_PROVIDERS as readonly unknown[]).includes(value);
}

function isPositiveVndAmount(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

function fail(code: PaymentErrorCode, message: string): Result<never> {
  return { ok: false, error: { code, message } };
}

/**
 * Whether a booking price requires a Payment at all. A null or non-positive
 * price is a free booking: no Payment aggregate is created and the booking
 * confirms without payment-provider mechanics.
 */
export function requiresPayment(priceVnd: number | null): priceVnd is number {
  return priceVnd !== null && isPositiveVndAmount(priceVnd);
}

export interface CreatePaymentOptions {
  bookingId: string;
  amountVnd: number;
  provider: PaymentProvider;
  method?: string;
  at?: string;
}

export function createPayment(options: CreatePaymentOptions): Result<Payment> {
  const { bookingId, amountVnd, provider, method } = options;
  const at = options.at ?? new Date().toISOString();
  if (!bookingId) {
    return fail("INVALID_PAYMENT_STATE", "bookingId is required");
  }
  if (!isPositiveVndAmount(amountVnd)) {
    return fail("INVALID_AMOUNT", "amountVnd must be a positive integer (VND)");
  }
  if (!isProvider(provider)) {
    return fail("INVALID_PROVIDER", `Unknown payment provider: ${String(provider)}`);
  }
  return ok({
    bookingId,
    amountVnd,
    currency: "VND",
    status: "pending",
    provider,
    ...(method !== undefined ? { method } : {}),
    refunds: [],
    history: [{ from: "created", to: "pending", actor: "attendee", at }],
    createdAt: at,
  });
}

export interface MarkPaymentSucceededOptions {
  externalRef?: string;
  at?: string;
}

export function markPaymentSucceeded(
  payment: Payment,
  options: MarkPaymentSucceededOptions = {},
): Result<Payment> {
  const at = options.at ?? new Date().toISOString();
  if (payment.status !== "pending") {
    return payment.status === "succeeded"
      ? fail("IDEMPOTENT_REJECTED", "Payment is already succeeded")
      : fail(
          "INVALID_PAYMENT_STATE",
          `Only a pending payment can succeed (current: ${payment.status})`,
        );
  }
  return ok({
    ...payment,
    status: "succeeded",
    paidAt: at,
    ...(options.externalRef !== undefined ? { externalRef: options.externalRef } : {}),
    history: [
      ...payment.history,
      { from: "pending", to: "succeeded", actor: "attendee", at },
    ],
  });
}

export interface MarkPaymentFailedOptions {
  reason?: string;
  at?: string;
}

export function markPaymentFailed(
  payment: Payment,
  options: MarkPaymentFailedOptions = {},
): Result<Payment> {
  const at = options.at ?? new Date().toISOString();
  if (payment.status !== "pending") {
    return payment.status === "failed"
      ? fail("IDEMPOTENT_REJECTED", "Payment is already failed")
      : fail(
          "INVALID_PAYMENT_STATE",
          `Only a pending payment can fail (current: ${payment.status})`,
        );
  }
  return ok({
    ...payment,
    status: "failed",
    history: [
      ...payment.history,
      {
        from: "pending",
        to: "failed",
        actor: "attendee",
        at,
        ...(options.reason !== undefined ? { reason: options.reason } : {}),
      },
    ],
  });
}

export interface RetryPaymentOptions {
  reason?: string;
  at?: string;
}

/**
 * A failed payment is retryable: the next attempt re-enters `pending`. One
 * Payment row per booking is preserved; every attempt is visible in history.
 */
export function retryPayment(
  payment: Payment,
  options: RetryPaymentOptions = {},
): Result<Payment> {
  const at = options.at ?? new Date().toISOString();
  if (payment.status !== "failed") {
    return fail(
      "INVALID_PAYMENT_STATE",
      `Only a failed payment can be retried (current: ${payment.status})`,
    );
  }
  return ok({
    ...payment,
    status: "pending",
    history: [
      ...payment.history,
      {
        from: "failed",
        to: "pending",
        actor: "attendee",
        at,
        ...(options.reason !== undefined ? { reason: options.reason } : {}),
      },
    ],
  });
}

/** Total refunded so far across all refund records. */
export function refundedAmount(payment: Payment): number {
  return payment.refunds.reduce((sum, refund) => sum + refund.amountVnd, 0);
}

/** Amount still refundable on a succeeded payment (gross minus refunded). */
export function refundableAmount(payment: Payment): number {
  return payment.amountVnd - refundedAmount(payment);
}

export interface IssueRefundOptions {
  id: string;
  amountVnd: number;
  reason: string;
  at?: string;
}

/**
 * Refund issuance. CURRENT policy is support-controlled ("refunds only via
 * support", spec:163), so there is no payer-side or host-side refund action and
 * `issuedBy` is fixed to "support". Future policy may let a TRUSTED SYSTEM
 * initiate refunds; the durable invariant is that untrusted clients can never
 * authoritatively mark a refund successful or manufacture financial outcomes.
 *
 * The refund is appended to the Payment. A partial refund keeps the Payment in
 * its financially successful/paid state (`succeeded`) with the Refund record
 * attached; only a FULL refund (refunds sum == amountVnd, i.e. the cumulative
 * successful refund total exhausted the refundable paid amount) moves it to the
 * terminal `refunded`. `refunded` never means merely "a refund was requested"
 * or "a Refund record exists". The `successfulRefundTotal <= refundablePaidAmount`
 * invariant is enforced by the REFUND_EXCEEDS_REMAINING guard. Nothing here
 * computes refund amounts from cancellation/attendance policy — callers supply
 * the amount after applying (future) Tutoria policy.
 */
export function issueRefund(
  payment: Payment,
  options: IssueRefundOptions,
): Result<Payment> {
  const { id, amountVnd, reason } = options;
  const at = options.at ?? new Date().toISOString();
  if (payment.status !== "succeeded") {
    return fail(
      "INVALID_PAYMENT_STATE",
      `Only a succeeded payment can be refunded (current: ${payment.status})`,
    );
  }
  if (!isPositiveVndAmount(amountVnd)) {
    return fail("INVALID_AMOUNT", "Refund amount must be a positive integer (VND)");
  }
  if (!reason) {
    return fail("REFUND_REASON_REQUIRED", "A refund reason is required");
  }
  const remaining = refundableAmount(payment);
  if (amountVnd > remaining) {
    return fail(
      "REFUND_EXCEEDS_REMAINING",
      `Refund ${amountVnd} exceeds remaining refundable ${remaining}`,
    );
  }
  const refund: PaymentRefund = { id, amountVnd, reason, issuedBy: "support", at };
  const refunded = refundedAmount(payment) + amountVnd;
  const fullyRefunded = refunded >= payment.amountVnd;
  const nextStatus: PaymentStatus = fullyRefunded ? "refunded" : "succeeded";
  return ok({
    ...payment,
    status: nextStatus,
    refunds: [...payment.refunds, refund],
    history: [
      ...payment.history,
      {
        from: payment.status,
        to: nextStatus,
        actor: "support",
        at,
        reason,
      },
    ],
  });
}

/**
 * Integration gate encoding spec flow 3 ("on success, booking moves to
 * `confirmed`"): a booking may be treated as fully confirmed only when its
 * Payment has succeeded — or when there is no Payment at all (free booking).
 * Pending/failed/refunded payments do not satisfy the gate. This predicate
 * NEVER changes BookingStatus; the Booking aggregate is not told about payment
 * states, and the booking module's host-accept `requested -> confirmed` stays
 * its own transition.
 */
export function canConfirmBooking(payment: Payment | null): boolean {
  if (payment === null) return true;
  return payment.status === "succeeded";
}

// ---------------------------------------------------------------------------
// Domain events
//
// Events are derived facts produced only from guard-passing results; a failed
// or idempotent-rejected call never emits an event, so replay-safe callers
// cannot double-emit. Recipients are derived server-side (the host learns of
// payer attempts/outcomes; both parties learn of support-issued refunds).
// ---------------------------------------------------------------------------

export type PaymentEventType =
  | "PAYMENT_ATTEMPTED"
  | "PAYMENT_SUCCEEDED"
  | "PAYMENT_FAILED"
  | "PAYMENT_RETRIED"
  | "REFUND_ISSUED";

export interface PaymentDomainEvent {
  type: PaymentEventType;
  /** When the payment change happened. */
  at: string;
  /** The actor whose action caused the event (attendee pays/retries, support refunds). */
  actor: PaymentActor;
  /** The booking the payment belongs to. */
  bookingId: string;
  /** Payment status after the change. */
  status: PaymentStatus;
  /** Gross amount the attendee pays, in VND. */
  amountVnd: number;
  /** Server-derived recipients; the actor is never the only recipient. */
  recipients: { attendee: boolean; host: boolean };
  /** Which attempt this event belongs to (count of pending entries). */
  attempt: number;
  /** Provider-side reference on success. */
  externalRef?: string;
  /** Present on REFUND_ISSUED. */
  refundId?: string;
  refundAmountVnd?: number;
  reason?: string;
}

function attemptCount(payment: Payment): number {
  return payment.history.filter((entry) => entry.to === "pending").length;
}

/**
 * Derive the payment events produced by a state change. `prev` is the payment
 * BEFORE the operation (or null on creation); `next` is the payment AFTER.
 * Only guard-passing results should be passed here.
 */
export function paymentEventsFor(
  prev: Payment | null,
  next: Payment,
): PaymentDomainEvent[] {
  if (prev === null) {
    return [
      {
        type: "PAYMENT_ATTEMPTED",
        at: next.createdAt,
        actor: "attendee",
        bookingId: next.bookingId,
        status: next.status,
        amountVnd: next.amountVnd,
        recipients: { attendee: false, host: true },
        attempt: attemptCount(next),
      },
    ];
  }
  if (next.refunds.length > prev.refunds.length) {
    const refund = next.refunds[next.refunds.length - 1];
    if (!refund) return [];
    return [
      {
        type: "REFUND_ISSUED",
        at: refund.at,
        actor: "support",
        bookingId: next.bookingId,
        status: next.status,
        amountVnd: next.amountVnd,
        recipients: { attendee: true, host: true },
        attempt: attemptCount(next),
        refundId: refund.id,
        refundAmountVnd: refund.amountVnd,
        reason: refund.reason,
      },
    ];
  }
  switch (next.status) {
    case "succeeded":
      return [
        {
          type: "PAYMENT_SUCCEEDED",
          at: next.paidAt ?? next.createdAt,
          actor: "attendee",
          bookingId: next.bookingId,
          status: next.status,
          amountVnd: next.amountVnd,
          recipients: { attendee: false, host: true },
          attempt: attemptCount(next),
          ...(next.externalRef !== undefined ? { externalRef: next.externalRef } : {}),
        },
      ];
    case "failed": {
      const entry = next.history[next.history.length - 1];
      if (!entry) return [];
      return [
        {
          type: "PAYMENT_FAILED",
          at: entry.at,
          actor: "attendee",
          bookingId: next.bookingId,
          status: next.status,
          amountVnd: next.amountVnd,
          recipients: { attendee: false, host: true },
          attempt: attemptCount(next),
          ...(entry.reason !== undefined ? { reason: entry.reason } : {}),
        },
      ];
    }
    case "pending": {
      const entry = next.history[next.history.length - 1];
      if (!entry) return [];
      const retried = prev.status === "failed";
      return [
        {
          type: retried ? "PAYMENT_RETRIED" : "PAYMENT_ATTEMPTED",
          at: entry.at,
          actor: "attendee",
          bookingId: next.bookingId,
          status: next.status,
          amountVnd: next.amountVnd,
          recipients: { attendee: false, host: true },
          attempt: attemptCount(next),
          ...(entry.reason !== undefined ? { reason: entry.reason } : {}),
        },
      ];
    }
    default:
      return [];
  }
}
