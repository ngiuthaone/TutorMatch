"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/discover/top-nav";
import { Footer } from "@/components/discover/footer";
import { sanitizeRichHtml } from "@/lib/sanitize";
import { formatTime } from "@/lib/community/format-time";
import type { ArticleDetail } from "@/lib/community/articles-api";
import { listComments, createComment, isCommunityApiError } from "@/lib/community/comments-api";

function CommentItem({ comment, depth }: { comment: { id: string; body: string; created_at: string; author: { name: string }; depth: number }; depth: number }) {
  return (
    <div className={`${depth > 0 ? "pl-4 sm:pl-6 border-l border-[#1f2228]" : ""} py-3`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-medium text-[#e7e8ea]">{comment.author?.name ?? "Anonymous"}</span>
        <span className="text-xs text-[#6b7280]">{formatTime(comment.created_at)}</span>
      </div>
      {comment.body ? (
        <p className="text-sm text-[#c9ccd1] leading-relaxed whitespace-pre-wrap">{comment.body}</p>
      ) : (
        <p className="text-sm text-[#4b5563] italic">[deleted]</p>
      )}
    </div>
  );
}

export function ArticleView({ article }: { article: ArticleDetail }) {
  const [comments, setComments] = useState<{ id: string; body: string; created_at: string; author: { name: string }; depth: number; parent_id: string | null }[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listComments("article", article.id).then((result) => {
      if (!cancelled) setComments(result.comments as typeof comments);
    }).finally(() => {
      if (!cancelled) setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [article.id, refreshKey]);

  const refreshComments = () => setRefreshKey((k) => k + 1);

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim() || submitting) return;
    setCommentError(null);
    setSubmitting(true);
    try {
      await createComment("article", article.id, commentBody.trim());
      setCommentBody("");
      refreshComments();
    } catch (err) {
      if (isCommunityApiError(err)) setCommentError(err.message || "Could not post comment.");
      else setCommentError("Something went wrong.");
      setSubmitting(false);
    }
  };

  const safeHtml = sanitizeRichHtml(article.content_html);

  return (
    <div className="tutoria-page-shell flex flex-col min-h-[100dvh]">
      <TopNav />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <Link href="/articles" className="text-xs text-[#6b7280] hover:text-[#9ca3af] mb-6 inline-block">&larr; All articles</Link>

          {article.cover_image_url && (
            <div className="rounded-2xl overflow-hidden border border-[#1f2228] mb-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={article.cover_image_url} alt={article.cover_image_alt || article.title}
                className="w-full h-56 sm:h-80 object-cover" />
            </div>
          )}

          <p className="text-xs text-[#6b7280] uppercase tracking-wide mb-2">
            {article.level?.replace("_", " ") ?? "General"} · {article.estimated_reading_minutes} min read
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold text-[#e7e8ea] leading-tight">{article.title}</h1>
          {article.subtitle && <p className="mt-3 text-lg text-[#9ca3af]">{article.subtitle}</p>}

          <div className="flex items-center gap-2 mt-5 mb-8 pb-6 border-b border-[#1a1d23]">
            <span className="text-sm text-[#9ca3af]">{article.author?.name ?? "Anonymous"}</span>
            {article.published_at && (
              <>
                <span className="text-xs text-[#4b5563]">·</span>
                <span className="text-xs text-[#6b7280]">{formatTime(article.published_at)}</span>
              </>
            )}
              {article.is_author && (
                <Link href={`/articles/${article.slug}/edit`} className="ml-auto text-xs text-[#6b7280] hover:text-[#9ca3af]">Edit</Link>
              )}
          </div>

          <div className="article-view-content text-[15px] text-[#c9ccd1] leading-relaxed"
            dangerouslySetInnerHTML={{ __html: safeHtml }} />

          {article.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-8 pt-6 border-t border-[#1a1d23]">
              {article.tags.map((tag) => (
                <span key={tag} className="text-[11px] text-[#6b7280]">#{tag}</span>
              ))}
            </div>
          )}

          {article.comments_enabled && (
            <section className="mt-10 pt-6 border-t border-[#1a1d23">
              <h2 className="text-sm font-medium text-[#9ca3af] mb-4">
                {comments.length} {comments.length === 1 ? "comment" : "comments"}
              </h2>
              {loaded && comments.length === 0 && (
                <p className="text-sm text-[#6b7280] mb-4">No comments yet.</p>
              )}
              {loaded && comments.map((c) => (
                <CommentItem key={c.id} comment={c} depth={c.depth} />
              ))}
              <form onSubmit={handleComment} className="flex flex-col gap-2 mt-4">
                <textarea value={commentBody} onChange={(e) => setCommentBody(e.target.value)} rows={3} maxLength={2000}
                  placeholder="Add a comment…"
                  className="w-full rounded-lg border border-[#1f2228] bg-[#0e1014] px-3 py-2 text-sm text-[#e7e8ea] placeholder-[#4b5563] resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b7280]" />
                {commentError && <p className="text-xs text-red-400">{commentError}</p>}
                <button type="submit" disabled={!commentBody.trim() || submitting}
                  className="self-start rounded-lg bg-[#e7e8ea] px-4 py-1.5 text-sm font-medium text-[#0e1014] disabled:opacity-50 disabled:cursor-not-allowed">
                  {submitting ? "Posting…" : "Comment"}
                </button>
              </form>
            </section>
          )}
        </article>
      </main>
      <Footer />
    </div>
  );
}
