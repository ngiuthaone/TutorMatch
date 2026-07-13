"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IconX, IconChevronDown } from "@tabler/icons-react";
import type { HeaderUser } from "./types";
import styles from "./tutoria-navigation.module.css";

interface MobileNavigationProps {
  open: boolean;
  onClose: () => void;
  user: HeaderUser | null;
}

const learnItems = [
  { label: "Courses", href: "/courses" },
  { label: "Skills", href: "/skills" },
  { label: "For You", href: "/discover/for-you" },
];

const communityItems = [
  { label: "Discussions", href: "/discussions" },
  { label: "Communities", href: "/communities" },
  { label: "People", href: "/people" },
  { label: "Events", href: "/events" },
];

function ExpandableSection({ label, items, onClose }: {
  label: string;
  items: { label: string; href: string }[];
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className={styles.mobileSectionButton}
        aria-expanded={expanded}
      >
        {label}
        <IconChevronDown
          size={14}
          stroke={1.7}
          className={`${styles.chevron} ${expanded ? styles.chevronOpen : ""}`}
        />
      </button>
      {expanded && (
        <div className={styles.mobileSectionItems}>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={styles.mobileSubLink}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function MobileNavigation({ open, onClose, user }: MobileNavigationProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      };
      document.addEventListener("keydown", handler);
      return () => {
        document.body.style.overflow = "";
        document.removeEventListener("keydown", handler);
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className={styles.mobileOverlay}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        id="mobile-navigation"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={styles.mobileDrawer}
      >
        <div className={styles.mobileDrawerHeader}>
          <Link href="/" onClick={onClose} className={styles.mobileWordmark}>
            <span>Tutoria</span>
            <span className={styles.brandSpark} aria-hidden="true">✦</span>
          </Link>
          <button
            onClick={onClose}
            className={styles.mobileCloseButton}
            aria-label="Close menu"
          >
            <IconX size={20} stroke={1.7} />
          </button>
        </div>

        <div className={styles.mobileBody}>
          <nav className={styles.mobileNav}>
            <p className={styles.mobileEyebrow}>Explore Tutoria</p>
            <Link
              href="/discover"
              onClick={onClose}
              className={styles.mobileNavLink}
            >
              Discover
            </Link>
            <ExpandableSection label="Learn" items={learnItems} onClose={onClose} />
            <ExpandableSection label="Community" items={communityItems} onClose={onClose} />
          </nav>

          {user ? (
            <div className={styles.mobileActions}>
              <button className={styles.mobilePrimaryAction}>
                <span>+</span>
                Create
              </button>
              <div className={styles.mobileUtilityRow}>
                <button className={styles.mobileSecondaryAction}>
                  Messages
                </button>
                <button className={styles.mobileSecondaryAction}>
                  Notifications
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.mobileActions}>
              <Link
                href="#"
                onClick={onClose}
                className={styles.mobileQuietAction}
              >
                Become a Creator
              </Link>
              <Link
                href="/auth/sign-in"
                onClick={onClose}
                className={styles.mobileSecondaryAction}
              >
                Sign in
              </Link>
              <Link href="/auth/sign-up" onClick={onClose} className={styles.mobilePrimaryAction}>
                Join Tutoria
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
