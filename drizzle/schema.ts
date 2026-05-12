import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  json,
  float,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * All users (tutors, students, parents, admins) are stored here.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  userType: mysqlEnum("userType", ["tutor", "student", "parent"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Tutor profile information
 * Stores detailed information about tutors
 */
export const tutors = mysqlTable("tutors", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  bio: text("bio"),
  avatarUrl: varchar("avatarUrl", { length: 512 }),
  avatarKey: varchar("avatarKey", { length: 256 }),
  education: text("education"), // JSON array of education history
  subjects: text("subjects"), // JSON array of subjects taught
  grades: text("grades"), // JSON array of grade levels
  hourlyRate: decimal("hourlyRate", { precision: 10, scale: 2 }).notNull(),
  experience: int("experience").default(0), // Years of experience
  location: varchar("location", { length: 256 }),
  district: varchar("district", { length: 100 }), // Hong Kong district
  availability: text("availability"), // JSON object of availability
  verified: boolean("verified").default(false),
  rating: float("rating").default(0),
  totalRatings: int("totalRatings").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Tutor = typeof tutors.$inferSelect;
export type InsertTutor = typeof tutors.$inferInsert;

/**
 * Student/Parent profile information
 */
export const students = mysqlTable("students", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  studentName: varchar("studentName", { length: 256 }),
  grade: varchar("grade", { length: 50 }),
  school: varchar("school", { length: 256 }),
  parentName: varchar("parentName", { length: 256 }),
  phone: varchar("phone", { length: 20 }),
  location: varchar("location", { length: 256 }),
  district: varchar("district", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Student = typeof students.$inferSelect;
export type InsertStudent = typeof students.$inferInsert;

/**
 * Tutoring requests from students/parents
 */
export const requests = mysqlTable("requests", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("studentId").notNull(),
  subject: varchar("subject", { length: 100 }).notNull(),
  grade: varchar("grade", { length: 50 }).notNull(),
  description: text("description"),
  preferredTimes: text("preferredTimes"), // JSON array of time slots
  location: varchar("location", { length: 256 }),
  district: varchar("district", { length: 100 }),
  budget: decimal("budget", { precision: 10, scale: 2 }),
  status: mysqlEnum("status", ["open", "matched", "completed", "cancelled"]).default("open"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Request = typeof requests.$inferSelect;
export type InsertRequest = typeof requests.$inferInsert;

/**
 * Matches between tutors and student requests
 */
export const matches = mysqlTable("matches", {
  id: int("id").autoincrement().primaryKey(),
  requestId: int("requestId").notNull(),
  tutorId: int("tutorId").notNull(),
  studentId: int("studentId").notNull(),
  status: mysqlEnum("status", ["pending", "accepted", "rejected", "active", "completed", "cancelled"]).default("pending"),
  matchedAt: timestamp("matchedAt").defaultNow().notNull(),
  acceptedAt: timestamp("acceptedAt"),
  completedAt: timestamp("completedAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Match = typeof matches.$inferSelect;
export type InsertMatch = typeof matches.$inferInsert;

/**
 * Lessons/sessions between tutor and student
 */
export const lessons = mysqlTable("lessons", {
  id: int("id").autoincrement().primaryKey(),
  matchId: int("matchId").notNull(),
  tutorId: int("tutorId").notNull(),
  studentId: int("studentId").notNull(),
  scheduledAt: timestamp("scheduledAt").notNull(),
  completedAt: timestamp("completedAt"),
  status: mysqlEnum("status", ["scheduled", "completed", "cancelled"]).default("scheduled"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Lesson = typeof lessons.$inferSelect;
export type InsertLesson = typeof lessons.$inferInsert;

/**
 * Ratings/Reviews
 * Two-way rating system: tutors rate students and students rate tutors
 */
export const ratings = mysqlTable("ratings", {
  id: int("id").autoincrement().primaryKey(),
  lessonId: int("lessonId").notNull(),
  fromUserId: int("fromUserId").notNull(), // Who is rating
  toUserId: int("toUserId").notNull(), // Who is being rated
  ratingType: mysqlEnum("ratingType", ["tutor_to_student", "student_to_tutor"]).notNull(),
  score: int("score").notNull(), // 1-5 stars
  review: text("review"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Rating = typeof ratings.$inferSelect;
export type InsertRating = typeof ratings.$inferInsert;

/**
 * Admin sessions for password-protected /admin access
 */
export const adminSessions = mysqlTable("adminSessions", {
  id: int("id").autoincrement().primaryKey(),
  adminId: int("adminId").notNull(),
  token: varchar("token", { length: 256 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdminSession = typeof adminSessions.$inferSelect;
export type InsertAdminSession = typeof adminSessions.$inferInsert;
