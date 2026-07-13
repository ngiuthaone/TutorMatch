"use client";

import { useState, useRef, useEffect } from "react";
import { IconArrowsUpDown } from "@tabler/icons-react";

interface SortOption {
  value: string;
  label: string;
}

interface SortDropdownProps {
  value: string;
  options: SortOption[];
  onChange: (value: string) => void;
}

export function SortDropdown({ value, options, onChange }: SortDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  const scheduleClose = () => { cancelClose(); timer.current = setTimeout(() => setOpen(false), 150); };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative" onMouseEnter={cancelClose} onMouseLeave={scheduleClose}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-foreground hover:bg-surface transition-colors"
      >
        <IconArrowsUpDown size={13} className="text-muted" />
        <span>Sort: <span className="font-semibold">{current?.label ?? value}</span></span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 min-w-[160px] rounded-xl border border-border bg-background shadow-lg p-1 z-30">
          {options.map((opt) => {
            const sel = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors ${
                  sel ? "bg-primary/10 text-primary-dark dark:text-primary-light font-medium" : "text-foreground hover:bg-surface"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
