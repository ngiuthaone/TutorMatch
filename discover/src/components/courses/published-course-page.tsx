"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import type { CourseDetail, CourseListing } from "@/lib/course-data";
import { PUBLISHED_COURSES_EVENT, PUBLISHED_COURSES_KEY } from "@/lib/course-data";
import { CourseDetailPage } from "./course-detail-page";

export function PublishedCoursePage({ slug, fallback, similarCourses }: { slug: string; fallback?: CourseDetail; similarCourses: CourseListing[] }) {
  const snapshot = useSyncExternalStore(
    (onChange) => {
      const onStorage = (event: StorageEvent) => { if (event.key === PUBLISHED_COURSES_KEY) onChange(); };
      window.addEventListener(PUBLISHED_COURSES_EVENT, onChange);
      window.addEventListener("storage", onStorage);
      return () => { window.removeEventListener(PUBLISHED_COURSES_EVENT, onChange); window.removeEventListener("storage", onStorage); };
    },
    () => window.localStorage.getItem(PUBLISHED_COURSES_KEY) || "[]",
    () => "[]",
  );
  const course = useMemo(() => {
    try {
      const published = JSON.parse(snapshot) as CourseDetail[];
      return published.find((item) => item.slug === slug) || fallback;
    } catch {
      return fallback;
    }
  }, [fallback, slug, snapshot]);

  if (!course) return <main style={{ minHeight: "60vh", display: "grid", placeItems: "center", color: "white", textAlign: "center" }}><div><h1>Course not found</h1><p>This course is not available in this browser.</p><Link href="/courses">Back to courses</Link></div></main>;
  return <CourseDetailPage course={course} similarCourses={similarCourses} />;
}
