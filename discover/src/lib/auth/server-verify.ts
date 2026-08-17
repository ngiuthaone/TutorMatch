export interface VerifiedServerUser {
  id: string;
  email: string | null;
}

export class ServerConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServerConfigError";
  }
}

function serverLiveConfig() {
  const demoMode = process.env.NEXT_PUBLIC_TUTORIA_DEMO_MODE === "true";
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, "");
  const publishableKey = String(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "").trim();
  const inProduction = process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_TUTORIA_ENVIRONMENT === "production";
  const live = !demoMode && Boolean(supabaseUrl && publishableKey);
  if (inProduction && demoMode) {
    throw new ServerConfigError("Invalid Tutoria configuration: demoMode is forbidden in production.");
  }
  if (inProduction && !live) {
    throw new ServerConfigError("Invalid Tutoria configuration: missing Supabase config in production.");
  }
  return {
    live,
    supabaseUrl,
    publishableKey,
  };
}

export function isServerLiveMode(): boolean {
  return serverLiveConfig().live;
}

const tokenCache = new Map<string, { expiresAt: number; user: VerifiedServerUser | null }>();
const TOKEN_CACHE_MS = 60_000;

async function fetchSupabaseUser(token: string): Promise<VerifiedServerUser | null> {
  const { supabaseUrl, publishableKey } = serverLiveConfig();
  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Apikey: publishableKey,
      },
      cache: "no-store",
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const payload = (await response.json()) as { id?: unknown; email?: unknown } | null;
  if (!payload || typeof payload.id !== "string" || !payload.id) return null;
  return {
    id: payload.id,
    email: typeof payload.email === "string" && payload.email ? payload.email : null,
  };
}

/** Validates a Supabase access token via the Supabase Auth API, with a short server-side cache. */
export async function verifyBearerToken(token: string): Promise<VerifiedServerUser | null> {
  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached.user;
  const user = await fetchSupabaseUser(token);
  tokenCache.set(token, { expiresAt: Date.now() + TOKEN_CACHE_MS, user });
  return user;
}

/** Extracts a well-formed Bearer token from a request. */
export function bearerTokenFrom(request: Request): string | null {
  const header = request.headers.get("authorization") || "";
  const match = /^Bearer\s+([^\s]+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

/** Returns the verified user for a request, or null when unauthenticated. */
export async function verifyRequestUser(request: Request): Promise<VerifiedServerUser | null> {
  const token = bearerTokenFrom(request);
  if (!token) return null;
  return verifyBearerToken(token);
}