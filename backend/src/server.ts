import "dotenv/config";
import { createApp } from "./app.js";
import { parseEnvironment } from "./config/env.js";
import { createSupabaseAuthService } from "./lib/supabase.js";
import { createSupabaseTutorCvService } from "./services/tutor-cv-service.js";
import { createSupabaseBookingService } from "./services/booking-service.js";

async function main() {
  const config = parseEnvironment(process.env);
  const authService = createSupabaseAuthService(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
  const tutorCvService = createSupabaseTutorCvService(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
  const bookingService = createSupabaseBookingService(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
  const app = createApp({ config, authService, tutorCvService, bookingService, logger: {
    level: config.NODE_ENV === "production" ? "info" : "debug",
    redact: { paths: ["req.headers.authorization", "req.headers.cookie", "res.headers.set-cookie", "*.accessToken", "*.refreshToken", "*.password", "*.secretKey"], censor: "[REDACTED]" }
  } });
  const shutdown = async (signal: string) => { app.log.info({ signal }, "Shutting down"); await app.close(); };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  await app.listen({ host: config.HOST, port: config.PORT });
  app.log.info({ host: config.HOST, port: config.PORT }, "Tutoria API started");
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Backend startup failed"); process.exitCode = 1; });
