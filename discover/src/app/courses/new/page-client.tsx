"use client";

import { useEffect, useRef, useState } from "react";
import { getApiBaseUrl, isLiveMode } from "@/lib/auth/config";

function buildCourseIframeSrc(): string {
  if (typeof window === "undefined") return "/course-creator-reference.html";
  const apiBase = isLiveMode() ? getApiBaseUrl() : "";
  const apiBaseParam = apiBase ? `apiBaseUrl=${encodeURIComponent(apiBase)}` : "";
  const existingSearch = window.location.search;
  const qs = existingSearch ? `&${apiBaseParam}` : `?${apiBaseParam}`;
  return apiBaseParam
    ? `/course-creator-reference.html${existingSearch ? `${existingSearch}&${apiBaseParam}` : `?${apiBaseParam}`}`
    : `/course-creator-reference.html${existingSearch}`;
}

export default function NewCoursePage() {
  const [frameSrc] = useState<string>(() => {
    return buildCourseIframeSrc();
  });
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !frame.contentWindow) return;

    // Notify the iframe that the parent is ready to receive messages.
    frame.contentWindow.postMessage({ type: "tutoria-course-parent-ready" }, window.location.origin);

    const onMessage = (event: MessageEvent) => {
      const data = event.data as {
        type?: string;
        requestId?: string;
        item?: unknown;
        error?: { code: string; message: string };
      };

      if (data.type === "tutoria-course-published") {
        const { requestId, item } = data;
        window.parent.postMessage({ type: "tutoria-course-published", requestId, item }, window.location.origin);
      } else if (data.type === "tutoria-course-publish-error") {
        const { requestId } = data;
        const apiError = data.error ?? { code: "UNKNOWN", message: "Unknown error" };
        window.parent.postMessage({ type: "tutoria-course-publish-error", requestId, code: apiError.code, message: apiError.message }, window.location.origin);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <iframe
      ref={frameRef}
      src={frameSrc}
      title="Tutoria Course Creator"
      style={{ width: "100%", height: "100dvh", border: 0 }}
    />
  );
}
