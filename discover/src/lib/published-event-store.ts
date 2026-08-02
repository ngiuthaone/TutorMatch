import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { EventDetail } from "@/lib/event-data";

const storagePath = path.join(process.cwd(), "data", "published-events.json");

export async function readSharedEvents(): Promise<EventDetail[]> {
  try {
    const stored = JSON.parse(await readFile(storagePath, "utf8"));
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

export async function getSharedEventBySlug(slug: string) {
  const events = await readSharedEvents();
  return events.find((event) => event.slug === slug);
}

export async function saveSharedEvent(event: EventDetail) {
  const events = await readSharedEvents();
  const next = [event, ...events.filter((item) => item.slug !== event.slug)];
  await mkdir(path.dirname(storagePath), { recursive: true });
  await writeFile(storagePath, JSON.stringify(next, null, 2), "utf8");
}
