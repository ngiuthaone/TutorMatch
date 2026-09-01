import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ApiError } from "../errors/api-error.js";
import type { AuthService } from "../services/auth-service.js";
import type { NotificationService } from "../services/notification-service.js";

const noStore = async (_request: unknown, reply: any, payload: unknown) => { reply.header("Cache-Control", "no-store"); return payload; };

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

const idParamSchema = z.string().uuid();

export const notificationRoutes: FastifyPluginAsync<{
  authService: AuthService;
  notificationService: NotificationService;
  readMax: number;
  windowMs: number;
}> = async (app, options) => {
  // List notifications.
  app.get("/api/v1/notifications", { preHandler: app.authenticate, config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError(400, "INVALID_QUERY", "Invalid query parameters.");
    const result = await options.notificationService.listNotifications(request.auth.accessToken, parsed.data.cursor ?? null, parsed.data.limit ?? 20);
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Notifications are temporarily unavailable.");
    return { notifications: result.data.notifications, nextCursor: result.data.nextCursor };
  });

  // Get unread count.
  app.get("/api/v1/notifications/unread-count", { preHandler: app.authenticate, config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const result = await options.notificationService.getUnreadCount(request.auth.accessToken);
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Notifications are temporarily unavailable.");
    return result.data;
  });

  // Mark notification as read.
  app.patch("/api/v1/notifications/:id/read", { preHandler: app.authenticate, config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Notification not found.");
    const result = await options.notificationService.markRead(request.auth.accessToken, parsed.data);
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Update failed.");
    return result.data;
  });

  // Mark all notifications as read.
  app.post("/api/v1/notifications/read-all", { preHandler: app.authenticate, config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const result = await options.notificationService.markAllRead(request.auth.accessToken);
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Update failed.");
    return result.data;
  });
};
