"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

type Submission = {
  id: string;
  userId: string;
  tutorProfileId: string | null;
  kind: string;
  bucket: string;
  objectPath: string;
  mime: string;
  sizeBytes: number;
  status: string;
  moderationProvider: string | null;
  moderationNote: string | null;
  createdAt: string;
  updatedAt: string;
};

const STATUSES = ["pending", "approved", "rejected", "removed", "all"] as const;

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / 1024 / 1024).toFixed(2)} MiB`;
}

function formatDate(iso: string) {
  try { return new Date(iso).toISOString().replace("T", " ").slice(0, 19) + "Z"; } catch { return iso; }
}

export default function ModerationQueue({ initialStatus, adminEmail }: { initialStatus: string; adminEmail: string | null }) {
  const [status, setStatus] = useState<string>(initialStatus);
  const [submissions, setSubmissions] = useState<Submission[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const reload = useCallback(async (s: string) => {
    setError(null);
    const res = await fetch(`/api/admin/moderation/media?status=${encodeURIComponent(s)}&limit=100`, { cache: "no-store" });
    const body = await res.json().catch(() => ({ ok: false }));
    if (!res.ok || !body.ok) {
      setError(body?.error?.code ?? `HTTP_${res.status}`);
      setSubmissions([]);
      return;
    }
    setSubmissions((body.submissions ?? []) as Submission[]);
  }, []);

  useEffect(() => { void reload(status); }, [reload, status]);

  const decide = useCallback(async (id: string, decision: "approved" | "rejected" | "removed") => {
    setPendingId(id);
    const note = decision === "rejected" || decision === "removed" ? window.prompt(`Optional note for ${decision}:`) ?? "" : "";
    try {
      const res = await fetch(`/api/admin/moderation/media/${encodeURIComponent(id)}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: note || undefined }),
      });
      const body = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !body.ok) {
        setError(body?.error?.code ?? `HTTP_${res.status}`);
        return;
      }
      startTransition(() => {
        setSubmissions((prev) => (prev ?? []).filter((row) => row.id !== id));
      });
    } finally {
      setPendingId(null);
    }
  }, []);

  return (
    <main className="min-h-[100dvh] bg-[#101011] px-5 py-12 text-[#e8e6df] sm:px-10">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-white/40">Admin</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Media moderation queue</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-white/55">
          Signed in as {adminEmail ?? "unknown"}. Decide on each submission — approve, reject, or remove. All
          actions are audited.
        </p>
        <nav className="mt-8 flex flex-wrap items-center gap-2 text-sm" aria-label="Status filter">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-full border px-3 py-1 ${s === status ? "border-white/70 bg-white text-[#101011]" : "border-white/15 bg-transparent text-white/70 hover:border-white/40"}`}
            >
              {s}
            </button>
          ))}
          <button type="button" onClick={() => void reload(status)} className="ml-auto rounded-full border border-white/15 px-3 py-1 text-white/70 hover:border-white/40">
            Refresh
          </button>
        </nav>
        {error ? (
          <p role="alert" className="mt-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            Could not load moderation queue: {error}
          </p>
        ) : null}
        {submissions === null ? (
          <p className="mt-8 text-sm text-white/55">Loading…</p>
        ) : submissions.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-white/10 bg-white/[.03] p-6 text-sm text-white/55">No submissions match this filter.</p>
        ) : (
          <ul className="mt-8 divide-y divide-white/10 rounded-3xl border border-white/10 bg-white/[.02]">
            {submissions.map((row) => (
              <li key={row.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1 text-sm">
                  <div className="font-mono text-xs text-white/40">{row.id}</div>
                  <div>
                    <strong className="font-medium">{row.kind}</strong> · {row.bucket}/{row.objectPath}
                  </div>
                  <div className="text-white/65">
                    {row.mime} · {formatBytes(row.sizeBytes)} · status <code className="text-white/80">{row.status}</code>
                  </div>
                  <div className="text-xs text-white/45">
                    Created {formatDate(row.createdAt)} · Tutor profile: {row.tutorProfileId ?? "(unlinked)"}
                  </div>
                  {row.moderationNote ? <div className="text-xs text-white/55">Note: {row.moderationNote}</div> : null}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pendingId === row.id}
                    onClick={() => void decide(row.id, "approved")}
                    className="rounded-full border border-emerald-400/60 px-3 py-1 text-xs font-medium text-emerald-200 hover:bg-emerald-400/10 disabled:opacity-40"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={pendingId === row.id}
                    onClick={() => void decide(row.id, "rejected")}
                    className="rounded-full border border-amber-400/60 px-3 py-1 text-xs font-medium text-amber-200 hover:bg-amber-400/10 disabled:opacity-40"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={pendingId === row.id}
                    onClick={() => void decide(row.id, "removed")}
                    className="rounded-full border border-red-400/60 px-3 py-1 text-xs font-medium text-red-200 hover:bg-red-400/10 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
