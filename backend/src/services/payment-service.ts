import { createClient } from "@supabase/supabase-js";
import { buildVnpayPaymentUrl, buildVnpayTransactionRequest, executeVnpayTransaction, normalizeVnpayOutcome, type VnpayConfig } from "./vnpay-adapter.js";

function returnUrlForBooking(returnUrl: string, bookingId: string): string {
  const url = new URL(returnUrl);
  url.searchParams.set("bookingId", bookingId);
  return url.toString();
}

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } } as const;
export type PaymentService = {
  start(token: string, bookingId: string, idempotencyKey: string): Promise<{ data?: any; error?: any }>;
  read(token: string, bookingId: string): Promise<{ data: any; error: any }>;
  observe(fields: { eventKey: string; merchantReference: string; outcome: string; providerTransactionNo: string | null; amountVnd: number; payload: Record<string, unknown> }): Promise<{ data: any; error: any }>;
  reconcile(merchantReference: string): Promise<{ data?: any; error?: any }>;
  executeRefund(refundId: string): Promise<{ data?: any; error?: any }>;
};
export function createSupabasePaymentService(url: string, publishableKey: string, serviceRoleKey: string | undefined, vnpay: VnpayConfig, vnpayApiUrl: string): PaymentService {
  const caller = (token: string) => createClient(url, publishableKey, { ...options, global: { headers: { Authorization: `Bearer ${token}` } } });
  const trusted = serviceRoleKey ? createClient(url, serviceRoleKey, options) : null;
  return {
    async start(token: string, bookingId: string, idempotencyKey: string) {
      const { data, error } = await caller(token).rpc("start_payment_attempt", { p_booking_id: bookingId, p_idempotency_key: idempotencyKey });
      if (error) return { error };
      return { data: { ...data, redirectUrl: buildVnpayPaymentUrl(vnpay, { merchantReference: data.merchantReference, amountVnd: data.amountVnd, orderInfo: `Tutoria booking ${bookingId}`, returnUrl: returnUrlForBooking(vnpay.returnUrl, bookingId), createdAt: new Date() }) } };
    },
    async read(token: string, bookingId: string) { return await caller(token).rpc("get_booking_payment", { p_booking_id: bookingId }); },
    async observe(fields: { eventKey: string; merchantReference: string; outcome: string; providerTransactionNo: string | null; amountVnd: number; payload: Record<string, unknown> }) {
      if (!trusted) return { data: null, error: new Error("Payment service authority is not configured") };
      const result = await trusted.rpc("record_vnpay_observation", { p_provider_event_key: fields.eventKey, p_merchant_reference: fields.merchantReference, p_outcome: fields.outcome, p_provider_transaction_no: fields.providerTransactionNo, p_amount_vnd: fields.amountVnd, p_payload: fields.payload });
      if (!result.error && result.data?.status === "succeeded" && result.data.bookingId) await trusted.rpc("finalize_paid_booking", { p_booking_id: result.data.bookingId });
      return result;
    },
    async reconcile(merchantReference: string) {
      if (!trusted) return { data: null, error: new Error("Payment service authority is not configured") };
      const attempt = await trusted.from("payment_attempts").select("id,payment_id,amount_vnd,merchant_reference").eq("merchant_reference", merchantReference).maybeSingle();
      if (attempt.error || !attempt.data) return { data: null, error: attempt.error ?? new Error("Unknown provider reference") };
      const operationKey = `query:${merchantReference}`;
      const existing = await trusted.from("payment_provider_operations").select("status,response_payload").eq("operation_key", operationKey).maybeSingle();
      if (existing.data?.status === "succeeded") return { data: existing.data.response_payload, error: null };
      const requestId = `query-${merchantReference}-${Date.now()}`;
      const query = buildVnpayTransactionRequest(vnpay, { requestId, command: "querydr", merchantReference, amountVnd: Number(attempt.data.amount_vnd), orderInfo: "Tutoria payment reconciliation", createdAt: new Date() });
      const operation = await trusted.from("payment_provider_operations").upsert({ operation_type: "query", operation_key: operationKey, payment_id: attempt.data.payment_id, attempt_id: attempt.data.id, merchant_reference: merchantReference, provider_request_id: requestId, status: "pending", request_payload: query.body }, { onConflict: "operation_key", ignoreDuplicates: true });
      if (operation.error) return { data: null, error: operation.error };
      try {
        const body = await executeVnpayTransaction(vnpayApiUrl, query);
        await trusted.from("payment_provider_operations").update({ status: String(body.vnp_ResponseCode) === "00" ? "succeeded" : "failed", response_payload: body, updated_at: new Date().toISOString() }).eq("operation_key", operationKey);
        const normalized = normalizeVnpayOutcome(body);
        return await this.observe({ eventKey: `query:${merchantReference}:${String(body.vnp_TransactionNo ?? body.vnp_ResponseCode ?? "unknown")}`, merchantReference, outcome: normalized.outcome, providerTransactionNo: normalized.providerTransactionNo, amountVnd: normalized.amountVnd, payload: body });
      } catch (error) {
        await trusted.from("payment_provider_operations").update({ status: "ambiguous", response_payload: { error: "transport_unknown" }, updated_at: new Date().toISOString() }).eq("operation_key", operationKey);
        return { data: null, error };
      }
    },
    async executeRefund(refundId: string) {
      if (!trusted) return { data: null, error: new Error("Payment service authority is not configured") };
      const refund = await trusted.from("refunds").select("id,payment_id,amount_vnd,status").eq("id", refundId).maybeSingle();
      if (refund.error || !refund.data) return { data: null, error: refund.error ?? new Error("Unknown refund obligation") };
      if (refund.data.status === "succeeded") return { data: refund.data, error: null };
      const existing = await trusted.from("payment_provider_operations").select("status,response_payload").eq("operation_key", `refund:${refundId}`).maybeSingle();
      if (existing.data) return { data: existing.data, error: existing.data.status === "ambiguous" || existing.data.status === "pending" ? new Error("Refund operation requires reconciliation") : null };
      const payment = await trusted.from("payments").select("amount_vnd").eq("id", refund.data.payment_id).single();
      const attempt = await trusted.from("payment_attempts").select("merchant_reference,provider_transaction_no").eq("payment_id", refund.data.payment_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (payment.error || attempt.error || !payment.data || !attempt.data) return { data: null, error: new Error("Refund provider reference unavailable") };
      const requestId = `refund-${refundId}-${Date.now()}`;
      const request = buildVnpayTransactionRequest(vnpay, { requestId, command: "refund", merchantReference: attempt.data.merchant_reference, amountVnd: Number(refund.data.amount_vnd), transactionNo: attempt.data.provider_transaction_no ?? undefined, orderInfo: `Tutoria refund ${refundId}`, createdAt: new Date() });
      const inserted = await trusted.from("payment_provider_operations").insert({ operation_type: "refund", operation_key: `refund:${refundId}`, payment_id: refund.data.payment_id, refund_id: refundId, merchant_reference: attempt.data.merchant_reference, provider_request_id: requestId, status: "pending", request_payload: request.body });
      if (inserted.error) return { data: null, error: new Error("Refund operation already in flight") };
      try {
        const body = await executeVnpayTransaction(vnpayApiUrl, request);
        const outcome = String(body.vnp_ResponseCode) === "00" ? "succeeded" : "failed";
        await trusted.from("payment_provider_operations").update({ status: outcome, response_payload: body, updated_at: new Date().toISOString() }).eq("operation_key", `refund:${refundId}`);
        return await trusted.rpc("record_vnpay_refund_result", { p_refund_id: refundId, p_outcome: outcome, p_provider_request_id: requestId, p_provider_transaction_no: typeof body.vnp_TransactionNo === "string" ? body.vnp_TransactionNo : null });
      } catch (error) {
        await trusted.from("payment_provider_operations").update({ status: "ambiguous", response_payload: { error: "transport_unknown" }, updated_at: new Date().toISOString() }).eq("operation_key", `refund:${refundId}`);
        return { data: null, error };
      }
    }
  };
}
