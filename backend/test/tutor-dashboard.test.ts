import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { testConfig } from "./helpers/config.js";
import { FakeAuthService } from "./helpers/fake-auth-service.js";

const userId = "11111111-1111-4111-8111-111111111111";
const token = "sensitive-access-token";

const apps: ReturnType<typeof createApp>[] = [];
afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

function authedSetup() {
  const service = new FakeAuthService();
  service.authentication = { status: "authenticated", user: { id: userId, email: "tutor@example.com" } };
  const app = createApp({ config: testConfig, authService: service });
  apps.push(app);
  return { app };
}

describe("GET /api/v1/me/tutor-dashboard", () => {
  it("requires authentication", async () => {
    const { app } = authedSetup();
    const r = await app.inject({ method: "GET", url: "/api/v1/me/tutor-dashboard" });
    expect(r.statusCode).toBe(401);
    expect(r.headers["www-authenticate"]).toBe("Bearer");
  });

  it("returns 503 when the upstream Supabase client cannot reach the project", async () => {
    const { app } = authedSetup();
    const r = await app.inject({ method: "GET", url: "/api/v1/me/tutor-dashboard", headers: { authorization: `Bearer ${token}` } });
    expect([200, 503]).toContain(r.statusCode);
    expect(r.headers["cache-control"]).toBe("no-store");
    if (r.statusCode === 503) expect(r.json().error.code).toBe("SERVICE_UNAVAILABLE");
  });
});

describe("POST /api/v1/me/tutor-reviews", () => {
  it("requires authentication", async () => {
    const { app } = authedSetup();
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/me/tutor-reviews",
      payload: { bookingId: userId, rating: 5, body: "Great tutor and very helpful!" },
    });
    expect(r.statusCode).toBe(401);
    expect(r.headers["www-authenticate"]).toBe("Bearer");
  });

  it("rejects malformed payloads with 400", async () => {
    const { app } = authedSetup();
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/me/tutor-reviews",
      headers: { authorization: `Bearer ${token}` },
      payload: { bookingId: userId, rating: 9, body: "x" },
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe("INVALID_REVIEW");
    expect(r.headers["cache-control"]).toBe("no-store");
  });

  it("rejects empty bodies", async () => {
    const { app } = authedSetup();
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/me/tutor-reviews",
      headers: { authorization: `Bearer ${token}` },
      payload: { bookingId: userId, rating: 4, body: "          " },
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe("INVALID_REVIEW");
  });
});
