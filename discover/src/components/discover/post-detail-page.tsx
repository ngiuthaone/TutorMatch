"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconArrowLeft, IconHeart, IconHeartFilled, IconRepeat, IconMessage2,
  IconLink, IconShare, IconLock, IconDots,
} from "@tabler/icons-react";
import {
  getPost, likePost, unlikePost, repostPost, unrepostPost,
  type Post,
} from "@/lib/community/posts-api";
import {
  listComments, createComment, deleteComment, appreciateComment, unappreciateComment,
  type Comment,
} from "@/lib/community/comments-api";
import { subscribeToPostComments, subscribeToPostCommentCount, subscribeToPostLikes } from "@/lib/community/realtime-api";
import { BookmarkButton } from "@/components/community/bookmark-button";
import { ReportDialog } from "@/components/community/report-dialog";
import { ModerationMenu } from "@/components/community/moderation-menu";
import { getSessionAccessToken } from "@/lib/auth/session";

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

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function PostDetailPage({ postId }: { postId: string }) {
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const loadedPostIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, c] = await Promise.all([
        getPost(postId),
        listComments("post", postId),
      ]);
      setPost(p);
      setComments(c.comments);
      loadedPostIdRef.current = postId;
    } catch {
      setError("Post not found or unavailable.");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => { load(); }, [load]);

  // Realtime: live comment count + new comments
  useEffect(() => {
    if (!loadedPostIdRef.current) return;
    const id = loadedPostIdRef.current;
    const offComments = subscribeToPostComments(id, (comment) => {
      setComments(prev => prev.some(c => c.id === comment.id) ? prev : [...prev, comment]);
    });
    const offCount = subscribeToPostCommentCount(id, ({ comment_count }) => {
      setPost(prev => prev ? { ...prev, comment_count } : prev);
    });
    return () => { offComments(); offCount(); };
  }, [post?.id]);

  const handleLike = useCallback(async () => {
    if (!post) return;
    if (!getSessionAccessToken()) { router.push(`/auth/sign-in?next=/discussions/${postId}`); return; }
    const previous = post;
    setPost({ ...post, liked_by_me: !post.liked_by_me, like_count: post.liked_by_me ? post.like_count - 1 : post.like_count + 1 });
    try {
      if (post.liked_by_me) { const r = await unlikePost(post.id); setPost(p => p ? { ...p, like_count: r.like_count, liked_by_me: false } : p); }
      else { const r = await likePost(post.id); setPost(p => p ? { ...p, like_count: r.like_count, liked_by_me: true } : p); }
    } catch { setPost(previous); }
  }, [post, postId, router]);

  const handleRepost = useCallback(async () => {
    if (!post) return;
    if (!getSessionAccessToken()) { router.push(`/auth/sign-in?next=/discussions/${postId}`); return; }
    const previous = post;
    setPost({ ...post, reposted_by_me: !post.reposted_by_me, repost_count: post.reposted_by_me ? post.repost_count - 1 : post.repost_count + 1 });
    try {
      if (post.reposted_by_me) { const r = await unrepostPost(post.id); setPost(p => p ? { ...p, repost_count: r.repost_count, reposted_by_me: false } : p); }
      else { const r = await repostPost(post.id); setPost(p => p ? { ...p, repost_count: r.repost_count, reposted_by_me: true } : p); }
    } catch { setPost(previous); }
  }, [post, postId, router]);

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/discussions/${postId}`;
    try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
  }, [postId]);

  const submitComment = useCallback(async () => {
    if (!newComment.trim() || !post) return;
    if (!getSessionAccessToken()) { router.push(`/auth/sign-in?next=/discussions/${postId}`); return; }
    setSubmitting(true);
    try {
      const result = await createComment("post", post.id, newComment.trim());
      const c: Comment = {
        id: result.id, parent_id: null, body: newComment.trim(),
        appreciated_count: 0, created_at: new Date().toISOString(),
        depth: 1, is_creator: true, appreciated_by_me: false,
        author: { name: "You", avatar_url: null, role: undefined },
      };
      setComments(prev => [...prev, c]);
      setPost(p => p ? { ...p, comment_count: p.comment_count + 1 } : p);
      setNewComment("");
    } catch { /* ignore */ }
    finally { setSubmitting(false); }
  }, [newComment, post, postId, router]);

  const handleDeleteComment = useCallback(async (commentId: string) => {
    try {
      await deleteComment(commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
      setPost(p => p ? { ...p, comment_count: Math.max(0, p.comment_count - 1) } : p);
    } catch { /* ignore */ }
  }, []);

  const handleAppreciateComment = useCallback(async (commentId: string) => {
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, appreciated_by_me: !c.appreciated_by_me, appreciated_count: c.appreciated_by_me ? c.appreciated_count - 1 : c.appreciated_count + 1 } : c));
    try {
      if (comment.appreciated_by_me) await unappreciateComment(commentId);
      else await appreciateComment(commentId);
    } catch {
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, ...comment } : c));
    }
  }, [comments]);

  if (loading || !post) {
    if (error) {
      return (
        <div className="min-h-[100dvh] bg-[#070b12] text-foreground">
          <div className="mx-auto max-w-[680px] px-4 py-12 text-center">
            <p className="text-muted">{error}</p>
            <Link href="/discussions" className="text-sm text-primary hover:underline mt-2 inline-block">Back to discussions</Link>
          </div>
        </div>
      );
    }
    return <div className="min-h-[100dvh] bg-[#070b12]"><div className="mx-auto max-w-[680px] px-4 py-8"><div className="animate-pulse h-64 rounded-2xl bg-surface" /></div></div>;
  }

  const authorName = post.author.name;
  const authorRole = post.author.role || "Learner";
  const avatarUrl = post.author.avatar_url || `https://picsum.photos/seed/${encodeURIComponent(authorName)}/60/60`;

  return (
    <div className="min-h-[100dvh] bg-[#070b12] text-foreground">
      <div className="mx-auto max-w-[680px] px-4 py-6">
        <Link href="/discussions" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-4">
          <IconArrowLeft size={14} /> Back to discussions
        </Link>

        <div className="rounded-2xl border border-border bg-surface p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <img src={avatarUrl} alt={authorName} className="w-9 h-9 rounded-full object-cover" />
            <div>
              <div className="text-sm font-medium">{authorName}</div>
              <div className="text-xs text-muted">{authorRole} · {formatFullDate(post.created_at)}</div>
            </div>
            {post.community_id && (
              <div className="ml-auto">
                <ModerationMenu targetType="post" targetId={post.id} canModerate={false} />
              </div>
            )}
          </div>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{post.body}</p>
          {post.image_url && (
            <img src={post.image_url} alt="Post image" className="w-full max-h-96 object-cover rounded-xl mt-3" />
          )}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {post.tags.map(t => (
                <span key={t} className="px-2 py-0.5 text-[11px] rounded-full bg-border/30 text-muted">#{t.replaceAll(" ", "")}</span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1 mt-4 pt-3 border-t border-border/50">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${post.liked_by_me ? "text-red-400" : "text-muted hover:text-red-400"}`}
              aria-label={post.liked_by_me ? "Unlike" : "Like"}
            >
              {post.liked_by_me ? <IconHeartFilled size={14} /> : <IconHeart size={14} />}
              <span className="tabular-nums">{post.like_count}</span>
            </button>
            <button
              onClick={handleRepost}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${post.reposted_by_me ? "text-green-400" : "text-muted hover:text-green-400"}`}
              aria-label={post.reposted_by_me ? "Unrepost" : "Repost"}
            >
              <IconRepeat size={14} />
              <span className="tabular-nums">{post.repost_count}</span>
            </button>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted">
              <IconMessage2 size={14} />
              <span className="tabular-nums">{post.comment_count}</span>
            </div>
            <button
              onClick={handleShare}
              className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted hover:text-foreground transition-colors"
              aria-label="Share"
            >
              <IconLink size={14} /> Share
            </button>
            {!post.is_author && (
              <button
                onClick={() => setReportOpen(true)}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-muted hover:text-red-400 transition-colors"
                aria-label="Report"
              >
                <IconDots size={14} />
              </button>
            )}
            <BookmarkButton targetType="post" targetId={post.id} iconOnly />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4 mb-4">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={getSessionAccessToken() ? "Write a comment…" : "Sign in to comment"}
            disabled={!getSessionAccessToken() || submitting}
            rows={2}
            className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted/60 focus:outline-none"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={submitComment}
              disabled={!newComment.trim() || submitting}
              className="px-4 py-1.5 text-sm font-medium rounded-xl bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-40"
            >
              {submitting ? "Posting…" : "Comment"}
            </button>
          </div>
        </div>

        {comments.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted">No comments yet. Be the first to respond.</div>
        ) : (
          <div className="space-y-2">
            {comments.map((c) => (
              <div key={c.id} className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-start gap-2 mb-2">
                  <img src={c.author.avatar_url || `https://picsum.photos/seed/${encodeURIComponent(c.author.name)}/40/40`} alt={c.author.name} className="w-7 h-7 rounded-full object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-medium">{c.author.name}</span>
                      {c.author.role && <span className="text-muted">· {c.author.role}</span>}
                      <span className="text-muted">· {formatTimeAgo(c.created_at)}</span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed mt-1 whitespace-pre-line">{c.body}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <button onClick={() => handleAppreciateComment(c.id)} className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${c.appreciated_by_me ? "text-red-400" : "text-muted hover:text-red-400"}`}>
                        {c.appreciated_by_me ? <IconHeartFilled size={11} /> : <IconHeart size={11} />}
                        <span className="tabular-nums">{c.appreciated_count}</span>
                      </button>
                      {c.is_creator && (
                        <button onClick={() => handleDeleteComment(c.id)} className="px-2 py-1 rounded text-xs text-muted hover:text-red-400">
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ReportDialog
        targetType="post"
        targetId={post.id}
        open={reportOpen}
        onClose={() => setReportOpen(false)}
      />
    </div>
  );
}
