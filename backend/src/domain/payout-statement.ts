/**
 * Tutoria payout statement calculation — pure domain logic for computing
 * per-period host payout statements.
 *
 * This module is stateless and dependency-free. It computes payout statement
 * line items from authoritative financial records and never persists or
 * mutates state.
 *
 * V1 Commission policy:
 * - 10% commission on non-refunded value.
 * - 0% learner service fee.
 * - Statutory withholding: placeholder (LEGAL REVIEW REQUIRED).
 * - Payout eligibility: blocked when host compliance is incomplete or
 *   when there are unresolved disputes/refunds/mismatches.
 */

export type PayoutEligibilityStatus = "eligible" | "blocked";
export type PayoutStatus = "pending" | "processing" | "sent" | "held";
export type WithholdingResolutionStatus = "resolved" | "unresolved";

export interface PayoutStatementInput {
  hostId: string;
  periodStart: string;
  periodEnd: string;
  /** Sum of successful payment amounts for this host in this period (VND). */
  grossPaidServiceValueVnd: number;
  /** Sum of refund amounts for this host in this period (VND). */
  refundsVnd: number;
  /** Number of basis points for commission (1000 = 10%). */
  commissionRateBps: number;
  /** Statutory withholding amount (VND, placeholder — LEGAL REVIEW REQUIRED). */
  statutoryWithholdingVnd: number;
  /** Whether the withholding amount has been reviewed and confirmed. */
  withholdingResolutionStatus: WithholdingResolutionStatus;
  /** Manual adjustments (VND, positive or negative). */
  adjustmentsVnd: number;
  /** Whether the host meets payout eligibility requirements. */
  eligibilityStatus: PayoutEligibilityStatus;
  /** Reason for blocking if not eligible. */
  blockedReason?: string;
  /** Current payout processing status. */
  payoutStatus: PayoutStatus;
}

export interface PayoutStatementResult {
  hostId: string;
  periodStart: string;
  periodEnd: string;
  grossPaidServiceValueVnd: number;
  refundsVnd: number;
  commissionVnd: number;
  statutoryWithholdingVnd: number;
  withholdingResolutionStatus: WithholdingResolutionStatus;
  adjustmentsVnd: number;
  netPayoutVnd: number;
  eligibilityStatus: PayoutEligibilityStatus;
  blockedReason?: string;
  payoutStatus: PayoutStatus;
}

/**
 * Compute payout statement from authoritative financial records.
 * Commission is always on the non-refunded value.
 */
export function calculatePayoutStatement(
  input: PayoutStatementInput,
): PayoutStatementResult {
  const { grossPaidServiceValueVnd, refundsVnd, commissionRateBps,
    statutoryWithholdingVnd, withholdingResolutionStatus, adjustmentsVnd, eligibilityStatus,
    blockedReason, payoutStatus, hostId, periodStart, periodEnd } = input;

  // Commission on non-refunded value.
  const nonRefunded = Math.max(0, grossPaidServiceValueVnd - refundsVnd);
  const commissionVnd = Math.floor((nonRefunded * commissionRateBps) / 10000);

  // Net payout = gross - refunds - commission - withholding + adjustments.
  // Refunds go back to learner, not to host. Commission is Tutoria's cut.
  // Withholding is法定扣缴 (placeholder). Adjustments are admin overrides.
  const netPayoutVnd = Math.max(0,
    grossPaidServiceValueVnd
    - refundsVnd
    - commissionVnd
    - statutoryWithholdingVnd
    + adjustmentsVnd
  );

  // Blocked payouts: if not eligible, net is forced to 0.
  const effectiveNet = eligibilityStatus === "blocked" ? 0 : netPayoutVnd;

  return {
    hostId,
    periodStart,
    periodEnd,
    grossPaidServiceValueVnd,
    refundsVnd,
    commissionVnd,
    statutoryWithholdingVnd,
    withholdingResolutionStatus,
    adjustmentsVnd,
    netPayoutVnd: effectiveNet,
    eligibilityStatus,
    ...(blockedReason !== undefined ? { blockedReason } : {}),
    payoutStatus: eligibilityStatus === "blocked" ? "held" : payoutStatus,
  };
}

/**
 * Determine payout eligibility for a host. Fail-closed: blocked unless
 * all requirements are met, including resolved tax/withholding status.
 */
export function determinePayoutEligibility(options: {
  identityVerified: boolean;
  hostAgreementAccepted: boolean;
  hasOpenDisputes: boolean;
  hasPendingRefunds: boolean;
  hasReconciliationMismatches: boolean;
  withholdingResolved: boolean;
}): { eligible: boolean; blockedReason?: string } {
  const { identityVerified, hostAgreementAccepted, hasOpenDisputes,
    hasPendingRefunds, hasReconciliationMismatches, withholdingResolved } = options;

  if (!identityVerified) {
    return { eligible: false, blockedReason: "identity_verification_pending" };
  }
  if (!hostAgreementAccepted) {
    return { eligible: false, blockedReason: "host_agreement_not_accepted" };
  }
  if (!withholdingResolved) {
    return { eligible: false, blockedReason: "withholding_configuration_unresolved" };
  }
  if (hasOpenDisputes) {
    return { eligible: false, blockedReason: "open_disputes" };
  }
  if (hasPendingRefunds) {
    return { eligible: false, blockedReason: "pending_refunds" };
  }
  if (hasReconciliationMismatches) {
    return { eligible: false, blockedReason: "reconciliation_mismatch" };
  }
  return { eligible: true };
}

/**
 * Commission calculation helper. Full refund = zero commission.
 * Partial refund = commission on remaining non-refunded value.
 */
export function calculateCommission(
  priceVnd: number,
  refundAmountVnd: number,
  commissionRateBps: number = 1000,
): number {
  if (priceVnd <= 0) return 0;
  const nonRefunded = Math.max(0, priceVnd - refundAmountVnd);
  if (nonRefunded <= 0) return 0;
  return Math.floor((nonRefunded * commissionRateBps) / 10000);
}
