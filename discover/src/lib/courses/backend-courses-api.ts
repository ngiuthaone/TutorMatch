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
export interface SectionInput {
  title: string;
  position?: number;
}

export interface LessonInput {
  title: string;
  lesson_type: "video" | "text" | "quiz" | "resource";
  position?: number;
  video_url?: string;
  text_content?: string;
  is_preview?: boolean;
}

export interface CourseUpdateInput {
  title?: string;
  slug?: string;
  description?: string;
  cover_url?: string;
  status?: "draft" | "published";
  sections?: SectionInput[];
}

export interface BackendSectionResult {
  id: string;
  title: string;
  position: number;
  course_id: string;
}

export interface BackendLessonResult {
  id: string;
  title: string;
  lesson_type: "video" | "text" | "quiz" | "resource";
  position: number;
  section_id: string;
  video_url?: string;
  text_content?: string;
  is_preview: boolean;
}

async function requestWithAuth(path: string, options: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown } = {}): Promise<unknown> {
  const token = getSessionAccessToken();
  if (!token) throw new BackendCourseApiError("UNAUTHORIZED", 401, "Sign in to manage courses.");
  const response = await fetch(`${getApiBaseUrl().replace(/\/$/, "")}${path}`, {
    method: options.method ?? "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...(options.body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: "omit",
    cache: "no-store",
  });
  const payload = await parseJson(response);
  if (!response.ok) throw readApiError(response, payload, "Course operation failed.");
  return payload;
}

