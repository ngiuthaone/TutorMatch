"use client";

import { useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { getApiBaseUrl, isLiveMode } from "@/lib/auth/config";
import { ensureSession, getSessionAccessToken } from "@/lib/auth/session";
import { BackendCourseApiError, publishBackendCourse, type BackendCoursePublishInput } from "@/lib/courses/backend-courses-api";
import { sanitizeTree } from "@/lib/api-security";

export default function NewCoursePage() {
  return (
    <RequireAuth>
      <CourseCreatorFrame />
    </RequireAuth>
  );
}

function buildBaseSrc(existingSearch: string, apiBaseParam: string): string {
  let prefix = "/course-creator-reference.html";
  if (existingSearch) prefix += existingSearch;
  if (apiBaseParam) {
    prefix += existingSearch ? `&${apiBaseParam}` : `?${apiBaseParam}`;
  }
  return prefix;
}

function CourseCreatorFrame() {
  const [frameSrc] = useState<string>(() => {
    if (typeof window === "undefined") return "/course-creator-reference.html";
    const existingSearch = window.location.search;
    const live = isLiveMode();
    let apiBase = "";
    if (live) {
      try {
        apiBase = getApiBaseUrl();
      } catch {
        apiBase = "";
      }
    }
    const apiBaseParam = apiBase ? `apiBaseUrl=${encodeURIComponent(apiBase)}` : "";
    return buildBaseSrc(existingSearch, apiBaseParam);
  });

  const frameRef = useRef<HTMLIFrameElement>(null);
  const notifyFrameReady = () => frameRef.current?.contentWindow?.postMessage({ type: "tutoria-course-parent-ready" }, window.location.origin);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const frame = document.querySelector<HTMLIFrameElement>('iframe[title="Create a course"]');
      if (!frame || event.origin !== window.location.origin || event.source !== frame.contentWindow) return;
      const message = event.data as { type?: unknown; requestId?: unknown; course?: unknown } | null;
      if (!message || typeof message.type !== "string") return;

      if (message.type === "tutoria-course-publish") {
        const requestId = typeof message.requestId === "string" ? message.requestId : "";
        if (!isLiveMode()) {
          frame.contentWindow?.postMessage({ type: "tutoria-course-demo", requestId }, window.location.origin);
          return;
        }
        try {
          await ensureSession();
          if (!getSessionAccessToken()) throw new BackendCourseApiError("UNAUTHORIZED", 401, "Sign in to publish a course.");
          const input = parseCourseInput(message.course);
          const item = await publishBackendCourse(input);
          frame.contentWindow?.postMessage({ type: "tutoria-course-published", requestId, item }, window.location.origin);
        } catch (error) {
          const apiError = error instanceof BackendCourseApiError
            ? error
            : error instanceof Error
              ? new BackendCourseApiError("VALIDATION_ERROR", 400, error.message)
              : new BackendCourseApiError("SERVICE_UNAVAILABLE", 503, "Marketplace is temporarily unavailable.");
          frame.contentWindow?.postMessage({ type: "tutoria-course-publish-error", requestId, code: apiError.code, message: apiError.message }, window.location.origin);
        }
        return;
      }
    };
    window.addEventListener("message", handleMessage);
    notifyFrameReady();
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <iframe
      ref={frameRef}
      title="Create a course"
      src={frameSrc}
      onLoad={notifyFrameReady}
      style={{ width: "100%", height: "100dvh", border: 0, display: "block", background: "#e9ebed" }}
    />
  );
}

/**
 * Convert the iframe's flat course object into the backend coursePostSchema
 * shape. slug/title go in dedicated fields; everything else lands in payload.
 * Identity/contact keys (creatorId, phone, hostName, etc.) are stripped — the
 * backend service scrubs again before persistence.
 */
function parseCourseInput(value: unknown): BackendCoursePublishInput {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const course = sanitizeTree(raw) as Record<string, unknown>;
  const slugRegex = /^[a-z0-9][a-z0-9-]{0,63}$/;
  const slug = typeof course.slug === "string" ? course.slug.trim() : "";
  if (slug && !slugRegex.test(slug)) {
    throw new Error("Invalid slug format");
  }
  const title = typeof course.title === "string" ? course.title.trim() : "";
  const payload: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(course)) {
    if (key === "slug" || key === "title") continue;
    payload[key] = val;
  }
  return { slug, title, payload };
}