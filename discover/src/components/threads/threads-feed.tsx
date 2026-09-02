"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { IconMessageCircle, IconHeart, IconHeartFilled, IconShare, IconLink, IconExternalLink, IconPlus, IconDots, IconFlag } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { listThreads, appreciateReference, unappreciateReference, reportReferenceContent, type ReferenceThread, type AnchorType } from "@/lib/community/threads-api";
import { BookmarkButton } from "@/components/community/bookmark-button";
import { ReportDialog } from "@/components/community/report-dialog";
import { getSessionAccessToken } from "@/lib/auth/session";

const ANCHOR_LABELS: Record<AnchorType, string> = {
  course: "Course",
  event: "Event",
  workshop: "Workshop",
  article: "Article",
  tutor_profile: "Tutor",
  external_url: "External",
};

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ThreadsFeedPage() {
  const router = useRouter();
  const [threads, setThreads] = useState<ReferenceThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [filterTag, setFilterTag] = useState<string>("");
  const [filterAnchor, setFilterAnchor] = useState<AnchorType | "">("");

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listThreads({
        cursor: reset ? null : cursor,
        limit: 20,
        tag: filterTag || null,
        anchorType: filterAnchor || null,
      });
      setThreads(prev => reset ? result.threads : [...prev, ...result.threads]);
      setCursor(result.nextCursor);
      setHasMore(result.nextCursor !== null);
    } catch {
      setError("Threads are temporarily unavailable. Please try again.");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    } finally {
      setLoading(false);
    }
  }, [cursor, filterTag, filterAnchor]);

  useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect
    load(true);
  }, [filterTag, filterAnchor]);

  const handleAppreciate = useCallback(async (threadId: string) => {
    if (!getSessionAccessToken()) {
      router.push("/auth/sign-in?next=/threads");
      return;
    }
    const thread = threads.find(t => t.id === threadId);
    if (!thread) return;
    const isLiked = thread.appreciated_by_me;
    setThreads(prev => prev.map(t => t.id === threadId ? { ...t, appreciated_by_me: !isLiked, appreciated_count: isLiked ? t.appreciated_count - 1 : t.appreciated_count + 1 } : t));
    try {
      if (isLiked) await unappreciateReference("thread", threadId);
      else await appreciateReference("thread", threadId);
    } catch {
      setThreads(prev => prev.map(t => t.id === threadId ? { ...t, appreciated_by_me: isLiked, appreciated_count: thread.appreciated_count } : t));
    }
  }, [threads, router]);

  return (
    <div className="min-h-[100dvh] bg-[#070b12] text-foreground">
      <div className="mx-auto max-w-[680px] px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Reference threads</h1>
            <p className="text-sm text-muted mt-1">Conversations anchored to a shared resource</p>
          </div>
          <button
            onClick={() => {
              if (getSessionAccessToken()) router.push("/threads/new");
              else router.push("/auth/sign-in?next=/threads/new");
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            <IconPlus size={16} /> New thread
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
          <button
            onClick={() => { setFilterAnchor(""); setFilterTag(""); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${!filterAnchor ? "border-primary bg-primary/10 text-primary" : "border-border text-muted hover:text-foreground"}`}
          >
            All
          </button>
          {(["course", "event", "workshop", "article", "tutor_profile", "external_url"] as AnchorType[]).map(t => (
            <button
              key={t}
              onClick={() => setFilterAnchor(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors whitespace-nowrap ${filterAnchor === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted hover:text-foreground"}`}
            >
              {ANCHOR_LABELS[t]}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm">
            {error}
          </div>
        )}

        {loading && threads.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse rounded-2xl border border-border bg-surface p-5">
                <div className="h-4 w-1/3 rounded bg-border mb-3" />
                <div className="h-3 w-full rounded bg-border mb-2" />
                <div className="h-3 w-2/3 rounded bg-border" />
              </div>
            ))}
          </div>
        ) : threads.length === 0 ? (
          <div className="text-center py-16 text-muted">
            <p>No threads yet.</p>
            <p className="text-xs mt-2">Be the first to start a conversation about a resource.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {threads.map(thread => (
              <ThreadCard
                key={thread.id}
                thread={thread}
                onAppreciate={handleAppreciate}
              />
            ))}
          </div>
        )}

        {hasMore && !loading && (
          <button
            onClick={() => load(false)}
            className="w-full mt-6 py-2.5 text-sm rounded-xl border border-border text-muted hover:text-foreground hover:border-primary/30 transition-colors"
          >
            Load more
          </button>
        )}
      </div>
    </div>
  );
}