export async function getBackendCourse(courseId: string): Promise<BackendCourseResult> {
  try {
    const base = getApiBaseUrl().replace(/\/$/, "");
    const response = await fetch(`${base}/api/v1/marketplace/course/${encodeURIComponent(courseId)}`, {
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

export async function updateBackendCourse(courseId: string, input: CourseUpdateInput): Promise<BackendCourseResult> {
  const response = (await requestWithAuth(`/api/v1/marketplace/course/${encodeURIComponent(courseId)}`, {
    method: "PUT",
    body: input,
  })) as { ok?: unknown; item?: unknown };
  if (response.ok !== true || !response.item || typeof response.item !== "object") {
    throw new BackendCourseApiError("INVALID_RESPONSE", 500, "The backend did not return the updated course.");
  }
  return { status: "ok", data: response.item as BackendCourse };
}

export async function createBackendSection(courseId: string, input: SectionInput): Promise<BackendSectionResult> {
  const response = (await requestWithAuth(`/api/v1/marketplace/course/${encodeURIComponent(courseId)}/sections`, {
    method: "POST",
    body: input,
  })) as { ok?: unknown; item?: unknown };
  if (response.ok !== true || !response.item || typeof response.item !== "object") {
    throw new BackendCourseApiError("INVALID_RESPONSE", 500, "The backend did not return the created section.");
  }
  return response.item as BackendSectionResult;
}

export async function updateBackendSection(sectionId: string, input: SectionInput): Promise<BackendSectionResult> {
  const response = (await requestWithAuth(`/api/v1/marketplace/section/${encodeURIComponent(sectionId)}`, {
    method: "PUT",
    body: input,
  })) as { ok?: unknown; item?: unknown };
  if (response.ok !== true || !response.item || typeof response.item !== "object") {
    throw new BackendCourseApiError("INVALID_RESPONSE", 500, "The backend did not return the updated section.");
  }
  return response.item as BackendSectionResult;
}

export async function deleteBackendSection(sectionId: string): Promise<void> {
  await requestWithAuth(`/api/v1/marketplace/section/${encodeURIComponent(sectionId)}`, {
    method: "DELETE",
  });
}

export async function createBackendLesson(sectionId: string, input: LessonInput): Promise<BackendLessonResult> {
  const response = (await requestWithAuth(`/api/v1/marketplace/section/${encodeURIComponent(sectionId)}/lessons`, {
    method: "POST",
    body: input,
  })) as { ok?: unknown; item?: unknown };
  if (response.ok !== true || !response.item || typeof response.item !== "object") {
    throw new BackendCourseApiError("INVALID_RESPONSE", 500, "The backend did not return the created lesson.");
  }
  return response.item as BackendLessonResult;
}

export async function updateBackendLesson(lessonId: string, input: LessonInput): Promise<BackendLessonResult> {
  const response = (await requestWithAuth(`/api/v1/marketplace/lesson/${encodeURIComponent(lessonId)}`, {
    method: "PUT",
    body: input,
  })) as { ok?: unknown; item?: unknown };
  if (response.ok !== true || !response.item || typeof response.item !== "object") {
    throw new BackendCourseApiError("INVALID_RESPONSE", 500, "The backend did not return the updated lesson.");
  }
  return response.item as BackendLessonResult;
}

export async function deleteBackendLesson(lessonId: string): Promise<void> {
  await requestWithAuth(`/api/v1/marketplace/lesson/${encodeURIComponent(lessonId)}`, {
    method: "DELETE",
  });
}

export async function reorderBackendLessons(sectionId: string, lessonIds: string[]): Promise<void> {
  await requestWithAuth(`/api/v1/marketplace/section/${encodeURIComponent(sectionId)}/lessons/reorder`, {
    method: "PUT",
    body: { lesson_ids: lessonIds },
  });
}

export async function reorderBackendSections(courseId: string, sectionIds: string[]): Promise<void> {
  await requestWithAuth(`/api/v1/marketplace/course/${encodeURIComponent(courseId)}/sections/reorder`, {
    method: "PUT",
    body: { section_ids: sectionIds },
  });
}

export interface CourseLessonProgress {
  lessonId: string;
  videoPosition: number;
  completed: boolean;
  completedAt: string | null;
}

export interface CourseProgress {
  courseId: string;
  enrollmentId: string;
  completedLessons: number;
  totalLessons: number;
  percentComplete: number;
  lessons: CourseLessonProgress[];
  enrolledAt: string;
  completedAt: string | null;
}

export async function updateLessonProgress(lessonId: string, completed: boolean): Promise<void> {
  await requestWithAuth("/api/v1/marketplace/lesson-progress", {
    method: "POST",
    body: { lesson_id: lessonId, completed },
  });
}

export async function updateLessonVideoPosition(lessonId: string, position: number): Promise<void> {
  await requestWithAuth("/api/v1/marketplace/lesson-progress/position", {
    method: "PUT",
    body: { lesson_id: lessonId, position },
  });
}

export async function getLessonProgress(lessonId: string): Promise<CourseLessonProgress | null> {
  try {
    const response = (await requestWithAuth(`/api/v1/marketplace/lesson-progress/${encodeURIComponent(lessonId)}`)) as {
      ok?: boolean;
      item?: CourseLessonProgress;
    };
    if (response.ok !== true || !response.item) return null;
    return response.item;
  } catch {
    return null;
  }
}

export async function getCourseProgress(courseId: string): Promise<CourseProgress | null> {
  try {
    const response = (await requestWithAuth(`/api/v1/marketplace/course/${encodeURIComponent(courseId)}/progress`)) as {
      ok?: boolean;
      item?: CourseProgress;
    };
    if (response.ok !== true || !response.item) return null;
    return response.item;
  } catch {
    return null;
  }
}

export async function markCourseComplete(courseId: string): Promise<void> {
  await requestWithAuth(`/api/v1/marketplace/course/${encodeURIComponent(courseId)}/complete`, {
    method: "POST",
  });
}

export async function getSignedVideoUrl(videoPath: string): Promise<string> {
  const response = (await requestWithAuth("/api/v1/marketplace/video-url", {
    method: "POST",
    body: { video_path: videoPath },
  })) as { ok?: boolean; url?: string };
  if (response.ok !== true || !response.url) {
    throw new BackendCourseApiError("VIDEO_URL_FAILED", 500, "Failed to get video URL.");
  }
  return response.url;
}
