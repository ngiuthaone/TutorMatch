"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TopNav } from "@/components/discover/top-nav";
import { RequireAuth } from "@/components/auth/require-auth";
import { createThread, isCommunityApiError } from "@/lib/community/threads-api";
import type { AnchorType } from "@/lib/community/threads-api";

const ANCHOR_TYPES: { value: AnchorType; label: string }[] = [
  { value: "course", label: "Course" },
  { value: "event", label: "Event" },
  { value: "workshop", label: "Workshop" },
  { value: "article", label: "Article" },
  { value: "tutor_profile", label: "Tutor" },
  { value: "external_url", label: "External link" },
];

const LEVELS = [
  { value: "", label: "Select level (optional)" },
  { value: "complete_beginner", label: "Complete beginner" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "all_levels", label: "All levels" },
];

function NewThreadForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [anchorType, setAnchorType] = useState<AnchorType>("external_url");
  const [anchorUrl, setAnchorUrl] = useState("");
  const [anchorTitle, setAnchorTitle] = useState("");
  const [level, setLevel] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const tags = tagInput.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 5);

  const canSubmit = title.trim().length > 0 && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await createThread({
        title: title.trim(),
        body: body.trim() || null,
        anchorType,
        anchorUrl: anchorType === "external_url" ? anchorUrl.trim() || null : null,
        anchorTitle: anchorTitle.trim() || null,
        level: level || null,
        tags,
      });
      router.push(`/threads/${result.id}`);
    } catch (err) {
      if (isCommunityApiError(err)) {
        if (err.code === "EMAIL_VERIFICATION_REQUIRED") setError("Please confirm your email before posting.");
        else if (err.code === "INVALID_ANCHOR_URL") setError("Please enter a valid https:// URL.");
        else setError(err.message || "Could not create thread.");
      } else {
        setError("Something went wrong. Please try again.");
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="tutoria-page-shell flex flex-col min-h-[100dvh]">
      <TopNav />
      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
          <Link href="/threads" className="text-xs text-[#6b7280] hover:text-[#9ca3af] mb-4 inline-block">&larr; Back to threads</Link>
          <h1 className="text-xl font-semibold text-[#e7e8ea] mb-6">Start a reference thread</h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="block text-xs font-medium text-[#9ca3af] mb-1.5">Anchor type</label>
              <select value={anchorType} onChange={(e) => setAnchorType(e.target.value as AnchorType)}
                className="w-full rounded-lg border border-[#1f2228] bg-[#0e1014] px-3 py-2 text-sm text-[#e7e8ea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b7280]">
                {ANCHOR_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>

            {anchorType === "external_url" && (
              <>
                <div>
                  <label className="block text-xs font-medium text-[#9ca3af] mb-1.5">URL (https://)</label>
                  <input type="url" value={anchorUrl} onChange={(e) => setAnchorUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full rounded-lg border border-[#1f2228] bg-[#0e1014] px-3 py-2 text-sm text-[#e7e8ea] placeholder-[#4b5563] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b7280]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#9ca3af] mb-1.5">Link title (optional)</label>
                  <input type="text" value={anchorTitle} onChange={(e) => setAnchorTitle(e.target.value)}
                    placeholder="What is this?"
                    className="w-full rounded-lg border border-[#1f2228] bg-[#0e1014] px-3 py-2 text-sm text-[#e7e8ea] placeholder-[#4b5563] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b7280]" />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-[#9ca3af] mb-1.5">Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200}
                placeholder="What do you want to discuss?"
                className="w-full rounded-lg border border-[#1f2228] bg-[#0e1014] px-3 py-2 text-sm text-[#e7e8ea] placeholder-[#4b5563] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b7280]" />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9ca3af] mb-1.5">Prompt / context (optional)</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={2000}
                placeholder="Add context to guide the discussion…"
                className="w-full rounded-lg border border-[#1f2228] bg-[#0e1014] px-3 py-2 text-sm text-[#e7e8ea] placeholder-[#4b5563] resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b7280]" />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-[#9ca3af] mb-1.5">Level</label>
                <select value={level} onChange={(e) => setLevel(e.target.value)}
                  className="w-full rounded-lg border border-[#1f2228] bg-[#0e1014] px-3 py-2 text-sm text-[#e7e8ea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b7280]">
                  {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-[#9ca3af] mb-1.5">Tags (comma-separated, max 5)</label>
                <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                  placeholder="beginner, math"
                  className="w-full rounded-lg border border-[#1f2228] bg-[#0e1014] px-3 py-2 text-sm text-[#e7e8ea] placeholder-[#4b5563] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b7280]" />
              </div>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex items-center gap-3 pt-2">
              <button type="submit" disabled={!canSubmit}
                className="rounded-lg bg-[#e7e8ea] px-5 py-2 text-sm font-medium text-[#0e1014] transition-colors hover:bg-[#d4d5d7] disabled:opacity-50 disabled:cursor-not-allowed">
                {submitting ? "Posting…" : "Post thread"}
              </button>
              <Link href="/threads" className="text-sm text-[#6b7280] hover:text-[#9ca3af]">Cancel</Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export default function NewThreadPage() {
  return (
    <RequireAuth>
      <NewThreadForm />
    </RequireAuth>
  );
}
