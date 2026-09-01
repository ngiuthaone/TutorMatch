// Public read of content_stubs for the published stub surfaces
// (messages / courses / payouts). Server-side fetch from Supabase; no service-role
// key required because the RLS policy `content_stubs_public_read` already gates
// anon + authenticated reads to `status='published'` rows.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_SURFACES = new Set(["messages", "courses", "payouts"]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ surface: string }> },
) {
  const { surface } = await context.params;
  if (!ALLOWED_SURFACES.has(surface)) {
    return NextResponse.json({ error: "Unknown surface" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ stubs: [] });
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await supabase
    .from("content_stubs")
    .select("id, surface, title, body, cta_label, cta_href, published_at")
    .eq("surface", surface)
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ stubs: data ?? [] });
}
