import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { logServiceError } from "../lib/service-error.js";

/**
 * Defense-in-depth text sanitizer (mirror of the events service). The DB is the
 * authority and the payload is display-only, but this runs as the service's
 * primary sanitizer before anything is persisted so injection-looking strings
 * are stored inertly and never execute.
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

/** Identity/owner keys that must never come from the client (R5/L3). */
const STRIPPED_KEYS = [
  "creatorId", "creatorEmail", "hostEmail", "hostId", "authId", "creatorUserId",
  "creator_id", "creator_email", "host_email", "host_id", "auth_id", "creator",
  "phone", "phoneNumber", "contactPhone", "hostPhone",
  "hostName", "hostNameOverride",
];

function stripIdentityKeys(config: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (STRIPPED_KEYS.includes(key)) continue;
    out[key] = value;
  }
  return out;
}

/** Sanitize user-controlled strings then strip identity keys (primary sanitizer). */
export function buildStoredPayload(inputConfig: Record<string, unknown>): Record<string, unknown> {
  const cleaned = sanitizeTree(inputConfig) as Record<string, unknown>;
  return stripIdentityKeys(cleaned);
}

export type MarketplaceKind = "course" | "event";
export type MarketplaceListing = { id: string; kind: MarketplaceKind; slug: string; title: string; creatorId: string; payload: Record<string, unknown>; publishedAt: string; status: string; version: number };
export type MarketplaceResult<T> = { status: "ok"; data: T } | { status: "conflict" | "unavailable" };
export type MarketplaceReadResult =
  | { status: "ok"; data: MarketplaceListing }
  | { status: "not_found" | "unavailable" };
export type MarketplaceUpdateResult =
  | { status: "ok"; data: MarketplaceListing }
  | { status: "not_found" | "conflict" | "forbidden" | "unavailable" };
export type MarketplaceUnpublishResult =
  | { status: "ok"; data: MarketplaceListing }
  | { status: "not_found" | "conflict" | "unavailable" };

export function mapRow(row: Record<string, unknown>, includeCreatorId = true): MarketplaceListing {
  return {
    id: row.id as string,
    kind: row.kind as MarketplaceKind,
    slug: row.slug as string,
    title: row.title as string,
    // Public reads never surface the creator's auth UID (AGENTS.md: public
    // tutor data must not expose auth IDs). Authed write paths keep it so the
    // creator still sees their own row. Matches the events surface, which does
    // not expose the owner identity on public reads.
    creatorId: includeCreatorId ? (row.creator_id as string) : "",
    payload: (row.payload as Record<string, unknown>) ?? {},
    publishedAt: (row.published_at as string) ?? "",
    status: (row.status as string) ?? "published",
    version: (row.version as number) ?? 1,
  };
}

