import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { logServiceError } from "../lib/service-error.js";
import { applyPagination } from '../lib/pagination.js';
import { checkVersion, buildVersionIncrement, isCasError } from '../lib/optimistic-lock.js';
import { isValidSlug } from '../lib/slug.js';

export interface Course {
  id: string;
  creator_id: string;
  title: string;
  slug: string;
  description?: string;
  cover_url?: string;
  status: "draft" | "published" | "unpublished";
  version: number;
  published_at?: string;
  created_at: string;
  updated_at: string;
  sections?: Section[];
}

export interface Section {
  id: string;
  course_id: string;
  title: string;
  position: number;
  created_at: string;
  updated_at: string;
  lessons?: Lesson[];
}

export interface Lesson {
  id: string;
  section_id: string;
  title: string;
  lesson_type: "video" | "text" | "quiz" | "resource";
  position: number;
  video_url?: string;
  text_content?: string;
  is_preview: boolean;
  created_at: string;
  updated_at: string;
  resources?: Resource[];
  quiz?: Quiz;
}

export interface Resource {
  id: string;
  lesson_id: string;
  title: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  created_at: string;
}

export interface Quiz {
  id: string;
  lesson_id: string;
  title: string;
  passing_score: number;
  created_at: string;
  updated_at: string;
  questions?: Question[];
}

export interface Question {
  id: string;
  quiz_id: string;
  question_text: string;
  position: number;
  created_at: string;
  options?: QuestionOption[];
}

export interface QuestionOption {
  id: string;
  question_id: string;
  option_text: string;
  is_correct: boolean;
  position: number;
  created_at: string;
}

export interface Enrollment {
  id: string;
  course_id: string;
  user_id: string;
  enrolled_at: string;
  completed_at?: string;
}

export interface LessonProgress {
  id: string;
  enrollment_id: string;
  lesson_id: string;
  completed: boolean;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CourseProgress {
  course_id: string;
  enrollment_id: string;
  total_lessons: number;
  completed_lessons: number;
  percent_complete: number;
  lessons: LessonProgress[];
}

export interface CourseInput {
  title: string;
  slug?: string;
  description?: string;
  cover_url?: string;
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

export interface ResourceInput {
  title: string;
  file_path: string;
  mime_type: string;
  file_size: number;
}

export interface QuizInput {
  title: string;
  passing_score?: number;
}

export interface QuestionInput {
  question_text: string;
  position?: number;
  options: { option_text: string; is_correct: boolean }[];
}

export type CourseResult<T> =
  | { status: "ok"; data: T }
  | { status: "not_found" | "forbidden" | "conflict" | "unavailable" | "validation_error"; error?: string };

function defaultClientFactory(url: string, key: string): (token?: string) => SupabaseClient {
  return (token?: string) =>
    createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
    });
}

