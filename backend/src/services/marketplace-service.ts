import { createClient } from "@supabase/supabase-js";

export type MarketplaceKind = "course" | "event";
export type MarketplaceListing = { id: string; kind: MarketplaceKind; slug: string; title: string; creatorId: string; payload: Record<string, unknown>; publishedAt: string };
export type MarketplaceResult<T> = { status: "ok"; data: T } | { status: "conflict" | "unavailable" };

/** Uses the caller's JWT so Supabase RLS remains the ownership boundary. */
export function createSupabaseMarketplaceService(url: string, publishableKey: string) {
  const caller = (token?: string) => createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });

  return {
    async publish(token: string, creatorId: string, input: Omit<MarketplaceListing, "id" | "creatorId" | "publishedAt">): Promise<MarketplaceResult<MarketplaceListing>> {
      try {
        const { data, error } = await caller(token).from("marketplace_listings").upsert({
          kind: input.kind, slug: input.slug, title: input.title, creator_id: creatorId, payload: input.payload, status: "published", published_at: new Date().toISOString(),
        }, { onConflict: "kind,slug" }).select("id,kind,slug,title,creator_id,payload,published_at").single();
        if (error) return error.code === "23505" || error.code === "42501" ? { status: "conflict" } : { status: "unavailable" };
        return { status: "ok", data: { id: data.id, kind: data.kind, slug: data.slug, title: data.title, creatorId: data.creator_id, payload: data.payload, publishedAt: data.published_at } };
      } catch { return { status: "unavailable" }; }
    },
    async list(kind: MarketplaceKind): Promise<MarketplaceResult<MarketplaceListing[]>> {
      try {
        const { data, error } = await caller().from("marketplace_listings").select("id,kind,slug,title,creator_id,payload,published_at").eq("kind", kind).eq("status", "published").order("published_at", { ascending: false }).limit(100);
        if (error) return { status: "unavailable" };
        return { status: "ok", data: (data || []).map((item) => ({ id: item.id, kind: item.kind as MarketplaceKind, slug: item.slug, title: item.title, creatorId: item.creator_id, payload: item.payload as Record<string, unknown>, publishedAt: item.published_at })) };
      } catch { return { status: "unavailable" }; }
    },
  };
}
