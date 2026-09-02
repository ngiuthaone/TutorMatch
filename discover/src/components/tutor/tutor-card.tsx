import Link from "next/link";
import { RatingStars } from "@/components/rating-stars";

export interface TutorCardData {
  id: string;
  displayName: string;
  headline?: string | null;
  avatarUrl?: string | null;
  hourlyRateVnd?: number | null;
  ratingAvg?: number | null;
  ratingCount?: number;
  subjects?: string[];
  languages?: { displayName: string }[];
  isNew?: boolean;
  href: string;
}

// Tutoria-native: extracted from the inline browse card markup so it can be reused in other
// discovery surfaces (search, recommendations). Visual language kept consistent with the
// existing browse page: charcoal/dark surface (`#17181c`), white/85 text, 2xl radius.
// Pattern adapted from NextTutor's inlined tutor card (MIT).
export function TutorCard({ tutor }: { tutor: TutorCardData }) {
  const name = tutor.displayName || "Tutor";
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2) || "T";
  const vnd =
    typeof tutor.hourlyRateVnd === "number"
      ? `${new Intl.NumberFormat("vi-VN").format(tutor.hourlyRateVnd)}₫/hr`
      : "—";
  const showRating =
    typeof tutor.ratingAvg === "number" && typeof tutor.ratingCount === "number" && tutor.ratingCount > 0;

  return (
    <article className="flex h-full flex-col gap-4 rounded-2xl border border-white/[.12] bg-[#17181c] p-5">
      <div className="flex items-start gap-3">
        {tutor.avatarUrl ? (
          <img src={tutor.avatarUrl} alt={name} className="h-12 w-12 rounded-full object-cover" />
        ) : (
          <div
            aria-hidden
            className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-sm font-semibold text-white/70"
          >
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-white flex items-center gap-2">
            {name}
            {tutor.isNew && (
              <span className="text-[10px] uppercase tracking-wide text-emerald-400">New</span>
            )}
          </h2>
          <p className="mt-1 line-clamp-2 text-xs text-white/55">
            {tutor.headline || "Independent tutor on Tutoria"}
          </p>
        </div>
      </div>
      {showRating && (
        <div className="inline-flex items-center gap-2 text-xs text-white/70">
          <RatingStars value={tutor.ratingAvg as number} size="sm" />
          <span>{(tutor.ratingAvg as number).toFixed(1)}</span>
          <span className="text-white/40">({tutor.ratingCount})</span>
        </div>
      )}
      {!showRating && <span className="text-xs text-white/45">New tutor</span>}
      <p className="text-sm font-semibold text-white">{vnd}</p>
      {tutor.subjects && tutor.subjects.length > 0 && (
        <p className="line-clamp-1 text-xs text-white/55">
          {tutor.subjects.slice(0, 3).join(" · ")}
        </p>
      )}
      {tutor.languages && tutor.languages.length > 0 && (
        <p className="line-clamp-1 text-xs text-white/40">
          Speaks {tutor.languages.slice(0, 2).map((l) => l.displayName).join(", ")}
        </p>
      )}
      <Link
        href={tutor.href}
        className="mt-auto rounded-xl border border-white/15 px-4 py-2.5 text-center text-sm font-medium text-white/85 hover:bg-white/[.06]"
      >
        View profile
      </Link>
    </article>
  );
}
