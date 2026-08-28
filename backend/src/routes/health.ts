import type { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/v1/health", {
    schema: { response: { 200: { type: "object", required: ["ok", "service", "version", "timestamp"], properties: {
      ok: { const: true }, service: { const: "tutoria-api" }, version: { const: "v1" }, timestamp: { type: "string", format: "date-time" }
    } } } }
  }, async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    return { ok: true, service: "tutoria-api", version: "v1", timestamp: new Date().toISOString() };
  });
};
