import { getApiBaseUrl } from "./auth/config";

export interface MarketplaceListing {
  id: string;
  kind: "course" | "event";
  slug: string;
  title: string;
  creatorId: string;
  payload: Record<string, unknown>;
  publishedAt: string;
}

/**
 * Fetch a published marketplace listing by kind and slug.
 * Returns the first matching listing, or null if not found.
 */
export async function getMarketplaceListing(
  kind: "course" | "event",
  slug: string,
): Promise<MarketplaceListing | null> {
  try {
    const base = getApiBaseUrl().replace(/\/$/, "");
    const response = await fetch(`${base}/api/v1/marketplace/${kind}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      ok?: boolean;
      items?: MarketplaceListing[];
    };
    if (payload.ok !== true || !Array.isArray(payload.items)) return null;
    return payload.items.find((item) => item.slug === slug) ?? null;
  } catch {
    return null;
  }
}
