"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconArrowLeft, IconAlertCircle, IconLock } from "@tabler/icons-react";
import { createCommunity, type CommunityVisibility, type CommunityJoinPolicy } from "@/lib/community/communities-api";
import { getSessionAccessToken } from "@/lib/auth/session";

export function NewCommunityPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<CommunityVisibility>("public");
  const [joinPolicy, setJoinPolicy] = useState<CommunityJoinPolicy>("open");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!getSessionAccessToken()) {
    return (
      <div className="min-h-[100dvh] bg-[#070b12] text-foreground">
        <div className="mx-auto max-w-[680px] px-4 py-12 text-center">
          <h1 className="text-xl font-semibold mb-2">Sign in to create a community</h1>
          <Link href="/auth/sign-in?next=/communities/new" className="inline-block mt-4 px-5 py-2 rounded-xl bg-primary text-white text-sm font-medium">Sign in</Link>
        </div>
      </div>
    );
  }

  const handleNameChange = (v: string) => {
    setName(v);
    if (!slug || slug === slugify(name)) {
      setSlug(slugify(v));
    }
  };

  const slugify = (v: string) => v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Name is required."); return; }
    if (!slug.trim() || slug.length < 2) { setError("Slug must be at least 2 characters."); return; }

    setSubmitting(true);
    try {
      const result = await createCommunity({ slug, name: name.trim(), description: description.trim() || undefined, visibility, joinPolicy });
      router.push(`/communities/${encodeURIComponent(result.slug)}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create community.";
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#070b12] text-foreground">
      <div className="mx-auto max-w-[680px] px-4 py-6">
        <Link href="/communities" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-4">
          <IconArrowLeft size={14} /> All communities
        </Link>
        <h1 className="text-2xl font-semibold mb-1">Create a community</h1>
        <p className="text-sm text-muted mb-6">A space for your learners, tutors, and topics to discuss.</p>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-sm flex items-start gap-2">
            <IconAlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Name <span className="text-red-400">*</span></label>
              <input type="text" value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="IELTS Study Circle" maxLength={100} className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">URL slug <span className="text-red-400">*</span></label>
              <div className="flex items-center">
                <span className="px-3 py-2 text-sm text-muted border border-r-0 border-border rounded-l-lg bg-border/20">/communities/</span>
                <input type="text" value={slug} onChange={(e) => setSlug(slugify(e.target.value))} maxLength={60} className="flex-1 px-3 py-2 text-sm rounded-r-lg border border-border bg-background focus:outline-none focus:border-primary" />
              </div>
              <p className="text-xs text-muted mt-1">Lowercase letters, numbers, and hyphens only.</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} placeholder="What is this community about?" className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:border-primary resize-none" />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
            <div>
              <label className="block text-sm font-medium mb-2">Visibility</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setVisibility("public")} className={`text-left px-3 py-2.5 rounded-xl border transition-colors ${visibility === "public" ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"}`}>
                  <div className="text-sm font-medium">Public</div>
                  <div className="text-xs text-muted">Anyone can see this community</div>
                </button>
                <button type="button" onClick={() => setVisibility("private")} className={`text-left px-3 py-2.5 rounded-xl border transition-colors flex items-start gap-2 ${visibility === "private" ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"}`}>
                  <IconLock size={14} className="mt-0.5 text-muted" />
                  <div>
                    <div className="text-sm font-medium">Private</div>
                    <div className="text-xs text-muted">Only members can see content</div>
                  </div>
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">How people join</label>
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => setJoinPolicy("open")} className={`text-left px-3 py-2.5 rounded-xl border transition-colors ${joinPolicy === "open" ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"}`}>
                  <div className="text-sm font-medium">Open</div>
                  <div className="text-xs text-muted">Anyone can join</div>
                </button>
                <button type="button" onClick={() => setJoinPolicy("request")} className={`text-left px-3 py-2.5 rounded-xl border transition-colors ${joinPolicy === "request" ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"}`}>
                  <div className="text-sm font-medium">Request</div>
                  <div className="text-xs text-muted">Mods approve</div>
                </button>
                <button type="button" onClick={() => setJoinPolicy("invite")} className={`text-left px-3 py-2.5 rounded-xl border transition-colors ${joinPolicy === "invite" ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"}`}>
                  <div className="text-sm font-medium">Invite</div>
                  <div className="text-xs text-muted">By invite only</div>
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Link href="/communities" className="px-4 py-2 text-sm text-muted hover:text-foreground">Cancel</Link>
            <button type="submit" disabled={submitting} className="px-5 py-2 text-sm font-medium rounded-xl bg-primary text-white hover:bg-primary-dark disabled:opacity-40">
              {submitting ? "Creating…" : "Create community"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
