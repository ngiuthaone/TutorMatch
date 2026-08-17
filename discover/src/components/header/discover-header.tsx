"use client";

import { useState, useCallback, useMemo, useSyncExternalStore, useEffect, useRef } from "react";
import Link from "next/link";
import { IconMenu2, IconX } from "@tabler/icons-react";
import { GlobalNavigation } from "./global-navigation";
import { UserMenu } from "./user-menu";
import { NotificationCenter } from "../notifications/notification-center";
import { MobileNavigation } from "./mobile-navigation";
import { getLiveIdentity, subscribeToIdentity } from "@/lib/auth/identity";
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
  const liveIdentity = useSyncExternalStore(
    subscribeToIdentity,
    getLiveIdentity,
    () => null,
  );
  const storedUser = useMemo(() => parseStoredUser(storedSignup), [storedSignup]);
  const liveUser: HeaderUser | null = liveIdentity
    ? { id: liveIdentity.id, name: liveIdentity.name, avatarUrl: liveIdentity.avatarUrl, isCreator: liveIdentity.role === "tutor" }
    : null;
  const user = userProp !== undefined ? userProp : (liveUser ?? storedUser);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  const lastScrollY = useRef(0);
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY.current;
      if (currentY < 16 || delta < -8) setHeaderHidden(false);
      else if (delta > 8 && !mobileMenuOpen) setHeaderHidden(true);
      lastScrollY.current = currentY;
    };
    lastScrollY.current = window.scrollY;
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [mobileMenuOpen]);

  return (
    <header className={`${styles.header} ${headerHidden ? styles.headerHidden : ""}`}>
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
            <NotificationCenter user={user} mobile />
          )}

          {!user && (
            <Link href="/auth/sign-in" className={styles.mobileSignIn}>
              Sign in
            </Link>
          )}

          <button
            className={styles.mobileMenuButton}
            onClick={() => {
              setMobileMenuOpen((v) => !v);
              setHeaderHidden(false);
            }}
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
