"use client";

import { useSearchParams, useRouter } from "next/navigation";

const LEVELS = [
  { value: "", label: "All levels" },
  { value: "complete_beginner", label: "Complete beginner" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "all_levels", label: "All levels" },
];

const ANCHOR_TYPES = [
  { value: "", label: "All types" },
  { value: "course", label: "Course" },
  { value: "event", label: "Event" },
  { value: "workshop", label: "Workshop" },
  { value: "article", label: "Article" },
  { value: "tutor_profile", label: "Tutor" },
  { value: "external_url", label: "Link" },
];

export function ThreadFilters() {
  const router = useRouter();
  const sp = useSearchParams();

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("cursor");
    router.push(`/threads?${next.toString()}`);
  };

  return (
    <div className="flex flex-wrap gap-2 mb-5">
      <select
        value={sp.get("level") ?? ""}
        onChange={(e) => update("level", e.target.value)}
        className="rounded-lg border border-[#1f2228] bg-[#0e1014] px-3 py-1.5 text-xs text-[#9ca3af] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b7280]"
        aria-label="Filter by level">
        {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
      </select>
      <select
        value={sp.get("anchorType") ?? ""}
        onChange={(e) => update("anchorType", e.target.value)}
        className="rounded-lg border border-[#1f2228] bg-[#0e1014] px-3 py-1.5 text-xs text-[#9ca3af] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b7280]"
        aria-label="Filter by anchor type">
        {ANCHOR_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
      </select>
    </div>
  );
}
