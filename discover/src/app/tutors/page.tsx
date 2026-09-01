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

export default async function TutorsBrowsePage({ searchParams }: TutorBrowsePageProps) {
  const params = await searchParams;
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
    initial = await listTutorCards({
      subject: filters.subject ?? undefined,
      level: filters.level ?? undefined,
      format: filters.format ?? undefined,
      minRate: filters.minRate ?? undefined,
      maxRate: filters.maxRate ?? undefined,
      sort,
      limit: 24,
    });
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
          }}
        />
      </div>
    </main>
  );
}
