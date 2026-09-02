import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { ApiError } from "../errors/api-error.js";
import type { AuthService } from "../services/auth-service.js";
import type { HostCenterService } from "../services/host-center-service.js";

const noStore = async (_request: unknown, reply: any, payload: unknown) => {
  reply.header("Cache-Control", "no-store").header("Pragma", "no-cache");
  return payload;
};

function csvTransform(headers: string[]): Transform {
  let headerWritten = false;
  return new Transform({
    objectMode: true,
    transform(row: Record<string, unknown>, _enc, callback) {
      if (!headerWritten) {
        this.push(headers.join(",") + "\r\n");
        headerWritten = true;
      }
      const values = headers.map((h) => {
        const val = row[h] ?? "";
        const str = val instanceof Date ? val.toISOString() : String(val);
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      });
      this.push(values.join(",") + "\r\n");
      callback();
    },
  });
}

function streamCsv<T extends Record<string, unknown>>(
  reply: any,
  headers: string[],
  data: T[],
): void {
  const source = Readable.from(data);
  const csv = csvTransform(headers);
  reply.raw.writeHead(200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Cache-Control": "no-store",
    "Transfer-Encoding": "chunked",
  });
  void pipeline(source, csv, reply.raw as NodeJS.WritableStream).catch(() => {});
}

const offeringIdParam = z.object({ id: z.string().uuid() });

