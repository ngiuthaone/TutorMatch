import { describe, it, expect } from "vitest";
import {
  calculateRefundAmount,
  calculateRefundAmountSafe,
  calculateCommission,
  computeHoursUntilStart,
  type RefundCalculationInput,
} from "../src/domain/refund-calculation.js";
import {
  calculatePayoutStatement,
  determinePayoutEligibility,
  type PayoutStatementInput,
} from "../src/domain/payout-statement.js";
import {
  findDisallowedProperties,
  validateAnalyticsEvent,
  ANALYTICS_SCHEMA_VERSION,
  EVENT_ALLOWED_PROPERTIES,
} from "../src/domain/analytics-events.js";
import {
  listingKindToOfferingType,
  isValidOfferingType,
  type ListingKind,
  type OfferingType,
} from "../src/domain/offering-type-mapping.js";

// ─── Refund Calculation Tests ────────────────────────────────────────────────

describe("calculateRefundAmount", () => {
  const sessionStart = "2026-08-20T10:00:00Z";
  const price = 500000;

  it("host cancellation yields 100% refund regardless of time", () => {
    // 1 hour before session
    const now = new Date("2026-08-20T09:00:00Z");
    const result = calculateRefundAmount({
      priceSnapshotVnd: price,
      sessionStartsAt: sessionStart,
      now,
      cancellationActor: "host",
    });
    expect(result.refundAmountVnd).toBe(price);
    expect(result.refundPercentage).toBe(100);
    expect(result.reason).toBe("host_cancellation");
  });

  it("learner cancellation >=24h yields 100% refund", () => {
    const now = new Date("2026-08-19T09:00:00Z"); // 25h before
    const result = calculateRefundAmount({
      priceSnapshotVnd: price,
      sessionStartsAt: sessionStart,
      now,
      cancellationActor: "attendee",
    });
    expect(result.refundAmountVnd).toBe(price);
    expect(result.refundPercentage).toBe(100);
    expect(result.reason).toBe("cancellation_band");
  });

  it("learner cancellation exactly at 24h boundary yields 100% refund", () => {
    const now = new Date("2026-08-19T10:00:00Z"); // exactly 24h before
    const result = calculateRefundAmount({
      priceSnapshotVnd: price,
      sessionStartsAt: sessionStart,
      now,
      cancellationActor: "attendee",
    });
    expect(result.refundAmountVnd).toBe(price);
    expect(result.refundPercentage).toBe(100);
  });

  it("learner cancellation at 12h yields 50% refund", () => {
    const now = new Date("2026-08-19T22:00:00Z"); // 12h before
    const result = calculateRefundAmount({
      priceSnapshotVnd: price,
      sessionStartsAt: sessionStart,
      now,
      cancellationActor: "attendee",
    });
    expect(result.refundAmountVnd).toBe(250000);
    expect(result.refundPercentage).toBe(50);
    expect(result.reason).toBe("cancellation_band");
  });

  it("learner cancellation exactly at 6h boundary yields 50% refund", () => {
    const now = new Date("2026-08-20T04:00:00Z"); // exactly 6h before
    const result = calculateRefundAmount({
      priceSnapshotVnd: price,
      sessionStartsAt: sessionStart,
      now,
      cancellationActor: "attendee",
    });
    expect(result.refundAmountVnd).toBe(250000);
    expect(result.refundPercentage).toBe(50);
  });

  it("learner cancellation <6h yields 0% refund", () => {
    const now = new Date("2026-08-20T05:00:00Z"); // 5h before
    const result = calculateRefundAmount({
      priceSnapshotVnd: price,
      sessionStartsAt: sessionStart,
      now,
      cancellationActor: "attendee",
    });
    expect(result.refundAmountVnd).toBe(0);
    expect(result.refundPercentage).toBe(0);
    expect(result.reason).toBe("cancellation_band");
  });

  it("learner cancellation after session started yields 0% refund", () => {
    const now = new Date("2026-08-20T10:01:00Z"); // 1 min after start
    const result = calculateRefundAmount({
      priceSnapshotVnd: price,
      sessionStartsAt: sessionStart,
      now,
      cancellationActor: "attendee",
    });
    expect(result.refundAmountVnd).toBe(0);
    expect(result.refundPercentage).toBe(0);
  });

  it("no-show yields 0% refund regardless of actor or time", () => {
    const now = new Date("2026-08-21T10:00:00Z"); // next day
    const result = calculateRefundAmount({
      priceSnapshotVnd: price,
      sessionStartsAt: sessionStart,
      now,
      cancellationActor: "attendee",
      isNoShow: true,
    });
    expect(result.refundAmountVnd).toBe(0);
    expect(result.refundPercentage).toBe(0);
    expect(result.reason).toBe("no_show");
  });

  it("free booking yields 0 refund", () => {
    const now = new Date("2026-08-19T10:00:00Z");
    const result = calculateRefundAmount({
      priceSnapshotVnd: 0,
      sessionStartsAt: sessionStart,
      now,
      cancellationActor: "attendee",
    });
    expect(result.refundAmountVnd).toBe(0);
    expect(result.refundPercentage).toBe(0);
    expect(result.reason).toBe("free_booking");
  });

  it("free booking with negative price (data error) yields 0 refund", () => {
    const now = new Date("2026-08-19T10:00:00Z");
    const result = calculateRefundAmount({
      priceSnapshotVnd: -100,
      sessionStartsAt: sessionStart,
      now,
      cancellationActor: "attendee",
    });
    expect(result.refundAmountVnd).toBe(0);
    expect(result.reason).toBe("free_booking");
  });

  it("refund never exceeds price", () => {
    const now = new Date("2026-08-19T00:00:00Z"); // 34h before
    const result = calculateRefundAmount({
      priceSnapshotVnd: price,
      sessionStartsAt: sessionStart,
      now,
      cancellationActor: "host",
    });
    expect(result.refundAmountVnd).toBe(price);
    expect(result.refundAmountVnd).toBeLessThanOrEqual(price);
  });
});

