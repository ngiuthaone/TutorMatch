import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/server-verify", () => ({
  isServerLiveMode: vi.fn(),
}));

import { isServerLiveMode } from "@/lib/auth/server-verify";

function validCourse() {
  return {
    slug: "intro-to-pottery",
    title: "Intro to Pottery",
    instructor: "Jo",
    category: "Arts & Crafts",
    lessons: 12,
    duration: "4h",
    rating: 4.8,
    students: 120,
    level: "Beginner",
    price: "Free",
    image: "https://picsum.photos/seed/pottery/1200/800",
    subtitle: "Shape clay into useful forms through short demonstrations.",
    reviewCount: 24,
    updated: "August 2026",
    language: "English",
    certificate: true,
    description: [
      "Pottery starts with the hands, then the wheel. Shape clay <script>alert(1)</script> into pots.",
    ],
    outcomes: ["Throw a centered bowl"],
    requirements: ["Apron"],
    faqs: [{ question: "Refund policy?", answer: "48 hours" }],
    curriculum: [{ title: "Centering", duration: "30 min", lessons: ["Pinch pots"] }],
    instructorRole: "Instructor",
    instructorBio: "Ceramics specialist",
    instructorImage: "https://picsum.photos/seed/instructor-jo/320/320",
    reviews: [{ name: "Mai", rating: 5, date: "July 2026", body: "Loved it", avatar: "https://example.com/mai.png" }],
  };
}

describe("POST /api/courses", () => {
  let tmpDir: string;
  let POST: typeof import("@/app/api/courses/route").POST;
  let GET: typeof import("@/app/api/courses/route").GET;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "tutoria-courses-"));
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
    const route = await import("@/app/api/courses/route");
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
      new NextRequest("http://localhost/api/courses", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  }

  it("returns 410 on POST in live mode", async () => {
    vi.mocked(isServerLiveMode).mockReturnValue(true);
    const response = await post(validCourse());
    expect(response.status).toBe(410);
    const body = (await response.json()) as { ok: boolean; error: { message: string } };
    expect(body.ok).toBe(false);
    expect(body.error.message).toBe(
      "Live mode: use POST /api/v1/courses or GET /api/v1/courses on the configured Tutoria API.",
    );
  });

  it("returns 410 on GET in live mode", async () => {
    vi.mocked(isServerLiveMode).mockReturnValue(true);
    const response = await GET();
    expect(response.status).toBe(410);
    const body = (await response.json()) as { ok: boolean; error: { message: string } };
    expect(body.ok).toBe(false);
    expect(body.error.message).toBe(
      "Live mode: use POST /api/v1/courses or GET /api/v1/courses on the configured Tutoria API.",
    );
  });

  it("serves stored courses via GET", async () => {
    vi.mocked(isServerLiveMode).mockReturnValue(false);
    const response = await GET();
    expect(response.status).toBe(200);
    const { courses } = (await response.json()) as { courses: unknown[] };
    expect(Array.isArray(courses)).toBe(true);
  });

  it("rejects an invalid slug with 400", async () => {
    vi.mocked(isServerLiveMode).mockReturnValue(false);
    const response = await post({ ...validCourse(), slug: "Not Valid Slug!" });
    expect(response.status).toBe(400);
  });

  it("rejects a missing title with 400", async () => {
    vi.mocked(isServerLiveMode).mockReturnValue(false);
    const response = await post({ ...validCourse(), title: "   " });
    expect(response.status).toBe(400);
  });

  it("rejects an oversized body with 413", async () => {
    vi.mocked(isServerLiveMode).mockReturnValue(false);
    const request = new NextRequest("http://localhost/api/courses", {
      method: "POST",
      headers: { "content-length": String(3 * 1024 * 1024) },
      body: JSON.stringify(validCourse()),
    });
    const response = await POST(request);
    expect(response.status).toBe(413);
  });

  it("publishes a valid course with 201 and sanitizes HTML", async () => {
    vi.mocked(isServerLiveMode).mockReturnValue(false);
    const response = await post(validCourse());
    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      ok: boolean;
      slug: string;
      status: string;
      course: { title: string; description: string[]; publishedAt: string };
    };
    expect(body.ok).toBe(true);
    expect(body.slug).toBe("intro-to-pottery");
    expect(body.status).toBe("published");
    expect(body.course.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const joined = body.course.description.join(" ");
    expect(joined).not.toMatch(/<script/i);
    expect(joined).not.toMatch(/javascript:/i);
  });
});
