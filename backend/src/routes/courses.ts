import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ApiError } from "../errors/api-error.js";
import type { AuthService } from "../services/auth-service.js";
import type { CourseService } from "../services/course-service.js";

const noStore = async (_request: unknown, reply: any, payload: unknown) => {
  reply.header("Cache-Control", "no-store").header("Pragma", "no-cache");
  return payload;
};

const uuidParamSchema = z.string().uuid();

const courseInputSchema = z.object({
  title: z.string().trim().min(1).max(300),
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  description: z.string().max(5000).optional(),
  cover_url: z.string().url().optional(),
});

const coursePatchSchema = courseInputSchema.partial().extend({
  version: z.number().int().min(1),
});

const sectionInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  position: z.number().int().min(0).optional(),
});

const sectionPatchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  position: z.number().int().min(0).optional(),
});

const lessonInputSchema = z.object({
  title: z.string().trim().min(1).max(300),
  lesson_type: z.enum(["video", "text", "quiz", "resource"]),
  position: z.number().int().min(0).optional(),
  video_url: z.string().url().optional(),
  text_content: z.string().optional(),
  is_preview: z.boolean().optional(),
});

const lessonPatchSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  lesson_type: z.enum(["video", "text", "quiz", "resource"]).optional(),
  position: z.number().int().min(0).optional(),
  video_url: z.string().url().nullable().optional(),
  text_content: z.string().nullable().optional(),
  is_preview: z.boolean().optional(),
});

