"use client";

import { useState, useCallback, useEffect } from "react";
import { IconArrowLeft, IconEye, IconSend, IconDeviceFloppy, IconX, IconChevronDown, IconPhoto, IconClock, IconCheck } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { ArticleRichText } from "./article-rich-text";
import { generateId, getUserFromStorage, estimateReadingTime, TOPICS, SKILLS, COMMUNITIES } from "@/lib/types";
import type { ArticleDraft, ContentVisibility, ContentLevel } from "@/lib/types";
import { saveArticleDraft, getArticleDrafts, publishArticle } from "@/lib/storage";

export function ArticleEditorPage({ articleId }: { articleId?: string }) {
  const router = useRouter();
  const user = getUserFromStorage();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [content, setContent] = useState<Record<string, unknown>>({
    type: "doc",
    content: [{ type: "paragraph", content: [] }],
  });
  const [contentHtml, setContentHtml] = useState("");
  const [visibility, setVisibility] = useState<ContentVisibility>("public");
  const [communityId, setCommunityId] = useState("");
  const [topicName, setTopicName] = useState("");
  const [skillNames, setSkillNames] = useState<string[]>([]);
  const [level, setLevel] = useState<ContentLevel | undefined>();
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [showPublishPanel, setShowPublishPanel] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [excerpt, setExcerpt] = useState("");
  const [draftId] = useState(() => articleId || generateId());
  const [showTopic, setShowTopic] = useState(false);
  const [showLevel, setShowLevel] = useState(false);
  const [showAudience, setShowAudience] = useState(false);
  const [skillSearch, setSkillSearch] = useState("");
  const [showSkills, setShowSkills] = useState(false);

  const readingTime = estimateReadingTime(
    contentHtml?.replace(/<[^>]*>/g, "") || ""
  );

  useEffect(() => {
    if (articleId) {
      const drafts = getArticleDrafts();
      const existing = drafts.find((d) => d.id === articleId);
      if (existing) {
        setTitle(existing.title);
        setSubtitle(existing.subtitle || "");
        setCoverImage(existing.coverImage?.url || null);
        setContent(existing.content || { type: "doc", content: [] });
        setContentHtml(existing.contentHtml || "");
        setVisibility(existing.visibility);
        setCommunityId(existing.communityId || "");
        setTopicName(existing.topicName || "");
        setSkillNames(existing.skillNames || []);
        setLevel(existing.level);
        setCommentsEnabled(existing.commentsEnabled);
        setExcerpt(existing.excerpt || "");
      }
    }
  }, [articleId]);

  useEffect(() => {
    const hasRealContent = title.trim().length > 0 || (contentHtml?.replace(/<[^>]*>/g, "") || "").trim().length > 0;
    if (!hasRealContent) return;
    const timer = setTimeout(() => {
      setSaving(true);
      saveArticleDraft({
        id: draftId,
        title,
        subtitle: subtitle || undefined,
        excerpt: excerpt || undefined,
        coverImage: coverImage ? { id: "cover", type: "image", url: coverImage, sortOrder: 0, uploadStatus: "complete" } : undefined,
        content,
        contentHtml,
        visibility,
        communityId: communityId || undefined,
        communityName: COMMUNITIES.find((c) => c.id === communityId)?.name,
        topicName: topicName || undefined,
        skillNames,
        level,
        commentsEnabled,
        estimatedReadingMinutes: readingTime,
        status: "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        skillIds: [],
      });
      setTimeout(() => setSaving(false), 300);
    }, 1500);
    return () => clearTimeout(timer);
  }, [title, subtitle, excerpt, coverImage, content, contentHtml, visibility, communityId, topicName, skillNames, level, commentsEnabled, readingTime, draftId]);

  const handleContentChange = useCallback((json: Record<string, unknown>, html: string) => {
    setContent(json);
    setContentHtml(html);
  }, []);

  const handleCoverUpload = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => setCoverImage(e.target?.result as string);
      reader.readAsDataURL(file);
    };
    input.click();
  }, []);

  const handlePublish = useCallback(() => {
    if (!title.trim()) return;
    const bodyText = contentHtml?.replace(/<[^>]*>/g, "") || "";
    if (!bodyText.trim()) return;
    if (visibility === "community" && !communityId) return;
    setPublishing(true);
    const draft: ArticleDraft = {
      id: draftId,
      title: title.trim(),
      subtitle: subtitle.trim() || undefined,
      excerpt: excerpt.trim() || undefined,
      coverImage: coverImage ? { id: "cover", type: "image", url: coverImage, sortOrder: 0, uploadStatus: "complete" } : undefined,
      content,
      contentHtml,
      visibility,
      communityId: communityId || undefined,
      communityName: COMMUNITIES.find((c) => c.id === communityId)?.name,
      topicName: topicName || undefined,
      skillNames,
      level,
      commentsEnabled,
      estimatedReadingMinutes: readingTime,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      skillIds: [],
    };
    const published = publishArticle(draft);
    setTimeout(() => {
      setPublishing(false);
      router.push(`/articles/${published.id}`);
    }, 400);
  }, [title, subtitle, excerpt, coverImage, content, contentHtml, visibility, communityId, topicName, skillNames, level, commentsEnabled, readingTime, draftId, router]);

  const handleSaveDraft = useCallback(() => {
    saveArticleDraft({
      id: draftId,
      title,
      subtitle: subtitle || undefined,
      excerpt: excerpt || undefined,
      coverImage: coverImage ? { id: "cover", type: "image", url: coverImage, sortOrder: 0, uploadStatus: "complete" } : undefined,
      content,
      contentHtml,
      visibility,
      communityId: communityId || undefined,
      communityName: COMMUNITIES.find((c) => c.id === communityId)?.name,
      topicName: topicName || undefined,
      skillNames,
      level,
      commentsEnabled,
      estimatedReadingMinutes: readingTime,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      skillIds: [],
    });
    setSaving(true);
    setTimeout(() => setSaving(false), 300);
  }, [title, subtitle, excerpt, coverImage, content, contentHtml, visibility, communityId, topicName, skillNames, level, commentsEnabled, readingTime, draftId]);

  const toggleSkill = useCallback((skill: string) => {
    setSkillNames((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : prev.length < 5 ? [...prev, skill] : prev
    );
  }, []);

  const canPublish = title.trim().length > 0 && (contentHtml?.replace(/<[^>]*>/g, "") || "").trim().length > 0;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="max-w-[760px] mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push("/discussions")}
                className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors" aria-label="Back">
                <IconArrowLeft size={20} />
              </button>
              <span className="text-sm font-semibold text-foreground">
                {articleId ? "Edit article" : "New article"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[11px] text-muted">
                <IconClock size={12} /> {readingTime} min read
              </span>
              {saving && <span className="text-[11px] text-muted">Saving\u2026</span>}
              <button onClick={handleSaveDraft}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-muted hover:text-foreground hover:bg-surface transition-colors">
                <IconDeviceFloppy size={13} /> Save
              </button>
              {!showPublishPanel && (
                <button onClick={() => router.push(`/articles/${draftId}/preview`)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-muted hover:text-foreground hover:bg-surface transition-colors">
                  <IconEye size={13} /> Preview
                </button>
              )}
              <button onClick={() => setShowPublishPanel((v) => !v)}
                className="flex items-center gap-1 px-4 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary-dark transition-colors">
                <IconSend size={13} /> Publish
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        <main className="flex-1 max-w-[760px] mx-auto w-full px-4 pt-8 pb-24">
          {!coverImage && (
            <button onClick={handleCoverUpload}
              className="w-full aspect-[16/9] rounded-2xl border-2 border-dashed border-border bg-surface hover:border-primary/30 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-2 mb-6">
              <IconPhoto size={28} className="text-muted/60" />
              <span className="text-sm text-muted">Add cover image</span>
            </button>
          )}

          {coverImage && (
            <div className="relative aspect-[16/9] rounded-2xl overflow-hidden bg-surface mb-6 group">
              <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                  <button onClick={handleCoverUpload}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/90 text-foreground hover:bg-white transition-colors">Replace</button>
                  <button onClick={() => setCoverImage(null)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/90 text-red-500 hover:bg-white transition-colors">Remove</button>
                </div>
              </div>
            </div>
          )}

          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Article title"
            className="w-full text-2xl md:text-3xl font-semibold tracking-tight text-foreground bg-transparent placeholder:text-muted/30 focus:outline-none mb-2" />
          {title.length > 200 && (
            <p className="text-[11px] text-muted text-right -mt-1 mb-2">{300 - title.length} characters remaining</p>
          )}

          <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Write a subtitle or short introduction\u2026"
            className="w-full text-sm text-muted bg-transparent placeholder:text-muted/30 focus:outline-none mb-6 pb-4 border-b border-border" />

          {excerpt && (
            <input type="text" value={excerpt} onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Excerpt for feed cards (optional)"
              className="w-full text-xs text-muted bg-transparent placeholder:text-muted/30 focus:outline-none mb-4" />
          )}

          <ArticleRichText content={content} onChange={handleContentChange} />
        </main>

        {showPublishPanel && (
          <aside className="w-80 border-l border-border bg-background p-5 overflow-y-auto hidden lg:block">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-foreground">Publish article</h2>
              <button onClick={() => setShowPublishPanel(false)}
                className="p-1 rounded text-muted hover:text-foreground transition-colors">
                <IconX size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-foreground mb-2">Preview</p>
                <div className="rounded-xl border border-border overflow-hidden bg-surface">
                  {coverImage && (
                    <div className="aspect-[16/9] bg-border">
                      <img src={coverImage} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                      {topicName || "Article"} \u00B7 {readingTime} min read
                    </p>
                    <p className="text-xs font-semibold text-foreground mt-1 line-clamp-2">{title || "Untitled"}</p>
                    <p className="text-[11px] text-muted mt-1 line-clamp-1">{subtitle || excerpt || "No description"}</p>
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-muted">
                      <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[7px] font-bold text-primary">
                        {user?.name?.charAt(0) || "Y"}
                      </div>
                      <span>{user?.name || "You"}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-foreground mb-1.5">Topic</p>
                <div className="relative">
                  <button onClick={() => setShowTopic((v) => !v)}
                    className="w-full text-left px-3 py-2 text-xs rounded-lg border border-border text-foreground hover:bg-surface transition-colors">
                    {topicName || "Select topic\u2026"}
                  </button>
                  {showTopic && (
                    <div className="absolute left-0 top-full mt-1 w-full max-h-40 overflow-y-auto rounded-xl border border-border bg-background shadow-lg p-1 z-10">
                      {TOPICS.map((t) => (
                        <button key={t} onClick={() => { setTopicName(t === topicName ? "" : t); setShowTopic(false); }}
                          className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors ${t === topicName ? "bg-primary/10 text-primary-dark dark:text-primary-light font-medium" : "text-foreground hover:bg-surface"}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-foreground mb-1.5">Skills (up to 5)</p>
                <div className="relative">
                  <input type="text" value={skillSearch} onChange={(e) => { setSkillSearch(e.target.value); setShowSkills(true); }}
                    onFocus={() => setShowSkills(true)} placeholder="Search\u2026"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted/60 focus:outline-none focus:border-primary/40" />
                  {showSkills && (
                    <div className="absolute left-0 top-full mt-1 w-full max-h-40 overflow-y-auto rounded-xl border border-border bg-background shadow-lg p-1 z-10">
                      {SKILLS.filter((s) => s.toLowerCase().includes(skillSearch.toLowerCase())).map((s) => (
                        <button key={s} onClick={() => { toggleSkill(s); setShowSkills(false); }}
                          className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors ${skillNames.includes(s) ? "bg-primary/10 text-primary-dark dark:text-primary-light font-medium" : "text-foreground hover:bg-surface"}`}>
                          {skillNames.includes(s) ? "\u2713 " : ""}{s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {skillNames.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {skillNames.map((s) => (
                      <span key={s} onClick={() => toggleSkill(s)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md bg-primary/10 text-primary-dark dark:text-primary-light cursor-pointer">
                        {s} <IconX size={10} />
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-medium text-foreground mb-1.5">Level</p>
                <div className="relative">
                  <button onClick={() => setShowLevel((v) => !v)}
                    className="w-full text-left px-3 py-2 text-xs rounded-lg border border-border text-foreground hover:bg-surface transition-colors">
                    {level ? level.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Select level\u2026"}
                  </button>
                  {showLevel && (
                    <div className="absolute left-0 top-full mt-1 w-full rounded-xl border border-border bg-background shadow-lg p-1 z-10">
                      {(["complete_beginner", "beginner", "intermediate", "advanced", "all_levels"] as ContentLevel[]).map((l) => (
                        <button key={l} onClick={() => { setLevel(level === l ? undefined : l); setShowLevel(false); }}
                          className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors ${l === level ? "bg-primary/10 text-primary-dark dark:text-primary-light font-medium" : "text-foreground hover:bg-surface"}`}>
                          {l.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-foreground mb-1.5">Visibility</p>
                <div className="relative">
                  <button onClick={() => setShowAudience((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg border border-border text-foreground hover:bg-surface transition-colors">
                    {visibility === "community" && communityId
                      ? COMMUNITIES.find((c) => c.id === communityId)?.name || "Community"
                      : "Everyone"}
                    <IconChevronDown size={12} />
                  </button>
                  {showAudience && (
                    <div className="absolute left-0 top-full mt-1 w-full rounded-xl border border-border bg-background shadow-lg p-1 z-10">
                      <button onClick={() => { setVisibility("public"); setCommunityId(""); setShowAudience(false); }}
                        className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors ${visibility === "public" ? "bg-primary/10 text-primary-dark dark:text-primary-light font-medium" : "text-foreground hover:bg-surface"}`}>
                        Everyone
                      </button>
                      {COMMUNITIES.filter((c) => c.canPost).map((c) => (
                        <button key={c.id} onClick={() => { setVisibility("community"); setCommunityId(c.id); setShowAudience(false); }}
                          className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors ${visibility === "community" && communityId === c.id ? "bg-primary/10 text-primary-dark dark:text-primary-light font-medium" : "text-foreground hover:bg-surface"}`}>
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground">Allow comments</span>
                <button onClick={() => setCommentsEnabled((v) => !v)}
                  className={`w-9 h-5 rounded-full transition-colors relative ${commentsEnabled ? "bg-primary" : "bg-border"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${commentsEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
              </div>

              <div className="pt-4 border-t border-border space-y-2">
                <button onClick={handleSaveDraft}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border border-border text-foreground hover:bg-surface transition-colors">
                  <IconDeviceFloppy size={15} /> Save draft
                </button>
                <button onClick={handlePublish} disabled={!canPublish || publishing}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  {publishing ? "Publishing\u2026" : <><IconSend size={15} /> Publish article</>}
                </button>
                {!canPublish && (
                  <p className="text-[11px] text-muted text-center">Add a title and content to publish.</p>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>

      {showPublishPanel && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowPublishPanel(false)}>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          <div onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md max-h-[80vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border bg-background shadow-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">Publish article</h2>
              <button onClick={() => setShowPublishPanel(false)}
                className="p-1 rounded text-muted hover:text-foreground transition-colors">
                <IconX size={16} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-foreground mb-1.5">Topic</p>
                <select value={topicName} onChange={(e) => setTopicName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground">
                  <option value="">Select topic</option>
                  {TOPICS.map((t) => (<option key={t} value={t}>{t}</option>))}
                </select>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground mb-1.5">Visibility</p>
                <select value={visibility === "community" ? communityId : "public"} onChange={(e) => {
                  if (e.target.value === "public") { setVisibility("public"); setCommunityId(""); }
                  else { setVisibility("community"); setCommunityId(e.target.value); }
                }}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground">
                  <option value="public">Everyone</option>
                  {COMMUNITIES.filter((c) => c.canPost).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground">Allow comments</span>
                <button onClick={() => setCommentsEnabled((v) => !v)}
                  className={`w-9 h-5 rounded-full transition-colors relative ${commentsEnabled ? "bg-primary" : "bg-border"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${commentsEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
              </div>
              <div className="pt-2 space-y-2">
                <button onClick={handlePublish} disabled={!canPublish || publishing}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-40">
                  {publishing ? "Publishing\u2026" : "Publish article"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPublishPanel && (
        <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-background border-t border-border p-4">
          <button onClick={handlePublish} disabled={!canPublish || publishing}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium rounded-xl bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-40">
            {publishing ? "Publishing\u2026" : "Publish article"}
          </button>
        </div>
      )}
    </div>
  );
}
