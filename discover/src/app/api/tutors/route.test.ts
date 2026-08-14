import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server-verify", () => ({
  isServerLiveMode: vi.fn(),
  verifyRequestUser: vi.fn(),
}));

import { isServerLiveMode, verifyRequestUser } from "@/lib/auth/server-verify";

const VALID = {
  displayName: "Ada Lovelace",
  status: "pending_review",
  about: "Computer <script>alert(1)</script> pioneer.",
  city: "London",
  portfolioUrl: "https://example.com/ada",
  rates: { "60 min": 4500 },
  sessionLengths: [30, 60],
  languages: ["English (native)"],
};

describe("POST /api/tutors", () => {
  let tmpDir: string;
  let POST: typeof import("@/app/api/tutors/route").POST;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "tutoria-tutors-"));
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
    POST = (await import("@/app/api/tutors/route")).POST;
  });

  afterAll(() => {
    cwdSpy.mockRestore();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function seedStore(tutor: Record<string, unknown>) {
    writeFileSync(path.join(tmpDir, "data", "published-tutors.json"), JSON.stringify([tutor], null, 2));
  }

  function readStore(): Array<Record<string, unknown>> {
    return JSON.parse(readFileSync(path.join(tmpDir, "data", "published-tutors.json"), "utf8"));
  }

  function post(body: unknown, token?: string) {
    return POST(
      new Request("http://localhost/api/tutors", {
        method: "POST",
        body: JSON.stringify(body),
        headers: token ? { authorization: `Bearer ${token}` } : {},
      }),
    );
  }

  it("rejects an invalid JSON body", async () => {
    const response = await POST(new Request("http://localhost/api/tutors", { method: "POST", body: "{" }));
    expect(response.status).toBe(400);
  });

  it("rejects payloads missing required fields", async () => {
    vi.mocked(isServerLiveMode).mockReturnValue(true);
    vi.mocked(verifyRequestUser).mockResolvedValue({ id: "u1", email: null });
    const response = await post({ displayName: "", status: "unknown" });
    expect(response.status).toBe(400);
  });

  it("returns 401 for unauthenticated submissions in live mode", async () => {
    vi.mocked(isServerLiveMode).mockReturnValue(true);
    vi.mocked(verifyRequestUser).mockResolvedValue(null);
    const response = await post(VALID);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("Sign in") });
  });

  it("stores nothing for an unauthenticated attempt", async () => {
    vi.mocked(isServerLiveMode).mockReturnValue(true);
    vi.mocked(verifyRequestUser).mockResolvedValue(null);
    await post(VALID);
    expect(() => readFileSync(path.join(tmpDir, "data", "published-tutors.json"), "utf8")).toThrow();
  });

  it("creates a tutor and ignores a client-supplied creatorId", async () => {
    vi.mocked(isServerLiveMode).mockReturnValue(true);
    vi.mocked(verifyRequestUser).mockResolvedValue({ id: "u1", email: "ada@example.com" });
    const response = await post({ ...VALID, creatorId: "tampered-other-id" });
    expect(response.status).toBe(201);
    const { tutor } = (await response.json()) as { tutor: Record<string, unknown> };
    expect(tutor.creatorId).toBe("u1");
    expect(tutor.id).toBeTruthy();
    const stored = readStore()[0];
    expect(stored.creatorId).toBe("u1");
    expect(stored.about).not.toContain("<script>");
    expect(stored.about).toContain("pioneer");
  });

  it("refuses a display name already owned by another user", async () => {
    vi.mocked(isServerLiveMode).mockReturnValue(true);
    vi.mocked(verifyRequestUser).mockResolvedValue({ id: "u2", email: null });
    seedStore({ displayName: VALID.displayName, creatorId: "u1", status: "published", publishedAt: "x" });
    const response = await post(VALID);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("another user") });
  });

  it("allows re-submission by the same owner (upsert)", async () => {
    vi.mocked(isServerLiveMode).mockReturnValue(true);
    vi.mocked(verifyRequestUser).mockResolvedValue({ id: "u1", email: null });
    seedStore({ displayName: VALID.displayName, creatorId: "u1", status: "published", publishedAt: "x" });
    const response = await post(VALID);
    expect(response.status).toBe(201);
    expect(readStore().length).toBe(1);
  });

  it("rate limits creation per user", async () => {
    vi.mocked(isServerLiveMode).mockReturnValue(true);
    vi.mocked(verifyRequestUser).mockResolvedValue({ id: "rate-limited-user", email: null });
    for (let counter = 0; counter < 10; counter += 1) {
      const response = await post({ ...VALID, displayName: `Tutor ${counter}` });
      expect(response.status).toBe(201);
    }
    const response = await post({ ...VALID, displayName: "Tutor overflow" });
    expect(response.status).toBe(429);
  });

});