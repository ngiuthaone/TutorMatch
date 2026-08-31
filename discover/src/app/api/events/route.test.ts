import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/server-verify", () => ({
  isServerLiveMode: vi.fn(),
}));

import { isServerLiveMode } from "@/lib/auth/server-verify";

function validEvent() {
  return {
    slug: "clean-pottery",
    title: "Intro to Pottery",
    date: "2026-08-20",
    time: "10:00",
    duration: "2 hours",
    location: "Studio 4",
    type: "In person",
    price: "$45",
    capacity: 8,
    topic: "Arts & Crafts",
    level: "Beginner",
    languages: ["English"],
    minimumAge: "14+",
    accessibility: "Step-free access",
    studioName: "Clay House",
    address: "12 Kiln Lane",
    sessions: [{ id: "s1", date: "2026-08-20", times: ["10:00"] }],
    about: ["Shape clay <script>alert(1)</script> into pots."],
    note: "All materials provided.",
    highlights: [{ title: "Small class", description: "Max 8 people" }],
    learn: ["Wheel throwing"],
    included: ["Clay", "Kiln firing"],
    bring: ["Apron"],
    plan: [{ title: "Warm up", duration: "15 min", description: "Handle the clay" }],
    faqs: [{ question: "Refund policy?", answer: "48 hours" }],
    hostRole: "Instructor",
    hostExperience: "10 years",
    hostBio: "Ceramics specialist",
    hostRecommendation: "Great for beginners",
    beforeYouAttend: [{ title: "Dress code", items: ["Comfortable shoes"] }],
    cancellation: ["48 hours notice"],
    reviews: [{ name: "Jo", attended: "2026-06-01", rating: 5, body: "Loved it", avatar: "https://example.com/jo.png" }],
    creatorName: "Jo",
  };
}

describe("POST /api/events", () => {
  let tmpDir: string;
  let POST: typeof import("@/app/api/events/route").POST;
  let GET: typeof import("@/app/api/events/route").GET;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "tutoria-events-"));
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
    const route = await import("@/app/api/events/route");
    POST = route.POST;
    GET = route.GET;
  });

  afterAll(() => {
    cwdSpy.mockRestore();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function post(body: unknown) {
    return POST(
      new NextRequest("http://localhost/api/events", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  }

  it("returns 410 on POST in live mode", async () => {
    vi.mocked(isServerLiveMode).mockReturnValue(true);
    const response = await post(validEvent());
    expect(response.status).toBe(410);
    const body = (await response.json()) as { ok: boolean; error: { message: string } };
    expect(body.ok).toBe(false);
    expect(body.error.message).toBe(
      "Live mode: use POST /api/v1/events or GET /api/v1/events on the configured Tutoria API.",
    );
  });

  it("returns 410 on GET in live mode", async () => {
    vi.mocked(isServerLiveMode).mockReturnValue(true);
    const response = await GET();
    expect(response.status).toBe(410);
    const body = (await response.json()) as { ok: boolean; error: { message: string } };
    expect(body.ok).toBe(false);
    expect(body.error.message).toBe(
      "Live mode: use POST /api/v1/events or GET /api/v1/events on the configured Tutoria API.",
    );
  });

  it("serves stored events via GET", async () => {
    vi.mocked(isServerLiveMode).mockReturnValue(false);
    const response = await GET();
    expect(response.status).toBe(200);
    const { events } = (await response.json()) as { events: unknown[] };
    expect(Array.isArray(events)).toBe(true);
  });
});