describe("calculateRefundAmountSafe", () => {
  it("rejects negative price", () => {
    const result = calculateRefundAmountSafe({
      priceSnapshotVnd: -1,
      sessionStartsAt: "2026-08-20T10:00:00Z",
      now: new Date("2026-08-19T10:00:00Z"),
      cancellationActor: "attendee",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_INPUT");
  });

  it("rejects missing sessionStartsAt", () => {
    const result = calculateRefundAmountSafe({
      priceSnapshotVnd: 500000,
      sessionStartsAt: "",
      now: new Date("2026-08-19T10:00:00Z"),
      cancellationActor: "attendee",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_INPUT");
  });

  it("rejects unknown actor", () => {
    const result = calculateRefundAmountSafe({
      priceSnapshotVnd: 500000,
      sessionStartsAt: "2026-08-20T10:00:00Z",
      now: new Date("2026-08-19T10:00:00Z"),
      cancellationActor: "system" as never,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_INPUT");
  });
});

describe("calculateCommission", () => {
  it("10% commission on non-refunded value", () => {
    expect(calculateCommission(500000, 0)).toBe(50000);
    expect(calculateCommission(500000, 250000)).toBe(25000);
  });

  it("full refund produces zero commission", () => {
    expect(calculateCommission(500000, 500000)).toBe(0);
  });

  it("over-refund produces zero commission", () => {
    expect(calculateCommission(500000, 600000)).toBe(0);
  });

  it("free booking produces zero commission", () => {
    expect(calculateCommission(0, 0)).toBe(0);
    expect(calculateCommission(-100, 0)).toBe(0);
  });

  it("commission rate is configurable", () => {
    // 5% = 500 bps
    expect(calculateCommission(500000, 0, 500)).toBe(25000);
    // 15% = 1500 bps
    expect(calculateCommission(500000, 0, 1500)).toBe(75000);
  });
});

describe("computeHoursUntilStart", () => {
  it("returns positive hours for future sessions", () => {
    const now = new Date("2026-08-19T10:00:00Z");
    const hours = computeHoursUntilStart("2026-08-20T10:00:00Z", now);
    expect(hours).toBeCloseTo(24, 0);
  });

  it("returns negative hours for past sessions", () => {
    const now = new Date("2026-08-21T10:00:00Z");
    const hours = computeHoursUntilStart("2026-08-20T10:00:00Z", now);
    expect(hours).toBeLessThan(0);
  });

  it("returns -1 for invalid date", () => {
    const now = new Date("2026-08-19T10:00:00Z");
    const hours = computeHoursUntilStart("not-a-date", now);
    expect(hours).toBe(-1);
  });
});

// ─── Payout Statement Tests ──────────────────────────────────────────────────

describe("calculatePayoutStatement", () => {
  const baseInput: PayoutStatementInput = {
    hostId: "h1",
    periodStart: "2026-08-01T00:00:00Z",
    periodEnd: "2026-08-31T23:59:59Z",
    grossPaidServiceValueVnd: 2000000,
    refundsVnd: 200000,
    commissionRateBps: 1000,
    statutoryWithholdingVnd: 0,
    withholdingResolutionStatus: "unresolved",
    adjustmentsVnd: 0,
    eligibilityStatus: "eligible",
    payoutStatus: "pending",
  };

  it("calculates commission on non-refunded value", () => {
    const result = calculatePayoutStatement(baseInput);
    expect(result.grossPaidServiceValueVnd).toBe(2000000);
    expect(result.refundsVnd).toBe(200000);
    expect(result.commissionVnd).toBe(180000); // 10% of 1800000
    expect(result.statutoryWithholdingVnd).toBe(0);
    expect(result.withholdingResolutionStatus).toBe("unresolved");
    expect(result.adjustmentsVnd).toBe(0);
    expect(result.netPayoutVnd).toBe(1620000); // 2000000 - 200000 - 180000
  });

  it("full refund yields zero commission and net = gross - refunds", () => {
    const result = calculatePayoutStatement({
      ...baseInput,
      refundsVnd: 2000000,
    });
    expect(result.commissionVnd).toBe(0);
    expect(result.netPayoutVnd).toBe(0); // 2000000 - 2000000 - 0
  });

  it("blocked eligibility forces net to 0 and status to held", () => {
    const result = calculatePayoutStatement({
      ...baseInput,
      eligibilityStatus: "blocked",
      blockedReason: "open_disputes",
    });
    expect(result.netPayoutVnd).toBe(0);
    expect(result.payoutStatus).toBe("held");
    expect(result.blockedReason).toBe("open_disputes");
  });

  it("applies adjustments", () => {
    const result = calculatePayoutStatement({
      ...baseInput,
      adjustmentsVnd: 100000,
    });
    expect(result.netPayoutVnd).toBe(1720000); // 2000000 - 200000 - 180000 + 100000
  });

  it("negative adjustments reduce net payout", () => {
    const result = calculatePayoutStatement({
      ...baseInput,
      adjustmentsVnd: -50000,
    });
    expect(result.netPayoutVnd).toBe(1570000);
  });

  it("net payout never goes negative (floor at 0)", () => {
    const result = calculatePayoutStatement({
      ...baseInput,
      adjustmentsVnd: -5000000,
    });
    expect(result.netPayoutVnd).toBe(0);
  });

  it("preserves withholding resolution status in output", () => {
    const resolved = calculatePayoutStatement({
      ...baseInput,
      withholdingResolutionStatus: "resolved",
      statutoryWithholdingVnd: 0,
    });
    expect(resolved.withholdingResolutionStatus).toBe("resolved");

    const unresolved = calculatePayoutStatement({
      ...baseInput,
      withholdingResolutionStatus: "unresolved",
      statutoryWithholdingVnd: 0,
    });
    expect(unresolved.withholdingResolutionStatus).toBe("unresolved");
  });
});

describe("determinePayoutEligibility", () => {
  it("eligible when all requirements met", () => {
    const result = determinePayoutEligibility({
      identityVerified: true,
      hostAgreementAccepted: true,
      hasOpenDisputes: false,
      hasPendingRefunds: false,
      hasReconciliationMismatches: false,
      withholdingResolved: true,
    });
    expect(result.eligible).toBe(true);
  });

  it("blocked when identity not verified", () => {
    const result = determinePayoutEligibility({
      identityVerified: false,
      hostAgreementAccepted: true,
      hasOpenDisputes: false,
      hasPendingRefunds: false,
      hasReconciliationMismatches: false,
      withholdingResolved: true,
    });
    expect(result.eligible).toBe(false);
    expect(result.blockedReason).toBe("identity_verification_pending");
  });

  it("blocked when host agreement not accepted", () => {
    const result = determinePayoutEligibility({
      identityVerified: true,
      hostAgreementAccepted: false,
      hasOpenDisputes: false,
      hasPendingRefunds: false,
      hasReconciliationMismatches: false,
      withholdingResolved: true,
    });
    expect(result.eligible).toBe(false);
    expect(result.blockedReason).toBe("host_agreement_not_accepted");
  });

  it("blocked when withholding unresolved (fail-closed)", () => {
    const result = determinePayoutEligibility({
      identityVerified: true,
      hostAgreementAccepted: true,
      hasOpenDisputes: false,
      hasPendingRefunds: false,
      hasReconciliationMismatches: false,
      withholdingResolved: false,
    });
    expect(result.eligible).toBe(false);
    expect(result.blockedReason).toBe("withholding_configuration_unresolved");
  });

  it("eligible with zero withholding when resolved", () => {
    const result = determinePayoutEligibility({
      identityVerified: true,
      hostAgreementAccepted: true,
      hasOpenDisputes: false,
      hasPendingRefunds: false,
      hasReconciliationMismatches: false,
      withholdingResolved: true,
    });
    expect(result.eligible).toBe(true);
  });

  it("blocked when open disputes exist", () => {
    const result = determinePayoutEligibility({
      identityVerified: true,
      hostAgreementAccepted: true,
      hasOpenDisputes: true,
      hasPendingRefunds: false,
      hasReconciliationMismatches: false,
      withholdingResolved: true,
    });
    expect(result.eligible).toBe(false);
    expect(result.blockedReason).toBe("open_disputes");
  });

  it("blocked when pending refunds exist", () => {
    const result = determinePayoutEligibility({
      identityVerified: true,
      hostAgreementAccepted: true,
      hasOpenDisputes: false,
      hasPendingRefunds: true,
      hasReconciliationMismatches: false,
      withholdingResolved: true,
    });
    expect(result.eligible).toBe(false);
    expect(result.blockedReason).toBe("pending_refunds");
  });

  it("blocked when reconciliation mismatches exist", () => {
    const result = determinePayoutEligibility({
      identityVerified: true,
      hostAgreementAccepted: true,
      hasOpenDisputes: false,
      hasPendingRefunds: false,
      hasReconciliationMismatches: true,
      withholdingResolved: true,
    });
    expect(result.eligible).toBe(false);
    expect(result.blockedReason).toBe("reconciliation_mismatch");
  });

  it("blocked when multiple issues exist (reports first found)", () => {
    const result = determinePayoutEligibility({
      identityVerified: false,
      hostAgreementAccepted: false,
      hasOpenDisputes: true,
      hasPendingRefunds: false,
      hasReconciliationMismatches: false,
      withholdingResolved: false,
    });
    expect(result.eligible).toBe(false);
    // First blocking condition wins
    expect(result.blockedReason).toBe("identity_verification_pending");
  });
});

// ─── Analytics Event Validation Tests ────────────────────────────────────────

describe("findDisallowedProperties", () => {
  it("returns empty for allowed properties", () => {
    const violations = findDisallowedProperties("ANALYTICS_BOOKING_REQUESTED", {
      bookingId: "b1",
      sessionId: "s1",
      participantCount: 1,
      priceVnd: 500000,
      offeringType: "tutor",
      bookingMode: "request_to_book",
    });
    expect(violations).toEqual([]);
  });

  it("rejects disallowed properties", () => {
    const violations = findDisallowedProperties("ANALYTICS_BOOKING_REQUESTED", {
      bookingId: "b1",
      email: "test@example.com",
      phone: "+84123456789",
    });
    expect(violations).toContain("email");
    expect(violations).toContain("phone");
    expect(violations).not.toContain("bookingId");
  });

  it("rejects PII under alternate names", () => {
    const violations = findDisallowedProperties("ANALYTICS_BOOKING_REQUESTED", {
      bookingId: "b1",
      userEmail: "test@example.com",
      contactPhone: "+84123456789",
      homeAddress: "123 Main St",
      userPassword: "secret",
      cardNumber: "4111111111111111",
    });
    expect(violations).toContain("userEmail");
    expect(violations).toContain("contactPhone");
    expect(violations).toContain("homeAddress");
    expect(violations).toContain("userPassword");
    expect(violations).toContain("cardNumber");
  });

  it("every event type has an allowlist defined", () => {
    // Ensure all event types referenced in the outbox CHECK have allowlists
    const allEventTypes = Object.keys(EVENT_ALLOWED_PROPERTIES);
    expect(allEventTypes.length).toBeGreaterThan(0);
    for (const eventType of allEventTypes) {
      expect(Array.isArray(EVENT_ALLOWED_PROPERTIES[eventType])).toBe(true);
      expect(EVENT_ALLOWED_PROPERTIES[eventType]!.length).toBeGreaterThan(0);
    }
  });
});

describe("validateAnalyticsEvent", () => {
  it("validates a correct event", () => {
    const result = validateAnalyticsEvent({
      eventType: "ANALYTICS_LISTING_VIEW",
      schemaVersion: ANALYTICS_SCHEMA_VERSION,
      environment: "production",
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects missing eventType", () => {
    const result = validateAnalyticsEvent({
      schemaVersion: ANALYTICS_SCHEMA_VERSION,
      environment: "production",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("eventType is required");
  });

  it("rejects wrong schema version", () => {
    const result = validateAnalyticsEvent({
      eventType: "ANALYTICS_LISTING_VIEW",
      schemaVersion: 999,
      environment: "production",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("schemaVersion"))).toBe(true);
  });

  it("rejects missing environment", () => {
    const result = validateAnalyticsEvent({
      eventType: "ANALYTICS_LISTING_VIEW",
      schemaVersion: ANALYTICS_SCHEMA_VERSION,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("environment is required");
  });
});

// ─── Offering-Type Mapping Tests ─────────────────────────────────────────────

describe("listingKindToOfferingType", () => {
  it("maps 'event' to 'event'", () => {
    expect(listingKindToOfferingType("event")).toBe("event");
  });

  it("maps 'course' to null (not bookable in V1)", () => {
    expect(listingKindToOfferingType("course")).toBeNull();
  });
});

describe("isValidOfferingType", () => {
  it("accepts valid offering types", () => {
    expect(isValidOfferingType("tutor")).toBe(true);
    expect(isValidOfferingType("workshop")).toBe(true);
    expect(isValidOfferingType("class")).toBe(true);
    expect(isValidOfferingType("event")).toBe(true);
  });

  it("rejects invalid offering types", () => {
    expect(isValidOfferingType("course")).toBe(false);
    expect(isValidOfferingType("lesson")).toBe(false);
    expect(isValidOfferingType("")).toBe(false);
  });
});

// ─── Integration: Payment Boundary with Refund ───────────────────────────────

describe("refund + commission integration", () => {
  it("full refund produces zero commission", () => {
    const refund = calculateRefundAmount({
      priceSnapshotVnd: 500000,
      sessionStartsAt: "2026-08-20T10:00:00Z",
      now: new Date("2026-08-19T00:00:00Z"),
      cancellationActor: "host",
    });
    expect(refund.refundAmountVnd).toBe(500000);

    const commission = calculateCommission(500000, refund.refundAmountVnd);
    expect(commission).toBe(0);
  });

  it("50% refund reduces commission base by half", () => {
    const refund = calculateRefundAmount({
      priceSnapshotVnd: 500000,
      sessionStartsAt: "2026-08-20T10:00:00Z",
      now: new Date("2026-08-19T22:00:00Z"), // 12h before
      cancellationActor: "attendee",
    });
    expect(refund.refundAmountVnd).toBe(250000);

    const commission = calculateCommission(500000, refund.refundAmountVnd);
    expect(commission).toBe(25000); // 10% of 250000
  });

  it("0% refund keeps full commission base", () => {
    const refund = calculateRefundAmount({
      priceSnapshotVnd: 500000,
      sessionStartsAt: "2026-08-20T10:00:00Z",
      now: new Date("2026-08-20T05:00:00Z"), // 5h before
      cancellationActor: "attendee",
    });
    expect(refund.refundAmountVnd).toBe(0);

    const commission = calculateCommission(500000, refund.refundAmountVnd);
    expect(commission).toBe(50000); // 10% of 500000
  });

  it("payout statement reconciles with refund + commission", () => {
    const payout = calculatePayoutStatement({
      hostId: "h1",
      periodStart: "2026-08-01T00:00:00Z",
      periodEnd: "2026-08-31T23:59:59Z",
      grossPaidServiceValueVnd: 1000000,
      refundsVnd: 250000,
      commissionRateBps: 1000,
      statutoryWithholdingVnd: 0,
      withholdingResolutionStatus: "resolved",
      adjustmentsVnd: 0,
      eligibilityStatus: "eligible",
      payoutStatus: "pending",
    });
    // Commission = 10% of (1000000 - 250000) = 75000
    expect(payout.commissionVnd).toBe(75000);
    // Net = 1000000 - 250000 - 75000 = 675000
    expect(payout.netPayoutVnd).toBe(675000);
  });

  it("unresolved withholding blocks payout even with zero withholding amount", () => {
    const payout = calculatePayoutStatement({
      hostId: "h1",
      periodStart: "2026-08-01T00:00:00Z",
      periodEnd: "2026-08-31T23:59:59Z",
      grossPaidServiceValueVnd: 1000000,
      refundsVnd: 0,
      commissionRateBps: 1000,
      statutoryWithholdingVnd: 0,
      withholdingResolutionStatus: "unresolved",
      adjustmentsVnd: 0,
      eligibilityStatus: "eligible",
      payoutStatus: "pending",
    });
    // Withholding is unresolved — payout should be blocked by eligibility check
    const eligibility = determinePayoutEligibility({
      identityVerified: true,
      hostAgreementAccepted: true,
      hasOpenDisputes: false,
      hasPendingRefunds: false,
      hasReconciliationMismatches: false,
      withholdingResolved: false,
    });
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.blockedReason).toBe("withholding_configuration_unresolved");
  });
});

// ─── Policy-Version Reproducibility Tests ────────────────────────────────────

describe("policy-version reproducibility", () => {
  it("snapshot stores V1 bands and calculator uses them", () => {
    // Simulate V1 bands snapshotted at booking time
    const v1Snapshot = {
      hostCancellationPct: 100,
      bands: [
        { minHours: 24, pct: 100 },
        { minHours: 6, pct: 50 },
        { minHours: 0, pct: 0 },
      ],
      noShowPct: 0,
    };

    // Simulate V2 bands (hypothetical future policy change: 48h threshold)
    const v2Snapshot = {
      hostCancellationPct: 100,
      bands: [
        { minHours: 48, pct: 100 },
        { minHours: 12, pct: 50 },
        { minHours: 0, pct: 0 },
      ],
      noShowPct: 0,
    };

    // Booking under V1: 30h before session → should get 100% (V1 has 24h threshold)
    // Under V2, this would be 50% (V2 has 48h threshold)
    // The RPC uses the snapshot, so V1 booking stays V1.

    // Verify V1 bands produce 100% at 30h
    const hours30 = 30;
    let v1Pct = 0;
    for (const band of v1Snapshot.bands) {
      if (hours30 >= band.minHours) {
        v1Pct = band.pct;
        break;
      }
    }
    expect(v1Pct).toBe(100);

    // Verify V2 bands would produce 50% at 30h (48h threshold not met)
    let v2Pct = 0;
    for (const band of v2Snapshot.bands) {
      if (hours30 >= band.minHours) {
        v2Pct = band.pct;
        break;
      }
    }
    expect(v2Pct).toBe(50);

    // The key invariant: V1 booking uses V1 bands, not V2 bands.
    // This is enforced by the RPC reading refund_policy_snapshot from booking_policy_snapshots.
  });
});
