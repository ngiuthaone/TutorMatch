import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ApiError } from "../errors/api-error.js";
import type { AuthService } from "../services/auth-service.js";
import type { SearchService } from "../services/search-service.js";

const noStore = async (_request: unknown, reply: any, payload: unknown) => { reply.header("Cache-Control", "no-store"); return payload; };

const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().positive().max(50).optional(),
  kind: z.enum(["all", "posts", "threads", "communities"]).optional(),
});

export const searchRoutes: FastifyPluginAsync<{
  authService: AuthService;
  searchService: SearchService;
  readMax: number;
  windowMs: number;
}> = async (app, options) => {
  app.get("/api/v1/search", { config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = searchQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError(400, "INVALID_QUERY", "Search query is required.");
    const result = await options.searchService.searchAll(parsed.data.q, parsed.data.limit ?? 20, parsed.data.kind ?? "all");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Search is temporarily unavailable.");
    return result.data;
  });
};
