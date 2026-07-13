"use client";

import { useEffect, useRef, useCallback } from "react";

const starData = [
  { cx: 120, cy: 60, r: 1.5, delay: 0 },
  { cx: 280, cy: 100, r: 1, delay: 0.3 },
  { cx: 180, cy: 180, r: 2, delay: 0.6 },
  { cx: 350, cy: 50, r: 1.2, delay: 0.9 },
  { cx: 400, cy: 140, r: 0.8, delay: 1.2 },
  { cx: 220, cy: 240, r: 1.8, delay: 1.5 },
  { cx: 80, cy: 200, r: 1, delay: 1.8 },
  { cx: 320, cy: 220, r: 1.3, delay: 2.1 },
  { cx: 150, cy: 300, r: 0.9, delay: 2.4 },
  { cx: 380, cy: 280, r: 1.6, delay: 2.7 },
  { cx: 260, cy: 320, r: 1.1, delay: 3.0 },
  { cx: 50, cy: 120, r: 1.4, delay: 3.3 },
  { cx: 440, cy: 200, r: 0.7, delay: 3.6 },
  { cx: 100, cy: 340, r: 1.2, delay: 3.9 },
  { cx: 300, cy: 40, r: 1, delay: 4.2 },
];

export function CosmicScene() {
  const svgRef = useRef<SVGSVGElement>(null);

  const brightenStars = useCallback(() => {
    if (!svgRef.current) return;
    const stars = svgRef.current.querySelectorAll<SVGCircleElement>(".auth-star");
    stars.forEach((s, i) => {
      setTimeout(() => {
        s.style.opacity = "1";
        s.style.transition = "opacity 0.6s ease";
      }, i * 30);
    });
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;
    const stars = svgRef.current.querySelectorAll<SVGCircleElement>(".auth-star");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            stars.forEach((s) => {
              s.style.opacity = "1";
            });
          }
        });
      },
      { threshold: 0.3 }
    );
    observer.observe(svgRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const emailInput = document.querySelector("input[type=email]");
    if (!emailInput) return;

    const handleFocus = () => brightenStars();

    emailInput.addEventListener("focus", handleFocus);
    return () => emailInput.removeEventListener("focus", handleFocus);
  }, [brightenStars]);

  return (
    <div className="relative w-full h-full min-h-[400px] lg:min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary/5 via-primary/10 to-primary/20 dark:from-primary-dark/20 dark:via-primary/10 dark:to-primary-dark/30">
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 500 400"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="planet-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--primary-light)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--primary-light)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="planet-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#89B0C4" />
            <stop offset="50%" stopColor="#6B8E9E" />
            <stop offset="100%" stopColor="#3D6A7E" />
          </linearGradient>
        </defs>

        <circle cx="350" cy="180" r="80" fill="url(#planet-glow)" />
        <circle cx="350" cy="180" r="35" fill="url(#planet-grad)" opacity="0.6" />
        <ellipse cx="350" cy="180" rx="38" ry="6" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" transform="rotate(-15 350 180)" />

        {starData.map((star) => (
          <circle
            key={star.cx}
            className="auth-star"
            cx={star.cx}
            cy={star.cy}
            r={star.r}
            fill="white"
            style={{ opacity: 0.4, transition: `opacity 0.8s ease ${star.delay}s` }}
          />
        ))}

        {starData.slice(0, 4).map((star) => (
          <circle
            key={`glow-${star.cx}`}
            cx={star.cx}
            cy={star.cy}
            r={star.r * 3}
            fill="white"
            style={{ opacity: 0.08, transition: `opacity 0.8s ease ${star.delay}s` }}
          />
        ))}
      </svg>

      <div className="relative z-10 px-8 lg:px-16 max-w-md">
        <p className="text-xl md:text-2xl font-medium text-primary-dark dark:text-primary-light leading-relaxed">
          Your next discovery is waiting.
        </p>
        <p className="mt-4 text-sm text-muted leading-relaxed">
          Pick up where you left off, continue a course, reconnect with your community, or explore something entirely new.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          {["Continue learning", "Share knowledge", "Find your people"].map((msg) => (
            <span
              key={msg}
              className="px-3 py-1.5 text-xs rounded-full bg-primary/10 dark:bg-primary/15 text-primary-dark dark:text-primary-light border border-primary/20"
            >
              {msg}
            </span>
          ))}
        </div>

        <div className="mt-6 text-xs text-muted leading-relaxed max-w-xs">
          <p className="italic">Curiosity brought you here. Let us keep going.</p>
        </div>
      </div>
    </div>
  );
}
