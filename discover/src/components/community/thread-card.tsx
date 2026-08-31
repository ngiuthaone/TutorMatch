"use client";

import Link from "next/link";
import type { ThreadSummary } from "@/lib/community/threads-api";
import { formatTime } from "@/lib/community/format-time";

const ANCHOR_LABELS: Record<string, string> = {
  course: "Course",
  event: "Event",
  workshop: "Workshop",
  article: "Article",
  tutor_profile: "Tutor",
  external_url: "Link",
};

export function ThreadCard({ thread }: { thread: ThreadSummary }) {
  return (
    <Link href={`/threads/${thread.id}`}
      className="block rounded-2xl border border-[#1f2228] bg-[#0e1014] p-5 transition-colors hover:border-[#2a2e36] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b7280]">
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center rounded-md bg-[#1a1d23] px-2 py-0.5 text-[11px] font-medium text-[#9ca3af] uppercase tracking-wide">
          {ANCHOR_LABELS[thread.anchor_type] ?? thread.anchor_type}
        </span>
        {thread.anchor_title && (
          <span className="text-xs text-[#6b7280] truncate">{thread.anchor_title}</span>
        )}
      </div>
      <h3 className="text-[15px] font-semibold text-[#e7e8ea] leading-snug line-clamp-2">
        {thread.title}
      </h3>
      {thread.body && (
        <p className="mt-1.5 text-sm text-[#9ca3af] leading-relaxed line-clamp-2">{thread.body}</p>
      )}
      {thread.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {thread.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-[11px] text-[#6b7280]">#{tag}</span>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center gap-4 text-xs text-[#6b7280]">
        <span>{thread.reply_count} {thread.reply_count === 1 ? "reply" : "replies"}</span>
        <span>{thread.appreciated_count} {thread.appreciated_count === 1 ? "appreciation" : "appreciations"}</span>
        <span>{formatTime(thread.created_at)}</span>
      </div>
    </Link>
  );
}
