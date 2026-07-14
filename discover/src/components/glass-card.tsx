import type { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
}

export function GlassCard({ children, className = "" }: GlassCardProps) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-[38px]",
        "border border-white/35",
        "bg-white/5 backdrop-blur-2xl",
        "shadow-xl shadow-black/10",
        "before:pointer-events-none before:absolute before:inset-0",
        "before:bg-gradient-to-br before:from-white/10 before:via-transparent before:to-transparent",
        className,
      ].join(" ")}
    >
      <div className="relative h-full">{children}</div>
    </div>
  );
}
