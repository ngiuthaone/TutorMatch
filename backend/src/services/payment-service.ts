import { createClient } from "@supabase/supabase-js";
import { buildVnpayPaymentUrl, type VnpayConfig } from "./vnpay-adapter.js";

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } } as const;
export type PaymentService = {
  start(token: string, bookingId: string, idempotencyKey: string): Promise<{ data?: any; error?: any }>;
  read(token: string, bookingId: string): Promise<{ data: any; error: any }>;
  observe(fields: { eventKey: string; merchantReference: string; outcome: string; providerTransactionNo: string | null; amountVnd: number; payload: Record<string, unknown> }): Promise<{ data: any; error: any }>;
};
export function createSupabasePaymentService(url: string, publishableKey: string, serviceRoleKey: string | undefined, vnpay: VnpayConfig): PaymentService {
  const caller = (token: string) => createClient(url, publishableKey, { ...options, global: { headers: { Authorization: `Bearer ${token}` } } });
  const trusted = serviceRoleKey ? createClient(url, serviceRoleKey, options) : null;
  return {
    async start(token: string, bookingId: string, idempotencyKey: string) {
      const { data, error } = await caller(token).rpc("start_payment_attempt", { p_booking_id: bookingId, p_idempotency_key: idempotencyKey });
      if (error) return { error };
      return { data: { ...data, redirectUrl: buildVnpayPaymentUrl(vnpay, { merchantReference: data.merchantReference, amountVnd: data.amountVnd, orderInfo: `Tutoria booking ${bookingId}`, createdAt: new Date() }) } };
    },
    async read(token: string, bookingId: string) { return await caller(token).rpc("get_booking_payment", { p_booking_id: bookingId }); },
    async observe(fields: { eventKey: string; merchantReference: string; outcome: string; providerTransactionNo: string | null; amountVnd: number; payload: Record<string, unknown> }) {
      if (!trusted) return { data: null, error: new Error("Payment service authority is not configured") };
      const result = await trusted.rpc("record_vnpay_observation", { p_provider_event_key: fields.eventKey, p_merchant_reference: fields.merchantReference, p_outcome: fields.outcome, p_provider_transaction_no: fields.providerTransactionNo, p_amount_vnd: fields.amountVnd, p_payload: fields.payload });
      if (!result.error && result.data?.status === "succeeded" && result.data.bookingId) await trusted.rpc("finalize_paid_booking", { p_booking_id: result.data.bookingId });
      return result;
    }
  };
}
