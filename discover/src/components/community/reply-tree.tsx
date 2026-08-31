"use client";

import { useState } from "react";
import { formatTime } from "@/lib/community/format-time";
import type { ThreadReply } from "@/lib/community/threads-api";
import { replyToThread, isCommunityApiError } from "@/lib/community/threads-api";

function ReplyComposer({ threadId, parentId, onPosted, compact }: {
  threadId: string; parentId: string | null; onPosted: () => void; compact?: boolean;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await replyToThread(threadId, body.trim(), parentId);
      setBody("");
      onPosted();
    } catch (err) {
      if (isCommunityApiError(err)) setError(err.message || "Could not post reply.");
      else setError("Something went wrong.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={compact ? "flex flex-col gap-2" : "flex flex-col gap-3 mt-4"}>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={compact ? 2 : 3} maxLength={2000}
        placeholder="Share your thoughts…"
        className="w-full rounded-lg border border-[#1f2228] bg-[#0e1014] px-3 py-2 text-sm text-[#e7e8ea] placeholder-[#4b5563] resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b7280]" />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={!body.trim() || submitting}
          className="rounded-lg bg-[#e7e8ea] px-4 py-1.5 text-xs font-medium text-[#0e1014] transition-colors hover:bg-[#d4d5d7] disabled:opacity-50 disabled:cursor-not-allowed">
          {submitting ? "Posting…" : "Reply"}
        </button>
        <button type="button" onClick={onPosted} className="text-xs text-[#6b7280] hover:text-[#9ca3af]">Cancel</button>
      </div>
    </form>
  );
}

function ReplyNode({ reply, threadId, depth }: { reply: ThreadReply; threadId: string; depth: number }) {
  const [showReply, setShowReply] = useState(false);
  return (
    <div className={`${depth > 0 ? "pl-4 sm:pl-6 border-l border-[#1f2228]" : ""}`}>
      <div className="py-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-[#e7e8ea]">{reply.author?.name ?? "Anonymous"}</span>
          <span className="text-xs text-[#6b7280]">{formatTime(reply.created_at)}</span>
        </div>
        {reply.body ? (
          <p className="text-sm text-[#c9ccd1] leading-relaxed whitespace-pre-wrap">{reply.body}</p>
        ) : (
          <p className="text-sm text-[#4b5563] italic">[deleted]</p>
        )}
        {reply.body && (
          <div className="flex items-center gap-3 mt-2">
            <button type="button" onClick={() => setShowReply((v) => !v)}
              className="text-xs text-[#6b7280] hover:text-[#9ca3af]">Reply</button>
          </div>
        )}
        {showReply && depth < 3 && (
          <div className="mt-2">
            <ReplyComposer threadId={threadId} parentId={reply.id} onPosted={() => setShowReply(false)} compact />
          </div>
        )}
      </div>
    </div>
  );
}

function buildReplyTree(replies: ThreadReply[]): { reply: ThreadReply; children: ThreadReply[] }[] {
  const byParent = new Map<string | null, ThreadReply[]>();
  for (const r of replies) {
    const key = r.parent_id;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(r);
  }
  const top = byParent.get(null) ?? [];
  return top.map((reply) => ({ reply, children: byParent.get(reply.id) ?? [] }));
}

export function ReplyTree({ replies, threadId }: { replies: ThreadReply[]; threadId: string }) {
  const tree = buildReplyTree(replies);
  if (tree.length === 0) {
    return <p className="text-sm text-[#6b7280]">No replies yet. Be the first to share your thoughts.</p>;
  }
  return (
    <div>
      {tree.map(({ reply, children }) => (
        <div key={reply.id}>
          <ReplyNode reply={reply} threadId={threadId} depth={reply.depth} />
          {children.map((child) => (
            <ReplyNode key={child.id} reply={child} threadId={threadId} depth={child.depth} />
          ))}
        </div>
      ))}
    </div>
  );
}

export { ReplyComposer };
