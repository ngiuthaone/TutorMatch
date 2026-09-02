"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { listTutorCards, type TutorCardSummary, type TutorDiscoveryFilters } from "@/lib/tutor-discovery-api";
import { TutorCard, type TutorCardData } from "@/components/tutor/tutor-card";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asStringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeLanguages(value: unknown): { displayName: string; proficiency: string }[] {
  if (!Array.isArray(value)) return [];
  return (value as { displayName?: unknown; proficiency?: unknown }[]).map((lang) => ({
    displayName: asStringValue(lang.displayName) ?? "",
    proficiency: asStringValue(lang.proficiency) ?? "",
  }));
}

function getApiBase(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }
  return "";
}

async function fetchTutorCardsBySearch(q: string): Promise<TutorCardSummary[]> {
  const base = getApiBase().replace(/\/$/, "");
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


interface TutorBrowseClientProps {
  initialItems: TutorCardSummary[];
  initialCursor: string | null;
  initialFilters: {
    subject: string;
    level: string;
    format: string;
    minRate: number | null;
    maxRate: number | null;
    sort: "rating" | "recent";
    q: string;
  };
}

const LEVEL_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Any level" },
  { value: "primary", label: "Primary" },
  { value: "lower_secondary", label: "Lower secondary" },
  { value: "upper_secondary", label: "Upper secondary" },
  { value: "university", label: "University" },
  { value: "adult", label: "Adult" },
  { value: "exam_preparation", label: "Exam prep" },
];

const FORMAT_OPTIONS: { value: "" | "online" | "in_person" | "both"; label: string }[] = [
  { value: "", label: "Any format" },
  { value: "online", label: "Online" },
  { value: "in_person", label: "In person" },
  { value: "both", label: "Online & in person" },
];

const SORT_OPTIONS: { value: "rating" | "recent"; label: string }[] = [
  { value: "rating", label: "Top rated" },
  { value: "recent", label: "Recently updated" },
];

