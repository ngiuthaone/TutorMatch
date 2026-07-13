"use client";

import { useEffect, type ReactNode } from "react";
import { IconX } from "@tabler/icons-react";

interface FilterDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  resultCount: number;
  onClear: () => void;
  children: ReactNode;
}

export function FilterDrawer({ open, onClose, title, resultCount, onClear, children }: FilterDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={onClose} />}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-background border-l border-border z-50 shadow-2xl transform transition-transform duration-300 flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors">
            <IconX size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {children}
        </div>

        <div className="px-5 py-4 border-t border-border flex items-center justify-between shrink-0 bg-background">
          <button onClick={onClear} className="text-xs text-muted hover:text-foreground underline underline-offset-2 transition-colors">
            Clear all
          </button>
          <button onClick={onClose} className="px-4 py-2 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary-dark transition-colors">
            Show {resultCount} result{resultCount !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </>
  );
}
