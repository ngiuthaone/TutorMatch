import type { FastifyInstance } from "fastify";
import { createClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config/env.js";

function publicClient(config: AppConfig) {
  return createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default async function tutorSearchRoutes(
  app: FastifyInstance,
  options: { config: AppConfig; max: number; windowMs: number },
) {
  const { config, max, windowMs } = options;
  const noStore = async (_request: unknown, reply: any, payload: unknown) => {
    reply.header("Cache-Control", "no-store");
    return payload;
  };

  app.get(
    "/api/v1/tutors/search",
    {
      config: { rateLimit: { max, timeWindow: windowMs } },
      onSend: noStore,
    },
    async (request, reply) => {
      const raw = request.query as { q?: unknown; limit?: unknown };
      const q = typeof raw.q === "string" ? raw.q.slice(0, 200) : "";
      const parsedLimit = Number(raw.limit);
      const limit = Number.isFinite(parsedLimit) ? parsedLimit : 24;

      const supabase = publicClient(config);
      const { data, error } = await supabase.rpc("search_tutors", {
        p_query: q,
        p_limit: limit,
      });
      if (error) {
        return reply.status(500).send({ error: error.message });
      }
      return reply.send({ tutors: data ?? [] });
    },
  );
}