export function TutorBrowseClient({ initialItems, initialCursor, initialFilters }: TutorBrowseClientProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [items, setItems] = useState<TutorCardSummary[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filters, setFilters] = useState({
    subject: initialFilters.subject,
    level: initialFilters.level,
    format: initialFilters.format,
    minRate: initialFilters.minRate,
    maxRate: initialFilters.maxRate,
    sort: initialFilters.sort,
    q: initialFilters.q,
  });

  const buildFilterPayload = useCallback(
    (current: typeof filters): TutorDiscoveryFilters => ({
      subject: current.subject || undefined,
      level: current.level || undefined,
      format: (current.format || undefined) as TutorDiscoveryFilters["format"],
      minRate: current.minRate ?? undefined,
      maxRate: current.maxRate ?? undefined,
      sort: current.sort,
      limit: 24,
    }),
    [],
  );

  const syncQueryString = useCallback(
    (current: typeof filters) => {
      const next = new URLSearchParams();
      if (current.q) next.set("q", current.q);
      if (current.subject) next.set("subject", current.subject);
      if (current.level) next.set("level", current.level);
      if (current.format) next.set("format", current.format);
      if (current.minRate !== null) next.set("minRate", String(current.minRate));
      if (current.maxRate !== null) next.set("maxRate", String(current.maxRate));
      if (current.sort !== "rating") next.set("sort", current.sort);
      const query = next.toString();
      router.replace(`/tutors${query ? `?${query}` : ""}`, { scroll: false });
    },
    [router],
  );

  const applyFilters = useCallback(
    async (next: typeof filters) => {
      setFilters(next);
      syncQueryString(next);
      if (next.q) {
        const search = await fetchTutorCardsBySearch(next.q);
        setItems(search);
        setCursor(null);
        return;
      }
      const payload = buildFilterPayload(next);
      const result = await listTutorCards(payload, null);
      setItems(result.items);
      setCursor(result.nextCursor);
    },
    [buildFilterPayload, syncQueryString],
  );

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const payload = buildFilterPayload(filters);
    const result = await listTutorCards(payload, cursor);
    setItems((prev) => [...prev, ...result.items]);
    setCursor(result.nextCursor);
    setLoadingMore(false);
  }, [buildFilterPayload, cursor, filters, loadingMore]);

  const subjectValue = filters.subject;
  const levelValue = filters.level;
  const formatValue = filters.format;
  const minRateValue = filters.minRate ?? "";
  const maxRateValue = filters.maxRate ?? "";
  const sortValue = filters.sort;
  const qValue = filters.q;

  const applyFiltersRef = useRef(applyFilters);
  // eslint-disable-next-line react-hooks/refs
  applyFiltersRef.current = applyFilters;

  const filtersRef = useRef(filters);
  // eslint-disable-next-line react-hooks/refs
  filtersRef.current = filters;

  useEffect(() => {
    const current = new URLSearchParams(params?.toString() ?? "");
    const next: typeof filters = {
      q: current.get("q") ?? "",
      subject: current.get("subject") ?? "",
      level: current.get("level") ?? "",
      format: current.get("format") ?? "",
      minRate: current.get("minRate") ? Number(current.get("minRate")) : null,
      maxRate: current.get("maxRate") ? Number(current.get("maxRate")) : null,
      sort: current.get("sort") === "recent" ? "recent" : "rating",
    };
    const same = JSON.stringify(next) === JSON.stringify(filtersRef.current);
    if (!same) {
      applyFiltersRef.current(next);
    }
  }, [params]);

  const isEmpty = useMemo(() => items.length === 0, [items]);

  return (
    <div>
      <form
        className="mb-6 flex gap-3 rounded-2xl border border-white/[.12] bg-white/[.03] p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void applyFilters({
            q: qValue.trim(),
            subject: subjectValue.trim(),
            level: levelValue,
            format: formatValue,
            minRate: minRateValue === "" ? null : Number(minRateValue),
            maxRate: maxRateValue === "" ? null : Number(maxRateValue),
            sort: sortValue,
          });
        }}
      >
        <label className="flex flex-1 flex-col gap-1 text-xs text-white/50">
          <span>Search</span>
          <input
            type="search"
            value={qValue}
            onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
            placeholder="Search tutors by name, subject, or bio…"
            className="rounded-xl border border-white/[.12] bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black"
          >
            Search
          </button>
        </div>
      </form>

      <form
        className="mb-6 grid gap-3 rounded-2xl border border-white/[.12] bg-white/[.03] p-4 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(event) => {
          event.preventDefault();
          void applyFilters({
            q: qValue.trim(),
            subject: subjectValue.trim(),
            level: levelValue,
            format: formatValue,
            minRate: minRateValue === "" ? null : Number(minRateValue),
            maxRate: maxRateValue === "" ? null : Number(maxRateValue),
            sort: sortValue,
          });
        }}
      >
        <label className="flex flex-col gap-1 text-xs text-white/50">
          <span>Subject</span>
          <input
            type="text"
            value={subjectValue}
            onChange={(event) => setFilters((prev) => ({ ...prev, subject: event.target.value }))}
            placeholder="Math, English…"
            className="rounded-xl border border-white/[.12] bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-white/50">
          <span>Level</span>
          <select
            value={levelValue}
            onChange={(event) => setFilters((prev) => ({ ...prev, level: event.target.value }))}
            className="rounded-xl border border-white/[.12] bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
          >
            {LEVEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-white/50">
          <span>Format</span>
          <select
            value={formatValue}
            onChange={(event) => setFilters((prev) => ({ ...prev, format: event.target.value }))}
            className="rounded-xl border border-white/[.12] bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
          >
            {FORMAT_OPTIONS.map((option) => (
              <option key={option.value || "any"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-white/50">
          <span>Min ₫/hr</span>
          <input
            type="number"
            inputMode="numeric"
            value={minRateValue}
            onChange={(event) => setFilters((prev) => ({ ...prev, minRate: event.target.value === "" ? null : Number(event.target.value) }))}
            className="rounded-xl border border-white/[.12] bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-white/50">
          <span>Max ₫/hr</span>
          <input
            type="number"
            inputMode="numeric"
            value={maxRateValue}
            onChange={(event) => setFilters((prev) => ({ ...prev, maxRate: event.target.value === "" ? null : Number(event.target.value) }))}
            className="rounded-xl border border-white/[.12] bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-white/50 sm:col-span-2 lg:col-span-1">
          <span>Sort</span>
          <select
            value={sortValue}
            onChange={(event) => setFilters((prev) => ({ ...prev, sort: event.target.value as "rating" | "recent" }))}
            className="rounded-xl border border-white/[.12] bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-1">
          <button
            type="submit"
            className="w-full rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black"
          >
            Apply
          </button>
        </div>
      </form>

      {isEmpty ? (
        <div className="rounded-2xl border border-white/[.12] bg-white/[.03] p-8 text-center">
          <p className="text-sm text-white/60">No tutors match these filters yet.</p>
          <button
            type="button"
            onClick={() => void applyFilters({ q: "", subject: "", level: "", format: "", minRate: null, maxRate: null, sort: "rating" })}
            className="mt-4 inline-block rounded-xl border border-white/15 px-4 py-2 text-sm text-white/80"
          >
            Reset filters
          </button>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((tutor) => (
            <li key={tutor.id} className="h-full">
              <TutorCard
                tutor={
                  {
                    id: tutor.id,
                    displayName: tutor.displayName,
                    headline: tutor.headline,
                    avatarUrl: tutor.avatarUrl,
                    hourlyRateVnd: tutor.hourlyRateVnd,
                    ratingAvg: tutor.rating.average,
                    ratingCount: tutor.rating.count,
                    subjects: tutor.subjects,
                    languages: tutor.languages,
                    href: `/tutor/${encodeURIComponent(tutor.displayName)}`,
                  } satisfies TutorCardData
                }
              />
            </li>
          ))}
        </ul>
      )}

      {cursor && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="rounded-xl border border-white/15 px-6 py-3 text-sm text-white/80 disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load more tutors"}
          </button>
        </div>
      )}
    </div>
  );
}
