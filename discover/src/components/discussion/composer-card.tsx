"use client";

import { useSyncExternalStore } from "react";
import { getUserFromStorage } from "@/lib/types";
import styles from "@/components/discover/discussions.module.css";

interface ComposerCardProps {
  onOpenPost: (preselectType?: string) => void;
}

export function ComposerCard({ onOpenPost }: ComposerCardProps) {
  const signupSnapshot = useSyncExternalStore(
    (onChange) => { window.addEventListener("storage", onChange); return () => window.removeEventListener("storage", onChange); },
    () => localStorage.getItem("tutoria_signup"),
    () => null,
  );
  const user = signupSnapshot ? getUserFromStorage() : null;

  if (!user) {
    return (
      <div className={styles.guestComposer}>
        <p><strong>Join Tutoria</strong> to share what you know and join the discussion.</p>
        <div className={styles.guestActions}>
          <a href="/auth/sign-in">Sign in</a>
          <a href="/auth/sign-up">Join Tutoria</a>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.composer}>
      <div className={styles.composerRow}>
        <div className={styles.avatarFallback} aria-hidden="true">{user.name.charAt(0).toUpperCase()}</div>
        <button onClick={() => onOpenPost()} className={styles.composerPrompt}>Start a discussion…</button>
        <button onClick={() => onOpenPost()} className={styles.postButton}>Post</button>
      </div>
    </div>
  );
}
