import { TutoriaApiError } from "../types/auth";
import type {
  BackendCourse,
  BackendCourseResult,
  BackendCoursePublishInput,
  BackendCoursePublishResult,
  SectionInput,
  LessonInput,
  CourseUpdateInput,
  BackendSectionResult,
  BackendLessonResult,
  CourseLessonProgress,
  CourseProgress,
} from "../types/course";

const STRIPPED_KEYS = new Set([
  "creatorId", "creatorEmail", "hostEmail", "hostId", "authId", "creatorUserId",
  "creator_id", "creator_email", "host_email", "host_id", "auth_id", "creator",
  "phone", "phoneNumber", "contactPhone", "hostPhone",
  "hostName", "hostNameOverride",
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

async function getAuthToken(): Promise<string | null> {
  // This will be implemented by the mobile app using SecureStore/AsyncStorage
  // For now, return null - the mobile app will inject its own token getter
  return null;
}

async function getApiBaseUrl(): Promise<string> {
  // This will be configured by the mobile app
  return process.env.EXPO_PUBLIC_API_BASE_URL || "";
}

async function request(path: string, options: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown } = {}): Promise<unknown> {
  const token = await getAuthToken();
  if (!token && options.method !== "GET") throw new TutoriaApiError("UNAUTHORIZED", 401, "Sign in to continue.");
  
  const baseUrl = await getApiBaseUrl();
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload as { error?: { code?: unknown; message?: unknown } } | null;
    const code = typeof error?.error?.code === "string" ? error.error.code : fallbackCodeForStatus(response.status);
    const message = typeof error?.error?.message === "string" ? error.error.message : fallbackMessage(response.status);
    throw new TutoriaApiError(code, response.status, message);
  }
  return payload;
}

function fallbackCodeForStatus(status: number): string {
  if (status === 409) return "SLUG_CONFLICT";
  if (status === 400) return "INVALID";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  return "REQUEST_FAILED";
}

function fallbackMessage(status: number): string {
  if (status === 409) return "A course with this slug already exists.";
  if (status === 401) return "Please sign in to continue.";
  return "An error occurred. Please try again.";
}

// Public course fetch (no auth required)
export async function getBackendCourseBySlug(slug: string): Promise<BackendCourseResult> {
  try {
    const baseUrl = await getApiBaseUrl();
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/v1/marketplace/course/${encodeURIComponent(slug)}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (response.status === 404) return { status: "not_found" };
    if (!response.ok) return { status: "unavailable" };
    const body = await response.json() as { ok?: boolean; item?: BackendCourse };
    if (body.ok !== true || !body.item) return { status: "not_found" };
    return { status: "ok", data: body.item };
  } catch {
    return { status: "unavailable" };
  }
}

// Authenticated course operations
export async function publishBackendCourse(input: BackendCoursePublishInput): Promise<BackendCoursePublishResult> {
  const payload = stripPayloadKeys(input.payload);
  const response = await request("/api/v1/marketplace/course", {
    method: "POST",
    body: { slug: input.slug, title: input.title, payload },
  });
  if (!response || typeof response !== "object" || !("ok" in response) || response.ok !== true) {
    throw new TutoriaApiError("INVALID_RESPONSE", 500, "The backend did not return the published course.");
  }
  return response as BackendCoursePublishResult;
}

export async function getBackendCourse(courseId: string): Promise<BackendCourseResult> {
  try {
    const baseUrl = await getApiBaseUrl();
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/v1/marketplace/course/${encodeURIComponent(courseId)}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (response.status === 404) return { status: "not_found" };
    if (!response.ok) return { status: "unavailable" };
    const body = await response.json() as { ok?: boolean; item?: BackendCourse };
    if (body.ok !== true || !body.item) return { status: "not_found" };
    return { status: "ok", data: body.item };
  } catch {
    return { status: "unavailable" };
  }
}

export async function updateBackendCourse(courseId: string, input: CourseUpdateInput): Promise<BackendCourseResult> {
  const response = await request(`/api/v1/marketplace/course/${encodeURIComponent(courseId)}`, {
    method: "PUT",
    body: input,
  });
  if (!response || typeof response !== "object" || !("ok" in response) || response.ok !== true) {
    throw new TutoriaApiError("INVALID_RESPONSE", 500, "The backend did not return the updated course.");
  }
  return { status: "ok", data: response as BackendCourse };
}

