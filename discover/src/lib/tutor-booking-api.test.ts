import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./auth/config", () => ({ getApiBaseUrl: () => "http://api.example.test" }));
vi.mock("./auth/session", () => ({ getSessionAccessToken: () => "access-token" }));

import { decideTutorBooking, listTutorBookings } from "./tutor-booking-api";

describe("tutor booking API", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("reads the authenticated tutor booking projection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, bookings: [{ id: "b1" }] }), { status: 200 })));
    await expect(listTutorBookings()).resolves.toEqual([{ id: "b1" }]);
    expect(fetch).toHaveBeenCalledWith("http://api.example.test/api/v1/me/tutor-bookings", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer access-token" }) }));
  });

  it("sends reject with the server version and maps conflicts", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: "STALE_VERSION", message: "Reload before trying again." } }), { status: 409 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(decideTutorBooking("b1", "reject", 7)).rejects.toMatchObject({ code: "STALE_VERSION", status: 409 });
    expect(fetchMock).toHaveBeenCalledWith("http://api.example.test/api/v1/bookings/b1/reject", expect.objectContaining({ body: JSON.stringify({ expectedVersion: 7 }) }));
  });
});
