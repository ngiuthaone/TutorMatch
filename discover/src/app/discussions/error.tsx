"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function DiscussionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Discussions error:", error);
  }, [error]);

  return (
    <div className="min-h-[100dvh] bg-[#070b12] flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border border-border bg-background p-8 text-center">
        <h1 className="text-xl font-semibold text-foreground mb-3">
          Something went wrong
        </h1>
        <p className="text-sm text-muted mb-6">
          The discussions page failed to load. Please try again.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 text-sm font-medium rounded-xl bg-primary text-white hover:bg-primary-dark transition-colors"
          >
            Try again
          </button>
          <Link
            href="/discover"
            className="px-4 py-2 text-sm font-medium rounded-xl border border-border text-muted hover:text-foreground hover:border-primary/30 transition-colors"
          >
            Back to Discover
          </Link>
        </div>
      </div>
    </div>
  );
}
