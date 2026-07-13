import Link from "next/link";
import { IconArrowUpRight } from "@tabler/icons-react";

import styles from "./footer.module.css";

const groups = [
  {
    title: "Explore",
    links: [
      ["Discover", "/discover"],
      ["People", "/people"],
      ["Courses", "/courses"],
      ["Events", "/events"],
    ],
  },
  {
    title: "Community",
    links: [
      ["Discussions", "/discussions"],
      ["Communities", "/communities"],
      ["Saved", "/discussions/saved"],
      ["Write an article", "/articles/new"],
    ],
  },
  {
    title: "Begin",
    links: [
      ["Sign in", "/auth/sign-in"],
      ["Join Tutoria", "/auth/sign-up"],
      ["Become a sharer", "/auth/sign-up?intent=creator"],
    ],
  },
];

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.inner} tutoria-page-container`}>
        <div className={styles.statement}>
          <Link href="/" className={styles.wordmark}>Tutoria<sup>®</sup></Link>
          <p>One platform. Countless possibilities. Learn, share, and connect beyond the ordinary.</p>
        </div>

        <div className={styles.groups}>
          {groups.map((group) => (
            <div key={group.title}>
              <h3>{group.title}</h3>
              <ul>
                {group.links.map(([label, href]) => (
                  <li key={label}>
                    <Link href={href}>{label}<IconArrowUpRight size={13} aria-hidden="true" /></Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className={styles.bottom}>
          <span>© 2026 Tutoria</span>
          <span>Made for curious minds everywhere</span>
        </div>
      </div>
    </footer>
  );
}
