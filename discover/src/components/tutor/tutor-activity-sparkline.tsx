"use client";

import { useEffect, useState } from "react";

interface ActivityData {
  daily: Array<{ date: string; views: number }>;
}

// Tutoria-native: 30-day rolling profile view sparkline for the public tutor profile page.
// Pattern adapted from NextTutor's TutorActivityGraph (MIT). Reimplemented under Tutoria's own
// visual language (charcoal/border radius tokens). Gracefully renders nothing when there is
// no data, no API configured, or the underlying `tutor_views` table is absent.
export function TutorActivitySparkline({ tutorProfileId }: { tutorProfileId: string }) {
  const [data, setData] = useState<ActivityData | null>(null);

  useEffect(() => {
    if (!tutorProfileId) return;
    let cancelled = false;
    fetch(`/api/v1/tutor-activity?tutorProfileId=${encodeURIComponent(tutorProfileId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        /* no-op: the component simply renders nothing */
      });
    return () => {
      cancelled = true;
    };
  }, [tutorProfileId]);

  if (!data || !Array.isArray(data.daily) || data.daily.length === 0) return null;
  const values = data.daily.map((d) => d.views);
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const max = Math.max(...values, 1);
  const width = 200;
  const height = 40;
  const padding = 2;
  const points = values.map((v, i) => {
    const x = padding + (i / Math.max(values.length - 1, 1)) * (width - 2 * padding);
    const y = height - padding - (v / max) * (height - 2 * padding);
    return `${x},${y}`;
  });
  const linePath = `M ${points.join(" L ")}`;
  const areaPath = `${linePath} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 md:p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
          <span aria-hidden>📈</span>Profile Activity
        </h2>
        <span className="text-[11px] text-zinc-500">Last 30 days</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-10"
        role="img"
        aria-label={`${total} profile views in the last 30 days`}
      >
        <defs>
          <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#sparkFill)" />
        <path d={linePath} fill="none" stroke="rgb(16, 185, 129)" strokeWidth="1.5" />
      </svg>
    </div>
  );
}
