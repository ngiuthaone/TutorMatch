"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconChevronDown } from "@tabler/icons-react";
import styles from "./tutoria-navigation.module.css";

interface SubNavItem {
  label: string;
  href: string;
}

interface NavGroup {
  label: string;
  items: SubNavItem[];
  matchPatterns: string[];
}

const learnGroup: NavGroup = {
  label: "Learn",
  items: [
    { label: "Courses", href: "/courses" },
    { label: "Skills", href: "/skills" },
    { label: "For You", href: "/discover/for-you" },
  ],
  matchPatterns: ["/courses", "/skills", "/discover/for-you"],
};

const createGroup: NavGroup = {
  label: "Create",
  items: [
    { label: "Become a tutor", href: "/become-a-tutor" },
    { label: "Create an event/workshop", href: "/events/new" },
    { label: "Create a course", href: "/courses/new" },
    { label: "Write an article", href: "/articles/new" },
  ],
  matchPatterns: ["/become-a-tutor", "/events/new", "/courses/new", "/articles/new"],
};

const communityGroup: NavGroup = {
  label: "Community",
  items: [
    { label: "Discussions", href: "/discussions" },
    { label: "Communities", href: "/communities" },
    { label: "People", href: "/people" },
    { label: "Events", href: "/events" },
  ],
  matchPatterns: ["/discussions", "/communities", "/people", "/events"],
};

const navGroups = [learnGroup, createGroup, communityGroup];

function groupIsActive(pathname: string, group: NavGroup) {
  const createIsActive = createGroup.matchPatterns.some((pattern) => pathname.startsWith(pattern));

  if (group === createGroup) return createIsActive;
  if (createIsActive) return false;

  return group.matchPatterns.some((pattern) => pathname.startsWith(pattern));
}

function NavDropdown({ group }: { group: NavGroup }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const scheduleClose = () => {
    cancelClose();
    timer.current = setTimeout(() => setOpen(false), 120);
  };

  const isActive = groupIsActive(pathname, group);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className={styles.navGroup}
      onMouseEnter={() => { cancelClose(); setOpen(true); }}
      onMouseLeave={scheduleClose}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className={`${styles.navButton} ${isActive ? styles.navButtonActive : ""}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {group.label}
        <IconChevronDown
          size={14}
          stroke={1.7}
          className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
        />
      </button>
      {open && (
        <div
          role="menu"
          className={styles.dropdown}
        >
          {group.items.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`${styles.dropdownItem} ${active ? styles.dropdownItemActive : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function GlobalNavigation() {
  const pathname = usePathname();
  const homeIsActive = pathname === "/" || pathname === "/landing";
  const discoverIsActive = pathname.startsWith("/discover")
    && !navGroups.some((group) => group.matchPatterns.some((pattern) => pathname.startsWith(pattern)));

  return (
    <div className={styles.globalNavigation}>
      <nav aria-label="Primary navigation" className={styles.desktopNav}>
        <Link
          href="/landing"
          aria-current={homeIsActive ? "page" : undefined}
          className={`${styles.navLink} ${homeIsActive ? styles.navLinkActive : ""}`}
        >
          Home
        </Link>
        <Link
          href="/discover"
          aria-current={discoverIsActive ? "page" : undefined}
          className={`${styles.navLink} ${discoverIsActive ? styles.navLinkActive : ""}`}
        >
          Discover
        </Link>
        {navGroups.map((group) => (
          <NavDropdown key={group.label} group={group} />
        ))}
      </nav>
    </div>
  );
}
