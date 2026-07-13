"use client";

import { useEffect, useRef } from "react";

interface CollapsibleHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function CollapsibleHeader({ children, className }: CollapsibleHeaderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const lastScroll = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const header = el.firstElementChild as HTMLElement | null;
    if (!header) return;

    header.style.transition = "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)";
    header.style.willChange = "transform";
    lastScroll.current = window.scrollY;

    const handler = () => {
      const current = window.scrollY;
      const delta = current - lastScroll.current;

      if (current <= 24) {
        header.style.transform = "";
      } else if (delta > 0 && current > 96) {
        header.style.transform = "translate3d(0, -100%, 0)";
      } else if (delta < 0) {
        header.style.transform = "";
      }

      lastScroll.current = current;
    };

    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return <div ref={ref} className={className}>{children}</div>;
}
