"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { IconPlus, IconFileText, IconChalkboardTeacher, IconUsers } from "@tabler/icons-react";
import styles from "./tutoria-navigation.module.css";

const createGroups = [
  {
    label: "Share knowledge",
    items: [
      { icon: IconFileText, label: "Write a post", href: "#" },
    ],
  },
  {
    label: "Offer something",
    items: [
      { icon: IconChalkboardTeacher, label: "Offer a session", href: "#" },
    ],
  },
  {
    label: "Build connections",
    items: [
      { icon: IconUsers, label: "Create a community", href: "#" },
    ],
  },
];

export function CreateMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, close]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);

  return (
    <div ref={ref} className={`${styles.menuAnchor} ${styles.desktopOnly}`}>
      <button
        className={styles.createButton}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="create-menu"
        aria-haspopup="true"
      >
        <IconPlus size={16} stroke={1.8} className={styles.createIcon} />
        Create
      </button>
      {open && (
        <div
          id="create-menu"
          role="menu"
          className={styles.createDropdown}
        >
          {createGroups.map((group) => (
            <div key={group.label}>
              <p className={styles.menuEyebrow}>
                {group.label}
              </p>
              {group.items.map((item) => (
                <button
                  key={item.label}
                  role="menuitem"
                  className={styles.createItem}
                >
                  <item.icon size={16} stroke={1.7} className={styles.menuIcon} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
