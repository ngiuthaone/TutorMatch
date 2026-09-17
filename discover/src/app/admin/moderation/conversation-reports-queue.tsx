"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

type Report = {
  id: string;
  reporterId: string;
  conversationId: string;
  messageId: string | null;
  reason: string;
  details: string | null;
  status: "pending" | "resolved" | "dismissed";
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  reporter: { id: string; name: string } | null;
  messagePreview: { id: string; body: string; createdAt: string } | null;
};

const STATUSES = ["pending", "resolved", "dismissed", "all"] as const;

function formatDate(iso: string) {
  try {
    return new Date(iso).toISOString().replace("T", " ").slice(0, 19) + "Z";
  } catch {
    return iso;
  }
}

export default function ConversationReportsQueue({ initialStatus }: { initialStatus: string }) {
  const [status, setStatus] = useState(initialStatus);
  const [reports, setReports] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const reload = useCallback(async (status: string) => {
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/admin/moderation/reports?status=${encodeURIComponent(status)}&limit=100`,
        { cache: "no-store" }
      );
      const body = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !body.ok) {
        setError(body?.error?.code ?? `HTTP_${res.status}`);
        setReports([]);
        return;
      }
      setReports(body.reports ?? []);
    } catch (err) {
      setError(String(err));
    }
  }, []);

  useEffect(() => {
    void reload(status);
  }, [status]);

  const decide = useCallback(async (id: string, decision: "resolved" | "dismissed") => {
    setPendingId(id);
    const note = decision === "dismissed" ? window.prompt(`Optional note for dismissal:`) ?? "" : "";
    try {
      const res = await fetch(
        `/api/v1/admin/moderation/reports/${encodeURIComponent(id)}/resolve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: decision, details: note || undefined }),
        });
      const body = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !body.ok) {
        setError(body?.error?.code ?? `HTTP_${res.status}`);
        return;
      }
      startTransition(() => {
        setReports((current) => (current ?? []).filter((row) => row.id !== id));
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setPendingId(null);
    }
  }, []);

  const showError = error ? (
    <p role="alert" className="mt-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
      Could not load moderation queue: {error}
    </p>
  ) : null;

  if (reports === null) {
    return (
      <div className="grid h-full place-items-center" aria-busy="true">
        <p className="text-sm text-[#9c9ca3]">Loading conversations…</p>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <p className="text-sm text-[#a8a8b0]">No reports found.</p>
      </div>
    );
  }

  return (
    <section aria-label="Conversation reports queue">
      {showError}
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <p className="text-xs uppercase tracking-wide text-[#7a7a80]">Conversation reports</p>
        <nav className="flex items-center justify-between gap-2 text-sm" aria-label="Status filter">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-full border px-3 py-1 ${status === s ? "border-white/70 bg-white text-[#101011]" : "border-white/15 bg-transparent text-white/70 hover:border-white/40"}`}
            >
              {s}
            </button>
          ))}
        </nav>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {reports.map((r) => (
          <article key={r.id} className="border-b border-white/10 px-4 py-3">
            <header className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`text-xs uppercase tracking-wide ${r.status === "pending" ? "text-[#f4a8a8]" : r.status === "resolved" ? "text-[#a8d4a8]" : "text-[#7a7a80]"}`}>
                  {r.status}
                </span>
                <span className="text-xs text-white/40">{formatDate(r.createdAt)}</span>
              </div>
              <span className="text-xs text-white/40">{r.reporter?.name ?? "Unknown"}</span>
            </header>
            <div className="mt-2 text-sm text-white/80">
              <p className="font-medium">{r.reason}</p>
              {r.details ? <p className="text-white/55 text-sm mt-1">{r.details}</p> : null}
            </div>
            <div className="mt-2 flex items-center gap-2">
              {r.messagePreview ? (
                <blockquote className="text-sm text-white/60 border-l-2 border-white/10 pl-2">
                  {r.messagePreview.body}
                </blockquote>
              ) : null}
              <div className="ml-auto flex gap-2">
                {r.status === "pending" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => decide(r.id, "resolved")}
                      disabled={pendingId === r.id}
                      className="rounded-full border border-emerald-400/60 px-3 py-1 text-xs font-medium text-emerald-200 hover:bg-emerald-400/10 disabled:opacity-40"
                    >
                      Resolve
                    </button>
                    <button
                      type="button"
                      onClick={() => decide(r.id, "dismissed")}
                      disabled={pendingId === r.id}
                      className="rounded-full border border-amber-400/60 px-3 py-1 text-xs font-medium text-amber-200 hover:bg-amber-400/10 disabled:opacity-40"
                    >
                      Dismiss
                    </button>
                  </>
                ) : (
                  <span className={`text-xs uppercase tracking-wide ${r.status === "resolved" ? "text-[#a8d4a8]" : "text-[#7a7a80]"}`}>
                    {r.status}
                  </span>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}