/** Uses the caller's JWT so Supabase RLS remains the ownership boundary. */
export function createSupabaseMarketplaceService(
  url: string,
  publishableKey: string,
  clientFactory: (token?: string) => SupabaseClient = defaultClientFactory(url, publishableKey),
) {
  const caller = clientFactory;
  return {
    async publish(token: string, creatorId: string, input: Omit<MarketplaceListing, "id" | "creatorId" | "publishedAt" | "status" | "version">): Promise<MarketplaceResult<MarketplaceListing>> {
      try {
        // Sanitize + strip identity keys before persistence (R5/L3). creatorId
        // always comes from the JWT below, never from the client payload.
        const storedPayload = buildStoredPayload(input.payload);
        const { data, error } = await caller(token).from("marketplace_listings").upsert({
          kind: input.kind, slug: input.slug, title: input.title, creator_id: creatorId, payload: storedPayload, status: "published", published_at: new Date().toISOString(),
        }, { onConflict: "kind,slug" }).select("id,kind,slug,title,creator_id,payload,published_at,status,version").single();
        if (error) return error.code === "23505" || error.code === "42501" ? { status: "conflict" } : { status: "unavailable" };
        return { status: "ok", data: mapRow(data) };
      } catch (error) {
        logServiceError({ service: "marketplace-service", operation: "publish", error });
        return { status: "unavailable" };
      }
    },

    async getPublic(kind: MarketplaceKind, slug: string): Promise<MarketplaceReadResult> {
      try {
        const { data, error } = await caller().from("marketplace_listings")
          .select("id,kind,slug,title,creator_id,payload,published_at,status,version")
          .eq("kind", kind).eq("slug", slug).eq("status", "published").single();
        if (error || !data) return { status: "not_found" };
        return { status: "ok", data: mapRow(data, false) };
      } catch (error) {
        logServiceError({ service: "marketplace-service", operation: "getPublic", error });
        return { status: "unavailable" };
      }
    },

    async list(kind: MarketplaceKind): Promise<MarketplaceResult<MarketplaceListing[]>> {
      try {
        const { data, error } = await caller().from("marketplace_listings").select("id,kind,slug,title,creator_id,payload,published_at,status,version").eq("kind", kind).eq("status", "published").order("published_at", { ascending: false }).limit(100);
        if (error) return { status: "unavailable" };
        return { status: "ok", data: (data || []).map((row) => mapRow(row, false)) };
      } catch (error) {
        logServiceError({ service: "marketplace-service", operation: "list", error });
        return { status: "unavailable" };
      }
    },

    async update(token: string, kind: MarketplaceKind, slug: string, expectedVersion: number, patch: { title?: string; payload?: Record<string, unknown> }): Promise<MarketplaceUpdateResult> {
      try {
        // Read the current row first to distinguish "not found" from "stale version".
        const { data: existing, error: readError } = await caller(token).from("marketplace_listings")
          .select("id,kind,slug,title,creator_id,payload,published_at,status,version")
          .eq("kind", kind).eq("slug", slug).single();
        if (readError || !existing) return { status: "not_found" };
        if (Number(existing.version) !== expectedVersion) return { status: "conflict" };

        const update: Record<string, unknown> = { version: expectedVersion + 1 };
        if (patch.title !== undefined) update.title = patch.title;
        if (patch.payload !== undefined) update.payload = buildStoredPayload(patch.payload);
        const { data, error } = await caller(token).from("marketplace_listings")
          .update(update)
          .eq("kind", kind).eq("slug", slug).eq("version", expectedVersion)
          .select("id,kind,slug,title,creator_id,payload,published_at,status,version").single();
        // A 0-row conditional UPDATE returns PostgREST error PGRST116. The
        // read-first step above already distinguished not_found (read failed)
        // and pre-update conflict (version mismatch), so reaching here means
        // the caller's version was correct at read time but a concurrent
        // writer moved the row before our UPDATE landed — a genuine
        // compare-and-swap race. Surface it as conflict (route 409), not
        // unavailable (route 503). RLS-blocked writes are indistinguishable
        // from a CAS race at this layer, so they also map to conflict.
        if (error) {
          if (error.code === "PGRST116") return { status: "conflict" };
          return { status: "unavailable" };
        }
        if (!data) return { status: "conflict" };
        return { status: "ok", data: mapRow(data) };
      } catch (error) {
        logServiceError({ service: "marketplace-service", operation: "update", error });
        return { status: "unavailable" };
      }
    },

    async unpublish(token: string, kind: MarketplaceKind, slug: string): Promise<MarketplaceUnpublishResult> {
      try {
        const { data: existing, error: readError } = await caller(token).from("marketplace_listings")
          .select("id,kind,slug,title,creator_id,payload,published_at,status,version")
          .eq("kind", kind).eq("slug", slug).single();
        if (readError || !existing) return { status: "not_found" };
        if (existing.status !== "published") return { status: "not_found" };
        const nextVersion = Number(existing.version) + 1;
        const { data, error } = await caller(token).from("marketplace_listings")
          .update({ status: "unpublished", version: nextVersion })
          .eq("kind", kind).eq("slug", slug).eq("status", "published").eq("version", existing.version)
          .select("id,kind,slug,title,creator_id,payload,published_at,status,version").single();
        // See update() above: a 0-row conditional UPDATE returns PGRST116,
        // which here means a concurrent CAS race on the status/version guard.
        // The read-first step already distinguished not_found (row missing or
        // not published), so this is a genuine conflict (route 409).
        if (error) {
          if (error.code === "PGRST116") return { status: "conflict" };
          return { status: "unavailable" };
        }
        if (!data) return { status: "not_found" };
        return { status: "ok", data: mapRow(data) };
      } catch (error) {
        logServiceError({ service: "marketplace-service", operation: "unpublish", error });
        return { status: "unavailable" };
      }
    },
  };
}

function defaultClientFactory(url: string, publishableKey: string): (token?: string) => SupabaseClient {
  return (token?: string) => createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });
}
