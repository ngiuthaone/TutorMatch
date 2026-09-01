"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconArrowLeft, IconExternalLink, IconAlertCircle } from "@tabler/icons-react";
import { createThread, type AnchorType } from "@/lib/community/threads-api";
import { getSessionAccessToken } from "@/lib/auth/session";

const ANCHOR_TYPES: { value: AnchorType; label: string; description: string }[] = [
  { value: "external_url", label: "External URL", description: "Link to a resource outside Tutoria" },
  { value: "course", label: "Course", description: "A Tutoria course" },
  { value: "event", label: "Event", description: "A Tutoria event" },
  { value: "workshop", label: "Workshop", description: "A Tutoria workshop" },
  { value: "article", label: "Article", description: "A Tutoria article" },
  { value: "tutor_profile", label: "Tutor", description: "A tutor's profile" },
];

const LEVELS = [
  { value: "", label: "Any level" },
  { value: "complete_beginner", label: "Complete beginner" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "all_levels", label: "All levels" },
];

export function NewThreadPage() {
  const router = useRouter();
  const [anchorType, setAnchorType] = useState<AnchorType>("external_url");
  const [anchorUrl, setAnchorUrl] = useState("");
  const [anchorTitle, setAnchorTitle] = useState("");
  const [anchorDomain, setAnchorDomain] = useState("");
  const [anchorId, setAnchorId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [level, setLevel] = useState("");
  const [replyPermission, setReplyPermission] = useState<"everyone" | "community_members" | "disabled">("everyone");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAuthed = !!getSessionAccessToken();

  if (!isAuthed) {
    return (
      <div className="min-h-[100dvh] bg-[#070b12] text-foreground">
        <div className="mx-auto max-w-[680px] px-4 py-12 text-center">
          <h1 className="text-xl font-semibold mb-2">Sign in to start a thread</h1>
          <p className="text-sm text-muted mb-4">You need an account to start a reference thread.</p>
          <Link href="/auth/sign-in?next=/threads/new" className="inline-block px-5 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t) && tags.length < 5) {
      setTags([...tags, t]);
      setTagInput("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) { setError("Title is required."); return; }
    if (anchorType === "external_url" && !anchorUrl.trim()) { setError("Anchor URL is required."); return; }
    if (anchorType !== "external_url" && !anchorId.trim()) { setError("Anchor ID is required."); return; }
    if (anchorType === "external_url" && !anchorUrl.match(/^https?:\/\//)) {
      setError("Anchor URL must start with http:// or https://");
      return;
    }

    setSubmitting(true);
    try {
      const result = await createThread({
        title: title.trim(),
        body: body.trim() || undefined,
        anchorType,
        anchorUrl: anchorType === "external_url" ? anchorUrl.trim() : undefined,
        anchorTitle: anchorTitle.trim() || undefined,
        anchorDomain: anchorDomain.trim() || undefined,
        anchorId: anchorType !== "external_url" ? anchorId.trim() : undefined,
        tags: tags.length > 0 ? tags : undefined,
        level: level ? (level as "complete_beginner" | "beginner" | "intermediate" | "advanced" | "all_levels") : undefined,
        replyPermission,
      });
      router.push(`/threads/${result.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create thread.";
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#070b12] text-foreground">
      <div className="mx-auto max-w-[680px] px-4 py-6">
        <Link href="/threads" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-4">
          <IconArrowLeft size={14} /> All threads
        </Link>
        <h1 className="text-2xl font-semibold mb-1">Start a reference thread</h1>
        <p className="text-sm text-muted mb-6">Anchor a conversation to a shared resource.</p>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-sm flex items-start gap-2">
            <IconAlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <label className="block text-sm font-medium mb-2">Anchor type</label>
            <div className="grid grid-cols-2 gap-2">
              {ANCHOR_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setAnchorType(t.value)}
                  className={`text-left px-3 py-2.5 rounded-xl border transition-colors ${anchorType === t.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"}`}
                >
                  <div className="text-sm font-medium">{t.label}</div>
                  <div className="text-xs text-muted">{t.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5">
            {anchorType === "external_url" ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">URL <span className="text-red-400">*</span></label>
                  <input
                    type="url"
                    value={anchorUrl}
                    onChange={(e) => setAnchorUrl(e.target.value)}
                    placeholder="https://example.com/article"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Title</label>
                  <input
                    type="text"
                    value={anchorTitle}
                    onChange={(e) => setAnchorTitle(e.target.value)}
                    placeholder="Article or resource title"
                    maxLength={500}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Domain</label>
                  <input
                    type="text"
                    value={anchorDomain}
                    onChange={(e) => setAnchorDomain(e.target.value)}
                    placeholder="example.com"
                    maxLength={255}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-1">Resource ID <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={anchorId}
                  onChange={(e) => setAnchorId(e.target.value)}
                  placeholder="Paste the resource UUID"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:border-primary"
                />
                <p className="text-xs text-muted mt-1">Paste the UUID of the {anchorType.replace("_", " ")} you want to discuss.</p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5">
            <div>
              <label className="block text-sm font-medium mb-1">Title <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What's this thread about?"
                maxLength={200}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:border-primary"
              />
              <p className="text-xs text-muted mt-1">{title.length}/200</p>
            </div>
            <div className="mt-3">
              <label className="block text-sm font-medium mb-1">Prompt</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Add context or a specific question to spark discussion"
                rows={3}
                maxLength={2000}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:border-primary resize-none"
              />
              <p className="text-xs text-muted mt-1">{body.length}/2000</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5">
            <label className="block text-sm font-medium mb-2">Tags (max 5)</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map(t => (
                <span key={t} className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary flex items-center gap-1">
                  #{t.replaceAll(" ", "")}
                  <button type="button" onClick={() => setTags(tags.filter(x => x !== t))} className="hover:text-red-400">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="Add a tag and press Enter"
                maxLength={50}
                className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-border bg-background focus:outline-none focus:border-primary"
              />
              <button type="button" onClick={addTag} className="px-3 py-1.5 text-sm rounded-lg border border-border hover:border-primary/30">Add</button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Level</label>
                <select value={level} onChange={(e) => setLevel(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:border-primary">
                  {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Replies</label>
                <select value={replyPermission} onChange={(e) => setReplyPermission(e.target.value as typeof replyPermission)} className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:border-primary">
                  <option value="everyone">Everyone</option>
                  <option value="community_members">Community members only</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Link href="/threads" className="px-4 py-2 text-sm text-muted hover:text-foreground">Cancel</Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-medium rounded-xl bg-primary text-white hover:bg-primary-dark disabled:opacity-40"
            >
              {submitting ? "Publishing…" : "Publish thread"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
