import Link from "next/link";
import { TopNav } from "@/components/discover/top-nav";
import { Footer } from "@/components/discover/footer";
import { listThreads } from "@/lib/community/threads-api";
import { ThreadCard } from "@/components/community/thread-card";
import { ThreadFilters } from "@/components/community/thread-filters";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ tag?: string; level?: string; anchorType?: string; cursor?: string }>;
}

export default async function ThreadsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const result = await listThreads({
    tag: sp.tag ?? null,
    level: sp.level ?? null,
    anchorType: sp.anchorType ?? null,
    cursor: sp.cursor ?? null,
    limit: 20,
  });

  const threads = result.threads ?? [];

  return (
    <div className="tutoria-page-shell flex flex-col min-h-[100dvh]">
      <TopNav />
      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-semibold text-[#e7e8ea]">Reference threads</h1>
              <p className="text-sm text-[#9ca3af] mt-0.5">Discuss fit and quality around a course, event, tutor, or resource.</p>
            </div>
            <Link href="/threads/new"
              className="inline-flex items-center rounded-lg bg-[#e7e8ea] px-4 py-2 text-sm font-medium text-[#0e1014] transition-colors hover:bg-[#d4d5d7]">
              New thread
            </Link>
          </div>

          <ThreadFilters />

          {threads.length === 0 ? (
            <div className="rounded-2xl border border-[#1f2228] bg-[#0e1014] p-10 text-center">
              <p className="text-sm text-[#9ca3af]">No threads yet. Start the first conversation.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {threads.map((thread) => (
                <ThreadCard key={thread.id} thread={thread} />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
