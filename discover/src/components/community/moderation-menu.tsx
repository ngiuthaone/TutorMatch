"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { IconDots, IconPin, IconLock, IconLockOpen, IconTrash, IconRestore } from "@tabler/icons-react";
import { pinPost, unpinPost, lockPost, unlockPost, removePost, restorePost, pinThread, unpinThread, lockThread, unlockThread, removeThread, restoreThread } from "@/lib/community/moderation-api";
import { getSessionAccessToken } from "@/lib/auth/session";

type TargetType = "post" | "thread";

interface ModerationMenuProps {
  targetType: TargetType;
  targetId: string;
  isPinned?: boolean;
  isLocked?: boolean;
  isRemoved?: boolean;
  canModerate: boolean;
  onUpdate?: () => void;
}

export function ModerationMenu({ targetType, targetId, isPinned, isLocked, isRemoved, canModerate, onUpdate }: ModerationMenuProps) {
  if (!canModerate) return null;
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handle = useCallback(async (action: () => Promise<unknown>) => {
    if (!getSessionAccessToken()) return;
    setPending(true);
    try {
      await action();
      onUpdate?.();
    } catch {
      // silently fail
    } finally {
      setPending(false);
      setOpen(false);
    }
  }, [onUpdate]);

  const isPost = targetType === "post";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(!open); }}
        className="flex items-center justify-center w-8 h-8 rounded-lg text-muted hover:text-foreground hover:bg-border/20 transition-colors"
        aria-label="Moderation actions"
      >
        <IconDots size={16} />
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-2 w-48 rounded-xl border border-border bg-background shadow-lg p-1 z-20">
          {isRemoved ? (
            <button
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); handle(() => isPost ? restorePost(targetId) : restoreThread(targetId)); }}
              disabled={pending}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg text-foreground hover:bg-surface"
            >
              <IconRestore size={13} /> Restore
            </button>
          ) : (
            <>
              {isPinned ? (
                <button
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); handle(() => isPost ? unpinPost(targetId) : unpinThread(targetId)); }}
                  disabled={pending}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg text-foreground hover:bg-surface"
                >
                  <IconPinOff size={13} /> Unpin
                </button>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); handle(() => isPost ? pinPost(targetId) : pinThread(targetId)); }}
                  disabled={pending}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg text-foreground hover:bg-surface"
                >
                  <IconPin size={13} /> Pin
                </button>
              )}
              {isLocked ? (
                <button
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); handle(() => isPost ? unlockPost(targetId) : unlockThread(targetId)); }}
                  disabled={pending}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg text-foreground hover:bg-surface"
                >
                  <IconLockOpen size={13} /> Unlock
                </button>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); handle(() => isPost ? lockPost(targetId) : lockThread(targetId)); }}
                  disabled={pending}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg text-foreground hover:bg-surface"
                >
                  <IconLock size={13} /> Lock
                </button>
              )}
              <div className="border-t border-border my-1" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (confirm("Remove this content? It will be hidden from public.")) {
                    handle(() => isPost ? removePost(targetId) : removeThread(targetId));
                  }
                }}
                disabled={pending}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10"
              >
                <IconTrash size={13} /> Remove
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function IconPinOff({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </svg>
  );
}
