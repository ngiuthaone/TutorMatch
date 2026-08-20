"use client";

import { useEffect, useMemo, useState } from "react";
import { IconCalendar, IconChevronDown, IconLoader2, IconRefresh } from "@tabler/icons-react";
import { listBookableSessions, type BookableSession } from "@/lib/booking-api";
import { sortFutureBookableSessions } from "@/lib/bookable-session-projection";

interface SessionDatePickerProps {
  offeringId?: string;
  kind?: string;
  onSelect: (session: BookableSession) => void;
  selected?: BookableSession | null;
  disabled?: boolean;
}

interface DateGroup {
  dateKey: string;
  label: string;
  sessions: BookableSession[];
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTimeRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const fmt = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${fmt(start)}\u2013${fmt(end)}`;
}

function dateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function groupByDate(sessions: BookableSession[]): DateGroup[] {
  const map = new Map<string, BookableSession[]>();
  for (const session of sessions) {
    const key = dateKey(session.startsAt);
    const group = map.get(key);
    if (group) {
      group.push(session);
    } else {
      map.set(key, [session]);
    }
  }
  const groups: DateGroup[] = [];
  for (const [dateKey, items] of map) {
    const d = new Date(items[0].startsAt);
    groups.push({ dateKey, label: formatDate(d), sessions: items });
  }
  return groups;
}

export function SessionDatePicker({
  offeringId,
  kind,
  onSelect,
  selected,
  disabled,
}: SessionDatePickerProps) {
  const [sessions, setSessions] = useState<BookableSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const fetchSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await listBookableSessions({ offeringId, kind });
      setSessions(sortFutureBookableSessions(raw));
    } catch {
      setError("Unable to load sessions. Try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offeringId, kind]);

  const groups = useMemo(() => groupByDate(sessions), [sessions]);
  const allSessionCount = sessions.length;
  const availableSessions = sessions.filter(
    (s) => s.spotsLeft === null || (s.spotsLeft !== null && s.spotsLeft > 0),
  );
  const soldOut = !loading && !error && availableSessions.length === 0 && allSessionCount > 0;

  const summaryText = (() => {
    if (loading) return "Loading sessions\u2026";
    if (error) return "Could not load sessions";
    if (soldOut) return "All sessions are full";
    if (!selected) return "Choose a date and time";
    const start = new Date(selected.startsAt);
    const end = new Date(selected.endsAt);
    const fmt = (d: Date) =>
      d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    return `${formatDate(start)}  \u00B7  ${fmt(start)}\u2013${fmt(end)}`;
  })();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { if (!loading && !disabled) setOpen(!open); }}
        disabled={loading || disabled}
        aria-expanded={open}
        className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 text-left transition-colors hover:border-[rgba(255,255,255,0.15)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="flex items-center gap-3 min-w-0">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[rgba(255,255,255,0.05)] text-[var(--muted,#a1a1aa)]">
            <IconCalendar size={17} />
          </span>
          <span className="min-w-0">
            <span className="block text-[0.625rem] font-extrabold uppercase tracking-[0.14em] text-[var(--quiet,#71717a)]">
              Date and time
            </span>
            <span className="mt-0.5 block truncate text-[0.9rem] font-semibold text-white">
              {summaryText}
            </span>
          </span>
        </span>
        {loading ? (
          <IconLoader2 size={15} className="shrink-0 animate-spin text-[var(--muted,#a1a1aa)]" />
        ) : (
          <IconChevronDown
            size={15}
            className={`shrink-0 text-[var(--muted,#a1a1aa)] transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {open && !loading && (
        <div className="absolute left-0 right-0 z-30 mt-2 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[var(--panel-2,#1b1b1e)] p-3 shadow-2xl">
          {error && (
            <div className="mb-3 rounded-xl bg-[rgba(255,100,100,0.08)] px-3 py-2 text-[0.82rem] text-[#f87171]">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => { void fetchSessions(); }}
                className="mt-1 inline-flex items-center gap-1 text-[0.78rem] font-semibold text-white underline"
              >
                <IconRefresh size={13} /> Retry
              </button>
            </div>
          )}

          {!error && soldOut && (
            <p className="py-4 text-center text-[0.82rem] text-[var(--muted,#a1a1aa)]">
              All sessions are currently full.
            </p>
          )}

          {!error && groups.length === 0 && !loading && (
            <p className="py-4 text-center text-[0.82rem] text-[var(--muted,#a1a1aa)]">
              No sessions available yet.
            </p>
          )}

          {groups.map((group) => (
            <div key={group.dateKey} className="mb-3 last:mb-0">
              <div className="mb-2 px-1 text-[0.78rem] font-bold text-white">{group.label}</div>
              <div className="flex flex-wrap gap-2">
                {group.sessions.map((session) => {
                  const isSelected = selected?.id === session.id;
                  const isFull = session.spotsLeft !== null && session.spotsLeft <= 0;

                  return (
                    <button
                      key={session.id}
                      type="button"
                      disabled={isFull}
                      onClick={() => { onSelect(session); setOpen(false); }}
                      className={`min-h-[34px] rounded-full border px-3 text-[0.75rem] font-semibold transition-colors ${
                        isSelected
                          ? "border-[rgba(255,255,255,0.28)] bg-white text-[#09090b]"
                          : isFull
                            ? "cursor-not-allowed border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] text-[var(--quiet,#71717a)] opacity-50 line-through"
                            : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.025)] text-[var(--muted,#a1a1aa)] hover:border-[rgba(255,255,255,0.2)] hover:text-white"
                      }`}
                    >
                      {formatTimeRange(session.startsAt, session.endsAt)}
                      {isFull && " Full"}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