const progressUpdateSchema = z.object({
  completed: z.boolean(),
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

async function requireTutor(authService: AuthService, request: any) {
  const profile = await authService.getOwnProfile(request.auth.accessToken, request.auth.userId);
  if (profile.status === "unavailable") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Profile service is temporarily unavailable.");
  if (profile.status !== "found" || profile.profile.id !== request.auth.userId || profile.profile.role !== "tutor")
    throw new ApiError(403, "TUTOR_ROLE_REQUIRED", "A tutor account is required.");
}

async function requireEnrollment(courseService: CourseService, userId: string, courseId: string) {
  const result = await courseService.getEnrollment(userId, courseId);
  if (result.status === "unavailable") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Course service is temporarily unavailable.");
  if (result.status === "ok" && result.data === null) throw new ApiError(403, "NOT_ENROLLED", "You are not enrolled in this course.");
}

function parseUuid(value: unknown, name: string): string {
  const parsed = uuidParamSchema.safeParse(value);
  if (!parsed.success) throw new ApiError(400, "INVALID_ID", `${name} is invalid.`);
  return parsed.data;
}

export const courseRoutes: FastifyPluginAsync<{ courseService: CourseService; authService: AuthService }> = async (
  app: FastifyInstance,
  options,
) => {
  app.get("/api/v1/courses", { onSend: noStore }, async (request) => {
    const query = listQuerySchema.safeParse(request.query);
    const filters = query.success ? { limit: query.data.limit, offset: query.data.offset } : undefined;
    const result = await options.courseService.listPublicCourses(filters);
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Course service is temporarily unavailable.");
    return { ok: true, items: result.data };
  });

  app.get("/api/v1/courses/mine", { preHandler: app.authenticate, onSend: noStore }, async (request) => {
    const result = await options.courseService.listMyCourses(request.auth.accessToken, request.auth.userId);
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Course service is temporarily unavailable.");
    return { ok: true, items: result.data };
  });

  app.get("/api/v1/courses/:courseId", { onSend: noStore }, async (request) => {
    const courseId = parseUuid((request.params as { courseId?: unknown }).courseId, "courseId");
    const result = await options.courseService.getCourse(courseId);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Course not found.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Course service is temporarily unavailable.");
    return { ok: true, item: result.data };
  });

  app.post("/api/v1/courses", { preHandler: app.authenticate }, async (request) => {
    const body = courseInputSchema.safeParse(request.body);
    if (!body.success) throw new ApiError(400, "VALIDATION_ERROR", "Invalid course data.");
    const result = await options.courseService.createCourse(request.auth.accessToken, request.auth.userId, body.data);
    if (result.status === "conflict") throw new ApiError(409, "SLUG_CONFLICT", "A course with that URL slug already exists.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Course service is temporarily unavailable.");
    return reply.code(201).send({ ok: true, item: result.data });
  });

  app.patch("/api/v1/courses/:courseId", { preHandler: app.authenticate }, async (request) => {
    const courseId = parseUuid((request.params as { courseId?: unknown }).courseId, "courseId");
    const body = coursePatchSchema.safeParse(request.body);
    if (!body.success) throw new ApiError(400, "VALIDATION_ERROR", "Invalid course data.");
    const isOwner = await options.courseService.isCourseOwner(request.auth.userId, courseId);
    if (!isOwner) throw new ApiError(403, "FORBIDDEN", "You do not own this course.");
    const result = await options.courseService.updateCourse(
      request.auth.accessToken,
      courseId,
      body.data.version,
      body.data,
    );
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Course not found.");
    if (result.status === "conflict") throw new ApiError(409, "VERSION_CONFLICT", "The course was modified by another request. Reload and try again.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Course service is temporarily unavailable.");
    return { ok: true, item: result.data };
  });

  app.delete("/api/v1/courses/:courseId", { preHandler: app.authenticate }, async (request) => {
    const courseId = parseUuid((request.params as { courseId?: unknown }).courseId, "courseId");
    const isOwner = await options.courseService.isCourseOwner(request.auth.userId, courseId);
    if (!isOwner) throw new ApiError(403, "FORBIDDEN", "You do not own this course.");
    const result = await options.courseService.deleteCourse(request.auth.accessToken, courseId);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Course not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "You do not own this course.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Course service is temporarily unavailable.");
    return { ok: true };
  });

  app.post("/api/v1/courses/:courseId/sections", { preHandler: app.authenticate }, async (request) => {
    const courseId = parseUuid((request.params as { courseId?: unknown }).courseId, "courseId");
    const isOwner = await options.courseService.isCourseOwner(request.auth.userId, courseId);
    if (!isOwner) throw new ApiError(403, "FORBIDDEN", "You do not own this course.");
    const body = sectionInputSchema.safeParse(request.body);
    if (!body.success) throw new ApiError(400, "VALIDATION_ERROR", "Invalid section data.");
    const result = await options.courseService.createSection(request.auth.accessToken, courseId, body.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Course not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "You do not own this course.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Course service is temporarily unavailable.");
    return reply.code(201).send({ ok: true, item: result.data });
  });

  app.patch("/api/v1/courses/:courseId/sections/:sectionId", { preHandler: app.authenticate }, async (request) => {
    const courseId = parseUuid((request.params as { courseId?: unknown }).courseId, "courseId");
    const sectionId = parseUuid((request.params as { sectionId?: unknown }).sectionId, "sectionId");
    const isOwner = await options.courseService.isCourseOwner(request.auth.userId, courseId);
    if (!isOwner) throw new ApiError(403, "FORBIDDEN", "You do not own this course.");
    const body = sectionPatchSchema.safeParse(request.body);
    if (!body.success) throw new ApiError(400, "VALIDATION_ERROR", "Invalid section data.");
    const result = await options.courseService.updateSection(request.auth.accessToken, sectionId, body.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Section not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "You do not own this course.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Course service is temporarily unavailable.");
    return { ok: true, item: result.data };
  });

  app.delete("/api/v1/courses/:courseId/sections/:sectionId", { preHandler: app.authenticate }, async (request) => {
    const courseId = parseUuid((request.params as { courseId?: unknown }).courseId, "courseId");
    const sectionId = parseUuid((request.params as { sectionId?: unknown }).sectionId, "sectionId");
    const isOwner = await options.courseService.isCourseOwner(request.auth.userId, courseId);
    if (!isOwner) throw new ApiError(403, "FORBIDDEN", "You do not own this course.");
    const result = await options.courseService.deleteSection(request.auth.accessToken, sectionId);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Section not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "You do not own this course.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Course service is temporarily unavailable.");
    return { ok: true };
  });

  app.post("/api/v1/courses/:courseId/lessons", { preHandler: app.authenticate }, async (request) => {
    const courseId = parseUuid((request.params as { courseId?: unknown }).courseId, "courseId");
    const isOwner = await options.courseService.isCourseOwner(request.auth.userId, courseId);
    if (!isOwner) throw new ApiError(403, "FORBIDDEN", "You do not own this course.");
    const body = lessonInputSchema.safeParse(request.body);
    if (!body.success) throw new ApiError(400, "VALIDATION_ERROR", "Invalid lesson data.");
    const sectionId = body.data.section_id;
    if (!sectionId) throw new ApiError(400, "VALIDATION_ERROR", "section_id is required.");
    const result = await options.courseService.createLesson(request.auth.accessToken, sectionId, body.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Section not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "You do not own this course.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Course service is temporarily unavailable.");
    return reply.code(201).send({ ok: true, item: result.data });
  });

  app.patch("/api/v1/courses/:courseId/lessons/:lessonId", { preHandler: app.authenticate }, async (request) => {
    const courseId = parseUuid((request.params as { courseId?: unknown }).courseId, "courseId");
    const lessonId = parseUuid((request.params as { lessonId?: unknown }).lessonId, "lessonId");
    const isOwner = await options.courseService.isCourseOwner(request.auth.userId, courseId);
    if (!isOwner) throw new ApiError(403, "FORBIDDEN", "You do not own this course.");
    const body = lessonPatchSchema.safeParse(request.body);
    if (!body.success) throw new ApiError(400, "VALIDATION_ERROR", "Invalid lesson data.");
    const result = await options.courseService.updateLesson(request.auth.accessToken, lessonId, body.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Lesson not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "You do not own this course.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Course service is temporarily unavailable.");
    return { ok: true, item: result.data };
  });

  app.delete("/api/v1/courses/:courseId/lessons/:lessonId", { preHandler: app.authenticate }, async (request) => {
    const courseId = parseUuid((request.params as { courseId?: unknown }).courseId, "courseId");
    const lessonId = parseUuid((request.params as { lessonId?: unknown }).lessonId, "lessonId");
    const isOwner = await options.courseService.isCourseOwner(request.auth.userId, courseId);
    if (!isOwner) throw new ApiError(403, "FORBIDDEN", "You do not own this course.");
    const result = await options.courseService.deleteLesson(request.auth.accessToken, lessonId);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Lesson not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "You do not own this course.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Course service is temporarily unavailable.");
    return { ok: true };
  });

  app.post("/api/v1/courses/:courseId/publish", { preHandler: app.authenticate }, async (request) => {
    const courseId = parseUuid((request.params as { courseId?: unknown }).courseId, "courseId");
    const isOwner = await options.courseService.isCourseOwner(request.auth.userId, courseId);
    if (!isOwner) throw new ApiError(403, "FORBIDDEN", "You do not own this course.");
    const result = await options.courseService.publishCourse(request.auth.accessToken, courseId);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Course not found.");
    if (result.status === "conflict") throw new ApiError(409, "ALREADY_PUBLISHED", "This course is already published.");
    if (result.status === "validation_error") throw new ApiError(400, "VALIDATION_ERROR", result.error || "Course cannot be published.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Course service is temporarily unavailable.");
    return { ok: true, item: result.data };
  });

  app.post("/api/v1/courses/:courseId/unpublish", { preHandler: app.authenticate }, async (request) => {
    const courseId = parseUuid((request.params as { courseId?: unknown }).courseId, "courseId");
    const isOwner = await options.courseService.isCourseOwner(request.auth.userId, courseId);
    if (!isOwner) throw new ApiError(403, "FORBIDDEN", "You do not own this course.");
    const result = await options.courseService.unpublishCourse(request.auth.accessToken, courseId);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Course not found.");
    if (result.status === "conflict") throw new ApiError(409, "NOT_PUBLISHED", "This course is not published.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Course service is temporarily unavailable.");
    return { ok: true, item: result.data };
  });

  app.get("/api/v1/courses/:courseId/progress", { preHandler: app.authenticate, onSend: noStore }, async (request) => {
    const courseId = parseUuid((request.params as { courseId?: unknown }).courseId, "courseId");
    const enrollmentResult = await options.courseService.getEnrollment(request.auth.userId, courseId);
    if (enrollmentResult.status === "unavailable") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Course service is temporarily unavailable.");
    if (enrollmentResult.status === "ok" && enrollmentResult.data === null) {
      const isOwner = await options.courseService.isCourseOwner(request.auth.userId, courseId);
      if (!isOwner) throw new ApiError(403, "NOT_ENROLLED", "You are not enrolled in this course.");
    }
    const result = await options.courseService.getCourseProgress(request.auth.userId, courseId);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Progress not found.");
    if (result.status === "forbidden") throw new ApiError(403, "NOT_ENROLLED", "You are not enrolled in this course.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Course service is temporarily unavailable.");
    return { ok: true, item: result.data };
  });

  app.post("/api/v1/courses/:courseId/lessons/:lessonId/progress", { preHandler: app.authenticate }, async (request) => {
    const courseId = parseUuid((request.params as { courseId?: unknown }).courseId, "courseId");
    const lessonId = parseUuid((request.params as { lessonId?: unknown }).lessonId, "lessonId");
    const body = progressUpdateSchema.safeParse(request.body);
    if (!body.success) throw new ApiError(400, "VALIDATION_ERROR", "Invalid progress data.");
    const enrollmentResult = await options.courseService.getEnrollment(request.auth.userId, courseId);
    if (enrollmentResult.status === "unavailable") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Course service is temporarily unavailable.");
    if (enrollmentResult.status === "ok" && enrollmentResult.data === null) {
      const isOwner = await options.courseService.isCourseOwner(request.auth.userId, courseId);
      if (!isOwner) throw new ApiError(403, "NOT_ENROLLED", "You are not enrolled in this course.");
    }
    const result = await options.courseService.updateLessonProgress(
      request.auth.accessToken,
      request.auth.userId,
      lessonId,
      body.data.completed,
    );
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Lesson not found.");
    if (result.status === "forbidden") throw new ApiError(403, "NOT_ENROLLED", "You are not enrolled in this course.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Course service is temporarily unavailable.");
    return { ok: true, item: result.data };
  });

  app.get("/api/v1/courses/:courseId/enrollments", { preHandler: app.authenticate, onSend: noStore }, async (request) => {
    const courseId = parseUuid((request.params as { courseId?: unknown }).courseId, "courseId");
    const result = await options.courseService.getEnrollment(request.auth.userId, courseId);
    if (result.status === "unavailable") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Course service is temporarily unavailable.");
    if (result.status === "ok" && result.data === null) throw new ApiError(404, "NOT_FOUND", "Enrollment not found.");
    return { ok: true, item: result.data };
  });

  app.get("/api/v1/courses/:courseId/enrollments/mine", { preHandler: app.authenticate, onSend: noStore }, async (request) => {
    const courseId = parseUuid((request.params as { courseId?: unknown }).courseId, "courseId");
    const result = await options.courseService.getEnrollment(request.auth.userId, courseId);
    if (result.status === "unavailable") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Course service is temporarily unavailable.");
    if (result.status === "ok" && result.data === null) throw new ApiError(404, "NOT_FOUND", "Enrollment not found.");
    return { ok: true, item: result.data };
  });

  app.get("/api/v1/courses/mine/enrollments", { preHandler: app.authenticate, onSend: noStore }, async (request) => {
    const result = await options.courseService.listMyEnrollments(request.auth.userId);
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Course service is temporarily unavailable.");
    return { ok: true, items: result.data };
  });

  app.get("/api/v1/courses/:courseId/signed-video/:lessonId", { preHandler: app.authenticate }, async (request) => {
    const courseId = parseUuid((request.params as { courseId?: unknown }).courseId, "courseId");
    const lessonId = parseUuid((request.params as { lessonId?: unknown }).lessonId, "lessonId");
    const result = await options.courseService.getSignedVideoUrl(courseId, lessonId, request.auth.userId);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Video not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "You do not have access to this video.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Course service is temporarily unavailable.");
    return { ok: true, item: result.data };
  });

  app.get("/api/v1/courses/:courseId/signed-resource/:resourceId", { preHandler: app.authenticate }, async (request) => {
    const courseId = parseUuid((request.params as { courseId?: unknown }).courseId, "courseId");
    const resourceId = parseUuid((request.params as { resourceId?: unknown }).resourceId, "resourceId");
    const result = await options.courseService.getSignedResourceUrl(courseId, resourceId, request.auth.userId);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Resource not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "You do not have access to this resource.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Course service is temporarily unavailable.");
    return { ok: true, item: result.data };
  });
};
