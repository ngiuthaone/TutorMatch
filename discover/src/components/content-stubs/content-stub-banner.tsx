import { createClient } from "@supabase/supabase-js";

export type ContentStub = {
  id: string;
  surface: string;
  title: string;
  body: string;
  cta_label: string | null;
  cta_href: string | null;
  published_at: string;
};

const ALLOWED_SURFACES = new Set(["messages", "courses", "payouts"]);

async function fetchStubs(surface: string): Promise<ContentStub[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];
  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await supabase
      .from("content_stubs")
      .select("id, surface, title, body, cta_label, cta_href, published_at")
      .eq("surface", surface)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(1);
    if (error) return [];
    return (data ?? []) as ContentStub[];
  } catch {
    return [];
  }
}

export async function ContentStubBanner({ surface }: { surface: string }) {
  if (!ALLOWED_SURFACES.has(surface)) return null;
  const stubs = await fetchStubs(surface);
  if (stubs.length === 0) return null;
  const stub = stubs[0];
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto w-full max-w-3xl border-b border-[#1c1d20] bg-[#101116] px-4 py-3 text-[#e8e8eb]"
      data-surface={surface}
    >
      <p className="text-sm font-medium text-[#f4f4f2]">{stub.title}</p>
      <p className="mt-1 text-xs text-[#9c9ca3]">{stub.body}</p>
      {stub.cta_label && stub.cta_href ? (
        <a
          href={stub.cta_href}
          className="mt-2 inline-block text-xs font-medium text-[#f4f4f2] underline-offset-4 hover:underline"
        >
          {stub.cta_label} →
        </a>
      ) : null}
    </div>
  );
}
