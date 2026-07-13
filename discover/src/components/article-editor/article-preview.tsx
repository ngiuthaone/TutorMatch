"use client";

import { useState, useEffect } from "react";
import { IconArrowLeft, IconClock, IconHeart, IconMessage2, IconBookmark, IconShare, IconUser } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { getArticleDrafts, getPublishedArticleById } from "@/lib/storage";
import type { ArticleDraft, PublishedArticle } from "@/lib/types";

export function ArticlePreview({ id }: { id: string }) {
  const router = useRouter();
  const [article, setArticle] = useState<ArticleDraft | PublishedArticle | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const published = getPublishedArticleById(id);
    if (published) {
      setArticle(published);
      return;
    }
    const drafts = getArticleDrafts();
    const draft = drafts.find((d) => d.id === id);
    if (draft) {
      setArticle(draft);
      return;
    }
    setNotFound(true);
  }, [id]);

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
          <IconArrowLeft size={14} /> Back to editor
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
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">{article.title}</h1>
            {article.subtitle && (
              <p className="mt-2 text-base text-muted">{article.subtitle}</p>
            )}
            <div className="flex items-center gap-3 mt-4 text-xs text-muted">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                  {(article as PublishedArticle).authorName?.charAt(0) || "Y"}
                </div>
                <span className="font-medium text-foreground">{(article as PublishedArticle).authorName || "You"}</span>
              </div>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span className="flex items-center gap-1"><IconClock size={12} />{article.estimatedReadingMinutes} min read</span>
            </div>
            <div className="mt-8 article-view-content text-sm text-foreground leading-relaxed"
              dangerouslySetInnerHTML={{ __html: article.contentHtml || "" }} />
            <div className="flex items-center gap-4 mt-8 pt-4 border-t border-border text-xs text-muted">
              <button className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-400 transition-colors">
                <IconHeart size={15} />
                <span className="tabular-nums">{(article as PublishedArticle).likes || 0}</span>
              </button>
              <button className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-primary/5 hover:text-primary transition-colors">
                <IconMessage2 size={15} />
                <span className="tabular-nums">{(article as PublishedArticle).comments || 0}</span>
              </button>
              <button className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-surface hover:text-foreground transition-colors ml-auto">
                <IconBookmark size={15} />
              </button>
              <button className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-surface hover:text-foreground transition-colors">
                <IconShare size={15} />
              </button>
            </div>
          </div>
        </article>
      </div>
    </main>
  );
}
