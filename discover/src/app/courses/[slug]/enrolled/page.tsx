"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { TopNav } from "@/components/discover/top-nav";
import { getCourseBySlug } from "@/lib/course-data";

export default function CourseEnrolledPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [enrollment, setEnrollment] = useState<{ id: string; courseId: string; enrolledAt: string } | null>(null);
  const [courseTitle, setCourseTitle] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    async function checkEnrollment() {
      try {
        const course = getCourseBySlug(slug);
        if (!course) {
          setError("Course not found");
          setLoading(false);
          return;
        }
        setCourseTitle(course.title);

        const stored = localStorage.getItem(`tutoria_enrollment_${slug}`);
        if (stored) {
          setEnrollment(JSON.parse(stored));
        }
      } catch (err) {
        console.error("Failed to load enrollment:", err);
      } finally {
        setLoading(false);
      }
    }

    checkEnrollment();
  }, [slug]);

  if (loading) {
    return (
      <div className="tutoria-page-shell tutoria-marketplace-shell flex flex-col bg-black">
        <TopNav />
        <main className="mx-auto grid w-full max-w-[1480px] grid-cols-1 gap-5 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_370px]">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.035]">
            <div className="flex min-h-[400px] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tutoria-page-shell tutoria-marketplace-shell flex flex-col bg-black">
        <TopNav />
        <main className="mx-auto grid w-full max-w-[1480px] grid-cols-1 gap-5 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_370px]">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.035] p-8 text-center">
            <div className="mb-4 text-5xl">⚠️</div>
            <h1 className="mb-2 text-2xl font-semibold text-white">{error}</h1>
            <p className="mb-6 text-white/60">The course you&apos;re looking for doesn&apos;t exist.</p>
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-6 py-3 text-white transition-colors hover:bg-white/20"
            >
              Browse Courses
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="tutoria-page-shell tutoria-marketplace-shell flex flex-col bg-black">
      <TopNav />
      <main className="mx-auto grid w-full max-w-[1480px] grid-cols-1 gap-5 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_370px]">
        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.035]">
          <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
            <div className="mb-6 text-6xl">✅</div>
            <h1 className="mb-2 text-3xl font-semibold text-white">You&apos;re enrolled!</h1>
            <p className="mb-1 text-xl text-white/80">{courseTitle}</p>
            {enrollment?.enrolledAt && (
              <p className="mb-8 text-sm text-white/50">
                Enrolled on {new Date(enrollment.enrolledAt).toLocaleDateString("vi-VN", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            )}

            <div className="mt-4 flex flex-col gap-4 sm:flex-row">
              <Link
                href={`/courses/${slug}/learn`}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-8 py-3 font-medium text-black transition-colors hover:bg-white/90"
              >
                Start Learning
              </Link>
              <Link
                href={`/courses/${slug}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-8 py-3 font-medium text-white transition-colors hover:bg-white/20"
              >
                View Course Details
              </Link>
            </div>

            <div className="mt-8 w-full max-w-md rounded-lg bg-white/5 p-4">
              <h3 className="mb-2 text-sm font-medium text-white/70">What&apos;s next?</h3>
              <ul className="space-y-2 text-sm text-white/50">
                <li className="flex items-start gap-2">
                  <span className="text-white/30">1.</span>
                  Access all course lessons and materials
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-white/30">2.</span>
                  Track your progress as you learn
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-white/30">3.</span>
                  Complete quizzes and earn your certificate
                </li>
              </ul>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.035] p-6">
            <h3 className="mb-4 text-lg font-medium text-white">Your Enrolled Courses</h3>
            <Link
              href="/my-courses"
              className="block text-sm text-white/60 transition-colors hover:text-white"
            >
              View all my courses →
            </Link>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.035] p-6">
            <h3 className="mb-4 text-lg font-medium text-white">Need Help?</h3>
            <p className="mb-3 text-sm text-white/50">
              Have questions about this course? Contact the instructor or visit the help center.
            </p>
            <Link
              href="/help"
              className="text-sm text-white/60 transition-colors hover:text-white"
            >
              Visit Help Center →
            </Link>
          </div>
        </aside>
      </main>
    </div>
  );
}
