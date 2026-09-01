import { describe, expect, it } from "vitest";

import type { EventDetail } from "@/lib/event-data";
import { computeRecommendations } from "@/lib/event-recommendations";

const event = (overrides: Partial<EventDetail> = {}): EventDetail => ({
  slug: "test",
  title: "Test",
  subtitle: "Sub",
  host: "Host A",
  location: "Hanoi",
  date: "Sat, 1 Jan 2028",
  time: "10:00",
  type: "In person",
  price: "100000 đ",
  attending: 1,
  capacity: 10,
  image: "",
  topic: "Cooking",
  level: "Beginner",
  rating: 0,
  reviewCount: 0,
  duration: "2 hours",
  languages: [],
  minimumAge: "16+",
  accessibility: "",
  studioName: "",
  address: "",
  sessions: [],
  spotsLeft: 1,
  about: [],
  note: "",
  highlights: [],
  learn: [],
  included: [],
  bring: [],
  plan: [],
  faqs: [],
  galleryImage: "",
  hostRole: "",
  hostExperience: "",
  hostBio: "",
  hostImage: "",
  hostRecommendation: "",
  beforeYouAttend: [],
  cancellation: [],
  reviews: [],
  ...overrides,
});

const NOW = new Date("2026-08-31T00:00:00.000Z");

describe("computeRecommendations scoring", () => {
  it("scores sameHost +100, sameCategory +50, titleOverlap +30 (cumulative)", () => {
    const candidates = [
      event({
        slug: "match-all",
        title: "Pizza Making Workshop",
        host: "Pizza 4P's",
        topic: "Cooking",
      }),
      event({ slug: "neutral", title: "Photography Walk", host: "Other Host", topic: "Photography" }),
    ];
    const recs = computeRecommendations({
      currentSlug: "pizza-workshop",
      currentHost: "Pizza 4P's",
      currentCategory: "Cooking",
      currentTitle: "Pizza 4P's Pizza-Making Workshop",
      candidates,
      now: NOW,
    });
    expect(recs.map((r) => r.slug)).toEqual(["match-all", "neutral"]);
    expect(recs[0].priority).toBe("host");
    expect(recs[1].priority).toBe("default");
  });

  it("returns top 6 candidates", () => {
    const candidates = Array.from({ length: 9 }, (_, i) =>
      event({ slug: `cand-${i}`, title: `Workshop ${i}` }),
    );
    const recs = computeRecommendations({
      currentSlug: "current",
      currentHost: "",
      currentCategory: "",
      currentTitle: "Different Title",
      candidates,
      now: NOW,
    });
    expect(recs).toHaveLength(6);
    expect(recs.map((r) => r.slug)).toEqual([
      "cand-0",
      "cand-1",
      "cand-2",
      "cand-3",
      "cand-4",
      "cand-5",
    ]);
  });

  it("excludes the current slug from the recommendations", () => {
    const candidates = [
      event({ slug: "self", title: "Self" }),
      event({ slug: "other", title: "Other" }),
    ];
    const recs = computeRecommendations({
      currentSlug: "self",
      currentHost: "",
      currentCategory: "",
      currentTitle: "X",
      candidates,
      now: NOW,
    });
    expect(recs.map((r) => r.slug)).toEqual(["other"]);
  });

  it("excludes past events", () => {
    const candidates = [
      event({ slug: "past", date: "1 Jan 2020", title: "Old Stuff" }),
      event({ slug: "future", date: "1 Aug 2027", title: "Future Event" }),
    ];
    const recs = computeRecommendations({
      currentSlug: "current",
      currentHost: "",
      currentCategory: "",
      currentTitle: "X",
      candidates,
      now: NOW,
    });
    expect(recs.map((r) => r.slug)).toEqual(["future"]);
  });

  it("treats rating as a tiebreaker only — most events tie at 0", () => {
    const candidates = [
      event({ slug: "a", title: "Same Title Match", rating: 0 }),
      event({ slug: "b", title: "Same Title Match", rating: 0 }),
    ];
    const recs = computeRecommendations({
      currentSlug: "self",
      currentHost: "",
      currentCategory: "",
      currentTitle: "Same Title Match",
      candidates,
      now: NOW,
    });
    expect(recs).toHaveLength(2);
    expect(recs[0].slug).toBe("a");
  });

  it("rating breaks ties only when scores are equal", () => {
    const candidates = [
      event({ slug: "low", title: "Same Title Match", rating: 3, date: "1 Aug 2027" }),
      event({ slug: "high", title: "Same Title Match", rating: 5, date: "1 Aug 2027" }),
    ];
    const recs = computeRecommendations({
      currentSlug: "self",
      currentHost: "",
      currentCategory: "",
      currentTitle: "Same Title Match",
      candidates,
      now: NOW,
    });
    expect(recs[0].slug).toBe("high");
    expect(recs[1].slug).toBe("low");
  });

  it("does not fabricate reviews or ratings — both default to 0", () => {
    const candidates = [
      event({ slug: "x", title: "Anything" }),
    ];
    const recs = computeRecommendations({
      currentSlug: "self",
      currentHost: "",
      currentCategory: "",
      currentTitle: "Anything",
      candidates,
      now: NOW,
    });
    expect(recs[0].reviewCount).toBe(0);
    expect(recs[0].rating).toBe(0);
  });

  it("reversibility: score ordering matches the approved +100/+50/+30 spec", () => {
    const candidates = [
      event({ slug: "title-only", title: "Pizza Workshop", host: "Z", topic: "Other" }),
      event({ slug: "host-only", title: "Generic Cooking", host: "Pizza 4P's", topic: "Other" }),
      event({ slug: "both", title: "Pizza Workshop", host: "Pizza 4P's", topic: "Other" }),
    ];
    const recs = computeRecommendations({
      currentSlug: "self",
      currentHost: "Pizza 4P's",
      currentCategory: "Other",
      currentTitle: "Pizza 4P's Pizza Workshop",
      candidates,
      now: NOW,
    });
    expect(recs.map((r) => r.slug)).toEqual(["both", "host-only", "title-only"]);
  });
});
