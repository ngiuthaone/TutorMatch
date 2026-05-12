import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, tutors, requests, ratings } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  if (!user.userType) {
    throw new Error("User userType is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
      userType: user.userType,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    // Handle userType separately (not nullable)
    if (user.userType !== undefined) {
      values.userType = user.userType;
      updateSet.userType = user.userType;
    }

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Tutor queries
export async function createTutor(tutorData: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(tutors).values({
    userId: tutorData.userId,
    bio: tutorData.bio,
    avatarUrl: tutorData.avatarUrl,
    avatarKey: tutorData.avatarKey,
    education: JSON.stringify(tutorData.education || []),
    subjects: JSON.stringify(tutorData.subjects || []),
    grades: JSON.stringify(tutorData.grades || []),
    hourlyRate: tutorData.hourlyRate,
    experience: tutorData.experience || 0,
    location: tutorData.location,
    district: tutorData.district,
    availability: JSON.stringify(tutorData.availability || {}),
  });
  return result;
}

export async function getTutorByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tutors).where(eq(tutors.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllTutors() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(tutors);
}

// Request queries
export async function createRequest(requestData: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(requests).values({
    studentId: requestData.studentId,
    subject: requestData.subject,
    grade: requestData.grade,
    description: requestData.description,
    preferredTimes: JSON.stringify(requestData.preferredTimes || []),
    location: requestData.location,
    district: requestData.district,
    budget: requestData.budget,
    status: "open",
  });
  return result;
}

export async function getRequestsByStudentId(studentId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(requests).where(eq(requests.studentId, studentId));
}

export async function getAllRequests() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(requests);
}

// Rating queries
export async function createRating(ratingData: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(ratings).values({
    lessonId: ratingData.lessonId,
    fromUserId: ratingData.fromUserId,
    toUserId: ratingData.toUserId,
    ratingType: ratingData.ratingType,
    score: ratingData.score,
    review: ratingData.review,
  });
  return result;
}

export async function getRatingsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(ratings).where(eq(ratings.toUserId, userId));
}


