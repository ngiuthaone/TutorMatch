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

type LiveTutorCard = {
  source: "live";
  id: string;
  name: string;
  headline: string;
  category: string;
  skills: string[];
  format: string;
  city: string;
  location: string;
  price: number;
  rating: number;
  reviews: number;
  expYears: number;
  sessions: number;
  verified: boolean;
  languages: string[];
  sessionTypes: string[];
  availability: string[];
  bio: string;
  initials: string;
  photoUrl: string;
  bg: string;
  tc: string;
};

const storagePath = path.join(process.cwd(), "data", "published-tutors.json");
const createLimiter = new InMemoryRateLimiter(10, 60_000);

function initialsFromName(displayName: string): string {
  const initials = displayName
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return initials || "T";
}

function capitalizeProficiency(value: string): string {
  if (!value) return value;
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

function lessonFormatLabels(value: unknown): string[] {
  if (value === "in_person") return ["In person"];
  if (value === "both") return ["Online", "In person"];
  return ["Online"];
}

type BackendTutorList = {
  ok?: unknown;
  items?: Array<{
    id?: unknown;
    displayName?: unknown;
    headline?: unknown;
    hourlyRateVnd?: unknown;
    subjects?: unknown;
    regions?: unknown;
    languages?: unknown;
    teachingFormat?: unknown;
  }>;
};

async function fetchLiveTutorCards(): Promise<LiveTutorCard[]> {
  const apiBaseUrl = String(process.env.NEXT_PUBLIC_TUTORIA_API_BASE_URL || "").trim().replace(/\/$/, "");
  if (!apiBaseUrl) return [];
  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/tutors?limit=200`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as BackendTutorList | null;
    if (!payload || payload.ok !== true || !Array.isArray(payload.items)) return [];
    return payload.items.flatMap((item) => {
      if (!item || typeof item.displayName !== "string" || !item.displayName.trim()) return [];
      const subjects = Array.isArray(item.subjects)
        ? item.subjects.filter((subject): subject is string => typeof subject === "string")
        : [];
      const formats = lessonFormatLabels(item.teachingFormat);
      const teachesOnline = formats.includes("Online");
      const teachesInPerson = formats.some((format) => format !== "Online");
      const format = teachesOnline && teachesInPerson ? "Either" : teachesInPerson ? "In person" : "Online";
      const languages = Array.isArray(item.languages)
        ? item.languages
            .map((language) => {
              const lang = language as { displayName?: unknown; proficiency?: unknown } | null;
              if (!lang || typeof lang.displayName !== "string" || !lang.displayName) return "";
              const proficiency = typeof lang.proficiency === "string" && lang.proficiency !== "basic"
                ? ` (${capitalizeProficiency(lang.proficiency)})`
                : "";
              return `${lang.displayName}${proficiency}`;
            })
            .filter(Boolean)
        : [];
      const regions = Array.isArray(item.regions)
        ? item.regions.filter((region): region is string => typeof region === "string")
        : [];
      return [{
        source: "live",
        id: typeof item.id === "string" ? item.id : "",
        name: item.displayName,
        headline: subjects[0] ? `${subjects[0]} Tutor` : "Independent Tutor",
        category: "lifestyle",
        skills: subjects.length ? subjects : ["Tutoring"],
        format,
        city: "hanoi",
        location: regions[0] || "",
        price: typeof item.hourlyRateVnd === "number" ? item.hourlyRateVnd : 0,
        rating: 0,
        reviews: 0,
        expYears: 0,
        sessions: 0,
        verified: false,
        languages: languages.length ? languages : ["Vietnamese"],
        sessionTypes: ["One-to-one"],
        availability: ["Available this week"],
        bio: typeof item.headline === "string" && item.headline.trim() ? item.headline : "A tutor on Tutoria.",
        initials: initialsFromName(item.displayName),
        photoUrl: "",
        bg: "bg-gray-800",
        tc: "text-gray-300",
      }];
    });
  } catch {
    return [];
  }
}

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stored = await readTutors();
  const live = isServerLiveMode();
  if (searchParams.get("source") === "store") {
    return NextResponse.json({ tutors: stored, live });
  }
  const liveCards = live ? await fetchLiveTutorCards() : [];
  const liveNames = new Set(liveCards.map((card) => card.name.toLocaleLowerCase().trim()));
  const merged = [
    ...liveCards,
    ...stored.filter((item) => !liveNames.has(String(item.displayName || "").toLocaleLowerCase().trim())),
  ];
  return NextResponse.json({ tutors: merged, live });
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