export async function createBackendSection(courseId: string, input: SectionInput): Promise<BackendSectionResult> {
  const response = await request(`/api/v1/marketplace/course/${encodeURIComponent(courseId)}/sections`, {
    method: "POST",
    body: input,
  });
  return response as BackendSectionResult;
}

export async function updateBackendSection(sectionId: string, input: SectionInput): Promise<BackendSectionResult> {
  const response = await request(`/api/v1/marketplace/section/${encodeURIComponent(sectionId)}`, {
    method: "PUT",
    body: input,
  });
  return response as BackendSectionResult;
}

export async function deleteBackendSection(sectionId: string): Promise<void> {
  await request(`/api/v1/marketplace/section/${encodeURIComponent(sectionId)}`, { method: "DELETE" });
}

export async function createBackendLesson(sectionId: string, input: LessonInput): Promise<BackendLessonResult> {
  const response = await request(`/api/v1/marketplace/section/${encodeURIComponent(sectionId)}/lessons`, {
    method: "POST",
    body: input,
  });
  return response as BackendLessonResult;
}

export async function updateBackendLesson(lessonId: string, input: LessonInput): Promise<BackendLessonResult> {
  const response = await request(`/api/v1/marketplace/lesson/${encodeURIComponent(lessonId)}`, {
    method: "PUT",
    body: input,
  });
  return response as BackendLessonResult;
}

export async function deleteBackendLesson(lessonId: string): Promise<void> {
  await request(`/api/v1/marketplace/lesson/${encodeURIComponent(lessonId)}`, { method: "DELETE" });
}

export async function reorderBackendLessons(sectionId: string, lessonIds: string[]): Promise<void> {
  await request(`/api/v1/marketplace/section/${encodeURIComponent(sectionId)}/lessons/reorder`, {
    method: "PUT",
    body: { lesson_ids: lessonIds },
  });
}

export async function reorderBackendSections(courseId: string, sectionIds: string[]): Promise<void> {
  await request(`/api/v1/marketplace/course/${encodeURIComponent(courseId)}/sections/reorder`, {
    method: "PUT",
    body: { section_ids: sectionIds },
  });
}

// Progress tracking
export async function updateLessonProgress(lessonId: string, completed: boolean): Promise<void> {
  await request("/api/v1/marketplace/lesson-progress", { method: "POST", body: { lesson_id: lessonId, completed } });
}

export async function updateLessonVideoPosition(lessonId: string, position: number): Promise<void> {
  await request("/api/v1/marketplace/lesson-progress/position", { method: "PUT", body: { lesson_id: lessonId, position } });
}

export async function getLessonProgress(lessonId: string): Promise<CourseLessonProgress | null> {
  try {
    const response = await request(`/api/v1/marketplace/lesson-progress/${encodeURIComponent(lessonId)}`);
    return response as CourseLessonProgress;
  } catch {
    return null;
  }
}

export async function getCourseProgress(courseId: string): Promise<CourseProgress | null> {
  try {
    const response = await request(`/api/v1/marketplace/course/${encodeURIComponent(courseId)}/progress`);
    return response as CourseProgress;
  } catch {
    return null;
  }
}

export async function markCourseComplete(courseId: string): Promise<void> {
  await request(`/api/v1/marketplace/course/${encodeURIComponent(courseId)}/complete`, { method: "POST" });
}

export async function getSignedVideoUrl(videoPath: string): Promise<string> {
  const response = await request("/api/v1/marketplace/video-url", { method: "POST", body: { video_path: videoPath } });
  if (!response || typeof response !== "object" || !("url" in response) || !response.url) {
    throw new TutoriaApiError("VIDEO_URL_FAILED", 500, "Failed to get video URL.");
  }
  return response.url as string;
}

// Configuration setters for the mobile app to inject
let authTokenGetter: (() => Promise<string | null>) | null = null;
let apiBaseUrlGetter: (() => Promise<string>) | null = null;

export function setAuthTokenGetter(getter: () => Promise<string | null>): void {
  authTokenGetter = getter;
}

export function setApiBaseUrlGetter(getter: () => Promise<string>): void {
  apiBaseUrlGetter = getter;
}

// Override the internal getters
async function getAuthTokenImpl(): Promise<string | null> {
  return authTokenGetter ? authTokenGetter() : null;
}

async function getApiBaseUrlImpl(): Promise<string> {
  return apiBaseUrlGetter ? apiBaseUrlGetter() : (process.env.EXPO_PUBLIC_API_BASE_URL || "");
}
