import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as eventBookingApi from "./event-booking-api";

vi.mock("./auth/config", () => ({
  getApiBaseUrl: () => "http://localhost:4000",
}));

vi.mock("./auth/session", () => ({
  getSessionAccessToken: () => null,
}));

function mockFetch(response: unknown, ok = true) {
  return vi.spyOn(global, "fetch").mockResolvedValueOnce({
    ok,
    status: ok ? 200 : 400,
    json: () => Promise.resolve(response),
  } as unknown as Response);
}

describe("getEventOffering", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when API returns {ok: false}", async () => {
    mockFetch({ ok: false });
    const result = await eventBookingApi.getEventOffering("offering-1");
    expect(result).toBeNull();
  });

  it("returns null when API returns non-ok response", async () => {
    mockFetch({ ok: false, error: { code: "NOT_FOUND" } }, false);
    await expect(eventBookingApi.getEventOffering("offering-1")).rejects.toThrow("NOT_FOUND");
  });

  it("returns the offering when API returns {ok: true, offering: {...}}", async () => {
    const offering = {
      id: "offering-1",
      hostId: "host-1",
      offeringType: "event",
      title: "Test Event",
      description: "A test",
      pricingModel: "hourly_v1",
      pricePerParticipantVnd: null,
      hourlyRateVnd: 50000,
      currency: "VND",
      bookingMode: "approval",
      status: "published",
      version: 1,
    };
    mockFetch({ ok: true, offering });
    const result = await eventBookingApi.getEventOffering("offering-1");
    expect(result).toEqual(offering);
  });
});

describe("getEventSessions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty array when API returns non-ok", async () => {
    mockFetch({ ok: false });
    const result = await eventBookingApi.getEventSessions("offering-1");
    expect(result).toEqual([]);
  });

  it("returns sessions array when API returns {ok: true, sessions: [...]}", async () => {
    const sessions = [
      {
        id: "session-1",
        startsAt: "2026-09-01T10:00:00Z",
        endsAt: "2026-09-01T11:00:00Z",
        minParticipants: 1,
        maxParticipants: 10,
        spotsLeft: 8,
        status: "scheduled",
      },
    ];
    mockFetch({ ok: true, sessions });
    const result = await eventBookingApi.getEventSessions("offering-1");
    expect(result).toEqual(sessions);
  });
});

