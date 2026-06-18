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

    getProfile: protectedProcedure.query(async ({ ctx }) => {
      return await getTutorByUserId(ctx.user.id);
    }),

    list: publicProcedure.query(async () => {
      return await getAllTutors();
    }),
  }),

  requests: router({
    create: protectedProcedure
      .input(
        z.object({
          subject: z.string(),
          gradeLevel: z.string(),
          description: z.string(),
          preferredTimeframe: z.array(z.string()),
          location: z.string(),
          budget: z.number().optional(),
          studentName: z.string(),
          studentPhone: z.string(),
          lessonFrequency: z.string(),
          lessonDuration: z.number(),
          startDate: z.string(),
          specialRequirements: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return await createRequest({
          studentId: ctx.user.id,
          subject: input.subject,
          grade: input.gradeLevel,
          description: input.description,
          preferredTimes: input.preferredTimeframe.join(", "),
          location: input.location,
          budget: input.budget ? input.budget.toString() : undefined,
          district: input.location.split(",")[0] || input.location,
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
});

export type AppRouter = typeof appRouter;
