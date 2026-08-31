"use client";

import { useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/discover/top-nav";
import { Footer } from "@/components/discover/footer";
import { formatTime } from "@/lib/community/format-time";
import type { ThreadDetail, ThreadSummary } from "@/lib/community/threads-api";
import { appreciateThread, unappreciateThread, reportThread } from "@/lib/community/threads-api";
import { ReplyTree, ReplyComposer } from "@/components/community/reply-tree";

const ANCHOR_LABELS: Record<string, string> = {
  course: "Course", event: "Event", workshop: "Workshop", article: "Article", tutor_profile: "Tutor", external_url: "Link",
};

function AnchorCard({ thread }: { thread: ThreadSummary }) {
  return (
    <div className="rounded-2xl border border-[#1f2228] bg-[#0e1014] p-4 mb-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="inline-flex items-center rounded-md bg-[#1a1d23] px-2 py-0.5 text-[11px] font-medium text-[#9ca3af] uppercase tracking-wide">
          {ANCHOR_LABELS[thread.anchor_type] ?? thread.anchor_type}
        </span>
      </div>
      {thread.anchor_title && (
        <h2 className="text-sm font-medium text-[#e7e8ea]">{thread.anchor_title}</h2>
      )}
      {thread.anchor_url && (
        <a href={thread.anchor_url} target="_blank" rel="noopener noreferrer"
          className="text-xs text-[#6b7280] hover:text-[#9ca3af] break-all mt-1 inline-block">
          {thread.anchor_url}
        </a>
      )}
    </div>
  );
}

function AppreciateButton({ threadId, initial, isCreator }: { threadId: string; initial: { count: number; appreciated: boolean }; isCreator: boolean }) {
  const [count, setCount] = useState(initial.count);
  const [appreciated, setAppreciated] = useState(initial.appreciated);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const wasAppreciated = appreciated;
    setAppreciated(!wasAppreciated);
    setCount((c) => c + (wasAppreciated ? -1 : 1));
    try {
      const result = wasAppreciated ? await unappreciateThread(threadId) : await appreciateThread(threadId);
      setCount(result.appreciated_count);
      setAppreciated(result.appreciated_by_me);
    } catch {
      setAppreciated(wasAppreciated);
      setCount((c) => c + (wasAppreciated ? 1 : -1));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" onClick={toggle} disabled={busy || isCreator}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
        appreciated
          ? "border-[#3a3f47] bg-[#1a1d23] text-[#e7e8ea]"
          : "border-[#1f2228] bg-[#0e1014] text-[#9ca3af] hover:border-[#2a2e36] hover:text-[#e7e8ea]"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
      aria-pressed={appreciated}
      title={isCreator ? "You cannot appreciate your own thread" : undefined}>
      <span>{appreciated ? "♥" : "♡"}</span>
      <span>{count}</span>
    </button>
  );
}

function ReportButton({ targetType, targetId }: { targetType: "thread" | "reply"; targetId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || busy) return;
    setBusy(true);
    try {
      await reportThread(targetType, targetId, reason.trim());
      setDone(true);
      setOpen(false);
    } catch {
      setBusy(false);
    }
  };

  if (done) {
    return <span className="text-xs text-[#6b7280]">Reported. Thank you.</span>;
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="text-xs text-[#6b7280] hover:text-[#9ca3af]">Report</button>
      {open && (
        <div className="absolute right-0 top-7 z-10 w-64 rounded-xl border border-[#1f2228] bg-[#0e1014] p-3 shadow-xl">
          <form onSubmit={submit} className="flex flex-col gap-2">
            <label className="text-xs text-[#9ca3af]">Why are you reporting this?</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} required
              placeholder="Spam, abuse, misinformation…"
              className="w-full rounded-lg border border-[#1f2228] bg-[#080809] px-2 py-1.5 text-xs text-[#e7e8ea] placeholder-[#4b5563] resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b7280]" />
            <div className="flex items-center gap-2">
              <button type="submit" disabled={!reason.trim() || busy}
                className="rounded-lg bg-[#e7e8ea] px-3 py-1 text-xs font-medium text-[#0e1014] disabled:opacity-50">
                {busy ? "Sending…" : "Submit report"}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="text-xs text-[#6b7280]">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export function ThreadDetailView({ detail }: { detail: ThreadDetail }) {
  const { thread, replies } = detail;
  const [key, setKey] = useState(0);

  return (
    <div className="tutoria-page-shell flex flex-col min-h-[100dvh]">
      <TopNav />
      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
          <Link href="/threads" className="text-xs text-[#6b7280] hover:text-[#9ca3af] mb-4 inline-block">&larr; Back to threads</Link>

          <AnchorCard thread={thread} />

          <div className="rounded-2xl border border-[#1f2228] bg-[#0e1014] p-5">
            <h1 className="text-lg font-semibold text-[#e7e8ea] leading-snug">{thread.title}</h1>
            <div className="flex items-center gap-2 mt-2 mb-4">
              <span className="text-xs text-[#9ca3af]">{thread.author?.name ?? "Anonymous"}</span>
              <span className="text-xs text-[#4b5563]">·</span>
              <span className="text-xs text-[#6b7280]">{formatTime(thread.created_at)}</span>
            </div>
            {thread.body && (
              <p className="text-sm text-[#c9ccd1] leading-relaxed whitespace-pre-wrap mb-4">{thread.body}</p>
            )}
            {thread.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {thread.tags.map((tag) => (
                  <span key={tag} className="text-[11px] text-[#6b7280]">#{tag}</span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 pt-3 border-t border-[#1a1d23]">
              <AppreciateButton threadId={thread.id}
                initial={{ count: thread.appreciated_count, appreciated: !!thread.appreciated_by_me }}
                isCreator={!!thread.is_creator} />
              <ReportButton targetType="thread" targetId={thread.id} />
            </div>
          </div>

          <div className="mt-6">
            <h2 className="text-sm font-medium text-[#9ca3af] mb-3">
              {thread.reply_count} {thread.reply_count === 1 ? "reply" : "replies"}
            </h2>
            <ReplyTree replies={replies} threadId={thread.id} key={key} />
            {thread.status === "published" && thread.reply_permission !== "disabled" && (
              <ReplyComposer threadId={thread.id} parentId={null} onPosted={() => setKey((k) => k + 1)} />
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
