import type { Metadata } from "next";

import { CourseCreator } from "@/components/courses/course-creator";

export const metadata: Metadata = {
  title: "Create a course | Tutoria",
  description: "Build, preview, price, and publish a self-paced course on Tutoria.",
};

export default function NewCoursePage() {
  return <CourseCreator />;
}
