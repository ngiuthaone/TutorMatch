import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ApiError } from "../errors/api-error.js";
import { verifyVnpayFields, normalizeVnpayOutcome, type VnpayConfig } from "../services/vnpay-adapter.js";
import type { PaymentService } from "../services/payment-service.js";

const startSchema = z.object({ bookingId: z.string().uuid(), idempotencyKey: z.string().trim().min(16).max(128) });
function paymentError(error: { code?: string; message?: string } | null, fallbackCode: string, fallbackStatus = 503): ApiError {
  const message = error?.message ?? "";
  if (error?.code === "42501") return new ApiError(403, "FORBIDDEN", "You are not allowed to access this payment.");
  if (message.includes("BOOKING_NOT_APPROVED_FOR_PAYMENT")) return new ApiError(409, "PAYMENT_NOT_READY", "The tutor has not approved this booking for payment.");
  if (message.includes("BOOKING_PRICE_NOT_SNAPSHOTTED")) return new ApiError(409, "BOOKING_PRICE_MISSING", "This booking has no authoritative price.");
  if (message.includes("PAYMENT_NOT_RETRYABLE")) return new ApiError(409, "PAYMENT_NOT_RETRYABLE", "This payment cannot be retried.");
  if (message.includes("INVALID_IDEMPOTENCY_KEY")) return new ApiError(400, "INVALID_IDEMPOTENCY_KEY", "The idempotency key is invalid.");
  if (message.includes("INVALID_TRANSITION")) return new ApiError(409, "INVALID_LIFECYCLE_TRANSITION", "Payment is not available in the current booking state.");
  return new ApiError(fallbackStatus, fallbackCode, fallbackStatus === 503 ? "Payment service is temporarily unavailable." : "Payment request was rejected.");
}
export const paymentRoutes: FastifyPluginAsync<{ service: PaymentService; vnpay: VnpayConfig; reconciliationToken: string | undefined }> = async (app, options) => {
  app.post("/api/v1/payments/start", { preHandler: app.authenticate }, async (request) => {
    const body = startSchema.safeParse(request.body); if (!body.success) throw new ApiError(400, "PAYMENT_INVALID", "Payment details are invalid.");
    const result = await options.service.start(request.auth.accessToken, body.data.bookingId, body.data.idempotencyKey);
    if (result.error) throw paymentError(result.error, "PAYMENT_START_REJECTED", 409);
    return { ok: true, payment: result.data };
  });
  app.get("/api/v1/payments/:bookingId", { preHandler: app.authenticate }, async (request) => {
    const bookingId = z.string().uuid().safeParse((request.params as { bookingId?: unknown }).bookingId); if (!bookingId.success) throw new ApiError(404, "NOT_FOUND", "Payment not found.");
    const result = await options.service.read(request.auth.accessToken, bookingId.data); if (result.error) throw paymentError(result.error, "PAYMENT_UNAVAILABLE");
    if (!result.data) throw new ApiError(404, "PAYMENT_NOT_FOUND", "Payment not found."); return { ok: true, payment: result.data };
  });
  app.get("/api/v1/payments/vnpay/ipn", async (request, reply) => {
    const fields = request.query as Record<string, unknown>;
    if (!verifyVnpayFields(fields, options.vnpay.hashSecret)) return reply.send({ RspCode: "97", Message: "Invalid signature" });
    const normalized = normalizeVnpayOutcome(fields); if (!normalized.merchantReference) return reply.send({ RspCode: "01", Message: "Invalid request" });
    const result = await options.service.observe({ eventKey: normalized.eventKey, merchantReference: normalized.merchantReference, outcome: normalized.outcome, providerTransactionNo: normalized.providerTransactionNo, amountVnd: normalized.amountVnd, payload: { responseCode: fields.vnp_ResponseCode, transactionStatus: fields.vnp_TransactionStatus } });
    if (result.error) return reply.send({ RspCode: "99", Message: "Processing error" }); return reply.send({ RspCode: "00", Message: "Confirm Success" });
  });
  if (options.reconciliationToken) app.post("/api/v1/internal/payments/reconcile", async (request, reply) => {
    if (request.headers["x-tutoria-reconciliation-token"] !== options.reconciliationToken) throw new ApiError(401, "UNAUTHORIZED", "Unauthorized.");
    const body = z.object({ merchantReference: z.string().trim().min(8).max(128) }).safeParse(request.body);
    if (!body.success) throw new ApiError(400, "RECONCILIATION_INVALID", "Reconciliation details are invalid.");
    const result = await options.service.reconcile(body.data.merchantReference);
    if (result.error) return reply.code(502).send({ ok: false, error: { code: "RECONCILIATION_UNKNOWN", message: "Provider state could not be reconciled." } });
    return { ok: true, result: result.data };
  });
  if (options.reconciliationToken) app.post("/api/v1/internal/payments/refunds/execute", async (request, reply) => {
    if (request.headers["x-tutoria-reconciliation-token"] !== options.reconciliationToken) throw new ApiError(401, "UNAUTHORIZED", "Unauthorized.");
    const body = z.object({ refundId: z.string().uuid() }).safeParse(request.body);
    if (!body.success) throw new ApiError(400, "REFUND_EXECUTION_INVALID", "Refund execution details are invalid.");
    const result = await options.service.executeRefund(body.data.refundId);
    if (result.error) return reply.code(502).send({ ok: false, error: { code: "REFUND_EXECUTION_UNKNOWN", message: "Refund provider state requires reconciliation." } });
    return { ok: true, result: result.data };
  });
};