describe("listBookableEvents", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty array when sessions endpoint returns non-ok", async () => {
    mockFetch({ ok: false });
    const result = await eventBookingApi.listBookableEvents();
    expect(result).toEqual([]);
  });

  it("groups sessions by offeringId", async () => {
    const sessions = [
      {
        id: "session-1",
        offeringId: "offering-1",
        startsAt: "2026-09-01T10:00:00Z",
        endsAt: "2026-09-01T11:00:00Z",
        minParticipants: 1,
        maxParticipants: 10,
        spotsLeft: 8,
        status: "scheduled",
        tutor: { displayName: "John Tutor" },
      },
      {
        id: "session-2",
        offeringId: "offering-1",
        startsAt: "2026-09-01T12:00:00Z",
        endsAt: "2026-09-01T13:00:00Z",
        minParticipants: 1,
        maxParticipants: 10,
        spotsLeft: 10,
        status: "scheduled",
        tutor: { displayName: "John Tutor" },
      },
    ];
    mockFetch({ ok: true, sessions });

    const offering = {
      id: "offering-1",
      hostId: "host-1",
      offeringType: "event",
      title: "Test Event",
      description: null,
      pricingModel: "hourly_v1",
      pricePerParticipantVnd: null,
      hourlyRateVnd: 50000,
      currency: "VND",
      bookingMode: "approval",
      status: "published",
      version: 1,
    };
    mockFetch({ ok: true, offering });

    const result = await eventBookingApi.listBookableEvents();
    expect(result).toHaveLength(1);
    expect(result[0].sessions).toHaveLength(2);
    expect(result[0].sessions[0].id).toBe("session-1");
    expect(result[0].sessions[1].id).toBe("session-2");
  });

  it("filters out sessions without offeringId", async () => {
    const sessions = [
      {
        id: "session-1",
        startsAt: "2026-09-01T10:00:00Z",
        endsAt: "2026-09-01T11:00:00Z",
        status: "scheduled",
      },
    ];
    mockFetch({ ok: true, sessions });
    const result = await eventBookingApi.listBookableEvents();
    expect(result).toEqual([]);
  });

  it("filters out unpublished offerings", async () => {
    const sessions = [
      {
        id: "session-1",
        offeringId: "offering-1",
        startsAt: "2026-09-01T10:00:00Z",
        endsAt: "2026-09-01T11:00:00Z",
        minParticipants: 1,
        maxParticipants: 10,
        spotsLeft: 8,
        status: "scheduled",
        tutor: { displayName: "John Tutor" },
      },
    ];
    mockFetch({ ok: true, sessions });

    const offering = {
      id: "offering-1",
      hostId: "host-1",
      offeringType: "event",
      title: "Test Event",
      description: null,
      pricingModel: "hourly_v1",
      pricePerParticipantVnd: null,
      hourlyRateVnd: 50000,
      currency: "VND",
      bookingMode: "approval",
      status: "unpublished",
      version: 1,
    };
    mockFetch({ ok: true, offering });

    const result = await eventBookingApi.listBookableEvents();
    expect(result).toEqual([]);
  });

  it("filters out non-event and non-workshop offerings", async () => {
    const sessions = [
      {
        id: "session-1",
        offeringId: "offering-course",
        startsAt: "2026-09-01T10:00:00Z",
        endsAt: "2026-09-01T11:00:00Z",
        minParticipants: 1,
        maxParticipants: 10,
        spotsLeft: 8,
        status: "scheduled",
        tutor: { displayName: "Tutor" },
      },
      {
        id: "session-2",
        offeringId: "offering-event",
        startsAt: "2026-09-01T10:00:00Z",
        endsAt: "2026-09-01T11:00:00Z",
        minParticipants: 1,
        maxParticipants: 10,
        spotsLeft: 8,
        status: "scheduled",
        tutor: { displayName: "Tutor" },
      },
    ];
    mockFetch({ ok: true, sessions });

    const courseOffering = {
      id: "offering-course",
      hostId: "host-1",
      offeringType: "course",
      title: "Course",
      description: null,
      pricingModel: "hourly_v1",
      pricePerParticipantVnd: null,
      hourlyRateVnd: 50000,
      currency: "VND",
      bookingMode: "approval",
      status: "published",
      version: 1,
    };
    const eventOffering = {
      id: "offering-event",
      hostId: "host-1",
      offeringType: "event",
      title: "Event",
      description: null,
      pricingModel: "hourly_v1",
      pricePerParticipantVnd: null,
      hourlyRateVnd: 50000,
      currency: "VND",
      bookingMode: "approval",
      status: "published",
      version: 1,
    };
    mockFetch({ ok: true, offering: courseOffering });
    mockFetch({ ok: true, offering: eventOffering });

    const result = await eventBookingApi.listBookableEvents();
    expect(result).toHaveLength(1);
    expect(result[0].offering.offeringType).toBe("event");
  });

  it("returns host display name from tutor object", async () => {
    const sessions = [
      {
        id: "session-1",
        offeringId: "offering-1",
        startsAt: "2026-09-01T10:00:00Z",
        endsAt: "2026-09-01T11:00:00Z",
        minParticipants: 1,
        maxParticipants: 10,
        spotsLeft: 8,
        status: "scheduled",
        tutor: { displayName: "Jane Doe" },
      },
    ];
    mockFetch({ ok: true, sessions });

    const offering = {
      id: "offering-1",
      hostId: "host-1",
      offeringType: "event",
      title: "Test Event",
      description: null,
      pricingModel: "hourly_v1",
      pricePerParticipantVnd: null,
      hourlyRateVnd: 50000,
      currency: "VND",
      bookingMode: "approval",
      status: "published",
      version: 1,
    };
    mockFetch({ ok: true, offering });

    const result = await eventBookingApi.listBookableEvents();
    expect(result[0].hostDisplayName).toBe("Jane Doe");
  });

  it("returns 'Host' as fallback when tutor is null", async () => {
    const sessions = [
      {
        id: "session-1",
        offeringId: "offering-1",
        startsAt: "2026-09-01T10:00:00Z",
        endsAt: "2026-09-01T11:00:00Z",
        minParticipants: 1,
        maxParticipants: 10,
        spotsLeft: 8,
        status: "scheduled",
        tutor: null,
      },
    ];
    mockFetch({ ok: true, sessions });

    const offering = {
      id: "offering-1",
      hostId: "host-1",
      offeringType: "event",
      title: "Test Event",
      description: null,
      pricingModel: "hourly_v1",
      pricePerParticipantVnd: null,
      hourlyRateVnd: 50000,
      currency: "VND",
      bookingMode: "approval",
      status: "published",
      version: 1,
    };
    mockFetch({ ok: true, offering });

    const result = await eventBookingApi.listBookableEvents();
    expect(result[0].hostDisplayName).toBe("Host");
  });
});

