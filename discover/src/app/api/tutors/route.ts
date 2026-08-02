import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PublishedTutor = Record<string, unknown> & { displayName?: string; status?: string };

const storagePath = path.join(process.cwd(), "data", "published-tutors.json");

async function readTutors(): Promise<PublishedTutor[]> {
  try {
    const stored = JSON.parse(await readFile(storagePath, "utf8"));
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

async function saveTutors(tutors: PublishedTutor[]) {
  await mkdir(path.dirname(storagePath), { recursive: true });
  await writeFile(storagePath, JSON.stringify(tutors, null, 2), "utf8");
}

export async function GET() {
  return NextResponse.json({ tutors: await readTutors() });
}

export async function POST(request: Request) {
  const tutor = await request.json() as PublishedTutor;
  const displayName = String(tutor.displayName || "").trim();
  if (!displayName || tutor.status !== "pending_review") {
    return NextResponse.json({ error: "A submitted tutor profile is required." }, { status: 400 });
  }

  const tutors = await readTutors();
  const nextTutor = { ...tutor, displayName, publishedAt: new Date().toISOString() };
  const next = [nextTutor, ...tutors.filter((item) => item.displayName !== displayName)];
  await saveTutors(next);
  return NextResponse.json({ tutor: nextTutor }, { status: 201 });
}
