import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AuthService } from "./auth-service.js";

/**
 * Defense-in-depth text sanitizer (bounded port of the discover `sanitizeTree`
 * spirit). The DB is the authority and the payload is display-only, but this
 * runs as the service's primary sanitizer before anything is persisted so
 * injection-looking strings are stored inertly and never execute.
 */
const UNSAFE_BLOCK = /<\s*(script|iframe|object|embed|frame|meta|link|base|form)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const UNSAFE_TAGS = /<\s*\/?(?:script|iframe|object|embed|frame|meta|link|base|form)\b[^>]*>/gi;
const EVENT_HANDLER_ATTR = /\s+on[a-z][a-z0-9_-]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const DANGEROUS_PROTOCOLS = /\b(?:javascript|vbscript|data):/gi;

export function sanitizeHtmlText(value: string): string {
  let result = String(value || "");
  if (result.length > 100_000) result = result.slice(0, 100_000);
  result = result.replace(UNSAFE_BLOCK, "");
  result = result.replace(UNSAFE_TAGS, "");
  result = result.replace(EVENT_HANDLER_ATTR, "");
  result = result.replace(DANGEROUS_PROTOCOLS, "");
  return result.trim();
}

export function sanitizeTree(value: unknown): unknown {
  if (typeof value === "string") return sanitizeHtmlText(value);
  if (Array.isArray(value)) return value.map(sanitizeTree);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = sanitizeTree(item);
    return out;
  }
  return value;
}

/** Identity/owner keys that must never come from the client (H1/H4). */
const STRIPPED_KEYS = [
  "creatorId", "creatorEmail", "hostEmail", "hostId", "authId", "creatorUserId",
  "creator_id", "creator_email", "host_email", "host_id", "auth_id", "creator",
  // Private contact data (R5) and client-supplied host display name/contact that
  // must never reach the public read; the server derives host identity (H2).
  "phone", "phoneNumber", "contactPhone", "hostPhone",
  "hostName", "hostNameOverride",
];

/**
 * Normalize a client-requested slug before it reaches the DB. The additive
 * migration's own normalization treats uppercase [A-Z] as *invalid* slug chars
 * (they become '-' instead of being lowercased), which drops letters like
 * `My_Workshop` -> `y-orkshop`. The service is the primary author (D4/S3), so
 * we lowercase first (and collapse non-alphanumerics) so the DB sees only
 * [a-z0-9-] and produces the intended slug. This keeps the locked migration
 * untouched while honoring the observable contract (uppercase -> lowercase,
 * underscores/spaces -> '-', returned slug = stored slug, satisfies CHECK).
 */
export function normalizeRequestedSlug(raw: unknown): string {
  const s = String(raw ?? "").toLowerCase();
  const slug = s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug.slice(0, 116); // reserve room for the DB's deterministic 4-char suffix
}

export type EventPublicationResult =
  | { status: "ok"; data: { slug: string; status: string; offeringId: string; version: number } }
  | { status: "not_found" }
  | { status: "invalid"; code: "EMAIL_VERIFICATION_REQUIRED" | "SLUG_EXHAUSTED" | "INVALID_SLUG" | "INVALID_TRANSITION" | "FORBIDDEN" }
  | { status: "unavailable" };

export type PublicEventPayload = Record<string, unknown> & { slug: string; title: string };

export type PublicEventResult =
  | { status: "ok"; data: PublicEventPayload }
  | { status: "not_found" }
  | { status: "unavailable" };

export type PublicEventListResult =
  | { status: "ok"; data: { events: PublicEventPayload[] } }
  | { status: "unavailable" };

interface PublishInput {
  requestedSlug: string;
  title: string;
  config: Record<string, unknown>;
  publish: boolean;
}

const DEFAULT_HOST_ROOT = "Tutoria host and educator";
const DEFAULT_HOST_RECOMMENDATION = "New host";
const DEFAULT_HOST_EXPERIENCE = "Passionate about teaching and guiding first-time participants.";
const DEFAULT_HOST_BIO = "An enthusiastic Tutoria host creating welcoming, practical learning experiences.";

function stripIdentityKeys(config: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (STRIPPED_KEYS.includes(key)) continue;
    out[key] = value;
  }
  return out;
}

/**
 * Server-side host identity derivation (D5/H2). Host display data is derived
 * from the verified user's profile (name / avatar) and optional tutor CV
 * (headline / bio), never from any client-supplied host field. The DB gate
 * (`assert_verified_booking_caller`) is the authority for who the caller is;
 * this is purely display derivation.
 */
async function deriveHostIdentity(token: string, userId: string, _email: string | null, authService: AuthService, cvClient: SupabaseClient) {
  let name = "Tutoria host";
  let avatarUrl: string | undefined;
  let headline: string | undefined;
  let bio: string | undefined;

  const profileResult = await authService.getOwnProfile(token, userId);
  if (profileResult.status === "found") {
    if (profileResult.profile.name) name = profileResult.profile.name.trim();
    if (profileResult.profile.avatar_url) avatarUrl = profileResult.profile.avatar_url;
  }

  // Best-effort tutor CV lookup for headline/bio. Only tutors have a CV row;
  // failures (non-tutor, no row) are ignored and the short defaults are used.
  try {
    const { data, error } = await cvClient.rpc("get_my_tutor_cv");
    if (!error && data && typeof data === "object") {
      const cv = data as { headline?: string | null; bio?: string | null };
      if (cv.headline) headline = cv.headline;
      if (cv.bio) bio = cv.bio;
    }
  } catch {
    // ignore
  }

  return { name, avatarUrl, headline, bio };
}