function ThreadCard({ thread, onAppreciate }: { thread: ReferenceThread; onAppreciate: (id: string) => void }) {
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const shareRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) setReportOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleShare = async () => {
    const url = `${window.location.origin}/threads/${thread.id}`;
    try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
  };

  const submitReport = async () => {
    if (!reportReason.trim()) return;
    try {
      await reportReferenceContent("thread", thread.id, reportReason.trim());
      setReportOpen(false);
      setReportReason("");
    } catch { /* silently fail */ }
  };

  const isLiked = !!thread.appreciated_by_me;
  const authorName = thread.creator.name;
  const authorRole = thread.creator.role || "Learner";
  const avatarUrl = thread.creator.avatar_url || `https://picsum.photos/seed/${encodeURIComponent(authorName)}/60/60`;

  return (
    <article className="rounded-2xl border border-border bg-surface overflow-hidden">
      {/* Anchor card */}
      <div className="px-5 pt-4 pb-3 border-b border-border/50">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded bg-primary/10 text-primary">
            {ANCHOR_LABELS[thread.anchor_type]}
          </span>
          {thread.status === "closed" && (
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded bg-amber-500/10 text-amber-400">
              Closed
            </span>
          )}
        </div>
        {thread.anchor_type === "external_url" && thread.anchor_url ? (
          <a href={thread.anchor_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors">
            {thread.anchor_title || thread.anchor_domain || thread.anchor_url}
            <IconExternalLink size={13} className="text-muted" />
          </a>
        ) : (
          <div className="text-sm font-medium text-foreground">
            {thread.anchor_title || "Resource"}
          </div>
        )}
        {thread.anchor_domain && thread.anchor_type === "external_url" && (
          <div className="text-xs text-muted mt-0.5">{thread.anchor_domain}</div>
        )}
      </div>

      {/* Thread content */}
      <Link href={`/threads/${thread.id}`} className="block px-5 py-4 hover:bg-border/10 transition-colors">
        <div className="flex items-center gap-2 mb-2">
          <img src={avatarUrl} alt={authorName} className="w-7 h-7 rounded-full object-cover" />
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-medium text-foreground">{authorName}</span>
            <span className="text-muted">·</span>
            <span className="text-muted">{authorRole}</span>
            <span className="text-muted">·</span>
            <span className="text-muted">{formatTimeAgo(thread.created_at)}</span>
          </div>
        </div>
        <h2 className="text-base font-semibold text-foreground mb-1">{thread.title}</h2>
        {thread.body && <p className="text-sm text-muted line-clamp-2">{thread.body}</p>}
        {thread.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {thread.tags.slice(0, 4).map(t => (
              <span key={t} className="px-1.5 py-0.5 text-[10px] rounded bg-border/30 text-muted">#{t.replaceAll(" ", "")}</span>
            ))}
          </div>
        )}
      </Link>

      {/* Actions */}
      <div className="flex items-center gap-1 px-3 py-2 border-t border-border/50">
        <button
          onClick={(e) => { e.preventDefault(); onAppreciate(thread.id); }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${isLiked ? "text-red-400" : "text-muted hover:text-red-400"}`}
        >
          {isLiked ? <IconHeartFilled size={14} /> : <IconHeart size={14} />}
          <span className="tabular-nums">{thread.appreciated_count}</span>
        </button>
        <Link href={`/threads/${thread.id}`} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted hover:text-foreground transition-colors">
          <IconMessageCircle size={14} />
          <span className="tabular-nums">{thread.reply_count}</span>
        </Link>
        <div className="relative ml-auto" ref={shareRef}>
          <button
            onClick={(e) => { e.preventDefault(); setReportOpen(!reportOpen); }}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-muted hover:text-foreground hover:bg-border/20 transition-colors"
          >
            <IconDots size={16} />
          </button>
          {reportOpen && (
            <div ref={reportRef} className="absolute right-0 bottom-full mb-2 w-64 rounded-xl border border-border bg-background shadow-lg p-2 z-20">
              <button onClick={(e) => { e.preventDefault(); handleShare(); setReportOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg text-foreground hover:bg-surface">
                <IconLink size={13} /> Copy link
              </button>
              <BookmarkButton targetType="thread" targetId={thread.id} showLabel />
              <ReportDialogLauncher targetType="thread" targetId={thread.id} disabled={!!thread.is_creator} />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function ReportDialogLauncher({ targetType, targetId, disabled }: { targetType: "thread" | "reply"; targetId: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  if (disabled) return null;
  return (
    <>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 border-t border-border mt-1 pt-1"
      >
        <IconFlag size={13} /> Report
      </button>
      <ReportDialog targetType={targetType} targetId={targetId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
