import { describe, expect, it } from "vitest";

import { toWorkshopData } from "@/lib/workshop-payload";

import type { EventDetail } from "@/lib/event-data";

const baseEvent = (overrides: Partial<EventDetail> = {}): EventDetail => ({
  slug: "test-workshop",
  title: "Test Workshop",
  subtitle: "A focused session",
  host: "Hoa",
  location: "Hanoi",
  date: "Sat, 1 Aug 2026",
  time: "14:00 - 18:00",
  type: "In person" as EventDetail["type"],
  price: "500000 đ",
  attending: 4,
  capacity: 12,
  image: "",
  topic: "Life skills",
  level: "Beginner",
  rating: 0,
  reviewCount: 0,
  duration: "120 minutes",
  languages: ["Vietnamese", "English"],
  minimumAge: "All ages",
  accessibility: "Contact the host for access details",
  studioName: "Hoa Studio",
  address: "12 Xuan Dieu, Tay Ho, Hanoi",
  sessions: [],
  spotsLeft: 8,
  about: ["A promised outcome."],
  note: "Please arrive 10 minutes early.",
  highlights: [],
  learn: ["One skill"],
  included: ["Materials"],
  bring: ["Curiosity"],
  plan: [],
  faqs: [],
  galleryImage: "",
  hostRole: "Facilitator",
  hostExperience: "3 years",
  hostBio: "Bio text.",
  hostImage: "",
  hostRecommendation: "New host",
  beforeYouAttend: [],
  cancellation: [],
  reviews: [],
  ...overrides,
});

describe("toWorkshopData date resolution", () => {
  it("keeps an explicit ISO dateKey on a session", () => {
    const data = toWorkshopData(baseEvent({
      sessions: [{ id: "s1", date: "1 Aug 2026", dateKey: "2026-08-01", times: ["14:00 - 18:00"] }],
    }));
    expect(data.schedule.sessions[0]?.dateKey).toBe("2026-08-01");
  });

  it("derives a dateKey from an English date label", () => {
    const data = toWorkshopData(baseEvent({
      sessions: [{ id: "s1", date: "Sun, 19 Jul 2026", times: ["09:00 - 12:30"] }],
    }));
    expect(data.schedule.sessions[0]?.dateKey).toBe("2026-07-19");
  });

  it("derives a dateKey from a Vietnamese date label", () => {
    const data = toWorkshopData(baseEvent({
      sessions: [{ id: "s1", date: "1 thg 8, 2026", times: ["14:00 - 18:00"] }],
    }));
    expect(data.schedule.sessions[0]?.dateKey).toBe("2026-08-01");
  });

  it("derives a dateKey from an ISO shorthand", () => {
    const data = toWorkshopData(baseEvent({
      sessions: [{ id: "s1", date: "2026-08-01", times: ["14:00 - 18:00"] }],
    }));
    expect(data.schedule.sessions[0]?.dateKey).toBe("2026-08-01");
  });

  it("leaves non-parseable sessions without a dateKey (recurring fallback)", () => {
    const data = toWorkshopData(baseEvent({
      sessions: [{ id: "s1", date: "Following week", times: ["14:00 - 18:00"] }],
    }));
    expect(data.schedule.sessions[0]?.dateKey).toBeUndefined();
  });
});

describe("toWorkshopData fidelity fields", () => {
  it("carries the real arrival note and timezone", () => {
    const data = toWorkshopData(baseEvent({ timezone: "Asia/Ho_Chi_Minh (GMT+7)" }));
    expect(data.location.note).toBe("Please arrive 10 minutes early.");
    expect(data.location.timezone).toBe("Asia/Ho_Chi_Minh (GMT+7)");
  });

  it("falls back to accessibility when the noted field is generic", () => {
    const data = toWorkshopData(baseEvent({ note: "Accessibility: No requirements specified." }));
    expect(data.location.note).toBe("Contact the host for access details");
  });

  it("emits before-you-attend checklists and facts", () => {
    const data = toWorkshopData(baseEvent({
      beforeYouAttend: [
        { title: "A respectful learning space", items: ["Arrive on time"] },
        { title: "Empty group", items: [] },
      ],
    }));
    expect(data.details.checklists).toEqual([{ title: "A respectful learning space", items: ["Arrive on time"] }]);
    expect(data.facts.format).toBe("In person");
    expect(data.facts.languages).toEqual(["Vietnamese", "English"]);
    expect(data.facts.minimumAge).toBe("All ages");
  });
});