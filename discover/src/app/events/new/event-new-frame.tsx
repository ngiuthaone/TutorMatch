"use client";

import { useEffect } from "react";

function isPublishedEventMessage(data: unknown): data is { type: "tutoria-event-published"; slug: string } {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    "slug" in data &&
    (data as { type?: unknown }).type === "tutoria-event-published" &&
    typeof (data as { slug?: unknown }).slug === "string" &&
    (data as { slug: string }).slug.length > 0
  );
}

export function EventNewFrame() {
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || !isPublishedEventMessage(event.data)) return;
      window.location.assign(`/events/${encodeURIComponent(event.data.slug)}`);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <iframe
      title="Create an event or workshop"
      src="/event-creator-reference.html"
      style={{ display: "block", width: "100%", height: "100dvh", border: 0 }}
    />
  );
}
