import { createClient } from "@supabase/supabase-js";

export type VerificationStatus = "not_verified" | "pending" | "verified";
export type PayoutEligibility = "not_eligible" | "eligible";

export interface HostComplianceState {
  userId: string;
  identityVerificationStatus: VerificationStatus;
  taxIdentityStatus: VerificationStatus;
  payoutEligibilityStatus: PayoutEligibility;
  hostAgreementVersion?: string;
  hostAgreementAcceptedAt?: string;
}

export type ComplianceServiceResult<T> =
  | { status: "ok"; data: T }
  | { status: "unavailable" };

/**
 * Host compliance service. Wraps the ensure_host_compliance and
 * is_host_payout_eligible RPCs. Fail-closed: paid offering activation
 * and payout eligibility require verified identity and accepted host agreement.
 */
export function createComplianceService(
  supabaseUrl: string,
  publishableKey: string,
) {
  const caller = (token: string) =>
    createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

  return {
    /** Ensure a compliance row exists and return current state. */
    async ensureCompliance(
      token: string,
      userId: string,
    ): Promise<ComplianceServiceResult<HostComplianceState>> {
      try {
        const { data, error } = await caller(token).rpc(
          "ensure_host_compliance",
          { p_user_id: userId },
        );
        if (error) return { status: "unavailable" };
        const row = data as Record<string, unknown>;
        return {
          status: "ok",
          data: {
            userId: row.userId as string,
            identityVerificationStatus: row.identityVerificationStatus as VerificationStatus,
            taxIdentityStatus: row.taxIdentityStatus as VerificationStatus,
            payoutEligibilityStatus: row.payoutEligibilityStatus as PayoutEligibility,
            hostAgreementVersion: (row.hostAgreementVersion as string) ?? undefined,
            hostAgreementAcceptedAt: (row.hostAgreementAcceptedAt as string) ?? undefined,
          },
        };
      } catch {
        return { status: "unavailable" };
      }
    },

    /** Server-authoritative payout eligibility check (fail-closed). */
    async isPayoutEligible(
      token: string,
      userId: string,
    ): Promise<ComplianceServiceResult<{ eligible: boolean }>> {
      try {
        const { data, error } = await caller(token).rpc(
          "is_host_payout_eligible",
          { p_user_id: userId },
        );
        if (error) return { status: "unavailable" };
        return { status: "ok", data: { eligible: data as boolean } };
      } catch {
        return { status: "unavailable" };
      }
    },
  };
}
