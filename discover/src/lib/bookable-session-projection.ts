export interface BookableSessionTime {
  startsAt: string;
  endsAt: string;
  status?: string;
}

export function sortFutureBookableSessions<T extends BookableSessionTime>(sessions: T[], now = Date.now()): T[] {
  return sessions
    .filter((session) => session.status === undefined || session.status === "scheduled")
    .filter((session) => {
      const startsAt = Date.parse(session.startsAt);
      const endsAt = Date.parse(session.endsAt);
      return Number.isFinite(startsAt) && Number.isFinite(endsAt) && startsAt > now && endsAt > startsAt;
    })
    .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt));
}

export function earliestFutureBookableSession<T extends BookableSessionTime>(sessions: T[], now = Date.now()): T | null {
  return sortFutureBookableSessions(sessions, now)[0] ?? null;
}
