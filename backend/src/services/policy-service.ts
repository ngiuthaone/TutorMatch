import { createClient } from "@supabase/supabase-js";

export type PolicyType =
  | "terms_of_service"
  | "privacy_policy"
  | "cancellation_refund_policy"
  | "host_agreement"
  | "payment_payout_rules";

export interface PolicyRegistryEntry {
  id: string;
  policyType: PolicyType;
  version: string;
  effectiveAt: string;
  contentHash: string;
  title?: string;
  publishedAt?: string;
  active: boolean;
}

export interface PolicyAcceptance {
  policyType: PolicyType;
  policyVersion: string;
  acceptedAt: string;
  acceptanceSurface: string;
  locale?: string;
}

export type PolicyServiceResult<T> =
  | { status: "ok"; data: T }
  | { status: "unavailable" };

/**
 * Server-side policy service. Uses the service-role key for admin operations
 * (registry management) and the caller's JWT for user-facing operations
 * (acceptance recording, checking).
 */
export function createPolicyService(
  supabaseUrl: string,
  serviceRoleKey: string,
  publishableKey: string,
) {
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const userClient = (token: string) =>
    createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

  return {
    /** List active policies (public). */
    async listActivePolicies(): Promise<PolicyServiceResult<PolicyRegistryEntry[]>> {
      try {
        const { data, error } = await adminClient
          .from("policy_registry")
          .select("id, policy_type, version, effective_at, content_hash, title, published_at, active")
          .eq("active", true)
          .order("effective_at", { ascending: false });
        if (error) return { status: "unavailable" };
        return {
          status: "ok",
          data: (data || []).map((row) => ({
            id: row.id,
            policyType: row.policy_type as PolicyType,
            version: row.version,
            effectiveAt: row.effective_at,
            contentHash: row.content_hash,
            title: row.title ?? undefined,
            publishedAt: row.published_at ?? undefined,
            active: row.active,
          })),
        };
      } catch {
        return { status: "unavailable" };
      }
    },

    /** Record a policy acceptance for a user (idempotent). */
    async recordAcceptance(
      token: string,
      userId: string,
      policyType: PolicyType,
      policyVersion: string,
      acceptanceSurface: string,
      locale?: string,
    ): Promise<PolicyServiceResult<{ status: string }>> {
      try {
        const { data, error } = await userClient(token).rpc(
          "record_policy_acceptance",
          {
            p_user_id: userId,
            p_policy_type: policyType,
            p_policy_version: policyVersion,
            p_acceptance_surface: acceptanceSurface,
            p_locale: locale ?? null,
          },
        );
        if (error) return { status: "unavailable" };
        return { status: "ok", data: data as { status: string } };
      } catch {
        return { status: "unavailable" };
      }
    },

    /** Check if a user has accepted a policy. */
    async hasAccepted(
      token: string,
      userId: string,
      policyType: PolicyType,
      policyVersion?: string,
    ): Promise<PolicyServiceResult<{ accepted: boolean }>> {
      try {
        const { data, error } = await userClient(token).rpc(
          "has_accepted_policy",
          {
            p_user_id: userId,
            p_policy_type: policyType,
            p_policy_version: policyVersion ?? null,
          },
        );
        if (error) return { status: "unavailable" };
        return { status: "ok", data: data as { accepted: boolean } };
      } catch {
        return { status: "unavailable" };
      }
    },

    /** List all policy acceptances for the calling user. */
    async getMyAcceptances(
      token: string,
    ): Promise<PolicyServiceResult<PolicyAcceptance[]>> {
      try {
        const { data, error } = await userClient(token).rpc(
          "get_my_policy_acceptances",
        );
        if (error) return { status: "unavailable" };
        return { status: "ok", data: (data as PolicyAcceptance[]) || [] };
      } catch {
        return { status: "unavailable" };
      }
    },
  };
}
