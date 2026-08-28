"use client";

import { useCallback, useRef, useState } from "react";
import { TopNav } from "@/components/discover/top-nav";

export function PeopleBrowser() {
  const [headerHidden, setHeaderHidden] = useState(false);
  const lastScrollY = useRef(0);
  const cleanupRef = useRef<(() => void) | null>(null);

  const handleFrameLoad = useCallback((frame: HTMLIFrameElement | null) => {
    cleanupRef.current?.();
    cleanupRef.current = null;

    const frameWindow = frame?.contentWindow;
    if (!frameWindow) return;

    const onScroll = () => {
      const currentY = frameWindow.scrollY;
      const delta = currentY - lastScrollY.current;

      if (currentY < 16 || delta < -8) setHeaderHidden(false);
      else if (delta > 8) setHeaderHidden(true);

      lastScrollY.current = currentY;
    };

    lastScrollY.current = frameWindow.scrollY;
    frameWindow.addEventListener("scroll", onScroll, { passive: true });
    cleanupRef.current = () => frameWindow.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#0f0f10]">
      <div
        className={`fixed inset-x-0 top-0 z-50 transition-transform duration-300 ease-out ${
          headerHidden ? "-translate-y-full" : "translate-y-0"
        }`}
      >
        <TopNav />
      </div>
      <iframe
        ref={handleFrameLoad}
        src="/browse-tutors.html"
        title="Browse Tutors"
        className="block h-[100dvh] w-full border-0"
      />
    </main>
  );
}
