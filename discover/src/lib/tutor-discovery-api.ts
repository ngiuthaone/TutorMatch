export {
  listTutors,
  getTutor,
  isPublicTutorUuid,
  TutorCvApiError,
  type PublicTutorListItem,
  type PublicTutorListResult,
  type PublicTutorDetail,
} from "./tutor-cv-api";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface TutorDiscoveryFilters {
  subject?: string;
  level?: string;
  format?: "online" | "in_person" | "both";
  minRate?: number;
  maxRate?: number;
  cursor?: string | null;
  sort?: "rating" | "recent";
  limit?: number;
}

export interface TutorCardSummary {
  id: string;
  displayName: string;
  headline: string | null;
  avatarUrl: string | null;
  hourlyRateVnd: number | null;
  subjects: string[];
  languages: { displayName: string; proficiency: string }[];
  teachingFormat: string | null;
  regions: string[];
  publishedAt: string | null;
  rating: { count: number; average: number | null };
}

function buildQuery(filters: TutorDiscoveryFilters): string {
  const params = new URLSearchParams();
  if (filters.subject) params.set("subject", filters.subject);
  if (filters.level) params.set("level", filters.level);
  if (filters.format) params.set("format", filters.format);
  if (typeof filters.minRate === "number") params.set("minRate", String(filters.minRate));
  if (typeof filters.maxRate === "number") params.set("maxRate", String(filters.maxRate));
  if (filters.cursor) params.set("cursor", filters.cursor);
  params.set("sort", filters.sort ?? "rating");
  if (typeof filters.limit === "number") params.set("limit", String(filters.limit));
  return params.size ? `?${params}` : "";
}

function getApiBase(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }
  return "";
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? (value as unknown[]).filter((entry): entry is string => typeof entry === "string")
    : [];
}

function normalizeLanguages(value: unknown): { displayName: string; proficiency: string }[] {
  if (!Array.isArray(value)) return [];
  return (value as { displayName?: unknown; proficiency?: unknown }[]).map((lang) => ({
    displayName: asString(lang.displayName) ?? "",
    proficiency: asString(lang.proficiency) ?? "",
  }));
}

function ratingFrom(value: unknown): TutorCardSummary["rating"] {
  if (value && typeof value === "object") {
    const record = value as { count?: unknown; average?: unknown };
    return {
      count: asNumber(record.count) ?? 0,
      average: asNumber(record.average),
    };
  }
  return { count: 0, average: null };
}

export async function listTutorCards(
  filters: TutorDiscoveryFilters,
  pageParam?: string | null,
): Promise<{ items: TutorCardSummary[]; nextCursor: string | null }> {
  const base = getApiBase().replace(/\/$/, "");
  const response = await fetch(
    `${base}/api/v1/tutors${buildQuery({ ...filters, cursor: pageParam ?? filters.cursor ?? null })}`,
    { cache: "no-store", headers: { Accept: "application/json" } },
  );
  if (!response.ok) return { items: [], nextCursor: null };
  const payload = (await response.json()) as { ok?: boolean; items?: unknown; nextCursor?: unknown };
  if (payload.ok !== true || !Array.isArray(payload.items)) return { items: [], nextCursor: null };
  const items = (payload.items as Record<string, unknown>[])
    .filter((item) => {
      const id = asString(item.id);
      return id !== null && UUID.test(id);
    })
    .map((item) => ({
      id: asString(item.id) as string,
      displayName: asString(item.displayName) ?? "",
      headline: asString(item.headline),
      avatarUrl: asString(item.avatarUrl),
      hourlyRateVnd: asNumber(item.hourlyRateVnd),
      subjects: asStringArray(item.subjects),
      languages: normalizeLanguages(item.languages),
      teachingFormat: asString(item.teachingFormat),
      regions: asStringArray(item.regions),
      publishedAt: asString(item.publishedAt),
      rating: ratingFrom(item.rating),
    }));
  return {
    items,
    nextCursor: typeof payload.nextCursor === "string" ? payload.nextCursor : null,
  };
}

export async function getTutorCard(id: string): Promise<TutorCardSummary | null> {
  if (!UUID.test(id)) return null;
  const base = getApiBase().replace(/\/$/, "");
  const response = await fetch(
    `${base}/api/v1/tutors/${encodeURIComponent(id)}`,
    { cache: "no-store", headers: { Accept: "application/json" } },
  );
  if (!response.ok) return null;
  const payload = (await response.json()) as { ok?: boolean; profile?: unknown };
  if (payload.ok !== true || !payload.profile || typeof payload.profile !== "object") return null;
  const profile = payload.profile as Record<string, unknown>;
  return {
    id: asString(profile.id) ?? id,
    displayName: asString(profile.displayName) ?? "",
    headline: asString(profile.headline),
    avatarUrl: asString(profile.avatarUrl),
    hourlyRateVnd: asNumber(profile.hourlyRateVnd),
    subjects: asStringArray(profile.subjects),
    languages: normalizeLanguages(profile.languages),
    teachingFormat: asString(profile.teachingFormat),
    regions: asStringArray(profile.regions),
    publishedAt: asString(profile.updatedAt),
    rating: ratingFrom(profile.rating),
  };
}
