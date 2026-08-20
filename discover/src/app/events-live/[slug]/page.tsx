"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EventDetailPage } from "@/components/event-live/event-detail-page";
import type { EventOffering, EventSession } from "@/lib/event-booking-api";

export default function EventLiveDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const [offering, setOffering] = useState<EventOffering | null>(null);
  const [sessions, setSessions] = useState<EventSession[]>([]);
  const [hostDisplayName, setHostDisplayName] = useState("Host");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    params.then(({ slug: resolvedSlug }) => {
      if (cancelled) return;

      async function load() {
        try {
          const { getEventOffering, getEventSessions } = await import("@/lib/event-booking-api");
          const [offeringData, sessionsData] = await Promise.all([
            getEventOffering(resolvedSlug),
            getEventSessions(resolvedSlug),
          ]);

          if (cancelled) return;

          if (!offeringData || offeringData.offeringType !== "event") {
            setError("Event not found");
            return;
          }

          setOffering(offeringData);
          setSessions(sessionsData);

          // Fetch host display name from tutor profile
          try {
            const { getApiBaseUrl } = await import("@/lib/auth/config");
            const response = await fetch(`${getApiBaseUrl()}/api/v1/sessions?tutorProfileId=${encodeURIComponent(offeringData.hostId)}`, { cache: "no-store" });
            if (response.ok) {
              const data = await response.json();
              const session = data.sessions?.[0];
              if (session?.tutor?.displayName) {
                setHostDisplayName(session.tutor.displayName);
              }
            }
          } catch {
            // Keep default host name
          }
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Failed to load event");
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
      load();
    });

    return () => { cancelled = true; };
  }, [params]);

  if (loading) {
    return (
      <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#09090b", color: "#f5f5f7" }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Loading event...</h1>
        </div>
      </main>
    );
  }

  if (error || !offering) {
    return (
      <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#09090b", color: "#f5f5f7", textAlign: "center" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>{error || "Event not found"}</h1>
          <p style={{ color: "#a1a1aa", marginTop: "0.5rem" }}>This event may have been removed or is not available.</p>
          <Link href="/events-live" style={{ display: "inline-block", marginTop: "1.5rem", color: "#d6c1ad", fontWeight: 600 }}>Back to events</Link>
        </div>
      </main>
    );
  }

  return <EventDetailPage offering={offering} sessions={sessions} hostDisplayName={hostDisplayName} />;
}
