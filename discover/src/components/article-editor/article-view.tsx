"use client";

import { useState, useEffect, useCallback } from "react";
import { IconArrowLeft, IconClock, IconHeart, IconHeartFilled, IconMessage2, IconBookmark, IconBookmarkFilled, IconShare, IconDots, IconFlag, IconTrash, IconEdit } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { getPublishedArticleById, toggleAppreciate, getComments } from "@/lib/storage";
import type { PublishedArticle } from "@/lib/types";
import { CommentThread } from "@/components/discussion/comment-thread";
import { getUserFromStorage } from "@/lib/types";

export function ArticleView({ id }: { id: string }) {
  const router = useRouter();
  const [article, setArticle] = useState<PublishedArticle | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [appreciated, setAppreciated] = useState(false);
  const [likes, setLikes] = useState(0);
  const [saved, setSaved] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const user = getUserFromStorage();

  const loadArticle = useCallback(() => {
    const a = getPublishedArticleById(id);
    if (a) {
      setArticle(a);
      setAppreciated(a.appreciated);
      setLikes(a.likes);
      setCommentCount(a.comments);
    } else {
      setNotFound(true);
    }
  }, [id]);

  useEffect(() => {
    const a = getPublishedArticleById(id);
    if (a) {
      setArticle(a);
      setAppreciated(a.appreciated);
      setLikes(a.likes);
      setCommentCount(a.comments);
      try {
        const saves = JSON.parse(localStorage.getItem("tutoria_saves") || "[]");
        setSaved(saves.includes(a.id));
      } catch {}
    } else {
      setNotFound(true);
    }
  }, [id]);

  const handleAppreciate = useCallback(() => {
    toggleAppreciate(id, "article");
    setAppreciated((v) => !v);
    setLikes((v) => (appreciated ? v - 1 : v + 1));
  }, [id, appreciated]);

  const handleSave = useCallback(() => {
    try {
      const saves: string[] = JSON.parse(localStorage.getItem("tutoria_saves") || "[]");
      const next = saved ? saves.filter((s) => s !== id) : [...saves, id];
      localStorage.setItem("tutoria_saves", JSON.stringify(next));
      setSaved((v) => !v);
    } catch {}
  }, [id, saved]);

  if (notFound) {
    return (
      <main className="flex-1">
        <div className="max-w-[680px] mx-auto px-4 pt-12 pb-16 text-center">
          <h1 className="text-xl font-semibold text-foreground">Article not found</h1>
          <p className="text-sm text-muted mt-2">This article may have been removed or doesn&apos;t exist.</p>
          <button onClick={() => router.push("/discussions")}
            className="inline-flex items-center gap-1.5 mt-6 text-sm font-medium text-primary hover:text-primary-dark transition-colors">
            <IconArrowLeft size={14} /> Back to discussions
          </button>
        </div>
      </main>
    );
  }

  if (!article) {
    return <main className="flex-1" />;
  }

  return (
    <main className="flex-1">
      <div className="max-w-[680px] mx-auto px-4 pt-8 pb-16">
        <button onClick={() => router.push("/discussions")}
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors mb-6">
          <IconArrowLeft size={14} /> All discussions
        </button>

        <article className="rounded-2xl border border-border bg-background overflow-hidden">
          {article.coverImage && (
            <div className="aspect-[16/9] overflow-hidden bg-surface">
              <img src={article.coverImage.url} alt={article.coverImage.altText || ""} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-6 md:p-8">
            {article.topicName && (
              <p className="text-[11px] font-semibold uppercase tracking-widest text-primary mb-3">
                {article.topicName} \u00B7 {article.estimatedReadingMinutes} min read
              </p>
            )}
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground flex-1">{article.title}</h1>
              <div className="relative shrink-0">
                <button onClick={() => setShowMenu((v) => !v)}
                  className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors">
                  <IconDots size={18} />
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-full mt-1 w-40 rounded-xl border border-border bg-background shadow-lg p-1 z-10">
                    <button className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg text-foreground hover:bg-surface transition-colors">
                      <IconBookmark size={13} className="text-muted" /> Save
                    </button>
                    <button className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg text-foreground hover:bg-surface transition-colors">
                      <IconEdit size={13} className="text-muted" /> Edit
                    </button>
                    <button className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                      <IconTrash size={13} /> Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
            {article.subtitle && (
              <p className="mt-2 text-base text-muted">{article.subtitle}</p>
            )}
            <div className="flex items-center gap-3 mt-4 text-xs text-muted">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                  {article.authorName?.charAt(0) || "Y"}
                </div>
                <span className="font-medium text-foreground">{article.authorName}</span>
                {article.authorRole && <span className="text-muted">{article.authorRole}</span>}
              </div>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span className="flex items-center gap-1"><IconClock size={12} />{article.estimatedReadingMinutes} min read</span>
            </div>
            <div className="mt-8 article-view-content text-sm text-foreground leading-relaxed"
              dangerouslySetInnerHTML={{ __html: article.contentHtml || "" }} />
            <div className="flex items-center gap-4 mt-8 pt-4 border-t border-border text-xs text-muted">
              <button onClick={handleAppreciate}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors ${appreciated ? "text-red-400 bg-red-50 dark:bg-red-900/10" : "hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-400"}`}>
                {appreciated ? <IconHeartFilled size={15} /> : <IconHeart size={15} />}
                <span className="tabular-nums">{likes}</span>
              </button>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-primary/5 hover:text-primary transition-colors cursor-pointer">
                <IconMessage2 size={15} />
                <span className="tabular-nums">{commentCount}</span>
              </div>
              <button onClick={handleSave}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ml-auto transition-colors ${saved ? "text-primary bg-primary/5" : "hover:bg-surface hover:text-foreground"}`}>
                {saved ? <IconBookmarkFilled size={15} /> : <IconBookmark size={15} />}
              </button>
              <button className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-surface hover:text-foreground transition-colors">
                <IconShare size={15} />
              </button>
            </div>
          </div>
        </article>

        {article.commentsEnabled && (
          <div className="mt-6">
            <CommentThread contentId={article.id} contentType="article" onUpdate={loadArticle} />
          </div>
        )}

        {!article.commentsEnabled && (
          <p className="mt-6 text-center text-xs text-muted">Comments are disabled for this article.</p>
        )}
      </div>
    </main>
  );
}
