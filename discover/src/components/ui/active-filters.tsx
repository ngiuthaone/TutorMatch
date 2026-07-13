"use client";

import { IconX } from "@tabler/icons-react";

interface ActiveFilter {
  key: string;
  label: string;
  value: string;
}

interface ActiveFiltersProps {
  filters: ActiveFilter[];
  onRemove: (key: string) => void;
  onClear: () => void;
}

export function ActiveFilters({ filters, onRemove, onClear }: ActiveFiltersProps) {
  if (filters.length === 0) return null;

  const labelMap: Record<string, string> = {
    online: "Online",
    inperson: "In person",
    free: "Free",
    paid: "Paid",
    all: "",
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {filters.map((f) => {
        const display = labelMap[f.value] || f.label;
        if (!display) return null;
        return (
          <span key={f.key} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-lg bg-primary/10 text-primary-dark dark:text-primary-light">
            {display}
            <button onClick={() => onRemove(f.key)} className="hover:opacity-60 transition-opacity"><IconX size={11} /></button>
          </span>
        );
      })}
      <button onClick={onClear} className="text-[11px] text-muted hover:text-foreground underline underline-offset-2 transition-colors">Clear all</button>
    </div>
  );
}
