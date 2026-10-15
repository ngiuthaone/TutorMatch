"use client";

import { CourseCreatorPage } from "@/components/course-creator/course-creator-page";

export default function EditCoursePageClient({ courseId }: { courseId: string }) {
  return <CourseCreatorPage mode="edit" courseId={courseId} />;
}
