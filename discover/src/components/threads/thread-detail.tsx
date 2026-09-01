"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconHeart, IconHeartFilled, IconMessageCircle, IconArrowLeft,
  IconExternalLink, IconLock, IconDots, IconLink, IconShare, IconFlag, IconTrash,
} from "@tabler/icons-react";
import {
  getThread, getThreadReplies, replyToThread, appreciateReference,
  unappreciateReference, reportReferenceContent, deleteThread, deleteThreadReply,
  type ReferenceThread, type ThreadReply, type AnchorType,
} from "@/lib/community/threads-api";
import { getSessionAccessToken } from "@/lib/auth/session";

const ANCHOR_LABELS: Record<AnchorType, string> = {
  course: "Course", event: "Event", workshop: "Workshop",
  article: "Article", tutor_profile: "Tutor", external_url: "External",
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

export function ThreadDetailPage({ threadId }: { threadId: string }) {
  const router = useRouter();
  const [thread, setThread] = useState<ReferenceThread | null>(null);
  const [replies, setReplies] = useState<ThreadReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newReply, setNewReply] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reportOpenFor, setReportOpenFor] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, r] = await Promise.all([getThread(threadId), getThreadReplies(threadId)]);
      setThread(t);
      setReplies(r.replies);
    } catch {
      setError("Thread is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => { load(); }, [load]);

  const handleAppreciate = useCallback(async (targetType: "thread" | "reply", targetId: string) => {
    if (!getSessionAccessToken()) {
      router.push(`/auth/sign-in?next=/threads/${threadId}`);
      return;
    }
    if (targetType === "thread" && thread) {
      const isLiked = thread.appreciated_by_me;
      setThread({ ...thread, appreciated_by_me: !isLiked, appreciated_count: isLiked ? thread.appreciated_count - 1 : thread.appreciated_count + 1 });
      try {
        if (isLiked) await unappreciateReference("thread", targetId);
        else await appreciateReference("thread", targetId);
      } catch {
        setThread(thread);
      }
    } else {
      const reply = replies.find(r => r.id === targetId);
      if (!reply) return;
      const isLiked = reply.appreciated_by_me;
      setReplies(prev => prev.map(r => r.id === targetId ? { ...r, appreciated_by_me: !isLiked, appreciated_count: isLiked ? r.appreciated_count - 1 : r.appreciated_count + 1 } : r));
      try {
        if (isLiked) await unappreciateReference("reply", targetId);
        else await appreciateReference("reply", targetId);
      } catch {
        setReplies(prev => prev.map(r => r.id === targetId ? { ...r, ...reply } : r));
      }
    }
  }, [thread, replies, router, threadId]);

  const submitReply = useCallback(async (parentId: string | null = null) => {
    if (!newReply.trim() || !thread) return;
    if (!getSessionAccessToken()) {
      router.push(`/auth/sign-in?next=/threads/${threadId}`);
      return;
    }
    setSubmitting(true);
    try {
      const result = await replyToThread(threadId, newReply.trim(), parentId);
      const newR: ThreadReply = {
        id: result.id,
        parent_id: parentId,
        body: newReply.trim(),
        appreciated_count: 0,
        created_at: new Date().toISOString(),
        depth: result.depth,
        is_creator: true,
        appreciated_by_me: false,
        author: { name: "You", avatar_url: null, role: undefined },
      };
      setReplies(prev => [...prev, newR]);
      setThread({ ...thread, reply_count: thread.reply_count + 1 });
      setNewReply("");
      setReplyTo(null);
    } catch {
      setError("Failed to post reply.");
    } finally {
      setSubmitting(false);
    }
  }, [newReply, thread, threadId, router]);

  const handleDeleteThread = useCallback(async () => {
    if (!thread || !confirm("Delete this thread? This cannot be undone.")) return;
    try {
      await deleteThread(threadId);
      router.push("/threads");
    } catch { /* ignore */ }
  }, [thread, threadId, router]);

  const handleDeleteReply = useCallback(async (replyId: string) => {
    if (!confirm("Delete this reply?")) return;
    try {
      await deleteThreadReply(replyId);
      setReplies(prev => prev.filter(r => r.id !== replyId));
      if (thread) setThread({ ...thread, reply_count: Math.max(0, thread.reply_count - 1) });
    } catch { /* ignore */ }
  }, [thread]);

  const submitReport = useCallback(async (targetType: "thread" | "reply", targetId: string) => {
    if (!reportReason.trim()) return;
    try {
      await reportReferenceContent(targetType, targetId, reportReason.trim());
      setReportOpenFor(null);
      setReportReason("");
    } catch { /* silently fail */ }
  }, [reportReason]);

  if (loading && !thread) {
    return <div className="min-h-[100dvh] bg-[#070b12] text-foreground"><div className="mx-auto max-w-[680px] px-4 py-8"><div className="animate-pulse h-32 rounded-2xl bg-surface" /></div></div>;
  }

  if (error || !thread) {
    return (
      <div className="min-h-[100dvh] bg-[#070b12] text-foreground">
        <div className="mx-auto max-w-[680px] px-4 py-8 text-center">
          <p className="text-muted">{error || "Thread not found."}</p>
          <Link href="/threads" className="text-sm text-primary hover:underline mt-2 inline-block">Back to threads</Link>
        </div>
      </div>
    );
  }

  const isLiked = !!thread.appreciated_by_me;
  const authorName = thread.creator.name;
  const authorRole = thread.creator.role || "Learner";
  const avatarUrl = thread.creator.avatar_url || `https://picsum.photos/seed/${encodeURIComponent(authorName)}/60/60`;
  const isClosed = thread.status === "closed";

  return (
    <div className="min-h-[100dvh] bg-[#070b12] text-foreground">
      <div className="mx-auto max-w-[680px] px-4 py-6">
        <Link href="/threads" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-4">
          <IconArrowLeft size={14} /> All threads
        </Link>

        {/* Anchor card */}
        <div className="rounded-2xl border border-border bg-surface p-5 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded bg-primary/10 text-primary">
              {ANCHOR_LABELS[thread.anchor_type]}
            </span>
            {isClosed && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded bg-amber-500/10 text-amber-400">
                <IconLock size={10} /> Closed
              </span>
            )}
          </div>
          {thread.anchor_type === "external_url" && thread.anchor_url ? (
            <a href={thread.anchor_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-base font-semibold text-foreground hover:text-primary transition-colors">
              {thread.anchor_title || thread.anchor_domain || thread.anchor_url}
              <IconExternalLink size={14} className="text-muted" />
            </a>
          ) : (
            <div className="text-base font-semibold text-foreground">{thread.anchor_title || "Resource"}</div>
          )}
          {thread.anchor_domain && (
            <div className="text-xs text-muted mt-1">{thread.anchor_domain}</div>
          )}
        </div>

        {/* Thread body */}
        <div className="rounded-2xl border border-border bg-surface p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <img src={avatarUrl} alt={authorName} className="w-9 h-9 rounded-full object-cover" />
            <div>
              <div className="text-sm font-medium">{authorName}</div>
              <div className="text-xs text-muted">{authorRole} · {formatTimeAgo(thread.created_at)}</div>
            </div>
            {thread.is_creator && (
              <button onClick={handleDeleteThread} className="ml-auto p-2 text-muted hover:text-red-400 transition-colors" aria-label="Delete thread">
                <IconTrash size={16} />
              </button>
            )}
          </div>
          <h1 className="text-xl font-semibold mb-2">{thread.title}</h1>
          {thread.body && <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{thread.body}</p>}
          {thread.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {thread.tags.map(t => (
                <span key={t} className="px-2 py-0.5 text-[11px] rounded-full bg-border/30 text-muted">#{t.replaceAll(" ", "")}</span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1 mt-4 pt-3 border-t border-border/50">
            <button
              onClick={() => handleAppreciate("thread", thread.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${isLiked ? "text-red-400" : "text-muted hover:text-red-400"}`}
            >
              {isLiked ? <IconHeartFilled size={14} /> : <IconHeart size={14} />}
              <span className="tabular-nums">{thread.appreciated_count}</span>
            </button>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted">
              <IconMessageCircle size={14} />
              <span className="tabular-nums">{thread.reply_count}</span>
            </div>
            <button
              onClick={async () => { try { await navigator.clipboard.writeText(window.location.href); } catch { /* ignore */ } }}
              className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted hover:text-foreground transition-colors"
            >
              <IconLink size={14} /> Share
            </button>
          </div>
        </div>

        {/* Reply composer */}
        {!isClosed && thread.reply_permission !== "disabled" && (
          <div className="rounded-2xl border border-border bg-surface p-4 mb-4">
            <textarea
              value={newReply}
              onChange={(e) => setNewReply(e.target.value)}
              placeholder={getSessionAccessToken() ? "Add a reply…" : "Sign in to reply"}
              disabled={!getSessionAccessToken() || submitting}
              rows={2}
              className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted/60 focus:outline-none"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={() => submitReply(null)}
                disabled={!newReply.trim() || submitting}
                className="px-4 py-1.5 text-sm font-medium rounded-xl bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-40"
              >
                {submitting ? "Posting…" : "Reply"}
              </button>
            </div>
          </div>
        )}

        {isClosed && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 mb-4 text-center text-sm text-amber-300">
            This thread is closed. New replies are not accepted.
          </div>
        )}

        {/* Replies */}
        {replies.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted">No replies yet. Be the first to respond.</div>
        ) : (
          <div className="space-y-2">
            {replies.map(reply => (
              <ReplyItem
                key={reply.id}
                reply={reply}
                onAppreciate={handleAppreciate}
                onReply={setReplyTo}
                onDelete={handleDeleteReply}
                replyOpen={replyTo === reply.id}
                replyText={newReply}
                onReplyTextChange={setNewReply}
                onSubmitReply={() => submitReply(reply.id)}
                onReport={setReportOpenFor}
                reportOpenFor={reportOpenFor}
                reportReason={reportReason}
                onReportReasonChange={setReportReason}
                onSubmitReport={submitReport}
                submitting={submitting}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReplyItem({
  reply, onAppreciate, onReply, onDelete, replyOpen, replyText, onReplyTextChange,
  onSubmitReply, onReport, reportOpenFor, reportReason, onReportReasonChange, onSubmitReport, submitting,
}: {
  reply: ThreadReply;
  onAppreciate: (type: "thread" | "reply", id: string) => void;
  onReply: (id: string | null) => void;
  onDelete: (id: string) => void;
  replyOpen: boolean;
  replyText: string;
  onReplyTextChange: (v: string) => void;
  onSubmitReply: () => void;
  onReport: (id: string | null) => void;
  reportOpenFor: string | null;
  reportReason: string;
  onReportReasonChange: (v: string) => void;
  onSubmitReport: (type: "thread" | "reply", id: string) => void;
  submitting: boolean;
}) {
  const authorName = reply.author.name;
  const authorRole = reply.author.role || "Learner";
  const avatarUrl = reply.author.avatar_url || `https://picsum.photos/seed/${encodeURIComponent(authorName)}/60/60`;
  const isLiked = !!reply.appreciated_by_me;
  const indent = Math.min((reply.depth - 1) * 24, 48);

  return (
    <div className="rounded-2xl border border-border bg-surface p-4" style={{ marginLeft: `${indent}px` }}>
      <div className="flex items-center gap-2 mb-2">
        <img src={avatarUrl} alt={authorName} className="w-6 h-6 rounded-full object-cover" />
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-medium">{authorName}</span>
          <span className="text-muted">·</span>
          <span className="text-muted">{authorRole}</span>
          <span className="text-muted">·</span>
          <span className="text-muted">{formatTimeAgo(reply.created_at)}</span>
        </div>
        <div className="ml-auto relative">
          <button onClick={() => onReport(reportOpenFor === reply.id ? null : reply.id)} className="p-1 text-muted hover:text-foreground">
            <IconDots size={14} />
          </button>
          {reportOpenFor === reply.id && (
            <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-border bg-background shadow-lg p-2 z-20">
              {!reply.is_creator && (
                <div className="px-3 py-2">
                  <textarea
                    value={reportReason}
                    onChange={(e) => onReportReasonChange(e.target.value)}
                    placeholder="Why are you reporting this?"
                    rows={2}
                    className="w-full text-xs bg-transparent border border-border rounded p-1 focus:outline-none"
                  />
                  <button onClick={() => onSubmitReport("reply", reply.id)} className="mt-1 w-full text-xs font-medium text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded px-2 py-1">
                    Submit report
                  </button>
                </div>
              )}
              {reply.is_creator && (
                <button onClick={() => onDelete(reply.id)} className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10">
                  <IconTrash size={13} /> Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <p className="text-sm text-foreground leading-relaxed">{reply.body}</p>
      <div className="flex items-center gap-1 mt-2">
        <button onClick={() => onAppreciate("reply", reply.id)} className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${isLiked ? "text-red-400" : "text-muted hover:text-red-400"}`}>
          {isLiked ? <IconHeartFilled size={12} /> : <IconHeart size={12} />}
          <span className="tabular-nums">{reply.appreciated_count}</span>
        </button>
        {reply.depth < 3 && (
          <button onClick={() => onReply(replyOpen ? null : reply.id)} className="px-2 py-1 rounded text-xs text-muted hover:text-primary">
            Reply
          </button>
        )}
      </div>
      {replyOpen && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <textarea
            value={replyText}
            onChange={(e) => onReplyTextChange(e.target.value)}
            placeholder="Write a reply…"
            rows={2}
            className="w-full resize-none bg-transparent text-sm placeholder:text-muted/60 focus:outline-none"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={() => onReply(null)} className="px-3 py-1 text-xs text-muted">Cancel</button>
            <button onClick={onSubmitReply} disabled={!replyText.trim() || submitting} className="px-3 py-1 text-xs font-medium rounded-lg bg-primary text-white disabled:opacity-40">
              Reply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