export function buildStoredConfig(
  inputConfig: Record<string, unknown>,
  host: { name: string; avatarUrl: string | undefined; headline: string | undefined; bio: string | undefined },
): Record<string, unknown> {
  // Sanitize user-controlled strings, then strip identity keys (primary sanitizer).
  const cleaned = sanitizeTree(inputConfig) as Record<string, unknown>;
  return {
    ...stripIdentityKeys(cleaned),
    host: host.name,
    creatorName: host.name,
    hostImage: host.avatarUrl,
    hostRole: DEFAULT_HOST_ROOT,
    hostExperience: host.headline ?? DEFAULT_HOST_EXPERIENCE,
    hostBio: host.bio ?? DEFAULT_HOST_BIO,
    hostRecommendation: DEFAULT_HOST_RECOMMENDATION,
  };
}

/** Uses the caller's JWT so Supabase RLS / security-definer RPC gates are the ownership boundary. */
export function createSupabaseEventPublicationService(url: string, publishableKey: string, authService: AuthService) {
  const caller = (token?: string) => createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });

  function mapCreateError(error: { code?: string; message?: string } | null): EventPublicationResult {
    const code = error?.code ?? "";
    const message = error?.message ?? "";
    if (code === "P0001" || message.includes("EMAIL_VERIFICATION_REQUIRED")) {
      return { status: "invalid", code: "EMAIL_VERIFICATION_REQUIRED" };
    }
    if (code === "42501" || message.includes("permission denied")) {
      return { status: "invalid", code: "FORBIDDEN" };
    }
    if (message.includes("SLUG_EXHAUSTED")) return { status: "invalid", code: "SLUG_EXHAUSTED" };
    if (message.includes("INVALID_SLUG")) return { status: "invalid", code: "INVALID_SLUG" };
    if (message.includes("INVALID_TRANSITION")) return { status: "invalid", code: "INVALID_TRANSITION" };
    return { status: "unavailable" };
  }

  return {
    async publishEvent(token: string, input: PublishInput, user: { userId: string; email: string | null }): Promise<EventPublicationResult> {
      try {
        const client = caller(token);
        // Derive host display data server-side; client host/identity keys are never authoritative.
        const host = await deriveHostIdentity(token, user.userId, user.email, authService, client);
        const config = buildStoredConfig(input.config, host);
        const requestedSlug = normalizeRequestedSlug(input.requestedSlug);

        const { data, error } = await client.rpc("create_tutoria_event", {
          p_requested_slug: requestedSlug,
          p_title: input.title,
          p_config: config,
          p_publish: input.publish,
        });
        if (error) return mapCreateError(error);
        if (!data || typeof data !== "object") return { status: "unavailable" };
        const row = data as {
          slug?: string;
          publication_status?: string;
          id?: string;
          version?: number;
        };
        return {
          status: "ok",
          data: {
            slug: String(row.slug ?? requestedSlug),
            status: String(row.publication_status ?? "draft"),
            offeringId: String(row.id ?? ""),
            version: row.version ?? 1,
          },
        };
      } catch {
        return { status: "unavailable" };
      }
    },
    async getPublicEventBySlug(slug: string): Promise<PublicEventResult> {
      try {
        const { data, error } = await caller().rpc("get_public_event_by_slug", { p_slug: slug });
        if (error) return { status: "unavailable" };
        if (!data || typeof data !== "object") return { status: "not_found" };
        const row = data as {
          id?: string;
          slug?: string;
          kind?: string;
          title?: string;
          description?: string | null;
          publication_status?: string;
          version?: number;
          published_at?: string | null;
          updated_at?: string | null;
          config?: Record<string, unknown> | null;
        };
        // Never surface `id` (offering id) or publication status to the public body.
        const config = (row.config as Record<string, unknown> | null) ?? {};
        const payload: PublicEventPayload = { ...config, slug: String(row.slug ?? slug), title: String(row.title ?? "") };
        return { status: "ok", data: payload };
      } catch {
        return { status: "unavailable" };
      }
    },
    async listPublicEvents(): Promise<PublicEventListResult> {
      try {
        const { data, error } = await caller().rpc("list_public_events");
        if (error) return { status: "unavailable" };
        if (!Array.isArray(data)) return { status: "unavailable" };
        const events: PublicEventPayload[] = data
          .map((row) => {
            if (!row || typeof row !== "object") return null;
            const item = row as { slug?: unknown; title?: unknown; config?: Record<string, unknown> | null };
            const config = (item.config as Record<string, unknown> | null) ?? {};
            return {
              ...config,
              slug: String(item.slug ?? ""),
              title: String(item.title ?? ""),
            };
          })
          .filter((e): e is PublicEventPayload => e !== null && e.slug !== "");
        return { status: "ok", data: { events } };
      } catch {
        return { status: "unavailable" };
      }
    },
  };
}

export type EventPublicationService = ReturnType<typeof createSupabaseEventPublicationService>;
