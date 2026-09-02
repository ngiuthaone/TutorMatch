import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Public read of aggregated profile view counts over the last 30 days for a given tutor.
// Pattern adapted from NextTutor's /api/tutor-activity (MIT). Reimplemented as a Tutoria-native
// REST endpoint. Reads via publishable key where possible; the underlying `tutor_views` table
// (when present) is expected to gate public reads via RLS. Service role is used only when
// explicitly configured (i.e. trusted server contexts).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tutorProfileId = searchParams.get("tutorProfileId");
  if (!tutorProfileId) {
    return NextResponse.json({ daily: [] });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  const key = serviceKey || publishableKey;
  if (!url || !key) {
    return NextResponse.json({ daily: [] });
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("tutor_views")
    .select("created_at")
    .eq("tutor_profile_id", tutorProfileId)
    .gte("created_at", thirtyDaysAgo);

  if (error) {
    // The table might not exist yet or RLS may block us; return empty rather than error.
    return NextResponse.json({ daily: generateEmpty() });
  }

  const counts = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    counts.set(d.toISOString().slice(0, 10), 0);
  }
  for (const view of data ?? []) {
    const day = view.created_at.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  return NextResponse.json({
    daily: Array.from(counts.entries()).map(([date, views]) => ({ date, views })),
  });
}

function generateEmpty(): Array<{ date: string; views: number }> {
  const out: Array<{ date: string; views: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    out.push({ date: d.toISOString().slice(0, 10), views: 0 });
  }
  return out;
}
