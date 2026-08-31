import Link from "next/link";
import { TopNav } from "@/components/discover/top-nav";
import { Footer } from "@/components/discover/footer";
import { listArticles } from "@/lib/community/articles-api";
import { formatTime } from "@/lib/community/format-time";

export const dynamic = "force-dynamic";

export default async function ArticlesIndexPage() {
  let articles: { id: string; slug: string; title: string; subtitle?: string | null; excerpt?: string | null; cover_image_url?: string | null; tags: string[]; level?: string | null; estimated_reading_minutes: number; published_at: string; author: { name: string; avatar_url?: string | null; role?: string } }[] = [];
  let loadError = false;
  try {
    const result = await listArticles({ limit: 20 });
    articles = result.articles ?? [];
  } catch {
    loadError = true;
  }

  return (
    <div className="tutoria-page-shell flex flex-col min-h-[100dvh]">
      <TopNav />
      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-semibold text-[#e7e8ea]">Articles</h1>
              <p className="text-sm text-[#9ca3af] mt-0.5">Long-form writing from the Tutoria community.</p>
            </div>
            <Link href="/articles/new"
              className="inline-flex items-center rounded-lg bg-[#e7e8ea] px-4 py-2 text-sm font-medium text-[#0e1014] transition-colors hover:bg-[#d4d5d7]">
              Write
            </Link>
          </div>

          {loadError && (
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              Articles are temporarily unavailable. Please reload to try again.
            </div>
          )}

          {articles.length === 0 && !loadError ? (
            <div className="rounded-2xl border border-[#1f2228] bg-[#0e1014] p-10 text-center">
              <p className="text-sm text-[#9ca3af]">No articles published yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {articles.map((article) => (
                <Link key={article.id} href={`/articles/${article.slug}`}
                  className="block rounded-2xl border border-[#1f2228] bg-[#0e1014] p-5 transition-colors hover:border-[#2a2e36] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b7280]">
                  <h3 className="text-[15px] font-semibold text-[#e7e8ea] leading-snug">{article.title}</h3>
                  {article.excerpt && (
                    <p className="mt-1.5 text-sm text-[#9ca3af] leading-relaxed line-clamp-2">{article.excerpt}</p>
                  )}
                  <div className="mt-3 flex items-center gap-3 text-xs text-[#6b7280]">
                    <span>{article.author?.name ?? "Anonymous"}</span>
                    <span>{formatTime(article.published_at)}</span>
                    <span>{article.estimated_reading_minutes} min read</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
