"use client";

import { getApiBaseUrl } from "./auth/config";
import { getSessionAccessToken } from "./auth/session";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class TutorCvApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 0) {
    super(code);
    this.name = "TutorCvApiError";
    this.code = code;
    this.status = status;
  }
}

export interface BackendTutorLanguage {
  code: string;
  displayName: string;
  proficiency: "basic" | "conversational" | "professional" | "native";
}

export interface BackendTutorAvailability {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timezone: string;
}

export interface BackendTutorEducation {
  institution: string;
  qualification: string;
  fieldOfStudy: string;
  startYear: number;
  endYear: number | null;
  description: string;
}

export interface BackendTutorExperience {
  title: string;
  organization: string;
  startYear: number;
  endYear: number | null;
  description: string;
}

export interface BackendTutorCredential {
  title: string;
  evidenceUrl: string | null;
  verified: boolean;
}

export interface BackendTutorFaq {
  question: string;
  answer: string;
}

export interface BackendTutorPolicies {
  learnerCancellation: string | null;
  lateCancellation: string | null;
  noShow: string | null;
  bookingNotice: string | null;
  bookingWindowDays: number | null;
  lessonBufferMin: number | null;
  sameDayBooking: boolean;
}

export interface BackendTutorConsultation {
  enabled: boolean;
  durationMin: number | null;
  priceVnd: number | null;
  purpose: string | null;
}

export interface BackendTutorProfile {
  displayName: string;
  headline: string | null;
  bio: string | null;
  hourlyRateVnd: number | null;
  currency: "VND";
  teachingFormat: "online" | "in_person" | "both" | null;
  subjects: string[];
  levels: string[];
  regions: string[];
  languages: BackendTutorLanguage[];
  availability: BackendTutorAvailability[];
  education: BackendTutorEducation[];
  experience: BackendTutorExperience[];
  role: string | null;
  portfolioUrl: string | null;
  lessonDescription: string | null;
  policies: BackendTutorPolicies | null;
  rates: Record<string, number> | null;
  displayDuration: number | null;
  consultation: BackendTutorConsultation | null;
  credentials: BackendTutorCredential[];
  goals: string[];
  ageGroups: string[];
  teachingStyles: string[];
  faqs: BackendTutorFaq[];
  avatarUrl?: string | null;
  introVideoUrl?: string | null;
  verified?: boolean;
  verificationStatus?: "none" | "pending_review" | "verified";
}

export interface BackendTutorProfileRecord {
  id: string;
  version: number;
  publishedAt: string | null;
  profile: BackendTutorProfile;
}

export interface PublicTutorListItem {
  id: string;
  displayName: string;
  headline: string | null;
  hourlyRateVnd: number | null;
  regions: string[];
  subjects: string[];
  languages: { displayName: string; proficiency: string }[];
  teachingFormat: string | null;
  publishedAt: string;
}

export interface PublicTutorDetail extends BackendTutorProfile {
  id: string;
  disclosure: string;
}

export interface PublicTutorListResult {
  items: PublicTutorListItem[];
  nextCursor: string | null;
}

type FlatTutorRecord = {
  id?: unknown;
  version?: unknown;
  publishedAt?: unknown;
  displayName?: unknown;
  headline?: unknown;
  bio?: unknown;
  hourlyRateVnd?: unknown;
  teachingFormat?: unknown;
  subjects?: unknown;
  levels?: unknown;
  regions?: unknown;
  languages?: unknown;
  availability?: unknown;
  education?: unknown;
  experience?: unknown;
  role?: unknown;
  portfolioUrl?: unknown;
  lessonDescription?: unknown;
  policies?: unknown;
  rates?: unknown;
  displayDuration?: unknown;
  consultation?: unknown;
  credentials?: unknown;
  goals?: unknown;
  ageGroups?: unknown;
  teachingStyles?: unknown;
  faqs?: unknown;
  avatarUrl?: unknown;
  introVideoUrl?: unknown;
  verified?: unknown;
  verificationStatus?: unknown;
};

function isTutorRecord(value: unknown): value is FlatTutorRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as FlatTutorRecord;
  return typeof record.version === "number" && typeof record.id === "string";
}

