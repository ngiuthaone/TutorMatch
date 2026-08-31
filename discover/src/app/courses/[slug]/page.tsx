import type { Metadata } from "next";
import { getCatalogCourseBySlug, getCatalogSimilarCourses } from "@/lib/course-data";
import { CourseProfileFrame } from "./course-profile-frame";
import { PublishedCourseFallback } from "./published-course-fallback";

export function generateStaticParams() {
  // Only catalog slugs are statically generated. Published-only slugs are
  // resolved at request time via the PublishedCourseFallback client component.
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const course = getCatalogCourseBySlug(slug);

  if (!course) return { title: "Course not found | Tutoria" };

  return {
    title: `${course.title} | Tutoria Courses`,
    description: course.subtitle,
  };
}

export default async function CoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const catalogCourse = getCatalogCourseBySlug(slug);
  if (catalogCourse) {
    return <CourseProfileFrame slug={slug} />;
  }
  // Non-catalog slugs (i.e. a creator-submitted course in the demo store)
  // resolve on the client. This is the canonical surface for cross-device
  // visibility while live mode wiring is blocked on the production
  // record-home decision.
  return <PublishedCourseFallback slug={slug} />;
}
