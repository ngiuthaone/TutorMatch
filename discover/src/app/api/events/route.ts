import { NextResponse } from "next/server";

import { z } from "zod";

import type { EventDetail } from "@/lib/event-data";
import { isServerLiveMode, verifyRequestUser } from "@/lib/auth/server-verify";
import { InMemoryRateLimiter, isSafeHttpUrl, sanitizeTree } from "@/lib/api-security";
import { readSharedEvents, saveSharedEvent } from "@/lib/published-event-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createLimiter = new InMemoryRateLimiter(10, 60_000);

const safeHttpUrl = (value: string) => isSafeHttpUrl(value);
const eventImageUrl = (value: string) => isSafeHttpUrl(value) || (/^data:image\/(?:avif|gif|jpe?g|png|webp);base64,[a-z0-9+/=\s]+$/i.test(value) && value.length <= 300_000);

const eventSessionSchema = z.object({
  id: z.string().min(1).max(80),
  date: z.string().max(60),
  times: z.array(z.string().max(30)).max(20),
});
const eventPlanItemSchema = z.object({
  title: z.string().max(300),
  duration: z.string().max(100),
  description: z.string().max(5_000),
  image: z.string().max(2_000).refine(safeHttpUrl, "Unsafe plan image URL.").optional(),
});
const eventReviewSchema = z.object({
  name: z.string().max(60),
  attended: z.string().max(60),
  rating: z.number().min(0).max(5),
  body: z.string().max(5_000),
  avatar: z.string().max(2_000).refine(safeHttpUrl, "Unsafe review avatar URL."),
});
const eventFaqSchema = z.object({
  question: z.string().max(500),
  answer: z.string().max(5_000),
});
const eventPackageSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(200),
  price: z.number().min(0),
  description: z.string().max(2_000).optional(),
  badge: z.string().max(200).optional(),
  includes: z.array(z.string().max(500)).max(100),
});

const eventPostSchema = z.object({
  slug: z.string().min(1).max(120).regex(/^[\w-]+$/, "Slug may only contain letters, numbers, dashes, and underscores."),
  title: z.string().min(1).max(300),
  subtitle: z.string().max(300).optional(),
  date: z.string().max(60),
  time: z.string().max(60),
  duration: z.string().max(100),
  location: z.string().max(300),
  type: z.enum(["In person", "Online"]),
  price: z.string().max(60),
  attending: z.number().int().min(0).optional(),
  capacity: z.number().int().min(1).max(100_000),
  image: z.string().max(2_000).refine(eventImageUrl, "Unsafe image URL.").optional(),
  topic: z.string().max(120),
  level: z.string().max(120),
  languages: z.array(z.string().max(60)).max(12),
  minimumAge: z.string().max(60),
  accessibility: z.string().max(5_000),
  studioName: z.string().max(200),
  address: z.string().max(500),
  sessions: z.array(eventSessionSchema).max(100),
  spotsLeft: z.number().int().min(0).optional(),
  about: z.array(z.string().max(20_000)).max(50),
  note: z.string().max(10_000),
  highlights: z.array(z.object({ title: z.string().max(200), description: z.string().max(2_000) })).max(30),
  learn: z.array(z.string().max(500)).max(100),
  included: z.array(z.string().max(500)).max(100),
  bring: z.array(z.string().max(500)).max(100),
  plan: z.array(eventPlanItemSchema).max(100),
  faqs: z.array(eventFaqSchema).max(30),
  galleryImage: z.string().max(2_000).refine(safeHttpUrl, "Unsafe gallery URL.").optional(),
  hostRole: z.string().max(120),
  hostExperience: z.string().max(5_000),
  hostBio: z.string().max(5_000),
  hostImage: z.string().max(2_000).refine(safeHttpUrl, "Unsafe host image URL.").optional(),
  hostRecommendation: z.string().max(500),
  beforeYouAttend: z.array(z.object({ title: z.string().max(200), items: z.array(z.string().max(500)).max(50) })).max(30),
  cancellation: z.array(z.string().max(500)).max(30),
  reviews: z.array(eventReviewSchema).max(100),
  packages: z.array(eventPackageSchema).max(40).optional(),
  pricingMode: z.enum(["single", "multiple"]).optional(),
  creatorId: z.string().optional(),
  creatorName: z.string().max(120).optional(),
  publishedAt: z.string().max(60).optional(),
});

export async function GET() {
  return NextResponse.json(
    { events: await readSharedEvents() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = eventPostSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A published event requires a slug, title, and valid event details." },
      { status: 400 },
    );
  }

  const events = await readSharedEvents();
  const live = isServerLiveMode();

  if (live) {
    const user = await verifyRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: "Sign in to publish an event." }, { status: 401 });
    }
    if (!createLimiter.isAllowed(user.id)) {
      return NextResponse.json({ error: "Too many event submissions. Try again shortly." }, { status: 429 });
    }
    const existing = events.find((item) => item.slug === parsed.data.slug);
    if (existing && existing.creatorId && existing.creatorId !== user.id) {
      return NextResponse.json(
        { error: "An event with this slug already belongs to another user." },
        { status: 403 },
      );
    }
    const event = {
      ...(sanitizeTree(parsed.data) as Omit<EventDetail, "creatorId">),
      slug: parsed.data.slug,
      title: parsed.data.title,
      creatorId: user.id,
      publishedAt: new Date().toISOString(),
    } as EventDetail;
    await saveSharedEvent(event);
    return NextResponse.json({ event }, { status: 201 });
  }

  const event = {
    ...(sanitizeTree(parsed.data) as Omit<EventDetail, "creatorId">),
    slug: parsed.data.slug,
    title: parsed.data.title,
    publishedAt: new Date().toISOString(),
  } as EventDetail;
  await saveSharedEvent(event);
  return NextResponse.json({ event }, { status: 201 });
}
