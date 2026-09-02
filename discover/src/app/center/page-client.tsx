"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RatingStars } from "@/components/rating-stars";
import { ensureSession, getSessionAccessToken, getSessionSnapshot } from "@/lib/auth/session";
import { isLiveMode } from "@/lib/auth/config";
import { cancelTutorBooking, decideTutorBooking, listTutorBookings, recordTutorAttendance, TutorBookingApiError } from "@/lib/tutor-booking-api";
import { cancelWorkshopBooking, listWorkshopBookings, TutorWorkshopBookingApiError } from "@/lib/tutor-workshop-booking-api";
import { getMyTutorDashboard, TutorDashboardApiError, type TutorDashboardSummary } from "@/lib/tutor-dashboard-api";
import { TutorScheduleCalendar, type ScheduledSession } from "@/components/tutor/tutor-schedule-calendar";
import {
  type HostAnalytics,
  type HostCheckInLogRow,
  type HostDashboardSummary,
  type HostEarnings,
  type HostOfferingDetail,
  type HostOfferingSummary,
  type HostPromotionCodeRow,
  type HostSessionRow,
  type HostTeamMemberRow,
  type CheckInRedeemResult,
  type CheckInToken,
  type CheckInUndoResult,
  getHostAnalytics,
  getHostDashboard,
  getHostEarnings,
  getHostOffering,
  getHostPayoutSummary,
  HostCenterApiError,
  issueCheckInToken,
  listHostAttendees,
  listHostCheckInLogs,
  listHostOfferings,
  listHostPayoutFailures,
  listHostPayoutStatements,
  listHostPromotionCodes,
  listHostSessions,
  listHostTeam,
  redeemCheckInToken,
  retryPayoutFailure,
  undoCheckIn,
} from "@/lib/host-center-api";

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
  const [actionError, setActionError] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "schedule" | "sessions">("overview");
  const [allBookings, setAllBookings] = useState<ScheduledSession[] | null>(null);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingError(null);
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
          const calendarSessions: ScheduledSession[] = bookings.map((booking) => ({
            id: booking.id,
            title: booking.learner?.displayName ?? "Booking",
            start: new Date(booking.session.startsAt),
            end: new Date(booking.session.endsAt),
            learnerName: booking.learner?.displayName ?? undefined,
            status: (booking.status === "rejected" ? "cancelled" : booking.status) as ScheduledSession["status"],
            href: `/bookings/${booking.id}`,
          }));
          setAllBookings(calendarSessions);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          setPendingError(error instanceof TutorBookingApiError ? error.message : "Bookings are temporarily unavailable.");
          setAllBookings([]);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [tab]);

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
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-white/[.1] bg-white/[.025] p-4 text-sm text-white/65">
              <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-white/40">Payouts</p>
              <p className="mt-2 text-white/80">Payouts are processed manually every Friday. You&apos;ll receive an email when your payout has been sent.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Today" value={String(summary.todayCount)} />
            <Stat label="Upcoming" value={String(summary.upcomingCount)} />
            <Stat label="Month earnings" value={formatVnd(summary.monthEarningsVnd)} />
            <Stat
              label="Rating"
              value={summary.rating.count === 0 ? "—" : (summary.rating.average?.toFixed(1) ?? "—")}
              hint={summary.rating.count === 0 ? "No reviews yet" : `${summary.rating.count} reviews`}
              extra={summary.rating.count > 0 && summary.rating.average !== null ? <RatingStars value={summary.rating.average} size="sm" /> : null}
            />
            <Stat label="Pending bookings" value={String(summary.pendingBookingsCount)} />
            <Stat label="Month completed" value={String(summary.monthCompletedCount)} />
            </div>
          </div>
        )}

        {tab === "schedule" && (
          <div className="mt-6 space-y-6">
            <div className="rounded-2xl border border-white/[.08] bg-white/[.02] p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/55">Calendar</h3>
              {allBookings === null ? (
                <p className="text-sm text-white/55">Loading calendar…</p>
              ) : (
                <TutorScheduleCalendar
                  sessions={allBookings}
                  onSessionClick={(s) => {
                      if (typeof window !== "undefined") window.location.href = s.href;
                    }}
                />
              )}
            </div>
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
                  // eslint-disable-next-line react-hooks/purity
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

function Stat({ label, value, hint, extra }: { label: string; value: string; hint?: string; extra?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[.08] bg-white/[.025] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-white/40">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <p className="text-2xl font-semibold text-white">{value}</p>
        {extra}
      </div>
      {hint && <p className="mt-1 text-xs text-white/45">{hint}</p>}
    </div>
  );
}

function apiErrorPayload(error: unknown, fallbackCode: string, fallbackMessage: string) {
  if (error instanceof HostCenterApiError) return { code: error.code, message: error.message };
  return { code: fallbackCode, message: fallbackMessage };
}

export default function CenterPage() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const notifyFrameReady = () => frameRef.current?.contentWindow?.postMessage({ type: "tutoria-center-parent-ready" }, window.location.origin);
  const [dashboard, setDashboard] = useState<TutorDashboardSummary | null>(null);
  const [dashboardLoaded, setDashboardLoaded] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const refreshDashboard = useCallback(async () => {
    if (!isLiveMode()) { setDashboardLoaded(true); return; }
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshDashboard();
    const session = getSessionSnapshot();
    if (session.status === "authenticated") void refreshDashboard();
  }, [refreshDashboard]);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const frame = document.querySelector<HTMLIFrameElement>('iframe[title="Tutoria Center"]');
      if (!frame || event.origin !== window.location.origin || event.source !== frame.contentWindow) return;
      const message = event.data as Record<string, unknown> | null;
      if (!message || typeof message.type !== "string") return;

      const rid = typeof message.requestId === "string" ? message.requestId : "";
      const respond = (type: string, data: unknown) =>
        frame.contentWindow?.postMessage({ ...(rid ? { requestId: rid } : {}), type, data }, window.location.origin);
      const respondError = (code: string, errMsg: string) =>
        frame.contentWindow?.postMessage({ ...(rid ? { requestId: rid } : {}), type: "tutoria-center-rpc-error", code, message: errMsg }, window.location.origin);

      // ── Tutor bookings ────────────────────────────────────────────────
      if (message.type === "tutoria-center-load-tutor-bookings") {
        if (!isLiveMode()) { respond("tutoria-center-demo", null); return; }
        try { await ensureSession(); if (!getSessionAccessToken()) throw new TutorBookingApiError("UNAUTHORIZED", 401, "Sign in to manage tutor bookings."); const bookings = await listTutorBookings(); const sessionState = getSessionSnapshot(); const tutor = sessionState.status === "authenticated" ? { name: sessionState.user.name, role: sessionState.user.role } : null; respond("tutoria-center-tutor-bookings", { bookings, tutor }); }
        catch (error) { const e = apiErrorPayload(error, "TUTOR_BOOKING_UNAVAILABLE", "Tutor bookings are temporarily unavailable."); respondError(e.code, e.message); }
        return;
      }
      if (message.type === "tutoria-center-decide-tutor-booking" && typeof message.bookingId === "string" && (message.action === "accept" || message.action === "reject")) {
        try { await ensureSession(); if (!getSessionAccessToken()) throw new TutorBookingApiError("UNAUTHORIZED", 401, "Sign in to manage tutor bookings."); const booking = await decideTutorBooking(message.bookingId as string, message.action as "accept" | "reject", typeof message.expectedVersion === "number" ? message.expectedVersion as number : undefined); respond("tutoria-center-tutor-booking-decision", { booking }); }
        catch (error) { const e = apiErrorPayload(error, "TUTOR_BOOKING_UNAVAILABLE", "This booking could not be updated. Reload and try again."); respondError(e.code, e.message); }
        return;
      }
      if (message.type === "tutoria-center-cancel-tutor-booking" && typeof message.bookingId === "string" && typeof message.expectedVersion === "number") {
        try { await ensureSession(); if (!getSessionAccessToken()) throw new TutorBookingApiError("UNAUTHORIZED", 401, "Sign in to manage tutor bookings."); const booking = await cancelTutorBooking(message.bookingId as string, message.expectedVersion as number, typeof message.reason === "string" ? message.reason as string : undefined); respond("tutoria-center-tutor-booking-cancellation", { booking }); }
        catch (error) { const e = apiErrorPayload(error, "TUTOR_BOOKING_UNAVAILABLE", "This booking could not be cancelled. Reload and try again."); respondError(e.code, e.message); }
        return;
      }

      // ── Workshop bookings ──────────────────────────────────────────────
      if (message.type === "tutoria-center-load-workshop-bookings") {
        if (!isLiveMode()) { respond("tutoria-center-demo", null); return; }
        try { await ensureSession(); if (!getSessionAccessToken()) throw new TutorWorkshopBookingApiError("UNAUTHORIZED", 401, "Sign in to manage workshop bookings."); const bookings = await listWorkshopBookings(); const sessionState = getSessionSnapshot(); const host = sessionState.status === "authenticated" ? { name: sessionState.user.name, role: sessionState.user.role } : null; respond("tutoria-center-workshop-bookings", { bookings, host }); }
        catch (error) { const e = apiErrorPayload(error, "TUTOR_WORKSHOP_BOOKING_UNAVAILABLE", "Workshop bookings are temporarily unavailable."); respondError(e.code, e.message); }
        return;
      }
      if (message.type === "tutoria-center-cancel-workshop-booking" && typeof message.bookingId === "string" && typeof message.expectedVersion === "number") {
        try { await ensureSession(); if (!getSessionAccessToken()) throw new TutorWorkshopBookingApiError("UNAUTHORIZED", 401, "Sign in to manage workshop bookings."); const booking = await cancelWorkshopBooking(message.bookingId as string, message.expectedVersion as number, typeof message.reason === "string" ? message.reason as string : undefined); respond("tutoria-center-workshop-booking-cancellation", { booking }); }
        catch (error) { const e = apiErrorPayload(error, "TUTOR_WORKSHOP_BOOKING_UNAVAILABLE", "This workshop booking could not be cancelled. Reload and try again."); respondError(e.code, e.message); }
        return;
      }

      // ── Host Center: dashboard ──────────────────────────────────────────
      if (message.type === "tutoria-center-load-host-dashboard") {
        try { await ensureSession(); const result = await getHostDashboard(); respond("tutoria-center-host-dashboard", result.dashboard); }
        catch (error) { const e = apiErrorPayload(error, "HOST_CENTER_UNAVAILABLE", "Dashboard is temporarily unavailable."); respondError(e.code, e.message); }
        return;
      }

      // ── Host Center: offerings ─────────────────────────────────────────
      if (message.type === "tutoria-center-load-host-offerings") {
        try { await ensureSession(); const params = (message as Record<string, unknown>) as { status?: string; kind?: string; limit?: number; offset?: number }; const result = await listHostOfferings(params); respond("tutoria-center-host-offerings", result.offerings); }
        catch (error) { const e = apiErrorPayload(error, "HOST_CENTER_UNAVAILABLE", "Offerings are temporarily unavailable."); respondError(e.code, e.message); }
        return;
      }

      // ── Host Center: offering detail ──────────────────────────────────
      if (message.type === "tutoria-center-load-host-offering-detail") {
        try { await ensureSession(); const params = (message as Record<string, unknown>) as { offeringId: string }; const result = await getHostOffering(params.offeringId); respond("tutoria-center-host-offering-detail", result.offering); }
        catch (error) { const e = apiErrorPayload(error, "HOST_CENTER_UNAVAILABLE", "Offering detail is temporarily unavailable."); respondError(e.code, e.message); }
        return;
      }

      // ── Host Center: sessions ──────────────────────────────────────────
      if (message.type === "tutoria-center-load-host-sessions") {
        try { await ensureSession(); const params = (message as Record<string, unknown>) as { from?: string; to?: string; offeringId?: string; status?: string; limit?: number; offset?: number }; const result = await listHostSessions(params); respond("tutoria-center-host-sessions", result.sessions); }
        catch (error) { const e = apiErrorPayload(error, "HOST_CENTER_UNAVAILABLE", "Sessions are temporarily unavailable."); respondError(e.code, e.message); }
        return;
      }

      // ── Host Center: attendees ───────────────────────────────────────────
      if (message.type === "tutoria-center-load-host-attendees") {
        try { await ensureSession(); const params = (message as Record<string, unknown>) as { q?: string; offeringId?: string; limit?: number; offset?: number }; const result = await listHostAttendees(params); respond("tutoria-center-host-attendees", result.attendees); }
        catch (error) { const e = apiErrorPayload(error, "HOST_CENTER_UNAVAILABLE", "Attendees are temporarily unavailable."); respondError(e.code, e.message); }
        return;
      }

      // ── Host Center: earnings ───────────────────────────────────────────
      if (message.type === "tutoria-center-load-host-earnings") {
        try { await ensureSession(); const params = (message as Record<string, unknown>) as { from?: string; to?: string }; const result = await getHostEarnings(params); respond("tutoria-center-host-earnings", result.earnings); }
        catch (error) { const e = apiErrorPayload(error, "HOST_CENTER_UNAVAILABLE", "Earnings are temporarily unavailable."); respondError(e.code, e.message); }
        return;
      }

      // ── Host Center: analytics ─────────────────────────────────────────
      if (message.type === "tutoria-center-load-host-analytics") {
        try { await ensureSession(); const result = await getHostAnalytics(); respond("tutoria-center-host-analytics", result.analytics); }
        catch (error) { const e = apiErrorPayload(error, "HOST_CENTER_UNAVAILABLE", "Analytics are temporarily unavailable."); respondError(e.code, e.message); }
        return;
      }

      // ── Host Center: payout summary ─────────────────────────────────────
      if (message.type === "tutoria-center-load-host-payout-summary") {
        try { await ensureSession(); const result = await getHostPayoutSummary(); respond("tutoria-center-host-payout-summary", result); }
        catch (error) { const e = apiErrorPayload(error, "HOST_CENTER_UNAVAILABLE", "Payout summary is temporarily unavailable."); respondError(e.code, e.message); }
        return;
      }

      // ── Host Center: payout failures ────────────────────────────────────
      if (message.type === "tutoria-center-load-host-payout-failures") {
        try { await ensureSession(); const params = (message as Record<string, unknown>) as { limit?: number; offset?: number }; const result = await listHostPayoutFailures(params); respond("tutoria-center-host-payout-failures", result); }
        catch (error) { const e = apiErrorPayload(error, "HOST_CENTER_UNAVAILABLE", "Payout failures are temporarily unavailable."); respondError(e.code, e.message); }
        return;
      }

      // ── Host Center: payout statements ──────────────────────────────────
      if (message.type === "tutoria-center-load-host-payout-statements") {
        try { await ensureSession(); const params = (message as Record<string, unknown>) as { limit?: number; offset?: number }; const result = await listHostPayoutStatements(params); respond("tutoria-center-host-payout-statements", result); }
        catch (error) { const e = apiErrorPayload(error, "HOST_CENTER_UNAVAILABLE", "Payout statements are temporarily unavailable."); respondError(e.code, e.message); }
        return;
      }

      // ── Host Center: team ───────────────────────────────────────────────
      if (message.type === "tutoria-center-load-host-team") {
        try { await ensureSession(); const params = (message as Record<string, unknown>) as { offeringId?: string; limit?: number; offset?: number }; const result = await listHostTeam(params); respond("tutoria-center-host-team", result.team); }
        catch (error) { const e = apiErrorPayload(error, "HOST_CENTER_UNAVAILABLE", "Team data is temporarily unavailable."); respondError(e.code, e.message); }
        return;
      }

      // ── Host Center: promotion codes ─────────────────────────────────────
      if (message.type === "tutoria-center-load-host-promotion-codes") {
        try { await ensureSession(); const params = (message as Record<string, unknown>) as { offeringId?: string; limit?: number; offset?: number }; const result = await listHostPromotionCodes(params); respond("tutoria-center-host-promotion-codes", result.promotionCodes); }
        catch (error) { const e = apiErrorPayload(error, "HOST_CENTER_UNAVAILABLE", "Promotion codes are temporarily unavailable."); respondError(e.code, e.message); }
        return;
      }

      // ── Host Center: check-in issue ─────────────────────────────────────
      if (message.type === "tutoria-center-issue-check-in-token") {
        try { await ensureSession(); const params = (message as Record<string, unknown>) as { sessionId: string }; const result = await issueCheckInToken(params.sessionId); respond("tutoria-center-check-in-token", result.token); }
        catch (error) { const e = apiErrorPayload(error, "HOST_CENTER_UNAVAILABLE", "Could not issue check-in token."); respondError(e.code, e.message); }
        return;
      }

      // ── Host Center: check-in redeem ────────────────────────────────────
      if (message.type === "tutoria-center-redeem-check-in-token") {
        try { await ensureSession(); const params = (message as Record<string, unknown>) as { token: string }; const result = await redeemCheckInToken(params.token); respond("tutoria-center-check-in-redeemed", result.result); }
        catch (error) { const e = apiErrorPayload(error, "HOST_CENTER_UNAVAILABLE", "Could not redeem check-in token."); respondError(e.code, e.message); }
        return;
      }

      // ── Host Center: check-in undo ───────────────────────────────────────
      if (message.type === "tutoria-center-undo-check-in") {
        try { await ensureSession(); const params = (message as Record<string, unknown>) as { token: string }; const result = await undoCheckIn(params.token); respond("tutoria-center-check-in-undone", result.result); }
        catch (error) { const e = apiErrorPayload(error, "HOST_CENTER_UNAVAILABLE", "Could not undo check-in."); respondError(e.code, e.message); }
        return;
      }

      // ── Host Center: check-in logs ─────────────────────────────────────
      if (message.type === "tutoria-center-load-check-in-logs") {
        try { await ensureSession(); const params = (message as Record<string, unknown>) as { sessionId?: string; limit?: number; offset?: number }; const result = await listHostCheckInLogs(params); respond("tutoria-center-check-in-logs", result.logs); }
        catch (error) { const e = apiErrorPayload(error, "HOST_CENTER_UNAVAILABLE", "Check-in logs are temporarily unavailable."); respondError(e.code, e.message); }
        return;
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
