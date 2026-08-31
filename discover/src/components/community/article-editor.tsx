"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TopNav } from "@/components/discover/top-nav";
import { ArticleRichText } from "@/components/article-editor/article-rich-text";
import { getSessionAccessToken } from "@/lib/auth/session";
import {
  createArticleDraft, updateArticleDraft, publishArticle, getMyArticle,
  isCommunityApiError,
} from "@/lib/community/articles-api";

interface ArticleEditorPageProps {
  articleId?: string;
}

export function ArticleEditorPage({ articleId }: ArticleEditorPageProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [coverImageAlt, setCoverImageAlt] = useState("");
  const [content, setContent] = useState<Record<string, unknown>>({ type: "doc", content: [{ type: "paragraph", content: [] }] });
  const [contentHtml, setContentHtml] = useState("");
  const [tags, setTags] = useState("");
  const [level, setLevel] = useState("");
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [estimatedReadingMinutes, setEstimatedReadingMinutes] = useState(1);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(articleId));
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    if (!articleId) {
      hydrated.current = true;
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = getSessionAccessToken();
        if (!token) return;
        const article = await getMyArticle(articleId);
        if (cancelled || !article) return;
        setTitle(article.title ?? "");
        setSubtitle(article.subtitle ?? "");
        setExcerpt(article.excerpt ?? "");
        setCoverImageUrl(article.cover_image_url ?? "");
        setCoverImageAlt(article.cover_image_alt ?? "");
        setContent(article.content_json ?? { type: "doc", content: [{ type: "paragraph", content: [] }] });
        setContentHtml(article.content_html ?? "");
        setTags((article.tags ?? []).join(", "));
        setLevel(article.level ?? "");
        setCommentsEnabled(article.comments_enabled ?? true);
        setEstimatedReadingMinutes(article.estimated_reading_minutes ?? 1);
        setDraftId(article.id);
        setStatus((article.status as "draft" | "published") ?? "draft");
        hydrated.current = true;
        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [articleId]);

  const tagsArray = tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10);

  const autosave = useCallback(async () => {
    const hasContent = title.trim().length > 0 || contentHtml.replace(/<[^>]*>/g, "").trim().length > 0;
    if (!hasContent) return;
    setSaving(true);
    try {
      const input = {
        title: title.trim() || "Untitled",
        subtitle: subtitle.trim() || null,
        excerpt: excerpt.trim() || null,
        coverImageUrl: coverImageUrl.trim() || null,
        coverImageAlt: coverImageAlt.trim() || null,
        contentHtml,
        contentJson: content,
        tags: tagsArray,
        level: level || null,
        estimatedReadingMinutes,
        commentsEnabled,
      };
      if (draftId && status === "draft") {
        await updateArticleDraft(draftId, input);
      } else if (!draftId) {
        const result = await createArticleDraft(input);
        setDraftId(result.id);
        setStatus("draft");
      }
    } catch {
      // autosave failure is non-fatal
    } finally {
      setSaving(false);
    }
  }, [title, subtitle, excerpt, coverImageUrl, coverImageAlt, contentHtml, content, tagsArray, level, estimatedReadingMinutes, commentsEnabled, draftId, status]);

  useEffect(() => {
    if (!hydrated.current && articleId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(autosave, 1500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [autosave, articleId]);

  const handleContentChange = useCallback((json: Record<string, unknown>, html: string) => {
    setContent(json);
    setContentHtml(html);
    const text = html.replace(/<[^>]*>/g, "");
    setEstimatedReadingMinutes(Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 200)));
  }, []);

  const handlePublish = async () => {
    if (publishing) return;
    setError(null);
    if (title.trim().length === 0 || contentHtml.replace(/<[^>]*>/g, "").trim().length === 0) {
      setError("Add a title and some content before publishing.");
      return;
    }
    setPublishing(true);
    try {
      let id = draftId;
      if (!id) {
        const created = await createArticleDraft({
          title: title.trim(),
          subtitle: subtitle.trim() || null,
          excerpt: excerpt.trim() || null,
          coverImageUrl: coverImageUrl.trim() || null,
          coverImageAlt: coverImageAlt.trim() || null,
          contentHtml,
          contentJson: content,
          tags: tagsArray,
          level: level || null,
          estimatedReadingMinutes,
          commentsEnabled,
        });
        id = created.id;
        setDraftId(id);
      } else if (status === "draft") {
        await updateArticleDraft(id, {
          title: title.trim(),
          subtitle: subtitle.trim() || null,
          excerpt: excerpt.trim() || null,
          coverImageUrl: coverImageUrl.trim() || null,
          coverImageAlt: coverImageAlt.trim() || null,
          contentHtml,
          contentJson: content,
          tags: tagsArray,
          level: level || null,
          estimatedReadingMinutes,
          commentsEnabled,
        });
      }
      const result = await publishArticle(id);
      router.push(`/articles/${result.slug}`);
    } catch (err) {
      if (isCommunityApiError(err)) {
        if (err.code === "EMAIL_VERIFICATION_REQUIRED") setError("Please confirm your email before publishing.");
        else if (err.code === "NOT_DRAFT") setError("This article has already been published.");
        else setError(err.message || "Could not publish article.");
      } else {
        setError("Something went wrong. Please try again.");
      }
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="tutoria-page-shell flex flex-col min-h-[100dvh]">
        <TopNav />
        <main className="flex-1 grid place-items-center"><p className="text-sm text-[#9ca3af]">Loading editor…</p></main>
      </div>
    );
  }

  return (
    <div className="tutoria-page-shell flex flex-col min-h-[100dvh]">
      <TopNav />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
          <div className="flex items-center justify-between mb-5">
            <Link href="/threads" className="text-xs text-[#6b7280] hover:text-[#9ca3af]">&larr; Back</Link>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#6b7280]">{saving ? "Saving…" : draftId ? "Saved" : ""}</span>
              <span className="text-xs text-[#6b7280]">{estimatedReadingMinutes} min read</span>
              <button type="button" onClick={handlePublish} disabled={publishing}
                className="rounded-lg bg-[#e7e8ea] px-4 py-1.5 text-sm font-medium text-[#0e1014] transition-colors hover:bg-[#d4d5d7] disabled:opacity-50 disabled:cursor-not-allowed">
                {publishing ? "Publishing…" : "Publish"}
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

          {coverImageUrl && (
            <div className="relative mb-5 rounded-2xl overflow-hidden border border-[#1f2228]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverImageUrl} alt={coverImageAlt || "Cover"} className="w-full h-48 sm:h-64 object-cover" />
              <button type="button" onClick={() => { setCoverImageUrl(""); setCoverImageAlt(""); }}
                className="absolute top-2 right-2 rounded-lg bg-[#0e1014]/80 px-2 py-1 text-xs text-[#e7e8ea]">Remove</button>
            </div>
          )}

          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200}
            placeholder="Article title"
            className="w-full bg-transparent text-2xl sm:text-3xl font-semibold text-[#e7e8ea] placeholder-[#4b5563] border-none outline-none mb-2" />
          <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} maxLength={500}
            placeholder="Subtitle (optional)"
            className="w-full bg-transparent text-base text-[#9ca3af] placeholder-[#4b5563] border-none outline-none border-b border-[#1f2228] pb-3 mb-3" />
          <input type="text" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} maxLength={500}
            placeholder="Short excerpt (optional)"
            className="w-full bg-transparent text-sm text-[#6b7280] placeholder-[#4b5563] border-none outline-none mb-4" />

          <div className="flex flex-wrap gap-3 mb-5">
            <div>
              <label className="block text-xs text-[#6b7280] mb-1">Cover image URL (https://)</label>
              <input type="url" value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)}
                placeholder="https://…"
                className="w-64 max-w-full rounded-lg border border-[#1f2228] bg-[#0e1014] px-3 py-1.5 text-xs text-[#e7e8ea] placeholder-[#4b5563] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b7280]" />
            </div>
            <div>
              <label className="block text-xs text-[#6b7280] mb-1">Cover alt text</label>
              <input type="text" value={coverImageAlt} onChange={(e) => setCoverImageAlt(e.target.value)} maxLength={300}
                placeholder="Describe the cover image"
                className="w-64 max-w-full rounded-lg border border-[#1f2228] bg-[#0e1014] px-3 py-1.5 text-xs text-[#e7e8ea] placeholder-[#4b5563] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b7280]" />
            </div>
            <div>
              <label className="block text-xs text-[#6b7280] mb-1">Level</label>
              <select value={level} onChange={(e) => setLevel(e.target.value)}
                className="rounded-lg border border-[#1f2228] bg-[#0e1014] px-3 py-1.5 text-xs text-[#e7e8ea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b7280]">
                <option value="">Any</option>
                <option value="complete_beginner">Complete beginner</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="all_levels">All levels</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#6b7280] mb-1">Tags (comma-separated)</label>
              <input type="text" value={tags} onChange={(e) => setTags(e.target.value)}
                placeholder="react, typescript"
                className="w-64 max-w-full rounded-lg border border-[#1f2228] bg-[#0e1014] px-3 py-1.5 text-xs text-[#e7e8ea] placeholder-[#4b5563] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b7280]" />
            </div>
            <div className="flex items-end gap-2 pb-1">
              <label className="flex items-center gap-1.5 text-xs text-[#9ca3af]">
                <input type="checkbox" checked={commentsEnabled} onChange={(e) => setCommentsEnabled(e.target.checked)}
                  className="rounded border-[#1f2228]" />
                Comments
              </label>
            </div>
          </div>

          <ArticleRichText content={content} onChange={handleContentChange} />
        </div>
      </main>
    </div>
  );
}
