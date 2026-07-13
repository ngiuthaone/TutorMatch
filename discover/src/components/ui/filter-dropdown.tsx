"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { IconChevronDown } from "@tabler/icons-react";

export interface FilterOption {
  value: string;
  label: string;
}

interface FilterDropdownProps {
  icon?: ReactNode;
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}

export function FilterDropdown({ icon, label, value, options, onChange }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isActive = value !== options[0]?.value;

  return (
    <div ref={ref} className="relative" onMouseEnter={cancelClose} onMouseLeave={scheduleClose}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={cancelClose}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg border transition-all cursor-default
          ${isActive ? "border-primary bg-primary/10 text-primary-dark dark:text-primary-light" : "border-transparent text-muted hover:border-border"}`}
      >
        {icon}<span>{value ? options.find((o) => o.value === value)?.label ?? label : label}</span>
        <IconChevronDown size={14} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 min-w-[140px] rounded-xl border border-border bg-background shadow-lg p-1 z-30">
          {options.map((opt) => {
            const selected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); cancelClose(); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors
                  ${selected ? "bg-primary/10 text-primary-dark dark:text-primary-light font-medium" : "text-foreground hover:bg-surface"}`}
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
