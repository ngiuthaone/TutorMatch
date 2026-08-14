import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import { z } from "zod";

import { isServerLiveMode, verifyRequestUser } from "@/lib/auth/server-verify";
import { InMemoryRateLimiter, isSafeHttpUrl, sanitizeTree } from "@/lib/api-security";

export const runtime = "nodejs";

type StoredTutor = {
  id: string;
  displayName: string;
  status: "pending_review" | "published";
  creatorId?: string;
  publishedAt: string;
} & Record<string, unknown>;

const storagePath = path.join(process.cwd(), "data", "published-tutors.json");
const createLimiter = new InMemoryRateLimiter(10, 60_000);

const tutorPostSchema = z.object({
  displayName: z.string().trim().min(1, "A tutor display name is required.").max(60),
  status: z.enum(["pending_review", "published"]),
  creatorId: z.string().optional(),
  city: z.string().max(60).optional(),
  location: z.string().max(200).optional(),
  role: z.string().max(100).optional(),
  headline: z.string().max(200).optional(),
  about: z.string().max(10_000).optional(),
  professionalBackground: z.string().max(10_000).optional(),
  photoUrl: z.string().max(2_000).refine(isSafeImageUrl, "Unsafe photo URL.").optional(),
  portfolioUrl: z.string().max(2_000).refine(isSafeHttpUrl, "Unsafe portfolio URL.").optional(),
  introVideoName: z.string().max(200).optional(),
  languages: z.array(z.string().max(60)).max(12).optional(),
  skills: z.array(z.string().max(80)).max(40).optional(),
  learnerLevels: z.array(z.string().max(80)).max(20).optional(),
  ageGroups: z.array(z.string().max(80)).max(20).optional(),
  goals: z.array(z.string().max(200)).max(20).optional(),
  teachingStyles: z.array(z.string().max(80)).max(20).optional(),
  lessonDescription: z.string().max(10_000).optional(),
  lessonFormat: z.array(z.string().max(60)).max(8).optional(),
  sessionLengths: z.array(z.number().int().min(10).max(600)).max(12).optional(),
  availability: z.array(z.string().max(40)).max(100).optional(),
  timeZone: z.string().max(80).optional(),
  rates: z.record(z.string().max(30), z.number().int().min(0).max(100_000_000)).optional(),
  displayDuration: z.number().int().min(10).max(600).nullable().optional(),
  learnerCancellation: z.string().max(500).optional(),
  lateCancellation: z.string().max(500).optional(),
  noShowPolicy: z.string().max(500).optional(),
  consultationEnabled: z.boolean().optional(),
  consultationDuration: z.string().max(100).optional(),
  consultationPrice: z.string().max(100).optional(),
  consultationPurpose: z.string().max(500).optional(),
  faqs: z.array(z.object({ id: z.string().max(80).optional(), question: z.string().max(500), answer: z.string().max(5_000) })).max(30).optional(),
  credentials: z.array(z.object({ id: z.string().max(80).optional(), title: z.string().max(200), evidenceUrl: z.string().max(2_000).refine(isSafeHttpUrl, "Unsafe evidence URL.") })).max(20).optional(),
  visibility: z.enum(["public", "unlisted", "paused"]).optional(),
  updatedAt: z.string().max(60).optional(),
  submittedAt: z.string().max(60).optional(),
  publishedAt: z.string().max(60).optional(),
});

function isSafeImageUrl(value: string): boolean {
  const trimmed = String(value || "").trim();
  if (!trimmed) return true;
  if (/^data:image\/(?:avif|gif|jpe?g|png|webp);base64,[a-z0-9+/=\s]+$/i.test(trimmed) && trimmed.length <= 300_000) return true;
  return isSafeHttpUrl(trimmed);
}

async function readTutors(): Promise<StoredTutor[]> {
  try {
    const stored = JSON.parse(await readFile(storagePath, "utf8"));
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

async function saveTutors(tutors: StoredTutor[]) {
  await mkdir(path.dirname(storagePath), { recursive: true });
  await writeFile(storagePath, JSON.stringify(tutors, null, 2), "utf8");
}

export async function GET() {
  return NextResponse.json({ tutors: await readTutors() });
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = tutorPostSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A submitted tutor profile is required and fields are invalid." },
      { status: 400 },
    );
  }

  const live = isServerLiveMode();
  if (live) {
    const user = await verifyRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: "Sign in to publish a tutor profile." }, { status: 401 });
    }
    if (!createLimiter.isAllowed(user.id)) {
      return NextResponse.json({ error: "Too many tutor profile submissions. Try again shortly." }, { status: 429 });
    }

    const tutors = await readTutors();
    const existing = tutors.find((item) => item.displayName === parsed.data.displayName);
    if (existing && existing.creatorId && existing.creatorId !== user.id) {
      return NextResponse.json(
        { error: "A tutor profile with this name already belongs to another user." },
        { status: 403 },
      );
    }

    const nextTutor: StoredTutor = {
      ...(sanitizeTree(parsed.data) as StoredTutor),
      id: existing?.id || crypto.randomUUID(),
      displayName: parsed.data.displayName,
      status: parsed.data.status,
      creatorId: user.id,
      publishedAt: new Date().toISOString(),
    };
    const next = [nextTutor, ...tutors.filter((item) => item.displayName !== parsed.data.displayName)];
    await saveTutors(next);
    return NextResponse.json({ tutor: nextTutor }, { status: 201 });
  }

  const tutors = await readTutors();
  const nextTutor: StoredTutor = {
    ...(sanitizeTree(parsed.data) as StoredTutor),
    id: crypto.randomUUID(),
    displayName: parsed.data.displayName,
    status: parsed.data.status,
    publishedAt: new Date().toISOString(),
  };
  const next = [nextTutor, ...tutors.filter((item) => item.displayName !== parsed.data.displayName)];
  await saveTutors(next);
  return NextResponse.json({ tutor: nextTutor }, { status: 201 });
}
