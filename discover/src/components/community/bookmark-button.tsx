"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { IconBookmark, IconBookmarkFilled } from "@tabler/icons-react";
import { addBookmark, removeBookmark, type BookmarkTarget } from "@/lib/community/bookmarks-api";
import { getSessionAccessToken } from "@/lib/auth/session";

interface BookmarkButtonProps {
  targetType: BookmarkTarget;
  targetId: string;
  initialSaved?: boolean;
  className?: string;
  showLabel?: boolean;
  iconOnly?: boolean;
}

export function BookmarkButton({
  targetType,
  targetId,
  initialSaved = false,
  className = "",
  showLabel = false,
  iconOnly = false,
}: BookmarkButtonProps) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [pending, setPending] = useState(false);

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!getSessionAccessToken()) {
      router.push("/auth/sign-in");
      return;
    }

    const previous = saved;
    setSaved(!previous);
    setPending(true);
    try {
      if (previous) {
        await removeBookmark(targetType, targetId);
      } else {
        await addBookmark(targetType, targetId);
      }
    } catch {
      setSaved(previous);
    } finally {
      setPending(false);
    }
  }, [saved, targetType, targetId, router]);

  const iconSize = iconOnly ? 14 : 13;
  const label = saved ? "Saved" : "Save";

  if (iconOnly) {
    return (
      <button
        onClick={handleClick}
        disabled={pending}
        aria-label={saved ? "Remove bookmark" : "Add bookmark"}
        className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${saved ? "text-primary" : "text-muted hover:text-foreground hover:bg-border/20"} ${className}`}
      >
        {saved ? <IconBookmarkFilled size={iconSize} /> : <IconBookmark size={iconSize} />}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${saved ? "text-primary" : "text-muted hover:text-foreground"} ${className}`}
    >
      {saved ? <IconBookmarkFilled size={iconSize} /> : <IconBookmark size={iconSize} />}
      {showLabel && <span>{label}</span>}
    </button>
  );
}
