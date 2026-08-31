// Demo-only fallback. Production publishes go through the backend at /api/v1/events.
// In live mode this route returns 410 to prevent silent misconfiguration.
import { NextRequest, NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isServerLiveMode } from "@/lib/auth/server-verify";

const LIVE_MODE_GONE_MESSAGE =
  "Live mode: use POST /api/v1/events or GET /api/v1/events on the configured Tutoria API.";

function liveModeGone(): NextResponse {
  return NextResponse.json(
    { ok: false, error: { message: LIVE_MODE_GONE_MESSAGE } },
    { status: 410 },
  );
}

const storagePath = path.join(process.cwd(), "data", "published-events.json");
const MAX_BODY_BYTES = 2 * 1024 * 1024;

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ ok: false, error: { message } }, { status });
}

async function readEvents(): Promise<Record<string, unknown>[]> {
  try {
    const stored = JSON.parse(await readFile(storagePath, "utf8"));
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

async function writeEvents(events: Record<string, unknown>[]): Promise<void> {
  await mkdir(path.dirname(storagePath), { recursive: true });
  await writeFile(storagePath, JSON.stringify(events, null, 2), "utf8");
}

function sanitizeString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/<\s*(script|iframe|object|embed|frame|meta|link|base|form)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|iframe|object|embed|frame|meta|link|base|form)[^>]*>/gi, "")
    .replace(/<\s*\/(script|iframe|object|embed|frame|meta|link|base|form)\s*>/gi, "")
    .replace(/\s+on[a-z][a-z0-9_-]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\b(?:javascript|vbscript|data):/gi, "")
    .trim();
}

function sanitizeEvent(event: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event)) {
    if (typeof value === "string") {
      out[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      out[key] = value.map((item) => {
        if (typeof item === "string") return sanitizeString(item);
        if (typeof item === "object" && item) return sanitizeEvent(item as Record<string, unknown>);
        return item;
      });
    } else if (value && typeof value === "object") {
      out[key] = sanitizeEvent(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function isValidSlug(slug: unknown): boolean {
  return typeof slug === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(slug);
}

export async function POST(request: NextRequest) {
  try {
    if (isServerLiveMode()) {
      return liveModeGone();
    }

    console.log("[api/events POST]", {
      method: request.method,
      url: request.url,
      contentLength: request.headers.get("content-length"),
      userAgent: request.headers.get("user-agent"),
    });

    const contentLengthHeader = request.headers.get("content-length");
    const contentLength = contentLengthHeader ? Number(contentLengthHeader) : 0;
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return jsonError("Event payload is too large. Try removing or replacing cover and gallery images with smaller files.", 413);
    }

    const body = await request.json();
    if (!body || typeof body !== "object") {
      return jsonError("Invalid request body", 400);
    }

    const { slug, title } = body as Record<string, unknown>;
    if (!isValidSlug(slug)) {
      return jsonError("Invalid slug format", 400);
    }
    if (typeof title !== "string" || !title.trim()) {
      return jsonError("Title is required", 400);
    }

    const sanitized = sanitizeEvent(body);
    sanitized.slug = (slug as string).trim();
    sanitized.title = (title as string).trim();
    sanitized.publishedAt = new Date().toISOString();
    sanitized.visibility = body.visibility || "Public";

    const events = await readEvents();
    const existing = events.find((item) => item.slug === slug);

    const next = existing
      ? events.map((item) => (item.slug === slug ? sanitized : item))
      : [sanitized, ...events];
    await writeEvents(next);

    return NextResponse.json({ ok: true, slug: sanitized.slug, status: "published", event: sanitized }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to publish event";
    return jsonError(message, 500);
  }
}

export async function GET() {
  try {
    if (isServerLiveMode()) {
      return liveModeGone();
    }
    const events = await readEvents();
    return NextResponse.json({ ok: true, events });
  } catch {
    return jsonError("Failed to read events", 500);
  }
}
