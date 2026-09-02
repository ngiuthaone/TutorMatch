// discover/src/components/messaging/attachment-view.tsx
//
// Renders a single message attachment: image (with signed-URL fetch on
// mount, error fallback, retry) or generic file (download CTA).
//
// Pattern adapted from ModernChattingWebsite (MIT, 456c7dfa) ChatInput's
// file-preview area + zingle (no license, STUDY_ONLY) LoadMoreMessages'
// error-fallback flow. Re-implemented from public behavior for Tutoria's
// visual language: charcoal/gray, no animations, no emoji, no glassmorphism.

import { useEffect, useState } from "react";
import { getAttachmentSignedUrl } from "@/lib/messaging-api";

export type MessageAttachmentViewProps = {
  storagePath: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  signedUrl?: string | null;
  /** When true, the file already has a public URL (e.g. from a server-side
   *  pre-signed response); skip the client fetch. */
  urlHint?: string | null;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mime: string): boolean {
  return mime.startsWith("image/");
}

export function MessageAttachmentView(props: MessageAttachmentViewProps) {
  const [url, setUrl] = useState<string | null>(props.urlHint ?? props.signedUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (props.urlHint || props.signedUrl) return; // already have it
    let cancelled = false;
    (async () => {
      try {
        const u = await getAttachmentSignedUrl(props.storagePath, 60 * 60 * 24);
        if (cancelled) return;
        if (u) setUrl(u);
        else setError("Could not load file.");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load file.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.storagePath, props.urlHint, props.signedUrl, retryKey]);

  if (error) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded border border-[#3a1f1f] bg-[#1f1112] px-2 py-1.5 text-[11px] text-[#f4a8a8]">
        <span className="truncate">Failed to load: {props.filename}</span>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setRetryKey((n) => n + 1);
          }}
          className="ml-auto rounded border border-[#3a1f1f] px-2 py-0.5 text-[10px] text-[#f4a8a8] hover:text-[#f4f4f2]"
        >
          Retry
        </button>
      </div>
    );
  }

  if (isImage(props.mimeType)) {
    return (
      <a
        href={url ?? "#"}
        target="_blank"
        rel="noreferrer"
        className="mt-2 block max-w-sm overflow-hidden rounded border border-[#1c1d20] bg-[#111114]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url ? (
          <img
            src={url}
            alt={props.filename}
            loading="lazy"
            className="block max-h-80 w-full object-cover"
          />
        ) : (
          <div className="flex h-40 w-full items-center justify-center text-[11px] text-[#7a7a80]">
            Loading image…
          </div>
        )}
      </a>
    );
  }

  return (
    <a
      href={url ?? "#"}
      target="_blank"
      rel="noreferrer"
      className="mt-2 flex items-center gap-2 rounded border border-[#1c1d20] bg-[#111114] px-2 py-1.5 text-[11px] text-[#cfcfd4] hover:bg-[#1c1d20]"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21.44 11.05 14.18 18.94a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
      </svg>
      <span className="truncate">{props.filename}</span>
      <span className="text-[10px] text-[#7a7a80]">{formatBytes(props.sizeBytes)}</span>
      <span className="ml-auto text-[10px] uppercase tracking-wide text-[#9c9ca3]">Download</span>
    </a>
  );
}
