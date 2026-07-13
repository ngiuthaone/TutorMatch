"use client";

import type { ReactNode } from "react";

interface FilterSectionProps {
  title: string;
  children: ReactNode;
}

export function FilterSection({ title, children }: FilterSectionProps) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-foreground mb-3">{title}</h3>
      <div className="space-y-1.5">
        {children}
      </div>
    </div>
  );
}

interface FilterCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  count?: number;
}

export function FilterCheckbox({ checked, onChange, label, count }: FilterCheckboxProps) {
  return (
    <label className="flex items-center gap-2.5 px-1 py-1 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary/30 focus:ring-2 accent-primary"
      />
      <span className="text-xs text-foreground group-hover:text-primary transition-colors">{label}</span>
      {count !== undefined && <span className="ml-auto text-[11px] text-muted">{count}</span>}
    </label>
  );
}

interface FilterRadioProps {
  selected: boolean;
  onSelect: () => void;
  label: string;
  name: string;
}

export function FilterRadio({ selected, onSelect, label, name }: FilterRadioProps) {
  return (
    <label className="flex items-center gap-2.5 px-1 py-1 cursor-pointer group">
      <input
        type="radio"
        name={name}
        checked={selected}
        onChange={onSelect}
        className="w-3.5 h-3.5 text-primary focus:ring-primary/30 accent-primary"
      />
      <span className="text-xs text-foreground group-hover:text-primary transition-colors">{label}</span>
    </label>
  );
}