function recordFromFlat(raw: FlatTutorRecord): BackendTutorProfileRecord {
  const stringArray = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  const nullableString = (value: unknown): string | null => (typeof value === "string" ? value : null);
  const teachingFormat = raw.teachingFormat === "online" || raw.teachingFormat === "in_person" || raw.teachingFormat === "both"
    ? raw.teachingFormat
    : null;
  const ratesFrom = (value: unknown): Record<string, number> | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const out: Record<string, number> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (typeof val === "number") out[key] = val;
    }
    return Object.keys(out).length > 0 ? out : null;
  };
  const policiesRaw = raw.policies && typeof raw.policies === "object" && !Array.isArray(raw.policies)
    ? (raw.policies as Record<string, unknown>)
    : null;
  const policies: BackendTutorProfile["policies"] = policiesRaw
    ? {
        learnerCancellation: nullableString(policiesRaw.learnerCancellation),
        lateCancellation: nullableString(policiesRaw.lateCancellation),
        noShow: nullableString(policiesRaw.noShow),
        bookingNotice: nullableString(policiesRaw.bookingNotice),
        bookingWindowDays: typeof policiesRaw.bookingWindowDays === "number" ? policiesRaw.bookingWindowDays : null,
        lessonBufferMin: typeof policiesRaw.lessonBufferMin === "number" ? policiesRaw.lessonBufferMin : null,
        sameDayBooking: policiesRaw.sameDayBooking === true,
      }
    : null;
  const consultationRaw = raw.consultation && typeof raw.consultation === "object" && !Array.isArray(raw.consultation)
    ? (raw.consultation as Record<string, unknown>)
    : null;
  const consultation: BackendTutorProfile["consultation"] = consultationRaw
    ? {
        enabled: consultationRaw.enabled === true,
        durationMin: typeof consultationRaw.durationMin === "number" ? consultationRaw.durationMin : null,
        priceVnd: typeof consultationRaw.priceVnd === "number" ? consultationRaw.priceVnd : null,
        purpose: nullableString(consultationRaw.purpose),
      }
    : null;
  const credentials = Array.isArray(raw.credentials)
    ? (raw.credentials as BackendTutorProfile["credentials"])
    : [];
  const faqs = Array.isArray(raw.faqs)
    ? (raw.faqs as BackendTutorProfile["faqs"])
    : [];
  const verificationStatus = raw.verificationStatus === "verified" || raw.verificationStatus === "pending_review"
    ? raw.verificationStatus
    : "none";
  return {
    id: raw.id as string,
    version: raw.version as number,
    publishedAt: typeof raw.publishedAt === "string" ? raw.publishedAt : null,
    profile: {
      displayName: typeof raw.displayName === "string" ? raw.displayName : "",
      headline: typeof raw.headline === "string" ? raw.headline : null,
      bio: typeof raw.bio === "string" ? raw.bio : null,
      hourlyRateVnd: typeof raw.hourlyRateVnd === "number" ? raw.hourlyRateVnd : null,
      currency: "VND",
      teachingFormat,
      subjects: stringArray(raw.subjects),
      levels: stringArray(raw.levels),
      regions: stringArray(raw.regions),
      languages: Array.isArray(raw.languages) ? (raw.languages as BackendTutorProfile["languages"]) : [],
      availability: Array.isArray(raw.availability) ? (raw.availability as BackendTutorProfile["availability"]) : [],
      education: Array.isArray(raw.education) ? (raw.education as BackendTutorProfile["education"]) : [],
      experience: Array.isArray(raw.experience) ? (raw.experience as BackendTutorProfile["experience"]) : [],
      role: nullableString(raw.role),
      portfolioUrl: nullableString(raw.portfolioUrl),
      lessonDescription: nullableString(raw.lessonDescription),
      policies,
      rates: ratesFrom(raw.rates),
      displayDuration: typeof raw.displayDuration === "number" ? raw.displayDuration : null,
      consultation,
      credentials,
      goals: stringArray(raw.goals),
      ageGroups: stringArray(raw.ageGroups),
      teachingStyles: stringArray(raw.teachingStyles),
      faqs,
      avatarUrl: nullableString(raw.avatarUrl),
      introVideoUrl: nullableString(raw.introVideoUrl),
      verified: raw.verified === true,
      verificationStatus,
    },
  };
}

