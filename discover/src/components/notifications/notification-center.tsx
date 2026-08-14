"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  IconBell,
  IconCalendarEvent,
  IconMessageCircle,
  IconStar,
  IconBook2,
  IconCheck,
} from "@tabler/icons-react";
import { isLiveMode } from "@/lib/auth/config";
import {
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  seedDemoNotifications,
  useNotifications,
  formatNotificationTime,
  type NotificationItem,
  type NotificationType,
  type NotificationMode,
} from "@/lib/notifications";
import type { HeaderUser } from "../header/types";
import navStyles from "../header/tutoria-navigation.module.css";
import styles from "./notification-center.module.css";

interface NotificationCenterProps {
  user: HeaderUser;
  mobile?: boolean;
}

const TYPE_ICONS: Record<NotificationType, typeof IconBell> = {
  session: IconCalendarEvent,
  review: IconStar,
  discussion: IconMessageCircle,
  course: IconBook2,
};

function timeAgo(iso: string): string {
  return formatNotificationTime(iso);
}

export function NotificationCenter({ user, mobile = false }: NotificationCenterProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const ref = useRef<HTMLDivElement>(null);
  const mode: NotificationMode = isLiveMode() ? "live" : "demo";
  const notifications = useNotifications(user.id, mode);
  const unreadCount = getUnreadCount(user.id, mode);

  useEffect(() => {
    if (!isLiveMode()) seedDemoNotifications(user.id);
  }, [user.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [open]);

  const openItem = useCallback(
    (item: NotificationItem) => {
      if (!item.read) markNotificationRead(user.id, item.id, mode);
      if (item.href) {
        setOpen(false);
        void router.push(item.href);
      }
    },
    [mode, router, user.id],
  );

  const visible = tab === "unread" ? notifications.filter((n) => !n.read) : notifications;

  return (
    <div ref={ref} className={mobile ? styles.anchorMobile : styles.anchor}>
      <button
        type="button"
        className={`${navStyles.iconButton} ${mobile ? navStyles.mobileNotification : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <IconBell size={19} stroke={1.7} />
        {unreadCount > 0 && (
          <span className={navStyles.notificationBadge}>{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifications" className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Notifications</h2>
            {unreadCount > 0 && (
              <button
                type="button"
                className={styles.markAll}
                onClick={() => markAllNotificationsRead(user.id, mode)}
              >
                <IconCheck size={14} stroke={2} />
                Mark all read
              </button>
            )}
          </div>

          <div className={styles.tabs} role="tablist" aria-label="Filter notifications">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "all"}
              className={`${styles.tab} ${tab === "all" ? styles.tabActive : ""}`}
              onClick={() => setTab("all")}
            >
              All
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "unread"}
              className={`${styles.tab} ${tab === "unread" ? styles.tabActive : ""}`}
              onClick={() => setTab("unread")}
            >
              Unread{unreadCount > 0 ? ` (${unreadCount})` : ""}
            </button>
          </div>

          <ul className={styles.list} aria-live="polite">
            {visible.length === 0 ? (
              <li className={styles.empty}>
                {tab === "unread"
                  ? "No unread notifications."
                  : "No notifications yet."}
              </li>
            ) : (
              visible.map((item) => {
                const Icon = TYPE_ICONS[item.type] ?? IconBell;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`${styles.item} ${item.read ? styles.itemRead : ""}`}
                      onClick={() => openItem(item)}
                    >
                      <span className={styles.itemIcon}>
                        <Icon size={16} stroke={1.7} />
                      </span>
                      <span className={styles.itemBody}>
                        <span className={styles.itemTitle}>
                          {item.title}
                          {!item.read && <span className={styles.unreadDot} />}
                        </span>
                        {item.body && <span className={styles.itemText}>{item.body}</span>}
                        <span className={styles.itemTime}>{timeAgo(item.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
