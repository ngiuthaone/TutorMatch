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

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const incoming = new URL(request.url);
  const status = incoming.searchParams.get("status") ?? "pending";
  const limit = incoming.searchParams.get("limit") ?? "100";
  const target = `${auth.url.replace(/\/$/, "")}/api/v1/admin/moderation/media?status=${encodeURIComponent(status)}&limit=${encodeURIComponent(limit)}`;
  const res = await fetch(target, {
    headers: { Authorization: `Bearer ${auth.accessToken}`, Accept: "application/json" },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({ ok: false }));
  return NextResponse.json(body, { status: res.status });
}
