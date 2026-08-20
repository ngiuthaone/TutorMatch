"use client";

import { IconLoader2 } from "@tabler/icons-react";

interface BookingCTAProps {
  onClick: () => void;
  loading: boolean;
  error?: string | null;
  disabled: boolean;
  label?: string;
  mobileLabel?: string;
}

export function BookingCTA({
  onClick,
  loading,
  error,
  disabled,
  label = "Continue",
  mobileLabel = "Book workshop",
}: BookingCTAProps) {
  return (
    <>
      {/* Desktop CTA */}
      <div className="hidden sm:block">
        <button
          type="button"
          onClick={onClick}
          disabled={disabled || loading}
          className="flex min-h-[3rem] w-full items-center justify-center rounded-[14px] bg-white text-[#09090b] font-extrabold transition-colors hover:bg-[#e5e5e5] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <IconLoader2 size={18} className="animate-spin" />
          ) : (
            label
          )}
        </button>
        <p className="mt-2.5 text-center text-[0.7rem] font-bold text-[var(--muted,#a1a1aa)]">
          You won&apos;t be charged yet
        </p>
      </div>

      {/* Mobile CTA — shown via the mobile bottom bar in parent */}

      {/* Error message */}
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="mt-2.5 rounded-xl bg-[rgba(248,113,113,0.08)] px-3.5 py-2.5 text-[0.82rem] text-[#f87171]"
        >
          {error}
        </div>
      )}
    </>
  );
}

/**
 * Mobile bottom bar CTA — rendered fixed at viewport bottom on small screens.
 */
export function MobileBookingBar({
  onClick,
  loading,
  disabled,
  priceLabel,
  sessionLabel,
  label = "Book workshop",
}: {
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  priceLabel: string;
  sessionLabel: string;
  label?: string;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] flex items-center justify-between gap-4 border-t border-[rgba(255,255,255,0.08)] bg-[rgba(9,9,11,0.94)] px-4 py-3 sm:hidden backdrop-blur-[18px]" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
      <div className="grid min-w-0">
        <strong className="text-white">{priceLabel}</strong>
        <span className="truncate text-[0.78rem] text-[var(--muted,#a1a1aa)]">{sessionLabel}</span>
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || loading}
        className="flex min-h-[44px] shrink-0 items-center justify-center rounded-[14px] bg-white px-5 text-[0.9rem] font-extrabold text-[#09090b] transition-colors hover:bg-[#e5e5e5] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <IconLoader2 size={18} className="animate-spin" />
        ) : (
          label
        )}
      </button>
    </div>
  );
}
