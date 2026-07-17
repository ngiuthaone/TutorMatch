"use client";

import { useState, useCallback, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { IconMenu2, IconX, IconBell } from "@tabler/icons-react";
import { GlobalNavigation } from "./global-navigation";
import { UserMenu } from "./user-menu";
import { MobileNavigation } from "./mobile-navigation";
import type { HeaderUser } from "./types";
import styles from "./tutoria-navigation.module.css";

interface DiscoverHeaderProps {
  user?: HeaderUser | null;
}

function parseStoredUser(raw: string | null): HeaderUser | null {
  try {
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.completed) {
        return { id: parsed.email || "1", name: parsed.name || "Learner", isCreator: false };
      }
    }
  } catch {}
  return null;
}

function subscribeToSignup(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getSignupSnapshot() {
  return localStorage.getItem("tutoria_signup");
}

function getServerSignupSnapshot() {
  return null;
}

export function DiscoverHeader({ user: userProp }: DiscoverHeaderProps) {
  const storedSignup = useSyncExternalStore(
    subscribeToSignup,
    getSignupSnapshot,
    getServerSignupSnapshot,
  );
  const storedUser = useMemo(() => parseStoredUser(storedSignup), [storedSignup]);
  const user = userProp !== undefined ? userProp : storedUser;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <GlobalNavigation />

        <div className={styles.actions}>
          {user ? (
            <UserMenu user={user} />
          ) : (
            <>
              <Link href="/auth/sign-up?intent=creator" className={styles.creatorLink}>
                Become a Creator
              </Link>
              <Link href="/auth/sign-in" className={`${styles.signInLink} ${styles.desktopOnly}`}>
                Sign in
              </Link>
              <Link href="/auth/sign-up" className={`${styles.joinLink} ${styles.desktopOnly}`}>
                Join Tutoria
              </Link>
            </>
          )}

          {user && (
            <button className={`${styles.iconButton} ${styles.mobileNotification}`} aria-label="Notifications">
              <IconBell size={19} stroke={1.7} />
            </button>
          )}

          {!user && (
            <Link href="/auth/sign-in" className={styles.mobileSignIn}>
              Sign in
            </Link>
          )}

          <button
            className={styles.mobileMenuButton}
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
          >
            {mobileMenuOpen ? <IconX size={20} stroke={1.7} /> : <IconMenu2 size={20} stroke={1.7} />}
          </button>
        </div>
      </div>

      <MobileNavigation
        open={mobileMenuOpen}
        onClose={closeMobileMenu}
        user={user}
      />
    </header>
  );
}
