import type { FastifyPluginAsync } from "fastify";
import { sql } from "@/lib/db";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/v1/health", {
    schema: {
      response: {
        200: {
          type: "object",
          required: ["ok", "service", "version", "timestamp", "database"],
          properties: {
            ok: { const: true },
            service: { const: "tutoria-api" },
            version: { const: "v1" },
            timestamp: { type: "string", format: "date-time" },
            database: { const: "ok" }
          }
        },
        503: {
          type: "object",
          required: ["ok", "service", "version", "timestamp", "database"],
          properties: {
            ok: { const: false },
            service: { const: "tutoria-api" },
            version: { const: "v1" },
            timestamp: { type: "string", format: "date-time" },
            database: { const: "error" }
          }
        }
      }
    }
  }, async (_request, reply) => {
    reply.header("Cache-Control", "no-store");

    let databaseStatus: "ok" | "error" = "ok";

    try {
      await sql.query("SELECT 1");
    } catch {
      databaseStatus = "error";
    }

    const ok = databaseStatus === "ok";

    return {
      ok,
      service: "tutoria-api",
      version: "v1",
      timestamp: new Date().toISOString(),
      database: databaseStatus
    };
  });
};
