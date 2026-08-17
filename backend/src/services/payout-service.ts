import { createClient } from "@supabase/supabase-js";

export interface PayoutStatement {
  id: string;
  hostId: string;
  periodStart: string;
  periodEnd: string;
  grossPaidServiceValueVnd: number;
  refundsVnd: number;
  commissionVnd: number;
  statutoryWithholdingVnd: number;
  adjustmentsVnd: number;
  netPayoutVnd: number;
  eligibilityStatus: "eligible" | "blocked";
  blockedReason?: string;
  payoutStatus: "pending" | "processing" | "sent" | "held";
}

export type PayoutServiceResult<T> =
  | { status: "ok"; data: T }
  | { status: "unavailable" };

export function createPayoutService(
  supabaseUrl: string,
  publishableKey: string,
) {
  const caller = (token: string) =>
    createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

  return {
    /** List payout statements for the calling host. */
    async getMyPayoutStatements(
      token: string,
    ): Promise<PayoutServiceResult<PayoutStatement[]>> {
      try {
        const { data, error } = await caller(token).rpc(
          "get_my_payout_statements",
        );
        if (error) return { status: "unavailable" };
        return { status: "ok", data: (data as PayoutStatement[]) || [] };
      } catch {
        return { status: "unavailable" };
      }
    },
  };
}