const offeringsQuerySchema = z.object({
  status: z.enum(["draft", "published", "unpublished"]).optional(),
  kind: z.enum(["tutor", "workshop", "class", "event"]).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const sessionsQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  offeringId: z.string().uuid().optional(),
  status: z.enum(["scheduled", "cancelled", "completed"]).optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const attendeesQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  offeringId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const earningsQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

const teamQuerySchema = z.object({
  offeringId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const promoCodesQuerySchema = z.object({
  offeringId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const checkInLogsQuerySchema = z.object({
  sessionId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const payoutFailuresQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const payoutStatementsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(48).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const checkInIssueSchema = z.object({ sessionId: z.string().uuid() });
const checkInRedeemSchema = z.object({ token: z.string().min(1).max(50) });
const checkInUndoSchema = z.object({ token: z.string().min(1).max(50) });

function failUnavailable(): never {
  throw new ApiError(503, "HOST_CENTER_UNAVAILABLE", "Tutoria Center is temporarily unavailable.");
}

export const hostCenterRoutes: FastifyPluginAsync<{
  authService: AuthService;
  service: HostCenterService;
  max: number;
  windowMs: number;
}> = async (app, options) => {
  app.get("/api/v1/host/dashboard", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
    onSend: noStore,
  }, async (request) => {
    const result = await options.service.getDashboard(request.auth.accessToken, request.auth.userId);
    if (result.status !== "ok") failUnavailable();
    return { ok: true, dashboard: result.data };
  });

  app.get("/api/v1/host/offerings", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
    onSend: noStore,
  }, async (request) => {
    const parsed = offeringsQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError(400, "INVALID_QUERY", "Invalid offerings query parameters.");
    const result = await options.service.listOfferings(request.auth.accessToken, request.auth.userId, {
      status: parsed.data.status,
      kind: parsed.data.kind,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
    if (result.status !== "ok") failUnavailable();
    return { ok: true, offerings: result.data };
  });

  app.get("/api/v1/host/offerings/:id", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
    onSend: noStore,
  }, async (request) => {
    const parsed = offeringIdParam.safeParse(request.params);
    if (!parsed.success) throw new ApiError(400, "INVALID_ID", "Offering id is invalid.");
    const result = await options.service.getOffering(request.auth.accessToken, request.auth.userId, parsed.data.id);
    if (result.status !== "ok") failUnavailable();
    return { ok: true, offering: result.data };
  });

  app.get("/api/v1/host/sessions", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
    onSend: noStore,
  }, async (request) => {
    const parsed = sessionsQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError(400, "INVALID_QUERY", "Invalid sessions query parameters.");
    const result = await options.service.listSessions(request.auth.accessToken, request.auth.userId, {
      from: parsed.data.from,
      to: parsed.data.to,
      offeringId: parsed.data.offeringId,
      status: parsed.data.status,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
    if (result.status !== "ok") failUnavailable();
    return { ok: true, sessions: result.data };
  });

  app.get("/api/v1/host/attendees", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
    onSend: noStore,
  }, async (request) => {
    const parsed = attendeesQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError(400, "INVALID_QUERY", "Invalid attendees query parameters.");
    const result = await options.service.listAttendees(request.auth.accessToken, request.auth.userId, {
      query: parsed.data.q,
      offeringId: parsed.data.offeringId,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
    if (result.status !== "ok") failUnavailable();
    return { ok: true, attendees: result.data };
  });

  app.get("/api/v1/host/earnings/export", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: 10, timeWindow: 60000 } },
  }, async (request, reply) => {
    const parsed = earningsQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError(400, "INVALID_QUERY", "Invalid earnings query parameters.");
    const result = await options.service.getEarnings(request.auth.accessToken, request.auth.userId, {
      from: parsed.data.from,
      to: parsed.data.to,
    });
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Service unavailable.");
    const { transactions = [] } = result.data;
    streamCsv(reply,
      ["Date", "Offering", "Amount (VND)", "Refunded (VND)", "Status"],
      transactions.map((t) => ({
        Date: t.occurredAt,
        Offering: t.offeringTitle ?? "",
        "Amount (VND)": t.amountVnd,
        "Refunded (VND)": t.refundedAmountVnd,
        Status: t.status,
      })),
    );
    return reply;
  });

  app.get("/api/v1/host/earnings", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
    onSend: noStore,
  }, async (request) => {
    const parsed = earningsQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError(400, "INVALID_QUERY", "Invalid earnings query parameters.");
    const result = await options.service.getEarnings(request.auth.accessToken, request.auth.userId, {
      from: parsed.data.from,
      to: parsed.data.to,
    });
    if (result.status !== "ok") failUnavailable();
    return { ok: true, earnings: result.data };
  });

  app.get("/api/v1/host/analytics", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
    onSend: noStore,
  }, async (request) => {
    const result = await options.service.getAnalytics(request.auth.accessToken, request.auth.userId);
    if (result.status !== "ok") failUnavailable();
    return { ok: true, analytics: result.data };
  });

  app.get("/api/v1/host/attendees/export", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: 10, timeWindow: 60000 } },
  }, async (request, reply) => {
    const parsed = attendeesQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError(400, "INVALID_QUERY", "Invalid attendees query parameters.");
    const result = await options.service.listAttendees(request.auth.accessToken, request.auth.userId, {
      query: parsed.data.q,
      offeringId: parsed.data.offeringId,
      limit: 10000,
      offset: 0,
    });
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Service unavailable.");
    streamCsv(reply,
      ["Name", "Email", "Total Bookings", "Lifetime Value (VND)", "Last Booking"],
      result.data.map((a) => ({
        Name: a.displayName,
        Email: a.learnerId,
        "Total Bookings": a.bookingsCount,
        "Lifetime Value (VND)": a.ltvVnd,
        "Last Booking": a.lastBookingAt ?? "",
      })),
    );
    return reply;
  });

  app.get("/api/v1/host/payout-summary", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
    onSend: noStore,
  }, async (request) => {
    const result = await options.service.getPayoutSummary(request.auth.accessToken, request.auth.userId);
    if (result.status !== "ok") failUnavailable();
    return { ok: true, ...result.data };
  });

  app.get("/api/v1/host/team", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
    onSend: noStore,
  }, async (request) => {
    const parsed = teamQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError(400, "INVALID_QUERY", "Invalid team query parameters.");
    const result = await options.service.listTeam(request.auth.accessToken, request.auth.userId, {
      offeringId: parsed.data.offeringId,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
    if (result.status !== "ok") failUnavailable();
    return { ok: true, team: result.data };
  });

  app.get("/api/v1/host/promotion-codes", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
    onSend: noStore,
  }, async (request) => {
    const parsed = promoCodesQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError(400, "INVALID_QUERY", "Invalid promotion codes query parameters.");
    const result = await options.service.listPromotionCodes(request.auth.accessToken, request.auth.userId, {
      offeringId: parsed.data.offeringId,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
    if (result.status !== "ok") failUnavailable();
    return { ok: true, promotionCodes: result.data };
  });

  app.post("/api/v1/host/check-in/issue", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: 30, timeWindow: 60000 } },
    onSend: noStore,
  }, async (request) => {
    const parsed = checkInIssueSchema.safeParse(request.body ?? {});
    if (!parsed.success) throw new ApiError(400, "INVALID_INPUT", "sessionId is required and must be a valid UUID.");
    const result = await options.service.issueCheckInToken(request.auth.accessToken, request.auth.userId, parsed.data.sessionId);
    if (result.status !== "ok") failUnavailable();
    return { ok: true, ...result.data };
  });

  app.post("/api/v1/host/check-in/redeem", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: 30, timeWindow: 60000 } },
    onSend: noStore,
  }, async (request) => {
    const parsed = checkInRedeemSchema.safeParse(request.body ?? {});
    if (!parsed.success) throw new ApiError(400, "INVALID_INPUT", "token is required.");
    const result = await options.service.redeemCheckInToken(request.auth.accessToken, request.auth.userId, parsed.data.token);
    if (result.status !== "ok") failUnavailable();
    return { ok: true, ...result.data };
  });

  app.post("/api/v1/host/check-in/undo", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: 10, timeWindow: 60000 } },
    onSend: noStore,
  }, async (request) => {
    const parsed = checkInUndoSchema.safeParse(request.body ?? {});
    if (!parsed.success) throw new ApiError(400, "INVALID_INPUT", "token is required.");
    const result = await options.service.undoCheckIn(request.auth.accessToken, request.auth.userId, parsed.data.token);
    if (result.status !== "ok") failUnavailable();
    return { ok: true, ...result.data };
  });

  app.get("/api/v1/host/check-in/logs", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
    onSend: noStore,
  }, async (request) => {
    const parsed = checkInLogsQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError(400, "INVALID_QUERY", "Invalid check-in logs query parameters.");
    const result = await options.service.listCheckInLogs(request.auth.accessToken, request.auth.userId, {
      sessionId: parsed.data.sessionId,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
    if (result.status !== "ok") failUnavailable();
    return { ok: true, logs: result.data };
  });

  app.get("/api/v1/host/payout-failures", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
    onSend: noStore,
  }, async (request) => {
    const parsed = payoutFailuresQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError(400, "INVALID_QUERY", "Invalid payout failures query parameters.");
    const result = await options.service.listPayoutFailures(request.auth.accessToken, request.auth.userId, {
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
    if (result.status !== "ok") failUnavailable();
    return { ok: true, failures: result.data.failures, hasMore: result.data.hasMore };
  });

  app.post("/api/v1/host/payout-failures/:id/retry", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: 20, timeWindow: 60000 } },
    onSend: noStore,
  }, async (request) => {
    const id = (request.params as any).id;
    if (!z.string().uuid().safeParse(id).success) throw new ApiError(400, "INVALID_INPUT", "failureId must be a valid UUID.");
    const result = await options.service.retryPayoutFailure(request.auth.accessToken, id);
    if (result.status !== "ok") failUnavailable();
    return { ok: true, ...result.data };
  });

  app.get("/api/v1/host/payout-statements", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: options.max, timeWindow: options.windowMs } },
    onSend: noStore,
  }, async (request) => {
    const parsed = payoutStatementsQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError(400, "INVALID_QUERY", "Invalid payout statements query parameters.");
    const result = await options.service.listPayoutStatements(request.auth.accessToken, request.auth.userId, {
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
    if (result.status !== "ok") failUnavailable();
    return { ok: true, statements: result.data.statements, hasMore: result.data.hasMore };
  });
};