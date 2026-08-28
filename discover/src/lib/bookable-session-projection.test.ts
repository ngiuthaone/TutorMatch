import { describe, expect, it } from "vitest";
import { earliestFutureBookableSession, sortFutureBookableSessions } from "@/lib/bookable-session-projection";

const now = Date.parse("2026-08-14T12:00:00Z");
const session = (id: string, startsAt: string, endsAt: string, status = "scheduled") => ({ id, startsAt, endsAt, status });

describe("bookable session projection", () => {
  it("selects the earliest future Session instead of array order", () => {
    const sessions = [
      session("B", "2026-08-15T16:00:00Z", "2026-08-15T17:00:00Z"),
      session("A", "2026-08-15T14:00:00Z", "2026-08-15T15:00:00Z"),
      session("C", "2026-08-16T14:00:00Z", "2026-08-16T15:00:00Z"),
    ];

    expect(earliestFutureBookableSession(sessions, now)?.id).toBe("A");
    expect(sortFutureBookableSessions(sessions, now).map(({ id }) => id)).toEqual(["A", "B", "C"]);
  });

  it("returns no next Session when all Sessions are unavailable or not future", () => {
    const sessions = [
      session("past", "2026-08-14T10:00:00Z", "2026-08-14T11:00:00Z"),
      session("cancelled", "2026-08-15T14:00:00Z", "2026-08-15T15:00:00Z", "cancelled"),
    ];

    expect(earliestFutureBookableSession(sessions, now)).toBeNull();
  });
});