describe("isFreeEvent", () => {
  it("returns true when hourlyRateVnd is 0", () => {
    const offering: eventBookingApi.EventOffering = {
      id: "1",
      hostId: "host-1",
      offeringType: "event",
      title: "Free Event",
      description: null,
      pricingModel: "hourly_v1",
      pricePerParticipantVnd: null,
      hourlyRateVnd: 0,
      currency: "VND",
      bookingMode: "approval",
      status: "published",
      version: 1,
    };
    expect(eventBookingApi.isFreeEvent(offering)).toBe(true);
  });

  it("returns true when pricePerParticipantVnd is 0", () => {
    const offering: eventBookingApi.EventOffering = {
      id: "1",
      hostId: "host-1",
      offeringType: "workshop",
      title: "Free Workshop",
      description: null,
      pricingModel: "flat_per_participant_v1",
      pricePerParticipantVnd: 0,
      hourlyRateVnd: null,
      currency: "VND",
      bookingMode: "approval",
      status: "published",
      version: 1,
    };
    expect(eventBookingApi.isFreeEvent(offering)).toBe(true);
  });

  it("returns false when prices are set", () => {
    const offering: eventBookingApi.EventOffering = {
      id: "1",
      hostId: "host-1",
      offeringType: "event",
      title: "Paid Event",
      description: null,
      pricingModel: "hourly_v1",
      pricePerParticipantVnd: null,
      hourlyRateVnd: 50000,
      currency: "VND",
      bookingMode: "approval",
      status: "published",
      version: 1,
    };
    expect(eventBookingApi.isFreeEvent(offering)).toBe(false);
  });

  it("returns false for flat_per_participant with non-zero price", () => {
    const offering: eventBookingApi.EventOffering = {
      id: "1",
      hostId: "host-1",
      offeringType: "workshop",
      title: "Paid Workshop",
      description: null,
      pricingModel: "flat_per_participant_v1",
      pricePerParticipantVnd: 100000,
      hourlyRateVnd: null,
      currency: "VND",
      bookingMode: "approval",
      status: "published",
      version: 1,
    };
    expect(eventBookingApi.isFreeEvent(offering)).toBe(false);
  });
});

describe("formatEventPriceVnd", () => {
  it('returns "Free" for zero-price events', () => {
    const offering: eventBookingApi.EventOffering = {
      id: "1",
      hostId: "host-1",
      offeringType: "event",
      title: "Free Event",
      description: null,
      pricingModel: "hourly_v1",
      pricePerParticipantVnd: null,
      hourlyRateVnd: 0,
      currency: "VND",
      bookingMode: "approval",
      status: "published",
      version: 1,
    };
    expect(eventBookingApi.formatEventPriceVnd(offering)).toBe("Free");
  });

  it("returns formatted VND amount with đ symbol", () => {
    const offering: eventBookingApi.EventOffering = {
      id: "1",
      hostId: "host-1",
      offeringType: "event",
      title: "Paid Event",
      description: null,
      pricingModel: "hourly_v1",
      pricePerParticipantVnd: null,
      hourlyRateVnd: 150000,
      currency: "VND",
      bookingMode: "approval",
      status: "published",
      version: 1,
    };
    expect(eventBookingApi.formatEventPriceVnd(offering)).toBe("150.000 đ");
  });

  it("formats flat_per_participant price", () => {
    const offering: eventBookingApi.EventOffering = {
      id: "1",
      hostId: "host-1",
      offeringType: "workshop",
      title: "Workshop",
      description: null,
      pricingModel: "flat_per_participant_v1",
      pricePerParticipantVnd: 200000,
      hourlyRateVnd: null,
      currency: "VND",
      bookingMode: "approval",
      status: "published",
      version: 1,
    };
    expect(eventBookingApi.formatEventPriceVnd(offering)).toBe("200.000 đ");
  });
});

describe("formatDuration", () => {
  it("returns minutes for < 60 min", () => {
    const result = eventBookingApi.formatDuration(
      "2026-09-01T10:00:00Z",
      "2026-09-01T10:30:00Z",
    );
    expect(result).toBe("30 min");
  });

  it("returns hours for 60+ min", () => {
    const result = eventBookingApi.formatDuration(
      "2026-09-01T10:00:00Z",
      "2026-09-01T11:00:00Z",
    );
    expect(result).toBe("1h");
  });

  it("returns hours + minutes for non-round hours", () => {
    const result = eventBookingApi.formatDuration(
      "2026-09-01T10:00:00Z",
      "2026-09-01T11:30:00Z",
    );
    expect(result).toBe("1h 30m");
  });

  it("returns hours + minutes for 90 minutes", () => {
    const result = eventBookingApi.formatDuration(
      "2026-09-01T10:00:00Z",
      "2026-09-01T11:30:00Z",
    );
    expect(result).toBe("1h 30m");
  });
});

describe("formatDateShort", () => {
  it("formats ISO date string to short date format", () => {
    const result = eventBookingApi.formatDateShort("2026-09-01T10:00:00Z");
    expect(result).toMatch(/Sep/);
    expect(result).toMatch(/1/);
  });
});

describe("formatTimeShort", () => {
  it("formats ISO date string to short time format", () => {
    const result = eventBookingApi.formatTimeShort("2026-09-01T10:00:00Z");
    expect(result).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/i);
  });
});