function mapCourseRow(row: Record<string, unknown>): Course {
  const course: Course = {
    id: row.id as string,
    creator_id: row.creator_id as string,
    title: row.title as string,
    slug: row.slug as string,
    status: row.status as Course["status"],
    version: row.version as number,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
  if (row.description != null) course.description = row.description as string;
  if (row.cover_url != null) course.cover_url = row.cover_url as string;
  if (row.published_at != null) course.published_at = row.published_at as string;
  if (row.sections != null) course.sections = (row.sections as Record<string, unknown>[]).map(mapSectionRow);
  return course;
}

function mapSectionRow(row: Record<string, unknown>): Section {
  const section: Section = {
    id: row.id as string,
    course_id: row.course_id as string,
    title: row.title as string,
    position: row.position as number,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
  if (row.lessons != null) section.lessons = (row.lessons as Record<string, unknown>[]).map(mapLessonRow);
  return section;
}

function mapLessonRow(row: Record<string, unknown>): Lesson {
  const lesson: Lesson = {
    id: row.id as string,
    section_id: row.section_id as string,
    title: row.title as string,
    lesson_type: row.lesson_type as Lesson["lesson_type"],
    position: row.position as number,
    is_preview: row.is_preview as boolean,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
  if (row.video_url != null) lesson.video_url = row.video_url as string;
  if (row.text_content != null) lesson.text_content = row.text_content as string;
  if (row.resources != null) lesson.resources = (row.resources as Record<string, unknown>[]).map(mapResourceRow);
  if (row.quiz != null) lesson.quiz = mapQuizRow(row.quiz as Record<string, unknown>);
  return lesson;
}

function mapResourceRow(row: Record<string, unknown>): Resource {
  return {
    id: row.id as string,
    lesson_id: row.lesson_id as string,
    title: row.title as string,
    file_path: row.file_path as string,
    mime_type: row.mime_type as string,
    file_size: row.file_size as number,
    created_at: row.created_at as string,
  };
}

function mapQuizRow(row: Record<string, unknown>): Quiz {
  const quiz: Quiz = {
    id: row.id as string,
    lesson_id: row.lesson_id as string,
    title: row.title as string,
    passing_score: row.passing_score as number,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
  if (row.questions != null) quiz.questions = (row.questions as Record<string, unknown>[]).map(mapQuestionRow);
  return quiz;
}

function mapQuestionRow(row: Record<string, unknown>): Question {
  const question: Question = {
    id: row.id as string,
    quiz_id: row.quiz_id as string,
    question_text: row.question_text as string,
    position: row.position as number,
    created_at: row.created_at as string,
  };
  if (row.options != null) question.options = (row.options as Record<string, unknown>[]).map(mapQuestionOptionRow);
  return question;
}

function mapQuestionOptionRow(row: Record<string, unknown>): QuestionOption {
  return {
    id: row.id as string,
    question_id: row.question_id as string,
    option_text: row.option_text as string,
    is_correct: row.is_correct as boolean,
    position: row.position as number,
    created_at: row.created_at as string,
  };
}

function mapEnrollmentRow(row: Record<string, unknown>): Enrollment {
  const enrollment: Enrollment = {
    id: row.id as string,
    course_id: row.course_id as string,
    user_id: row.user_id as string,
    enrolled_at: row.enrolled_at as string,
  };
  if (row.completed_at != null) enrollment.completed_at = row.completed_at as string;
  return enrollment;
}

function mapLessonProgressRow(row: Record<string, unknown>): LessonProgress {
  const progress: LessonProgress = {
    id: row.id as string,
    enrollment_id: row.enrollment_id as string,
    lesson_id: row.lesson_id as string,
    completed: row.completed as boolean,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
  if (row.completed_at != null) progress.completed_at = row.completed_at as string;
  return progress;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 100);
}

export interface CourseService {
  createCourse(token: string, creatorId: string, input: CourseInput): Promise<CourseResult<Course>>;
  getCourse(courseId: string, userId?: string): Promise<CourseResult<Course>>;
  getCourseBySlug(slug: string): Promise<CourseResult<Course>>;
  updateCourse(token: string, courseId: string, expectedVersion: number, patch: Partial<CourseInput>): Promise<CourseResult<Course>>;
  deleteCourse(token: string, courseId: string): Promise<CourseResult<void>>;
  listMyCourses(token: string, userId: string): Promise<CourseResult<Course[]>>;
  listPublicCourses(filters?: { limit?: number; offset?: number }): Promise<CourseResult<Course[]>>;

  publishCourse(token: string, courseId: string): Promise<CourseResult<Course>>;
  unpublishCourse(token: string, courseId: string): Promise<CourseResult<Course>>;
  validateForPublishing(courseId: string): Promise<CourseResult<{ valid: boolean; errors: string[] }>>;

  createSection(token: string, courseId: string, input: SectionInput): Promise<CourseResult<Section>>;
  updateSection(token: string, sectionId: string, patch: Partial<SectionInput>): Promise<CourseResult<Section>>;
  deleteSection(token: string, sectionId: string): Promise<CourseResult<void>>;
  reorderSections(token: string, courseId: string, sectionIds: string[]): Promise<CourseResult<void>>;

  createLesson(token: string, sectionId: string, input: LessonInput): Promise<CourseResult<Lesson>>;
  updateLesson(token: string, lessonId: string, patch: Partial<LessonInput>): Promise<CourseResult<Lesson>>;
  deleteLesson(token: string, lessonId: string): Promise<CourseResult<void>>;
  reorderLessons(token: string, sectionId: string, lessonIds: string[]): Promise<CourseResult<void>>;

  createResource(token: string, lessonId: string, input: ResourceInput): Promise<CourseResult<Resource>>;
  deleteResource(token: string, resourceId: string): Promise<CourseResult<void>>;

  createQuiz(token: string, lessonId: string, input: QuizInput): Promise<CourseResult<Quiz>>;
  addQuizQuestion(token: string, quizId: string, input: QuestionInput): Promise<CourseResult<Question>>;
  deleteQuizQuestion(token: string, questionId: string): Promise<CourseResult<void>>;

  getEnrollment(userId: string, courseId: string): Promise<CourseResult<Enrollment | null>>;
  listMyEnrollments(userId: string): Promise<CourseResult<Enrollment[]>>;

  updateLessonProgress(token: string, userId: string, lessonId: string, completed: boolean): Promise<CourseResult<LessonProgress>>;
  getCourseProgress(userId: string, courseId: string): Promise<CourseResult<CourseProgress>>;

  canAccessLesson(userId: string, lessonId: string): Promise<boolean>;
  isCourseOwner(userId: string, courseId: string): Promise<boolean>;

  getSignedVideoUrl(courseId: string, lessonId: string, userId: string): Promise<CourseResult<string>>;
  getSignedResourceUrl(courseId: string, resourceId: string, userId: string): Promise<CourseResult<string>>;
}

export function createSupabaseCourseService(
  url: string,
  publishableKey: string,
  clientFactory: (token?: string) => SupabaseClient = defaultClientFactory(url, publishableKey),
): CourseService {
  const caller = clientFactory;

  async function getCourseByIdInternal(courseId: string, token?: string): Promise<CourseResult<Course>> {
    try {
      const { data, error } = await caller(token)
        .from("courses")
        .select("*, sections(*, lessons(*, resources(*), quiz:course_quizzes(*, questions:course_quiz_questions(*, options:course_quiz_options(*)))))")
        .eq("id", courseId)
        .single();
      if (error || !data) return { status: "not_found" };
      return { status: "ok", data: mapCourseRow(data) };
    } catch (error) {
      logServiceError({ service: "course-service", operation: "getCourseByIdInternal", error });
      return { status: "unavailable" };
    }
  }

  async function getLessonCourseId(lessonId: string): Promise<string | null> {
    try {
      const { data, error } = await caller()
        .from("course_lessons")
        .select("section_id, course_sections(course_id)")
        .eq("id", lessonId)
        .single();
      if (error || !data) return null;
      const record = data as unknown as { section_id: string; course_sections: { course_id: string }[] };
      return record.course_sections?.[0]?.course_id ?? null;
    } catch {
      return null;
    }
  }

  async function getSectionCourseId(sectionId: string): Promise<string | null> {
    try {
      const { data, error } = await caller()
        .from("course_sections")
        .select("course_id")
        .eq("id", sectionId)
        .single();
      if (error || !data) return null;
      return (data as { course_id: string }).course_id;
    } catch {
      return null;
    }
  }

  async function getResourceLessonId(resourceId: string): Promise<string | null> {
    try {
      const { data, error } = await caller()
        .from("course_resources")
        .select("lesson_id")
        .eq("id", resourceId)
        .single();
      if (error || !data) return null;
      return (data as { lesson_id: string }).lesson_id;
    } catch {
      return null;
    }
  }

  async function getQuizLessonId(quizId: string): Promise<string | null> {
    try {
      const { data, error } = await caller()
        .from("course_quizzes")
        .select("lesson_id")
        .eq("id", quizId)
        .single();
      if (error || !data) return null;
      return (data as { lesson_id: string }).lesson_id;
    } catch {
      return null;
    }
  }

  return {
    async createCourse(token: string, creatorId: string, input: CourseInput): Promise<CourseResult<Course>> {
      try {
        const slug = input.slug || generateSlug(input.title);
        if (input.slug && !isValidSlug(input.slug)) {
          return { status: "validation_error", error: "invalid slug format" };
        }

        const { data: existing } = await caller(token).from("courses").select("id, slug").eq("slug", slug).single();
        if (existing) return { status: "conflict", error: "slug already exists" };

        const { data, error } = await caller(token)
          .from("courses")
          .insert({
            creator_id: creatorId,
            title: input.title,
            slug,
            description: input.description ?? null,
            cover_url: input.cover_url ?? null,
            status: "draft",
            version: 1,
          })
          .select("*, sections(*, lessons(*, resources(*), quiz:course_quizzes(*, questions:course_quiz_questions(*, options:course_quiz_options(*)))))")
          .single();

        if (error) {
          if (error.code === "23505") return { status: "conflict", error: "slug already exists" };
          if (error.code === "42501") return { status: "forbidden" };
          logServiceError({ service: "course-service", operation: "createCourse", error });
          return { status: "unavailable" };
        }
        return { status: "ok", data: mapCourseRow(data) };
      } catch (error) {
        logServiceError({ service: "course-service", operation: "createCourse", error });
        return { status: "unavailable" };
      }
    },

    async getCourse(courseId: string, userId?: string): Promise<CourseResult<Course>> {
      const result = await getCourseByIdInternal(courseId);
      if (result.status !== "ok") return result;
      const course = result.data;
      if (course.status !== "published" && course.creator_id !== userId) {
        return { status: "not_found" };
      }
      return result;
    },

    async getCourseBySlug(slug: string): Promise<CourseResult<Course>> {
      try {
        const { data, error } = await caller()
          .from("courses")
          .select("*, sections(*, lessons(*, resources(*), quiz:course_quizzes(*, questions:course_quiz_questions(*, options:course_quiz_options(*)))))")
          .eq("slug", slug)
          .eq("status", "published")
          .single();
        if (error || !data) return { status: "not_found" };
        return { status: "ok", data: mapCourseRow(data) };
      } catch (error) {
        logServiceError({ service: "course-service", operation: "getCourseBySlug", error });
        return { status: "unavailable" };
      }
    },

    async updateCourse(
      token: string,
      courseId: string,
      expectedVersion: number,
      patch: Partial<CourseInput>,
    ): Promise<CourseResult<Course>> {
      try {
        const { data: existing, error: readError } = await caller(token)
          .from("courses")
          .select("id, version, slug")
          .eq("id", courseId)
          .single();
        if (readError || !existing) return { status: "not_found" };
        if (!checkVersion(existing, expectedVersion)) return { status: "conflict" };

        const update: Record<string, unknown> = buildVersionIncrement(expectedVersion);
        if (patch.title !== undefined) update.title = patch.title;
        if (patch.description !== undefined) update.description = patch.description ?? null;
        if (patch.cover_url !== undefined) update.cover_url = patch.cover_url ?? null;
        if (patch.slug !== undefined) {
          if (!isValidSlug(patch.slug)) return { status: "validation_error", error: "invalid slug format" };
          update.slug = patch.slug;
        }

        const { data, error } = await caller(token)
          .from("courses")
          .update(update)
          .eq("id", courseId)
          .eq("version", expectedVersion)
          .select("*, sections(*, lessons(*, resources(*), quiz:course_quizzes(*, questions:course_quiz_questions(*, options:course_quiz_options(*)))))")
          .single();

        if (error) {
          if (isCasError(error)) return { status: "conflict" };
          if (error.code === "23505") return { status: "conflict", error: "slug already exists" };
          if (error.code === "42501") return { status: "forbidden" };
          logServiceError({ service: "course-service", operation: "updateCourse", error });
          return { status: "unavailable" };
        }
        if (!data) return { status: "conflict" };
        return { status: "ok", data: mapCourseRow(data) };
      } catch (error) {
        logServiceError({ service: "course-service", operation: "updateCourse", error });
        return { status: "unavailable" };
      }
    },

    async deleteCourse(token: string, courseId: string): Promise<CourseResult<void>> {
      try {
        const { data: course, error: courseError } = await caller(token)
          .from("courses")
          .select("id, status")
          .eq("id", courseId)
          .single();
        if (courseError || !course) return { status: "not_found" };

        const { data: enrollments } = await caller()
          .from("course_enrollments")
          .select("id")
          .eq("course_id", courseId)
          .limit(1);

        const courseRecord = course as { id: string; status: string };
        if (enrollments && enrollments.length > 0 && courseRecord.status === "published") {
          return { status: "forbidden", error: "Cannot delete a published course with existing enrollments" };
        }

        const { error } = await caller(token).from("courses").delete().eq("id", courseId);
        if (error) {
          if (error.code === "42501") return { status: "forbidden" };
          logServiceError({ service: "course-service", operation: "deleteCourse", error });
          return { status: "unavailable" };
        }
        return { status: "ok", data: undefined as void };
      } catch (error) {
        logServiceError({ service: "course-service", operation: "deleteCourse", error });
        return { status: "unavailable" };
      }
    },

    async listMyCourses(token: string, userId: string): Promise<CourseResult<Course[]>> {
      try {
        const { data, error } = await caller(token)
          .from("courses")
          .select("*, sections(*, lessons(*))")
          .eq("creator_id", userId)
          .order("updated_at", { ascending: false });
        if (error) {
          logServiceError({ service: "course-service", operation: "listMyCourses", error });
          return { status: "unavailable" };
        }
        return { status: "ok", data: (data || []).map(mapCourseRow) };
      } catch (error) {
        logServiceError({ service: "course-service", operation: "listMyCourses", error });
        return { status: "unavailable" };
      }
    },

    async listPublicCourses(filters?: { limit?: number; offset?: number }): Promise<CourseResult<Course[]>> {
      try {
        const q = applyPagination(
          caller()
            .from("courses")
            .select("*, sections(*, lessons(*))")
            .eq("status", "published")
            .order("published_at", { ascending: false }),
          filters
        );
        const { data, error } = await q;
        if (error) {
          logServiceError({ service: "course-service", operation: "listPublicCourses", error });
          return { status: "unavailable" };
        }
        return { status: "ok", data: (data || []).map(mapCourseRow) };
      } catch (error) {
        logServiceError({ service: "course-service", operation: "listPublicCourses", error });
        return { status: "unavailable" };
      }
    },

    async publishCourse(token: string, courseId: string): Promise<CourseResult<Course>> {
      try {
        const validation = await this.validateForPublishing(courseId);
        if (validation.status !== "ok") return validation;
        if (!validation.data.valid) return { status: "validation_error", error: validation.data.errors.join("; ") };

        const { data: existing, error: readError } = await caller(token)
          .from("courses")
          .select("id, status, version")
          .eq("id", courseId)
          .single();
        if (readError || !existing) return { status: "not_found" };
        if (existing.status === "published") return { status: "conflict", error: "course already published" };

        const nextVersion = Number(existing.version) + 1;
        const { data, error } = await caller(token)
          .from("courses")
          .update({ status: "published", published_at: new Date().toISOString(), version: nextVersion })
          .eq("id", courseId)
          .eq("version", existing.version)
          .select("*, sections(*, lessons(*, resources(*), quiz:course_quizzes(*, questions:course_quiz_questions(*, options:course_quiz_options(*)))))")
          .single();

        if (error) {
          if (isCasError(error)) return { status: "conflict" };
          logServiceError({ service: "course-service", operation: "publishCourse", error });
          return { status: "unavailable" };
        }
        if (!data) return { status: "conflict" };
        return { status: "ok", data: mapCourseRow(data) };
      } catch (error) {
        logServiceError({ service: "course-service", operation: "publishCourse", error });
        return { status: "unavailable" };
      }
    },

    async unpublishCourse(token: string, courseId: string): Promise<CourseResult<Course>> {
      try {
        const { data: existing, error: readError } = await caller(token)
          .from("courses")
          .select("id, status, version")
          .eq("id", courseId)
          .single();
        if (readError || !existing) return { status: "not_found" };
        if (existing.status !== "published") return { status: "conflict", error: "course not published" };

        const nextVersion = Number(existing.version) + 1;
        const { data, error } = await caller(token)
          .from("courses")
          .update({ status: "unpublished", version: nextVersion })
          .eq("id", courseId)
          .eq("version", existing.version)
          .select("*, sections(*, lessons(*, resources(*), quiz:course_quizzes(*, questions:course_quiz_questions(*, options:course_quiz_options(*)))))")
          .single();

        if (error) {
          if (isCasError(error)) return { status: "conflict" };
          logServiceError({ service: "course-service", operation: "unpublishCourse", error });
          return { status: "unavailable" };
        }
        if (!data) return { status: "conflict" };
        return { status: "ok", data: mapCourseRow(data) };
      } catch (error) {
        logServiceError({ service: "course-service", operation: "unpublishCourse", error });
        return { status: "unavailable" };
      }
    },

    async validateForPublishing(courseId: string): Promise<CourseResult<{ valid: boolean; errors: string[] }>> {
      try {
        const { data, error } = await caller()
          .from("courses")
          .select("id, title, cover_url, sections(*, lessons(*))")
          .eq("id", courseId)
          .single();

        if (error || !data) return { status: "not_found" };

        const errors: string[] = [];
        const course = data as {
          title: string;
          cover_url?: string;
          sections?: { lessons?: { title: string; lesson_type: string; video_url?: string; text_content?: string }[] }[];
        };

        if (!course.title || course.title.trim().length === 0) errors.push("Course must have a title");
        if (!course.cover_url) errors.push("Course must have a cover image");

        const sections = course.sections || [];
        if (sections.length === 0) errors.push("Course must have at least one section");

        let hasAtLeastOneLesson = false;
        for (const section of sections) {
          const lessons = section.lessons || [];
          if (lessons.length === 0) continue;
          hasAtLeastOneLesson = true;
          for (const lesson of lessons) {
            if (!lesson.title || lesson.title.trim().length === 0) {
              errors.push(`Lesson must have a title`);
            }
            if (lesson.lesson_type === "video" && !lesson.video_url) {
              errors.push(`Video lesson must have a video_url`);
            }
            if (lesson.lesson_type === "text" && !lesson.text_content) {
              errors.push(`Text lesson must have text_content`);
            }
          }
        }

        if (!hasAtLeastOneLesson) errors.push("Course must have at least one lesson");

        return { status: "ok", data: { valid: errors.length === 0, errors } };
      } catch (error) {
        logServiceError({ service: "course-service", operation: "validateForPublishing", error });
        return { status: "unavailable" };
      }
    },

    async createSection(token: string, courseId: string, input: SectionInput): Promise<CourseResult<Section>> {
      try {
        const { data: existing } = await caller(token)
          .from("courses")
          .select("id")
          .eq("id", courseId)
          .single();
        if (!existing) return { status: "not_found" };

        let position = input.position;
        if (position === undefined) {
          const { data: maxData } = await caller(token)
            .from("course_sections")
            .select("position")
            .eq("course_id", courseId)
            .order("position", { ascending: false })
            .limit(1)
            .single();
          position = maxData ? (maxData as { position: number }).position + 1 : 0;
        }

        const { data, error } = await caller(token)
          .from("course_sections")
          .insert({ course_id: courseId, title: input.title, position })
          .select()
          .single();

        if (error) {
          if (error.code === "42501") return { status: "forbidden" };
          logServiceError({ service: "course-service", operation: "createSection", error });
          return { status: "unavailable" };
        }
        return { status: "ok", data: mapSectionRow(data) };
      } catch (error) {
        logServiceError({ service: "course-service", operation: "createSection", error });
        return { status: "unavailable" };
      }
    },

    async updateSection(token: string, sectionId: string, patch: Partial<SectionInput>): Promise<CourseResult<Section>> {
      try {
        const { data: existing, error: readError } = await caller(token)
          .from("course_sections")
          .select("id, course_id")
          .eq("id", sectionId)
          .single();
        if (readError || !existing) return { status: "not_found" };

        const update: Record<string, unknown> = {};
        if (patch.title !== undefined) update.title = patch.title;
        if (patch.position !== undefined) update.position = patch.position;

        const { data, error } = await caller(token)
          .from("course_sections")
          .update(update)
          .eq("id", sectionId)
          .select()
          .single();

        if (error) {
          if (error.code === "42501") return { status: "forbidden" };
          logServiceError({ service: "course-service", operation: "updateSection", error });
          return { status: "unavailable" };
        }
        return { status: "ok", data: mapSectionRow(data) };
      } catch (error) {
        logServiceError({ service: "course-service", operation: "updateSection", error });
        return { status: "unavailable" };
      }
    },

    async deleteSection(token: string, sectionId: string): Promise<CourseResult<void>> {
      try {
        const { error } = await caller(token).from("course_sections").delete().eq("id", sectionId);
        if (error) {
          if (error.code === "42501") return { status: "forbidden" };
          logServiceError({ service: "course-service", operation: "deleteSection", error });
          return { status: "unavailable" };
        }
        return { status: "ok", data: undefined as void };
      } catch (error) {
        logServiceError({ service: "course-service", operation: "deleteSection", error });
        return { status: "unavailable" };
      }
    },

    async reorderSections(token: string, courseId: string, sectionIds: string[]): Promise<CourseResult<void>> {
      try {
        const updates = sectionIds.map((id, index) =>
          caller(token).from("course_sections").update({ position: index }).eq("id", id).eq("course_id", courseId),
        );
        const results = await Promise.all(updates);
        const error = results.find((r) => r.error);
        if (error?.error) {
          if (error.error.code === "42501") return { status: "forbidden" };
          logServiceError({ service: "course-service", operation: "reorderSections", error: error.error });
          return { status: "unavailable" };
        }
        return { status: "ok", data: undefined as void };
      } catch (error) {
        logServiceError({ service: "course-service", operation: "reorderSections", error });
        return { status: "unavailable" };
      }
    },

    async createLesson(token: string, sectionId: string, input: LessonInput): Promise<CourseResult<Lesson>> {
      try {
        const courseId = await getSectionCourseId(sectionId);
        if (!courseId) return { status: "not_found" };

        let position = input.position;
        if (position === undefined) {
          const { data: maxData } = await caller(token)
            .from("course_lessons")
            .select("position")
            .eq("section_id", sectionId)
            .order("position", { ascending: false })
            .limit(1)
            .single();
          position = maxData ? (maxData as { position: number }).position + 1 : 0;
        }

        const { data, error } = await caller(token)
          .from("course_lessons")
          .insert({
            section_id: sectionId,
            title: input.title,
            lesson_type: input.lesson_type,
            position,
            video_url: input.video_url ?? null,
            text_content: input.text_content ?? null,
            is_preview: input.is_preview ?? false,
          })
          .select("*, resources(*), quiz:course_quizzes(*, questions:course_quiz_questions(*, options:course_quiz_options(*)))")
          .single();

        if (error) {
          if (error.code === "42501") return { status: "forbidden" };
          logServiceError({ service: "course-service", operation: "createLesson", error });
          return { status: "unavailable" };
        }
        return { status: "ok", data: mapLessonRow(data) };
      } catch (error) {
        logServiceError({ service: "course-service", operation: "createLesson", error });
        return { status: "unavailable" };
      }
    },

    async updateLesson(token: string, lessonId: string, patch: Partial<LessonInput>): Promise<CourseResult<Lesson>> {
      try {
        const update: Record<string, unknown> = {};
        if (patch.title !== undefined) update.title = patch.title;
        if (patch.lesson_type !== undefined) update.lesson_type = patch.lesson_type;
        if (patch.position !== undefined) update.position = patch.position;
        if (patch.video_url !== undefined) update.video_url = patch.video_url ?? null;
        if (patch.text_content !== undefined) update.text_content = patch.text_content ?? null;
        if (patch.is_preview !== undefined) update.is_preview = patch.is_preview;

        const { data, error } = await caller(token)
          .from("course_lessons")
          .update(update)
          .eq("id", lessonId)
          .select("*, resources(*), quiz:course_quizzes(*, questions:course_quiz_questions(*, options:course_quiz_options(*)))")
          .single();

        if (error) {
          if (error.code === "42501") return { status: "forbidden" };
          logServiceError({ service: "course-service", operation: "updateLesson", error });
          return { status: "unavailable" };
        }
        if (!data) return { status: "not_found" };
        return { status: "ok", data: mapLessonRow(data) };
      } catch (error) {
        logServiceError({ service: "course-service", operation: "updateLesson", error });
        return { status: "unavailable" };
      }
    },

    async deleteLesson(token: string, lessonId: string): Promise<CourseResult<void>> {
      try {
        const { error } = await caller(token).from("course_lessons").delete().eq("id", lessonId);
        if (error) {
          if (error.code === "42501") return { status: "forbidden" };
          logServiceError({ service: "course-service", operation: "deleteLesson", error });
          return { status: "unavailable" };
        }
        return { status: "ok", data: undefined as void };
      } catch (error) {
        logServiceError({ service: "course-service", operation: "deleteLesson", error });
        return { status: "unavailable" };
      }
    },

    async reorderLessons(token: string, sectionId: string, lessonIds: string[]): Promise<CourseResult<void>> {
      try {
        const courseId = await getSectionCourseId(sectionId);
        if (!courseId) return { status: "not_found" };

        const updates = lessonIds.map((id, index) =>
          caller(token)
            .from("course_lessons")
            .update({ position: index })
            .eq("id", id)
            .eq("section_id", sectionId),
        );
        const results = await Promise.all(updates);
        const error = results.find((r) => r.error);
        if (error?.error) {
          if (error.error.code === "42501") return { status: "forbidden" };
          logServiceError({ service: "course-service", operation: "reorderLessons", error: error.error });
          return { status: "unavailable" };
        }
        return { status: "ok", data: undefined as void };
      } catch (error) {
        logServiceError({ service: "course-service", operation: "reorderLessons", error });
        return { status: "unavailable" };
      }
    },

    async createResource(token: string, lessonId: string, input: ResourceInput): Promise<CourseResult<Resource>> {
      try {
        const courseId = await getLessonCourseId(lessonId);
        if (!courseId) return { status: "not_found" };

        const { data, error } = await caller(token)
          .from("course_resources")
          .insert({
            lesson_id: lessonId,
            title: input.title,
            file_path: input.file_path,
            mime_type: input.mime_type,
            file_size: input.file_size,
          })
          .select()
          .single();

        if (error) {
          if (error.code === "42501") return { status: "forbidden" };
          logServiceError({ service: "course-service", operation: "createResource", error });
          return { status: "unavailable" };
        }
        return { status: "ok", data: mapResourceRow(data) };
      } catch (error) {
        logServiceError({ service: "course-service", operation: "createResource", error });
        return { status: "unavailable" };
      }
    },

    async deleteResource(token: string, resourceId: string): Promise<CourseResult<void>> {
      try {
        const { error } = await caller(token).from("course_resources").delete().eq("id", resourceId);
        if (error) {
          if (error.code === "42501") return { status: "forbidden" };
          logServiceError({ service: "course-service", operation: "deleteResource", error });
          return { status: "unavailable" };
        }
        return { status: "ok", data: undefined as void };
      } catch (error) {
        logServiceError({ service: "course-service", operation: "deleteResource", error });
        return { status: "unavailable" };
      }
    },

    async createQuiz(token: string, lessonId: string, input: QuizInput): Promise<CourseResult<Quiz>> {
      try {
        const courseId = await getLessonCourseId(lessonId);
        if (!courseId) return { status: "not_found" };

        const { data: existingQuiz } = await caller(token)
          .from("course_quizzes")
          .select("id")
          .eq("lesson_id", lessonId)
          .single();
        if (existingQuiz) return { status: "conflict", error: "quiz already exists for this lesson" };

        const { data, error } = await caller(token)
          .from("course_quizzes")
          .insert({
            lesson_id: lessonId,
            title: input.title,
            passing_score: input.passing_score ?? 70,
          })
          .select("*, questions:course_quiz_questions(*, options:course_quiz_options(*))")
          .single();

        if (error) {
          if (error.code === "42501") return { status: "forbidden" };
          logServiceError({ service: "course-service", operation: "createQuiz", error });
          return { status: "unavailable" };
        }
        return { status: "ok", data: mapQuizRow(data) };
      } catch (error) {
        logServiceError({ service: "course-service", operation: "createQuiz", error });
        return { status: "unavailable" };
      }
    },

    async addQuizQuestion(token: string, quizId: string, input: QuestionInput): Promise<CourseResult<Question>> {
      try {
        const courseId = await getQuizLessonId(quizId);
        if (!courseId) return { status: "not_found" };

        let position = input.position;
        if (position === undefined) {
          const { data: maxData } = await caller(token)
            .from("course_quiz_questions")
            .select("position")
            .eq("quiz_id", quizId)
            .order("position", { ascending: false })
            .limit(1)
            .single();
          position = maxData ? (maxData as { position: number }).position + 1 : 0;
        }

        const { data: questionData, error: questionError } = await caller(token)
          .from("course_quiz_questions")
          .insert({ quiz_id: quizId, question_text: input.question_text, position })
          .select()
          .single();

        if (questionError) {
          if (questionError.code === "42501") return { status: "forbidden" };
          logServiceError({ service: "course-service", operation: "addQuizQuestion", error: questionError });
          return { status: "unavailable" };
        }

        const optionsWithQuestionId = input.options.map((opt, idx) => ({
          question_id: questionData.id,
          option_text: opt.option_text,
          is_correct: opt.is_correct,
          position: idx,
        }));

        const { data: optionsData, error: optionsError } = await caller(token)
          .from("course_quiz_options")
          .insert(optionsWithQuestionId)
          .select();

        if (optionsError) {
          logServiceError({ service: "course-service", operation: "addQuizQuestion options", error: optionsError });
        }

        const question = mapQuestionRow(questionData);
        question.options = (optionsData || []).map((o: Record<string, unknown>) => ({
          id: o.id as string,
          question_id: o.question_id as string,
          option_text: o.option_text as string,
          is_correct: o.is_correct as boolean,
          position: o.position as number,
          created_at: o.created_at as string,
        }));

        return { status: "ok", data: question };
      } catch (error) {
        logServiceError({ service: "course-service", operation: "addQuizQuestion", error });
        return { status: "unavailable" };
      }
    },

    async deleteQuizQuestion(token: string, questionId: string): Promise<CourseResult<void>> {
      try {
        const { error } = await caller(token).from("course_quiz_questions").delete().eq("id", questionId);
        if (error) {
          if (error.code === "42501") return { status: "forbidden" };
          logServiceError({ service: "course-service", operation: "deleteQuizQuestion", error });
          return { status: "unavailable" };
        }
        return { status: "ok", data: undefined as void };
      } catch (error) {
        logServiceError({ service: "course-service", operation: "deleteQuizQuestion", error });
        return { status: "unavailable" };
      }
    },

    async getEnrollment(userId: string, courseId: string): Promise<CourseResult<Enrollment | null>> {
      try {
        const { data, error } = await caller()
          .from("course_enrollments")
          .select()
          .eq("user_id", userId)
          .eq("course_id", courseId)
          .single();
        if (error && error.code !== "PGRST116") return { status: "ok", data: null };
        if (error || !data) return { status: "ok", data: null };
        return { status: "ok", data: mapEnrollmentRow(data) };
      } catch (error) {
        logServiceError({ service: "course-service", operation: "getEnrollment", error });
        return { status: "unavailable" };
      }
    },

    async listMyEnrollments(userId: string): Promise<CourseResult<Enrollment[]>> {
      try {
        const { data, error } = await caller()
          .from("course_enrollments")
          .select()
          .eq("user_id", userId)
          .order("enrolled_at", { ascending: false });
        if (error) {
          logServiceError({ service: "course-service", operation: "listMyEnrollments", error });
          return { status: "unavailable" };
        }
        return { status: "ok", data: (data || []).map(mapEnrollmentRow) };
      } catch (error) {
        logServiceError({ service: "course-service", operation: "listMyEnrollments", error });
        return { status: "unavailable" };
      }
    },

    async updateLessonProgress(
      token: string,
      userId: string,
      lessonId: string,
      completed: boolean,
    ): Promise<CourseResult<LessonProgress>> {
      try {
        const courseId = await getLessonCourseId(lessonId);
        if (!courseId) return { status: "not_found" };

        const { data: enrollment } = await caller()
          .from("course_enrollments")
          .select("id")
          .eq("user_id", userId)
          .eq("course_id", courseId)
          .single();
        if (!enrollment) return { status: "forbidden", error: "user not enrolled" };

        const enrollmentRecord = enrollment as { id: string };

        const { data, error } = await caller(token)
          .from("course_lesson_progress")
          .upsert(
            {
              enrollment_id: enrollmentRecord.id,
              lesson_id: lessonId,
              completed,
              completed_at: completed ? new Date().toISOString() : null,
            },
            { onConflict: "enrollment_id,lesson_id" },
          )
          .select()
          .single();

        if (error) {
          if (error.code === "42501") return { status: "forbidden" };
          logServiceError({ service: "course-service", operation: "updateLessonProgress", error });
          return { status: "unavailable" };
        }
        return { status: "ok", data: mapLessonProgressRow(data) };
      } catch (error) {
        logServiceError({ service: "course-service", operation: "updateLessonProgress", error });
        return { status: "unavailable" };
      }
    },

    async getCourseProgress(userId: string, courseId: string): Promise<CourseResult<CourseProgress>> {
      try {
        const { data: enrollment } = await caller()
          .from("course_enrollments")
          .select("id")
          .eq("user_id", userId)
          .eq("course_id", courseId)
          .single();
        if (!enrollment) return { status: "not_found", error: "not enrolled" };

        const enrollmentRecord = enrollment as { id: string };

        const { data: totalLessonsData } = await caller()
          .from("course_lessons")
          .select("id, course_sections!inner(course_id)")
          .eq("course_sections.course_id", courseId);

        const totalLessons = totalLessonsData?.length ?? 0;

        const { data: progressData, error: progressError } = await caller()
          .from("course_lesson_progress")
          .select()
          .eq("enrollment_id", enrollmentRecord.id);

        if (progressError) {
          logServiceError({ service: "course-service", operation: "getCourseProgress", error: progressError });
          return { status: "unavailable" };
        }

        const lessons = (progressData || []).map(mapLessonProgressRow);
        const completedLessons = lessons.filter((l) => l.completed).length;
        const percentComplete = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

        return {
          status: "ok",
          data: {
            course_id: courseId,
            enrollment_id: enrollmentRecord.id,
            total_lessons: totalLessons,
            completed_lessons: completedLessons,
            percent_complete: percentComplete,
            lessons,
          },
        };
      } catch (error) {
        logServiceError({ service: "course-service", operation: "getCourseProgress", error });
        return { status: "unavailable" };
      }
    },

    async canAccessLesson(userId: string, lessonId: string): Promise<boolean> {
      try {
        const courseId = await getLessonCourseId(lessonId);
        if (!courseId) return false;

        const { data: course } = await caller().from("courses").select("creator_id").eq("id", courseId).single();
        if (course && (course as { creator_id: string }).creator_id === userId) return true;

        const { data: enrollment } = await caller()
          .from("course_enrollments")
          .select("id")
          .eq("user_id", userId)
          .eq("course_id", courseId)
          .single();
        return !!enrollment;
      } catch {
        return false;
      }
    },

    async isCourseOwner(userId: string, courseId: string): Promise<boolean> {
      try {
        const { data } = await caller().from("courses").select("creator_id").eq("id", courseId).single();
        if (!data) return false;
        return (data as { creator_id: string }).creator_id === userId;
      } catch {
        return false;
      }
    },

    async getSignedVideoUrl(courseId: string, lessonId: string, userId: string): Promise<CourseResult<string>> {
      try {
        const canAccess = await this.canAccessLesson(userId, lessonId);
        if (!canAccess) return { status: "forbidden" };

        const { data: lesson } = await caller()
          .from("course_lessons")
          .select("video_url")
          .eq("id", lessonId)
          .single();
        if (!lesson || !lesson.video_url) return { status: "not_found" };

        const lessonRecord = lesson as { video_url?: string };
        const videoPath = lessonRecord.video_url?.replace(/^.*\/course-videos\//, "");
        if (!videoPath) return { status: "not_found" };

        const { data, error } = await caller()
          .storage.from("course-videos")
          .createSignedUrl(videoPath, 3600);
        if (error || !data) return { status: "unavailable" };
        return { status: "ok", data: data.signedUrl };
      } catch (error) {
        logServiceError({ service: "course-service", operation: "getSignedVideoUrl", error });
        return { status: "unavailable" };
      }
    },

    async getSignedResourceUrl(courseId: string, resourceId: string, userId: string): Promise<CourseResult<string>> {
      try {
        const lessonId = await getResourceLessonId(resourceId);
        if (!lessonId) return { status: "not_found" };

        const canAccess = await this.canAccessLesson(userId, lessonId);
        if (!canAccess) return { status: "forbidden" };

        const { data: resource } = await caller()
          .from("course_resources")
          .select("file_path")
          .eq("id", resourceId)
          .single();
        if (!resource) return { status: "not_found" };

        const resourceRecord = resource as { file_path: string };
        const filePath = resourceRecord.file_path.replace(/^.*\/course-resources\//, "");
        if (!filePath) return { status: "not_found" };

        const { data, error } = await caller()
          .storage.from("course-resources")
          .createSignedUrl(filePath, 3600);
        if (error || !data) return { status: "unavailable" };
        return { status: "ok", data: data.signedUrl };
      } catch (error) {
        logServiceError({ service: "course-service", operation: "getSignedResourceUrl", error });
        return { status: "unavailable" };
      }
    },
  };
}
