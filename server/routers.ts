import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import {
  createTutor,
  getTutorByUserId,
  getAllTutors,
  createRequest,
  getRequestsByStudentId,
  getAllRequests,
  createRating,
  getRatingsByUserId,
} from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  tutors: router({
    create: protectedProcedure
      .input(
        z.object({
          bio: z.string(),
          education: z.array(z.string()),
          subjects: z.array(z.string()),
          grades: z.array(z.string()),
          hourlyRate: z.string(),
          experience: z.string().optional(),
          location: z.string().optional(),
          district: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return await createTutor({
          userId: ctx.user.id,
          ...input,
        });
      }),

    getById: publicProcedure
      .input(z.object({ tutorId: z.number() }))
      .query(async ({ input }) => {
        const tutors = await getAllTutors();
        return tutors.find((t: any) => t.id === input.tutorId);
      }),

    list: publicProcedure.query(async () => {
      return await getAllTutors();
    }),

    getMyProfile: protectedProcedure.query(async ({ ctx }) => {
      return await getTutorByUserId(ctx.user.id);
    }),
  }),

  requests: router({
    create: protectedProcedure
      .input(
        z.object({
          subject: z.string(),
          gradeLevel: z.string(),
          description: z.string(),
          preferredTimeframe: z.array(z.string()).optional(),
          location: z.string(),
          studentName: z.string(),
          studentPhone: z.string(),
          lessonFrequency: z.string().optional(),
          lessonDuration: z.number().optional(),
          startDate: z.string().optional(),
          budget: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return await createRequest({
          userId: ctx.user.id,
          ...input,
        });
      }),

    getMyRequests: protectedProcedure.query(async ({ ctx }) => {
      return await getRequestsByStudentId(ctx.user.id);
    }),

    list: publicProcedure.query(async () => {
      return await getAllRequests();
    }),
  }),

  ratings: router({
    create: protectedProcedure
      .input(
        z.object({
          lessonId: z.number(),
          toUserId: z.number(),
          ratingType: z.enum(["tutor_to_student", "student_to_tutor"]),
          score: z.number().min(1).max(5),
          review: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return await createRating({
          lessonId: input.lessonId,
          fromUserId: ctx.user.id,
          toUserId: input.toUserId,
          ratingType: input.ratingType,
          score: input.score,
          review: input.review,
        });
      }),

    getByUserId: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return await getRatingsByUserId(input.userId);
      }),
  }),

  matching: router({
    suggestTutors: publicProcedure
      .input(
        z.object({
          requestId: z.number().optional(),
          subject: z.string(),
          gradeLevel: z.string(),
          budget: z.number().optional(),
        })
      )
      .query(async ({ input }) => {
        const allTutors = await getAllTutors();

        const matchedTutors = allTutors.filter((tutor: any) => {
          const tutorSubjects = tutor.subjects || [];
          const tutorGrades = tutor.grades || [];

          const subjectMatch = tutorSubjects.some((s: string) =>
            s.toLowerCase().includes(input.subject.toLowerCase())
          );
          const gradeMatch = tutorGrades.some((g: string) =>
            g.toLowerCase().includes(input.gradeLevel.toLowerCase())
          );

          const budgetMatch =
            !input.budget || parseInt(tutor.hourlyRate || 0) <= input.budget;

          return subjectMatch && gradeMatch && budgetMatch;
        });

        return matchedTutors.sort((a: any, b: any) => {
          const ratingA = a.rating || 0;
          const ratingB = b.rating || 0;
          return ratingB - ratingA;
        });
      }),
  }),
});

export type AppRouter = typeof appRouter;
