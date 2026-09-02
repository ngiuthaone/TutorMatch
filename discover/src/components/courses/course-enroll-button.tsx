"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createCourseBooking, startCoursePayment, getCourseEnrollment, type CourseEnrollment } from "@/lib/course-booking-api";

interface CourseEnrollButtonProps {
  slug: string;
  courseId: string;
  priceVnd: number | null;
  priceDisplay: string;
  isEnrolled?: boolean;
  existingEnrollment?: CourseEnrollment | null;
}

export function CourseEnrollButton({
  slug,
  courseId,
  priceVnd,
  priceDisplay,
  isEnrolled = false,
  existingEnrollment,
}: CourseEnrollButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState(isEnrolled || !!existingEnrollment);

  const handleEnroll = useCallback(async () => {
    if (enrolled) {
      router.push(`/courses/${slug}/enrolled`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { bookingId } = await createCourseBooking(slug);

      if (priceVnd && priceVnd > 0) {
        const { redirectUrl } = await startCoursePayment(bookingId);
        localStorage.setItem(`tutoria_pending_course_booking_${slug}`, JSON.stringify({ bookingId, createdAt: Date.now() }));
        window.location.href = redirectUrl;
      } else {
        localStorage.setItem(`tutoria_enrollment_${slug}`, JSON.stringify({
          id: crypto.randomUUID(),
          courseId,
          enrolledAt: new Date().toISOString(),
        }));
        router.push(`/courses/${slug}/enrolled`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to enroll. Please try again.";
      setError(message);
      setLoading(false);
    }
  }, [slug, courseId, priceVnd, enrolled, router]);

  if (enrolled) {
    return (
      <div className="space-y-3">
        <button
          onClick={() => router.push(`/courses/${slug}/enrolled`)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-3 font-medium text-white transition-colors hover:bg-green-500"
        >
          <span>✓</span>
          <span>You&apos;re Enrolled</span>
        </button>
        <button
          onClick={() => router.push(`/courses/${slug}/learn`)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 px-6 py-3 font-medium text-white transition-colors hover:bg-white/20"
        >
          Continue Learning →
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleEnroll}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 font-medium text-black transition-colors hover:bg-white/90 disabled:opacity-50"
      >
        {loading ? (
          <>
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-black/20 border-t-black/60" />
            <span>Processing...</span>
          </>
        ) : (
          <>
            <span>Enroll Now</span>
            {priceVnd !== null && priceVnd > 0 && <span>— {priceDisplay}</span>}
            {(!priceVnd || priceVnd === 0) && <span>(Free)</span>}
          </>
        )}
      </button>
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
      {priceVnd !== null && priceVnd > 0 && (
        <p className="text-center text-sm text-white/40">
          Secure payment via VNPay
        </p>
      )}
    </div>
  );
}

export function CoursePricingBadge({ priceVnd, priceDisplay }: { priceVnd: number | null; priceDisplay: string }) {
  if (priceVnd === null) {
    return <span className="text-2xl font-bold text-white">Free</span>;
  }

  if (priceVnd === 0) {
    return <span className="text-2xl font-bold text-white">Free</span>;
  }

  return (
    <div className="flex items-baseline gap-2">
      <span className="text-3xl font-bold text-white">{priceDisplay}</span>
      <span className="text-sm text-white/50">VND</span>
    </div>
  );
}
