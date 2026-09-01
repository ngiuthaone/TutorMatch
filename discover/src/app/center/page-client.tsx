"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ensureSession, getSessionAccessToken, getSessionSnapshot } from "@/lib/auth/session";
import { isLiveMode } from "@/lib/auth/config";
import { cancelTutorBooking, decideTutorBooking, listTutorBookings, recordTutorAttendance, TutorBookingApiError } from "@/lib/tutor-booking-api";
import { cancelWorkshopBooking, listWorkshopBookings, TutorWorkshopBookingApiError } from "@/lib/tutor-workshop-booking-api";
import { getMyTutorDashboard, TutorDashboardApiError, type TutorDashboardSummary } from "@/lib/tutor-dashboard-api";

interface TutorDashboardSectionProps {
  summary: TutorDashboardSummary;
  onRefresh: () => Promise<void>;
}

function formatVnd(amount: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(amount)}₫`;
}

function TutorDashboardSection({ summary, onRefresh }: TutorDashboardSectionProps) {
  const [pending, setPending] = useState<{ id: string; learner: string; startsAt: string; endsAt: string; version: number; status: "confirmed" | "requested" }[] | null>(null);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<{ id: string; rating: number; body: string; publishedAt: string; learnerName: string | null }[] | null>(null);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "schedule" | "sessions">("overview");

  const [actionError, setActionError] = useState<string | null>(null);
  const handleAttendance = async (bookingId: string, outcome: "attended" | "learner_no_show") => {
    setActionError(null);
    try {
      const row = pending?.find((b) => b.id === bookingId);
      if (!row) return;
      await recordTutorAttendance(bookingId, outcome, row.version);
      await onRefresh();
      setPending((prev) => prev?.filter((b) => b.id !== bookingId) ?? null);
    } catch (error) {
      setActionError(error instanceof TutorBookingApiError ? error.message : "Could not record attendance.");
    }
  };

  useEffect(() => {
    let cancelled = false;
    setPendingError(null);
    setReviewsError(null);
    setActionError(null);
    if (tab === "schedule") {
      void listTutorBookings()
        .then((bookings) => {
          if (cancelled) return;
          const rows = bookings
            .filter((booking) => booking.status === "confirmed" || booking.status === "requested")
            .map((booking) => ({
              id: booking.id,
              learner: booking.learner?.displayName ?? "Learner",
              startsAt: booking.session.startsAt,
              endsAt: booking.session.endsAt,
              version: booking.version,
              status: booking.status as "confirmed" | "requested",
            }));
          setPending(rows);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          setPendingError(error instanceof TutorBookingApiError ? error.message : "Bookings are temporarily unavailable.");
        });
    }
    return () => {
      cancelled = true;
    };
  }, [tab, onRefresh]);

  return (
    <section className="mx-auto max-w-5xl px-5 pb-12 pt-10 sm:px-10">
      <div className="rounded-3xl border border-white/[.12] bg-[#17181c] p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-white/40">Tutor dashboard</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{summary.tutorProfile.displayName}</h2>
            {summary.tutorProfile.headline && (
              <p className="mt-1 text-sm text-white/55">{summary.tutorProfile.headline}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <a href="/become-a-tutor" className="rounded-xl border border-white/15 px-3 py-2 text-white/80">Edit profile</a>
            <button type="button" onClick={() => void onRefresh()} className="rounded-xl border border-white/15 px-3 py-2 text-white/80">Refresh</button>
          </div>
        </header>

        <nav className="mt-6 flex flex-wrap gap-2 border-b border-white/[.1] pb-3 text-xs">
          {(["overview", "schedule", "sessions"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-full px-3 py-2 ${tab === id ? "bg-white text-black" : "border border-white/15 text-white/70"}`}
            >
              {id === "overview" ? "Overview" : id === "schedule" ? "Schedule" : "Sessions"}
            </button>
          ))}
        </nav>

        {tab === "overview" && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Today" value={String(summary.todayCount)} />
            <Stat label="Upcoming" value={String(summary.upcomingCount)} />
            <Stat label="Month earnings" value={formatVnd(summary.monthEarningsVnd)} />
            <Stat
              label="Rating"
              value={summary.rating.count === 0 ? "—" : `${summary.rating.average?.toFixed(1) ?? "—"} ★`}
              hint={summary.rating.count === 0 ? "No reviews yet" : `${summary.rating.count} reviews`}
            />
            <Stat label="Pending bookings" value={String(summary.pendingBookingsCount)} />
            <Stat label="Month completed" value={String(summary.monthCompletedCount)} />
          </div>
        )}

        {tab === "schedule" && (
          <div className="mt-6">
            {pendingError ? (
              <p className="rounded-2xl border border-amber-300/20 bg-amber-300/[.06] p-4 text-sm text-amber-100">{pendingError}</p>
            ) : pending === null ? (
              <p className="text-sm text-white/55">Loading schedule…</p>
            ) : pending.length === 0 ? (
              <p className="text-sm text-white/55">No upcoming sessions on the schedule.</p>
            ) : (
              <>
              <ul className="space-y-3">
                {pending.map((row) => {
                  const past = new Date(row.endsAt).getTime() <= Date.now();
                  return (
                    <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[.08] bg-white/[.025] p-4 text-sm text-white/80">
                      <span>{new Date(row.startsAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" })}</span>
                      <span>{row.learner}</span>
                      <div className="flex flex-wrap items-center gap-2">
                        <a href={`/bookings/${encodeURIComponent(row.id)}`} className="rounded-xl border border-white/15 px-3 py-1.5 text-xs">View booking</a>
                        {past && row.status === "confirmed" && <>
                          <button type="button" onClick={() => void handleAttendance(row.id, "attended")} className="rounded-xl border border-white/15 px-3 py-1.5 text-xs">Mark complete</button>
                          <button type="button" onClick={() => void handleAttendance(row.id, "learner_no_show")} className="rounded-xl border border-white/15 px-3 py-1.5 text-xs">Mark no-show</button>
                        </>}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {actionError && <p role="alert" className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/[.06] p-4 text-sm text-amber-100">{actionError}</p>}
              </>
            )}
          </div>
        )}

        {tab === "sessions" && (
          <div className="mt-6 text-sm text-white/55">
            Sessions are created from your published offerings. Use the Sessions tab once offerings exist; creation lives in the booking dashboard and is wired through your profile wizard.
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/[.08] bg-white/[.025] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-white/40">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-white/45">{hint}</p>}
    </div>
  );
}

export default function CenterPage() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const notifyFrameReady = () => frameRef.current?.contentWindow?.postMessage({ type: "tutoria-center-parent-ready" }, window.location.origin);
  const [dashboard, setDashboard] = useState<TutorDashboardSummary | null>(null);
  const [dashboardLoaded, setDashboardLoaded] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const refreshDashboard = useCallback(async () => {
    if (!isLiveMode()) {
      setDashboardLoaded(true);
      return;
    }
    try {
      await ensureSession();
      const result = await getMyTutorDashboard();
      setDashboard(result.dashboard);
      setDashboardError(null);
    } catch (error) {
      setDashboardError(error instanceof TutorDashboardApiError ? error.message : "Tutor dashboard is temporarily unavailable.");
    } finally {
      setDashboardLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refreshDashboard();
    const session = getSessionSnapshot();
    if (session.status === "authenticated") void refreshDashboard();
  }, [refreshDashboard]);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const frame = document.querySelector<HTMLIFrameElement>('iframe[title="Tutoria Center"]');
      if (!frame || event.origin !== window.location.origin || event.source !== frame.contentWindow) return;
      const message = event.data as { type?: unknown; requestId?: unknown; bookingId?: unknown; action?: unknown; expectedVersion?: unknown; reason?: unknown } | null;
      if (!message || typeof message.type !== "string") return;

      if (message.type === "tutoria-center-load-tutor-bookings") {
        const requestId = typeof message.requestId === "string" ? message.requestId : "";
        if (!isLiveMode()) { frame.contentWindow?.postMessage({ type: "tutoria-center-demo", requestId }, window.location.origin); return; }
        try { await ensureSession(); if (!getSessionAccessToken()) throw new TutorBookingApiError("UNAUTHORIZED", 401, "Sign in to manage tutor bookings."); const bookings = await listTutorBookings(); const sessionState = getSessionSnapshot(); const tutor = sessionState.status === "authenticated" ? { name: sessionState.user.name, role: sessionState.user.role } : null; frame.contentWindow?.postMessage({ type: "tutoria-center-tutor-bookings", requestId, bookings, tutor }, window.location.origin); }
        catch (error) { const apiError = error instanceof TutorBookingApiError ? error : new TutorBookingApiError("TUTOR_BOOKING_UNAVAILABLE", 503, "Tutor bookings are temporarily unavailable."); frame.contentWindow?.postMessage({ type: "tutoria-center-tutor-bookings-error", requestId, code: apiError.code, message: apiError.message }, window.location.origin); }
        return;
      }
      if (message.type === "tutoria-center-decide-tutor-booking" && typeof message.bookingId === "string" && (message.action === "accept" || message.action === "reject")) {
        const requestId = typeof message.requestId === "string" ? message.requestId : "";
        try { await ensureSession(); if (!getSessionAccessToken()) throw new TutorBookingApiError("UNAUTHORIZED", 401, "Sign in to manage tutor bookings."); const booking = await decideTutorBooking(message.bookingId, message.action, typeof message.expectedVersion === "number" ? message.expectedVersion : undefined); frame.contentWindow?.postMessage({ type: "tutoria-center-tutor-booking-decision", requestId, booking }, window.location.origin); }
        catch (error) { const apiError = error instanceof TutorBookingApiError ? error : new TutorBookingApiError("TUTOR_BOOKING_UNAVAILABLE", 503, "This booking could not be updated. Reload and try again."); frame.contentWindow?.postMessage({ type: "tutoria-center-tutor-booking-decision-error", requestId, code: apiError.code, message: apiError.message }, window.location.origin); }
      }
      if (message.type === "tutoria-center-cancel-tutor-booking" && typeof message.bookingId === "string" && typeof message.expectedVersion === "number") {
        const requestId = typeof message.requestId === "string" ? message.requestId : "";
        try { await ensureSession(); if (!getSessionAccessToken()) throw new TutorBookingApiError("UNAUTHORIZED", 401, "Sign in to manage tutor bookings."); const booking = await cancelTutorBooking(message.bookingId, message.expectedVersion, typeof message.reason === "string" ? message.reason : undefined); frame.contentWindow?.postMessage({ type: "tutoria-center-tutor-booking-cancellation", requestId, booking }, window.location.origin); }
        catch (error) { const apiError = error instanceof TutorBookingApiError ? error : new TutorBookingApiError("TUTOR_BOOKING_UNAVAILABLE", 503, "This booking could not be cancelled. Reload and try again."); frame.contentWindow?.postMessage({ type: "tutoria-center-tutor-booking-cancellation-error", requestId, code: apiError.code, message: apiError.message }, window.location.origin); }
      }

      if (message.type === "tutoria-center-load-workshop-bookings") {
        const requestId = typeof message.requestId === "string" ? message.requestId : "";
        if (!isLiveMode()) { frame.contentWindow?.postMessage({ type: "tutoria-center-demo", requestId }, window.location.origin); return; }
        try { await ensureSession(); if (!getSessionAccessToken()) throw new TutorWorkshopBookingApiError("UNAUTHORIZED", 401, "Sign in to manage workshop bookings."); const bookings = await listWorkshopBookings(); const sessionState = getSessionSnapshot(); const host = sessionState.status === "authenticated" ? { name: sessionState.user.name, role: sessionState.user.role } : null; frame.contentWindow?.postMessage({ type: "tutoria-center-workshop-bookings", requestId, bookings, host }, window.location.origin); }
        catch (error) { const apiError = error instanceof TutorWorkshopBookingApiError ? error : new TutorWorkshopBookingApiError("TUTOR_WORKSHOP_BOOKING_UNAVAILABLE", 503, "Workshop bookings are temporarily unavailable."); frame.contentWindow?.postMessage({ type: "tutoria-center-workshop-bookings-error", requestId, code: apiError.code, message: apiError.message }, window.location.origin); }
        return;
      }
      if (message.type === "tutoria-center-cancel-workshop-booking" && typeof message.bookingId === "string" && typeof message.expectedVersion === "number") {
        const requestId = typeof message.requestId === "string" ? message.requestId : "";
        try { await ensureSession(); if (!getSessionAccessToken()) throw new TutorWorkshopBookingApiError("UNAUTHORIZED", 401, "Sign in to manage workshop bookings."); const booking = await cancelWorkshopBooking(message.bookingId, message.expectedVersion, typeof message.reason === "string" ? message.reason : undefined); frame.contentWindow?.postMessage({ type: "tutoria-center-workshop-booking-cancellation", requestId, booking }, window.location.origin); }
        catch (error) { const apiError = error instanceof TutorWorkshopBookingApiError ? error : new TutorWorkshopBookingApiError("TUTOR_WORKSHOP_BOOKING_UNAVAILABLE", 503, "This workshop booking could not be cancelled. Reload and try again."); frame.contentWindow?.postMessage({ type: "tutoria-center-workshop-booking-cancellation-error", requestId, code: apiError.code, message: apiError.message }, window.location.origin); }
      }
    };
    window.addEventListener("message", handleMessage);
    notifyFrameReady();
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <main className="min-h-[100dvh] bg-[#101011]">
      {dashboard && <TutorDashboardSection summary={dashboard} onRefresh={() => refreshDashboard()} />}
      {!dashboard && dashboardLoaded && !dashboardError && isLiveMode() && (
        <p className="mx-auto max-w-5xl px-5 pt-10 text-sm text-white/55">Sign in as a tutor to see your dashboard.</p>
      )}
      {dashboardError && (
        <p role="alert" className="mx-auto max-w-5xl px-5 pt-10 text-sm text-amber-100">{dashboardError}</p>
      )}
      <iframe ref={frameRef} src="/center.html" title="Tutoria Center" onLoad={notifyFrameReady} style={{ width: "100%", height: "100dvh", border: 0, display: "block" }} />
    </main>
  );
}
