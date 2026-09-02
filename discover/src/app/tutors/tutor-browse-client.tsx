"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { listTutorCards, type TutorCardSummary, type TutorDiscoveryFilters } from "@/lib/tutor-discovery-api";

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

function money(amount: number | null): string {
  if (amount === null) return "—";
  return `${new Intl.NumberFormat("vi-VN").format(amount)}₫/hr`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2) || "T";
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) return <img src={url} alt={name} className="h-12 w-12 rounded-full object-cover" />;
  return (
    <div aria-hidden className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-sm font-semibold text-white/70">
      {initials(name)}
    </div>
  );
}

function Stars({ rating }: { rating: { count: number; average: number | null } }) {
  if (rating.count === 0 || rating.average === null) {
    return <span className="text-xs text-white/45">New tutor</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-white/70">
      <span aria-hidden className="text-amber-300">★</span>
      <span>{rating.average.toFixed(1)}</span>
      <span className="text-white/40">({rating.count})</span>
    </span>
  );
}

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

  const applyFiltersRef = useRef(applyFilters);
  // eslint-disable-next-line react-hooks/refs
  applyFiltersRef.current = applyFilters;

  const filtersRef = useRef(filters);
  // eslint-disable-next-line react-hooks/refs
  filtersRef.current = filters;

  useEffect(() => {
    const current = new URLSearchParams(params?.toString() ?? "");
    const next: typeof filters = {
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
        className="mb-6 grid gap-3 rounded-2xl border border-white/[.12] bg-white/[.03] p-4 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(event) => {
          event.preventDefault();
          void applyFilters({
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
            onClick={() => void applyFilters({ subject: "", level: "", format: "", minRate: null, maxRate: null, sort: "rating" })}
            className="mt-4 inline-block rounded-xl border border-white/15 px-4 py-2 text-sm text-white/80"
          >
            Reset filters
          </button>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((tutor) => (
            <li key={tutor.id}>
              <article className="flex h-full flex-col gap-4 rounded-2xl border border-white/[.12] bg-[#17181c] p-5">
                <div className="flex items-start gap-3">
                  <Avatar name={tutor.displayName} url={tutor.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-semibold text-white">{tutor.displayName || "Tutor"}</h2>
                    <p className="mt-1 line-clamp-2 text-xs text-white/55">{tutor.headline || "Independent tutor on Tutoria"}</p>
                  </div>
                </div>
                <Stars rating={tutor.rating} />
                <p className="text-sm font-semibold text-white">{money(tutor.hourlyRateVnd)}</p>
                {tutor.subjects.length > 0 && (
                  <p className="line-clamp-1 text-xs text-white/55">
                    {tutor.subjects.slice(0, 3).join(" · ")}
                  </p>
                )}
                {tutor.languages.length > 0 && (
                  <p className="line-clamp-1 text-xs text-white/40">
                    Speaks {tutor.languages.slice(0, 2).map((language) => language.displayName).join(", ")}
                  </p>
                )}
                <Link
                  href={`/tutor/${encodeURIComponent(tutor.displayName)}`}
                  className="mt-auto rounded-xl border border-white/15 px-4 py-2.5 text-center text-sm font-medium text-white/85 hover:bg-white/[.06]"
                >
                  View profile
                </Link>
              </article>
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
