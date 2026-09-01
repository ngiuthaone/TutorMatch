import { getApiBaseUrl } from "@/lib/auth/config";
import { getSessionAccessToken } from "@/lib/auth/session";

export interface BackendCourse {
  id: string;
  kind: "course";
  slug: string;
  title: string;
  payload: Record<string, unknown>;
  publishedAt: string;
  status: string;
  version: number;
}

export type BackendCourseResult =
  | { status: "ok"; data: BackendCourse }
  | { status: "not_found" | "unavailable" };

export class BackendCourseApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status = 0, message = code) {
    super(message);
    this.name = "BackendCourseApiError";
    this.code = code;
    this.status = status;
  }
}

export type BackendCoursePublishInput = {
  slug: string;
  title: string;
  payload: Record<string, unknown>;
};

export interface BackendCoursePublishResult {
  id: string;
  kind: "course";
  slug: string;
  title: string;
  payload: Record<string, unknown>;
  publishedAt: string;
  status: string;
  version: number;
}

type ApiPayload = { error?: { code?: unknown; message?: unknown }; item?: unknown };

function readApiError(response: Response, payload: unknown, fallbackMessage: string): BackendCourseApiError {
  const error = payload as ApiPayload | null;
  const code = typeof error?.error?.code === "string" ? error.error.code : fallbackCodeForStatus(response.status, fallbackMessage);
  const message = typeof error?.error?.message === "string" ? error.error.message : fallbackMessage;
  return new BackendCourseApiError(code, response.status, message);
}

function fallbackCodeForStatus(status: number, fallback: string): string {
  if (status === 409) return "SLUG_CONFLICT";
  if (status === 400) return "INVALID";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  return fallback;
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new BackendCourseApiError("INVALID_RESPONSE", response.status);
  }
}

async function request(path: string, options: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<unknown> {
  const token = getSessionAccessToken();
  if (!token) throw new BackendCourseApiError("UNAUTHORIZED", 401, "Sign in to publish a course.");
  const response = await fetch(`${getApiBaseUrl().replace(/\/$/, "")}${path}`, {
    method: options.method ?? "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...(options.body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: "omit",
    cache: "no-store",
  });
  const payload = await parseJson(response);
  if (!response.ok) throw readApiError(response, payload, "Marketplace is temporarily unavailable.");
  return payload;
}

/**
 * Fetch a single published course from the production backend by slug.
 * This endpoint is public (no auth required); RLS enforces status='published'.
 */
export async function getBackendCourseBySlug(slug: string): Promise<BackendCourseResult> {
  try {
    const base = getApiBaseUrl().replace(/\/$/, "");
    const response = await fetch(`${base}/api/v1/marketplace/course/${encodeURIComponent(slug)}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (response.status === 404) return { status: "not_found" };
    if (!response.ok) return { status: "unavailable" };
    const body = (await response.json()) as { ok?: boolean; item?: BackendCourse };
    if (body.ok !== true || !body.item) return { status: "not_found" };
    return { status: "ok", data: body.item };
  } catch {
    return { status: "unavailable" };
  }
}

/**
 * Publish a course to the production backend. Creator identity is always
 * derived from the caller's JWT server-side; this function strips client-side
 * identity/contact keys as defense-in-depth (the backend route also strips
 * them and the marketplace service applies its own scrub before persistence).
 */
export async function publishBackendCourse(input: BackendCoursePublishInput): Promise<BackendCoursePublishResult> {
  const payload = stripPayloadKeys(input.payload);
  const response = (await request("/api/v1/marketplace/course", {
    method: "POST",
    body: { slug: input.slug, title: input.title, payload },
  })) as { ok?: unknown; item?: unknown };
  if (response.ok !== true || !response.item || typeof response.item !== "object") {
    throw new BackendCourseApiError("INVALID_RESPONSE", 500, "The backend did not return the published course.");
  }
  return response.item as BackendCoursePublishResult;
}

const STRIPPED_KEYS = new Set([
  "creatorId", "creatorEmail", "hostEmail", "hostId", "authId", "creatorUserId",
  "creator_id", "creator_email", "host_email", "host_id", "auth_id", "creator",
  "phone", "phoneNumber", "contactPhone", "hostPhone",
  "hostName", "hostNameOverride",
  // Reserved: the backend stores slug/title as dedicated columns, not in payload.
  "slug", "title",
]);

function stripPayloadKeys(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (STRIPPED_KEYS.has(key)) continue;
    out[key] = value;
  }
  return out;
}