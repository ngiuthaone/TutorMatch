"use client";

import { getApiBaseUrl } from "./auth/config";
import { getSessionAccessToken } from "./auth/session";

export class TutorDashboardApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 0, message?: string) {
    super(message || code);
    this.name = "TutorDashboardApiError";
    this.code = code;
    this.status = status;
  }
}

export interface TutorDashboardRating {
  count: number;
  average: number | null;
}

export interface TutorDashboardSummary {
  tutorProfile: {
    id: string;
    displayName: string;
    headline: string | null;
    publicationStatus: string;
    verificationStatus: string;
    hourlyRateVnd: number | null;
    avatarObjectPath: string | null;
  };
  todayCount: number;
  upcomingCount: number;
  monthEarningsVnd: number;
  monthCompletedCount: number;
  rating: TutorDashboardRating;
  pendingBookingsCount: number;
}

export interface TutorDashboardResult {
  isTutor: boolean;
  dashboard: TutorDashboardSummary | null;
}

async function request<T>(path: string, init?: RequestInit & { authenticated?: boolean }): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init?.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  if (init?.authenticated) {
    const token = getSessionAccessToken();
    if (!token) throw new TutorDashboardApiError("UNAUTHORIZED", 401, "Sign in required.");
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${getApiBaseUrl().replace(/\/$/, "")}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers ?? {}) },
    credentials: "omit",
    cache: "no-store",
  });
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    throw new TutorDashboardApiError("INVALID_RESPONSE", response.status);
  }
  if (!response.ok) {
    const code = typeof (payload as { error?: { code?: string } } | null)?.error?.code === "string"
      ? (payload as { error: { code: string } }).error.code
      : "INTERNAL_ERROR";
    throw new TutorDashboardApiError(code, response.status);
  }
  if ((payload as { ok?: unknown } | null)?.ok !== true) {
    throw new TutorDashboardApiError("INVALID_RESPONSE", response.status);
  }
  return payload as T;
}

export async function getMyTutorDashboard(): Promise<TutorDashboardResult> {
  return request<TutorDashboardResult>("/api/v1/me/tutor-dashboard", { authenticated: true });
}

export async function submitTutorReview(input: { bookingId: string; rating: number; body: string }): Promise<unknown> {
  return request("/api/v1/me/tutor-reviews", {
    method: "POST",
    authenticated: true,
    body: JSON.stringify(input),
  });
}
