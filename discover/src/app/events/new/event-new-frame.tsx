"use client";

import { useEffect, useState } from "react";

import { isLiveMode, getApiBaseUrl } from "@/lib/auth/config";
import { getUserFromStorage } from "@/lib/types";

type PublishedEventMessage = {
  type: "tutoria-event-published";
  slug: string;
};

type GetIdentityMessage = {
  type: "tutoria-creator-get-identity";
  requestId: string;
};

function isPublishedEventMessage(data: unknown): data is PublishedEventMessage {
  if (!data || typeof data !== "object") return false;
  const candidate = data as { type?: unknown; slug?: unknown };
  return (
    candidate.type === "tutoria-event-published" && typeof candidate.slug === "string"
  );
}

function isGetIdentityMessage(data: unknown): data is GetIdentityMessage {
  if (!data || typeof data !== "object") return false;
  const candidate = data as { type?: unknown; requestId?: unknown };
  return (
    candidate.type === "tutoria-creator-get-identity" &&
    typeof candidate.requestId === "string"
  );
}

function buildBaseSrc(existingSearch: string, apiBaseParam: string): string {
  let prefix = "/event-creator-reference.html";
  if (existingSearch) prefix += existingSearch;

  if (apiBaseParam) {
    prefix += existingSearch ? `&${apiBaseParam}` : `?${apiBaseParam}`;
  }

  return prefix;
}

function withCacheBuster(src: string): string {
  const joiner = src.includes("?") ? "&" : "?";
  return `${src}${joiner}v=${Date.now()}`;
}

function readTutorProfileSubmission(): {
  role?: string;
  experience?: string;
  bio?: string;
  photoUrl?: string;
} {
  try {
    const raw = localStorage.getItem("tutoria_tutor_profile_submission");
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const skills = Array.isArray(parsed.skills) ? parsed.skills : [];
    return {
      role: typeof parsed.role === "string" ? parsed.role.trim() : undefined,
      experience: skills.length ? `Teaches ${skills.join(", ")}` : undefined,
      bio:
        (typeof parsed.about === "string" && parsed.about.trim()) ||
        (typeof parsed.headline === "string" && parsed.headline.trim()) ||
        undefined,
      photoUrl: typeof parsed.photoUrl === "string" ? parsed.photoUrl : undefined,
    };
  } catch {
    return {};
  }
}

function buildIdentity(): {
  id: string;
  host: string;
  role: string;
  experience: string;
  bio: string;
  image: string;
} {
  const user = getUserFromStorage();
  const tutor = readTutorProfileSubmission();
  const id = user?.id || "";
  const host = user?.name || "";
  return {
    id,
    host,
    role: tutor.role || user?.role || "",
    experience: tutor.experience || "",
    bio: tutor.bio || "",
    image: tutor.photoUrl || user?.avatarUrl || "",
  };
}

export function EventNewFrame() {
  const [frameSrc, setFrameSrc] = useState<string>(() => {
    if (typeof window === "undefined") return "/event-creator-reference.html";
    const existingSearch = window.location.search;
    const live = isLiveMode();
    const apiBase = live ? getApiBaseUrl() : "";
    const apiBaseParam = apiBase ? `apiBaseUrl=${encodeURIComponent(apiBase)}` : "";
    return withCacheBuster(buildBaseSrc(existingSearch, apiBaseParam));
  });

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as unknown;

      if (isPublishedEventMessage(data)) {
        window.location.assign(`/events/${encodeURIComponent(data.slug)}`);
        return;
      }

      if (isGetIdentityMessage(data) && event.source) {
        const identity = buildIdentity();
        try {
          (event.source as Window).postMessage(
            {
              type: "tutoria-creator-identity",
              requestId: data.requestId,
              identity,
            },
            "*"
          );
        } catch {
          // The iframe may have been torn down between request and reply; ignore.
        }
        return;
      }
    }
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, []);

  return (
    <iframe
      title="Create an event or workshop"
      src={frameSrc}
      style={{ display: "block", width: "100%", height: "100dvh", border: 0 }}
    />
  );
}
