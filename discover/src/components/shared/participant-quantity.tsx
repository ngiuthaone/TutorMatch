"use client";

import { IconMinus, IconPlus, IconUsers } from "@tabler/icons-react";

interface ParticipantQuantityProps {
  min?: number;
  max: number;
  value: number;
  onChange: (qty: number) => void;
  disabled?: boolean;
}

const HARD_CAP = 100;

export function ParticipantQuantity({
  min = 1,
  max,
  value,
  onChange,
  disabled,
}: ParticipantQuantityProps) {
  const effectiveMax = Math.min(max, HARD_CAP);
  const canDecrement = value > min && !disabled;
  const canIncrement = value < effectiveMax && !disabled;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-2.5">
      <span className="flex items-center gap-3 min-w-0 flex-1">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[rgba(255,255,255,0.05)] text-[var(--muted,#a1a1aa)]">
          <IconUsers size={17} />
        </span>
        <span className="min-w-0">
          <span className="block text-[0.625rem] font-extrabold uppercase tracking-[0.14em] text-[var(--quiet,#71717a)]">
            Participants
          </span>
          <span className="mt-0.5 block text-[0.9rem] font-semibold text-white">
            {value} guest{value === 1 ? "" : "s"}
          </span>
        </span>
      </span>
      <div className="flex shrink-0 items-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.2)] p-0.5">
        <button
          type="button"
          aria-label="Remove participant"
          disabled={!canDecrement}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="grid h-11 w-11 place-items-center rounded-full text-[var(--muted,#a1a1aa)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <IconMinus size={15} />
        </button>
        <output
          aria-live="polite"
          className="w-7 text-center text-[0.9rem] font-bold text-white"
        >
          {value}
        </output>
        <button
          type="button"
          aria-label="Add participant"
          disabled={!canIncrement}
          onClick={() => onChange(Math.min(effectiveMax, value + 1))}
          className="grid h-11 w-11 place-items-center rounded-full text-[var(--muted,#a1a1aa)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <IconPlus size={15} />
        </button>
      </div>
    </div>
  );
}
