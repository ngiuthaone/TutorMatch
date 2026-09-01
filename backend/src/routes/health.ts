import type { FastifyPluginAsync } from "fastify";
import { createClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config/env.js";

type ReadyCheck = {
  ok: boolean;
  latencyMs?: number;
  error?: string;
};

const SUPABASE_AUTH_OPTIONS = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const;

async function pingDatabase(supabaseUrl: string, publishableKey: string): Promise<ReadyCheck> {
  const started = Date.now();
  try {
    const client = createClient(supabaseUrl, publishableKey, SUPABASE_AUTH_OPTIONS);
    const { error } = await client.from("profiles").select("id", { head: true, count: "exact" }).limit(1);
    if (error) return { ok: false, latencyMs: Date.now() - started, error: error.message };
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    return { ok: false, latencyMs: Date.now() - started, error: error instanceof Error ? error.message : "unknown" };
  }
}

async function pingStorage(supabaseUrl: string, publishableKey: string): Promise<ReadyCheck> {
  const started = Date.now();
  try {
    const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
      method: "GET",
      headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok && response.status !== 401 && response.status !== 403) {
      return { ok: false, latencyMs: Date.now() - started, error: `HTTP ${response.status}` };
    }
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    return { ok: false, latencyMs: Date.now() - started, error: error instanceof Error ? error.message : "unknown" };
  }
}

async function readWorkerHeartbeats(supabaseUrl: string, serviceRoleKey: string | undefined): Promise<{
  ok: boolean;
  workers: Array<{ workerId: string; lastRunAt: string; lastStatus: string; lastError: string | null; ageSeconds: number }>;
  error?: string;
}> {
  if (!serviceRoleKey) {
    return { ok: false, workers: [], error: "service role key not configured" };
  }
  try {
    const client = createClient(supabaseUrl, serviceRoleKey, SUPABASE_AUTH_OPTIONS);
    const { data, error } = await client.from("worker_heartbeats").select("worker_id, last_run_at, last_status, last_error");
    if (error) return { ok: false, workers: [], error: error.message };
    const now = Date.now();
    return {
      ok: true,
      workers: (data ?? []).map((row) => {
        const lastRunMs = new Date(row.last_run_at as string).getTime();
        return {
          workerId: row.worker_id as string,
          lastRunAt: row.last_run_at as string,
          lastStatus: row.last_status as string,
          lastError: (row.last_error as string | null) ?? null,
          ageSeconds: Number.isFinite(lastRunMs) ? Math.max(0, Math.floor((now - lastRunMs) / 1000)) : -1,
        };
      }),
    };
  } catch (error) {
    return { ok: false, workers: [], error: error instanceof Error ? error.message : "unknown" };
  }
}

export const healthRoutes: FastifyPluginAsync<{ config: AppConfig; requireAdmin?: (request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => Promise<void> }> = async (app, opts) => {
  const { config, requireAdmin } = opts;

  // Liveness probe - returns 200 without hitting any external dependencies.
  // No rate limit override: the global 100/min cap is enough for an
  // unauthenticated health endpoint that returns just a static shape.
  app.get("/api/v1/health", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    return {
      ok: true,
      service: "tutoria-api",
      version: "v1",
      timestamp: new Date().toISOString(),
    };
  });

  // Legacy shallow readiness probe - checks Supabase connectivity only.
  app.get("/api/v1/health/ready", {
    config: { rateLimit: { max: config.HEALTH_READYZ_RATE_LIMIT_MAX, timeWindow: config.RATE_LIMIT_WINDOW_MS } },
  }, async (_request, reply) => {
    let databaseStatus: "ok" | "error" = "ok";
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      if (!supabaseUrl) {
        databaseStatus = "error";
      } else {
        const response = await fetch(`${supabaseUrl}/rest/v1/`, {
          method: "HEAD",
          headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY || "" },
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok && response.status !== 401) databaseStatus = "error";
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

  // Deep readiness probe - pings DB and storage only. Worker heartbeats
  // are NOT exposed here; the public surface is sufficient to know
  // "is the service responsive?" Worker status is available to admins
  // via the auth-gated /api/v1/admin/workers/heartbeats endpoint (see
  // admin routes).
  app.get("/api/v1/readyz", {
    config: { rateLimit: { max: config.HEALTH_READYZ_RATE_LIMIT_MAX, timeWindow: config.RATE_LIMIT_WINDOW_MS } },
  }, async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    const [database, storage] = await Promise.all([
      pingDatabase(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY),
      pingStorage(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY),
    ]);
    const ok = database.ok && storage.ok;
    return reply.status(ok ? 200 : 503).send({
      ok,
      service: "tutoria-api",
      version: "v1",
      timestamp: new Date().toISOString(),
      checks: { database, storage },
    });
  });

  // Admin-only worker heartbeats surface. Returns last_run_at, last_status,
  // lastError, and a stale-worker list. Intentionally behind auth+admin
  // because lastError may contain sensitive error text (SQL fragments,
  // PII, internal paths) and reveals internal worker identities. Only
  // mounted when requireAdmin is wired (i.e. the server is configured for
  // admin routes). When the operator doesn't pass requireAdmin, the
  // endpoint is not registered at all — there's no public fallback.
  if (requireAdmin) {
    app.get("/api/v1/admin/workers/heartbeats", {
      preHandler: [app.authenticate, requireAdmin],
      config: { rateLimit: { max: config.RATE_LIMIT_MAX, timeWindow: config.RATE_LIMIT_WINDOW_MS } },
    }, async (_request, reply) => {
      reply.header("Cache-Control", "no-store");
      const workers = await readWorkerHeartbeats(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);
      const staleThresholdSeconds = 300;
      const staleWorkers = workers.workers.filter((w) => w.ageSeconds > staleThresholdSeconds).map((w) => w.workerId);
      const ok = workers.ok && staleWorkers.length === 0;
      return reply.status(ok ? 200 : 503).send({
        ok,
        timestamp: new Date().toISOString(),
        staleThresholdSeconds,
        staleWorkers,
        workers: workers.workers,
        error: workers.error,
      });
    });
  }

  // Simple liveness probe (for k8s/load balancer)
  app.get("/health", async () => ({
    ok: true,
    timestamp: new Date().toISOString(),
  }));
};
