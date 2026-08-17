import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server-verify", () => ({
  isServerLiveMode: vi.fn(),
  verifyRequestUser: vi.fn(),
}));

import { isServerLiveMode, verifyRequestUser } from "@/lib/auth/server-verify";

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
      new Request("http://localhost/api/events", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  }

  function seedEvent(event: Record<string, unknown>) {
    writeFileSync(path.join(tmpDir, "data", "published-events.json"), JSON.stringify([event], null, 2));
  }

  it("rejects an invalid slug format", async () => {
    vi.mocked(isServerLiveMode).mockReturnValue(true);
    vi.mocked(verifyRequestUser).mockResolvedValue({ id: "u1", email: null });
    const response = await post({ ...validEvent(), slug: "bad slug!" });
    expect(response.status).toBe(400);
  });

  it("returns 401 for unauthenticated submissions in live mode", async () => {
    vi.mocked(isServerLiveMode).mockReturnValue(true);
    vi.mocked(verifyRequestUser).mockResolvedValue(null);
    const response = await post(validEvent());
    expect(response.status).toBe(401);
  });

  it("stores an event, overriding a client tampered creatorId", async () => {
    vi.mocked(isServerLiveMode).mockReturnValue(true);
    vi.mocked(verifyRequestUser).mockResolvedValue({ id: "u9", email: "host@example.com" });
    const response = await post({ ...validEvent(), creatorId: "tampered-owner" });
    expect(response.status).toBe(201);
    const { event } = (await response.json()) as { event: Record<string, unknown> };
    expect(event.creatorId).toBe("u9");
    expect(event.slug).toBe("clean-pottery");
    const stored = JSON.parse(readFileSync(path.join(tmpDir, "data", "published-events.json"), "utf8")) as Array<Record<string, unknown>>;
    expect((stored[0].about as string[])[0]).not.toContain("<script>");
  });

  it("rejects a slug already owned by another user", async () => {
    vi.mocked(isServerLiveMode).mockReturnValue(true);
    vi.mocked(verifyRequestUser).mockResolvedValue({ id: "attacker", email: null });
    seedEvent({
      ...validEvent(),
      slug: "clean-pottery",
      creatorId: "original-owner",
    });
    const response = await post(validEvent());
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("another user") });
  });

  it("rate limits event creation", async () => {
    vi.mocked(isServerLiveMode).mockReturnValue(true);
    vi.mocked(verifyRequestUser).mockResolvedValue({ id: "event-spammer", email: null });
    for (let counter = 0; counter < 10; counter += 1) {
      const response = await post({ ...validEvent(), slug: `event-${counter}` });
      expect(response.status).toBe(201);
    }
    const response = await post({ ...validEvent(), slug: "event-overflow" });
    expect(response.status).toBe(429);
  });

  it("serves stored events via GET", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const { events } = (await response.json()) as { events: unknown[] };
    expect(Array.isArray(events)).toBe(true);
  });
});
