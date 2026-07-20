import type { Metadata } from "next";
import { PublishedCoursePage } from "@/components/courses/published-course-page";
import { Footer } from "@/components/discover/footer";
import { TopNav } from "@/components/discover/top-nav";
import { allCourses, getCourseBySlug, getSimilarCourses } from "@/lib/course-data";

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
  const course = getCourseBySlug(slug);

  return (
    <div className="tutoria-page-shell tutoria-marketplace-shell flex flex-col bg-black">
      <TopNav />
      <PublishedCoursePage slug={slug} fallback={course} similarCourses={getSimilarCourses(slug)} />
      <Footer />
    </div>
  );
}
