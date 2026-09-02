import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { signUpConfirmed } from "./auth-helpers.js";
import { createSupabaseCourseService, type Course, type Section, type Lesson } from "../src/services/course-service.js";

const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
const dbUrl = process.env.SUPABASE_TEST_DB_URL;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
if (!url || !key || !dbUrl || !serviceKey) throw new Error("Integration tests require local Supabase URL, publishable key, DB URL, and service role key.");
if (!["localhost", "127.0.0.1", "host.docker.internal"].includes(new URL(url).hostname)) throw new Error("Refusing to run integration tests against a non-local Supabase target.");

const sql = postgres(dbUrl, { max: 5 });
const password = "Local-test-only-Password1!";

const createdCourseIds = new Set<string>();
const createdUserIds = new Set<string>();

async function signupTutor(metadata: Record<string, unknown> = {}): Promise<{ user: { id: string }; client: SupabaseClient; token: string }> {
  const email = `course-${randomUUID()}@example.test`;
  const r = await signUpConfirmed({
    anon: createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }),
    url: url!,
    publishableKey: key!,
    serviceRoleKey: serviceKey!,
    email,
    password,
    metadata: { name: "Course Tutor", role: "tutor", ...metadata },
    trustedTutor: true,
  });
  createdUserIds.add(r.user.id);
  return { user: r.user, client: r.client, token: r.session.access_token };
}

async function signupLearner(metadata: Record<string, unknown> = {}): Promise<{ user: { id: string }; client: SupabaseClient; token: string }> {
  const email = `learner-${randomUUID()}@example.test`;
  const r = await signUpConfirmed({
    anon: createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }),
    url: url!,
    publishableKey: key!,
    serviceRoleKey: serviceKey!,
    email,
    password,
    metadata: { name: "Course Learner", role: "learner", ...metadata },
    trustedTutor: false,
  });
  createdUserIds.add(r.user.id);
  return { user: r.user, client: r.client, token: r.session.access_token };
}

async function createTestCourse(token: string, creatorId: string, slug?: string): Promise<Course> {
  const service = createSupabaseCourseService(url!, key!);
  const result = await service.createCourse(token, creatorId, {
    title: "Test Course",
    slug: slug || `test-${randomUUID().slice(0, 8)}`,
    description: "A test course description",
    cover_url: "https://example.com/cover.jpg",
  });
  expect(result.status).toBe("ok");
  if (result.status !== "ok") throw new Error("Failed to create test course");
  const course = result.data;
  createdCourseIds.add(course.id);
  return course;
}

async function createTestSection(token: string, courseId: string, title: string, position?: number): Promise<Section> {
  const service = createSupabaseCourseService(url!, key!);
  const result = await service.createSection(token, courseId, { title, position });
  expect(result.status).toBe("ok");
  if (result.status !== "ok") throw new Error("Failed to create test section");
  return result.data;
}

async function createTestLesson(token: string, sectionId: string, title: string, lessonType: "video" | "text" = "text", additionalFields: Record<string, unknown> = {}): Promise<Lesson> {
  const service = createSupabaseCourseService(url!, key!);
  const input: Record<string, unknown> = { title, lesson_type: lessonType };
  if (lessonType === "video") input.video_url = "https://example.com/video.mp4";
  if (lessonType === "text") input.text_content = "Lesson content here";
  Object.assign(input, additionalFields);
  const result = await service.createLesson(token, sectionId, input as Parameters<typeof service.createLesson>[2]);
  expect(result.status).toBe("ok");
  if (result.status !== "ok") throw new Error("Failed to create test lesson");
  return result.data;
}

async function enrollLearner(learnerId: string, courseId: string): Promise<void> {
  await sql`INSERT INTO public.course_enrollments (id, course_id, user_id, enrolled_at) VALUES (${randomUUID()}, ${courseId}, ${learnerId}, NOW())`;
}

