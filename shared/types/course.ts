// Platform-agnostic course types shared between web and mobile

export interface BackendCourse {
  id: string;
  kind: "course";
  slug: string;
  title: string;
  payload: Record<string, unknown>;
  publishedAt: string;
  status: string;
  version: number;
}

export type BackendCourseResult =
  | { status: "ok"; data: BackendCourse }
  | { status: "not_found" | "unavailable" };

export interface BackendCoursePublishInput {
  slug: string;
  title: string;
  payload: Record<string, unknown>;
}

export interface BackendCoursePublishResult {
  id: string;
  kind: "course";
  slug: string;
  title: string;
  payload: Record<string, unknown>;
  publishedAt: string;
  status: string;
  version: number;
}

export interface SectionInput {
  title: string;
  position?: number;
}

export interface LessonInput {
  title: string;
  lesson_type: "video" | "text" | "quiz" | "resource";
  position?: number;
  video_url?: string;
  text_content?: string;
  is_preview?: boolean;
}

export interface CourseUpdateInput {
  title?: string;
  slug?: string;
  description?: string;
  cover_url?: string;
  status?: "draft" | "published";
  sections?: SectionInput[];
}

export interface BackendSectionResult {
  id: string;
  title: string;
  position: number;
  course_id: string;
}

export interface BackendLessonResult {
  id: string;
  title: string;
  lesson_type: "video" | "text" | "quiz" | "resource";
  position: number;
  section_id: string;
  video_url?: string;
  text_content?: string;
  is_preview: boolean;
}

export interface CourseLessonProgress {
  lessonId: string;
  videoPosition: number;
  completed: boolean;
  completedAt: string | null;
}

export interface CourseProgress {
  courseId: string;
  enrollmentId: string;
  completedLessons: number;
  totalLessons: number;
  percentComplete: number;
  lessons: CourseLessonProgress[];
  enrolledAt: string;
  completedAt: string | null;
}

// Public catalog types
export interface CourseListing {
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
}

export interface CourseSection {
  title: string;
  duration: string;
  lessons: string[];
}

export interface CourseReview {
  name: string;
  rating: number;
  date: string;
  body: string;
  avatar: string;
}

export interface CourseFaq {
  question: string;
  answer: string;
}

export interface CourseDetail extends CourseListing {
  subtitle: string;
  reviewCount: number;
  updated: string;
  language: string;
  certificate: boolean;
  description: string[];
  outcomes: string[];
  requirements: string[];
  faqs: CourseFaq[];
  curriculum: CourseSection[];
  instructorRole: string;
  instructorBio: string;
  instructorImage: string;
  reviews: CourseReview[];
}
