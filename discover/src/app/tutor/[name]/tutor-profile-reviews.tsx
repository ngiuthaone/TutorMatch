import { callTutorRpc } from "@/lib/tutor-profile-rpc";

interface TutorProfileReviewsProps {
  tutorProfileId: string;
}

interface ReviewItem {
  id: string;
  rating: number;
  body: string;
  publishedAt: string;
  learner: { name: string | null; avatarUrl: string | null };
}

interface RatingSummary {
  count: number;
  average: number | null;
}

function formatDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

export async function TutorProfileReviews({ tutorProfileId }: TutorProfileReviewsProps) {
  const [summary, reviews] = await Promise.all([
    callTutorRpc<RatingSummary>("get_tutor_rating_summary", { p_tutor_profile_id: tutorProfileId }),
    callTutorRpc<ReviewItem[]>("list_tutor_reviews", { p_tutor_profile_id: tutorProfileId, p_limit: 6, p_offset: 0 }),
  ]);

  const count = summary?.count ?? 0;
  const average = summary?.average ?? null;

  return (
    <section aria-labelledby="tutor-reviews-heading" className="rounded-3xl border border-white/[.12] bg-[#17181c] p-6">
      <header className="flex items-baseline justify-between gap-3">
        <h2 id="tutor-reviews-heading" className="text-lg font-semibold tracking-tight">
          Learner reviews
        </h2>
        <p className="text-xs text-white/45">
          {count === 0
            ? "No reviews yet"
            : `${average !== null ? average.toFixed(1) : "—"} ★ · ${count} ${count === 1 ? "review" : "reviews"}`}
        </p>
      </header>
      {(!reviews || reviews.length === 0) ? (
        <p className="mt-4 text-sm text-white/55">Completed bookings may leave a review.</p>
      ) : (
        <ul className="mt-5 space-y-4">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-2xl border border-white/[.08] bg-white/[.025] p-4">
              <div className="flex items-center justify-between gap-3 text-xs text-white/55">
                <span className="font-medium text-white/80">{review.learner?.name ?? "Anonymous learner"}</span>
                <span>{formatDate(review.publishedAt)}</span>
              </div>
              <p className="mt-2 text-sm text-amber-300" aria-label={`Rating ${review.rating} of 5`}>
                {"★".repeat(review.rating)}
                <span className="text-white/20">{"★".repeat(5 - review.rating)}</span>
              </p>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-white/75">{review.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
