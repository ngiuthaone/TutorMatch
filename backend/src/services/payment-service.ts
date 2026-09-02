import { createClient } from "@supabase/supabase-js";
import { buildVnpayPaymentUrl, buildVnpayTransactionRequest, executeVnpayTransaction, normalizeVnpayOutcome, classifyVnpayRefundOutcome, formatVnpayDateTime, type VnpayConfig } from "./vnpay-adapter.js";
import { logServiceError } from "../lib/service-error.js";

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
  reconcileRefund(refundId: string): Promise<{ data?: any; error?: any }>;
  sweepRefundExecutions(workerId: string): Promise<{ data?: any; error?: any }>;
  sweepRefundReconciliations(workerId: string): Promise<{ data?: any; error?: any }>;
  sweepPendingFinalizations(workerId: string): Promise<{ data?: any; error?: any }>;
  sweepExpiredWorkshopBookings(workerId: string): Promise<{ data?: any; error?: any }>;
  sweepExpiredBookings(workerId: string): Promise<{ data?: { expired: number }; error?: unknown }>;
};
export type PaymentWorkerOptions = {
  batchSize?: number;
  leaseSeconds?: number;
  releaseBackoffSeconds?: number;
  providerRequestTimeoutMs?: number;
  signal?: AbortSignal;
};
export function createSupabasePaymentService(url: string, publishableKey: string, serviceRoleKey: string | undefined, vnpay: VnpayConfig, vnpayApiUrl: string, fetchImpl: typeof fetch = fetch, workerOptions: PaymentWorkerOptions = {}): PaymentService {
  const caller = (token: string) => createClient(url, publishableKey, { ...options, global: { headers: { Authorization: `Bearer ${token}` } } });
  const trusted = serviceRoleKey ? createClient(url, serviceRoleKey, options) : null;
  const workerLeaseSeconds = workerOptions.leaseSeconds ?? 300;
  const sweepBatch = workerOptions.batchSize ?? 50;
  const releaseBackoffSeconds = workerOptions.releaseBackoffSeconds ?? 60;
  const executeProvider = (request: ReturnType<typeof buildVnpayTransactionRequest>) => executeVnpayTransaction(vnpayApiUrl, request, fetchImpl, workerOptions.providerRequestTimeoutMs, workerOptions.signal);

  async function recordRefundResult(refundId: string, outcome: "pending" | "succeeded" | "failed" | "ambiguous", providerRequestId: string, body: Record<string, unknown>) {
    if (!trusted) return { data: null, error: new Error("Payment service authority is not configured") };
    return await trusted.rpc("record_vnpay_refund_result", {
      p_refund_id: refundId, p_outcome: outcome, p_provider_request_id: providerRequestId,
      p_provider_transaction_no: typeof body.vnp_TransactionNo === "string" ? body.vnp_TransactionNo : null,
      p_settlement_payload: body
    });
  }

  async function releaseRefundClaim(workerId: string, refundId: string, message: string) {
    if (!trusted) return { data: null, error: new Error("Payment service authority is not configured") };
    return await trusted.rpc("release_refund_claim", { p_worker_id: workerId, p_refund_id: refundId, p_error: message, p_backoff_seconds: releaseBackoffSeconds });
  }

  return {
    async start(token: string, bookingId: string, idempotencyKey: string) {
      const { data, error } = await caller(token).rpc("start_payment_attempt", { p_booking_id: bookingId, p_idempotency_key: idempotencyKey });
      if (error) return { error };
      if (!data || data.merchantReference == null || data.amountVnd == null) {
        return { error: { code: "INVALID_RESPONSE", message: "Payment service returned invalid data." } };
      }
      return { data: { ...data, redirectUrl: buildVnpayPaymentUrl(vnpay, { merchantReference: data.merchantReference, amountVnd: data.amountVnd, orderInfo: `Tutoria booking ${bookingId}`, returnUrl: returnUrlForBooking(vnpay.returnUrl, bookingId), createdAt: new Date() }) } };
    },
    async read(token: string, bookingId: string) { return await caller(token).rpc("get_booking_payment", { p_booking_id: bookingId }); },
    async observe(fields: { eventKey: string; merchantReference: string; outcome: string; providerTransactionNo: string | null; amountVnd: number; payload: Record<string, unknown> }) {
      if (!trusted) return { data: null, error: new Error("Payment service authority is not configured") };
      const result = await trusted.rpc("record_vnpay_observation", { p_provider_event_key: fields.eventKey, p_merchant_reference: fields.merchantReference, p_outcome: fields.outcome, p_provider_transaction_no: fields.providerTransactionNo, p_amount_vnd: fields.amountVnd, p_payload: fields.payload });
      if (!result.error && result.data?.status === "succeeded" && result.data.bookingId) { await trusted.rpc("finalize_paid_booking", { p_booking_id: result.data.bookingId }); await trusted.rpc("enroll_learner_in_course", { p_booking_id: result.data.bookingId }); }
      return result;
    },
    async reconcile(merchantReference: string) {
      if (!trusted) return { data: null, error: new Error("Payment service authority is not configured") };
      const attempt = await trusted.from("payment_attempts").select("id,payment_id,amount_vnd,merchant_reference").eq("merchant_reference", merchantReference).maybeSingle();
      if (attempt.error || !attempt.data) return { data: null, error: attempt.error ?? new Error("Unknown provider reference") };
      const operationKey = `query:${merchantReference}`;
      const existing = await trusted.from("payment_provider_operations").select("status,response_payload").eq("operation_key", operationKey).maybeSingle();
      if (existing.data && existing.data.status === "succeeded") return { data: existing.data.response_payload, error: null };
      const requestId = `query-${merchantReference}-${Date.now()}`;
      const query = buildVnpayTransactionRequest(vnpay, { requestId, command: "querydr", merchantReference, amountVnd: Number(attempt.data.amount_vnd), orderInfo: "Tutoria payment reconciliation", createdAt: new Date() });
      const operation = await trusted.from("payment_provider_operations").upsert({ operation_type: "query", operation_key: operationKey, payment_id: attempt.data.payment_id, attempt_id: attempt.data.id, merchant_reference: merchantReference, provider_request_id: requestId, status: "pending", request_payload: query.body }, { onConflict: "operation_key", ignoreDuplicates: true });
      if (operation.error) return { data: null, error: operation.error };
      try {
        const body = await executeProvider(query);
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
      const refund = await trusted.from("refunds").select("id,payment_id,amount_vnd,status,provider_transaction_no").eq("id", refundId).maybeSingle();
      if (refund.error || !refund.data) return { data: null, error: refund.error ?? new Error("Unknown refund obligation") };
      if (refund.data.status === "succeeded") return { data: refund.data, error: null };
      if (refund.data.status === "failed") return { data: null, error: new Error("Refund is terminal (failed); it will not be re-executed") };
      const operationKey = `refund:${refundId}`;
      const existing = await trusted.from("payment_provider_operations").select("status,provider_request_id,response_payload").eq("operation_key", operationKey).maybeSingle();
      if (existing.data) {
        if (refund.data.status === "pending" || refund.data.status === "ambiguous") return { data: refund.data, error: null };
        return await recordRefundResult(refundId, existing.data.status, existing.data.provider_request_id, existing.data.response_payload ?? {});
      }
      const payment = await trusted.from("payments").select("amount_vnd,status").eq("id", refund.data.payment_id).single();
      const attempt = await trusted.from("payment_attempts").select("merchant_reference,provider_transaction_no").eq("payment_id", refund.data.payment_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (payment.error || attempt.error || !payment.data || !attempt.data) return { data: null, error: new Error("Refund provider reference unavailable") };
      const requestId = `refund-${refundId}-${Date.now()}`;
      const request = buildVnpayTransactionRequest(vnpay, { requestId, command: "refund", merchantReference: attempt.data.merchant_reference, amountVnd: Number(refund.data.amount_vnd), transactionNo: attempt.data.provider_transaction_no ?? undefined, orderInfo: `Tutoria refund ${refundId}`, createdAt: new Date() });
      const inserted = await trusted.from("payment_provider_operations").insert({ operation_type: "refund", operation_key: operationKey, payment_id: refund.data.payment_id, refund_id: refundId, merchant_reference: attempt.data.merchant_reference, provider_request_id: requestId, status: "pending", request_payload: request.body });
      if (inserted.error) return { data: null, error: new Error("Refund operation already in flight") };
      try {
        const body = await executeProvider(request);
        const outcome = classifyVnpayRefundOutcome(body);
        await trusted.from("payment_provider_operations").update({ status: outcome, response_payload: body, updated_at: new Date().toISOString() }).eq("operation_key", operationKey);
        return await recordRefundResult(refundId, outcome, requestId, body);
      } catch (error) {
        await trusted.from("payment_provider_operations").update({ status: "ambiguous", response_payload: { error: "transport_unknown" }, updated_at: new Date().toISOString() }).eq("operation_key", operationKey);
        await recordRefundResult(refundId, "ambiguous", requestId, {});
        return { data: null, error };
      }
    },
    async reconcileRefund(refundId: string) {
      if (!trusted) return { data: null, error: new Error("Payment service authority is not configured") };
      const refund = await trusted.from("refunds").select("id,payment_id,amount_vnd,status,provider_transaction_no").eq("id", refundId).maybeSingle();
      if (refund.error || !refund.data) return { data: null, error: refund.error ?? new Error("Unknown refund obligation") };
      if (refund.data.status === "succeeded") return { data: refund.data, error: null };
      const op = await trusted.from("payment_provider_operations").select("provider_request_id,created_at").eq("operation_type", "refund").eq("refund_id", refundId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (op.error || !op.data?.provider_request_id) return { data: null, error: op.error ?? new Error("Refund was never executed; nothing to reconcile") };
      const attempt = await trusted.from("payment_attempts").select("id,merchant_reference").eq("payment_id", refund.data.payment_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (attempt.error || !attempt.data) return { data: null, error: new Error("Refund provider reference unavailable") };
      const queryKey = `queryrefund:${refundId}`;
      const existing = await trusted.from("payment_provider_operations").select("status,provider_request_id").eq("operation_key", queryKey).maybeSingle();
      if (existing.data?.status === "succeeded" || existing.data?.status === "failed") return { data: existing.data, error: null };
      const requestId = existing.data?.provider_request_id ?? `queryrefund-${refundId}-${Date.now()}`;
      const query = buildVnpayTransactionRequest(vnpay, { requestId, command: "querydr", merchantReference: attempt.data.merchant_reference, amountVnd: Number(refund.data.amount_vnd), transactionNo: refund.data.provider_transaction_no ?? undefined, transactionDate: formatVnpayDateTime(new Date(op.data.created_at)), orderInfo: "Tutoria refund reconciliation", createdAt: new Date() });
      const inserted = await trusted.from("payment_provider_operations").upsert({ operation_type: "query", operation_key: queryKey, payment_id: refund.data.payment_id, attempt_id: attempt.data.id, refund_id: refundId, merchant_reference: attempt.data.merchant_reference, provider_request_id: requestId, status: "pending", request_payload: query.body }, { onConflict: "operation_key", ignoreDuplicates: true });
      if (inserted.error) return { data: null, error: inserted.error };
      try {
        const body = await executeProvider(query);
        const outcome = classifyVnpayRefundOutcome(body);
        await trusted.from("payment_provider_operations").update({ status: outcome, response_payload: body, updated_at: new Date().toISOString() }).eq("operation_key", queryKey);
        return await recordRefundResult(refundId, outcome, requestId, body);
      } catch (error) {
        await trusted.from("payment_provider_operations").update({ status: "ambiguous", response_payload: { error: "transport_unknown" }, updated_at: new Date().toISOString() }).eq("operation_key", queryKey);
        await recordRefundResult(refundId, "ambiguous", requestId, {});
        return { data: null, error };
      }
    },
    async sweepRefundExecutions(workerId: string) {
      if (workerOptions.signal?.aborted) return { data: { claimed: 0, executed: 0 }, error: null };
      if (!trusted) return { data: null, error: new Error("Payment service authority is not configured") };
      const { data, error } = await trusted.rpc("claim_pending_refund_executions", { p_worker_id: workerId, p_max_count: sweepBatch, p_lease_seconds: workerLeaseSeconds });
      if (error) return { data: null, error };
      let executed = 0;
      for (const row of (data ?? []) as { refundId: string }[]) {
        if (workerOptions.signal?.aborted) break;
        let result: { data?: unknown; error?: unknown };
        try {
          result = await this.executeRefund(row.refundId);
        } catch (err) {
          console.error("refund_execution_exception", { refundId: row.refundId, error: String(err) });
          try { await releaseRefundClaim(workerId, row.refundId, String(err)); } catch (error) { logServiceError({ service: "payment-service", operation: "sweepRefundExecutions.releaseRefundClaim", error }); }
          continue;
        }
        if (result.error) {
          await releaseRefundClaim(workerId, row.refundId, String((result.error as Error | undefined)?.message ?? "refund_execution_error"));
          continue;
        }
        executed += 1;
      }
      return { data: { claimed: (data ?? []).length, executed }, error: null };
    },
    async sweepRefundReconciliations(workerId: string) {
      if (workerOptions.signal?.aborted) return { data: { claimed: 0, reconciled: 0 }, error: null };
      if (!trusted) return { data: null, error: new Error("Payment service authority is not configured") };
      const { data, error } = await trusted.rpc("claim_pending_refund_reconciliations", { p_worker_id: workerId, p_max_count: sweepBatch, p_lease_seconds: workerLeaseSeconds });
      if (error) return { data: null, error };
      let reconciled = 0;
      for (const row of (data ?? []) as { refundId: string }[]) {
        if (workerOptions.signal?.aborted) break;
        const result = await this.reconcileRefund(row.refundId);
        if (result.error) {
          await releaseRefundClaim(workerId, row.refundId, String((result.error as Error | undefined)?.message ?? "refund_reconciliation_error"));
          continue;
        }
        reconciled += 1;
      }
      return { data: { claimed: (data ?? []).length, reconciled }, error: null };
    },
    async sweepPendingFinalizations(workerId: string) {
      if (workerOptions.signal?.aborted) return { data: { claimed: 0, finalized: 0 }, error: null };
      if (!trusted) return { data: null, error: new Error("Payment service authority is not configured") };
      const { data, error } = await trusted.rpc("claim_pending_payment_finalizations", { p_worker_id: workerId, p_max_count: sweepBatch, p_lease_seconds: workerLeaseSeconds });
      if (error) return { data: null, error };
      let finalized = 0;
      for (const event of (data ?? []) as { id: string; payload: { bookingId?: string } }[]) {
        if (workerOptions.signal?.aborted) break;
        const bookingId = event.payload?.bookingId;
        if (!bookingId) {
          await trusted.rpc("complete_event", { p_worker_id: workerId, p_event_id: event.id });
          continue;
        }
        const result = await trusted.rpc("finalize_paid_booking", { p_booking_id: bookingId });
        if (result.error) {
          const attempts = Number((event as { attemptCount?: number }).attemptCount ?? 1);
          const backoff = attempts >= 5 ? 86400 : 60;
          await trusted.rpc("fail_event", { p_worker_id: workerId, p_event_id: event.id, p_error: String((result.error as Error | undefined)?.message ?? "finalization_error"), p_backoff_seconds: backoff });
          continue;
        }
        await trusted.rpc("complete_event", { p_worker_id: workerId, p_event_id: event.id });
        finalized += 1;
      }
      return { data: { claimed: (data ?? []).length, finalized }, error: null };
    },
    async sweepExpiredWorkshopBookings(workerId: string) {
      if (workerOptions.signal?.aborted) return { data: { expired: 0 }, error: null };
      if (!trusted) return { data: null, error: new Error("Payment service authority is not configured") };
      return await trusted.rpc("expire_stale_workshop_bookings", { p_worker_id: workerId });
    },
    async sweepExpiredBookings(workerId: string) {
      if (workerOptions.signal?.aborted) return { data: { expired: 0 }, error: null };
      if (!trusted) return { error: new Error("Payment service authority is not configured") };
      return await trusted.rpc("expire_stale_bookings", { p_worker_id: workerId }) as { data?: { expired: number }; error?: unknown };
    }
  };
}
