import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getServerSupabaseEnv } from "@/lib/auth/server-verify";
import { getApiBaseUrl } from "@/lib/auth/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function requireAdmin() {
  const env = getServerSupabaseEnv();
  if (!env) return { error: NextResponse.json({ ok: false, error: { code: "CONFIGURATION_ERROR" } }, { status: 503 }) };
  const cookieStore = await cookies();
  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      get(name: string) { return cookieStore.get(name)?.value; },
      set(_n: string, _v: string, _o: CookieOptions) {},
      remove(_n: string, _o: CookieOptions) {},
    },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { error: NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED" } }, { status: 401 }) };
  const role = (data.user.app_metadata?.role as string) ?? null;
  if (role !== "admin") return { error: NextResponse.json({ ok: false, error: { code: "FORBIDDEN" } }, { status: 403 }) };
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token ?? null;
  if (!accessToken) return { error: NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED" } }, { status: 401 }) };
  return { accessToken, url: getApiBaseUrl() };
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { decision?: string; note?: string } | null;
  if (!body || !body.decision) return NextResponse.json({ ok: false, error: { code: "INVALID_BODY" } }, { status: 400 });
  const target = `${auth.url.replace(/\/$/, "")}/api/v1/admin/moderation/media/${encodeURIComponent(id)}/decide`;
  const res = await fetch(target, {
    method: "POST",
    headers: { Authorization: `Bearer ${auth.accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ decision: body.decision, note: body.note ?? undefined }),
    cache: "no-store",
  });
  const payload = await res.json().catch(() => ({ ok: false }));
  return NextResponse.json(payload, { status: res.status });
}
