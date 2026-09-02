import { listTutorCards, type TutorCardSummary } from "@/lib/tutor-discovery-api";
import { TutorBrowseClient } from "./tutor-browse-client";

export const dynamic = "force-dynamic";

interface TutorBrowsePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function asString(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  return null;
}

function asNumber(value: string | string[] | undefined): number | null {
  const raw = asString(value);
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asStringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArrayValue(value: unknown): string[] {
  return Array.isArray(value)
    ? (value as unknown[]).filter((entry): entry is string => typeof entry === "string")
    : [];
}

function normalizeLanguages(value: unknown): { displayName: string; proficiency: string }[] {
  if (!Array.isArray(value)) return [];
  return (value as { displayName?: unknown; proficiency?: unknown }[]).map((lang) => ({
    displayName: asStringValue(lang.displayName) ?? "",
    proficiency: asStringValue(lang.proficiency) ?? "",
  }));
}

function ratingFrom(value: unknown): TutorCardSummary["rating"] {
  if (value && typeof value === "object") {
    const record = value as { count?: unknown; average?: unknown };
    return {
      count: asNumberValue(record.count) ?? 0,
      average: asNumberValue(record.average),
    };
  }
  return { count: 0, average: null };
}

async function fetchTutorsBySearch(q: string): Promise<TutorCardSummary[]> {
  const base = (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL
    ? process.env.NEXT_PUBLIC_API_BASE_URL
    : ""
  ).replace(/\/$/, "");
  const params = new URLSearchParams();
  params.set("q", q);
  params.set("limit", "24");
  try {
    const response = await fetch(`${base}/api/v1/tutors/search?${params.toString()}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as { tutors?: unknown };
    if (!Array.isArray(payload.tutors)) return [];
    return (payload.tutors as Record<string, unknown>[])
      .filter((item) => {
        const id = asStringValue(item.id);
        return id !== null && UUID.test(id);
      })
      .map((item) => ({
        id: asStringValue(item.id) as string,
        displayName: asStringValue(item.display_name) ?? "",
        headline: asStringValue(item.headline),
        avatarUrl: asStringValue(item.avatar_object_path),
        hourlyRateVnd: asNumberValue(item.hourly_rate_vnd),
        subjects: [],
        languages: normalizeLanguages(item.languages),
        teachingFormat: asStringValue(item.teaching_format),
        regions: [],
        publishedAt: asStringValue(item.published_at),
        rating: { count: 0, average: null },
      }));
  } catch {
    return [];
  }
}

export default async function TutorsBrowsePage({ searchParams }: TutorBrowsePageProps) {
  const params = await searchParams;
  const q = asString(params.q);
  const filters = {
    subject: asString(params.subject),
    level: asString(params.level),
    format: asString(params.format) as "online" | "in_person" | "both" | null,
    minRate: asNumber(params.minRate),
    maxRate: asNumber(params.maxRate),
  };
  const sort = asString(params.sort) === "recent" ? "recent" : "rating";

  let initial: { items: TutorCardSummary[]; nextCursor: string | null } = { items: [], nextCursor: null };
  let loadError: string | null = null;
  try {
    if (q) {
      const items = await fetchTutorsBySearch(q);
      initial = { items, nextCursor: null };
    } else {
      initial = await listTutorCards({
        subject: filters.subject ?? undefined,
        level: filters.level ?? undefined,
        format: filters.format ?? undefined,
        minRate: filters.minRate ?? undefined,
        maxRate: filters.maxRate ?? undefined,
        sort,
        limit: 24,
      });
    }
  } catch {
    loadError = "Tutor discovery is temporarily unavailable.";
  }

  return (
    <main className="min-h-[100dvh] bg-[#101011] px-5 py-10 text-[#e8e6df] sm:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-white/40">Browse tutors</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Find a tutor that fits</h1>
          <p className="mt-3 max-w-2xl text-sm text-white/55">
            Independent tutors across Vietnam. Filter by subject, level, format, and price.
          </p>
        </header>
        <form
          method="get"
          action="/tutors"
          className="mb-6"
        >
          <input
            type="search"
            name="q"
            placeholder="Search tutors by name, subject, or bio…"
            defaultValue={q ?? ""}
            className="w-full rounded-xl border border-white/[.12] bg-black/40 px-4 py-2 text-sm text-white outline-none focus:border-white/30"
          />
        </form>
        {loadError && (
          <p role="alert" className="mb-6 rounded-2xl border border-amber-300/20 bg-amber-300/[.06] p-4 text-sm text-amber-100">
            {loadError}
          </p>
        )}
        <TutorBrowseClient
          initialItems={initial.items}
          initialCursor={initial.nextCursor}
          initialFilters={{
            subject: filters.subject ?? "",
            level: filters.level ?? "",
            format: filters.format ?? "",
            minRate: filters.minRate,
            maxRate: filters.maxRate,
            sort,
            q: q ?? "",
          }}
        />
      </div>
    </main>
  );
}
