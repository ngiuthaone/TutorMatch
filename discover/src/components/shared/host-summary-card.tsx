"use client";

import Link from "next/link";
import { IconMessageCircle, IconShieldCheck, IconStarFilled } from "@tabler/icons-react";

interface HostSummaryCardProps {
  name: string;
  avatarUrl?: string;
  role?: string;
  bio?: string;
  rating?: number;
  reviewCount?: number;
  profileUrl?: string;
}

function initialsAvatar(displayName: string): string {
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2) || "T";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="#17181c"/><text x="400" y="440" font-family="Arial, Helvetica, sans-serif" font-size="300" font-weight="600" fill="#e8e6df" text-anchor="middle">${initials.replace(/[<>&"]/g, "")}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

export function HostSummaryCard({
  name,
  avatarUrl,
  role,
  bio,
  rating,
  reviewCount,
  profileUrl,
}: HostSummaryCardProps) {
  const imgSrc = avatarUrl || initialsAvatar(name);

  return (
    <div className="rounded-[32px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-8">
      <span className="block text-[0.6875rem] font-bold uppercase tracking-[0.18em] text-[var(--quiet,#71717a)]">
        Host
      </span>

      <div className="mt-5 flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt={name}
          width={76}
          height={76}
          className="h-[76px] w-[76px] shrink-0 rounded-full border border-[rgba(255,255,255,0.08)] object-cover"
        />
        <div className="min-w-0">
          <h2 className="text-[1.65rem] font-semibold tracking-tight text-white">{name}</h2>
          {role && <p className="mt-0.5 text-[0.88rem] text-[var(--muted,#a1a1aa)]">{role}</p>}
        </div>
      </div>

      {bio && (
        <p className="mt-4 leading-relaxed text-[var(--muted,#a1a1aa)]">{bio}</p>
      )}

      {(rating != null || reviewCount != null) && (
        <div className="mt-5 flex flex-wrap gap-3">
          {rating != null && (
            <span className="inline-flex items-center gap-1 text-[0.88rem] text-[#d8d8dc]">
              <IconStarFilled size={15} className="text-[var(--accent,#d6c1ad)]" />
              {rating}{reviewCount != null && ` (${reviewCount})`}
            </span>
          )}
          {rating != null && (
            <span className="inline-flex items-center gap-1 text-[0.88rem] text-[#d8d8dc]">
              <IconShieldCheck size={15} className="text-[var(--accent,#d6c1ad)]" />
              Verified host
            </span>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {profileUrl && (
          <Link
            href={profileUrl}
            className="inline-flex min-h-[42px] items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.025)] px-4 text-[0.875rem] font-semibold text-[var(--muted,#a1a1aa)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-white"
          >
            View profile
          </Link>
        )}
        <button
          type="button"
          className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.025)] px-4 text-[0.875rem] font-semibold text-[var(--muted,#a1a1aa)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-white"
        >
          <IconMessageCircle size={15} /> Message host
        </button>
      </div>
    </div>
  );
}
