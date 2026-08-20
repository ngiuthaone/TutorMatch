"use client";

import { IconShieldCheck } from "@tabler/icons-react";

interface PriceSummaryProps {
  unitPrice?: number | null;
  quantity: number;
  serverTotal?: number | null;
  policy?: string;
}

const formatVnd = (amount: number): string =>
  `${new Intl.NumberFormat("vi-VN").format(amount)} \u0111`;

export function PriceSummary({
  unitPrice,
  quantity,
  serverTotal,
  policy,
}: PriceSummaryProps) {
  const isFree = unitPrice === 0;
  const isUnknown = unitPrice === null || unitPrice === undefined;
  const multiple = quantity > 1;

  return (
    <div className="space-y-0">
      {/* Subtotal line (only for multi-participant paid workshops) */}
      {multiple && !isFree && !isUnknown && (
        <div className="flex items-end justify-between gap-4 border-t border-[rgba(255,255,255,0.08)] px-5 pt-4 pb-0">
          <span className="text-[0.82rem] text-[var(--muted,#a1a1aa)]">
            Subtotal ({quantity} \u00D7 {formatVnd(unitPrice)})
          </span>
          <span className="text-[0.82rem] text-[var(--muted,#a1a1aa)]">
            {formatVnd(unitPrice * quantity)}
          </span>
        </div>
      )}

      {/* Total / price display */}
      <div className="flex items-end justify-between gap-4 border-t border-[rgba(255,255,255,0.08)] px-5 pt-4 pb-0">
        {isFree ? (
          <span className="text-[0.82rem] text-[var(--muted,#a1a1aa)]">
            Total for {quantity} guest{quantity === 1 ? "" : "s"}
          </span>
        ) : isUnknown ? (
          <span className="text-[0.82rem] text-[var(--muted,#a1a1aa)]">
            Price to be confirmed
          </span>
        ) : (
          <span className="text-[0.82rem] text-[var(--muted,#a1a1aa)]">
            Total for {quantity} guest{quantity === 1 ? "" : "s"}
          </span>
        )}
        <span className="text-[1.35rem] font-bold tracking-tight text-white">
          {isFree ? (
            "Free"
          ) : isUnknown ? (
            "\u2014"
          ) : (
            serverTotal != null ? (
              <span title="Server-confirmed total">{formatVnd(serverTotal)}</span>
            ) : (
              <span title="Estimated total">{formatVnd(unitPrice * quantity)}</span>
            )
          )}
        </span>
      </div>

      {/* Estimate label (only when client-calculated) */}
      {!isFree && !isUnknown && serverTotal === null && (
        <div className="px-5 pt-1 text-right text-[0.6875rem] text-[var(--quiet,#71717a)]">
          Estimate \u00B7 final price confirmed by server
        </div>
      )}

      {/* Cancellation policy */}
      {policy && (
        <div className="flex gap-2.5 border-t border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.1)] px-5 py-3.5 text-[0.78rem] leading-relaxed text-[var(--muted,#a1a1aa)]">
          <IconShieldCheck size={16} className="mt-0.5 shrink-0 text-[var(--accent,#d6c1ad)]" />
          <span>{policy}</span>
        </div>
      )}
    </div>
  );
}