async function profileResponse(
  response: Response,
  options: { allowNull?: boolean } = {},
): Promise<BackendTutorProfileRecord | null> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new TutorCvApiError("INVALID_RESPONSE", response.status);
  }
  if (!response.ok) {
    const code = typeof (payload as { error?: { code?: string } } | null)?.error?.code === "string"
      ? (payload as { error: { code: string } }).error.code
      : "INTERNAL_ERROR";
    if (options.allowNull && response.status === 404 && code === "TUTOR_CV_NOT_FOUND") {
      return null;
    }
    throw new TutorCvApiError(code, response.status);
  }
  if ((payload as { ok?: unknown } | null)?.ok !== true) {
    throw new TutorCvApiError("INVALID_RESPONSE", response.status);
  }
  const raw = (payload as { profile?: unknown }).profile;
  if (!isTutorRecord(raw)) {
    throw new TutorCvApiError("INVALID_RESPONSE", 500);
  }
  return recordFromFlat(raw);
}

async function request(path: string, { method = "GET", body, authenticated = false }: { method?: string; body?: unknown; authenticated?: boolean } = {}): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (authenticated) {
    const token = getSessionAccessToken();
    if (!token) throw new TutorCvApiError("UNAUTHORIZED", 401);
    headers.Authorization = `Bearer ${token}`;
  }
  return fetch(`${getApiBaseUrl().replace(/\/$/, "")}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "omit",
    cache: "no-store",
  });
}

export async function getMyTutorCv(): Promise<{ id: string; version: number; publishedAt: string | null; profile: BackendTutorProfile } | null> {
  return profileResponse(await request("/api/v1/me/tutor-cv", { authenticated: true }), { allowNull: true });
}

export async function saveMyTutorCv(profile: BackendTutorProfile, expectedVersion: number | null): Promise<{ id: string; version: number; publishedAt: string | null; profile: BackendTutorProfile }> {
  const result = await profileResponse(await request("/api/v1/me/tutor-cv", { method: "PUT", body: { profile, expectedVersion }, authenticated: true }));
  if (!result) throw new TutorCvApiError("INVALID_RESPONSE", 500);
  return result;
}

export async function publishMyTutorCv(expectedVersion: number): Promise<{ id: string; version: number; publishedAt: string | null; profile: BackendTutorProfile }> {
  const result = await profileResponse(await request("/api/v1/me/tutor-cv/publish", { method: "POST", body: { expectedVersion }, authenticated: true }));
  if (!result) throw new TutorCvApiError("INVALID_RESPONSE", 500);
  return result;
}

export async function unpublishMyTutorCv(expectedVersion: number): Promise<{ id: string; version: number; publishedAt: string | null; profile: BackendTutorProfile }> {
  const result = await profileResponse(await request("/api/v1/me/tutor-cv/unpublish", { method: "POST", body: { expectedVersion }, authenticated: true }));
  if (!result) throw new TutorCvApiError("INVALID_RESPONSE", 500);
  return result;
}

export async function listTutors(filters: Record<string, string | number | undefined> = {}): Promise<PublicTutorListResult> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const query = params.size ? `?${params}` : "";
  const response = await request(`/api/v1/tutors${query}`);
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new TutorCvApiError("INVALID_RESPONSE", response.status);
  }
  if (!response.ok) {
    throw new TutorCvApiError("INVALID_RESPONSE", response.status);
  }
  if ((payload as { ok?: unknown } | null)?.ok !== true) {
    throw new TutorCvApiError("INVALID_RESPONSE", response.status);
  }
  const body = payload as { items?: unknown; nextCursor?: unknown };
  if (!Array.isArray(body.items) || !(body.nextCursor === null || typeof body.nextCursor === "string")) {
    throw new TutorCvApiError("INVALID_RESPONSE", 500);
  }
  const items = body.items as PublicTutorListItem[];
  if (items.some((item) => !item || typeof item !== "object" || !UUID.test(String(item.id)) || typeof item.displayName !== "string")) {
    throw new TutorCvApiError("INVALID_RESPONSE", 500);
  }
  return { items, nextCursor: body.nextCursor };
}

export async function getTutor(id: string): Promise<PublicTutorDetail> {
  const response = await request(`/api/v1/tutors/${encodeURIComponent(id)}`);
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new TutorCvApiError("INVALID_RESPONSE", response.status);
  }
  if (!response.ok || (payload as { ok?: unknown } | null)?.ok !== true) {
    throw new TutorCvApiError("INVALID_RESPONSE", response.status);
  }
  const tutor = (payload as { profile?: unknown }).profile;
  if (!tutor || typeof tutor !== "object") {
    throw new TutorCvApiError("INVALID_RESPONSE", 500);
  }
  return tutor as PublicTutorDetail;
}

export function isPublicTutorUuid(value: string): boolean {
  return UUID.test(value);
}