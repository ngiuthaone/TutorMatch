import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ApiError } from "../errors/api-error.js";
import { verifyVnpayFields, normalizeVnpayOutcome, type VnpayConfig } from "../services/vnpay-adapter.js";
import type { PaymentService } from "../services/payment-service.js";

const startSchema = z.object({ bookingId: z.string().uuid(), idempotencyKey: z.string().trim().min(16).max(128) });
export const paymentRoutes: FastifyPluginAsync<{ service: PaymentService; vnpay: VnpayConfig; reconciliationToken: string | undefined }> = async (app, options) => {
  app.post("/api/v1/payments/start", { preHandler: app.authenticate }, async (request) => {
    const body = startSchema.safeParse(request.body); if (!body.success) throw new ApiError(400, "PAYMENT_INVALID", "Payment details are invalid.");
    const result = await options.service.start(request.auth.accessToken, body.data.bookingId, body.data.idempotencyKey);
    if (result.error) throw new ApiError(result.error.code === "42501" ? 403 : 400, "PAYMENT_START_REJECTED", result.error.message);
    return { ok: true, payment: result.data };
  });
  app.get("/api/v1/payments/:bookingId", { preHandler: app.authenticate }, async (request) => {
    const bookingId = z.string().uuid().safeParse((request.params as { bookingId?: unknown }).bookingId); if (!bookingId.success) throw new ApiError(404, "NOT_FOUND", "Payment not found.");
    const result = await options.service.read(request.auth.accessToken, bookingId.data); if (result.error) throw new ApiError(503, "PAYMENT_UNAVAILABLE", "Payment is temporarily unavailable.");
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
