"use client";

import { useState, useCallback } from "react";
import { IconX, IconAlertCircle, IconCheck } from "@tabler/icons-react";
import { reportContent, type ReportTarget } from "@/lib/community/bookmarks-api";
import { reportReferenceContent } from "@/lib/community/threads-api";
import { getSessionAccessToken } from "@/lib/auth/session";

const REASONS = [
  { value: "Spam", label: "Spam" },
  { value: "Harassment", label: "Harassment" },
  { value: "Scam", label: "Scam" },
  { value: "Inappropriate content", label: "Inappropriate content" },
  { value: "Misinformation", label: "Misinformation" },
  { value: "Other", label: "Other" },
] as const;

type ReportType = "post" | "article" | "thread" | "reply";

interface ReportDialogProps {
  targetType: ReportType;
  targetId: string;
  open: boolean;
  onClose: () => void;
}

export function ReportDialog({ targetType, targetId, open, onClose }: ReportDialogProps) {
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!getSessionAccessToken()) {
      onClose();
      return;
    }
    if (!reason) return;

    setSubmitting(true);
    setError(null);
    try {
      const fullReason = details.trim() ? `${reason}: ${details.trim()}` : reason;
      if (targetType === "post") {
        await reportContent("post" as ReportTarget, targetId, fullReason);
      } else if (targetType === "article") {
        await reportContent("article" as ReportTarget, targetId, fullReason);
      } else {
        await reportReferenceContent(targetType as "thread" | "reply", targetId, fullReason);
      }
      setSubmitted(true);
      setTimeout(() => {
        onClose();
        setReason("");
        setDetails("");
        setSubmitted(false);
      }, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit report.");
    } finally {
      setSubmitting(false);
    }
  }, [reason, details, targetType, targetId, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <span className="text-sm font-semibold">Report content</span>
          <button onClick={onClose} className="p-1 rounded-lg text-muted hover:text-foreground hover:bg-surface">
            <IconX size={18} />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center">
            <IconCheck size={32} className="mx-auto text-green-400 mb-3" />
            <p className="text-sm text-foreground">Thanks. We&apos;ve received your report.</p>
          </div>
        ) : (
          <div className="p-5 space-y-3">
            <p className="text-sm text-muted">Why are you reporting this?</p>
            <div className="space-y-1.5">
              {REASONS.map((r) => (
                <label key={r.value} className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-surface">
                  <input
                    type="radio"
                    name="report-reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="accent-primary"
                  />
                  <span className="text-sm">{r.label}</span>
                </label>
              ))}
            </div>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Additional details (optional)"
              rows={2}
              maxLength={500}
              className="w-full mt-2 px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:border-primary resize-none"
            />
            {error && (
              <div className="flex items-center gap-2 text-xs text-red-400">
                <IconAlertCircle size={14} /> {error}
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={onClose} className="px-3 py-1.5 text-xs text-muted hover:text-foreground">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!reason || submitting}
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-40"
              >
                {submitting ? "Submitting…" : "Submit report"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
