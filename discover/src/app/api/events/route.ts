import { NextResponse } from "next/server";

import type { EventDetail } from "@/lib/event-data";
import { readSharedEvents, saveSharedEvent } from "@/lib/published-event-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { events: await readSharedEvents() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const event = await request.json() as EventDetail;
  const slug = String(event.slug || "").trim();
  const title = String(event.title || "").trim();

  if (!slug || !title) {
    return NextResponse.json(
      { error: "A published event requires a slug and title." },
      { status: 400 },
    );
  }

  const publishedEvent = {
    ...event,
    slug,
    title,
    publishedAt: new Date().toISOString(),
  } as EventDetail;

  await saveSharedEvent(publishedEvent);
  return NextResponse.json({ event: publishedEvent }, { status: 201 });
}
