"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  IconUser,
  IconBook2,
  IconCalendarEvent,
  IconHeart,
  IconSparkles,
  IconSettings,
  IconHelpCircle,
  IconLogout,
  IconMessage,
  IconBell,
} from "@tabler/icons-react";
import Link from "next/link";
import type { HeaderUser } from "./types";
import styles from "./tutoria-navigation.module.css";

interface UserMenuProps {
  user: HeaderUser;
}

export function UserMenu({ user }: UserMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    if (menuOpen) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [menuOpen, close]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    if (menuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen, close]);

  const profileHref = `/profile/${encodeURIComponent(user.name)}`;

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : null;



  const items = [
    { icon: IconUser, label: "View profile", href: profileHref },
    { icon: IconBook2, label: "My learning", href: "/learning" },
    { icon: IconCalendarEvent, label: "My bookings", href: "/bookings" },
    { icon: IconHeart, label: "Saved", href: "/saved" },
    ...(user.isCreator
      ? [{ icon: IconSparkles, label: "Creator dashboard", href: "/dashboard" as const }]
      : [{ icon: IconSparkles, label: "Start creating", href: "/auth/sign-up?intent=creator" as const }]),
    { icon: IconSettings, label: "Settings", href: "/settings" },
    { icon: IconHelpCircle, label: "Help", href: "/help" },
    { icon: IconLogout, label: "Sign out", href: "/auth/sign-in" },
  ];

  return (
    <>
      {/* Messages */}
      <button
        className={styles.iconButton}
        aria-label="Messages"
      >
        <IconMessage size={19} stroke={1.7} />
        {typeof user.unreadMessages === "number" && user.unreadMessages > 0 && (
          <span className={styles.notificationBadge}>
            {user.unreadMessages > 9 ? "9+" : user.unreadMessages}
          </span>
        )}
      </button>

      {/* Notifications */}
      <button
        className={styles.iconButton}
        aria-label="Notifications"
      >
        <IconBell size={19} stroke={1.7} />
        {typeof user.unreadNotifications === "number" && user.unreadNotifications > 0 && (
          <span className={styles.notificationDot} />
        )}
      </button>

      {/* Avatar */}
      <div ref={ref} className={styles.menuAnchor}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className={styles.avatarButton}
          aria-label="User menu"
          aria-expanded={menuOpen}
          aria-haspopup="true"
        >
          {user.avatarUrl ? (
            // User avatars can be remote or local data URLs, so they intentionally bypass Next's host allowlist.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt={user.name}
              className={styles.avatarImage}
            />
          ) : initials ? (
            <span>{initials}</span>
          ) : (
            <IconUser size={18} stroke={1.7} />
          )}
        </button>
        {menuOpen && (
          <div
            role="menu"
            className={styles.userDropdown}
          >
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  role="menuitem"
                  onClick={close}
                  className={styles.userMenuItem}
                >
                  <Icon size={16} stroke={1.7} className={styles.menuIcon} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
