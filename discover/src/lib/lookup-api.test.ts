import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./auth/session", () => ({ getSessionAccessToken: () => "access-token" }));
vi.mock("./auth/config", () => ({
  getApiBaseUrl: () => "http://api.example.test",
  NEXT_PUBLIC_TUTORIA_API_BASE_URL: "http://api.example.test",
}));

import { getLookupOptions } from "./lookup-api";

describe("lookup-api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("extracts unique languages, categories, levels from tutor data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      items: [
        { languages: [{ displayName: "English" }], subjects: ["Development"], levels: ["beginner"] },
        { languages: [{ displayName: "Vietnamese" }, { displayName: "English" }], subjects: ["Business", "Development"], levels: ["intermediate"] },
      ],
    }), { status: 200 })));
    const result = await getLookupOptions();
    expect(result.languages).toEqual(["English", "Vietnamese"]);
    expect(result.categories).toEqual(["Business", "Development"]);
    expect(result.levels).toEqual(["beginner", "intermediate"]);
  });

  it("falls back to defaults on non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false }), { status: 500 })));
    const result = await getLookupOptions();
    expect(result.languages).toHaveLength(11);
    expect(result.categories).toHaveLength(14);
    expect(result.levels).toHaveLength(4);
  });

  it("falls back to defaults on fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const result = await getLookupOptions();
    expect(result.levels).toEqual(["Beginner Level", "Intermediate Level", "Expert Level", "All Levels"]);
  });

  it("sends auth header when token exists", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, items: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await getLookupOptions();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/v1/tutors"), expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer access-token" }),
    }));
  });
});