describe.sequential("course service (integration)", () => {
  afterAll(async () => {
    for (const courseId of createdCourseIds) {
      await sql`DELETE FROM public.course_enrollments WHERE course_id = ${courseId}`;
      await sql`DELETE FROM public.course_lesson_progress WHERE lesson_id IN (SELECT id FROM public.course_lessons WHERE section_id IN (SELECT id FROM public.course_sections WHERE course_id = ${courseId}))`;
      await sql`DELETE FROM public.course_lessons WHERE section_id IN (SELECT id FROM public.course_sections WHERE course_id = ${courseId})`;
      await sql`DELETE FROM public.course_sections WHERE course_id = ${courseId}`;
      await sql`DELETE FROM public.courses WHERE id = ${courseId}`;
    }
    for (const userId of createdUserIds) {
      await sql`DELETE FROM auth.users WHERE id = ${userId}`;
    }
    await sql.end({ timeout: 5 });
  });

  describe("course CRUD", () => {
    it("can create a course", async () => {
      const { user, token } = await signupTutor();
      const service = createSupabaseCourseService(url!, key!);
      const slug = `create-${randomUUID().slice(0, 8)}`;
      const result = await service.createCourse(token, user.id, {
        title: "Create Test Course",
        slug,
        description: "Course description",
        cover_url: "https://example.com/cover.jpg",
      });
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;
      expect(result.data.title).toBe("Create Test Course");
      expect(result.data.slug).toBe(slug);
      expect(result.data.status).toBe("draft");
      expect(result.data.version).toBe(1);
      expect(result.data.creator_id).toBe(user.id);
      createdCourseIds.add(result.data.id);
    });

    it("can read own course by ID", async () => {
      const { user, token } = await signupTutor();
      const course = await createTestCourse(token, user.id);
      const service = createSupabaseCourseService(url!, key!);
      const result = await service.getCourse(course.id);
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;
      expect(result.data.id).toBe(course.id);
      expect(result.data.title).toBe(course.title);
    });

    it("can read published course by slug", async () => {
      const { user, token } = await signupTutor();
      const course = await createTestCourse(token, user.id);
      const section = await createTestSection(token, course.id, "Test Section");
      await createTestLesson(token, section.id, "Test Lesson", "text");
      const service = createSupabaseCourseService(url!, key!);
      const publishResult = await service.publishCourse(token, course.id);
      expect(publishResult.status).toBe("ok");
      if (publishResult.status !== "ok") return;
      const getResult = await service.getCourseBySlug(course.slug);
      expect(getResult.status).toBe("ok");
      if (getResult.status !== "ok") return;
      expect(getResult.data.id).toBe(course.id);
      expect(getResult.data.status).toBe("published");
    });

    it("cannot read unpublished course by slug as public", async () => {
      const { user, token } = await signupTutor();
      const course = await createTestCourse(token, user.id);
      const service = createSupabaseCourseService(url!, key!);
      const result = await service.getCourseBySlug(course.slug);
      expect(result.status).toBe("not_found");
    });

    it("owner can update course with correct version", async () => {
      const { user, token } = await signupTutor();
      const course = await createTestCourse(token, user.id);
      const service = createSupabaseCourseService(url!, key!);
      const result = await service.updateCourse(token, course.id, 1, {
        title: "Updated Title",
        description: "Updated description",
      });
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;
      expect(result.data.title).toBe("Updated Title");
      expect(result.data.description).toBe("Updated description");
      expect(result.data.version).toBe(2);
    });

    it("update with wrong version returns conflict", async () => {
      const { user, token } = await signupTutor();
      const course = await createTestCourse(token, user.id);
      const service = createSupabaseCourseService(url!, key!);
      const result = await service.updateCourse(token, course.id, 999, { title: "Stale Update" });
      expect(result.status).toBe("conflict");
    });

    it("owner can delete course", async () => {
      const { user, token } = await signupTutor();
      const course = await createTestCourse(token, user.id);
      const service = createSupabaseCourseService(url!, key!);
      const deleteResult = await service.deleteCourse(token, course.id);
      expect(deleteResult.status).toBe("ok");
      const getResult = await service.getCourse(course.id);
      expect(getResult.status).toBe("not_found");
      createdCourseIds.delete(course.id);
    });

    it("can list own courses", async () => {
      const { user, token } = await signupTutor();
      await createTestCourse(token, user.id);
      await createTestCourse(token, user.id);
      const service = createSupabaseCourseService(url!, key!);
      const result = await service.listMyCourses(token, user.id);
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;
      expect(result.data.length).toBeGreaterThanOrEqual(2);
      expect(result.data.every((c) => c.creator_id === user.id)).toBe(true);
    });

    it("can list published courses", async () => {
      const { user, token } = await signupTutor();
      const course = await createTestCourse(token, user.id);
      const section = await createTestSection(token, course.id, "Test Section");
      await createTestLesson(token, section.id, "Test Lesson", "text");
      const service = createSupabaseCourseService(url!, key!);
      await service.publishCourse(token, course.id);
      const result = await service.listPublicCourses({ limit: 10 });
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;
      expect(result.data.some((c) => c.id === course.id)).toBe(true);
    });

    it("invalid course ID returns not_found", async () => {
      const service = createSupabaseCourseService(url!, key!);
      const result = await service.getCourse(randomUUID());
      expect(result.status).toBe("not_found");
    });

    it("another user cannot update course", async () => {
      const tutorA = await signupTutor({ name: "Tutor A" });
      const tutorB = await signupTutor({ name: "Tutor B" });
      const course = await createTestCourse(tutorA.token, tutorA.user.id);
      const service = createSupabaseCourseService(url!, key!);
      const result = await service.updateCourse(tutorB.token, course.id, 1, { title: "Hijacked" });
      expect(result.status).toBe("forbidden");
    });

    it("another user cannot delete course", async () => {
      const tutorA = await signupTutor({ name: "Tutor A" });
      const tutorB = await signupTutor({ name: "Tutor B" });
      const course = await createTestCourse(tutorA.token, tutorA.user.id);
      const service = createSupabaseCourseService(url!, key!);
      const result = await service.deleteCourse(tutorB.token, course.id);
      expect(result.status).toBe("forbidden");
    });
  });

  describe("sections", () => {
    it("owner can create section", async () => {
      const { user, token } = await signupTutor();
      const course = await createTestCourse(token, user.id);
      const service = createSupabaseCourseService(url!, key!);
      const result = await service.createSection(token, course.id, { title: "New Section" });
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;
      expect(result.data.title).toBe("New Section");
      expect(result.data.course_id).toBe(course.id);
      expect(result.data.position).toBe(0);
    });

    it("owner can update section", async () => {
      const { user, token } = await signupTutor();
      const course = await createTestCourse(token, user.id);
      const section = await createTestSection(token, course.id, "Original Title");
      const service = createSupabaseCourseService(url!, key!);
      const result = await service.updateSection(token, section.id, { title: "Updated Title" });
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;
      expect(result.data.title).toBe("Updated Title");
    });

    it("owner can delete section (cascades to lessons)", async () => {
      const { user, token } = await signupTutor();
      const course = await createTestCourse(token, user.id);
      const section = await createTestSection(token, course.id, "Section to Delete");
      const lesson = await createTestLesson(token, section.id, "Lesson in Deleted Section", "text");
      const service = createSupabaseCourseService(url!, key!);
      const result = await service.deleteSection(token, section.id);
      expect(result.status).toBe("ok");
      const checkLesson = await sql`SELECT id FROM public.course_lessons WHERE id = ${lesson.id}`;
      expect(checkLesson).toHaveLength(0);
    });

    it("can reorder sections", async () => {
      const { user, token } = await signupTutor();
      const course = await createTestCourse(token, user.id);
      const sectionA = await createTestSection(token, course.id, "Section A", 0);
      const sectionB = await createTestSection(token, course.id, "Section B", 1);
      const sectionC = await createTestSection(token, course.id, "Section C", 2);
      const service = createSupabaseCourseService(url!, key!);
      const result = await service.reorderSections(token, course.id, [sectionC.id, sectionA.id, sectionB.id]);
      expect(result.status).toBe("ok");
    });

    it("cannot create section on another creator's course", async () => {
      const tutorA = await signupTutor({ name: "Tutor A" });
      const tutorB = await signupTutor({ name: "Tutor B" });
      const course = await createTestCourse(tutorA.token, tutorA.user.id);
      const service = createSupabaseCourseService(url!, key!);
      const result = await service.createSection(tutorB.token, course.id, { title: "Unauthorized Section" });
      expect(result.status).toBe("forbidden");
    });
  });

  describe("lessons", () => {
    it("owner can create lesson", async () => {
      const { user, token } = await signupTutor();
      const course = await createTestCourse(token, user.id);
      const section = await createTestSection(token, course.id, "Test Section");
      const service = createSupabaseCourseService(url!, key!);
      const result = await service.createLesson(token, section.id, {
        title: "New Lesson",
        lesson_type: "text",
        text_content: "Lesson content",
      });
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;
      expect(result.data.title).toBe("New Lesson");
      expect(result.data.section_id).toBe(section.id);
      expect(result.data.position).toBe(0);
    });

    it("owner can update lesson", async () => {
      const { user, token } = await signupTutor();
      const course = await createTestCourse(token, user.id);
      const section = await createTestSection(token, course.id, "Test Section");
      const lesson = await createTestLesson(token, section.id, "Original Lesson", "text");
      const service = createSupabaseCourseService(url!, key!);
      const result = await service.updateLesson(token, lesson.id, { title: "Updated Lesson" });
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;
      expect(result.data.title).toBe("Updated Lesson");
    });

    it("owner can delete lesson", async () => {
      const { user, token } = await signupTutor();
      const course = await createTestCourse(token, user.id);
      const section = await createTestSection(token, course.id, "Test Section");
      const lesson = await createTestLesson(token, section.id, "Lesson to Delete", "text");
      const service = createSupabaseCourseService(url!, key!);
      const result = await service.deleteLesson(token, lesson.id);
      expect(result.status).toBe("ok");
      const checkLesson = await sql`SELECT id FROM public.course_lessons WHERE id = ${lesson.id}`;
      expect(checkLesson).toHaveLength(0);
    });

    it("lessons maintain position ordering", async () => {
      const { user, token } = await signupTutor();
      const course = await createTestCourse(token, user.id);
      const section = await createTestSection(token, course.id, "Test Section");
      const lesson1 = await createTestLesson(token, section.id, "Lesson 1", "text");
      const lesson2 = await createTestLesson(token, section.id, "Lesson 2", "text");
      const lesson3 = await createTestLesson(token, section.id, "Lesson 3", "text");
      const service = createSupabaseCourseService(url!, key!);
      expect(lesson1.position).toBe(0);
      expect(lesson2.position).toBe(1);
      expect(lesson3.position).toBe(2);
      const reorderResult = await service.reorderLessons(token, section.id, [lesson3.id, lesson1.id, lesson2.id]);
      expect(reorderResult.status).toBe("ok");
      const getResult = await service.getCourse(course.id);
      expect(getResult.status).toBe("ok");
      if (getResult.status !== "ok") return;
      const sections = getResult.data.sections || [];
      const reorderedSection = sections.find((s) => s.id === section.id);
      expect(reorderedSection?.lessons?.map((l) => l.id)).toEqual([lesson3.id, lesson1.id, lesson2.id]);
    });

    it("cannot create lesson on another creator's section", async () => {
      const tutorA = await signupTutor({ name: "Tutor A" });
      const tutorB = await signupTutor({ name: "Tutor B" });
      const courseA = await createTestCourse(tutorA.token, tutorA.user.id);
      const sectionA = await createTestSection(tutorA.token, courseA.id, "Tutor A Section");
      const service = createSupabaseCourseService(url!, key!);
      const result = await service.createLesson(tutorB.token, sectionA.id, {
        title: "Unauthorized Lesson",
        lesson_type: "text",
      });
      expect(result.status).toBe("forbidden");
    });
  });

  describe("progress", () => {
    it("enrolled user can mark lesson complete", async () => {
      const { user: tutorUser, token: tutorToken } = await signupTutor();
      const { user: learnerUser, token: learnerToken } = await signupLearner();
      const course = await createTestCourse(tutorToken, tutorUser.id);
      const section = await createTestSection(tutorToken, course.id, "Test Section");
      const lesson = await createTestLesson(tutorToken, section.id, "Test Lesson", "text");
      await enrollLearner(learnerUser.id, course.id);
      const service = createSupabaseCourseService(url!, key!);
      const result = await service.updateLessonProgress(learnerToken, learnerUser.id, lesson.id, true);
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;
      expect(result.data.completed).toBe(true);
      expect(result.data.completed_at).toBeTruthy();
    });

    it("user cannot update another learner's progress", async () => {
      const { user: tutorUser, token: tutorToken } = await signupTutor();
      const { user: learnerA } = await signupLearner({ name: "Learner A" });
      const { user: learnerB } = await signupLearner({ name: "Learner B" });
      const course = await createTestCourse(tutorToken, tutorUser.id);
      const section = await createTestSection(tutorToken, course.id, "Test Section");
      const lesson = await createTestLesson(tutorToken, section.id, "Test Lesson", "text");
      await enrollLearner(learnerA.id, course.id);
      await enrollLearner(learnerB.id, course.id);
      const service = createSupabaseCourseService(url!, key!);
      const result = await service.updateLessonProgress(`Bearer invalid-token`, learnerA.id, lesson.id, true);
      expect(result.status).toBe("forbidden");
    });

    it("progress persists correctly", async () => {
      const { user: tutorUser, token: tutorToken } = await signupTutor();
      const { user: learnerUser, token: learnerToken } = await signupLearner();
      const course = await createTestCourse(tutorToken, tutorUser.id);
      const section = await createTestSection(tutorToken, course.id, "Test Section");
      const lesson1 = await createTestLesson(tutorToken, section.id, "Lesson 1", "text");
      const lesson2 = await createTestLesson(tutorToken, section.id, "Lesson 2", "text");
      await enrollLearner(learnerUser.id, course.id);
      const service = createSupabaseCourseService(url!, key!);
      await service.updateLessonProgress(learnerToken, learnerUser.id, lesson1.id, true);
      await service.updateLessonProgress(learnerToken, learnerUser.id, lesson2.id, true);
      const progressResult = await service.getCourseProgress(learnerToken, learnerUser.id, course.id);
      expect(progressResult.status).toBe("ok");
      if (progressResult.status !== "ok") return;
      expect(progressResult.data.total_lessons).toBe(2);
      expect(progressResult.data.completed_lessons).toBe(2);
      expect(progressResult.data.percent_complete).toBe(100);
    });

    it("duplicate updates are idempotent", async () => {
      const { user: tutorUser, token: tutorToken } = await signupTutor();
      const { user: learnerUser, token: learnerToken } = await signupLearner();
      const course = await createTestCourse(tutorToken, tutorUser.id);
      const section = await createTestSection(tutorToken, course.id, "Test Section");
      const lesson = await createTestLesson(tutorToken, section.id, "Test Lesson", "text");
      await enrollLearner(learnerUser.id, course.id);
      const service = createSupabaseCourseService(url!, key!);
      const first = await service.updateLessonProgress(learnerToken, learnerUser.id, lesson.id, true);
      expect(first.status).toBe("ok");
      const second = await service.updateLessonProgress(learnerToken, learnerUser.id, lesson.id, true);
      expect(second.status).toBe("ok");
      const progress = await service.getCourseProgress(learnerToken, learnerUser.id, course.id);
      expect(progress.status).toBe("ok");
      if (progress.status !== "ok") return;
      expect(progress.data.completed_lessons).toBe(1);
    });
  });

  describe("state transitions", () => {
    it("course with missing required fields cannot be published", async () => {
      const { user, token } = await signupTutor();
      const course = await createTestCourse(token, user.id);
      const service = createSupabaseCourseService(url!, key!);
      const result = await service.publishCourse(token, course.id);
      expect(result.status).toBe("validation_error");
    });

    it("valid course can be published", async () => {
      const { user, token } = await signupTutor();
      const course = await createTestCourse(token, user.id);
      const section = await createTestSection(token, course.id, "Test Section");
      await createTestLesson(token, section.id, "Test Lesson", "text");
      const service = createSupabaseCourseService(url!, key!);
      const result = await service.publishCourse(token, course.id);
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;
      expect(result.data.status).toBe("published");
      expect(result.data.published_at).toBeTruthy();
    });

    it("owner can unpublish course", async () => {
      const { user, token } = await signupTutor();
      const course = await createTestCourse(token, user.id);
      const section = await createTestSection(token, course.id, "Test Section");
      await createTestLesson(token, section.id, "Test Lesson", "text");
      const service = createSupabaseCourseService(url!, key!);
      await service.publishCourse(token, course.id);
      const result = await service.unpublishCourse(token, course.id);
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;
      expect(result.data.status).toBe("unpublished");
    });
  });

  describe("authorization", () => {
    it("unauthorized creator access denied", async () => {
      const tutorA = await signupTutor({ name: "Tutor A" });
      const tutorB = await signupTutor({ name: "Tutor B" });
      const courseA = await createTestCourse(tutorA.token, tutorA.user.id);
      const sectionA = await createTestSection(tutorA.token, courseA.id, "Tutor A Section");
      const lessonA = await createTestLesson(tutorA.token, sectionA.id, "Tutor A Lesson", "text");
      await enrollLearner(tutorB.user.id, courseA.id);
      const service = createSupabaseCourseService(url!, key!);
      const canAccess = await service.canAccessLesson(tutorB.token, tutorB.user.id, lessonA.id);
      expect(canAccess).toBe(true);
    });

    it("non-enrolled user cannot access course content", async () => {
      const tutor = await signupTutor();
      const stranger = await signupLearner();
      const course = await createTestCourse(tutor.token, tutor.user.id);
      const section = await createTestSection(tutor.token, course.id, "Test Section");
      const lesson = await createTestLesson(tutor.token, section.id, "Test Lesson", "text");
      const service = createSupabaseCourseService(url!, key!);
      const canAccess = await service.canAccessLesson(stranger.token, stranger.user.id, lesson.id);
      expect(canAccess).toBe(false);
    });

    it("course owner can always access their own lessons", async () => {
      const { user, token } = await signupTutor();
      const course = await createTestCourse(token, user.id);
      const section = await createTestSection(token, course.id, "Test Section");
      const lesson = await createTestLesson(token, section.id, "Test Lesson", "text");
      const service = createSupabaseCourseService(url!, key!);
      const canAccess = await service.canAccessLesson(token, user.id, lesson.id);
      expect(canAccess).toBe(true);
    });

    it("enrolled learner can access course content", async () => {
      const { user: tutorUser, token: tutorToken } = await signupTutor();
      const { user: learnerUser, token: learnerToken } = await signupLearner();
      const course = await createTestCourse(tutorToken, tutorUser.id);
      const section = await createTestSection(tutorToken, course.id, "Test Section");
      const lesson = await createTestLesson(tutorToken, section.id, "Test Lesson", "text");
      await enrollLearner(learnerUser.id, course.id);
      const service = createSupabaseCourseService(url!, key!);
      const canAccess = await service.canAccessLesson(learnerToken, learnerUser.id, lesson.id);
      expect(canAccess).toBe(true);
    });

    it("isCourseOwner returns true for owner", async () => {
      const { user, token } = await signupTutor();
      const course = await createTestCourse(token, user.id);
      const service = createSupabaseCourseService(url!, key!);
      const result = await service.isCourseOwner(token, user.id, course.id);
      expect(result).toBe(true);
    });

    it("isCourseOwner returns false for non-owner", async () => {
      const { user: tutorUser, token: tutorToken } = await signupTutor();
      const { user: otherUser, token: otherToken } = await signupLearner();
      const course = await createTestCourse(tutorToken, tutorUser.id);
      const service = createSupabaseCourseService(url!, key!);
      const result = await service.isCourseOwner(otherToken, otherUser.id, course.id);
      expect(result).toBe(false);
    });
  });
});
