import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getApiBaseUrlMock = vi.hoisted(() => vi.fn(() => "http://api.example.com"));

vi.mock("@/lib/auth/config", () => ({ getApiBaseUrl: getApiBaseUrlMock }));

import {
  getMarketplaceListing,
  type MarketplaceListing,
} from "@/lib/marketplace-api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("marketplace-api", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("getMarketplaceListing", () => {
    it("constructs the correct URL and parses course response", async () => {
      const listing: MarketplaceListing = {
        id: "listing-1",
        kind: "course",
        slug: "intro-to-python",
        title: "Intro to Python",
        creatorId: "creator-1",
        payload: {},
        publishedAt: "2026-08-01T00:00:00.000Z",
      };
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValue(jsonResponse({ ok: true, items: [listing] }));

      const result = await getMarketplaceListing("course", "intro-to-python");

      expect(result).toEqual(listing);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://api.example.com/api/v1/marketplace/course",
        expect.objectContaining({ cache: "no-store", headers: { Accept: "application/json" } }),
      );
    });

    it("returns null when response is not ok", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true, items: [] }, 404));

      const result = await getMarketplaceListing("event", "nonexistent");

      expect(result).toBeNull();
    });

    it("returns null when payload ok is false", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: false, items: [] }));

      const result = await getMarketplaceListing("course", "any-slug");

      expect(result).toBeNull();
    });

    it("returns null when items is not an array", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true, items: null }));

      const result = await getMarketplaceListing("event", "any-slug");

      expect(result).toBeNull();
    });

    it("returns null when listing with matching slug is not found", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true, items: [] }));

      const result = await getMarketplaceListing("course", "missing-slug");

      expect(result).toBeNull();
    });
  });
});
