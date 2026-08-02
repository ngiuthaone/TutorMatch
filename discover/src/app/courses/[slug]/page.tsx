import type { Metadata } from "next";
import { allCourses, getCourseBySlug } from "@/lib/course-data";
import { CourseProfileFrame } from "./course-profile-frame";

export function generateStaticParams() {
  return allCourses.map((course) => ({ slug: course.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const course = getCourseBySlug(slug);

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

  return <CourseProfileFrame slug={slug} />;
}
