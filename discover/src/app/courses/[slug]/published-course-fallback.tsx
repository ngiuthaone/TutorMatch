"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isLiveMode } from "@/lib/auth/config";
import { getBackendCourseBySlug } from "@/lib/courses/backend-courses-api";

interface PublishedCourse {
  slug: string;
  title: string;
  instructor: string;
  category: string;
  lessons: number;
  duration: string;
  rating: number;
  students: number;
  level: string;
  price: string;
  image: string;
  subtitle?: string;
  description?: string[];
  outcomes?: string[];
  requirements?: string[];
  faqs?: { question: string; answer: string }[];
  curriculum?: { title: string; duration: string; lessons: string[] }[];
  instructorRole?: string;
  instructorBio?: string;
  instructorImage?: string;
  reviews?: { name: string; rating: number; date: string; body: string; avatar?: string }[];
  updated?: string;
  language?: string;
  certificate?: boolean;
  reviewCount?: number;
}

/**
 * In live mode, fetches from the production backend (GET /api/v1/marketplace/course/:slug).
 * In demo mode, fetches from the demo JSON store (GET /api/courses).
 * Never falls back from live to demo — live must not pretend to be demo.
 */
export function PublishedCourseFallback({ slug }: { slug: string }) {
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error" | "unavailable">("loading");
  const [course, setCourse] = useState<PublishedCourse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const live = isLiveMode();
      if (live) {
        try {
          const result = await getBackendCourseBySlug(slug);
          if (cancelled) return;
          if (result.status === "not_found") {
            setStatus("missing");
            return;
          }
          if (result.status === "unavailable") {
            setStatus("unavailable");
            setErrorMessage("The course service is temporarily unavailable. Try again in a moment.");
            return;
          }
          if (result.status !== "ok") {
            setStatus("unavailable");
            setErrorMessage("The course service could not be reached.");
            return;
          }
          const p = result.data.payload;
          setCourse({
            slug: result.data.slug,
            title: String(p.title ?? result.data.title),
            instructor: String(p.instructor ?? p.creatorName ?? "Tutoria creator"),
            category: String(p.category ?? "General"),
            lessons: Number(p.lessons ?? 0),
            duration: String(p.duration ?? "0h"),
            rating: Number(p.rating ?? 0),
            students: Number(p.students ?? 0),
            level: String(p.level ?? "All levels"),
            price: String(p.price ?? "Free"),
            image: String(p.image ?? ""),
            subtitle: String(p.subtitle ?? ""),
            description: Array.isArray(p.description) ? p.description as string[] : [],
            outcomes: Array.isArray(p.outcomes) ? p.outcomes as string[] : [],
            requirements: Array.isArray(p.requirements) ? p.requirements as string[] : [],
            faqs: Array.isArray(p.faqs) ? p.faqs as { question: string; answer: string }[] : [],
            curriculum: Array.isArray(p.curriculum) ? p.curriculum as { title: string; duration: string; lessons: string[] }[] : [],
            instructorRole: String(p.instructorRole ?? "Course creator"),
            instructorBio: String(p.instructorBio ?? ""),
            instructorImage: String(p.instructorImage ?? ""),
            reviews: Array.isArray(p.reviews) ? p.reviews as { name: string; rating: number; date: string; body: string; avatar?: string }[] : [],
            updated: String(p.updated ?? ""),
            language: String(p.language ?? "English"),
            certificate: Boolean(p.certificate),
            reviewCount: Number(p.reviewCount ?? 0),
          });
          setStatus("ready");
        } catch {
          if (!cancelled) {
            setStatus("unavailable");
            setErrorMessage("Could not reach the course service.");
          }
        }
        return;
      }
      // Demo mode — fetch from the demo JSON store
      try {
        const response = await fetch("/api/courses", { cache: "no-store" });
        if (!response.ok) {
          if (!cancelled) setStatus("error");
          return;
        }
        const payload = (await response.json()) as { ok: boolean; courses?: PublishedCourse[] };
        if (cancelled) return;
        if (!payload.ok) {
          setStatus("error");
          return;
        }
        const found = (payload.courses || []).find((item) => item.slug === slug) || null;
        setCourse(found);
        setStatus(found ? "ready" : "missing");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (status === "loading") {
    return (
      <main style={{ minHeight: "60vh", display: "grid", placeItems: "center", color: "white" }}>
        <div>Loading the published course…</div>
      </main>
    );
  }
  if (status === "unavailable") {
    return (
      <main style={{ minHeight: "60vh", display: "grid", placeItems: "center", color: "white", textAlign: "center" }}>
        <div>
          <h1>Course temporarily unavailable</h1>
          <p>{errorMessage || "The course service is temporarily unavailable. Try again in a moment."}</p>
          <Link href="/courses">Back to courses</Link>
        </div>
      </main>
    );
  }
  if (status === "error") {
    return (
      <main style={{ minHeight: "60vh", display: "grid", placeItems: "center", color: "white", textAlign: "center" }}>
        <div>
          <h1>Course temporarily unavailable</h1>
          <p>The demo course store could not be reached. Try again in a moment.</p>
          <Link href="/courses">Back to courses</Link>
        </div>
      </main>
    );
  }
  if (status === "missing" || !course) {
    return (
      <main style={{ minHeight: "60vh", display: "grid", placeItems: "center", color: "white", textAlign: "center" }}>
        <div>
          <h1>Course not found</h1>
          <p>{isLiveMode() ? "This course has not been published yet." : "This course has not been published to the demo store yet."}</p>
          <Link href="/courses">Back to courses</Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", padding: "64px 24px", color: "white", background: "#08090a" }}>
      <article style={{ maxWidth: 920, margin: "0 auto", display: "grid", gap: 24 }}>
        <header style={{ display: "grid", gap: 12 }}>
          <div style={{ color: "#9ca3af", fontSize: 13, textTransform: "uppercase", letterSpacing: ".06em" }}>
            {course.category} · {course.level}
          </div>
          <h1 style={{ fontSize: 36, lineHeight: 1.15, margin: 0 }}>{course.title}</h1>
          {course.subtitle ? <p style={{ fontSize: 17, color: "#d4d4d8" }}>{course.subtitle}</p> : null}
          <div style={{ color: "#a1a1aa" }}>Taught by {course.instructor}</div>
        </header>
        {course.description && course.description.length ? (
          <section>
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>About this course</h2>
            {course.description.map((paragraph, index) => (
              <p key={index} style={{ color: "#d4d4d8", lineHeight: 1.6 }}>{paragraph}</p>
            ))}
          </section>
        ) : null}
        {course.outcomes && course.outcomes.length ? (
          <section>
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>What you will learn</h2>
            <ul style={{ paddingLeft: 18, color: "#d4d4d8", lineHeight: 1.7 }}>
              {course.outcomes.map((outcome, index) => (
                <li key={index}>{outcome}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {course.instructor ? (
          <section>
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>Instructor</h2>
            <p style={{ color: "#d4d4d8" }}>
              <strong>{course.instructor}</strong>
              {course.instructorRole ? ` — ${course.instructorRole}` : ""}
            </p>
            {course.instructorBio ? <p style={{ color: "#a1a1aa" }}>{course.instructorBio}</p> : null}
          </section>
        ) : null}
        <footer>
          <Link href="/courses">Back to courses</Link>
        </footer>
      </article>
    </main>
  );
}
