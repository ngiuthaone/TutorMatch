"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TutorProfileSkeleton } from "./tutor-profile-skeleton";
import { isLiveMode } from "@/lib/auth/config";
import { getTutor, isPublicTutorUuid, listTutors, type PublicTutorDetail } from "@/lib/tutor-cv-api";
import { BookingApiError, createBooking, listBookableSessions, type BookableSession } from "@/lib/booking-api";
import { sortFutureBookableSessions } from "@/lib/bookable-session-projection";
import { ensureSession, useSession } from "@/lib/auth/session";

interface TutorProfileFrameProps {
  name: string;
}

const LEVEL_LABELS: Record<string, string> = {
  primary: "Primary school ages",
  lower_secondary: "Lower secondary ages",
  upper_secondary: "Upper secondary ages",
  university: "University students",
  adult: "Adults",
  beginner: "Complete beginners",
  intermediate: "Intermediate learners",
  advanced: "Advanced learners",
  exam_preparation: "Exam preparation",
};

function initialsAvatar(displayName: string): string {
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2) || "T";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="#17181c"/><text x="400" y="440" font-family="Arial, Helvetica, sans-serif" font-size="300" font-weight="600" fill="#e8e6df" text-anchor="middle">${initials.replace(/[<>&"]/g, "")}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

function hourRateToSessionRates(hourly: number): Record<string, number> {
  const rates: Record<string, number> = {};
  for (const duration of [30, 50, 60, 90]) {
    rates[String(duration)] = Math.round((hourly * duration) / 60);
  }
  return rates;
}

function teachingFormats(format: PublicTutorDetail["teachingFormat"]): string[] {
  const formats: string[] = [];
  if (format === "online" || format === "both") formats.push("Online");
  if (format === "in_person" || format === "both") formats.push("At my teaching space", "At learners' location", "Public place");
  return formats.length ? formats : ["Online"];
}

function availabilityStrings(detail: PublicTutorDetail): string[] {
  return (detail.availability ?? []).map((slot) => `${slot.startTime}-${slot.endTime}-${slot.dayOfWeek}`);
}

function timezoneLabel(detail: PublicTutorDetail): string {
  const tz = detail.availability?.[0]?.timezone;
  if (!tz) return "GMT+7 - Asia/Bangkok";
  if (tz === "Asia/Bangkok") return "GMT+7 - Asia/Bangkok";
  if (tz === "Asia/Singapore") return "GMT+8 - Asia/Singapore";
  if (tz === "Asia/Tokyo") return "GMT+9 - Asia/Tokyo";
  return tz;
}

export function TutorProfileFrame({ name }: TutorProfileFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const fallbackTimerRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const live = isLiveMode();
  const session = useSession();
  const decodedName = useMemo(() => decodeURIComponent(name).trim(), [name]);
  const [state, setState] = useState<{ status: "loading" } | { status: "not-found" } | { status: "ready"; frameName: string; src: string }>({ status: "loading" });

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current === null) return;
    window.clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = null;
  }, []);

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    const resolve = async () => {
      try {
        const detail = isPublicTutorUuid(decodedName)
          ? await getTutor(decodedName)
          : await findByDisplayName(decodedName);
        if (cancelled || !detail) {
          if (!cancelled) setState({ status: "not-found" });
          return;
        }
        const displayName = detail.displayName;
        const languages = (detail.languages ?? []).map(
          (lang) => `${lang.displayName} (${lang.proficiency[0].toUpperCase()}${lang.proficiency.slice(1)})`,
        );
        const learnerLevels: string[] = [];
        (detail.levels ?? []).forEach((code) => {
          const label = LEVEL_LABELS[code];
          if (label && !learnerLevels.includes(label)) learnerLevels.push(label);
        });
        let bookableSessions: BookableSession[] = [];
        try {
          bookableSessions = sortFutureBookableSessions(await listBookableSessions(detail.id));
        } catch {
          // The profile remains viewable, but availability must not be inferred from tutor rules when Sessions cannot be read.
        }
        const frameProfile = {
          id: detail.id,
          name: displayName,
          role: "Independent tutor",
          tagline: detail.headline || "A tutor on Tutoria.",
          image: initialsAvatar(displayName),
          rating: 0,
          reviewCount: 0,
          lessons: 0,
          responseTime: "—",
          location: detail.regions?.[0] || "",
          price: detail.hourlyRateVnd || 0,
          languages,
          subjects: detail.subjects ?? [],
          about: (detail.bio ? [detail.bio] : []),
          learnerLevels,
          ageGroups: [],
          teachingStyles: [],
          outcomes: [],
          typicalLesson: "",
          sessionLengths: [30, 50, 60, 90],
          rates: hourRateToSessionRates(detail.hourlyRateVnd || 0),
          displayDuration: 60,
          lessonFormat: teachingFormats(detail.teachingFormat),
          availability: availabilityStrings(detail),
          timeZone: timezoneLabel(detail),
          sameDayBooking: false,
          learnerCancellation: "Not set",
          lateCancellation: "Not set",
          noShowPolicy: "Not set",
          consultationEnabled: false,
          faqs: [],
          isVerified: false,
          disclosure: detail.disclosure,
          bookableSessions,
        };
        if (cancelled) return;
        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(frameProfile))));
        setState({ status: "ready", frameName: displayName, src: `/tutor-profile-exact.html?name=${encodeURIComponent(displayName)}&profile=${encoded}` });
      } catch {
        if (!cancelled) setState({ status: "not-found" });
      }
    };
    void resolve();
    return () => { cancelled = true; };
  }, [live, decodedName]);

  const readyName = state.status === "ready" ? state.frameName : null;

  useEffect(() => {
    if (!live) return;
    const onBookingMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as { type?: unknown; requestId?: unknown; tutorProfileId?: unknown; sessionId?: unknown; participantCount?: unknown } | null;
      if (!data) return;
      if (data.type === "tutoria-booking-auth-required") {
        const returnPath = `${window.location.pathname}${window.location.search}`;
        window.location.assign(`/auth/sign-in?next=${encodeURIComponent(returnPath)}`);
        return;
      }
      if (typeof data.requestId !== "string") return;
      const respond = (payload: Record<string, unknown>) => {
        frameRef.current?.contentWindow?.postMessage({ ...payload, requestId: data.requestId }, window.location.origin);
      };
      if (data.type === "tutoria-booking-load-sessions" && typeof data.tutorProfileId === "string") {
        void listBookableSessions(data.tutorProfileId)
          .then((sessions) => respond({ type: "tutoria-booking-sessions", sessions }))
          .catch((error: unknown) => respond({ type: "tutoria-booking-error", code: error instanceof BookingApiError ? error.code : "BOOKING_SERVICE_UNAVAILABLE" }));
      }
      if (data.type === "tutoria-booking-create" && typeof data.sessionId === "string") {
        const sessionId = data.sessionId;
        void ensureSession()
          .then(() => createBooking(sessionId, typeof data.participantCount === "number" ? data.participantCount : 1))
          .then((booking) => respond({ type: "tutoria-booking-created", booking }))
          .catch((error: unknown) => {
            const code = error instanceof BookingApiError ? error.code : "BOOKING_SERVICE_UNAVAILABLE";
            respond({ type: code === "UNAUTHORIZED" ? "tutoria-booking-auth-required" : "tutoria-booking-error", code });
          });
      }
    };
    window.addEventListener("message", onBookingMessage);
    return () => window.removeEventListener("message", onBookingMessage);
  }, [live]);

  useEffect(() => {
    if (!live || !ready) return;
    frameRef.current?.contentWindow?.postMessage({
      type: "tutoria-booking-auth-state",
      authenticated: session.status === "authenticated",
    }, window.location.origin);
  }, [live, ready, session.status]);

  useEffect(() => {
    const onReady = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== frameRef.current?.contentWindow) return;
      if (event.data?.type !== "tutoria-tutor-profile-ready") return;
      if (readyName === null || event.data?.name !== readyName) return;
      clearFallbackTimer();
      setReady(true);
    };
    window.addEventListener("message", onReady);
    return () => window.removeEventListener("message", onReady);
  }, [clearFallbackTimer, readyName]);

  useEffect(() => clearFallbackTimer, [clearFallbackTimer]);

  const handleLoad = useCallback(() => {
    clearFallbackTimer();
    fallbackTimerRef.current = window.setTimeout(() => setReady(true), 1500);
  }, [clearFallbackTimer]);

  if (!live) {
    return (
      <div className="relative min-h-[100dvh] bg-[#101011]">
        <TutorProfileSkeleton />
        <iframe
          key={decodedName}
          ref={frameRef}
          src={`/tutor-profile-exact.html?name=${encodeURIComponent(decodedName)}`}
          title="Tutor profile"
          onLoad={handleLoad}
          className="absolute inset-0 block h-[100dvh] w-full border-0 bg-[#101011]"
        />
      </div>
    );
  }

  if (state.status === "not-found") {
    return (
      <main className="min-h-[100dvh] grid place-items-center bg-[#101011] px-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-[#e8e6df]">Tutor profile not found</h1>
          <p className="mt-3 text-sm text-[#8f8e8a]">
            This tutor profile is unavailable or has been unpublished.
          </p>
          <a href="/discover" className="mt-6 inline-block text-sm underline text-[#e8e6df]">
            Back to Discover
          </a>
        </div>
      </main>
    );
  }

  if (state.status === "loading") {
    return (
      <main className="min-h-[100dvh] bg-[#101011]" aria-busy="true">
        <TutorProfileSkeleton />
      </main>
    );
  }

  return (
    <div className="relative min-h-[100dvh] bg-[#101011]">
      {!ready && <TutorProfileSkeleton />}
      <iframe
        key={state.frameName}
        ref={frameRef}
        src={state.src}
        title="Tutor profile"
        onLoad={handleLoad}
        className="absolute inset-0 block h-[100dvh] w-full border-0 bg-[#101011]"
        style={{
          opacity: ready ? 1 : 0,
          pointerEvents: ready ? "auto" : "none",
          transition: "opacity 120ms ease",
        }}
      />
    </div>
  );
}

async function findByDisplayName(displayName: string): Promise<PublicTutorDetail | null> {
  const wanted = displayName.toLocaleLowerCase().trim();
  let cursor: string | null = null;
  for (let page = 0; page < 8; page += 1) {
    const result = await listTutors({ limit: 24, ...(cursor ? { cursor } : {}) });
    const match = result.items.find((item) => item.displayName.toLocaleLowerCase().trim() === wanted);
    if (match) return getTutor(match.id);
    if (!result.nextCursor) return null;
    cursor = result.nextCursor;
  }
  return null;
}
