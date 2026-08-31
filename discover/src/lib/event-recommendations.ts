import type { EventDetail } from "@/lib/event-data";
import type { WorkshopDataRecommendation } from "@/lib/workshop-payload";

// ---------------------------------------------------------------------------
// Recommendations algorithm.
//
// Approved scoring (server-side, reversible):
//   * sameHost         +100 when candidate.host === currentHost
//   * sameCategory     +50  when candidate.topic === currentCategory
//   * titleOverlap     +30  when any word (>=4 chars) from currentTitle
//                          appears in candidate.title (case-insensitive substring)
//
// Excludes: currentSlug, past events (event.date strictly before today UTC).
//
// Sort: score desc, then rating desc (tiebreaker only — there are no
// production reviews so most events currently tie at rating 0), then
// publishedAt desc falling back to event date desc (recency).
//
// Returns top 6.
//
// Tuning: every boost is a single literal inside `scoreCandidate` and the
// sort comparators below. To tune, change the three constants or reorder
// the comparators. Ratings are intentionally a tiebreaker — they must never
// become a primary sort key without production review data.
// ---------------------------------------------------------------------------

const MONTH_INDEX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};
const VIETNAMESE_MONTHS: Record<string, number> = {
  "1": 0, "2": 1, "3": 2, "4": 3, "5": 4, "6": 5,
  "7": 6, "8": 7, "9": 8, "10": 9, "11": 10, "12": 11,
};

export function labelToDateKey(label?: string): string | undefined {
  if (!label) return undefined;
  const raw = String(label).trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const cleaned = raw.replace(/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*,\s*/i, "");
  const vietnamese = cleaned.match(/^(\d{1,2})\s+thg\s+(\d{1,2})\s*,?\s*(\d{4})$/i);
  if (vietnamese) {
    const month = VIETNAMESE_MONTHS[vietnamese[2]];
    if (month === undefined) return undefined;
    return `${vietnamese[3]}-${String(month + 1).padStart(2, "0")}-${String(vietnamese[1]).padStart(2, "0")}`;
  }
  const dayFirst = cleaned.match(/^(\d{1,2})\s+([a-z]{3})\s+(\d{4})$/i);
  if (dayFirst) {
    const month = MONTH_INDEX[dayFirst[2].toLowerCase()];
    if (month === undefined) return undefined;
    return `${dayFirst[3]}-${String(month + 1).padStart(2, "0")}-${String(dayFirst[1]).padStart(2, "0")}`;
  }
  const monthFirst = cleaned.match(/^([a-z]{3})\s+(\d{1,2})(?:,)?\s+(\d{4})$/i);
  if (monthFirst) {
    const month = MONTH_INDEX[monthFirst[1].toLowerCase()];
    if (month === undefined) return undefined;
    return `${monthFirst[3]}-${String(month + 1).padStart(2, "0")}-${String(monthFirst[2]).padStart(2, "0")}`;
  }
  return undefined;
}

export function isPastEvent(candidate: { date?: string }, now: Date = new Date()): boolean {
  const key = labelToDateKey(candidate.date);
  if (!key) return false; // unparseable dates are kept (don't drop unknown-dated events)
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const eventTime = Date.parse(`${key}T00:00:00Z`);
  if (Number.isNaN(eventTime)) return false;
  return eventTime < todayUtc;
}

export function scoreCandidate(
  currentTitle: string,
  currentHost: string,
  currentCategory: string,
  candidate: EventDetail,
): number {
  let score = 0;
  if (candidate.host && candidate.host === currentHost) score += 100;
  if (candidate.topic && currentCategory && candidate.topic === currentCategory) score += 50;
  const titleWords = currentTitle
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4);
  const candidateTitle = candidate.title.toLowerCase();
  if (titleWords.some((w) => candidateTitle.includes(w))) score += 30;
  return score;
}

export function eventRecencyKey(event: EventDetail): number {
  const published = event.publishedAt ? Date.parse(event.publishedAt) : Number.NaN;
  if (!Number.isNaN(published)) return published;
  const eventDate = event.date ? Date.parse(`${labelToDateKey(event.date) ?? ""}T00:00:00Z`) : Number.NaN;
  if (!Number.isNaN(eventDate)) return eventDate;
  return 0;
}

export interface RecommendationInput {
  currentSlug: string;
  currentHost: string;
  currentCategory: string;
  currentTitle: string;
  candidates: EventDetail[];
  now?: Date;
  limit?: number;
}

const unwrapVnd = (price?: string | number): number => {
  if (typeof price === "number") return price;
  if (typeof price === "string") {
    const digits = price.replace(/[^0-9]/g, "");
    return digits ? Number(digits) : 0;
  }
  return 0;
};

export function computeRecommendations(input: RecommendationInput): WorkshopDataRecommendation[] {
  const { currentSlug, currentHost, currentCategory, currentTitle, candidates } = input;
  const limit = input.limit ?? 6;

  const scored = candidates
    .filter((event) => event.slug !== currentSlug)
    .filter((event) => !isPastEvent(event, input.now))
    .map((event) => ({
      event,
      score: scoreCandidate(currentTitle, currentHost, currentCategory, event),
    }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ratingDiff = (b.event.rating ?? 0) - (a.event.rating ?? 0);
    if (ratingDiff !== 0) return ratingDiff;
    return eventRecencyKey(b.event) - eventRecencyKey(a.event);
  });

  return scored.slice(0, limit).map(({ event }) => ({
    slug: event.slug,
    title: event.title,
    category: event.topic || "Workshop",
    host: event.host,
    rating: event.rating ?? 0,
    reviewCount: event.reviewCount ?? 0,
    duration: event.duration || "2 hours",
    location: event.location,
    priceFrom: unwrapVnd(event.price),
    image: event.image,
    priority: event.host === currentHost ? "host" : "default",
  }));
}
