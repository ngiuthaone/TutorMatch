import type { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  // Liveness probe - returns 200 without hitting any external dependencies
  app.get("/api/v1/health", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    return {
      ok: true,
      service: "tutoria-api",
      version: "v1",
      timestamp: new Date().toISOString(),
    };
  });

  // Readiness probe - checks Supabase connectivity
  app.get("/api/v1/health/ready", async (_request, reply) => {
    let databaseStatus: "ok" | "error" = "ok";

    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      if (!supabaseUrl) {
        databaseStatus = "error";
      } else {
        const response = await fetch(`${supabaseUrl}/rest/v1/`, {
          method: "HEAD",
          headers: { "apikey": process.env.SUPABASE_PUBLISHABLE_KEY || "" },
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok && response.status !== 401) {
          databaseStatus = "error";
        }
      }
    } catch {
      databaseStatus = "error";
    }

    const ok = databaseStatus === "ok";
    return reply.status(ok ? 200 : 503).send({
      ok,
      service: "tutoria-api",
      version: "v1",
      timestamp: new Date().toISOString(),
      database: databaseStatus,
    });
  });

  // Simple liveness probe (for k8s/load balancer)
  app.get("/health", async () => ({
    ok: true,
    timestamp: new Date().toISOString(),
  }));
};
