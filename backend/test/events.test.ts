import { Writable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { testConfig } from "./helpers/config.js";
import { FakeAuthService } from "./helpers/fake-auth-service.js";
import { buildStoredConfig, normalizeRequestedSlug } from "../src/services/event-publication-service.js";

const userId = "11111111-1111-4111-8111-111111111111";
const token = "secret-token";
const apps: any[] = [];

const validEvent = {
  slug: "pottery-workshop",
  title: "Beginner Pottery Workshop",
  date: "Sunday, 19 Jul",
  time: "2:00 PM",
  duration: "3.5 hours",
  location: "Tay Ho, Ha Noi",
  type: "In person",
  price: "350,000 đ",
  capacity: 20,
  topic: "Creative arts",
  level: "Beginner",
  languages: ["Vietnamese", "English"],
  minimumAge: "12+",
  accessibility: "Wheelchair accessible",
  studioName: "ClaySpace Studio",
  address: "123 Ceramic Road",
  sessions: [{ id: "s1", date: "Sun 19 Jul", times: ["09:00 - 12:30"] }],
  about: ["Learn the foundations of hand-building."],
  note: "No experience required.",
  highlights: [{ title: "All materials included", description: "Clay and tools covered." }],
  learn: ["Shape a ceramic cup"],
  included: ["Clay", "Tools"],
  bring: ["Closed-toe shoes"],
  plan: [{ title: "Welcome", duration: "15 min", description: "Meet your host." }],
  faqs: [{ question: "Do I need experience?", answer: "No." }],
  galleryImage: "https://example.com/gallery/pottery-workshop.jpg",
  hostRole: "Ceramic artist",
  hostExperience: "8+ years",
  hostBio: "Experienced ceramics educator.",
  hostImage: "https://example.com/host/host.png",
  hostRecommendation: "98% recommend",
  beforeYouAttend: [{ title: "Minimum age", items: ["At least 12 years old."] }],
  cancellation: ["Cancel 24 hours before."],
  reviews: [{ name: "Linh", attended: "Attended 19 Jul", rating: 5, body: "Excellent.", avatar: "https://example.com/a.png" }],
  visibility: "Public",
};

function fakeEventService() {
  const service: any = { publishCalls: 0, getCalls: 0, lastArgs: null };
  service.publishEvent = async (token: string, input: unknown, user: unknown) => {
    service.publishCalls++;
    service.lastArgs = { token, input, user };
    return { status: "ok", data: { slug: "pottery-workshop", status: "published", offeringId: "offering-1", version: 2 } };
  };
  service.getPublicEventBySlug = async () => { service.getCalls++; return { status: "ok", data: { slug: "pottery-workshop", title: "Beginner Pottery Workshop", host: "Tutoria host", hostRole: "Tutoria host and educator", hostBio: "Bio", about: [] } }; };
  service.listPublicEvents = async () => { (service.listCalls = (service.listCalls ?? 0) + 1); return { status: "ok", data: { events: [{ slug: "pottery-workshop", title: "Beginner Pottery Workshop", host: "Thu Ha" }] } }; };
  return service;
}

function setup(service: any = fakeEventService(), authOverrides: Partial<FakeAuthService> = {}) {
  const auth = new FakeAuthService();
  auth.authentication = { status: "authenticated", user: { id: userId, email: null } };
  auth.profile = { status: "found", profile: { id: userId, role: "tutor", name: "Thu Ha", phone: null, avatar_url: "https://example.com/avatar.png", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" } };
  Object.assign(auth, authOverrides);
  const app = createApp({ config: testConfig, authService: auth, eventService: service });
  apps.push(app);
  return { app, service, auth };
}
afterEach(async () => Promise.all(apps.splice(0).map((a) => a.close())));

const publish = (app: any, body: unknown = validEvent, headers: Record<string, string> = { authorization: `Bearer ${token}` }) =>
  app.inject({ method: "POST", url: "/api/v1/events", headers, payload: body });

describe("events publication routes", () => {
  it("A1: rejects anonymous publish with 401 and does not invoke the service", async () => {
    const { app, service } = setup();
    const r = await app.inject({ method: "POST", url: "/api/v1/events", payload: validEvent });
    expect(r.statusCode).toBe(401);
    expect(service.publishCalls).toBe(0);
  });

  it("A2: rejects a garbage bearer token with 401 and never echoes the token", async () => {
    const { app, auth } = setup();
    auth.authentication = { status: "invalid" };
    const r = await publish(app, validEvent, { authorization: `Bearer garbage-token` });
    expect(r.statusCode).toBe(401);
    expect(JSON.stringify(r.json())).not.toContain("garbage-token");
  });

  it("A6: an invalid authentication result is a 401 without handler invocation", async () => {
    const { app, service, auth } = setup();
    auth.authentication = { status: "invalid" };
    const r = await publish(app);
    expect(r.statusCode).toBe(401);
    expect(service.publishCalls).toBe(0);
  });

  it("LD1: rejects invalid bodies with 400 and no service call", async () => {
    const { app, service } = setup();
    const r = await publish(app, { ...validEvent, title: "" });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe("EVENT_INVALID");
    expect(service.publishCalls).toBe(0);
  });

  it("LD1: rejects a malformed JSON body with 400 and no service call", async () => {
    const { app, service } = setup();
    const r = await publish(app, "{not-json" as unknown, { authorization: `Bearer ${token}`, "content-type": "application/json" });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe("INVALID_BODY");
    expect(service.publishCalls).toBe(0);
  });

  it("LD1: rejects an empty JSON body with 400 and no service call", async () => {
    const { app, service } = setup();
    const r = await publish(app, "" as unknown, { authorization: `Bearer ${token}`, "content-type": "application/json" });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe("INVALID_BODY");
    expect(service.publishCalls).toBe(0);
  });

  it("LD1: rejects a bad slug with 400 and no service call", async () => {
    const { app, service } = setup();
    const r = await publish(app, { ...validEvent, slug: "Bad Slug!" });
    expect(r.statusCode).toBe(400);
    expect(service.publishCalls).toBe(0);
  });

  it("LD2: returns 429 when the publish rate limit is exceeded", async () => {
    const { app, service, auth } = setup();
    auth.authentication = { status: "authenticated", user: { id: userId, email: null } };
    // EVENT_PUBLISH_RATE_LIMIT_MAX defaults to 10 in testConfig.
    let last = 0;
    for (let i = 0; i < 12; i += 1) last = (await publish(app)).statusCode;
    expect(last).toBe(429);
    // First 10 succeed, the 11th onward is blocked by the limiter before the service.
    expect(service.publishCalls).toBe(10);
  });

  it("LD4: accepts a realistic multi-photo event under the route cap", async () => {
    const { app, service } = setup();
    const realistic = {
      ...validEvent,
      galleryImage: `data:image/png;base64,${"A".repeat(340_000)}`,
      plan: [
        { title: "Welcome", duration: "15 min", description: "Meet your host.", image: `data:image/png;base64,${"A".repeat(340_000)}` },
        { title: "Hands on", duration: "2 h", description: "Shape your cup.", image: `data:image/png;base64,${"A".repeat(340_000)}` },
        { title: "Glazing", duration: "30 min", description: "Finish your piece.", image: `data:image/png;base64,${"A".repeat(340_000)}` },
      ],
    };
    const r = await publish(app, realistic);
    expect(r.statusCode).toBe(200);
    expect(service.publishCalls).toBe(1);
  });

  it("LD4: rejects an oversized body with 413 and no service call", async () => {
    const { app, service } = setup();
    const big = { ...validEvent, about: ["x".repeat(4_100_000)] };
    const r = await publish(app, big);
    expect(r.statusCode).toBe(413);
    expect(r.json().error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(service.publishCalls).toBe(0);
  });

  it("V4: a successful publish returns a status field and drops version", async () => {
    const { app } = setup();
    const r = await publish(app);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ slug: "pottery-workshop", status: "published", offeringId: "offering-1" });
    expect(r.json().version).toBeUndefined();
  });

  it("V1: visibility Public maps publish=true; Unlisted maps publish=false", async () => {
    const { app, service } = setup();

    await publish(app, { ...validEvent, visibility: "Public" });
    expect(service.lastArgs.input.publish).toBe(true);

    await publish(app, { ...validEvent, visibility: "Unlisted" });
    expect(service.lastArgs.input.publish).toBe(false);

    await publish(app, { ...validEvent, visibility: "Community only" });
    expect(service.lastArgs.input.publish).toBe(false);
  });

  it("H1: the route strips a client-supplied creatorId before it reaches the service", async () => {
    const { app, service } = setup();
    await publish(app, { ...validEvent, creatorId: "99999999-9999-4999-8999-999999999999", creatorEmail: "spoof@example.com" });
    expect(service.publishCalls).toBe(1);
    const config = service.lastArgs.input.config;
    expect(config.creatorId).toBeUndefined();
    expect(config.creatorEmail).toBeUndefined();
    expect(config.visibility).toBeUndefined();
  });

  it("R6: private/public GET marks the response no-store", async () => {
    const { app } = setup();
    const r = await app.inject({ method: "GET", url: "/api/v1/events/pottery-workshop" });
    expect(r.statusCode).toBe(200);
    expect(r.headers["cache-control"]).toBe("no-store");
  });

  it("R3: GET of an unknown slug returns 404 without invoking a publish", async () => {
    const { app, service } = setup();
    service.getPublicEventBySlug = async () => ({ status: "not_found" });
    const r = await app.inject({ method: "GET", url: "/api/v1/events/does-not-exist" });
    expect(r.statusCode).toBe(404);
    expect(r.json().error.code).toBe("NOT_FOUND");
    expect(service.publishCalls).toBe(0);
  });

  it("R6/R1: GET returns the public event shape with no testimonial/identity leaks from the service payload", async () => {
    const { app } = setup();
    const r = await app.inject({ method: "GET", url: "/api/v1/events/pottery-workshop" });
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(body.title).toBe("Beginner Pottery Workshop");
    expect(body.slug).toBe("pottery-workshop");
    expect(JSON.stringify(body)).not.toMatch(/creatorId|creator_id|offeringId|service_role/i);
  });

  it("F1: by-slug response strips phone and hostName keys", async () => {
    // Regression for the F1 finding: the DB read path (now driven by
    // public._event_public_strip_config) is the canonical defense-in-depth
    // stripper. The service contract is: the by-slug public read response
    // never includes phone, contactEmail, hostName, or other private contact
    // keys, even if a future writer stored them. This test pins the route's
    // pass-through contract: the service must surface the post-strip payload,
    // and the route must faithfully return it (no key re-leak).
    const { app, service } = setup();
    // Simulate the DB read after the canonical strip: identity/contact/host
    // override keys removed; public host display (host, hostRole, hostBio)
    // and form fields retained.
    service.getPublicEventBySlug = async () => {
      service.getCalls++;
      return {
        status: "ok",
        data: {
          slug: "pottery-workshop",
          title: "Beginner Pottery Workshop",
          host: "Thu Ha",
          hostRole: "Tutoria host and educator",
          hostBio: "Server-derived bio",
          topic: "Creative arts",
          level: "Beginner",
          // These keys were sent in the original client config; the DB
          // canonical strip (public._event_public_strip_config) removed them
          // before this payload was produced. They must not reappear in the
          // route response.
        },
      };
    };

    const r = await app.inject({ method: "GET", url: "/api/v1/events/pottery-workshop" });
    expect(r.statusCode).toBe(200);
    const body = r.json();

    // Public fields are present.
    expect(body.title).toBe("Beginner Pottery Workshop");
    expect(body.slug).toBe("pottery-workshop");
    expect(body.host).toBe("Thu Ha");
    expect(body.hostRole).toBe("Tutoria host and educator");
    expect(body.hostBio).toBe("Server-derived bio");

    // Stripped keys are absent.
    expect(body.phone).toBeUndefined();
    expect(body.hostName).toBeUndefined();
    expect(body.hostNameOverride).toBeUndefined();
    expect(body.contactEmail).toBeUndefined();
    expect(body.contactPhone).toBeUndefined();
    expect(body.phoneNumber).toBeUndefined();
    expect(body.hostPhone).toBeUndefined();
    expect(body.creatorId).toBeUndefined();
    expect(body.creatorEmail).toBeUndefined();
    expect(body.hostEmail).toBeUndefined();
    expect(body.hostId).toBeUndefined();

    // The serialized body must not contain the stripped key names.
    const json = JSON.stringify(body);
    expect(json).not.toMatch(/phone/i);
    expect(json).not.toMatch(/contactEmail/i);
    expect(json).not.toMatch(/hostName/i);
    expect(json).not.toMatch(/hostPhone/i);
  });

  it("L1/L2: GET /api/v1/events lists published public events and marks no-store", async () => {
    const { app, service } = setup();
    const r = await app.inject({ method: "GET", url: "/api/v1/events" });
    expect(r.statusCode).toBe(200);
    expect(r.headers["cache-control"]).toBe("no-store");
    expect(r.json()).toEqual({ events: [{ slug: "pottery-workshop", title: "Beginner Pottery Workshop", host: "Thu Ha" }] });
    // The list route, not the single-item route, was invoked.
    expect(service.listCalls ?? 0).toBe(1);
  });

  it("L5: GET /api/v1/events returns 503 when the list backend is unavailable", async () => {
    const { app, service } = setup();
    service.listPublicEvents = async () => ({ status: "unavailable" });
    const r = await app.inject({ method: "GET", url: "/api/v1/events" });
    expect(r.statusCode).toBe(503);
    expect(r.json().error.code).toBe("SERVICE_UNAVAILABLE");
  });

  // P3/B: image-validation hardening on POST /api/v1/events
  it("P3: rejects a base64 data:image URL exceeding 500KB raw bytes with 400 and no service call", async () => {
    const { app, service } = setup();
    // 700_000 b64 chars ~= 525KB raw bytes: over the 500KB cap. Stays under the 4MB body limit.
    const oversizeDataUrl = `data:image/png;base64,${ "A".repeat(700_000) }`;
    const r = await publish(app, { ...validEvent, image: oversizeDataUrl });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe("EVENT_INVALID");
    expect(service.publishCalls).toBe(0);
  });

  it("P3: rejects an https:// URL longer than 2KB with 400 and no service call", async () => {
    const { app, service } = setup();
    const longHttps = "https://example.com/" + "a".repeat(3 * 1024);
    const r = await publish(app, { ...validEvent, image: longHttps });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe("EVENT_INVALID");
    expect(service.publishCalls).toBe(0);
  });

  it("P3: accepts a valid data:image/...;base64 URL under 500KB (201)", async () => {
    const { app, service } = setup();
    // 400KB of base64 ~= 300KB of raw image bytes; well under the 500KB cap.
    const okDataUrl = `data:image/jpeg;base64,${ "A".repeat(400 * 1024) }`;
    const r = await publish(app, { ...validEvent, image: okDataUrl });
    expect(r.statusCode).toBe(200);
    expect(service.publishCalls).toBe(1);
  });

  it("P3: accepts a publish with no image at all (image is optional)", async () => {
    const { app, service } = setup();
    // validEvent has no top-level `image`; galleryImage/plan images remain valid https URLs.
    const r = await publish(app, validEvent);
    expect(r.statusCode).toBe(200);
    expect(service.publishCalls).toBe(1);
  });

  it("P3: rejects a config payload serialized above the whole-config cap with 400 and no service call", async () => {
    const { app, service } = setup();
    // 3.5MB serialized stays under the 4MB route body limit so the body parses, but exceeds the
    // 3MB whole-config cap and is rejected before the service runs.
    const bulky = { ...validEvent, about: ["x".repeat(3_500_000)] };
    const r = await publish(app, bulky);
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe("EVENT_INVALID");
    expect(service.publishCalls).toBe(0);
  });
});

describe("event publication service host derivation (H2)", () => {
  it("buildStoredConfig strips identity keys and derives host display from the profile path, ignoring client host spoof", () => {
    const config = buildStoredConfig(
      {
        title: "Pottery",
        about: ["Welcome"],
        creatorId: "99999999-9999-4999-8999-999999999999",
        creatorEmail: "spoof@example.com",
        hostEmail: "spoof@example.com",
        host: "Client Spoofed Host",
        creatorName: "Client Spoofed Name",
        hostRole: "Client Role",
        hostExperience: "Client Experience",
        hostBio: "Client Bio",
        hostRecommendation: "Client Rec",
      },
      { name: "Thu Ha", avatarUrl: "https://example.com/avatar.png", headline: "Ceramic artist", bio: "Teaches in Hanoi." },
    );
    // Identity/owner keys are gone.
    expect(config.creatorId).toBeUndefined();
    expect(config.creatorEmail).toBeUndefined();
    expect(config.hostEmail).toBeUndefined();
    // Host fields are derived from the profile, not the client.
    expect(config.host).toBe("Thu Ha");
    expect(config.creatorName).toBe("Thu Ha");
    expect(config.hostRole).toBe("Tutoria host and educator");
    expect(config.hostExperience).toBe("Ceramic artist");
    expect(config.hostBio).toBe("Teaches in Hanoi.");
    expect(config.hostRecommendation).toBe("New host");
    expect(config.hostImage).toBe("https://example.com/avatar.png");
    // Innocent payload fields survive.
    expect(config.title).toBe("Pottery");
  });

  it("buildStoredConfig applies short defaults when no profile/CV data is available", () => {
    const config = buildStoredConfig({ title: "Pottery" }, { name: "Tutoria host", avatarUrl: undefined, headline: undefined, bio: undefined });
    expect(config.host).toBe("Tutoria host");
    expect(config.hostExperience).toBeTruthy();
    expect(config.hostBio).toBeTruthy();
    expect(config.hostRecommendation).toBe("New host");
  });

  it("buildStoredConfig sanitizes injection-looking strings so they are stored inertly", () => {
    const config = buildStoredConfig(
      { about: ["<script>alert(1)</script>Hello"] },
      { name: "Host", avatarUrl: undefined, headline: undefined, bio: undefined },
    );
    expect(JSON.stringify(config)).not.toContain("<script>");
    expect(JSON.stringify(config)).toContain("Hello");
  });

  it("buildStoredConfig strips private contact data and client host display name (R5/H2)", () => {
    const config = buildStoredConfig(
      { title: "Pottery", phone: "0000000000", hostName: "Client Name", hostPhone: "111", creatorId: "99999999-9999-4999-8999-999999999999" },
      { name: "Thu Ha", avatarUrl: undefined, headline: undefined, bio: undefined },
    );
    expect(config.phone).toBeUndefined();
    expect(config.hostName).toBeUndefined();
    expect(config.hostPhone).toBeUndefined();
    expect(config.creatorId).toBeUndefined();
    expect(config.host).toBe("Thu Ha");
  });

  it("normalizeRequestedSlug lowercases and collapses to [a-z0-9-] (S1/S3)", () => {
    expect(normalizeRequestedSlug("My_Workshop_EVENT")).toBe("my-workshop-event");
    expect(normalizeRequestedSlug("  Hello World  ")).toBe("hello-world");
    expect(normalizeRequestedSlug("")).toBe("");
    expect(normalizeRequestedSlug("UPPER_CASE")).toBe("upper-case");
    expect(normalizeRequestedSlug("a".repeat(200)).length).toBeLessThanOrEqual(116);
  });
});
