"use client";

import { useState, useEffect, useCallback } from "react";
import { IconHeart, IconHeartFilled, IconMessage2, IconDots, IconFlag, IconTrash } from "@tabler/icons-react";
import { getComments, addComment, deletePublishedPost, updatePublishedPost } from "@/lib/storage";
import { generateId, getUserFromStorage } from "@/lib/types";
import type { Comment } from "@/lib/types";

interface CommentThreadProps {
  contentId: string;
  contentType: "post" | "article";
  onUpdate: () => void;
}

export function CommentThread({ contentId, contentType, onUpdate }: CommentThreadProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const user = getUserFromStorage();

  const loadComments = useCallback(() => {
    setComments(getComments(contentId));
  }, [contentId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    const user_ = getUserFromStorage();
    addComment({
      id: generateId(),
      parentId: "",
      contentId,
      contentType,
      authorId: user_?.id || "anon",
      authorName: user_?.name || "Anonymous",
      authorAvatar: user_?.avatarUrl,
      authorRole: user_?.role,
      body: newComment.trim(),
      likes: 0,
      appreciated: false,
      createdAt: new Date().toISOString(),
    });
    setNewComment("");
    onUpdate();
    loadComments();
  };

  const handleReply = (parentId: string) => {
    if (!replyText.trim()) return;
    const user_ = getUserFromStorage();
    addComment({
      id: generateId(),
      parentId,
      contentId,
      contentType,
      authorId: user_?.id || "anon",
      authorName: user_?.name || "Anonymous",
      authorAvatar: user_?.avatarUrl,
      authorRole: user_?.role,
      body: replyText.trim(),
      likes: 0,
      appreciated: false,
      createdAt: new Date().toISOString(),
    });
    setReplyText("");
    setReplyTo(null);
    onUpdate();
    loadComments();
  };

  const totalComments = comments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0);

  if (totalComments === 0 && !user) {
    return null;
  }

  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
        <IconMessage2 size={14} className="text-primary" />
        {totalComments} {totalComments === 1 ? "Comment" : "Comments"}
      </h3>

      {user && (
        <div className="flex items-start gap-3 mb-4">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 flex items-center gap-2">
            <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment\u2026"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted/60 focus:outline-none border-b border-border pb-1" />
            <button onClick={handleSubmit} disabled={!newComment.trim()}
              className="text-xs font-medium text-primary hover:text-primary-dark transition-colors disabled:opacity-40">Post</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {comments.map((comment) => (
          <CommentCard key={comment.id} comment={comment} onReply={setReplyTo} replyTo={replyTo}
            replyText={replyText} setReplyText={setReplyText} onReplySubmit={handleReply} user={user} />
        ))}
      </div>
    </div>
  );
}

function CommentCard({ comment, onReply, replyTo, replyText, setReplyText, onReplySubmit, user }: {
  comment: Comment;
  onReply: (id: string | null) => void;
  replyTo: string | null;
  replyText: string;
  setReplyText: (v: string) => void;
  onReplySubmit: (parentId: string) => void;
  user: ReturnType<typeof getUserFromStorage>;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
          {comment.authorName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted flex-wrap">
            <span className="font-medium text-foreground">{comment.authorName}</span>
            {comment.authorRole && <span className="text-muted">{comment.authorRole}</span>}
            <span className="w-1 h-1 rounded-full bg-border" />
            <span>{formatTime(comment.createdAt)}</span>
            <div className="relative ml-auto">
              <button onClick={() => setShowMenu((v) => !v)}
                className="p-1 rounded text-muted hover:text-foreground hover:bg-surface transition-colors">
                <IconDots size={13} />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 w-32 rounded-xl border border-border bg-background shadow-lg p-1 z-10">
                  <button className="w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg text-foreground hover:bg-surface transition-colors">
                    <IconFlag size={12} className="text-muted" /> Report
                  </button>
                  <button className="w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg text-foreground hover:bg-surface transition-colors">
                    <IconTrash size={12} className="text-muted" /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>
          <p className="mt-1.5 text-sm text-foreground leading-relaxed">{comment.body}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted">
            <button className="flex items-center gap-1 hover:text-red-400 transition-colors">
              <IconHeart size={12} />
              <span>{comment.likes}</span>
            </button>
            {user && (
              <button onClick={() => onReply(replyTo === comment.id ? null : comment.id)}
                className="hover:text-primary transition-colors">
                Reply
              </button>
            )}
          </div>

          {replyTo === comment.id && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
              <input type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply\u2026"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted/60 focus:outline-none" />
              <button onClick={() => onReplySubmit(comment.id)} disabled={!replyText.trim()}
                className="text-xs font-medium text-primary hover:text-primary-dark transition-colors disabled:opacity-40">Reply</button>
            </div>
          )}

          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border space-y-3">
              {comment.replies.map((reply) => (
                <div key={reply.id} className="flex items-start gap-3 pl-4">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                    {reply.authorName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted flex-wrap">
                      <span className="font-medium text-foreground">{reply.authorName}</span>
                      <span className="w-1 h-1 rounded-full bg-border" />
                      <span>{formatTime(reply.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-sm text-foreground leading-relaxed">{reply.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
