"use client";

import { useEffect, useRef, useState } from "react";
import { TopNav } from "@/components/discover/top-nav";

export function CoursesEmbed() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastScrollY = useRef(0);
  const [headerHidden, setHeaderHidden] = useState(false);
  const headerHeight = 86;

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type !== "tutoria-courses-scroll") return;

      const y = Number(event.data.y) || 0;
      const delta = y - lastScrollY.current;

      if (y < 16 || delta < -8) setHeaderHidden(false);
      else if (delta > 8) setHeaderHidden(true);

      lastScrollY.current = y;
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div
      className="relative min-h-[100dvh] overflow-hidden bg-[#08090a]"
      style={{ colorScheme: "dark" }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10"
        style={{
          height: headerHeight,
          transform: headerHidden ? "translateY(-100%)" : "translateY(0)",
          transition: "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div className="pointer-events-auto">
          <TopNav />
        </div>
      </div>
      <iframe
        ref={iframeRef}
        src="/courses-reference.html"
        title="Courses"
        style={{
          width: "100%",
          height: "100dvh",
          border: 0,
          display: "block",
          background: "#08090a",
        }}
      />
    </div>
  );
}
